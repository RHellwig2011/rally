import { NextRequest, NextResponse } from "next/server";
import { verifyJwtEdge } from "./lib/auth/edge";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "./lib/utils/rate-limiter";
import { applySecurityHeaders } from "./lib/utils/security-headers";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Apply global rate limiting to API routes (skip in development for load testing)
  if (pathname.startsWith("/api/") && process.env.NODE_ENV !== 'development') {
    const sessionToken = request.cookies.get("sessionToken")?.value;
    let userId: string | undefined;

    if (sessionToken) {
      const decoded = await verifyJwtEdge(sessionToken);
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

  // Public routes that don't need authentication (exact match)
  const publicExactRoutes = [
    "/",
    "/about",
    "/help",
    "/campaigns",
    "/login",
    "/signup",
    "/terms",
    "/privacy",
    "/forgot-password",
    // The create-campaign wizard is a public page that gates in-page (it
    // checks /api/auth/me and renders a sign-in card for anonymous visitors).
    // The mutation it drives, POST /api/campaigns, still requires auth +
    // verified email inside the handler.
    "/create-campaign",
    "/auth/verify-email",
    "/auth/reset-password",
    ...(process.env.NODE_ENV !== "production" ? ["/test-donation"] : []),
    "/api/csrf-token",
    // Uptime monitors and deploy smoke tests call this with no credentials.
    "/api/health",
    "/api/campaigns/public",
    "/api/campaigns/check-slug",
    "/api/donations",
    "/api/referrals/track",
    "/api/help/chat",
    "/api/webhooks/stripe",
    // Resend open/click webhooks authenticate by Svix signature inside the
    // handler (RESEND_WEBHOOK_SECRET). Same convention as Stripe.
    "/api/webhooks/resend",
    // RFC 8058 one-click unsubscribe: mailbox providers GET/POST here with no
    // cookies. The HMAC token in the query string is the authorization.
    "/api/unsubscribe",
  ];

  // Public route prefixes (must end with "/" so "/api/auth/" can't match "/api/authors")
  const publicRoutePrefixes = [
    "/raise/", // public fundraising pages
    "/player/onboard/", // token-based player onboarding from invitation emails
    "/api/auth/", // login, signup, register, verify, reset, refresh, logout
    "/api/campaigns/slug/", // public campaign pages
    "/api/donations/", // donation verification for public donors
    "/api/webhooks/", // webhooks authenticate via signatures
    "/api/cron/", // cron routes authenticate via CRON_SECRET bearer token
    "/contribute/", // token-based supporter-contact collection page (players + guardians)
    "/api/contact-invite/", // GET/POST the invite token anonymously; the token IS the authorization
  ];

  const isPublicRoute =
    publicExactRoutes.includes(pathname) ||
    publicRoutePrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    // Public team member profile + token-based onboarding endpoints only
    (pathname.startsWith("/api/team-members/") &&
      (pathname.endsWith("/public") || pathname.endsWith("/onboard"))) ||
    // Cheer wall: public visitors POST messages; GET/PATCH/DELETE enforce
    // campaign-leader auth inside the route handlers
    (pathname.startsWith("/api/campaigns/") && pathname.includes("/cheer-messages")) ||
    // Leaderboard: scope=public is anonymous; scope=staff re-checks the session
    // and campaign ownership inside the route handler (401/403).
    (pathname.startsWith("/api/campaigns/") && pathname.endsWith("/leaderboard"));

  const sessionToken = request.cookies.get("sessionToken")?.value;

  if (!isPublicRoute && !sessionToken) {
    // Redirect to login if trying to access protected route
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (sessionToken) {
    const decoded = await verifyJwtEdge(sessionToken);
    if (!decoded && !isPublicRoute) {
      // Token is invalid or expired
      if (pathname.startsWith("/api/")) {
        const response = NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
        response.cookies.delete("sessionToken");
        return response;
      }
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("sessionToken");
      return response;
    }

    // Admin pages require ADMIN or BANK_ADMIN role. API routes under
    // /api/admin already enforce this server-side (403); this closes the
    // UI-only hole where any logged-in user could load /admin page shells.
    if (
      decoded &&
      (pathname === "/admin" || pathname.startsWith("/admin/")) &&
      decoded.role !== "ADMIN" &&
      decoded.role !== "BANK_ADMIN"
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
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