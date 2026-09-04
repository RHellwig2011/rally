import { NextResponse } from "next/server";

/**
 * Security Headers Configuration
 * Based on OWASP security best practices
 */

const isDevelopment = process.env.NODE_ENV === "development";

export const SECURITY_HEADERS = {
  // Content Security Policy - Prevents XSS attacks
  "Content-Security-Policy": [
    "default-src 'self'",
    // Scripts: Allow Stripe and eval in dev mode only.
    //
    // KNOWN WEAKNESS: 'unsafe-inline' ships to production and largely nullifies
    // this CSP as an XSS control. It is currently LOAD-BEARING — the Next.js App
    // Router emits inline hydration scripts (self.__next_f.push) on every page
    // and there is no nonce infrastructure in the app. Removing the token
    // without replacing it breaks hydration site-wide.
    //
    // FOLLOW-UP (tracked, not done here): generate a per-request nonce in
    // middleware.ts, forward it to the render, and serve
    //   script-src 'self' 'nonce-<value>' 'strict-dynamic'
    // dropping 'unsafe-inline' entirely. Mitigating factor today: the codebase
    // has no XSS sink (no dangerouslySetInnerHTML / innerHTML / document.write),
    // so this is a defense-in-depth gap rather than an exploitable hole.
    [
      "script-src 'self'",
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
      "'unsafe-inline'",
      "https://js.stripe.com",
      "https://maps.googleapis.com",
    ].join(" "),
    // Styles: Allow inline styles for Tailwind and Google Fonts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Images: Allow self, data URIs, blobs and any HTTPS host.
    //
    // The blanket `https:` is load-bearing: campaign logos/banners and player
    // profile photos are operator- and guardian-supplied absolute URLs on
    // arbitrary hosts, rendered with plain <img> (see app/raise/[slug]/page.tsx
    // and app/player/profile/[teamMemberId]/page.tsx). Narrowing this requires
    // first moving those uploads behind a first-party host; until then a
    // tighter list would break real campaign pages.
    "img-src 'self' data: blob: https:",
    // Fonts: Allow self and Google Fonts
    "font-src 'self' data: https://fonts.gstatic.com",
    // Connect: Allow self and Stripe API
    [
      "connect-src 'self'",
      "https://api.stripe.com",
      "https://*.stripe.com",
      ...(isDevelopment ? ["ws://localhost:*", "http://localhost:*"] : []),
    ].join(" "),
    // Frames: Only Stripe for payment forms
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    // Objects: Disallow plugins
    "object-src 'none'",
    // Base URI: Restrict to same origin
    "base-uri 'self'",
    // Form actions: Only same origin
    "form-action 'self'",
    // Frame ancestors: Prevent embedding (clickjacking)
    "frame-ancestors 'none'",
    // Upgrade insecure requests in production
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].filter(Boolean).join("; "),

  // Prevents clickjacking attacks
  "X-Frame-Options": "DENY",

  // Prevents MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Enables browser XSS protection (legacy but good)
  "X-XSS-Protection": "1; mode=block",

  // Referrer Policy - Controls referrer information sharing
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Permissions Policy - Controls browser features
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "interest-cohort=()", // Blocks FLoC tracking
    "payment=(self)", // Allow payment APIs on same origin only
  ].join(", "),

  // Strict-Transport-Security - Forces HTTPS (2 years in production)
  ...(process.env.NODE_ENV === "production"
    ? {
        "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
      }
    : {}),

  // DNS Prefetch Control - Allow DNS prefetching for performance
  "X-DNS-Prefetch-Control": "on",

  // Don't leak server info
  "X-Powered-By": "Rally Platform",
};

/**
 * Apply security headers to a NextResponse
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Create a NextResponse with security headers
 */
export function createSecureResponse(
  body: any,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(body, init);
  return applySecurityHeaders(response);
}

/**
 * CSRF Token generation and validation
 */
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

/**
 * Generate a random CSRF token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Set CSRF token cookie in response
 */
export function setCsrfToken(response: NextResponse): { token: string; response: NextResponse } {
  const token = generateCsrfToken();

  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return { token, response };
}

/**
 * Validate CSRF token from request
 */
export function validateCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | undefined
): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(cookieToken, headerToken);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * CSRF Protection Configuration
 */
export const CSRF_PROTECTED_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

/**
 * Check if a path should be protected by CSRF
 */
export function shouldProtectCsrf(pathname: string): boolean {
  // Paths that should be protected
  const protectedPaths = [
    "/api/donations",
    "/api/campaigns",
    "/api/payments",
    "/api/disbursements",
  ];

  // Paths that should NOT be protected (webhooks, etc.)
  const excludedPaths = [
    "/api/webhooks/stripe",
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/register",
  ];

  // Check if path is excluded
  if (excludedPaths.some((path) => pathname.startsWith(path))) {
    return false;
  }

  // Check if path is in protected list
  return protectedPaths.some((path) => pathname.startsWith(path));
}

/**
 * Helper to get CSRF token from request
 */
export function getCsrfTokens(request: Request): {
  cookieToken: string | undefined;
  headerToken: string | undefined;
} {
  // Extract from cookie
  const cookieHeader = request.headers.get("cookie");
  const cookies = Object.fromEntries(
    (cookieHeader || "")
      .split(";")
      .map((c) => c.trim().split("="))
      .filter((pair) => pair.length === 2)
  );
  const cookieToken = cookies[CSRF_COOKIE_NAME];

  // Extract from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME) || undefined;

  return { cookieToken, headerToken };
}
