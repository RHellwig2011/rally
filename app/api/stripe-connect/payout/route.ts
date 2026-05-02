import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPayout } from "@/lib/stripe";
import { verifyAuth } from "@/lib/requireAuth";
import prisma from "@/lib/prisma";

const payoutSchema = z.object({
  disbursementRequestId: z.string().min(1, "Disbursement request ID is required"),
});

/**
 * POST /api/stripe-connect/payout
 * Create a payout to a campaign's Stripe Connect account
 * This should be called by bank admins after approving a disbursement
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication (throws if not authenticated)
    const user = await verifyAuth(req);

    // Only BANK_ADMIN can create payouts
    if (user.role !== "BANK_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Only bank admins can process payouts" },
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

    // Create the payout via Stripe
    const transfer = await createPayout({
      accountId: stripeAccountId,
      amount: Number(disbursementRequest.requestedAmount),
      metadata: {
        disbursementRequestId: disbursementRequest.id,
        campaignId: disbursementRequest.bankingAccount.campaign.id,
        purpose: disbursementRequest.purpose,
      },
    });

    // Update disbursement request
    await prisma.disbursementRequest.update({
      where: { id: disbursementRequest.id },
      data: {
        status: "COMPLETED",
        disbursementDate: new Date(),
        payoutTransactionId: transfer.id,
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        bankingAccountId: disbursementRequest.bankingAccountId,
        type: "DISBURSEMENT",
        amount: -disbursementRequest.requestedAmount,
        balanceAfter: disbursementRequest.bankingAccount.availableBalance - disbursementRequest.requestedAmount,
        disbursementId: disbursementRequest.id,
        description: `Disbursement: ${disbursementRequest.purpose}`,
        createdBy: user.id,
        metadata: {
          stripeTransferId: transfer.id,
        },
      },
    });

    // Update banking account balance
    await prisma.bankingAccount.update({
      where: { id: disbursementRequest.bankingAccountId },
      data: {
        availableBalance: {
          decrement: disbursementRequest.requestedAmount,
        },
        disbursedTotal: {
          increment: disbursementRequest.requestedAmount,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Payout created successfully",
        transferId: transfer.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to create payout:", error);

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
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create payout",
      },
      { status: 500 }
    );
  }
}
