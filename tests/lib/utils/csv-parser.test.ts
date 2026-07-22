import {
  parseCSV,
  validateCSVRows,
  generateSampleCSV,
  createErrorReport,
  REQUIRED_CSV_HEADERS,
  OPTIONAL_CSV_HEADERS,
  ALL_CSV_HEADERS,
  MAX_CSV_FILE_SIZE,
  MAX_CSV_ROWS,
  CSVImportResult,
} from '@/lib/utils/csv-parser';

// ─── parseCSV ────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  it('parses valid CSV with required headers', () => {
    const csv = 'name,email\nJohn Doe,john@example.com';
    const result = parseCSV(csv);
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ name: 'John Doe', email: 'john@example.com' });
    expect(result.errors).toHaveLength(0);
  });

  it('parses CSV with all optional headers', () => {
    const csv = 'name,email,personalGoal,position,grade\nJane,jane@x.com,500,Forward,12';
    const result = parseCSV(csv);
    expect(result.success).toBe(true);
    expect(result.rows[0]).toMatchObject({
      name: 'Jane',
      email: 'jane@x.com',
      personalGoal: '500',
      position: 'Forward',
      grade: '12',
    });
  });

  it('trims whitespace from headers and values', () => {
    const csv = ' name , email \n  Alice  ,  alice@example.com  ';
    const result = parseCSV(csv);
    expect(result.success).toBe(true);
    expect(result.rows[0]).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
  });

  it('returns error and success=false when required headers are missing', () => {
    const csv = 'name,position\nJohn,Forward';
    const result = parseCSV(csv);
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toMatch(/Missing required headers/);
    expect(result.errors[0].message).toContain('email');
  });

  it('returns error when both required headers are missing', () => {
    const csv = 'position,grade\nForward,12';
    const result = parseCSV(csv);
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('name');
    expect(result.errors[0].message).toContain('email');
  });

  it('succeeds but warns about unknown headers (does not error)', () => {
    const csv = 'name,email,unknownField\nJohn,j@x.com,someValue';
    const result = parseCSV(csv);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error when row count exceeds MAX_CSV_ROWS', () => {
    const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `Person ${i},p${i}@x.com`);
    const csv = ['name,email', ...rows].join('\n');
    const result = parseCSV(csv);
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toMatch(/maximum allowed/);
  });

  it('skips empty lines', () => {
    const csv = 'name,email\nJohn,j@x.com\n\n\nJane,jane@x.com\n';
    const result = parseCSV(csv);
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(2);
  });

  it('exposes headers in result', () => {
    const csv = 'name,email,position\nJohn,j@x.com,Forward';
    const result = parseCSV(csv);
    expect(result.headers).toEqual(['name', 'email', 'position']);
  });
});

// ─── validateCSVRows ──────────────────────────────────────────────────────────

describe('validateCSVRows', () => {
  const validRow = { name: 'John Doe', email: 'john@example.com' };

  it('accepts a valid minimal row', () => {
    const { validRows, errors, duplicates } = validateCSVRows([validRow]);
    expect(validRows).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(duplicates).toHaveLength(0);
  });

  it('normalises email to lowercase', () => {
    const { validRows } = validateCSVRows([{ name: 'Alice', email: 'Alice@EXAMPLE.COM' }]);
    expect(validRows[0].email).toBe('alice@example.com');
  });

  it('rejects row with missing name', () => {
    const { validRows, errors } = validateCSVRows([{ name: '', email: 'a@b.com' }]);
    expect(validRows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it('rejects row with missing email', () => {
    const { validRows, errors } = validateCSVRows([{ name: 'John', email: '' }]);
    expect(validRows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it('rejects invalid email format', () => {
    const { errors } = validateCSVRows([{ name: 'John', email: 'not-an-email' }]);
    expect(errors[0]).toMatchObject({ field: 'email', message: 'Invalid email format' });
  });

  it('detects duplicates within the CSV', () => {
    const rows = [
      { name: 'John', email: 'john@example.com' },
      { name: 'John Copy', email: 'john@example.com' },
    ];
    const { validRows, duplicates } = validateCSVRows(rows);
    expect(validRows).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].message).toMatch(/Duplicate email within CSV/);
  });

  it('detects duplicates against existing emails', () => {
    const existing = new Set(['john@example.com']);
    const { validRows, duplicates } = validateCSVRows([validRow], existing);
    expect(validRows).toHaveLength(0);
    expect(duplicates[0].message).toMatch(/already exists/);
  });

  it('parses personalGoal numeric string', () => {
    const { validRows } = validateCSVRows([{ ...validRow, personalGoal: '500' }]);
    expect(validRows[0].personalGoal).toBe(500);
  });

  it('parses personalGoal with dollar sign and commas', () => {
    const { validRows } = validateCSVRows([{ ...validRow, personalGoal: '$1,000' }]);
    expect(validRows[0].personalGoal).toBe(1000);
  });

  it('rejects non-numeric personalGoal', () => {
    const { errors } = validateCSVRows([{ ...validRow, personalGoal: 'abc' }]);
    expect(errors[0]).toMatchObject({ field: 'personalGoal' });
  });

  it('rejects personalGoal below minimum ($1)', () => {
    const { errors } = validateCSVRows([{ ...validRow, personalGoal: '0.50' }]);
    expect(errors[0].message).toMatch(/between \$1 and \$50,000/);
  });

  it('rejects personalGoal above maximum ($50,000)', () => {
    const { errors } = validateCSVRows([{ ...validRow, personalGoal: '99999' }]);
    expect(errors[0].message).toMatch(/between \$1 and \$50,000/);
  });

  it('rejects position longer than 50 characters', () => {
    const { errors } = validateCSVRows([{ ...validRow, position: 'x'.repeat(51) }]);
    expect(errors[0]).toMatchObject({ field: 'position' });
  });

  it('rejects grade longer than 20 characters', () => {
    const { errors } = validateCSVRows([{ ...validRow, grade: 'x'.repeat(21) }]);
    expect(errors[0]).toMatchObject({ field: 'grade' });
  });

  it('attaches _csvRow with 1-based row number (offset by header)', () => {
    const { validRows } = validateCSVRows([validRow]);
    expect(validRows[0]._csvRow).toBe(2);
  });

  it('handles multiple rows independently', () => {
    const rows = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'not-valid' },
      { name: 'Carol', email: 'carol@example.com' },
    ];
    const { validRows, errors } = validateCSVRows(rows);
    expect(validRows).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });
});

// ─── generateSampleCSV ───────────────────────────────────────────────────────

describe('generateSampleCSV', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateSampleCSV()).toBe('string');
    expect(generateSampleCSV().length).toBeGreaterThan(0);
  });

  it('contains all expected headers in first line', () => {
    const firstLine = generateSampleCSV().split('\n')[0];
    expect(firstLine).toBe('name,email,personalGoal,position,grade');
  });

  it('is parseable by parseCSV and returns valid rows', () => {
    const result = parseCSV(generateSampleCSV());
    expect(result.success).toBe(true);
    expect(result.rows.length).toBeGreaterThan(0);
  });
});

// ─── createErrorReport ───────────────────────────────────────────────────────

describe('createErrorReport', () => {
  const baseResult: CSVImportResult = {
    success: true,
    summary: { totalRows: 3, successCount: 1, skipCount: 1, errorCount: 1 },
    results: {
      successful: [{ row: 2, name: 'Alice', email: 'alice@example.com' }],
      skipped: [{ row: 3, email: 'bob@example.com', reason: 'Duplicate email' }],
      errors: [{ row: 4, email: 'bad', field: 'email', reason: 'Invalid email format' }],
    },
  };

  it('includes summary counts', () => {
    const report = createErrorReport(baseResult);
    expect(report).toContain('Total Rows: 3');
    expect(report).toContain('Successful: 1');
    expect(report).toContain('Skipped: 1');
    expect(report).toContain('Errors: 1');
  });

  it('lists successful imports', () => {
    const report = createErrorReport(baseResult);
    expect(report).toContain('alice@example.com');
    expect(report).toContain('Alice');
  });

  it('lists skipped rows with reason', () => {
    const report = createErrorReport(baseResult);
    expect(report).toContain('bob@example.com');
    expect(report).toContain('Duplicate email');
  });

  it('lists error rows with field and reason', () => {
    const report = createErrorReport(baseResult);
    expect(report).toContain('Invalid email format');
  });

  it('omits sections when there are no entries', () => {
    const empty: CSVImportResult = {
      success: true,
      summary: { totalRows: 0, successCount: 0, skipCount: 0, errorCount: 0 },
      results: { successful: [], skipped: [], errors: [] },
    };
    const report = createErrorReport(empty);
    // The summary block always shows zero counts; the per-row sections
    // (with their CSV column headers) must be omitted entirely.
    expect(report).not.toContain('Successfully Imported:');
    expect(report).not.toContain('Skipped (Duplicates):');
    expect(report).not.toContain('Row,Field,Reason');
    expect(report).not.toContain('Row,Name,Email');
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('CSV constants', () => {
  it('REQUIRED_CSV_HEADERS contains name and email', () => {
    expect(REQUIRED_CSV_HEADERS).toEqual(expect.arrayContaining(['name', 'email']));
  });

  it('ALL_CSV_HEADERS is the union of required and optional', () => {
    expect(ALL_CSV_HEADERS).toEqual([...REQUIRED_CSV_HEADERS, ...OPTIONAL_CSV_HEADERS]);
  });

  it('MAX_CSV_FILE_SIZE is 5 MB', () => {
    expect(MAX_CSV_FILE_SIZE).toBe(5 * 1024 * 1024);
  });

  it('MAX_CSV_ROWS is 500', () => {
    expect(MAX_CSV_ROWS).toBe(500);
  });
});
