/**
 * Team-member onboarding invitation tokens: issue, expiry, and the one-time
 * claim that links a TeamMember row to a User (C4 / H14).
 *
 * Token policy:
 *  - 32 random bytes, hex-encoded (64 chars), unique per team member.
 *  - Expires INVITATION_TOKEN_TTL_MS (14 days) after issue; the expiry is
 *    stamped on create and on every resend, which also rotates the token.
 *  - One-time: a successful claim clears both the token and its expiry, so
 *    no link can ever be replayed.
 *  - A member that already has a userId can never be re-claimed — the claim
 *    is a conditional updateMany keyed on `userId: null`, never a
 *    read-then-write, so a concurrent double-submit has exactly one winner.
 */

import crypto from "crypto";
import prisma from "@/lib/prisma";

export const INVITATION_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/** New 32-byte hex invitation token. */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Expiry to stamp when a token is issued (create or resend). */
export function invitationTokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TOKEN_TTL_MS);
}

/**
 * Fail closed: a null expiry (row predates tracking and missed the backfill,
 * or the column was never stamped) is treated as expired. The recovery path
 * is a coach resend, which rotates the token and stamps a fresh expiry.
 */
export function isInvitationTokenExpired(
  member: { invitationTokenExpiresAt: Date | null },
  now: Date = new Date()
): boolean {
  if (!member.invitationTokenExpiresAt) return true;
  return member.invitationTokenExpiresAt.getTime() <= now.getTime();
}

/** Absolute onboarding URL the player opens from their invite. */
export function buildOnboardingLink(teamMemberId: string, token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/player/onboard/${teamMemberId}?token=${token}`;
}

export type ClaimOnboardingResult = "claimed" | "not_claimed";

/**
 * One-time claim of a TeamMember onboarding invitation.
 *
 * The whole claim predicate lives in the WHERE clause, so the update is a
 * no-op unless every invariant still holds at write time:
 *   id + token match, token unexpired, onboarding not yet completed, row not
 *   soft-deleted, and — critically — userId still null, so an existing
 *   account link is never overwritten.
 *
 * On success the token and its expiry are cleared (one-time use) and the
 * invitation is marked ACCEPTED. Returns "claimed" iff this call was the one
 * that won; a concurrent or repeated call gets "not_claimed" and must not
 * treat the onboarding as its own.
 */
export async function claimTeamMemberOnboarding(params: {
  teamMemberId: string;
  invitationToken: string;
  /** User to link, or null when the player has no account to connect. */
  userId: string | null;
  /** Profile fields collected by the onboarding form. */
  profileData: Record<string, unknown>;
  now?: Date;
}): Promise<ClaimOnboardingResult> {
  const now = params.now ?? new Date();

  const result = await prisma.teamMember.updateMany({
    where: {
      id: params.teamMemberId,
      invitationToken: params.invitationToken,
      invitationTokenExpiresAt: { gt: now },
      onboardingCompletedAt: null,
      userId: null,
      deletedAt: null,
    },
    data: {
      ...params.profileData,
      // where guarantees userId is currently null, so this only ever sets —
      // never overwrites — an account link.
      ...(params.userId ? { userId: params.userId } : {}),
      invitationToken: null,
      invitationTokenExpiresAt: null,
      onboardingCompletedAt: now,
      invitationStatus: "ACCEPTED",
      joinedAt: now,
    },
  });

  return result.count === 1 ? "claimed" : "not_claimed";
}
