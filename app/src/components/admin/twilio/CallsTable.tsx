/**
 * CallsTable Component
 * Responsive table for displaying call records
 */

'use client';

import { Phone, ArrowDown, ArrowUp, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { CallRecord } from '@/lib/types/twilio-admin';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface CallsTableProps {
  calls: CallRecord[];
  onViewDetails: (call: CallRecord) => void;
}

// Helper function to format phone number
function formatPhone(phone: string): string {
  if (!phone) return 'N/A';
  // Format: +1 (415) 555-1234
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// Helper function to format duration
function formatDuration(seconds?: number): string {
  if (!seconds) return '0s';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

// Helper function to format date/time
function formatDateTime(dateString: string): string {
  try {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm');
  } catch {
    return dateString;
  }
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    no_answer: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    busy: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    initiated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    ringing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };

  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

// Direction badge component
function DirectionBadge({ direction }: { direction: string }) {
  if (direction === 'inbound') {
    return (
      <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
        <ArrowDown className="h-3 w-3" />
        <span className="text-xs font-medium">Inbound</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
      <ArrowUp className="h-3 w-3" />
      <span className="text-xs font-medium">Outbound</span>
    </span>
  );
}

export function CallsTable({ calls, onViewDetails }: CallsTableProps) {
  if (calls.length === 0) {
    return (
      <div className="text-center py-12">
        <Phone className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No calls found</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Try adjusting your filters to see more results.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date/Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tenant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                From
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                To
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
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {calls.map((call) => (
              <tr
                key={call.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                onClick={() => onViewDetails(call)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatDateTime(call.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <div className="font-medium">{call.tenant?.company_name || 'N/A'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {call.tenant?.subdomain}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatPhone(call.from_number)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatPhone(call.to_number)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <DirectionBadge direction={call.direction} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={call.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-gray-400" />
                    {formatDuration(call.recording_duration_seconds)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(call);
                    }}
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {calls.map((call) => (
          <Card
            key={call.id}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onViewDetails(call)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {call.tenant?.company_name || 'N/A'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDateTime(call.created_at)}
                </div>
              </div>
              <StatusBadge status={call.status} />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Direction:</span>
                <DirectionBadge direction={call.direction} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">From:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatPhone(call.from_number)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">To:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatPhone(call.to_number)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatDuration(call.recording_duration_seconds)}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <Button variant="ghost" size="sm" onClick={() => onViewDetails(call)} className="w-full">
                View Details
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
