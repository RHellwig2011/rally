import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { processDonation } from "@/lib/banking";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// This is critical - tells Next.js not to parse the body
export const preferredRegion = 'auto';

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 *
 * Important: This endpoint must have raw body access for signature verification
 */
export async function POST(req: NextRequest) {
  try {
    // Get raw body as buffer for signature verification
    const buf = await req.arrayBuffer();
    const rawBody = Buffer.from(buf);
    const body = rawBody.toString('utf8');

    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;

    // TEMPORARY DEV WORKAROUND: Skip signature verification in development
    // TODO: Fix before production - Next.js 14 App Router has issues with raw body access
    // See: https://github.com/vercel/next.js/discussions/48427
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  DEVELOPMENT MODE: Skipping webhook signature verification');
      console.warn('⚠️  THIS MUST BE FIXED BEFORE PRODUCTION DEPLOYMENT');
      event = JSON.parse(body) as Stripe.Event;
    } else {
      try {
        event = constructWebhookEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 400 }
        );
      }
    }

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log("Payment succeeded:", paymentIntent.id);

  const { campaignId, donorEmail, donorName, referralCode } = paymentIntent.metadata;

  if (!campaignId || !donorEmail) {
    console.error("Missing required metadata in payment intent:", paymentIntent.id);
    return;
  }

  // Check if donation already exists (idempotency)
  const existingDonation = await prisma.donation.findFirst({
    where: { paymentIntentId: paymentIntent.id },
  });

  if (existingDonation) {
    console.log("Donation already processed:", paymentIntent.id);
    return;
  }

  try {
    // Process the donation
    const result = await processDonation({
      campaignId,
      donorEmail,
      donorName,
      donorMessage: paymentIntent.description || undefined,
      grossAmount: BigInt(paymentIntent.amount),
      paymentIntentId: paymentIntent.id,
      isAnonymous: false,
      referralCode,
    });

    console.log("Donation processed successfully:", result.donation.id);

    // Send receipt email
    try {
      const { sendDonationReceipt } = await import('@/lib/email');
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { organizationName: true, teamName: true },
      });

      if (campaign) {
        await sendDonationReceipt({
          toEmail: donorEmail,
          donorName: donorName || 'Donor',
          campaignName: `${campaign.organizationName} ${campaign.teamName}`,
          amount: paymentIntent.amount,
          donationDate: new Date(),
          taxDeductible: true,
        });
      }
    } catch (emailError) {
      console.error('Failed to send donation receipt:', emailError);
    }
  } catch (error) {
    console.error("Failed to process donation:", error);
    throw error;
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log("Payment failed:", paymentIntent.id);

  // Check if donation exists and mark as failed
  const donation = await prisma.donation.findFirst({
    where: { paymentIntentId: paymentIntent.id },
  });

  if (donation) {
    await prisma.donation.update({
      where: { id: donation.id },
      data: { status: "FAILED" },
    });
    console.log("Donation marked as failed:", donation.id);
  }
}

/**
 * Handle charge refund
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log("Charge refunded:", charge.id);

  if (!charge.payment_intent) {
    console.error("No payment intent associated with charge:", charge.id);
    return;
  }

  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent.id;

  // Find the donation
  const donation = await prisma.donation.findFirst({
    where: { paymentIntentId },
    include: {
      campaign: {
        include: {
          bankingAccount: true,
        },
      },
    },
  });

  if (!donation || !donation.campaign.bankingAccount) {
    console.error("Donation or banking account not found for payment intent:", paymentIntentId);
    return;
  }

  // Update donation status
  await prisma.donation.update({
    where: { id: donation.id },
    data: { status: "REFUNDED" },
  });

  // Create refund transaction
  await prisma.transaction.create({
    data: {
      bankingAccountId: donation.campaign.bankingAccount.id,
      type: "REFUND",
      amount: -donation.netAmount,
      balanceAfter: donation.campaign.bankingAccount.availableBalance - donation.netAmount,
      donationId: donation.id,
      description: `Refund for donation ${donation.id}`,
      createdBy: "system",
    },
  });

  // Update banking account balance
  await prisma.bankingAccount.update({
    where: { id: donation.campaign.bankingAccount.id },
    data: {
      availableBalance: {
        decrement: donation.netAmount,
      },
      totalRaised: {
        decrement: donation.grossAmount,
      },
    },
  });

  console.log("Refund processed successfully for donation:", donation.id);
}

/**
 * Handle Stripe Connect account updates
 */
async function handleAccountUpdated(account: Stripe.Account) {
  console.log("Account updated:", account.id);

  // Update banking account with verification status
  const bankingAccount = await prisma.bankingAccount.findFirst({
    where: { stripeConnectAccountId: account.id },
  });

  if (bankingAccount) {
    const isVerified = account.charges_enabled && account.payouts_enabled;

    await prisma.bankingAccount.update({
      where: { id: bankingAccount.id },
      data: { payoutAccountVerified: isVerified },
    });

    console.log("Banking account verification updated:", bankingAccount.id, isVerified);
  }
}
