import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/requireAuth";
import prisma from "@/lib/prisma";

// Validation schema for a single contact
const contactSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});

// Validation schema for import request
const importContactsSchema = z.object({
  teamMemberId: z.string().min(1, "Team member ID is required"),
  contacts: z.array(contactSchema).min(1, "At least one contact is required"),
  source: z.enum(["MANUAL_IMPORT", "CSV_UPLOAD"]).default("MANUAL_IMPORT"),
});

/**
 * POST /api/contacts/import
 * Import contacts for a team member
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validatedData = importContactsSchema.parse(body);

    // Verify user owns this team member record
    const teamMember = await prisma.teamMember.findUnique({
      where: { id: validatedData.teamMemberId },
    });

    if (!teamMember) {
      return NextResponse.json(
        { success: false, error: "Team member not found" },
        { status: 404 }
      );
    }

    if (teamMember.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: "You can only import contacts for yourself" },
        { status: 403 }
      );
    }

    // Filter out contacts that don't have at least email or phone
    const validContacts = validatedData.contacts.filter(
      (contact) => contact.email || contact.phone
    );

    if (validContacts.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid contacts found. Each contact must have at least an email or phone number." },
        { status: 400 }
      );
    }

    // Import contacts (skip duplicates based on email or phone)
    const importedContacts = [];
    const skippedCount = { email: 0, phone: 0 };

    for (const contactData of validContacts) {
      // Check for duplicates
      const existingContact = await prisma.contact.findFirst({
        where: {
          teamMemberId: validatedData.teamMemberId,
          OR: [
            ...(contactData.email ? [{ email: contactData.email }] : []),
            ...(contactData.phone ? [{ phone: contactData.phone }] : []),
          ],
        },
      });

      if (existingContact) {
        if (contactData.email && existingContact.email === contactData.email) {
          skippedCount.email++;
        } else if (contactData.phone && existingContact.phone === contactData.phone) {
          skippedCount.phone++;
        }
        continue;
      }

      // Create new contact
      const contact = await prisma.contact.create({
        data: {
          teamMemberId: validatedData.teamMemberId,
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          email: contactData.email,
          phone: contactData.phone,
          notes: contactData.notes,
          tags: contactData.tags || [],
          source: validatedData.source,
        },
      });

      importedContacts.push(contact);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Imported ${importedContacts.length} contacts`,
        imported: importedContacts.length,
        skipped: skippedCount.email + skippedCount.phone,
        skippedDetails: skippedCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact import error:", error);

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
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to import contacts",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contacts/import?teamMemberId=xxx
 * Get all contacts for a team member
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const teamMemberId = searchParams.get("teamMemberId");

    if (!teamMemberId) {
      return NextResponse.json(
        { success: false, error: "Team member ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const teamMember = await prisma.teamMember.findUnique({
      where: { id: teamMemberId },
    });

    if (!teamMember) {
      return NextResponse.json(
        { success: false, error: "Team member not found" },
        { status: 404 }
      );
    }

    if (teamMember.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get contacts
    const contacts = await prisma.contact.findMany({
      where: { teamMemberId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        success: true,
        contacts,
        total: contacts.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch contacts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}
