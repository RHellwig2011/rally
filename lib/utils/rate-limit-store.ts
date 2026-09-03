/**
 * Shared rate-limit store: Upstash Redis over the REST protocol via plain
 * fetch() (no npm dependency, works in Edge middleware where ioredis does
 * not).
 *
 * Why this exists: the in-memory limiter in ./rate-limiter keeps every
 * counter in the local process heap, so N instances multiply every limit by
 * N and a cold start hands an attacker a fresh budget. This module makes the
 * global middleware limit (and any future caller) count against one shared
 * fixed window, so the budget is per-deployment regardless of instance
 * count or restarts.
 *
 * Configuration (either pair; the RATE_LIMIT_* names are accepted aliases):
 *   UPSTASH_REDIS_REST_URL    + UPSTASH_REDIS_REST_TOKEN
 *   RATE_LIMIT_REDIS_REST_URL + RATE_LIMIT_REDIS_REST_TOKEN
 *
 * Graceful degradation is a repo convention and applies here twice over:
 *   - env vars unset  -> the in-memory limiter is used directly;
 *   - Redis unreachable, slow (>1.5s), or returning errors -> that call
 *     falls back to the in-memory limiter.
 * Neither case ever throws and neither blocks the request; the first
 * fallback logs a single warning per process instead of spamming per
 * request. A limiter is a guard, not a gate: Redis being down must not
 * become a self-inflicted outage.
 *
 * Atomicity: the increment is a single Lua EVAL (INCR + conditional PEXPIRE)
 * executed atomically by Redis, so concurrent instances can never double-
 * count or race the window expiry. The window is fixed, keyed per
 * identifier with an `rl:` prefix.
 */

import rateLimiter from "./rate-limiter";

export interface SharedRateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface SharedRateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // epoch seconds
}

export interface SharedRateLimitResult {
  limited: boolean;
  info: SharedRateLimitInfo;
}

/** Short ceiling on any single Redis call so a slow store never stalls a request. */
const REDIS_TIMEOUT_MS = 1500;

const KEY_PREFIX = "rl:";

/**
 * INCR the bucket; on the first hit of a window start its TTL. Returns
 * [count, ttlMs]. A single EVAL keeps the read-modify-write atomic across
 * concurrent instances (unlike INCR + EXPIRE as two round trips).
 */
const INCR_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

function redisUrl(): string | null {
  return (
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.RATE_LIMIT_REDIS_REST_URL ??
    null
  );
}

function redisToken(): string | null {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.RATE_LIMIT_REDIS_REST_TOKEN ??
    null
  );
}

/**
 * True when both halves of a REST credential pair are present. Read at call
 * time (not module load) so misconfiguration can be fixed without a restart
 * and tests can vary the environment.
 */
export function isSharedRateLimitConfigured(): boolean {
  return Boolean(redisUrl() && redisToken());
}

let fallbackLogged = false;

function logFallbackOnce(error: unknown): void {
  if (fallbackLogged) return;
  fallbackLogged = true;
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(
    `Rate limit: Redis store unavailable (${detail}); falling back to the ` +
      "in-memory per-instance limiter. Limits will not be shared across " +
      "instances until UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are set."
  );
}

interface RedisCount {
  count: number;
  ttlMs: number;
}

/**
 * Run the atomic INCR script through the Upstash REST API. Throws on any
 * transport error, non-2xx, or malformed payload — callers degrade.
 */
async function redisIncrement(
  key: string,
  windowMs: number
): Promise<RedisCount> {
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) {
    throw new Error("Redis credentials not configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS);
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/eval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([INCR_SCRIPT, "1", key, String(windowMs)]),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Upstash responded ${response.status}`);
    }

    const payload = (await response.json()) as {
      result?: unknown;
      error?: string;
    };
    if (payload.error || !Array.isArray(payload.result)) {
      throw new Error(payload.error ?? "Unexpected Upstash response shape");
    }

    const [count, ttl] = payload.result as [unknown, unknown];
    if (typeof count !== "number" || typeof ttl !== "number" || ttl < 0) {
      throw new Error("Unexpected Upstash counter payload");
    }
    return { count, ttlMs: ttl };
  } finally {
    clearTimeout(timer);
  }
}

/** In-memory fallback; mirrors the sync checkRateLimit semantics. */
function memoryCheck(
  identifier: string,
  config: SharedRateLimitConfig
): SharedRateLimitResult {
  const limited = rateLimiter.isRateLimited(
    identifier,
    config.limit,
    config.windowMs
  );
  const info = rateLimiter.getRateLimitInfo(identifier, config.limit);
  return { limited, info };
}

/**
 * Increment the shared bucket for `identifier` and report whether the
 * request is over the limit. Never throws: any Redis problem downgrades to
 * the in-memory limiter for that call.
 *
 * Mirrors the rest of the rate-limit family by bypassing in development
 * (NODE_ENV is "test" under jest, so tests exercise the real logic).
 */
export async function checkSharedRateLimit(
  identifier: string,
  config: SharedRateLimitConfig
): Promise<SharedRateLimitResult> {
  if (process.env.NODE_ENV === "development") {
    return {
      limited: false,
      info: {
        limit: config.limit,
        remaining: config.limit,
        reset: Math.ceil((Date.now() + config.windowMs) / 1000),
      },
    };
  }

  if (isSharedRateLimitConfigured()) {
    try {
      const { count, ttlMs } = await redisIncrement(
        `${KEY_PREFIX}${identifier}`,
        config.windowMs
      );
      return {
        limited: count > config.limit,
        info: {
          limit: config.limit,
          remaining: Math.max(0, config.limit - count),
          reset: Math.ceil((Date.now() + ttlMs) / 1000),
        },
      };
    } catch (error) {
      logFallbackOnce(error);
    }
  }

  return memoryCheck(identifier, config);
}
