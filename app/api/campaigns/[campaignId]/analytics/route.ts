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
    // Total Raised, which only counts COMPLETED donations).
    //
    // This list is still returned in full because the dashboard derives its
    // "Total Donations" and "this week" tiles from it client-side, but it is no
    // longer what the rollups below are computed from — those are aggregated in
    // the database. Consequently donorEmail is no longer selected at all: the
    // unique-donor count is a COUNT(DISTINCT) and donor addresses never leave
    // Postgres.
    const donations = await prisma.donation.findMany({
      where: { campaignId, status: "COMPLETED" },
      select: {
        id: true,
        grossAmount: true,
        donorName: true,
        isAnonymous: true,
        createdAt: true,
        teamMemberId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Bucket bounds are expressed in CENTS so they are compared against the raw
    // cent amounts in like units (a $25 donation is 2500 cents and must land in
    // the "$25-$50" bucket, not "$500+"). The SQL CASE below must stay in step
    // with these labels and bounds.
    const ranges = [
      { minCents: 0, maxCents: 2_500, label: "$0-$25" },
      { minCents: 2_500, maxCents: 5_000, label: "$25-$50" },
      { minCents: 5_000, maxCents: 10_000, label: "$50-$100" },
      { minCents: 10_000, maxCents: 25_000, label: "$100-$250" },
      { minCents: 25_000, maxCents: 50_000, label: "$250-$500" },
      { minCents: 50_000, maxCents: Infinity, label: "$500+" },
    ];

    // All three rollups are aggregations, so they run in the database rather
    // than over the JS array. Raw SQL for the day buckets and the distinct
    // donor count mirrors campaigns/[campaignId]/stats — Prisma can express
    // neither day-bucket grouping nor COUNT(DISTINCT). No @map in the schema,
    // so camelCase identifiers are quoted.
    const [dailyRows, teamMemberGroups, sizeRows, uniqueDonorRows] = await Promise.all([
      prisma.$queryRaw<Array<{
        date: Date;
        total_amount: bigint;
        donation_count: bigint;
      }>>`
        SELECT
          ("createdAt" AT TIME ZONE 'UTC')::date as date,
          SUM("grossAmount") as total_amount,
          COUNT(*) as donation_count
        FROM "Donation"
        WHERE "campaignId" = ${campaignId}
          AND status = 'COMPLETED'
        GROUP BY ("createdAt" AT TIME ZONE 'UTC')::date
        ORDER BY date ASC
      `,

      prisma.donation.groupBy({
        by: ["teamMemberId"],
        where: { campaignId, status: "COMPLETED", teamMemberId: { not: null } },
        _sum: { grossAmount: true },
        _count: true,
      }),

      prisma.$queryRaw<Array<{
        bucket: string;
        total_amount: bigint;
        donation_count: bigint;
      }>>`
        SELECT
          CASE
            WHEN "grossAmount" < 2500 THEN '$0-$25'
            WHEN "grossAmount" < 5000 THEN '$25-$50'
            WHEN "grossAmount" < 10000 THEN '$50-$100'
            WHEN "grossAmount" < 25000 THEN '$100-$250'
            WHEN "grossAmount" < 50000 THEN '$250-$500'
            ELSE '$500+'
          END as bucket,
          SUM("grossAmount") as total_amount,
          COUNT(*) as donation_count
        FROM "Donation"
        WHERE "campaignId" = ${campaignId}
          AND status = 'COMPLETED'
        GROUP BY bucket
      `,

      prisma.$queryRaw<Array<{ donor_count: bigint }>>`
        SELECT COUNT(DISTINCT "donorEmail") as donor_count
        FROM "Donation"
        WHERE "campaignId" = ${campaignId}
          AND status = 'COMPLETED'
      `,
    ]);

    // The bucket is cut in UTC ("createdAt" AT TIME ZONE 'UTC')::date, so the
    // label is formatted in UTC too. Both halves matter: DATE(timestamptz)
    // alone converts using the database session's TimeZone, so a donation at
    // 01:00 UTC could be grouped under the previous day and then labelled as
    // the next one. Formatting in the server's local zone shifts it the same
    // way from the other side.
    const dailyData = dailyRows.map((row) => ({
      date: new Date(row.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      amount: centsToDollars(Number(row.total_amount)), // dollars
      count: Number(row.donation_count),
    }));

    // groupBy returns ids; names come from one lookup rather than a join per row.
    const teamMemberIds = teamMemberGroups
      .map((g) => g.teamMemberId)
      .filter((id): id is string => !!id);

    const teamMemberNames = new Map(
      (teamMemberIds.length > 0
        ? await prisma.teamMember.findMany({
            where: { id: { in: teamMemberIds } },
            select: { id: true, name: true },
          })
        : []
      ).map((tm) => [tm.id, tm.name])
    );

    const teamMemberStats = teamMemberGroups
      .map((group) => ({
        id: group.teamMemberId!,
        amountCents: Number(group._sum.grossAmount || 0),
        count: group._count,
      }))
      // A donation can outlive a hard-deleted member row; drop those rather
      // than render an empty leaderboard name.
      .filter((m) => teamMemberNames.has(m.id))
      .sort((a, b) => b.amountCents - a.amountCents)
      .map((m) => ({
        name: teamMemberNames.get(m.id)!,
        amount: centsToDollars(m.amountCents), // dollars
        count: m.count,
      }));

    const sizeByBucket = new Map(sizeRows.map((r) => [r.bucket, r]));

    // Emitted in `ranges` order so the pie chart's slice order is stable.
    const donationSizeBreakdown = ranges
      .map((range) => {
        const row = sizeByBucket.get(range.label);
        return {
          range: range.label,
          count: Number(row?.donation_count || 0),
          value: centsToDollars(Number(row?.total_amount || 0)), // dollars
        };
      })
      .filter((item) => item.count > 0);

    // Unique donor count is computed server-side so donor emails never leave
    // the server.
    const uniqueDonorCount = Number(uniqueDonorRows[0]?.donor_count || 0);

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
