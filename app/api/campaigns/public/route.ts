import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET public campaigns (no auth required)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status") || "ACTIVE";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get all active campaigns with their stats
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: status as any,
        ...(category && category !== "All" ? { category: category as any } : {}),
      },
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
    });

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
        total: serializedCampaigns.length
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
