'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Receipt,
  Clock,
  FileText,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Briefcase,
  CreditCard,
  HardHat,
  ClipboardList,
} from 'lucide-react';
import {
  getProjectFinancialSummary,
  getTaskBreakdown,
  getFinancialTimeline,
  getWorkforceSummary,
} from '@/lib/api/financial';
import type {
  ProjectFinancialSummary,
  TaskBreakdownResponse,
  TaskBreakdownItem,
  TimelineResponse,
  TimelineMonth,
  WorkforceResponse,
} from '@/lib/types/financial';
import { formatCurrency, formatDate } from '@/lib/api/projects';

// ============================================================================
// Types
// ============================================================================

interface FinancialOverviewProps {
  projectId: string;
}

type TaskSortField = 'total_cost' | 'task_title';
type SortOrder = 'asc' | 'desc';

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  labor: { bg: 'bg-blue-100 dark:bg-blue-900/30', bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
  material: { bg: 'bg-green-100 dark:bg-green-900/30', bar: 'bg-green-500', text: 'text-green-700 dark:text-green-300' },
  subcontractor: { bg: 'bg-purple-100 dark:bg-purple-900/30', bar: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300' },
  equipment: { bg: 'bg-orange-100 dark:bg-orange-900/30', bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  insurance: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', bar: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300' },
  fuel: { bg: 'bg-amber-100 dark:bg-amber-900/30', bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
  utilities: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', bar: 'bg-indigo-500', text: 'text-indigo-700 dark:text-indigo-300' },
  office: { bg: 'bg-pink-100 dark:bg-pink-900/30', bar: 'bg-pink-500', text: 'text-pink-700 dark:text-pink-300' },
  marketing: { bg: 'bg-rose-100 dark:bg-rose-900/30', bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
  taxes: { bg: 'bg-red-100 dark:bg-red-900/30', bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
  tools: { bg: 'bg-teal-100 dark:bg-teal-900/30', bar: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300' },
  other: { bg: 'bg-gray-100 dark:bg-gray-700', bar: 'bg-gray-500', text: 'text-gray-700 dark:text-gray-300' },
};

const CATEGORY_LABELS: Record<string, string> = {
  labor: 'Labor',
  material: 'Materials',
  subcontractor: 'Subcontractor',
  equipment: 'Equipment',
  insurance: 'Insurance',
  fuel: 'Fuel',
  utilities: 'Utilities',
  office: 'Office',
  marketing: 'Marketing',
  taxes: 'Taxes',
  tools: 'Tools',
  other: 'Other',
};

const TASK_STATUS_MAP: Record<string, { variant: 'success' | 'warning' | 'info' | 'neutral' | 'danger'; label: string }> = {
  done: { variant: 'success', label: 'Done' },
  in_progress: { variant: 'info', label: 'In Progress' },
  not_started: { variant: 'neutral', label: 'Not Started' },
  blocked: { variant: 'danger', label: 'Blocked' },
};

// ============================================================================
// Skeleton components for loading states
// ============================================================================

function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={`p-5 animate-pulse ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="h-7 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
      <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
    </Card>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="p-6 animate-pulse">
      <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function TableSkeleton({ rows = 3, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card className="p-6 animate-pulse">
      <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function FinancialOverview({ projectId }: FinancialOverviewProps) {
  // Date filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Data state
  const [summary, setSummary] = useState<ProjectFinancialSummary | null>(null);
  const [taskBreakdown, setTaskBreakdown] = useState<TaskBreakdownResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [workforce, setWorkforce] = useState<WorkforceResponse | null>(null);

  // Loading state (per-section for progressive rendering)
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [loadingWorkforce, setLoadingWorkforce] = useState(true);

  // Error state
  const [errorSummary, setErrorSummary] = useState<string | null>(null);
  const [errorTasks, setErrorTasks] = useState<string | null>(null);
  const [errorTimeline, setErrorTimeline] = useState<string | null>(null);
  const [errorWorkforce, setErrorWorkforce] = useState<string | null>(null);

  // Task sort state
  const [taskSortBy, setTaskSortBy] = useState<TaskSortField>('total_cost');
  const [taskSortOrder, setTaskSortOrder] = useState<SortOrder>('desc');

  // Task expansion state
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const dateParams = useMemo(() => {
    const p: { date_from?: string; date_to?: string } = {};
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [dateFrom, dateTo]);

  // Load summary, timeline, workforce in parallel
  const loadAllData = useCallback(async () => {
    setLoadingSummary(true);
    setLoadingTimeline(true);
    setLoadingWorkforce(true);
    setErrorSummary(null);
    setErrorTimeline(null);
    setErrorWorkforce(null);

    const [summaryResult, timelineResult, workforceResult] = await Promise.allSettled([
      getProjectFinancialSummary(projectId, dateParams),
      getFinancialTimeline(projectId, dateParams),
      getWorkforceSummary(projectId, dateParams),
    ]);

    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value);
    } else {
      setErrorSummary(summaryResult.reason?.message || 'Failed to load summary');
    }
    setLoadingSummary(false);

    if (timelineResult.status === 'fulfilled') {
      setTimeline(timelineResult.value);
    } else {
      setErrorTimeline(timelineResult.reason?.message || 'Failed to load timeline');
    }
    setLoadingTimeline(false);

    if (workforceResult.status === 'fulfilled') {
      setWorkforce(workforceResult.value);
    } else {
      setErrorWorkforce(workforceResult.reason?.message || 'Failed to load workforce data');
    }
    setLoadingWorkforce(false);
  }, [projectId, dateParams]);

  // Load task breakdown separately (re-fetches on sort change without re-fetching other sections)
  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    setErrorTasks(null);

    try {
      const data = await getTaskBreakdown(projectId, { ...dateParams, sort_by: taskSortBy, sort_order: taskSortOrder });
      setTaskBreakdown(data);
    } catch (err) {
      setErrorTasks((err as { message?: string }).message || 'Failed to load task breakdown');
    } finally {
      setLoadingTasks(false);
    }
  }, [projectId, dateParams, taskSortBy, taskSortOrder]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Re-fetch tasks when sort changes (task endpoint supports server sort)
  const handleTaskSort = (field: TaskSortField) => {
    if (field === taskSortBy) {
      setTaskSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setTaskSortBy(field);
      setTaskSortOrder('desc');
    }
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Filter timeline months to only show those with data
  const activeMonths = useMemo(() => {
    if (!timeline) return [];
    return timeline.months.filter((m) => m.total_expenses > 0);
  }, [timeline]);

  const maxMonthlyExpense = useMemo(() => {
    if (activeMonths.length === 0) return 0;
    return Math.max(...activeMonths.map((m) => m.total_expenses));
  }, [activeMonths]);

  // Calculate budget used percent for progress bar
  const budgetUsedPercent = useMemo(() => {
    if (!summary) return null;
    const { margin_analysis, cost_summary } = summary;
    if (margin_analysis.estimated_cost && margin_analysis.estimated_cost > 0) {
      return (cost_summary.total_expenses / margin_analysis.estimated_cost) * 100;
    }
    if (margin_analysis.contract_value && margin_analysis.contract_value > 0) {
      return (cost_summary.total_expenses / margin_analysis.contract_value) * 100;
    }
    return null;
  }, [summary]);

  return (
    <div className="space-y-6">
      {/* ── Date Range Filter ── */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Financial Overview
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto">
            <div className="w-full sm:w-44">
              <Input
                type="date"
                label="Date From"
                id="overview-date-from"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                leftIcon={<Calendar className="w-4 h-4" />}
              />
            </div>
            <div className="w-full sm:w-44">
              <Input
                type="date"
                label="Date To"
                id="overview-date-to"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                leftIcon={<Calendar className="w-4 h-4" />}
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="self-end px-3 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                aria-label="Clear date filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Budget & Margin Cards ── */}
      {loadingSummary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : errorSummary ? (
        <ErrorCard message={errorSummary} />
      ) : summary ? (
        <>
          <BudgetMarginSection summary={summary} budgetUsedPercent={budgetUsedPercent} />
          <CostBreakdownSection summary={summary} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueSection summary={summary} />
            <SubcontractorCrewReceiptSection summary={summary} />
          </div>
        </>
      ) : null}

      {/* ── Task Cost Breakdown ── */}
      {loadingTasks ? (
        <SectionSkeleton rows={4} />
      ) : errorTasks ? (
        <ErrorCard message={errorTasks} />
      ) : taskBreakdown ? (
        <TaskBreakdownSection
          data={taskBreakdown}
          sortBy={taskSortBy}
          sortOrder={taskSortOrder}
          onSort={handleTaskSort}
          expandedTasks={expandedTasks}
          onToggleExpand={toggleTaskExpanded}
        />
      ) : null}

      {/* ── Monthly Timeline ── */}
      {loadingTimeline ? (
        <SectionSkeleton rows={3} />
      ) : errorTimeline ? (
        <ErrorCard message={errorTimeline} />
      ) : timeline ? (
        <TimelineSection
          activeMonths={activeMonths}
          cumulativeTotal={timeline.cumulative_total}
          maxExpense={maxMonthlyExpense}
        />
      ) : null}

      {/* ── Workforce ── */}
      {loadingWorkforce ? (
        <TableSkeleton rows={3} cols={5} />
      ) : errorWorkforce ? (
        <ErrorCard message={errorWorkforce} />
      ) : workforce ? (
        <WorkforceSection data={workforce} />
      ) : null}
    </div>
  );
}

// ============================================================================
// Error Card
// ============================================================================

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="p-8 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Something went wrong</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </Card>
  );
}

// ============================================================================
// Section 1: Budget & Margin
// ============================================================================

function BudgetMarginSection({
  summary,
  budgetUsedPercent,
}: {
  summary: ProjectFinancialSummary;
  budgetUsedPercent: number | null;
}) {
  const { margin_analysis, cost_summary } = summary;
  const actualMargin = margin_analysis.actual_margin;
  const marginPercent = margin_analysis.margin_percent;
  const isPositive = actualMargin !== null && actualMargin >= 0;

  return (
    <div className="space-y-4">
      {/* Top metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Contract Value */}
        <MetricCard
          icon={DollarSign}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          label="Contract Value"
          value={margin_analysis.contract_value !== null ? formatCurrency(margin_analysis.contract_value) : '-'}
          subtitle={summary.project.name}
        />

        {/* Estimated Cost */}
        <MetricCard
          icon={BarChart3}
          iconBg="bg-gray-100 dark:bg-gray-700"
          iconColor="text-gray-600 dark:text-gray-400"
          label="Estimated Cost"
          value={margin_analysis.estimated_cost !== null ? formatCurrency(margin_analysis.estimated_cost) : '-'}
          subtitle={`${cost_summary.entry_count} ${cost_summary.entry_count === 1 ? 'entry' : 'entries'} recorded`}
        />

        {/* Actual Cost */}
        <MetricCard
          icon={CreditCard}
          iconBg="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
          label="Actual Cost"
          value={formatCurrency(cost_summary.total_expenses)}
          subtitle={cost_summary.total_expenses_pending > 0
            ? `${formatCurrency(cost_summary.total_expenses_pending)} pending`
            : 'All confirmed'}
        />

        {/* Budget Remaining / Margin */}
        <MetricCard
          icon={actualMargin !== null && actualMargin >= 0 ? TrendingUp : TrendingDown}
          iconBg={actualMargin === null ? 'bg-gray-100 dark:bg-gray-700' : isPositive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}
          iconColor={actualMargin === null ? 'text-gray-600 dark:text-gray-400' : isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
          label="Actual Margin"
          value={actualMargin !== null ? formatCurrency(actualMargin) : '-'}
          valueColor={actualMargin === null ? undefined : isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
          subtitle={marginPercent !== null ? `${marginPercent.toFixed(1)}% margin` : 'No contract value'}
        />
      </div>

      {/* Budget Usage Progress Bar */}
      {budgetUsedPercent !== null && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Budget Usage</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{budgetUsedPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budgetUsedPercent > 100
                  ? 'bg-red-500'
                  : budgetUsedPercent > 80
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(budgetUsedPercent, 100)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(budgetUsedPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Budget usage: ${budgetUsedPercent.toFixed(1)} percent`}
            />
          </div>
          {margin_analysis.gross_margin !== null && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Gross Margin: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(margin_analysis.gross_margin)}</span>
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Metric Card (reusable within overview)
// ============================================================================

function MetricCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  valueColor,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor?: string;
  subtitle?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueColor || 'text-gray-900 dark:text-white'}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      )}
    </Card>
  );
}

// ============================================================================
// Section 2: Cost Breakdown by Category + Classification
// ============================================================================

function CostBreakdownSection({ summary }: { summary: ProjectFinancialSummary }) {
  const { cost_summary } = summary;
  const totalExpenses = cost_summary.total_expenses;
  const hasCategories = cost_summary.by_category.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Cost Breakdown by Category */}
      <Card className="p-6 lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-500" />
          Cost Breakdown by Category
        </h3>
        {hasCategories ? (
          <div className="space-y-3">
            {cost_summary.by_category
              .slice()
              .sort((a, b) => b.total - a.total)
              .map((cat) => {
                const pct = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
                const colors = CATEGORY_COLORS[cat.category_type] || CATEGORY_COLORS.other;
                return (
                  <div key={cat.category_id} className="flex items-center gap-3">
                    <div className="w-32 min-w-[8rem] text-sm text-gray-600 dark:text-gray-400 truncate" title={cat.category_name}>
                      {cat.category_name}
                    </div>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors.bar} transition-all duration-300`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                    <div className="w-24 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(cat.total)}
                    </div>
                    <div className="w-12 text-right text-xs text-gray-500 dark:text-gray-400">
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <EmptyState message="No cost entries recorded yet" />
        )}
      </Card>

      {/* Cost Breakdown by Classification */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Cost by Classification
        </h3>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Cost of Goods Sold</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(cost_summary.by_classification.cost_of_goods_sold)}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
            <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">Operating Expense</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(cost_summary.by_classification.operating_expense)}
            </p>
          </div>
          {cost_summary.total_tax_paid > 0 && (
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total Tax Paid</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(cost_summary.total_tax_paid)}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Section 3: Revenue Summary
// ============================================================================

function RevenueSection({ summary }: { summary: ProjectFinancialSummary }) {
  const { revenue } = summary;

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4 text-gray-500" />
        Revenue Summary
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
          <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Invoiced</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(revenue.total_invoiced)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{revenue.invoice_count} invoice{revenue.invoice_count !== 1 ? 's' : ''}</p>
        </div>
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Collected</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(revenue.total_collected)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{revenue.paid_invoices} paid</p>
        </div>
        <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800">
          <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Outstanding</p>
          <p className={`text-xl font-bold ${revenue.outstanding > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
            {formatCurrency(revenue.outstanding)}
          </p>
          {revenue.partial_invoices > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{revenue.partial_invoices} partial</p>
          )}
          {revenue.draft_invoices > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{revenue.draft_invoices} draft</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Section 4: Subcontractor + Crew + Receipt summaries (compact)
// ============================================================================

function SubcontractorCrewReceiptSection({ summary }: { summary: ProjectFinancialSummary }) {
  const { subcontractor_summary, crew_summary, receipt_summary } = summary;

  return (
    <div className="space-y-4">
      {/* Subcontractor Summary */}
      <Card className="p-5">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-purple-500" />
          Subcontractor Summary
        </h4>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Invoiced: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(subcontractor_summary.total_invoiced)}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Paid: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(subcontractor_summary.total_paid)}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Outstanding: </span>
            <span className={`font-semibold ${subcontractor_summary.outstanding > 0 ? 'text-yellow-600 dark:text-yellow-400' : subcontractor_summary.outstanding < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {formatCurrency(subcontractor_summary.outstanding)}
            </span>
          </div>
        </div>
      </Card>

      {/* Crew Summary */}
      <Card className="p-5">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <HardHat className="w-4 h-4 text-blue-500" />
          Crew Summary
        </h4>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Hours: </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {crew_summary.total_regular_hours.toFixed(1)} regular
              {crew_summary.total_overtime_hours > 0 ? ` + ${crew_summary.total_overtime_hours.toFixed(1)} OT` : ''}
              {' = '}{crew_summary.total_hours.toFixed(1)} total
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Payments: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(crew_summary.total_crew_payments)}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Members: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{crew_summary.crew_member_count}</span>
          </div>
        </div>
      </Card>

      {/* Receipt Summary */}
      <Card className="p-5">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-green-500" />
          Receipts
        </h4>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{receipt_summary.total_receipts}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Categorized: </span>
            <span className="font-semibold text-green-600 dark:text-green-400">{receipt_summary.categorized_receipts}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Uncategorized: </span>
            <span className={`font-semibold ${receipt_summary.uncategorized_receipts > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
              {receipt_summary.uncategorized_receipts}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Section 5: Task Cost Breakdown
// ============================================================================

function TaskBreakdownSection({
  data,
  sortBy,
  sortOrder,
  onSort,
  expandedTasks,
  onToggleExpand,
}: {
  data: TaskBreakdownResponse;
  sortBy: TaskSortField;
  sortOrder: SortOrder;
  onSort: (field: TaskSortField) => void;
  expandedTasks: Set<string>;
  onToggleExpand: (taskId: string) => void;
}) {
  const hasTasks = data.tasks.length > 0;

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-500" />
          Per-Task Cost Breakdown
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Sort:</span>
          <button
            onClick={() => onSort('total_cost')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sortBy === 'total_cost'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            aria-label={`Sort by cost ${sortBy === 'total_cost' ? (sortOrder === 'desc' ? 'ascending' : 'descending') : 'descending'}`}
          >
            Cost {sortBy === 'total_cost' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => onSort('task_title')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sortBy === 'task_title'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            aria-label={`Sort by title ${sortBy === 'task_title' ? (sortOrder === 'desc' ? 'ascending' : 'descending') : 'descending'}`}
          >
            Title {sortBy === 'task_title' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
        </div>
      </div>

      {hasTasks ? (
        <div className="space-y-3">
          {data.tasks.map((task) => (
            <TaskCard
              key={task.task_id}
              task={task}
              isExpanded={expandedTasks.has(task.task_id)}
              onToggle={() => onToggleExpand(task.task_id)}
            />
          ))}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total across all tasks</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(data.total_task_cost)}</span>
          </div>
        </div>
      ) : (
        <EmptyState message="No tasks have cost entries yet" />
      )}
    </Card>
  );
}

function TaskCard({
  task,
  isExpanded,
  onToggle,
}: {
  task: TaskBreakdownItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusInfo = TASK_STATUS_MAP[task.task_status] || { variant: 'neutral' as const, label: task.task_status };
  const hasCategories = task.expenses.by_category.length > 0;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={isExpanded}
        aria-label={`${task.task_title} - ${formatCurrency(task.expenses.total)} - click to ${isExpanded ? 'collapse' : 'expand'}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <ClipboardList className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white truncate">{task.task_title}</span>
          <Badge variant={statusInfo.variant} label={statusInfo.label} />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(task.expenses.total)}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Summary row (always visible) */}
      <div className="px-4 pb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {task.expenses.by_category.map((cat) => (
          <span key={cat.category_name}>
            {CATEGORY_LABELS[cat.category_type] || cat.category_name}: {formatCurrency(cat.total)}
          </span>
        ))}
        {task.subcontractor_invoices.total_invoiced > 0 && (
          <span>Sub Invoices: {formatCurrency(task.subcontractor_invoices.total_invoiced)}</span>
        )}
        {task.crew_hours.total_hours > 0 && (
          <span>Crew Hours: {task.crew_hours.total_hours.toFixed(1)}h</span>
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && hasCategories && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Detailed Breakdown</p>
          <div className="space-y-2">
            {task.expenses.by_category.map((cat) => {
              const pct = task.expenses.total > 0 ? (cat.total / task.expenses.total) * 100 : 0;
              const colors = CATEGORY_COLORS[cat.category_type] || CATEGORY_COLORS.other;
              return (
                <div key={cat.category_name} className="flex items-center gap-2">
                  <span className="w-28 text-xs text-gray-600 dark:text-gray-400 truncate">{cat.category_name}</span>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="w-20 text-right text-xs font-medium text-gray-900 dark:text-white">{formatCurrency(cat.total)}</span>
                  <span className="w-10 text-right text-xs text-gray-400">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{task.expenses.entry_count} expense {task.expenses.entry_count === 1 ? 'entry' : 'entries'}</span>
            {task.subcontractor_invoices.invoice_count > 0 && (
              <span>{task.subcontractor_invoices.invoice_count} subcontractor invoice{task.subcontractor_invoices.invoice_count !== 1 ? 's' : ''}: {formatCurrency(task.subcontractor_invoices.total_invoiced)}</span>
            )}
            {task.crew_hours.total_hours > 0 && (
              <span>
                Crew: {task.crew_hours.total_regular_hours.toFixed(1)}h regular
                {task.crew_hours.total_overtime_hours > 0 ? ` + ${task.crew_hours.total_overtime_hours.toFixed(1)}h OT` : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Section 6: Monthly Timeline
// ============================================================================

function TimelineSection({
  activeMonths,
  cumulativeTotal,
  maxExpense,
}: {
  activeMonths: TimelineMonth[];
  cumulativeTotal: number;
  maxExpense: number;
}) {
  const hasData = activeMonths.length > 0;

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-500" />
        Monthly Cost Timeline
      </h3>

      {hasData ? (
        <>
          {/* Desktop: horizontal bar chart */}
          <div className="hidden md:block space-y-3">
            {activeMonths.map((month) => (
                <div key={`${month.year}-${month.month}`} className="flex items-center gap-3">
                  <div className="w-20 text-sm font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">
                    {month.month_label}
                  </div>
                  <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                    {month.by_category.map((cat, i) => {
                      const catPct = maxExpense > 0 ? (cat.total / maxExpense) * 100 : 0;
                      const colors = CATEGORY_COLORS[cat.category_type] || CATEGORY_COLORS.other;
                      return (
                        <div
                          key={`${cat.category_name}-${i}`}
                          className={`h-full ${colors.bar} ${i === 0 ? 'rounded-l-full' : ''} ${i === month.by_category.length - 1 ? 'rounded-r-full' : ''}`}
                          style={{ width: `${Math.max(catPct, 0.5)}%` }}
                          title={`${cat.category_name}: ${formatCurrency(cat.total)}`}
                        />
                      );
                    })}
                  </div>
                  <div className="w-24 text-right text-sm font-medium text-gray-900 dark:text-white flex-shrink-0">
                    {formatCurrency(month.total_expenses)}
                  </div>
                </div>
            ))}
          </div>

          {/* Mobile: table fallback */}
          <div className="md:hidden">
            <div className="space-y-3">
              {activeMonths.map((month) => (
                <div key={`m-${month.year}-${month.month}`} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{month.month_label}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(month.total_expenses)}</span>
                  </div>
                  {month.by_category.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      {month.by_category.map((cat, i) => (
                        <span key={`${cat.category_name}-${i}`}>
                          {CATEGORY_LABELS[cat.category_type] || cat.category_name}: {formatCurrency(cat.total)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Cumulative total */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cumulative Total</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(cumulativeTotal)}</span>
          </div>

          {/* Category legend */}
          {activeMonths.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {(() => {
                const allCatTypes = new Set<string>();
                activeMonths.forEach((m) => m.by_category.forEach((c) => allCatTypes.add(c.category_type)));
                return Array.from(allCatTypes).map((type) => {
                  const colors = CATEGORY_COLORS[type] || CATEGORY_COLORS.other;
                  return (
                    <div key={type} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <div className={`w-3 h-3 rounded-full ${colors.bar}`} />
                      <span>{CATEGORY_LABELS[type] || type}</span>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </>
      ) : (
        <EmptyState message="No monthly cost data available" />
      )}
    </Card>
  );
}

// ============================================================================
// Section 7: Workforce
// ============================================================================

function WorkforceSection({ data }: { data: WorkforceResponse }) {
  const hasCrewHours = data.crew_hours.by_crew_member.length > 0;
  const hasCrewPayments = data.crew_payments.by_crew_member.length > 0;
  const hasSubs = data.subcontractor_invoices.by_subcontractor.length > 0;

  return (
    <div className="space-y-6">
      {/* Crew Hours */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          Crew Hours
        </h3>
        {hasCrewHours ? (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Crew Member</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Regular</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">OT</th>
                    <th className="text-right py-2 pl-4 font-medium text-gray-500 dark:text-gray-400">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.crew_hours.by_crew_member.map((member) => (
                    <tr key={member.crew_member_id} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{member.crew_member_name}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600 dark:text-gray-400">{member.regular_hours.toFixed(1)}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600 dark:text-gray-400">{member.overtime_hours.toFixed(1)}</td>
                      <td className="py-2.5 pl-4 text-right font-semibold text-gray-900 dark:text-white">{member.total_hours.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="py-2.5 pr-4 font-semibold text-gray-900 dark:text-white">Total</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-gray-900 dark:text-white">{data.crew_hours.total_regular_hours.toFixed(1)}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-gray-900 dark:text-white">{data.crew_hours.total_overtime_hours.toFixed(1)}</td>
                    <td className="py-2.5 pl-4 text-right font-bold text-gray-900 dark:text-white">{data.crew_hours.total_hours.toFixed(1)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {data.crew_hours.by_crew_member.map((member) => (
                <div key={member.crew_member_id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white mb-2">{member.crew_member_name}</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Regular: {member.regular_hours.toFixed(1)}h</span>
                    <span className="text-gray-500 dark:text-gray-400">OT: {member.overtime_hours.toFixed(1)}h</span>
                    <span className="font-semibold text-gray-900 dark:text-white">Total: {member.total_hours.toFixed(1)}h</span>
                  </div>
                </div>
              ))}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm font-semibold text-gray-900 dark:text-white text-center">
                Total: {data.crew_hours.total_regular_hours.toFixed(1)} regular + {data.crew_hours.total_overtime_hours.toFixed(1)} OT = {data.crew_hours.total_hours.toFixed(1)} hours
              </div>
            </div>
          </>
        ) : (
          <EmptyState message="No crew hours logged for this project" />
        )}
      </Card>

      {/* Crew Payments */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-green-500" />
          Crew Payments
        </h3>
        {hasCrewPayments ? (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Crew Member</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Total Paid</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Payments</th>
                    <th className="text-right py-2 pl-4 font-medium text-gray-500 dark:text-gray-400">Last Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {data.crew_payments.by_crew_member.map((member) => (
                    <tr key={member.crew_member_id} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{member.crew_member_name}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(member.total_paid)}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600 dark:text-gray-400">{member.payment_count}</td>
                      <td className="py-2.5 pl-4 text-right text-gray-600 dark:text-gray-400">{member.last_payment_date ? formatDate(member.last_payment_date) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="py-2.5 pr-4 font-semibold text-gray-900 dark:text-white">Total</td>
                    <td className="py-2.5 px-4 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(data.crew_payments.total_paid)}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-gray-900 dark:text-white">{data.crew_payments.payment_count}</td>
                    <td className="py-2.5 pl-4" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {data.crew_payments.by_crew_member.map((member) => (
                <div key={member.crew_member_id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900 dark:text-white">{member.crew_member_name}</p>
                    <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(member.total_paid)}</p>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{member.payment_count} payment{member.payment_count !== 1 ? 's' : ''}</span>
                    <span>Last: {member.last_payment_date ? formatDate(member.last_payment_date) : '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState message="No crew payments recorded for this project" />
        )}
      </Card>

      {/* Subcontractor Invoices */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-purple-500" />
          Subcontractors
        </h3>
        {hasSubs ? (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Subcontractor</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Invoiced</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Paid</th>
                    <th className="text-right py-2 pl-4 font-medium text-gray-500 dark:text-gray-400">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subcontractor_invoices.by_subcontractor.map((sub) => (
                    <tr key={sub.subcontractor_id} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{sub.subcontractor_name}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600 dark:text-gray-400">{formatCurrency(sub.invoiced)}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600 dark:text-gray-400">{formatCurrency(sub.paid)}</td>
                      <td className={`py-2.5 pl-4 text-right font-semibold ${
                        sub.outstanding > 0
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : sub.outstanding < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                      }`}>
                        {formatCurrency(sub.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="py-2.5 pr-4 font-semibold text-gray-900 dark:text-white">Total</td>
                    <td className="py-2.5 px-4 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(data.subcontractor_invoices.total_invoiced)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(data.subcontractor_invoices.total_paid)}</td>
                    <td className={`py-2.5 pl-4 text-right font-bold ${
                      data.subcontractor_invoices.outstanding > 0
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : data.subcontractor_invoices.outstanding < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                    }`}>
                      {formatCurrency(data.subcontractor_invoices.outstanding)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {data.subcontractor_invoices.by_subcontractor.map((sub) => (
                <div key={sub.subcontractor_id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white mb-2">{sub.subcontractor_name}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Invoiced</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(sub.invoiced)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Paid</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(sub.paid)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Outstanding</p>
                      <p className={`font-semibold ${sub.outstanding > 0 ? 'text-yellow-600 dark:text-yellow-400' : sub.outstanding < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {formatCurrency(sub.outstanding)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState message="No subcontractor invoices for this project" />
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-gray-400 dark:text-gray-500">{message}</p>
    </div>
  );
}
