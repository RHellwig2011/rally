import { prisma } from "./prisma";
import {
  Prisma,
  TransactionType,
  DisbursementStatus,
  type BankingAccount,
  type Donation,
  type Transaction,
} from "@prisma/client";
import { completeDonation, runMoneyTransaction } from "./donations";

export interface ProcessDonationResult {
  donation: Donation;
  transaction: Transaction | null;
  bankingAccount: BankingAccount;
}

/**
 * True when `error` is the unique-index violation on Donation.paymentIntentId
 * (prisma/migrations/00000000000002_donation_payment_intent_unique). That index
 * is the real exclusion for concurrent webhook deliveries; the in-transaction
 * lookup below is only a fast path.
 */
function isDuplicatePaymentIntent(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(target)) return target.includes("paymentIntentId");
  if (typeof target === "string") return target.includes("paymentIntentId");
  // Some drivers omit meta.target. Donation's only other unique column is its
  // own cuid primary key, so a P2002 here is this index either way.
  return true;
}

/**
 * Calculate fee breakdown for a donation
 * @param grossAmount - Amount in cents (as BigInt or number)
 * @param platformFeePercent - Platform fee percentage (default 10%)
 */
export function calculateDonationFees(grossAmount: bigint | number, platformFeePercent: number = 10) {
  const amount = typeof grossAmount === 'bigint' ? grossAmount : BigInt(grossAmount);

  // Calculate platform fee (half-up rounding to match the canonical formula
  // in app/api/donations/route.ts: Math.round(gross * feePercent / 100))
  const feeBps = BigInt(Math.round(platformFeePercent * 100));
  const platformFee = (amount * feeBps + BigInt(5000)) / BigInt(10000);

  // Processing fee: 2.9% + $0.30, rounded (Math.round(gross * 0.029) + 30)
  const processingFee = (amount * BigInt(29) + BigInt(500)) / BigInt(1000) + BigInt(30);

  // Net amount after fees
  const netAmount = amount - platformFee - processingFee;

  return {
    grossAmount: amount,
    platformFee,
    processingFee,
    netAmount,
  };
}

/**
 * Process a donation and update campaign banking account
 */
export async function processDonation(params: {
  campaignId: string;
  donorId?: string;
  donorEmail: string;
  donorName?: string;
  donorMessage?: string;
  grossAmount: bigint | number;
  isAnonymous?: boolean;
  referralCode?: string;
  paymentIntentId?: string;
}): Promise<ProcessDonationResult> {
  const {
    campaignId,
    donorId,
    donorEmail,
    donorName,
    donorMessage,
    grossAmount: rawGrossAmount,
    isAnonymous = false,
    referralCode,
    paymentIntentId,
  } = params;

  // Convert to BigInt if needed
  const grossAmount = typeof rawGrossAmount === 'bigint' ? rawGrossAmount : BigInt(rawGrossAmount);

  // Get campaign and banking account
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { bankingAccount: true },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (!campaign.bankingAccount) {
    throw new Error("Banking account not set up for this campaign");
  }

  // Calculate fees
  const { platformFee, processingFee, netAmount } = calculateDonationFees(
    grossAmount,
    campaign.platformFeePercent
  );

  /**
   * Resolve a payment intent that already has a donation row instead of
   * inserting a second one.
   *
   * A PENDING row is the normal case: POST /api/donations recorded the donation
   * before the client confirmed payment, and this webhook fallback only ran
   * because the lookup upstream missed it (or lost a race with it). Completing
   * that row is what credits the campaign, and completeDonation's conditional
   * PENDING/FAILED -> COMPLETED claim makes the credit exactly-once even when
   * the verify endpoint is racing us. Anything already COMPLETED or REFUNDED is
   * returned untouched.
   */
  const settleExistingDonation = async (
    existing: Donation
  ): Promise<ProcessDonationResult> => {
    if (existing.status === "PENDING" || existing.status === "FAILED") {
      await completeDonation(existing.id);
    }

    const [donation, bankingAccount] = await Promise.all([
      prisma.donation.findUnique({ where: { id: existing.id } }),
      prisma.bankingAccount.findUnique({
        where: { id: campaign.bankingAccount!.id },
      }),
    ]);

    return {
      donation: donation ?? existing,
      transaction: null,
      bankingAccount: bankingAccount ?? campaign.bankingAccount!,
    };
  };

  // Fast path for a payment intent that was already recorded. Stripe redelivers
  // webhooks, so the same payment_intent.succeeded reaches this fallback more
  // than once. This read alone is NOT the guard — at ReadCommitted two
  // concurrent deliveries can both miss it — the unique index on
  // Donation.paymentIntentId is, and the P2002 catch below closes the window.
  if (paymentIntentId) {
    const alreadyRecorded = await prisma.donation.findFirst({
      where: { paymentIntentId },
    });

    if (alreadyRecorded) {
      return settleExistingDonation(alreadyRecorded);
    }
  }

  // runMoneyTransaction is the required wrapper for every money mutation: it
  // pins the isolation level and retries write conflicts. Its callback must be
  // replay-safe, which is why the balance changes below are all relative
  // increments and the insert is protected by a unique index rather than a
  // read-then-write check.
  const runInsert = () => runMoneyTransaction(async (tx) => {
    // Create donation record
    const donation = await tx.donation.create({
      data: {
        campaignId,
        donorId,
        donorEmail,
        donorName,
        donorMessage,
        grossAmount,
        platformFee,
        processingFee,
        netAmount,
        isAnonymous,
        referralCode,
        paymentIntentId,
        status: "COMPLETED",
        paymentProvider: paymentIntentId ? "STRIPE" : "SIMULATED",
      },
    });

    // Update banking account balances
    const updatedBankingAccount = await tx.bankingAccount.update({
      where: { id: campaign.bankingAccount!.id },
      data: {
        totalRaised: { increment: grossAmount },
        platformFeesCollected: { increment: platformFee },
        availableBalance: { increment: netAmount },
      },
    });

    // Create ledger transaction for deposit
    const transaction = await tx.transaction.create({
      data: {
        bankingAccountId: campaign.bankingAccount!.id,
        type: TransactionType.DEPOSIT,
        amount: netAmount,
        balanceAfter: updatedBankingAccount.availableBalance,
        donationId: donation.id,
        description: `Donation from ${donorName || donorEmail}`,
        ...(donorId && { createdBy: donorId }), // Only include if valid user ID
      },
    });

    // Create ledger transaction for fee collection
    await tx.transaction.create({
      data: {
        bankingAccountId: campaign.bankingAccount!.id,
        type: TransactionType.FEE_COLLECTION,
        amount: platformFee,
        balanceAfter: updatedBankingAccount.availableBalance,
        donationId: donation.id,
        description: `Platform fee (${campaign.platformFeePercent}%)`,
        // No createdBy for system-generated fee transactions
      },
    });

    // Update campaign current amount
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        currentAmount: { increment: grossAmount },
      },
    });

    // Update referral stats if applicable. Scoped to this campaign: referral
    // codes are not globally unique, so an unscoped match would credit another
    // campaign's referral row with this donation.
    if (referralCode) {
      await tx.referral.updateMany({
        where: { referralCode, campaignId },
        data: {
          donationCount: { increment: 1 },
          totalRaised: { increment: grossAmount },
        },
      });
    }

    return { donation, transaction, bankingAccount: updatedBankingAccount };
  });

  try {
    return await runInsert();
  } catch (error) {
    // A concurrent delivery (or the app's own PENDING row acquiring this
    // payment intent between the read above and this insert) won the unique
    // index. Credit nothing extra — settle against the row that won. The catch
    // is out here rather than inside the callback because a failed statement
    // aborts the Postgres transaction: no further query in it would run.
    if (paymentIntentId && isDuplicatePaymentIntent(error)) {
      const winner = await prisma.donation.findFirst({
        where: { paymentIntentId },
      });

      if (winner) {
        console.warn(
          `Duplicate donation insert for payment intent ${paymentIntentId}; settled against existing donation ${winner.id}`
        );
        return settleExistingDonation(winner);
      }
    }

    throw error;
  }
}

/**
 * Get banking account summary
 */
export async function getBankingAccountSummary(bankingAccountId: string) {
  const bankingAccount = await prisma.bankingAccount.findUnique({
    where: { id: bankingAccountId },
    include: {
      campaign: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      disbursementRequests: {
        where: {
          status: {
            in: [DisbursementStatus.PENDING, DisbursementStatus.APPROVED],
          },
        },
        orderBy: { requestedAt: "desc" },
      },
    },
  });

  if (!bankingAccount) {
    throw new Error("Banking account not found");
  }

  return bankingAccount;
}

/**
 * Get transaction history for a banking account
 */
export async function getTransactionHistory(params: {
  bankingAccountId: string;
  limit?: number;
  offset?: number;
}) {
  const { bankingAccountId, limit = 50, offset = 0 } = params;

  const transactions = await prisma.transaction.findMany({
    where: { bankingAccountId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      donation: true,
      disbursement: true,
      createdByUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  const total = await prisma.transaction.count({
    where: { bankingAccountId },
  });

  return {
    transactions,
    total,
    hasMore: offset + limit < total,
  };
}
