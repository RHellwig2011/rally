/**
 * SMS service — the ONE place this product sends text messages from, and the
 * single chokepoint where every outbound SMS is checked against
 * lib/suppression.ts before dispatch.
 *
 * lib/sms.ts used to be a second entry point with a different option key
 * (`body` instead of `message`) and its own stricter phone validator. It has
 * been folded into this module; its unique exports live at the bottom of this
 * file. There is no code path from a route to Twilio that skips isSuppressed().
 */

import twilio from 'twilio';
import { isSuppressed, filterSuppressed } from '@/lib/suppression';

// Lazily constructed: twilio() throws when the SID/token are absent, and this
// module is imported by routes that must still load (and fail gracefully) in
// environments without Twilio credentials.
let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // The Account SID (AC…) is required either way — an API Key is scoped to it.
  if (!accountSid) {
    return null;
  }

  if (twilioClient) {
    return twilioClient;
  }

  // Prefer API Key auth (SK… + secret): scoped and revocable without touching
  // the account's primary auth token. Fall back to the auth token when no key
  // is configured. If neither secret is present, Twilio is not configured and
  // callers degrade gracefully.
  if (apiKeySid && apiKeySecret) {
    twilioClient = twilio(apiKeySid, apiKeySecret, { accountSid });
  } else if (authToken) {
    twilioClient = twilio(accountSid, authToken);
  } else {
    return null;
  }

  return twilioClient;
}

export interface SMSOptions {
  to: string;
  message: string;
  mediaUrl?: string[]; // For MMS (videos, images)
  /** Scopes the suppression check to a Program (global opt-outs always apply). */
  programId?: string | null;
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** True when the number is on the suppression list — nothing was sent. */
  suppressed?: boolean;
  /**
   * True when the failure looks retryable (Twilio 429 / 5xx / network blip)
   * rather than permanent (bad number, unset credentials). Callers must not
   * retry a permanent failure — and must never retry a `suppressed` result.
   */
  transient?: boolean;
}

/**
 * Classify a Twilio/network failure. Only 429 and 5xx are worth retrying;
 * a 400-class error means the request itself is wrong and a retry will fail
 * identically.
 */
function isTransientError(error: unknown): boolean {
  const err = error as { status?: number; code?: number | string } | null;
  if (!err || typeof err !== 'object') return false;

  if (typeof err.status === 'number') {
    if (err.status === 429) return true;
    if (err.status >= 500 && err.status <= 599) return true;
  }

  // Node-level connectivity failures never reached Twilio at all.
  const code = typeof err.code === 'string' ? err.code : '';
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND'
  );
}

/**
 * Send an SMS message using Twilio.
 *
 * NOTE: there is deliberately no `transactional` escape hatch for SMS. Under
 * the TCPA, revocation of consent must be honored for all non-emergency
 * messages — a STOP means stop, even for an invitation. Email has exemptions;
 * SMS does not.
 */
export async function sendSMS(options: SMSOptions): Promise<SendSMSResult> {
  // Suppression check happens before anything else so no caller can bypass it.
  if (await isSuppressed({ phone: options.to, channel: 'SMS', programId: options.programId ?? null })) {
    console.warn('🔕 Suppressed SMS — recipient opted out.');
    return {
      success: false,
      suppressed: true,
      error: 'Recipient has opted out of SMS (suppressed)',
    };
  }

  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  try {
    if (!fromNumber) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }

    // Ensure phone number is in E.164 format
    const toNumber = normalizePhoneNumber(options.to);

    const client = getClient();
    if (!client) {
      // Not configured: log instead of sending. The suppression check above
      // has already run, so a dev-mode "send" still respects opt-outs.
      console.log('📱 SMS (Twilio not configured - logging to console)');
      console.log('To:', toNumber);
      console.log('Body:', options.message);
      return { success: true, messageId: 'dev-mode-sms' };
    }

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
      error: error instanceof Error ? error.message : 'Unknown error',
      ...(isTransientError(error) ? { transient: true } : {}),
    };
  }
}

/**
 * Normalize a phone number to E.164 format (required by Twilio).
 *
 * Lenient on purpose: it always returns a string, falling back to a US
 * assumption. This is the internal last-mile normalizer used at dispatch time —
 * it is NOT a validator. Callers that need to reject a bad number before they
 * build a recipient list must use the exported `formatPhoneNumber` below,
 * which returns null instead of inventing a number.
 */
function normalizePhoneNumber(phone: string): string {
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
/**
 * How many Twilio requests may be in flight at once, and how long to pause
 * between batches. An unbounded Promise.all over a 1000-person roster opens
 * 1000 simultaneous HTTPS connections, which exhausts sockets locally and
 * trips Twilio's per-account concurrency limit (429) remotely — turning a
 * capacity problem into a pile of "failed" recipients nobody retries.
 */
const SMS_BATCH_SIZE = 15;
const SMS_BATCH_DELAY_MS = 250;

export async function sendBulkSMS(
  messages: Array<{ to: string; message: string; mediaUrl?: string[]; programId?: string | null }>,
  programId?: string | null
): Promise<{
  success: number;
  failed: number;
  suppressed: number;
  /** Failures that look retryable (429/5xx/network) — a subset of `failed`. */
  transient: number;
  results: Array<{
    to: string;
    success: boolean;
    error?: string;
    suppressed?: boolean;
    transient?: boolean;
  }>;
}> {
  // Filter up front so opted-out numbers are reported as their own bucket
  // rather than being lumped in with delivery failures.
  const { allowed, suppressed } = await filterSuppressed(
    messages.map((m) => ({ ...m, phone: m.to })),
    'SMS',
    programId ?? null
  );

  if (suppressed.length > 0) {
    console.warn(`🔕 Suppressed ${suppressed.length} SMS recipient(s) — opted out.`);
  }

  // Send in bounded batches with a short pause between them, so a large
  // roster degrades into a slower send rather than a burst of 429s.
  const sent: Array<{
    to: string;
    success: boolean;
    error?: string;
    suppressed?: boolean;
    transient?: boolean;
  }> = [];

  for (let i = 0; i < allowed.length; i += SMS_BATCH_SIZE) {
    const batch = allowed.slice(i, i + SMS_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (msg) => {
        const result = await sendSMS({ ...msg, programId: msg.programId ?? programId ?? null });
        return {
          to: msg.to,
          success: result.success,
          error: result.error,
          ...(result.suppressed ? { suppressed: true } : {}),
          ...(result.transient ? { transient: true } : {}),
        };
      })
    );

    sent.push(...batchResults);

    if (i + SMS_BATCH_SIZE < allowed.length) {
      await new Promise((resolve) => setTimeout(resolve, SMS_BATCH_DELAY_MS));
    }
  }

  const suppressedResults: typeof sent = suppressed.map((msg) => ({
    to: msg.to,
    success: false,
    error: 'Recipient has opted out of SMS (suppressed)',
    suppressed: true,
  }));

  const results = [...sent, ...suppressedResults];

  const success = results.filter((r) => r.success).length;
  // Suppressed recipients are not delivery failures — they are people we are
  // legally required not to text. Counting them as "failed" hides that.
  const failed = results.filter((r) => !r.success && !r.suppressed).length;
  const transient = results.filter((r) => r.transient).length;

  if (transient > 0) {
    console.warn(
      `⚠️  ${transient} SMS recipient(s) failed transiently (429/5xx/network) and are safe to retry.`
    );
  }

  return {
    success,
    failed,
    suppressed: results.filter((r) => r.suppressed).length,
    transient,
    results,
  };
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

/* ---------------------------------------------------------------------------
 * Migrated from lib/sms.ts during the sms-module consolidation.
 *
 * lib/sms.ts was a second entry point over this module whose only behavioural
 * difference was the option key (`body` rather than `message`) and a stricter,
 * null-returning phone validator. Both are preserved below; the option key is
 * not, because a single module must not expose two spellings of one field.
 * ------------------------------------------------------------------------- */

/**
 * Validate and format a phone number to E.164 format.
 *
 * Returns null for anything that cannot be a real number, so callers can reject
 * it up front rather than handing Twilio a fabricated destination. Contrast
 * with the internal `normalizePhoneNumber`, which always returns a string.
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
 * Send invitation SMS to join a team.
 *
 * There is deliberately no `transactional` escape hatch: under the TCPA a
 * revocation of consent covers all non-emergency messages, invitations
 * included. Email has exemptions; SMS does not.
 */
export async function sendTeamInviteSMS(params: {
  toPhone: string;
  toName: string;
  campaignName: string;
  inviterName: string;
  inviteLink: string;
  programId?: string | null;
}): Promise<SendSMSResult> {
  const { toPhone, toName, campaignName, inviterName, inviteLink, programId } = params;

  const formattedPhone = formatPhoneNumber(toPhone);
  if (!formattedPhone) {
    return { success: false, error: 'Invalid phone number format' };
  }

  return sendSMS({
    to: formattedPhone,
    message: `Hi ${toName}! ${inviterName} invited you to join ${campaignName} on Rally. Start fundraising: ${inviteLink}`,
    programId: programId ?? null,
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
  programId?: string | null;
}): Promise<SendSMSResult> {
  const { toPhone, firstName, campaignName, playerName, donationLink, programId } = params;

  const formattedPhone = formatPhoneNumber(toPhone);
  if (!formattedPhone) {
    return { success: false, error: 'Invalid phone number format' };
  }

  return sendSMS({
    to: formattedPhone,
    message: `Hi ${firstName}! ${playerName} is fundraising for ${campaignName}. Support them here: ${donationLink}`,
    programId: programId ?? null,
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
  programId?: string | null;
}): Promise<SendSMSResult> {
  const { toPhone, campaignName, updateTitle, campaignUrl, programId } = params;

  const formattedPhone = formatPhoneNumber(toPhone);
  if (!formattedPhone) {
    return { success: false, error: 'Invalid phone number format' };
  }

  return sendSMS({
    to: formattedPhone,
    message: `New update from ${campaignName}: ${updateTitle}. View: ${campaignUrl}`,
    programId: programId ?? null,
  });
}
