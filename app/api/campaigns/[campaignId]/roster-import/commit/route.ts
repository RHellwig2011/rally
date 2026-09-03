import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { checkCsrf } from "@/lib/csrf";
import { generateInvitationToken, invitationTokenExpiry } from "@/lib/onboarding";
import { z } from "zod";
import {
  applyMapping,
  validateMapping,
  RosterField,
  MappedRosterRow,
} from "@/lib/utils/roster-mapping";
import { MAX_ROSTER_ROWS } from "@/lib/utils/roster-file";
import { generateUniqueFundraisingLinkCode } from "@/lib/utils/team-member";

/**
 * POST /api/campaigns/[campaignId]/roster-import/commit
 *
 * Writes the roster the coach previewed and confirmed.
 *
 * Deliberately sends NO invitations. Importing a roster and contacting the
 * people on it are separate decisions: a coach should be able to load last
 * season's spreadsheet without an email going out to 60 families the moment
 * they click a button. Invitations are a distinct, explicit step.
 */

const MAX_TEAM_MEMBERS = 100;

const ROSTER_FIELDS: RosterField[] = [
  "firstName",
  "lastName",
  "name",
  "email",
  "phone",
  "parentEmail",
  "parentPhone",
  "graduationYear",
  "grade",
  "position",
  "jerseyNumber",
  "personalGoal",
];

const commitSchema = z.object({
  mapping: z.record(z.enum(ROSTER_FIELDS as [RosterField, ...RosterField[]]).nullable()),
  rows: z.array(z.record(z.any())).min(1, "No rows to import").max(MAX_ROSTER_ROWS),
  source: z.enum(["HUDL_CSV", "GENERIC_CSV", "MANUAL_PASTE"]).default("GENERIC_CSV"),
  seasonYear: z.number().int().min(1900).max(2200).optional(),
  fileName: z.string().max(255).optional(),
  deriveGradYearFromGrade: z.boolean().optional(),
  // Validated separately so we can return a purpose-written 400.
  attestation: z.boolean().optional(),
});

/**
 * The fields needed to match a roster row against an existing player and to
 * decide which blanks an import may fill. Shared by the initial load and by
 * newly created rows so both can go into the same lookup maps.
 */
const MEMBER_MATCH_FIELDS = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  parentEmail: true,
  parentPhone: true,
  graduationYear: true,
  jerseyNumber: true,
  position: true,
  grade: true,
} as const;

type RowOutcome = "created" | "restored" | "updated" | "skipped" | "failed";

interface RowResult {
  row: number;
  name: string;
  email?: string;
  outcome: RowOutcome;
  reason?: string;
  teamMemberId?: string;
}

/** Dedupe key for rosters with no email: names vary in case, spacing and punctuation. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fallback identity for roster rows with no email — which is most of a Hudl
 * export. Graduation year is part of the key because two players on one program
 * genuinely can share a name across classes.
 */
function nameKey(row: { name: string; graduationYear?: number | null }): string {
  return `name:${normalizeName(row.name)}|${row.graduationYear ?? ""}`;
}

/**
 * Do two records describe the same player?
 *
 * Matching on email alone is not enough: a player imported from a Hudl export
 * with no email, then re-imported next season from a file that *does* have one,
 * must resolve to the same person rather than being created twice.
 *
 * So: equal emails match. Otherwise fall back to name + graduation year, but
 * only when at least one side has no email — if both sides carry different
 * emails they are two different people who happen to share a name.
 */
function isSamePlayer(
  incoming: { email?: string; name: string; graduationYear?: number | null },
  candidate: { email?: string | null; name: string; graduationYear?: number | null }
): boolean {
  const incomingEmail = incoming.email?.toLowerCase();
  const candidateEmail = candidate.email?.toLowerCase();

  if (incomingEmail && candidateEmail) return incomingEmail === candidateEmail;
  return nameKey(incoming) === nameKey(candidate);
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

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const data = commitSchema.parse(body);

    // ---- Attestation ------------------------------------------------------
    // A roster is a list of minors' names and contact details. We require the
    // coach to state affirmatively that they are entitled to share it before we
    // store any of it — the RosterImport row then records who said so and when.
    if (data.attestation !== true) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Confirm that you are authorised to share this roster with us before importing.",
          code: "ATTESTATION_REQUIRED",
        },
        { status: 400 }
      );
    }

    const mapping = data.mapping as Record<string, RosterField | null>;
    const mappingCheck = validateMapping(mapping);
    if (!mappingCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "That column mapping is not usable yet",
          details: mappingCheck.errors,
        },
        { status: 400 }
      );
    }

    const { rows: mappedRows, errors: mappingErrors } = applyMapping(
      data.rows as Record<string, unknown>[],
      mapping,
      { deriveGradYearFromGrade: data.deriveGradYearFromGrade }
    );

    const results: RowResult[] = mappingErrors.map((error) => ({
      row: error.row,
      name: "",
      outcome: "failed" as const,
      reason: error.reason,
    }));

    // ---- Existing roster, loaded once -------------------------------------
    const existingMembers = await prisma.teamMember.findMany({
      where: { campaignId, deletedAt: null },
      select: MEMBER_MATCH_FIELDS,
    });

    // Two lookups: email is authoritative when present, otherwise fall back to
    // normalised name + graduation year (which is why grad year matters — two
    // players genuinely can share a name across classes).
    type ExistingMember = (typeof existingMembers)[number];
    const byEmail = new Map<string, ExistingMember>();
    const byName = new Map<string, ExistingMember>();
    for (const member of existingMembers) {
      if (member.email) byEmail.set(member.email.toLowerCase(), member);
      byName.set(nameKey(member), member);
    }

    /** Resolve a roster row against the players already on this campaign. */
    const findExisting = (row: MappedRosterRow): ExistingMember | undefined => {
      if (row.email) {
        const byEmailMatch = byEmail.get(row.email.toLowerCase());
        if (byEmailMatch) return byEmailMatch;
      }
      const candidate = byName.get(nameKey(row));
      if (candidate && isSamePlayer(row, candidate)) return candidate;
      return undefined;
    };

    // ---- Previously removed players ---------------------------------------
    // Removal is a soft delete and the row keeps the player's amountRaised. A
    // season-start re-import that listed them again used to create a second
    // record, orphaning last season's total on a row nothing can read. Match
    // them here and revive the original instead.
    const deletedMembers = await prisma.teamMember.findMany({
      where: { campaignId, deletedAt: { not: null } },
      select: MEMBER_MATCH_FIELDS,
      orderBy: { deletedAt: "desc" },
    });

    const deletedByEmail = new Map<string, ExistingMember>();
    const deletedByName = new Map<string, ExistingMember>();
    for (const member of deletedMembers) {
      // Most recent removal wins; earlier ones stay archived.
      if (member.email && !deletedByEmail.has(member.email.toLowerCase())) {
        deletedByEmail.set(member.email.toLowerCase(), member);
      }
      if (!deletedByName.has(nameKey(member))) {
        deletedByName.set(nameKey(member), member);
      }
    }

    const findDeleted = (row: MappedRosterRow): ExistingMember | undefined => {
      if (row.email) {
        const match = deletedByEmail.get(row.email.toLowerCase());
        if (match) return match;
      }
      const candidate = deletedByName.get(nameKey(row));
      if (candidate && isSamePlayer(row, candidate)) return candidate;
      return undefined;
    };

    const forgetDeleted = (member: ExistingMember) => {
      if (member.email) deletedByEmail.delete(member.email.toLowerCase());
      deletedByName.delete(nameKey(member));
    };

    // ---- Capacity check ---------------------------------------------------
    // Count distinct *new* people, so a file that mostly updates existing
    // players is not rejected for a limit it would never reach.
    const seenEmails = new Set<string>();
    const seenNames = new Set<string>();
    let projectedNew = 0;
    for (const row of mappedRows) {
      const email = row.email?.toLowerCase();
      if (email && seenEmails.has(email)) continue;
      if (seenNames.has(nameKey(row))) continue;
      if (email) seenEmails.add(email);
      seenNames.add(nameKey(row));
      if (!findExisting(row)) projectedNew += 1;
    }

    if (existingMembers.length + projectedNew > MAX_TEAM_MEMBERS) {
      return NextResponse.json(
        {
          success: false,
          error: `This import would put the roster at ${
            existingMembers.length + projectedNew
          } players, over the ${MAX_TEAM_MEMBERS} limit. Currently on the roster: ${existingMembers.length}. New in this file: ${projectedNew}.`,
        },
        { status: 400 }
      );
    }

    // ---- Import -----------------------------------------------------------
    // Rows already handled in this file, so the same player listed twice does
    // not become two records. Same identity rules as the DB match above.
    const processedByEmail = new Map<string, number>();
    const processedByName = new Map<string, { row: number; hadEmail: boolean }>();

    for (const row of mappedRows) {
      const email = row.email?.toLowerCase();

      let duplicateOf: number | undefined;
      if (email && processedByEmail.has(email)) {
        duplicateOf = processedByEmail.get(email);
      } else {
        const seen = processedByName.get(nameKey(row));
        // Only a name collision where one of the two rows carries no email is
        // the same person; two different emails means two different players.
        if (seen && (!email || !seen.hadEmail)) duplicateOf = seen.row;
      }

      if (duplicateOf !== undefined) {
        results.push({
          row: row._row,
          name: row.name,
          email: row.email,
          outcome: "skipped",
          reason: `Duplicate of row ${duplicateOf} in this file`,
        });
        continue;
      }

      if (email) processedByEmail.set(email, row._row);
      processedByName.set(nameKey(row), { row: row._row, hadEmail: Boolean(email) });

      const existing = findExisting(row);

      try {
        if (existing) {
          // Fill in blanks only. The coach's existing record — which they may
          // have edited by hand — wins over a stale spreadsheet column.
          const updates: Record<string, unknown> = {};
          if (!existing.email && row.email) updates.email = row.email.toLowerCase();
          if (!existing.phoneNumber && row.phone) updates.phoneNumber = row.phone;
          if (!existing.parentEmail && row.parentEmail)
            updates.parentEmail = row.parentEmail.toLowerCase();
          if (!existing.parentPhone && row.parentPhone)
            updates.parentPhone = row.parentPhone;
          if (existing.graduationYear === null && row.graduationYear !== undefined)
            updates.graduationYear = row.graduationYear;
          if (!existing.jerseyNumber && row.jerseyNumber)
            updates.jerseyNumber = row.jerseyNumber;
          if (!existing.position && row.position) updates.position = row.position;
          if (!existing.grade && row.grade) updates.grade = row.grade;

          if (Object.keys(updates).length === 0) {
            results.push({
              row: row._row,
              name: row.name,
              email: row.email,
              outcome: "skipped",
              reason: "Already on the roster, nothing new to add",
              teamMemberId: existing.id,
            });
            continue;
          }

          await prisma.teamMember.update({
            where: { id: existing.id },
            data: updates,
          });

          // Keep the in-memory view current so a later row in the same file
          // does not re-fill a field this row just populated.
          Object.assign(existing, updates);

          results.push({
            row: row._row,
            name: row.name,
            email: row.email,
            outcome: "updated",
            reason: `Filled in ${Object.keys(updates).join(", ")}`,
            teamMemberId: existing.id,
          });
          continue;
        }

        const playerFields = {
          name: row.name,
          email: row.email ? row.email.toLowerCase() : null,
          phoneNumber: row.phone ?? null,
          parentEmail: row.parentEmail ? row.parentEmail.toLowerCase() : null,
          parentPhone: row.parentPhone ?? null,
          graduationYear: row.graduationYear ?? null,
          jerseyNumber: row.jerseyNumber ?? null,
          position: row.position ?? null,
          grade: row.grade ?? null,
          personalGoal:
            row.personalGoal !== undefined
              ? BigInt(Math.round(row.personalGoal * 100))
              : null,
        };

        const removed = findDeleted(row);

        if (removed) {
          // Bring the original row back rather than inserting a twin. Blanks on
          // the removed record are filled from the file; anything already set
          // there is left alone, same rule as the update branch above.
          const revived = await prisma.teamMember.update({
            where: { id: removed.id },
            data: {
              deletedAt: null,
              name: row.name,
              ...(removed.email ? {} : { email: playerFields.email }),
              ...(removed.phoneNumber ? {} : { phoneNumber: playerFields.phoneNumber }),
              ...(removed.parentEmail ? {} : { parentEmail: playerFields.parentEmail }),
              ...(removed.parentPhone ? {} : { parentPhone: playerFields.parentPhone }),
              ...(removed.graduationYear === null
                ? { graduationYear: playerFields.graduationYear }
                : {}),
              ...(removed.jerseyNumber ? {} : { jerseyNumber: playerFields.jerseyNumber }),
              ...(removed.position ? {} : { position: playerFields.position }),
              ...(removed.grade ? {} : { grade: playerFields.grade }),
            },
            select: MEMBER_MATCH_FIELDS,
          });

          forgetDeleted(removed);
          if (revived.email) byEmail.set(revived.email.toLowerCase(), revived);
          byName.set(nameKey(revived), revived);

          results.push({
            row: row._row,
            name: row.name,
            email: row.email,
            outcome: "restored",
            reason:
              "Was previously removed from this roster — restored with their fundraising history intact",
            teamMemberId: revived.id,
          });
          continue;
        }

        const fundLinkCode = await generateUniqueFundraisingLinkCode(campaignId);
        const invitationToken = generateInvitationToken();

        const created = await prisma.teamMember.create({
          data: {
            campaignId,
            ...playerFields,
            amountRaised: BigInt(0),
            fundLinkCode,
            invitationToken,
            invitationTokenExpiresAt: invitationTokenExpiry(),
            invitationStatus: "PENDING",
            // No invitation is sent here, so this stays null. It is the flag
            // the invite step keys off to know who has not been contacted.
            invitationSentAt: null,
            userId: null,
          },
          select: MEMBER_MATCH_FIELDS,
        });

        // Register the new member so later rows resolve against it too.
        if (created.email) byEmail.set(created.email.toLowerCase(), created);
        byName.set(nameKey(created), created);

        results.push({
          row: row._row,
          name: row.name,
          email: row.email,
          outcome: "created",
          teamMemberId: created.id,
        });
      } catch (error) {
        // One bad row must not lose the other 59. Record it and continue.
        console.error(`Roster import: row ${row._row} failed`, error);

        // The (campaignId, email) unique index only covers live rows, so P2002
        // here means a genuine clash with a player currently on the roster —
        // never the old false report against an already-removed one.
        const isUniqueViolation =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002";

        results.push({
          row: row._row,
          name: row.name,
          email: row.email,
          outcome: "failed",
          reason: isUniqueViolation
            ? "Another player currently on this roster already uses this email address"
            : "Could not save this player",
        });
      }
    }

    const summary = {
      total: data.rows.length,
      created: results.filter((r) => r.outcome === "created").length,
      // Players who had been removed from this roster and are back on it, with
      // the amount they raised previously still attached.
      restored: results.filter((r) => r.outcome === "restored").length,
      updated: results.filter((r) => r.outcome === "updated").length,
      skipped: results.filter((r) => r.outcome === "skipped").length,
      failed: results.filter((r) => r.outcome === "failed").length,
    };

    // ---- Provenance -------------------------------------------------------
    // One row per import: where the roster came from, how it was mapped, who
    // uploaded it. This is what makes a re-import reproducible and gives us an
    // answer to "where did this child's contact details come from".
    const rosterImport = await prisma.rosterImport.create({
      data: {
        campaignId,
        programId: campaign.programId ?? null,
        source: data.source,
        seasonYear: data.seasonYear ?? campaign.seasonYear ?? null,
        fileName: data.fileName ?? null,
        columnMapping: mapping as any,
        rowsTotal: summary.total,
        rowsImported: summary.created + summary.restored + summary.updated,
        rowsSkipped: summary.skipped,
        rowsFailed: summary.failed,
        importedById: user.id,
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json(
      {
        success: true,
        rosterImportId: rosterImport.id,
        importedAt: rosterImport.createdAt,
        summary,
        results: results.sort((a, b) => a.row - b.row),
        warnings: mappingCheck.warnings,
        // Stated plainly so no caller assumes the roster has been notified.
        notice:
          "No invitations were sent. Invite players from the roster page when you are ready.",
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

    console.error("Roster import commit failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import roster" },
      { status: 500 }
    );
  }
}

