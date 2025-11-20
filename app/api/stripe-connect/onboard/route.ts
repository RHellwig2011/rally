import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createConnectAccount, createAccountLink } from "@/lib/stripe";
import { verifyAuth } from "@/lib/requireAuth";
import prisma from "@/lib/prisma";

const onboardSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required"),
});

/**
 * POST /api/stripe-connect/onboard
 * Create a Stripe Connect account and return onboarding link
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { campaignId } = onboardSchema.parse(body);

    // Verify user owns or leads this campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        bankingAccount: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.primaryLeaderId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: "You must be the campaign leader to set up payouts" },
        { status: 403 }
      );
    }

    // Check if banking account exists
    if (!campaign.bankingAccount) {
      return NextResponse.json(
        { success: false, error: "Banking account not found for this campaign" },
        { status: 404 }
      );
    }

    let accountId = campaign.bankingAccount.stripeConnectAccountId;

    // Create Stripe Connect account if it doesn't exist
    if (!accountId) {
      const account = await createConnectAccount({
        email: authResult.user.email,
        campaignId: campaign.id,
        organizationName: campaign.organizationName,
      });

      accountId = account.id;

      // Save the account ID
      await prisma.bankingAccount.update({
        where: { id: campaign.bankingAccount.id },
        data: { stripeConnectAccountId: accountId },
      });
    }

    // Create account link for onboarding
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const accountLink = await createAccountLink({
      accountId,
      refreshUrl: `${appUrl}/campaigns/${campaign.slug}/settings/payouts?refresh=true`,
      returnUrl: `${appUrl}/campaigns/${campaign.slug}/settings/payouts?success=true`,
    });

    return NextResponse.json(
      {
        success: true,
        onboardingUrl: accountLink.url,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to create onboarding link:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create onboarding link",
      },
      { status: 500 }
    );
  }
}
