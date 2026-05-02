import { Resend } from 'resend';
import {
  getDonationConfirmationTemplate,
  getDonationConfirmationText,
  getDonationReceiptTemplate,
  type DonationConfirmationData,
  type DonationReceiptData,
} from './donation-templates';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM || 'noreply@rallyfundraising.com';

/**
 * Send donation confirmation email
 */
export async function sendDonationConfirmation(data: DonationConfirmationData) {
  try {
    const html = getDonationConfirmationTemplate(data);
    const text = getDonationConfirmationText(data);

    const result = await resend.emails.send({
      from: `Rally Fundraising <${fromEmail}>`,
      to: data.toEmail,
      subject: `Thank you for your donation to ${data.campaignName}!`,
      html,
      text,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to send donation confirmation email:', error);
    return { success: false, error };
  }
}

/**
 * Send formal donation receipt (for tax purposes)
 */
export async function sendDonationReceipt(data: DonationReceiptData) {
  try {
    const html = getDonationReceiptTemplate(data);

    const result = await resend.emails.send({
      from: `Rally Fundraising <${fromEmail}>`,
      to: data.toEmail,
      subject: `[Tax Receipt] Donation Receipt - ${data.donationId}`,
      html,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to send donation receipt:', error);
    return { success: false, error };
  }
}

/**
 * Send team member invitation email
 */
export async function sendTeamMemberInvitation(
  email: string,
  memberName: string,
  campaignName: string,
  fundraisingLink: string,
  personalGoal?: number
) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background-color: #f7f7f7; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }
    .link-box { background-color: white; border: 2px dashed #3b82f6; padding: 15px; border-radius: 6px; margin: 20px 0; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You've Been Added to ${campaignName}!</h1>
    </div>
    <div class="content">
      <p>Hi ${memberName},</p>
      <p>Great news! You've been added as a team member to the <strong>${campaignName}</strong> fundraising campaign on Rally.</p>

      ${personalGoal ? `<p>Your personal fundraising goal has been set to <strong>$${personalGoal}</strong>.</p>` : ''}

      <h3>Your Personal Fundraising Page</h3>
      <p>We've created a personalized fundraising page just for you! Share this link with friends, family, and supporters:</p>

      <div class="link-box">
        <strong>${fundraisingLink}</strong>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${fundraisingLink}" class="button">View Your Page</a>
      </div>

      <h3>Tips for Successful Fundraising:</h3>
      <ul>
        <li>Share your link on social media</li>
        <li>Send personal messages to friends and family</li>
        <li>Post updates about your progress</li>
        <li>Thank your donors promptly</li>
      </ul>

      <p>If you have any questions or need help, please don't hesitate to reach out to your campaign organizer.</p>

      <p>Good luck with your fundraising!</p>

      <p>Best regards,<br>The Rally Team</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const result = await resend.emails.send({
      from: `Rally Fundraising <${fromEmail}>`,
      to: email,
      subject: `Welcome to ${campaignName} on Rally!`,
      html,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to send team member invitation:', error);
    return { success: false, error };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName?: string
) {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background-color: #f7f7f7; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }
    .warning { background-color: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 6px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hi ${userName || 'there'},</p>
      <p>We received a request to reset your password for your Rally account.</p>

      <p>Click the button below to reset your password:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </div>

      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #3b82f6;">${resetLink}</p>

      <div class="warning">
        <strong>⚠️ Important:</strong>
        <ul style="margin: 10px 0 0 0;">
          <li>This link will expire in 1 hour</li>
          <li>If you didn't request this reset, please ignore this email</li>
          <li>Your password won't change until you create a new one</li>
        </ul>
      </div>

      <p>Best regards,<br>The Rally Team</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const result = await resend.emails.send({
      from: `Rally Security <${fromEmail}>`,
      to: email,
      subject: 'Reset Your Rally Password',
      html,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error };
  }
}

/**
 * Send email verification
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string,
  userName?: string
) {
  const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background-color: #f7f7f7; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify Your Email Address</h1>
    </div>
    <div class="content">
      <p>Hi ${userName || 'there'},</p>
      <p>Welcome to Rally! Please verify your email address to complete your registration.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyLink}" class="button">Verify Email</a>
      </div>

      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #3b82f6;">${verifyLink}</p>

      <p>This link will expire in 24 hours.</p>

      <p>If you didn't create an account with Rally, please ignore this email.</p>

      <p>Best regards,<br>The Rally Team</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const result = await resend.emails.send({
      from: `Rally <${fromEmail}>`,
      to: email,
      subject: 'Verify Your Rally Account',
      html,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, error };
  }
}