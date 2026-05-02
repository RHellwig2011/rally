import { NextRequest, NextResponse } from "next/server";
import rateLimiter, { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "./rate-limiter";
import { verifyJwt } from "../auth";

type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

type RouteHandler = (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function to add rate limiting to API routes
 *
 * @example
 * export const POST = withRateLimit(handler, RATE_LIMITS.PAYMENT);
 */
export function withRateLimit(
  handler: RouteHandler,
  config: RateLimitConfig = RATE_LIMITS.API
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      // Get user ID from session if authenticated
      const sessionToken = request.cookies.get("sessionToken")?.value;
      let userId: string | undefined;

      if (sessionToken) {
        const decoded = verifyJwt(sessionToken);
        userId = decoded?.id;
      }

      // Get client identifier
      const identifier = getClientIdentifier(request, userId);

      // Check rate limit
      const { limited, info } = checkRateLimit(identifier, config);

      // Always add rate limit headers
      const headers = {
        "X-RateLimit-Limit": info.limit.toString(),
        "X-RateLimit-Remaining": info.remaining.toString(),
        "X-RateLimit-Reset": info.reset.toString(),
      };

      if (limited) {
        return NextResponse.json(
          {
            success: false,
            error: "Too many requests. Please try again later.",
            retryAfter: info.reset,
          },
          {
            status: 429,
            headers: {
              ...headers,
              "Retry-After": (info.reset - Math.floor(Date.now() / 1000)).toString(),
            },
          }
        );
      }

      // Execute the handler
      const response = await handler(request, context);

      // Add rate limit headers to successful response
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error("Rate limit error:", error);
      // On error, allow the request to proceed (fail open)
      return handler(request, context);
    }
  };
}

/**
 * Helper to manually check rate limit in route handlers
 * Skips rate limiting in development mode for load testing
 */
export function checkRouteRateLimit(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.API
): { limited: boolean; response?: NextResponse } {
  // Skip rate limiting in development mode
  if (process.env.NODE_ENV === 'development') {
    return { limited: false };
  }

  const sessionToken = request.cookies.get("sessionToken")?.value;
  let userId: string | undefined;

  if (sessionToken) {
    const decoded = verifyJwt(sessionToken);
    userId = decoded?.id;
  }

  const identifier = getClientIdentifier(request, userId);
  const { limited, info } = checkRateLimit(identifier, config);

  if (limited) {
    return {
      limited: true,
      response: NextResponse.json(
        {
          success: false,
          error: "Too many requests. Please try again later.",
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
      ),
    };
  }

  return { limited: false };
}
