import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Fetch campaign by slug with all public data. findFirst, not findUnique:
    // this is the unauthenticated public page, and DRAFT/PAUSED/CANCELLED
    // campaigns must not be reachable just by knowing the slug.
    const campaign = await prisma.campaign.findFirst({
      where: { slug, status: { in: ['ACTIVE', 'COMPLETED'] } },
      include: {
        primaryLeader: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        bankingAccount: {
          select: {
            totalRaised: true,
          }
        },
        donations: {
          where: {
            status: 'COMPLETED'
          },
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            donorName: true,
            grossAmount: true,
            donorMessage: true,
            isAnonymous: true,
            createdAt: true,
          }
        },
        cheerMessages: {
          where: {
            isApproved: true,
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            authorName: true,
            message: true,
            createdAt: true,
          }
        },
        updates: {
          where: {
            status: 'PUBLISHED',
          },
          take: 5,
          orderBy: { publishedAt: 'desc' },
          select: {
            id: true,
            title: true,
            content: true,
            publishedAt: true,
          }
        },
        teamMembers: {
          where: {
            deletedAt: null,
            isProfilePublic: true,
          },
          // Explicit select, never `include`. These rows are minors' records:
          // an unscoped fetch pulls email, phoneNumber, parentEmail,
          // parentPhone and invitationToken into this handler, one careless
          // spread away from an unauthenticated response. Only the four columns
          // the projection below actually emits are read. The user join was
          // dropped for the same reason — nothing consumed it.
          select: {
            id: true,
            name: true,
            amountRaised: true,
            personalGoal: true,
          },
          orderBy: { amountRaised: 'desc' }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Calculate stats. Both are aggregates over EVERY completed donation, not
    // just the 20 most recent ones fetched above, and both are computed in the
    // database — the donor count used to load every donor email into memory to
    // size a Set, and the average was silently computed over only that 20-row
    // page. Raw SQL quotes the camelCase identifiers because the schema has no
    // @map.
    const [donorCountRow] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT "donorEmail") AS count
      FROM "Donation"
      WHERE "campaignId" = ${campaign.id} AND "status" = 'COMPLETED'
    `;
    const donorCount = Number(donorCountRow?.count ?? 0);

    const donationStats = await prisma.donation.aggregate({
      where: {
        campaignId: campaign.id,
        status: 'COMPLETED',
      },
      _avg: { grossAmount: true },
    });
    const avgDonation = Number(donationStats._avg.grossAmount ?? 0);

    // Prepare response data
    const responseData = {
      id: campaign.id,
      slug: campaign.slug,
      organizationName: campaign.organizationName,
      teamName: campaign.teamName,
      description: campaign.description,
      goalAmount: campaign.goalAmount.toString(),
      currentAmount: campaign.currentAmount.toString(),
      platformFeePercent: campaign.platformFeePercent,
      logoUrl: campaign.logoUrl,
      bannerImageUrl: campaign.bannerImageUrl,
      primaryColor: campaign.primaryColor,
      secondaryColor: campaign.secondaryColor,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      status: campaign.status,
      category: campaign.category,
      primaryLeader: campaign.primaryLeader,
      donations: campaign.donations.map(d => ({
        id: d.id,
        donorName: d.isAnonymous ? 'Anonymous' : (d.donorName || 'Anonymous'),
        grossAmount: d.grossAmount.toString(),
        donorMessage: d.donorMessage,
        isAnonymous: d.isAnonymous,
        createdAt: d.createdAt,
      })),
      cheerMessages: campaign.cheerMessages,
      updates: campaign.updates.map(u => ({
        id: u.id,
        title: u.title,
        content: u.content,
        publishedAt: u.publishedAt,
      })),
      teamMembers: campaign.teamMembers.map(tm => ({
        id: tm.id,
        name: tm.name,
        amountRaised: tm.amountRaised.toString(),
        personalGoal: tm.personalGoal?.toString(),
      })),
      stats: {
        donorCount,
        avgDonation: Math.round(avgDonation),
      }
    };

    return NextResponse.json(
      { success: true, campaign: responseData },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch campaign:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}
