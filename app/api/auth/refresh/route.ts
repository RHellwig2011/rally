import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken, generateJwt, ACCESS_TOKEN_MAX_AGE_SEC, REFRESH_COOKIE_MAX_AGE_SEC } from "@/lib/auth";
import prisma from "@/lib/prisma";

const COOKIE_MAX_AGE = REFRESH_COOKIE_MAX_AGE_SEC;

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
      maxAge: ACCESS_TOKEN_MAX_AGE_SEC,
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

    // Every failure here means the presented token can never be rotated again,
    // so clear both cookies: the browser stops replaying dead credentials and
    // the user is sent back through login. Scope differs by failure mode and
    // rotateRefreshToken decides it — a first replay of a rotated-away token
    // (the lost-response retry) only fails this request, while a confirmed
    // reuse also revokes the user's whole token family, ending their other
    // sessions. The client-facing message stays generic either way: which mode
    // fired is in the server log, and telling a caller that reuse was
    // specifically detected only helps an attacker probe for stolen tokens.
    const res = NextResponse.json(
      { success: false, error: "Invalid or expired refresh token" },
      { status: 401 }
    );

    res.cookies.set("sessionToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.cookies.set("refresh_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  }
}
