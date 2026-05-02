import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;

    // For now, return mock contacts
    // In production, this would fetch from a contacts table
    const mockContacts = [
      {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        phone: "+15555551234",
      },
      {
        id: "2",
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "+15555555678",
      },
      {
        id: "3",
        name: "Bob Johnson",
        email: "bob@example.com",
        phone: "+15555559012",
      },
    ];

    return NextResponse.json(
      {
        success: true,
        contacts: mockContacts,
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

export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;
    const body = await req.json();
    const { name, email, phone } = body;

    if (!name || (!email && !phone)) {
      return NextResponse.json(
        { success: false, error: "Name and email or phone required" },
        { status: 400 }
      );
    }

    // In production, this would save to database
    // For now, just return success

    return NextResponse.json(
      {
        success: true,
        contact: {
          id: Date.now().toString(),
          name,
          email,
          phone,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact creation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
