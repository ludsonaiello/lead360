/**
 * QuoteStatsWidget Component
 * Collapsible statistics widget showing quote metrics and status breakdown
 */

'use client';

import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import { formatMoney, formatPercent } from '@/lib/api/quotes';
import {
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  TrendingUp,
  Target,
  CheckCircle2,
  Send,
  Eye,
  ThumbsUp,
  XCircle,
  Ban,
  Shield,
  Mail,
  MailCheck,
  MailOpen,
  MailX,
  Download,
  PlayCircle,
  CheckCircle,
} from 'lucide-react';
import type { QuoteStatistics } from '@/lib/types/quotes';

interface QuoteStatsWidgetProps {
  stats: QuoteStatistics | null;
  loading?: boolean;
  className?: string;
}

export function QuoteStatsWidget({
  stats,
  loading = false,
  className = '',
}: QuoteStatsWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card className={`${className}`}>
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Quote Statistics
          </h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-6">
          {/* Primary Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Quotes */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.total_quotes}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Total Quotes
                  </p>
                </div>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatMoney(stats.total_revenue || 0)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Total Revenue
                  </p>
                </div>
              </div>
            </div>

            {/* Average Quote Value */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatMoney(stats.avg_quote_value || 0)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Avg Quote Value
                  </p>
                </div>
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="p-4 bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                  <Target className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatPercent(stats.conversion_rate)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Conversion Rate
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Amount Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Amount Sent */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Send className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatMoney(stats.amount_sent || 0)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Amount Sent
                  </p>
                </div>
              </div>
            </div>

            {/* Amount Pending Approval */}
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatMoney(stats.amount_pending_approval || 0)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Amount Pending
                  </p>
                </div>
              </div>
            </div>

            {/* Amount Denied */}
            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatMoney(stats.amount_denied || 0)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Amount Denied
                  </p>
                </div>
              </div>
            </div>

            {/* Amount Lost */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Ban className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatMoney(stats.amount_lost || 0)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Amount Lost
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Status Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Draft */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <FileText className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.draft || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Draft</p>
                </div>
              </div>

              {/* Pending Approval */}
              <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <Shield className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.pending_approval || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Pending</p>
                </div>
              </div>

              {/* Ready */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.ready || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Ready</p>
                </div>
              </div>

              {/* Sent */}
              <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                <Send className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.sent || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Sent</p>
                </div>
              </div>

              {/* Delivered */}
              <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <MailCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.delivered || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Delivered</p>
                </div>
              </div>

              {/* Opened (Email) */}
              <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                <MailOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.opened || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Email Opened</p>
                </div>
              </div>

              {/* Read */}
              <div className="flex items-center gap-3 p-3 bg-cyan-50 dark:bg-cyan-900/10 rounded-lg border border-cyan-200 dark:border-cyan-800">
                <Eye className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.read || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Read</p>
                </div>
              </div>

              {/* Downloaded */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.downloaded || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Downloaded</p>
                </div>
              </div>

              {/* Email Failed */}
              <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800">
                <MailX className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.email_failed || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Failed</p>
                </div>
              </div>

              {/* Denied */}
              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.denied || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Denied</p>
                </div>
              </div>

              {/* Lost */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <Ban className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.lost || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Lost</p>
                </div>
              </div>

              {/* Approved */}
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                <ThumbsUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.approved || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Approved</p>
                </div>
              </div>

              {/* Started */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                <PlayCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.started || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Started</p>
                </div>
              </div>

              {/* Concluded */}
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stats.by_status?.concluded || 0}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Concluded</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default QuoteStatsWidget;
