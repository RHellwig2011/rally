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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
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

    // Format response
    const formattedDisbursements = disbursements.map(d => ({
      id: d.id,
      amount: Number(d.requestedAmount) / 100,
      purpose: d.purpose,
      status: d.status,
      rejectionReason: d.rejectionReason,
      campaign: {
        id: d.bankingAccount.campaign.id,
        name: `${d.bankingAccount.campaign.teamName} - ${d.bankingAccount.campaign.organizationName}`,
        slug: d.bankingAccount.campaign.slug,
        status: d.bankingAccount.campaign.status,
      },
      requestedBy: {
        id: d.requestedByUser.id,
        name: `${d.requestedByUser.firstName} ${d.requestedByUser.lastName}`,
        email: d.requestedByUser.email,
      },
      approvedBy: d.approvedByUser ? {
        id: d.approvedByUser.id,
        name: `${d.approvedByUser.firstName} ${d.approvedByUser.lastName}`,
        email: d.approvedByUser.email,
      } : null,
      createdAt: d.createdAt,
      requestedAt: d.requestedAt,
      approvedAt: d.approvedAt,
    }));

    return NextResponse.json({
      success: true,
      disbursements: formattedDisbursements,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      summary: {
        totalAmount: Number(stats._sum.requestedAmount || 0) / 100,
        totalCount: stats._count,
        byStatus: statusCounts.map(s => ({
          status: s.status,
          count: s._count,
          totalAmount: Number(s._sum.requestedAmount || 0) / 100,
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