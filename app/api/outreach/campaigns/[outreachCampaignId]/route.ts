import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/requireAuth";
import prisma from "@/lib/prisma";
import { checkCsrf } from "@/lib/csrf";
import { cancelScheduledOutreach } from "@/lib/outreach";

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  emailSubject: z.string().max(200).optional(),
  emailBody: z.string().max(10000).optional(),
  smsBody: z.string().max(1600).optional(),
  scheduledFor: z.string().datetime().optional(),
  status: z.enum(["SCHEDULED", "CANCELLED"]).optional(),
});

/**
 * PATCH /api/outreach/campaigns/[outreachCampaignId]
 *
 * Update a DRAFT/SCHEDULED outreach campaign (reschedule, edit copy) or
 * cancel a SCHEDULED one (SCHEDULED → CANCELLED). SENT/SENDING/FAILED rows
 * are immutable.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { outreachCampaignId: string } }
) {
  try {
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    const user = await verifyAuth(req);
    const { outreachCampaignId } = params;

    const body = await req.json();
    const validated = updateCampaignSchema.parse(body);

    const outreach = await prisma.outreachCampaign.findUnique({
      where: { id: outreachCampaignId },
      include: {
        campaign: {
          select: {
            primaryLeaderId: true,
            guardians: { select: { id: true } },
            teamMembers: {
              where: { userId: user.id, deletedAt: null },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!outreach) {
      return NextResponse.json(
        { success: false, error: "Outreach campaign not found" },
        { status: 404 }
      );
    }

    const isLeaderLevel =
      outreach.campaign.primaryLeaderId === user.id ||
      outreach.campaign.guardians.some((g) => g.id === user.id) ||
      user.role === "ADMIN";
    const isCreator = outreach.createdBy === user.id;
    const isTeamMember = outreach.campaign.teamMembers.length > 0;

    if (!isLeaderLevel && !isCreator && !isTeamMember) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to update this outreach campaign" },
        { status: 403 }
      );
    }

    if (validated.status === "CANCELLED") {
      const { cancelled } = await cancelScheduledOutreach(outreachCampaignId);
      if (!cancelled) {
        return NextResponse.json(
          {
            success: false,
            error: "Only scheduled outreach campaigns can be cancelled",
          },
          { status: 409 }
        );
      }

      const updated = await prisma.outreachCampaign.findUnique({
        where: { id: outreachCampaignId },
      });

      return NextResponse.json(
        { success: true, outreachCampaign: updated },
        { status: 200 }
      );
    }

    if (outreach.status !== "DRAFT" && outreach.status !== "SCHEDULED") {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft or scheduled outreach campaigns can be updated",
        },
        { status: 409 }
      );
    }

    const nextStatus = validated.status ?? outreach.status;
    const nextScheduledFor = validated.scheduledFor
      ? new Date(validated.scheduledFor)
      : outreach.scheduledFor;

    if (nextStatus === "SCHEDULED") {
      if (!nextScheduledFor) {
        return NextResponse.json(
          {
            success: false,
            error: "scheduledFor is required when status is SCHEDULED",
          },
          { status: 400 }
        );
      }
      if (nextScheduledFor.getTime() <= Date.now()) {
        return NextResponse.json(
          {
            success: false,
            error: "scheduledFor must be a future date and time",
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.outreachCampaign.update({
      where: { id: outreachCampaignId },
      data: {
        ...(validated.name !== undefined ? { name: validated.name } : {}),
        ...(validated.emailSubject !== undefined
          ? { emailSubject: validated.emailSubject }
          : {}),
        ...(validated.emailBody !== undefined ? { emailBody: validated.emailBody } : {}),
        ...(validated.smsBody !== undefined ? { smsBody: validated.smsBody } : {}),
        ...(validated.scheduledFor !== undefined
          ? { scheduledFor: new Date(validated.scheduledFor) }
          : {}),
        ...(validated.status !== undefined ? { status: validated.status } : {}),
      },
    });

    return NextResponse.json(
      { success: true, outreachCampaign: updated },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error("Failed to update outreach campaign:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update outreach campaign" },
      { status: 500 }
    );
  }
}
