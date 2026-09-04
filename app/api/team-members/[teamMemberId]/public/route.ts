import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isPubliclyListableCampaign } from "@/lib/public-campaign";
import { getUserFromToken } from "@/lib/auth";

/**
 * GET /api/team-members/[teamMemberId]/public
 * Get public player profile data (no auth required)
 *
 * Trust gates (private profile, non-listable campaign status) apply to the
 * anonymous public. Campaign staff — the primary leader, guardians, ADMIN —
 * and the player's own linked account see the page anyway with
 * `preview: true`, because a coach clicking a player on their own roster
 * (private-by-default, campaign still DRAFT) must not hit a dead page.
 * Preview responses never increment click stats.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
    const { teamMemberId } = params;

    // Get team member with campaign and donations.
    // Shared fundraising links use fundLinkCode in the URL, while internal
    // links use the cuid id — resolve either. Everything downstream is keyed
    // on the resolved teamMember.id, so donation attribution is unaffected.
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        OR: [{ id: teamMemberId }, { fundLinkCode: teamMemberId }],
        deletedAt: null,
      },
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
            platformFeePercent: true,
            primaryLeaderId: true,
            guardians: { select: { id: true } },
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

    // Staff/self check for private-profile and draft-campaign preview.
    let isPreviewViewer = false;
    const sessionToken = req.cookies.get("sessionToken")?.value;
    if (sessionToken) {
      const viewer = await getUserFromToken(sessionToken);
      if (viewer) {
        isPreviewViewer =
          viewer.role === "ADMIN" ||
          teamMember.campaign.primaryLeaderId === viewer.id ||
          teamMember.campaign.guardians.some((g) => g.id === viewer.id) ||
          (teamMember.userId !== null && teamMember.userId === viewer.id);
      }
    }

    const publiclyVisible =
      isPubliclyListableCampaign(teamMember.campaign.status) &&
      teamMember.isProfilePublic;

    if (!publiclyVisible && !isPreviewViewer) {
      // Same responses the public always got: 404 for a non-listable
      // campaign, 403 for a private profile on a live one.
      if (!isPubliclyListableCampaign(teamMember.campaign.status)) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
      }
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

    // Get recent donations attributed to this player.
    // Attribution is strictly: donation.teamMemberId matches, or (legacy records)
    // donation.referralCode stored the team member id. Never fall back to
    // campaign-wide matches.
    const recentDonations = await prisma.donation.findMany({
      where: {
        campaignId: teamMember.campaignId,
        OR: [
          { teamMemberId: teamMember.id },
          { referralCode: teamMember.id },
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

    // Count ALL donations attributed to this player (not just the 20 shown),
    // so stats work for players without a linked user/referral row too.
    const donationCount = await prisma.donation.count({
      where: {
        campaignId: teamMember.campaignId,
        OR: [
          { teamMemberId: teamMember.id },
          { referralCode: teamMember.id },
        ],
        status: "COMPLETED",
      },
    });

    // Track page view (increment click count) — real public views only, so a
    // coach re-checking their roster doesn't inflate the player's stats.
    if (referral && !isPreviewViewer) {
      await prisma.referral.update({
        where: { id: referral.id },
        data: { clickCount: { increment: 1 } },
      });
    }

    // Format response
    const {
      primaryLeaderId: _leader,
      guardians: _guardians,
      ...publicCampaign
    } = teamMember.campaign;
    const response = {
      // True when the viewer sees this only because they are campaign staff
      // or the player — the page shows a "preview" banner instead of
      // pretending the profile is live.
      preview: !publiclyVisible,
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
        ...publicCampaign,
        goalAmount: teamMember.campaign.goalAmount.toString(),
        currentAmount: teamMember.campaign.currentAmount.toString(),
      },
      referralCode: referral?.referralCode || '',
      recentDonations: recentDonations.map((d) => ({
        ...d,
        // Never expose real donor names for anonymous donations
        donorName: d.isAnonymous ? null : d.donorName,
        grossAmount: d.grossAmount.toString(),
      })),
      stats: {
        donationCount,
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
