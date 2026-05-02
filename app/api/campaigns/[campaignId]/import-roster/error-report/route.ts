import { NextRequest, NextResponse } from "next/server";
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