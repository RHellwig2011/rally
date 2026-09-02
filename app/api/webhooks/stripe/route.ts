import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { processDonation } from "@/lib/banking";
import { completeDonation, refundDonation } from "@/lib/donations";
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

    // Signature verification can only be skipped with an explicit opt-in
    // env flag, and never in production.
    const allowUnsigned =
      process.env.ALLOW_UNSIGNED_WEBHOOKS === "true" &&
      process.env.NODE_ENV !== "production";

    if (allowUnsigned) {
      console.warn('⚠️  ALLOW_UNSIGNED_WEBHOOKS: Skipping webhook signature verification');
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

  // Normal flow: the app pre-creates a PENDING donation before the client
  // confirms payment, so complete that record (idempotent — a no-op if the
  // verify endpoint already completed it).
  const existingDonation = await prisma.donation.findFirst({
    where: { paymentIntentId: paymentIntent.id },
  });

  if (existingDonation) {
    const completed = await completeDonation(existingDonation.id);
    if (!completed) {
      console.log("Donation already completed:", paymentIntent.id);
      return;
    }

    console.log("Donation completed via webhook:", existingDonation.id);

    try {
      const { sendDonationReceipt } = await import('@/lib/email');
      const campaign = await prisma.campaign.findUnique({
        where: { id: existingDonation.campaignId },
        select: { organizationName: true, teamName: true },
      });

      if (campaign) {
        await sendDonationReceipt({
          toEmail: existingDonation.donorEmail,
          donorName: existingDonation.donorName || 'Donor',
          campaignName: `${campaign.organizationName} ${campaign.teamName}`,
          amountInCents: Number(existingDonation.grossAmount),
          donationDate: existingDonation.createdAt,
          taxDeductible: false,
        });
      }
    } catch (emailError) {
      console.error('Failed to send donation receipt:', emailError);
    }
    return;
  }

  // Fallback: a payment intent we never recorded (e.g. created outside the
  // app). Requires metadata to reconstruct the donation.
  if (!campaignId || !donorEmail) {
    console.error("Missing required metadata in payment intent:", paymentIntent.id);
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
          amountInCents: paymentIntent.amount,
          donationDate: new Date(),
          taxDeductible: false,
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
    // Conditional claim, mirroring completeDonation: Stripe can deliver this
    // event out of order relative to payment_intent.succeeded, and an
    // unconditional write would flip an already-COMPLETED donation to FAILED
    // while leaving its credits applied.
    const failed = await prisma.donation.updateMany({
      where: { id: donation.id, status: "PENDING" },
      data: { status: "FAILED" },
    });

    if (failed.count === 0) {
      console.log("Donation was not PENDING; failure not recorded:", donation.id);
      return;
    }

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

  // refundDonation reverses the donation in full — the gross, the net, and the
  // platform fee. A partial refund would therefore claw back more than Stripe
  // actually returned, so it is left for manual handling rather than applied
  // incorrectly.
  if (charge.amount_refunded < charge.amount) {
    console.warn(
      `Partial refund on charge ${charge.id} (${charge.amount_refunded} of ${charge.amount}) is not supported; no credits reversed`
    );
    return;
  }

  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent.id;

  // Find the donation
  const donation = await prisma.donation.findFirst({
    where: { paymentIntentId },
    select: { id: true },
  });

  if (!donation) {
    console.error("Donation not found for payment intent:", paymentIntentId);
    return;
  }

  // Atomically flip COMPLETED -> REFUNDED and reverse all credits
  // (campaign total, team member total, banking balances + REFUND transaction)
  const refunded = await refundDonation(donation.id);

  if (!refunded) {
    console.log("Donation was not in COMPLETED state; refund skipped:", donation.id);
    return;
  }

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
