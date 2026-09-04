/**
 * Assistant-coach (Campaign.guardians) invitations.
 *
 * Token policy matches lib/onboarding.ts: 32-byte hex, 14-day expiry,
 * one-time claim via conditional updateMany (token + unexpired + acceptedAt null).
 */

import prisma from "@/lib/prisma";
import {
  generateInvitationToken,
  invitationTokenExpiry,
} from "@/lib/onboarding";
import {
  sendAssistantCoachAddedEmail,
  sendCoachInviteEmail,
} from "@/lib/email";

export type InviteActor = { id: string; role: string };

export type InviteResult =
  | { ok: true; status: "connected" | "invited" }
  | { ok: false; error: string; httpStatus: number };

/** Primary leader or ADMIN — guardians cannot add guardians. */
export function canInviteAssistantCoach(
  actor: InviteActor,
  campaign: { primaryLeaderId: string }
): boolean {
  return actor.role === "ADMIN" || actor.id === campaign.primaryLeaderId;
}

export function canViewCoaches(
  actor: InviteActor,
  campaign: { primaryLeaderId: string; guardianIds: string[] }
): boolean {
  return (
    actor.role === "ADMIN" ||
    actor.id === campaign.primaryLeaderId ||
    campaign.guardianIds.includes(actor.id)
  );
}

export function buildCoachInviteLink(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/coach-invite/${token}`;
}

export type ClaimCoachInviteResult = "claimed" | "not_claimed";

/**
 * One-time claim of a CoachInvite. The claim predicate lives in the WHERE
 * clause so a concurrent double-submit has exactly one winner. On success
 * the current user is connected to campaign.guardians.
 */
export async function claimCoachInvite(params: {
  token: string;
  userId: string;
  now?: Date;
}): Promise<ClaimCoachInviteResult> {
  const now = params.now ?? new Date();

  const result = await prisma.coachInvite.updateMany({
    where: {
      token: params.token,
      acceptedAt: null,
      expiresAt: { gt: now },
    },
    data: { acceptedAt: now },
  });

  if (result.count !== 1) return "not_claimed";

  const invite = await prisma.coachInvite.findUnique({
    where: { token: params.token },
    select: { campaignId: true },
  });
  if (!invite) return "not_claimed";

  await prisma.campaign.update({
    where: { id: invite.campaignId },
    data: { guardians: { connect: { id: params.userId } } },
  });

  return "claimed";
}

export async function inviteAssistantCoach(params: {
  campaignId: string;
  email: string;
  actor: InviteActor;
  actorName: string;
}): Promise<InviteResult> {
  const email = params.email.trim().toLowerCase();

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.campaignId },
    include: {
      guardians: { select: { id: true, email: true } },
      primaryLeader: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  if (!campaign) {
    return { ok: false, error: "Campaign not found", httpStatus: 404 };
  }

  if (!canInviteAssistantCoach(params.actor, campaign)) {
    return {
      ok: false,
      error: "Not authorized to invite assistant coaches",
      httpStatus: 403,
    };
  }

  if (campaign.primaryLeader.email.toLowerCase() === email) {
    return {
      ok: false,
      error: "That person already leads this campaign",
      httpStatus: 400,
    };
  }

  if (campaign.guardians.some((g) => g.email.toLowerCase() === email)) {
    return {
      ok: false,
      error: "That person is already an assistant coach",
      httpStatus: 409,
    };
  }

  const campaignName = `${campaign.organizationName} ${campaign.teamName}`;
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true },
  });

  if (existingUser) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { guardians: { connect: { id: existingUser.id } } },
    });

    await prisma.coachInvite.updateMany({
      where: {
        campaignId: campaign.id,
        email,
        acceptedAt: null,
      },
      data: { acceptedAt: new Date() },
    });

    await sendAssistantCoachAddedEmail({
      toEmail: existingUser.email,
      toName: existingUser.firstName || "Coach",
      campaignName,
      inviterName: params.actorName,
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/${campaign.id}`,
    }).catch((err) =>
      console.error("Failed to send assistant-coach notification:", err)
    );

    return { ok: true, status: "connected" };
  }

  const token = generateInvitationToken();
  const expiresAt = invitationTokenExpiry();

  const pending = await prisma.coachInvite.findFirst({
    where: { campaignId: campaign.id, email, acceptedAt: null },
    select: { id: true },
  });

  if (pending) {
    await prisma.coachInvite.update({
      where: { id: pending.id },
      data: { token, expiresAt, invitedById: params.actor.id },
    });
  } else {
    await prisma.coachInvite.create({
      data: {
        campaignId: campaign.id,
        email,
        token,
        expiresAt,
        invitedById: params.actor.id,
      },
    });
  }

  await sendCoachInviteEmail({
    toEmail: email,
    campaignName,
    inviterName: params.actorName,
    inviteLink: buildCoachInviteLink(token),
  }).catch((err) =>
    console.error("Failed to send assistant-coach invite:", err)
  );

  return { ok: true, status: "invited" };
}

export async function removeAssistantCoach(params: {
  campaignId: string;
  userId: string;
  actor: InviteActor;
}): Promise<InviteResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.campaignId },
    select: {
      id: true,
      primaryLeaderId: true,
      guardians: { select: { id: true } },
    },
  });

  if (!campaign) {
    return { ok: false, error: "Campaign not found", httpStatus: 404 };
  }

  if (!canInviteAssistantCoach(params.actor, campaign)) {
    return {
      ok: false,
      error: "Not authorized to remove assistant coaches",
      httpStatus: 403,
    };
  }

  if (params.userId === campaign.primaryLeaderId) {
    return {
      ok: false,
      error: "Cannot remove the campaign leader",
      httpStatus: 400,
    };
  }

  if (!campaign.guardians.some((g) => g.id === params.userId)) {
    return { ok: false, error: "Assistant coach not found", httpStatus: 404 };
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { guardians: { disconnect: { id: params.userId } } },
  });

  return { ok: true, status: "connected" };
}
