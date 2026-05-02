import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPaymentIntent } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { checkRouteRateLimit } from "@/lib/utils/with-rate-limit";
import { RATE_LIMITS } from "@/lib/utils/rate-limiter";

// Validation schema
const createIntentSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  donorEmail: z.string().email("Valid email is required"),
  donorName: z.string().optional(),
  referralCode: z.string().optional(),
});

/**
 * POST /api/payments/create-intent
 * Create a Stripe Payment Intent for a donation
 */
export async function POST(req: NextRequest) {
  try {
    // Apply payment-specific rate limiting
    const rateLimitCheck = checkRouteRateLimit(req, RATE_LIMITS.PAYMENT);
    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    const body = await req.json();
    const validatedData = createIntentSchema.parse(body);

    // Verify campaign exists and is active
    const campaign = await prisma.campaign.findUnique({
      where: { id: validatedData.campaignId },
      select: {
        id: true,
        status: true,
        organizationName: true,
        teamName: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Campaign is not active" },
        { status: 400 }
      );
    }

    // Convert dollar amount to cents
    const amountInCents = Math.round(validatedData.amount * 100);

    // Create payment intent
    const paymentIntent = await createPaymentIntent({
      amount: amountInCents,
      campaignId: validatedData.campaignId,
      donorEmail: validatedData.donorEmail,
      metadata: {
        campaignName: `${campaign.organizationName} ${campaign.teamName}`,
        ...(validatedData.donorName && { donorName: validatedData.donorName }),
        ...(validatedData.referralCode && { referralCode: validatedData.referralCode }),
      },
    });

    return NextResponse.json(
      {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to create payment intent:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create payment intent",
      },
      { status: 500 }
    );
  }
}
