import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { recordOptOut, matchesOptOutKeyword } from "@/lib/suppression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/twilio-inbound
 *
 * Inbound SMS webhook. Twilio posts an application/x-www-form-urlencoded body
 * whenever someone texts our number. We look for a revocation keyword and, if
 * we find one, record the opt-out SYNCHRONOUSLY before replying — the reply
 * confirms the opt-out, so it must not be able to confirm something that
 * hasn't been persisted.
 *
 * TCPA: consumers may revoke consent "in any reasonable manner". These seven
 * keywords must be honored within 10 business days; we do it immediately.
 *
 * PUBLIC ROUTE: Twilio posts here with no session. /api/webhooks/* is already
 * excluded from the middleware matcher and from CSRF, so no middleware change
 * is required for this path.
 */

// Keyword matching lives in lib/suppression.ts — Next.js route modules may
// only export HTTP handlers and route config.

function twiml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/**
 * Verify the X-Twilio-Signature header.
 *
 * This route sits outside the middleware matcher (/api/webhooks/* is excluded)
 * and takes no session, so the signature is the ONLY gate. A forged POST
 * writes a ContactOptOut row for an attacker-chosen phone number and
 * permanently corrupts the TCPA consent ledger.
 *
 * It therefore fails CLOSED: a missing TWILIO_AUTH_TOKEN refuses the request
 * rather than waving it through. The local-dev escape hatch is an explicit
 * ALLOW_UNSIGNED_WEBHOOKS=true opt-in that is inert in production — the same
 * precedent as app/api/webhooks/stripe/route.ts. The absence of a secret is
 * never itself permission to skip verification.
 *
 * TWILIO_AUTH_TOKEN specifically, and not whatever credential outbound SMS
 * happens to use. Twilio computes X-Twilio-Signature as an HMAC-SHA1 over the
 * URL and sorted params keyed by the account Auth Token, so an API Key
 * (TWILIO_API_KEY_SID/SECRET) cannot validate it — twilio.validateRequest()
 * takes the Auth Token and nothing else. lib/services/sms.ts prefers API Keys
 * for OUTBOUND, which means an API-key-only deployment sends fine while every
 * inbound STOP is refused here and no opt-out is ever recorded. That failure is
 * invisible from the sending side, so GET /api/health reports it as
 * sms.inboundWebhook = "unverifiable"; see .env.example.
 */
function verifySignature(
  request: NextRequest,
  url: string,
  params: Record<string, string>
): { ok: boolean; reason?: string } {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  const allowUnsigned =
    process.env.ALLOW_UNSIGNED_WEBHOOKS === "true" &&
    process.env.NODE_ENV !== "production";

  if (allowUnsigned) {
    console.warn(
      "⚠️  ALLOW_UNSIGNED_WEBHOOKS: skipping Twilio signature verification. " +
        "Anyone who can reach this URL can forge opt-outs. Never set this in production."
    );
    return { ok: true };
  }

  if (!authToken) {
    console.error(
      "TWILIO_AUTH_TOKEN is not configured — refusing inbound SMS webhook, so " +
        "this STOP was NOT recorded. An API Key cannot stand in here: Twilio " +
        "signs inbound webhooks with the account Auth Token. Set " +
        "TWILIO_AUTH_TOKEN (in addition to any API Key used for sending), or " +
        "ALLOW_UNSIGNED_WEBHOOKS=true outside production to test locally."
    );
    return { ok: false, reason: "TWILIO_AUTH_TOKEN is not configured" };
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) {
    return { ok: false, reason: "Missing X-Twilio-Signature header" };
  }

  const valid = twilio.validateRequest(authToken, signature, url, params);
  return valid ? { ok: true } : { ok: false, reason: "Invalid X-Twilio-Signature" };
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();

    const params: Record<string, string> = {};
    form.forEach((value, key) => {
      if (typeof value === "string") params[key] = value;
    });

    // Twilio signs the exact URL it posted to. Behind a proxy the forwarded
    // host/proto are authoritative; fall back to the request URL locally.
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const signedUrl =
      forwardedProto && forwardedHost
        ? `${forwardedProto}://${forwardedHost}${request.nextUrl.pathname}${request.nextUrl.search}`
        : request.url;

    const signatureCheck = verifySignature(request, signedUrl, params);
    if (!signatureCheck.ok) {
      console.error("Rejected inbound Twilio webhook:", signatureCheck.reason);
      return NextResponse.json({ error: signatureCheck.reason }, { status: 403 });
    }

    const from = params.From || "";
    const body = params.Body || "";

    if (!from) {
      console.error("Inbound Twilio webhook missing From");
      return twiml();
    }

    const keyword = matchesOptOutKeyword(body);

    if (!keyword) {
      // Not a revocation — acknowledge with an empty TwiML so Twilio doesn't
      // retry and we don't auto-reply to normal conversation.
      return twiml();
    }

    // Record synchronously. If this throws we must NOT tell them they're
    // unsubscribed.
    await recordOptOut({
      phone: from,
      channel: "SMS",
      source: "SMS_STOP",
      note: `Inbound SMS keyword: "${keyword}"`,
    });

    console.log(`🔕 SMS opt-out recorded via inbound keyword "${keyword}"`);

    return twiml(
      "You've been unsubscribed and will not receive any more messages from Bleacher Backers. Reply HELP for help."
    );
  } catch (error) {
    console.error("Error handling inbound Twilio webhook:", error);
    // 500 makes Twilio retry, which is what we want: a dropped STOP is a
    // compliance failure.
    return NextResponse.json(
      { error: "Failed to process inbound message" },
      { status: 500 }
    );
  }
}
