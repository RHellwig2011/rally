/**
 * Resend webhook signature verification and open/click tracking.
 *
 * No svix SDK — HMAC-SHA256 over "id.timestamp.payload" with the base64
 * secret after the whsec_ prefix, matching Svix's signing scheme that Resend
 * uses. Fail closed: missing secret or bad signature is the caller's problem
 * to refuse, not ours to wave through.
 */

import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";

/** Svix recommends rejecting payloads whose timestamp is older than this. */
export const RESEND_WEBHOOK_TOLERANCE_SECONDS = 300;

export function verifyResendWebhookSignature(opts: {
  payload: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  secret: string;
  nowSeconds?: number;
}): boolean {
  const { payload, svixId, svixTimestamp, svixSignature, secret } = opts;

  if (!secret || !svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > RESEND_WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const secretPart = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(secretPart, "base64");
  } catch {
    return false;
  }
  if (key.length === 0) {
    return false;
  }

  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expected = createHmac("sha256", key).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected);

  const candidates = svixSignature.split(/[\s]+/).filter(Boolean);
  for (const part of candidates) {
    const comma = part.indexOf(",");
    if (comma === -1) continue;
    const version = part.slice(0, comma);
    const sig = part.slice(comma + 1);
    if (version !== "v1" || !sig) continue;

    const provided = Buffer.from(sig);
    if (provided.length !== expectedBuf.length) continue;
    if (timingSafeEqual(provided, expectedBuf)) {
      return true;
    }
  }

  return false;
}

export interface ResendWebhookEvent {
  type?: string;
  data?: {
    email_id?: string;
    emailId?: string;
  };
}

function emailIdFromEvent(event: ResendWebhookEvent): string | null {
  const id = event.data?.email_id || event.data?.emailId;
  return id && id.length > 0 ? id : null;
}

/**
 * First open: set openedAt, status OPENED (unless already CLICKED), increment
 * OutreachCampaign.emailsOpened. Redeliveries no-op because openedAt is set.
 */
export async function applyResendOpen(providerMessageId: string): Promise<{
  updated: boolean;
}> {
  const log = await prisma.outreachLog.findFirst({
    where: { providerMessageId, type: "EMAIL" },
    select: { id: true, outreachCampaignId: true, status: true, openedAt: true },
  });

  if (!log) {
    return { updated: false };
  }

  const data: { openedAt: Date; status?: "OPENED" } = { openedAt: new Date() };
  if (log.status !== "CLICKED") {
    data.status = "OPENED";
  }

  const result = await prisma.outreachLog.updateMany({
    where: { id: log.id, openedAt: null },
    data,
  });

  if (result.count !== 1) {
    return { updated: false };
  }

  await prisma.outreachCampaign.update({
    where: { id: log.outreachCampaignId },
    data: { emailsOpened: { increment: 1 } },
  });

  return { updated: true };
}

/**
 * First click: set clickedAt, status CLICKED, increment linksClicked.
 * Redeliveries no-op because clickedAt is set.
 */
export async function applyResendClick(providerMessageId: string): Promise<{
  updated: boolean;
}> {
  const log = await prisma.outreachLog.findFirst({
    where: { providerMessageId, type: "EMAIL" },
    select: { id: true, outreachCampaignId: true },
  });

  if (!log) {
    return { updated: false };
  }

  const result = await prisma.outreachLog.updateMany({
    where: { id: log.id, clickedAt: null },
    data: {
      clickedAt: new Date(),
      status: "CLICKED",
    },
  });

  if (result.count !== 1) {
    return { updated: false };
  }

  await prisma.outreachCampaign.update({
    where: { id: log.outreachCampaignId },
    data: { linksClicked: { increment: 1 } },
  });

  return { updated: true };
}

/**
 * Dispatch a verified Resend webhook event. Unknown types are ignored so
 * Resend does not retry them.
 */
export async function handleResendWebhookEvent(
  event: ResendWebhookEvent
): Promise<{ handled: boolean }> {
  const emailId = emailIdFromEvent(event);
  if (!emailId) {
    return { handled: false };
  }

  if (event.type === "email.opened") {
    await applyResendOpen(emailId);
    return { handled: true };
  }

  if (event.type === "email.clicked") {
    await applyResendClick(emailId);
    return { handled: true };
  }

  return { handled: false };
}
