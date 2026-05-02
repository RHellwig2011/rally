import { NextRequest, NextResponse } from 'next/server';
import { runCampaignAutomation } from '@/lib/utils/campaign-automation';

/**
 * POST /api/cron/campaign-automation
 * Runs automated campaign status checks and updates
 *
 * This endpoint should be called by a cron job (e.g., daily)
 * You can use services like:
 * - Vercel Cron Jobs (vercel.json)
 * - GitHub Actions (scheduled workflow)
 * - External cron services (cron-job.org, EasyCron, etc.)
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.warn('CRON_SECRET not configured - automation endpoint is unprotected');
    } else if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🤖 Campaign automation triggered via API');

    // Run automation
    const results = await runCampaignAutomation();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        campaignsAutoCompleted: results.autoCompleted,
        remindersSent: results.reminders,
        warningsFound: results.warnings,
        errors: results.errors,
      },
    });
  } catch (error) {
    console.error('Campaign automation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Automation failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/campaign-automation
 * Manual trigger (useful for testing)
 */
export async function GET(req: NextRequest) {
  // Check for admin authorization
  // TODO: Add proper admin auth check once we have session management

  try {
    const results = await runCampaignAutomation();

    return NextResponse.json({
      success: true,
      message: 'Manual campaign automation completed',
      timestamp: new Date().toISOString(),
      results: {
        campaignsAutoCompleted: results.autoCompleted,
        remindersSent: results.reminders,
        warningsFound: results.warnings,
        errors: results.errors,
      },
    });
  } catch (error) {
    console.error('Campaign automation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Automation failed',
      },
      { status: 500 }
    );
  }
}
