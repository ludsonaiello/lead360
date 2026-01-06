// Platform Admin: Tenant-Specific Audit Log Page
// View audit logs for a specific tenant

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Shield, Building2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { AuditLogFilters } from '@/components/audit/AuditLogFilters';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { AuditLogDetailModal } from '@/components/audit/AuditLogDetailModal';
import { ExportAuditModal } from '@/components/audit/ExportAuditModal';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import type { AuditLog } from '@/lib/types/audit';
import { Button } from '@/components/ui/Button';

interface TenantAuditPageProps {
  params: {
    id: string;
  };
}

/**
 * Platform Admin: Tenant-Specific Audit Log Page
 *
 * Route: /admin/tenants/[id]/audit
 * Access: Platform Admin only
 *
 * Features:
 * - View all logs for specific tenant
 * - Pre-filtered to tenant ID
 * - Export tenant-specific logs
 * - Full filtering capabilities
 */
export default function TenantAuditPage({ params }: TenantAuditPageProps) {
  const { id: tenantId } = params;
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Use audit logs hook for specific tenant
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
    endpointType: 'tenant',
    resourceId: tenantId,
    syncWithUrl: true,
    autoFetch: true
  });

  // Get tenant name from first log entry
  const tenantName = logs[0]?.tenant?.legal_name || 'Tenant';

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
        <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
          Admin
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/admin/tenants" className="hover:text-blue-600 dark:hover:text-blue-400">
          Tenants
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 dark:text-gray-100">Audit Log</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Audit Log - {tenantName}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All activity for this tenant (Platform Admin view)
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2"
        >
          <Shield className="h-4 w-4" />
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
          emptyMessage="No activity found for this tenant"
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
