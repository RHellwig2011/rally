// Session management utilities
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  expiresAt: number;
}

export async function createSession(data: Omit<SessionData, 'expiresAt'>) {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  const session = await new SignJWT({ ...data, expiresAt })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET_KEY);

  (await cookies()).set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });

  return session;
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(sessionCookie.value, SECRET_KEY);

    if (!payload.expiresAt || Date.now() > (payload.expiresAt as number)) {
      return null;
    }

    return payload as SessionData;
  } catch (error) {
    return null;
  }
}

export async function deleteSession() {
  (await cookies()).delete('session');
}

export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

export async function requireRole(allowedRoles: string[]) {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.role)) {
    throw new Error('Forbidden');
  }

  return session;
}
