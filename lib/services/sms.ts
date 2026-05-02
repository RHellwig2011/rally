import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const fromNumber = process.env.TWILIO_PHONE_NUMBER;

export interface SMSOptions {
  to: string;
  message: string;
  mediaUrl?: string[]; // For MMS (videos, images)
}

/**
 * Send an SMS message using Twilio
 */
export async function sendSMS(options: SMSOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!fromNumber) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }

    // Ensure phone number is in E.164 format
    const toNumber = formatPhoneNumber(options.to);

    const message = await client.messages.create({
      body: options.message,
      from: fromNumber,
      to: toNumber,
      mediaUrl: options.mediaUrl,
    });

    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Format phone number to E.164 format (required by Twilio)
 * Assumes US numbers if no country code provided
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it already has country code, return as is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Otherwise, assume US
  return `+1${digits}`;
}

/**
 * Send team member invitation SMS
 */
export async function sendTeamMemberInvitationSMS(
  phoneNumber: string,
  memberName: string,
  campaignName: string,
  onboardingLink: string
): Promise<boolean> {
  const message = `Hi ${memberName}! 🎉 You've been invited to join ${campaignName}. Complete your profile here: ${onboardingLink}`;

  const result = await sendSMS({
    to: phoneNumber,
    message,
  });

  return result.success;
}

/**
 * Send parent welcome SMS
 */
export async function sendParentWelcomeSMS(
  phoneNumber: string,
  parentName: string,
  playerName: string,
  campaignName: string,
  fundraisingLink: string
): Promise<boolean> {
  const message = `Hi ${parentName}, ${playerName} joined ${campaignName}! Track their progress: ${fundraisingLink}`;

  const result = await sendSMS({
    to: phoneNumber,
    message,
  });

  return result.success;
}

/**
 * Send donation notification SMS
 */
export async function sendDonationNotificationSMS(
  phoneNumber: string,
  recipientName: string,
  donorName: string,
  amount: number,
  playerName: string
): Promise<boolean> {
  const message = `🎉 ${playerName} received a $${amount.toFixed(2)} donation from ${donorName}! Keep it up!`;

  const result = await sendSMS({
    to: phoneNumber,
    message,
  });

  return result.success;
}

/**
 * Send bulk SMS messages (for player outreach)
 */
export async function sendBulkSMS(
  messages: Array<{ to: string; message: string; mediaUrl?: string[] }>
): Promise<{ success: number; failed: number; results: Array<{ to: string; success: boolean; error?: string }> }> {
  const results = await Promise.all(
    messages.map(async (msg) => {
      const result = await sendSMS(msg);
      return {
        to: msg.to,
        success: result.success,
        error: result.error,
      };
    })
  );

  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return { success, failed, results };
}

/**
 * Send video via MMS
 */
export async function sendVideoSMS(
  phoneNumber: string,
  message: string,
  videoUrl: string
): Promise<boolean> {
  const result = await sendSMS({
    to: phoneNumber,
    message,
    mediaUrl: [videoUrl],
  });

  return result.success;
}
