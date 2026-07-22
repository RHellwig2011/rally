import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import {
  sendTeamMemberInvitation,
  formatFundraisingLink,
} from "@/lib/utils/team-member";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  applyRateLimitHeaders
} from "@/lib/utils/rate-limit";
import { checkCsrf } from "@/lib/csrf";

/**
 * POST /api/campaigns/[campaignId]/team-members/[memberId]/resend-invite
 * Resend invitation email to a team member
 * Requirements: Max once per hour to prevent spam
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string; memberId: string } }
) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

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

    const { campaignId, memberId } = params;

    // Verify campaign and authorization
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
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
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some(g => g.id === user.id);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to manage this campaign" },
        { status: 403 }
      );
    }

    // Get team member
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        campaignId,
        deletedAt: null,
        email: { not: null }, // Must have email to resend invitation
      }
    });

    if (!teamMember) {
      return NextResponse.json(
        { success: false, error: "Team member not found or has no email address" },
        { status: 404 }
      );
    }

    // Check if member is still in PENDING status
    if (teamMember.invitationStatus === "ACCEPTED") {
      return NextResponse.json(
        {
          success: false,
          error: "Team member has already accepted the invitation"
        },
        { status: 400 }
      );
    }

    // Note: deletedAt is already filtered in the query above, so no need to check again

    // Rate limiting: Max once per hour per team member to prevent spam
    const rateLimitId = `resend:${memberId}`;
    const rateLimitConfig = {
      maxRequests: 1,
      windowMs: 60 * 60 * 1000, // 1 hour
    };
    const rateLimitResult = checkRateLimit(rateLimitId, rateLimitConfig);

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: "Invitation already sent recently. Please wait before sending again.",
          retryAfter: rateLimitResult.retryAfter,
          nextResendTime: new Date(rateLimitResult.resetTime).toISOString()
        },
        { status: 429 }
      );
      applyRateLimitHeaders(response.headers, rateLimitResult);
      return response;
    }

    // Check last sent time (database check as backup to rate limiting)
    if (teamMember.invitationSentAt) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (teamMember.invitationSentAt > hourAgo) {
        const nextResendTime = new Date(teamMember.invitationSentAt.getTime() + 60 * 60 * 1000);
        return NextResponse.json(
          {
            success: false,
            error: "Invitation was sent recently. Please wait at least 1 hour between resends.",
            lastSentAt: teamMember.invitationSentAt,
            nextResendTime
          },
          { status: 429 }
        );
      }
    }

    // Send invitation email
    if (!teamMember.fundLinkCode) {
      return NextResponse.json(
        {
          success: false,
          error: "Team member missing fundraising link code. Please contact support."
        },
        { status: 500 }
      );
    }

    // Ensure the member has an invitation token (regenerate if missing) so we
    // can build the onboarding link the same way the original invite does
    let invitationToken = teamMember.invitationToken;
    if (!invitationToken) {
      invitationToken = crypto.randomBytes(32).toString("hex");
      await prisma.teamMember.update({
        where: { id: memberId },
        data: { invitationToken },
      });
    }

    const fundraisingLink = formatFundraisingLink(campaign.slug, teamMember.fundLinkCode);
    const onboardingLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/player/onboard/${teamMember.id}?token=${invitationToken}`;

    const emailSent = await sendTeamMemberInvitation(
      teamMember.email!, // Non-null assertion safe because query filters for non-null emails
      teamMember.name,
      `${campaign.teamName} - ${campaign.organizationName}`,
      fundraisingLink,
      teamMember.personalGoal ? Number(teamMember.personalGoal) / 100 : undefined,
      onboardingLink
    );

    if (!emailSent) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send invitation email. Please try again later."
        },
        { status: 500 }
      );
    }

    // Update invitation sent timestamp
    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        invitationSentAt: new Date(),
        invitationStatus: "PENDING", // Reset status to pending
      }
    });

    return NextResponse.json({
      success: true,
      message: "Invitation resent successfully",
      sentAt: new Date().toISOString(),
      email: teamMember.email,
      fundraisingLink
    });

  } catch (error) {
    console.error("Failed to resend invitation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to resend invitation"
      },
      { status: 500 }
    );
  }
}