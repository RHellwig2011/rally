/**
 * @jest-environment node
 *
 * Regression coverage for two rate-limiting defects:
 *  - client identifiers derived from a spoofable X-Forwarded-For header, which
 *    let any caller mint a fresh bucket per request;
 *  - authentication endpoints with no throttle at all.
 *
 * NODE_ENV is "test" under jest, so the development bypasses are inactive and
 * the real limiting logic runs.
 */

function makeReq(headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers,
  }) as any;
}

describe("FINDING 2: X-Forwarded-For spoofing", () => {
  const load = () => {
    let mod: any;
    jest.isolateModules(() => {
      mod = require("@/lib/utils/rate-limiter");
    });
    return mod;
  };

  test("default (TRUSTED_PROXY_HOPS unset) ignores XFF entirely: rotating XFF cannot mint buckets", () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    const { getClientIdentifier } = load();

    const keys = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      keys.add(
        getClientIdentifier(makeReq({ "x-forwarded-for": `10.0.${i >> 8}.${i % 256}` }))
      );
    }
    expect([...keys]).toEqual(["ip:unknown"]);
  });

  test("x-real-ip is also ignored when no proxy is declared", () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    const { getClientIdentifier } = load();
    expect(getClientIdentifier(makeReq({ "x-real-ip": "9.9.9.9" }))).toBe("ip:unknown");
  });

  test("with TRUSTED_PROXY_HOPS=1 a prepended spoof loses to the proxy-appended hop", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const { getClientIdentifier } = load();

    // Attacker prepends "1.2.3.4"; our proxy appends the true peer "203.0.113.7".
    expect(
      getClientIdentifier(makeReq({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))
    ).toBe("ip:203.0.113.7");

    // Rotating the spoofed left-hand entry does not change the bucket.
    const keys = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      keys.add(
        getClientIdentifier(makeReq({ "x-forwarded-for": `10.0.0.${i % 256}, 203.0.113.7` }))
      );
    }
    expect([...keys]).toEqual(["ip:203.0.113.7"]);
  });

  test("with TRUSTED_PROXY_HOPS=2 the client sits two entries from the right", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const { getClientIdentifier } = load();
    expect(
      getClientIdentifier(
        makeReq({ "x-forwarded-for": "1.1.1.1, 203.0.113.7, 172.16.0.1" })
      )
    ).toBe("ip:203.0.113.7");
  });

  test("junk / non-IP values never become bucket keys", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const { getClientIdentifier } = load();
    for (const bad of ["not-an-ip", "999.999.999.999", "'; DROP TABLE", "", "1.2.3.4.5"]) {
      expect(getClientIdentifier(makeReq({ "x-forwarded-for": bad }))).toBe("ip:unknown");
    }
  });

  test("lib/utils/rate-limit.ts getRateLimitIdentifier has the same behaviour", () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    let mod: any;
    jest.isolateModules(() => {
      mod = require("@/lib/utils/rate-limit");
    });
    const keys = new Set<string>();
    for (let i = 0; i < 500; i++) {
      keys.add(
        mod.getRateLimitIdentifier(makeReq({ "x-forwarded-for": `10.0.0.${i % 256}` }))
      );
    }
    expect([...keys]).toEqual(["ip:unknown"]);
    expect(mod.getRateLimitIdentifier(makeReq(), "user-123")).toBe("user:user-123");
  });
});

describe("FINDING 3: auth throttling", () => {
  const load = () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    let mod: any;
    jest.isolateModules(() => {
      mod = require("@/lib/utils/rate-limiter");
    });
    return mod;
  };

  test("failed logins for one account are cut off after 5, across DIFFERENT IPs", () => {
    const { checkLoginRateLimit, recordFailedLogin } = load();
    const email = "victim@example.com";

    const results: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      // each attempt from a different (trusted) source IP
      const req = makeReq({ "x-forwarded-for": `spoof, 198.51.100.${i}` });
      const check = checkLoginRateLimit(req, email);
      results.push(check.limited);
      if (!check.limited) recordFailedLogin(email);
    }
    expect(results).toEqual([false, false, false, false, false, true, true, true]);
  });

  test("a correct password never burns the account budget (no self-lockout)", () => {
    const { checkLoginRateLimit, clearFailedLogins } = load();
    const email = "goodguy@example.com";
    for (let i = 0; i < 20; i++) {
      const check = checkLoginRateLimit(makeReq({ "x-forwarded-for": "s, 198.51.100.9" }), email);
      expect(check.limited).toBe(false);
      clearFailedLogins(email); // successful login
    }
  });

  test("429 response carries Retry-After and RateLimit headers", () => {
    const { checkLoginRateLimit, recordFailedLogin } = load();
    const email = "hdrs@example.com";
    for (let i = 0; i < 5; i++) {
      checkLoginRateLimit(makeReq({ "x-forwarded-for": "s, 198.51.100.20" }), email);
      recordFailedLogin(email);
    }
    const blocked = checkLoginRateLimit(
      makeReq({ "x-forwarded-for": "s, 198.51.100.20" }),
      email
    );
    expect(blocked.limited).toBe(true);
    expect(blocked.response.status).toBe(429);
    expect(blocked.response.headers.get("Retry-After")).toBeTruthy();
    expect(blocked.response.headers.get("X-RateLimit-Limit")).toBe("5");
  });

  test("per-IP bucket stops credential spraying across MANY accounts from one IP", () => {
    const { checkAuthRateLimit } = load();
    let blockedAt = -1;
    for (let i = 0; i < 100; i++) {
      const check = checkAuthRateLimit(
        makeReq({ "x-forwarded-for": `s, 198.51.100.77` }),
        `spray${i}@example.com`
      );
      if (check.limited) {
        blockedAt = i;
        break;
      }
    }
    expect(blockedAt).toBe(60); // RATE_LIMITS.AUTH_IP.limit
  });

  test("resend-verification style per-account bucket stops mail-bombing one inbox", () => {
    const { checkAuthRateLimit } = load();
    const email = "bombme@example.com";
    let blockedAt = -1;
    for (let i = 0; i < 20; i++) {
      // different IP every time - the ACCOUNT bucket must still bite
      const check = checkAuthRateLimit(
        makeReq({ "x-forwarded-for": `s, 203.0.113.${i}` }),
        email
      );
      if (check.limited) {
        blockedAt = i;
        break;
      }
    }
    expect(blockedAt).toBe(5); // RATE_LIMITS.AUTH.limit
  });

  test("email bucket is case/whitespace normalised", () => {
    const { checkAuthRateLimit } = load();
    let blockedAt = -1;
    const variants = ["Case@Example.com", " case@example.com ", "CASE@EXAMPLE.COM"];
    for (let i = 0; i < 20; i++) {
      const check = checkAuthRateLimit(
        makeReq({ "x-forwarded-for": `s, 203.0.113.${i}` }),
        variants[i % variants.length]
      );
      if (check.limited) {
        blockedAt = i;
        break;
      }
    }
    expect(blockedAt).toBe(5);
  });
});
