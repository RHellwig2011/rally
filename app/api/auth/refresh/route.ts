import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken, generateJwt } from "@/lib/auth";
import prisma from "@/lib/prisma";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches login

export async function POST(req: NextRequest) {
  try {
    const oldToken = req.cookies.get("refresh_token")?.value;
    if (!oldToken) {
      return NextResponse.json(
        { success: false, error: "No refresh token" },
        { status: 401 }
      );
    }

    const ip = (req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "") as string;

    const { userId, refreshToken: newRefresh } = await rotateRefreshToken(
      oldToken,
      ip
    );

    // Fetch user for role to sign a new session token
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sessionToken = generateJwt({ id: user.id, role: user.role });

    const res = NextResponse.json({ success: true }, { status: 200 });

    // Rotate both cookies so the session actually continues
    res.cookies.set("sessionToken", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    res.cookies.set("refresh_token", newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return res;
  } catch (err) {
    console.error("Token refresh error:", err);
    return NextResponse.json(
      { success: false, error: "Invalid or expired refresh token" },
      { status: 401 }
    );
  }
}
