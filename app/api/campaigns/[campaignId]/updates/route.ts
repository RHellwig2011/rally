import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { checkCsrf } from "@/lib/csrf";
import { partitionSuppressed } from "@/lib/suppression";

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
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

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

    // Check campaign authorization. Only the fields this handler needs — the
    // previous version pulled every COMPLETED donation for the campaign into
    // memory just to notify donors, which is unbounded work on the read path.
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        slug: true,
        organizationName: true,
        teamName: true,
        programId: true,
        primaryLeaderId: true,
        guardians: { select: { id: true } },
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
    if (validatedData.notifyDonors) {
      try {
        const { sendCampaignUpdate } = await import('@/lib/email');

        // Distinct donor addresses, deduped by the database rather than by
        // loading every donation row.
        const donorRows = await prisma.donation.findMany({
          where: { campaignId, status: 'COMPLETED' },
          select: { donorEmail: true },
          distinct: ['donorEmail'],
        });

        // Compliance gate: every send path runs its recipients through the
        // suppression layer first. A donor who unsubscribed is still a donor,
        // so without this they keep receiving campaign updates. Scoped to the
        // campaign's program so a program-level opt-out is honoured alongside
        // the global ones; this fails closed (a lookup error throws to the
        // catch below and nothing is sent).
        const { allowed, suppressed } = await partitionSuppressed(
          donorRows.map(d => ({ email: d.donorEmail })),
          'EMAIL',
          campaign.programId
        );

        if (suppressed.length > 0) {
          console.log(
            `Campaign update ${update.id}: skipped ${suppressed.length} suppressed donor address(es)`
          );
        }

        if (allowed.length > 0) {
          const campaignUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/raise/${campaign.slug}`;

          // Send emails (in background, don't wait)
          const emailPromises = allowed.map(({ email }) =>
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
              data: { sentToEmails: allowed.length }
            }).catch(console.error);
          });
        }

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

// Generous default so existing callers, which send no query parameters, keep
// seeing a campaign's whole update history.
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 200;

// GET - Get all updates for a campaign
// Supports ?limit=&offset= query parameters.
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;

    // Middleware only proves a session exists; it never grants access to a
    // particular campaign. Authorize here the same way the sibling campaign
    // routes (stats, analytics) do — this endpoint exposes an update's body and
    // its recipient count, which is not another team's business.
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
      select: {
        primaryLeaderId: true,
        guardians: { select: { id: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some(g => g.id === user.id) ||
      user.role === "ADMIN";

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    // Clamped pagination, mirroring app/api/admin/transactions.
    const searchParams = req.nextUrl.searchParams;
    const parsedLimit = parseInt(searchParams.get("limit") || String(DEFAULT_LIST_LIMIT), 10);
    const limit = Number.isNaN(parsedLimit)
      ? DEFAULT_LIST_LIMIT
      : Math.min(Math.max(parsedLimit, 1), MAX_LIST_LIMIT);
    const parsedOffset = parseInt(searchParams.get("offset") || "0", 10);
    const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

    const where = {
      campaignId,
      status: 'PUBLISHED' as const,
    };

    const [updates, total] = await Promise.all([
      prisma.campaignUpdate.findMany({
        where,
        include: {
          author: {
            select: {
              firstName: true,
              lastName: true,
            }
          }
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.campaignUpdate.count({ where }),
    ]);

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
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + updates.length < total,
        }
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
