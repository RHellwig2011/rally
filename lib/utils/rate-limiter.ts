/**
 * In-Memory Rate Limiter
 *
 * PER-INSTANCE ONLY. Every counter lives in this process's heap, so the limits
 * below are enforced once per running instance, not once per deployment:
 *  - N serverless instances / containers multiply every limit by N;
 *  - a cold start or redeploy wipes all counters, handing an attacker a fresh
 *    budget on demand.
 * That is acceptable for a single long-lived instance and is still far better
 * than no throttle. For multi-instance production the GLOBAL middleware limit
 * is already backed by the shared Redis store in ./rate-limit-store (Upstash
 * REST, configured via UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN), which
 * falls back to this in-memory limiter when Redis is unconfigured or down.
 * The exported surface (checkRateLimit / checkAuthRateLimit /
 * checkLoginRateLimit / checkDonationRateLimit) remains the sync seam other
 * route handlers use; those per-route buckets are still per-instance.
 */

import { NextResponse } from "next/server";

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
    // The HTTP server keeps the process alive on its own; this housekeeping
    // timer must not be what holds it open (it otherwise hangs jest runs).
    // Optional-chained because edge runtimes return a plain number here.
    (this.cleanupInterval as { unref?: () => void } | null)?.unref?.();
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
  // Per-ACCOUNT authentication limit, keyed on the submitted email address.
  // Blocks credential guessing even when it is spread across many source IPs.
  AUTH: {
    limit: 5, // 5 attempts
    windowMs: 15 * 60 * 1000, // per 15 minutes
  },
  // Per-IP authentication limit. Deliberately looser than AUTH so a shared
  // school/library NAT is not locked out, while still stopping one source
  // from spraying credentials across many accounts.
  AUTH_IP: {
    limit: 60, // 60 attempts
    windowMs: 15 * 60 * 1000, // per 15 minutes
  },
  // Anonymous AI help chat - each request costs the operator real OpenAI spend
  CHAT: {
    limit: 20, // 20 messages
    windowMs: 15 * 60 * 1000, // per 15 minutes
  },
  // Payment endpoints - strict limits
  PAYMENT: {
    limit: 10, // 10 requests
    windowMs: 60 * 60 * 1000, // per hour
  },
  // Donation creation, per known client IP. Tight enough to stop card testing
  // (an attacker validating stolen card numbers against our Stripe account).
  DONATION: {
    limit: 20, // 20 donation attempts
    windowMs: 60 * 60 * 1000, // per hour
  },
  // Donation creation when NO trustworthy client IP exists and every anonymous
  // donor therefore collapses into one shared bucket. Applying the 20/hour
  // per-IP figure to that shared bucket would cap the ENTIRE platform at 20
  // donations an hour on any deployment that has not set TRUSTED_PROXY_HOPS —
  // refusing real money because of a config gap. This allowance still bounds a
  // runaway script without doing that.
  DONATION_SHARED: {
    limit: 500, // 500 donation attempts across all unidentified callers
    windowMs: 60 * 60 * 1000, // per hour
  },
  // Donation creation per donor email address. Survives IP rotation, so it
  // still bites when the source address is unknown or deliberately varied.
  DONATION_EMAIL: {
    limit: 10, // 10 donation attempts for one email
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
 * Number of trusted reverse proxies sitting between the public internet and
 * this app. `X-Forwarded-For` is fully attacker-controlled unless we know
 * exactly how many trailing entries were appended by infrastructure we own,
 * so the default of 0 means "ignore forwarding headers entirely".
 *
 * Set TRUSTED_PROXY_HOPS=1 behind a single nginx/ALB/Cloudflare layer, 2 if
 * two of your own proxies append to the header, and so on.
 */
const TRUSTED_PROXY_HOPS = (() => {
  const parsed = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
})();

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Validate and canonicalise a single address taken from a forwarding header.
 * Returns null for anything that is not a syntactically valid IP so that
 * attacker-supplied junk can never become a rate-limit bucket key.
 */
function normalizeIp(raw: string): string | null {
  let value = raw.trim();
  if (!value || value.length > 64) return null;

  // "[2001:db8::1]:443" -> "2001:db8::1"
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end <= 1) return null;
    value = value.slice(1, end);
  } else {
    const first = value.indexOf(":");
    // Exactly one colon means "1.2.3.4:5678", not IPv6.
    if (first !== -1 && first === value.lastIndexOf(":")) {
      value = value.slice(0, first);
    }
  }

  const v4 = IPV4_PATTERN.exec(value);
  if (v4) {
    for (let i = 1; i <= 4; i++) {
      const part = v4[i];
      if (part.length > 1 && part.startsWith("0")) return null;
      if (Number(part) > 255) return null;
    }
    return value;
  }

  // IPv6: hex groups, optional trailing IPv4, at most one "::" compression.
  if (value.length > 45) return null;
  if (!/^[0-9a-f:.]+$/i.test(value)) return null;
  const groups = value.split(":");
  if (groups.length < 3 || groups.length > 9) return null;
  if (value.split("::").length > 2) return null;
  return value.toLowerCase();
}

/**
 * Derive a client IP we are actually willing to trust, or null.
 *
 * Deliberately does NOT use `xff.split(",")[0]`: the leftmost entry is the one
 * the caller supplies, so an attacker gets a fresh rate-limit bucket per
 * request. Even a proxy that appends the true peer address does not help,
 * because the attacker can prepend an arbitrary spoofed hop. The trustworthy
 * entry is counted from the RIGHT, where our own infrastructure writes.
 */
export function getTrustedClientIp(request: Request): string | null {
  // Platform-populated address (Vercel sets NextRequest.ip from its own edge,
  // not from a caller-controlled header), so it outranks any header.
  const platformIp = (request as { ip?: unknown }).ip;
  if (typeof platformIp === "string") {
    const normalized = normalizeIp(platformIp);
    if (normalized) return normalized;
  }

  if (TRUSTED_PROXY_HOPS === 0) return null;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    // Each trusted proxy appends the address it received the request from, so
    // the real client sits TRUSTED_PROXY_HOPS entries from the right. Fewer
    // entries than expected means the chain is not what we configured.
    if (hops.length >= TRUSTED_PROXY_HOPS) {
      const candidate = normalizeIp(hops[hops.length - TRUSTED_PROXY_HOPS]);
      if (candidate) return candidate;
    }
  }

  // x-real-ip is overwritten (not appended) by the nearest proxy, so it is
  // only meaningful once we have declared that a proxy is in front of us.
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const candidate = normalizeIp(realIp);
    if (candidate) return candidate;
  }

  return null;
}

/**
 * Helper function to get client identifier from request
 *
 * Fails CLOSED: when no trustworthy client IP can be derived every anonymous
 * caller shares the single "ip:unknown" bucket. That throttles the whole
 * deployment rather than handing attackers unlimited fresh buckets — configure
 * TRUSTED_PROXY_HOPS so real addresses are available.
 */
export function getClientIdentifier(request: Request, userId?: string): string {
  // Prefer user ID if authenticated
  if (userId) {
    return `user:${userId}`;
  }

  return `ip:${getTrustedClientIp(request) ?? "unknown"}`;
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

type RateLimitInfo = { limit: number; remaining: number; reset: number };

function tooManyRequests(info: RateLimitInfo): NextResponse {
  return NextResponse.json(
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
        "Retry-After": Math.max(
          0,
          info.reset - Math.floor(Date.now() / 1000)
        ).toString(),
      },
    }
  );
}

type LimitCheck = { limited: boolean; response?: NextResponse };

/**
 * Run a limiter decision, FAILING OPEN if the limiter itself breaks.
 *
 * A throttle is a guard, not a gate: if this module throws (a malformed bucket
 * key, an exhausted heap, a bug introduced later) the correct outcome is to let
 * the request through, not to hand a self-inflicted outage to every legitimate
 * donor and user. Note this is fail-open on INTERNAL FAULT only — a limiter
 * that successfully decides "over the limit" always blocks.
 */
function failOpen(decide: () => LimitCheck): LimitCheck {
  try {
    return decide();
  } catch (error) {
    console.error("Rate limiter fault - allowing request (fail open):", error);
    return { limited: false };
  }
}

function authAccountKey(email: string): string {
  return `auth:account:${email.trim().toLowerCase()}`;
}

/**
 * Pick the per-IP auth bucket. When no trustworthy client IP exists every
 * caller shares one bucket, so that bucket gets the (much larger) GLOBAL
 * allowance — a misconfigured proxy setup must not lock the entire
 * deployment out of signing in.
 */
function authIpBucket(request: Request): { key: string; config: { limit: number; windowMs: number } } {
  const ip = getTrustedClientIp(request);
  return ip
    ? { key: `auth:ip:${ip}`, config: RATE_LIMITS.AUTH_IP }
    : { key: "auth:ip:unknown", config: RATE_LIMITS.GLOBAL };
}

/**
 * Throttle for auth endpoints that are not credential checks (registration,
 * signup, password reset, resend-verification). Consumes both the per-IP and,
 * when an address was submitted, the per-account bucket — the per-account
 * bucket is what stops an attacker using our SMTP budget to mail-bomb one
 * victim.
 *
 * Mirrors checkRouteRateLimit by bypassing in development.
 */
export function checkAuthRateLimit(
  request: Request,
  email?: string
): LimitCheck {
  return failOpen(() => {
    if (process.env.NODE_ENV === "development") {
      return { limited: false };
    }

    const bucket = authIpBucket(request);
    const byIp = checkRateLimit(bucket.key, bucket.config);
    if (byIp.limited) {
      return { limited: true, response: tooManyRequests(byIp.info) };
    }

    if (email) {
      const byAccount = checkRateLimit(authAccountKey(email), RATE_LIMITS.AUTH);
      if (byAccount.limited) {
        return { limited: true, response: tooManyRequests(byAccount.info) };
      }
    }

    return { limited: false };
  });
}

/**
 * Throttle for the login endpoint.
 *
 * The per-IP bucket is consumed on every attempt, but the per-account bucket
 * is only INSPECTED here and consumed by recordFailedLogin. A user who types
 * their password correctly therefore never burns their own allowance, while a
 * guesser is cut off after RATE_LIMITS.AUTH.limit failures for that account
 * regardless of how many IPs they spread the attempt across.
 */
export function checkLoginRateLimit(
  request: Request,
  email: string
): LimitCheck {
  return failOpen(() => {
    if (process.env.NODE_ENV === "development") {
      return { limited: false };
    }

    const bucket = authIpBucket(request);
    const byIp = checkRateLimit(bucket.key, bucket.config);
    if (byIp.limited) {
      return { limited: true, response: tooManyRequests(byIp.info) };
    }

    const accountInfo = rateLimiter.getRateLimitInfo(
      authAccountKey(email),
      RATE_LIMITS.AUTH.limit
    );
    if (accountInfo.remaining <= 0) {
      return { limited: true, response: tooManyRequests(accountInfo) };
    }

    return { limited: false };
  });
}

/** Count one failed credential check against the account's bucket. */
export function recordFailedLogin(email: string): void {
  try {
    if (process.env.NODE_ENV === "development") {
      return;
    }
    rateLimiter.isRateLimited(
      authAccountKey(email),
      RATE_LIMITS.AUTH.limit,
      RATE_LIMITS.AUTH.windowMs
    );
  } catch (error) {
    console.error("Rate limiter fault recording failed login:", error);
  }
}

/** Clear an account's failed-attempt bucket after a successful login. */
export function clearFailedLogins(email: string): void {
  try {
    rateLimiter.reset(authAccountKey(email));
  } catch (error) {
    console.error("Rate limiter fault clearing failed logins:", error);
  }
}

/**
 * Donation throttle, source dimension.
 *
 * Card testing is the threat: an attacker pushes stolen card numbers through
 * our Stripe account in bulk to learn which ones are live. This is the bucket
 * to consume BEFORE parsing a request body, so junk floods stay cheap.
 *
 * Deliberately widens to DONATION_SHARED when no trustworthy client IP exists.
 * Every anonymous caller shares one bucket in that case, and charging them the
 * strict per-IP allowance would cap the whole platform's revenue over a proxy
 * misconfiguration. Set TRUSTED_PROXY_HOPS for real per-attacker isolation.
 *
 * Split from the per-email bucket rather than taking an optional email, because
 * the two are consumed at different points in the request and folding them into
 * one call would charge the source bucket twice per donation.
 *
 * Mirrors the rest of this module by bypassing in development, and fails open.
 */
export function checkDonationSourceRateLimit(request: Request): LimitCheck {
  return failOpen(() => {
    if (process.env.NODE_ENV === "development") {
      return { limited: false };
    }

    const ip = getTrustedClientIp(request);
    const byIp = ip
      ? checkRateLimit(`donation:ip:${ip}`, RATE_LIMITS.DONATION)
      : checkRateLimit("donation:ip:unknown", RATE_LIMITS.DONATION_SHARED);

    return byIp.limited
      ? { limited: true, response: tooManyRequests(byIp.info) }
      : { limited: false };
  });
}

/**
 * Donation throttle, donor-identity dimension. Consumed once the body has been
 * validated. Survives IP rotation, so it still bites when the source address is
 * unknown (the shared-bucket case above) or deliberately varied.
 */
export function checkDonationEmailRateLimit(donorEmail: string): LimitCheck {
  return failOpen(() => {
    if (process.env.NODE_ENV === "development") {
      return { limited: false };
    }

    const byEmail = checkRateLimit(
      `donation:email:${donorEmail.trim().toLowerCase()}`,
      RATE_LIMITS.DONATION_EMAIL
    );

    return byEmail.limited
      ? { limited: true, response: tooManyRequests(byEmail.info) }
      : { limited: false };
  });
}
