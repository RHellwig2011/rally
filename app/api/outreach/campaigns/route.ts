import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/requireAuth";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendSMS, formatPhoneNumber } from "@/lib/services/sms";
import { filterSuppressed } from "@/lib/suppression";
import { checkCsrf } from "@/lib/csrf";

// Validation schema for creating an outreach campaign
const createCampaignSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required"),
  name: z.string().min(1, "Campaign name is required").max(200),
  type: z.enum(["EMAIL", "SMS", "BOTH"]),
  emailSubject: z.string().max(200).optional(),
  emailBody: z.string().max(10000).optional(),
  smsBody: z.string().max(1600).optional(), // 10 SMS segments
  // Only honoured for leader-level callers; see the authorization block below.
  teamMemberIds: z.array(z.string()).max(500).optional(),
  scheduledFor: z.string().datetime().optional(), // ISO datetime string
});

interface OutreachContact {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
}

/**
 * lib/suppression.ts#filterSuppressed issues one DB query per recipient inside
 * a single unbounded Promise.all. Feeding it a whole roster at once opens
 * hundreds of simultaneous connections and can exhaust the pool, so we hand it
 * bounded batches instead.
 */
const SUPPRESSION_LOOKUP_BATCH = 25;

async function partitionSuppressed<
  T extends { email?: string | null; phone?: string | null }
>(
  recipients: T[],
  channel: "EMAIL" | "SMS",
  programId: string | null
): Promise<{ allowed: T[]; suppressed: T[] }> {
  const allowed: T[] = [];
  const suppressed: T[] = [];

  for (let i = 0; i < recipients.length; i += SUPPRESSION_LOOKUP_BATCH) {
    const batch = recipients.slice(i, i + SUPPRESSION_LOOKUP_BATCH);
    const result = await filterSuppressed(batch, channel, programId);
    allowed.push(...result.allowed);
    suppressed.push(...result.suppressed);
  }

  return { allowed, suppressed };
}

/**
 * POST /api/outreach/campaigns
 * Create and optionally send an outreach campaign
 */
export async function POST(req: NextRequest) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Verify authentication (throws if not authenticated)
    const user = await verifyAuth(req);

    const body = await req.json();
    const validatedData = createCampaignSchema.parse(body);

    // Verify user has access to this campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: validatedData.campaignId },
      include: {
        guardians: {
          select: { id: true },
        },
        teamMembers: {
          where: { deletedAt: null },
          include: {
            contacts: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Canonical ownership rule used across the codebase. Leader-level callers
    // may address the whole roster; anyone else may only address their own.
    const isLeaderLevel =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some((g) => g.id === user.id) ||
      user.role === "ADMIN";

    const callerTeamMembers = campaign.teamMembers.filter(
      (tm) => tm.userId === user.id
    );

    if (!isLeaderLevel && callerTeamMembers.length === 0) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to create outreach campaigns for this campaign" },
        { status: 403 }
      );
    }

    // Validate message content based on type
    if ((validatedData.type === "EMAIL" || validatedData.type === "BOTH") &&
        (!validatedData.emailSubject || !validatedData.emailBody)) {
      return NextResponse.json(
        { success: false, error: "Email subject and body are required for email campaigns" },
        { status: 400 }
      );
    }

    if ((validatedData.type === "SMS" || validatedData.type === "BOTH") && !validatedData.smsBody) {
      return NextResponse.json(
        { success: false, error: "SMS body is required for SMS campaigns" },
        { status: 400 }
      );
    }

    // Determine which team members' contacts this caller may address.
    //
    // A non-leader (a player, once player logins exist) gets exactly their own
    // TeamMember rows, derived server-side. The client-supplied teamMemberIds
    // list is IGNORED for them — honouring it would let one player blast every
    // other minor's family contacts.
    let teamMembers;
    if (isLeaderLevel) {
      teamMembers = campaign.teamMembers;
      if (validatedData.teamMemberIds && validatedData.teamMemberIds.length > 0) {
        teamMembers = teamMembers.filter((tm) =>
          validatedData.teamMemberIds!.includes(tm.id)
        );
      }
    } else {
      teamMembers = callerTeamMembers;
    }

    // Collect all contacts
    const allContacts: OutreachContact[] = teamMembers.flatMap((tm) => tm.contacts);

    if (allContacts.length === 0) {
      return NextResponse.json(
        { success: false, error: "No contacts found to send to" },
        { status: 400 }
      );
    }

    const programId = campaign.programId ?? null;
    const wantsEmail = validatedData.type === "EMAIL" || validatedData.type === "BOTH";
    const wantsSms = validatedData.type === "SMS" || validatedData.type === "BOTH";

    // Apply the suppression list BEFORE we commit to a recipient list, so the
    // response can report an honest skipped count and opted-out people are
    // never queued in the first place. sendEmail/sendSMS re-check at dispatch
    // time to close the race where someone opts out mid-send.
    const emailCandidates = wantsEmail ? allContacts.filter((c) => !!c.email) : [];
    const smsCandidates = wantsSms ? allContacts.filter((c) => !!c.phone) : [];

    const { allowed: emailContacts, suppressed: suppressedEmailContacts } =
      await partitionSuppressed(emailCandidates, "EMAIL", programId);
    const { allowed: smsContacts, suppressed: suppressedSmsContacts } =
      await partitionSuppressed(smsCandidates, "SMS", programId);

    const skipped = suppressedEmailContacts.length + suppressedSmsContacts.length;
    const attempted = emailCandidates.length + smsCandidates.length;

    // Create the outreach campaign
    const outreachCampaign = await prisma.outreachCampaign.create({
      data: {
        campaignId: validatedData.campaignId,
        createdBy: user.id,
        name: validatedData.name,
        type: validatedData.type,
        status: validatedData.scheduledFor ? "SCHEDULED" : "SENDING",
        emailSubject: validatedData.emailSubject,
        emailBody: validatedData.emailBody,
        smsBody: validatedData.smsBody,
        scheduledFor: validatedData.scheduledFor ? new Date(validatedData.scheduledFor) : null,
        totalRecipients: allContacts.length,
      },
    });

    // If not scheduled, send immediately
    if (!validatedData.scheduledFor) {
      // Send emails and SMS in the background (don't wait)
      sendOutreachMessages(
        outreachCampaign.id,
        { emailContacts, smsContacts, suppressedEmailContacts, suppressedSmsContacts },
        validatedData,
        campaign.slug,
        programId
      ).catch((error) => console.error("Failed to send outreach messages:", error));
    }

    return NextResponse.json(
      {
        success: true,
        outreachCampaign: {
          id: outreachCampaign.id,
          name: outreachCampaign.name,
          status: outreachCampaign.status,
          totalRecipients: outreachCampaign.totalRecipients,
        },
        attempted,
        queued: attempted - skipped,
        skipped,
        message: validatedData.scheduledFor
          ? "Outreach campaign scheduled"
          : `Outreach campaign is being sent to ${attempted - skipped} of ${attempted} recipient${
              attempted !== 1 ? "s" : ""
            }${skipped > 0 ? ` (${skipped} skipped — opted out)` : ""}`,
      },
      { status: 201 }
    );
  } catch (error) {
    // verifyAuth throws a NextResponse (401) on auth failure - return it as-is
    if (error instanceof NextResponse) {
      return error;
    }

    console.error("Outreach campaign error:", error);

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

    // Detail is logged above; don't leak internal error messages to the client.
    return NextResponse.json(
      { success: false, error: "Failed to create outreach campaign" },
      { status: 500 }
    );
  }
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

/**
 * Send outreach messages to contacts
 */
async function sendOutreachMessages(
  outreachCampaignId: string,
  audience: {
    emailContacts: OutreachContact[];
    smsContacts: OutreachContact[];
    suppressedEmailContacts: OutreachContact[];
    suppressedSmsContacts: OutreachContact[];
  },
  campaignData: {
    type: "EMAIL" | "SMS" | "BOTH";
    emailSubject?: string;
    emailBody?: string;
    smsBody?: string;
  },
  campaignSlug: string,
  programId: string | null
) {
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

  // Send email
  for (const contact of audience.emailContacts) {
    if (!contact.email) continue;

    try {
      // Replace placeholders in email
      const firstName = contact.firstName || "Friend";
      const personalizedBody = campaignData.emailBody!
        .replace(/\{firstName\}/g, firstName)
        .replace(/\{donationLink\}/g, donationLink);

      const result = await sendEmail({
        to: contact.email,
        subject: campaignData.emailSubject!,
        html: personalizedBody,
        text: personalizedBody.replace(/<[^>]*>/g, ""), // Strip HTML tags for text version
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

        // Log the outreach
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

        // Update contact
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

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Send SMS
  for (const contact of audience.smsContacts) {
    if (!contact.phone) continue;

    try {
      const formattedPhone = formatPhoneNumber(contact.phone);
      if (!formattedPhone) {
        throw new Error("Invalid phone number format");
      }

      const firstName = contact.firstName || "Friend";
      const personalizedBody = campaignData.smsBody!
        .replace(/\{firstName\}/g, firstName)
        .replace(/\{donationLink\}/g, donationLink);

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

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (skipped > 0) {
    console.warn(
      `🔕 Outreach campaign ${outreachCampaignId}: skipped ${skipped} opted-out recipient(s).`
    );
  }

  // Update campaign stats with what actually went out.
  await prisma.outreachCampaign.update({
    where: { id: outreachCampaignId },
    data: {
      status: emailsSent + smsSent > 0 ? "SENT" : "FAILED",
      emailsSent,
      smsSent,
      sentAt: emailsSent + smsSent > 0 ? new Date() : null,
    },
  });
}

/**
 * GET /api/outreach/campaigns?campaignId=xxx
 * Get all outreach campaigns for a campaign
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication (throws if not authenticated)
    const user = await verifyAuth(req);

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    // Verify the user has access to this campaign (leader, guardian, admin, or
    // team member)
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        primaryLeaderId: true,
        guardians: {
          select: { id: true },
        },
        teamMembers: {
          where: { userId: user.id, deletedAt: null },
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

    const isLeaderLevel =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some((g) => g.id === user.id) ||
      user.role === "ADMIN";
    const isTeamMember = campaign.teamMembers.length > 0;

    if (!isLeaderLevel && !isTeamMember) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to view outreach campaigns for this campaign" },
        { status: 403 }
      );
    }

    const campaigns = await prisma.outreachCampaign.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      include: {
        createdByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        campaigns,
        total: campaigns.length,
      },
      { status: 200 }
    );
  } catch (error) {
    // verifyAuth throws a NextResponse (401) on auth failure - return it as-is
    if (error instanceof NextResponse) {
      return error;
    }

    console.error("Failed to fetch outreach campaigns:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
