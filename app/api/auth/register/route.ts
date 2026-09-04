import { registerUser } from "@/lib/auth";
import { sendEmailVerification } from "@/lib/email";
import { checkAuthRateLimit } from "@/lib/utils/rate-limiter";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Service" }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = registerSchema.parse(body);

    // Bounds account-creation floods and the outbound verification email they
    // would trigger.
    const rateLimitCheck = checkAuthRateLimit(req, validated.email);
    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    const { user, verificationToken } = await registerUser({
      ...validated,
      termsAccepted: true,
    });

    // Send verification email (don't await - let it happen in background)
    sendEmailVerification({
      toEmail: user.email,
      toName: user.firstName,
      verificationToken,
    }).catch((err) => {
      console.error("Failed to send verification email:", err);
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        message: "Registration successful. Please check your email to verify your account.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes("already in use")) {
      return NextResponse.json(
        { success: false, error: "User with this email already exists" },
        { status: 409 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
