import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createCampaignSchema, updateCampaignSchema } from "@/lib/validations/campaign";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitConfigs,
  applyRateLimitHeaders
} from "@/lib/utils/rate-limit";
import { checkCsrf } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Get token from cookie
    const sessionToken = req.cookies.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromToken(sessionToken);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // A campaign is a publicly listed, money-collecting page created under a
    // free-text organisation name, so the creator must have proven control of
    // their email address first. Note this is deliberately NOT a role check:
    // self-service campaign creation by any authenticated user is intended.
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please verify your email address before creating a campaign. Check your inbox for the verification link.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    // Apply rate limiting (10 campaigns per user per day)
    const rateLimitId = getRateLimitIdentifier(req, user.id);
    const rateLimitResult = checkRateLimit(rateLimitId, rateLimitConfigs.campaignCreate);

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
      applyRateLimitHeaders(response.headers, rateLimitResult);
      return response;
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createCampaignSchema.parse(body);

    // Check if slug is already taken
    const existingCampaign = await prisma.campaign.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingCampaign) {
      return NextResponse.json(
        { success: false, error: "Campaign URL is already taken. Please choose a different one." },
        { status: 400 }
      );
    }

    // Convert dollar amount to cents (use BigInt for large values)
    const goalAmountInCents = BigInt(Math.round(validatedData.goalAmount * 100));
    const approvalThresholdInCents = validatedData.approvalThreshold
      ? BigInt(Math.round(validatedData.approvalThreshold * 100))
      : BigInt(50000); // Default $500

    // Find guardian user by email if provided
    let guardianUser = null;
    if (validatedData.guardianEmail) {
      guardianUser = await prisma.user.findUnique({
        where: { email: validatedData.guardianEmail },
      });

      // If guardian email provided but user doesn't exist, we'll need to invite them
      // For now, we'll just note this in the response
    }

    // Create campaign with banking account in a transaction
    const campaign = await prisma.campaign.create({
      data: {
        organizationName: validatedData.organizationName,
        teamName: validatedData.teamName,
        slug: validatedData.slug,
        description: validatedData.description,
        goalAmount: goalAmountInCents,
        startDate: new Date(validatedData.startDate),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        category: validatedData.category,
        primaryColor: validatedData.primaryColor || "#6366F1",
        secondaryColor: validatedData.secondaryColor || "#F59E0B",
        // Created unlisted. /api/campaigns/public only ever returns
        // ACTIVE/COMPLETED and donations require ACTIVE, so a new campaign
        // cannot collect money or appear in the public directory until its
        // leader explicitly launches it (DRAFT -> ACTIVE from the dashboard).
        status: "DRAFT",
        primaryLeaderId: user.id,
        // Connect guardian if found
        ...(guardianUser && {
          guardians: {
            connect: { id: guardianUser.id }
          }
        }),
        // Create banking account
        bankingAccount: {
          create: {
            approvalThreshold: approvalThresholdInCents,
            requiresGuardianApproval: !!validatedData.guardianEmail,
          }
        }
      },
      include: {
        bankingAccount: true,
        primaryLeader: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    return NextResponse.json(
      {
        success: true,
        campaign: {
          id: campaign.id,
          slug: campaign.slug,
          teamName: campaign.teamName,
          guardianNeedsInvite: validatedData.guardianEmail && !guardianUser,
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Campaign creation error:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map(e => ({ field: e.path.join("."), message: e.message }))
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        success: false,
        // Detail is logged above; never leak internal error text to the client.
        error: "Failed to create campaign"
      },
      { status: 500 }
    );
  }
}

// GET campaigns (filtered by user - shows their own campaigns)
export async function GET(req: NextRequest) {
  try {
    // Get token from cookie
    const sessionToken = req.cookies.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromToken(sessionToken);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    // Only accept values that actually exist in the CampaignStatus enum. An
    // unrecognised status is rejected rather than passed through to Prisma,
    // which would throw and surface as a 500.
    const validStatuses = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;
    type CampaignStatusValue = (typeof validStatuses)[number];
    const rawStatus = searchParams.get("status");
    if (rawStatus && !validStatuses.includes(rawStatus as CampaignStatusValue)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }
    const status = rawStatus as CampaignStatusValue | null;

    const rawLimit = parseInt(searchParams.get("limit") || "50");
    const rawOffset = parseInt(searchParams.get("offset") || "0");
    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    // Get campaigns where user is primary leader or guardian
    const campaigns = await prisma.campaign.findMany({
      where: {
        ...(status ? { status } : {}),
        OR: [
          { primaryLeaderId: user.id },
          { guardians: { some: { id: user.id } } }
        ]
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        primaryLeader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        bankingAccount: {
          select: {
            availableBalance: true,
            totalRaised: true,
          }
        }
      }
    });

    // Convert BigInt to strings for JSON
    const serializedCampaigns = campaigns.map(c => ({
      ...c,
      goalAmount: c.goalAmount.toString(),
      currentAmount: c.currentAmount.toString(),
      bankingAccount: c.bankingAccount ? {
        availableBalance: c.bankingAccount.availableBalance.toString(),
        totalRaised: c.bankingAccount.totalRaised.toString(),
      } : null
    }));

    return NextResponse.json({ success: true, campaigns: serializedCampaigns }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch campaigns:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
