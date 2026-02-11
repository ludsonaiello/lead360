/**
 * Webhook Events List Page
 * Full list of webhook events with filtering and pagination
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Webhook, Filter } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { WebhookEventsTable } from '@/components/admin/twilio/WebhookEventsTable';
import { WebhookEventDetailModal } from '@/components/admin/twilio/WebhookEventDetailModal';
import { getWebhookEvents, retryWebhookEvent } from '@/lib/api/twilio-admin';
import type { WebhookEvent, WebhookEventFilters } from '@/lib/types/twilio-admin';

export default function WebhookEventsListPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryingEvents, setRetryingEvents] = useState<Record<string, boolean>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [webhookType, setWebhookType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start_date: Date | null; end_date: Date | null }>({ start_date: null, end_date: null });
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadEvents();
  }, [currentPage, webhookType, status, dateRange]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const filters: WebhookEventFilters = {
        page: currentPage,
        limit,
        ...(webhookType && { webhook_type: webhookType as any }),
        ...(status && { status: status as any }),
        ...(dateRange.start_date && { start_date: dateRange.start_date.toISOString() }),
        ...(dateRange.end_date && { end_date: dateRange.end_date.toISOString() })
      };

      const data = await getWebhookEvents(filters);
      setEvents(data.data);
      setTotalPages(data.pagination.pages);
      setTotalCount(data.pagination.total);
    } catch (error: any) {
      console.error('[WebhookEvents] Error loading events:', error);
      setErrorMessage(error?.message || 'Failed to load webhook events');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryEvent = async (id: string) => {
    setRetryingEvents((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await retryWebhookEvent(id);
      setSuccessMessage(result.message || 'Webhook event retry queued');
      // Reload events to show updated status
      await loadEvents();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to retry webhook event');
    } finally {
      setRetryingEvents((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleViewDetails = (event: WebhookEvent) => {
    setSelectedEvent(event);
    setDetailModalOpen(true);
  };

  const handleClearFilters = () => {
    setWebhookType('');
    setStatus('');
    setDateRange({ start_date: null, end_date: null });
    setCurrentPage(1);
  };

  const hasActiveFilters = webhookType || status || dateRange.start_date || dateRange.end_date;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <Link href="/admin/communications/twilio" className="hover:text-gray-700 dark:hover:text-gray-300">
            Twilio Admin
          </Link>
          <span>/</span>
          <Link href="/admin/communications/twilio/webhooks" className="hover:text-gray-700 dark:hover:text-gray-300">
            Webhooks
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-100">Events</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Webhook className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Webhook Events
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {totalCount} total events
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={hasActiveFilters ? 'primary' : 'secondary'}
            size="sm"
          >
            <Filter className="h-4 w-4 mr-2" />
            {hasActiveFilters ? 'Filters Active' : 'Filters'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Webhook Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Webhook Type
              </label>
              <Select
                value={webhookType}
                onChange={(value) => {
                  setWebhookType(value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'sms', label: 'SMS' },
                  { value: 'call', label: 'Call' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'email', label: 'Email' }
                ]}
                className="w-full"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <Select
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'processed', label: 'Processed' },
                  { value: 'failed', label: 'Failed' }
                ]}
                className="w-full"
              />
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <DateRangePicker
                startDate={dateRange.start_date}
                endDate={dateRange.end_date}
                onChange={(start, end) => {
                  setDateRange({ start_date: start, end_date: end });
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {/* Filter Actions */}
          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button onClick={handleClearFilters} variant="secondary" size="sm">
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Events Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        {loading ? (
          <div className="flex justify-center items-center p-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center p-12">
            <p className="text-gray-500 dark:text-gray-400">
              No webhook events found
            </p>
          </div>
        ) : (
          <>
            <WebhookEventsTable
              events={events}
              onRetry={handleRetryEvent}
              onViewDetails={handleViewDetails}
              retrying={retryingEvents}
            />
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onNext={() => setCurrentPage((p) => p + 1)}
                onPrevious={() => setCurrentPage((p) => p - 1)}
                onGoToPage={(page) => setCurrentPage(page)}
              />
            </div>
          </>
        )}
      </div>

      {/* Event Detail Modal */}
      <WebhookEventDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={!!successMessage}
        onClose={() => setSuccessMessage(null)}
        title="Success"
        message={successMessage || ''}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Error"
        message={errorMessage || ''}
      />
    </div>
  );
}
