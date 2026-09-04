import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/requireAuth";
import prisma from "@/lib/prisma";
import { partitionSuppressed } from "@/lib/suppression";
import { checkCsrf } from "@/lib/csrf";
import {
  deliverOutreachCampaign,
  type OutreachContact,
} from "@/lib/outreach";

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
  // Omit to send immediately. SCHEDULED requires a future scheduledFor.
  status: z.enum(["SCHEDULED"]).optional(),
});

/**
 * Default page size for the GET list below. Generous on purpose: existing
 * clients send no limit and must keep seeing a campaign's whole history.
 */
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 200;

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

    const wantsSchedule =
      validatedData.status === "SCHEDULED" || Boolean(validatedData.scheduledFor);

    if (validatedData.status === "SCHEDULED" && !validatedData.scheduledFor) {
      return NextResponse.json(
        { success: false, error: "scheduledFor is required when status is SCHEDULED" },
        { status: 400 }
      );
    }

    if (wantsSchedule) {
      // A schedule in the past is a client bug, not a request to send now.
      if (
        !validatedData.scheduledFor ||
        new Date(validatedData.scheduledFor).getTime() <= Date.now()
      ) {
        return NextResponse.json(
          { success: false, error: "scheduledFor must be a future date and time" },
          { status: 400 }
        );
      }
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
        status: wantsSchedule ? "SCHEDULED" : "SENDING",
        emailSubject: validatedData.emailSubject,
        emailBody: validatedData.emailBody,
        smsBody: validatedData.smsBody,
        scheduledFor: wantsSchedule && validatedData.scheduledFor
          ? new Date(validatedData.scheduledFor)
          : null,
        totalRecipients: allContacts.length,
      },
    });

    // If not scheduled, send immediately
    if (!wantsSchedule) {
      // Send emails and SMS in the background (don't wait)
      deliverOutreachCampaign(
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
        message: wantsSchedule
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

    // Clamped pagination, mirroring app/api/admin/transactions. `total` is the
    // unpaginated count, so `total` keeps meaning what it always did rather
    // than silently becoming "size of this page".
    const parsedLimit = parseInt(searchParams.get("limit") || String(DEFAULT_LIST_LIMIT), 10);
    const limit = Number.isNaN(parsedLimit)
      ? DEFAULT_LIST_LIMIT
      : Math.min(Math.max(parsedLimit, 1), MAX_LIST_LIMIT);
    const parsedOffset = parseInt(searchParams.get("offset") || "0", 10);
    const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

    const [campaigns, total] = await Promise.all([
      prisma.outreachCampaign.findMany({
        where: { campaignId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          createdByUser: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.outreachCampaign.count({ where: { campaignId } }),
    ]);

    return NextResponse.json(
      {
        success: true,
        campaigns,
        total,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + campaigns.length < total,
        },
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
