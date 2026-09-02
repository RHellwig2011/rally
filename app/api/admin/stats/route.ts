import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/stats
 * Get platform-wide statistics for admin dashboard
 */
export async function GET(req: NextRequest) {
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

    // Check authorization - only BANK_ADMIN or ADMIN
    if (user.role !== 'BANK_ADMIN' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Parse and clamp query parameters for date range. `days` drives both the
    // trend window and the previous-period comparison, so an unclamped value
    // (?days=abc -> NaN -> Invalid Date, or ?days=100000) either breaks the
    // queries outright or makes them scan the whole donation table.
    const searchParams = req.nextUrl.searchParams;
    const parsedDays = parseInt(searchParams.get('days') || '30', 10);
    const days = Number.isNaN(parsedDays) ? 30 : Math.min(Math.max(parsedDays, 1), 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Run all queries in parallel for better performance
    const [
      campaignStats,
      donationStats,
      disbursementStats,
      userStats,
      recentCampaigns,
      topCampaigns,
      platformMetrics,
    ] = await Promise.all([
      // Campaign statistics
      prisma.campaign.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Donation statistics
      prisma.donation.aggregate({
        where: {
          status: 'COMPLETED',
        },
        _sum: {
          grossAmount: true,
          platformFee: true,
          netAmount: true,
        },
        _count: true,
        _avg: {
          grossAmount: true,
        }
      }),

      // Disbursement statistics
      prisma.disbursementRequest.groupBy({
        by: ['status'],
        _count: true,
        _sum: {
          requestedAmount: true,
        }
      }),

      // User statistics
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),

      // Recent campaigns (last 5)
      prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          organizationName: true,
          teamName: true,
          status: true,
          goalAmount: true,
          currentAmount: true,
          createdAt: true,
        }
      }),

      // Top campaigns by amount raised
      prisma.campaign.findMany({
        where: {
          status: 'ACTIVE',
        },
        orderBy: { currentAmount: 'desc' },
        take: 10,
        select: {
          id: true,
          organizationName: true,
          teamName: true,
          slug: true,
          goalAmount: true,
          currentAmount: true,
          _count: {
            select: {
              donations: {
                where: { status: 'COMPLETED' }
              }
            }
          }
        }
      }),

      // Platform financial metrics
      prisma.bankingAccount.aggregate({
        _sum: {
          totalRaised: true,
          platformFeesCollected: true,
          availableBalance: true,
          disbursedTotal: true,
          pendingDisbursement: true,
        }
      }),
    ]);

    // Get donation trends (by day for last 30 days)
    const donationTrends = await prisma.$queryRaw<Array<{
      date: Date;
      total_amount: bigint;
      donation_count: bigint;
    }>>`
      SELECT
        ("createdAt" AT TIME ZONE 'UTC')::date as date,
        SUM("grossAmount") as total_amount,
        COUNT(*) as donation_count
      FROM "Donation"
      WHERE status = 'COMPLETED'
        AND "createdAt" >= ${startDate}
      GROUP BY ("createdAt" AT TIME ZONE 'UTC')::date
      ORDER BY date ASC
    `;

    // Get unique donors count. Counted in the database: the findMany({distinct})
    // this replaces pulled every distinct donor email on the platform into
    // memory purely to read .length. Raw SQL because Prisma cannot express
    // COUNT(DISTINCT ...); camelCase identifiers must be quoted (no @map).
    const uniqueDonorRows = await prisma.$queryRaw<Array<{ donor_count: bigint }>>`
      SELECT COUNT(DISTINCT "donorEmail") as donor_count
      FROM "Donation"
      WHERE status = 'COMPLETED'
    `;
    const uniqueDonors = Number(uniqueDonorRows[0]?.donor_count || 0);

    // Calculate growth metrics (compare to previous period)
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - days);

    const [currentPeriodDonations, previousPeriodDonations] = await Promise.all([
      prisma.donation.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startDate }
        },
        _sum: { grossAmount: true },
        _count: true,
      }),
      prisma.donation.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: previousPeriodStart,
            lt: startDate,
          }
        },
        _sum: { grossAmount: true },
        _count: true,
      }),
    ]);

    // Calculate growth percentages
    const donationGrowth = previousPeriodDonations._sum.grossAmount
      ? ((Number(currentPeriodDonations._sum.grossAmount || 0) - Number(previousPeriodDonations._sum.grossAmount)) /
         Number(previousPeriodDonations._sum.grossAmount)) * 100
      : 0;

    const countGrowth = previousPeriodDonations._count
      ? ((currentPeriodDonations._count - previousPeriodDonations._count) / previousPeriodDonations._count) * 100
      : 0;

    // Format campaign stats by status
    const campaignsByStatus = campaignStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    // Format disbursement stats by status
    const disbursementsByStatus = disbursementStats.reduce((acc, stat) => {
      acc[stat.status] = {
        count: stat._count,
        amount: Number(stat._sum.requestedAmount || 0) / 100,
      };
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    // Format user stats by role
    const usersByRole = userStats.reduce((acc, stat) => {
      acc[stat.role] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    // Build response
    const response = {
      success: true,
      stats: {
        // Overall metrics
        totalCampaigns: campaignStats.reduce((sum, s) => sum + s._count, 0),
        activeCampaigns: campaignsByStatus.ACTIVE || 0,
        draftCampaigns: campaignsByStatus.DRAFT || 0,
        completedCampaigns: campaignsByStatus.COMPLETED || 0,

        totalDonations: donationStats._count,
        totalRaised: Number(donationStats._sum.grossAmount || 0) / 100,
        averageDonation: Number(donationStats._avg.grossAmount || 0) / 100,

        platformFees: Number(donationStats._sum.platformFee || 0) / 100,
        totalDisbursed: Number(platformMetrics._sum.disbursedTotal || 0) / 100,
        pendingDisbursements: disbursementsByStatus.PENDING?.count || 0,
        pendingDisbursementAmount: disbursementsByStatus.PENDING?.amount || 0,

        uniqueDonors,
        activeUsers: usersByRole.CAMPAIGN_LEADER || 0,
        totalUsers: userStats.reduce((sum, s) => sum + s._count, 0),

        // Financial overview
        financials: {
          totalRaised: Number(platformMetrics._sum.totalRaised || 0) / 100,
          platformFeesCollected: Number(platformMetrics._sum.platformFeesCollected || 0) / 100,
          availableBalance: Number(platformMetrics._sum.availableBalance || 0) / 100,
          disbursedTotal: Number(platformMetrics._sum.disbursedTotal || 0) / 100,
          pendingDisbursement: Number(platformMetrics._sum.pendingDisbursement || 0) / 100,
        },

        // Growth metrics
        growth: {
          donations: {
            current: Number(currentPeriodDonations._sum.grossAmount || 0) / 100,
            previous: Number(previousPeriodDonations._sum.grossAmount || 0) / 100,
            percentage: Math.round(donationGrowth * 100) / 100,
            trend: donationGrowth > 0 ? 'up' : donationGrowth < 0 ? 'down' : 'neutral',
          },
          donationCount: {
            current: currentPeriodDonations._count,
            previous: previousPeriodDonations._count,
            percentage: Math.round(countGrowth * 100) / 100,
            trend: countGrowth > 0 ? 'up' : countGrowth < 0 ? 'down' : 'neutral',
          }
        },

        // Breakdown by status
        campaignsByStatus,
        disbursementsByStatus,
        usersByRole,

        // Recent data
        recentCampaigns: recentCampaigns.map(c => ({
          id: c.id,
          name: `${c.teamName} - ${c.organizationName}`,
          status: c.status,
          progress: {
            goal: Number(c.goalAmount) / 100,
            raised: Number(c.currentAmount) / 100,
            percentage: Math.round((Number(c.currentAmount) / Number(c.goalAmount)) * 100),
          },
          createdAt: c.createdAt,
        })),

        // Top campaigns
        topCampaigns: topCampaigns.map(c => ({
          id: c.id,
          name: `${c.teamName} - ${c.organizationName}`,
          slug: c.slug,
          raised: Number(c.currentAmount) / 100,
          goal: Number(c.goalAmount) / 100,
          percentage: Math.round((Number(c.currentAmount) / Number(c.goalAmount)) * 100),
          donationCount: c._count.donations,
        })),

        // Donation trends
        donationTrends: donationTrends.map(t => ({
          date: t.date,
          amount: Number(t.total_amount) / 100,
          count: Number(t.donation_count),
        })),

        // Period info
        period: {
          days,
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        }
      }
    };

    // Cache for 5 minutes
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      }
    });

  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch admin statistics"
      },
      { status: 500 }
    );
  }
}