import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { checkRouteRateLimit } from "@/lib/utils/with-rate-limit";
import { RATE_LIMITS } from "@/lib/utils/rate-limiter";

// This route is intentionally anonymous (the public /help page calls it), so
// the only things standing between it and an unmetered OpenAI bill are the
// rate limit and these bounds.
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 5;
const MAX_BODY_BYTES = 32 * 1024;

const chatSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(MAX_MESSAGE_CHARS),
      })
    )
    .max(50)
    .optional()
    .default([]),
});

const RALLY_CONTEXT = `You are a helpful AI assistant for Rally, a modern fundraising platform for youth teams, clubs, and school groups.

Key information about Rally:

PLATFORM FEATURES:
- Quick Setup: Create campaigns in 5 minutes with customizable branding
- AI-Powered Messaging: AI generates personalized emails and SMS messages with different tones (friendly, enthusiastic, heartfelt)
- Mass Outreach: Send bulk emails and SMS to hundreds of contacts at once
- Auto-Generated Posters: Beautiful shareable campaign graphics with real-time stats
- Individual Player Tracking: Each team member gets their own fundraising link and dashboard
- Built-In Banking: Secure campaign accounts with transparent fund tracking
- Real-Time Dashboard: Live donation notifications and analytics
- Team Roster Import: Upload team members via CSV or add manually
- Referral Tracking: Unique links for each player to track their outreach

PRICING:
- Platform Fee: 10% of donations
- Payment Processing: ~3% (standard credit card fees)
- Example: $100 donation = $87 to campaign ($10 platform fee + $3 processing fee)
- No hidden fees, no setup costs, no monthly charges
- Only pay when you receive donations

HOW IT WORKS:
1. CREATE: Set up your campaign in 5 minutes with team info and goals
2. SHARE: AI generates messages, send to contacts via email/SMS, or share posters
3. TRACK: Watch donations roll in with real-time dashboard and notifications
4. WITHDRAW: Transfer funds to your account with one-click payouts

CAMPAIGN TYPES SUPPORTED:
- Sports teams (soccer, basketball, volleyball, etc.)
- School clubs and activities
- Band and arts programs
- Community service projects
- Educational trips and tournaments

AI FEATURES:
- Message Generation: Creates authentic, age-appropriate fundraising messages
- Tone Selection: Choose friendly, enthusiastic, or heartfelt tone
- Stats Integration: Automatically includes campaign progress in messages
- Video Scripts: Generate scripts for kids to record fundraising videos
- Multiple Variations: Create A/B testing message versions

BANKING & PAYOUTS:
- Funds held in secure campaign banking accounts
- Transparent tracking of all transactions
- Payouts require a completed Stripe Connect account and BANK_ADMIN approval. Approver cannot be the same person who requested the disbursement.
- Real-time balance updates

SUPPORT:
- 24/7 AI assistant (that's you!)
- Email support: support@rally.com
- Fast response times (hours, not days)
- Dedicated help for campaign leaders

SECURITY & TRUST:
- Bank-grade security for all transactions
- Transparent fee structure (no hidden costs)
- Real-time donation tracking
- Tax receipts for donors
- Guardian oversight options

KEY BENEFITS:
- 3x more donations with AI-powered outreach
- 5-minute campaign setup (vs hours with traditional platforms)
- 98% campaign success rate
- Over $2.5M raised by 500+ teams
- 15K+ happy donors

When answering questions:
1. Be friendly, helpful, and enthusiastic
2. Keep answers concise but informative
3. Use specific features and benefits when relevant
4. Direct users to create a campaign or browse existing ones when appropriate
5. If you don't know something specific, acknowledge it and suggest contacting support
6. Emphasize how easy Rally makes fundraising
7. Use examples when helpful

Remember: You're here to help teams succeed with their fundraising goals!`;

export async function POST(req: NextRequest) {
  try {
    const rateLimitCheck = checkRouteRateLimit(req, RATE_LIMITS.CHAT);
    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    // Bound the payload before parsing it, so oversized bodies are rejected
    // rather than buffered into JSON.parse.
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: "Request body is too large" },
        { status: 413 }
      );
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parsed = chatSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400 }
      );
    }

    const { message, history } = parsed.data;

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: true,
          response: "Thanks for your question! While my AI features are currently being set up, I can still help you:\n\n✉️ Email our support team at support@rally.com\n📖 Check out our About page to learn about Rally's features\n🚀 Create a campaign at /create-campaign\n\nWe typically respond to emails within a few hours during business days!"
        },
        { status: 200 }
      );
    }

    // Initialize OpenAI client only if API key exists
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build conversation history
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: RALLY_CONTEXT,
      },
    ];

    // Only the caller's own turns are replayed. Echoing back client-supplied
    // "assistant" turns would let anyone fabricate a conversation in which the
    // assistant already agreed to ignore RALLY_CONTEXT, turning this into a
    // general-purpose model proxy billed to us.
    history
      .filter((msg) => msg.role === "user")
      .slice(-MAX_HISTORY_MESSAGES)
      .forEach((msg) => {
        const content = msg.content.trim();
        if (content) {
          messages.push({ role: "user", content });
        }
      });

    // Add current message
    messages.push({
      role: "user",
      content: message,
    });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error("No response from AI");
    }

    return NextResponse.json(
      {
        success: true,
        response: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Help chat error:", error);

    // Provide a fallback response
    return NextResponse.json(
      {
        success: true,
        response: "I apologize, but I'm having trouble connecting right now. For immediate assistance, please email us at support@rally.com or visit our About page to learn more about Rally. We typically respond within a few hours!"
      },
      { status: 200 }
    );
  }
}
