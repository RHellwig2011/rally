import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkRouteRateLimit } from "@/lib/utils/with-rate-limit";
import { RATE_LIMITS } from "@/lib/utils/rate-limiter";

/**
 * referralCode is interpolated straight into a Prisma `where`, so it has to be
 * proven to be a string before it gets there. `{ "referralCode": { "not": "" } }`
 * is valid JSON and becomes a filter that matches EVERY referral row, turning
 * this endpoint into a one-request click-count inflator for the whole platform.
 */
const trackSchema = z.object({
  referralCode: z.string().min(1, "Referral code is required").max(64),
});

/**
 * POST /api/referrals/track
 * Track a referral link click
 *
 * PUBLIC (listed in middleware's publicExactRoutes) and unauthenticated, so the
 * only thing standing between a script and unbounded write amplification is the
 * per-IP throttle below.
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitCheck = checkRouteRateLimit(req, RATE_LIMITS.API);
    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    const body = await req.json().catch(() => null);
    const parsed = trackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Referral code is required" },
        { status: 400 }
      );
    }

    // Find and update the referral
    const referral = await prisma.referral.updateMany({
      where: { referralCode: parsed.data.referralCode },
      data: {
        clickCount: { increment: 1 },
      },
    });

    if (referral.count === 0) {
      // Referral code not found - that's ok, just don't track
      return NextResponse.json(
        { success: true, message: "Referral code not found" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Click tracked" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to track referral:", error);
    return NextResponse.json(
      { success: false, error: "Failed to track referral" },
      { status: 500 }
    );
  }
}
