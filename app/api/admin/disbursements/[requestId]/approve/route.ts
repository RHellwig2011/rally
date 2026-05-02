import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { checkCsrf } from "@/lib/csrf";

const approveSchema = z.object({
  notes: z.string().optional(),
  initiateTransfer: z.boolean().default(true),
});

/**
 * PUT /api/admin/disbursements/[requestId]/approve
 * Approve a disbursement request (BANK_ADMIN only)
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

    // Check authorization - only BANK_ADMIN
    if (user.role !== 'BANK_ADMIN') {
      return NextResponse.json(
        { success: false, error: "Only BANK_ADMIN can approve disbursements" },
        { status: 403 }
      );
    }

    const requestId = params.requestId;

    // Parse request body
    const body = await req.json();
    const validatedData = approveSchema.parse(body);

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

    // Check if sufficient funds still available
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

    // Process approval in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update disbursement request
      const updated = await tx.disbursementRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedBy: user.id,
          approvedAt: new Date(),
        }
      });

      // Update banking account balances
      await tx.bankingAccount.update({
        where: { id: disbursementRequest.bankingAccountId },
        data: {
          availableBalance: {
            decrement: disbursementRequest.requestedAmount
          },
          disbursedTotal: {
            increment: disbursementRequest.requestedAmount
          },
          pendingDisbursement: {
            decrement: disbursementRequest.requestedAmount
          }
        }
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          type: 'DISBURSEMENT',
          amount: -disbursementRequest.requestedAmount, // Negative for disbursement
          balanceAfter: disbursementRequest.bankingAccount.availableBalance - disbursementRequest.requestedAmount,
          description: `Disbursement: ${disbursementRequest.purpose}`,
          disbursementId: disbursementRequest.id,
          bankingAccountId: disbursementRequest.bankingAccountId,
          createdBy: user.id,
        }
      });

      // If initiating transfer, mark as completed immediately
      // In production, this would trigger ACH transfer and update status via webhook
      if (validatedData.initiateTransfer) {
        await tx.disbursementRequest.update({
          where: { id: requestId },
          data: {
            status: 'COMPLETED',
          }
        });
      }

      return { updated, transaction };
    });

    // Send notification emails to campaign leader
    const campaign = disbursementRequest.bankingAccount.campaign;
    const campaignLeader = campaign.primaryLeader;

    try {
      await sendDisbursementApprovedEmail(
        campaignLeader.email,
        `${campaignLeader.firstName} ${campaignLeader.lastName}`,
        `${campaign.teamName} - ${campaign.organizationName}`,
        Number(disbursementRequest.requestedAmount) / 100,
        disbursementRequest.purpose,
        result.transaction.id
      );
    } catch (emailError) {
      console.error('Failed to send approval notification:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Disbursement approved successfully",
      disbursement: {
        id: requestId,
        amount: Number(disbursementRequest.requestedAmount) / 100,
        status: validatedData.initiateTransfer ? 'COMPLETED' : 'APPROVED',
        approvedBy: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        },
        approvedAt: new Date(),
        transactionId: result.transaction.id,
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

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve disbursement"
      },
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
  purpose: string,
  transactionId: string
): Promise<void> {
  // TODO: Implement email notification using email service
  console.log(`Notifying ${name} (${email}) of approved disbursement for ${campaignName}: $${amount} (${purpose}) - Transaction: ${transactionId}`);
}