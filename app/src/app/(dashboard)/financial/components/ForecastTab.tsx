/**
 * Cash Flow Forecast Tab — Financial Dashboard
 * Net forecast display, inflows, outflows with period selector
 * API: GET /api/v1/financial/dashboard/forecast
 * Sprint 20, Task 3
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  FileText,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { getDashboardForecast } from '@/lib/api/financial';
import type { ForecastResponse, ForecastInflowItem, ForecastOutflowItem } from '@/lib/types/financial';
import toast from 'react-hot-toast';

// ============================================================================
// Helpers
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const fmtDetailed = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const PERIOD_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

function getNetColor(label: string): { text: string; bg: string; border: string } {
  switch (label) {
    case 'Positive':
      return {
        text: 'text-green-700 dark:text-green-300',
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
      };
    case 'Negative':
      return {
        text: 'text-red-700 dark:text-red-300',
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
      };
    default:
      return {
        text: 'text-gray-700 dark:text-gray-300',
        bg: 'bg-gray-50 dark:bg-gray-800',
        border: 'border-gray-200 dark:border-gray-700',
      };
  }
}

function NetIcon({ label, className }: { label: string; className?: string }) {
  switch (label) {
    case 'Positive':
      return <TrendingUp className={`${className} text-green-500 dark:text-green-400`} />;
    case 'Negative':
      return <TrendingDown className={`${className} text-red-500 dark:text-red-400`} />;
    default:
      return <Minus className={`${className} text-gray-400 dark:text-gray-500`} />;
  }
}

// ============================================================================
// Skeleton Loader
// ============================================================================

function ForecastSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading cash flow forecast">
      {/* Selector skeleton */}
      <div className="flex justify-end">
        <Skeleton width={160} height={44} />
      </div>
      {/* Net forecast card */}
      <Card className="p-6 sm:p-8">
        <Skeleton width={150} height={16} className="mx-auto mb-4" />
        <Skeleton width={200} height={40} className="mx-auto mb-3" />
        <Skeleton width={100} height={20} className="mx-auto mb-6" />
        <div className="flex justify-center gap-8">
          <Skeleton width={120} height={40} />
          <Skeleton width={120} height={40} />
        </div>
      </Card>
      {/* Inflows/Outflows */}
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="p-4 sm:p-5">
          <Skeleton width={200} height={18} className="mb-4" />
          <Skeleton width="100%" height={50} className="mb-2" />
          <Skeleton width="80%" height={50} />
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function ForecastTab() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<number>(30);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboardForecast({ days: periodDays });
      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load cash flow forecast';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  // Loading
  if (loading) {
    return <ForecastSkeleton />;
  }

  // Error
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <AlertTriangle className="h-10 w-10 text-red-400 dark:text-red-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Failed to load forecast
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchForecast}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px] min-w-[44px]"
          >
            Try Again
          </button>
        </div>
      </Card>
    );
  }

  // Empty
  if (!data) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <DollarSign className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            No forecast data yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create invoices and recurring expenses to generate cash flow projections.
          </p>
        </div>
      </Card>
    );
  }

  const {
    expected_inflows,
    expected_outflows,
    net_forecast,
    net_forecast_label,
    forecast_start,
    forecast_end,
  } = data;

  const netColors = getNetColor(net_forecast_label);

  const dateRange = `${new Date(forecast_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(forecast_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-end gap-2">
        <label htmlFor="forecast-period" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Period
        </label>
        <select
          id="forecast-period"
          value={periodDays}
          onChange={(e) => setPeriodDays(Number(e.target.value))}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[44px]"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Net Forecast Hero Card */}
      <Card className={`p-6 sm:p-8 border ${netColors.border} ${netColors.bg}`}>
        <div className="text-center">
          <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Net Forecast
          </p>
          <div className="flex items-center justify-center gap-3 mb-2">
            <NetIcon label={net_forecast_label} className="h-8 w-8 sm:h-10 sm:w-10" />
            <p className={`text-3xl sm:text-5xl font-bold ${netColors.text} break-all`}>
              {net_forecast >= 0 ? `+${fmt(net_forecast)}` : fmt(net_forecast)}
            </p>
          </div>
          <Badge
            variant={net_forecast_label === 'Positive' ? 'success' : net_forecast_label === 'Negative' ? 'danger' : 'neutral'}
            label={net_forecast_label}
            className="mb-4"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
            {dateRange}
          </p>

          {/* Inflows / Outflows summary row */}
          <div className="flex items-center justify-center gap-6 sm:gap-12">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <ArrowDownCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Inflows</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">
                {fmtDetailed(expected_inflows.total)}
              </p>
            </div>
            <div className="w-px h-10 bg-gray-200 dark:bg-gray-600" aria-hidden="true" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <ArrowUpCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Outflows</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400">
                {fmtDetailed(expected_outflows.total)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Expected Inflows */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <ArrowDownCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
          Expected Inflows
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
            ({fmtDetailed(expected_inflows.total)})
          </span>
        </h2>

        {expected_inflows.items.length === 0 ? (
          <div className="text-center py-6">
            <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No expected inflows in the next {periodDays} days.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {expected_inflows.items.map((item: ForecastInflowItem) => {
              const dueStr = new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <div
                  key={`inflow-${item.invoice_id}-${item.due_date}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-green-500 dark:text-green-400 shrink-0" />
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      Invoice <span className="font-semibold">{item.invoice_number}</span>
                    </span>
                    {item.project_name && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {item.project_name}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                      {fmtDetailed(item.amount_due)}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Due: {dueStr}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Expected Outflows */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <ArrowUpCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
          Expected Outflows
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
            ({fmtDetailed(expected_outflows.total)})
          </span>
        </h2>

        {expected_outflows.items.length === 0 ? (
          <div className="text-center py-6">
            <RefreshCw className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No expected outflows in the next {periodDays} days.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {expected_outflows.items.map((item: ForecastOutflowItem) => {
              const dueStr = new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <div
                  key={`outflow-${item.rule_id}-${item.due_date}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <RefreshCw className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {item.rule_name}
                    </span>
                    {item.category_name && (
                      <Badge variant="gray" label={item.category_name} />
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                      {fmtDetailed(item.amount)}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Due: {dueStr}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
