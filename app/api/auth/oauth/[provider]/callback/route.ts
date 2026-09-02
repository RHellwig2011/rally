import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createRefreshToken, generateJwt } from "@/lib/auth";
import {
  exchangeCodeForIdentity,
  getProviderConfig,
  isOAuthProvider,
  oauthStateCookieName,
  parseAppleUserField,
  verifyOAuthState,
  type OAuthIdentity,
  type OAuthProvider,
} from "@/lib/oauth";

/**
 * GET+POST /api/auth/oauth/[provider]/callback — finish the social sign-in.
 *
 * GET is the normal redirect flow (Google). POST exists because Apple
 * requires response_mode=form_post when scopes are requested: its servers
 * POST the code/state/user fields to us. Both shapes share handleCallback.
 *
 * Errors redirect back to /login?error=<code> rather than returning JSON —
 * the browser arrived here by navigation, not fetch.
 */

function errorRedirect(origin: string, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, origin));
}

/** Mirrors the login page's destinationFor(). */
function destinationFor(role: string, redirect: string | null) {
  if (redirect) return redirect; // already validated same-site before signing
  if (role === "ADMIN" || role === "BANK_ADMIN") return "/admin";
  if (role === "PLAYER") return "/player";
  return "/campaigns";
}

async function findOrCreateUser(
  provider: OAuthProvider,
  identity: OAuthIdentity,
  appleName: { firstName?: string; lastName?: string }
) {
  const providerField = provider === "google" ? "googleId" : "appleId";

  // 1. Returning OAuth user.
  const byProviderId = await prisma.user.findUnique({
    where: { [providerField]: identity.providerSubject } as any,
  });
  if (byProviderId) return byProviderId;

  const firstName = appleName.firstName || identity.firstName;
  const lastName = appleName.lastName || identity.lastName;

  // 2. Existing password account with the same email: link ONLY when the
  //    provider verified that address (see lib/oauth.ts for the why).
  const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
  if (byEmail) {
    if (!identity.emailVerified) {
      throw new Error("unverified_email");
    }
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { [providerField]: identity.providerSubject } as any,
    });
  }

  // 3. New account. The random passwordHash is unusable for login; the user
  //    can set a real password through the reset flow. A verified provider
  //    email counts as verified here (Google/Apple confirmed ownership).
  return prisma.user.create({
    data: {
      email: identity.email,
      passwordHash: crypto.randomBytes(48).toString("hex"),
      firstName,
      lastName,
      emailVerified: identity.emailVerified,
      [providerField]: identity.providerSubject,
    } as any,
  });
}

async function handleCallback(
  req: NextRequest,
  providerParam: string,
  fields: { code: string | null; state: string | null; user: string | null; error: string | null }
) {
  const origin = req.nextUrl.origin;

  if (!isOAuthProvider(providerParam)) {
    return NextResponse.json({ error: "Unknown sign-in provider" }, { status: 404 });
  }
  const provider = providerParam;

  // Provider-side failure (user cancelled, etc.) — Apple/Google both send
  // an error back to the redirect_uri.
  if (fields.error) {
    return errorRedirect(origin, "oauth_cancelled");
  }

  const config = getProviderConfig(provider);
  if (!config) return errorRedirect(origin, "oauth_not_configured");

  if (!fields.code || !fields.state) return errorRedirect(origin, "oauth_failed");

  // Double-submit: the state param must match the cookie AND verify as a
  // state we signed for this provider.
  const cookieState = req.cookies.get(oauthStateCookieName())?.value;
  if (!cookieState || cookieState !== fields.state) {
    return errorRedirect(origin, "oauth_state_mismatch");
  }
  const state = verifyOAuthState(fields.state, provider);
  if (!state) return errorRedirect(origin, "oauth_state_mismatch");

  let identity: OAuthIdentity;
  try {
    identity = await exchangeCodeForIdentity(provider, config, fields.code);
  } catch (err) {
    console.error(`OAuth ${provider} token exchange/verification failed:`, err);
    return errorRedirect(origin, "oauth_failed");
  }

  let user;
  try {
    user = await findOrCreateUser(provider, identity, parseAppleUserField(fields.user));
  } catch (err) {
    if (err instanceof Error && err.message === "unverified_email") {
      return errorRedirect(origin, "oauth_unverified_email");
    }
    console.error(`OAuth ${provider} account provisioning failed:`, err);
    return errorRedirect(origin, "oauth_failed");
  }

  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "") as string;
  const token = generateJwt({ id: user.id, role: user.role });
  const refresh = await createRefreshToken(user.id, ip);

  const response = NextResponse.redirect(
    new URL(destinationFor(user.role, state.redirect), origin)
  );

  // Attributes identical to /api/auth/login and /api/auth/refresh — a session
  // minted here must be indistinguishable from a password login.
  response.cookies.set("sessionToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  response.cookies.set("refresh_token", refresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
  // State cookie is single-use.
  response.cookies.set(oauthStateCookieName(), "", { path: "/", maxAge: 0 });

  return response;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  return handleCallback(req, params.provider, {
    code: req.nextUrl.searchParams.get("code"),
    state: req.nextUrl.searchParams.get("state"),
    user: null,
    error: req.nextUrl.searchParams.get("error"),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const form = await req.formData().catch(() => null);
  if (!form) return errorRedirect(req.nextUrl.origin, "oauth_failed");
  return handleCallback(req, params.provider, {
    code: (form.get("code") as string) || null,
    state: (form.get("state") as string) || null,
    user: (form.get("user") as string) || null,
    error: (form.get("error") as string) || null,
  });
}
