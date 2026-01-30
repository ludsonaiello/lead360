/**
 * ProfitabilityAnalysisModal Component
 * Large modal showing detailed profitability breakdown with cost analysis
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalActions,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatMoney } from '@/lib/api/quotes';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Percent,
} from 'lucide-react';
import { analyzeProfitability } from '@/lib/api/profitability';
import type { ProfitabilityAnalysis } from '@/lib/types/quotes';

interface ProfitabilityAnalysisModalProps {
  quoteId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ProfitabilityAnalysisModal({
  quoteId,
  isOpen,
  onClose,
}: ProfitabilityAnalysisModalProps) {
  const [analysis, setAnalysis] = useState<ProfitabilityAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAnalysis();
    }
  }, [isOpen, quoteId]);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyzeProfitability(quoteId);
      setAnalysis(data);
    } catch (err: any) {
      console.error('Failed to load profitability analysis:', err);
      setError(err.message || 'Failed to load profitability analysis');
    } finally {
      setLoading(false);
    }
  };

  const getMarginBadgeVariant = (
    margin: number
  ): 'success' | 'warning' | 'danger' => {
    if (margin >= 25) return 'success';
    if (margin >= 15) return 'warning';
    return 'danger';
  };

  const getMarginColor = (margin: number): string => {
    if (margin >= 25) return 'text-green-600 dark:text-green-400';
    if (margin >= 15) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title="Profitability Analysis">
      <ModalContent>
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              Loading analysis...
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                  Failed to load analysis
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadAnalysis}
                  className="mt-3"
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && analysis && (
          <div className="space-y-6">
            {/* Overall Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Percent className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Overall Margin
                  </span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {analysis.overall_margin_percent.toFixed(1)}%
                </p>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Quote Total
                  </span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {formatMoney(analysis.quote_total)}
                </p>
              </div>
            </div>

            {/* Low Margin Warning */}
            {analysis.overall_margin_percent < 15 && (
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                      Warning: Very Low Profit Margin
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      This quote has a profit margin of{' '}
                      {analysis.overall_margin_percent.toFixed(1)}%, which is
                      below the minimum recommended threshold. Consider
                      reviewing costs or adjusting pricing.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Markup Settings */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Markup Settings
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Profit
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {analysis.markup_settings.profit_percent}%
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Overhead
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {analysis.markup_settings.overhead_percent}%
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Contingency
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {analysis.markup_settings.contingency_percent}%
                  </p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                    Total Multiplier
                  </p>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    {analysis.markup_settings.total_markup_multiplier.toFixed(4)}x
                  </p>
                </div>
              </div>
            </div>

            {/* Groups Analysis */}
            {analysis.groups_analysis &&
              analysis.groups_analysis.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Groups Analysis
                  </h3>
                  <div className="overflow-x-auto">
                    {/* Desktop Table */}
                    <table className="hidden md:table w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                            Group
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                            Items
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                            Total Cost
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                            Total Price
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                            Margin %
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {analysis.groups_analysis.map((group) => (
                          <tr
                            key={group.group_id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          >
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                              {group.name}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                              {group.item_count}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                              {formatMoney(group.total_cost)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                              {formatMoney(group.total_price)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Badge
                                variant={getMarginBadgeVariant(
                                  group.margin_percent
                                )}
                              >
                                {group.margin_percent.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                      {analysis.groups_analysis.map((group) => (
                        <div
                          key={group.group_id}
                          className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            {group.name}
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">
                                Items:
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {group.item_count}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">
                                Total Cost:
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {formatMoney(group.total_cost)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">
                                Total Price:
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {formatMoney(group.total_price)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400">
                                Margin:
                              </span>
                              <Badge
                                variant={getMarginBadgeVariant(
                                  group.margin_percent
                                )}
                              >
                                {group.margin_percent.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            {/* Summary */}
            {analysis.summary && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Items Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Total Items
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {analysis.summary.total_items}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Healthy
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {analysis.summary.healthy_items}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                      Acceptable
                    </p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {analysis.summary.acceptable_items}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertCircle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        Low Margin
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                      {analysis.summary.low_margin_items}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Critical
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                      {analysis.summary.critical_items}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Item-by-Item Analysis */}
            {analysis.items_analysis && analysis.items_analysis.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Item-by-Item Analysis
                </h3>
                <div className="overflow-x-auto">
                  {/* Desktop Table */}
                  <table className="hidden md:table w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                          Item
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                          Group
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                          Cost
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                          Price
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                          Profit
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                          Margin %
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {analysis.items_analysis.map((item) => (
                        <tr
                          key={item.item_id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {item.title}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {item.group_name}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                            {formatMoney(item.cost)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                            {formatMoney(item.price_before_discount)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                            {formatMoney(item.profit)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-semibold ${getMarginColor(item.margin_percent)}`}
                            >
                              {item.margin_percent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant={
                                item.status === 'healthy'
                                  ? 'success'
                                  : item.status === 'acceptable'
                                    ? 'info'
                                    : item.status === 'low'
                                      ? 'warning'
                                      : 'danger'
                              }
                            >
                              {item.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3">
                    {analysis.items_analysis.map((item) => (
                      <div
                        key={item.item_id}
                        className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {item.title}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {item.group_name}
                            </p>
                          </div>
                          <Badge
                            variant={
                              item.status === 'healthy'
                                ? 'success'
                                : item.status === 'acceptable'
                                  ? 'info'
                                  : item.status === 'low'
                                    ? 'warning'
                                    : 'danger'
                            }
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">
                              Quantity:
                            </span>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {item.quantity} {item.unit}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">
                              Cost:
                            </span>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {formatMoney(item.cost)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">
                              Price:
                            </span>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {formatMoney(item.price_before_discount)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">
                              Profit:
                            </span>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {formatMoney(item.profit)}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-600 dark:text-gray-400">
                              Margin:
                            </span>
                            <p
                              className={`font-semibold ${getMarginColor(item.margin_percent)}`}
                            >
                              {item.margin_percent.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ModalContent>

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default ProfitabilityAnalysisModal;
