import { resendVerificationEmail } from "@/lib/auth";
import { sendEmailVerification } from "@/lib/email";
import { checkAuthRateLimit } from "@/lib/utils/rate-limiter";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const resendSchema = z.object({
  email: z.string().email(),
});

// Generic response — never reveals whether an account exists or is already
// verified (matches forgot-password's anti-enumeration behavior).
const GENERIC_RESPONSE = {
  success: true,
  message:
    "If an account with that email exists and is unverified, we've sent a verification email.",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = resendSchema.parse(body);

    // Per-account bucket matters most here: without it anyone can mail-bomb a
    // single inbox on our SMTP budget.
    const rateLimitCheck = checkAuthRateLimit(req, validated.email);
    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    try {
      const verificationToken = await resendVerificationEmail(validated.email);

      // Get user info for the email
      const user = await prisma.user.findUnique({
        where: { email: validated.email },
        select: { firstName: true, email: true },
      });

      if (user) {
        sendEmailVerification({
          toEmail: user.email,
          toName: user.firstName,
          verificationToken,
        }).catch((err) => {
          console.error("Failed to send verification email:", err);
        });
      }
    } catch (error) {
      // "User not found" / "Email already verified" — swallow so callers
      // cannot enumerate accounts. Log anything unexpected.
      if (
        !(
          error instanceof Error &&
          (error.message === "User not found" ||
            error.message === "Email already verified")
        )
      ) {
        console.error("Resend verification error:", error);
      }
    }

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.errors },
        { status: 400 }
      );
    }

    console.error("Resend verification error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
