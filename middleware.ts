import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "./lib/auth";

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get("sessionToken")?.value;

  // Public routes that don't need authentication
  const publicRoutes = [
    "/",
    "/login",
    "/signup",
    "/auth/verify-email",
    "/auth/reset-password",
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/register",
    "/api/auth/verify-email",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/resend-verification",
    "/api/donations",
  ];

  // Allow all /raise/* pages (public fundraising pages)
  if (request.nextUrl.pathname.startsWith("/raise/")) {
    return NextResponse.next();
  }

  // Check if current path is public
  const isPublicRoute = publicRoutes.some((route) => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route));

  if (!isPublicRoute && !sessionToken) {
    // Redirect to login if trying to access protected route
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (sessionToken) {
    const decoded = verifyJwt(sessionToken);
    if (!decoded) {
      // Token is invalid or expired - only redirect if not on public route
      if (!isPublicRoute) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("sessionToken");
        return response;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};