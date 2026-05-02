import prisma from "./prisma";
// @ts-expect-error - bcryptjs types not found during build
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = "15m"; // access token lifetime

const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30);

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

function toPublicUser(user: any): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
}

export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  phone?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("Email already in use");

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

export async function rotateRefreshToken(oldRawToken: string, ip?: string) {
  const tokenHash = hashToken(oldRawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) throw new Error("Invalid refresh token");
  if (existing.revoked) throw new Error("Refresh token revoked");
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

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpiry: null,
    },
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
