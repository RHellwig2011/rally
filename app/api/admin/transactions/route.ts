import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

const VALID_TYPES = [
  'DEPOSIT',
  'DISBURSEMENT',
  'FEE_COLLECTION',
  'REFUND',
  'ADJUSTMENT',
] as const;

/**
 * GET /api/admin/transactions
 * List recent platform transactions (ADMIN or BANK_ADMIN only).
 * Supports ?limit=&offset=&type= query parameters.
 * All BigInt amounts are converted to Number (cents) for JSON safety.
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

    // Parse and clamp query parameters
    const searchParams = req.nextUrl.searchParams;
    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
    const parsedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

    const typeParam = searchParams.get('type');
    const where: any = {};
    if (typeParam && (VALID_TYPES as readonly string[]).includes(typeParam)) {
      where.type = typeParam;
    }

    const [transactions, total, typeTotals] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          bankingAccount: {
            select: {
              id: true,
              campaign: {
                select: {
                  id: true,
                  teamName: true,
                  organizationName: true,
                  slug: true,
                },
              },
            },
          },
          donation: {
            select: {
              id: true,
              donorName: true,
              isAnonymous: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.groupBy({
        by: ['type'],
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const formattedTransactions = transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      description: t.description,
      createdAt: t.createdAt,
      campaign: t.bankingAccount?.campaign
        ? {
            id: t.bankingAccount.campaign.id,
            teamName: t.bankingAccount.campaign.teamName,
            organizationName: t.bankingAccount.campaign.organizationName,
            slug: t.bankingAccount.campaign.slug,
            name: `${t.bankingAccount.campaign.organizationName} - ${t.bankingAccount.campaign.teamName}`,
          }
        : null,
      donor: t.donation
        ? t.donation.isAnonymous
          ? "Anonymous"
          : t.donation.donorName || null
        : null,
      metadata: t.metadata ?? null,
    }));

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      summary: {
        byType: typeTotals.map((t) => ({
          type: t.type,
          totalAmount: Number(t._sum.amount || 0),
          count: t._count,
        })),
      },
    });

  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transactions"
      },
      { status: 500 }
    );
  }
}
