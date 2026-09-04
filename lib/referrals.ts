/**
 * Referral rows (H12 leftover): a Referral is the durable per-player share
 * link record for one campaign — `referralCode` is what DonationForm passes
 * through and what /api/referrals/track and the donations route resolve.
 *
 * Rows are created lazily, exactly once per (campaignId, referrerId) pair,
 * when a player claims their roster spot (onboard) — nothing else on the
 * platform creates them, so a missing row simply means the player has no
 * share link yet.
 */

import crypto from "crypto";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/** Short, URL-safe, unguessable share code (12 chars, 72 bits). */
export function generateReferralCode(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/**
 * Idempotently ensure a Referral row exists for this user on this campaign.
 *
 * Safe to call from racing requests: `referralCode` is unique, and a P2002
 * collision on the (astronomically unlikely) code clash just retries with a
 * fresh code. A pre-existing row for the pair is returned as-is so repeated
 * onboarding attempts / re-claims never mint a second code and split the
 * player's stats.
 *
 * Never throws in a way callers must handle inline — returns null on failure
 * (repo convention: a missing referral degrades to an untracked share link,
 * it must not fail the onboarding that triggered it).
 */
export async function ensureReferral(
  campaignId: string,
  referrerId: string
): Promise<{ id: string; referralCode: string } | null> {
  try {
    const existing = await prisma.referral.findFirst({
      where: { campaignId, referrerId },
      select: { id: true, referralCode: true },
    });
    if (existing) return existing;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.referral.create({
          data: {
            campaignId,
            referrerId,
            referralCode: generateReferralCode(),
          },
          select: { id: true, referralCode: true },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          // Either our random code collided (retry with a new one) or a
          // concurrent call created the pair's row first (return theirs).
          const raced = await prisma.referral.findFirst({
            where: { campaignId, referrerId },
            select: { id: true, referralCode: true },
          });
          if (raced) return raced;
          continue;
        }
        throw error;
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to ensure referral row:", error);
    return null;
  }
}
