import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkCsrf } from "@/lib/csrf";
import {
  canInviteAssistantCoach,
  canViewCoaches,
  inviteAssistantCoach,
} from "@/lib/coach-invite";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitConfigs,
  applyRateLimitHeaders,
} from "@/lib/utils/rate-limit";

const inviteSchema = z.object({
  email: z.string().email("Invalid email format").trim().toLowerCase(),
});

async function getSessionUser(req: NextRequest) {
  const sessionToken = req.cookies.get("sessionToken")?.value;
  if (!sessionToken) return null;
  return getUserFromToken(sessionToken);
}

/**
 * GET /api/campaigns/[campaignId]/coaches
 * List assistant coaches (guardians) and pending invites.
 * Leader, guardian, or ADMIN.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.campaignId },
      select: {
        id: true,
        primaryLeaderId: true,
        guardians: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        coachInvites: {
          where: { acceptedAt: null },
          select: {
            id: true,
            email: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const actor = { id: user.id, role: user.role };
    if (
      !canViewCoaches(actor, {
        primaryLeaderId: campaign.primaryLeaderId,
        guardianIds: campaign.guardians.map((g) => g.id),
      })
    ) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const now = Date.now();
    return NextResponse.json({
      success: true,
      canInvite: canInviteAssistantCoach(actor, campaign),
      coaches: campaign.guardians,
      pendingInvites: campaign.coachInvites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        expired: invite.expiresAt.getTime() <= now,
      })),
    });
  } catch (error) {
    console.error("Failed to list assistant coaches:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list assistant coaches" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/[campaignId]/coaches
 * Invite an assistant coach by email. Leader or ADMIN only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const rateLimitId = getRateLimitIdentifier(req, user.id);
    const rateLimitResult = checkRateLimit(
      rateLimitId,
      rateLimitConfigs.campaignUpdate
    );
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429 }
      );
      applyRateLimitHeaders(response.headers, rateLimitResult);
      return response;
    }

    const body = await req.json();
    const { email } = inviteSchema.parse(body);

    const actorName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || "A coach";

    const result = await inviteAssistantCoach({
      campaignId: params.campaignId,
      email,
      actor: { id: user.id, role: user.role },
      actorName,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.httpStatus }
      );
    }

    return NextResponse.json(
      { success: true, status: result.status },
      { status: result.status === "connected" ? 200 : 201 }
    );
  } catch (error) {
    console.error("Failed to invite assistant coach:", error);
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
      { success: false, error: "Failed to invite assistant coach" },
      { status: 500 }
    );
  }
}
