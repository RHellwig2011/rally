/**
 * In-Memory Rate Limiter
 * For production, consider using Redis or Vercel KV for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Check if a request should be rate limited
   * @param identifier - Unique identifier (e.g., IP address or user ID)
   * @param limit - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns true if rate limit exceeded, false otherwise
   */
  isRateLimited(identifier: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || entry.resetAt < now) {
      // First request or window expired, reset the counter
      this.store.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
      });
      return false;
    }

    if (entry.count >= limit) {
      // Rate limit exceeded
      return true;
    }

    // Increment counter
    entry.count++;
    return false;
  }

  /**
   * Get rate limit info for response headers
   */
  getRateLimitInfo(identifier: string, limit: number): {
    limit: number;
    remaining: number;
    reset: number;
  } {
    const entry = this.store.get(identifier);
    const now = Date.now();

    if (!entry || entry.resetAt < now) {
      return {
        limit,
        remaining: limit - 1,
        reset: Math.ceil((now + 60000) / 1000), // Default 1 minute
      };
    }

    return {
      limit,
      remaining: Math.max(0, limit - entry.count),
      reset: Math.ceil(entry.resetAt / 1000),
    };
  }

  /**
   * Clear rate limit for an identifier (useful for testing)
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  /**
   * Clear all rate limits
   */
  resetAll(): void {
    this.store.clear();
  }

  /**
   * Clean up interval on app shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

export default rateLimiter;

// Rate limit configurations for different endpoints
export const RATE_LIMITS = {
  // Authentication endpoints - stricter limits
  AUTH: {
    limit: 5, // 5 requests
    windowMs: 15 * 60 * 1000, // per 15 minutes
  },
  // Payment endpoints - strict limits
  PAYMENT: {
    limit: 10, // 10 requests
    windowMs: 60 * 60 * 1000, // per hour
  },
  // Donation creation
  DONATION: {
    limit: 20, // 20 donations
    windowMs: 60 * 60 * 1000, // per hour
  },
  // General API endpoints
  API: {
    limit: 100, // 100 requests
    windowMs: 15 * 60 * 1000, // per 15 minutes
  },
  // File upload endpoints
  UPLOAD: {
    limit: 10, // 10 uploads
    windowMs: 60 * 60 * 1000, // per hour
  },
  // Email sending
  EMAIL: {
    limit: 10, // 10 emails
    windowMs: 60 * 60 * 1000, // per hour
  },
  // Global limit per IP
  GLOBAL: {
    limit: 300, // 300 requests
    windowMs: 15 * 60 * 1000, // per 15 minutes
  },
};

/**
 * Helper function to get client identifier from request
 */
export function getClientIdentifier(request: Request, userId?: string): string {
  // Prefer user ID if authenticated
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `ip:${ip}`;
}

/**
 * Rate limit middleware helper
 */
export function checkRateLimit(
  identifier: string,
  config: { limit: number; windowMs: number }
): { limited: boolean; info: { limit: number; remaining: number; reset: number } } {
  const limited = rateLimiter.isRateLimited(identifier, config.limit, config.windowMs);
  const info = rateLimiter.getRateLimitInfo(identifier, config.limit);

  return { limited, info };
}
