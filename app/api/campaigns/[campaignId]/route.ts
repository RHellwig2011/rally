import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateCampaignSchema } from "@/lib/validations/campaign";
import { z } from "zod";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitConfigs,
  applyRateLimitHeaders
} from "@/lib/utils/rate-limit";
import { checkCsrf } from "@/lib/csrf";

/**
 * GET /api/campaigns/[campaignId]
 * Retrieve campaign details by ID with aggregated statistics
 * Returns: campaign details, total raised, donor count, team member count, fundraising progress
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // Get token from cookie
    const sessionToken = req.cookies.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromToken(sessionToken);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const campaignId = params.campaignId;

    // Get campaign with all related data and aggregations
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        primaryLeader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        bankingAccount: {
          select: {
            id: true,
            availableBalance: true,
            totalRaised: true,
            disbursedTotal: true,
            pendingDisbursement: true,
            platformFeesCollected: true,
          }
        },
        // Get aggregated statistics
        _count: {
          select: {
            teamMembers: true,
            donations: {
              where: {
                status: "COMPLETED"
              }
            }
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Sensitive data (banking balances, leader/guardian emails) is only
    // returned to the campaign leader, its guardians, or an admin
    const isOwner =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some((g) => g.id === user.id) ||
      user.role === "ADMIN" ||
      user.role === "BANK_ADMIN";

    // Calculate additional statistics
    const donations = await prisma.donation.aggregate({
      where: {
        campaignId: campaignId,
        status: "COMPLETED"
      },
      _sum: {
        grossAmount: true,
        netAmount: true,
        platformFee: true,
      },
      _count: {
        id: true,
        donorEmail: true
      },
      _avg: {
        grossAmount: true
      },
      _max: {
        grossAmount: true
      }
    });

    // Get unique donor count
    const uniqueDonors = await prisma.donation.findMany({
      where: {
        campaignId: campaignId,
        status: "COMPLETED"
      },
      select: {
        donorEmail: true
      },
      distinct: ['donorEmail']
    });

    // Calculate days remaining
    const now = new Date();
    const endDate = campaign.endDate ? new Date(campaign.endDate) : null;
    const daysRemaining = endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    // Convert BigInt to numbers for JSON serialization
    const totalRaised = Number(donations._sum.grossAmount || 0) / 100; // Convert from cents
    const goalAmount = Number(campaign.goalAmount) / 100;
    const progress = goalAmount > 0 ? (totalRaised / goalAmount) * 100 : 0;

    // Format response
    const response = {
      success: true,
      campaign: {
        id: campaign.id,
        organizationName: campaign.organizationName,
        teamName: campaign.teamName,
        slug: campaign.slug,
        description: campaign.description,
        category: campaign.category,
        primaryColor: campaign.primaryColor,
        secondaryColor: campaign.secondaryColor,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        daysRemaining,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,

        // Financial data
        goalAmount,
        totalRaised,
        currentAmount: Number(campaign.currentAmount) / 100,
        progress: Math.min(100, Math.round(progress * 100) / 100), // Cap at 100%

        // Statistics
        statistics: {
          teamMemberCount: campaign._count.teamMembers,
          donationCount: donations._count.id || 0,
          uniqueDonorCount: uniqueDonors.length,
          averageDonation: donations._avg.grossAmount ? Number(donations._avg.grossAmount) / 100 : 0,
          largestDonation: donations._max.grossAmount ? Number(donations._max.grossAmount) / 100 : 0,
        },

        // Leadership (emails only exposed to owner/guardian/admin)
        primaryLeader: isOwner
          ? campaign.primaryLeader
          : {
              id: campaign.primaryLeader.id,
              firstName: campaign.primaryLeader.firstName,
              lastName: campaign.primaryLeader.lastName,
            },
        guardians: isOwner
          ? campaign.guardians
          : campaign.guardians.map((g) => ({
              id: g.id,
              firstName: g.firstName,
              lastName: g.lastName,
            })),

        // Banking (only included if user has access)
        bankingAccount: isOwner && campaign.bankingAccount ? {
          availableBalance: Number(campaign.bankingAccount.availableBalance) / 100,
          totalRaised: Number(campaign.bankingAccount.totalRaised) / 100,
          disbursedTotal: Number(campaign.bankingAccount.disbursedTotal) / 100,
          pendingDisbursement: Number(campaign.bankingAccount.pendingDisbursement) / 100,
          platformFeesCollected: Number(campaign.bankingAccount.platformFeesCollected) / 100,
        } : null
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Failed to fetch campaign:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campaign details" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/campaigns/[campaignId]
 * Update campaign details
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Get token from cookie
    const sessionToken = req.cookies.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromToken(sessionToken);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Apply rate limiting (50 updates per user per hour)
    const rateLimitId = getRateLimitIdentifier(req, user.id);
    const rateLimitResult = checkRateLimit(rateLimitId, rateLimitConfigs.campaignUpdate);

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

    // Check if user has permission to update this campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        primaryLeaderId: true,
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
    const isLeader = campaign.primaryLeaderId === user.id;
    const isGuardian = campaign.guardians.some(g => g.id === user.id);

    if (!isLeader && !isGuardian) {
      return NextResponse.json(
        { success: false, error: "Not authorized to update this campaign" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = updateCampaignSchema.parse(body);

    // Prepare update data
    const updateData: any = {};

    if (validatedData.organizationName) updateData.organizationName = validatedData.organizationName;
    if (validatedData.teamName) updateData.teamName = validatedData.teamName;
    if (validatedData.description) updateData.description = validatedData.description;
    if (validatedData.goalAmount) {
      updateData.goalAmount = BigInt(Math.round(validatedData.goalAmount * 100));
    }
    if (validatedData.endDate) updateData.endDate = new Date(validatedData.endDate);
    if (validatedData.primaryColor) updateData.primaryColor = validatedData.primaryColor;
    if (validatedData.secondaryColor) updateData.secondaryColor = validatedData.secondaryColor;
    if (validatedData.seasonYear !== undefined) updateData.seasonYear = validatedData.seasonYear;

    // Linking a campaign to a program is a privilege change, not cosmetics.
    // GET /api/programs/[programId]/alumni grants access to anyone who leads a
    // campaign in the program, and that data is contact details for athletes,
    // collected while many of them were minors. Attaching your own campaign to
    // a stranger's program would therefore hand you their alumni database, so
    // the caller must already belong to the program they name.
    if (validatedData.programId !== undefined) {
      if (validatedData.programId === null) {
        updateData.programId = null;
      } else {
        const program = await prisma.program.findUnique({
          where: { id: validatedData.programId },
          select: {
            id: true,
            createdById: true,
            campaigns: { select: { primaryLeaderId: true } },
          },
        });

        if (!program) {
          return NextResponse.json(
            { success: false, error: "Program not found" },
            { status: 404 }
          );
        }

        const belongsToProgram =
          user.role === "ADMIN" ||
          program.createdById === user.id ||
          program.campaigns.some((c) => c.primaryLeaderId === user.id);

        if (!belongsToProgram) {
          return NextResponse.json(
            {
              success: false,
              error: "Not authorized to link this campaign to that program",
            },
            { status: 403 }
          );
        }

        updateData.programId = program.id;
      }
    }

    // Update campaign
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
      include: {
        primaryLeader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      campaign: {
        id: updatedCampaign.id,
        organizationName: updatedCampaign.organizationName,
        teamName: updatedCampaign.teamName,
        slug: updatedCampaign.slug,
        description: updatedCampaign.description,
        goalAmount: Number(updatedCampaign.goalAmount) / 100,
        status: updatedCampaign.status,
        programId: updatedCampaign.programId,
        seasonYear: updatedCampaign.seasonYear,
        updatedAt: updatedCampaign.updatedAt,
      }
    });

  } catch (error) {
    console.error("Campaign update error:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map(e => ({ field: e.path.join("."), message: e.message }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        // Detail is logged above; never leak internal error text to the client.
        error: "Failed to update campaign"
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/[campaignId]
 * Delete a campaign (soft delete for data integrity)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Get token from cookie
    const sessionToken = req.cookies.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromToken(sessionToken);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const campaignId = params.campaignId;

    // Check if user has permission to delete this campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        primaryLeaderId: true,
        status: true,
        donations: {
          select: { id: true },
          take: 1
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Only primary leader can delete
    if (campaign.primaryLeaderId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Not authorized to delete this campaign" },
        { status: 403 }
      );
    }

    // Can only delete DRAFT campaigns or campaigns with no donations
    if (campaign.status !== "DRAFT" && campaign.donations.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete campaign with donations. Please archive it instead."
        },
        { status: 400 }
      );
    }

    // Soft delete by updating status to ARCHIVED
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "ARCHIVED"
      }
    });

    return NextResponse.json({
      success: true,
      message: "Campaign deleted successfully"
    });

  } catch (error) {
    console.error("Campaign deletion error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete campaign"
      },
      { status: 500 }
    );
  }
}