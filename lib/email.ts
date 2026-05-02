/**
 * Email service for sending notifications using Resend
 */

import { Resend } from 'resend';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Initialize Resend client
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

/**
 * Send an email using Resend
 * Falls back to console logging if Resend is not configured
 */
export async function sendEmail(options: EmailOptions): Promise<{ id?: string }> {
  const fromEmail = process.env.EMAIL_FROM || 'noreply@bleacherbackers.com';

  // If Resend is not configured, just log to console
  const resend = getResendClient();
  if (!resend) {
    console.log('📧 EMAIL (Resend not configured - logging to console)');
    console.log('From:', fromEmail);
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('---');
    console.log(options.text || 'See HTML version');
    console.log('---');
    return { id: 'dev-mode-email' };
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log('✅ Email sent successfully:', result);
    return { id: (result as any).id };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
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
  amount: number;
  donationDate: Date;
  taxDeductible: boolean;
}) {
  const { toEmail, donorName, campaignName, amount, donationDate, taxDeductible } = params;

  const subject = `Thank you for your donation to ${campaignName}`;

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

      <div class="amount">$${(amount / 100).toFixed(2)}</div>

      <div class="receipt">
        <h3>Receipt Details</h3>
        <p><strong>Campaign:</strong> ${campaignName}</p>
        <p><strong>Amount:</strong> $${(amount / 100).toFixed(2)}</p>
        <p><strong>Date:</strong> ${donationDate.toLocaleDateString()}</p>
        <p><strong>Tax Deductible:</strong> ${taxDeductible ? 'Yes' : 'No'}</p>
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
- Amount: $${(amount / 100).toFixed(2)}
- Date: ${donationDate.toLocaleDateString()}
- Tax Deductible: ${taxDeductible ? 'Yes' : 'No'}

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
  });
}
