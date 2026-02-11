/**
 * TenantMetricsTable Component
 * Metrics breakdown for tenant communications (updated for nested API structure - Feb 7, 2026)
 */

'use client';

import { Phone, MessageSquare, FileText, TrendingUp, DollarSign } from 'lucide-react';
import type { TenantMetricsResponse } from '@/lib/types/twilio-admin';
import Card from '@/components/ui/Card';

interface TenantMetricsTableProps {
  metrics: TenantMetricsResponse;
}

function MetricRow({ label, value, secondary }: { label: string; value: string | number; secondary?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <div className="text-right">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</div>
        {secondary && <div className="text-xs text-gray-500 dark:text-gray-400">{secondary}</div>}
      </div>
    </div>
  );
}

export function TenantMetricsTable({ metrics }: TenantMetricsTableProps) {
  const transcriptionSuccessRate = parseFloat(metrics.transcriptions?.success_rate || '0') || 0;

  return (
    <div className="space-y-6">
      {/* Call Metrics Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Call Metrics</h3>
        </div>

        <div className="space-y-3">
          <MetricRow label="Total Calls" value={metrics.calls?.total || 0} />
          <MetricRow label="Inbound Calls" value={metrics.calls?.inbound || 0} />
          <MetricRow label="Outbound Calls" value={metrics.calls?.outbound || 0} />
          <MetricRow label="Completed Calls" value={metrics.calls?.completed || 0} />
          <MetricRow label="Failed Calls" value={metrics.calls?.failed || 0} />
          <MetricRow
            label="Average Call Duration"
            value={`${Math.floor((metrics.calls?.average_duration_seconds || 0) / 60)}m ${(metrics.calls?.average_duration_seconds || 0) % 60}s`}
          />
          <MetricRow
            label="Total Call Duration"
            value={`${Math.floor((metrics.calls?.total_duration_minutes || 0) / 60)}h ${(metrics.calls?.total_duration_minutes || 0) % 60}m`}
          />
        </div>
      </div>

      {/* SMS Metrics Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">SMS Metrics</h3>
        </div>

        <div className="space-y-3">
          <MetricRow label="Total SMS" value={metrics.sms?.total || 0} />
          <MetricRow label="Inbound SMS" value={metrics.sms?.inbound || 0} />
          <MetricRow label="Outbound SMS" value={metrics.sms?.outbound || 0} />
          <MetricRow label="Delivered" value={metrics.sms?.delivered || 0} />
          <MetricRow label="Failed" value={metrics.sms?.failed || 0} />
        </div>
      </div>

      {/* WhatsApp Metrics Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">WhatsApp Metrics</h3>
        </div>

        <div className="space-y-3">
          <MetricRow label="Total WhatsApp" value={metrics.whatsapp?.total || 0} />
          <MetricRow label="Inbound" value={metrics.whatsapp?.inbound || 0} />
          <MetricRow label="Outbound" value={metrics.whatsapp?.outbound || 0} />
          <MetricRow label="Delivered" value={metrics.whatsapp?.delivered || 0} />
          <MetricRow label="Failed" value={metrics.whatsapp?.failed || 0} />
        </div>
      </div>

      {/* Transcription Metrics Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transcription Metrics</h3>
        </div>

        <div className="space-y-3">
          <MetricRow label="Total Transcriptions" value={metrics.transcriptions?.total || 0} />
          <MetricRow label="Completed" value={metrics.transcriptions?.completed || 0} />
          <MetricRow label="Failed" value={metrics.transcriptions?.failed || 0} />
          <MetricRow
            label="Average Processing Time"
            value={`${(metrics.transcriptions?.average_processing_time_seconds || 0).toFixed(1)}s`}
          />
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Success Rate</span>
              <span className={`text-lg font-bold ${
                transcriptionSuccessRate >= 95
                  ? 'text-green-600 dark:text-green-400'
                  : transcriptionSuccessRate >= 85
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {metrics.transcriptions?.success_rate || '0%'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cost Breakdown</h3>
        </div>

        <div className="space-y-3">
          <MetricRow label="Calls" value={metrics.costs?.breakdown?.calls || '$0.00'} />
          <MetricRow label="SMS" value={metrics.costs?.breakdown?.sms || '$0.00'} />
          <MetricRow label="WhatsApp" value={metrics.costs?.breakdown?.whatsapp || '$0.00'} />
          <MetricRow label="Transcriptions" value={metrics.costs?.breakdown?.transcriptions || '$0.00'} />
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Estimated Monthly</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {metrics.costs?.estimated_monthly || '$0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
