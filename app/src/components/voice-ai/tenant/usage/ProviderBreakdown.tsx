'use client';

// ============================================================================
// ProviderBreakdown Component
// ============================================================================
// Table showing usage breakdown by provider (STT/LLM/TTS)
// ============================================================================

import React from 'react';
import type { ProviderUsageBreakdown } from '@/lib/types/voice-ai';

interface ProviderBreakdownProps {
  providers: ProviderUsageBreakdown[];
  totalEstimatedCost: number;
}

/**
 * Format provider usage based on type
 */
const formatUsage = (provider: ProviderUsageBreakdown): string => {
  switch (provider.provider_type) {
    case 'STT':
      const minutes = Math.ceil((provider.total_seconds || 0) / 60);
      return `${minutes.toLocaleString()} minutes`;
    case 'LLM':
      return `${(provider.total_tokens || 0).toLocaleString()} tokens`;
    case 'TTS':
      return `${(provider.total_characters || 0).toLocaleString()} characters`;
    default:
      return 'N/A';
  }
};

/**
 * Get provider type badge color
 */
const getProviderTypeBadge = (type: 'STT' | 'LLM' | 'TTS') => {
  switch (type) {
    case 'STT':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'LLM':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'TTS':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  }
};

/**
 * ProviderBreakdown Component
 */
export function ProviderBreakdown({
  providers,
  totalEstimatedCost,
}: ProviderBreakdownProps) {
  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Usage Breakdown by Provider
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Detailed breakdown of usage by AI provider type
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Usage
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Estimated Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {providers.map((provider, index) => (
              <tr
                key={provider.provider_id || index}
                className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
              >
                {/* Provider Name */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {provider.provider_key}
                  </div>
                </td>

                {/* Provider Type */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProviderTypeBadge(
                      provider.provider_type
                    )}`}
                  >
                    {provider.provider_type}
                  </span>
                </td>

                {/* Usage */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                  {formatUsage(provider)}
                </td>

                {/* Estimated Cost */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                  ${provider.estimated_cost.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Total */}
          <tfoot className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <td
                colSpan={3}
                className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                Total Estimated Cost
              </td>
              <td className="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                ${totalEstimatedCost.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
