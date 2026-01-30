/**
 * ProfitabilityWidget Component
 * Compact widget showing key profitability metrics with color-coded status
 */

'use client';

import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/api/quotes';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Percent,
  Eye,
} from 'lucide-react';
import { validateProfitability } from '@/lib/api/profitability';
import type { ProfitabilityValidation } from '@/lib/types/quotes';
import { ProfitabilityAnalysisModal } from './ProfitabilityAnalysisModal';

interface ProfitabilityWidgetProps {
  quoteId: string;
  quoteTotals?: {
    subtotal: number;
    discount: number;
    total: number;
    cost?: number;
  };
  className?: string;
  onRefresh?: () => void;
}

export function ProfitabilityWidget({
  quoteId,
  quoteTotals,
  className = '',
  onRefresh,
}: ProfitabilityWidgetProps) {
  const [validation, setValidation] = useState<ProfitabilityValidation | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  const loadValidation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await validateProfitability(quoteId);
      setValidation(data);
    } catch (err: any) {
      console.error('Failed to load profitability:', err);
      setError(err.message || 'Failed to load profitability data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadValidation();
  }, [quoteId, quoteTotals]);

  const getStatusConfig = () => {
    if (!validation) {
      return {
        label: 'Unknown',
        variant: 'neutral' as const,
        bgColor: 'bg-gray-50 dark:bg-gray-800',
        borderColor: 'border-gray-200 dark:border-gray-700',
        textColor: 'text-gray-900 dark:text-gray-100',
        icon: AlertTriangle,
        iconColor: 'text-gray-500',
      };
    }

    const margin = validation.margin_percent;
    const { minimum, target } = validation.thresholds; // API uses "minimum" and "target", not "minimum_margin"

    if (!validation.is_valid || margin < minimum) { // API uses "is_valid", not "is_profitable"
      return {
        label: 'Unprofitable',
        variant: 'danger' as const,
        bgColor: 'bg-red-50 dark:bg-red-900/10',
        borderColor: 'border-red-200 dark:border-red-800',
        textColor: 'text-red-900 dark:text-red-100',
        icon: TrendingDown,
        iconColor: 'text-red-600 dark:text-red-400',
      };
    } else if (margin < target) {
      return {
        label: 'Low Margin',
        variant: 'warning' as const,
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/10',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        textColor: 'text-yellow-900 dark:text-yellow-100',
        icon: AlertTriangle,
        iconColor: 'text-yellow-600 dark:text-yellow-400',
      };
    } else {
      return {
        label: 'Profitable',
        variant: 'success' as const,
        bgColor: 'bg-green-50 dark:bg-green-900/10',
        borderColor: 'border-green-200 dark:border-green-800',
        textColor: 'text-green-900 dark:text-green-100',
        icon: TrendingUp,
        iconColor: 'text-green-600 dark:text-green-400',
      };
    }
  };

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Profitability Analysis
          </h3>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadValidation}
          className="mt-4 w-full"
        >
          Retry
        </Button>
      </Card>
    );
  }

  if (!validation) {
    return null;
  }

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <>
      <Card className={`${className}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Profitability Analysis
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-4">
          {/* Primary Metrics */}
          <div className="grid grid-cols-1 gap-4">
            {/* Margin Percentage */}
            <div
              className={`p-3 md:p-4 ${statusConfig.bgColor} border ${statusConfig.borderColor} rounded-lg`}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div
                  className={`p-2 ${statusConfig.bgColor} rounded-lg border ${statusConfig.borderColor} flex-shrink-0`}
                >
                  <Percent
                    className={`w-4 h-4 md:w-5 md:h-5 ${statusConfig.iconColor}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xl md:text-2xl font-bold ${statusConfig.textColor} truncate`}
                  >
                    {validation.margin_percent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Profit Margin
                  </p>
                </div>
              </div>
            </div>

            {/* Profit Amount */}
            <div
              className={`p-3 md:p-4 ${statusConfig.bgColor} border ${statusConfig.borderColor} rounded-lg`}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div
                  className={`p-2 ${statusConfig.bgColor} rounded-lg border ${statusConfig.borderColor} flex-shrink-0`}
                >
                  <StatusIcon
                    className={`w-4 h-4 md:w-5 md:h-5 ${statusConfig.iconColor}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xl md:text-2xl font-bold ${statusConfig.textColor} break-words`}
                  >
                    {formatMoney(validation.financial_summary.gross_profit)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Profit Amount
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Thresholds */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Target Margin:
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {validation.thresholds.target}%
              </span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-600 dark:text-gray-400">
                Minimum Margin:
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {validation.thresholds.minimum}%
              </span>
            </div>
          </div>

          {/* Warnings */}
          {validation.warnings && validation.warnings.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <p
                      key={index}
                      className="text-sm text-yellow-800 dark:text-yellow-200"
                    >
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* View Details Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnalysisModal(true)}
            className="w-full"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Detailed Analysis
          </Button>

          {/* Status Badge */}
          <div className="flex justify-center pt-2">
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
        </div>
      </Card>

      {/* Analysis Modal */}
      {showAnalysisModal && (
        <ProfitabilityAnalysisModal
          quoteId={quoteId}
          isOpen={showAnalysisModal}
          onClose={() => setShowAnalysisModal(false)}
        />
      )}
    </>
  );
}

export default ProfitabilityWidget;
