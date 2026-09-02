import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCsrf } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  normalizeEmail,
  normalizePhone,
  partitionSuppressed,
} from "@/lib/suppression";
import { z } from "zod";

/**
 * PUBLIC token-resolved contact collection.
 *
 * Neither handler reads the session - the entire point is that a parent can
 * open the link from a text message without an account. The token is the only
 * credential, so both handlers are deliberately stingy about what they return:
 * the player's FIRST name, the team, and aggregate goal progress. Never other
 * players, never contact emails/phones already on file, never donor data.
 *
 * NOTE: requires middleware to treat "/api/contact-invite/" as a public API
 * prefix (and "/contribute/" as a public page prefix) - requested from the
 * orchestrator, since middleware.ts is not this agent's file.
 */

const MAX_CONTACTS_PER_SUBMISSION = 50;

// Rate limit submissions per token, mirroring lib/utils/rate-limit.ts configs.
// Generous enough for a parent fixing a typo and resubmitting, tight enough
// that a leaked token is not a bulk contact-injection endpoint.
const inviteSubmitRateLimit = {
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
};

const contactSchema = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: z
    .string()
    .trim()
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  relationship: z.string().trim().max(60).optional().or(z.literal("")),
});

const submitSchema = z.object({
  contacts: z
    .array(contactSchema)
    .min(1, "At least one contact is required")
    .max(
      MAX_CONTACTS_PER_SUBMISSION,
      `At most ${MAX_CONTACTS_PER_SUBMISSION} contacts per submission`
    ),
  consentAttested: z.boolean(),
});

/**
 * The digits exactly as submitted, country code included — this is the STORAGE
 * shape for Contact.phone, not a matching key. Every comparison (opt-out,
 * dedupe) runs through lib/suppression.ts#normalizePhone instead, so this
 * endpoint decides "has this person opted out?" with byte-for-byte the same
 * normalization recordOptOut wrote the row with. Diverging here is a TCPA
 * problem, not a cosmetic one: a "+1 (555) 010-1234" opt-out must still block a
 * "5550101234" submission.
 */
function toStoredPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ResolvedInvite = Awaited<ReturnType<typeof resolveInvite>>;

async function resolveInvite(token: string) {
  return prisma.contactInvite.findUnique({
    where: { token },
    include: {
      teamMember: {
        select: {
          id: true,
          name: true,
          deletedAt: true,
          campaign: {
            select: {
              id: true,
              programId: true,
              organizationName: true,
              teamName: true,
              goalAmount: true,
              currentAmount: true,
              minContactsPerPlayer: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Gate an invite: 404 for unknown, 410 for revoked/expired/orphaned.
 * 410 Gone is the honest status here - the link was real, it is simply no
 * longer usable, and the page shows a "this link has expired" state.
 */
function gateInvite(
  invite: ResolvedInvite
):
  | { ok: true; invite: NonNullable<ResolvedInvite> }
  | { ok: false; response: NextResponse } {
  if (!invite) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "This link is not valid." },
        { status: 404 }
      ),
    };
  }

  if (invite.revokedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error:
            "This link has been replaced. Ask your coach or team contact for the current link.",
          reason: "REVOKED",
        },
        { status: 410 }
      ),
    };
  }

  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error:
            "This link has expired. Ask your coach or team contact for a new one.",
          reason: "EXPIRED",
        },
        { status: 410 }
      ),
    };
  }

  if (!invite.teamMember || invite.teamMember.deletedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: "This link is no longer active.",
          reason: "INACTIVE",
        },
        { status: 410 }
      ),
    };
  }

  return { ok: true, invite: invite as NonNullable<ResolvedInvite> };
}

/**
 * GET /api/contact-invite/[token]
 * PUBLIC. Returns only what the /contribute page renders.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const invite = await resolveInvite(params.token);

    const gate = gateInvite(invite);
    if (!gate.ok) {
      return gate.response;
    }

    const { teamMember } = gate.invite;
    const campaign = teamMember.campaign;

    const contactCount = await prisma.contact.count({
      where: { teamMemberId: teamMember.id },
    });

    // First name only - the public page greets the parent, it does not
    // publish the roster.
    const playerFirstName = teamMember.name.trim().split(/\s+/)[0] || teamMember.name;

    // Money is BigInt cents in the DB; JSON.stringify throws on BigInt.
    const goalCents = Number(campaign.goalAmount);
    const raisedCents = Number(campaign.currentAmount);
    const percentRaised =
      goalCents > 0 ? Math.min(Math.round((raisedCents / goalCents) * 100), 100) : 0;

    return NextResponse.json(
      {
        success: true,
        invite: {
          role: gate.invite.role,
        },
        player: {
          firstName: playerFirstName,
        },
        team: {
          organizationName: campaign.organizationName,
          teamName: campaign.teamName,
        },
        progress: {
          // Display-safe: dollars as plain numbers, plus a precomputed percent.
          goalDollars: goalCents / 100,
          raisedDollars: raisedCents / 100,
          percentRaised,
        },
        contacts: {
          minContactsPerPlayer: campaign.minContactsPerPlayer,
          submitted: contactCount,
          remaining: Math.max(campaign.minContactsPerPlayer - contactCount, 0),
          quotaMet: contactCount >= campaign.minContactsPerPlayer,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact invite lookup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load this link" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contact-invite/[token]
 * PUBLIC. Accepts supporter contacts from an anonymous submitter.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // CSRF check (state-changing route). Works for anonymous submitters:
    // /api/csrf-token is public and sets the double-submit cookie.
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    const { token } = params;

    // Rate limit by token, not by IP: a whole family behind one NAT should not
    // lock each other out, but a single leaked token should be contained.
    const rate = checkRateLimit(`contact-invite:${token}`, inviteSubmitRateLimit);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many submissions for this link. Please try again later.",
          retryAfter: rate.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rate.retryAfter ?? 60),
          },
        }
      );
    }

    const invite = await resolveInvite(token);
    const gate = gateInvite(invite);
    if (!gate.ok) {
      return gate.response;
    }

    const { teamMember } = gate.invite;
    const campaign = teamMember.campaign;

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const validated = submitSchema.parse(body);

    // Consent is a hard gate, not a checkbox we record and ignore. The
    // submitter is sharing OTHER people's contact details; under TCPA an
    // athlete cannot consent on a relative's behalf, so the person doing the
    // sharing must affirm they have permission.
    if (validated.consentAttested !== true) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must confirm you have permission to share these people's contact details.",
          code: "CONSENT_REQUIRED",
        },
        { status: 400 }
      );
    }

    const attestedAt = new Date();

    // --- Normalize + shape the submitted rows -------------------------------
    type Candidate = {
      index: number;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
      relationship: string | null;
    };

    const candidates: Candidate[] = [];
    const invalid: { index: number; reason: string }[] = [];

    validated.contacts.forEach((raw, index) => {
      const email = normalizeEmail(raw.email);
      const phone = toStoredPhone(raw.phone);

      if (!email && !phone) {
        invalid.push({ index, reason: "Each contact needs an email or a phone number" });
        return;
      }

      if (email && !EMAIL_RE.test(email)) {
        invalid.push({ index, reason: "Invalid email address" });
        return;
      }

      // 10 digits US, 11 with country code. Anything shorter is a typo.
      if (phone && (phone.length < 10 || phone.length > 15)) {
        invalid.push({ index, reason: "Invalid phone number" });
        return;
      }

      candidates.push({
        index,
        firstName: raw.firstName?.trim() || null,
        lastName: raw.lastName?.trim() || null,
        email,
        phone,
        relationship: raw.relationship?.trim() || null,
      });
    });

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid contacts were submitted",
          invalid,
        },
        { status: 400 }
      );
    }

    // --- Suppression: never resurrect an opted-out contact ------------------
    // Delegated to lib/suppression.ts rather than matched against a locally
    // normalized set: that module's SQL is what recordOptOut writes against, so
    // this is the only way the two sides are guaranteed to agree. Channel "ALL"
    // matches an opt-out row on ANY channel, which is what this endpoint wants
    // — someone who told us to stop must not be re-added to a roster at all.
    // Global opt-outs (programId null) always apply; program-scoped ones apply
    // only to this campaign's program, which partitionSuppressed handles.
    const { suppressed: suppressedCandidates } = await partitionSuppressed(
      candidates,
      "ALL",
      campaign.programId ?? null
    );
    const suppressedIndexes = new Set(suppressedCandidates.map((c) => c.index));

    // --- Dedupe against contacts already on file for this player ------------
    const existing = await prisma.contact.findMany({
      where: { teamMemberId: teamMember.id },
      select: { email: true, phone: true },
    });

    const existingEmails = new Set(
      existing.map((c) => normalizeEmail(c.email)).filter((e): e is string => !!e)
    );
    const existingPhones = new Set(
      existing.map((c) => normalizePhone(c.phone)).filter((p): p is string => !!p)
    );

    const suppressed: { index: number; email: string | null; phone: string | null }[] = [];
    const duplicates: { index: number; email: string | null; phone: string | null }[] = [];
    const toCreate: Candidate[] = [];

    // Batch-local sets so a submission that repeats a row inserts it once.
    const batchEmails = new Set<string>();
    const batchPhones = new Set<string>();

    for (const c of candidates) {
      if (suppressedIndexes.has(c.index)) {
        // Silently skipped for the submitter's purposes, but reported back as
        // a count so the page can be honest that not everyone was added.
        suppressed.push({ index: c.index, email: c.email, phone: c.phone });
        continue;
      }

      // Compare on the canonical (last-10-digit) form so "+1 555 010 1234" and
      // "5550101234" are recognised as the same person already on file.
      const phoneKey = normalizePhone(c.phone);

      const isDuplicate =
        (c.email && (existingEmails.has(c.email) || batchEmails.has(c.email))) ||
        (phoneKey && (existingPhones.has(phoneKey) || batchPhones.has(phoneKey)));

      if (isDuplicate) {
        duplicates.push({ index: c.index, email: c.email, phone: c.phone });
        continue;
      }

      if (c.email) batchEmails.add(c.email);
      if (phoneKey) batchPhones.add(phoneKey);
      toCreate.push(c);
    }

    // --- Persist ------------------------------------------------------------
    // The attestation lands in first-class columns (consentAttestedAt /
    // consentSource / consentAttestedById) so it is queryable — a free-text note
    // cannot answer "which contacts did we mail without a recorded basis?".
    // notes now carries only the human-readable relationship.
    const buildNotes = (c: Candidate) =>
      c.relationship
        ? `relationship=${c.relationship.replace(/[\s=]+/g, "_")}`
        : null;

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const c of toCreate) {
        const row = await tx.contact.create({
          data: {
            teamMemberId: teamMember.id,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            phone: c.phone,
            source: "ROSTER_INVITE",
            notes: buildNotes(c),
            consentAttestedAt: attestedAt,
            consentSource: `contact-invite:${gate.invite.role}`,
            consentAttestedById: gate.invite.id,
            tags: c.relationship ? [`relationship:${c.relationship}`] : [],
          },
          select: { id: true },
        });
        rows.push(row);
      }

      await tx.contactInvite.update({
        where: { id: gate.invite.id },
        data: {
          useCount: { increment: 1 },
          lastUsedAt: attestedAt,
        },
      });

      return rows;
    });

    const totalContacts = await prisma.contact.count({
      where: { teamMemberId: teamMember.id },
    });

    return NextResponse.json(
      {
        success: true,
        added: created.length,
        suppressedCount: suppressed.length,
        duplicateCount: duplicates.length,
        invalidCount: invalid.length,
        invalid,
        contacts: {
          minContactsPerPlayer: campaign.minContactsPerPlayer,
          submitted: totalContacts,
          remaining: Math.max(campaign.minContactsPerPlayer - totalContacts, 0),
          quotaMet: totalContacts >= campaign.minContactsPerPlayer,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact invite submission error:", error);

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

    return NextResponse.json(
      { success: false, error: "Failed to submit contacts" },
      { status: 500 }
    );
  }
}
