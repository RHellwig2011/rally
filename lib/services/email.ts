import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: options.from || process.env.EMAIL_FROM || 'Rally Raise <noreply@rallyraise.com>',
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      attachments: options.attachments,
    });

    if (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

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

  const result = await sendEmail({
    to: memberEmail,
    subject: `🎉 You're invited to join ${campaignName}!`,
    html,
    text,
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

  const result = await sendEmail({
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

  const result = await sendEmail({
    to: recipientEmail,
    subject: `🎉 ${playerName} received a $${amount.toFixed(2)} donation!`,
    html,
    text,
  });

  return result.success;
}
