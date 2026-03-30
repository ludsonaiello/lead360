/**
 * Accounts Receivable Tab — Financial Dashboard
 * Summary cards, aging buckets, invoice list with overdue highlighting
 * API: GET /api/v1/financial/dashboard/ar
 * Sprint 20, Task 1
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  AlertTriangle,
  Clock,
  DollarSign,
  ExternalLink,
  Filter,
  AlertCircle,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { getDashboardAR } from '@/lib/api/financial';
import type { ARSummary, ARInvoice, InvoiceStatus } from '@/lib/types/financial';
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

const AGING_BUCKET_LABELS: Record<string, string> = {
  current: 'Current',
  days_1_30: '1–30 days',
  days_31_60: '31–60 days',
  days_61_90: '61–90 days',
  days_over_90: '90+ days',
};

const AGING_BUCKET_COLORS: Record<string, string> = {
  current: 'bg-green-500 dark:bg-green-400',
  days_1_30: 'bg-blue-500 dark:bg-blue-400',
  days_31_60: 'bg-yellow-500 dark:bg-yellow-400',
  days_61_90: 'bg-orange-500 dark:bg-orange-400',
  days_over_90: 'bg-red-500 dark:bg-red-400',
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'voided', label: 'Voided' },
];

// ============================================================================
// Skeleton Loader
// ============================================================================

function ARSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading accounts receivable">
      {/* Filter skeleton */}
      <div className="flex gap-4">
        <Skeleton width={160} height={44} />
        <Skeleton width={180} height={44} />
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
      {/* Aging buckets */}
      <Card className="p-4 sm:p-5">
        <Skeleton width={150} height={18} className="mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <Skeleton width={80} height={14} />
            <Skeleton width={`${60 - i * 10}%`} height={24} />
            <Skeleton width={60} height={14} />
          </div>
        ))}
      </Card>
      {/* Invoice list */}
      <Card className="p-4 sm:p-5">
        <Skeleton width={200} height={18} className="mb-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <Skeleton width="40%" height={16} className="mb-2" />
            <Skeleton width="70%" height={14} className="mb-1" />
            <Skeleton width="50%" height={14} />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function ReceivableTab() {
  const [data, setData] = useState<ARSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const fetchAR = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { status?: InvoiceStatus; overdue_only?: boolean } = {};
      if (statusFilter) params.status = statusFilter as InvoiceStatus;
      if (overdueOnly) params.overdue_only = true;
      const result = await getDashboardAR(params);
      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load accounts receivable data';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, overdueOnly]);

  useEffect(() => {
    fetchAR();
  }, [fetchAR]);

  // Loading
  if (loading) {
    return <ARSkeleton />;
  }

  // Error
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <AlertTriangle className="h-10 w-10 text-red-400 dark:text-red-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Failed to load accounts receivable
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchAR}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px] min-w-[44px]"
          >
            Try Again
          </button>
        </div>
      </Card>
    );
  }

  // Empty / no data
  if (!data) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <DollarSign className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            No receivable data yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create invoices from your projects to see accounts receivable.
          </p>
        </div>
      </Card>
    );
  }

  const { summary, aging_buckets, invoices } = data;

  // Compute max for aging bar chart
  const agingValues = Object.values(aging_buckets);
  const maxAging = Math.max(...agingValues, 1);
  const totalAging = agingValues.reduce((a, b) => a + b, 0);

  // Summary cards
  const summaryCards = [
    {
      label: 'Total Invoiced',
      value: fmt(summary.total_invoiced),
      subtitle: `${summary.invoice_count} invoice${summary.invoice_count !== 1 ? 's' : ''}`,
      color: 'text-blue-600 dark:text-blue-400',
      bgIcon: 'bg-blue-50 dark:bg-blue-900/30',
      icon: FileText,
    },
    {
      label: 'Collected',
      value: fmt(summary.total_collected),
      subtitle: summary.total_invoiced > 0
        ? `${((summary.total_collected / summary.total_invoiced) * 100).toFixed(0)}% collected`
        : 'No invoices',
      color: 'text-green-600 dark:text-green-400',
      bgIcon: 'bg-green-50 dark:bg-green-900/30',
      icon: DollarSign,
    },
    {
      label: 'Outstanding',
      value: fmt(summary.total_outstanding),
      subtitle: `Avg ${summary.avg_days_outstanding} days`,
      color: 'text-amber-600 dark:text-amber-400',
      bgIcon: 'bg-amber-50 dark:bg-amber-900/30',
      icon: Clock,
    },
    {
      label: 'Overdue',
      value: fmt(summary.total_overdue),
      subtitle: `${summary.overdue_count} invoice${summary.overdue_count !== 1 ? 's' : ''}`,
      color: summary.overdue_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
      bgIcon: summary.overdue_count > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30',
      icon: AlertCircle,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" aria-hidden="true" />
          <label htmlFor="ar-status-filter" className="sr-only">Filter by status</label>
          <select
            id="ar-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[44px]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <ToggleSwitch
          enabled={overdueOnly}
          onChange={setOverdueOnly}
          label="Overdue Only"
        />
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

      {/* Avg Days Outstanding */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Average Days Outstanding:{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {summary.avg_days_outstanding}
            </span>
          </span>
        </div>
      </Card>

      {/* Aging Buckets */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Aging Buckets
        </h2>
        {totalAging === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No outstanding amounts to display.
          </p>
        ) : (
          <div className="space-y-3">
            {(Object.keys(AGING_BUCKET_LABELS) as Array<keyof typeof aging_buckets>).map((key) => {
              const amount = aging_buckets[key];
              const pct = maxAging > 0 ? (amount / maxAging) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 w-20 sm:w-24 shrink-0 text-right">
                    {AGING_BUCKET_LABELS[key]}
                  </span>
                  <div className="flex-1 h-6 sm:h-7 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    {pct > 0 && (
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${AGING_BUCKET_COLORS[key]}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                        role="progressbar"
                        aria-valuenow={amount}
                        aria-valuemin={0}
                        aria-valuemax={maxAging}
                        aria-label={`${AGING_BUCKET_LABELS[key]}: ${fmtDetailed(amount)}`}
                      />
                    )}
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 w-20 sm:w-24 shrink-0">
                    {fmtDetailed(amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Outstanding Invoices */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Outstanding Invoices
          {invoices.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({invoices.length})
            </span>
          )}
        </h2>

        {invoices.length === 0 ? (
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                No outstanding invoices
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {overdueOnly
                  ? 'No overdue invoices found. Great job!'
                  : statusFilter
                    ? `No invoices found with status "${statusFilter}".`
                    : 'All invoices have been collected. Well done!'
                }
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv: ARInvoice) => (
              <InvoiceCard key={inv.invoice_id} invoice={inv} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Invoice Card Sub-component
// ============================================================================

function InvoiceCard({ invoice }: { invoice: ARInvoice }) {
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No due date';

  return (
    <Card
      className={`p-4 sm:p-5 ${
        invoice.is_overdue
          ? 'border-l-4 border-l-red-500 dark:border-l-red-400'
          : ''
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* Left: Invoice info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {invoice.invoice_number}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">|</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {invoice.project_name}
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {fmtDetailed(invoice.amount)}
            </span>
            {invoice.is_overdue && (
              <Badge variant="danger" label="Overdue" />
            )}
          </div>

          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>
              Status: <span className="capitalize font-medium">{invoice.status}</span>
            </span>
            <span className="hidden sm:inline">|</span>
            <span>Due: {dueDate}</span>
            <span className="hidden sm:inline">|</span>
            <span>
              {invoice.is_overdue && invoice.days_overdue != null
                ? <span className="text-red-600 dark:text-red-400 font-medium">{invoice.days_overdue} days OVERDUE</span>
                : `${invoice.days_outstanding} days outstanding`
              }
            </span>
          </div>

          <div className="mt-2 flex items-center gap-4 text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              Paid: <span className="font-medium text-green-600 dark:text-green-400">{fmtDetailed(invoice.amount_paid)}</span>
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Due: <span className={`font-medium ${invoice.is_overdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {fmtDetailed(invoice.amount_due)}
              </span>
            </span>
          </div>

          {/* Overdue warning or days-to-due */}
          {!invoice.is_overdue && invoice.days_outstanding <= 7 && invoice.amount_due > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{invoice.days_outstanding === 0 ? 'Due today' : `${invoice.days_outstanding} day${invoice.days_outstanding !== 1 ? 's' : ''} to due date`}</span>
            </div>
          )}
        </div>

        {/* Right: View Project link */}
        <Link
          href={`/projects/${invoice.project_id}#financial`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors min-h-[44px] min-w-[44px] shrink-0"
        >
          View Project
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
