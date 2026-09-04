import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkCsrf } from "@/lib/csrf";

/**
 * POST /api/admin/campaigns/[campaignId]/verify
 * Stamp organization verification so the campaign leader can go ACTIVE.
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

    if (user.role !== "BANK_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.campaignId },
      select: { id: true, organizationVerifiedAt: true },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        organizationVerifiedAt: campaign.organizationVerifiedAt ?? now,
        organizationVerifiedById: user.id,
      },
      select: {
        id: true,
        organizationVerifiedAt: true,
        organizationVerifiedById: true,
        status: true,
      },
    });

    return NextResponse.json({ success: true, campaign: updated });
  } catch (error) {
    console.error("Organization verify error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify organization" },
      { status: 500 }
    );
  }
}
