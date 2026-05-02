import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;
    const body = await req.json();
    const { messageType, subject, message, contacts } = body;

    if (!messageType || !message || !contacts || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: "Message type, message, and contacts required" },
        { status: 400 }
      );
    }

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // In production, this would:
    // 1. Send emails via Resend or similar service
    // 2. Send SMS via Twilio
    // 3. Track sent messages in database
    // 4. Handle rate limiting and batching

    // For now, simulate sending
    console.log(`Sending ${messageType} to ${contacts.length} contacts for campaign ${campaignId}`);
    console.log("Subject:", subject);
    console.log("Message:", message);
    console.log("Contacts:", contacts);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // In production, you'd use Resend for emails:
    /*
    if (messageType === "email") {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      for (const contact of contacts) {
        await resend.emails.send({
          from: `${campaign.teamName} <noreply@rally.com>`,
          to: contact.email,
          subject: subject,
          text: message,
        });
      }
    }
    */

    // In production, you'd use Twilio for SMS:
    /*
    if (messageType === "sms") {
      const twilio = require("twilio");
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      for (const contact of contacts) {
        if (contact.phone) {
          await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: contact.phone,
          });
        }
      }
    }
    */

    return NextResponse.json(
      {
        success: true,
        sent: contacts.length,
        message: `Successfully sent ${messageType} to ${contacts.length} contact${
          contacts.length !== 1 ? "s" : ""
        }`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Send outreach error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send messages" },
      { status: 500 }
    );
  }
}
