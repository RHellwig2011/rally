import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { z } from "zod";

/**
 * Contact invites let a player (or their guardian) collect supporter contacts
 * without the supporter-adder needing an account. The invite token is the only
 * credential the public /contribute/[token] page carries, so it is rotated
 * rather than reused: creating a new invite for a (teamMember, role) pair
 * revokes any prior live token for that pair.
 */

const createInviteSchema = z.object({
  role: z.enum(["PLAYER", "GUARDIAN"]).default("PLAYER"),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

const DEFAULT_EXPIRES_IN_DAYS = 30;

/**
 * POST /api/team-members/[teamMemberId]/contact-invite
 * Create (or rotate) a shareable contact-collection invite for a team member.
 * Allowed: the player themself, the campaign leader, or an ADMIN.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
    // CSRF check (state-changing route)
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

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

    const { teamMemberId } = params;

    const teamMember = await prisma.teamMember.findFirst({
      where: { id: teamMemberId, deletedAt: null },
      include: {
        campaign: {
          select: { id: true, primaryLeaderId: true },
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { success: false, error: "Team member not found" },
        { status: 404 }
      );
    }

    // The player themself, the campaign leader, or an ADMIN
    const isSelf = teamMember.userId != null && teamMember.userId === user.id;
    const isLeader = teamMember.campaign.primaryLeaderId === user.id;
    const isAdmin = user.role === "ADMIN";

    if (!isSelf && !isLeader && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authorized to create an invite for this team member",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const validated = createInviteSchema.parse(body ?? {});

    const expiresInDays = validated.expiresInDays ?? DEFAULT_EXPIRES_IN_DAYS;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    const token = crypto.randomBytes(32).toString("hex");

    // Rotate: revoke any prior live invite for this (teamMember, role) pair,
    // then issue the new one. Done in a transaction so a share link is never
    // ambiguous - at most one live token exists per pair.
    const [revoked, invite] = await prisma.$transaction([
      prisma.contactInvite.updateMany({
        where: {
          teamMemberId,
          role: validated.role,
          revokedAt: null,
        },
        data: { revokedAt: now },
      }),
      prisma.contactInvite.create({
        data: {
          teamMemberId,
          token,
          role: validated.role,
          expiresAt,
        },
      }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = `${appUrl}/contribute/${invite.token}`;

    return NextResponse.json(
      {
        success: true,
        invite: {
          id: invite.id,
          token: invite.token,
          role: invite.role,
          url,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
        },
        rotated: revoked.count > 0,
        revokedCount: revoked.count,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact invite creation error:", error);

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

    return NextResponse.json(
      { success: false, error: "Failed to create contact invite" },
      { status: 500 }
    );
  }
}
