import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/disbursements
 * Get all disbursement requests (BANK_ADMIN only)
 * Supports filtering by status, date range, campaign
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
    const campaignId = searchParams.get('campaignId');
    const rawLimit = parseInt(searchParams.get('limit') || '50');
    const rawOffset = parseInt(searchParams.get('offset') || '0');
    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);
    const allowedSortFields = ['createdAt', 'requestedAt', 'requestedAmount', 'status', 'approvedAt'];
    const requestedSortBy = searchParams.get('sortBy') || 'createdAt';
    const sortBy = allowedSortFields.includes(requestedSortBy) ? requestedSortBy : 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build where clause
    const validStatuses = ['PENDING', 'APPROVED', 'PROCESSING', 'REJECTED', 'COMPLETED', 'CANCELLED'];
    const where: any = {};
    if (status && validStatuses.includes(status)) where.status = status;
    if (campaignId) {
      where.bankingAccount = {
        campaignId: campaignId
      };
    }

    // Get disbursement requests
    const disbursements = await prisma.disbursementRequest.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
      include: {
        bankingAccount: {
          include: {
            campaign: {
              select: {
                id: true,
                organizationName: true,
                teamName: true,
                slug: true,
                status: true,
              }
            }
          }
        },
        requestedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        approvedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    // Get total count
    const total = await prisma.disbursementRequest.count({ where });

    // Calculate summary statistics
    const stats = await prisma.disbursementRequest.aggregate({
      where,
      _sum: {
        requestedAmount: true,
      },
      _count: true,
    });

    const statusCounts = await prisma.disbursementRequest.groupBy({
      by: ['status'],
      _count: true,
      _sum: {
        requestedAmount: true,
      }
    });

    // Format response — canonical shape consumed by /admin and /admin/disbursements.
    // All money values are integer CENTS (BigInt converted via Number()).
    const requests = disbursements.map(d => ({
      id: d.id,
      campaignId: d.campaignId,
      requestedAmount: Number(d.requestedAmount),
      purpose: d.purpose,
      description: d.description,
      receiptsUrls: d.receiptsUrls,
      status: d.status,
      rejectionReason: d.rejectionReason,
      requestedAt: d.requestedAt,
      createdAt: d.createdAt,
      approvedAt: d.approvedAt,
      disbursementDate: d.disbursementDate,
      requestedByUser: {
        id: d.requestedByUser.id,
        firstName: d.requestedByUser.firstName,
        lastName: d.requestedByUser.lastName,
        email: d.requestedByUser.email,
      },
      approvedByUser: d.approvedByUser ? {
        id: d.approvedByUser.id,
        firstName: d.approvedByUser.firstName,
        lastName: d.approvedByUser.lastName,
        email: d.approvedByUser.email,
      } : null,
      bankingAccount: {
        availableBalance: Number(d.bankingAccount.availableBalance),
        campaign: {
          id: d.bankingAccount.campaign.id,
          teamName: d.bankingAccount.campaign.teamName,
          organizationName: d.bankingAccount.campaign.organizationName,
          slug: d.bankingAccount.campaign.slug,
          status: d.bankingAccount.campaign.status,
        },
      },
    }));

    return NextResponse.json({
      success: true,
      requests,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      summary: {
        totalAmount: Number(stats._sum.requestedAmount || 0),
        totalCount: stats._count,
        byStatus: statusCounts.map(s => ({
          status: s.status,
          count: s._count,
          totalAmount: Number(s._sum.requestedAmount || 0),
        }))
      }
    });

  } catch (error) {
    console.error('Failed to fetch disbursements:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch disbursement requests"
      },
      { status: 500 }
    );
  }
}