// User Activity Page
// View all actions performed by a specific user

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, User as UserIcon } from 'lucide-react';
import Card from '@/components/ui/Card';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { AuditLogFilters } from '@/components/audit/AuditLogFilters';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { AuditLogDetailModal } from '@/components/audit/AuditLogDetailModal';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import type { AuditLog } from '@/lib/types/audit';

interface UserActivityPageProps {
  params: {
    id: string;
  };
}

/**
 * User Activity Page
 *
 * Route: /settings/users/[id]/activity
 * Access: Owner, Admin only
 *
 * Features:
 * - View all actions performed by specific user
 * - Pre-filtered by user ID
 * - Simplified filters (no actor filter)
 * - Pagination
 * - Click row to view details
 */
export default function UserActivityPage({ params }: UserActivityPageProps) {
  const { id: userId } = params;
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Use audit logs hook for specific user
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
    goToPage
  } = useAuditLogs({
    endpointType: 'user',
    resourceId: userId,
    syncWithUrl: true,
    autoFetch: true
  });

  // Get user name from first log entry
  const userName = logs[0]?.actor
    ? `${logs[0].actor.first_name} ${logs[0].actor.last_name}`
    : 'User';

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
        <Link href="/settings" className="hover:text-blue-600 dark:hover:text-blue-400">
          Settings
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/settings/users" className="hover:text-blue-600 dark:hover:text-blue-400">
          Users
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 dark:text-gray-100">Activity</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <UserIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Activity Log - {userName}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            All actions performed by this user
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-300">
            <span className="font-medium">Error:</span> {error}
          </p>
        </Card>
      )}

      {/* Filters (hide actor filter) */}
      <Card className="mb-6 p-6">
        <AuditLogFilters
          filters={filters}
          onChange={setFilters}
          onReset={resetFilters}
          hideActorFilter
        />
      </Card>

      {/* Results Summary */}
      {pagination && !isLoading && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} action{pagination.total !== 1 ? 's' : ''}
        </div>
      )}

      {/* Audit Log Table */}
      <Card className="mb-6 overflow-hidden">
        <AuditLogTable
          logs={logs}
          isLoading={isLoading}
          onRowClick={setSelectedLog}
          emptyMessage="No activity found for this user"
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
    </div>
  );
}
