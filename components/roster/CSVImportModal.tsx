'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import { MAX_CSV_FILE_SIZE, MAX_CSV_ROWS } from '@/lib/utils/csv-parser';
import { formatBytes } from '@/lib/utils/formatters';

interface CSVImportModalProps {
  campaignId: string;
  onClose: () => void;
  onComplete: () => void;
}

interface ImportResult {
  success: boolean;
  summary: {
    totalRows: number;
    successCount: number;
    skipCount: number;
    errorCount: number;
  };
  results: {
    successful: Array<{ row: number; name: string; email: string }>;
    skipped: Array<{ row: number; email?: string; reason: string }>;
    errors: Array<{ row: number; field?: string; reason: string }>;
  };
}

export function CSVImportModal({ campaignId, onClose, onComplete }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const csvFile = acceptedFiles[0];

    if (!csvFile) return;

    // Validate file type
    if (!csvFile.name.endsWith('.csv') && csvFile.type !== 'text/csv') {
      toast.error('Please upload a CSV file');
      return;
    }

    // Validate file size
    if (csvFile.size > MAX_CSV_FILE_SIZE) {
      toast.error(`File size exceeds ${formatBytes(MAX_CSV_FILE_SIZE)} limit`);
      return;
    }

    setFile(csvFile);
    setImportResult(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: MAX_CSV_FILE_SIZE,
  });

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/import-roster`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.status === 429) {
        const nextImportTime = new Date(data.nextImportTime);
        const timeUntil = Math.ceil((nextImportTime.getTime() - Date.now()) / 1000 / 60);
        toast.error(`You can only import once per hour. Next import available in ${timeUntil} minutes.`);
        return;
      }

      setImportResult(data);

      if (data.success && data.summary.successCount > 0) {
        toast.success(`Successfully imported ${data.summary.successCount} team members`);
        if (data.summary.skipCount > 0) {
          toast(`Skipped ${data.summary.skipCount} duplicate entries`);
        }
      } else if (data.summary.errorCount > 0) {
        toast.error(`Import failed with ${data.summary.errorCount} errors`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import CSV file');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!importResult) return;

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/import-roster/error-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importResult),
      });

      if (!response.ok) throw new Error('Failed to generate report');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import_report_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Failed to download report:', error);
      toast.error('Failed to download report');
    }
  };

  const handleComplete = () => {
    if (importResult?.success && importResult.summary.successCount > 0) {
      onComplete();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Import Team Members from CSV</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {!importResult ? (
            <>
              {/* Instructions */}
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold mb-2">CSV Requirements:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Required columns: name, email</li>
                  <li>• Optional columns: personalGoal, position, grade</li>
                  <li>• Maximum {MAX_CSV_ROWS} rows allowed</li>
                  <li>• Maximum file size: {formatBytes(MAX_CSV_FILE_SIZE)}</li>
                  <li>• Duplicates will be automatically skipped</li>
                </ul>
              </div>

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
              >
                <input {...getInputProps()} />
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-3"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {file ? (
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                    <p className="text-xs text-blue-600 mt-2">Click or drag to replace</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600">
                      {isDragActive
                        ? 'Drop the CSV file here...'
                        : 'Drag and drop your CSV file here, or click to browse'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">CSV files only</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between mt-6">
                <a
                  href={`/api/campaigns/${campaignId}/import-roster`}
                  download="team_roster_template.csv"
                  className="px-4 py-2 text-blue-600 hover:underline"
                >
                  Download Template
                </a>
                <div className="space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!file || importing}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {importing ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Import Results */}
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Import Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Rows</p>
                      <p className="font-semibold">{importResult.summary.totalRows}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Successful</p>
                      <p className="font-semibold text-green-600">{importResult.summary.successCount}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Skipped</p>
                      <p className="font-semibold text-yellow-600">{importResult.summary.skipCount}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Errors</p>
                      <p className="font-semibold text-red-600">{importResult.summary.errorCount}</p>
                    </div>
                  </div>
                </div>

                {/* Details Toggle */}
                {(importResult.results.errors.length > 0 || importResult.results.skipped.length > 0) && (
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {showDetails ? 'Hide Details' : 'Show Details'}
                  </button>
                )}

                {/* Detailed Results */}
                {showDetails && (
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {importResult.results.errors.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-red-600 mb-2">Errors</h4>
                        <div className="space-y-1">
                          {importResult.results.errors.map((error, index) => (
                            <div key={index} className="text-sm p-2 bg-red-50 rounded">
                              Row {error.row}: {error.reason}
                              {error.field && ` (${error.field})`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {importResult.results.skipped.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-yellow-600 mb-2">Skipped (Duplicates)</h4>
                        <div className="space-y-1">
                          {importResult.results.skipped.map((skip, index) => (
                            <div key={index} className="text-sm p-2 bg-yellow-50 rounded">
                              Row {skip.row}: {skip.email} - {skip.reason}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between mt-6">
                <button
                  onClick={handleDownloadReport}
                  className="px-4 py-2 text-blue-600 hover:underline"
                >
                  Download Report
                </button>
                <div className="space-x-3">
                  <button
                    onClick={() => {
                      setFile(null);
                      setImportResult(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Import Another
                  </button>
                  <button
                    onClick={handleComplete}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {importResult.success && importResult.summary.successCount > 0 ? 'Done' : 'Close'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}