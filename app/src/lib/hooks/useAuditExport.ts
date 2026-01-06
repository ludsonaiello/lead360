// Custom hook for exporting audit logs

import { useState, useCallback } from 'react';
import { exportAuditLogs, getAuditLogs } from '@/lib/api/audit';
import type { ExportFormat, AuditLogFilters } from '@/lib/types/audit';
import toast from 'react-hot-toast';

interface UseAuditExportReturn {
  /**
   * Export audit logs to specified format
   * Validates row count before export (max 10,000)
   */
  exportLogs: (format: ExportFormat, filters?: Omit<AuditLogFilters, 'page' | 'limit'>) => Promise<void>;

  /**
   * Check if export would exceed limit without downloading
   */
  checkExportSize: (filters?: Omit<AuditLogFilters, 'page' | 'limit'>) => Promise<number>;

  /**
   * Whether export is currently in progress
   */
  isExporting: boolean;

  /**
   * Error message if export failed
   */
  error: string | null;
}

const MAX_EXPORT_ROWS = 10000;

/**
 * Custom hook for handling audit log exports
 *
 * Features:
 * - Pre-validates export size (max 10,000 rows)
 * - Handles CSV and JSON formats
 * - Shows toast notifications for success/error
 * - Loading state management
 *
 * @returns Export functions and state
 *
 * @example
 * ```tsx
 * const { exportLogs, isExporting, checkExportSize } = useAuditExport();
 *
 * const handleExport = async () => {
 *   const count = await checkExportSize(filters);
 *   if (count > 10000) {
 *     alert('Too many results');
 *     return;
 *   }
 *   await exportLogs('csv', filters);
 * };
 * ```
 */
export function useAuditExport(): UseAuditExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check how many rows would be exported without actually exporting
   */
  const checkExportSize = useCallback(async (
    filters?: Omit<AuditLogFilters, 'page' | 'limit'>
  ): Promise<number> => {
    try {
      // Fetch with limit 1 just to get total count
      const response = await getAuditLogs({ ...filters, page: 1, limit: 1 });
      return response.pagination.total;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to check export size');
    }
  }, []);

  /**
   * Export audit logs to file
   * Automatically validates row count and triggers browser download
   */
  const exportLogs = useCallback(async (
    format: ExportFormat,
    filters?: Omit<AuditLogFilters, 'page' | 'limit'>
  ): Promise<void> => {
    try {
      setIsExporting(true);
      setError(null);

      // Check total count first
      const totalRows = await checkExportSize(filters);

      // Validate row count
      if (totalRows === 0) {
        toast.error('No audit logs found matching your filters.');
        return;
      }

      if (totalRows > MAX_EXPORT_ROWS) {
        const errorMsg = `Too many results (${totalRows.toLocaleString()} rows). Maximum ${MAX_EXPORT_ROWS.toLocaleString()} rows allowed. Please narrow your date range or add more filters.`;
        setError(errorMsg);
        toast.error(errorMsg, { duration: 5000 });
        return;
      }

      // Perform export (triggers download)
      await exportAuditLogs(format, filters);

      // Success notification
      const formatName = format.toUpperCase();
      toast.success(`Successfully exported ${totalRows.toLocaleString()} audit log${totalRows !== 1 ? 's' : ''} to ${formatName}`);

      setError(null);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to export audit logs';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsExporting(false);
    }
  }, [checkExportSize]);

  return {
    exportLogs,
    checkExportSize,
    isExporting,
    error
  };
}
