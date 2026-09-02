/**
 * Suppression list — the single chokepoint every outbound message must pass.
 *
 * ContactOptOut is the system of record for "this person told us to stop".
 * Nothing in the product may dispatch a marketing email or an SMS without
 * first asking isSuppressed()/filterSuppressed().
 *
 * FAIL CLOSED: if the lookup throws (DB blip, migration in flight, pool
 * exhaustion) we treat the recipient as SUPPRESSED and log loudly. A dropped
 * message is a support ticket; an unlawful message is $500-$1,500 per message
 * under the TCPA and a CAN-SPAM violation. Never fail open.
 */

import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import type { OptOutChannel, OptOutSource } from "@prisma/client";

import { JWT_SECRET } from "@/lib/jwt-secret";

export type SuppressionChannel = OptOutChannel;

export interface SuppressionQuery {
  email?: string | null;
  phone?: string | null;
  channel: SuppressionChannel;
  programId?: string | null;
}

/** Lowercase + trim. Opt-out matching on email is case-insensitive. */
export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Digits only, last 10. This makes "+1 (555) 010-1234", "5550101234" and
 * "1-555-010-1234" all match the same opt-out row regardless of the format
 * the number happened to be stored in.
 */
export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/**
 * True when this recipient has opted out of this channel.
 *
 * Matches a ContactOptOut row when ALL of:
 *  - the row's channel is ALL, or equals the requested channel
 *  - the row's programId is NULL (global opt-out) or equals programId
 *  - the row's normalized email or normalized phone equals the recipient's
 *
 * Returns TRUE on any error (fail closed).
 */
export async function isSuppressed(query: SuppressionQuery): Promise<boolean> {
  const email = normalizeEmail(query.email);
  const phone = normalizePhone(query.phone);
  const programId = query.programId ?? null;

  // Nothing addressable => nothing to check. Callers validate recipients.
  if (!email && !phone) return false;

  try {
    // Raw SQL because phone numbers are stored in whatever format they were
    // captured in; normalization has to happen inside the comparison.
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "ContactOptOut"
      WHERE ("programId" IS NULL OR "programId" = ${programId}::text)
        AND (
          "channel" = 'ALL'::"OptOutChannel"
          OR "channel" = ${query.channel}::"OptOutChannel"
          OR ${query.channel}::text = 'ALL'
        )
        AND (
          (
            ${email}::text IS NOT NULL
            AND "email" IS NOT NULL
            AND lower(btrim("email")) = ${email}::text
          )
          OR (
            ${phone}::text IS NOT NULL
            AND "phone" IS NOT NULL
            AND right(regexp_replace("phone", '[^0-9]', '', 'g'), 10) = ${phone}::text
          )
        )
      LIMIT 1
    `;

    return rows.length > 0;
  } catch (error) {
    console.error(
      "🚨 SUPPRESSION LOOKUP FAILED — failing closed and treating recipient as suppressed.",
      { channel: query.channel, programId, hasEmail: !!email, hasPhone: !!phone },
      error
    );
    return true;
  }
}

export interface FilterSuppressedResult<T> {
  allowed: T[];
  suppressed: T[];
}

/**
 * Batch version of isSuppressed for fan-out sends. Each recipient is checked
 * independently so one bad lookup only suppresses that recipient.
 */
export async function filterSuppressed<
  T extends { email?: string | null; phone?: string | null }
>(
  recipients: T[],
  channel: SuppressionChannel,
  programId?: string | null
): Promise<FilterSuppressedResult<T>> {
  const verdicts = await Promise.all(
    recipients.map((r) =>
      isSuppressed({ email: r.email, phone: r.phone, channel, programId })
    )
  );

  const allowed: T[] = [];
  const suppressed: T[] = [];

  recipients.forEach((recipient, i) => {
    (verdicts[i] ? suppressed : allowed).push(recipient);
  });

  return { allowed, suppressed };
}

/**
 * filterSuppressed issues one DB query per recipient inside a single unbounded
 * Promise.all. Feeding it a whole roster at once opens hundreds of simultaneous
 * connections and can exhaust the pool, so partitionSuppressed hands it bounded
 * batches instead.
 */
export const SUPPRESSION_LOOKUP_BATCH = 25;

/**
 * Pool-safe filterSuppressed. This is the helper every fan-out send path should
 * use; call filterSuppressed directly only for a handful of recipients whose
 * count is already bounded.
 */
export async function partitionSuppressed<
  T extends { email?: string | null; phone?: string | null }
>(
  recipients: T[],
  channel: SuppressionChannel,
  programId?: string | null
): Promise<FilterSuppressedResult<T>> {
  const allowed: T[] = [];
  const suppressed: T[] = [];

  for (let i = 0; i < recipients.length; i += SUPPRESSION_LOOKUP_BATCH) {
    const batch = recipients.slice(i, i + SUPPRESSION_LOOKUP_BATCH);
    const result = await filterSuppressed(batch, channel, programId);
    allowed.push(...result.allowed);
    suppressed.push(...result.suppressed);
  }

  return { allowed, suppressed };
}

export interface RecordOptOutInput {
  email?: string | null;
  phone?: string | null;
  channel: SuppressionChannel;
  source: OptOutSource;
  programId?: string | null;
  note?: string | null;
}

/**
 * Record an opt-out. Idempotent: re-submitting the same unsubscribe link or
 * texting STOP twice will not pile up duplicate rows. ContactOptOut has no
 * unique constraint (email/phone are both nullable and either may identify a
 * row), so this is a find-then-create rather than a true upsert.
 */
export async function recordOptOut(input: RecordOptOutInput): Promise<{
  created: boolean;
  id: string | null;
}> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  if (!email && !phone) {
    throw new Error("recordOptOut requires an email or a phone number");
  }

  const programId = input.programId ?? null;

  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "ContactOptOut"
    WHERE "channel" = ${input.channel}::"OptOutChannel"
      AND (
        ("programId" IS NULL AND ${programId}::text IS NULL)
        OR "programId" = ${programId}::text
      )
      AND (
        (
          ${email}::text IS NOT NULL
          AND "email" IS NOT NULL
          AND lower(btrim("email")) = ${email}::text
        )
        OR (
          ${phone}::text IS NOT NULL
          AND "phone" IS NOT NULL
          AND right(regexp_replace("phone", '[^0-9]', '', 'g'), 10) = ${phone}::text
        )
      )
    LIMIT 1
  `;

  if (existing.length > 0) {
    return { created: false, id: existing[0].id };
  }

  const row = await prisma.contactOptOut.create({
    data: {
      email,
      // Store the normalized 10-digit form; matching normalizes both sides
      // anyway, but a consistent store makes manual DB inspection sane.
      phone,
      channel: input.channel,
      source: input.source,
      programId,
      note: input.note ?? null,
    },
    select: { id: true },
  });

  return { created: true, id: row.id };
}

/* ------------------------------------------------------------------ */
/* Inbound SMS revocation keywords                                     */
/* ------------------------------------------------------------------ */

/**
 * The seven revocation keywords we are required to honor. Under the TCPA a
 * consumer may revoke consent "in any reasonable manner"; these must be
 * actioned within 10 business days (we do it immediately).
 */
export const OPT_OUT_KEYWORDS = [
  "stop",
  "quit",
  "end",
  "revoke",
  "opt out",
  "cancel",
  "unsubscribe",
];

/** Variants carriers treat as equivalent to STOP. */
const OPT_OUT_ALIASES = ["stopall", "optout", "unsub"];

/**
 * Returns the matched revocation keyword, or null if the message isn't one.
 *
 * Exact-matches the trimmed, punctuation-stripped body rather than
 * substring-matching: "please don't stop sending me updates" must NOT opt
 * someone out, and "can you cancel my donation?" is not a revocation.
 */
export function matchesOptOutKeyword(body: string): string | null {
  const normalized = body
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (OPT_OUT_ALIASES.includes(normalized.replace(/[\s-]/g, ""))) {
    return normalized;
  }

  return OPT_OUT_KEYWORDS.includes(normalized) ? normalized : null;
}

/* ------------------------------------------------------------------ */
/* Tokenized unsubscribe links                                         */
/* ------------------------------------------------------------------ */

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function signPayload(payload: string): string {
  return base64url(createHmac("sha256", JWT_SECRET).update(payload).digest());
}

/**
 * Build a self-verifying unsubscribe token. HMAC-SHA256 over
 * "<normalized email>:<channel>" keyed with JWT_SECRET — no extra table, and
 * the link stays valid indefinitely (CAN-SPAM requires at least 30 days; an
 * unsubscribe link that expires is a compliance liability, not a feature).
 */
export function createUnsubscribeToken(
  email: string,
  channel: SuppressionChannel = "ALL"
): string {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("createUnsubscribeToken requires an email");

  const payload = `${normalized}:${channel}`;
  return `${base64url(Buffer.from(payload, "utf8"))}.${signPayload(payload)}`;
}

/**
 * Verify an unsubscribe token in constant time.
 * Returns null for anything malformed, tampered with, or wrongly signed.
 */
export function verifyUnsubscribeToken(
  token: string | null | undefined
): { email: string; channel: SuppressionChannel } | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSig] = parts;

  let payload: string;
  try {
    payload = fromBase64url(encodedPayload).toString("utf8");
  } catch {
    return null;
  }

  const expectedSig = signPayload(payload);

  // Length check first so timingSafeEqual never throws; the length of a
  // signature is not secret.
  const provided = Buffer.from(providedSig, "utf8");
  const expected = Buffer.from(expectedSig, "utf8");
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  const sep = payload.lastIndexOf(":");
  if (sep <= 0) return null;

  const email = normalizeEmail(payload.slice(0, sep));
  const channel = payload.slice(sep + 1) as SuppressionChannel;

  if (!email) return null;
  if (channel !== "ALL" && channel !== "EMAIL" && channel !== "SMS") return null;

  return { email, channel };
}

/** Absolute URL of the tokenized unsubscribe endpoint for this address. */
export function unsubscribeUrl(
  email: string,
  channel: SuppressionChannel = "ALL"
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/api/unsubscribe?token=${encodeURIComponent(
    createUnsubscribeToken(email, channel)
  )}`;
}

/**
 * Headers + footer markup that must accompany every non-transactional email.
 * CAN-SPAM: working opt-out mechanism + valid physical postal address.
 */
export const POSTAL_ADDRESS =
  process.env.MAILING_ADDRESS || "Bleacher Backers, 1207 Delaware Ave #1234, Wilmington, DE 19806";

export function unsubscribeHeaders(email: string): Record<string, string> {
  const url = unsubscribeUrl(email);
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function unsubscribeFooterHtml(email: string): string {
  const url = unsubscribeUrl(email);
  return `
  <div style="max-width:600px;margin:24px auto 0;padding:16px 20px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.6;">
    <p style="margin:0 0 6px 0;">${POSTAL_ADDRESS}</p>
    <p style="margin:0;">
      Don't want these emails?
      <a href="${url}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>`;
}

export function unsubscribeFooterText(email: string): string {
  return `\n\n---\n${POSTAL_ADDRESS}\nUnsubscribe: ${unsubscribeUrl(email)}\n`;
}
