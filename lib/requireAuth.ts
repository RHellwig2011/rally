import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, getUserFromToken, PublicUser } from "./auth";
import { UserRole } from "@prisma/client";

export type AuthenticatedRequest = NextRequest & {
  user?: PublicUser;
};

/**
 * Get user from request (checks both Authorization header and cookie)
 */
export async function getUserFromRequest(req: NextRequest): Promise<PublicUser | null> {
  // First, try Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      const token = parts[1];
      const user = await getUserFromToken(token);
      if (user) return user;
    }
  }

  // Fallback to cookie
  const sessionToken = req.cookies.get("sessionToken")?.value;
  if (sessionToken) {
    const user = await getUserFromToken(sessionToken);
    if (user) return user;
  }

  return null;
}

/**
 * Middleware to require authentication
 * Returns the user if authenticated, or throws a 401 response
 */
export async function requireAuth(req: NextRequest): Promise<PublicUser> {
  const user = await getUserFromRequest(req);

  if (!user) {
    throw NextResponse.json(
      { success: false, error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }

  return user;
}

/**
 * Middleware to require specific role(s)
 * Returns the user if authenticated and has required role, or throws a 403 response
 */
export async function requireRole(
  req: NextRequest,
  roles: UserRole | UserRole[]
): Promise<PublicUser> {
  const user = await requireAuth(req);

  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(user.role as UserRole)) {
    throw NextResponse.json(
      {
        success: false,
        error: `Forbidden. Required role: ${allowedRoles.join(" or ")}`
      },
      { status: 403 }
    );
  }

  return user;
}

/**
 * Middleware to require campaign leader role
 */
export async function requireCampaignLeader(req: NextRequest): Promise<PublicUser> {
  return requireRole(req, UserRole.CAMPAIGN_LEADER);
}

/**
 * Middleware to require guardian role
 */
export async function requireGuardian(req: NextRequest): Promise<PublicUser> {
  return requireRole(req, UserRole.GUARDIAN);
}

/**
 * Middleware to require bank admin role
 */
export async function requireBankAdmin(req: NextRequest): Promise<PublicUser> {
  return requireRole(req, UserRole.BANK_ADMIN);
}

/**
 * Helper to create unauthorized response
 */
export function unauthorized(message: string = "Unauthorized") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

/**
 * Helper to create forbidden response
 */
export function forbidden(message: string = "Forbidden") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

/**
 * Wrapper function to protect API routes with authentication
 * Usage:
 *
 * export const POST = withAuth(async (req, user) => {
 *   // user is guaranteed to be authenticated
 *   return NextResponse.json({ data: "protected" });
 * });
 */
export function withAuth(
  handler: (req: NextRequest, user: PublicUser) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any) => {
    try {
      const user = await requireAuth(req);
      return handler(req, user);
    } catch (error) {
      if (error instanceof NextResponse) {
        return error;
      }
      return NextResponse.json(
        { success: false, error: "Authentication failed" },
        { status: 401 }
      );
    }
  };
}

/**
 * Wrapper function to protect API routes with role-based authentication
 * Usage:
 *
 * export const POST = withRole(UserRole.CAMPAIGN_LEADER, async (req, user) => {
 *   // user is guaranteed to be authenticated and have CAMPAIGN_LEADER role
 *   return NextResponse.json({ data: "protected" });
 * });
 */
export function withRole(
  roles: UserRole | UserRole[],
  handler: (req: NextRequest, user: PublicUser) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any) => {
    try {
      const user = await requireRole(req, roles);
      return handler(req, user);
    } catch (error) {
      if (error instanceof NextResponse) {
        return error;
      }
      return NextResponse.json(
        { success: false, error: "Authorization failed" },
        { status: 403 }
      );
    }
  };
}

// Backwards compatibility alias
export const verifyAuth = requireAuth;

export default {
  getUserFromRequest,
  requireAuth,
  verifyAuth,
  requireRole,
  requireCampaignLeader,
  requireGuardian,
  requireBankAdmin,
  unauthorized,
  forbidden,
  withAuth,
  withRole,
};
