import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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
import { checkCsrf } from "@/lib/csrf";

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
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

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

    // Rate limiting: 1 import per campaign per hour.
    // Checked AFTER auth + authorization so failed or unauthorized attempts
    // cannot burn the campaign's single hourly import slot.
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

    // Get current team member count. Soft-deleted rows do not occupy a roster
    // slot — they are invisible to every other query and can be revived — so
    // they must not count against the 100 limit either.
    const currentMemberCount = await prisma.teamMember.count({
      where: {
        campaignId,
        deletedAt: null,
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

    // Get existing team member emails for duplicate checking.
    // Compare against TeamMember.email directly (not the linked user account,
    // which is usually null for invited members). Live rows only: the
    // (campaignId, email) unique index is partial on `deletedAt IS NULL`, so a
    // removed player's address is free again. Listing them in a new import
    // revives their original record below rather than being skipped as a
    // duplicate or stranding their fundraising total on a second row.
    const existingMembers = await prisma.teamMember.findMany({
      where: {
        campaignId,
        deletedAt: null,
      },
      select: {
        email: true,
      }
    });

    const existingEmails = new Set(
      existingMembers
        .map(m => m.email?.toLowerCase())
        .filter((email): email is string => !!email)
    );

    // Previously removed players, keyed by email, so a re-import restores them.
    const deletedMembers = await prisma.teamMember.findMany({
      where: {
        campaignId,
        deletedAt: { not: null },
        email: { not: null },
      },
      orderBy: { deletedAt: "desc" },
      select: { id: true, email: true, fundLinkCode: true },
    });

    const deletedByEmail = new Map<string, (typeof deletedMembers)[number]>();
    for (const member of deletedMembers) {
      const key = member.email!.toLowerCase();
      // Most recent removal wins; older archived rows stay archived.
      if (!deletedByEmail.has(key)) deletedByEmail.set(key, member);
    }

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
        const email = rowData.email.toLowerCase();
        const invitationToken = crypto.randomBytes(32).toString("hex");

        const shared = {
          name: rowData.name,
          email,
          personalGoal: rowData.personalGoal
            ? BigInt(Math.round(rowData.personalGoal * 100))
            : null,
          position: rowData.position || null,
          grade: rowData.grade || null,
          invitationToken,
          invitationStatus: "PENDING" as const,
          invitationSentAt: new Date(),
        };

        const removed = deletedByEmail.get(email);

        // Restore a previously removed player instead of creating a twin: the
        // soft-deleted row still holds everything they raised, and a second row
        // would orphan it.
        const member = removed
          ? await tx.teamMember.update({
              where: { id: removed.id },
              data: {
                ...shared,
                fundLinkCode:
                  removed.fundLinkCode ??
                  (await generateUniqueFundraisingLinkCode(campaignId)),
                deletedAt: null,
                onboardingCompletedAt: null,
                joinedAt: null,
              },
            })
          : await tx.teamMember.create({
              data: {
                campaignId,
                ...shared,
                fundLinkCode: await generateUniqueFundraisingLinkCode(campaignId),
                amountRaised: BigInt(0),
                userId: null,
              },
            });

        members.push({
          ...member,
          _csvRow: rowData._csvRow,
          _originalData: rowData,
          _restored: Boolean(removed),
        });
      }

      return members;
    });

    // Send the invitations and record what actually happened to each one.
    //
    // sendTeamMemberInvitation never throws — it catches internally and returns
    // false — so branching on the returned boolean is the only way to detect a
    // failure. A try/catch here would be dead code, which is exactly how every
    // member of a failed import ended up reported as invited while their status
    // sat at PENDING and the roster UI rendered that as "Invitation Sent".
    const invitationResults = await Promise.all(
      createdMembers.map(async (member) => {
        const base = {
          row: member._csvRow,
          teamMemberId: member.id,
          name: member.name,
          email: member.email,
        };

        if (!member.fundLinkCode || !member.email) {
          console.error(
            `Cannot send invitation to team member ${member.id}: missing fundraising link code or email`
          );
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { invitationStatus: "EMAIL_FAILED" },
          });
          return { ...base, invitationStatus: "EMAIL_FAILED" as const };
        }

        const fundraisingLink = formatFundraisingLink(campaign.slug, member.fundLinkCode);
        const onboardingLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/player/onboard/${member.id}?token=${member.invitationToken}`;

        const emailSent = await sendTeamMemberInvitation(
          member.email,
          member.name,
          `${campaign.teamName} - ${campaign.organizationName}`,
          fundraisingLink,
          member.personalGoal ? Number(member.personalGoal) / 100 : undefined,
          onboardingLink
        );

        if (!emailSent) {
          console.error(`Failed to send invitation to ${member.email}`);
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { invitationStatus: "EMAIL_FAILED" },
          });
        }

        return {
          ...base,
          invitationStatus: (emailSent ? "PENDING" : "EMAIL_FAILED") as
            | "PENDING"
            | "EMAIL_FAILED",
        };
      })
    );

    const failedInvitations = invitationResults.filter(
      (r) => r.invitationStatus === "EMAIL_FAILED"
    );

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

    return NextResponse.json({
      ...importResult,
      // The rows written are separate from the invitations delivered. Reported
      // per member so the roster page can offer "resend failed invites" instead
      // of the coach believing everyone was contacted.
      invitations: {
        sent: invitationResults.length - failedInvitations.length,
        failed: failedInvitations.length,
        results: invitationResults,
      },
      // Players who had been removed from this roster and are back on it, with
      // their previous fundraising total intact.
      restored: createdMembers
        .filter((m) => m._restored)
        .map((m) => ({ row: m._csvRow, name: m.name, email: m.email })),
    });

  } catch (error) {
    console.error("CSV import error:", error);

    // Handle specific database errors. The (campaignId, email) unique index is
    // partial on `deletedAt IS NULL`, so P2002 means a clash with a player
    // currently on the roster — removed players are restored, not rejected.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Some of these emails are already used by players currently on the roster. Please check for duplicates.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        // Detail is logged above; never leak internal error text to the client.
        error: "Failed to import CSV"
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