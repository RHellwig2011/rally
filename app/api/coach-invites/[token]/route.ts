import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/coach-invites/[token]
 * Token-authenticated invite preview for the accept page. No session required.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const invite = await prisma.coachInvite.findUnique({
      where: { token: params.token },
      select: {
        email: true,
        expiresAt: true,
        acceptedAt: true,
        campaign: {
          select: {
            id: true,
            organizationName: true,
            teamName: true,
          },
        },
        invitedBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    const expired = invite.expiresAt.getTime() <= now.getTime();
    const accepted = invite.acceptedAt !== null;

    return NextResponse.json({
      success: true,
      invite: {
        email: invite.email,
        expired,
        accepted,
        campaignName: `${invite.campaign.organizationName} ${invite.campaign.teamName}`,
        inviterName: [invite.invitedBy.firstName, invite.invitedBy.lastName]
          .filter(Boolean)
          .join(" "),
      },
    });
  } catch (error) {
    console.error("Failed to load coach invite:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load invitation" },
      { status: 500 }
    );
  }
}
