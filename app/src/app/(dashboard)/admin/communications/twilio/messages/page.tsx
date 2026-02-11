/**
 * Messages Monitoring Page
 * Sprint 2: Cross-Tenant Communication Monitoring
 * View all SMS/WhatsApp messages across all tenants
 */

'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Download } from 'lucide-react';
import { getAllSMS, getAllWhatsApp } from '@/lib/api/twilio-admin';
import type { CommunicationEvent, MessageFilters } from '@/lib/types/twilio-admin';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { MessageFilters as MessageFiltersComponent } from '@/components/admin/twilio/MessageFilters';
import { MessagesGrid } from '@/components/admin/twilio/MessagesGrid';
import { MessageDetailModal } from '@/components/admin/twilio/MessageDetailModal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import Papa from 'papaparse';
import { format } from 'date-fns';

type TabType = 'sms' | 'whatsapp';

const TABS: TabItem[] = [
  { id: 'sms', label: 'SMS Messages', icon: MessageSquare },
  { id: 'whatsapp', label: 'WhatsApp Messages', icon: MessageSquare },
];

export default function MessagesMonitoringPage() {
  const [activeTab, setActiveTab] = useState<TabType>('sms');
  const [messages, setMessages] = useState<CommunicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<CommunicationEvent | null>(null);
  const [filters, setFilters] = useState<MessageFilters>({
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

  // Fetch messages when tab or filters change
  useEffect(() => {
    fetchMessages();
  }, [activeTab, filters]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = activeTab === 'sms'
        ? await getAllSMS(filters)
        : await getAllWhatsApp(filters);
      setMessages(response.data);
      setPagination(response.pagination);
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      toast.error(error.response?.data?.message || 'Failed to load messages');
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
      const response = activeTab === 'sms'
        ? await getAllSMS({
            ...filters,
            page: 1,
            limit: 10000,
          })
        : await getAllWhatsApp({
            ...filters,
            page: 1,
            limit: 10000,
          });

      // Transform data for CSV
      const csvData = response.data.map((message) => ({
        'Date': message.created_at,
        'Tenant': message.tenant?.company_name || 'N/A',
        'Channel': message.channel.toUpperCase(),
        'Direction': message.direction,
        'From': message.from_phone || '',
        'To': message.to_phone || '',
        'Status': message.status,
        'Message': message.text_body || '',
        'Provider': message.provider?.provider_name || 'N/A',
        'Sent By': message.created_by_user
          ? `${message.created_by_user.first_name} ${message.created_by_user.last_name}`
          : 'N/A',
        'Provider Message ID': message.provider_message_id || '',
      }));

      // Generate CSV
      const csv = Papa.unparse(csvData);

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${activeTab}-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();

      toast.success(`Exported ${response.data.length} messages successfully`);
    } catch (error: any) {
      console.error('Failed to export messages:', error);
      toast.error(error.response?.data?.message || 'Failed to export messages');
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
            <MessageSquare className="h-8 w-8" />
            Messages Monitoring
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor SMS and WhatsApp messages across all tenants
          </p>
        </div>
        <Button onClick={handleExportCSV} loading={exporting} disabled={messages.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as TabType)} />

      {/* Filters */}
      <MessageFiltersComponent
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* Results Summary */}
      {!loading && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {messages.length} of {pagination.total} messages
        </div>
      )}

      {/* Messages Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <MessagesGrid messages={messages} onViewDetails={setSelectedMessage} />

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
      <MessageDetailModal
        isOpen={!!selectedMessage}
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
      />
    </div>
  );
}
