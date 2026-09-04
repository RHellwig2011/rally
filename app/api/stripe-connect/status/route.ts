import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { verifyAuth } from "@/lib/requireAuth";
import prisma from "@/lib/prisma";

/**
 * GET /api/stripe-connect/status?campaignId=xxx
 * Get the status of a campaign's Stripe Connect account
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication (throws if not authenticated)
    const user = await verifyAuth(req);

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    // Get campaign and banking account
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

    // Ownership check: only the campaign's primary leader (or platform/bank
    // admins) may view the campaign's Stripe Connect status.
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      user.role === "ADMIN" ||
      user.role === "BANK_ADMIN";

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to view this campaign's payout account status" },
        { status: 403 }
      );
    }

    if (!campaign.bankingAccount?.stripeConnectAccountId) {
      return NextResponse.json(
        {
          success: true,
          connected: false,
          message: "Stripe Connect account not set up",
        },
        { status: 200 }
      );
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(
      campaign.bankingAccount.stripeConnectAccountId
    );

    return NextResponse.json(
      {
        success: true,
        connected: true,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requiresInfo: account.requirements?.currently_due?.length ? true : false,
        currentlyDue: account.requirements?.currently_due || [],
      },
      { status: 200 }
    );
  } catch (error) {
    // verifyAuth throws a NextResponse (401) on auth failure — pass it through
    if (error instanceof NextResponse) {
      return error;
    }
    console.error("Failed to get account status:", error);
    return NextResponse.json(
      {
        success: false,
        // Detail is logged above; never leak internal error text to the client.
        error: "Failed to get account status",
      },
      { status: 500 }
    );
  }
}
