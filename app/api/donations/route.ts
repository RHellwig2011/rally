import { NextRequest, NextResponse } from "next/server";
import { processDonation } from "@/lib/banking";
import prisma from "@/lib/prisma";
import { z } from "zod";

// Validation schema for donations
const createDonationSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required"),
  donorEmail: z.string().email("Valid email is required"),
  donorName: z.string().optional(),
  donorMessage: z.string().optional(),
  amount: z.number().positive("Amount must be greater than 0"),
  isAnonymous: z.boolean().optional().default(false),
  referralCode: z.string().optional(),
  paymentIntentId: z.string().optional(), // For Stripe payments
  useStripe: z.boolean().optional().default(false), // Flag to use Stripe or simulated
});

/**
 * POST /api/donations
 * Create a new donation (Stripe or simulated payment)
 */
export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedData = createDonationSchema.parse(body);

    // Convert dollar amount to cents (BigInt)
    const grossAmountInCents = BigInt(Math.round(validatedData.amount * 100));

    // If using Stripe, verify the payment intent
    if (validatedData.useStripe && validatedData.paymentIntentId) {
      const { retrievePaymentIntent } = await import('@/lib/stripe');

      try {
        const paymentIntent = await retrievePaymentIntent(validatedData.paymentIntentId);

        // Verify payment was successful
        if (paymentIntent.status !== 'succeeded') {
          return NextResponse.json(
            {
              success: false,
              error: "Payment has not been completed yet",
            },
            { status: 400 }
          );
        }

        // Verify amount matches
        if (BigInt(paymentIntent.amount) !== grossAmountInCents) {
          return NextResponse.json(
            {
              success: false,
              error: "Payment amount does not match donation amount",
            },
            { status: 400 }
          );
        }

        // Check if donation already exists (idempotency)
        const existingDonation = await prisma.donation.findFirst({
          where: { paymentIntentId: validatedData.paymentIntentId },
        });

        if (existingDonation) {
          return NextResponse.json(
            {
              success: false,
              error: "This payment has already been processed",
            },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error("Failed to verify payment intent:", error);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to verify payment",
          },
          { status: 500 }
        );
      }
    }

    // Process the donation using our banking logic
    const result = await processDonation({
      campaignId: validatedData.campaignId,
      donorEmail: validatedData.donorEmail,
      donorName: validatedData.donorName,
      donorMessage: validatedData.donorMessage,
      grossAmount: grossAmountInCents,
      isAnonymous: validatedData.isAnonymous,
      referralCode: validatedData.referralCode,
      paymentIntentId: validatedData.paymentIntentId,
    });

    // Send donation receipt email
    try {
      const { sendDonationReceipt } = await import('@/lib/email');
      const campaign = await prisma.campaign.findUnique({
        where: { id: validatedData.campaignId },
        select: { organizationName: true, teamName: true },
      });

      if (campaign) {
        await sendDonationReceipt({
          toEmail: validatedData.donorEmail,
          donorName: validatedData.donorName || 'Donor',
          campaignName: `${campaign.organizationName} ${campaign.teamName}`,
          amount: Number(grossAmountInCents),
          donationDate: new Date(),
          taxDeductible: true,
        });
      }
    } catch (emailError) {
      console.error('Failed to send donation receipt:', emailError);
      // Don't fail the request if email fails
    }

    // Convert BigInt values to strings for JSON serialization
    const donation = {
      ...result.donation,
      grossAmount: result.donation.grossAmount.toString(),
      platformFee: result.donation.platformFee.toString(),
      processingFee: result.donation.processingFee.toString(),
      netAmount: result.donation.netAmount.toString(),
    };

    return NextResponse.json(
      {
        success: true,
        donation,
        message: "Thank you for your donation!",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Donation processing error:", error);

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
        error: error instanceof Error ? error.message : "Failed to process donation",
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
