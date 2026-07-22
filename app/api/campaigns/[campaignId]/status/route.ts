import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { sendCampaignStatusChangeNotification } from "@/lib/email";
import { checkCsrf } from "@/lib/csrf";

// Campaign status enum matching Prisma schema
const CampaignStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;

// Validation schema for status update
const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']),
  reason: z.string().optional(),
});

// Valid status transitions
const validTransitions: Record<string, string[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['PAUSED', 'COMPLETED'],
  PAUSED: ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [], // No transitions from ARCHIVED
};

/**
 * PUT /api/campaigns/[campaignId]/status
 * Update campaign status
 * Only campaign leader can change status
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
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

    const campaignId = params.campaignId;

    // Parse and validate request body
    const body = await req.json();
    const validatedData = updateStatusSchema.parse(body);

    // Get campaign and check ownership
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        status: true,
        primaryLeaderId: true,
        goalAmount: true,
        endDate: true,
        completedAt: true,
        archivedAt: true,
        primaryLeader: {
          select: { id: true, email: true, firstName: true }
        },
        guardians: {
          select: { id: true }
        },
        _count: {
          select: {
            donations: {
              where: { status: 'COMPLETED' }
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

    // Check authorization - only primary leader or admin can change status
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      user.role === 'BANK_ADMIN' ||
      user.role === 'ADMIN';

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Only campaign leader or admin can change campaign status" },
        { status: 403 }
      );
    }

    // Check if transition is valid
    const currentStatus = campaign.status;
    const newStatus = validatedData.status;

    if (currentStatus === newStatus) {
      return NextResponse.json({
        success: true,
        message: "Campaign already has this status",
        campaign: {
          id: campaign.id,
          status: campaign.status
        }
      });
    }

    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
          allowedTransitions
        },
        { status: 400 }
      );
    }

    // Additional validation based on status
    const now = new Date();

    // ACTIVE campaigns must have end date in future
    if (newStatus === 'ACTIVE') {
      if (campaign.endDate && campaign.endDate < now) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot activate campaign with past end date"
          },
          { status: 400 }
        );
      }

      // Check if campaign has required information
      if (!campaign.goalAmount || campaign.goalAmount <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Campaign must have a goal amount before activation"
          },
          { status: 400 }
        );
      }
    }

    // COMPLETED campaigns should have end date in past or donations
    if (newStatus === 'COMPLETED') {
      const hasEnded = campaign.endDate && campaign.endDate < now;
      const hasDonations = campaign._count.donations > 0;

      if (!hasEnded && !hasDonations) {
        return NextResponse.json(
          {
            success: false,
            error: "Campaign should have ended or have donations before marking as completed",
            warning: "You can still complete the campaign if needed"
          },
          { status: 400 }
        );
      }
    }

    // Update campaign status with audit trail
    const updatedCampaign = await prisma.$transaction(async (tx) => {
      // Update campaign
      const updated = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: newStatus,
          ...(newStatus === 'COMPLETED' && !campaign.completedAt && {
            completedAt: now
          }),
          ...(newStatus === 'ARCHIVED' && !campaign.archivedAt && {
            archivedAt: now
          }),
          updatedAt: now,
        },
        select: {
          id: true,
          status: true,
          organizationName: true,
          teamName: true,
          slug: true,
          startDate: true,
          endDate: true,
          completedAt: true,
          archivedAt: true,
          goalAmount: true,
          currentAmount: true,
        }
      });

      // TODO: Create activity log when ActivityLog model is added
      // await tx.activityLog.create({
      //   data: {
      //     campaignId,
      //     userId: user.id,
      //     action: 'STATUS_CHANGE',
      //     details: {
      //       from: currentStatus,
      //       to: newStatus,
      //       reason: validatedData.reason,
      //       timestamp: now.toISOString(),
      //     },
      //   }
      // });

      // Send email notifications to campaign leaders and guardians
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const campaignUrl = `${appUrl}/dashboard/${campaignId}`;
      const campaignFullName = `${updated.organizationName} ${updated.teamName}`;
      const changedByName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

      // Notify primary leader if they didn't make the change
      if (campaign.primaryLeader.id !== user.id && campaign.primaryLeader.email) {
        Promise.resolve(
          sendCampaignStatusChangeNotification({
            toEmail: campaign.primaryLeader.email,
            toName: campaign.primaryLeader.firstName || 'Campaign Leader',
            campaignName: campaignFullName,
            fromStatus: currentStatus,
            toStatus: newStatus,
            reason: validatedData.reason,
            changedBy: changedByName,
            campaignUrl,
          })
        ).catch(err => console.error('Failed to send notification to leader:', err));
      }

      // Notify guardians
      const guardians = await tx.user.findMany({
        where: {
          guardedCampaigns: {
            some: { id: campaignId }
          },
          emailVerified: true,
        },
        select: { id: true, email: true, firstName: true }
      });

      guardians.forEach(guardian => {
        if (guardian.id !== user.id && guardian.email) {
          Promise.resolve(
            sendCampaignStatusChangeNotification({
              toEmail: guardian.email,
              toName: guardian.firstName || 'Guardian',
              campaignName: campaignFullName,
              fromStatus: currentStatus,
              toStatus: newStatus,
              reason: validatedData.reason,
              changedBy: changedByName,
              campaignUrl,
            })
          ).catch(err => console.error('Failed to send notification to guardian:', err));
        }
      });

      // If activating campaign, notify team members
      if (newStatus === 'ACTIVE') {
        const teamMembers = await tx.teamMember.findMany({
          where: {
            campaignId,
            deletedAt: null,
            email: { not: null }
          },
          select: { email: true, name: true }
        });

        // Queue notification emails (don't await)
        Promise.all(
          teamMembers
            .filter(member => member.email !== null)
            .map(member =>
              sendCampaignActiveNotification(member.email!, member.name, updated.teamName)
            )
        ).catch(err => console.error('Failed to send team notifications:', err));
      }

      return updated;
    });

    // Format response
    const response = {
      success: true,
      message: `Campaign status updated to ${newStatus}`,
      campaign: {
        id: updatedCampaign.id,
        status: updatedCampaign.status,
        name: `${updatedCampaign.teamName} - ${updatedCampaign.organizationName}`,
        slug: updatedCampaign.slug,
        startDate: updatedCampaign.startDate,
        endDate: updatedCampaign.endDate,
        completedAt: updatedCampaign.completedAt,
        archivedAt: updatedCampaign.archivedAt,
        progress: {
          goal: Number(updatedCampaign.goalAmount) / 100,
          raised: Number(updatedCampaign.currentAmount) / 100,
          percentage: Math.round((Number(updatedCampaign.currentAmount) / Number(updatedCampaign.goalAmount)) * 100)
        }
      },
      transition: {
        from: currentStatus,
        to: newStatus,
        timestamp: now,
        changedBy: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Campaign status update error:', error);

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
        // Detail is logged above; never leak internal error text to the client.
        error: "Failed to update campaign status"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/[campaignId]/status
 * Get campaign status and history
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const campaignId = params.campaignId;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        status: true,
        organizationName: true,
        teamName: true,
        startDate: true,
        endDate: true,
        completedAt: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // TODO: Get status history from activity log when ActivityLog model is added
    const statusHistory: any[] = [];
    // const statusHistory = await prisma.activityLog.findMany({
    //   where: {
    //     campaignId,
    //     action: 'STATUS_CHANGE'
    //   },
    //   orderBy: { createdAt: 'desc' },
    //   take: 10,
    //   include: {
    //     user: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         email: true,
    //       }
    //     }
    //   }
    // });

    // Determine available transitions
    const availableTransitions = validTransitions[campaign.status] || [];

    return NextResponse.json({
      success: true,
      status: {
        current: campaign.status,
        availableTransitions,
        dates: {
          created: campaign.createdAt,
          updated: campaign.updatedAt,
          started: campaign.startDate,
          ending: campaign.endDate,
          completed: campaign.completedAt,
          archived: campaign.archivedAt,
        }
      },
      history: statusHistory.map(log => ({
        from: log.details?.from || 'UNKNOWN',
        to: log.details?.to || 'UNKNOWN',
        reason: log.details?.reason,
        timestamp: log.createdAt,
        changedBy: {
          id: log.user.id,
          name: `${log.user.firstName} ${log.user.lastName}`,
          email: log.user.email,
        }
      })),
      campaign: {
        id: campaign.id,
        name: `${campaign.teamName} - ${campaign.organizationName}`,
      }
    });

  } catch (error) {
    console.error('Failed to fetch campaign status:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch campaign status"
      },
      { status: 500 }
    );
  }
}

// Helper function to send notification (implement based on your notification system)
async function sendCampaignActiveNotification(
  email: string,
  name: string,
  campaignName: string
): Promise<void> {
  // TODO: Implement email notification
  console.log(`Notifying ${name} (${email}) that ${campaignName} is now active`);
}