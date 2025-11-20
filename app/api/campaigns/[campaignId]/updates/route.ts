import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// Validation schema
const createUpdateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  notifyDonors: z.boolean().optional().default(true),
});

// POST - Create and publish campaign update
export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
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

    const { campaignId } = params;

    // Check campaign authorization
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        guardians: { select: { id: true } },
        donations: {
          where: { status: 'COMPLETED' },
          select: { donorEmail: true, donorName: true }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some(g => g.id === user.id);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    // Validate request
    const body = await req.json();
    const validatedData = createUpdateSchema.parse(body);

    // Create campaign update
    const update = await prisma.campaignUpdate.create({
      data: {
        campaignId,
        authorId: user.id,
        title: validatedData.title,
        content: validatedData.content,
        notifyDonors: validatedData.notifyDonors,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    // Send email notifications to donors if requested
    if (validatedData.notifyDonors && campaign.donations.length > 0) {
      try {
        const { sendCampaignUpdate } = await import('@/lib/email');

        // Get unique donor emails
        const uniqueDonors = new Map<string, string>();
        campaign.donations.forEach(d => {
          if (!uniqueDonors.has(d.donorEmail)) {
            uniqueDonors.set(d.donorEmail, d.donorName || 'Supporter');
          }
        });

        const campaignUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/raise/${campaign.slug}`;

        // Send emails (in background, don't wait)
        const emailPromises = Array.from(uniqueDonors.entries()).map(([email, name]) =>
          sendCampaignUpdate({
            toEmail: email,
            campaignName: `${campaign.organizationName} ${campaign.teamName}`,
            updateTitle: validatedData.title,
            updateContent: validatedData.content,
            campaignUrl,
          }).catch(err => {
            console.error(`Failed to send update to ${email}:`, err);
          })
        );

        // Don't wait for emails, but track count
        Promise.all(emailPromises).then(() => {
          prisma.campaignUpdate.update({
            where: { id: update.id },
            data: { sentToEmails: uniqueDonors.size }
          }).catch(console.error);
        });

      } catch (emailError) {
        console.error('Failed to send campaign updates:', emailError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        update: {
          id: update.id,
          title: update.title,
          content: update.content,
          authorName: `${update.author.firstName} ${update.author.lastName}`,
          publishedAt: update.publishedAt,
          notifyDonors: update.notifyDonors,
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create update:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map(e => ({ field: e.path.join("."), message: e.message }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to create update" },
      { status: 500 }
    );
  }
}

// GET - Get all updates for a campaign
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;

    const updates = await prisma.campaignUpdate.findMany({
      where: {
        campaignId,
        status: 'PUBLISHED',
      },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { publishedAt: 'desc' },
    });

    return NextResponse.json(
      {
        success: true,
        updates: updates.map(u => ({
          id: u.id,
          title: u.title,
          content: u.content,
          authorName: `${u.author.firstName} ${u.author.lastName}`,
          publishedAt: u.publishedAt,
          sentToEmails: u.sentToEmails,
        }))
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch updates:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch updates" },
      { status: 500 }
    );
  }
}
