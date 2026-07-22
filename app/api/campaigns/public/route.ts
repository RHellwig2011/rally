import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { CampaignStatus, CampaignCategory } from "@prisma/client";

// Only these statuses may ever be listed publicly (never DRAFT/PAUSED/ARCHIVED)
const PUBLIC_STATUSES: CampaignStatus[] = ["ACTIVE", "COMPLETED"];

// GET public campaigns (no auth required)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const statusParam = searchParams.get("status");
    const rawLimit = parseInt(searchParams.get("limit") || "50");
    const rawOffset = parseInt(searchParams.get("offset") || "0");
    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    // Validate status against the publicly listable statuses
    let status: CampaignStatus = "ACTIVE";
    if (statusParam) {
      if (!PUBLIC_STATUSES.includes(statusParam as CampaignStatus)) {
        return NextResponse.json(
          { success: false, error: "Invalid status filter" },
          { status: 400 }
        );
      }
      status = statusParam as CampaignStatus;
    }

    // Validate category against the enum; ignore unknown values
    const validCategory =
      category &&
      category !== "All" &&
      (Object.values(CampaignCategory) as string[]).includes(category)
        ? (category as CampaignCategory)
        : null;

    // Get all active campaigns with their stats
    const where = {
      status,
      ...(validCategory ? { category: validCategory } : {}),
    };
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              donations: true,
            }
          }
        }
      }),
      prisma.campaign.count({ where }),
    ]);

    // Convert BigInt to strings for JSON
    const serializedCampaigns = campaigns.map(c => ({
      id: c.id,
      slug: c.slug,
      organizationName: c.organizationName,
      teamName: c.teamName,
      description: c.description,
      goalAmount: c.goalAmount.toString(),
      currentAmount: c.currentAmount.toString(),
      category: c.category,
      status: c.status,
      logoUrl: c.logoUrl,
      bannerImageUrl: c.bannerImageUrl,
      primaryColor: c.primaryColor,
      secondaryColor: c.secondaryColor,
      startDate: c.startDate,
      endDate: c.endDate,
      createdAt: c.createdAt,
      _count: c._count
    }));

    return NextResponse.json(
      {
        success: true,
        campaigns: serializedCampaigns,
        total,
        hasMore: offset + campaigns.length < total
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch public campaigns:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
