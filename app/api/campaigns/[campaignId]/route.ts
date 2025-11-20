import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // Get token from cookie
    const sessionToken = req.cookies.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromToken(sessionToken);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { campaignId } = params;

    // Fetch campaign with all related data
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        primaryLeader: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        guardians: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        bankingAccount: {
          include: {
            transactions: {
              take: 20,
              orderBy: { createdAt: 'desc' }
            },
            disbursementRequests: {
              take: 10,
              orderBy: { requestedAt: 'desc' },
              include: {
                requestedByUser: {
                  select: {
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          }
        },
        donations: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            donor: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        },
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          },
          orderBy: { amountRaised: 'desc' }
        },
        referrals: {
          where: {
            referrerId: user.id
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check authorization - user must be primary leader or guardian
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some(g => g.id === user.id);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to view this campaign" },
        { status: 403 }
      );
    }

    // Calculate stats
    const totalDonations = campaign.donations.length;
    const completedDonations = campaign.donations.filter(d => d.status === 'COMPLETED');
    const avgDonation = completedDonations.length > 0
      ? completedDonations.reduce((sum, d) => sum + Number(d.grossAmount), 0) / completedDonations.length
      : 0;

    // Count donors (unique by email)
    const uniqueDonorEmails = new Set(campaign.donations.map(d => d.donorEmail));
    const donorCount = uniqueDonorEmails.size;

    // Count new donors today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newDonorsToday = campaign.donations.filter(
      d => d.createdAt >= today
    ).length;

    // Calculate days left
    let daysLeft = null;
    if (campaign.endDate) {
      const now = new Date();
      const end = new Date(campaign.endDate);
      daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Prepare response data
    const responseData = {
      campaign: {
        id: campaign.id,
        organizationName: campaign.organizationName,
        teamName: campaign.teamName,
        slug: campaign.slug,
        description: campaign.description,
        goalAmount: campaign.goalAmount.toString(),
        currentAmount: campaign.currentAmount.toString(),
        status: campaign.status,
        category: campaign.category,
        primaryColor: campaign.primaryColor,
        secondaryColor: campaign.secondaryColor,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        createdAt: campaign.createdAt,
      },
      bankingAccount: campaign.bankingAccount ? {
        totalRaised: campaign.bankingAccount.totalRaised.toString(),
        platformFeesCollected: campaign.bankingAccount.platformFeesCollected.toString(),
        availableBalance: campaign.bankingAccount.availableBalance.toString(),
        disbursedTotal: campaign.bankingAccount.disbursedTotal.toString(),
        pendingDisbursement: campaign.bankingAccount.pendingDisbursement.toString(),
      } : null,
      recentDonations: campaign.donations.map(d => ({
        id: d.id,
        donorName: d.isAnonymous ? 'Anonymous' : (d.donorName || 'Anonymous'),
        donorEmail: d.donorEmail,
        grossAmount: d.grossAmount.toString(),
        platformFee: d.platformFee.toString(),
        netAmount: d.netAmount.toString(),
        donorMessage: d.donorMessage,
        isAnonymous: d.isAnonymous,
        status: d.status,
        createdAt: d.createdAt,
      })),
      disbursementRequests: campaign.bankingAccount?.disbursementRequests.map(dr => ({
        id: dr.id,
        requestedAmount: dr.requestedAmount.toString(),
        purpose: dr.purpose,
        status: dr.status,
        requestedAt: dr.requestedAt,
        requestedBy: `${dr.requestedByUser.firstName} ${dr.requestedByUser.lastName}`,
        approvedAt: dr.approvedAt,
        disbursementDate: dr.disbursementDate,
      })) || [],
      teamMembers: campaign.teamMembers.map(tm => ({
        id: tm.id,
        userId: tm.userId,
        name: tm.name,
        personalGoal: tm.personalGoal?.toString(),
        amountRaised: tm.amountRaised.toString(),
        userEmail: tm.user.email,
        createdAt: tm.createdAt,
      })),
      stats: {
        donorCount,
        avgDonation: Math.round(avgDonation),
        newDonorsToday,
        daysLeft,
        totalDonations,
      }
    };

    return NextResponse.json(
      { success: true, data: responseData },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch campaign:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campaign data" },
      { status: 500 }
    );
  }
}
