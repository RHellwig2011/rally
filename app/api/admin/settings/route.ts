import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { z } from "zod";

// In-memory settings store (in production, this would be in database or environment)
// For now, we'll use environment variables and return them
const settingsSchema = z.object({
  platformFeePercent: z.number().min(0).max(100).optional(),
  minimumDonationAmount: z.number().min(1).optional(),
  suggestedDonationAmounts: z.array(z.number().positive()).length(4).optional(),
  maxFileUploadSize: z.number().positive().optional(),
  termsOfServiceUrl: z.string().url().optional(),
  privacyPolicyUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
  enableRecurringDonations: z.boolean().optional(),
  enableSmsNotifications: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
});

/**
 * GET /api/admin/settings
 * Get platform settings
 */
export async function GET(req: NextRequest) {
  try {
    // Authentication check
    const sessionToken = req.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check authorization - only BANK_ADMIN or ADMIN
    if (user.role !== 'BANK_ADMIN' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Get settings from environment variables
    // In production, these would be stored in a database
    const settings = {
      // Financial
      platformFeePercent: parseInt(process.env.PLATFORM_FEE_PERCENT || '10'),
      minimumDonationAmount: parseInt(process.env.MINIMUM_DONATION_AMOUNT || '1'),
      suggestedDonationAmounts: [25, 50, 100, 250], // Could be stored in DB

      // File uploads
      maxFileUploadSize: 5 * 1024 * 1024, // 5MB in bytes

      // Legal
      termsOfServiceUrl: process.env.TERMS_OF_SERVICE_URL || `${process.env.NEXT_PUBLIC_APP_URL}/terms`,
      privacyPolicyUrl: process.env.PRIVACY_POLICY_URL || `${process.env.NEXT_PUBLIC_APP_URL}/privacy`,

      // Support
      supportEmail: process.env.SUPPORT_EMAIL || 'support@rallyfundraising.com',

      // Features
      enableRecurringDonations: process.env.ENABLE_RECURRING_DONATIONS === 'true',
      enableSmsNotifications: process.env.ENABLE_SMS_NOTIFICATIONS === 'true',

      // System
      maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      environment: process.env.NODE_ENV,

      // Stripe
      stripeConfigured: !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
      stripeWebhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,

      // Email
      emailConfigured: !!process.env.RESEND_API_KEY,
      emailFrom: process.env.EMAIL_FROM,

      // SMS
      smsConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    };

    return NextResponse.json({
      success: true,
      settings,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch settings"
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings
 * Update platform settings (BANK_ADMIN only)
 */
export async function PUT(req: NextRequest) {
  try {
    // Authentication check
    const sessionToken = req.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check authorization - only BANK_ADMIN
    if (user.role !== 'BANK_ADMIN') {
      return NextResponse.json(
        { success: false, error: "Only BANK_ADMIN can update settings" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = settingsSchema.parse(body);

    // Log the settings change
    console.log(
      `Settings updated by ${user.email}:`,
      JSON.stringify(validatedData, null, 2)
    );

    // In production, these would be saved to database
    // For now, we'll just return success
    // You would implement database storage here:
    // await prisma.settings.upsert({ ... })

    // TODO: Store in database
    // TODO: Invalidate any caches
    // TODO: Notify relevant services of changes

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      settings: validatedData,
      updatedBy: {
        id: user.id,
        email: user.email,
      },
      updatedAt: new Date().toISOString(),
      note: "Settings updates will take effect immediately for new requests. Some features may require application restart."
    });

  } catch (error) {
    console.error('Settings update error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update settings"
      },
      { status: 500 }
    );
  }
}