/**
 * Transcription Provider Card Component
 * Sprint 4: Transcription Monitoring
 * Displays provider statistics with health status indicators
 */

'use client';

import React from 'react';
import { TranscriptionProvider } from '@/lib/types/twilio-admin';
import { formatCurrency } from '@/lib/utils/currency-formatter';
import { TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface TranscriptionProviderCardProps {
  provider: TranscriptionProvider;
}

export function TranscriptionProviderCard({ provider }: TranscriptionProviderCardProps) {
  const successRate = parseFloat(provider.statistics.success_rate);
  const isHealthy = successRate >= 98;
  const isDegraded = successRate >= 95 && successRate < 98;
  const isDown = successRate < 95;

  const statusConfig = isHealthy
    ? {
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
        icon: CheckCircle2,
      }
    : isDegraded
    ? {
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        icon: AlertTriangle,
      }
    : {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        icon: XCircle,
      };

  const StatusIcon = statusConfig.icon;
  const usagePercentage = (provider.usage_current / provider.usage_limit) * 100;

  return (
    <div
      className={`
        rounded-lg border ${statusConfig.borderColor} ${statusConfig.bgColor}
        p-4 transition-all hover:shadow-md
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
          {provider.provider_name}
        </h3>
        {provider.is_system_default && (
          <span className="px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-800">
            System Default
          </span>
        )}
      </div>

      {/* Success Rate - Large Display */}
      <div className="mb-3">
        <div className={`text-3xl font-bold ${statusConfig.color} mb-1 flex items-center gap-2`}>
          {provider.statistics.success_rate}
          {isHealthy ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <TrendingDown className="h-5 w-5" />
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Success Rate</p>
      </div>

      {/* Statistics Grid */}
      <div className="space-y-2 text-xs mb-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Total:</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {provider.statistics.total_transcriptions.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Successful:</span>
          <span className="font-semibold text-green-600 dark:text-green-400">
            {provider.statistics.successful.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Failed:</span>
          <span className="font-semibold text-red-600 dark:text-red-400">
            {provider.statistics.failed.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400">Cost/min:</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(provider.cost_per_minute)}
          </span>
        </div>
      </div>

      {/* Usage Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600 dark:text-gray-400">Usage:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {provider.usage_current.toLocaleString()} / {provider.usage_limit.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              usagePercentage >= 90
                ? 'bg-red-600 dark:bg-red-500'
                : usagePercentage >= 75
                ? 'bg-yellow-600 dark:bg-yellow-500'
                : 'bg-blue-600 dark:bg-blue-500'
            }`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
          {usagePercentage.toFixed(1)}% used
        </div>
      </div>

      {/* Status Indicator */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">Status:</span>
          <span
            className={`
              px-2 py-1 rounded-full font-medium
              ${
                provider.status === 'active'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : provider.status === 'inactive'
                  ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }
            `}
          >
            {provider.status.charAt(0).toUpperCase() + provider.status.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TranscriptionProviderCard;
