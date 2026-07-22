import { NextRequest, NextResponse } from "next/server";
import { processDonation } from "@/lib/banking";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  checkDonationSourceRateLimit,
  checkDonationEmailRateLimit,
} from "@/lib/utils/rate-limiter";
import { checkCsrf } from "@/lib/csrf";

// Validation schema for donations
const createDonationSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required"),
  teamMemberId: z.string().optional(), // Team member being supported
  donorEmail: z.string().email("Valid email is required"),
  donorName: z.string().optional(),
  donorPhone: z.string().optional(),
  message: z.string().optional(),
  amount: z.number().min(1, "Minimum donation is $1"),
  isAnonymous: z.boolean().optional().default(false),
  coverFees: z.boolean().optional().default(false),
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

    // Source-level throttle first: this runs before any parsing so a flood of
    // junk bodies is cheap to reject.
    const ipRateLimit = checkDonationSourceRateLimit(req);
    if (ipRateLimit.limited) {
      return ipRateLimit.response!;
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createDonationSchema.parse(body);

    // Now that a donor email is known, apply the per-email bucket too. This is
    // the one that keeps biting during card testing from rotating addresses,
    // where the IP bucket alone would not.
    const donorRateLimit = checkDonationEmailRateLimit(validatedData.donorEmail);
    if (donorRateLimit.limited) {
      return donorRateLimit.response!;
    }

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
    // When the donor covers processing fees, they are charged gross + processing
    // and the campaign keeps gross - platformFee.
    const coverFees = validatedData.coverFees;
    const chargedAmountInCents = coverFees
      ? grossAmountInCents + processingFee
      : grossAmountInCents;
    const netAmount = coverFees
      ? grossAmountInCents - platformFee
      : grossAmountInCents - platformFee - processingFee;

    // If a team member is being supported, make sure they belong to this campaign
    let teamMemberId: string | undefined;
    if (validatedData.teamMemberId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          id: validatedData.teamMemberId,
          campaignId: validatedData.campaignId,
          deletedAt: null,
        },
        select: { id: true },
      });
      teamMemberId = teamMember?.id;
    }

    // referralCode is caller-supplied on this unauthenticated endpoint, so it is
    // only persisted once it resolves to a real Referral belonging to THIS
    // campaign. Storing an arbitrary string here would let a donor point the
    // attribution logic at a record of their choosing; unknown or foreign codes
    // are dropped and the donation is still accepted.
    let referralCode: string | undefined;
    if (validatedData.referralCode) {
      const referral = await prisma.referral.findFirst({
        where: {
          referralCode: validatedData.referralCode,
          campaignId: validatedData.campaignId,
        },
        select: { referralCode: true },
      });
      referralCode = referral?.referralCode;
    }

    // Create donation record in PENDING status
    const donation = await prisma.donation.create({
      data: {
        campaignId: validatedData.campaignId,
        teamMemberId,
        donorEmail: validatedData.donorEmail,
        donorName: validatedData.donorName,
        donorMessage: validatedData.message,
        grossAmount: BigInt(grossAmountInCents),
        platformFee: BigInt(platformFee),
        processingFee: BigInt(processingFee),
        netAmount: BigInt(netAmount),
        isAnonymous: validatedData.isAnonymous,
        referralCode,
        status: "PENDING",
        paymentProvider: "STRIPE",
      },
    });

    // Create Stripe payment intent
    const { createPaymentIntent } = await import('@/lib/stripe');
    const paymentIntent = await createPaymentIntent({
      amount: chargedAmountInCents,
      campaignId: validatedData.campaignId,
      donorEmail: validatedData.donorEmail,
      metadata: {
        donationId: donation.id,
        campaignName: `${campaign.organizationName} ${campaign.teamName}`,
        ...(coverFees && { coverFees: "true" }),
        ...(validatedData.donorName && { donorName: validatedData.donorName }),
        ...(referralCode && { referralCode }),
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
          totalCharged: chargedAmountInCents / 100,
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
        // Detail is logged above; never leak internal error text to the client.
        error: "Failed to create donation",
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
    const rawLimit = parseInt(searchParams.get("limit") || "20");
    const rawOffset = parseInt(searchParams.get("offset") || "0");
    const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    {
      const where = { campaignId, status: "COMPLETED" as const };
      const donations = await prisma.donation.findMany({
        where,
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

      const total = await prisma.donation.count({ where });

      // Serialize BigInt and hide the identity of anonymous donors
      const serializedDonations = donations.map((d) => ({
        ...d,
        donorName: d.isAnonymous ? null : d.donorName,
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
    }
  } catch (error) {
    console.error("Failed to fetch donations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch donations" },
      { status: 500 }
    );
  }
}
