/**
 * Alerts Tab — Financial Dashboard
 * Severity-styled alert cards with action links
 * API: GET /api/v1/financial/dashboard/alerts
 * Sprint 20, Task 4
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Info,
  ShieldAlert,
  ExternalLink,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { getDashboardAlerts } from '@/lib/api/financial';
import type { AlertsResponse, FinancialAlert, AlertType } from '@/lib/types/financial';
import toast from 'react-hot-toast';

// ============================================================================
// Helpers
// ============================================================================

const fmtDetailed = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

function getSeverityStyles(severity: string): {
  border: string;
  bg: string;
  iconColor: string;
  label: string;
  badgeVariant: 'danger' | 'warning' | 'info' | 'neutral';
} {
  switch (severity) {
    case 'error':
      return {
        border: 'border-l-4 border-l-red-500',
        bg: 'bg-red-50 dark:bg-red-900/20',
        iconColor: 'text-red-500 dark:text-red-400',
        label: 'ERROR',
        badgeVariant: 'danger',
      };
    case 'warning':
      return {
        border: 'border-l-4 border-l-yellow-500',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        iconColor: 'text-yellow-500 dark:text-yellow-400',
        label: 'WARNING',
        badgeVariant: 'warning',
      };
    case 'info':
      return {
        border: 'border-l-4 border-l-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        iconColor: 'text-blue-500 dark:text-blue-400',
        label: 'INFO',
        badgeVariant: 'info',
      };
    default:
      return {
        border: 'border-l-4 border-l-gray-400',
        bg: 'bg-gray-50 dark:bg-gray-900/20',
        iconColor: 'text-gray-500 dark:text-gray-400',
        label: 'NOTICE',
        badgeVariant: 'neutral',
      };
  }
}

function SeverityIcon({ severity, className }: { severity: string; className?: string }) {
  switch (severity) {
    case 'error':
      return <ShieldAlert className={`${className} text-red-500 dark:text-red-400`} />;
    case 'warning':
      return <AlertTriangle className={`${className} text-yellow-500 dark:text-yellow-400`} />;
    case 'info':
      return <Info className={`${className} text-blue-500 dark:text-blue-400`} />;
    default:
      return <Info className={`${className} text-gray-500 dark:text-gray-400`} />;
  }
}

function getAlertLink(alert: FinancialAlert): string | null {
  const details = alert.details as Record<string, string | number>;
  const alertType: AlertType = alert.type;

  switch (alertType) {
    case 'cost_overrun':
    case 'budget_warning':
      return details.project_id ? `/projects/${details.project_id}#financial` : null;
    case 'overdue_invoice':
      // overdue_invoice details may include project_id; if so, link to project
      return details.project_id ? `/projects/${details.project_id}#financial` : null;
    case 'upcoming_obligation':
      return '/financial/recurring';
    default:
      return null;
  }
}

function getAlertLinkLabel(type: AlertType): string {
  switch (type) {
    case 'cost_overrun':
    case 'budget_warning':
      return 'View Project';
    case 'overdue_invoice':
      return 'View Invoice';
    case 'upcoming_obligation':
      return 'View Recurring';
    default:
      return 'View';
  }
}

// ============================================================================
// Skeleton Loader
// ============================================================================

function AlertsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading financial alerts">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Skeleton variant="circular" width={40} height={40} />
            <div className="flex-1 space-y-2">
              <Skeleton width={80} height={14} />
              <Skeleton width="70%" height={16} />
              <Skeleton width="50%" height={14} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function AlertsTab() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboardAlerts();
      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load financial alerts';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Loading
  if (loading) {
    return <AlertsSkeleton />;
  }

  // Error
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <AlertTriangle className="h-10 w-10 text-red-400 dark:text-red-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Failed to load alerts
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchAlerts}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px] min-w-[44px]"
          >
            Try Again
          </button>
        </div>
      </Card>
    );
  }

  // All clear
  if (!data || data.alert_count === 0) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <CheckCircle2 className="h-12 w-12 text-green-400 dark:text-green-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            All Clear
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No financial alerts at this time. Everything looks good!
          </p>
        </div>
      </Card>
    );
  }

  const { alerts, alert_count } = data;

  // Group alerts by severity for summary
  const errorCount = alerts.filter(a => a.severity === 'error').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const infoCount = alerts.filter(a => a.severity === 'info').length;

  return (
    <div className="space-y-6">
      {/* Alert count summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-500 dark:text-amber-400" />
          Financial Alerts ({alert_count})
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {errorCount > 0 && (
            <Badge variant="danger" label={`${errorCount} Error${errorCount !== 1 ? 's' : ''}`} />
          )}
          {warningCount > 0 && (
            <Badge variant="warning" label={`${warningCount} Warning${warningCount !== 1 ? 's' : ''}`} />
          )}
          {infoCount > 0 && (
            <Badge variant="info" label={`${infoCount} Info`} />
          )}
        </div>
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {alerts.map((alert: FinancialAlert, index: number) => (
          <AlertCard key={`${alert.type}-${alert.severity}-${index}`} alert={alert} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Alert Card Sub-component
// ============================================================================

function AlertCard({ alert }: { alert: FinancialAlert }) {
  const styles = getSeverityStyles(alert.severity);
  const link = getAlertLink(alert);
  const linkLabel = getAlertLinkLabel(alert.type);
  const details = alert.details as Record<string, string | number | undefined>;

  return (
    <Card className={`p-4 sm:p-5 ${styles.border} ${styles.bg}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Icon + Content */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <SeverityIcon severity={alert.severity} className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant={styles.badgeVariant} label={styles.label} />
            </div>

            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              {alert.message}
            </p>

            {/* Alert-type-specific details */}
            <AlertDetails type={alert.type} details={details} />
          </div>
        </div>

        {/* Action Link */}
        {link && (
          <Link
            href={link}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors min-h-[44px] min-w-[44px] shrink-0 self-end sm:self-start"
          >
            {linkLabel}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// Alert Details Sub-component
// ============================================================================

function AlertDetails({ type, details }: { type: AlertType; details: Record<string, string | number | undefined> }) {
  switch (type) {
    case 'cost_overrun':
    case 'budget_warning': {
      const estimated = typeof details.estimated_cost === 'number' ? details.estimated_cost : 0;
      const actual = typeof details.actual_cost === 'number' ? details.actual_cost : 0;
      const percent = typeof details.percent_used === 'number' ? details.percent_used : 0;
      return (
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          {details.project_name && (
            <p>Project: <span className="font-medium text-gray-900 dark:text-gray-100">{String(details.project_name)}</span></p>
          )}
          <p>
            Estimated: {fmtDetailed(estimated)} | Actual: {fmtDetailed(actual)} ({percent.toFixed(1)}%)
          </p>
        </div>
      );
    }

    case 'overdue_invoice': {
      const amountDue = typeof details.amount_due === 'number' ? details.amount_due : 0;
      const daysOverdue = typeof details.days_overdue === 'number' ? details.days_overdue : 0;
      return (
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          {details.invoice_number && (
            <p>Invoice: <span className="font-medium text-gray-900 dark:text-gray-100">{String(details.invoice_number)}</span></p>
          )}
          <p>
            Amount Due: <span className="font-semibold text-red-600 dark:text-red-400">{fmtDetailed(amountDue)}</span>
            {daysOverdue > 0 && (
              <> | <span className="text-red-600 dark:text-red-400">{daysOverdue} days overdue</span></>
            )}
          </p>
        </div>
      );
    }

    case 'upcoming_obligation': {
      const amount = typeof details.amount === 'number' ? details.amount : 0;
      return (
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          {details.rule_name && (
            <p>Rule: <span className="font-medium text-gray-900 dark:text-gray-100">{String(details.rule_name)}</span></p>
          )}
          {amount > 0 && (
            <p>Amount: {fmtDetailed(amount)}</p>
          )}
          {details.due_date && (
            <p>Due: {new Date(String(details.due_date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
