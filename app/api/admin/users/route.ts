import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/users
 * Get all users with filtering and pagination
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
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const emailVerified = searchParams.get('emailVerified');

    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
    const parsedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

    const allowedSortFields = ['createdAt', 'updatedAt', 'email', 'firstName', 'lastName', 'role'];
    const sortByParam = searchParams.get('sortBy') || 'createdAt';
    const sortBy = allowedSortFields.includes(sortByParam) ? sortByParam : 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const validRoles = ['DONOR', 'PLAYER', 'TEAM_MEMBER', 'CAMPAIGN_LEADER', 'GUARDIAN', 'ADMIN', 'BANK_ADMIN'];

    // Build where clause
    const where: any = {};

    if (role && validRoles.includes(role)) {
      where.role = role;
    }

    if (emailVerified !== null && emailVerified !== undefined) {
      where.emailVerified = emailVerified === 'true';
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get users
    const users = await prisma.user.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            ledCampaigns: true,
            donations: {
              where: { status: 'COMPLETED' }
            }
          }
        }
      }
    });

    // Get total count
    const total = await prisma.user.count({ where });

    // Get aggregated donation amounts per user
    const userDonations = await Promise.all(
      users.map(async (u) => {
        const donationTotal = await prisma.donation.aggregate({
          where: {
            donorEmail: u.email,
            status: 'COMPLETED',
          },
          _sum: {
            grossAmount: true,
          },
          _count: true,
        });

        return {
          userId: u.id,
          totalDonated: Number(donationTotal._sum.grossAmount || 0) / 100,
          donationCount: donationTotal._count,
        };
      })
    );

    // Format response
    const formattedUsers = users.map((u) => {
      const userDonation = userDonations.find(d => d.userId === u.id);
      return {
        id: u.id,
        email: u.email,
        name: `${u.firstName} ${u.lastName}`,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        emailVerified: u.emailVerified,
        phoneVerified: u.phoneVerified,
        campaignsLed: u._count.ledCampaigns,
        donationsMade: u._count.donations,
        totalDonated: userDonation?.totalDonated || 0,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });

    // Get summary by role
    const roleCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      summary: {
        byRole: roleCounts.map(r => ({
          role: r.role,
          count: r._count,
        })),
        totalUsers: total,
      }
    });

  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch users"
      },
      { status: 500 }
    );
  }
}