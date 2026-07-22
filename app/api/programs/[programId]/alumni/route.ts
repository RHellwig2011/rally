import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  aggregateAlumni,
  normalizeEmail,
  normalizePhone,
  toCsv,
  type AlumniRecord,
  type AlumniStatus,
} from "@/lib/alumni";

/**
 * GET /api/programs/[programId]/alumni
 *
 * The alumni database. Walks every campaign in the program, pulls all
 * per-season TeamMember rows, dedupes them into one record per human, and
 * annotates each with lifetime giving and current contactability.
 *
 * Query params:
 *   status=alumni|current|unknown|all   (default all)
 *   graduationYear=<int>
 *   search=<name or email substring>
 *   limit=1..200 (default 50), offset=>=0
 *   export=csv  -> full filtered set as CSV, ignoring limit/offset
 */

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function parseOffset(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function parseStatusFilter(raw: string | null): AlumniStatus | "ALL" {
  switch ((raw ?? "").toLowerCase()) {
    case "alumni":
      return "ALUMNI";
    case "current":
      return "CURRENT";
    case "unknown":
      return "UNKNOWN";
    default:
      return "ALL";
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { programId: string } }
) {
  try {
    const { programId } = params;

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

    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        organizationName: true,
        teamName: true,
        sport: true,
        slug: true,
      },
    });

    if (!program) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 }
      );
    }

    // Authorization: you must lead at least one campaign in this program.
    // This is alumni contact data, much of it collected while the athletes were
    // minors — leadership of a sibling program is not enough.
    if (user.role !== "ADMIN") {
      const ledCampaigns = await prisma.campaign.count({
        where: { programId, primaryLeaderId: user.id },
      });
      if (ledCampaigns === 0) {
        return NextResponse.json(
          { success: false, error: "Not authorized" },
          { status: 403 }
        );
      }
    }

    const members = await prisma.teamMember.findMany({
      where: { campaign: { programId }, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneNumber: true,
        graduationYear: true,
        jerseyNumber: true,
        position: true,
        amountRaised: true,
        campaignId: true,
        campaign: {
          select: { id: true, teamName: true, seasonYear: true, startDate: true },
        },
      },
    });

    const now = new Date();
    const allRecords = aggregateAlumni(
      members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        phoneNumber: m.phoneNumber,
        graduationYear: m.graduationYear,
        jerseyNumber: m.jerseyNumber,
        position: m.position,
        amountRaised: m.amountRaised,
        campaignId: m.campaignId,
        campaignName: m.campaign.teamName,
        seasonYear: m.campaign.seasonYear,
        campaignStartDate: m.campaign.startDate,
      })),
      { now }
    );

    // --- Suppression -------------------------------------------------------
    // Program-scoped opt-outs plus platform-wide ones (programId null). An
    // unsubscribe is a standing instruction, so it is applied here at read time
    // rather than being something a caller could forget to check later.
    const optOuts = await prisma.contactOptOut.findMany({
      where: { OR: [{ programId }, { programId: null }] },
      select: { email: true, phone: true, channel: true },
    });

    const emailSuppressed = new Set<string>();
    const phoneSuppressed = new Set<string>();
    for (const optOut of optOuts) {
      const email = normalizeEmail(optOut.email);
      const phone = normalizePhone(optOut.phone);
      if (email && (optOut.channel === "EMAIL" || optOut.channel === "ALL")) {
        emailSuppressed.add(email);
      }
      if (phone && (optOut.channel === "SMS" || optOut.channel === "ALL")) {
        phoneSuppressed.add(phone);
      }
    }

    // --- Last contacted ----------------------------------------------------
    // Derived from outreach we actually sent to this address.
    const alumniEmails = allRecords
      .map((r) => r.email)
      .filter((e): e is string => Boolean(e));

    const lastContactedByEmail = new Map<string, string>();
    if (alumniEmails.length > 0) {
      const logs = await prisma.outreachLog.groupBy({
        by: ["recipientEmail"],
        where: { recipientEmail: { in: alumniEmails }, sentAt: { not: null } },
        _max: { sentAt: true },
      });
      for (const log of logs) {
        const email = normalizeEmail(log.recipientEmail);
        if (email && log._max.sentAt) {
          lastContactedByEmail.set(email, log._max.sentAt.toISOString());
        }
      }
    }

    const decorate = (record: AlumniRecord) => {
      const email = record.email;
      const phoneKey = normalizePhone(record.phone);
      const emailOptedOut = Boolean(email && emailSuppressed.has(email));
      const phoneOptedOut = Boolean(phoneKey && phoneSuppressed.has(phoneKey));
      return {
        ...record,
        emailSuppressed: emailOptedOut,
        phoneSuppressed: phoneOptedOut,
        suppressed: emailOptedOut || phoneOptedOut,
        // The only field that matters for "can I email this alum": a live
        // address that has not opted out.
        contactableByEmail: Boolean(email) && !emailOptedOut,
        lastContactedAt: email ? lastContactedByEmail.get(email) ?? null : null,
      };
    };

    const decorated = allRecords.map(decorate);

    // --- Filters -----------------------------------------------------------
    const searchParams = req.nextUrl.searchParams;
    const statusFilter = parseStatusFilter(searchParams.get("status"));
    const searchRaw = (searchParams.get("search") ?? "").trim().toLowerCase();
    const gradYearRaw = searchParams.get("graduationYear");
    const gradYearParsed = Number.parseInt(gradYearRaw ?? "", 10);
    const gradYearFilter = Number.isFinite(gradYearParsed) ? gradYearParsed : null;

    const filtered = decorated.filter((record) => {
      if (statusFilter !== "ALL" && record.status !== statusFilter) return false;
      if (gradYearFilter !== null && record.graduationYear !== gradYearFilter) {
        return false;
      }
      if (searchRaw) {
        const haystack = [record.name, record.email ?? "", record.phone ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchRaw)) return false;
      }
      return true;
    });

    // --- CSV export --------------------------------------------------------
    // Exports the whole filtered set, not the current page. Data portability is
    // deliberate here: the manager's roster history is theirs to take.
    if ((searchParams.get("export") ?? "").toLowerCase() === "csv") {
      const csv = toCsv(
        [
          "Name",
          "Email",
          "Phone",
          "Graduation Year",
          "Status",
          "Seasons Played",
          "Seasons",
          "First Season",
          "Last Season",
          "Lifetime Raised (USD)",
          "Suppressed",
          "Contactable By Email",
          "Last Contacted At",
        ],
        filtered.map((r) => [
          r.name,
          r.email ?? "",
          r.phone ?? "",
          r.graduationYear ?? "",
          r.status,
          r.seasonCount,
          r.seasonsPlayed
            .map((s) => s.seasonYear ?? s.campaignName ?? s.campaignId)
            .join("; "),
          r.firstSeason?.seasonYear ?? r.firstSeason?.campaignName ?? "",
          r.lastSeason?.seasonYear ?? r.lastSeason?.campaignName ?? "",
          (r.lifetimeRaised / 100).toFixed(2),
          r.suppressed ? "YES" : "NO",
          r.contactableByEmail ? "YES" : "NO",
          r.lastContactedAt ?? "",
        ])
      );

      const filenameSlug = program.slug || program.id;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameSlug}-alumni.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // --- Summary + pagination ---------------------------------------------
    const limit = parseLimit(searchParams.get("limit"));
    const offset = parseOffset(searchParams.get("offset"));
    const page = filtered.slice(offset, offset + limit);

    const alumniOnly = decorated.filter((r) => r.status === "ALUMNI");
    const graduationYears = [
      ...new Set(
        decorated
          .map((r) => r.graduationYear)
          .filter((y): y is number => typeof y === "number")
      ),
    ].sort((a, b) => b - a);

    return NextResponse.json({
      success: true,
      program: {
        id: program.id,
        organizationName: program.organizationName,
        teamName: program.teamName,
        sport: program.sport,
        slug: program.slug,
      },
      summary: {
        totalPeople: decorated.length,
        totalAlumni: alumniOnly.length,
        totalCurrent: decorated.filter((r) => r.status === "CURRENT").length,
        totalUnknown: decorated.filter((r) => r.status === "UNKNOWN").length,
        alumniWithContactableEmail: alumniOnly.filter((r) => r.contactableByEmail)
          .length,
        alumniSuppressed: alumniOnly.filter((r) => r.suppressed).length,
        // Cents. Lifetime giving from people who have graduated.
        alumniLifetimeRaised: alumniOnly.reduce(
          (sum, r) => sum + r.lifetimeRaised,
          0
        ),
        rosterRowsScanned: members.length,
      },
      graduationYears,
      alumni: page,
      pagination: {
        total: filtered.length,
        limit,
        offset,
        hasMore: offset + page.length < filtered.length,
      },
    });
  } catch (error) {
    console.error("Failed to load program alumni:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load alumni" },
      { status: 500 }
    );
  }
}
