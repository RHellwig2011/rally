import { NextRequest, NextResponse } from "next/server";
import { checkCsrf } from "@/lib/csrf";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/services/email";
import { runMoneyTransaction } from "@/lib/donations";
import { z } from "zod";

// Sentinel distinguishing the in-transaction funds guard (a 400) from a genuine
// server fault (a 500) once the throw has unwound to the catch block.
const INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS";

// Validation schema for creating disbursement request
const createDisbursementSchema = z.object({
  amount: z.number().min(10, "Minimum disbursement amount is $10").max(50000, "Maximum disbursement amount is $50,000"),
  purpose: z.enum(['EQUIPMENT', 'TRAVEL', 'UNIFORMS', 'FACILITIES', 'TOURNAMENT_FEES', 'OTHER']),
  description: z.string().min(10, "Please provide a detailed description").max(500),
  bankingDetails: z.object({
    accountName: z.string().min(1),
    accountNumber: z.string().min(4),
    routingNumber: z.string().length(9, "Routing number must be 9 digits"),
  }).optional(),
});

/**
 * POST /api/campaigns/[campaignId]/disbursements
 * Create a disbursement request
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // CSRF protection (double-submit cookie)
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

    const campaignId = params.campaignId;

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createDisbursementSchema.parse(body);

    // Get campaign and banking account
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        primaryLeader: {
          select: { id: true, email: true, firstName: true, lastName: true }
        },
        guardians: {
          select: { id: true }
        },
        bankingAccount: true,
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check authorization
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some(g => g.id === user.id);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to request disbursements for this campaign" },
        { status: 403 }
      );
    }

    // Check campaign status
    if (campaign.status !== 'ACTIVE' && campaign.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: "Disbursements can only be requested for active or completed campaigns" },
        { status: 400 }
      );
    }

    // Check if banking account exists
    if (!campaign.bankingAccount) {
      return NextResponse.json(
        { success: false, error: "Banking account not set up for this campaign" },
        { status: 400 }
      );
    }

    const amountInCents = BigInt(Math.round(validatedData.amount * 100));

    // Check for pending disbursements
    const pendingDisbursements = await prisma.disbursementRequest.count({
      where: {
        bankingAccountId: campaign.bankingAccount.id,
        status: 'PENDING',
      }
    });

    if (pendingDisbursements >= 3) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many pending disbursement requests. Please wait for existing requests to be processed.",
          pendingCount: pendingDisbursements,
        },
        { status: 400 }
      );
    }

    // Update banking details if provided
    if (validatedData.bankingDetails) {
      await prisma.bankingAccount.update({
        where: { id: campaign.bankingAccount.id },
        data: {
          payoutAccountType: 'BANK_ACCOUNT',
          payoutAccountLast4: validatedData.bankingDetails.accountNumber.slice(-4),
          // In production, encrypt these values
          // For now, we're just storing last 4 digits
        }
      });
    }

    // Create the request and reserve the funds in one atomic step. The balance
    // is re-read and the reservation applied under the same lock, so two
    // concurrent requests cannot each pass a check against a balance that only
    // covers one of them. The comparison is against the UNRESERVED balance —
    // availableBalance still includes money already spoken for by PENDING and
    // APPROVED requests, which is what pendingDisbursement tracks.
    const bankingAccountId = campaign.bankingAccount.id;
    const disbursementRequest = await runMoneyTransaction(async (tx) => {
      const account = await tx.bankingAccount.update({
        where: { id: bankingAccountId },
        data: {
          pendingDisbursement: {
            increment: amountInCents
          }
        }
      });

      // A throw here rolls back the reservation as well as the create below.
      if (account.pendingDisbursement > account.availableBalance) {
        throw new Error(INSUFFICIENT_FUNDS);
      }

      return tx.disbursementRequest.create({
        data: {
          campaignId: campaign.id,
          bankingAccount: { connect: { id: bankingAccountId } },
          requestedByUser: { connect: { id: user.id } },
          requestedAmount: amountInCents,
          purpose: validatedData.purpose,
          description: validatedData.description,
          receiptsUrls: [],
          status: 'PENDING',
        },
        include: {
          requestedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          }
        }
      });
    });

    // Send notification to bank admin
    const bankAdmins = await prisma.user.findMany({
      where: { role: 'BANK_ADMIN' },
      select: { email: true, firstName: true }
    });

    // Queue notifications (don't await)
    Promise.all(
      bankAdmins.map(admin =>
        sendDisbursementRequestNotification(
          admin.email,
          admin.firstName,
          campaign.teamName,
          validatedData.amount
        )
      )
    ).catch(err => console.error('Failed to send admin notifications:', err));

    return NextResponse.json({
      success: true,
      message: "Disbursement request created successfully",
      disbursementRequest: {
        id: disbursementRequest.id,
        amount: Number(disbursementRequest.requestedAmount) / 100,
        purpose: disbursementRequest.purpose,
        status: disbursementRequest.status,
        requestedBy: {
          name: `${disbursementRequest.requestedByUser.firstName} ${disbursementRequest.requestedByUser.lastName}`,
          email: disbursementRequest.requestedByUser.email,
        },
        createdAt: disbursementRequest.createdAt,
      }
    });

  } catch (error) {
    console.error('Disbursement request error:', error);

    // The in-transaction funds guard is an expected business failure, not a
    // server fault.
    if (error instanceof Error && error.message === INSUFFICIENT_FUNDS) {
      return NextResponse.json(
        { success: false, error: "Insufficient funds" },
        { status: 400 }
      );
    }

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
        error: "Failed to create disbursement request"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/[campaignId]/disbursements
 * Get disbursement requests for a campaign
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
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

    const campaignId = params.campaignId;

    // Get campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        guardians: {
          select: { id: true }
        },
        bankingAccount: {
          include: {
            disbursementRequests: {
              orderBy: { createdAt: 'desc' },
              include: {
                requestedByUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  }
                },
                approvedByUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check authorization
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some(g => g.id === user.id) ||
      user.role === 'BANK_ADMIN' ||
      user.role === 'ADMIN';

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to view disbursements for this campaign" },
        { status: 403 }
      );
    }

    if (!campaign.bankingAccount) {
      return NextResponse.json({
        success: true,
        disbursements: [],
        bankingAccount: null,
      });
    }

    // Format response
    const disbursements = campaign.bankingAccount.disbursementRequests.map(req => ({
      id: req.id,
      amount: Number(req.requestedAmount) / 100,
      purpose: req.purpose,
      status: req.status,
      rejectionReason: req.rejectionReason,
      requestedBy: {
        id: req.requestedByUser.id,
        name: `${req.requestedByUser.firstName} ${req.requestedByUser.lastName}`,
        email: req.requestedByUser.email,
      },
      approvedBy: req.approvedByUser ? {
        id: req.approvedByUser.id,
        name: `${req.approvedByUser.firstName} ${req.approvedByUser.lastName}`,
        email: req.approvedByUser.email,
      } : null,
      createdAt: req.createdAt,
      approvedAt: req.approvedAt,
    }));

    // Calculate summary
    const summary = {
      totalRequested: disbursements.filter(d => d.status === 'PENDING').reduce((sum, d) => sum + d.amount, 0),
      totalApproved: disbursements.filter(d => d.status === 'APPROVED').reduce((sum, d) => sum + d.amount, 0),
      totalCompleted: disbursements.filter(d => d.status === 'COMPLETED').reduce((sum, d) => sum + d.amount, 0),
      totalRejected: disbursements.filter(d => d.status === 'REJECTED').reduce((sum, d) => sum + d.amount, 0),
      pendingCount: disbursements.filter(d => d.status === 'PENDING').length,
      availableBalance: Number(campaign.bankingAccount.availableBalance) / 100,
      pendingDisbursement: Number(campaign.bankingAccount.pendingDisbursement) / 100,
    };

    return NextResponse.json({
      success: true,
      disbursements,
      summary,
      campaign: {
        id: campaign.id,
        name: `${campaign.teamName} - ${campaign.organizationName}`,
      }
    });

  } catch (error) {
    console.error('Failed to fetch disbursements:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch disbursement requests"
      },
      { status: 500 }
    );
  }
}

/**
 * Notify a bank admin that a new disbursement request needs review.
 *
 * Transactional: bank admins must receive these regardless of marketing
 * preferences, since an unreviewed request blocks a team's payout.
 *
 * @param amount Requested amount in DOLLARS (the validated request payload).
 */
async function sendDisbursementRequestNotification(
  email: string,
  name: string,
  campaignName: string,
  amount: number
): Promise<void> {
  const formattedAmount = amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  const reviewUrl = `${
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  }/admin/disbursements`;

  const result = await sendEmail({
    to: email,
    subject: `New disbursement request: ${campaignName} (${formattedAmount})`,
    transactional: true,
    html: `
      <p>Hi ${name},</p>
      <p>
        <strong>${campaignName}</strong> has submitted a new disbursement request for
        <strong>${formattedAmount}</strong>.
      </p>
      <p>It is pending review and will not be paid out until approved.</p>
      <p><a href="${reviewUrl}">Review disbursement requests</a></p>
    `,
    text:
      `Hi ${name},\n\n` +
      `${campaignName} has submitted a new disbursement request for ${formattedAmount}.\n` +
      `It is pending review and will not be paid out until approved.\n\n` +
      `Review disbursement requests: ${reviewUrl}\n`,
  });

  // Surface failures to the caller's .catch so they are logged rather than
  // silently swallowed — sendEmail reports errors in its return value.
  if (!result.success) {
    throw new Error(
      `Disbursement notification to bank admin failed: ${result.error || "unknown error"}`
    );
  }
}