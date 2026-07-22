import { jwtVerify } from "jose";
import { JWT_SECRET } from "../jwt-secret";

export interface EdgeJwtPayload {
  id: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Edge-runtime-safe JWT verification for middleware.
 *
 * Tokens are signed with `jsonwebtoken` (HS256) in lib/auth.ts, which relies
 * on Node's crypto module and cannot run in the Edge runtime. `jose` verifies
 * the same HS256 tokens using Web Crypto, so middleware can validate sessions.
 */
export async function verifyJwtEdge(
  token: string
): Promise<EdgeJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    return payload as unknown as EdgeJwtPayload;
  } catch {
    return null;
  }
}
