/**
 * CommunicationDetailModal Component
 * Full details modal for communication events
 * Shows: timeline, HTML preview, metadata, webhook events
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusBadge } from './StatusBadge';
import { getCommunicationEvent, resendEmail } from '@/lib/api/communication';
import type { CommunicationEventDetail } from '@/lib/types/communication';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Mail,
  Clock,
  Check,
  Eye,
  MousePointer,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Code,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CommunicationDetailModalProps {
  eventId: string;
  onClose: () => void;
  onResendSuccess?: () => void;
}

export function CommunicationDetailModal({
  eventId,
  onClose,
  onResendSuccess,
}: CommunicationDetailModalProps) {
  const [event, setEvent] = useState<CommunicationEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [showHtml, setShowHtml] = useState(true);
  const [showRawHtml, setShowRawHtml] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        const data = await getCommunicationEvent(eventId);
        setEvent(data);
      } catch (error) {
        console.error('Failed to fetch event details:', error);
        toast.error('Failed to load event details');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  const handleResend = async () => {
    if (!event) return;

    try {
      setIsResending(true);
      await resendEmail(event.id);
      toast.success('Email queued for resend');
      onResendSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to resend email:', error);
      toast.error(error?.response?.data?.message || 'Failed to resend email');
    } finally {
      setIsResending(false);
    }
  };

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return '-';
    return format(new Date(timestamp), 'MMM d, yyyy h:mm:ss a');
  };

  return (
    <Modal isOpen onClose={onClose} title="Communication Details" size="lg">
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : event ? (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {event.to_email || event.to_phone}
                </h3>
              </div>
              {event.subject && (
                <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">{event.subject}</p>
              )}
            </div>
            <StatusBadge status={event.status} />
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <MetadataItem label="Channel" value={event.channel} />
            <MetadataItem label="Direction" value={event.direction} />
            <MetadataItem
              label="Provider"
              value={event.provider ? event.provider.provider_name : 'Unknown'}
            />
            <MetadataItem label="Created" value={formatTimestamp(event.created_at)} />
            {event.from_email && <MetadataItem label="From Email" value={event.from_email} />}
            {event.from_name && <MetadataItem label="From Name" value={event.from_name} />}
            {event.cc_emails && event.cc_emails.length > 0 && (
              <MetadataItem label="CC" value={event.cc_emails.join(', ')} className="col-span-2" />
            )}
            {event.template_key && <MetadataItem label="Template" value={event.template_key} />}
            {event.created_by_user && (
              <MetadataItem
                label="Created By"
                value={`${event.created_by_user.full_name} (${event.created_by_user.email})`}
                className="col-span-2"
              />
            )}
          </div>

          {/* Timeline */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Delivery Timeline
            </h4>
            <div className="space-y-3">
              <TimelineItem
                icon={<Clock className="h-4 w-4" />}
                label="Created"
                timestamp={event.created_at}
                active
              />
              <TimelineItem
                icon={<Check className="h-4 w-4" />}
                label="Sent"
                timestamp={event.sent_at}
                active={!!event.sent_at}
              />
              <TimelineItem
                icon={<Check className="h-4 w-4" />}
                label="Delivered"
                timestamp={event.delivered_at}
                active={!!event.delivered_at}
              />
              <TimelineItem
                icon={<Eye className="h-4 w-4" />}
                label="Opened"
                timestamp={event.opened_at}
                active={!!event.opened_at}
              />
              <TimelineItem
                icon={<MousePointer className="h-4 w-4" />}
                label="Clicked"
                timestamp={event.clicked_at}
                active={!!event.clicked_at}
              />
              {event.bounced_at && (
                <TimelineItem
                  icon={<AlertCircle className="h-4 w-4" />}
                  label={`Bounced (${event.bounce_type || 'unknown'})`}
                  timestamp={event.bounced_at}
                  active
                  error
                />
              )}
            </div>
          </div>

          {/* Error Message */}
          {event.error_message && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                    Error Details
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300">{event.error_message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Related Entity */}
          {event.related_entity_type && event.related_entity_id && (
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">Related to:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                {event.related_entity_type} #{event.related_entity_id}
              </span>
            </div>
          )}

          {/* Email Content */}
          {event.html_body && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Email Content
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowHtml(true)}
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      showHtml
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <FileText className="h-3 w-3 inline mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={() => setShowHtml(false)}
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      !showHtml
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Code className="h-3 w-3 inline mr-1" />
                    Raw HTML
                  </button>
                </div>
              </div>

              {showHtml ? (
                <div
                  className="p-4 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: event.html_body }}
                />
              ) : (
                <pre className="p-4 bg-gray-900 text-gray-100 rounded text-xs max-h-96 overflow-auto">
                  {event.html_body}
                </pre>
              )}
            </div>
          )}

          {/* Text Body */}
          {event.text_body && !showHtml && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Plain Text Version
              </h4>
              <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-sm max-h-64 overflow-auto whitespace-pre-wrap">
                {event.text_body}
              </pre>
            </div>
          )}

          {/* Webhook Events */}
          {event.webhook_events && event.webhook_events.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Webhook Events ({event.webhook_events.length})
              </h4>
              <div className="space-y-2">
                {event.webhook_events.map((webhook) => (
                  <div
                    key={webhook.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {webhook.event_type}
                      </span>
                      {webhook.signature_verified && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
                          Verified
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 dark:text-gray-400">
                      {formatTimestamp(webhook.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
            {event.status === 'failed' && event.channel === 'email' && (
              <Button onClick={handleResend} disabled={isResending}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isResending ? 'animate-spin' : ''}`} />
                {isResending ? 'Resending...' : 'Resend Email'}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// Helper component for metadata items
function MetadataItem({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 break-words">{value}</p>
    </div>
  );
}

// Helper component for timeline items
function TimelineItem({
  icon,
  label,
  timestamp,
  active = false,
  error = false,
}: {
  icon: React.ReactNode;
  label: string;
  timestamp: string | null | undefined;
  active?: boolean;
  error?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex-shrink-0 mt-0.5 ${
          error
            ? 'text-red-600 dark:text-red-400'
            : active
            ? 'text-green-600 dark:text-green-400'
            : 'text-gray-300 dark:text-gray-600'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {timestamp ? format(new Date(timestamp), 'MMM d, yyyy h:mm:ss a') : 'Not yet'}
        </p>
      </div>
    </div>
  );
}

export default CommunicationDetailModal;
