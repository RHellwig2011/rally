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

/**
 * Atomically mark a COMPLETED donation REFUNDED and reverse its credits.
 * Returns the refunded donation, or null if it was not in COMPLETED state.
 */
export async function refundDonation(donationId: string) {
  return runMoneyTransaction(async (tx) => {
    const transitioned = await tx.donation.updateMany({
      where: { id: donationId, status: "COMPLETED" },
      data: { status: "REFUNDED" },
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
      data: { currentAmount: { decrement: donation.grossAmount } },
    });

    // Identical scoping to completeDonation so a refund always decrements the
    // exact row the original donation incremented.
    const teamMemberId = donation.teamMemberId || donation.referralCode;
    if (teamMemberId) {
      await tx.teamMember.updateMany({
        where: {
          id: teamMemberId,
          campaignId: donation.campaignId,
          deletedAt: null,
        },
        data: { amountRaised: { decrement: donation.grossAmount } },
      });
    }

    const bankingAccount = await tx.bankingAccount.findUnique({
      where: { campaignId: donation.campaignId },
    });

    if (bankingAccount) {
      const updated = await tx.bankingAccount.update({
        where: { id: bankingAccount.id },
        data: {
          totalRaised: { decrement: donation.grossAmount },
          availableBalance: { decrement: donation.netAmount },
          platformFeesCollected: { decrement: donation.platformFee },
        },
      });

      await tx.transaction.create({
        data: {
          bankingAccountId: bankingAccount.id,
          type: "REFUND",
          amount: -donation.netAmount,
          balanceAfter: updated.availableBalance,
          donationId: donation.id,
          description: `Refund for donation ${donation.id}`,
          // System-generated: no createdBy user (FK to User.id)
        },
      });

      // Reverse the platform fee in the ledger so FEE_COLLECTION totals
      // reconcile with bankingAccount.platformFeesCollected.
      await tx.transaction.create({
        data: {
          bankingAccountId: bankingAccount.id,
          type: "FEE_COLLECTION",
          amount: -donation.platformFee,
          balanceAfter: updated.availableBalance,
          donationId: donation.id,
          description: `Platform fee reversal for refunded donation ${donation.id}`,
        },
      });
    }

    return donation;
  });
}
