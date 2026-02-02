/**
 * Change Order History Timeline Component
 * Displays chronological timeline of change order events
 * Backend: GET /quotes/:parentQuoteId/change-orders/history
 * Returns: ChangeOrderHistoryResponse with timeline events
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  getChangeOrderHistory,
  getStatusLabel,
  getStatusBadgeVariant,
} from '@/lib/api/change-orders';
import type {
  ChangeOrderHistoryResponse,
  ChangeOrderHistoryEvent,
} from '@/lib/types/quotes';
import toast from 'react-hot-toast';

interface ChangeOrderHistoryTimelineProps {
  parentQuoteId: string;
  parentQuoteNumber: string;
  className?: string;
}

export function ChangeOrderHistoryTimeline({
  parentQuoteId,
  parentQuoteNumber,
  className = '',
}: ChangeOrderHistoryTimelineProps) {
  const [history, setHistory] = useState<ChangeOrderHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [parentQuoteId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getChangeOrderHistory(parentQuoteId);
      setHistory(data);
    } catch (error: any) {
      console.error('Failed to fetch change order history:', error);
      toast.error('Could not load change order history');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number): string => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'change_order_created':
        return <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'change_order_approved':
        return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'change_order_rejected':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'change_order_created':
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
      case 'change_order_approved':
        return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
      case 'change_order_rejected':
        return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-700';
    }
  };

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      </Card>
    );
  }

  if (!history || history.timeline.length === 0) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center py-8">
          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            No change order history yet
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Events will appear here as change orders are created, approved, or rejected
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <div>
          <h3 className="text-lg font-bold">Change Order History</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {history.total_events} event{history.total_events !== 1 ? 's' : ''} • {parentQuoteNumber}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {history.timeline.map((event: ChangeOrderHistoryEvent, index: number) => {
          const isFirst = index === 0;
          const isLast = index === history.timeline.length - 1;
          const isIncrease = event.amount >= 0;

          return (
            <div key={event.id} className="relative">
              {/* Timeline Line */}
              {!isLast && (
                <div className="absolute left-[18px] top-[36px] bottom-[-16px] w-0.5 bg-gray-300 dark:bg-gray-600" />
              )}

              {/* Event Card */}
              <div className={`flex gap-4 p-4 rounded-lg border ${getEventColor(event.event_type)}`}>
                {/* Icon */}
                <div className="flex-shrink-0 w-9 h-9 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center border-2 border-current">
                  {getEventIcon(event.event_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900 dark:text-gray-100">
                          {event.change_order_number}
                        </span>
                        <Badge variant={getStatusBadgeVariant(event.status) as any}>
                          {getStatusLabel(event.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {event.description}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isIncrease ? (
                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className={`font-bold text-sm ${
                        isIncrease
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {isIncrease ? '+' : '-'}{formatMoney(event.amount)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {formatDateTime(event.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default ChangeOrderHistoryTimeline;
