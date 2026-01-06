// Export Audit Modal
// Modal for exporting audit logs to CSV or JSON

'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { AlertCircle, Download, FileText, FileJson } from 'lucide-react';
import { useAuditExport } from '@/lib/hooks/useAuditExport';
import { ExportFormat, type AuditLogFilters } from '@/lib/types/audit';

interface ExportAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: AuditLogFilters;
}

/**
 * Modal for exporting audit logs
 *
 * Features:
 * - Format selection (CSV or JSON)
 * - Shows current filters
 * - Displays estimated row count
 * - Validates export size (max 10,000)
 * - Loading state during export
 * - Error handling
 *
 * @example
 * ```tsx
 * <ExportAuditModal
 *   isOpen={showExportModal}
 *   onClose={() => setShowExportModal(false)}
 *   currentFilters={filters}
 * />
 * ```
 */
export function ExportAuditModal({
  isOpen,
  onClose,
  currentFilters
}: ExportAuditModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(ExportFormat.CSV);
  const [estimatedRows, setEstimatedRows] = useState<number | null>(null);
  const [isCheckingSize, setIsCheckingSize] = useState(false);

  const { exportLogs, isExporting, checkExportSize } = useAuditExport();

  // Check export size when modal opens
  useEffect(() => {
    if (isOpen) {
      checkSize();
    }
  }, [isOpen, currentFilters]);

  const checkSize = async () => {
    try {
      setIsCheckingSize(true);
      const { page, limit, ...exportFilters } = currentFilters;
      const count = await checkExportSize(exportFilters);
      setEstimatedRows(count);
    } catch (err) {
      setEstimatedRows(null);
    } finally {
      setIsCheckingSize(false);
    }
  };

  const handleExport = async () => {
    const { page, limit, ...exportFilters } = currentFilters;
    await exportLogs(selectedFormat, exportFilters);
    onClose();
  };

  const hasActiveFilters = Object.keys(currentFilters).some(
    key => key !== 'page' && key !== 'limit' && currentFilters[key as keyof AuditLogFilters]
  );

  const isTooLarge = estimatedRows !== null && estimatedRows > 10000;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Export Audit Logs
          </h2>
        </div>

        {/* Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Export Format
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedFormat(ExportFormat.CSV)}
              className={`
                p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all
                ${selectedFormat === ExportFormat.CSV
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }
              `}
            >
              <FileText className={`h-8 w-8 ${selectedFormat === ExportFormat.CSV ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
              <span className={`font-medium ${selectedFormat === ExportFormat.CSV ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                CSV
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Spreadsheet format
              </span>
            </button>

            <button
              onClick={() => setSelectedFormat(ExportFormat.JSON)}
              className={`
                p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all
                ${selectedFormat === ExportFormat.JSON
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }
              `}
            >
              <FileJson className={`h-8 w-8 ${selectedFormat === ExportFormat.JSON ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
              <span className={`font-medium ${selectedFormat === ExportFormat.JSON ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                JSON
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Structured data
              </span>
            </button>
          </div>
        </div>

        {/* Current Filters Summary */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Filters Applied:
          </h3>
          {hasActiveFilters ? (
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {currentFilters.start_date && (
                <li>• Date Range: {new Date(currentFilters.start_date).toLocaleDateString()} - {currentFilters.end_date ? new Date(currentFilters.end_date).toLocaleDateString() : 'Now'}</li>
              )}
              {currentFilters.action_type && (
                <li>• Action Type: {currentFilters.action_type}</li>
              )}
              {currentFilters.entity_type && (
                <li>• Entity Type: {currentFilters.entity_type}</li>
              )}
              {currentFilters.status && (
                <li>• Status: {currentFilters.status}</li>
              )}
              {currentFilters.search && (
                <li>• Search: "{currentFilters.search}"</li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No filters applied - exporting all logs
            </p>
          )}
        </div>

        {/* Estimated Rows */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Estimated Rows:
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {isCheckingSize ? (
                <span className="text-sm text-gray-500">Calculating...</span>
              ) : estimatedRows !== null ? (
                estimatedRows.toLocaleString()
              ) : (
                <span className="text-sm text-gray-500">Unknown</span>
              )}
            </span>
          </div>

          {isTooLarge && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  Too many results ({estimatedRows!.toLocaleString()} rows)
                </p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  Maximum 10,000 rows allowed. Please narrow your date range or add more filters.
                </p>
              </div>
            </div>
          )}

          {estimatedRows === 0 && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                No audit logs found matching your filters.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Actions */}
      <ModalActions>
        <Button variant="secondary" onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleExport}
          disabled={isExporting || isTooLarge || estimatedRows === 0}
          loading={isExporting}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : `Export ${selectedFormat.toUpperCase()}`}
        </Button>
      </ModalActions>
    </Modal>
  );
}
