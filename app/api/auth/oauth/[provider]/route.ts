import { NextRequest, NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  createOAuthState,
  getProviderConfig,
  isOAuthProvider,
  oauthStateCookieName,
  oauthStateCookieOptions,
} from "@/lib/oauth";

/**
 * Same rule as the login page: a leading "/" is not enough — "//evil.com" is
 * scheme-relative and "/\evil.com" normalises off-origin. Rejecting here
 * (before the value is ever signed into state) means the callback can trust
 * the redirect it verifies without re-checking.
 */
function isSameSitePath(redirect: string) {
  return (
    redirect.startsWith("/") &&
    !redirect.startsWith("//") &&
    !redirect.includes("\\")
  );
}

/**
 * GET /api/auth/oauth/[provider] — start the social sign-in flow.
 *
 * Public by design (under the /api/auth/ prefix in middleware): the state
 * cookie + signed state param are the CSRF protection, not the session.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider;
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "Unknown sign-in provider" }, { status: 404 });
  }

  const config = getProviderConfig(provider);
  if (!config) {
    // Graceful degradation: the feature is off until env vars are set.
    return NextResponse.redirect(
      new URL(`/login?error=oauth_not_configured`, req.nextUrl.origin)
    );
  }

  const rawRedirect = req.nextUrl.searchParams.get("redirect");
  const redirect = rawRedirect && isSameSitePath(rawRedirect) ? rawRedirect : null;

  const state = createOAuthState(provider, redirect);
  const response = NextResponse.redirect(buildAuthorizationUrl(provider, config, state));
  response.cookies.set(oauthStateCookieName(), state, oauthStateCookieOptions(provider));
  return response;
}
