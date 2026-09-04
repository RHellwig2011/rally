/**
 * Compatibility re-export. THIS MODULE CONTAINS NO LOGIC.
 *
 * It used to hold a second, independent sendEmail() implementation with its own
 * module-scope Resend client, its own suppression handling and its own default
 * sender. Two live implementations meant identical-looking calls in different
 * routes behaved differently, and a fix applied to one — the dev-mode console
 * fallback when RESEND_API_KEY is unset, the per-recipient unsubscribe token —
 * was silently absent from the other.
 *
 * Everything now lives in lib/email.ts. The three templates that only ever
 * existed here (sendTeamMemberInvitationEmail, sendParentWelcomeEmail,
 * sendDonationNotificationEmail) moved there unchanged.
 *
 * The `sendEmail` exported here is lib/email.ts#sendEmailWithResult — the
 * non-throwing `{ success, error }` contract this module has always had. It is
 * deliberately NOT lib/email.ts#sendEmail, which throws on a send failure;
 * swapping the two would turn every caller's `if (!result.success)` branch into
 * an uncaught exception.
 *
 * Remaining importers of this path: app/api/campaigns/[campaignId]/disbursements/route.ts
 * and app/api/team-members/[teamMemberId]/send-outreach/route.ts. Once those two
 * import { sendEmailWithResult } from "@/lib/email" directly, this file can be
 * deleted outright.
 */

export {
  sendEmailWithResult as sendEmail,
  sendTeamMemberInvitationEmail,
  sendParentWelcomeEmail,
  sendDonationNotificationEmail,
} from '@/lib/email';

export type {
  EmailOptions,
  SendEmailStatusResult as SendEmailResult,
} from '@/lib/email';
