import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { reconcilePendingDonations } from "@/lib/reconcile-donations";

/**
 * Reconcile stranded PENDING donations against Stripe.
 *
 * Webhook retries exhaust after ~3 days. If payment_intent.succeeded was
 * dropped (handler 500 + donor closed the verify tab), money sits collected
 * at Stripe while the donation never credits. This job retrieves each aged
 * PENDING PaymentIntent and completeDonation's conditional claim settles it
 * exactly-once. Abandoned checkouts (no PI, canceled, requires_payment_method)
 * are expired PENDING → FAILED. In-flight 3DS is left alone.
 *
 * Security: fails CLOSED when CRON_SECRET is unset.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerTokenMatches(authHeader: string | null, secret: string): boolean {
  if (!authHeader) return false;

  const expected = `Bearer ${secret}`;
  const provided = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);

  if (provided.length !== expectedBuf.length) return false;

  return timingSafeEqual(provided, expectedBuf);
}

function authorizeCronRequest(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error(
      "CRON_SECRET is not configured - donation reconcile endpoint is disabled"
    );
    return NextResponse.json(
      { success: false, error: "Automation endpoint is not configured" },
      { status: 503 }
    );
  }

  if (!bearerTokenMatches(req.headers.get("authorization"), cronSecret)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null;
}

async function handleCronRequest(req: NextRequest, method: "GET" | "POST") {
  const unauthorized = authorizeCronRequest(req);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    console.log(
      `Donation reconcile triggered via ${method} /api/cron/reconcile-donations`
    );

    const results = await reconcilePendingDonations();

    if (results.errors.length > 0) {
      console.error("Donation reconcile errors:", results.errors);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error("Donation reconcile error:", error);
    return NextResponse.json(
      { success: false, error: "Reconcile failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleCronRequest(req, "POST");
}

export async function GET(req: NextRequest) {
  return handleCronRequest(req, "GET");
}
