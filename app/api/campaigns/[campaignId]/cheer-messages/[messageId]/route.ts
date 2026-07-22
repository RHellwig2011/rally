import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { checkCsrf } from "@/lib/csrf";

const moderateSchema = z.object({
  isApproved: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
});

type AuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

async function authorizeModerator(
  req: NextRequest,
  campaignId: string
): Promise<AuthResult> {
  const sessionToken = req.cookies.get("sessionToken")?.value;
  if (!sessionToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  const user = await getUserFromToken(sessionToken);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, primaryLeaderId: true },
  });

  if (!campaign) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      ),
    };
  }

  if (campaign.primaryLeaderId !== user.id && user.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}

/**
 * PATCH /api/campaigns/[campaignId]/cheer-messages/[messageId]
 * Approve, unapprove, or flag a cheer wall message (campaign leader or admin).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { campaignId: string; messageId: string } }
) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    const { campaignId, messageId } = params;

    const auth = await authorizeModerator(req, campaignId);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const data = moderateSchema.parse(body);

    if (data.isApproved === undefined && data.isFlagged === undefined) {
      return NextResponse.json(
        { success: false, error: "Nothing to update" },
        { status: 400 }
      );
    }

    const existing = await prisma.cheerWallMessage.findFirst({
      where: { id: messageId, campaignId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.cheerWallMessage.update({
      where: { id: messageId },
      data: {
        ...(data.isApproved !== undefined && { isApproved: data.isApproved }),
        ...(data.isFlagged !== undefined && { isFlagged: data.isFlagged }),
      },
      select: {
        id: true,
        authorName: true,
        message: true,
        isApproved: true,
        isFlagged: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, cheerMessage: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Failed to moderate cheer message:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update message" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/[campaignId]/cheer-messages/[messageId]
 * Permanently remove a cheer wall message (campaign leader or admin).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { campaignId: string; messageId: string } }
) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    const { campaignId, messageId } = params;

    const auth = await authorizeModerator(req, campaignId);
    if (!auth.ok) return auth.response;

    const existing = await prisma.cheerWallMessage.findFirst({
      where: { id: messageId, campaignId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    await prisma.cheerWallMessage.delete({ where: { id: messageId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete cheer message:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
