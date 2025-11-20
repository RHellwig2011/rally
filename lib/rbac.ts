import { PublicUser } from "./auth";

export function hasRole(user: PublicUser | null | undefined, roles: string | string[]) {
  if (!user) return false;
  const wanted = Array.isArray(roles) ? roles : [roles];
  return wanted.includes(user.role as string);
}

export function requireRole(user: PublicUser | null | undefined, roles: string | string[]) {
  if (!hasRole(user, roles)) {
    const wanted = Array.isArray(roles) ? roles.join(", ") : roles;
    throw new Error(`Requires role: ${wanted}`);
  }
  return true;
}

export default { hasRole, requireRole };
