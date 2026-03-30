/**
 * Accounts Payable Tab — Financial Dashboard
 * Summary cards, subcontractor outstanding, upcoming recurring, crew hours
 * API: GET /api/v1/financial/dashboard/ap
 * Sprint 20, Task 2
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  DollarSign,
  Building2,
  RefreshCw,
  Users,
  Clock,
  Calendar,
  Info,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { getDashboardAP } from '@/lib/api/financial';
import type { APSummary, APSubcontractorDetail, APRecurringUpcoming } from '@/lib/types/financial';
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

const fmtHours = (hours: number): string =>
  hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;

const DAYS_AHEAD_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

// ============================================================================
// Skeleton Loader
// ============================================================================

function APSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading accounts payable">
      {/* Selector skeleton */}
      <div className="flex justify-end">
        <Skeleton width={160} height={44} />
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 sm:p-5">
            <Skeleton width="50%" height={14} className="mb-3" />
            <Skeleton width="70%" height={28} className="mb-2" />
            <Skeleton width="60%" height={12} />
          </Card>
        ))}
      </div>
      {/* Sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-4 sm:p-5">
          <Skeleton width={200} height={18} className="mb-4" />
          <Skeleton width="100%" height={14} className="mb-2" />
          <Skeleton width="80%" height={14} />
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function PayableTab() {
  const [data, setData] = useState<APSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysAhead, setDaysAhead] = useState<number>(30);

  const fetchAP = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboardAP({ days_ahead: daysAhead });
      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load accounts payable data';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [daysAhead]);

  useEffect(() => {
    fetchAP();
  }, [fetchAP]);

  // Loading
  if (loading) {
    return <APSkeleton />;
  }

  // Error
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <AlertTriangle className="h-10 w-10 text-red-400 dark:text-red-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Failed to load accounts payable
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchAP}
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
            No payable data yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add subcontractor invoices or recurring expenses to see accounts payable.
          </p>
        </div>
      </Card>
    );
  }

  const { summary, subcontractor_invoices, recurring_upcoming, crew_hours_summary } = data;

  // Summary cards
  const summaryCards = [
    {
      label: 'Sub Outstanding',
      value: fmt(summary.subcontractor_outstanding),
      subtitle: 'Subcontractor payable',
      color: 'text-orange-600 dark:text-orange-400',
      bgIcon: 'bg-orange-50 dark:bg-orange-900/30',
      icon: Building2,
    },
    {
      label: 'Crew Unpaid',
      value: fmt(summary.crew_unpaid_estimate),
      subtitle: 'Estimated crew cost',
      color: 'text-blue-600 dark:text-blue-400',
      bgIcon: 'bg-blue-50 dark:bg-blue-900/30',
      icon: Users,
    },
    {
      label: 'Recurring',
      value: fmt(summary.recurring_upcoming),
      subtitle: `Next ${daysAhead} days`,
      color: 'text-purple-600 dark:text-purple-400',
      bgIcon: 'bg-purple-50 dark:bg-purple-900/30',
      icon: RefreshCw,
    },
    {
      label: 'Total AP Est.',
      value: fmt(summary.total_ap_estimate),
      subtitle: 'Combined estimate',
      color: 'text-red-600 dark:text-red-400',
      bgIcon: 'bg-red-50 dark:bg-red-900/30',
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Days-Ahead Selector */}
      <div className="flex items-center justify-end gap-2">
        <label htmlFor="ap-days-ahead" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Look-ahead
        </label>
        <select
          id="ap-days-ahead"
          value={daysAhead}
          onChange={(e) => setDaysAhead(Number(e.target.value))}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[44px]"
        >
          {DAYS_AHEAD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${card.bgIcon}`}>
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {card.label}
                  </p>
                </div>
                <p className={`text-lg sm:text-2xl font-bold ${card.color} break-all`}>
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {card.subtitle}
                </p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Subcontractor Outstanding */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-orange-500 dark:text-orange-400" />
          Subcontractor Outstanding
        </h2>

        {subcontractor_invoices.by_subcontractor.length === 0 ? (
          <div className="text-center py-6">
            <Building2 className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No subcontractor invoices outstanding.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Totals row */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-100 dark:border-gray-700">
              <span>{subcontractor_invoices.invoice_count} invoice{subcontractor_invoices.invoice_count !== 1 ? 's' : ''}</span>
              <div className="flex gap-4">
                <span>Pending: {fmtDetailed(subcontractor_invoices.total_pending)}</span>
                <span>Approved: {fmtDetailed(subcontractor_invoices.total_approved)}</span>
              </div>
            </div>
            {/* By subcontractor */}
            {subcontractor_invoices.by_subcontractor.map((sub: APSubcontractorDetail) => (
              <div
                key={sub.subcontractor_id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {sub.subcontractor_name}
                  </span>
                  <Badge variant="neutral" label={`${sub.invoice_count} inv`} />
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 sm:shrink-0">
                  <span>
                    Pending: <span className="font-medium text-amber-600 dark:text-amber-400">{fmtDetailed(sub.total_pending)}</span>
                  </span>
                  <span>
                    Approved: <span className="font-medium text-green-600 dark:text-green-400">{fmtDetailed(sub.total_approved)}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Upcoming Recurring Expenses */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-purple-500 dark:text-purple-400" />
          Upcoming Recurring Expenses
        </h2>

        {recurring_upcoming.length === 0 ? (
          <div className="text-center py-6">
            <RefreshCw className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No recurring expenses due in the next {daysAhead} days.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            {/* Desktop: table-style layout */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-0 text-xs text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-100 dark:border-gray-700 px-4 sm:px-0">
                <span className="font-medium uppercase tracking-wider">Due Date</span>
                <span className="font-medium uppercase tracking-wider">Expense</span>
                <span className="font-medium uppercase tracking-wider text-right">Amount</span>
                <span className="font-medium uppercase tracking-wider text-right">Frequency</span>
              </div>
              {recurring_upcoming.map((item: APRecurringUpcoming) => {
                const dueStr = new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div
                    key={`${item.rule_id}-${item.due_date}`}
                    className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 items-center py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0 px-4 sm:px-0"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-16">
                      {dueStr}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                        {item.rule_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.supplier_name && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.supplier_name}</span>
                        )}
                        {item.category_name && (
                          <Badge variant="gray" label={item.category_name} />
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                      {fmtDetailed(item.amount)}
                    </span>
                    <span className="text-right">
                      <Badge variant="purple" label={FREQUENCY_LABELS[item.frequency] || item.frequency} />
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile: card layout */}
            <div className="sm:hidden space-y-2 px-4">
              {recurring_upcoming.map((item: APRecurringUpcoming) => {
                const dueStr = new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div
                    key={`${item.rule_id}-${item.due_date}-mobile`}
                    className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.rule_name}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {fmtDetailed(item.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{dueStr}</span>
                        {item.category_name && (
                          <>
                            <span>|</span>
                            <span>{item.category_name}</span>
                          </>
                        )}
                      </div>
                      <Badge variant="purple" label={FREQUENCY_LABELS[item.frequency] || item.frequency} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Crew Hours Summary */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          Crew Hours This Month
        </h2>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Regular</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300">
              {fmtHours(crew_hours_summary.total_regular_hours_this_month)}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">Overtime</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-300">
              {fmtHours(crew_hours_summary.total_overtime_hours_this_month)}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Members</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-700 dark:text-gray-300">
              {crew_hours_summary.crew_member_count}
            </p>
          </div>
        </div>

        {/* Note about hourly rates */}
        {crew_hours_summary.note && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {crew_hours_summary.note}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
