/**
 * Email service — the ONE place this product sends mail from.
 *
 * There used to be a second, independent implementation in lib/services/email.ts
 * with its own Resend client, its own suppression handling and its own error
 * contract. Two live implementations meant a fix applied to one (the dev-mode
 * console fallback, the per-recipient unsubscribe token) was silently absent
 * from the other, and two identical-looking sendEmail() calls in two routes
 * behaved differently. lib/services/email.ts is now a zero-logic re-export of
 * this module.
 *
 * There is exactly one dispatch path — `dispatchEmail` below — and two thin
 * adapters over it, because the two historical call sites need two different
 * error contracts and both are load-bearing:
 *
 *   sendEmail()           → throws on send failure, returns a { status } union.
 *   sendEmailWithResult() → never throws, returns { success, error }.
 */

import { Resend } from 'resend';
import {
  isSuppressed,
  unsubscribeHeaders,
  unsubscribeFooterHtml,
  unsubscribeFooterText,
} from '@/lib/suppression';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
  /**
   * Set true ONLY for mail the recipient is entitled to receive regardless of
   * marketing preferences: donation receipts, email verification, password
   * resets, team-member invitations. Transactional mail skips the suppression
   * list and carries no unsubscribe footer.
   *
   * This is an explicit flag on purpose — never infer it from the subject.
   */
  transactional?: boolean;
  /** Scopes the suppression check to a Program (global opt-outs always apply). */
  programId?: string | null;
}

/**
 * The outcome of a sendEmail call.
 *
 * `status` is a required discriminator on purpose. When "nothing was sent"
 * was signalled only by an optional `suppressed?: boolean`, callers that
 * ignored the return value logged opted-out recipients as delivered — which
 * is precisely the artifact produced in a CAN-SPAM/TCPA dispute. Making the
 * field required forces every caller to acknowledge the two outcomes.
 *
 * A genuine send failure is not represented here: sendEmail throws for those,
 * so callers must keep their try/catch.
 */
export interface SendEmailResult {
  status: 'SENT' | 'SUPPRESSED';
  id?: string;
  /** True when the recipient was on the suppression list — nothing was sent. */
  suppressed?: boolean;
  /** Addresses that were withheld because they opted out. */
  suppressedRecipients?: string[];
}

/**
 * Non-throwing result contract. Used by routes that record a per-recipient
 * outcome (outreach logs, disbursement notifications) and must be able to tell
 * "opted out" apart from "the provider rejected it".
 */
export interface SendEmailStatusResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** True when every recipient was on the suppression list — nothing was sent. */
  suppressed?: boolean;
  /** Addresses that were withheld because they opted out. */
  suppressedRecipients?: string[];
}

/** Default sender for callers that pass neither `from` nor EMAIL_FROM. */
const DEFAULT_FROM = 'noreply@bleacherbackers.com';

// Initialize Resend client lazily. Constructing it at module scope would bind
// whatever RESEND_API_KEY looked like at import time and would give routes no
// way to degrade gracefully when the key is absent.
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - emails will only be logged to console');
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

interface DispatchOutcome {
  /** Recipients that actually went out (or were console-logged in dev mode). */
  sent: Array<{ to: string; id?: string }>;
  /** Recipients the provider rejected, with the provider's reason. */
  failures: Array<{ to: string; error: string }>;
  /** Recipients withheld because they are on the suppression list. */
  suppressedRecipients: string[];
}

/**
 * The single dispatch path. Never throws — it reports every per-recipient
 * outcome and lets the adapters decide what an error means to their caller.
 */
async function dispatchEmail(options: EmailOptions): Promise<DispatchOutcome> {
  const fromEmail = options.from || process.env.EMAIL_FROM || DEFAULT_FROM;
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  const outcome: DispatchOutcome = { sent: [], failures: [], suppressedRecipients: [] };

  // Suppression check first — before the dev-mode console branch, so local
  // testing exercises the same gate production does. Transactional mail
  // (receipts, verification, password resets, invitations) is exempt.
  let allowed = recipients;
  if (!options.transactional) {
    allowed = [];
    for (const address of recipients) {
      if (
        await isSuppressed({
          email: address,
          channel: 'EMAIL',
          programId: options.programId ?? null,
        })
      ) {
        outcome.suppressedRecipients.push(address);
      } else {
        allowed.push(address);
      }
    }

    if (outcome.suppressedRecipients.length > 0) {
      console.warn(
        `🔕 Suppressed ${outcome.suppressedRecipients.length} email recipient(s) — opted out:`,
        options.subject
      );
    }
  }

  if (allowed.length === 0) {
    return outcome;
  }

  const resend = getResendClient();

  // Transactional mail carries no unsubscribe footer, so the whole recipient
  // list can go out in a single provider call.
  //
  // Non-transactional mail gets one call per recipient: each person's
  // unsubscribe token must be their own, or one recipient could unsubscribe
  // another with a link they were handed.
  const batches: string[][] = options.transactional ? [allowed] : allowed.map((a) => [a]);

  for (const batch of batches) {
    const tokenHolder = batch[0];
    const html = options.transactional
      ? options.html
      : `${options.html}${unsubscribeFooterHtml(tokenHolder)}`;
    const text = options.text
      ? options.transactional
        ? options.text
        : `${options.text}${unsubscribeFooterText(tokenHolder)}`
      : options.text;
    const headers = options.transactional ? undefined : unsubscribeHeaders(tokenHolder);

    // If Resend is not configured, log instead of sending. The suppression
    // gate above has already run, so a dev-mode "send" still honours opt-outs.
    if (!resend) {
      console.log('📧 EMAIL (Resend not configured - logging to console)');
      console.log('From:', fromEmail);
      console.log('To:', batch.join(', '));
      console.log('Subject:', options.subject);
      console.log('---');
      console.log(text || 'See HTML version');
      console.log('---');
      for (const address of batch) {
        outcome.sent.push({ to: address, id: 'dev-mode-email' });
      }
      continue;
    }

    try {
      // Resend does not throw on API errors — it resolves to { data, error }
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: batch,
        subject: options.subject,
        html,
        text,
        replyTo: options.replyTo,
        attachments: options.attachments,
        headers,
      });

      if (error) {
        throw new Error(`Resend error: ${error.message}`);
      }

      console.log('✅ Email sent successfully:', data?.id);
      for (const address of batch) {
        outcome.sent.push({ to: address, id: data?.id });
      }
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      for (const address of batch) {
        outcome.failures.push({ to: address, error: message });
      }
    }
  }

  return outcome;
}

/**
 * Send an email using Resend.
 *
 * Falls back to console logging if Resend is not configured.
 *
 * THROWS when the provider rejected the message and nothing went out — callers
 * of this variant treat a throw as a send failure and must keep their
 * try/catch. A suppressed recipient is NOT a throw: it is a successful no-op,
 * reported as `status: 'SUPPRESSED'`.
 */
export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  const outcome = await dispatchEmail(options);

  if (outcome.sent.length === 0) {
    if (outcome.failures.length > 0) {
      throw new Error(outcome.failures[0].error);
    }
    // Nothing sent and nothing failed => every recipient was suppressed.
    return {
      status: 'SUPPRESSED',
      suppressed: true,
      suppressedRecipients: outcome.suppressedRecipients,
    };
  }

  return {
    status: 'SENT',
    id: outcome.sent[0].id,
    ...(outcome.suppressedRecipients.length > 0
      ? { suppressedRecipients: outcome.suppressedRecipients }
      : {}),
  };
}

/**
 * Send an email and report the outcome instead of throwing.
 *
 * Same dispatch path as sendEmail — only the error contract differs. Used by
 * routes that write a per-recipient audit row and therefore need the failure
 * reason as a value rather than as an exception.
 */
export async function sendEmailWithResult(
  options: EmailOptions
): Promise<SendEmailStatusResult> {
  const outcome = await dispatchEmail({
    ...options,
    // Preserves the historical lib/services/email.ts sender fallback for the
    // callers that migrated from it.
    from: options.from || process.env.EMAIL_FROM || 'Rally Raise <noreply@rallyraise.com>',
  });

  if (outcome.sent.length === 0 && outcome.failures.length === 0) {
    return {
      success: false,
      error: 'Recipient has opted out of email (suppressed)',
      suppressed: true,
      suppressedRecipients: outcome.suppressedRecipients,
    };
  }

  return {
    success: outcome.sent.length > 0,
    messageId: outcome.sent.find((s) => s.id)?.id,
    error: outcome.failures[0]?.error,
    ...(outcome.suppressedRecipients.length > 0
      ? { suppressedRecipients: outcome.suppressedRecipients }
      : {}),
  };
}

/**
 * Send team member invitation email
 */
export async function sendTeamMemberInvitation(params: {
  toEmail: string;
  toName: string;
  campaignName: string;
  campaignOrg: string;
  inviterName: string;
  inviteLink: string;
}) {
  const { toEmail, toName, campaignName, campaignOrg, inviterName, inviteLink } = params;

  const subject = `You've been invited to join ${campaignOrg} ${campaignName}!`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #6366F1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .highlight-box { background: #f0f9ff; border-left: 4px solid #6366F1; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 You're Invited!</h1>
    </div>
    <div class="content">
      <p>Hi ${toName},</p>

      <p><strong>${inviterName}</strong> has invited you to join the fundraising team for <strong>${campaignOrg} ${campaignName}</strong> on Rally!</p>

      <p>As a team member, you'll be able to:</p>
      <ul>
        <li>Get your own personalized fundraising page</li>
        <li>Share your unique link with friends and family</li>
        <li>Track your individual donations and progress</li>
        <li>Compete on the team leaderboard</li>
        <li><strong>Import your contacts and send personalized donation requests via email & text!</strong></li>
      </ul>

      <p style="text-align: center;">
        <a href="${inviteLink}" class="button">Join the Team</a>
      </p>

      <div class="highlight-box">
        <strong>🚀 Pro Tip:</strong> Once you join, you can import your contacts (email & phone) and Rally will help you send personalized fundraising messages to them! This is the fastest way to reach your goal.
      </div>

      <p><strong>Next Steps:</strong></p>
      <ol>
        <li>Click the button above to create your account</li>
        <li>Set up your profile and fundraising page</li>
        <li>Import your contacts (friends, family, teammates)</li>
        <li>Send out personalized donation requests</li>
        <li>Watch the donations roll in! 💰</li>
      </ol>

      <p>Or copy and paste this link into your browser:<br>
      <code style="background: #f3f4f6; padding: 8px; display: inline-block; margin-top: 8px;">${inviteLink}</code></p>

      <p>Let's raise some funds together! 💪</p>

      <p>Best,<br>The Rally Team</p>
    </div>
    <div class="footer">
      <p>Rally - Fundraising Reimagined</p>
      <p>You received this email because ${inviterName} invited you to join their team.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${toName},

${inviterName} has invited you to join the fundraising team for ${campaignOrg} ${campaignName} on Rally!

As a team member, you'll be able to:
- Get your own personalized fundraising page
- Share your unique link with friends and family
- Track your individual donations and progress
- Compete on the team leaderboard

Join the team: ${inviteLink}

Let's raise some funds together!

Best,
The Rally Team
  `;

  await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    // Transactional: an invitation to join a team the inviter added them to.
    transactional: true,
  });
}

/**
 * Send campaign update notification
 */
export async function sendCampaignUpdate(params: {
  toEmail: string;
  campaignName: string;
  updateTitle: string;
  updateContent: string;
  campaignUrl: string;
}) {
  const { toEmail, campaignName, updateTitle, updateContent, campaignUrl } = params;

  const subject = `New Update: ${updateTitle}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .update { background: #f9fafb; padding: 20px; border-left: 4px solid #6366F1; margin: 20px 0; }
    .button { display: inline-block; background: #6366F1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📢 Campaign Update</h1>
    </div>
    <div class="content">
      <h2>${campaignName}</h2>

      <div class="update">
        <h3>${updateTitle}</h3>
        <p>${updateContent}</p>
      </div>

      <p style="text-align: center;">
        <a href="${campaignUrl}" class="button">View Campaign</a>
      </p>
    </div>
    <div class="footer">
      <p>Rally - Fundraising Reimagined</p>
      <p>You received this because you're following ${campaignName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Campaign Update: ${campaignName}

${updateTitle}

${updateContent}

View campaign: ${campaignUrl}
  `;

  await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send donation receipt
 */
export async function sendDonationReceipt(params: {
  toEmail: string;
  donorName: string;
  campaignName: string;
  /**
   * CENTS, matching the `Donation.grossAmount` column and Stripe's
   * `paymentIntent.amount`. Named for the unit because it silently was not:
   * every call site passed dollars into a body that divided by 100, so a $50
   * donation was receipted as "$0.50".
   */
  amountInCents: number;
  donationDate: Date;
  taxDeductible: boolean;
  /**
   * H4: IRS-shaped receipt fields. Only meaningful when taxDeductible is
   * true; a deductible receipt without legalName+ein is still sent but omits
   * the deductibility claim (we must not assert deductibility we cannot
   * substantiate with the org's identity).
   */
  orgLegalName?: string | null;
  ein?: string | null;
}) {
  const { toEmail, donorName, campaignName, amountInCents, donationDate } = params;

  // The deductibility claim requires the org's legal identity on the receipt.
  const taxDeductible =
    params.taxDeductible && !!params.orgLegalName && !!params.ein;

  const subject = `Thank you for your donation to ${campaignName}`;

  // Formatted once: the same figure appears three times across the HTML and
  // text bodies, and they must not be able to drift apart.
  const formattedAmount = `$${(amountInCents / 100).toFixed(2)}`;

  // IRS substantiation block (Pub. 1771): legal name, EIN, amount, date, and
  // the goods-or-services statement.
  const irsHtml = taxDeductible
    ? `
        <p><strong>Organization:</strong> ${params.orgLegalName}</p>
        <p><strong>EIN:</strong> ${params.ein}</p>
        <p><em>No goods or services were provided in exchange for this contribution. ${params.orgLegalName} is a tax-exempt organization under Section 501(c)(3) of the Internal Revenue Code. Please retain this receipt for your tax records.</em></p>`
    : "";
  const irsText = taxDeductible
    ? `- Organization: ${params.orgLegalName}\n- EIN: ${params.ein}\n\nNo goods or services were provided in exchange for this contribution. ${params.orgLegalName} is a tax-exempt organization under Section 501(c)(3) of the Internal Revenue Code. Please retain this receipt for your tax records.`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .receipt { background: #f9fafb; padding: 20px; border: 2px dashed #d1d5db; margin: 20px 0; }
    .amount { font-size: 36px; font-weight: bold; color: #10b981; text-align: center; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Thank You!</h1>
    </div>
    <div class="content">
      <p>Dear ${donorName},</p>

      <p>Thank you for your generous donation to <strong>${campaignName}</strong>!</p>

      <div class="amount">${formattedAmount}</div>

      <div class="receipt">
        <h3>Receipt Details</h3>
        <p><strong>Campaign:</strong> ${campaignName}</p>
        <p><strong>Amount:</strong> ${formattedAmount}</p>
        <p><strong>Date:</strong> ${donationDate.toLocaleDateString()}</p>
        <p><strong>Tax Deductible:</strong> ${taxDeductible ? 'Yes' : 'No'}</p>${irsHtml}
      </div>

      ${taxDeductible ? '<p><em>This donation is tax-deductible. Please keep this receipt for your records.</em></p>' : ''}

      <p>Your support makes a real difference. Thank you for helping make dreams come true!</p>

      <p>With gratitude,<br>The Rally Team</p>
    </div>
    <div class="footer">
      <p>Rally - Fundraising Reimagined</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Thank you for your donation!

Dear ${donorName},

Thank you for your generous donation to ${campaignName}!

Receipt Details:
- Campaign: ${campaignName}
- Amount: ${formattedAmount}
- Date: ${donationDate.toLocaleDateString()}
- Tax Deductible: ${taxDeductible ? 'Yes' : 'No'}
${irsText}
${taxDeductible ? 'This donation is tax-deductible. Please keep this receipt for your records.' : ''}

Your support makes a real difference!

With gratitude,
The Rally Team
  `;

  await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    // Transactional: a receipt for money the donor already gave us. Must send
    // even to a suppressed address — they may need it for taxes.
    transactional: true,
  });
}

/**
 * Send email verification link
 */
export async function sendEmailVerification(params: {
  toEmail: string;
  toName: string;
  verificationToken: string;
}) {
  const { toEmail, toName, verificationToken } = params;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationLink = `${appUrl}/auth/verify-email?token=${verificationToken}`;

  const subject = 'Verify your Rally account';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #6366F1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Rally!</h1>
    </div>
    <div class="content">
      <p>Hi ${toName},</p>

      <p>Thanks for signing up for Rally! To complete your registration, please verify your email address by clicking the button below:</p>

      <p style="text-align: center;">
        <a href="${verificationLink}" class="button">Verify Email Address</a>
      </p>

      <p>Or copy and paste this link into your browser:<br>
      <code style="background: #f3f4f6; padding: 8px; display: inline-block; margin-top: 8px;">${verificationLink}</code></p>

      <p><strong>This link will expire in 24 hours.</strong></p>

      <p>If you didn't create a Rally account, you can safely ignore this email.</p>

      <p>Best,<br>The Rally Team</p>
    </div>
    <div class="footer">
      <p>Rally - Fundraising Reimagined</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${toName},

Thanks for signing up for Rally! To complete your registration, please verify your email address by clicking the link below:

${verificationLink}

This link will expire in 24 hours.

If you didn't create a Rally account, you can safely ignore this email.

Best,
The Rally Team
  `;

  await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    // Transactional: account security / signup completion.
    transactional: true,
  });
}

/**
 * Send campaign status change notification
 */
export async function sendCampaignStatusChangeNotification(params: {
  toEmail: string;
  toName: string;
  campaignName: string;
  fromStatus: string;
  toStatus: string;
  reason?: string;
  changedBy: string;
  campaignUrl: string;
}) {
  const { toEmail, toName, campaignName, fromStatus, toStatus, reason, changedBy, campaignUrl } = params;

  const subject = `Campaign Status Updated: ${campaignName} is now ${toStatus}`;

  const statusDescriptions: Record<string, string> = {
    DRAFT: 'in draft mode',
    ACTIVE: 'active and accepting donations',
    PAUSED: 'temporarily paused',
    COMPLETED: 'successfully completed',
    ARCHIVED: 'archived',
  };

  const statusEmojis: Record<string, string> = {
    DRAFT: '📝',
    ACTIVE: '🚀',
    PAUSED: '⏸️',
    COMPLETED: '🎉',
    ARCHIVED: '📦',
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .status-box { background: #f0f9ff; border-left: 4px solid #6366F1; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .status-transition { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; color: #6366F1; }
    .reason-box { background: #f9fafb; padding: 15px; margin: 20px 0; border-radius: 4px; font-style: italic; }
    .button { display: inline-block; background: #6366F1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${statusEmojis[toStatus]} Status Update</h1>
    </div>
    <div class="content">
      <p>Hi ${toName},</p>

      <p>The campaign <strong>${campaignName}</strong> has been updated.</p>

      <div class="status-transition">
        ${statusEmojis[fromStatus]} ${fromStatus} → ${statusEmojis[toStatus]} ${toStatus}
      </div>

      <div class="status-box">
        <p><strong>Your campaign is now ${statusDescriptions[toStatus]}.</strong></p>
        ${toStatus === 'ACTIVE' ? '<p>🎉 Congratulations! Your campaign is now live and ready to accept donations. Share your campaign link to start fundraising!</p>' : ''}
        ${toStatus === 'PAUSED' ? '<p>⏸️ Donations are temporarily paused. You can resume the campaign anytime from your dashboard.</p>' : ''}
        ${toStatus === 'COMPLETED' ? '<p>🎉 Amazing work! Your campaign has been marked as complete. You can now request final disbursements.</p>' : ''}
        ${toStatus === 'ARCHIVED' ? '<p>📦 This campaign has been archived and is no longer active.</p>' : ''}
      </div>

      ${reason ? `
      <div class="reason-box">
        <strong>Reason:</strong> "${reason}"
      </div>
      ` : ''}

      <p><strong>Changed by:</strong> ${changedBy}</p>

      <p style="text-align: center;">
        <a href="${campaignUrl}" class="button">View Campaign Dashboard</a>
      </p>

      <p>If you have any questions, feel free to reach out to our support team.</p>

      <p>Best,<br>The Rally Team</p>
    </div>
    <div class="footer">
      <p>Rally - Fundraising Reimagined</p>
      <p>You received this because you're a leader of ${campaignName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Campaign Status Update: ${campaignName}

${fromStatus} → ${toStatus}

Your campaign is now ${statusDescriptions[toStatus]}.

${reason ? `Reason: "${reason}"` : ''}

Changed by: ${changedBy}

View your dashboard: ${campaignUrl}

Best,
The Rally Team
  `;

  await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send password reset link
 */
export async function sendPasswordResetEmail(params: {
  toEmail: string;
  toName: string;
  resetToken: string;
}) {
  const { toEmail, toName, resetToken } = params;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetLink = `${appUrl}/auth/reset-password?token=${resetToken}`;

  const subject = 'Reset your Rally password';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #6366F1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔒 Password Reset</h1>
    </div>
    <div class="content">
      <p>Hi ${toName},</p>

      <p>We received a request to reset your Rally password. Click the button below to choose a new password:</p>

      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </p>

      <p>Or copy and paste this link into your browser:<br>
      <code style="background: #f3f4f6; padding: 8px; display: inline-block; margin-top: 8px;">${resetLink}</code></p>

      <div class="warning">
        <strong>⚠️ Important:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
      </div>

      <p>Best,<br>The Rally Team</p>
    </div>
    <div class="footer">
      <p>Rally - Fundraising Reimagined</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${toName},

We received a request to reset your Rally password. Click the link below to choose a new password:

${resetLink}

⚠️ Important: This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.

Best,
The Rally Team
  `;

  await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    // Transactional: account security. Never suppress a password reset.
    transactional: true,
  });
}

/* ---------------------------------------------------------------------------
 * Migrated from lib/services/email.ts during the email-module consolidation.
 * These three templates only ever existed in that module; they now share the
 * single dispatch path above via sendEmailWithResult (non-throwing contract,
 * which is what their `Promise<boolean>` return type already assumed).
 * ------------------------------------------------------------------------- */

/**
 * Send team member invitation email with onboarding link
 */
export async function sendTeamMemberInvitationEmail(
  memberEmail: string,
  memberName: string,
  campaignName: string,
  teamName: string,
  onboardingLink: string,
  fundraisingLink: string,
  personalGoal?: number
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                🎉 You're Invited!
              </h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">
                Join ${campaignName}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Hi <strong>${memberName}</strong>! 👋
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Great news! Your coach has invited you to join the <strong>${teamName}</strong> fundraiser.
              </p>

              <!-- Call to Action Box -->
              <div style="background-color: #eef2ff; border-left: 4px solid #6366f1; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <h2 style="margin: 0 0 10px 0; color: #4f46e5; font-size: 18px; font-weight: 600;">
                  📝 First Step: Complete Your Profile
                </h2>
                <p style="margin: 0 0 15px 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
                  We need a few details from you and your parent/guardian to get started:
                </p>
                <ul style="margin: 0 0 15px 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
                  <li>Your email and phone (optional)</li>
                  <li>Your parent's email and phone</li>
                </ul>
                <a href="${onboardingLink}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-top: 10px;">
                  Complete Your Profile →
                </a>
              </div>

              ${personalGoal ? `
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0; color: #d97706; font-size: 16px; font-weight: 600;">
                  🎯 Your Goal: $${personalGoal.toFixed(2)}
                </h3>
                <p style="margin: 0; font-size: 14px; color: #78350f;">
                  Your coach has set this fundraising goal for you. You got this! 💪
                </p>
              </div>
              ` : ''}

              <!-- What Happens Next -->
              <h3 style="margin: 30px 0 15px 0; color: #111827; font-size: 18px; font-weight: 600;">
                What Happens Next?
              </h3>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0; vertical-align: top;">
                    <span style="display: inline-block; width: 30px; height: 30px; background-color: #6366f1; color: #ffffff; border-radius: 50%; text-align: center; line-height: 30px; font-weight: bold; margin-right: 10px;">1</span>
                  </td>
                  <td style="padding: 12px 0;">
                    <strong style="color: #111827; font-size: 15px;">Complete your profile</strong>
                    <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Add your contact info and your parent's details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; vertical-align: top;">
                    <span style="display: inline-block; width: 30px; height: 30px; background-color: #8b5cf6; color: #ffffff; border-radius: 50%; text-align: center; line-height: 30px; font-weight: bold; margin-right: 10px;">2</span>
                  </td>
                  <td style="padding: 12px 0;">
                    <strong style="color: #111827; font-size: 15px;">Get your fundraising page</strong>
                    <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">You'll get a personal page to share with family & friends</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; vertical-align: top;">
                    <span style="display: inline-block; width: 30px; height: 30px; background-color: #f59e0b; color: #ffffff; border-radius: 50%; text-align: center; line-height: 30px; font-weight: bold; margin-right: 10px;">3</span>
                  </td>
                  <td style="padding: 12px 0;">
                    <strong style="color: #111827; font-size: 15px;">Start fundraising!</strong>
                    <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Share your link and watch the donations come in</p>
                  </td>
                </tr>
              </table>

              <!-- Questions -->
              <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                  <strong>Questions?</strong> Reply to this email or contact your coach. We're here to help! 😊
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af;">
                This invitation was sent by your coach through Rally
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} Rally Fundraising Platform
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

  const text = `
Hi ${memberName}!

You're invited to join ${campaignName}!

Your coach has invited you to join the ${teamName} fundraiser.

FIRST STEP: Complete Your Profile
${onboardingLink}

We need your contact info and your parent/guardian's email and phone number so they can stay updated on your fundraising progress.

${personalGoal ? `Your Goal: $${personalGoal.toFixed(2)}` : ''}

What Happens Next?
1. Complete your profile (add your info + parent's details)
2. Get your personal fundraising page
3. Start fundraising!

Questions? Reply to this email and we'll help you out!

Rally Fundraising Platform
  `;

  const result = await sendEmailWithResult({
    to: memberEmail,
    subject: `🎉 You're invited to join ${campaignName}!`,
    html,
    text,
    // Team-member invitations are transactional — a coach adding a player to
    // their roster must reach them regardless of marketing preferences.
    transactional: true,
  });

  return result.success;
}

/**
 * Send parent notification email after onboarding
 */
export async function sendParentWelcomeEmail(
  parentEmail: string,
  parentName: string,
  playerName: string,
  campaignName: string,
  teamName: string,
  fundraisingLink: string
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Child Joined a Fundraiser</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                ${playerName} Joined a Fundraiser!
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Hi ${parentName},
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Great news! <strong>${playerName}</strong> has joined the <strong>${teamName}</strong> fundraiser for <strong>${campaignName}</strong>.
              </p>

              <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <h2 style="margin: 0 0 10px 0; color: #047857; font-size: 18px; font-weight: 600;">
                  📊 Track Progress
                </h2>
                <p style="margin: 0 0 15px 0; font-size: 14px; color: #065f46;">
                  You'll receive updates about ${playerName}'s fundraising progress, including:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #065f46; font-size: 14px;">
                  <li>When donations are received</li>
                  <li>Milestone achievements</li>
                  <li>Team updates and progress</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${fundraisingLink}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  View ${playerName}'s Fundraising Page
                </a>
              </div>

              <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                  <strong>Questions?</strong> Reply to this email and we'll be happy to help!
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} Rally Fundraising Platform
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

  const text = `
Hi ${parentName},

${playerName} has joined the ${teamName} fundraiser for ${campaignName}!

You'll receive updates about ${playerName}'s fundraising progress, including:
- When donations are received
- Milestone achievements
- Team updates and progress

View ${playerName}'s fundraising page: ${fundraisingLink}

Questions? Reply to this email and we'll be happy to help!

Rally Fundraising Platform
  `;

  const result = await sendEmailWithResult({
    to: parentEmail,
    subject: `${playerName} joined ${campaignName}!`,
    html,
    text,
  });

  return result.success;
}

/**
 * Send donation notification email
 */
export async function sendDonationNotificationEmail(
  recipientEmail: string,
  recipientName: string,
  donorName: string,
  amount: number,
  playerName: string,
  message?: string
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Donation Received!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                New Donation!
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #374151;">
                Hi ${recipientName},
              </p>

              <div style="background-color: #fffbeb; border: 2px solid #fbbf24; padding: 30px; border-radius: 12px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #78350f; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                  DONATION AMOUNT
                </p>
                <p style="margin: 0; font-size: 48px; color: #d97706; font-weight: bold;">
                  $${amount.toFixed(2)}
                </p>
                <p style="margin: 15px 0 0 0; font-size: 16px; color: #92400e;">
                  from <strong>${donorName}</strong>
                </p>
              </div>

              ${message ? `
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: left;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; font-weight: 600;">
                  💬 Personal Message:
                </p>
                <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6; font-style: italic;">
                  "${message}"
                </p>
              </div>
              ` : ''}

              <p style="margin: 30px 0 0 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Keep up the great work, ${playerName}! 🌟
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} Rally Fundraising Platform
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

  const text = `
Hi ${recipientName},

🎉 New Donation Received!

$${amount.toFixed(2)} from ${donorName}

${message ? `Personal Message: "${message}"` : ''}

Keep up the great work, ${playerName}!

Rally Fundraising Platform
  `;

  const result = await sendEmailWithResult({
    to: recipientEmail,
    subject: `🎉 ${playerName} received a $${amount.toFixed(2)} donation!`,
    html,
    text,
  });

  return result.success;
}


/**
 * Invite an assistant coach who does not yet have an account.
 * Transactional — invitations are exempt from the suppression list.
 */
export async function sendCoachInviteEmail(params: {
  toEmail: string;
  campaignName: string;
  inviterName: string;
  inviteLink: string;
}) {
  const { toEmail, campaignName, inviterName, inviteLink } = params;
  const subject = `You're invited to help coach ${campaignName}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>You're invited as an assistant coach</h1>
    <p><strong>${inviterName}</strong> invited you to help run <strong>${campaignName}</strong> on Rally.</p>
    <p>As an assistant coach you'll be able to manage the roster, outreach, and campaign settings alongside the head coach.</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${inviteLink}" style="display: inline-block; background: #6366F1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept invitation</a>
    </p>
    <p>Or copy this link: ${inviteLink}</p>
    <p>This invitation expires in 14 days. You'll need to be signed in to accept.</p>
  </div>
</body>
</html>
  `;

  const text = `${inviterName} invited you to help coach ${campaignName} on Rally.

Accept the invitation:
${inviteLink}

This invitation expires in 14 days. You'll need to be signed in to accept.
`;

  await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    // Invitations are transactional — a coach adding an assistant must reach them.
    transactional: true,
  });
}

/**
 * Notify an existing user that they were added as an assistant coach.
 * Transactional — same exemption as team-member invitations.
 */
export async function sendAssistantCoachAddedEmail(params: {
  toEmail: string;
  toName: string;
  campaignName: string;
  inviterName: string;
  dashboardUrl: string;
}) {
  const { toEmail, toName, campaignName, inviterName, dashboardUrl } = params;
  const subject = `You've been added as an assistant coach on ${campaignName}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>You're an assistant coach</h1>
    <p>Hi ${toName},</p>
    <p><strong>${inviterName}</strong> added you as an assistant coach for <strong>${campaignName}</strong>.</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #6366F1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Open dashboard</a>
    </p>
  </div>
</body>
</html>
  `;

  const text = `Hi ${toName},

${inviterName} added you as an assistant coach for ${campaignName}.

Open the dashboard: ${dashboardUrl}
`;

  await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    transactional: true,
  });
}
