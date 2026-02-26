'use client';

// ============================================================================
// CallLogsList Component
// ============================================================================
// Main component for displaying call logs with filters and pagination
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Loader2,
  Eye,
  ExternalLink,
  Phone,
  AlertTriangle,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { CallLogFilters, CallLogFiltersState } from './CallLogFilters';
import { CallDetailModal } from './CallDetailModal';
import { CallStatusBadge } from './CallStatusBadge';
import { CallOutcomeBadge } from './CallOutcomeBadge';
import * as voiceAiApi from '@/lib/api/voice-ai';
import type { CallLog, PaginatedCallLogsResponse } from '@/lib/types/voice-ai';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

/**
 * Default filter values (last 30 days)
 */
const getDefaultFilters = (): CallLogFiltersState => {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  return {
    from: thirtyDaysAgo.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
    outcome: '',
    status: '',
    page: 1,
    limit: 20,
  };
};

/**
 * CallLogsList - Main list component with filters, table, and pagination
 */
export function CallLogsList() {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [meta, setMeta] = useState<PaginatedCallLogsResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<CallLogFiltersState>(getDefaultFilters());
  const [selectedCallLogId, setSelectedCallLogId] = useState<string | null>(null);

  /**
   * Load call logs from API
   */
  const loadCallLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build filters object (exclude empty values)
      const apiFilters: any = {
        page: filters.page,
        limit: filters.limit,
      };

      if (filters.from) {
        apiFilters.from = filters.from;
      }

      if (filters.to) {
        apiFilters.to = filters.to;
      }

      if (filters.outcome) {
        apiFilters.outcome = filters.outcome;
      }

      if (filters.status) {
        apiFilters.status = filters.status;
      }

      const response = await voiceAiApi.getTenantCallLogs(apiFilters);
      setCallLogs(response.data);
      setMeta(response.meta);
    } catch (err: any) {
      console.error('[CallLogsList] Failed to load call logs:', err);
      const errorMessage = err.response?.data?.message || 'Failed to load call logs';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount and when filters change
  useEffect(() => {
    loadCallLogs();
  }, [filters.page]); // Only reload when page changes

  /**
   * Handle filter changes
   */
  const handleFiltersChange = (newFilters: CallLogFiltersState) => {
    setFilters(newFilters);
  };

  /**
   * Handle search/apply filters
   */
  const handleSearch = () => {
    setFilters({ ...filters, page: 1 }); // Reset to page 1 and trigger reload
    loadCallLogs();
  };

  /**
   * Reset filters to defaults
   */
  const handleReset = () => {
    const defaultFilters = getDefaultFilters();
    setFilters(defaultFilters);
    // Reload will be triggered by useEffect when filters change
    setTimeout(() => loadCallLogs(), 0);
  };

  /**
   * Handle pagination change
   */
  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  /**
   * Format duration in seconds to human-readable format
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  /**
   * Format date to relative time
   */
  const formatRelativeTime = (dateString: string): string => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (err) {
      return dateString;
    }
  };

  // Loading state
  if (loading && callLogs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  // Error state
  if (error && callLogs.length === 0) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-1">
              Failed to Load Call Logs
            </h3>
            <p className="text-sm text-red-800 dark:text-red-200 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={loadCallLogs}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <CallLogFilters
        filters={filters}
        onChange={handleFiltersChange}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* Results Summary */}
      {meta && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {callLogs.length > 0 ? (meta.page - 1) * meta.limit + 1 : 0} to{' '}
          {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} call logs
        </div>
      )}

      {/* Empty State */}
      {callLogs.length === 0 && !loading && (
        <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-200 dark:bg-gray-700 rounded-full">
              <Phone className="h-8 w-8 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                No Call Logs Found
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No call logs found for the selected period. Adjust your filters or check
                back later.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Call Logs Table */}
      {callLogs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Caller
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {callLogs.map((callLog) => (
                  <tr
                    key={callLog.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {/* Date/Time */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(callLog.started_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(callLog.started_at).toLocaleTimeString()}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {formatRelativeTime(callLog.started_at)}
                      </div>
                    </td>

                    {/* Caller */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                        {callLog.from_number}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {callLog.direction}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <CallStatusBadge status={callLog.status} />
                    </td>

                    {/* Outcome */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CallOutcomeBadge outcome={callLog.outcome} />
                        {callLog.is_overage && (
                          <span
                            className="inline-flex items-center"
                            title="This call exceeded your quota"
                          >
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {formatDuration(callLog.duration_seconds)}
                      </div>
                    </td>

                    {/* Lead */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {callLog.lead_id ? (
                        <a
                          href={`/leads/${callLog.lead_id}`}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          View Lead
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                          -
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCallLogId(callLog.id)}
                      >
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
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <PaginationControls
          currentPage={meta.page}
          totalPages={meta.total_pages}
          onPageChange={handlePageChange}
        />
      )}

      {/* Detail Modal */}
      {selectedCallLogId && (
        <CallDetailModal
          callLogId={selectedCallLogId}
          isOpen={!!selectedCallLogId}
          onClose={() => setSelectedCallLogId(null)}
        />
      )}
    </div>
  );
}
