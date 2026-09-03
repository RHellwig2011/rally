import { NextRequest, NextResponse } from "next/server";
import { loginUser, ACCESS_TOKEN_MAX_AGE_SEC, REFRESH_COOKIE_MAX_AGE_SEC } from "@/lib/auth";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearFailedLogins,
} from "@/lib/utils/rate-limiter";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = loginSchema.parse(body);

    // Throttle before spending a bcrypt comparison on the submitted password.
    const rateLimitCheck = checkLoginRateLimit(req, validated.email);
    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "") as string;

    let result;
    try {
      result = await loginUser(validated.email, validated.password, ip);
    } catch (err) {
      if (err instanceof Error && err.message === "Invalid credentials") {
        recordFailedLogin(validated.email);
      }
      throw err;
    }

    // Correct password: release the account's failed-attempt budget so a
    // guesser cannot keep a legitimate user locked out.
    clearFailedLogins(validated.email);

    const response = NextResponse.json(
      {
        success: true,
        user: result.user,
      },
      { status: 200 }
    );

    // Set secure cookies
    // Keep these attributes identical to the ones /api/auth/refresh re-issues,
    // otherwise a refreshed session lands on a different cookie scope.
    response.cookies.set("sessionToken", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE_SEC,
    });

    if (result.refresh) {
      response.cookies.set("refresh_token", result.refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: REFRESH_COOKIE_MAX_AGE_SEC,
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

    if (error instanceof Error && error.message === "Invalid credentials") {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
