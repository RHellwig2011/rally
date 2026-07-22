import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Fetch campaign by slug with all public data
    const campaign = await prisma.campaign.findUnique({
      where: { slug },
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
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            }
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

    // Calculate stats
    const completedDonations = campaign.donations;
    const uniqueDonorEmails = new Set(
      await prisma.donation.findMany({
        where: {
          campaignId: campaign.id,
          status: 'COMPLETED'
        },
        select: {
          donorEmail: true,
        }
      }).then(donations => donations.map(d => d.donorEmail))
    );
    const donorCount = uniqueDonorEmails.size;

    // Calculate average donation
    const avgDonation = completedDonations.length > 0
      ? completedDonations.reduce((sum, d) => sum + Number(d.grossAmount), 0) / completedDonations.length
      : 0;

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
