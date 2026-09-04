import { NextRequest, NextResponse } from "next/server";
import {
  handleResendWebhookEvent,
  verifyResendWebhookSignature,
  type ResendWebhookEvent,
} from "@/lib/resend-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resend
 *
 * Resend (Svix) webhook for email.opened / email.clicked. Public: Resend
 * posts here with no session. Authorization is the Svix HMAC on
 * svix-id / svix-timestamp / svix-signature, verified with
 * RESEND_WEBHOOK_SECRET. Fails closed (401) if the secret is unset or the
 * signature is invalid — same convention as the Stripe webhook, except we
 * never skip verification.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET is not configured — refusing Resend webhook");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 401 }
    );
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 401 }
    );
  }

  const payload = await req.text();

  const valid = verifyResendWebhookSignature({
    payload,
    svixId,
    svixTimestamp,
    svixSignature,
    secret,
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(payload) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleResendWebhookEvent(event);
  } catch (error) {
    console.error("Resend webhook handler failed:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
