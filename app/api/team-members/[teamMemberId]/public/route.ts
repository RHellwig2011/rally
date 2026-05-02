import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/team-members/[teamMemberId]/public
 * Get public player profile data (no auth required)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
    const { teamMemberId } = params;

    // Get team member with campaign and donations
    const teamMember = await prisma.teamMember.findUnique({
      where: { id: teamMemberId },
      include: {
        campaign: {
          select: {
            id: true,
            organizationName: true,
            teamName: true,
            slug: true,
            description: true,
            goalAmount: true,
            currentAmount: true,
            logoUrl: true,
            bannerImageUrl: true,
            primaryColor: true,
            status: true,
            endDate: true,
          },
        },
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // Check if profile is public
    if (!teamMember.isProfilePublic) {
      return NextResponse.json(
        { error: "This player's profile is private" },
        { status: 403 }
      );
    }

    // Get referral code (only if userId exists)
    const referral = teamMember.userId ? await prisma.referral.findFirst({
      where: {
        campaignId: teamMember.campaignId,
        referrerId: teamMember.userId,
      },
    }) : null;

    // Get recent donations attributed to this player
    const recentDonations = await prisma.donation.findMany({
      where: {
        campaignId: teamMember.campaignId,
        OR: [
          { referralCode: referral?.referralCode },
          { referredByUserId: teamMember.userId },
        ],
        status: "COMPLETED",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        donorName: true,
        grossAmount: true,
        isAnonymous: true,
        donorMessage: true,
        createdAt: true,
      },
    });

    // Track page view (increment click count)
    if (referral) {
      await prisma.referral.update({
        where: { id: referral.id },
        data: { clickCount: { increment: 1 } },
      });
    }

    // Format response
    const response = {
      teamMember: {
        id: teamMember.id,
        name: teamMember.name,
        personalGoal: teamMember.personalGoal?.toString() || null,
        amountRaised: teamMember.amountRaised.toString(),
        profilePhotoUrl: teamMember.profilePhotoUrl,
        profileVideoUrl: teamMember.profileVideoUrl,
        personalStory: teamMember.personalStory,
        position: teamMember.position,
        grade: teamMember.grade,
        favoriteQuote: teamMember.favoriteQuote,
      },
      campaign: {
        ...teamMember.campaign,
        goalAmount: teamMember.campaign.goalAmount.toString(),
        currentAmount: teamMember.campaign.currentAmount.toString(),
      },
      referralCode: referral?.referralCode || '',
      recentDonations: recentDonations.map((d) => ({
        ...d,
        grossAmount: d.grossAmount.toString(),
      })),
      stats: {
        donationCount: referral?.donationCount || 0,
        clickCount: referral?.clickCount || 0,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch player data:", error);
    return NextResponse.json(
      { error: "Failed to fetch player data" },
      { status: 500 }
    );
  }
}
