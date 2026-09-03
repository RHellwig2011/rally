import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { checkCsrf } from "@/lib/csrf";
import { recordOfflineDonation } from "@/lib/banking";

/**
 * POST /api/campaigns/[campaignId]/donations/offline
 *
 * H8: staff-only entry of an offline (cash / paper check) gift the team
 * already physically holds. Writes the same Donation + Transaction ledger as
 * card gifts (see recordOfflineDonation for the balance semantics: totals
 * count it, availableBalance does not).
 *
 * Cookie-authenticated mutation -> CSRF double-submit applies. Authorized for
 * the campaign's primary leader, its guardians, and platform ADMINs.
 */

const offlineDonationSchema = z.object({
  // Dollars-and-cents as integer cents, consistent with the DB unit.
  amountInCents: z
    .number()
    .int()
    .positive()
    .max(10_000_000, "Offline entries above $100,000 are not accepted"),
  method: z.enum(["CASH", "CHECK"]),
  donorName: z.string().trim().max(200).optional(),
  donorEmail: z.string().trim().email().optional().or(z.literal("")),
  donorMessage: z.string().trim().max(2000).optional(),
  isAnonymous: z.boolean().optional(),
  teamMemberId: z.string().trim().min(1).optional(),
  /** Check number or other paper reference. */
  reference: z.string().trim().max(100).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
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

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.campaignId },
      include: { guardians: { select: { id: true } } },
    });
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isAuthorized =
      user.role === "ADMIN" ||
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some((g) => g.id === user.id);
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to manage this campaign" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = offlineDonationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.errors },
        { status: 400 }
      );
    }

    let result;
    try {
      result = await recordOfflineDonation({
        campaignId: params.campaignId,
        recordedByUserId: user.id,
        grossAmount: parsed.data.amountInCents,
        method: parsed.data.method,
        donorName: parsed.data.donorName || undefined,
        donorEmail: parsed.data.donorEmail || undefined,
        donorMessage: parsed.data.donorMessage || undefined,
        isAnonymous: parsed.data.isAnonymous,
        teamMemberId: parsed.data.teamMemberId,
        reference: parsed.data.reference,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Team member not found on this campaign"
      ) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      donation: {
        id: result.donation.id,
        grossAmount: Number(result.donation.grossAmount),
        paymentMethod: result.donation.paymentMethod,
        teamMemberId: result.donation.teamMemberId,
        status: result.donation.status,
      },
    });
  } catch (error) {
    console.error("Failed to record offline donation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record offline donation" },
      { status: 500 }
    );
  }
}
