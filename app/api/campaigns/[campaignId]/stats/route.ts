import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/campaigns/[campaignId]/stats
 * Get time-series fundraising data and statistics for a campaign
 * Returns:
 * - Donations by day for last 30 days
 * - Top 10 players by amount raised
 * - Donor metrics (new, repeat, total)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const campaignId = params.campaignId;

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Calculate date range for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = campaign.startDate > thirtyDaysAgo ? campaign.startDate : thirtyDaysAgo;

    // Get donations by day for the last 30 days
    const donationsByDay = await prisma.$queryRaw<Array<{
      date: Date;
      total_amount: bigint;
      donation_count: bigint;
    }>>`
      SELECT
        DATE(created_at) as date,
        SUM(gross_amount) as total_amount,
        COUNT(*) as donation_count
      FROM "Donation"
      WHERE campaign_id = ${campaignId}
        AND status = 'COMPLETED'
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Get top 10 team members by amount raised
    const topPlayers = await prisma.teamMember.findMany({
      where: {
        campaignId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        profilePhotoUrl: true,
        amountRaised: true,
        personalGoal: true,
        position: true,
        grade: true,
        _count: {
          select: {
            donations: {
              where: { status: "COMPLETED" }
            }
          }
        }
      },
      orderBy: {
        amountRaised: "desc",
      },
      take: 10,
    });

    // Get unique donor metrics
    const donorMetrics = await prisma.$transaction(async (tx) => {
      // Total unique donors
      const totalDonors = await tx.donation.groupBy({
        by: ['donorEmail'],
        where: {
          campaignId,
          status: 'COMPLETED',
        },
        _count: true,
      });

      // New donors (first-time donors in last 30 days)
      const newDonors = await tx.$queryRaw<Array<{ donor_count: bigint }>>`
        SELECT COUNT(DISTINCT donor_email) as donor_count
        FROM (
          SELECT donor_email, MIN(created_at) as first_donation
          FROM "Donation"
          WHERE campaign_id = ${campaignId}
            AND status = 'COMPLETED'
          GROUP BY donor_email
          HAVING MIN(created_at) >= ${thirtyDaysAgo}
        ) as new_donors
      `;

      // Repeat donors (donated more than once)
      const repeatDonors = await tx.$queryRaw<Array<{ donor_count: bigint }>>`
        SELECT COUNT(*) as donor_count
        FROM (
          SELECT donor_email, COUNT(*) as donation_count
          FROM "Donation"
          WHERE campaign_id = ${campaignId}
            AND status = 'COMPLETED'
          GROUP BY donor_email
          HAVING COUNT(*) > 1
        ) as repeat_donors
      `;

      // Anonymous donors count
      const anonymousDonors = await tx.donation.count({
        where: {
          campaignId,
          status: 'COMPLETED',
          isAnonymous: true,
        }
      });

      return {
        totalUniqueDonors: totalDonors.length,
        newDonorsLast30Days: Number(newDonors[0]?.donor_count || 0),
        repeatDonors: Number(repeatDonors[0]?.donor_count || 0),
        anonymousDonations: anonymousDonors,
      };
    });

    // Calculate donation trends
    const currentPeriodTotal = donationsByDay
      .slice(0, 7)
      .reduce((sum, day) => sum + Number(day.total_amount), 0);

    const previousPeriodTotal = donationsByDay
      .slice(7, 14)
      .reduce((sum, day) => sum + Number(day.total_amount), 0);

    const trendPercentage = previousPeriodTotal > 0
      ? ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100
      : 0;

    // Format response
    const response = {
      success: true,
      stats: {
        // Time series data
        donationsByDay: donationsByDay.map(day => ({
          date: day.date,
          amount: Number(day.total_amount) / 100,
          donationCount: Number(day.donation_count),
        })),

        // Top performers
        topPlayers: topPlayers.map(player => ({
          id: player.id,
          name: player.name,
          profilePhotoUrl: player.profilePhotoUrl,
          amountRaised: Number(player.amountRaised) / 100,
          personalGoal: player.personalGoal ? Number(player.personalGoal) / 100 : null,
          percentageOfGoal: player.personalGoal
            ? (Number(player.amountRaised) / Number(player.personalGoal)) * 100
            : 0,
          donationCount: player._count.donations,
          position: player.position,
          grade: player.grade,
        })),

        // Donor metrics
        donorMetrics,

        // Trends
        trends: {
          weekOverWeek: {
            percentage: trendPercentage.toFixed(2),
            direction: trendPercentage > 0 ? "up" : trendPercentage < 0 ? "down" : "neutral",
            currentWeekTotal: currentPeriodTotal / 100,
            previousWeekTotal: previousPeriodTotal / 100,
          }
        },

        // Period
        period: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
          daysIncluded: Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        }
      }
    };

    // Cache control headers for 5 minutes
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      }
    });

  } catch (error) {
    console.error("Failed to fetch campaign stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch campaign statistics"
      },
      { status: 500 }
    );
  }
}