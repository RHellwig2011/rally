import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  parseCSV,
  validateCSVRows,
  MAX_CSV_FILE_SIZE,
  MAX_CSV_ROWS,
  CSVImportResult,
  createErrorReport,
} from "@/lib/utils/csv-parser";
import {
  generateUniqueFundraisingLinkCode,
  checkTeamMemberLimit,
  sendTeamMemberInvitation,
  formatFundraisingLink,
} from "@/lib/utils/team-member";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  applyRateLimitHeaders
} from "@/lib/utils/rate-limit";

/**
 * POST /api/campaigns/[campaignId]/import-roster
 * Import team members from CSV file
 * Requirements:
 * - Max file size: 5 MB
 * - Max rows: 500
 * - Rate limit: 1 import per campaign per hour
 * - Atomic operation: all or nothing
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
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

    const campaignId = params.campaignId;

    // Rate limiting: 1 import per campaign per hour
    const rateLimitId = `csv-import:${campaignId}`;
    const rateLimitConfig = {
      maxRequests: 1,
      windowMs: 60 * 60 * 1000, // 1 hour
    };
    const rateLimitResult = checkRateLimit(rateLimitId, rateLimitConfig);

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: "CSV import rate limit exceeded. You can only import once per hour per campaign.",
          retryAfter: rateLimitResult.retryAfter,
          nextImportTime: new Date(rateLimitResult.resetTime).toISOString()
        },
        { status: 429 }
      );
      applyRateLimitHeaders(response.headers, rateLimitResult);
      return response;
    }

    // Verify campaign exists and user is authorized
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        guardians: {
          select: { id: true }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check authorization
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some(g => g.id === user.id);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to manage this campaign" },
        { status: 403 }
      );
    }

    // Get current team member count
    const currentMemberCount = await prisma.teamMember.count({
      where: {
        campaignId,
      }
    });

    // Parse the form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json(
        { success: false, error: "File must be a CSV" },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_CSV_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds maximum allowed (${MAX_CSV_FILE_SIZE / 1024 / 1024} MB)`
        },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    // Parse CSV
    const parseResult = parseCSV(content);

    if (!parseResult.success || parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse CSV file",
          details: parseResult.errors
        },
        { status: 400 }
      );
    }

    // Check if adding these rows would exceed the limit
    const totalAfterImport = currentMemberCount + parseResult.rows.length;
    if (totalAfterImport > 100) {
      return NextResponse.json(
        {
          success: false,
          error: `Import would exceed maximum team member limit. Current: ${currentMemberCount}, Importing: ${parseResult.rows.length}, Max: 100`
        },
        { status: 400 }
      );
    }

    // Get existing team member emails for duplicate checking
    const existingMembers = await prisma.teamMember.findMany({
      where: {
        campaignId,
      },
      select: {
        user: {
          select: { email: true }
        }
      }
    });

    const existingEmails = new Set(existingMembers.filter(m => m.user).map(m => m.user!.email.toLowerCase()));

    // Validate all rows
    const validation = validateCSVRows(parseResult.rows, existingEmails);

    // Prepare import result
    const importResult: CSVImportResult = {
      success: false,
      summary: {
        totalRows: parseResult.rows.length,
        successCount: 0,
        skipCount: validation.duplicates.length,
        errorCount: validation.errors.length,
      },
      results: {
        successful: [],
        skipped: validation.duplicates.map(d => ({
          row: d.row,
          email: d.value as string,
          reason: d.message,
        })),
        errors: validation.errors.map(e => ({
          row: e.row,
          email: e.value as string | undefined,
          field: e.field,
          reason: e.message,
        })),
      },
    };

    // If there are any errors, don't import anything (atomic operation)
    if (validation.errors.length > 0) {
      return NextResponse.json(importResult, { status: 400 });
    }

    // If all rows are duplicates, return early
    if (validation.validRows.length === 0) {
      importResult.success = true; // No errors, just all skipped
      return NextResponse.json(importResult);
    }

    // Create team members in a transaction
    const createdMembers = await prisma.$transaction(async (tx) => {
      const members = [];

      for (const rowData of validation.validRows) {
        // Generate unique fundraising link code
        const fundLinkCode = await generateUniqueFundraisingLinkCode(campaignId);

        // Create team member
        const member = await tx.teamMember.create({
          data: {
            campaignId,
            name: rowData.name,
            email: rowData.email.toLowerCase(),
            personalGoal: rowData.personalGoal
              ? BigInt(Math.round(rowData.personalGoal * 100))
              : null,
            position: rowData.position || null,
            grade: rowData.grade || null,
            fundLinkCode,
            invitationStatus: "PENDING",
            invitationSentAt: new Date(),
            amountRaised: BigInt(0),
            userId: null,
          },
        });

        members.push({
          ...member,
          _csvRow: rowData._csvRow,
          _originalData: rowData,
        });
      }

      return members;
    });

    // Send invitation emails in background (don't fail the import if emails fail)
    const emailPromises = createdMembers.map(async (member) => {
      try {
        if (!member.fundLinkCode || !member.email) {
          throw new Error('Missing fundraising link code or email');
        }
        const fundraisingLink = formatFundraisingLink(campaign.slug, member.fundLinkCode);
        await sendTeamMemberInvitation(
          member.email,
          member.name,
          `${campaign.teamName} - ${campaign.organizationName}`,
          fundraisingLink,
          member.personalGoal ? Number(member.personalGoal) / 100 : undefined
        );
        return { success: true, memberId: member.id };
      } catch (error) {
        console.error(`Failed to send invitation to ${member.email}:`, error);
        // Update invitation status to email failed
        await prisma.teamMember.update({
          where: { id: member.id },
          data: { invitationStatus: "EMAIL_FAILED" }
        });
        return { success: false, memberId: member.id };
      }
    });

    // Don't wait for emails to complete
    Promise.all(emailPromises).then((results) => {
      const failedCount = results.filter(r => !r.success).length;
      if (failedCount > 0) {
        console.log(`${failedCount} invitation emails failed to send`);
      }
    });

    // Update import result with successful imports
    importResult.success = true;
    importResult.summary.successCount = createdMembers.length;
    importResult.results.successful = createdMembers
      .filter(m => m.email) // Filter out any without email
      .map(m => ({
        row: m._csvRow,
        name: m.name,
        email: m.email!,
        fundLinkCode: m.fundLinkCode || undefined,
      }));

    return NextResponse.json(importResult);

  } catch (error) {
    console.error("CSV import error:", error);

    // Handle specific database errors
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        {
          success: false,
          error: "Some emails already exist in the campaign. Please check for duplicates.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to import CSV"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/[campaignId]/import-roster
 * Get sample CSV template
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // Generate sample CSV
    const csvContent = [
      'name,email,personalGoal,position,grade',
      'John Doe,john.doe@example.com,500,Forward,12',
      'Jane Smith,jane.smith@example.com,250,Goalkeeper,11',
      'Mike Johnson,mike.j@example.com,750,Defense,10',
      'Sarah Williams,sarah.w@example.com,,Midfielder,12',
      'Tom Brown,tom.brown@example.com,300,,9',
      '',
      '# Instructions:',
      '# - name: Required. Team member full name (2-100 characters)',
      '# - email: Required. Valid email address',
      '# - personalGoal: Optional. Personal fundraising goal in dollars (1-50000)',
      '# - position: Optional. Team position (max 50 characters)',
      '# - grade: Optional. Grade level (max 20 characters)',
      '# - Maximum 500 rows allowed',
      '# - File size must be under 5MB',
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="team_roster_template.csv"',
      },
    });

  } catch (error) {
    console.error("Failed to generate CSV template:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate template" },
      { status: 500 }
    );
  }
}