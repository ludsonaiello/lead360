/**
 * Profit & Loss Tab — Financial Dashboard
 * Year/month selectors, annual summary, monthly breakdown table,
 * expense category bars, tax summary, CSV export
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Download,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { getDashboardPL, exportPL } from '@/lib/api/financial';
import type { PLSummary, PLMonth, PLExpenseByCategory } from '@/lib/types/financial';
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

const fmtPercent = (value: number | null): string => {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)}%`;
};

const fmtCompact = (amount: number): string => {
  if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return fmt(amount);
};

const signedFmt = (amount: number): string => {
  const formatted = fmtDetailed(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
};

const MONTH_OPTIONS = [
  { value: '0', label: 'All Year' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

// ============================================================================
// Sub-components
// ============================================================================

function PLSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading P&L data">
      {/* Controls skeleton */}
      <div className="flex flex-wrap gap-3">
        <Skeleton width={120} height={44} />
        <Skeleton width={150} height={44} />
        <Skeleton width={140} height={36} />
        <Skeleton width={120} height={44} className="ml-auto" />
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 sm:p-5">
            <Skeleton width="50%" height={14} className="mb-3" />
            <Skeleton width="70%" height={28} className="mb-2" />
            <Skeleton width="40%" height={12} />
          </Card>
        ))}
      </div>
      {/* Table skeleton */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Skeleton width={200} height={20} />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-200 dark:border-gray-700 last:border-0">
            <div className="grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} height={16} />
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ExpenseCategoryBars({ categories, totalExpenses }: { categories: PLExpenseByCategory[]; totalExpenses: number }) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        No expense categories for this period.
      </p>
    );
  }

  const sorted = [...categories].sort((a, b) => b.total - a.total);
  const maxTotal = sorted[0]?.total || 1;

  return (
    <div className="space-y-3">
      {sorted.map((cat) => {
        const pct = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
        const barWidth = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
        return (
          <div key={cat.category_id} className="group">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700 dark:text-gray-300 font-medium truncate mr-2">
                {cat.category_name}
              </span>
              <span className="text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">
                {fmtDetailed(cat.total)} ({pct.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-blue-500 dark:bg-blue-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${barWidth}%` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${cat.category_name}: ${pct.toFixed(0)}%`}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {cat.entry_count} {cat.entry_count === 1 ? 'entry' : 'entries'} · {cat.classification === 'cost_of_goods_sold' ? 'COGS' : 'OpEx'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function MonthDetailView({ month }: { month: PLMonth }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Income</p>
          <p className="mt-2 text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{fmtDetailed(month.income.total)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{month.income.invoice_count} invoice{month.income.invoice_count !== 1 ? 's' : ''}</p>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expenses</p>
          <p className="mt-2 text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">{fmtDetailed(month.expenses.total)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            COGS: {fmtDetailed(month.expenses.by_classification.cost_of_goods_sold)}
          </p>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gross Profit</p>
          <p className={`mt-2 text-lg sm:text-2xl font-bold ${month.gross_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {fmtDetailed(month.gross_profit)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Margin: {fmtPercent(month.gross_margin_percent)}
          </p>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Net Profit</p>
          <p className={`mt-2 text-lg sm:text-2xl font-bold ${month.net_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {fmtDetailed(month.net_profit)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            OpEx: {fmtDetailed(month.expenses.by_classification.operating_expense)}
          </p>
        </Card>
      </div>

      {/* Income by Project */}
      {month.income.by_project.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Income by Project</h3>
          <div className="space-y-2">
            {month.income.by_project.map((proj) => (
              <div key={proj.project_id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{proj.project_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{proj.project_number}</p>
                </div>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400 shrink-0 ml-3 tabular-nums">
                  {fmtDetailed(proj.collected)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Expense Categories */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Expense Categories</h3>
        <ExpenseCategoryBars categories={month.expenses.by_category} totalExpenses={month.expenses.total} />
      </Card>

      {/* COGS vs OpEx Breakdown */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">COGS vs Operating Expenses</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cost of Goods Sold</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {fmtDetailed(month.expenses.by_classification.cost_of_goods_sold)}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Operating Expense</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {fmtDetailed(month.expenses.by_classification.operating_expense)}
            </p>
          </div>
        </div>
      </Card>

      {/* Top Suppliers */}
      {month.expenses.top_suppliers.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Top Suppliers</h3>
          <div className="space-y-2">
            {month.expenses.top_suppliers.map((s) => (
              <div key={s.supplier_id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-sm text-gray-700 dark:text-gray-300">{s.supplier_name}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{fmtDetailed(s.total)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tax Summary */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Tax Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Collected</p>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums">{fmtDetailed(month.tax.tax_collected)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Paid</p>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums">{fmtDetailed(month.tax.tax_paid)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Net Position</p>
            <p className={`text-base font-bold tabular-nums ${
              month.tax.net_tax_position >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {fmtDetailed(month.tax.net_tax_position)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ProfitLossTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(0); // 0 = All Year
  const [includePending, setIncludePending] = useState(false);
  const [data, setData] = useState<PLSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchPL = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { year: number; month?: number; include_pending?: boolean } = { year };
      if (month > 0) params.month = month;
      if (includePending) params.include_pending = true;
      const result = await getDashboardPL(params);
      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load P&L data';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [year, month, includePending]);

  useEffect(() => {
    fetchPL();
  }, [fetchPL]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: { year: number; month?: number; include_pending?: boolean } = { year };
      if (month > 0) params.month = month;
      if (includePending) params.include_pending = true;
      const blob = await exportPL(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = month > 0 ? `pl-${year}-${String(month).padStart(2, '0')}.csv` : `pl-${year}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('P&L report exported successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to export P&L';
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  // Aggregate all expense categories across months for full-year view
  const aggregateCategories = (months: PLMonth[]): PLExpenseByCategory[] => {
    const map = new Map<string, PLExpenseByCategory>();
    for (const m of months) {
      for (const cat of m.expenses.by_category) {
        const existing = map.get(cat.category_id);
        if (existing) {
          existing.total += cat.total;
          existing.entry_count += cat.entry_count;
        } else {
          map.set(cat.category_id, { ...cat });
        }
      }
    }
    return Array.from(map.values());
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Year Selector */}
        <div>
          <label htmlFor="pl-year" className="sr-only">Year</label>
          <select
            id="pl-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[44px]"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Month Selector */}
        <div>
          <label htmlFor="pl-month" className="sr-only">Month</label>
          <select
            id="pl-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[44px]"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Include Pending Toggle */}
        <ToggleSwitch
          enabled={includePending}
          onChange={setIncludePending}
          label="Include pending"
        />

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={exporting || loading}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Loading */}
      {loading && <PLSkeleton />}

      {/* Error */}
      {error && !loading && (
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <AlertTriangle className="h-10 w-10 text-red-400 dark:text-red-500 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Failed to load P&L data
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={fetchPL}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px]"
            >
              Try Again
            </button>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && data && data.totals.total_income === 0 && data.totals.total_expenses === 0 && (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              No P&L data for {month > 0 ? MONTH_OPTIONS[month].label : ''} {year}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Financial entries recorded for this period will appear here.
            </p>
          </div>
        </Card>
      )}

      {/* P&L Content */}
      {!loading && !error && data && (data.totals.total_income > 0 || data.totals.total_expenses > 0) && (
        <>
          {/* Single Month View */}
          {month > 0 && data.months.length > 0 ? (
            <MonthDetailView month={data.months[0]} />
          ) : (
            /* Full Year View */
            <>
              {/* Annual Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className="p-4 sm:p-5">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Revenue</p>
                  <p className="mt-2 text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 break-all">
                    {fmtDetailed(data.totals.total_income)}
                  </p>
                </Card>
                <Card className="p-4 sm:p-5">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expenses</p>
                  <p className="mt-2 text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400 break-all">
                    {fmtDetailed(data.totals.total_expenses)}
                  </p>
                </Card>
                <Card className="p-4 sm:p-5">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gross Profit</p>
                  <p className={`mt-2 text-lg sm:text-2xl font-bold break-all ${
                    data.totals.total_gross_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {fmtDetailed(data.totals.total_gross_profit)}
                  </p>
                </Card>
                <Card className="p-4 sm:p-5">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Net Profit</p>
                  <p className={`mt-2 text-lg sm:text-2xl font-bold break-all ${
                    data.totals.total_operating_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {fmtDetailed(data.totals.total_operating_profit)}
                  </p>
                </Card>
              </div>

              {/* Monthly Averages & Best/Worst */}
              <Card className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Avg Monthly: Income{' '}
                      <span className="font-semibold text-green-600 dark:text-green-400">{fmtCompact(data.totals.avg_monthly_income)}</span>
                      {' | '}Expense{' '}
                      <span className="font-semibold text-red-600 dark:text-red-400">{fmtCompact(data.totals.avg_monthly_expenses)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {data.totals.best_month && (
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
                        <span className="text-gray-500 dark:text-gray-400">Best:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {data.totals.best_month.month_label}
                        </span>
                        <span className="text-green-600 dark:text-green-400 tabular-nums">
                          ({signedFmt(data.totals.best_month.net_profit)})
                        </span>
                      </div>
                    )}
                    {data.totals.worst_month && data.totals.worst_month.month_label !== data.totals.best_month?.month_label && (
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="text-gray-500 dark:text-gray-400">Worst:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {data.totals.worst_month.month_label}
                        </span>
                        <span className="text-red-600 dark:text-red-400 tabular-nums">
                          ({signedFmt(data.totals.worst_month.net_profit)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Monthly Breakdown Table */}
              <Card className="overflow-hidden">
                <div className="px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Monthly Breakdown
                  </h3>
                </div>

                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                        <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Month</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Income</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Expense</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">COGS</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {data.months.map((m) => {
                        const hasData = m.income.total > 0 || m.expenses.total > 0;
                        return (
                          <tr
                            key={`${m.year}-${m.month}`}
                            className={`${hasData ? '' : 'text-gray-400 dark:text-gray-500'} hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors`}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{m.month_label}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">
                              {m.income.total > 0 ? fmtDetailed(m.income.total) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">
                              {m.expenses.total > 0 ? fmtDetailed(m.expenses.total) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                              {m.expenses.by_classification.cost_of_goods_sold > 0 ? fmtDetailed(m.expenses.by_classification.cost_of_goods_sold) : '—'}
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold tabular-nums ${
                              m.net_profit > 0 ? 'text-green-600 dark:text-green-400' : m.net_profit < 0 ? 'text-red-600 dark:text-red-400' : ''
                            }`}>
                              {hasData ? signedFmt(m.net_profit) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Layout */}
                <div className="sm:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {data.months.filter(m => m.income.total > 0 || m.expenses.total > 0).length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">No monthly data yet.</p>
                  ) : (
                    data.months
                      .filter(m => m.income.total > 0 || m.expenses.total > 0)
                      .map((m) => (
                        <div key={`mobile-${m.year}-${m.month}`} className="p-4">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{m.month_label}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Income</span>
                              <p className="font-medium text-green-600 dark:text-green-400 tabular-nums">{fmtDetailed(m.income.total)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Expense</span>
                              <p className="font-medium text-red-600 dark:text-red-400 tabular-nums">{fmtDetailed(m.expenses.total)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">COGS</span>
                              <p className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">{fmtDetailed(m.expenses.by_classification.cost_of_goods_sold)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Profit</span>
                              <p className={`font-semibold tabular-nums ${
                                m.net_profit > 0 ? 'text-green-600 dark:text-green-400' : m.net_profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                              }`}>
                                {signedFmt(m.net_profit)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </Card>

              {/* Expense Categories (aggregated for full year) */}
              <Card className="p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Expense Categories
                </h3>
                <ExpenseCategoryBars
                  categories={aggregateCategories(data.months)}
                  totalExpenses={data.totals.total_expenses}
                />
              </Card>

              {/* Tax Summary */}
              <Card className="p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Tax Summary</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Collected</p>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {fmtDetailed(data.totals.total_tax_collected)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Paid</p>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {fmtDetailed(data.totals.total_tax_paid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Net Position</p>
                    <p className={`text-base font-bold tabular-nums ${
                      (data.totals.total_tax_collected - data.totals.total_tax_paid) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {fmtDetailed(data.totals.total_tax_collected - data.totals.total_tax_paid)}
                    </p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
