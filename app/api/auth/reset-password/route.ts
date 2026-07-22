import { resetPassword } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/utils/rate-limiter";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const resetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = resetSchema.parse(body);

    // Per-IP only — the request carries a token rather than an address, and
    // reset tokens are 32 random bytes so guessing them is not the threat.
    // This bounds bcrypt work from automated submission floods.
    const rateLimitCheck = checkAuthRateLimit(req);
    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    await resetPassword(validated.token, validated.newPassword);

    return NextResponse.json(
      {
        success: true,
        message: "Password reset successfully. You can now log in with your new password.",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.errors },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "Invalid or expired password reset token"
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired password reset token" },
        { status: 400 }
      );
    }

    console.error("Password reset error:", error);
    return NextResponse.json(
      { success: false, error: "Password reset failed. Please try again." },
      { status: 500 }
    );
  }
}
