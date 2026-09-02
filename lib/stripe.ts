import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

// Initialize Stripe with API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
});

/**
 * Calculate Stripe processing fee
 * Stripe charges 2.9% + $0.30 per transaction
 */
export function calculateStripeFee(amountInCents: bigint): bigint {
  const amount = Number(amountInCents);
  const percentageFee = Math.round(amount * 0.029); // 2.9%
  const fixedFee = 30; // $0.30 in cents
  return BigInt(percentageFee + fixedFee);
}

/**
 * Calculate platform fee (default 10%)
 */
export function calculatePlatformFee(
  amountInCents: bigint,
  platformFeePercent: number = 10
): bigint {
  const amount = Number(amountInCents);
  return BigInt(Math.round((amount * platformFeePercent) / 100));
}

/**
 * Calculate net amount going to campaign
 */
export function calculateNetAmount(
  grossAmount: bigint,
  platformFee: bigint,
  processingFee: bigint
): bigint {
  return grossAmount - platformFee - processingFee;
}

/**
 * Create a payment intent for a donation
 */
export async function createPaymentIntent({
  amount,
  campaignId,
  donorEmail,
  metadata = {},
  idempotencyKey,
}: {
  amount: number; // Amount in cents
  campaignId: string;
  donorEmail: string;
  metadata?: Record<string, string>;
  // Deterministic key derived from the PENDING donation row, so a retry after a
  // timeout reuses the original intent instead of leaving an orphaned one.
  idempotencyKey?: string;
}): Promise<Stripe.PaymentIntent> {
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: donorEmail,
      metadata: {
        campaignId,
        donorEmail,
        ...metadata,
      },
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );

  return paymentIntent;
}

/**
 * Retrieve a payment intent
 */
export async function retrievePaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Create a refund for a payment
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number // Optional partial refund amount in cents
): Promise<Stripe.Refund> {
  return await stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amount && { amount }),
  });
}

/**
 * Create a Stripe Connect account for a campaign
 */
export async function createConnectAccount({
  email,
  campaignId,
  organizationName,
}: {
  email: string;
  campaignId: string;
  organizationName: string;
}): Promise<Stripe.Account> {
  return await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'non_profit',
    metadata: {
      campaignId,
      organizationName,
    },
  });
}

/**
 * Create an account link for Stripe Connect onboarding
 */
export async function createAccountLink({
  accountId,
  refreshUrl,
  returnUrl,
}: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<Stripe.AccountLink> {
  return await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

/**
 * Create a payout/transfer to a Connect account
 */
export async function createPayout({
  accountId,
  amount,
  metadata = {},
  idempotencyKey,
}: {
  accountId: string;
  amount: number; // Amount in cents
  metadata?: Record<string, string>;
  // Deterministic key derived from the disbursement request, so a retry after a
  // timeout returns the original transfer instead of paying the team twice.
  idempotencyKey?: string;
}): Promise<Stripe.Transfer> {
  return await stripe.transfers.create(
    {
      amount,
      currency: 'usd',
      destination: accountId,
      metadata,
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );
}

/**
 * Verify webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
