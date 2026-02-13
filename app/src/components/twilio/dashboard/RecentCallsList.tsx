/**
 * Recent Calls List Component
 * Displays last 5 call records on dashboard
 *
 * Features:
 * - Compact list view of recent calls
 * - Lead name and direction icon
 * - Status badge
 * - Time ago display
 * - Click to open call details modal
 * - Empty state
 * - Loading skeleton
 * - Dark mode support
 * - Mobile responsive
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import {
  PhoneIncoming,
  PhoneOutgoing,
  User,
  ArrowRight,
  Phone,
} from 'lucide-react';

import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import { CallDetailsModal } from '@/components/twilio/CallDetailsModal';
import type { CallRecord } from '@/lib/types/twilio-tenant';

interface RecentCallsListProps {
  /** Array of recent call records (max 5) */
  calls: CallRecord[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
}

// Helper functions
function formatCallStatus(status: string): string {
  const statusMap: Record<string, string> = {
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

function getCallStatusVariant(
  status: string
): 'success' | 'danger' | 'warning' | 'orange' | 'gray' | 'info' {
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
    default:
      return 'info';
  }
}

function getLeadFullName(lead: CallRecord['lead']): string {
  if (!lead) return 'Unknown';
  return `${lead.first_name} ${lead.last_name}`.trim() || 'Unknown';
}

function formatTimeAgo(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

// Loading Skeleton
function CallRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 animate-pulse">
      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
      </div>
    </div>
  );
}

export function RecentCallsList({ calls, isLoading = false, error }: RecentCallsListProps) {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  return (
    <>
      <Card>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Calls
              </h2>
            </div>
            <Link href="/communications/twilio/calls">
              <Button variant="ghost" size="sm" className="text-purple-600 dark:text-purple-400">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-1 divide-y divide-gray-100 dark:divide-gray-700">
              {[...Array(5)].map((_, index) => (
                <CallRowSkeleton key={index} />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="py-12 text-center">
              <Phone className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
              <Link href="/communications/twilio/calls">
                <Button variant="secondary" size="sm">
                  View Call History
                </Button>
              </Link>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && calls.length === 0 && (
            <div className="py-12 text-center">
              <Phone className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                No recent calls
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                Initiate your first call to see activity here
              </p>
              <Link href="/communications/twilio/calls">
                <Button variant="primary" size="sm">
                  Make a Call
                </Button>
              </Link>
            </div>
          )}

          {/* Call List */}
          {!isLoading && !error && calls.length > 0 && (
            <div className="space-y-1 divide-y divide-gray-100 dark:divide-gray-700">
              {calls.map((call) => (
                <button
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className="w-full flex items-center gap-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 -mx-2 transition-colors duration-150 text-left"
                >
                  {/* Direction Icon */}
                  <div
                    className={`p-2 rounded-full flex-shrink-0 ${
                      call.direction === 'inbound'
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'bg-purple-100 dark:bg-purple-900'
                    }`}
                  >
                    {call.direction === 'inbound' ? (
                      <PhoneIncoming className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <PhoneOutgoing className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>

                  {/* Call Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {getLeadFullName(call.lead)}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(call.created_at)}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    <Badge variant={getCallStatusVariant(call.status)} size="sm">
                      {formatCallStatus(call.status)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Call Details Modal */}
      {selectedCall && (
        <CallDetailsModal
          call={selectedCall}
          isOpen={!!selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </>
  );
}
