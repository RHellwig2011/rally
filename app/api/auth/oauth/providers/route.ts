import { NextResponse } from "next/server";
import { configuredOAuthProviders } from "@/lib/oauth";

/**
 * GET /api/auth/oauth/providers — which social sign-in providers are
 * configured. Login/signup pages use this to hide buttons for providers
 * whose env vars are missing (graceful degradation).
 *
 * Note: the static "providers" segment takes precedence over the [provider]
 * dynamic route, so this never collides with a provider named "providers".
 */
export async function GET() {
  return NextResponse.json(configuredOAuthProviders());
}
