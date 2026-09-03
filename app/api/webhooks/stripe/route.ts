import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, stripe } from "@/lib/stripe";
import { processDonation, reconstructDonationFromIntent } from "@/lib/banking";
import { completeDonation, applyChargeback, applyRefund, reinstateChargeback, stripeDisputeFeeCents, chargeRefundToGross } from "@/lib/donations";
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

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "charge.dispute.closed":
        await handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;

      case "charge.dispute.funds_reinstated":
        await handleDisputeFundsReinstated(event.data.object as Stripe.Dispute);
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

  const reconstructed = reconstructDonationFromIntent({
    amount: paymentIntent.amount,
    metadata: paymentIntent.metadata,
  });

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
      const { sendDonationReceipt } = await import("@/lib/email");
      const campaign = await prisma.campaign.findUnique({
        where: { id: existingDonation.campaignId },
        select: { organizationName: true, teamName: true },
      });

      if (campaign) {
        await sendDonationReceipt({
          toEmail: existingDonation.donorEmail,
          donorName: existingDonation.donorName || "Donor",
          campaignName: `${campaign.organizationName} ${campaign.teamName}`,
          amountInCents: Number(existingDonation.grossAmount),
          donationDate: existingDonation.createdAt,
          taxDeductible: false,
        });
      }
    } catch (emailError) {
      console.error("Failed to send donation receipt:", emailError);
    }
    return;
  }

  const campaignId = reconstructed.campaignId;
  const donorEmail = reconstructed.donorEmail;
  const donorName = reconstructed.donorName;

  if (!campaignId || !donorEmail) {
    console.error("Missing required metadata in payment intent:", paymentIntent.id);
    return;
  }

  try {
    const result = await processDonation({
      campaignId,
      donorEmail,
      donorName,
      donorMessage: paymentIntent.description || undefined,
      grossAmount: reconstructed.grossAmount,
      paymentIntentId: paymentIntent.id,
      isAnonymous: false,
      referralCode: reconstructed.referralCode,
      teamMemberId: reconstructed.teamMemberId,
      coverFees: reconstructed.coverFees,
    });

    console.log("Donation processed successfully:", result.donation.id);

    try {
      const { sendDonationReceipt } = await import("@/lib/email");
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { organizationName: true, teamName: true },
      });

      if (campaign) {
        await sendDonationReceipt({
          toEmail: donorEmail,
          donorName: donorName || "Donor",
          campaignName: `${campaign.organizationName} ${campaign.teamName}`,
          amountInCents: Number(reconstructed.grossAmount),
          donationDate: new Date(),
          taxDeductible: false,
        });
      }
    } catch (emailError) {
      console.error("Failed to send donation receipt:", emailError);
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
 * Handle charge refund. Stripe sends charge.refunded with a running
 * amount_refunded; applyRefund reverses only the delta.
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

  const donation = await prisma.donation.findFirst({
    where: { paymentIntentId },
    select: { id: true, grossAmount: true },
  });

  if (!donation) {
    console.error("Donation not found for payment intent:", paymentIntentId);
    return;
  }

  const refundedGross = chargeRefundToGross(
    BigInt(charge.amount_refunded),
    BigInt(charge.amount),
    donation.grossAmount
  );

  const refunded = await applyRefund(donation.id, refundedGross);

  if (!refunded) {
    console.log("Donation was not refundable; refund skipped:", donation.id);
    return;
  }

  console.log(
    "Refund processed for donation:",
    donation.id,
    "refundedAmount=",
    refunded.refundedAmount.toString(),
    "status=",
    refunded.status
  );
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

function isInquiryDispute(status: string | null | undefined): boolean {
  return typeof status === "string" && status.startsWith("warning_");
}

function paymentIntentIdFrom(dispute: Stripe.Dispute): string | null {
  if (typeof dispute.payment_intent === "string") return dispute.payment_intent;
  if (dispute.payment_intent && typeof dispute.payment_intent === "object") {
    return dispute.payment_intent.id;
  }
  return null;
}

async function resolveDonationForDispute(dispute: Stripe.Dispute) {
  let paymentIntentId = paymentIntentIdFrom(dispute);

  if (!paymentIntentId) {
    const chargeId =
      typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) return null;
    const charge = await stripe.charges.retrieve(chargeId);
    const pi = charge.payment_intent;
    paymentIntentId = typeof pi === "string" ? pi : pi?.id ?? null;
  }

  if (!paymentIntentId) return null;

  return prisma.donation.findFirst({
    where: { paymentIntentId },
    select: { id: true, campaignId: true, grossAmount: true, donorEmail: true },
  });
}

async function alertBankAdmins(params: {
  donationId: string;
  campaignId: string;
  disputeId: string;
  reason: string | null;
  feeCents: bigint;
  grossAmount: bigint;
}) {
  try {
    const [admins, campaign] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ["BANK_ADMIN", "ADMIN"] } },
        select: { email: true },
      }),
      prisma.campaign.findUnique({
        where: { id: params.campaignId },
        select: { organizationName: true, teamName: true },
      }),
    ]);

    const emails = admins.map((a) => a.email).filter(Boolean);
    if (emails.length === 0) {
      console.error("Chargeback applied but no BANK_ADMIN/ADMIN users to alert", params);
      return;
    }

    const { sendEmailWithResult } = await import("@/lib/email");
    const campaignLabel = campaign
      ? `${campaign.organizationName} ${campaign.teamName}`
      : params.campaignId;
    const fee = (Number(params.feeCents) / 100).toFixed(2);
    const gross = (Number(params.grossAmount) / 100).toFixed(2);

    await sendEmailWithResult({
      to: emails,
      subject: `Chargeback on ${campaignLabel}`,
      transactional: true,
      text: `Stripe dispute ${params.disputeId} (${params.reason ?? "unknown reason"}) on donation ${params.donationId}. Gross $${gross}, dispute fee $${fee}. Campaign balance has been reversed and may be negative.`,
      html: `<p>Stripe dispute <code>${params.disputeId}</code> (${params.reason ?? "unknown reason"}) on donation <code>${params.donationId}</code>.</p><p>Gross $${gross}. Dispute fee $${fee}. Campaign: ${campaignLabel}.</p><p>Campaign balance has been reversed and may be negative.</p>`,
    });
  } catch (error) {
    console.error("Failed to alert admins of chargeback:", error);
  }
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  console.log("Dispute created:", dispute.id, dispute.status);

  if (isInquiryDispute(dispute.status)) {
    console.log("Inquiry dispute; funds not withdrawn, skipping reversal:", dispute.id);
    return;
  }

  const donation = await resolveDonationForDispute(dispute);
  if (!donation) {
    console.error("Donation not found for dispute:", dispute.id);
    return;
  }

  const feeCents = stripeDisputeFeeCents(dispute);
  const applied = await applyChargeback(donation.id, {
    disputeId: dispute.id,
    feeCents,
  });

  if (!applied) {
    console.log("Chargeback not applied (donation not COMPLETED):", donation.id);
    return;
  }

  await alertBankAdmins({
    donationId: donation.id,
    campaignId: donation.campaignId,
    disputeId: dispute.id,
    reason: dispute.reason,
    feeCents,
    grossAmount: donation.grossAmount,
  });
}

async function handleDisputeClosed(dispute: Stripe.Dispute) {
  console.log("Dispute closed:", dispute.id, dispute.status);

  if (isInquiryDispute(dispute.status) || dispute.status === "warning_closed") {
    return;
  }

  const donation = await resolveDonationForDispute(dispute);
  if (!donation) {
    console.error("Donation not found for closed dispute:", dispute.id);
    return;
  }

  if (dispute.status === "won") {
    const restored = await reinstateChargeback(donation.id);
    if (!restored) {
      console.log("Chargeback reinstatement skipped:", donation.id);
    }
    return;
  }

  if (dispute.status === "lost") {
    const feeCents = stripeDisputeFeeCents(dispute);
    await applyChargeback(donation.id, {
      disputeId: dispute.id,
      feeCents,
    });
  }
}

async function handleDisputeFundsReinstated(dispute: Stripe.Dispute) {
  console.log("Dispute funds reinstated:", dispute.id);

  const donation = await resolveDonationForDispute(dispute);
  if (!donation) {
    console.error("Donation not found for funds_reinstated:", dispute.id);
    return;
  }

  const restored = await reinstateChargeback(donation.id);
  if (!restored) {
    console.log("Chargeback reinstatement skipped:", donation.id);
  }
}
