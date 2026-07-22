import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/campaigns/[campaignId]/cheer-messages
 * List cheer messages for moderation (campaign leader or admin only).
 * Optional ?status=pending|approved filter.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;

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

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, primaryLeaderId: true },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.primaryLeaderId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const status = req.nextUrl.searchParams.get("status");
    const where: { campaignId: string; isApproved?: boolean } = { campaignId };
    if (status === "pending") where.isApproved = false;
    if (status === "approved") where.isApproved = true;

    const messages = await prisma.cheerWallMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        authorName: true,
        message: true,
        isAnonymous: true,
        isApproved: true,
        isFlagged: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    console.error("Failed to list cheer messages:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load cheer messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;
    const body = await req.json();
    const { authorName, message, isAnonymous } = body;

    // Validate input
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        { success: false, error: "Message must be 500 characters or less" },
        { status: 400 }
      );
    }

    const displayName = isAnonymous ? "Anonymous" : (authorName || "Anonymous");

    if (!isAnonymous && (!authorName || authorName.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Create cheer message (pending approval)
    const cheerMessage = await prisma.cheerWallMessage.create({
      data: {
        campaignId,
        authorName: displayName,
        message: message.trim(),
        isApproved: false, // Require approval by campaign owner
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your message has been submitted and is pending approval!",
        cheerMessage: {
          id: cheerMessage.id,
          authorName: cheerMessage.authorName,
          message: cheerMessage.message,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create cheer message:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit message" },
      { status: 500 }
    );
  }
}
