import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/requireAuth";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendSMS, formatPhoneNumber } from "@/lib/sms";

// Validation schema for creating an outreach campaign
const createCampaignSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required"),
  name: z.string().min(1, "Campaign name is required"),
  type: z.enum(["EMAIL", "SMS", "BOTH"]),
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
  smsBody: z.string().optional(),
  teamMemberIds: z.array(z.string()).optional(), // If specified, only send to these team members' contacts
  scheduledFor: z.string().datetime().optional(), // ISO datetime string
});

/**
 * POST /api/outreach/campaigns
 * Create and optionally send an outreach campaign
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validatedData = createCampaignSchema.parse(body);

    // Verify user has access to this campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: validatedData.campaignId },
      include: {
        teamMembers: {
          include: {
            contacts: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check if user is campaign leader or team member
    const isLeader = campaign.primaryLeaderId === authResult.user.id;
    const isTeamMember = campaign.teamMembers.some(
      (tm) => tm.userId === authResult.user.id
    );

    if (!isLeader && !isTeamMember) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to create outreach campaigns for this campaign" },
        { status: 403 }
      );
    }

    // Validate message content based on type
    if ((validatedData.type === "EMAIL" || validatedData.type === "BOTH") &&
        (!validatedData.emailSubject || !validatedData.emailBody)) {
      return NextResponse.json(
        { success: false, error: "Email subject and body are required for email campaigns" },
        { status: 400 }
      );
    }

    if ((validatedData.type === "SMS" || validatedData.type === "BOTH") && !validatedData.smsBody) {
      return NextResponse.json(
        { success: false, error: "SMS body is required for SMS campaigns" },
        { status: 400 }
      );
    }

    // Get contacts to send to
    let teamMembers = campaign.teamMembers;
    if (validatedData.teamMemberIds && validatedData.teamMemberIds.length > 0) {
      teamMembers = teamMembers.filter((tm) =>
        validatedData.teamMemberIds!.includes(tm.id)
      );
    }

    // Collect all contacts
    const allContacts = teamMembers.flatMap((tm) => tm.contacts);

    if (allContacts.length === 0) {
      return NextResponse.json(
        { success: false, error: "No contacts found to send to" },
        { status: 400 }
      );
    }

    // Create the outreach campaign
    const outreachCampaign = await prisma.outreachCampaign.create({
      data: {
        campaignId: validatedData.campaignId,
        createdBy: authResult.user.id,
        name: validatedData.name,
        type: validatedData.type,
        status: validatedData.scheduledFor ? "SCHEDULED" : "SENDING",
        emailSubject: validatedData.emailSubject,
        emailBody: validatedData.emailBody,
        smsBody: validatedData.smsBody,
        scheduledFor: validatedData.scheduledFor ? new Date(validatedData.scheduledFor) : null,
        totalRecipients: allContacts.length,
      },
    });

    // If not scheduled, send immediately
    if (!validatedData.scheduledFor) {
      // Send emails and SMS in the background (don't wait)
      sendOutreachMessages(outreachCampaign.id, allContacts, validatedData, campaign.slug).catch(
        (error) => console.error("Failed to send outreach messages:", error)
      );
    }

    return NextResponse.json(
      {
        success: true,
        outreachCampaign: {
          id: outreachCampaign.id,
          name: outreachCampaign.name,
          status: outreachCampaign.status,
          totalRecipients: outreachCampaign.totalRecipients,
        },
        message: validatedData.scheduledFor
          ? "Outreach campaign scheduled"
          : "Outreach campaign is being sent",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Outreach campaign error:", error);

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
        error: error instanceof Error ? error.message : "Failed to create outreach campaign",
      },
      { status: 500 }
    );
  }
}

/**
 * Send outreach messages to contacts
 */
async function sendOutreachMessages(
  outreachCampaignId: string,
  contacts: any[],
  campaignData: {
    type: "EMAIL" | "SMS" | "BOTH";
    emailSubject?: string;
    emailBody?: string;
    smsBody?: string;
  },
  campaignSlug: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const donationLink = `${appUrl}/raise/${campaignSlug}/donate`;

  let emailsSent = 0;
  let smsSent = 0;

  for (const contact of contacts) {
    // Send email
    if ((campaignData.type === "EMAIL" || campaignData.type === "BOTH") && contact.email) {
      try {
        // Replace placeholders in email
        const firstName = contact.firstName || "Friend";
        const personalizedBody = campaignData.emailBody!
          .replace(/\{firstName\}/g, firstName)
          .replace(/\{donationLink\}/g, donationLink);

        await sendEmail({
          to: contact.email,
          subject: campaignData.emailSubject!,
          html: personalizedBody,
          text: personalizedBody.replace(/<[^>]*>/g, ""), // Strip HTML tags for text version
        });

        emailsSent++;

        // Log the outreach
        await prisma.outreachLog.create({
          data: {
            outreachCampaignId,
            contactId: contact.id,
            type: campaignData.type,
            recipientEmail: contact.email,
            status: "SENT",
            sentAt: new Date(),
            emailProvider: "resend",
          },
        });

        // Update contact
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            emailsSent: { increment: 1 },
            lastContactedAt: new Date(),
          },
        });
      } catch (error) {
        console.error(`Failed to send email to ${contact.email}:`, error);

        await prisma.outreachLog.create({
          data: {
            outreachCampaignId,
            contactId: contact.id,
            type: campaignData.type,
            recipientEmail: contact.email,
            status: "FAILED",
            failureReason: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }

    // Send SMS
    if ((campaignData.type === "SMS" || campaignData.type === "BOTH") && contact.phone) {
      try {
        const formattedPhone = formatPhoneNumber(contact.phone);
        if (!formattedPhone) {
          throw new Error("Invalid phone number format");
        }

        const firstName = contact.firstName || "Friend";
        const personalizedBody = campaignData.smsBody!
          .replace(/\{firstName\}/g, firstName)
          .replace(/\{donationLink\}/g, donationLink);

        await sendSMS({
          to: formattedPhone,
          body: personalizedBody,
        });

        smsSent++;

        await prisma.outreachLog.create({
          data: {
            outreachCampaignId,
            contactId: contact.id,
            type: campaignData.type,
            recipientPhone: contact.phone,
            status: "SENT",
            sentAt: new Date(),
            smsProvider: "twilio",
          },
        });

        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            smsSent: { increment: 1 },
            lastContactedAt: new Date(),
          },
        });
      } catch (error) {
        console.error(`Failed to send SMS to ${contact.phone}:`, error);

        await prisma.outreachLog.create({
          data: {
            outreachCampaignId,
            contactId: contact.id,
            type: campaignData.type,
            recipientPhone: contact.phone,
            status: "FAILED",
            failureReason: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Update campaign stats
  await prisma.outreachCampaign.update({
    where: { id: outreachCampaignId },
    data: {
      status: "SENT",
      emailsSent,
      smsSent,
      sentAt: new Date(),
    },
  });
}

/**
 * GET /api/outreach/campaigns?campaignId=xxx
 * Get all outreach campaigns for a campaign
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
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const campaigns = await prisma.outreachCampaign.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      include: {
        createdByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        campaigns,
        total: campaigns.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch outreach campaigns:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
