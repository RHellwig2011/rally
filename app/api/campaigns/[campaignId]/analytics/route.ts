import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;

    // Fetch campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Fetch all donations for this campaign
    const donations = await prisma.donation.findMany({
      where: { campaignId },
      include: {
        teamMember: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Calculate daily data
    const dailyMap = new Map<string, { amount: number; count: number }>();

    donations.forEach((donation) => {
      const date = new Date(donation.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const amount = parseInt(donation.grossAmount.toString());

      if (dailyMap.has(date)) {
        const existing = dailyMap.get(date)!;
        dailyMap.set(date, {
          amount: existing.amount + amount,
          count: existing.count + 1,
        });
      } else {
        dailyMap.set(date, { amount, count: 1 });
      }
    });

    const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      amount: data.amount,
      count: data.count,
    }));

    // Calculate team member stats
    const teamMemberMap = new Map<string, { name: string; amount: number; count: number }>();

    donations.forEach((donation) => {
      if (donation.teamMember) {
        const memberId = donation.teamMemberId!;
        const name = donation.teamMember.name;
        const amount = parseInt(donation.grossAmount.toString());

        if (teamMemberMap.has(memberId)) {
          const existing = teamMemberMap.get(memberId)!;
          teamMemberMap.set(memberId, {
            name,
            amount: existing.amount + amount,
            count: existing.count + 1,
          });
        } else {
          teamMemberMap.set(memberId, { name, amount, count: 1 });
        }
      }
    });

    const teamMemberStats = Array.from(teamMemberMap.values())
      .sort((a, b) => b.amount - a.amount);

    // Calculate donation size breakdown
    const ranges = [
      { min: 0, max: 25, label: "$0-$25" },
      { min: 25, max: 50, label: "$25-$50" },
      { min: 50, max: 100, label: "$50-$100" },
      { min: 100, max: 250, label: "$100-$250" },
      { min: 250, max: 500, label: "$250-$500" },
      { min: 500, max: Infinity, label: "$500+" },
    ];

    const donationSizeBreakdown = ranges.map((range) => {
      const donationsInRange = donations.filter((d) => {
        const amount = parseInt(d.grossAmount.toString());
        return amount >= range.min && amount < range.max;
      });

      return {
        range: range.label,
        count: donationsInRange.length,
        value: donationsInRange.reduce(
          (sum, d) => sum + parseInt(d.grossAmount.toString()),
          0
        ),
      };
    }).filter(item => item.count > 0);

    // Serialize data
    const serializedCampaign = {
      ...campaign,
      goalAmount: campaign.goalAmount.toString(),
      currentAmount: campaign.currentAmount.toString(),
    };

    const serializedDonations = donations.map((d) => ({
      id: d.id,
      grossAmount: d.grossAmount.toString(),
      donorEmail: d.donorEmail,
      createdAt: d.createdAt.toISOString(),
      teamMemberId: d.teamMemberId,
    }));

    return NextResponse.json(
      {
        success: true,
        analytics: {
          campaign: serializedCampaign,
          donations: serializedDonations,
          dailyData,
          teamMemberStats,
          donationSizeBreakdown,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
