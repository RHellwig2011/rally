import prisma from "./prisma";
// @ts-expect-error - bcryptjs types not found during build
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { JWT_SECRET } from "./jwt-secret";

const JWT_EXPIRES_IN = "15m";
export const ACCESS_TOKEN_MAX_AGE_SEC = 15 * 60;
export const REFRESH_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30);

// Loop guard for walking the replacedById chain during reuse detection.
const REVOKE_CHAIN_MAX_DEPTH = 100;

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
};

function toPublicUser(user: any): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    emailVerified: user.emailVerified === true,
  };
}

export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  phone?: string;
  termsAccepted?: boolean;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("Email already in use");
  if (!data.termsAccepted) throw new Error("Terms must be accepted");

  const passwordHash = await bcrypt.hash(data.password, 10);

  // Generate email verification token
  const verificationToken = generateRandomToken(32);
  const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: (data.role as any) || undefined,
      verificationToken,
      verificationTokenExpiry,
      emailVerified: false,
      termsAcceptedAt: new Date(),
    },
  });

  return { user: toPublicUser(user), verificationToken };
}

export function generateJwt(payload: { id: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJwt(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; role: string; iat: number; exp: number };
  } catch (err) {
    return null;
  }
}

export async function getUserFromToken(token?: string) {
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) return null;
  return toPublicUser(user);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateRandomToken(size = 64) {
  return crypto.randomBytes(size).toString("hex");
}

async function createRefreshTokenRecord(userId: string, tokenHash: string, ip?: string) {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  return prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
      createdByIp: ip,
    },
  });
}

export async function createRefreshToken(userId: string, ip?: string) {
  const raw = generateRandomToken(48);
  const tokenHash = hashToken(raw);
  await createRefreshTokenRecord(userId, tokenHash, ip);
  return raw;
}

/**
 * Revoke the whole user's outstanding tokens, then annotate the replacedById
 * chain descended from `startId` with the reason.
 *
 * Only called once a replay is confirmed (see rotateRefreshToken): the token
 * presented was already rotated away AND its successor has itself been used, so
 * two different holders are minting sessions from one chain. There is no way to
 * tell which of them is the legitimate client, so the safe response is to kill
 * the entire family and force both back through login. Same reasoning as the
 * mass-revoke in resetPassword.
 *
 * Ordering matters. The user-wide revoke runs FIRST and the chain walk is
 * best-effort inside its own try/catch, so a dangling or corrupted
 * replacedById link can never leave another device's token live — the previous
 * version walked first with `update()`, which raises P2025 on a missing row and
 * aborted family revocation entirely.
 */
async function revokeRefreshTokenFamily(
  startId: string,
  userId: string,
  ip?: string
) {
  const revocation = {
    revoked: true,
    revokedAt: new Date(),
    revokedByIp: ip,
    reason: "reuse_detected",
  };

  await prisma.$transaction(async (tx) => {
    // Everything still live for this user, including siblings the chain does
    // not reach — a token minted by a parallel login is equally suspect once
    // the account is known to be compromised.
    await tx.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: revocation,
    });

    // Then record the reason on each already-revoked link of the chain, so the
    // audit trail shows where the replay was detected. Bounded by
    // REVOKE_CHAIN_MAX_DEPTH: replacedById is a self-relation and a corrupted
    // row could otherwise loop forever. updateMany + findUnique so a missing
    // row is a no-op rather than a throw, and the whole walk is wrapped
    // because it must never cost us the revoke above.
    try {
      const seen = new Set<string>();
      let cursor: string | null = startId;

      for (let depth = 0; cursor && depth < REVOKE_CHAIN_MAX_DEPTH; depth++) {
        if (seen.has(cursor)) break;
        seen.add(cursor);

        await tx.refreshToken.updateMany({
          where: { id: cursor },
          data: revocation,
        });

        const link: { replacedById: string | null } | null =
          await tx.refreshToken.findUnique({
            where: { id: cursor },
            select: { replacedById: true },
          });

        cursor = link?.replacedById ?? null;
      }
    } catch (chainError) {
      console.error(
        `Refresh token chain annotation failed for user ${userId}; family revoke already applied:`,
        chainError
      );
    }
  });
}

export async function rotateRefreshToken(oldRawToken: string, ip?: string) {
  const tokenHash = hashToken(oldRawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) throw new Error("Invalid refresh token");

  if (existing.revoked) {
    // Reuse detection. An expired-and-revoked token is just an old token aging
    // out normally, so only an unexpired one is worth examining.
    if (existing.expiresAt > new Date()) {
      // A revoked-but-unexpired token is not automatically theft. The common
      // case is a lost response: the server committed the rotation, the reply
      // never reached the client (timeout, dropped connection, double-submit),
      // and the client retries with the token it still holds. Revoking the
      // family there logs a legitimate user out of every device on a flaky
      // network.
      //
      // The distinguishing signal is the successor. If it is still unused, at
      // most one holder has ever rotated this chain, so this is a retry: fail
      // the request only. If the successor has itself been used — it is
      // revoked, or it already points at a successor of its own — then two
      // different holders are rotating the same chain, which is the real reuse
      // signal, and the family goes.
      //
      // Refresh tokens are stored as hashes (see hashToken), so the successor's
      // raw value cannot be recovered and the retry cannot be answered
      // idempotently with the token pair it lost. The client gets a 401 and
      // logs in again — but keeps its other sessions.
      const successor = existing.replacedById
        ? await prisma.refreshToken.findUnique({
            where: { id: existing.replacedById },
            select: { revoked: true, replacedById: true },
          })
        : null;

      const successorWasUsed =
        !existing.replacedById || // rotated away with no successor recorded
        !successor || // successor row is gone; cannot vouch for the chain
        successor.revoked ||
        successor.replacedById !== null;

      if (successorWasUsed) {
        await revokeRefreshTokenFamily(existing.id, existing.userId, ip);
        throw new Error("Refresh token reuse detected");
      }
    }
    throw new Error("Refresh token revoked");
  }

  if (existing.expiresAt <= new Date()) throw new Error("Refresh token expired");

  // create a new refresh token
  const newRaw = generateRandomToken(48);
  const newHash = hashToken(newRaw);
  const newRecord = await createRefreshTokenRecord(existing.userId, newHash, ip);

  // revoke old token and link
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: {
      revoked: true,
      revokedAt: new Date(),
      revokedByIp: ip,
      replacedById: newRecord.id,
    },
  });

  return { userId: existing.userId, refreshToken: newRaw };
}

export async function revokeRefreshToken(rawToken: string, ip?: string) {
  const hash = hashToken(rawToken);
  const rec = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (!rec) return false;
  if (rec.revoked) return true;
  await prisma.refreshToken.update({ where: { id: rec.id }, data: { revoked: true, revokedAt: new Date(), revokedByIp: ip } });
  return true;
}

export async function loginUser(email: string, password: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Invalid credentials");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Invalid credentials");

  const token = generateJwt({ id: user.id, role: user.role });
  const refresh = await createRefreshToken(user.id, ip);
  return { token, refresh, user: toPublicUser(user) };
}

/**
 * Verify user email with token
 */
export async function verifyEmail(token: string) {
  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token,
      verificationTokenExpiry: {
        gte: new Date(),
      },
    },
  });

  if (!user) {
    throw new Error("Invalid or expired verification token");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    },
  });

  return toPublicUser(user);
}

/**
 * Request password reset - generates token and returns it
 * The calling code should send this token via email
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Don't reveal if user exists or not (security best practice)
  if (!user) {
    // Return a fake token to prevent user enumeration
    return generateRandomToken(32);
  }

  const resetToken = generateRandomToken(32);
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetToken,
      passwordResetTokenExpiry: resetTokenExpiry,
    },
  });

  return resetToken;
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetTokenExpiry: {
        gte: new Date(),
      },
    },
  });

  if (!user) {
    throw new Error("Invalid or expired password reset token");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    // Consume the reset token as part of the same conditional write, so two
    // concurrent submissions of the same token cannot both succeed.
    const consumed = await tx.user.updateMany({
      where: {
        id: user.id,
        passwordResetToken: token,
        passwordResetTokenExpiry: { gte: new Date() },
      },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      },
    });

    if (consumed.count === 0) {
      throw new Error("Invalid or expired password reset token");
    }

    // A password reset exists to evict whoever compromised the account, so
    // every outstanding refresh token dies with the old password. Without
    // this, a stolen refresh token keeps minting fresh 30-day sessions
    // indefinitely via rotateRefreshToken.
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: {
        revoked: true,
        revokedAt: new Date(),
        reason: "password_reset",
      },
    });
  });

  return toPublicUser(user);
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.emailVerified) {
    throw new Error("Email already verified");
  }

  // Generate new verification token
  const verificationToken = generateRandomToken(32);
  const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken,
      verificationTokenExpiry,
    },
  });

  return verificationToken;
}

export default {
  registerUser,
  loginUser,
  generateJwt,
  verifyJwt,
  getUserFromToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  resendVerificationEmail,
};
