'use client';

import React from 'react';
import Card from '@/components/ui/Card';
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Receipt } from 'lucide-react';
import type { ProjectFinancialSummary } from '@/lib/types/projects';
import { formatCurrency } from '@/lib/api/projects';

interface CostSummaryCardProps {
  summary: ProjectFinancialSummary;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  labor: { label: 'Labor', color: 'bg-blue-500' },
  material: { label: 'Materials', color: 'bg-green-500' },
  subcontractor: { label: 'Subcontractor', color: 'bg-purple-500' },
  equipment: { label: 'Equipment', color: 'bg-orange-500' },
  other: { label: 'Other', color: 'bg-gray-500' },
};

export default function CostSummaryCard({ summary }: CostSummaryCardProps) {
  const marginActual = summary.margin_actual;
  const isPositiveMargin = marginActual !== null && marginActual !== undefined && marginActual >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Total Actual Cost */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Costs</span>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(summary.total_actual_cost)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {summary.entry_count} {summary.entry_count === 1 ? 'entry' : 'entries'}
        </p>
      </Card>

      {/* Contract Value */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <BarChart3 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Contract Value</span>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {summary.contract_value !== null ? formatCurrency(summary.contract_value) : '-'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Est. cost: {summary.estimated_cost !== null ? formatCurrency(summary.estimated_cost) : '-'}
        </p>
      </Card>

      {/* Margin */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${
            marginActual === null || marginActual === undefined
              ? 'bg-gray-100 dark:bg-gray-700'
              : isPositiveMargin
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
          }`}>
            {marginActual === null || marginActual === undefined ? (
              <TrendingUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            ) : isPositiveMargin ? (
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Actual Margin</span>
        </div>
        <p className={`text-2xl font-bold ${
          marginActual === null || marginActual === undefined
            ? 'text-gray-900 dark:text-white'
            : isPositiveMargin
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
        }`}>
          {marginActual !== null && marginActual !== undefined ? formatCurrency(marginActual) : '-'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Est. margin: {summary.margin_estimated !== null && summary.margin_estimated !== undefined
            ? formatCurrency(summary.margin_estimated)
            : '-'}
        </p>
      </Card>

      {/* Receipts */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Receipts</span>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {summary.receipt_count ?? 0}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          uploaded for this project
        </p>
      </Card>

      {/* Cost Breakdown */}
      <Card className="p-5 md:col-span-2 xl:col-span-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Cost Breakdown by Category</h4>
        <div className="space-y-3">
          {Object.entries(summary.cost_by_category).map(([key, value]) => {
            const cat = CATEGORY_LABELS[key];
            const percentage = summary.total_actual_cost > 0
              ? (value / summary.total_actual_cost) * 100
              : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-600 dark:text-gray-400">{cat?.label || key}</div>
                <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cat?.color || 'bg-gray-500'}`}
                    style={{ width: `${Math.max(percentage, 0)}%` }}
                  />
                </div>
                <div className="w-28 text-right text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(value)}
                </div>
                <div className="w-12 text-right text-xs text-gray-500 dark:text-gray-400">
                  {percentage.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
