import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPayout } from "@/lib/stripe";
import { verifyAuth } from "@/lib/requireAuth";
import prisma from "@/lib/prisma";
import { checkCsrf } from "@/lib/csrf";
import { runMoneyTransaction } from "@/lib/donations";

const payoutSchema = z.object({
  disbursementRequestId: z.string().min(1, "Disbursement request ID is required"),
});

// Sentinel distinguishing the in-transaction funds guard (a 400) from a genuine
// server fault (a 500) once the throw has unwound to the catch block.
const INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS";

/**
 * Stripe error types that mean the transfer definitively did NOT happen: the
 * request was rejected before any money moved, so the books must be put back.
 * Everything else — StripeConnectionError, StripeAPIError, a socket timeout, an
 * error thrown by something other than the SDK — is AMBIGUOUS: Stripe may have
 * accepted the transfer and only the response was lost. Reversing the debit on
 * an ambiguous error is the dangerous case, because the funds reappear as
 * available while Stripe has already paid them out, and a concurrent
 * disbursement can then spend money that is gone.
 */
const DEFINITE_STRIPE_FAILURE_TYPES = new Set([
  "StripeCardError",
  "StripeInvalidRequestError",
  "StripeAuthenticationError",
  "StripePermissionError",
  "StripeRateLimitError",
]);

function isDefiniteStripeFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { type, code } = error as { type?: unknown; code?: unknown };
  if (typeof type !== "string" || !DEFINITE_STRIPE_FAILURE_TYPES.has(type)) {
    return false;
  }
  // An invalid-request error without a code is not necessarily a clean
  // rejection (the SDK also surfaces some transport problems this way), so
  // require Stripe to have named the failure.
  if (type === "StripeInvalidRequestError" && typeof code !== "string") {
    return false;
  }
  return true;
}

/**
 * POST /api/stripe-connect/payout
 * Create a payout to a campaign's Stripe Connect account (ADMIN or BANK_ADMIN).
 *
 * This is the only route that moves money out of a banking account, and the
 * only writer that may set a disbursement to COMPLETED — which it does together
 * with the Stripe transfer id, so a COMPLETED row always evidences a real
 * transfer. Called after PUT /api/admin/disbursements/[requestId]/approve has
 * moved the request to APPROVED.
 */
export async function POST(req: NextRequest) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Verify authentication (throws if not authenticated)
    const user = await verifyAuth(req);

    // Same rule as the approve/reject routes that feed this one: platform
    // admins and banking admins can process payouts.
    if (user.role !== "BANK_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Only banking admins can process payouts" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { disbursementRequestId } = payoutSchema.parse(body);

    // Get the disbursement request
    const disbursementRequest = await prisma.disbursementRequest.findUnique({
      where: { id: disbursementRequestId },
      include: {
        bankingAccount: {
          include: {
            campaign: true,
          },
        },
      },
    });

    if (!disbursementRequest) {
      return NextResponse.json(
        { success: false, error: "Disbursement request not found" },
        { status: 404 }
      );
    }

    // Verify disbursement is approved
    if (disbursementRequest.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: "Disbursement request must be approved first" },
        { status: 400 }
      );
    }

    // Verify Stripe Connect account exists
    const stripeAccountId = disbursementRequest.bankingAccount.stripeConnectAccountId;
    if (!stripeAccountId) {
      return NextResponse.json(
        { success: false, error: "Campaign has not set up payout account" },
        { status: 400 }
      );
    }

    // Verify sufficient balance
    if (disbursementRequest.bankingAccount.availableBalance < disbursementRequest.requestedAmount) {
      return NextResponse.json(
        { success: false, error: "Insufficient balance for payout" },
        { status: 400 }
      );
    }

    // Step 1 — claim the request AND debit the funds before calling Stripe, in
    // one atomic step. Claiming first means two concurrent payout calls can
    // never both create a transfer (only one wins APPROVED -> PROCESSING), and
    // debiting first means the authoritative balance check happens under the
    // same lock, so two payouts on one account cannot overdraw it. Doing the
    // debit afterwards could only detect an overdraft once the money was
    // already gone.
    const claim = await runMoneyTransaction(async (tx) => {
      const claimed = await tx.disbursementRequest.updateMany({
        where: { id: disbursementRequest.id, status: "APPROVED" },
        data: { status: "PROCESSING" },
      });

      if (claimed.count === 0) {
        return null;
      }

      const account = await tx.bankingAccount.update({
        where: { id: disbursementRequest.bankingAccountId },
        data: {
          availableBalance: {
            decrement: disbursementRequest.requestedAmount,
          },
          disbursedTotal: {
            increment: disbursementRequest.requestedAmount,
          },
          pendingDisbursement: {
            decrement: disbursementRequest.requestedAmount,
          },
        },
      });

      // A throw here rolls back both the claim and the balance changes.
      if (account.availableBalance < BigInt(0)) {
        throw new Error(INSUFFICIENT_FUNDS);
      }

      return { balanceAfter: account.availableBalance };
    });

    if (!claim) {
      return NextResponse.json(
        { success: false, error: "Disbursement request was already processed" },
        { status: 409 }
      );
    }

    // Step 2 — create the payout via Stripe. On a definite rejection, release
    // the claim and give the funds back, leaving the request APPROVED and
    // retryable. On an ambiguous error the debit STAYS, because the transfer
    // may well have happened.
    let transfer;
    try {
      transfer = await createPayout({
        accountId: stripeAccountId,
        amount: Number(disbursementRequest.requestedAmount),
        // The disbursement request is the natural key: at most one transfer
        // ever belongs to it. If this call times out and the settle step or an
        // operator retries, Stripe replays the original transfer rather than
        // sending the money a second time.
        idempotencyKey: `disbursement-${disbursementRequest.id}`,
        metadata: {
          disbursementRequestId: disbursementRequest.id,
          campaignId: disbursementRequest.bankingAccount.campaign.id,
          purpose: disbursementRequest.purpose,
        },
      });
    } catch (stripeError) {
      if (!isDefiniteStripeFailure(stripeError)) {
        // Ambiguous: a timeout or connection error can arrive after Stripe has
        // already accepted the transfer. Crediting availableBalance back here
        // would show money the team may no longer have, and a second
        // disbursement could reserve it. Leave the row PROCESSING and the debit
        // in place; the idempotency key means a deliberate retry replays the
        // original transfer rather than paying twice, but a human has to
        // confirm at Stripe which happened first.
        console.error(
          `Payout for disbursement ${disbursementRequest.id} failed ambiguously; ` +
            `funds stay debited and the request stays PROCESSING. Check Stripe for a transfer with ` +
            `idempotency key disbursement-${disbursementRequest.id} and reconcile before retrying:`,
          stripeError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Payout could not be confirmed with Stripe and is left pending. " +
              "The funds stay debited; reconcile this disbursement before retrying.",
            disbursementRequestId: disbursementRequest.id,
            status: "PROCESSING",
          },
          { status: 502 }
        );
      }

      // Definite rejection — Stripe never created a transfer, so put the books
      // back and make the request retryable.
      await runMoneyTransaction(async (tx) => {
        const released = await tx.disbursementRequest.updateMany({
          where: { id: disbursementRequest.id, status: "PROCESSING" },
          data: { status: "APPROVED" },
        });

        if (released.count === 0) {
          return;
        }

        await tx.bankingAccount.update({
          where: { id: disbursementRequest.bankingAccountId },
          data: {
            availableBalance: {
              increment: disbursementRequest.requestedAmount,
            },
            disbursedTotal: {
              decrement: disbursementRequest.requestedAmount,
            },
            pendingDisbursement: {
              increment: disbursementRequest.requestedAmount,
            },
          },
        });
      });
      throw stripeError;
    }

    // Invariant: a disbursement is only ever marked COMPLETED alongside the id
    // of a transfer that actually happened. Without one the request stays
    // PROCESSING for manual reconciliation rather than claiming a phantom
    // payment.
    if (!transfer?.id) {
      console.error(
        `Stripe returned no transfer id for disbursement ${disbursementRequest.id}; left PROCESSING for reconciliation`
      );
      return NextResponse.json(
        { success: false, error: "Payout could not be confirmed" },
        { status: 502 }
      );
    }

    // Step 3 — settle the claim and write the ledger row. The money has already
    // moved at Stripe, so this is recorded even if it takes a retry; the
    // transfer id is logged if it ultimately fails so the row can be
    // reconciled by hand.
    try {
      await runMoneyTransaction(async (tx) => {
        const settled = await tx.disbursementRequest.updateMany({
          where: { id: disbursementRequest.id, status: "PROCESSING" },
          data: {
            status: "COMPLETED",
            disbursementDate: new Date(),
            payoutTransactionId: transfer.id,
          },
        });

        // We hold the exclusive PROCESSING claim, so losing it means something
        // else moved the row out from under us — do not write a ledger entry
        // against a state we no longer own.
        if (settled.count === 0) {
          throw new Error("Disbursement left PROCESSING before the payout was recorded");
        }

        await tx.transaction.create({
          data: {
            bankingAccountId: disbursementRequest.bankingAccountId,
            type: "DISBURSEMENT",
            amount: -disbursementRequest.requestedAmount,
            balanceAfter: claim.balanceAfter,
            disbursementId: disbursementRequest.id,
            description: `Disbursement: ${disbursementRequest.purpose}`,
            createdBy: user.id,
            metadata: {
              stripeTransferId: transfer.id,
            },
          },
        });
      });
    } catch (settleError) {
      console.error(
        `Stripe transfer ${transfer.id} succeeded for disbursement ${disbursementRequest.id} but recording it failed; reconcile manually:`,
        settleError
      );
      return NextResponse.json(
        {
          success: false,
          error: "Payout was sent but could not be recorded. Contact support before retrying.",
          transferId: transfer.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Payout created successfully",
        transferId: transfer.id,
      },
      { status: 200 }
    );
  } catch (error) {
    // verifyAuth throws a NextResponse (401) on auth failure — pass it through
    if (error instanceof NextResponse) {
      return error;
    }
    console.error("Failed to create payout:", error);

    // The in-transaction funds guard is an expected business failure, not a
    // server fault.
    if (error instanceof Error && error.message === INSUFFICIENT_FUNDS) {
      return NextResponse.json(
        { success: false, error: "Insufficient balance for payout" },
        { status: 400 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to create payout" },
      { status: 500 }
    );
  }
}
