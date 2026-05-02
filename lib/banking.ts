import { prisma } from "./prisma";
import { TransactionType, DisbursementStatus } from "@prisma/client";

/**
 * Calculate fee breakdown for a donation
 * @param grossAmount - Amount in cents (as BigInt or number)
 * @param platformFeePercent - Platform fee percentage (default 10%)
 */
export function calculateDonationFees(grossAmount: bigint | number, platformFeePercent: number = 10) {
  const amount = typeof grossAmount === 'bigint' ? grossAmount : BigInt(grossAmount);

  // Calculate platform fee
  const platformFee = (amount * BigInt(Math.round(platformFeePercent * 100))) / BigInt(10000);

  // Processing fee: 2.9% + $0.30
  const processingFee = (amount * BigInt(29)) / BigInt(1000) + BigInt(30);

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
}) {
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

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
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

    // Update referral stats if applicable
    if (referralCode) {
      await tx.referral.updateMany({
        where: { referralCode },
        data: {
          donationCount: { increment: 1 },
          totalRaised: { increment: grossAmount },
        },
      });
    }

    return { donation, transaction, bankingAccount: updatedBankingAccount };
  });

  return result;
}

/**
 * Create a disbursement request
 */
export async function createDisbursementRequest(params: {
  bankingAccountId: string;
  campaignId: string;
  requestedBy: string;
  requestedAmount: bigint | number;
  purpose: string;
  receiptsUrls?: string[];
}) {
  const { bankingAccountId, campaignId, requestedBy, requestedAmount: rawAmount, purpose, receiptsUrls = [] } = params;
  const requestedAmount = typeof rawAmount === 'bigint' ? rawAmount : BigInt(rawAmount);

  // Get banking account
  const bankingAccount = await prisma.bankingAccount.findUnique({
    where: { id: bankingAccountId },
  });

  if (!bankingAccount) {
    throw new Error("Banking account not found");
  }

  // Check if sufficient funds
  if (bankingAccount.availableBalance < requestedAmount) {
    throw new Error("Insufficient funds");
  }

  // Check if requires guardian approval
  const requiresApproval =
    bankingAccount.requiresGuardianApproval && requestedAmount >= bankingAccount.approvalThreshold;

  // Create disbursement request
  const disbursementRequest = await prisma.disbursementRequest.create({
    data: {
      bankingAccountId,
      campaignId,
      requestedBy,
      requestedAmount,
      purpose,
      receiptsUrls,
      status: requiresApproval ? DisbursementStatus.PENDING : DisbursementStatus.APPROVED,
    },
  });

  // Update pending disbursement amount
  await prisma.bankingAccount.update({
    where: { id: bankingAccountId },
    data: {
      pendingDisbursement: { increment: requestedAmount },
    },
  });

  return disbursementRequest;
}

/**
 * Approve a disbursement request
 */
export async function approveDisbursementRequest(params: {
  disbursementRequestId: string;
  approvedBy: string;
}) {
  const { disbursementRequestId, approvedBy } = params;

  const disbursementRequest = await prisma.disbursementRequest.update({
    where: { id: disbursementRequestId },
    data: {
      status: DisbursementStatus.APPROVED,
      approvedBy,
      approvedAt: new Date(),
    },
  });

  return disbursementRequest;
}

/**
 * Reject a disbursement request
 */
export async function rejectDisbursementRequest(params: {
  disbursementRequestId: string;
  approvedBy: string;
  rejectionReason: string;
}) {
  const { disbursementRequestId, approvedBy, rejectionReason } = params;

  const disbursementRequest = await prisma.disbursementRequest.findUnique({
    where: { id: disbursementRequestId },
  });

  if (!disbursementRequest) {
    throw new Error("Disbursement request not found");
  }

  // Use transaction to update both disbursement request and banking account
  await prisma.$transaction([
    prisma.disbursementRequest.update({
      where: { id: disbursementRequestId },
      data: {
        status: DisbursementStatus.REJECTED,
        approvedBy,
        approvedAt: new Date(),
        rejectionReason,
      },
    }),
    prisma.bankingAccount.update({
      where: { id: disbursementRequest.bankingAccountId },
      data: {
        pendingDisbursement: { decrement: disbursementRequest.requestedAmount },
      },
    }),
  ]);
}

/**
 * Process a disbursement (simulate payout)
 */
export async function processDisbursement(params: {
  disbursementRequestId: string;
  processedBy: string;
}) {
  const { disbursementRequestId, processedBy } = params;

  const disbursementRequest = await prisma.disbursementRequest.findUnique({
    where: { id: disbursementRequestId },
    include: { bankingAccount: true },
  });

  if (!disbursementRequest) {
    throw new Error("Disbursement request not found");
  }

  if (disbursementRequest.status !== DisbursementStatus.APPROVED) {
    throw new Error("Disbursement request must be approved first");
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Update banking account balances
    const updatedBankingAccount = await tx.bankingAccount.update({
      where: { id: disbursementRequest.bankingAccountId },
      data: {
        availableBalance: { decrement: disbursementRequest.requestedAmount },
        disbursedTotal: { increment: disbursementRequest.requestedAmount },
        pendingDisbursement: { decrement: disbursementRequest.requestedAmount },
      },
    });

    // Create ledger transaction
    const transaction = await tx.transaction.create({
      data: {
        bankingAccountId: disbursementRequest.bankingAccountId,
        type: TransactionType.DISBURSEMENT,
        amount: -disbursementRequest.requestedAmount, // Negative for disbursement
        balanceAfter: updatedBankingAccount.availableBalance,
        disbursementId: disbursementRequest.id,
        description: disbursementRequest.purpose,
        createdBy: processedBy,
      },
    });

    // Update disbursement request status
    const updated = await tx.disbursementRequest.update({
      where: { id: disbursementRequestId },
      data: {
        status: DisbursementStatus.COMPLETED,
        disbursementDate: new Date(),
        payoutTransactionId: transaction.id,
      },
    });

    return { disbursementRequest: updated, transaction, bankingAccount: updatedBankingAccount };
  });

  return result;
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
