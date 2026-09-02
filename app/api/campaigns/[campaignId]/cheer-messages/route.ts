import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getClientIdentifier } from "@/lib/utils/rate-limiter";

/**
 * POST here is PUBLIC by design (middleware lets /cheer-messages through so
 * anonymous well-wishers can post), which makes it an unauthenticated write.
 * Keyed on IP + campaignId: one spammer must not be able to bury a single
 * team's moderation queue, but a shared school/library NAT posting to several
 * different campaigns should not be collectively locked out.
 */
const CHEER_POST_RATE_LIMIT = {
  limit: 10, // 10 messages
  windowMs: 15 * 60 * 1000, // per 15 minutes
};

/** Free-text name shown on the wall; bounded like every other public input. */
const MAX_AUTHOR_NAME_LENGTH = 100;

/**
 * GET /api/campaigns/[campaignId]/cheer-messages
 * List cheer messages for moderation (campaign leader or admin only).
 * Optional ?status=pending|approved filter.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;

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

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, primaryLeaderId: true },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.primaryLeaderId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const status = req.nextUrl.searchParams.get("status");
    const where: { campaignId: string; isApproved?: boolean } = { campaignId };
    if (status === "pending") where.isApproved = false;
    if (status === "approved") where.isApproved = true;

    const messages = await prisma.cheerWallMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        authorName: true,
        message: true,
        isAnonymous: true,
        isApproved: true,
        isFlagged: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    console.error("Failed to list cheer messages:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load cheer messages" },
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

    // Throttle before touching the body or the database. Mirrors the rest of
    // the limiter family (and middleware) by bypassing in development.
    if (process.env.NODE_ENV !== "development") {
      const identifier = `cheer:${getClientIdentifier(req)}:${campaignId}`;
      const { limited, info } = checkRateLimit(identifier, CHEER_POST_RATE_LIMIT);
      if (limited) {
        return NextResponse.json(
          {
            success: false,
            error: "Too many messages. Please try again later.",
            retryAfter: info.reset,
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": info.limit.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": info.reset.toString(),
              "Retry-After": Math.max(
                0,
                info.reset - Math.floor(Date.now() / 1000)
              ).toString(),
            },
          }
        );
      }
    }

    const body = await req.json();
    const { authorName, message, isAnonymous } = body;

    // Anonymous posts arrive from an unauthenticated caller, so nothing about
    // the body's shape can be assumed — a non-string message would otherwise
    // throw on .trim() and surface as a 500.
    if (typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        { success: false, error: "Message must be 500 characters or less" },
        { status: 400 }
      );
    }

    const anonymous = isAnonymous === true;
    const submittedName = typeof authorName === "string" ? authorName.trim() : "";

    if (!anonymous && submittedName.length === 0) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    if (submittedName.length > MAX_AUTHOR_NAME_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Name must be ${MAX_AUTHOR_NAME_LENGTH} characters or less`,
        },
        { status: 400 }
      );
    }

    const displayName = anonymous ? "Anonymous" : submittedName || "Anonymous";

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

    // Create cheer message (pending approval)
    const cheerMessage = await prisma.cheerWallMessage.create({
      data: {
        campaignId,
        authorName: displayName,
        message: message.trim(),
        // Persisted, not just folded into displayName: the moderation list and
        // the public wall both read isAnonymous, and dropping it here made
        // every submission look like a named post to those consumers.
        isAnonymous: anonymous,
        isApproved: false, // Require approval by campaign owner
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your message has been submitted and is pending approval!",
        cheerMessage: {
          id: cheerMessage.id,
          authorName: cheerMessage.authorName,
          message: cheerMessage.message,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create cheer message:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit message" },
      { status: 500 }
    );
  }
}
