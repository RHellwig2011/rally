// jose ships pure ESM which this Jest setup (CJS) cannot parse, and next/jest
// force-prepends its own /node_modules/ transformIgnorePatterns so the usual
// "transform jose too" config fix does not apply. The tests below never touch
// token verification, so stub the module before lib/oauth imports it.
jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import {
  buildAuthorizationUrl,
  createOAuthState,
  getProviderConfig,
  isOAuthProvider,
  parseAppleUserField,
  verifyOAuthState,
} from "@/lib/oauth";

const ENV_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "APPLE_CLIENT_ID",
  "APPLE_TEAM_ID",
  "APPLE_KEY_ID",
  "APPLE_PRIVATE_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

describe("lib/oauth", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe("isOAuthProvider", () => {
    it("accepts known providers and rejects anything else", () => {
      expect(isOAuthProvider("google")).toBe(true);
      expect(isOAuthProvider("apple")).toBe(true);
      expect(isOAuthProvider("facebook")).toBe(false);
      expect(isOAuthProvider("")).toBe(false);
      expect(isOAuthProvider("../admin")).toBe(false);
    });
  });

  describe("getProviderConfig", () => {
    it("returns null when a provider is not configured (graceful degradation)", () => {
      expect(getProviderConfig("google")).toBeNull();
      expect(getProviderConfig("apple")).toBeNull();
    });

    it("returns null when only some of a provider's vars are set", () => {
      process.env.GOOGLE_CLIENT_ID = "id-only";
      expect(getProviderConfig("google")).toBeNull();
    });

    it("builds a Google config when both vars are set", () => {
      process.env.GOOGLE_CLIENT_ID = "gid";
      process.env.GOOGLE_CLIENT_SECRET = "gsecret";
      const config = getProviderConfig("google");
      expect(config).not.toBeNull();
      expect(config!.clientId).toBe("gid");
      expect(config!.issuer).toBe("https://accounts.google.com");
    });
  });

  describe("buildAuthorizationUrl", () => {
    it("includes client_id, redirect_uri, state, and openid scope for Google", () => {
      process.env.GOOGLE_CLIENT_ID = "gid";
      process.env.GOOGLE_CLIENT_SECRET = "gsecret";
      process.env.NEXT_PUBLIC_APP_URL = "https://rally.example.com";
      const config = getProviderConfig("google")!;
      const url = new URL(buildAuthorizationUrl("google", config, "state-123"));
      expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url.searchParams.get("client_id")).toBe("gid");
      expect(url.searchParams.get("state")).toBe("state-123");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "https://rally.example.com/api/auth/oauth/google/callback"
      );
      expect(url.searchParams.get("scope")).toBe("openid email profile");
    });
  });

  describe("OAuth state", () => {
    it("round-trips a redirect for the same provider", () => {
      const state = createOAuthState("google", "/create-campaign");
      expect(verifyOAuthState(state, "google")).toEqual({ redirect: "/create-campaign" });
    });

    it("rejects a state minted for a different provider", () => {
      const state = createOAuthState("google", "/campaigns");
      expect(verifyOAuthState(state, "apple")).toBeNull();
    });

    it("rejects a tampered state", () => {
      const state = createOAuthState("google", "/campaigns");
      const tampered = state.slice(0, -2) + "xx";
      expect(verifyOAuthState(tampered, "google")).toBeNull();
    });

    it("round-trips a null redirect", () => {
      const state = createOAuthState("apple", null);
      expect(verifyOAuthState(state, "apple")).toEqual({ redirect: null });
    });
  });

  describe("parseAppleUserField", () => {
    it("parses Apple's one-time user JSON", () => {
      expect(
        parseAppleUserField(JSON.stringify({ name: { firstName: "Jane", lastName: "Coach" } }))
      ).toEqual({ firstName: "Jane", lastName: "Coach" });
    });

    it("returns empty object for null or malformed input", () => {
      expect(parseAppleUserField(null)).toEqual({});
      expect(parseAppleUserField("not json")).toEqual({});
      expect(parseAppleUserField("{}")).toEqual({ firstName: undefined, lastName: undefined });
    });
  });
});
