import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "./lib/auth";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "./lib/utils/rate-limiter";
import { applySecurityHeaders } from "./lib/utils/security-headers";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Apply global rate limiting to API routes (skip in development for load testing)
  if (pathname.startsWith("/api/") && process.env.NODE_ENV !== 'development') {
    const sessionToken = request.cookies.get("sessionToken")?.value;
    let userId: string | undefined;

    if (sessionToken) {
      const decoded = verifyJwt(sessionToken);
      userId = decoded?.id;
    }

    const identifier = getClientIdentifier(request, userId);
    const { limited, info } = checkRateLimit(identifier, RATE_LIMITS.GLOBAL);

    if (limited) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests. Please slow down.",
          retryAfter: info.reset,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": info.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": info.reset.toString(),
            "Retry-After": (info.reset - Math.floor(Date.now() / 1000)).toString(),
          },
        }
      );
    }
  }

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
    "/api/webhooks/stripe",
  ];

  // Allow all /raise/* pages (public fundraising pages)
  if (pathname.startsWith("/raise/")) {
    return NextResponse.next();
  }

  // Check if current path is public
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route));

  const sessionToken = request.cookies.get("sessionToken")?.value;

  if (!isPublicRoute && !sessionToken) {
    // Redirect to login if trying to access protected route
    if (pathname.startsWith("/api/")) {
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

  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - api/webhooks (webhook routes need raw body access)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api/webhooks).*)",
  ],
};