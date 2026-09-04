import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  createTeamMemberSchema,
  listTeamMembersQuerySchema
} from "@/lib/validations/team-member";
import {
  generateUniqueFundraisingLinkCode,
  checkTeamMemberLimit,
  checkDuplicateEmail,
  sendTeamMemberInvitation,
  formatFundraisingLink,
  formatTeamMemberResponse,
} from "@/lib/utils/team-member";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitConfigs,
  applyRateLimitHeaders
} from "@/lib/utils/rate-limit";
import {
  generateInvitationToken,
  invitationTokenExpiry,
  buildOnboardingLink,
} from "@/lib/onboarding";
import { checkCsrf } from "@/lib/csrf";

/**
 * POST /api/campaigns/[campaignId]/team-members
 * Add a new team member to the campaign
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Authentication check
    const sessionToken = req.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Apply rate limiting (100 per user per hour)
    const rateLimitId = getRateLimitIdentifier(req, user.id);
    const rateLimitResult = checkRateLimit(rateLimitId, rateLimitConfigs.teamMember);

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
      applyRateLimitHeaders(response.headers, rateLimitResult);
      return response;
    }

    const campaignId = params.campaignId;

    // Verify campaign exists and user is authorized
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        guardians: {
          select: { id: true }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check authorization
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some(g => g.id === user.id);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to manage this campaign" },
        { status: 403 }
      );
    }

    // Check team member limit (100 per campaign)
    const limitReached = await checkTeamMemberLimit(campaignId);
    if (limitReached) {
      return NextResponse.json(
        {
          success: false,
          error: "Campaign has reached maximum team member limit (100)"
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createTeamMemberSchema.parse(body);

    // Check for duplicate email in campaign
    const isDuplicate = await checkDuplicateEmail(campaignId, validatedData.email);
    if (isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: "A team member with this email already exists in the campaign"
        },
        { status: 409 }
      );
    }

    const normalizedEmail = validatedData.email.toLowerCase();

    // A removed player is only ever soft-deleted, and their row keeps the money
    // they raised. Re-adding that email must revive the original record rather
    // than insert a second one — a new row would strand their historical
    // amountRaised on a record no query can see.
    const softDeleted = await prisma.teamMember.findFirst({
      where: {
        campaignId,
        email: normalizedEmail,
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: "desc" },
      select: { id: true, fundLinkCode: true },
    });

    // Generate unique invitation token for onboarding (H14: 14-day expiry)
    const invitationToken = generateInvitationToken();

    const memberFields = {
      name: validatedData.name,
      email: normalizedEmail,
      personalGoal: validatedData.personalGoal
        ? BigInt(Math.round(validatedData.personalGoal * 100))
        : null,
      position: validatedData.position,
      grade: validatedData.grade,
      profilePhotoUrl: validatedData.profilePhotoUrl,
      phoneNumber: validatedData.phoneNumber,
      invitationToken,
      invitationTokenExpiresAt: invitationTokenExpiry(),
      invitationStatus: "PENDING" as const,
      invitationSentAt: new Date(),
    };

    const campaignSelect = {
      campaign: {
        select: { slug: true, teamName: true, organizationName: true },
      },
    };

    let teamMember;
    let fundLinkCode: string;
    try {
      if (softDeleted) {
        // Keep the existing fundraising link if the player still has one, so any
        // link already shared for them keeps working.
        fundLinkCode =
          softDeleted.fundLinkCode ??
          (await generateUniqueFundraisingLinkCode(campaignId));

        teamMember = await prisma.teamMember.update({
          where: { id: softDeleted.id },
          data: {
            ...memberFields,
            fundLinkCode,
            // Restore, deliberately leaving amountRaised and their donation
            // history untouched.
            deletedAt: null,
            onboardingCompletedAt: null,
            joinedAt: null,
          },
          include: campaignSelect,
        });
      } else {
        fundLinkCode = await generateUniqueFundraisingLinkCode(campaignId);

        teamMember = await prisma.teamMember.create({
          data: {
            campaignId,
            ...memberFields,
            fundLinkCode,
            amountRaised: BigInt(0),
            userId: null, // Will be connected when user signs up
          },
          include: campaignSelect,
        });
      }
    } catch (error) {
      // The (campaignId, email) unique index is partial on deletedAt IS NULL, so
      // this is a genuine live collision that raced the check above — report it
      // as the conflict it is instead of a generic 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "A team member with this email already exists in the campaign",
          },
          { status: 409 }
        );
      }
      throw error;
    }

    // Send invitation email with onboarding link
    const fundraisingLink = formatFundraisingLink(campaign.slug, fundLinkCode);
    const onboardingLink = buildOnboardingLink(teamMember.id, invitationToken);

    const emailSent = await sendTeamMemberInvitation(
      validatedData.email,
      validatedData.name,
      `${campaign.teamName} - ${campaign.organizationName}`,
      fundraisingLink,
      validatedData.personalGoal ?? undefined,
      onboardingLink
    );

    if (!emailSent) {
      // Update status if email failed
      await prisma.teamMember.update({
        where: { id: teamMember.id },
        data: { invitationStatus: "EMAIL_FAILED" }
      });
    }

    return NextResponse.json(
      {
        success: true,
        teamMember: {
          id: teamMember.id,
          name: teamMember.name,
          email: teamMember.email,
          personalGoal: teamMember.personalGoal
            ? Number(teamMember.personalGoal) / 100
            : null,
          // A revived member keeps the total they raised before removal.
          amountRaised: Number(teamMember.amountRaised) / 100,
          fundLinkCode: teamMember.fundLinkCode,
          fundraisingLink,
          invitationStatus: emailSent ? "PENDING" : "EMAIL_FAILED",
          invitationSentAt: teamMember.invitationSentAt,
          // H7: copyable link, also the fallback when the invite email fails.
          onboardingLink,
          // True when this re-activated a previously removed player, which is
          // why amountRaised can be non-zero on a freshly "added" member.
          restored: Boolean(softDeleted),
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Failed to add team member:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map(e => ({
            field: e.path.join("."),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        // Detail is logged above; never leak internal error text to the client.
        error: "Failed to add team member"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/[campaignId]/team-members
 * List all team members for a campaign with pagination
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // Authentication check
    const sessionToken = req.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const campaignId = params.campaignId;

    // Verify campaign exists and user is authorized
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        guardians: {
          select: { id: true }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check authorization: campaign leader, guardian, or admin
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some(g => g.id === user.id) ||
      user.role === "ADMIN";

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to view this campaign's team members" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);

    // Parse query parameters
    const queryParams = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "25",
      sortBy: searchParams.get("sortBy") || "amountRaised",
      sortOrder: searchParams.get("sortOrder") || "desc",
      status: searchParams.get("status") || "all",
      search: searchParams.get("search") || undefined,
    };

    // Validate query parameters
    const validatedQuery = listTeamMembersQuerySchema.parse(queryParams);
    const page = typeof validatedQuery.page === 'number' ? validatedQuery.page : parseInt(validatedQuery.page || "1");
    const limit = typeof validatedQuery.limit === 'number' ? validatedQuery.limit : parseInt(validatedQuery.limit || "25");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      campaignId,
      deletedAt: null, // Exclude soft-deleted members
    };

    // Add status filter
    // Map query values to actual InvitationStatus enum values (PENDING,
    // ACCEPTED, EMAIL_FAILED, EXPIRED). Unknown values (e.g. "rejected")
    // are rejected with 400 instead of being passed to Prisma.
    if (validatedQuery.status && validatedQuery.status !== "all") {
      const statusMap: Record<string, string> = {
        pending: "PENDING",
        accepted: "ACCEPTED",
        email_failed: "EMAIL_FAILED",
        expired: "EXPIRED",
      };
      const mappedStatus = statusMap[validatedQuery.status.toLowerCase()];
      if (!mappedStatus) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status filter "${validatedQuery.status}". Valid values: all, pending, accepted, email_failed, expired`,
          },
          { status: 400 }
        );
      }
      where.invitationStatus = mappedStatus;
    }

    // Add search filter
    if (validatedQuery.search) {
      where.OR = [
        { name: { contains: validatedQuery.search, mode: 'insensitive' } },
        { email: { contains: validatedQuery.search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    switch (validatedQuery.sortBy) {
      case "name":
        orderBy.name = validatedQuery.sortOrder;
        break;
      case "personalGoal":
        orderBy.personalGoal = validatedQuery.sortOrder;
        break;
      case "dateJoined":
        orderBy.createdAt = validatedQuery.sortOrder;
        break;
      case "amountRaised":
      default:
        orderBy.amountRaised = validatedQuery.sortOrder;
        break;
    }

    // Get total count for pagination
    const totalCount = await prisma.teamMember.count({ where });

    // Get team members with pagination
    const teamMembers = await prisma.teamMember.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        campaign: {
          select: { slug: true }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            emailVerified: true,
          }
        },
        _count: {
          select: {
            donations: {
              where: { status: "COMPLETED" }
            }
          }
        }
      }
    });

    // Format response
    const formattedMembers = teamMembers.map(member => ({
      id: member.id,
      name: member.name,
      email: member.email,
      personalGoal: member.personalGoal ? Number(member.personalGoal) / 100 : null,
      amountRaised: Number(member.amountRaised) / 100,
      position: member.position,
      grade: member.grade,
      profilePhotoUrl: member.profilePhotoUrl,
      phoneNumber: member.phoneNumber,
      invitationStatus: member.invitationStatus,
      // H7: coach-copyable onboarding link. Only for members who have not
      // accepted and still hold a live token; null after claim (the token is
      // cleared) so a spent link is never shown.
      onboardingLink:
        member.invitationStatus !== "ACCEPTED" && member.invitationToken
          ? buildOnboardingLink(member.id, member.invitationToken)
          : null,
      invitationTokenExpiresAt: member.invitationTokenExpiresAt,
      joinedAt: member.joinedAt,
      fundLinkCode: member.fundLinkCode,
      fundraisingLink: member.fundLinkCode
        ? formatFundraisingLink(member.campaign.slug, member.fundLinkCode)
        : null,
      donationCount: member._count.donations,
      user: member.user ? {
        id: member.user.id,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        emailVerified: member.user.emailVerified,
      } : null,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return NextResponse.json({
      success: true,
      teamMembers: formattedMembers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext,
        hasPrev,
        nextPage: hasNext ? page + 1 : null,
        prevPage: hasPrev ? page - 1 : null,
      }
    });

  } catch (error) {
    console.error("Failed to fetch team members:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch team members"
      },
      { status: 500 }
    );
  }
}