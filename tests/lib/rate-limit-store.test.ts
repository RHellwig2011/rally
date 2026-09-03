/**
 * @jest-environment node
 *
 * Coverage for the Redis-backed shared rate-limit store (H17):
 *  - with UPSTASH_REDIS_REST_URL/TOKEN set, counters live in Redis (fetch
 *    is mocked — these tests never touch a network) and over-limit requests
 *    are blocked;
 *  - when fetch rejects or returns an error, the check falls back to the
 *    in-memory limiter (which still counts and blocks) and logs once;
 *  - with the env vars unset, the in-memory limiter is used and fetch is
 *    never called.
 *
 * NODE_ENV is "test" under jest, so the development bypass is inactive and
 * the real logic runs.
 */

const ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RATE_LIMIT_REDIS_REST_URL",
  "RATE_LIMIT_REDIS_REST_TOKEN",
] as const;

function clearRedisEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function loadStore() {
  let mod: typeof import("@/lib/utils/rate-limit-store");
  jest.isolateModules(() => {
    mod = require("@/lib/utils/rate-limit-store");
  });
  // isolateModules re-evaluates the store module but not its rate-limiter
  // import; clear any buckets leaked between tests.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("@/lib/utils/rate-limiter").default.resetAll();
  return mod!;
}

/** A fetch mock that behaves like Upstash's EVAL endpoint, counting locally. */
function makeUpstashFetch() {
  const counts = new Map<string, number>();
  const calls: { url: string; body: unknown }[] = [];
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    const [script, numkeys, key, windowMs] = JSON.parse(String(init?.body)) as [
      string,
      string,
      string,
      string
    ];
    expect(typeof script).toBe("string");
    expect(numkeys).toBe("1");
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return {
      ok: true,
      json: async () => ({ result: [count, Number(windowMs)] }),
    } as Response;
  });
  return { fetchMock, calls };
}

describe("checkSharedRateLimit", () => {
  let warnSpy: jest.SpyInstance;
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearRedisEnv();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.restoreAllMocks();
    (global as { fetch: unknown }).fetch = originalFetch;
    clearRedisEnv();
  });

  test("unset env vars: uses the in-memory limiter and never calls fetch", async () => {
    const fetchMock = jest.fn();
    (global as { fetch: unknown }).fetch = fetchMock;
    const { checkSharedRateLimit } = loadStore();

    const config = { limit: 2, windowMs: 60_000 };
    const r1 = await checkSharedRateLimit("ip:1.2.3.4", config);
    const r2 = await checkSharedRateLimit("ip:1.2.3.4", config);
    const r3 = await checkSharedRateLimit("ip:1.2.3.4", config);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(r1.limited).toBe(false);
    expect(r2.limited).toBe(false);
    expect(r3.limited).toBe(true);
    expect(r3.info.remaining).toBe(0);
  });

  test("Redis path: counts via fetch and blocks over the limit", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const { fetchMock, calls } = makeUpstashFetch();
    (global as { fetch: unknown }).fetch = fetchMock;
    const { checkSharedRateLimit, isSharedRateLimitConfigured } = loadStore();

    expect(isSharedRateLimitConfigured()).toBe(true);

    const config = { limit: 3, windowMs: 15 * 60_000 };
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await checkSharedRateLimit("user:42", config));
    }

    expect(results.map((r) => r.limited)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(results[0].info.remaining).toBe(2);
    expect(results[3].info.remaining).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // One atomic EVAL per call, authorized, against the /eval endpoint, with
    // the bucket key namespaced and the window forwarded.
    const { url, body } = calls[0];
    expect(url).toBe("https://fake.upstash.io/eval");
    expect(Array.isArray(body)).toBe(true);
    const [script, numkeys, key, windowMs] = body as string[];
    expect(typeof script).toBe("string");
    expect(numkeys).toBe("1");
    expect(key).toBe("rl:user:42");
    expect(windowMs).toBe(String(15 * 60_000));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("RATE_LIMIT_REDIS_REST_URL/TOKEN aliases are accepted when Upstash vars are unset", async () => {
    process.env.RATE_LIMIT_REDIS_REST_URL = "https://alias.upstash.io";
    process.env.RATE_LIMIT_REDIS_REST_TOKEN = "token";
    const { fetchMock, calls } = makeUpstashFetch();
    (global as { fetch: unknown }).fetch = fetchMock;
    const { checkSharedRateLimit, isSharedRateLimitConfigured } = loadStore();

    expect(isSharedRateLimitConfigured()).toBe(true);
    await checkSharedRateLimit("ip:9.9.9.9", { limit: 5, windowMs: 60_000 });
    expect(calls[0].url).toBe("https://alias.upstash.io/eval");
  });

  test("fetch rejects: falls back to memory (still counts/blocks) and logs once", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const fetchMock = jest.fn(async () => {
      throw new Error("connection refused");
    });
    (global as { fetch: unknown }).fetch = fetchMock;
    const { checkSharedRateLimit } = loadStore();

    const config = { limit: 2, windowMs: 60_000 };
    const r1 = await checkSharedRateLimit("ip:5.6.7.8", config);
    const r2 = await checkSharedRateLimit("ip:5.6.7.8", config);
    const r3 = await checkSharedRateLimit("ip:5.6.7.8", config);

    // Redis was attempted every time, then the memory limiter decided.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect([r1.limited, r2.limited, r3.limited]).toEqual([false, false, true]);
    // One warning per process, not one per failed request.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/falling back/);
  });

  test("non-ok Redis response: falls back to memory", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as Response);
    (global as { fetch: unknown }).fetch = fetchMock;
    const { checkSharedRateLimit } = loadStore();

    const config = { limit: 1, windowMs: 60_000 };
    const r1 = await checkSharedRateLimit("ip:10.0.0.1", config);
    const r2 = await checkSharedRateLimit("ip:10.0.0.1", config);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect([r1.limited, r2.limited]).toEqual([false, true]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  test("Redis payload with an error field: falls back to memory", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ error: "ERR unknown command" }),
    }) as Response);
    (global as { fetch: unknown }).fetch = fetchMock;
    const { checkSharedRateLimit } = loadStore();

    const r = await checkSharedRateLimit("ip:10.0.0.2", {
      limit: 1,
      windowMs: 60_000,
    });
    expect(r.limited).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  test("distinct identifiers get distinct shared buckets", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const { fetchMock, calls } = makeUpstashFetch();
    (global as { fetch: unknown }).fetch = fetchMock;
    const { checkSharedRateLimit } = loadStore();

    const config = { limit: 1, windowMs: 60_000 };
    await checkSharedRateLimit("ip:1.1.1.1", config);
    const other = await checkSharedRateLimit("ip:2.2.2.2", config);

    expect(other.limited).toBe(false);
    const keys = calls.map((c) => (c.body as string[])[2]);
    expect(new Set(keys).size).toBe(2);
  });
});
