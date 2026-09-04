import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Isolation level for the money paths.
 *
 * These transactions ran at Serializable, which was both unnecessary and
 * actively harmful: every donation to a campaign updates that campaign's single
 * Campaign and BankingAccount row, so concurrent donors constantly tripped
 * write-conflict aborts (Postgres SQLSTATE 40001, surfaced by Prisma as P2034).
 * Nothing retried them, so a donor whose card Stripe had already charged got an
 * HTTP 500 and a donation stranded in PENDING.
 *
 * ReadCommitted is sufficient here because none of these transactions make a
 * decision from a value they read and later write back — the pattern that
 * actually needs Serializable. Instead:
 *   - the state change is claimed with a conditional
 *     `updateMany({ where: { id, status: <expected> } })`, which Postgres
 *     evaluates against the locked row, so exactly one caller can win it; and
 *   - every balance change is a relative increment/decrement applied by the
 *     database, so concurrent updates compose instead of overwriting.
 * Both are already race-free at ReadCommitted.
 */
const MONEY_ISOLATION_LEVEL = Prisma.TransactionIsolationLevel.ReadCommitted;

// P2034 is Prisma's "write conflict or deadlock"; 40001 (serialization failure)
// and 40P01 (deadlock detected) are the underlying Postgres SQLSTATEs.
const RETRYABLE_CODES = new Set(["P2034", "40001", "40P01"]);

function isRetryableConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (RETRYABLE_CODES.has(error.code)) return true;
    // Postgres' own SQLSTATE is passed through in meta.code for raw/driver errors.
    const metaCode = (error.meta as { code?: unknown } | undefined)?.code;
    if (typeof metaCode === "string" && RETRYABLE_CODES.has(metaCode)) {
      return true;
    }
  }
  return false;
}

const MAX_TRANSACTION_ATTEMPTS = 5;

/**
 * Run `fn` as a money transaction: ReadCommitted (see above), retrying the
 * deadlocks that row-lock contention can still produce. Backoff is jittered so
 * that contending writers do not retry in lockstep.
 *
 * `fn` MUST be safe to replay — a conflicting attempt commits nothing, but it
 * may be executed more than once. The conditional-claim plus relative-increment
 * pattern described above is what makes that true.
 */
export async function runMoneyTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: MONEY_ISOLATION_LEVEL,
      });
    } catch (error) {
      if (!isRetryableConflict(error)) {
        throw error;
      }
      lastError = error;

      if (attempt < MAX_TRANSACTION_ATTEMPTS - 1) {
        // Exponential backoff with jitter: ~10-20ms, 20-40ms, 40-80ms, 80-160ms.
        const backoffMs = 10 * 2 ** attempt * (1 + Math.random());
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError;
}

/**
 * Atomically mark a donation COMPLETED and credit the campaign, team member,
 * and banking account. Safe to call concurrently (client verify + Stripe
 * webhook): the conditional updateMany guarantees only the first caller
 * applies the credits.
 *
 * Returns the completed donation, or null if it was already completed (or
 * does not exist).
 *
 * FAILED is an accepted starting state alongside PENDING. Stripe does not
 * order webhook deliveries, so a `payment_intent.payment_failed` for an
 * earlier attempt can land after the `payment_intent.succeeded` that actually
 * collected the money; claiming only PENDING would strand that real payment as
 * FAILED with no credits. Recovering from FAILED is still exactly-once — the
 * conditional claim can only be won by one caller, and COMPLETED and REFUNDED
 * are deliberately excluded so credits are never applied twice.
 *
 * A FAILED row is additionally checked for an existing DEPOSIT ledger entry
 * before it is claimed. Before handlePaymentFailed used a conditional claim, an
 * out-of-order `payment_intent.payment_failed` could flip an already-COMPLETED
 * donation to FAILED *without* reversing its credits. Those legacy rows are
 * already counted in Campaign.currentAmount and the banking balances, so
 * completing them again would double-credit; the DEPOSIT row is the durable
 * evidence that the credits were applied, and its presence makes this a no-op.
 */
export async function completeDonation(
  donationId: string,
  options: { paymentMethodLast4?: string | null } = {}
) {
  return runMoneyTransaction(async (tx) => {
    // Legacy-double-credit guard, checked before the claim. Only FAILED rows
    // can carry credits already (a PENDING donation has never been credited),
    // so this costs one indexed lookup on the recovery path and nothing on the
    // normal one. A donation whose DEPOSIT row exists has already moved money
    // into the banking account; treat it as already completed.
    const current = await tx.donation.findUnique({
      where: { id: donationId },
      select: { status: true },
    });

    if (current?.status === "FAILED") {
      const priorDeposit = await tx.transaction.findFirst({
        where: { donationId, type: "DEPOSIT" },
        select: { id: true },
      });

      if (priorDeposit) {
        console.error(
          `Donation ${donationId} is FAILED but already has a DEPOSIT ledger row; ` +
            `refusing to credit it a second time. Reconcile this row by hand.`
        );
        return null;
      }
    }

    // Conditional update is the concurrency guard: only one caller ever
    // transitions PENDING/FAILED -> COMPLETED and applies the balance credits.
    const transitioned = await tx.donation.updateMany({
      where: { id: donationId, status: { in: ["PENDING", "FAILED"] } },
      data: {
        status: "COMPLETED",
        ...(options.paymentMethodLast4 && {
          paymentMethodLast4: options.paymentMethodLast4,
        }),
      },
    });

    if (transitioned.count === 0) {
      return null;
    }

    const donation = await tx.donation.findUnique({
      where: { id: donationId },
    });
    if (!donation) return null;

    await tx.campaign.update({
      where: { id: donation.campaignId },
      data: { currentAmount: { increment: donation.grossAmount } },
    });

    // Credit the supported team member. teamMemberId is authoritative;
    // referralCode is only consulted for legacy records that stored a team
    // member id there. Either way the lookup is scoped to this donation's own
    // campaign (and to a live member), so a caller-supplied value can never
    // credit a player on a different campaign. Mirrors the read-side scoping in
    // app/api/team-members/[teamMemberId]/public/route.ts.
    const teamMemberId = donation.teamMemberId || donation.referralCode;
    if (teamMemberId) {
      await tx.teamMember.updateMany({
        where: {
          id: teamMemberId,
          campaignId: donation.campaignId,
          deletedAt: null,
        },
        data: { amountRaised: { increment: donation.grossAmount } },
      });
    }

    const bankingAccount = await tx.bankingAccount.findUnique({
      where: { campaignId: donation.campaignId },
      select: { id: true },
    });

    if (bankingAccount) {
      const updatedAccount = await tx.bankingAccount.update({
        where: { id: bankingAccount.id },
        data: {
          totalRaised: { increment: donation.grossAmount },
          availableBalance: { increment: donation.netAmount },
          platformFeesCollected: { increment: donation.platformFee },
        },
      });

      // Ledger rows, mirroring lib/banking.ts processDonation, so the admin
      // transaction ledger reconciles with the account balances.
      await tx.transaction.create({
        data: {
          bankingAccountId: bankingAccount.id,
          type: "DEPOSIT",
          amount: donation.netAmount,
          balanceAfter: updatedAccount.availableBalance,
          donationId: donation.id,
          description: `Donation from ${donation.isAnonymous ? "Anonymous" : donation.donorName || donation.donorEmail}`,
          ...(donation.donorId && { createdBy: donation.donorId }),
        },
      });

      await tx.transaction.create({
        data: {
          bankingAccountId: bankingAccount.id,
          type: "FEE_COLLECTION",
          amount: donation.platformFee,
          balanceAfter: updatedAccount.availableBalance,
          donationId: donation.id,
          description: "Platform fee",
          // No createdBy for system-generated fee transactions
        },
      });
    }

    return donation;
  });
}

function allocatedShare(
  total: bigint,
  refundedGross: bigint,
  gross: bigint
): bigint {
  const zero = BigInt(0);
  if (gross <= zero) return zero;
  if (refundedGross <= zero) return zero;
  if (refundedGross >= gross) return total;
  return (total * refundedGross) / gross;
}

function remainingCredits(donation: {
  grossAmount: bigint;
  netAmount: bigint;
  platformFee: bigint;
  refundedAmount: bigint;
}) {
  const prev = donation.refundedAmount;
  const gross = donation.grossAmount;
  return {
    gross: allocatedShare(gross, gross, gross) - allocatedShare(gross, prev, gross),
    net:
      donation.netAmount - allocatedShare(donation.netAmount, prev, gross),
    platformFee:
      donation.platformFee - allocatedShare(donation.platformFee, prev, gross),
  };
}

/**
 * Map Stripe charge.amount_refunded (against charge.amount, which is larger
 * than donation.grossAmount when the donor covered processing fees) onto
 * donation.grossAmount cents.
 */
export function chargeRefundToGross(
  amountRefunded: bigint,
  chargeAmount: bigint,
  grossAmount: bigint
): bigint {
  const zero = BigInt(0);
  if (chargeAmount <= zero) return zero;
  if (amountRefunded >= chargeAmount) return grossAmount;
  if (amountRefunded <= zero) return zero;
  return (grossAmount * amountRefunded) / chargeAmount;
}

/**
 * Apply a cumulative refund of `refundedGrossCents` against donation.grossAmount.
 * Stripe redelivers charge.refunded with a running total; we reverse only the
 * delta since donation.refundedAmount. Full refund (target >= gross) claims
 * COMPLETED → REFUNDED. Partial refunds stay COMPLETED.
 *
 * Omitting refundedGrossCents refunds the remainder in full (refundDonation).
 */
export async function applyRefund(
  donationId: string,
  refundedGrossCents?: bigint
) {
  return runMoneyTransaction(async (tx) => {
    const current = await tx.donation.findUnique({
      where: { id: donationId },
    });
    if (!current) return null;

    const zero = BigInt(0);
    const gross = current.grossAmount;
    let target =
      refundedGrossCents === undefined ? gross : refundedGrossCents;
    if (target < zero) target = zero;
    if (target > gross) target = gross;

    if (current.status === "REFUNDED") {
      return current.refundedAmount >= target ? current : null;
    }
    if (current.status !== "COMPLETED") {
      return null;
    }

    const prev = current.refundedAmount;
    if (target <= prev) {
      return current;
    }

    const fully = target >= gross;
    const transitioned = await tx.donation.updateMany({
      where: {
        id: donationId,
        status: "COMPLETED",
        refundedAmount: prev,
      },
      data: {
        refundedAmount: target,
        status: fully ? "REFUNDED" : "COMPLETED",
      },
    });

    if (transitioned.count === 0) {
      const again = await tx.donation.findUnique({
        where: { id: donationId },
      });
      if (again && again.refundedAmount >= target) {
        return again;
      }
      throw new Error(`Refund claim lost for donation ${donationId}`);
    }

    const donation = await tx.donation.findUnique({
      where: { id: donationId },
    });
    if (!donation) return null;

    const grossDelta =
      allocatedShare(gross, target, gross) -
      allocatedShare(gross, prev, gross);
    const netDelta =
      allocatedShare(current.netAmount, target, gross) -
      allocatedShare(current.netAmount, prev, gross);
    const feeDelta =
      allocatedShare(current.platformFee, target, gross) -
      allocatedShare(current.platformFee, prev, gross);

    await tx.campaign.update({
      where: { id: donation.campaignId },
      data: { currentAmount: { decrement: grossDelta } },
    });

    const teamMemberId = donation.teamMemberId || donation.referralCode;
    if (teamMemberId) {
      await tx.teamMember.updateMany({
        where: {
          id: teamMemberId,
          campaignId: donation.campaignId,
          deletedAt: null,
        },
        data: { amountRaised: { decrement: grossDelta } },
      });
    }

    const bankingAccount = await tx.bankingAccount.findUnique({
      where: { campaignId: donation.campaignId },
    });

    if (bankingAccount) {
      const updated = await tx.bankingAccount.update({
        where: { id: bankingAccount.id },
        data: {
          totalRaised: { decrement: grossDelta },
          availableBalance: { decrement: netDelta },
          platformFeesCollected: { decrement: feeDelta },
        },
      });

      await tx.transaction.create({
        data: {
          bankingAccountId: bankingAccount.id,
          type: "REFUND",
          amount: -netDelta,
          balanceAfter: updated.availableBalance,
          donationId: donation.id,
          description: fully
            ? `Refund for donation ${donation.id}`
            : `Partial refund (${target} of ${gross} cents) for donation ${donation.id}`,
        },
      });

      await tx.transaction.create({
        data: {
          bankingAccountId: bankingAccount.id,
          type: "FEE_COLLECTION",
          amount: -feeDelta,
          balanceAfter: updated.availableBalance,
          donationId: donation.id,
          description: `Platform fee reversal for refunded donation ${donation.id}`,
        },
      });
    }

    return donation;
  });
}

/** Full refund — wrapper around applyRefund for existing callers. */
export async function refundDonation(donationId: string) {
  return applyRefund(donationId);
}

type StripeDisputeFeeSource = {
  balance_transactions?: Array<string | { fee?: number | null } | null> | null;
};

/**
 * Stripe's dispute fee in cents from expanded `balance_transactions`.
 * Unexpanded id strings and missing fees return 0 — we do not guess $15.
 */
export function stripeDisputeFeeCents(dispute: StripeDisputeFeeSource): bigint {
  const txs = dispute.balance_transactions;
  if (!Array.isArray(txs)) return BigInt(0);

  let fee = BigInt(0);
  for (const entry of txs) {
    if (!entry || typeof entry === "string") continue;
    if (typeof entry.fee === "number" && Number.isFinite(entry.fee) && entry.fee > 0) {
      fee += BigInt(Math.trunc(entry.fee));
    }
  }
  return fee;
}

/**
 * Atomically mark a COMPLETED donation DISPUTED and reverse its credits,
 * plus Stripe's dispute fee. Idempotent for the same disputeId.
 *
 * availableBalance is allowed to go negative — the campaign may already have
 * disbursed the funds. BANK_ADMIN alerting lives in the webhook, not here.
 */
export async function applyChargeback(
  donationId: string,
  options: { disputeId: string; feeCents: bigint }
) {
  const zero = BigInt(0);
  const feeCents = options.feeCents > zero ? options.feeCents : zero;

  return runMoneyTransaction(async (tx) => {
    const transitioned = await tx.donation.updateMany({
      where: { id: donationId, status: "COMPLETED" },
      data: {
        status: "DISPUTED",
        disputeId: options.disputeId,
        disputedAt: new Date(),
        disputeFee: feeCents,
      },
    });

    if (transitioned.count === 0) {
      const existing = await tx.donation.findUnique({
        where: { id: donationId },
      });
      if (
        existing?.status === "DISPUTED" &&
        existing.disputeId === options.disputeId
      ) {
        return existing;
      }
      return null;
    }

    const donation = await tx.donation.findUnique({
      where: { id: donationId },
    });
    if (!donation) return null;

    const remaining = remainingCredits(donation);

    await tx.campaign.update({
      where: { id: donation.campaignId },
      data: { currentAmount: { decrement: remaining.gross } },
    });

    const teamMemberId = donation.teamMemberId || donation.referralCode;
    if (teamMemberId) {
      await tx.teamMember.updateMany({
        where: {
          id: teamMemberId,
          campaignId: donation.campaignId,
          deletedAt: null,
        },
        data: { amountRaised: { decrement: remaining.gross } },
      });
    }

    const bankingAccount = await tx.bankingAccount.findUnique({
      where: { campaignId: donation.campaignId },
    });

    if (bankingAccount) {
      const updated = await tx.bankingAccount.update({
        where: { id: bankingAccount.id },
        data: {
          totalRaised: { decrement: remaining.gross },
          availableBalance: { decrement: remaining.net + feeCents },
          platformFeesCollected: { decrement: remaining.platformFee },
        },
      });

      await tx.transaction.create({
        data: {
          bankingAccountId: bankingAccount.id,
          type: "CHARGEBACK",
          amount: -remaining.net,
          balanceAfter: updated.availableBalance,
          donationId: donation.id,
          description: `Chargeback ${options.disputeId} for donation ${donation.id}`,
        },
      });

      await tx.transaction.create({
        data: {
          bankingAccountId: bankingAccount.id,
          type: "FEE_COLLECTION",
          amount: -remaining.platformFee,
          balanceAfter: updated.availableBalance,
          donationId: donation.id,
          description: `Platform fee reversal for disputed donation ${donation.id}`,
        },
      });

      if (feeCents > BigInt(0)) {
        await tx.transaction.create({
          data: {
            bankingAccountId: bankingAccount.id,
            type: "ADJUSTMENT",
            amount: -feeCents,
            balanceAfter: updated.availableBalance,
            donationId: donation.id,
            description: `Stripe dispute fee for ${options.disputeId}`,
          },
        });
      }
    }

    return donation;
  });
}

/**
 * Atomically restore a DISPUTED donation to COMPLETED (merchant won / funds
 * reinstated) and reverse the chargeback ledger. Idempotent: a second delivery
 * finds COMPLETED and is a no-op.
 */
export async function reinstateChargeback(donationId: string) {
  return runMoneyTransaction(async (tx) => {
    const transitioned = await tx.donation.updateMany({
      where: { id: donationId, status: "DISPUTED" },
      data: { status: "COMPLETED" },
    });

    if (transitioned.count === 0) {
      return null;
    }

    const donation = await tx.donation.findUnique({
      where: { id: donationId },
    });
    if (!donation) return null;

    const feeCents =
      donation.disputeFee > BigInt(0) ? donation.disputeFee : BigInt(0);
    const remaining = remainingCredits(donation);

    await tx.campaign.update({
      where: { id: donation.campaignId },
      data: { currentAmount: { increment: remaining.gross } },
    });

    const teamMemberId = donation.teamMemberId || donation.referralCode;
    if (teamMemberId) {
      await tx.teamMember.updateMany({
        where: {
          id: teamMemberId,
          campaignId: donation.campaignId,
          deletedAt: null,
        },
        data: { amountRaised: { increment: remaining.gross } },
      });
    }

    const bankingAccount = await tx.bankingAccount.findUnique({
      where: { campaignId: donation.campaignId },
    });

    if (bankingAccount) {
      const updated = await tx.bankingAccount.update({
        where: { id: bankingAccount.id },
        data: {
          totalRaised: { increment: remaining.gross },
          availableBalance: { increment: remaining.net + feeCents },
          platformFeesCollected: { increment: remaining.platformFee },
        },
      });

      await tx.transaction.create({
        data: {
          bankingAccountId: bankingAccount.id,
          type: "CHARGEBACK",
          amount: remaining.net,
          balanceAfter: updated.availableBalance,
          donationId: donation.id,
          description: `Chargeback reversal for donation ${donation.id}`,
        },
      });

      await tx.transaction.create({
        data: {
          bankingAccountId: bankingAccount.id,
          type: "FEE_COLLECTION",
          amount: remaining.platformFee,
          balanceAfter: updated.availableBalance,
          donationId: donation.id,
          description: "Platform fee",
        },
      });

      if (feeCents > BigInt(0)) {
        await tx.transaction.create({
          data: {
            bankingAccountId: bankingAccount.id,
            type: "ADJUSTMENT",
            amount: feeCents,
            balanceAfter: updated.availableBalance,
            donationId: donation.id,
            description: `Stripe dispute fee reversal for ${donation.disputeId ?? donation.id}`,
          },
        });
      }
    }

    return donation;
  });
}
