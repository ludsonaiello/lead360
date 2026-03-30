/**
 * Overview Tab — Financial Dashboard
 * Key metrics, quick navigation, and alerts from getDashboardOverview()
 */

'use client';

import React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Receipt,
  CheckSquare,
  Building2,
  RefreshCw,
  CreditCard,
  Download,
  AlertTriangle,
  Info,
  ArrowRight,
  DollarSign,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import type { DashboardOverview, FinancialAlert } from '@/lib/types/financial';

// ============================================================================
// Props
// ============================================================================

interface OverviewTabProps {
  data: DashboardOverview | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  forecastDays: number;
  onForecastDaysChange: (days: number) => void;
  hasRole: (roles: string[]) => boolean;
}

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

interface MetricCard {
  label: string;
  value: string;
  subtitle: string;
  trend: 'up' | 'down' | 'neutral';
  color: string;
}

interface NavCardDef {
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  stat?: string;
}

function getSeverityStyles(severity: string): string {
  switch (severity) {
    case 'error':
      return 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20';
    case 'warning':
      return 'border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
    case 'info':
      return 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20';
    default:
      return 'border-l-4 border-l-gray-400 bg-gray-50 dark:bg-gray-900/20';
  }
}

function SeverityIcon({ severity, className }: { severity: string; className?: string }) {
  switch (severity) {
    case 'error':
      return <AlertTriangle className={`${className} text-red-500 dark:text-red-400`} />;
    case 'warning':
      return <AlertTriangle className={`${className} text-yellow-500 dark:text-yellow-400`} />;
    case 'info':
      return <Info className={`${className} text-blue-500 dark:text-blue-400`} />;
    default:
      return <Info className={`${className} text-gray-500 dark:text-gray-400`} />;
  }
}

// ============================================================================
// Skeleton Loader
// ============================================================================

function OverviewSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading financial overview">
      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="p-4 sm:p-5">
            <Skeleton width="50%" height={14} className="mb-3" />
            <Skeleton width="70%" height={28} className="mb-2" />
            <Skeleton width="60%" height={12} />
          </Card>
        ))}
      </div>
      {/* Forecast skeleton */}
      <Card className="p-4 sm:p-5">
        <Skeleton width="40%" height={18} className="mb-2" />
        <Skeleton width="100%" height={14} />
      </Card>
      {/* Nav cards skeleton */}
      <div>
        <Skeleton width={150} height={22} className="mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-start gap-3">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1">
                  <Skeleton width="50%" height={16} className="mb-2" />
                  <Skeleton width="80%" height={12} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function OverviewTab({
  data,
  loading,
  error,
  onRetry,
  forecastDays,
  onForecastDaysChange,
  hasRole,
}: OverviewTabProps) {
  // Loading
  if (loading) {
    return <OverviewSkeleton />;
  }

  // Error
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <AlertTriangle className="h-10 w-10 text-red-400 dark:text-red-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Failed to load financial data
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={onRetry}
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
            No financial data yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Start by recording expenses or creating invoices to see your financial overview.
          </p>
        </div>
      </Card>
    );
  }

  // Build 8 metric cards from overview data
  const totalIncome = data.pl_summary.totals.total_income;
  const totalExpenses = data.pl_summary.totals.total_expenses;
  const netProfit = data.pl_summary.totals.total_gross_profit;
  const outstanding = data.ar_summary.summary.total_outstanding;
  const apEstimate = data.ap_summary.summary.total_ap_estimate;
  const netForecast = data.forecast.net_forecast;
  const forecastLabel = data.forecast.net_forecast_label;
  const alertCount = data.alerts.length;

  const metricCards: MetricCard[] = [
    {
      label: 'Revenue',
      value: fmt(totalIncome),
      subtitle: 'Collected this period',
      trend: totalIncome > 0 ? 'up' : 'neutral',
      color: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Expenses',
      value: fmt(totalExpenses),
      subtitle: 'Confirmed this period',
      trend: totalExpenses > 0 ? 'down' : 'neutral',
      color: 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Net Profit',
      value: fmt(netProfit),
      subtitle: 'Gross profit this period',
      trend: netProfit > 0 ? 'up' : netProfit < 0 ? 'down' : 'neutral',
      color: netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
    },
    {
      label: 'AR Outstanding',
      value: fmt(outstanding),
      subtitle: 'Invoices receivable',
      trend: outstanding > 0 ? 'down' : 'neutral',
      color: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'AP Estimate',
      value: fmt(apEstimate),
      subtitle: 'Estimated payable',
      trend: apEstimate > 0 ? 'down' : 'neutral',
      color: 'text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Forecast',
      value: netForecast >= 0 ? `+${fmt(netForecast)}` : fmt(netForecast),
      subtitle: `${forecastLabel} net ${forecastDays}d`,
      trend: netForecast > 0 ? 'up' : netForecast < 0 ? 'down' : 'neutral',
      color: netForecast >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Pending',
      value: `${data.ap_summary.subcontractor_invoices.total_pending}`,
      subtitle: 'Entries to review',
      trend: 'neutral',
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Alerts',
      value: `${alertCount}`,
      subtitle: alertCount === 0 ? 'All clear' : `${alertCount} warning${alertCount !== 1 ? 's' : ''}`,
      trend: alertCount > 0 ? 'down' : 'neutral',
      color: alertCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400',
    },
  ];

  // Nav cards with RBAC
  const navCards: NavCardDef[] = [
    {
      label: 'Expenses',
      description: 'View & manage all cost entries',
      href: '/financial/entries',
      icon: Receipt,
      roles: ['Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee'],
    },
    {
      label: 'Approvals',
      description: 'Review pending expense submissions',
      href: '/financial/approvals',
      icon: CheckSquare,
      roles: ['Owner', 'Admin', 'Manager', 'Bookkeeper'],
      stat: data.ap_summary.subcontractor_invoices.total_pending
        ? `${data.ap_summary.subcontractor_invoices.total_pending} pending`
        : undefined,
    },
    {
      label: 'Suppliers',
      description: 'Vendor registry & contacts',
      href: '/financial/suppliers',
      icon: Building2,
      roles: ['Owner', 'Admin', 'Manager', 'Bookkeeper'],
    },
    {
      label: 'Recurring',
      description: 'Automated recurring expenses',
      href: '/financial/recurring',
      icon: RefreshCw,
      roles: ['Owner', 'Admin', 'Manager', 'Bookkeeper'],
      stat: data.ap_summary.recurring_upcoming.length
        ? `${data.ap_summary.recurring_upcoming.length} upcoming`
        : undefined,
    },
    {
      label: 'Payment Methods',
      description: 'Payment accounts & cards',
      href: '/settings/payment-methods',
      icon: CreditCard,
      roles: ['Owner', 'Admin', 'Bookkeeper'],
    },
    {
      label: 'Exports',
      description: 'QuickBooks & Xero exports',
      href: '/financial/exports',
      icon: Download,
      roles: ['Owner', 'Admin', 'Bookkeeper'],
    },
  ];

  const visibleNavCards = navCards.filter((card) => hasRole(card.roles));
  const alerts = data.alerts;

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'neutral' }) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400 shrink-0" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />;
    return <Minus className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />;
  };

  return (
    <div className="space-y-6">
      {/* Forecast Period Selector */}
      <div className="flex items-center justify-end gap-2">
        <label htmlFor="overview-forecast" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Forecast
        </label>
        <select
          id="overview-forecast"
          value={forecastDays}
          onChange={(e) => onForecastDaysChange(Number(e.target.value))}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[44px]"
        >
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {/* Key Metrics Grid — 8 cards */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Key Metrics
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {metricCards.map((card) => (
            <Card key={card.label} className="p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {card.label}
                </p>
                <TrendIcon trend={card.trend} />
              </div>
              <p className={`mt-2 text-lg sm:text-2xl font-bold ${card.color} break-all`}>
                {card.value}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {card.subtitle}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Forecast Detail */}
      {data.forecast && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {forecastDays}-Day Cash Flow Forecast
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {new Date(data.forecast.forecast_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' — '}
                {new Date(data.forecast.forecast_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Inflows</p>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {fmtDetailed(data.forecast.expected_inflows.total)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Outflows</p>
                <p className="font-semibold text-red-600 dark:text-red-400">
                  {fmtDetailed(data.forecast.expected_outflows.total)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Net</p>
                <p className={`font-semibold ${
                  data.forecast.net_forecast >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {fmtDetailed(data.forecast.net_forecast)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Navigation */}
      {visibleNavCards.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Quick Navigation
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {visibleNavCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href} className="group block">
                  <Card className="p-4 sm:p-5 h-full transition-all duration-200 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {card.label}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {card.description}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                    </div>
                    {card.stat && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {card.stat}
                        </p>
                      </div>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Alerts ({alerts.length})
          </h2>
          <div className="space-y-3">
            {alerts.map((alert: FinancialAlert, index: number) => (
              <Card
                key={`alert-${index}`}
                className={`p-4 ${getSeverityStyles(alert.severity)}`}
              >
                <div className="flex items-start gap-3">
                  <SeverityIcon severity={alert.severity} className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {alert.message}
                    </p>
                    <p className="text-xs mt-1 text-gray-500 dark:text-gray-400 capitalize">
                      {alert.type.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All clear */}
      {alerts.length === 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
            <CheckSquare className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">All clear — no financial alerts at this time.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
