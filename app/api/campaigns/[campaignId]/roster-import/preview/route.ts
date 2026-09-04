import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkCsrf } from "@/lib/csrf";
import {
  parseRosterFile,
  parsePastedRoster,
  RosterFileError,
  MAX_ROSTER_FILE_SIZE,
} from "@/lib/utils/roster-file";
import {
  autoDetectMapping,
  validateMapping,
  applyMapping,
  normalizeHeader,
} from "@/lib/utils/roster-mapping";

/**
 * POST /api/campaigns/[campaignId]/roster-import/preview
 *
 * Parses an uploaded roster (multipart `file`) or pasted text (`{ pastedText }`)
 * and proposes a column mapping. Writes NOTHING to the database — the whole
 * point is that the coach sees how we read their columns, against their own
 * data, and can correct it before any TeamMember row is created.
 *
 * The raw rows are echoed back so the commit step imports exactly what was
 * previewed rather than re-parsing a file we would have to store somewhere.
 */

const SAMPLE_ROW_COUNT = 5;

/** Hudl's athlete export headers, in the order its template ships them. */
const HUDL_HEADERS = [
  "firstname",
  "lastname",
  "email",
  "graduationyear",
  "jersey",
  "position",
  "cell",
];

/**
 * A Hudl export is recognised by its header set, not by anything we ask the
 * coach to declare, so the provenance we record is what the file actually was.
 */
function detectSource(headers: string[], isPaste: boolean): "HUDL_CSV" | "GENERIC_CSV" | "MANUAL_PASTE" {
  const normalized = new Set(headers.map(normalizeHeader));
  const hudlMatches = HUDL_HEADERS.filter((header) => normalized.has(header)).length;

  // 5 of the 7 template headers is a confident match even if the coach deleted
  // a column or two before uploading.
  if (hudlMatches >= 5) return "HUDL_CSV";
  return isPaste ? "MANUAL_PASTE" : "GENERIC_CSV";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
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

    const campaignId = params.campaignId;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        guardians: { select: { id: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some((g) => g.id === user.id) ||
      user.role === "ADMIN";

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to manage this campaign" },
        { status: 403 }
      );
    }

    // ---- Read the roster, from a file upload or a paste -------------------
    const contentType = req.headers.get("content-type") || "";
    let parsed;
    let fileName: string | null = null;
    let isPaste = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || typeof file === "string") {
        return NextResponse.json(
          { success: false, error: "No file provided" },
          { status: 400 }
        );
      }

      fileName = file.name || null;
      parsed = await parseRosterFile(file);
    } else {
      const body = await req.json().catch(() => null);
      const pastedText = body?.pastedText;

      if (typeof pastedText !== "string" || pastedText.trim() === "") {
        return NextResponse.json(
          {
            success: false,
            error: "Upload a roster file or paste your roster rows.",
          },
          { status: 400 }
        );
      }

      if (Buffer.byteLength(pastedText, "utf8") > MAX_ROSTER_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: "That paste is too large. Upload the file instead." },
          { status: 400 }
        );
      }

      isPaste = true;
      parsed = parsePastedRoster(pastedText);
    }

    // ---- Propose a mapping and show it against real rows ------------------
    const suggestedMapping = autoDetectMapping(parsed.headers);
    const validation = validateMapping(suggestedMapping);

    // Sample rows are mapped with the *suggested* mapping so the coach can see
    // immediately whether the guess landed on the right columns.
    const sample = applyMapping(parsed.rows.slice(0, SAMPLE_ROW_COUNT), suggestedMapping);

    return NextResponse.json({
      success: true,
      fileName,
      detectedSource: detectSource(parsed.headers, isPaste),
      headers: parsed.headers,
      suggestedMapping,
      validation,
      rowCount: parsed.rows.length,
      sampleRows: sample.rows,
      sampleErrors: sample.errors,
      // Echoed back verbatim for the commit step.
      rows: parsed.rows,
    });
  } catch (error) {
    // Anything the coach can fix by uploading a different file.
    if (error instanceof RosterFileError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error("Roster import preview failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to read that roster file" },
      { status: 500 }
    );
  }
}
