import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { claimCoachInvite } from "@/lib/coach-invite";

/**
 * POST /api/coach-invites/[token]/accept
 * Cookie-authenticated + CSRF. Claims the invite then connects the user
 * as a campaign guardian.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
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

    const result = await claimCoachInvite({
      token: params.token,
      userId: user.id,
    });

    if (result !== "claimed") {
      return NextResponse.json(
        {
          success: false,
          error: "Invitation is invalid, expired, or already used",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to accept coach invite:", error);
    return NextResponse.json(
      { success: false, error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
