import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkSlugSchema } from "@/lib/validations/campaign";
import { z } from "zod";

/**
 * Check if a campaign slug is available
 * Used for real-time validation in the campaign creation form
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate the slug format
    const validatedData = checkSlugSchema.parse(body);

    // Check if slug exists in database
    const existingCampaign = await prisma.campaign.findUnique({
      where: { slug: validatedData.slug },
      select: { id: true } // Only fetch ID to minimize data transfer
    });

    return NextResponse.json({
      success: true,
      available: !existingCampaign,
      slug: validatedData.slug
    });

  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          error: "Invalid slug format",
          details: error.errors.map(e => e.message).join(", ")
        },
        { status: 400 }
      );
    }

    // Handle other errors
    console.error("Slug check error:", error);
    return NextResponse.json(
      {
        success: false,
        available: false,
        error: "Failed to check slug availability"
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking slug availability via query parameter
 * Alternative to POST for simpler client implementation
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          error: "Slug parameter is required"
        },
        { status: 400 }
      );
    }

    // Validate the slug format
    const validatedData = checkSlugSchema.parse({ slug });

    // Check if slug exists in database
    const existingCampaign = await prisma.campaign.findUnique({
      where: { slug: validatedData.slug },
      select: { id: true }
    });

    return NextResponse.json({
      success: true,
      available: !existingCampaign,
      slug: validatedData.slug
    });

  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          error: "Invalid slug format",
          details: error.errors.map(e => e.message).join(", ")
        },
        { status: 400 }
      );
    }

    // Handle other errors
    console.error("Slug check error:", error);
    return NextResponse.json(
      {
        success: false,
        available: false,
        error: "Failed to check slug availability"
      },
      { status: 500 }
    );
  }
}