import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
