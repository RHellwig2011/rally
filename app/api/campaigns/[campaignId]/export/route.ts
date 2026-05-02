import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/campaigns/[campaignId]/export?type=donations|team
 * Export campaign data as CSV
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
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
    const { searchParams } = new URL(req.url);
    const exportType = searchParams.get("type") || "donations";

    // Check authorization
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        guardians: { select: { id: true } }
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

    let csv: string;
    let filename: string;

    if (exportType === "donations") {
      // Export donations
      const donations = await prisma.donation.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
      });

      // Create CSV
      const headers = ["Date", "Donor Name", "Email", "Amount", "Platform Fee", "Net Amount", "Message", "Status"];
      const rows = donations.map(d => [
        new Date(d.createdAt).toLocaleDateString(),
        d.isAnonymous ? "Anonymous" : (d.donorName || ""),
        d.donorEmail,
        `$${(Number(d.grossAmount) / 100).toFixed(2)}`,
        `$${(Number(d.platformFee) / 100).toFixed(2)}`,
        `$${(Number(d.netAmount) / 100).toFixed(2)}`,
        d.donorMessage ? `"${d.donorMessage.replace(/"/g, '""')}"` : "",
        d.status,
      ]);

      csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      filename = `${campaign.slug}-donations-${new Date().toISOString().split('T')[0]}.csv`;

    } else if (exportType === "team") {
      // Export team members
      const teamMembers = await prisma.teamMember.findMany({
        where: { campaignId },
        include: {
          user: {
            select: { email: true }
          }
        },
        orderBy: { amountRaised: 'desc' },
      });

      const headers = ["Name", "Email", "Personal Goal", "Amount Raised", "Joined Date"];
      const rows = teamMembers.map(tm => [
        tm.name,
        tm.user?.email || "",
        tm.personalGoal ? `$${(Number(tm.personalGoal) / 100).toFixed(2)}` : "",
        `$${(Number(tm.amountRaised) / 100).toFixed(2)}`,
        new Date(tm.createdAt).toLocaleDateString(),
      ]);

      csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      filename = `${campaign.slug}-team-${new Date().toISOString().split('T')[0]}.csv`;

    } else {
      return NextResponse.json(
        { success: false, error: "Invalid export type" },
        { status: 400 }
      );
    }

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("Export failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export data" },
      { status: 500 }
    );
  }
}
