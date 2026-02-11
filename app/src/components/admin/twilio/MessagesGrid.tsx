/**
 * MessagesGrid Component
 * Grid display for SMS/WhatsApp messages
 */

'use client';

import { MessageSquare, ArrowDown, ArrowUp, Check, X as XIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { CommunicationEvent } from '@/lib/types/twilio-admin';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface MessagesGridProps {
  messages: CommunicationEvent[];
  onViewDetails: (message: CommunicationEvent) => void;
}

// Helper function to format phone number
function formatPhone(phone: string): string {
  if (!phone) return 'N/A';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// Helper function to format date/time
function formatDateTime(dateString: string): string {
  try {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm');
  } catch {
    return dateString;
  }
}

// Helper function to truncate text
function truncateText(text: string, maxLength: number = 100): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, { bg: string; icon: any }> = {
    delivered: { bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: Check },
    sent: { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Check },
    failed: { bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XIcon },
    undelivered: { bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XIcon },
    queued: { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: null },
    sending: { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: null },
  };

  const statusConfig = statusColors[status] || {
    bg: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    icon: null,
  };
  const Icon = statusConfig.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg}`}>
      {Icon && <Icon className="h-3 w-3" />}
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

// Channel badge component
function ChannelBadge({ channel }: { channel: string }) {
  const colors = {
    sms: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    whatsapp: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[channel as keyof typeof colors] || colors.sms}`}>
      {channel.toUpperCase()}
    </span>
  );
}

export function MessagesGrid({ messages, onViewDetails }: MessagesGridProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No messages found</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Try adjusting your filters to see more results.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {messages.map((message) => (
        <Card
          key={message.id}
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onViewDetails(message)}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {message.tenant?.company_name || 'N/A'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatDateTime(message.created_at)}
              </div>
            </div>
            <ChannelBadge channel={message.channel} />
          </div>

          {/* Status and Direction */}
          <div className="flex items-center gap-2 mb-3">
            <StatusBadge status={message.status} />
            <DirectionBadge direction={message.direction} />
          </div>

          {/* Phone Numbers */}
          <div className="space-y-1 mb-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">From:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatPhone(message.from_phone || '')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">To:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatPhone(message.to_phone || '')}
              </span>
            </div>
          </div>

          {/* Message Preview */}
          {message.text_body && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md mb-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {truncateText(message.text_body, 100)}
              </p>
            </div>
          )}

          {/* Sent By */}
          {message.created_by_user && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Sent by: {message.created_by_user.first_name} {message.created_by_user.last_name}
            </div>
          )}

          {/* View Details Button */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(message);
              }}
              className="w-full"
            >
              View Details
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
