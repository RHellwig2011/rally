/**
 * Campaign analytics API.
 *
 * ---------------------------------------------------------------------------
 * UNITS CONVENTION (authoritative for this endpoint and its consumers)
 * ---------------------------------------------------------------------------
 * The database stores every money column as an integer number of CENTS
 * (Prisma BigInt: Campaign.goalAmount/currentAmount, Donation.grossAmount, ...).
 *
 * This endpoint returns every money value as a plain JS number of DOLLARS.
 * That applies to:
 *   analytics.campaign.goalAmount / currentAmount
 *   analytics.donations[].grossAmount
 *   analytics.dailyData[].amount
 *   analytics.teamMemberStats[].amount
 *   analytics.donationSizeBreakdown[].value
 *
 * All aggregation is done in integer cents and divided by 100 exactly once, at
 * the response boundary, so no floating point drift accumulates. Consumers that
 * use lib/utils formatCurrency() (which expects CENTS) must convert back with
 * Math.round(dollars * 100).
 *
 * PRIVACY: donor email addresses are never included in the response. Donor
 * identity is exposed as a name only, and only for non-anonymous donations.
 * ---------------------------------------------------------------------------
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";

/** Convert an integer cent amount to a dollars number for the JSON response. */
function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
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

    const { campaignId } = params;

    // Fetch campaign (guardians included for the ownership check only)
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        guardians: { select: { id: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Authorization: campaign leader, guardian, or admin only.
    // Without this, any authenticated user could read another team's analytics.
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

    // Fetch completed donations for this campaign (all analytics must match
    // Total Raised, which only counts COMPLETED donations)
    const donations = await prisma.donation.findMany({
      where: { campaignId, status: "COMPLETED" },
      select: {
        id: true,
        grossAmount: true,
        donorEmail: true,
        donorName: true,
        isAnonymous: true,
        createdAt: true,
        teamMemberId: true,
        teamMember: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Calculate daily data (accumulated in CENTS, converted at the boundary)
    const dailyMap = new Map<string, { amountCents: number; count: number }>();

    donations.forEach((donation) => {
      const date = new Date(donation.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const amountCents = Number(donation.grossAmount);

      const existing = dailyMap.get(date);
      if (existing) {
        dailyMap.set(date, {
          amountCents: existing.amountCents + amountCents,
          count: existing.count + 1,
        });
      } else {
        dailyMap.set(date, { amountCents, count: 1 });
      }
    });

    const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      amount: centsToDollars(data.amountCents), // dollars
      count: data.count,
    }));

    // Calculate team member stats (accumulated in CENTS)
    const teamMemberMap = new Map<
      string,
      { name: string; amountCents: number; count: number }
    >();

    donations.forEach((donation) => {
      if (donation.teamMember && donation.teamMemberId) {
        const memberId = donation.teamMemberId;
        const name = donation.teamMember.name;
        const amountCents = Number(donation.grossAmount);

        const existing = teamMemberMap.get(memberId);
        if (existing) {
          teamMemberMap.set(memberId, {
            name,
            amountCents: existing.amountCents + amountCents,
            count: existing.count + 1,
          });
        } else {
          teamMemberMap.set(memberId, { name, amountCents, count: 1 });
        }
      }
    });

    const teamMemberStats = Array.from(teamMemberMap.values())
      .sort((a, b) => b.amountCents - a.amountCents)
      .map((m) => ({
        name: m.name,
        amount: centsToDollars(m.amountCents), // dollars
        count: m.count,
      }));

    // Donation size breakdown. Bucket bounds are expressed in CENTS so they are
    // compared against the raw cent amounts in like units (a $25 donation is
    // 2500 cents and must land in the "$25-$50" bucket, not "$500+").
    const ranges = [
      { minCents: 0, maxCents: 2_500, label: "$0-$25" },
      { minCents: 2_500, maxCents: 5_000, label: "$25-$50" },
      { minCents: 5_000, maxCents: 10_000, label: "$50-$100" },
      { minCents: 10_000, maxCents: 25_000, label: "$100-$250" },
      { minCents: 25_000, maxCents: 50_000, label: "$250-$500" },
      { minCents: 50_000, maxCents: Infinity, label: "$500+" },
    ];

    const donationSizeBreakdown = ranges
      .map((range) => {
        const donationsInRange = donations.filter((d) => {
          const amountCents = Number(d.grossAmount);
          return amountCents >= range.minCents && amountCents < range.maxCents;
        });

        return {
          range: range.label,
          count: donationsInRange.length,
          value: centsToDollars(
            donationsInRange.reduce((sum, d) => sum + Number(d.grossAmount), 0)
          ), // dollars
        };
      })
      .filter((item) => item.count > 0);

    // Unique donor count is computed server-side so donor emails never leave
    // the server.
    const uniqueDonorCount = new Set(donations.map((d) => d.donorEmail)).size;

    const serializedCampaign = {
      id: campaign.id,
      slug: campaign.slug,
      organizationName: campaign.organizationName,
      teamName: campaign.teamName,
      description: campaign.description,
      status: campaign.status,
      category: campaign.category,
      goalAmount: centsToDollars(Number(campaign.goalAmount)), // dollars
      currentAmount: centsToDollars(Number(campaign.currentAmount)), // dollars
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate ? campaign.endDate.toISOString() : null,
      createdAt: campaign.createdAt.toISOString(),
    };

    // Name-only donor identity; anonymous donations expose nothing.
    const serializedDonations = donations.map((d) => ({
      id: d.id,
      grossAmount: centsToDollars(Number(d.grossAmount)), // dollars
      donorName: d.isAnonymous ? null : d.donorName,
      createdAt: d.createdAt.toISOString(),
      teamMemberId: d.teamMemberId,
    }));

    return NextResponse.json(
      {
        success: true,
        analytics: {
          campaign: serializedCampaign,
          donations: serializedDonations,
          uniqueDonorCount,
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
