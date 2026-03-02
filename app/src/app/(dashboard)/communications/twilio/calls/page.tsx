/**
 * Call History & Playback Page (Sprint 4)
 * Comprehensive call history interface with pagination, filtering, search, recording playback, and CSV export
 *
 * Features:
 * - Paginated call history table with server-side pagination
 * - Filters: direction, status, call type, date range
 * - Search: lead name, phone numbers
 * - Recording playback with HTML5 audio player
 * - CSV export functionality
 * - Call details modal
 * - Mobile responsive (table converts to cards on <768px)
 * - RBAC enforcement (Owner, Admin, Manager, Sales can access)
 * - Dark mode support
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
  Phone,
  Search,
  Download,
  Filter,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  User,
  Calendar,
  Play,
  AlertCircle,
  Bot,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { CallDetailsModal } from '@/components/twilio/CallDetailsModal';
import { CallRecordCard } from '@/components/twilio/CallRecordCard';

import { getUnifiedCallHistory } from '@/lib/api/twilio-tenant';
import type { UnifiedCallRecord, UnifiedCallHistoryResponse, CallDirection, CallStatus, CallType } from '@/lib/types/twilio-tenant';
import { useAuth } from '@/contexts/AuthContext';

// Helper functions for formatting
function formatCallStatus(status: CallStatus): string {
  const statusMap: Record<CallStatus, string> = {
    initiated: 'Initiated',
    ringing: 'Ringing',
    in_progress: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    no_answer: 'No Answer',
    busy: 'Busy',
    canceled: 'Canceled',
  };
  return statusMap[status] || status;
}

function getCallStatusVariant(status: CallStatus): 'success' | 'danger' | 'warning' | 'orange' | 'gray' | 'info' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'no_answer':
      return 'warning';
    case 'busy':
      return 'orange';
    case 'canceled':
      return 'gray';
    case 'in_progress':
    case 'ringing':
    case 'initiated':
      return 'info';
    default:
      return 'gray';
  }
}

function getCallDirectionVariant(direction: CallDirection): 'info' | 'purple' {
  return direction === 'inbound' ? 'info' : 'purple';
}

function formatCallDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDirection(direction: CallDirection): string {
  return direction === 'inbound' ? 'Inbound' : 'Outbound';
}

function getLeadFullName(lead: UnifiedCallRecord['lead']): string {
  if (!lead) return 'Unknown';
  return `${lead.first_name} ${lead.last_name}`.trim() || 'Unknown';
}

function getUserFullName(user: UnifiedCallRecord['initiated_by_user']): string {
  if (!user) return 'System';
  return `${user.first_name} ${user.last_name}`.trim() || 'System';
}

// CSV export function
function exportToCSV(calls: UnifiedCallRecord[]) {
  const headers = [
    'Date/Time',
    'Call Type',
    'Lead Name',
    'Lead Phone',
    'Direction',
    'Status',
    'Duration (seconds)',
    'Recording Available',
    'Initiated By',
  ];

  const rows = calls.map((call) => [
    format(new Date(call.created_at), 'yyyy-MM-dd HH:mm:ss'),
    call.call_type === 'voice_ai' ? 'AI Call' : 'IVR Call',
    getLeadFullName(call.lead),
    call.lead?.phone || call.direction === 'inbound' ? call.from_number : call.to_number,
    formatDirection(call.direction),
    formatCallStatus(call.status),
    call.recording_duration_seconds?.toString() || '0',
    call.recording_url ? 'Yes' : 'No',
    getUserFullName(call.initiated_by_user),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `call-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function CallHistoryPage() {
  const { user } = useAuth();

  // State
  const [calls, setCalls] = useState<UnifiedCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [ivrCount, setIvrCount] = useState(0);
  const [voiceAiCount, setVoiceAiCount] = useState(0);

  // Filters
  const [directionFilter, setDirectionFilter] = useState<CallDirection | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<CallStatus | 'all'>('all');
  const [callTypeFilter, setCallTypeFilter] = useState<'all' | 'ivr' | 'voice_ai'>('all');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [selectedCall, setSelectedCall] = useState<UnifiedCallRecord | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // RBAC - Check if user can view call history
  const canViewCallHistory = user?.roles?.some((role) =>
    ['Owner', 'Admin', 'Manager', 'Sales'].includes(role)
  ) || false;

  // Select options
  const directionOptions = [
    { value: 'all', label: 'All Directions' },
    { value: 'inbound', label: 'Inbound' },
    { value: 'outbound', label: 'Outbound' },
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'no_answer', label: 'No Answer' },
    { value: 'busy', label: 'Busy' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'ringing', label: 'Ringing' },
    { value: 'initiated', label: 'Initiated' },
  ];

  const callTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'ivr', label: 'IVR Calls' },
    { value: 'voice_ai', label: 'AI Calls' },
  ];

  const perPageOptions = [
    { value: '10', label: '10 per page' },
    { value: '20', label: '20 per page' },
    { value: '50', label: '50 per page' },
    { value: '100', label: '100 per page' },
  ];

  // Fetch call history
  useEffect(() => {
    if (canViewCallHistory) {
      fetchCallHistory();
    }
  }, [page, limit, canViewCallHistory]);

  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      const response = await getUnifiedCallHistory({ page, limit });
      setCalls(response.data);
      setTotal(response.meta.total);
      setTotalPages(response.meta.totalPages);
      setIvrCount(response.meta.ivr_count);
      setVoiceAiCount(response.meta.voice_ai_count);
    } catch (error: any) {
      console.error('Error fetching call history:', error);
      toast.error('Failed to load call history');
      setCalls([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search calls (client-side)
  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      // Direction filter
      if (directionFilter !== 'all' && call.direction !== directionFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && call.status !== statusFilter) {
        return false;
      }

      // Call type filter
      if (callTypeFilter !== 'all' && call.call_type !== callTypeFilter) {
        return false;
      }

      // Date range filter
      if (dateFrom && new Date(call.created_at) < dateFrom) {
        return false;
      }
      if (dateTo && new Date(call.created_at) > dateTo) {
        return false;
      }

      // Search filter (lead name, phone numbers)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const leadName = getLeadFullName(call.lead).toLowerCase();
        const leadPhone = call.lead?.phone?.toLowerCase() || '';
        const fromNumber = call.from_number.toLowerCase();
        const toNumber = call.to_number.toLowerCase();

        if (
          !leadName.includes(query) &&
          !leadPhone.includes(query) &&
          !fromNumber.includes(query) &&
          !toNumber.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [calls, directionFilter, statusFilter, callTypeFilter, dateFrom, dateTo, searchQuery]);

  const handleCallClick = (call: CallRecord) => {
    setSelectedCall(call);
    setShowDetailsModal(true);
  };

  const handleExport = () => {
    if (filteredCalls.length === 0) {
      toast.error('No calls to export');
      return;
    }
    exportToCSV(filteredCalls);
    toast.success(`Exported ${filteredCalls.length} calls to CSV`);
  };

  const handleClearFilters = () => {
    setDirectionFilter('all');
    setStatusFilter('all');
    setCallTypeFilter('all');
    setDateFrom(null);
    setDateTo(null);
    setSearchQuery('');
  };

  // RBAC check - Employee cannot view
  if (!canViewCallHistory) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Call History
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View and manage call records, recordings, and transcriptions
          </p>
        </div>

        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You don't have permission to view call history. Contact your administrator.
          </p>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading && calls.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Call History
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View and manage call records, recordings, and transcriptions
          </p>
        </div>

        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb
        items={[
          { label: 'Communications', href: '/communications/history' },
          { label: 'Twilio', href: '/communications/twilio' },
          { label: 'Call History' }, // Current page
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Call History
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View and manage call records, recordings, and transcriptions
          </p>
        </div>

        <Button onClick={handleExport} variant="secondary" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="p-4 space-y-4">
          {/* Search */}
          <div>
            <Input
              type="text"
              placeholder="Search by lead name, phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Direction Filter */}
            <Select
              value={directionFilter}
              onChange={(value) => setDirectionFilter(value as any)}
              label="Direction"
              options={directionOptions}
            />

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as any)}
              label="Status"
              options={statusOptions}
            />

            {/* Call Type Filter */}
            <Select
              value={callTypeFilter}
              onChange={(value) => setCallTypeFilter(value as any)}
              label="Call Type"
              options={callTypeOptions}
            />

            {/* Per-page selector */}
            <Select
              value={limit.toString()}
              onChange={(value) => {
                setLimit(Number(value));
                setPage(1);
              }}
              label="Per Page"
              options={perPageOptions}
            />
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Range
            </label>
            <DateRangePicker
              startDate={dateFrom}
              endDate={dateTo}
              onChange={(start, end) => {
                setDateFrom(start);
                setDateTo(end);
              }}
            />
          </div>

          {/* Clear Filters */}
          {(directionFilter !== 'all' ||
            statusFilter !== 'all' ||
            callTypeFilter !== 'all' ||
            dateFrom ||
            dateTo ||
            searchQuery) && (
            <div className="flex justify-end">
              <Button onClick={handleClearFilters} variant="ghost" size="sm">
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredCalls.length} of {total} calls
        {filteredCalls.length !== total && ' (filtered)'}
        {' '} • {ivrCount} IVR • {voiceAiCount} AI
      </div>

      {/* Table (Desktop) and Cards (Mobile) */}
      {filteredCalls.length === 0 ? (
        <Card className="p-8 text-center">
          <Phone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No calls found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {calls.length === 0
              ? 'No call history available yet. Make your first call to see it here.'
              : 'No calls match your current filters. Try adjusting your search criteria.'}
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Lead
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Direction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Recording
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date/Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredCalls.map((call) => (
                      <tr
                        key={call.id}
                        onClick={() => handleCallClick(call)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <User className="w-5 h-5 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {getLeadFullName(call.lead)}
                              </div>
                              {call.call_reason && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {call.call_reason}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                          {call.lead?.phone || (call.direction === 'inbound' ? call.from_number : call.to_number)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {call.call_type === 'voice_ai' ? (
                            <Badge variant="purple">
                              <Bot className="w-3 h-3 mr-1" />
                              AI Call
                            </Badge>
                          ) : (
                            <Badge variant="gray">
                              <Phone className="w-3 h-3 mr-1" />
                              IVR
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={getCallDirectionVariant(call.direction)}>
                            {call.direction === 'inbound' ? (
                              <PhoneIncoming className="w-3 h-3 mr-1" />
                            ) : (
                              <PhoneOutgoing className="w-3 h-3 mr-1" />
                            )}
                            {formatDirection(call.direction)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={getCallStatusVariant(call.status)}>
                            {formatCallStatus(call.status)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1 text-gray-400" />
                            {formatCallDuration(call.recording_duration_seconds)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {call.recording_url ? (
                            <Badge variant="green">
                              <Play className="w-3 h-3 mr-1" />
                              Available
                            </Badge>
                          ) : (
                            <Badge variant="gray">
                              No Recording
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                            {format(new Date(call.created_at), 'MMM d, yyyy h:mm a')}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredCalls.map((call) => (
              <CallRecordCard
                key={call.id}
                call={call}
                onClick={() => handleCallClick(call)}
              />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          onNext={() => setPage((p) => Math.min(p + 1, totalPages))}
          onPrevious={() => setPage((p) => Math.max(p - 1, 1))}
          onGoToPage={setPage}
        />
      )}

      {/* Call Details Modal */}
      {selectedCall && (
        <CallDetailsModal
          call={selectedCall}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedCall(null);
          }}
        />
      )}
    </div>
  );
}
