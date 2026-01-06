// Tenant Audit Log Page
// Main audit log viewer for tenant users

'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { AuditLogFilters } from '@/components/audit/AuditLogFilters';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { AuditLogDetailModal } from '@/components/audit/AuditLogDetailModal';
import { ExportAuditModal } from '@/components/audit/ExportAuditModal';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import type { AuditLog } from '@/lib/types/audit';

/**
 * Tenant Audit Log Page
 *
 * Route: /settings/audit-log
 * Access: Owner, Admin only
 *
 * Features:
 * - View all audit logs for current tenant
 * - Filter by date range, action type, entity type, status, search
 * - Pagination (50 items per page)
 * - Export to CSV/JSON
 * - Click row to view full details
 * - URL query param synchronization (shareable links)
 *
 * Auto-filtered to current tenant (backend enforces)
 */
export default function AuditLogPage() {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Use audit logs hook with default settings
  const {
    logs,
    pagination,
    filters,
    isLoading,
    error,
    setFilters,
    resetFilters,
    nextPage,
    previousPage,
    goToPage,
    refresh
  } = useAuditLogs({
    syncWithUrl: true,
    autoFetch: true
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Audit Log
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track all changes and actions in your account
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-300">
            <span className="font-medium">Error:</span> {error}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            className="mt-2"
          >
            Try Again
          </Button>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-6 p-6">
        <AuditLogFilters
          filters={filters}
          onChange={setFilters}
          onReset={resetFilters}
        />
      </Card>

      {/* Results Summary */}
      {pagination && !isLoading && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} log{pagination.total !== 1 ? 's' : ''}
        </div>
      )}

      {/* Audit Log Table */}
      <Card className="mb-6 overflow-hidden">
        <AuditLogTable
          logs={logs}
          isLoading={isLoading}
          onRowClick={setSelectedLog}
        />
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <PaginationControls
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onNext={nextPage}
            onPrevious={previousPage}
            onGoToPage={goToPage}
          />
        </div>
      )}

      {/* Detail Modal */}
      <AuditLogDetailModal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        logId={selectedLog?.id || ''}
      />

      {/* Export Modal */}
      <ExportAuditModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentFilters={filters}
      />
    </div>
  );
}
