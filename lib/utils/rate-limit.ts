import { NextRequest } from "next/server";
import { getTrustedClientIp } from "./rate-limiter";

/**
 * Simple in-memory rate limiter for MVP
 * In production, use Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Store rate limit data in memory (will reset on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
// Housekeeping only — must not keep the process alive by itself.
(cleanupTimer as { unref?: () => void })?.unref?.();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number; // Maximum requests allowed in the window
  remaining: number;
  resetTime: number;
  retryAfter?: number; // Seconds until the rate limit resets
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier for the rate limit (e.g., userId, IP address)
 * @param config - Rate limit configuration
 * @returns Result indicating if the request is allowed
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();

  // Skip rate limiting in development (matches the rate-limiter.ts /
  // with-rate-limit.ts family and middleware, which all bypass in dev).
  // NODE_ENV is 'test' under jest, so tests still exercise real limiting.
  if (process.env.NODE_ENV === "development") {
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }

  const entry = rateLimitStore.get(identifier);

  // If no entry exists or the window has expired, create a new entry
  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime,
    });

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  // Check if the limit has been exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }

  // Increment the count
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Extract client identifier from request
 * Uses user ID if authenticated, otherwise uses IP address
 *
 * Shares getTrustedClientIp with rate-limiter.ts so both limiters apply the
 * same trusted-proxy rules. Raw x-forwarded-for / x-real-ip are never trusted:
 * without TRUSTED_PROXY_HOPS configured, anonymous callers all collapse into
 * the single "ip:unknown" bucket (fail closed) instead of minting a fresh
 * bucket per spoofed header value.
 */
export function getRateLimitIdentifier(
  req: NextRequest,
  userId?: string
): string {
  // Prefer user ID if available
  if (userId) {
    return `user:${userId}`;
  }

  return `ip:${getTrustedClientIp(req) ?? "unknown"}`;
}

/**
 * Rate limit configurations for different endpoints
 */
export const rateLimitConfigs = {
  // Campaign creation: 10 per user per day
  campaignCreate: {
    maxRequests: 10,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Campaign updates: 50 per user per hour
  campaignUpdate: {
    maxRequests: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
  },

  // Donation attempts: 20 per IP per hour
  donation: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
  },

  // Team member operations: 100 per user per hour
  teamMember: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
  },

  // CSV import: 1 per campaign per hour
  csvImport: {
    maxRequests: 1,
    windowMs: 60 * 60 * 1000, // 1 hour
  },

  // General API: 100 requests per minute
  general: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
};

/**
 * Apply rate limiting headers to response
 */
export function applyRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set("X-RateLimit-Limit", result.limit.toString());
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set("X-RateLimit-Reset", new Date(result.resetTime).toISOString());

  if (result.retryAfter) {
    headers.set("Retry-After", result.retryAfter.toString());
  }
}