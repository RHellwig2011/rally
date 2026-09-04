import { NextRequest, NextResponse } from "next/server";
import { checkCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { z } from "zod";
// The non-throwing sendEmail contract: this route writes a per-recipient
// OutreachLog row and needs the failure reason as a value, not an exception.
import { sendEmailWithResult } from "@/lib/email";
import { sendSMS } from "@/lib/services/sms";

// Contact rows can carry null or empty-string fields (missing Contact data);
// treat those as absent instead of failing validation for the whole batch.
const emptyToUndefined = (v: unknown) => (v === null || v === "" ? undefined : v);

const sendOutreachSchema = z.object({
  messageType: z.enum(["email", "sms"]),
  subject: z.string().max(200).optional(),
  message: z.string().min(1, "Message is required").max(10000),
  contacts: z
    .array(
      z.object({
        name: z.preprocess(emptyToUndefined, z.string().optional()),
        email: z.preprocess(emptyToUndefined, z.string().email().optional()),
        phone: z.preprocess(emptyToUndefined, z.string().optional()),
      })
    )
    .min(1, "At least one contact is required")
    .max(500),
});

function buildEmailHtml(message: string, campaignName: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `
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
              <div style="white-space: pre-wrap; font-size: 16px; color: #374151; line-height: 1.6;">${escaped}</div>
              <p style="margin-top: 30px; font-size: 14px; color: #9ca3af; text-align: center;">${campaignName}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Sent via Rally Fundraising Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * POST /api/campaigns/[campaignId]/send-outreach
 * Send outreach messages (email or SMS) to a list of contacts.
 * Creates an OutreachCampaign with per-recipient OutreachLog rows and
 * reports REAL attempted/sent/failed counts.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // CSRF protection (double-submit cookie)
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Authentication check
    const sessionToken = req.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { campaignId } = params;

    // Verify campaign exists and user is authorized
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        guardians: {
          select: { id: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check authorization: campaign leader, guardian, or admin
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some((g) => g.id === user.id) ||
      user.role === "ADMIN";

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to send outreach for this campaign" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = sendOutreachSchema.parse(body);

    if (validated.messageType === "email" && !validated.subject) {
      return NextResponse.json(
        { success: false, error: "Subject is required for email outreach" },
        { status: 400 }
      );
    }

    const campaignName = `${campaign.teamName} - ${campaign.organizationName}`;
    const isEmail = validated.messageType === "email";
    // Outreach is marketing, never transactional. sendEmail/sendSMS enforce the
    // suppression list themselves; programId scopes it so program-level
    // opt-outs are honored too (global opt-outs always apply).
    const programId = campaign.programId ?? null;

    // Create the outreach campaign record up front
    const outreachCampaign = await prisma.outreachCampaign.create({
      data: {
        campaignId,
        createdBy: user.id,
        name: validated.subject || `Outreach ${new Date().toISOString().slice(0, 10)}`,
        type: isEmail ? "EMAIL" : "SMS",
        status: "SENDING",
        emailSubject: isEmail ? validated.subject : null,
        emailBody: isEmail ? validated.message : null,
        smsBody: isEmail ? null : validated.message,
        totalRecipients: validated.contacts.length,
      },
    });

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const results: Array<{
      recipient: string | null;
      status: "SENT" | "FAILED" | "SKIPPED";
      error?: string;
    }> = [];

    // Resolve every Contact link in ONE query instead of a findFirst per
    // recipient — a 500-contact blast was 500 extra round trips inside the send
    // loop. deletedAt: null on the relation matters: a soft-deleted player's
    // contacts must not be revived as the link target for this send.
    const addresses = Array.from(
      new Set(
        validated.contacts
          .map((c) => (isEmail ? c.email : c.phone))
          .filter((a): a is string => !!a)
      )
    );

    const linkableContacts = addresses.length
      ? await prisma.contact.findMany({
          where: {
            teamMember: { campaignId, deletedAt: null },
            ...(isEmail ? { email: { in: addresses } } : { phone: { in: addresses } }),
          },
          select: { id: true, email: true, phone: true },
        })
      : [];

    // First row wins for a duplicated address, matching the findFirst this
    // replaces.
    const contactIdByAddress = new Map<string, string>();
    for (const contact of linkableContacts) {
      const key = isEmail ? contact.email : contact.phone;
      if (key && !contactIdByAddress.has(key)) {
        contactIdByAddress.set(key, contact.id);
      }
    }

    for (const recipient of validated.contacts) {
      const address = isEmail ? recipient.email : recipient.phone;

      if (!address) {
        skippedCount++;
        results.push({
          recipient: recipient.name || null,
          status: "SKIPPED",
          error: isEmail ? "Missing email address" : "Missing phone number",
        });
        continue;
      }

      // Function replacer: recipient names are user-supplied, and a name
      // containing `$&`, `$\`` or `$'` would otherwise be expanded by
      // String.prototype.replace into surrounding template text.
      const personalizedMessage = validated.message.replace(
        /\{name\}/g,
        () => recipient.name || "there"
      );

      // Attempt the actual send (services fail gracefully with placeholder keys)
      let sendResult: { success: boolean; error?: string; suppressed?: boolean };
      if (isEmail) {
        sendResult = await sendEmailWithResult({
          to: address,
          subject: validated.subject!,
          html: buildEmailHtml(personalizedMessage, campaignName),
          text: personalizedMessage,
          // Only route replies to an address the account has actually proven
          // it controls. An unverified address here turns our verified sending
          // domain into a relay that collects replies for an attacker.
          replyTo: user.emailVerified ? user.email : undefined,
          programId,
        });
      } else {
        sendResult = await sendSMS({
          to: address,
          message: personalizedMessage,
          programId,
        });
      }

      // Link to an existing Contact row within this campaign (prefetched above)
      const existingContactId = contactIdByAddress.get(address) || null;

      // Record the honest per-recipient outcome
      await prisma.outreachLog.create({
        data: {
          outreachCampaignId: outreachCampaign.id,
          contactId: existingContactId,
          type: isEmail ? "EMAIL" : "SMS",
          recipientEmail: isEmail ? address : recipient.email || null,
          recipientPhone: isEmail ? recipient.phone || null : address,
          status: sendResult.success ? "SENT" : "FAILED",
          sentAt: sendResult.success ? new Date() : null,
          failureReason: sendResult.success ? null : sendResult.error || "Send failed",
          emailProvider: isEmail && sendResult.success ? "resend" : null,
          smsProvider: !isEmail && sendResult.success ? "twilio" : null,
        },
      });

      if (sendResult.success) {
        sentCount++;
        if (existingContactId) {
          await prisma.contact.update({
            where: { id: existingContactId },
            data: {
              ...(isEmail ? { emailsSent: { increment: 1 } } : { smsSent: { increment: 1 } }),
              lastContactedAt: new Date(),
            },
          });
        }
      } else if (sendResult.suppressed) {
        // Opted out — deliberately withheld, not a delivery failure to retry.
        skippedCount++;
      } else {
        failedCount++;
      }

      results.push({
        recipient: address,
        status: sendResult.success
          ? "SENT"
          : sendResult.suppressed
          ? "SKIPPED"
          : "FAILED",
        error: sendResult.success ? undefined : sendResult.error,
      });
    }

    // Finalize the outreach campaign with real stats
    await prisma.outreachCampaign.update({
      where: { id: outreachCampaign.id },
      data: {
        status: sentCount > 0 ? "SENT" : "FAILED",
        sentAt: sentCount > 0 ? new Date() : null,
        emailsSent: isEmail ? sentCount : 0,
        smsSent: isEmail ? 0 : sentCount,
      },
    });

    const attempted = validated.contacts.length;

    return NextResponse.json(
      {
        success: true,
        outreachCampaignId: outreachCampaign.id,
        attempted,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
        results,
        message: `Sent ${sentCount} of ${attempted} ${validated.messageType} message${
          attempted !== 1 ? "s" : ""
        }${failedCount > 0 ? ` (${failedCount} failed)` : ""}${
          skippedCount > 0 ? ` (${skippedCount} skipped)` : ""
        }`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Send outreach error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to send messages" },
      { status: 500 }
    );
  }
}
