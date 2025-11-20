import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Get refresh token from cookies and revoke it
    const refreshToken = req.cookies.get("refresh_token")?.value;
    if (refreshToken) {
      const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "") as string;
      await revokeRefreshToken(refreshToken, ip);
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );

    // Clear both session and refresh tokens
    response.cookies.delete("sessionToken");
    response.cookies.delete("refresh_token");

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    // Even if revoking fails, clear cookies
    const response = NextResponse.json(
      { success: true, message: "Logged out" },
      { status: 200 }
    );

    response.cookies.delete("sessionToken");
    response.cookies.delete("refresh_token");

    return response;
  }
}
