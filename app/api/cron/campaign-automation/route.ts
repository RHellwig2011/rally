import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runCampaignAutomation } from '@/lib/utils/campaign-automation';

/**
 * Campaign automation cron endpoint.
 *
 * This endpoint should be called by a cron job (e.g., daily). You can use
 * services like:
 * - Vercel Cron Jobs (vercel.json)
 * - GitHub Actions (scheduled workflow)
 * - External cron services (cron-job.org, EasyCron, etc.)
 *
 * Both GET and POST are supported (some schedulers only issue GETs) and both
 * require the same `Authorization: Bearer ${CRON_SECRET}` header.
 *
 * Security: fails CLOSED. If CRON_SECRET is not configured the endpoint is
 * disabled entirely rather than running unauthenticated - this handler mutates
 * campaign status and sends email to leaders and guardians.
 */

// Node runtime: uses crypto.timingSafeEqual
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Constant-time bearer token comparison so the secret can't be recovered by
 * timing the response.
 */
function bearerTokenMatches(authHeader: string | null, secret: string): boolean {
  if (!authHeader) return false;

  const expected = `Bearer ${secret}`;
  const provided = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);

  // timingSafeEqual throws when lengths differ, so guard first. The length of
  // the secret is not meaningfully sensitive.
  if (provided.length !== expectedBuf.length) return false;

  return timingSafeEqual(provided, expectedBuf);
}

/**
 * Authorize a cron invocation. Returns a NextResponse to short-circuit with,
 * or null when the caller is authorized.
 */
function authorizeCronRequest(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // Fail closed: never run automation without a configured secret.
    console.error(
      'CRON_SECRET is not configured - campaign automation endpoint is disabled'
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Automation endpoint is not configured',
      },
      { status: 503 }
    );
  }

  if (!bearerTokenMatches(req.headers.get('authorization'), cronSecret)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null;
}

/**
 * Run the automation and shape the JSON response. Shared by GET and POST.
 */
async function handleCronRequest(req: NextRequest, method: 'GET' | 'POST') {
  const unauthorized = authorizeCronRequest(req);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    console.log(`Campaign automation triggered via ${method} /api/cron/campaign-automation`);

    const results = await runCampaignAutomation();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        campaignsAutoCompleted: results.autoCompleted,
        remindersSent: results.reminders,
        warningsFound: results.warnings,
        errors: results.errors,
        outreachClaimed: results.outreachClaimed,
        outreachSent: results.outreachSent,
        outreachFailed: results.outreachFailed,
        goalsStretched: results.goalsStretched,
      },
    });
  } catch (error) {
    // Log the detail server-side; never return raw error messages to callers.
    console.error('Campaign automation error:', error);
    return NextResponse.json(
      { success: false, error: 'Automation failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/campaign-automation
 * Requires: Authorization: Bearer ${CRON_SECRET}
 */
export async function POST(req: NextRequest) {
  return handleCronRequest(req, 'POST');
}

/**
 * GET /api/cron/campaign-automation
 * Same automation as POST, for schedulers that only issue GET requests.
 * Requires: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  return handleCronRequest(req, 'GET');
}
