import { resendVerificationEmail } from "@/lib/auth";
import { sendEmailVerification } from "@/lib/email";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const resendSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = resendSchema.parse(body);

    const verificationToken = await resendVerificationEmail(validated.email);

    // Get user info for the email
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
      select: { firstName: true, email: true }
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

    return NextResponse.json(
      {
        success: true,
        message: "Verification email sent. Please check your inbox.",
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
      { success: false, error: error instanceof Error ? error.message : "Failed to resend verification email" },
      { status: 400 }
    );
  }
}
