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
 * 200 { status: "ok" }        — app is up and the database answered
 * 503 { status: "degraded" }  — app is up but the database did not answer
 */

// Never cache: a cached health check reports the past, which is the one thing
// a health check must not do.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Cheapest possible round-trip that proves the connection actually works.
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: "ok", database: "ok" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Health check failed to reach the database:", error);

    return NextResponse.json(
      { status: "degraded", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
