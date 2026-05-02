import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { checkCsrf } from "@/lib/csrf";

const rejectSchema = z.object({
  reason: z.string().min(10, "Please provide a detailed reason for rejection").max(500),
});

/**
 * PUT /api/admin/disbursements/[requestId]/reject
 * Reject a disbursement request (BANK_ADMIN only)
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
        { success: false, error: "Only BANK_ADMIN can reject disbursements" },
        { status: 403 }
      );
    }

    const requestId = params.requestId;

    // Parse request body
    const body = await req.json();
    const validatedData = rejectSchema.parse(body);

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

    // Process rejection in transaction
    await prisma.$transaction(async (tx) => {
      // Update disbursement request
      await tx.disbursementRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectionReason: validatedData.reason,
          approvedBy: user.id, // Track who rejected it
          approvedAt: new Date(),
        }
      });

      // Return funds to available balance
      await tx.bankingAccount.update({
        where: { id: disbursementRequest.bankingAccountId },
        data: {
          pendingDisbursement: {
            decrement: disbursementRequest.requestedAmount
          }
        }
      });
    });

    // Send notification to campaign leader
    const campaign = disbursementRequest.bankingAccount.campaign;
    const campaignLeader = campaign.primaryLeader;

    try {
      await sendDisbursementRejectedEmail(
        campaignLeader.email,
        `${campaignLeader.firstName} ${campaignLeader.lastName}`,
        `${campaign.teamName} - ${campaign.organizationName}`,
        Number(disbursementRequest.requestedAmount) / 100,
        disbursementRequest.purpose,
        validatedData.reason
      );
    } catch (emailError) {
      console.error('Failed to send rejection notification:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Disbursement rejected",
      disbursement: {
        id: requestId,
        amount: Number(disbursementRequest.requestedAmount) / 100,
        status: 'REJECTED',
        rejectionReason: validatedData.reason,
        rejectedBy: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        },
        rejectedAt: new Date(),
        campaign: {
          id: campaign.id,
          name: `${campaign.teamName} - ${campaign.organizationName}`,
        }
      }
    });

  } catch (error) {
    console.error('Disbursement rejection error:', error);

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
        error: error instanceof Error ? error.message : "Failed to reject disbursement"
      },
      { status: 500 }
    );
  }
}

// Helper function to send notification
async function sendDisbursementRejectedEmail(
  email: string,
  name: string,
  campaignName: string,
  amount: number,
  purpose: string,
  reason: string
): Promise<void> {
  // TODO: Implement email notification using email service
  console.log(`Notifying ${name} (${email}) of rejected disbursement for ${campaignName}: $${amount} (${purpose}) - Reason: ${reason}`);
}