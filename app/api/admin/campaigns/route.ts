import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/campaigns
 * Get all campaigns with filtering, search, and pagination
 * Admin endpoint for campaign management
 */
export async function GET(req: NextRequest) {
  try {
    // Authentication check
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

    // Check authorization - only BANK_ADMIN or ADMIN
    if (user.role !== 'BANK_ADMIN' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { organizationName: { contains: search, mode: 'insensitive' } },
        { teamName: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // Get campaigns with related data
    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
      include: {
        primaryLeader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        bankingAccount: {
          select: {
            totalRaised: true,
            availableBalance: true,
            disbursedTotal: true,
            pendingDisbursement: true,
          }
        },
        _count: {
          select: {
            teamMembers: true,
            donations: {
              where: { status: 'COMPLETED' }
            }
          }
        }
      }
    });

    // Get total count
    const total = await prisma.campaign.count({ where });

    // Get unique donor counts for each campaign
    const campaignsWithDonors = await Promise.all(
      campaigns.map(async (c) => {
        const uniqueDonors = await prisma.donation.findMany({
          where: {
            campaignId: c.id,
            status: 'COMPLETED',
          },
          select: { donorEmail: true },
          distinct: ['donorEmail'],
        });

        // Calculate days remaining
        const daysRemaining = c.endDate
          ? Math.max(0, Math.ceil((c.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
          : null;

        // Calculate progress
        const progress = Number(c.goalAmount) > 0
          ? Math.round((Number(c.currentAmount) / Number(c.goalAmount)) * 100)
          : 0;

        return {
          id: c.id,
          organizationName: c.organizationName,
          teamName: c.teamName,
          name: `${c.teamName} - ${c.organizationName}`,
          slug: c.slug,
          category: c.category,
          status: c.status,

          // Financial
          goalAmount: Number(c.goalAmount) / 100,
          currentAmount: Number(c.currentAmount) / 100,
          progress,

          // Banking
          banking: c.bankingAccount ? {
            totalRaised: Number(c.bankingAccount.totalRaised) / 100,
            availableBalance: Number(c.bankingAccount.availableBalance) / 100,
            disbursedTotal: Number(c.bankingAccount.disbursedTotal) / 100,
            pendingDisbursement: Number(c.bankingAccount.pendingDisbursement) / 100,
          } : null,

          // Statistics
          teamMemberCount: c._count.teamMembers,
          donationCount: c._count.donations,
          uniqueDonorCount: uniqueDonors.length,
          disbursementRequestCount: 0, // TODO: Add disbursement request count

          // Dates
          startDate: c.startDate,
          endDate: c.endDate,
          daysRemaining,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,

          // Leadership
          primaryLeader: {
            id: c.primaryLeader.id,
            name: `${c.primaryLeader.firstName} ${c.primaryLeader.lastName}`,
            email: c.primaryLeader.email,
          }
        };
      })
    );

    // Get summary statistics
    const statusCounts = await prisma.campaign.groupBy({
      by: ['status'],
      _count: true,
    });

    const categoryCounts = await prisma.campaign.groupBy({
      by: ['category'],
      _count: true,
    });

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithDonors,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      summary: {
        byStatus: statusCounts.map(s => ({
          status: s.status,
          count: s._count,
        })),
        byCategory: categoryCounts.map(c => ({
          category: c.category,
          count: c._count,
        })),
        totalCampaigns: total,
      }
    });

  } catch (error) {
    console.error('Failed to fetch campaigns:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch campaigns"
      },
      { status: 500 }
    );
  }
}