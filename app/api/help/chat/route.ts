import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

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
- Guardian approval required for large withdrawals (configurable threshold)
- One-click payouts to linked bank account
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

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

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

    // Add recent history (last 5 messages for context)
    const recentHistory = history.slice(-5);
    recentHistory.forEach((msg: Message) => {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
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
