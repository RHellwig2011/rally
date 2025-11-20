import { requestPasswordReset } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const resetRequestSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = resetRequestSchema.parse(body);

    const resetToken = await requestPasswordReset(validated.email);

    // Get user info for the email
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
      select: { firstName: true, email: true }
    });

    // Send password reset email (only if user exists)
    if (user) {
      sendPasswordResetEmail({
        toEmail: user.email,
        toName: user.firstName,
        resetToken,
      }).catch((err) => {
        console.error("Failed to send password reset email:", err);
      });
    }

    // Always return success to prevent user enumeration
    return NextResponse.json(
      {
        success: true,
        message: "If an account with that email exists, we've sent a password reset link.",
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

    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
