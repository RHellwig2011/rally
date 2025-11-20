import { NextResponse } from "next/server";
import { rotateRefreshToken, generateJwt } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const match = cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith("refresh_token="));
    if (!match) return NextResponse.json({ error: "No refresh token" }, { status: 401 });

    const oldToken = match.split("=").slice(1).join("=");
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "") as string;

    const { userId, refreshToken: newRefresh } = await rotateRefreshToken(oldToken, ip);

    // Fetch user for role to sign access token
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    const access = generateJwt({ id: user.id, role: user.role });

    const res = NextResponse.json({ token: access }, { status: 200 });
    res.cookies.set("refresh_token", newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Refresh failed" }, { status: 401 });
  }
}
