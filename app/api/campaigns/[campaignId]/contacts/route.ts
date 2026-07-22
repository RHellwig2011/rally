import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { z } from "zod";

/**
 * Contacts for a campaign. Contact rows belong to a TeamMember, so
 * "campaign contacts" are the contacts of the campaign's team members.
 */

const createContactSchema = z.object({
  teamMemberId: z.string().min(1, "teamMemberId is required"),
  name: z.string().trim().max(200).optional(),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: z.preprocess(
    (val) => (typeof val === "string" ? val.trim().toLowerCase() : val),
    z.string().email("Invalid email format").optional()
  ),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  source: z.enum(["MANUAL_IMPORT", "CSV_UPLOAD", "ROSTER_INVITE", "DONATION"]).optional(),
});

type AuthResult =
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getUserFromToken>>> }
  | { ok: false; response: NextResponse };

async function authorizeCampaignAccess(
  req: NextRequest,
  campaignId: string
): Promise<AuthResult> {
  const sessionToken = req.cookies.get("sessionToken")?.value;
  if (!sessionToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  const user = await getUserFromToken(sessionToken);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      guardians: {
        select: { id: true },
      },
    },
  });

  if (!campaign) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      ),
    };
  }

  const isAuthorized =
    campaign.primaryLeaderId === user.id ||
    campaign.guardians.some((g) => g.id === user.id) ||
    user.role === "ADMIN";

  if (!isAuthorized) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Not authorized to manage this campaign" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user };
}

function formatContact(contact: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  notes: string | null;
  tags: string[];
  emailsSent: number;
  smsSent: number;
  lastContactedAt: Date | null;
  donated: boolean;
  donationAmount: bigint | null;
  createdAt: Date;
  teamMemberId: string;
  teamMember?: { id: string; name: string } | null;
}) {
  return {
    id: contact.id,
    name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    source: contact.source,
    notes: contact.notes,
    tags: contact.tags,
    emailsSent: contact.emailsSent,
    smsSent: contact.smsSent,
    lastContactedAt: contact.lastContactedAt,
    donated: contact.donated,
    donationAmount:
      contact.donationAmount != null ? Number(contact.donationAmount) / 100 : null,
    teamMemberId: contact.teamMemberId,
    teamMember: contact.teamMember
      ? { id: contact.teamMember.id, name: contact.teamMember.name }
      : null,
    createdAt: contact.createdAt,
  };
}

/**
 * GET /api/campaigns/[campaignId]/contacts
 * List all contacts belonging to the campaign's team members
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;

    const auth = await authorizeCampaignAccess(req, campaignId);
    if (!auth.ok) {
      return auth.response;
    }

    const contacts = await prisma.contact.findMany({
      where: {
        teamMember: {
          campaignId,
          deletedAt: null,
        },
      },
      include: {
        teamMember: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        success: true,
        contacts: contacts.map(formatContact),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contacts fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/[campaignId]/contacts
 * Create a contact for one of the campaign's team members
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // CSRF check (state-changing route)
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    const { campaignId } = params;

    const auth = await authorizeCampaignAccess(req, campaignId);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await req.json();
    const validated = createContactSchema.parse(body);

    if (!validated.email && !validated.phone) {
      return NextResponse.json(
        { success: false, error: "Either email or phone is required" },
        { status: 400 }
      );
    }

    // The team member the contact belongs to must be part of this campaign
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        id: validated.teamMemberId,
        campaignId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!teamMember) {
      return NextResponse.json(
        { success: false, error: "Team member not found in this campaign" },
        { status: 404 }
      );
    }

    // Dedupe by email within the campaign
    if (validated.email) {
      const existing = await prisma.contact.findFirst({
        where: {
          email: validated.email,
          teamMember: { campaignId },
        },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: "A contact with this email already exists in the campaign",
            contactId: existing.id,
          },
          { status: 409 }
        );
      }
    }

    // Derive first/last name from a single "name" field if provided
    let firstName = validated.firstName;
    let lastName = validated.lastName;
    if (!firstName && !lastName && validated.name) {
      const parts = validated.name.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(" ") || undefined;
    }

    const contact = await prisma.contact.create({
      data: {
        teamMemberId: teamMember.id,
        firstName: firstName || null,
        lastName: lastName || null,
        email: validated.email || null,
        phone: validated.phone || null,
        notes: validated.notes || null,
        tags: validated.tags || [],
        source: validated.source || "MANUAL_IMPORT",
      },
      include: {
        teamMember: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        contact: formatContact(contact),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact creation error:", error);

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
      { success: false, error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
