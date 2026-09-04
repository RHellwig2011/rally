import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { checkCsrf } from "@/lib/csrf";

const settingsSchema = z
  .object({
    platformFeePercent: z.number().min(0).max(100),
    minDonationAmount: z.number().min(0),
    maxDonationAmount: z.number().min(1),
    suggestedAmounts: z.array(z.number().positive()).min(1).max(8),
    maxFileUploadSize: z.number().int().min(1).max(100),
    termsOfServiceUrl: z.string().url().or(z.literal("")),
    privacyPolicyUrl: z.string().url().or(z.literal("")),
    supportEmail: z.string().email(),
    enableEmailNotifications: z.boolean(),
    enableSmsNotifications: z.boolean(),
    maintenanceMode: z.boolean(),
  })
  .partial();

/**
 * Serialize the PlatformSettings row to the shape the admin settings page
 * renders (dollars, BigInt-free).
 */
function serializeSettings(row: {
  platformFeePercent: number;
  minDonationAmountCents: bigint;
  maxDonationAmountCents: bigint;
  suggestedAmountsCents: bigint[];
  maxFileUploadSizeMb: number;
  termsOfServiceUrl: string;
  privacyPolicyUrl: string;
  supportEmail: string;
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  maintenanceMode: boolean;
  updatedAt: Date;
}) {
  return {
    platformFeePercent: row.platformFeePercent,
    minDonationAmount: Number(row.minDonationAmountCents) / 100,
    maxDonationAmount: Number(row.maxDonationAmountCents) / 100,
    suggestedAmounts: row.suggestedAmountsCents.map((c) => Number(c) / 100),
    maxFileUploadSize: row.maxFileUploadSizeMb,
    termsOfServiceUrl: row.termsOfServiceUrl,
    privacyPolicyUrl: row.privacyPolicyUrl,
    supportEmail: row.supportEmail,
    enableEmailNotifications: row.enableEmailNotifications,
    enableSmsNotifications: row.enableSmsNotifications,
    maintenanceMode: row.maintenanceMode,
  };
}

/** Lazily create/read the singleton settings row. */
async function getOrCreateSettings() {
  return prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

/**
 * GET /api/admin/settings
 * Get platform settings (ADMIN or BANK_ADMIN)
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

    const row = await getOrCreateSettings();

    return NextResponse.json({
      success: true,
      settings: serializeSettings(row),
      lastUpdated: row.updatedAt.toISOString(),
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
 * Update platform settings (ADMIN or BANK_ADMIN)
 */
export async function PUT(req: NextRequest) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

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

    // Parse and validate request body
    const body = await req.json();
    const v = settingsSchema.parse(body);

    // Map dollars -> cents and page names -> DB column names
    const data: Record<string, unknown> = {};
    if (v.platformFeePercent !== undefined) data.platformFeePercent = v.platformFeePercent;
    if (v.minDonationAmount !== undefined) data.minDonationAmountCents = BigInt(Math.round(v.minDonationAmount * 100));
    if (v.maxDonationAmount !== undefined) data.maxDonationAmountCents = BigInt(Math.round(v.maxDonationAmount * 100));
    if (v.suggestedAmounts !== undefined) data.suggestedAmountsCents = v.suggestedAmounts.map((a) => BigInt(Math.round(a * 100)));
    if (v.maxFileUploadSize !== undefined) data.maxFileUploadSizeMb = v.maxFileUploadSize;
    if (v.termsOfServiceUrl !== undefined) data.termsOfServiceUrl = v.termsOfServiceUrl;
    if (v.privacyPolicyUrl !== undefined) data.privacyPolicyUrl = v.privacyPolicyUrl;
    if (v.supportEmail !== undefined) data.supportEmail = v.supportEmail;
    if (v.enableEmailNotifications !== undefined) data.enableEmailNotifications = v.enableEmailNotifications;
    if (v.enableSmsNotifications !== undefined) data.enableSmsNotifications = v.enableSmsNotifications;
    if (v.maintenanceMode !== undefined) data.maintenanceMode = v.maintenanceMode;

    const updated = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });

    console.log(`Settings updated by ${user.email}`);

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      settings: serializeSettings(updated),
      updatedBy: {
        id: user.id,
        email: user.email,
      },
      updatedAt: updated.updatedAt.toISOString(),
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
        error: "Failed to update settings"
      },
      { status: 500 }
    );
  }
}
