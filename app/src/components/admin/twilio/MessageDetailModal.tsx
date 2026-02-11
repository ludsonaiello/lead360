/**
 * MessageDetailModal Component
 * Detailed view of a single SMS/WhatsApp message
 */

'use client';

import { format } from 'date-fns';
import { MessageSquare, Building2, User, Clock, Send, X } from 'lucide-react';
import Link from 'next/link';
import type { CommunicationEvent } from '@/lib/types/twilio-admin';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface MessageDetailModalProps {
  isOpen: boolean;
  message: CommunicationEvent | null;
  onClose: () => void;
}

// Helper functions
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

function formatDateTime(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm:ss');
  } catch {
    return dateString;
  }
}

// Status badge
function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    undelivered: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    queued: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    sending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };

  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

// Channel badge
function ChannelBadge({ channel }: { channel: string }) {
  const colors = {
    sms: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    whatsapp: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colors[channel as keyof typeof colors] || colors.sms}`}>
      {channel.toUpperCase()}
    </span>
  );
}

// Detail item component
function DetailItem({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="h-5 w-5 text-gray-400 mt-0.5" />}
      <div className="flex-1">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </div>
        <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">{value}</div>
      </div>
    </div>
  );
}

export function MessageDetailModal({ isOpen, message, onClose }: MessageDetailModalProps) {
  if (!message) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Message Details</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Message ID: {message.provider_message_id || message.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Status and Channel Badges */}
        <div className="flex items-center gap-2 mb-6">
          <StatusBadge status={message.status} />
          <ChannelBadge channel={message.channel} />
        </div>

        {/* Message Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <DetailItem
            label="Direction"
            value={
              <span
                className={
                  message.direction === 'inbound'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-green-600 dark:text-green-400'
                }
              >
                {message.direction.charAt(0).toUpperCase() + message.direction.slice(1)}
              </span>
            }
            icon={MessageSquare}
          />
          <DetailItem label="Provider" value={message.provider?.provider_name || 'N/A'} />
          <DetailItem label="From" value={formatPhone(message.from_phone || '')} />
          <DetailItem label="To" value={formatPhone(message.to_phone || '')} />
          <DetailItem label="Sent At" value={formatDateTime(message.sent_at)} icon={Send} />
          <DetailItem label="Delivered At" value={formatDateTime(message.delivered_at)} icon={Clock} />
        </div>

        {/* Message Content */}
        {message.text_body && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Message Content</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {message.text_body}
            </p>
          </div>
        )}

        {/* Tenant Information */}
        {message.tenant && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              <Building2 className="h-4 w-4" />
              Tenant Information
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Company:</span>
                <Link
                  href={`/admin/tenants/${message.tenant_id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  {message.tenant.company_name}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Subdomain:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {message.tenant.subdomain}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sent By User */}
        {message.created_by_user && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              <User className="h-4 w-4" />
              Sent By
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Name:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {message.created_by_user.first_name} {message.created_by_user.last_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Email:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {message.created_by_user.email}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Metadata</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Created</div>
              <div className="text-gray-900 dark:text-gray-100">{formatDateTime(message.created_at)}</div>
            </div>
            {message.provider_id && (
              <div>
                <div className="text-gray-500 dark:text-gray-400">Provider ID</div>
                <div className="text-gray-900 dark:text-gray-100 truncate">{message.provider_id}</div>
              </div>
            )}
          </div>
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </ModalActions>
    </Modal>
  );
}
