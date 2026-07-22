import { NextRequest, NextResponse } from "next/server";
import { checkCsrf } from "@/lib/csrf";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createErrorReport, CSVImportResult } from "@/lib/utils/csv-parser";

/**
 * POST /api/campaigns/[campaignId]/import-roster/error-report
 * Generate and download CSV import error report
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // Consistent with the sibling import-roster route. This handler writes
    // nothing, so the check is defense-in-depth; the client already sends it.
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // This handler only reformats a payload the caller already holds, but the
    // payload is a roster of minors' names and emails. Gate it behind the same
    // campaign-staff check as every other roster endpoint so it can never
    // become an unauthenticated formatting oracle.
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

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        primaryLeaderId: true,
        guardians: { select: { id: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some((g) => g.id === user.id) ||
      user.role === "ADMIN";

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    // Parse the import result from request body
    const body = await req.json();

    if (!body || !body.summary || !body.results) {
      return NextResponse.json(
        { success: false, error: "Invalid import result data" },
        { status: 400 }
      );
    }

    const importResult = body as CSVImportResult;

    // Generate error report
    const reportContent = createErrorReport(importResult);

    // Return CSV file
    return new NextResponse(reportContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="import_report_${Date.now()}.csv"`,
      },
    });

  } catch (error) {
    console.error("Failed to generate error report:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate error report" },
      { status: 500 }
    );
  }
}