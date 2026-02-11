/**
 * All Calls Monitoring Page
 * Sprint 2: Cross-Tenant Communication Monitoring
 * View all voice calls across all tenants
 */

'use client';

import { useState, useEffect } from 'react';
import { Phone, Download } from 'lucide-react';
import { getAllCalls } from '@/lib/api/twilio-admin';
import type { CallRecord, CallFilters } from '@/lib/types/twilio-admin';
import { CallFilters as CallFiltersComponent } from '@/components/admin/twilio/CallFilters';
import { CallsTable } from '@/components/admin/twilio/CallsTable';
import { CallDetailModal } from '@/components/admin/twilio/CallDetailModal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import Papa from 'papaparse';
import { format } from 'date-fns';

export default function AllCallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [filters, setFilters] = useState<CallFilters>({
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 1,
    has_next: false,
    has_prev: false,
  });

  // Fetch calls when filters change
  useEffect(() => {
    fetchCalls();
  }, [filters]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const response = await getAllCalls(filters);
      setCalls(response.data);
      setPagination(response.pagination);
    } catch (error: any) {
      console.error('Failed to load calls:', error);
      toast.error(error.response?.data?.message || 'Failed to load calls');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
    });
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);

      // Fetch all records (not just current page)
      const response = await getAllCalls({
        ...filters,
        page: 1,
        limit: 10000, // Max limit
      });

      // Transform data for CSV
      const csvData = response.data.map((call) => ({
        'Date': call.created_at,
        'Tenant': call.tenant?.company_name || 'N/A',
        'Direction': call.direction,
        'From': call.from_number,
        'To': call.to_number,
        'Status': call.status,
        'Duration (seconds)': call.recording_duration_seconds || 0,
        'Cost': call.cost || '0.00',
        'Lead': call.lead ? `${call.lead.first_name} ${call.lead.last_name}` : 'N/A',
        'Call SID': call.twilio_call_sid,
      }));

      // Generate CSV
      const csv = Papa.unparse(csvData);

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `calls-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();

      toast.success(`Exported ${response.data.length} calls successfully`);
    } catch (error: any) {
      console.error('Failed to export calls:', error);
      toast.error(error.response?.data?.message || 'Failed to export calls');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Phone className="h-8 w-8" />
            All Calls Monitoring
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor voice calls across all tenants
          </p>
        </div>
        <Button onClick={handleExportCSV} loading={exporting} disabled={calls.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <CallFiltersComponent
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* Results Summary */}
      {!loading && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {calls.length} of {pagination.total} calls
        </div>
      )}

      {/* Calls Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <CallsTable calls={calls} onViewDetails={setSelectedCall} />

          {/* Pagination */}
          {pagination.pages > 1 && (
            <PaginationControls
              currentPage={filters.page || 1}
              totalPages={pagination.pages}
              onNext={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
              onPrevious={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
            />
          )}
        </>
      )}

      {/* Detail Modal */}
      <CallDetailModal
        isOpen={!!selectedCall}
        call={selectedCall}
        onClose={() => setSelectedCall(null)}
      />
    </div>
  );
}
