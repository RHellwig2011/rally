/**
 * Utility functions for exporting data to various formats
 */

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
    const values = headers.map(header => {
      const value = row[header];

      // Handle special cases
      if (value === null || value === undefined) {
        return '';
      }

      // Escape quotes and wrap in quotes if needed
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    });

    csvRows.push(values.join(','));
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
