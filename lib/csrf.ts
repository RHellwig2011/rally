/**
 * CSRF Protection Utilities
 * Implements Double Submit Cookie pattern for CSRF protection
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Hash a CSRF token for comparison
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verify CSRF token from request
 * @param request - Next.js request object
 * @returns true if token is valid, false otherwise
 */
export function verifyCsrfToken(request: NextRequest): boolean {
  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  // Get token from header (preferred) or body
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Use timing-safe comparison
  const cookieHash = hashToken(cookieToken);
  const headerHash = hashToken(headerToken);

  return cookieHash === headerHash;
}

/**
 * Middleware to check CSRF token on state-changing requests
 */
export function requireCsrfToken(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const method = request.method;

    // Only check CSRF for state-changing methods
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      // Skip CSRF check for webhook endpoints (they use signature verification)
      if (request.nextUrl.pathname.startsWith("/api/webhooks/")) {
        return handler(request, context);
      }

      // Verify CSRF token
      if (!verifyCsrfToken(request)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid CSRF token. Please refresh the page and try again.",
          },
          { status: 403 }
        );
      }
    }

    return handler(request, context);
  };
}

/**
 * Helper to check CSRF in route handlers
 */
export function checkCsrf(request: NextRequest): {
  valid: boolean;
  response?: NextResponse;
} {
  const method = request.method;

  // Only check CSRF for state-changing methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return { valid: true };
  }

  // Skip CSRF check for webhook endpoints
  if (request.nextUrl.pathname.startsWith("/api/webhooks/")) {
    return { valid: true };
  }

  // Verify CSRF token
  if (!verifyCsrfToken(request)) {
    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Invalid CSRF token. Please refresh the page and try again.",
        },
        { status: 403 }
      ),
    };
  }

  return { valid: true };
}

/**
 * Generate and set CSRF cookie
 */
export function setCsrfCookie(response: NextResponse, token?: string): string {
  const csrfToken = token || generateCsrfToken();

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return csrfToken;
}

/**
 * Get CSRF token from request cookies
 */
export function getCsrfToken(request: NextRequest): string | undefined {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value;
}

/**
 * API endpoint to get CSRF token
 * Usage: GET /api/csrf-token
 */
export function createCsrfTokenEndpoint() {
  return async function GET(request: NextRequest) {
    const existingToken = getCsrfToken(request);
    const token = existingToken || generateCsrfToken();

    const response = NextResponse.json({
      success: true,
      csrfToken: token,
    });

    // Set cookie if it doesn't exist
    if (!existingToken) {
      setCsrfCookie(response, token);
    }

    return response;
  };
}
