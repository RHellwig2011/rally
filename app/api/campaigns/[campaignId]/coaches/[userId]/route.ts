import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { removeAssistantCoach } from "@/lib/coach-invite";

/**
 * DELETE /api/campaigns/[campaignId]/coaches/[userId]
 * Disconnect an assistant coach. Leader or ADMIN only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { campaignId: string; userId: string } }
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

    const result = await removeAssistantCoach({
      campaignId: params.campaignId,
      userId: params.userId,
      actor: { id: user.id, role: user.role },
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.httpStatus }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove assistant coach:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove assistant coach" },
      { status: 500 }
    );
  }
}
