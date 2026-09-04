import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/health
 *
 * Liveness + database readiness probe for uptime monitors and deploy smoke
 * tests. Public by design (registered in middleware.ts's publicExactRoutes):
 * a health check behind auth cannot be reached by an external monitor.
 *
 * Deliberately says as little as possible. It reports whether the process is
 * up and whether it can reach Postgres — nothing about versions, connection
 * strings, table contents, or error details, since any of those would be a
 * free reconnaissance endpoint for an unauthenticated caller. The specific
 * failure is logged server-side instead.
 *
 * `sms.inboundWebhook` is the one deliberate exception, and it is a status word
 * rather than a configuration dump. Without TWILIO_AUTH_TOKEN the inbound
 * webhook cannot verify Twilio's signature and refuses every request, so STOP
 * keywords are never recorded — and because outbound SMS can authenticate with
 * an API Key instead, sending keeps working and nothing surfaces the break.
 * That silence is the hazard: the first evidence would be a TCPA complaint. It
 * discloses no secret and aids no attacker (the route fails closed either way,
 * so "unverifiable" means the endpoint rejects the attacker too).
 *
 * The HTTP status stays driven by the database alone. A credential that still
 * needs setting is a deploy defect, not an outage, and should not page whoever
 * is on call for uptime — alert on the field instead.
 *
 * 200 { status: "ok" }        — app is up and the database answered
 * 503 { status: "degraded" }  — app is up but the database did not answer
 */

/**
 * Can inbound Twilio webhooks verify their signature?
 *
 *   "disabled"     — Twilio is not configured at all; inbound is moot.
 *   "ok"           — the Auth Token is present, so signatures can be checked.
 *   "unverifiable" — SMS is configured but TWILIO_AUTH_TOKEN is missing, so
 *                    every inbound STOP is being refused. Alert on this.
 */
function inboundWebhookStatus(): "disabled" | "ok" | "unverifiable" {
  if (!process.env.TWILIO_ACCOUNT_SID) return "disabled";
  return process.env.TWILIO_AUTH_TOKEN ? "ok" : "unverifiable";
}

// Never cache: a cached health check reports the past, which is the one thing
// a health check must not do.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const sms = { inboundWebhook: inboundWebhookStatus() };

  try {
    // Cheapest possible round-trip that proves the connection actually works.
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: "ok", database: "ok", sms },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Health check failed to reach the database:", error);

    return NextResponse.json(
      { status: "degraded", database: "unreachable", sms },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
