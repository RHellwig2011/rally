import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/referrals/track
 * Track a referral link click
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referralCode } = body;

    if (!referralCode) {
      return NextResponse.json(
        { success: false, error: "Referral code is required" },
        { status: 400 }
      );
    }

    // Find and update the referral
    const referral = await prisma.referral.updateMany({
      where: { referralCode },
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
