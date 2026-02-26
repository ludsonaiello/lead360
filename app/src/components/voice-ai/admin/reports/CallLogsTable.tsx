import React from 'react';
import Button from '@/components/ui/Button';
import type { CallLog } from '@/lib/types/voice-ai';
import { Eye, Clock, AlertTriangle } from 'lucide-react';

interface CallLogsTableProps {
  callLogs: CallLog[];
  tenants: Array<{ id: string; name: string }>;
  onViewDetails: (call: CallLog) => void;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading: boolean;
}

/**
 * Call Logs Table Component
 * Paginated table displaying call logs with status badges and actions
 */
export default function CallLogsTable({
  callLogs,
  tenants,
  onViewDetails,
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  loading,
}: CallLogsTableProps) {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const classes = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      transferred: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    }[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${classes}`}>
        {status}
      </span>
    );
  };

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) {
      return <span className="text-xs text-gray-500 dark:text-gray-400">N/A</span>;
    }

    const classes = {
      lead_created: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      transferred: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      abandoned: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    }[outcome] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';

    const label = outcome.replace('_', ' ');

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${classes}`}>
        {label}
      </span>
    );
  };

  const getTenantName = (tenantId: string): string => {
    const tenant = tenants.find((t) => t.id === tenantId);
    return tenant?.name || tenantId;
  };

  return (
    <div className="space-y-4">
      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          Showing {callLogs.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
          {Math.min(page * limit, total)} of {total} calls
        </span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Caller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Outcome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {callLogs.map((call) => (
                <tr
                  key={call.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(call.started_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {getTenantName(call.tenant_id)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                      {call.from_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(call.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getOutcomeBadge(call.outcome)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-gray-100">
                        <Clock className="h-4 w-4" />
                        <span>{formatDuration(call.duration_seconds)}</span>
                      </div>
                      {call.is_overage && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                          title="Overage call"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Overage
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <Button variant="ghost" size="sm" onClick={() => onViewDetails(call)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1 || loading}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  disabled={loading}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
