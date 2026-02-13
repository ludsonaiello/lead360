/**
 * Call Record Card Component
 * Mobile-optimized card view for call records
 *
 * Features:
 * - Lead name and phone
 * - Direction and status badges
 * - Duration display
 * - Date/time
 * - Recording play button
 * - Click to open details modal
 * - Dark mode support
 */

'use client';

import React from 'react';
import { format } from 'date-fns';
import {
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Calendar,
  Play,
  User,
  Phone,
} from 'lucide-react';

import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

import type { CallRecord } from '@/lib/types/twilio-tenant';

interface CallRecordCardProps {
  call: CallRecord;
  onClick: () => void;
}

// Helper functions (duplicated from page for component independence)
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

function getCallStatusVariant(status: string): 'success' | 'danger' | 'warning' | 'orange' | 'gray' | 'info' {
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

function getCallDirectionVariant(direction: string): 'info' | 'purple' {
  return direction === 'inbound' ? 'info' : 'purple';
}

function formatCallDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getLeadFullName(lead: CallRecord['lead']): string {
  if (!lead) return 'Unknown';
  return `${lead.first_name} ${lead.last_name}`.trim() || 'Unknown';
}

export function CallRecordCard({ call, onClick }: CallRecordCardProps) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:shadow-md transition-shadow duration-200 active:scale-98"
    >
      <div className="p-4 space-y-3">
        {/* Header: Lead Name and Direction */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`p-2 rounded-full flex-shrink-0 ${
              call.direction === 'inbound'
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'bg-purple-100 dark:bg-purple-900'
            }`}>
              {call.direction === 'inbound' ? (
                <PhoneIncoming className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <PhoneOutgoing className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {getLeadFullName(call.lead)}
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {call.lead?.phone || (call.direction === 'inbound' ? call.from_number : call.to_number)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Badges: Direction and Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={getCallDirectionVariant(call.direction)}>
            {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
          </Badge>
          <Badge variant={getCallStatusVariant(call.status)}>
            {formatCallStatus(call.status)}
          </Badge>
          {call.recording_url && (
            <Badge variant="green">
              <Play className="w-3 h-3 mr-1" />
              Recording
            </Badge>
          )}
        </div>

        {/* Call Reason (if available) */}
        {call.call_reason && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {call.call_reason}
          </p>
        )}

        {/* Footer: Duration and Date */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatCallDuration(call.recording_duration_seconds)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{format(new Date(call.created_at), 'MMM d, h:mm a')}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
