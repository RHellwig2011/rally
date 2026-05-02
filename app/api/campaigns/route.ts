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
        status: "ACTIVE", // Set to ACTIVE by default for MVP
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
        error: error instanceof Error ? error.message : "Failed to create campaign"
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
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get campaigns where user is primary leader or guardian
    const campaigns = await prisma.campaign.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
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
