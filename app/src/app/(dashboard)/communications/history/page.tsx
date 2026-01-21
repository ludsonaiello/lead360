/**
 * Communication History Page
 * Lists all communication events with filtering, pagination, and CSV export
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Filter, Download, Search, X } from 'lucide-react';
import { getCommunicationHistory } from '@/lib/api/communication';
import type { CommunicationEvent, GetCommunicationHistoryParams } from '@/lib/types/communication';
import { CommunicationEventCard } from '@/components/communication/CommunicationEventCard';
import { CommunicationDetailModal } from '@/components/communication/CommunicationDetailModal';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Papa from 'papaparse';

export default function CommunicationHistoryPage() {
  const [events, setEvents] = useState<CommunicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Filters
  const [filters, setFilters] = useState<GetCommunicationHistoryParams>({
    page: 1,
    limit,
  });

  const [tempFilters, setTempFilters] = useState<GetCommunicationHistoryParams>({
    page: 1,
    limit,
  });

  // Filter options
  const channelOptions: SelectOption[] = [
    { value: '', label: 'All Channels' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'whatsapp', label: 'WhatsApp' },
  ];

  const statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'sent', label: 'Sent' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'failed', label: 'Failed' },
    { value: 'bounced', label: 'Bounced' },
  ];

  // Fetch communication history
  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await getCommunicationHistory({
        ...filters,
        page: currentPage,
        limit,
      });
      setEvents(response.data);
      setTotalPages(response.meta.total_pages);
      setTotalCount(response.meta.total_count);
    } catch (error) {
      console.error('Failed to fetch communication history:', error);
      toast.error('Failed to load communication history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentPage, filters]);

  // Apply filters
  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setCurrentPage(1);
    setShowFilters(false);
  };

  // Clear filters
  const handleClearFilters = () => {
    const clearedFilters: GetCommunicationHistoryParams = { page: 1, limit };
    setTempFilters(clearedFilters);
    setFilters(clearedFilters);
    setCurrentPage(1);
    setShowFilters(false);
  };

  // CSV Export
  const handleExportCSV = async () => {
    try {
      setExporting(true);

      // Fetch ALL records (not just current page)
      const response = await getCommunicationHistory({
        ...filters,
        page: 1,
        limit: 10000, // Large limit to get all records
      });

      // Transform data for CSV
      const csvData = response.data.map(event => ({
        'Date': format(new Date(event.created_at), 'yyyy-MM-dd HH:mm:ss'),
        'Channel': event.channel,
        'Recipient': event.to_email || event.to_phone || '',
        'Subject': event.subject || '',
        'Status': event.status,
        'Provider': event.provider_id || '',
        'Sent At': event.sent_at ? format(new Date(event.sent_at), 'yyyy-MM-dd HH:mm:ss') : '',
        'Delivered At': event.delivered_at ? format(new Date(event.delivered_at), 'yyyy-MM-dd HH:mm:ss') : '',
        'Opened At': event.opened_at ? format(new Date(event.opened_at), 'yyyy-MM-dd HH:mm:ss') : '',
        'Clicked At': event.clicked_at ? format(new Date(event.clicked_at), 'yyyy-MM-dd HH:mm:ss') : '',
        'Related To': event.related_entity_type ? `${event.related_entity_type} #${event.related_entity_id}` : '',
        'Error': event.error_message || '',
      }));

      // Generate CSV
      const csv = Papa.unparse(csvData);

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `communication-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${response.data.length} records successfully`);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  // View event details
  const handleViewDetails = (eventId: string) => {
    setSelectedEvent(eventId);
  };

  // Active filters count
  const activeFiltersCount = Object.keys(filters).filter(
    key => key !== 'page' && key !== 'limit' && filters[key as keyof GetCommunicationHistoryParams]
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Communication History
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            View all sent communications and their delivery status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="secondary"
            className="relative"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <Button
            onClick={handleExportCSV}
            disabled={exporting || events.length === 0}
            variant="secondary"
          >
            <Download className={`h-4 w-4 mr-2 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Channel"
              options={channelOptions}
              value={tempFilters.channel || ''}
              onChange={(value) => setTempFilters({ ...tempFilters, channel: value as any })}
            />

            <Select
              label="Status"
              options={statusOptions}
              value={tempFilters.status || ''}
              onChange={(value) => setTempFilters({ ...tempFilters, status: value as any })}
            />

            <Input
              label="Recipient Email"
              type="email"
              value={tempFilters.to_email || ''}
              onChange={(e) => setTempFilters({ ...tempFilters, to_email: e.target.value })}
              placeholder="customer@example.com"
            />

            <Input
              label="Recipient Phone"
              type="tel"
              value={tempFilters.to_phone || ''}
              onChange={(e) => setTempFilters({ ...tempFilters, to_phone: e.target.value })}
              placeholder="+1234567890"
            />

            <Input
              label="Start Date"
              type="date"
              value={tempFilters.start_date?.split('T')[0] || ''}
              onChange={(e) => setTempFilters({ ...tempFilters, start_date: e.target.value ? `${e.target.value}T00:00:00Z` : undefined })}
            />

            <Input
              label="End Date"
              type="date"
              value={tempFilters.end_date?.split('T')[0] || ''}
              onChange={(e) => setTempFilters({ ...tempFilters, end_date: e.target.value ? `${e.target.value}T23:59:59Z` : undefined })}
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={handleClearFilters} variant="secondary">
              Clear All
            </Button>
            <Button onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {events.length} of {totalCount} communication{totalCount === 1 ? '' : 's'}
          </span>
          {currentPage > 1 && (
            <span>
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>
      )}

      {/* Events List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Search className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            No communications found
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {activeFiltersCount > 0
              ? 'Try adjusting your filters to see more results'
              : 'No communications have been sent yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <CommunicationEventCard
              key={event.id}
              event={event}
              onViewDetails={() => handleViewDetails(event.id)}
              onResendSuccess={fetchHistory}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onNext={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            onPrevious={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            onGoToPage={setCurrentPage}
          />
        </div>
      )}

      {/* Communication Detail Modal */}
      {selectedEvent && (
        <CommunicationDetailModal
          eventId={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onResendSuccess={fetchHistory}
        />
      )}
    </div>
  );
}
