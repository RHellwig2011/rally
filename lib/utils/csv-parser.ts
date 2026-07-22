import Papa from 'papaparse';
import { z } from 'zod';
import { createTeamMemberSchema } from '@/lib/validations/team-member';
import { toCsvRow } from '@/lib/utils/export';

/**
 * CSV Import utilities for team member roster
 * Week 2: CSV Import functionality
 */

// CSV row schema - all fields are strings initially
const csvRowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required"),
  personalGoal: z.string().optional().default(""),
  position: z.string().optional().default(""),
  grade: z.string().optional().default(""),
});

// Required CSV headers
export const REQUIRED_CSV_HEADERS = ['name', 'email'];
export const OPTIONAL_CSV_HEADERS = ['personalGoal', 'position', 'grade'];
export const ALL_CSV_HEADERS = [...REQUIRED_CSV_HEADERS, ...OPTIONAL_CSV_HEADERS];

// CSV constraints
export const MAX_CSV_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_CSV_ROWS = 500;

export interface CSVParseResult {
  success: boolean;
  headers: string[];
  rows: any[];
  errors: CSVError[];
}

export interface CSVError {
  row: number;
  field?: string;
  message: string;
  value?: any;
}

export interface CSVImportResult {
  success: boolean;
  summary: {
    totalRows: number;
    successCount: number;
    skipCount: number;
    errorCount: number;
  };
  results: {
    successful: Array<{
      row: number;
      name: string;
      email: string;
      fundLinkCode?: string;
    }>;
    skipped: Array<{
      row: number;
      email?: string;
      reason: string;
    }>;
    errors: Array<{
      row: number;
      email?: string;
      field?: string;
      reason: string;
    }>;
  };
}

/**
 * Parse CSV file content
 */
export function parseCSV(content: string): CSVParseResult {
  const result: CSVParseResult = {
    success: false,
    headers: [],
    rows: [],
    errors: [],
  };

  try {
    // Parse CSV with PapaParse
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().replace(/^["']|["']$/g, ''),
      transform: (value) => value.trim(),
    });

    if (parsed.errors && parsed.errors.length > 0) {
      parsed.errors.forEach((error) => {
        result.errors.push({
          row: error.row || 0,
          message: error.message,
        });
      });
      return result;
    }

    // Get headers
    result.headers = parsed.meta.fields || [];

    // Validate headers
    const missingHeaders = REQUIRED_CSV_HEADERS.filter(
      h => !result.headers.includes(h)
    );

    if (missingHeaders.length > 0) {
      result.errors.push({
        row: 0,
        message: `Missing required headers: ${missingHeaders.join(', ')}`,
      });
      return result;
    }

    // Check for unknown headers
    const validHeaders = new Set(ALL_CSV_HEADERS);
    const unknownHeaders = result.headers.filter(h => !validHeaders.has(h));
    if (unknownHeaders.length > 0) {
      console.warn(`Unknown headers will be ignored: ${unknownHeaders.join(', ')}`);
    }

    // Check row count
    if (parsed.data.length > MAX_CSV_ROWS) {
      result.errors.push({
        row: 0,
        message: `CSV contains ${parsed.data.length} rows, maximum allowed is ${MAX_CSV_ROWS}`,
      });
      return result;
    }

    // Store rows
    result.rows = parsed.data;
    result.success = true;

  } catch (error) {
    result.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : 'Failed to parse CSV',
    });
  }

  return result;
}

/**
 * Validate CSV rows for team member import
 */
export function validateCSVRows(
  rows: any[],
  existingEmails: Set<string> = new Set()
): {
  validRows: any[];
  errors: CSVError[];
  duplicates: CSVError[];
} {
  const validRows: any[] = [];
  const errors: CSVError[] = [];
  const duplicates: CSVError[] = [];
  const emailsSeen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because row 1 is headers, and index is 0-based

    try {
      // Validate row structure
      const validatedRow = csvRowSchema.parse(row);

      // Validate and transform email
      const email = validatedRow.email.toLowerCase().trim();

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({
          row: rowNum,
          field: 'email',
          message: 'Invalid email format',
          value: validatedRow.email,
        });
        return;
      }

      // Check for duplicates within the CSV
      if (emailsSeen.has(email)) {
        duplicates.push({
          row: rowNum,
          field: 'email',
          message: 'Duplicate email within CSV file',
          value: email,
        });
        return;
      }

      // Check for duplicates with existing members
      if (existingEmails.has(email)) {
        duplicates.push({
          row: rowNum,
          field: 'email',
          message: 'Email already exists in campaign',
          value: email,
        });
        return;
      }

      emailsSeen.add(email);

      // Transform data for team member creation
      const teamMemberData: any = {
        name: validatedRow.name.trim(),
        email: email,
      };

      // Parse personal goal if provided
      if (validatedRow.personalGoal) {
        const goalStr = validatedRow.personalGoal.replace(/[$,]/g, '').trim();
        if (goalStr) {
          const goal = parseFloat(goalStr);
          if (isNaN(goal)) {
            errors.push({
              row: rowNum,
              field: 'personalGoal',
              message: 'Invalid personal goal format',
              value: validatedRow.personalGoal,
            });
            return;
          }
          if (goal < 1 || goal > 50000) {
            errors.push({
              row: rowNum,
              field: 'personalGoal',
              message: 'Personal goal must be between $1 and $50,000',
              value: goal,
            });
            return;
          }
          teamMemberData.personalGoal = goal;
        }
      }

      // Add optional fields
      if (validatedRow.position) {
        teamMemberData.position = validatedRow.position.trim();
        if (teamMemberData.position.length > 50) {
          errors.push({
            row: rowNum,
            field: 'position',
            message: 'Position cannot exceed 50 characters',
            value: validatedRow.position,
          });
          return;
        }
      }

      if (validatedRow.grade) {
        teamMemberData.grade = validatedRow.grade.trim();
        if (teamMemberData.grade.length > 20) {
          errors.push({
            row: rowNum,
            field: 'grade',
            message: 'Grade cannot exceed 20 characters',
            value: validatedRow.grade,
          });
          return;
        }
      }

      // Validate with the schema
      try {
        createTeamMemberSchema.parse(teamMemberData);
        validRows.push({
          ...teamMemberData,
          _csvRow: rowNum,
        });
      } catch (zodError: any) {
        const firstError = zodError.errors[0];
        errors.push({
          row: rowNum,
          field: firstError.path.join('.'),
          message: firstError.message,
        });
      }

    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        errors.push({
          row: rowNum,
          field: firstError.path.join('.'),
          message: firstError.message,
        });
      } else {
        errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : 'Invalid row data',
        });
      }
    }
  });

  return {
    validRows,
    errors,
    duplicates,
  };
}

/**
 * Generate sample CSV content
 */
export function generateSampleCSV(): string {
  const headers = ['name', 'email', 'personalGoal', 'position', 'grade'];
  const sampleRows = [
    ['John Doe', 'john.doe@example.com', '500', 'Forward', '12'],
    ['Jane Smith', 'jane.smith@example.com', '250', 'Goalkeeper', '11'],
    ['Mike Johnson', 'mike.j@example.com', '750', 'Defense', '10'],
    ['Sarah Williams', 'sarah.w@example.com', '', 'Midfielder', '12'],
    ['Tom Brown', 'tom.brown@example.com', '300', '', '9'],
  ];

  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Create CSV error report
 */
export function createErrorReport(result: CSVImportResult): string {
  const lines: string[] = [
    'Rally Team Member Import Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Summary:',
    `Total Rows: ${result.summary.totalRows}`,
    `Successful: ${result.summary.successCount}`,
    `Skipped: ${result.summary.skipCount}`,
    `Errors: ${result.summary.errorCount}`,
    '',
  ];

  if (result.results.successful.length > 0) {
    lines.push('Successfully Imported:');
    lines.push('Row,Name,Email');
    result.results.successful.forEach(item => {
      lines.push(toCsvRow([item.row, item.name, item.email]));
    });
    lines.push('');
  }

  if (result.results.skipped.length > 0) {
    lines.push('Skipped (Duplicates):');
    lines.push('Row,Email,Reason');
    result.results.skipped.forEach(item => {
      lines.push(toCsvRow([item.row, item.email || 'N/A', item.reason]));
    });
    lines.push('');
  }

  if (result.results.errors.length > 0) {
    lines.push('Errors:');
    lines.push('Row,Field,Reason');
    result.results.errors.forEach(item => {
      lines.push(toCsvRow([item.row, item.field || 'N/A', item.reason]));
    });
    lines.push('');
  }

  return lines.join('\n');
}