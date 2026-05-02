import { NextRequest, NextResponse } from "next/server";
import { processDonation } from "@/lib/banking";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { checkRouteRateLimit } from "@/lib/utils/with-rate-limit";
import { RATE_LIMITS } from "@/lib/utils/rate-limiter";
import { checkCsrf } from "@/lib/csrf";

// Validation schema for donations
const createDonationSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required"),
  teamMemberId: z.string().optional(), // Team member being supported
  donorEmail: z.string().email("Valid email is required"),
  donorName: z.string().optional(),
  donorPhone: z.string().optional(),
  message: z.string().optional(),
  amount: z.number().positive("Amount must be greater than 0"),
  isAnonymous: z.boolean().optional().default(false),
  referralCode: z.string().optional(),
});

/**
 * POST /api/donations
 * Create a new donation and Stripe payment intent
 */
export async function POST(req: NextRequest) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Apply payment-specific rate limiting
    const rateLimitCheck = checkRouteRateLimit(req, RATE_LIMITS.DONATION);
    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createDonationSchema.parse(body);

    // Verify campaign exists and is active
    const campaign = await prisma.campaign.findUnique({
      where: { id: validatedData.campaignId },
      select: {
        id: true,
        status: true,
        organizationName: true,
        teamName: true,
        platformFeePercent: true,
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
        { success: false, error: "Campaign is not currently accepting donations" },
        { status: 400 }
      );
    }

    // Convert dollar amount to cents
    const grossAmountInCents = Math.round(validatedData.amount * 100);

    // Calculate fees
    const platformFeePercent = campaign.platformFeePercent || 10;
    const platformFee = Math.round((grossAmountInCents * platformFeePercent) / 100);
    const processingFee = Math.round(grossAmountInCents * 0.029) + 30; // Stripe: 2.9% + $0.30
    const netAmount = grossAmountInCents - platformFee - processingFee;

    // Create donation record in PENDING status
    const donation = await prisma.donation.create({
      data: {
        campaignId: validatedData.campaignId,
        donorEmail: validatedData.donorEmail,
        donorName: validatedData.donorName,
        donorMessage: validatedData.message,
        grossAmount: BigInt(grossAmountInCents),
        platformFee: BigInt(platformFee),
        processingFee: BigInt(processingFee),
        netAmount: BigInt(netAmount),
        isAnonymous: validatedData.isAnonymous,
        referralCode: validatedData.teamMemberId || validatedData.referralCode,
        status: "PENDING",
        paymentProvider: "STRIPE",
      },
    });

    // Create Stripe payment intent
    const { createPaymentIntent } = await import('@/lib/stripe');
    const paymentIntent = await createPaymentIntent({
      amount: grossAmountInCents,
      campaignId: validatedData.campaignId,
      donorEmail: validatedData.donorEmail,
      metadata: {
        donationId: donation.id,
        campaignName: `${campaign.organizationName} ${campaign.teamName}`,
        ...(validatedData.donorName && { donorName: validatedData.donorName }),
        ...(validatedData.referralCode && { referralCode: validatedData.referralCode }),
      },
    });

    // Update donation with payment intent ID
    await prisma.donation.update({
      where: { id: donation.id },
      data: {
        paymentIntentId: paymentIntent.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        donation: {
          id: donation.id,
          amount: validatedData.amount,
          campaignId: donation.campaignId,
        },
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Donation creation error:", error);

    // Handle validation errors
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

    // Handle other errors
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create donation",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/donations?campaignId=xxx
 * Get donations for a campaign
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    try {
      const donations = await prisma.donation.findMany({
        where: { campaignId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          donorName: true,
          donorMessage: true,
          grossAmount: true,
          isAnonymous: true,
          createdAt: true,
          status: true,
        },
      });

      const total = await prisma.donation.count({
        where: { campaignId },
      });

      // Convert BigInt to string for JSON
      const serializedDonations = donations.map((d) => ({
        ...d,
        grossAmount: d.grossAmount.toString(),
      }));

      return NextResponse.json(
        {
          success: true,
          donations: serializedDonations,
          total,
          hasMore: offset + limit < total,
        },
        { status: 200 }
      );
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error("Failed to fetch donations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch donations" },
      { status: 500 }
    );
  }
}
