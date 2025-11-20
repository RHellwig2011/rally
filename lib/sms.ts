/**
 * SMS service for sending text messages using Twilio
 */

import twilio from 'twilio';

export interface SMSOptions {
  to: string; // Phone number in E.164 format (+1234567890)
  body: string;
}

// Initialize Twilio client
let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('Twilio not configured - SMS will only be logged to console');
    return null;
  }

  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  return twilioClient;
}

/**
 * Send an SMS using Twilio
 * Falls back to console logging if Twilio is not configured
 */
export async function sendSMS(options: SMSOptions): Promise<{ sid?: string }> {
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!fromPhone) {
    console.warn('TWILIO_PHONE_NUMBER not configured');
    return { sid: undefined };
  }

  // If Twilio is not configured, just log to console
  const client = getTwilioClient();
  if (!client) {
    console.log('📱 SMS (Twilio not configured - logging to console)');
    console.log('From:', fromPhone);
    console.log('To:', options.to);
    console.log('Body:', options.body);
    console.log('---');
    return { sid: 'dev-mode-sms' };
  }

  try {
    const message = await client.messages.create({
      from: fromPhone,
      to: options.to,
      body: options.body,
    });

    console.log('✅ SMS sent successfully:', message.sid);
    return { sid: message.sid };
  } catch (error) {
    console.error('❌ Failed to send SMS:', error);
    throw error;
  }
}

/**
 * Validate and format phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string | null {
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '');

  // US phone number validation (10 digits)
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Already in E.164 format with country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // International number
  if (digits.length > 10) {
    return `+${digits}`;
  }

  console.warn('Invalid phone number format:', phone);
  return null;
}

/**
 * Send invitation SMS to join a team
 */
export async function sendTeamInviteSMS(params: {
  toPhone: string;
  toName: string;
  campaignName: string;
  inviterName: string;
  inviteLink: string;
}) {
  const { toPhone, toName, campaignName, inviterName, inviteLink } = params;

  const formattedPhone = formatPhoneNumber(toPhone);
  if (!formattedPhone) {
    throw new Error('Invalid phone number format');
  }

  const body = `Hi ${toName}! ${inviterName} invited you to join ${campaignName} on Rally. Start fundraising: ${inviteLink}`;

  return await sendSMS({
    to: formattedPhone,
    body,
  });
}

/**
 * Send donation request SMS
 */
export async function sendDonationRequestSMS(params: {
  toPhone: string;
  firstName: string;
  campaignName: string;
  playerName: string;
  donationLink: string;
}) {
  const { toPhone, firstName, campaignName, playerName, donationLink } = params;

  const formattedPhone = formatPhoneNumber(toPhone);
  if (!formattedPhone) {
    throw new Error('Invalid phone number format');
  }

  const body = `Hi ${firstName}! ${playerName} is fundraising for ${campaignName}. Support them here: ${donationLink}`;

  return await sendSMS({
    to: formattedPhone,
    body,
  });
}

/**
 * Send campaign update SMS
 */
export async function sendCampaignUpdateSMS(params: {
  toPhone: string;
  campaignName: string;
  updateTitle: string;
  campaignUrl: string;
}) {
  const { toPhone, campaignName, updateTitle, campaignUrl } = params;

  const formattedPhone = formatPhoneNumber(toPhone);
  if (!formattedPhone) {
    throw new Error('Invalid phone number format');
  }

  const body = `New update from ${campaignName}: ${updateTitle}. View: ${campaignUrl}`;

  return await sendSMS({
    to: formattedPhone,
    body,
  });
}
