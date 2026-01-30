/**
 * BulkImportModal Component
 * Modal for bulk importing library items from CSV
 * Features: template download, file upload, validation results
 */

'use client';

import React, { useState, useRef } from 'react';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  bulkImportLibraryItems,
  downloadBulkImportTemplate,
} from '@/lib/api/library-items';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  row: number;
  title?: string;
  error?: string;
}

export function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadBulkImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'library-items-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to download template:', err);
      alert('Failed to download template. Please try again.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
    } else {
      alert('Please drop a valid CSV file');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);

      // Call API
      const response = await bulkImportLibraryItems(file);

      // Process results
      const importResults: ImportResult[] = response.results.map((result: any) => ({
        success: result.success,
        row: result.row,
        title: result.title || result.data?.title,
        error: result.error,
      }));

      const successes = importResults.filter((r) => r.success).length;
      const errors = importResults.filter((r) => !r.success).length;

      setResults(importResults);
      setSuccessCount(successes);
      setErrorCount(errors);
      setShowResults(true);

      // If all succeeded, trigger success callback after a delay
      if (errors === 0) {
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Failed to upload CSV:', err);
      alert(err.message || 'Failed to upload CSV. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadErrors = () => {
    const errorRows = results.filter((r) => !r.success);
    const csv = [
      'Row,Title,Error',
      ...errorRows.map((r) => `${r.row},"${r.title || 'N/A'}","${r.error}"`),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleClose = () => {
    setFile(null);
    setResults([]);
    setShowResults(false);
    setSuccessCount(0);
    setErrorCount(0);
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setResults([]);
    setShowResults(false);
    setSuccessCount(0);
    setErrorCount(0);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={!uploading ? handleClose : () => {}}
      title="Bulk Import Library Items"
      size="lg"
    >
      <ModalContent>
        {!showResults ? (
          <div className="space-y-6">
            {/* Step 1: Download Template */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Step 1: Download CSV Template
              </h3>
              <Button variant="secondary" onClick={handleDownloadTemplate} size="sm">
                <Download className="w-4 h-4" />
                Download Template
              </Button>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Fill in the template with your library items data
              </p>
            </div>

            {/* Step 2: Upload CSV */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Step 2: Upload Completed CSV
              </h3>

              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors
                  ${
                    file
                      ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/10'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                  }
                `}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <>
                    <CheckCircle className="w-12 h-12 text-green-500 dark:text-green-400 mx-auto mb-3" />
                    <p className="text-gray-900 dark:text-gray-100 font-medium mb-1">
                      File selected: {file.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Click to choose a different file
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-900 dark:text-gray-100 font-medium mb-1">
                      Drop CSV file here or click to browse
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Only .csv files are supported
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Results Summary */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                {errorCount === 0 ? (
                  <CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-yellow-500 dark:text-yellow-400" />
                )}
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {successCount} successful, {errorCount} failed
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {errorCount > 0
                      ? 'Review errors below and fix the CSV'
                      : 'All items imported successfully!'}
                  </p>
                </div>
              </div>

              {errorCount > 0 && (
                <Button variant="secondary" size="sm" onClick={handleDownloadErrors}>
                  <Download className="w-4 h-4" />
                  Download Errors
                </Button>
              )}
            </div>

            {/* Results Table */}
            <div className="max-h-[400px] overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 border-b">
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                      Row
                    </th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                      Title
                    </th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr
                      key={index}
                      className={`border-b ${
                        result.success
                          ? 'bg-green-50 dark:bg-green-900/10'
                          : 'bg-red-50 dark:bg-red-900/10'
                      }`}
                    >
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                        {result.row}
                      </td>
                      <td className="py-2 px-3 text-gray-900 dark:text-gray-100 font-medium">
                        {result.title || 'N/A'}
                      </td>
                      <td className="py-2 px-3">
                        {result.success ? (
                          <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            Success
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-700 dark:text-red-400">
                            <XCircle className="w-4 h-4" />
                            {result.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ModalContent>

      <ModalActions>
        {!showResults ? (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!file} loading={uploading}>
              <Upload className="w-4 h-4" />
              Upload & Import
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
            {errorCount > 0 && (
              <Button onClick={handleReset}>
                <Upload className="w-4 h-4" />
                Import Another
              </Button>
            )}
          </>
        )}
      </ModalActions>
    </Modal>
  );
}
