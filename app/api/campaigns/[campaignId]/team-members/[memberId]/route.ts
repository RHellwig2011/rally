import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { updateTeamMemberSchema } from "@/lib/validations/team-member";
import {
  checkDuplicateEmail,
  formatFundraisingLink,
  sendTeamMemberInvitation,
} from "@/lib/utils/team-member";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitConfigs,
  applyRateLimitHeaders
} from "@/lib/utils/rate-limit";

/**
 * GET /api/campaigns/[campaignId]/team-members/[memberId]
 * Get details of a specific team member
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string; memberId: string } }
) {
  try {
    const { campaignId, memberId } = params;

    // Get team member with campaign and donation data
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        campaignId,
        deletedAt: null,
      },
      include: {
        campaign: {
          select: { slug: true, teamName: true, organizationName: true }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            emailVerified: true,
          }
        },
        donations: {
          where: { status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            grossAmount: true,
            donorName: true,
            isAnonymous: true,
            createdAt: true,
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

    if (!teamMember) {
      return NextResponse.json(
        { success: false, error: "Team member not found" },
        { status: 404 }
      );
    }

    // Calculate statistics
    const stats = await prisma.donation.aggregate({
      where: {
        teamMemberId: memberId,
        status: "COMPLETED",
      },
      _sum: {
        grossAmount: true,
      },
      _avg: {
        grossAmount: true,
      },
      _max: {
        grossAmount: true,
      }
    });

    // Format response
    const response = {
      success: true,
      teamMember: {
        id: teamMember.id,
        name: teamMember.name,
        email: teamMember.email,
        personalGoal: teamMember.personalGoal ? Number(teamMember.personalGoal) / 100 : null,
        amountRaised: Number(teamMember.amountRaised) / 100,
        position: teamMember.position,
        grade: teamMember.grade,
        profilePhotoUrl: teamMember.profilePhotoUrl,
        phoneNumber: teamMember.phoneNumber,
        invitationStatus: teamMember.invitationStatus,
        joinedAt: teamMember.joinedAt,
        fundLinkCode: teamMember.fundLinkCode,
        fundraisingLink: teamMember.fundLinkCode
          ? formatFundraisingLink(teamMember.campaign.slug, teamMember.fundLinkCode)
          : null,

        // Statistics
        statistics: {
          totalRaised: Number(stats._sum.grossAmount || 0) / 100,
          averageDonation: Number(stats._avg.grossAmount || 0) / 100,
          largestDonation: Number(stats._max.grossAmount || 0) / 100,
          donationCount: teamMember._count.donations,
        },

        // Recent donations
        recentDonations: teamMember.donations.map(d => ({
          id: d.id,
          amount: Number(d.grossAmount) / 100,
          donorName: d.isAnonymous ? "Anonymous" : d.donorName,
          createdAt: d.createdAt,
        })),

        // User info if connected
        user: teamMember.user,

        // Campaign info
        campaign: {
          slug: teamMember.campaign.slug,
          name: `${teamMember.campaign.teamName} - ${teamMember.campaign.organizationName}`,
        },

        createdAt: teamMember.createdAt,
        updatedAt: teamMember.updatedAt,
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Failed to fetch team member:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch team member" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/campaigns/[campaignId]/team-members/[memberId]
 * Update team member details
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { campaignId: string; memberId: string } }
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

    // Apply rate limiting
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

    const { campaignId, memberId } = params;

    // Verify campaign and authorization
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

    // Check team member exists
    const existingMember = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        campaignId,
        deletedAt: null,
      }
    });

    if (!existingMember) {
      return NextResponse.json(
        { success: false, error: "Team member not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = updateTeamMemberSchema.parse(body);

    // NOTE: Email cannot be changed as per roadmap requirements
    // If they need to change email, they should delete and re-add

    // Update team member
    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.personalGoal !== undefined && {
          personalGoal: validatedData.personalGoal
            ? BigInt(Math.round(validatedData.personalGoal * 100))
            : null
        }),
        ...(validatedData.position !== undefined && { position: validatedData.position }),
        ...(validatedData.grade !== undefined && { grade: validatedData.grade }),
        ...(validatedData.profilePhotoUrl !== undefined && { profilePhotoUrl: validatedData.profilePhotoUrl }),
        ...(validatedData.phoneNumber !== undefined && { phoneNumber: validatedData.phoneNumber }),
        updatedAt: new Date(),
      },
      include: {
        campaign: {
          select: { slug: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      teamMember: {
        id: updatedMember.id,
        name: updatedMember.name,
        email: updatedMember.email,
        personalGoal: updatedMember.personalGoal ? Number(updatedMember.personalGoal) / 100 : null,
        amountRaised: Number(updatedMember.amountRaised) / 100,
        position: updatedMember.position,
        grade: updatedMember.grade,
        profilePhotoUrl: updatedMember.profilePhotoUrl,
        phoneNumber: updatedMember.phoneNumber,
        fundraisingLink: updatedMember.fundLinkCode
          ? formatFundraisingLink(updatedMember.campaign.slug, updatedMember.fundLinkCode)
          : null,
        updatedAt: updatedMember.updatedAt,
      }
    });

  } catch (error) {
    console.error("Failed to update team member:", error);

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
        error: error instanceof Error ? error.message : "Failed to update team member"
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/[campaignId]/team-members/[memberId]
 * Soft delete a team member
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { campaignId: string; memberId: string } }
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

    const { campaignId, memberId } = params;

    // Verify campaign and authorization
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

    // Only campaign leader can delete team members
    if (campaign.primaryLeaderId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Only campaign leader can remove team members" },
        { status: 403 }
      );
    }

    // Check team member exists
    const existingMember = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        campaignId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            donations: true
          }
        }
      }
    });

    if (!existingMember) {
      return NextResponse.json(
        { success: false, error: "Team member not found" },
        { status: 404 }
      );
    }

    // Soft delete: preserve data for reporting
    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        deletedAt: new Date(),
        // Note: No need to change invitationStatus - deletedAt is sufficient for soft delete
      }
    });

    return NextResponse.json({
      success: true,
      message: "Team member removed successfully",
      preservedData: {
        donationCount: existingMember._count.donations,
        amountRaised: Number(existingMember.amountRaised) / 100,
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Failed to delete team member:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to remove team member"
      },
      { status: 500 }
    );
  }
}