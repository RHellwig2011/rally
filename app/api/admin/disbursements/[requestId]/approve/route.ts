import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { checkCsrf } from "@/lib/csrf";

const approveSchema = z.object({
  notes: z.string().optional(),
});

/**
 * PUT /api/admin/disbursements/[requestId]/approve
 * Approve a disbursement request (ADMIN or BANK_ADMIN).
 *
 * Approval is a decision, not a payment: it only moves the request
 * PENDING -> APPROVED and never touches account balances. The money leaves via
 * POST /api/stripe-connect/payout, which is the single place that talks to
 * Stripe, and which is the only writer allowed to set status COMPLETED (it does
 * so together with the payout transaction id). Keeping the two steps separate
 * is what stops the ledger from claiming a team was paid when nothing was
 * actually transferred.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Authentication check
    const sessionToken = req.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check authorization - only BANK_ADMIN or ADMIN
    if (user.role !== 'BANK_ADMIN' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: "Only banking admins can approve disbursements" },
        { status: 403 }
      );
    }

    const requestId = params.requestId;

    // Parse request body (tolerate an empty/absent body — all fields have defaults)
    const body = await req.json().catch(() => ({}));
    approveSchema.parse(body);

    // Get disbursement request
    const disbursementRequest = await prisma.disbursementRequest.findUnique({
      where: { id: requestId },
      include: {
        bankingAccount: {
          include: {
            campaign: {
              select: {
                id: true,
                organizationName: true,
                teamName: true,
                primaryLeader: {
                  select: {
                    email: true,
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          }
        },
        requestedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!disbursementRequest) {
      return NextResponse.json(
        { success: false, error: "Disbursement request not found" },
        { status: 404 }
      );
    }

    // Check if already processed
    if (disbursementRequest.status !== 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: `Disbursement request is already ${disbursementRequest.status.toLowerCase()}`
        },
        { status: 400 }
      );
    }

    // Advisory funds check so an unfundable request is not approved. The
    // authoritative check happens inside the payout transaction, which is where
    // the balance is actually debited.
    const availableBalance = disbursementRequest.bankingAccount.availableBalance;
    if (disbursementRequest.requestedAmount > availableBalance) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient funds in banking account",
          details: {
            requested: Number(disbursementRequest.requestedAmount) / 100,
            available: Number(availableBalance) / 100,
          }
        },
        { status: 400 }
      );
    }

    if (disbursementRequest.requestedBy === user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "The person who requested a disbursement cannot approve it",
        },
        { status: 403 }
      );
    }

    // The conditional updateMany is the concurrency guard (same pattern as
    // lib/donations.ts completeDonation): only one caller ever transitions
    // PENDING -> APPROVED. No balance bookkeeping happens here, so this needs no
    // multi-statement transaction — the request keeps its reservation in
    // pendingDisbursement until the payout route settles it.
    const approved = await prisma.disbursementRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        approvedBy: user.id,
        approvedAt: new Date(),
      }
    });

    if (approved.count === 0) {
      return NextResponse.json(
        { success: false, error: "Disbursement request has already been processed" },
        { status: 400 }
      );
    }

    // Send notification emails to campaign leader
    const campaign = disbursementRequest.bankingAccount.campaign;
    const campaignLeader = campaign.primaryLeader;

    try {
      await sendDisbursementApprovedEmail(
        campaignLeader.email,
        `${campaignLeader.firstName} ${campaignLeader.lastName}`,
        `${campaign.teamName} - ${campaign.organizationName}`,
        Number(disbursementRequest.requestedAmount) / 100,
        disbursementRequest.purpose
      );
    } catch (emailError) {
      console.error('Failed to send approval notification:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Disbursement approved. Funds move once the payout is sent.",
      disbursement: {
        id: requestId,
        amount: Number(disbursementRequest.requestedAmount) / 100,
        status: 'APPROVED',
        approvedBy: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        },
        approvedAt: new Date(),
        campaign: {
          id: campaign.id,
          name: `${campaign.teamName} - ${campaign.organizationName}`,
        }
      }
    });

  } catch (error) {
    console.error('Disbursement approval error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    // Generic message so raw error text is never surfaced to the caller.
    return NextResponse.json(
      { success: false, error: "Failed to approve disbursement" },
      { status: 500 }
    );
  }
}

// Helper function to send notification
async function sendDisbursementApprovedEmail(
  email: string,
  name: string,
  campaignName: string,
  amount: number,
  purpose: string
): Promise<void> {
  // TODO: Implement email notification using email service
  console.log(`Notifying ${name} (${email}) of approved disbursement for ${campaignName}: $${amount} (${purpose}) - payout pending`);
}