'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorModal from '@/components/ui/ErrorModal';
import Button from '@/components/ui/Button';
import CallLogFiltersComponent from '@/components/voice-ai/admin/reports/CallLogFilters';
import CallLogsTable from '@/components/voice-ai/admin/reports/CallLogsTable';
import CallDetailModal from '@/components/voice-ai/admin/reports/CallDetailModal';
import voiceAiApi from '@/lib/api/voice-ai';
import type { CallLog, CallLogFilters } from '@/lib/types/voice-ai';
import { FileText, Download, RefreshCw } from 'lucide-react';

/**
 * Voice AI Call Logs Page (Platform Admin Only)
 * Route: /admin/voice-ai/reports/call-logs
 *
 * Features:
 * - Paginated call logs with filtering
 * - Filter by tenant, date range, outcome, status
 * - Export to CSV
 * - View full call details in modal
 * - Overage indicator
 * - Lead links
 */
export default function CallLogsPage() {
  // State management
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter state
  const [filters, setFilters] = useState<CallLogFilters>({
    tenantId: undefined,
    from: undefined,
    to: undefined,
    outcome: undefined,
    status: undefined,
    page: 1,
    limit: 20,
  });

  // Initial data load
  useEffect(() => {
    Promise.all([fetchCallLogs(), fetchTenants()]);
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchCallLogs();
  }, [filters.page, filters.limit]);

  const fetchCallLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await voiceAiApi.getCallLogs(filters);
      setCallLogs(response.data);
      setTotal(response.meta.total);
      setPage(response.meta.page);
      setLimit(response.meta.limit);
      setTotalPages(response.meta.total_pages);
    } catch (err: any) {
      console.error('Failed to fetch call logs:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load call logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await voiceAiApi.getAllTenants({ limit: 1000 });
      setTenants(
        response.data.map((t) => ({
          id: t.tenant_id,
          name: t.company_name,
        }))
      );
    } catch (err: any) {
      console.error('Failed to fetch tenants:', err);
      // Non-critical error, just log it
    }
  };

  const handleApplyFilters = () => {
    setFilters({ ...filters, page: 1 });
    fetchCallLogs();
  };

  const handleResetFilters = () => {
    setFilters({
      tenantId: undefined,
      from: undefined,
      to: undefined,
      outcome: undefined,
      status: undefined,
      page: 1,
      limit: 20,
    });
    setTimeout(() => fetchCallLogs(), 0);
  };

  const handleViewDetails = (call: CallLog) => {
    setSelectedCall(call);
    setIsDetailModalOpen(true);
  };

  const handleExportCSV = () => {
    try {
      // Create CSV content
      const headers = [
        'Timestamp',
        'Tenant ID',
        'Call SID',
        'From',
        'To',
        'Direction',
        'Status',
        'Outcome',
        'Duration (s)',
        'Is Overage',
        'Lead ID',
      ];

      const rows = callLogs.map((call) => [
        new Date(call.started_at).toISOString(),
        call.tenant_id,
        call.call_sid,
        call.from_number,
        call.to_number,
        call.direction,
        call.status,
        call.outcome || '',
        call.duration_seconds.toString(),
        call.is_overage ? 'Yes' : 'No',
        call.lead_id || '',
      ]);

      const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `call_logs_${new Date().toISOString()}.csv`;
      link.click();
    } catch (err: any) {
      console.error('Failed to export CSV:', err);
      setError('Failed to export CSV');
    }
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const getTenantName = (tenantId: string): string => {
    const tenant = tenants.find((t) => t.id === tenantId);
    return tenant?.name || tenantId;
  };

  const breadcrumbItems = [
    { label: 'Admin', href: '/admin/dashboard' },
    { label: 'Voice AI', href: '/admin/voice-ai/providers' },
    { label: 'Reports', href: '/admin/voice-ai/reports' },
    { label: 'Call Logs', href: '/admin/voice-ai/reports/call-logs' },
  ];

  return (
    <ProtectedRoute requiredPermission="platform_admin:view_all_tenants">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-100 dark:bg-brand-900/20 rounded-lg">
                <FileText className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Call Logs
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  View and filter call logs across all tenants
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExportCSV} disabled={callLogs.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={fetchCallLogs} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <CallLogFiltersComponent
          filters={filters}
          onFiltersChange={setFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          tenants={tenants}
          loading={loading}
        />

        {/* Loading State */}
        {loading && !callLogs.length ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : callLogs.length === 0 ? (
          /* Empty State */
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No call logs found
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Try adjusting your filters or check back later.
            </p>
          </div>
        ) : (
          /* Call Logs Table */
          <CallLogsTable
            callLogs={callLogs}
            tenants={tenants}
            onViewDetails={handleViewDetails}
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            loading={loading}
          />
        )}
      </div>

      {/* Call Detail Modal */}
      <CallDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedCall(null);
        }}
        call={selectedCall}
        tenantName={selectedCall ? getTenantName(selectedCall.tenant_id) : undefined}
      />

      {/* Error Modal */}
      {error && (
        <ErrorModal
          isOpen={!!error}
          onClose={() => setError(null)}
          title="Error"
          message={error}
        />
      )}
    </ProtectedRoute>
  );
}
