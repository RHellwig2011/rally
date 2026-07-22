import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import Stripe from "stripe";
import { checkRouteRateLimit } from "@/lib/utils/with-rate-limit";
import { RATE_LIMITS } from "@/lib/utils/rate-limiter";
import { completeDonation } from "@/lib/donations";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-11-17.clover',
});

/**
 * POST /api/donations/[donationId]/verify
 * Verify Stripe payment and update donation status
 * Called after client-side Stripe flow completes
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { donationId: string } }
) {
  try {
    // Apply payment-specific rate limiting
    const rateLimitCheck = checkRouteRateLimit(req, RATE_LIMITS.PAYMENT);
    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    const donationId = params.donationId;
    const body = await req.json();
    const { paymentIntentId } = body;

    if (!paymentIntentId) {
      return NextResponse.json(
        { success: false, error: "Payment intent ID is required" },
        { status: 400 }
      );
    }

    // Get donation from database
    const donation = await prisma.donation.findUnique({
      where: { id: donationId },
      include: {
        campaign: {
          select: {
            id: true,
            teamName: true,
            organizationName: true,
            currentAmount: true,
          }
        }
      }
    });

    if (!donation) {
      return NextResponse.json(
        { success: false, error: "Donation not found" },
        { status: 404 }
      );
    }

    // Check if donation is already completed
    if (donation.status === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        message: "Donation already completed",
        donation: {
          id: donation.id,
          status: donation.status,
          amount: Number(donation.grossAmount) / 100,
        }
      });
    }

    // Verify the payment intent with Stripe (expand payment_method for last4)
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["payment_method"],
      });
    } catch (stripeError) {
      console.error('Stripe error retrieving payment intent:', stripeError);
      return NextResponse.json(
        { success: false, error: "Failed to verify payment with Stripe" },
        { status: 500 }
      );
    }

    // Verify payment intent matches donation
    if (paymentIntent.id !== donation.paymentIntentId) {
      return NextResponse.json(
        { success: false, error: "Payment intent does not match donation" },
        { status: 400 }
      );
    }

    // Check payment status
    if (paymentIntent.status === 'succeeded') {
      // Get the last 4 digits if available (payment_method is expanded)
      const paymentMethod = paymentIntent.payment_method;
      let last4: string | null = null;
      if (paymentMethod && typeof paymentMethod === 'object' && 'card' in paymentMethod) {
        last4 = paymentMethod.card?.last4 ?? null;
      }

      // Atomically complete the donation and apply credits. Returns null if
      // another caller (e.g. the Stripe webhook) already completed it.
      const completed = await completeDonation(donationId, {
        paymentMethodLast4: last4,
      });

      if (completed) {
        // Send confirmation email (only from the caller that won the race)
        try {
          const { sendDonationReceipt } = await import('@/lib/email');
          await sendDonationReceipt({
            toEmail: donation.donorEmail,
            donorName: donation.donorName || 'Anonymous Donor',
            campaignName: `${donation.campaign.teamName} - ${donation.campaign.organizationName}`,
            amount: Number(donation.grossAmount) / 100,
            donationDate: donation.createdAt,
            taxDeductible: false, // TODO: Set based on campaign's tax-exempt status
          });
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError);
          // Don't fail the request if email fails
        }
      }

      return NextResponse.json({
        success: true,
        message: completed ? "Payment verified successfully" : "Donation already completed",
        donation: {
          id: donation.id,
          status: 'COMPLETED',
          amount: Number(donation.grossAmount) / 100,
          campaignName: `${donation.campaign.teamName} - ${donation.campaign.organizationName}`,
        }
      });

    } else if (paymentIntent.status === 'processing') {
      // Payment is still processing
      return NextResponse.json({
        success: true,
        message: "Payment is still processing",
        donation: {
          id: donation.id,
          status: 'PROCESSING',
          amount: Number(donation.grossAmount) / 100,
        }
      });

    } else if (paymentIntent.status === 'requires_payment_method' ||
               paymentIntent.status === 'requires_confirmation') {
      // Payment failed or was not completed
      await prisma.donation.update({
        where: { id: donationId },
        data: {
          status: 'FAILED',
          // Note: Payment failure details are stored in Stripe, not in our DB
        }
      });

      return NextResponse.json(
        {
          success: false,
          error: "Payment was not completed",
          donation: {
            id: donation.id,
            status: 'FAILED',
          }
        },
        { status: 400 }
      );

    } else {
      // Other payment intent statuses
      return NextResponse.json(
        {
          success: false,
          error: `Payment has unexpected status: ${paymentIntent.status}`,
          donation: {
            id: donation.id,
            status: donation.status,
          }
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Donation verification error:', error);
    return NextResponse.json(
      {
        success: false,
        // Detail is logged above; never leak internal error text to the client.
        error: "Failed to verify donation"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/donations/[donationId]/verify
 * Get donation verification status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { donationId: string } }
) {
  try {
    const donationId = params.donationId;

    const donation = await prisma.donation.findUnique({
      where: { id: donationId },
      select: {
        id: true,
        status: true,
        grossAmount: true,
        donorName: true,
        isAnonymous: true,
        createdAt: true,
        referralCode: true,
        campaign: {
          select: {
            teamName: true,
            organizationName: true,
          }
        }
      }
    });

    if (!donation) {
      return NextResponse.json(
        { success: false, error: "Donation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      donation: {
        id: donation.id,
        status: donation.status,
        amount: Number(donation.grossAmount) / 100,
        donorName: donation.isAnonymous ? "Anonymous" : donation.donorName,
        campaignName: `${donation.campaign.teamName} - ${donation.campaign.organizationName}`,
        createdAt: donation.createdAt,
      }
    });

  } catch (error) {
    console.error('Failed to fetch donation status:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch donation status"
      },
      { status: 500 }
    );
  }
}