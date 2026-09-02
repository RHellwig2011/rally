import { NextRequest, NextResponse } from 'next/server';
import { checkCsrf } from "@/lib/csrf";
import { getUserFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { sendEmail } from '@/lib/services/email';
import { sendSMS, sendBulkSMS, sendVideoSMS } from '@/lib/services/sms';
import { partitionSuppressed } from '@/lib/suppression';

// The outreach UI always posts every recipient row as
// { name, email, phone } and leaves the unused channel as "". Zod's
// .optional() only admits undefined, so blank strings must be normalised to
// undefined before validation or SMS-only sends fail with a 400.
const blankToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

/**
 * Recipient addresses on this route come from the request body rather than
 * from stored Contacts, and the body is interpolated into email sent from our
 * verified domain. Without hard caps that is a turnkey phishing relay, so the
 * limits mirror the sibling route (app/api/campaigns/[campaignId]/send-outreach).
 */
const MAX_RECIPIENTS_PER_REQUEST = 500;
const MAX_MESSAGE_LENGTH = 10000;
const MAX_SUBJECT_LENGTH = 200;
const MAX_NAME_LENGTH = 200;

const sendOutreachSchema = z.object({
  type: z.enum(['email', 'sms', 'both']),
  recipients: z.array(z.object({
    name: z.preprocess(blankToUndefined, z.string().max(MAX_NAME_LENGTH).optional()),
    email: z.preprocess(blankToUndefined, z.string().email().max(320).optional()),
    phone: z.preprocess(blankToUndefined, z.string().max(32).optional()),
  })).min(1).max(MAX_RECIPIENTS_PER_REQUEST),
  subject: z.string().max(MAX_SUBJECT_LENGTH).optional(),
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  // Only http(s) media may be embedded — an arbitrary URL scheme in an <a>/
  // <source> is an injection vector, not a video.
  videoUrl: z
    .string()
    .url()
    .refine((v) => /^https?:\/\//i.test(v), 'Video URL must be http or https')
    .optional(),
  schedule: z.string().datetime().optional(), // For future scheduling feature
}).superRefine((data, ctx) => {
  // Every recipient needs at least one contact method, and the request as a
  // whole needs at least one recipient reachable on a channel the caller
  // actually asked for. Without this the route happily returns success with
  // zero sends (e.g. type: 'sms' where no row carries a phone number).
  data.recipients.forEach((recipient, index) => {
    if (!recipient.email && !recipient.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recipients', index],
        message: 'Each recipient needs an email address or a phone number',
      });
    }
  });

  const wantsEmail = data.type === 'email' || data.type === 'both';
  const wantsSms = data.type === 'sms' || data.type === 'both';
  const reachable = data.recipients.some(
    (r) => (wantsEmail && !!r.email) || (wantsSms && !!r.phone)
  );

  if (!reachable) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['recipients'],
      message:
        data.type === 'email'
          ? 'At least one recipient must have an email address'
          : data.type === 'sms'
          ? 'At least one recipient must have a phone number'
          : 'At least one recipient must have an email address or a phone number',
    });
  }
});

/**
 * Escape text before interpolating it into email HTML. Message bodies and
 * recipient names are caller-supplied, so raw interpolation lets someone
 * inject arbitrary markup (links, hidden content, spoofed branding) into mail
 * sent from our verified domain.
 *
 * Quotes are escaped too, not just angle brackets: several interpolation sites
 * below sit INSIDE a double-quoted attribute (src="...", href="..."), where a
 * bare `"` closes the attribute and opens an injection point without ever
 * needing a `<`.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Recipient-counting quota.
 *
 * A per-REQUEST rate limit is useless here: the damage scales with how many
 * strangers get mailed, not with how many HTTP calls were made. 500 requests
 * of 1 recipient and 1 request of 500 recipients cost the same. So the budget
 * is denominated in recipients, and it is charged per user AND per team member
 * (a leader may send for many players; neither dimension may be used to
 * launder volume through the other).
 */
const RECIPIENT_QUOTA_LIMIT = 1000;
const RECIPIENT_QUOTA_WINDOW_MS = 60 * 60 * 1000; // per hour

const recipientQuota = new Map<string, { count: number; resetAt: number }>();

function pruneRecipientQuota(now: number): void {
  for (const [key, entry] of recipientQuota.entries()) {
    if (entry.resetAt <= now) recipientQuota.delete(key);
  }
}

/**
 * Atomically charge `amount` recipients against every supplied bucket.
 * Either all buckets have room and all are charged, or none are.
 */
function chargeRecipientQuota(
  keys: string[],
  amount: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  pruneRecipientQuota(now);

  for (const key of keys) {
    const entry = recipientQuota.get(key);
    const used = !entry || entry.resetAt <= now ? 0 : entry.count;
    if (used + amount > RECIPIENT_QUOTA_LIMIT) {
      const resetAt = entry && entry.resetAt > now ? entry.resetAt : now + RECIPIENT_QUOTA_WINDOW_MS;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }
  }

  for (const key of keys) {
    const entry = recipientQuota.get(key);
    if (!entry || entry.resetAt <= now) {
      recipientQuota.set(key, { count: amount, resetAt: now + RECIPIENT_QUOTA_WINDOW_MS });
    } else {
      entry.count += amount;
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * POST /api/team-members/[teamMemberId]/send-outreach
 * Send personalized outreach messages (email/SMS) to contacts
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
    // CSRF protection (double-submit cookie)
    const csrfCheck = checkCsrf(request);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Authentication
    const sessionToken = request.cookies.get('sessionToken')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const { teamMemberId } = params;
    const body = await request.json();
    const validatedData = sendOutreachSchema.parse(body);

    // Get team member and verify ownership
    const teamMember = await prisma.teamMember.findFirst({
      where: { id: teamMemberId, deletedAt: null },
      include: {
        campaign: {
          select: {
            id: true,
            teamName: true,
            organizationName: true,
            slug: true,
            // Opt-outs can be scoped to a Program; global opt-outs always apply.
            programId: true,
          }
        }
      }
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Check authorization (must be the team member or campaign leader)
    if (teamMember.userId !== user.id) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: teamMember.campaignId },
        select: { primaryLeaderId: true }
      });

      if (campaign?.primaryLeaderId !== user.id) {
        return NextResponse.json(
          { error: 'Not authorized to send messages for this team member' },
          { status: 403 }
        );
      }
    }

    // Charge the recipient budget before any dispatch. Counted per channel:
    // a "both" send to 300 people is 600 messages, not 300.
    const wantsEmailChannel = validatedData.type === 'email' || validatedData.type === 'both';
    const wantsSmsChannel = validatedData.type === 'sms' || validatedData.type === 'both';
    const chargeableRecipients =
      (wantsEmailChannel ? validatedData.recipients.filter((r) => !!r.email).length : 0) +
      (wantsSmsChannel ? validatedData.recipients.filter((r) => !!r.phone).length : 0);

    const quota = chargeRecipientQuota(
      [`user:${user.id}`, `teamMember:${teamMemberId}`],
      chargeableRecipients
    );

    if (!quota.allowed) {
      return NextResponse.json(
        {
          error:
            'Outreach limit reached. You have sent the maximum number of messages allowed this hour.',
          retryAfterSeconds: quota.retryAfterSeconds,
        },
        { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } }
      );
    }

    // Build fundraising link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const fundraisingLink = `${appUrl}/raise/${teamMember.campaign.slug}/player/${teamMember.fundLinkCode}`;

    const programId = teamMember.campaign.programId ?? null;

    // Re-parse the (already http/https-validated) URL and re-serialise it, so
    // what lands inside src="..." is the canonical, percent-encoded form rather
    // than whatever byte sequence the caller typed.
    const videoUrl = validatedData.videoUrl
      ? new URL(validatedData.videoUrl).toString()
      : undefined;

    // Track results
    const emailResults: Array<{ to: string; success: boolean; error?: string; suppressed?: boolean }> = [];
    const smsResults: Array<{ to: string; success: boolean; error?: string; suppressed?: boolean }> = [];

    // Send emails
    if (validatedData.type === 'email' || validatedData.type === 'both') {
      // Recipients come straight from the request body, so this route is the
      // last place we can enforce opt-outs before dispatch. Everything is
      // routed through partitionSuppressed (batched, so a 500-recipient send
      // cannot open 500 simultaneous connections); suppressed people are
      // reported back honestly rather than silently dropped. Scoped to this
      // branch so an SMS-only send does not pay for email lookups it will
      // never use.
      const emailRecipients = validatedData.recipients.filter((r) => !!r.email);
      const { allowed: allowedEmailRecipients, suppressed: suppressedEmailRecipients } =
        await partitionSuppressed(
          // Keep phone on the object: an ALL-channel opt-out recorded against a
          // phone number should also stop email to the same person.
          emailRecipients.map((r) => ({ ...r, email: r.email! })),
          'EMAIL',
          programId
        );

      for (const recipient of suppressedEmailRecipients) {
        emailResults.push({
          to: recipient.email,
          success: false,
          suppressed: true,
          error: 'Recipient has opted out of email',
        });
      }

      for (const recipient of allowedEmailRecipients) {
        if (!recipient.email) continue;

        // Function replacer: a recipient name containing `$&`, `$\`` or
        // `$'` would otherwise be expanded by String.prototype.replace and
        // splice parts of the template into the message body.
        const personalizedMessage = validatedData.message.replace(
          /\{name\}/g,
          () => recipient.name || 'there'
        );

        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 30px;">
              <div style="white-space: pre-wrap; font-size: 16px; color: #374151; line-height: 1.6;">
${escapeHtml(personalizedMessage)}
              </div>

              ${videoUrl ? `
              <div style="margin: 30px 0; text-align: center;">
                <video controls style="max-width: 100%; border-radius: 8px;" poster="">
                  <source src="${escapeHtml(videoUrl)}" type="video/mp4">
                  Your browser doesn't support video playback.
                </video>
              </div>
              ` : ''}

              <div style="margin-top: 40px; text-align: center;">
                <a href="${escapeHtml(fundraisingLink)}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Support ${escapeHtml(teamMember.name)} →
                </a>
              </div>

              <p style="margin-top: 30px; font-size: 14px; color: #9ca3af; text-align: center;">
                ${escapeHtml(teamMember.campaign.teamName)} - ${escapeHtml(teamMember.campaign.organizationName)}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Sent via Rally Fundraising Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        const result = await sendEmail({
          to: recipient.email,
          subject: validatedData.subject || `${teamMember.name} needs your support!`,
          html: htmlBody,
          text: `${personalizedMessage}\n\nSupport ${teamMember.name}: ${fundraisingLink}`,
          // Only route replies to an address the account has actually proven
          // it controls. An unverified address here turns our verified sending
          // domain into a relay that collects replies for an attacker.
          replyTo: user.emailVerified ? user.email : undefined,
          // Fundraising outreach is marketing, never transactional. sendEmail
          // re-checks suppression and attaches the unsubscribe footer/header.
          programId,
        });

        emailResults.push({
          to: recipient.email,
          success: result.success,
          error: result.error,
        });

        // Persist a Contact only for mail we actually dispatched. Recording a
        // contact for a failed send would let anyone seed arbitrary addresses
        // into this team's roster just by attempting to mail them.
        if (result.success) {
          const existingContact = await prisma.contact.findFirst({
            where: {
              teamMemberId: teamMember.id,
              email: recipient.email,
            }
          });

          if (existingContact) {
            await prisma.contact.update({
              where: { id: existingContact.id },
              data: {
                emailsSent: { increment: 1 },
                lastContactedAt: new Date(),
              }
            });
          } else {
            await prisma.contact.create({
              data: {
                teamMemberId: teamMember.id,
                firstName: recipient.name?.split(' ')[0],
                lastName: recipient.name?.split(' ').slice(1).join(' '),
                email: recipient.email,
                phone: recipient.phone,
                source: 'MANUAL_IMPORT',
                emailsSent: 1,
                lastContactedAt: new Date(),
              }
            });
          }
        }
      }
    }

    // Send SMS
    if (validatedData.type === 'sms' || validatedData.type === 'both') {
      const { allowed: allowedSmsRecipients, suppressed: suppressedSmsRecipients } =
        await partitionSuppressed(
          validatedData.recipients.filter((r) => !!r.phone),
          'SMS',
          programId
        );

      for (const recipient of suppressedSmsRecipients) {
        smsResults.push({
          to: recipient.phone!,
          success: false,
          suppressed: true,
          error: 'Recipient has opted out of SMS',
        });
      }

      const smsMessages = allowedSmsRecipients
        .map(recipient => {
          // Function replacer — see the email branch above: `$` sequences in
          // a recipient name are literal text, not replacement patterns.
          const personalizedMessage = validatedData.message.replace(
            /\{name\}/g,
            () => recipient.name || 'there'
          );

          return {
            to: recipient.phone!,
            message: `${personalizedMessage}\n\nSupport me here: ${fundraisingLink}`,
            mediaUrl: videoUrl ? [videoUrl] : undefined,
          };
        });

      if (smsMessages.length > 0) {
        const bulkResult = await sendBulkSMS(smsMessages, programId);
        smsResults.push(...bulkResult.results);

        // Save to outreach log — only for recipients whose message actually
        // went out. A failed send must not seed a Contact row.
        const deliveredPhones = new Set(
          bulkResult.results.filter((r) => r.success).map((r) => r.to)
        );

        for (const recipient of allowedSmsRecipients) {
          if (recipient.phone && deliveredPhones.has(recipient.phone)) {
            const existingContact = await prisma.contact.findFirst({
              where: {
                teamMemberId: teamMember.id,
                phone: recipient.phone,
              }
            });

            if (existingContact) {
              await prisma.contact.update({
                where: { id: existingContact.id },
                data: {
                  smsSent: { increment: 1 },
                  lastContactedAt: new Date(),
                }
              });
            } else {
              await prisma.contact.create({
                data: {
                  teamMemberId: teamMember.id,
                  firstName: recipient.name?.split(' ')[0],
                  lastName: recipient.name?.split(' ').slice(1).join(' '),
                  email: recipient.email,
                  phone: recipient.phone,
                  source: 'MANUAL_IMPORT',
                  smsSent: 1,
                  lastContactedAt: new Date(),
                }
              });
            }
          }
        }
      }
    }

    // Calculate summary. "suppressed" is its own bucket: those people are not
    // delivery failures, they asked us to stop. The UI must be able to say so.
    const emailSuccess = emailResults.filter(r => r.success).length;
    const emailSuppressed = emailResults.filter(r => r.suppressed).length;
    const emailFailed = emailResults.filter(r => !r.success && !r.suppressed).length;
    const smsSuccess = smsResults.filter(r => r.success).length;
    const smsSuppressed = smsResults.filter(r => r.suppressed).length;
    const smsFailed = smsResults.filter(r => !r.success && !r.suppressed).length;

    return NextResponse.json({
      success: true,
      summary: {
        email: {
          sent: emailSuccess,
          failed: emailFailed,
          suppressed: emailSuppressed,
          total: emailResults.length,
        },
        sms: {
          sent: smsSuccess,
          failed: smsFailed,
          suppressed: smsSuppressed,
          total: smsResults.length,
        }
      },
      results: {
        email: emailResults,
        sms: smsResults,
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error sending outreach:', error);
    return NextResponse.json(
      { error: 'Failed to send messages' },
      { status: 500 }
    );
  }
}
