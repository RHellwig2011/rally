import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";

/**
 * GET /api/campaigns/[campaignId]/recent-donations
 * Get recent donation activity feed for a campaign
 * Returns last 20 donations with donor info (respecting anonymity)
 *
 * PRIVATE: this feed carries donor names, amounts, donor messages and the
 * supported player's name. Its only consumer is the campaign owner's dashboard
 * (app/dashboard/[campaignId]/page.tsx), so it is restricted to the campaign
 * leader, its guardians, and admins. The public campaign page uses the
 * anonymity-scrubbed /api/donations feed instead.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const campaignId = params.campaignId;

    // Parse query parameters (NaN-guarded and clamped)
    const searchParams = req.nextUrl.searchParams;
    const rawLimit = parseInt(searchParams.get('limit') || '20');
    const rawOffset = parseInt(searchParams.get('offset') || '0');
    const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    // Authentication
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

    // Verify campaign exists (guardians included for the ownership check only)
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        teamName: true,
        organizationName: true,
        primaryLeaderId: true,
        guardians: { select: { id: true } },
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Authorization: campaign leader, guardian, or admin only.
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some((g) => g.id === user.id) ||
      user.role === "ADMIN";

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    // Get recent donations with team member info
    const donations = await prisma.donation.findMany({
      where: {
        campaignId,
        status: "COMPLETED",
      },
      select: {
        id: true,
        grossAmount: true,
        donorName: true,
        donorMessage: true,
        isAnonymous: true,
        createdAt: true,
        teamMember: {
          select: {
            id: true,
            name: true,
            profilePhotoUrl: true,
            position: true,
            grade: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await prisma.donation.count({
      where: {
        campaignId,
        status: "COMPLETED",
      }
    });

    // Calculate time ago for each donation
    const now = new Date();
    const formatTimeAgo = (date: Date): string => {
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (seconds < 60) return "just now";
      if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
      }
      if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      }
      if (seconds < 2592000) {
        const days = Math.floor(seconds / 86400);
        return `${days} day${days === 1 ? '' : 's'} ago`;
      }
      if (seconds < 31536000) {
        const months = Math.floor(seconds / 2592000);
        return `${months} month${months === 1 ? '' : 's'} ago`;
      }
      const years = Math.floor(seconds / 31536000);
      return `${years} year${years === 1 ? '' : 's'} ago`;
    };

    // Format donations for response
    const formattedDonations = donations.map(donation => ({
      id: donation.id,
      amount: Number(donation.grossAmount) / 100,
      donorName: donation.isAnonymous ? "Anonymous" : (donation.donorName || "Unknown"),
      donorInitials: donation.isAnonymous ? "?" :
        (donation.donorName || "U")
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
      message: donation.donorMessage,
      timeAgo: formatTimeAgo(donation.createdAt),
      timestamp: donation.createdAt.toISOString(),
      teamMember: donation.teamMember ? {
        id: donation.teamMember.id,
        name: donation.teamMember.name,
        profilePhotoUrl: donation.teamMember.profilePhotoUrl,
        position: donation.teamMember.position,
        grade: donation.teamMember.grade,
      } : null,
      isCampaignDonation: !donation.teamMember,
    }));

    // Calculate summary stats for the feed
    const feedStats = await prisma.donation.aggregate({
      where: {
        campaignId,
        status: "COMPLETED",
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      _sum: {
        grossAmount: true,
      },
      _count: true,
    });

    const response = {
      success: true,
      campaign: {
        id: campaign.id,
        name: `${campaign.teamName} - ${campaign.organizationName}`,
      },
      donations: formattedDonations,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      feedStats: {
        last24Hours: {
          count: feedStats._count,
          totalAmount: Number(feedStats._sum.grossAmount || 0) / 100,
        }
      }
    };

    // Cache for 30 seconds since this is a live feed
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=10',
      }
    });

  } catch (error) {
    console.error("Failed to fetch recent donations:", error);
    // Never surface raw error/Prisma messages to the caller.
    return NextResponse.json(
      { success: false, error: "Failed to fetch recent donations" },
      { status: 500 }
    );
  }
}