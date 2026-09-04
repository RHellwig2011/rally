/**
 * Utility functions for exporting data to various formats
 */

/**
 * Leading characters that spreadsheet applications (Excel, Google Sheets,
 * LibreOffice) interpret as the start of a formula. A roster value such as
 * `=HYPERLINK("http://evil.test","CLICK")` becomes a live, clickable formula
 * the moment a coach opens the downloaded .csv, so any value starting with one
 * of these is prefixed with an apostrophe to force it to be read as text
 * (CSV injection / CWE-1236).
 */
const FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@', '\t', '\r'];

/** Plain numbers must stay numbers — `-12.50` is data, not a formula. */
const NUMERIC_LITERAL = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

/**
 * Escape a single CSV field. This is the ONE place CSV quoting/neutralising
 * happens — every CSV producer in the app routes through it.
 *
 * - Doubles inner double quotes and always wraps the field in quotes, so
 *   commas, quotes and newlines can never terminate a field early and shift
 *   every subsequent column (RFC 4180).
 * - Neutralises spreadsheet formula triggers as described above.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let stringValue = String(value);

  if (
    stringValue.length > 0 &&
    FORMULA_TRIGGER_CHARS.includes(stringValue[0]) &&
    !NUMERIC_LITERAL.test(stringValue)
  ) {
    stringValue = `'${stringValue}`;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

/**
 * Escape and join a full row of CSV fields.
 */
export function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',');
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: any[], headers: string[]): string {
  if (!data || data.length === 0) {
    return headers.join(',') + '\n';
  }

  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    csvRows.push(toCsvRow(headers.map(header => row[header])));
  }

  return csvRows.join('\n');
}

/**
 * Download CSV file in browser
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Export campaign status history to CSV
 */
export function exportStatusHistoryToCSV(
  statusHistory: Array<{
    from: string;
    to: string;
    reason?: string;
    timestamp: string | Date;
    changedBy?: {
      name?: string;
      email?: string;
    };
  }>,
  campaignName: string
): void {
  // Transform data for CSV export
  const csvData = statusHistory.map(change => ({
    Date: new Date(change.timestamp).toLocaleString(),
    'From Status': change.from,
    'To Status': change.to,
    'Reason': change.reason || 'N/A',
    'Changed By': change.changedBy?.name || change.changedBy?.email || 'Unknown',
  }));

  const headers = ['Date', 'From Status', 'To Status', 'Reason', 'Changed By'];
  const csvContent = convertToCSV(csvData, headers);

  const filename = `${campaignName.replace(/[^a-z0-9]/gi, '_')}_status_history_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csvContent, filename);
}

/**
 * Export campaign donations to CSV
 */
export function exportDonationsToCSV(
  donations: Array<{
    donorName: string;
    grossAmount: number;
    createdAt: string | Date;
    donorMessage?: string;
  }>,
  campaignName: string
): void {
  const csvData = donations.map(donation => ({
    Date: new Date(donation.createdAt).toLocaleString(),
    'Donor Name': donation.donorName,
    'Amount': `$${(donation.grossAmount / 100).toFixed(2)}`,
    'Message': donation.donorMessage || 'N/A',
  }));

  const headers = ['Date', 'Donor Name', 'Amount', 'Message'];
  const csvContent = convertToCSV(csvData, headers);

  const filename = `${campaignName.replace(/[^a-z0-9]/gi, '_')}_donations_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csvContent, filename);
}
