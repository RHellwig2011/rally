import prisma from "@/lib/prisma";
import { completeDonation } from "@/lib/donations";
import { retrievePaymentIntent } from "@/lib/stripe";

/** Default: 2 hours. Webhooks should have fired; 3DS still in-flight is skipped by status. */
export const PENDING_RECONCILE_MIN_AGE_MS = 2 * 60 * 60 * 1000;

const DEFAULT_LIMIT = 100;

export type PendingReconcileAction = "complete" | "expire" | "skip";

type PendingDonationRef = {
  paymentIntentId: string | null;
  paymentProvider: string;
};

/**
 * Decide what to do with one PENDING donation given Stripe's view of its PI.
 *
 * `pi`:
 *   - { status } after a successful retrieve
 *   - "missing" when the row never stored a paymentIntentId
 *   - null when retrieve failed — fail closed (do not expire; retry next run)
 */
export function pendingReconcileAction(
  donation: PendingDonationRef,
  pi: { status: string } | null | "missing"
): PendingReconcileAction {
  if (donation.paymentProvider === "SIMULATED") {
    return "skip";
  }

  if (pi === "missing") {
    return "expire";
  }

  if (pi === null) {
    return "skip";
  }

  if (pi.status === "succeeded") {
    return "complete";
  }

  if (pi.status === "canceled" || pi.status === "requires_payment_method") {
    return "expire";
  }

  return "skip";
}

export type ReconcilePendingResult = {
  scanned: number;
  completed: number;
  expired: number;
  skipped: number;
  errors: string[];
};

export async function reconcilePendingDonations(options?: {
  now?: Date;
  minAgeMs?: number;
  limit?: number;
}): Promise<ReconcilePendingResult> {
  const now = options?.now ?? new Date();
  const minAgeMs = options?.minAgeMs ?? PENDING_RECONCILE_MIN_AGE_MS;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const cutoff = new Date(now.getTime() - minAgeMs);

  const pending = await prisma.donation.findMany({
    where: {
      status: "PENDING",
      createdAt: { lte: cutoff },
    },
    select: {
      id: true,
      paymentIntentId: true,
      paymentProvider: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const result: ReconcilePendingResult = {
    scanned: pending.length,
    completed: 0,
    expired: 0,
    skipped: 0,
    errors: [],
  };

  for (const donation of pending) {
    try {
      let pi: { status: string } | null | "missing";

      if (!donation.paymentIntentId) {
        pi = "missing";
      } else if (donation.paymentProvider === "SIMULATED") {
        pi = null;
      } else {
        try {
          const retrieved = await retrievePaymentIntent(donation.paymentIntentId);
          pi = { status: retrieved.status };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "retrieve failed";
          result.errors.push(`${donation.id}: ${message}`);
          result.skipped += 1;
          continue;
        }
      }

      const action = pendingReconcileAction(donation, pi);

      if (action === "complete") {
        await completeDonation(donation.id);
        result.completed += 1;
      } else if (action === "expire") {
        await prisma.donation.updateMany({
          where: { id: donation.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
        result.expired += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      result.errors.push(`${donation.id}: ${message}`);
      result.skipped += 1;
    }
  }

  return result;
}
