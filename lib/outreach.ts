/**
 * Shared outreach delivery.
 *
 * Immediate send (POST /api/outreach/campaigns) and the scheduled-outreach
 * cron worker both go through deliverOutreachCampaign so suppression, logging,
 * and SENT/FAILED finalization stay on one path.
 */

import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendSMS, formatPhoneNumber } from "@/lib/services/sms";
import { partitionSuppressed } from "@/lib/suppression";

export interface OutreachContact {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
}

export interface OutreachAudience {
  emailContacts: OutreachContact[];
  smsContacts: OutreachContact[];
  suppressedEmailContacts: OutreachContact[];
  suppressedSmsContacts: OutreachContact[];
}

export interface OutreachContent {
  type: "EMAIL" | "SMS" | "BOTH";
  emailSubject?: string | null;
  emailBody?: string | null;
  smsBody?: string | null;
}

export interface DeliverOutreachResult {
  emailsSent: number;
  smsSent: number;
  skipped: number;
  status: "SENT" | "FAILED";
}

/**
 * OutreachLog.status is the Prisma `MessageStatus` enum, which has no SKIPPED
 * member (PENDING/SENT/DELIVERED/FAILED/OPENED/CLICKED). A suppressed
 * recipient is therefore recorded as FAILED with an explicit opt-out reason
 * and a NULL sentAt — never as SENT. prisma/schema.prisma is owned elsewhere;
 * adding a SKIPPED member there would let this read as what it really is.
 */
const SUPPRESSED_LOG_STATUS = "FAILED" as const;
const SUPPRESSED_EMAIL_REASON = "Recipient has opted out of email (suppressed)";
const SUPPRESSED_SMS_REASON = "Recipient has opted out of SMS (suppressed)";

const SCHEDULED_PICKUP_LIMIT = 20;

function delay(ms: number): Promise<void> {
  if (process.env.NODE_ENV === "test") return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve the current roster contacts for a campaign and run them through
 * the suppression list. Used at scheduled-send time so opt-outs that arrived
 * after the campaign was queued are honoured.
 */
export async function resolveOutreachAudience(opts: {
  campaignId: string;
  type: "EMAIL" | "SMS" | "BOTH";
  programId: string | null;
}): Promise<OutreachAudience> {
  const teamMembers = await prisma.teamMember.findMany({
    where: { campaignId: opts.campaignId, deletedAt: null },
    include: { contacts: true },
  });

  const allContacts: OutreachContact[] = teamMembers.flatMap((tm) =>
    tm.contacts.map((c) => ({
      id: c.id,
      email: c.email,
      phone: c.phone,
      firstName: c.firstName,
    }))
  );

  const wantsEmail = opts.type === "EMAIL" || opts.type === "BOTH";
  const wantsSms = opts.type === "SMS" || opts.type === "BOTH";

  const emailCandidates = wantsEmail ? allContacts.filter((c) => !!c.email) : [];
  const smsCandidates = wantsSms ? allContacts.filter((c) => !!c.phone) : [];

  const { allowed: emailContacts, suppressed: suppressedEmailContacts } =
    await partitionSuppressed(emailCandidates, "EMAIL", opts.programId);
  const { allowed: smsContacts, suppressed: suppressedSmsContacts } =
    await partitionSuppressed(smsCandidates, "SMS", opts.programId);

  return {
    emailContacts,
    smsContacts,
    suppressedEmailContacts,
    suppressedSmsContacts,
  };
}

/**
 * Send outreach messages to an already-partitioned audience and finalize the
 * OutreachCampaign as SENT or FAILED.
 */
export async function deliverOutreachCampaign(
  outreachCampaignId: string,
  audience: OutreachAudience,
  campaignData: OutreachContent,
  campaignSlug: string,
  programId: string | null
): Promise<DeliverOutreachResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const donationLink = `${appUrl}/raise/${campaignSlug}/donate`;

  let emailsSent = 0;
  let smsSent = 0;
  let skipped = 0;

  // Record the people we deliberately withheld from, up front. This is the
  // row a CAN-SPAM/TCPA audit looks for: it proves we honoured the opt-out.
  for (const contact of audience.suppressedEmailContacts) {
    skipped++;
    await prisma.outreachLog.create({
      data: {
        outreachCampaignId,
        contactId: contact.id,
        type: "EMAIL",
        recipientEmail: contact.email,
        status: SUPPRESSED_LOG_STATUS,
        sentAt: null,
        failureReason: SUPPRESSED_EMAIL_REASON,
      },
    });
  }

  for (const contact of audience.suppressedSmsContacts) {
    skipped++;
    await prisma.outreachLog.create({
      data: {
        outreachCampaignId,
        contactId: contact.id,
        type: "SMS",
        recipientPhone: contact.phone,
        status: SUPPRESSED_LOG_STATUS,
        sentAt: null,
        failureReason: SUPPRESSED_SMS_REASON,
      },
    });
  }

  for (const contact of audience.emailContacts) {
    if (!contact.email) continue;

    try {
      const firstName = contact.firstName || "Friend";
      // Function replacers: contact names are user-supplied, so a `$&`/`$\``/
      // `$'` sequence must be inserted literally rather than expanded.
      const personalizedBody = (campaignData.emailBody || "")
        .replace(/\{firstName\}/g, () => firstName)
        .replace(/\{donationLink\}/g, () => donationLink);

      const result = await sendEmail({
        to: contact.email,
        subject: campaignData.emailSubject || "",
        html: personalizedBody,
        text: personalizedBody.replace(/<[^>]*>/g, ""),
        programId,
      });

      // A suppressed recipient is NOT a delivery. Logging it as SENT with a
      // timestamp would misrepresent an opt-out we correctly honoured.
      if (result.status === "SUPPRESSED") {
        skipped++;

        await prisma.outreachLog.create({
          data: {
            outreachCampaignId,
            contactId: contact.id,
            type: "EMAIL",
            recipientEmail: contact.email,
            status: SUPPRESSED_LOG_STATUS,
            sentAt: null,
            failureReason: SUPPRESSED_EMAIL_REASON,
          },
        });
      } else {
        emailsSent++;

        await prisma.outreachLog.create({
          data: {
            outreachCampaignId,
            contactId: contact.id,
            type: "EMAIL",
            recipientEmail: contact.email,
            status: "SENT",
            sentAt: new Date(),
            emailProvider: "resend",
            providerMessageId: result.id ?? null,
          },
        });

        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            emailsSent: { increment: 1 },
            lastContactedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Failed to send email to ${contact.email}:`, error);

      await prisma.outreachLog.create({
        data: {
          outreachCampaignId,
          contactId: contact.id,
          type: "EMAIL",
          recipientEmail: contact.email,
          status: "FAILED",
          failureReason: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    await delay(100);
  }

  for (const contact of audience.smsContacts) {
    if (!contact.phone) continue;

    try {
      const formattedPhone = formatPhoneNumber(contact.phone);
      if (!formattedPhone) {
        throw new Error("Invalid phone number format");
      }

      const firstName = contact.firstName || "Friend";
      const personalizedBody = (campaignData.smsBody || "")
        .replace(/\{firstName\}/g, () => firstName)
        .replace(/\{donationLink\}/g, () => donationLink);

      const result = await sendSMS({
        to: formattedPhone,
        message: personalizedBody,
        programId,
      });

      if (result.suppressed) {
        skipped++;

        await prisma.outreachLog.create({
          data: {
            outreachCampaignId,
            contactId: contact.id,
            type: "SMS",
            recipientPhone: contact.phone,
            status: SUPPRESSED_LOG_STATUS,
            sentAt: null,
            failureReason: result.error || SUPPRESSED_SMS_REASON,
          },
        });
      } else if (!result.success) {
        await prisma.outreachLog.create({
          data: {
            outreachCampaignId,
            contactId: contact.id,
            type: "SMS",
            recipientPhone: contact.phone,
            status: "FAILED",
            failureReason: result.error || "Send failed",
          },
        });
      } else {
        smsSent++;

        await prisma.outreachLog.create({
          data: {
            outreachCampaignId,
            contactId: contact.id,
            type: "SMS",
            recipientPhone: contact.phone,
            status: "SENT",
            sentAt: new Date(),
            smsProvider: "twilio",
            providerMessageId: result.messageId ?? null,
          },
        });

        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            smsSent: { increment: 1 },
            lastContactedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Failed to send SMS to ${contact.phone}:`, error);

      await prisma.outreachLog.create({
        data: {
          outreachCampaignId,
          contactId: contact.id,
          type: "SMS",
          recipientPhone: contact.phone,
          status: "FAILED",
          failureReason: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    await delay(100);
  }

  if (skipped > 0) {
    console.warn(
      `🔕 Outreach campaign ${outreachCampaignId}: skipped ${skipped} opted-out recipient(s).`
    );
  }

  const status: "SENT" | "FAILED" = emailsSent + smsSent > 0 ? "SENT" : "FAILED";

  await prisma.outreachCampaign.update({
    where: { id: outreachCampaignId },
    data: {
      status,
      emailsSent,
      smsSent,
      sentAt: emailsSent + smsSent > 0 ? new Date() : null,
    },
  });

  return { emailsSent, smsSent, skipped, status };
}

/**
 * Load a claimed (SENDING) outreach campaign, re-resolve recipients through
 * the suppression list, and deliver.
 */
export async function deliverOutreachCampaignById(
  outreachCampaignId: string
): Promise<DeliverOutreachResult> {
  const outreach = await prisma.outreachCampaign.findUnique({
    where: { id: outreachCampaignId },
    include: {
      campaign: {
        select: {
          id: true,
          slug: true,
          programId: true,
        },
      },
    },
  });

  if (!outreach) {
    throw new Error(`Outreach campaign ${outreachCampaignId} not found`);
  }

  const audience = await resolveOutreachAudience({
    campaignId: outreach.campaignId,
    type: outreach.type,
    programId: outreach.campaign.programId ?? null,
  });

  return deliverOutreachCampaign(
    outreach.id,
    audience,
    {
      type: outreach.type,
      emailSubject: outreach.emailSubject,
      emailBody: outreach.emailBody,
      smsBody: outreach.smsBody,
    },
    outreach.campaign.slug,
    outreach.campaign.programId ?? null
  );
}

export interface ProcessScheduledOutreachResult {
  claimed: number;
  sent: number;
  failed: number;
}

/**
 * Pick up due SCHEDULED outreach campaigns and send them.
 *
 * Claim is a conditional updateMany (SCHEDULED → SENDING) so two overlapping
 * cron ticks cannot double-send the same row — the same pattern as donation
 * completion in lib/donations.ts.
 */
export async function processScheduledOutreach(): Promise<ProcessScheduledOutreachResult> {
  const now = new Date();
  const stats: ProcessScheduledOutreachResult = {
    claimed: 0,
    sent: 0,
    failed: 0,
  };

  const due = await prisma.outreachCampaign.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: now },
    },
    select: { id: true },
    orderBy: { scheduledFor: "asc" },
    take: SCHEDULED_PICKUP_LIMIT,
  });

  for (const row of due) {
    const claimed = await prisma.outreachCampaign.updateMany({
      where: { id: row.id, status: "SCHEDULED" },
      data: { status: "SENDING" },
    });

    if (claimed.count !== 1) {
      continue;
    }

    stats.claimed++;

    try {
      const result = await deliverOutreachCampaignById(row.id);
      if (result.status === "SENT") {
        stats.sent++;
      } else {
        stats.failed++;
      }
    } catch (error) {
      console.error(
        `Failed to send scheduled outreach campaign ${row.id}:`,
        error
      );
      stats.failed++;
      await prisma.outreachCampaign.updateMany({
        where: { id: row.id, status: "SENDING" },
        data: { status: "FAILED" },
      });
    }
  }

  return stats;
}

/**
 * Cancel a SCHEDULED outreach campaign. Conditional so a send that claimed
 * the row between the client's read and this write is not overwritten.
 */
export async function cancelScheduledOutreach(
  outreachCampaignId: string
): Promise<{ cancelled: boolean }> {
  const result = await prisma.outreachCampaign.updateMany({
    where: { id: outreachCampaignId, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });
  return { cancelled: result.count === 1 };
}
