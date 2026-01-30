/**
 * Quote Email History Component
 * Shows timeline of all emails sent for a specific quote
 * Displays status, recipients, subject, and delivery tracking
 */

'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  MousePointer,
  AlertCircle,
  Send,
  Loader2,
} from 'lucide-react';
import { getCommunicationHistory } from '@/lib/api/communication';
import type { CommunicationEvent } from '@/lib/types/communication';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface QuoteEmailHistoryProps {
  quoteId: string;
}

export function QuoteEmailHistory({ quoteId }: QuoteEmailHistoryProps) {
  const [emails, setEmails] = useState<CommunicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEmails();
  }, [quoteId]);

  const loadEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCommunicationHistory({
        related_entity_type: 'quote',
        related_entity_id: quoteId,
        channel: 'email',
        limit: 100, // Get all emails for this quote
      });
      setEmails(response.data);
    } catch (err: any) {
      console.error('Failed to load email history:', err);
      setError(err.message || 'Failed to load email history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'sent':
        return <Send className="w-4 h-4 text-blue-600" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
      case 'bounced':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Mail className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'yellow';
      case 'sent':
        return 'blue';
      case 'delivered':
        return 'green';
      case 'failed':
      case 'bounced':
        return 'red';
      default:
        return 'gray';
    }
  };

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return null;
    try {
      return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">
              Failed to Load Email History
            </h4>
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-4">
          <Mail className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No Emails Sent Yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          When you send this quote, email history will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {emails.map((email, index) => (
        <Card key={email.id} className="p-6">
          <div className="space-y-4">
            {/* Header: Subject and Status */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {email.subject || 'No Subject'}
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">To:</span>
                    <span>{email.to_email}</span>
                  </div>
                  {email.cc_emails && email.cc_emails.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">CC:</span>
                      <span>{email.cc_emails.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusColor(email.status) as any}>
                  {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                </Badge>
              </div>
            </div>

            {/* Timeline */}
            <div className="border-l-2 border-gray-200 dark:border-gray-700 ml-2 pl-6 space-y-3">
              {/* Created/Queued */}
              <div className="relative">
                <div className="absolute -left-[1.6rem] w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <Clock className="w-2.5 h-2.5 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Queued</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    {formatTimestamp(email.created_at)}
                  </span>
                </div>
              </div>

              {/* Sent */}
              {email.sent_at && (
                <div className="relative">
                  <div className="absolute -left-[1.6rem] w-4 h-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Send className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">Sent</span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">
                      {formatTimestamp(email.sent_at)}
                    </span>
                  </div>
                </div>
              )}

              {/* Delivered */}
              {email.delivered_at && (
                <div className="relative">
                  <div className="absolute -left-[1.6rem] w-4 h-4 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">Delivered</span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">
                      {formatTimestamp(email.delivered_at)}
                    </span>
                  </div>
                </div>
              )}

              {/* Opened */}
              {email.opened_at && (
                <div className="relative">
                  <div className="absolute -left-[1.6rem] w-4 h-4 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                    <Eye className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">Opened</span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">
                      {formatTimestamp(email.opened_at)}
                    </span>
                  </div>
                </div>
              )}

              {/* Clicked */}
              {email.clicked_at && (
                <div className="relative">
                  <div className="absolute -left-[1.6rem] w-4 h-4 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                    <MousePointer className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">Clicked</span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">
                      {formatTimestamp(email.clicked_at)}
                    </span>
                  </div>
                </div>
              )}

              {/* Bounced */}
              {email.bounced_at && (
                <div className="relative">
                  <div className="absolute -left-[1.6rem] w-4 h-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <XCircle className="w-2.5 h-2.5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      Bounced {email.bounce_type ? `(${email.bounce_type})` : ''}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">
                      {formatTimestamp(email.bounced_at)}
                    </span>
                  </div>
                </div>
              )}

              {/* Error */}
              {email.error_message && (
                <div className="relative">
                  <div className="absolute -left-[1.6rem] w-4 h-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-2.5 h-2.5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-red-900 dark:text-red-100">Error</span>
                    <p className="text-red-800 dark:text-red-200 mt-1">{email.error_message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Provider Info */}
            {email.provider_message_id && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  <span className="font-medium">Message ID:</span>{' '}
                  <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                    {email.provider_message_id.substring(0, 32)}
                    {email.provider_message_id.length > 32 ? '...' : ''}
                  </code>
                </div>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default QuoteEmailHistory;
