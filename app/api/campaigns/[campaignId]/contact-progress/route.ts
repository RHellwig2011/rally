import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";

/**
 * Per-player supporter-contact counts against the campaign quota, so a coach
 * can see at a glance who still owes contacts.
 */

/**
 * GET /api/campaigns/[campaignId]/contact-progress
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
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

    const { campaignId } = params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        primaryLeaderId: true,
        minContactsPerPlayer: true,
        guardians: { select: { id: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some((g) => g.id === user.id) ||
      user.role === "ADMIN";

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to view this campaign" },
        { status: 403 }
      );
    }

    const quota = campaign.minContactsPerPlayer;

    const teamMembers = await prisma.teamMember.findMany({
      where: { campaignId, deletedAt: null },
      select: {
        id: true,
        name: true,
        _count: { select: { contacts: true } },
      },
      orderBy: { name: "asc" },
    });

    const players = teamMembers.map((tm) => {
      const contactCount = tm._count.contacts;
      return {
        teamMemberId: tm.id,
        name: tm.name,
        contactCount,
        quotaMet: contactCount >= quota,
        remaining: Math.max(quota - contactCount, 0),
      };
    });

    const totalContacts = players.reduce((sum, p) => sum + p.contactCount, 0);
    const playersMeetingQuota = players.filter((p) => p.quotaMet).length;

    return NextResponse.json(
      {
        success: true,
        minContactsPerPlayer: quota,
        players,
        totals: {
          playerCount: players.length,
          totalContacts,
          playersMeetingQuota,
          playersMissingQuota: players.length - playersMeetingQuota,
          // Contacts still needed across the whole roster to hit the quota.
          contactsStillNeeded: players.reduce((sum, p) => sum + p.remaining, 0),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact progress error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load contact progress" },
      { status: 500 }
    );
  }
}
