/**
 * CommunicationEventCard Component
 * Displays a single communication event in a card format
 * Features:
 * - Recipient information
 * - Subject/content preview
 * - Status badge
 * - Provider name
 * - Timeline (sent, delivered, opened, clicked)
 * - Related entity link
 * - Error message (if failed)
 * - Actions (View Details, Resend)
 * - Responsive design
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  Phone,
  MessageSquare,
  Eye,
  MousePointer,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Clock,
  Check,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { CommunicationEvent } from '@/lib/types/communication';
import { format } from 'date-fns';
import { resendEmail } from '@/lib/api/communication';
import { toast } from 'react-hot-toast';

interface CommunicationEventCardProps {
  event: CommunicationEvent;
  onResendSuccess?: () => void;
  onViewDetails?: () => void;
}

export function CommunicationEventCard({ event, onResendSuccess, onViewDetails }: CommunicationEventCardProps) {
  const [isResending, setIsResending] = useState(false);

  // Get channel icon
  const getChannelIcon = () => {
    switch (event.channel) {
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'sms':
        return <MessageSquare className="h-5 w-5" />;
      case 'whatsapp':
        return <Phone className="h-5 w-5" />;
      default:
        return <Mail className="h-5 w-5" />;
    }
  };

  // Get recipient display
  const getRecipient = () => {
    if (event.channel === 'email') {
      return event.to_email || 'Unknown';
    }
    return event.to_phone || 'Unknown';
  };

  // Handle resend
  const handleResend = async () => {
    try {
      setIsResending(true);
      await resendEmail(event.id);
      toast.success('Email queued for resend');
      onResendSuccess?.();
    } catch (error: any) {
      console.error('Failed to resend email:', error);
      toast.error(error?.response?.data?.message || 'Failed to resend email');
    } finally {
      setIsResending(false);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return '-';
    return format(new Date(timestamp), 'MMM d, h:mm a');
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Channel Icon */}
          <div className="flex-shrink-0 mt-1 text-gray-400 dark:text-gray-500">
            {getChannelIcon()}
          </div>

          {/* Recipient & Subject */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {getRecipient()}
            </p>
            {event.subject && (
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">
                {event.subject}
              </p>
            )}
            {event.cc_emails && event.cc_emails.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                CC: {event.cc_emails.join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <StatusBadge status={event.status} />
      </div>

      {/* Provider & Created Info */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <span className="font-medium">
          via {event.provider_id ? 'Provider' : 'Unknown'}
        </span>
        <span>•</span>
        <span>{formatTimestamp(event.created_at)}</span>
      </div>

      {/* Timeline */}
      {event.status !== 'pending' && event.status !== 'failed' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <TimelineItem
            icon={<Check className="h-3 w-3" />}
            label="Sent"
            timestamp={event.sent_at}
          />
          <TimelineItem
            icon={<Check className="h-3 w-3" />}
            label="Delivered"
            timestamp={event.delivered_at}
          />
          <TimelineItem
            icon={<Eye className="h-3 w-3" />}
            label="Opened"
            timestamp={event.opened_at}
          />
          <TimelineItem
            icon={<MousePointer className="h-3 w-3" />}
            label="Clicked"
            timestamp={event.clicked_at}
          />
        </div>
      )}

      {/* Error Message */}
      {event.error_message && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-3">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{event.error_message}</p>
        </div>
      )}

      {/* Related Entity */}
      {event.related_entity_type && event.related_entity_id && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
          <ExternalLink className="h-4 w-4" />
          <span className="capitalize">{event.related_entity_type}</span>
          <span>#{event.related_entity_id}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onViewDetails}
          className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          View Details
        </button>

        {event.status === 'failed' && event.channel === 'email' && (
          <button
            onClick={handleResend}
            disabled={isResending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
            {isResending ? 'Resending...' : 'Resend'}
          </button>
        )}
      </div>
    </div>
  );
}

// Helper component for timeline items
function TimelineItem({
  icon,
  label,
  timestamp,
}: {
  icon: React.ReactNode;
  label: string;
  timestamp: string | null | undefined;
}) {
  const hasValue = !!timestamp;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <div className={`${hasValue ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {timestamp ? format(new Date(timestamp), 'h:mm a') : '-'}
      </span>
    </div>
  );
}

export default CommunicationEventCard;
