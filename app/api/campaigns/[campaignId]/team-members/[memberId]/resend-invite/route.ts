import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  sendTeamMemberInvitation,
  formatFundraisingLink,
} from "@/lib/utils/team-member";
import {
  generateInvitationToken,
  invitationTokenExpiry,
  buildOnboardingLink,
} from "@/lib/onboarding";
import { sendTeamMemberInvitationSMS } from "@/lib/services/sms";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  applyRateLimitHeaders
} from "@/lib/utils/rate-limit";
import { checkCsrf } from "@/lib/csrf";

/**
 * POST /api/campaigns/[campaignId]/team-members/[memberId]/resend-invite
 * Resend invitation to a team member.
 * Requirements: Max once per hour to prevent spam
 *
 * H14: every resend ROTATES the invitation token (old links die immediately)
 * and stamps a fresh 14-day expiry.
 * H7: members with a phone but no email get the invite by SMS (suppression
 * is enforced inside lib/services/sms.ts); the onboarding link is also
 * returned so the coach can copy it directly.
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
      }
    });

    if (!teamMember) {
      return NextResponse.json(
        { success: false, error: "Team member not found" },
        { status: 404 }
      );
    }

    // Need at least one channel to deliver the invitation
    if (!teamMember.email && !teamMember.phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Team member has no email or phone number to send the invitation to" },
        { status: 400 }
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

    // H14: rotate the token on EVERY resend — any previously sent link stops
    // working here — and stamp a fresh expiry. Persisted before sending so a
    // delivered link is always backed by the stored token; if the send below
    // fails, the coach can still copy this link from the roster.
    const invitationToken = generateInvitationToken();
    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        invitationToken,
        invitationTokenExpiresAt: invitationTokenExpiry(),
        invitationSentAt: new Date(),
        invitationStatus: "PENDING", // Reset status to pending
      },
    });

    const onboardingLink = buildOnboardingLink(teamMember.id, invitationToken);
    const campaignName = `${campaign.teamName} - ${campaign.organizationName}`;

    let delivered: boolean;
    let channel: "email" | "sms";

    if (teamMember.email) {
      channel = "email";
      if (!teamMember.fundLinkCode) {
        return NextResponse.json(
          {
            success: false,
            error: "Team member missing fundraising link code. Please contact support."
          },
          { status: 500 }
        );
      }

      const fundraisingLink = formatFundraisingLink(campaign.slug, teamMember.fundLinkCode);
      delivered = await sendTeamMemberInvitation(
        teamMember.email,
        teamMember.name,
        campaignName,
        fundraisingLink,
        teamMember.personalGoal ? Number(teamMember.personalGoal) / 100 : undefined,
        onboardingLink
      );
    } else {
      // H7: SMS invite for a member with a phone but no email. sendSMS runs
      // the suppression check internally — no caller can bypass it.
      channel = "sms";
      delivered = await sendTeamMemberInvitationSMS(
        teamMember.phoneNumber!,
        teamMember.name,
        campaignName,
        onboardingLink
      );
    }

    if (!delivered) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to send invitation ${channel === "sms" ? "SMS" : "email"}. Please try again later.`,
          // The rotated link is live even though delivery failed — the coach
          // can copy it from the roster instead of waiting out the rate limit.
          onboardingLink
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invitation resent successfully via ${channel}`,
      sentAt: new Date().toISOString(),
      email: teamMember.email,
      channel,
      onboardingLink,
      invitationTokenExpiresAt: invitationTokenExpiry().toISOString()
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
