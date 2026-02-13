/**
 * Communication Event Detail Modal
 * Displays detailed information about SMS and Email communications
 */

'use client';

import React from 'react';
import { format } from 'date-fns';
import {
  X,
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  Clock,
  Send,
  Inbox,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  MousePointerClick,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { CommunicationEvent } from '@/lib/types/communication';

interface CommunicationEventModalProps {
  event: CommunicationEvent;
  isOpen: boolean;
  onClose: () => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'delivered':
    case 'sent':
      return CheckCircle;
    case 'failed':
    case 'bounced':
      return XCircle;
    case 'opened':
      return Eye;
    case 'clicked':
      return MousePointerClick;
    default:
      return AlertCircle;
  }
};

const getStatusColor = (status: string): 'success' | 'danger' | 'warning' | 'info' | 'gray' => {
  switch (status) {
    case 'delivered':
    case 'sent':
      return 'success';
    case 'failed':
    case 'bounced':
      return 'danger';
    case 'pending':
      return 'warning';
    case 'opened':
    case 'clicked':
      return 'info';
    default:
      return 'gray';
  }
};

export function CommunicationEventModal({ event, isOpen, onClose }: CommunicationEventModalProps) {
  const isSMS = event.channel === 'sms' || event.channel === 'whatsapp';
  const isEmail = event.channel === 'email';
  const isCall = event.channel === 'call';
  const StatusIcon = getStatusIcon(event.status);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCall ? 'Call Details' : isSMS ? 'SMS Details' : 'Email Details'}
      size="xl"
    >
      <div className="space-y-6">
        {/* Header with Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-full ${
                isCall
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : isSMS
                  ? 'bg-purple-100 dark:bg-purple-900/30'
                  : 'bg-blue-100 dark:bg-blue-900/30'
              }`}
            >
              {isCall ? (
                <Phone className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : isSMS ? (
                event.direction === 'inbound' ? (
                  <Inbox className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                ) : (
                  <Send className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                )
              ) : (
                <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white capitalize">
                {event.direction} {event.channel}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge color={getStatusColor(event.status)}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {event.status}
                </Badge>
                {event.channel === 'whatsapp' && (
                  <Badge color="green">WhatsApp</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Communication Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recipient Info */}
          {isSMS && event.to_phone && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {event.direction === 'outbound' ? 'To' : 'From'}
              </label>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{event.to_phone}</span>
              </div>
            </div>
          )}

          {isEmail && event.to_email && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                To
              </label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{event.to_email}</span>
              </div>
            </div>
          )}

          {/* From Info */}
          {isSMS && event.from_phone && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {event.direction === 'outbound' ? 'From' : 'To'}
              </label>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{event.from_phone}</span>
              </div>
            </div>
          )}

          {isEmail && event.from_email && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                From
              </label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">
                  {event.from_name ? `${event.from_name} <${event.from_email}>` : event.from_email}
                </span>
              </div>
            </div>
          )}

          {/* Created At */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Created
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900 dark:text-white">
                {format(new Date(event.created_at), 'MMM d, yyyy h:mm:ss a')}
              </span>
            </div>
          </div>

          {/* Sent At */}
          {event.sent_at && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sent
              </label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">
                  {format(new Date(event.sent_at), 'MMM d, yyyy h:mm:ss a')}
                </span>
              </div>
            </div>
          )}

          {/* Delivered At */}
          {event.delivered_at && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Delivered
              </label>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-900 dark:text-white">
                  {format(new Date(event.delivered_at), 'MMM d, yyyy h:mm:ss a')}
                </span>
              </div>
            </div>
          )}

          {/* Opened At (Email only) */}
          {event.opened_at && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Opened
              </label>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-500" />
                <span className="text-gray-900 dark:text-white">
                  {format(new Date(event.opened_at), 'MMM d, yyyy h:mm:ss a')}
                </span>
              </div>
            </div>
          )}

          {/* Clicked At (Email only) */}
          {event.clicked_at && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Clicked
              </label>
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-purple-500" />
                <span className="text-gray-900 dark:text-white">
                  {format(new Date(event.clicked_at), 'MMM d, yyyy h:mm:ss a')}
                </span>
              </div>
            </div>
          )}

          {/* Call Duration (Calls only) */}
          {isCall && (event as any).call_duration !== undefined && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Call Duration
              </label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">
                  {(event as any).call_duration}s
                </span>
              </div>
            </div>
          )}

          {/* Call SID (Calls only) */}
          {isCall && (event as any).call_sid && (
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Twilio Call SID
              </label>
              <div className="text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
                {(event as any).call_sid}
              </div>
            </div>
          )}

          {/* Provider Message ID (SMS/Email) */}
          {!isCall && event.provider_message_id && (
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Provider Message ID
              </label>
              <div className="text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
                {event.provider_message_id}
              </div>
            </div>
          )}
        </div>

        {/* Call Recording (Calls only) */}
        {isCall && (event as any).recording_url && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Call Recording
            </label>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <audio
                controls
                src={(event as any).recording_url}
                className="w-full"
                controlsList="download"
              >
                Your browser does not support the audio element.
              </audio>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Duration: {(event as any).call_duration || 0}s</span>
                <a
                  href={(event as any).recording_url}
                  download
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Download Recording
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Subject (Email only) */}
        {isEmail && event.subject && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Subject
            </label>
            <p className="text-gray-900 dark:text-white font-medium">
              {event.subject}
            </p>
          </div>
        )}

        {/* Message Content */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {isSMS ? 'Message' : 'Content'}
          </label>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            {/* Text Body */}
            {event.text_body && (
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {event.text_body}
              </div>
            )}

            {/* HTML Body (Email only) - Show in collapsed details */}
            {isEmail && event.html_body && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  View HTML content
                </summary>
                <div className="mt-2 p-4 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 max-h-96 overflow-auto">
                  <div dangerouslySetInnerHTML={{ __html: event.html_body }} />
                </div>
              </details>
            )}
          </div>
        </div>

        {/* Error Message */}
        {event.error_message && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                  Error
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {event.error_message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CC/BCC (Email only) */}
        {isEmail && (event.cc_emails || event.bcc_emails) && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-3">
            {event.cc_emails && event.cc_emails.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  CC
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {event.cc_emails.join(', ')}
                </p>
              </div>
            )}
            {event.bcc_emails && event.bcc_emails.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  BCC
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {event.bcc_emails.join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default CommunicationEventModal;
