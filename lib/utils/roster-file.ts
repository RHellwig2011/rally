/**
 * Roster file parsing.
 *
 * Turns whatever a coach actually has — a Hudl .xlsx export, a school .csv, or
 * a block of cells pasted straight out of Excel — into a uniform
 * `{ headers, rows }` shape that lib/utils/roster-mapping.ts can map.
 *
 * This module deliberately knows nothing about our data model. It only answers
 * "what columns are in this file and what is in them", so the coach can confirm
 * the column mapping before anything is written to the database.
 */

import Papa from 'papaparse';

export const MAX_ROSTER_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_ROSTER_ROWS = 1000;

export interface ParsedRosterFile {
  headers: string[];
  /** One object per data row, keyed by the (de-duplicated) header text. */
  rows: Record<string, string>[];
}

/**
 * Thrown for anything the coach can fix by uploading a different file.
 * Route handlers turn this into a 400 with `message` shown verbatim, so the
 * messages here are written for a coach, not a developer.
 */
export class RosterFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RosterFileError';
  }
}

/* -------------------------------------------------------------------------- */
/* Shared matrix -> { headers, rows } normalisation                            */
/* -------------------------------------------------------------------------- */

function isBlank(value: string): boolean {
  return value.trim() === '';
}

function rowIsEmpty(cells: string[]): boolean {
  return cells.every(isBlank);
}

/**
 * Headers must be unique because rows are keyed by them, and a mapping is
 * `header -> field`. Real exports do ship duplicate or blank header cells
 * (merged cells, trailing formatting columns), so make them unique rather than
 * silently dropping a column of data.
 */
function normalizeHeaders(rawHeaders: string[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((raw, index) => {
    let header = String(raw ?? '').trim();
    if (!header) header = `Column ${index + 1}`;

    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    return count === 0 ? header : `${header} (${count + 1})`;
  });
}

/**
 * `matrix` is the raw grid including the header line. Leading blank lines are
 * skipped: exports frequently start with an empty or title row.
 *
 * Title rows are also skipped: real Hudl/TeamSnap/school exports often put a
 * merged banner cell ("Lincoln High — Athletes") above the real header line.
 * A row whose cells are (almost) all the same single value — merged cells
 * surface as the value repeated or one value plus blanks — is not a header
 * row when the row after it looks like one (several distinct non-blank
 * cells), so we drop it rather than importing "Column 2..7" garbage.
 */
function looksLikeTitleRow(row: string[], next: string[] | undefined): boolean {
  if (!next) return false;
  const nonBlank = row.filter((cell) => !isBlank(cell));
  const distinct = new Set(nonBlank.map((cell) => cell.trim()));
  const nextNonBlank = next.filter((cell) => !isBlank(cell));
  const nextDistinct = new Set(nextNonBlank.map((cell) => cell.trim()));
  // ≤1 distinct value up top (single title, or merged-cell repetition) while
  // the next row carries several distinct cells — that next row is the header.
  return distinct.size <= 1 && nextDistinct.size >= 2;
}

function matrixToRoster(matrix: string[][], sourceLabel: string): ParsedRosterFile {
  let nonEmpty = matrix.filter((row) => !rowIsEmpty(row));

  // Peel any leading title rows (there can be more than one banner line).
  while (nonEmpty.length > 1 && looksLikeTitleRow(nonEmpty[0], nonEmpty[1])) {
    nonEmpty = nonEmpty.slice(1);
  }

  if (nonEmpty.length === 0) {
    throw new RosterFileError(
      `${sourceLabel} is empty. Export your roster again and make sure it has a header row and at least one player.`
    );
  }

  const headerRow = nonEmpty[0];
  const dataRows = nonEmpty.slice(1);

  if (dataRows.length === 0) {
    throw new RosterFileError(
      `${sourceLabel} has a header row but no players in it. Check that you exported the full roster.`
    );
  }

  if (dataRows.length > MAX_ROSTER_ROWS) {
    throw new RosterFileError(
      `${sourceLabel} has ${dataRows.length} rows, which is over the ${MAX_ROSTER_ROWS}-row limit. Split it into smaller files and import them one at a time.`
    );
  }

  // Trailing all-blank columns are common in spreadsheet exports; drop them so
  // the coach is not asked to map "Column 9".
  let width = headerRow.length;
  for (const row of dataRows) width = Math.max(width, row.length);
  while (
    width > 0 &&
    isBlank(headerRow[width - 1] ?? '') &&
    dataRows.every((row) => isBlank(row[width - 1] ?? ''))
  ) {
    width -= 1;
  }

  const headers = normalizeHeaders(
    Array.from({ length: width }, (_, i) => headerRow[i] ?? '')
  );

  const rows = dataRows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = String(row[i] ?? '').trim();
    });
    return record;
  });

  return { headers, rows };
}

/* -------------------------------------------------------------------------- */
/* Delimited text (.csv, .tsv, pasted cells)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Pasting from Excel or Google Sheets yields tab-separated cells, not CSV, and
 * some European exports use semicolons. Guess from the first non-empty line by
 * counting candidates outside of quotes.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r\n|\n|\r/).find((line) => line.trim() !== '') ?? '';

  let best = ',';
  let bestCount = 0;
  for (const candidate of ['\t', ',', ';', '|']) {
    let count = 0;
    let inQuotes = false;
    for (const char of firstLine) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === candidate && !inQuotes) count += 1;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Parsed with `header: false` on purpose: we do our own header extraction so
 * that CSV, pasted text and .xlsx all share one code path, and so duplicate or
 * blank headers survive instead of silently overwriting each other.
 */
function parseDelimitedText(text: string, sourceLabel: string, delimiter?: string): ParsedRosterFile {
  // Strip a UTF-8 BOM — Excel writes one and it corrupts the first header.
  const content = text.replace(/^﻿/, '');

  if (content.trim() === '') {
    throw new RosterFileError(
      `${sourceLabel} is empty. Paste or upload a roster with a header row and at least one player.`
    );
  }

  const result = Papa.parse<string[]>(content, {
    header: false,
    skipEmptyLines: 'greedy',
    delimiter: delimiter ?? detectDelimiter(content),
  });

  // Papa reports a delimiter guess failure as an error but still returns data;
  // only genuinely unparseable input should stop the import.
  const fatal = result.errors.filter(
    (error) => error.type === 'Quotes' || error.code === 'MissingQuotes'
  );
  if (fatal.length > 0) {
    throw new RosterFileError(
      `${sourceLabel} could not be read (unbalanced quotes near line ${(fatal[0].row ?? 0) + 1}). Re-export the file and try again.`
    );
  }

  const matrix = (result.data ?? []).map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []
  );

  return matrixToRoster(matrix, sourceLabel);
}

export function parseRosterCsv(text: string, sourceLabel = 'That CSV file'): ParsedRosterFile {
  return parseDelimitedText(text, sourceLabel);
}

/** Raw paste mode — coaches copy cells straight out of Excel (tab separated). */
export function parsePastedRoster(text: string): ParsedRosterFile {
  return parseDelimitedText(text, 'The pasted roster');
}

/* -------------------------------------------------------------------------- */
/* Spreadsheets (.xlsx)                                                        */
/* -------------------------------------------------------------------------- */

/** exceljs cell values are unions: rich text, formulas, hyperlinks, dates. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Formula cell: use the computed result, not the formula text.
    if ('result' in obj) return cellToString(obj.result);
    // Hyperlink cell (emails in Hudl exports are often hyperlinked).
    if ('text' in obj) return cellToString(obj.text);
    // Rich text cell.
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((run: any) => String(run?.text ?? '')).join('').trim();
    }
    if ('error' in obj) return '';
  }
  return String(value).trim();
}

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04" — .xlsx is a zip
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0]; // legacy .xls compound file

function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte);
}

/**
 * Reads the first worksheet, treating the first non-empty row as headers.
 * exceljs is imported lazily — it is a heavy dependency and only this path
 * needs it.
 */
export async function parseRosterXlsx(
  data: ArrayBuffer | Buffer,
  sourceLabel = 'That spreadsheet'
): Promise<ParsedRosterFile> {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const head = new Uint8Array(buffer.subarray(0, 4));

  if (matchesSignature(head, OLE2_SIGNATURE)) {
    // Genuinely unsupported: exceljs reads the modern zip-based format only.
    // Say so plainly instead of failing with a parser stack trace.
    throw new RosterFileError(
      'That looks like an old-style .xls file, which we cannot read. Open it in Excel or Google Sheets and re-save it as .xlsx (or export it as .csv), then upload it again.'
    );
  }
  if (!matchesSignature(head, ZIP_SIGNATURE)) {
    throw new RosterFileError(
      `${sourceLabel} does not look like a spreadsheet. Upload the .xlsx file you exported, or a .csv.`
    );
  }

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as any);
  } catch {
    throw new RosterFileError(
      `${sourceLabel} could not be opened. Re-export it from your roster tool, or save it as a .csv and upload that.`
    );
  }

  // Hudl and Excel both ship workbooks whose first sheet is an empty
  // "Sheet1" with the data on a later tab. Read the first sheet that has
  // any content instead of failing on a technicality the coach can't see.
  const worksheet =
    workbook.worksheets.find((ws) => (ws.actualRowCount ?? 0) > 0) ??
    workbook.worksheets[0];
  if (!worksheet) {
    throw new RosterFileError(`${sourceLabel} has no worksheets in it.`);
  }

  const matrix: string[][] = [];
  const columnCount = Math.max(worksheet.columnCount ?? 0, 1);

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let col = 1; col <= columnCount; col += 1) {
      cells.push(cellToString(row.getCell(col).value));
    }
    matrix.push(cells);
  });

  return matrixToRoster(matrix, sourceLabel);
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

export function isSpreadsheetFileName(fileName: string): boolean {
  return /\.(xlsx|xlsm|xls)$/i.test(fileName);
}

export function isDelimitedFileName(fileName: string): boolean {
  return /\.(csv|tsv|txt)$/i.test(fileName);
}

/**
 * Dispatches on file extension. `File` here is the web File from
 * `request.formData()`, which works in Node 18+ route handlers.
 */
export async function parseRosterFile(file: File): Promise<ParsedRosterFile> {
  const fileName = file.name || 'roster';

  if (file.size === 0) {
    throw new RosterFileError('That file is empty. Check the export and try again.');
  }
  if (file.size > MAX_ROSTER_FILE_SIZE) {
    throw new RosterFileError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB, over the ${MAX_ROSTER_FILE_SIZE / 1024 / 1024} MB limit. A roster export should be far smaller — check you uploaded the right file.`
    );
  }

  if (isSpreadsheetFileName(fileName)) {
    const buffer = await file.arrayBuffer();
    return parseRosterXlsx(buffer, `"${fileName}"`);
  }

  if (isDelimitedFileName(fileName)) {
    return parseRosterCsv(await file.text(), `"${fileName}"`);
  }

  throw new RosterFileError(
    `We cannot read "${fileName}". Upload a .xlsx spreadsheet (the format Hudl exports) or a .csv file.`
  );
}
