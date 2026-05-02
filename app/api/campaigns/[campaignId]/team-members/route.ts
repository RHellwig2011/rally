import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import crypto from "crypto";
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

/**
 * POST /api/campaigns/[campaignId]/team-members
 * Add a new team member to the campaign
 */
export async function POST(
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

    // Generate unique fundraising link code
    const fundLinkCode = await generateUniqueFundraisingLinkCode(campaignId);

    // Generate unique invitation token for onboarding
    const invitationToken = crypto.randomBytes(32).toString('hex');

    // Create team member record
    const teamMember = await prisma.teamMember.create({
      data: {
        campaignId,
        name: validatedData.name,
        email: validatedData.email.toLowerCase(),
        personalGoal: validatedData.personalGoal
          ? BigInt(Math.round(validatedData.personalGoal * 100))
          : null,
        position: validatedData.position,
        grade: validatedData.grade,
        profilePhotoUrl: validatedData.profilePhotoUrl,
        phoneNumber: validatedData.phoneNumber,
        fundLinkCode,
        invitationToken,
        invitationStatus: "PENDING",
        invitationSentAt: new Date(),
        amountRaised: BigInt(0),
        userId: null, // Will be connected when user signs up
      },
      include: {
        campaign: {
          select: { slug: true, teamName: true, organizationName: true }
        }
      }
    });

    // Send invitation email with onboarding link
    const fundraisingLink = formatFundraisingLink(campaign.slug, fundLinkCode);
    const onboardingLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/player/onboard/${teamMember.id}?token=${invitationToken}`;

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
          amountRaised: 0,
          fundLinkCode: teamMember.fundLinkCode,
          fundraisingLink,
          invitationStatus: emailSent ? "PENDING" : "EMAIL_FAILED",
          invitationSentAt: teamMember.invitationSentAt,
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
        error: error instanceof Error ? error.message : "Failed to add team member"
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
    const campaignId = params.campaignId;
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
    if (validatedQuery.status && validatedQuery.status !== "all") {
      where.invitationStatus = validatedQuery.status.toUpperCase();
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