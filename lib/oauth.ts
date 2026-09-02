import crypto from "crypto";
import jwt from "jsonwebtoken";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { JWT_SECRET } from "./jwt-secret";

/**
 * Social sign-in (Google, Apple) via the standard server-side
 * authorization-code flow. Identity is established solely from the provider's
 * ID token, verified against the provider's published JWKS with `jose` —
 * we never trust the `user` form field or query params for identity.
 *
 * Configuration follows the repo's graceful-degradation convention: a
 * provider whose env vars are missing is reported as not configured, and the
 * routes return a clear error instead of throwing at import time.
 *
 * Account linking rules (callback enforces these):
 *   1. A user row already carrying this provider id signs in.
 *   2. Otherwise, an existing row with the same email links the provider id —
 *      but ONLY when the provider asserts the email is verified. Linking on an
 *      unverified provider email would let an attacker who controls any
 *      unverified-address OAuth account take over a password account.
 *   3. Otherwise a new user is created with a random, unusable passwordHash;
 *      they can set a real password through the reset flow.
 */

export type OAuthProvider = "google" | "apple";

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "apple";
}

type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  issuer: string;
};

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function oauthRedirectUri(provider: OAuthProvider): string {
  return `${appUrl()}/api/auth/oauth/${provider}/callback`;
}

/**
 * Apple's token endpoint authenticates the client with a short-lived ES256
 * JWT instead of a static secret, signed with the private key downloaded from
 * the Apple developer portal. APPLE_PRIVATE_KEY may carry literal "\n"
 * escapes (env-file friendly); normalise before importing.
 */
function appleClientSecret(): string {
  const { APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = process.env;
  if (!APPLE_CLIENT_ID || !APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
    throw new Error("Apple sign-in is not fully configured");
  }
  const pem = APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const key = crypto.createPrivateKey(pem);
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: APPLE_TEAM_ID,
      iat: now,
      exp: now + 60 * 60 * 6, // Apple allows up to 6 months; 6 hours is plenty
      aud: "https://appleid.apple.com",
      sub: APPLE_CLIENT_ID,
    },
    key,
    { algorithm: "ES256", keyid: APPLE_KEY_ID }
  );
}

export function getProviderConfig(provider: OAuthProvider): ProviderConfig | null {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      clientId,
      clientSecret,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      jwksUrl: "https://www.googleapis.com/oauth2/v2/certs",
      issuer: "https://accounts.google.com",
    };
  }
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) {
    return null;
  }
  return {
    clientId,
    clientSecret: appleClientSecret(),
    authorizeUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    jwksUrl: "https://appleid.apple.com/auth/keys",
    issuer: "https://appleid.apple.com",
  };
}

export function configuredOAuthProviders(): Record<OAuthProvider, boolean> {
  return {
    google: getProviderConfig("google") !== null,
    apple: getProviderConfig("apple") !== null,
  };
}

export function buildAuthorizationUrl(provider: OAuthProvider, config: ProviderConfig, state: string): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", oauthRedirectUri(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  if (provider === "google") {
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("access_type", "online");
  } else {
    url.searchParams.set("scope", "name email");
    // Apple requires form_post whenever scopes are requested, so the callback
    // must accept POST as well as GET.
    url.searchParams.set("response_mode", "form_post");
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// State parameter
//
// The state JWT is the CSRF protection for the whole flow: it binds the
// browser (via the oauth_state cookie, double-submit) to the eventual
// callback and carries the post-login redirect so open-redirect validation
// happens exactly once, at signing time. 10 minutes is ample for a login.
// ---------------------------------------------------------------------------

const STATE_COOKIE = "oauth_state";
const STATE_TTL_SECONDS = 10 * 60;

export function createOAuthState(provider: OAuthProvider, redirect: string | null): string {
  return jwt.sign(
    { provider, redirect, nonce: crypto.randomBytes(16).toString("hex") },
    JWT_SECRET,
    { expiresIn: STATE_TTL_SECONDS }
  );
}

export function verifyOAuthState(token: string, provider: OAuthProvider): { redirect: string | null } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      provider?: string;
      redirect?: string | null;
    };
    if (payload.provider !== provider) return null;
    return { redirect: typeof payload.redirect === "string" ? payload.redirect : null };
  } catch {
    return null;
  }
}

export function oauthStateCookieName(): string {
  return STATE_COOKIE;
}

/**
 * Cookie attributes for the state cookie. Apple's form_post callback is a
 * cross-site POST, which SameSite=Lax strips — so in production the cookie
 * must be SameSite=None; Secure. That also means Apple sign-in cannot be
 * exercised over plain http locally; Google's GET redirect works with Lax.
 */
export function oauthStateCookieOptions(provider: OAuthProvider) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: (provider === "apple" && secure ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// Code exchange + ID token verification
// ---------------------------------------------------------------------------

export type OAuthIdentity = {
  providerSubject: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
};

export async function exchangeCodeForIdentity(
  provider: OAuthProvider,
  config: ProviderConfig,
  code: string
): Promise<OAuthIdentity> {
  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: oauthRedirectUri(provider),
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => "");
    throw new Error(`Token exchange failed (${tokenResponse.status}): ${detail.slice(0, 200)}`);
  }

  const { id_token: idToken } = (await tokenResponse.json()) as { id_token?: string };
  if (!idToken) throw new Error("Token response did not include an id_token");

  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: config.issuer,
    audience: config.clientId,
  });

  if (!payload.sub) throw new Error("ID token missing subject");
  if (!payload.email || typeof payload.email !== "string") {
    throw new Error("ID token missing email claim");
  }

  // Providers are not consistent about claim types: Apple encodes
  // email_verified as the string "true", Google as a boolean.
  const verifiedClaim = payload.email_verified;
  const emailVerified = verifiedClaim === true || verifiedClaim === "true";

  // Google's profile claims give us names directly. Apple's do not — Apple
  // sends the name once, in the form_post `user` field, which the callback
  // passes through separately; here we fall back to the email prefix.
  const fallbackName = payload.email.split("@")[0].slice(0, 50) || "Friend";
  const firstName =
    typeof payload.given_name === "string" && payload.given_name ? payload.given_name.slice(0, 50) : fallbackName;
  const lastName =
    typeof payload.family_name === "string" && payload.family_name ? payload.family_name.slice(0, 50) : "";

  return {
    providerSubject: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified,
    firstName,
    lastName,
  };
}

/**
 * Apple's one-time `user` form field: a JSON string shaped like
 * {"name":{"firstName":"...","lastName":"..."}}. Present only on the very
 * first authorization, and NOT identity-bearing (the ID token is), so it is
 * safe to use purely for display names.
 */
export function parseAppleUserField(raw: string | null): { firstName?: string; lastName?: string } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const first = parsed?.name?.firstName;
    const last = parsed?.name?.lastName;
    return {
      firstName: typeof first === "string" && first ? first.slice(0, 50) : undefined,
      lastName: typeof last === "string" && last ? last.slice(0, 50) : undefined,
    };
  } catch {
    return {};
  }
}
