import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = loginSchema.parse(body);

    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "") as string;
    const result = await loginUser(validated.email, validated.password, ip);

    // For MVP, we'll skip email verification check
    // if (!result.user.emailVerified) {
    //   return NextResponse.json(
    //     { success: false, error: "Please verify your email before logging in" },
    //     { status: 401 }
    //   );
    // }

    const response = NextResponse.json(
      {
        success: true,
        user: result.user,
      },
      { status: 200 }
    );

    // Set secure cookies
    response.cookies.set("sessionToken", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    if (result.refresh) {
      response.cookies.set("refresh_token", result.refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
      });
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Login failed" },
      { status: 401 }
    );
  }
}
