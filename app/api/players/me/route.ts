import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/players/me
 * Get current user's player/team member stats across all campaigns
 */
export async function GET(req: NextRequest) {
  try {
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

    // Get all team memberships for this user. Team members are soft-deleted
    // only, so without deletedAt: null a player removed from a roster keeps
    // seeing that campaign — and its totals keep feeding their stats.
    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId: user.id, deletedAt: null },
      include: {
        campaign: {
          select: {
            id: true,
            organizationName: true,
            teamName: true,
            slug: true,
            goalAmount: true,
            currentAmount: true,
            status: true,
            endDate: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get referral data for each membership
    const referrals = await prisma.referral.findMany({
      where: {
        referrerId: user.id,
        campaignId: { in: teamMemberships.map(tm => tm.campaignId) }
      }
    });

    const referralMap = new Map(referrals.map(r => [r.campaignId, r]));

    // Calculate total stats
    const totalRaised = teamMemberships.reduce(
      (sum, tm) => sum + Number(tm.amountRaised),
      0
    );

    const totalDonations = referrals.reduce(
      (sum, r) => sum + r.donationCount,
      0
    );

    const totalClicks = referrals.reduce(
      (sum, r) => sum + r.clickCount,
      0
    );

    // Prepare response
    const playerData = {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      stats: {
        totalRaised,
        totalDonations,
        totalClicks,
        campaignCount: teamMemberships.length,
      },
      memberships: teamMemberships.map(tm => {
        const referral = referralMap.get(tm.campaignId);
        return {
          id: tm.id,
          name: tm.name,
          personalGoal: tm.personalGoal?.toString(),
          amountRaised: tm.amountRaised.toString(),
          createdAt: tm.createdAt,
          campaign: {
            id: tm.campaign.id,
            organizationName: tm.campaign.organizationName,
            teamName: tm.campaign.teamName,
            slug: tm.campaign.slug,
            goalAmount: tm.campaign.goalAmount.toString(),
            currentAmount: tm.campaign.currentAmount.toString(),
            status: tm.campaign.status,
            endDate: tm.campaign.endDate,
          },
          referral: referral ? {
            code: referral.referralCode,
            clickCount: referral.clickCount,
            donationCount: referral.donationCount,
            totalRaised: referral.totalRaised.toString(),
          } : null,
        };
      })
    };

    return NextResponse.json(
      { success: true, data: playerData },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch player data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch player data" },
      { status: 500 }
    );
  }
}
