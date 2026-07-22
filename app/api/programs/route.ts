import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { checkCsrf } from "@/lib/csrf";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitConfigs,
  applyRateLimitHeaders,
} from "@/lib/utils/rate-limit";

/**
 * GET /api/programs
 * List the programs the caller leads.
 *
 * A Program is the persistent entity above Campaign — the thing that survives
 * across seasons and gives alumni somewhere to hang. Leadership is derived from
 * campaigns rather than stored on Program: you lead a program if you are the
 * primary leader of at least one of its campaigns. ADMIN sees everything.
 */
export async function GET(req: NextRequest) {
  try {
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

    const isAdmin = user.role === "ADMIN";

    const programs = await prisma.program.findMany({
      where: isAdmin
        ? {}
        : { campaigns: { some: { primaryLeaderId: user.id } } },
      select: {
        id: true,
        organizationName: true,
        teamName: true,
        sport: true,
        slug: true,
        createdAt: true,
        campaigns: {
          select: {
            id: true,
            teamName: true,
            slug: true,
            seasonYear: true,
            startDate: true,
            status: true,
            primaryLeaderId: true,
            _count: { select: { teamMembers: true } },
          },
          orderBy: { startDate: "desc" },
        },
      },
      orderBy: { organizationName: "asc" },
    });

    const payload = programs.map((program) => {
      const seasonYears = [
        ...new Set(
          program.campaigns
            .map((c) => c.seasonYear)
            .filter((y): y is number => typeof y === "number")
        ),
      ].sort((a, b) => a - b);

      return {
        id: program.id,
        organizationName: program.organizationName,
        teamName: program.teamName,
        sport: program.sport,
        slug: program.slug,
        createdAt: program.createdAt.toISOString(),
        campaignCount: program.campaigns.length,
        // Roster rows across all seasons — NOT distinct humans. The alumni
        // endpoint dedupes; this is the raw count.
        rosterRowCount: program.campaigns.reduce(
          (sum, c) => sum + c._count.teamMembers,
          0
        ),
        seasonYears,
        firstSeasonYear: seasonYears[0] ?? null,
        latestSeasonYear: seasonYears[seasonYears.length - 1] ?? null,
        // Whether *this* caller leads it, which differs from visibility for admins.
        isLeader: program.campaigns.some((c) => c.primaryLeaderId === user.id),
        campaigns: program.campaigns.map((c) => ({
          id: c.id,
          teamName: c.teamName,
          slug: c.slug,
          seasonYear: c.seasonYear,
          startDate: c.startDate.toISOString(),
          status: c.status,
          teamMemberCount: c._count.teamMembers,
        })),
      };
    });

    return NextResponse.json({ success: true, programs: payload });
  } catch (error) {
    console.error("Failed to list programs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load programs" },
      { status: 500 }
    );
  }
}

const createProgramSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name cannot exceed 100 characters"),
  teamName: z
    .string()
    .trim()
    .min(2, "Team name must be at least 2 characters")
    .max(100, "Team name cannot exceed 100 characters"),
  sport: z
    .string()
    .trim()
    .max(50, "Sport cannot exceed 50 characters")
    .optional()
    .or(z.literal("")),
});

/** URL-safe slug from the program's identity, matching the campaign slug rules. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * POST /api/programs
 * Create a Program — the persistent entity above Campaign that alumni and
 * year-over-year roster data hang off.
 *
 * Restricted to people who already lead a campaign (plus ADMIN). Programs are
 * keyed by (organizationName, teamName), so letting any authenticated user
 * create them would let a stranger squat "Lincoln High / Varsity Basketball"
 * and block the actual coach.
 */
export async function POST(req: NextRequest) {
  try {
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

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

    const isAdmin = user.role === "ADMIN";

    if (!isAdmin) {
      // Same leadership model the GET uses: you lead a program if you lead one
      // of its campaigns, so you must lead a campaign to start one.
      const leadsACampaign = await prisma.campaign.count({
        where: { primaryLeaderId: user.id },
      });

      if (leadsACampaign === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only campaign leaders can create a program. Create a campaign first.",
          },
          { status: 403 }
        );
      }
    }

    const rateLimitId = getRateLimitIdentifier(req, user.id);
    const rateLimitResult = checkRateLimit(
      rateLimitId,
      rateLimitConfigs.campaignCreate
    );

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429 }
      );
      applyRateLimitHeaders(response.headers, rateLimitResult);
      return response;
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const data = createProgramSchema.parse(body);

    // (organizationName, teamName) is unique. Report the clash as a conflict and
    // hand back the existing program so the caller can link to it instead.
    const existing = await prisma.program.findUnique({
      where: {
        organizationName_teamName: {
          organizationName: data.organizationName,
          teamName: data.teamName,
        },
      },
      select: { id: true, organizationName: true, teamName: true, slug: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `A program for ${data.teamName} at ${data.organizationName} already exists.`,
          code: "PROGRAM_EXISTS",
          program: existing,
        },
        { status: 409 }
      );
    }

    const baseSlug = slugify(`${data.organizationName}-${data.teamName}`) || "program";

    // Slug is unique across all programs, and two organisations can legitimately
    // field a "varsity-basketball". Walk to the first free suffix.
    let slug = baseSlug;
    for (let attempt = 2; attempt < 100; attempt++) {
      const taken = await prisma.program.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!taken) break;
      slug = `${baseSlug.slice(0, 45)}-${attempt}`;
    }

    let program;
    try {
      program = await prisma.program.create({
        data: {
          organizationName: data.organizationName,
          teamName: data.teamName,
          sport: data.sport ? data.sport : null,
          slug,
          createdById: user.id,
        },
        select: {
          id: true,
          organizationName: true,
          teamName: true,
          sport: true,
          slug: true,
          createdAt: true,
        },
      });
    } catch (error) {
      // Lost a race against a concurrent create on either unique constraint.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "A program with these details already exists.",
            code: "PROGRAM_EXISTS",
          },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        program: {
          ...program,
          createdAt: program.createdAt.toISOString(),
          campaignCount: 0,
          rosterRowCount: 0,
          seasonYears: [],
          isLeader: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error("Failed to create program:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create program" },
      { status: 500 }
    );
  }
}
