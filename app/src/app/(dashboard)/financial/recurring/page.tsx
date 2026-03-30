'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Plus,
  Pause,
  Play,
  SkipForward,
  Pencil,
  XCircle,
  Zap,
  Eye,
  Calendar,
  DollarSign,
  Hash,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getRecurringRules,
  getRecurringPreview,
  getFinancialCategories,
  pauseRecurringRule,
  resumeRecurringRule,
  skipRecurringRule,
  triggerRecurringRule,
  cancelRecurringRule,
} from '@/lib/api/financial';
import type {
  RecurringRule,
  RecurringRuleStatus,
  RecurringFrequency,
  RecurringPreviewResponse,
  FinancialCategory,
} from '@/lib/types/financial';
import { getPageCount } from '@/lib/types/financial';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import type { SelectOption } from '@/components/ui/Select';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import RecurringRuleFormModal from './components/RecurringRuleFormModal';
import RuleDetailModal from './components/RuleDetailModal';

// ────────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const CAN_CANCEL_ROLES = ['Owner', 'Admin'];
const CAN_TRIGGER_ROLES = ['Owner', 'Admin'];

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const FREQUENCY_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Frequencies' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: 'next_due_date', label: 'Next Due Date' },
  { value: 'amount', label: 'Amount' },
  { value: 'name', label: 'Name' },
  { value: 'created_at', label: 'Created Date' },
];

const SORT_ORDER_OPTIONS: SelectOption[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
];

const STATUS_BADGE_VARIANT: Record<RecurringRuleStatus, 'success' | 'warning' | 'info' | 'gray'> = {
  active: 'success',
  paused: 'warning',
  completed: 'info',
  cancelled: 'gray',
};

const STATUS_LABEL: Record<RecurringRuleStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const FREQUENCY_SHORT: Record<RecurringFrequency, string> = {
  daily: 'day',
  weekly: 'wk',
  monthly: 'mo',
  quarterly: 'qtr',
  annual: 'yr',
};

const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatFrequencyDisplay(rule: RecurringRule): string {
  const prefix = rule.interval > 1 ? `Every ${rule.interval} ` : '';

  switch (rule.frequency) {
    case 'daily':
      return prefix ? `${prefix}days` : 'Daily';
    case 'weekly': {
      const day = rule.day_of_week !== null ? ` on ${DAY_NAMES[rule.day_of_week]}` : '';
      return prefix ? `${prefix}weeks${day}` : `Weekly${day}`;
    }
    case 'monthly': {
      const dom = rule.day_of_month ? ` on the ${ordinal(rule.day_of_month)}` : '';
      return prefix ? `${prefix}months${dom}` : `Monthly${dom}`;
    }
    case 'quarterly': {
      const dom = rule.day_of_month ? ` on the ${ordinal(rule.day_of_month)}` : '';
      return prefix ? `${prefix}quarters${dom}` : `Quarterly${dom}`;
    }
    case 'annual': {
      const dom = rule.day_of_month ? ` on the ${ordinal(rule.day_of_month)}` : '';
      return prefix ? `${prefix}years${dom}` : `Annual${dom}`;
    }
    default:
      return rule.frequency;
  }
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string): string {
  // Parse as local date to avoid UTC→local timezone shift
  // "2026-04-01" or "2026-04-01T00:00:00.000Z" → April 1 in every timezone
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ────────────────────────────────────────────────────────────────────────────────
// Skeleton loaders
// ────────────────────────────────────────────────────────────────────────────────

function SummaryCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </Card>
  );
}

function RuleCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="animate-pulse space-y-3">
        <div className="flex justify-between">
          <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="flex gap-2 pt-1">
          <div className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-9 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────────

export default function RecurringExpensesPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canView = hasRole(CAN_VIEW_ROLES);
  const canCancel = hasRole(CAN_CANCEL_ROLES);
  const canTrigger = hasRole(CAN_TRIGGER_ROLES);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [summary, setSummary] = useState<{ total_active_rules: number; monthly_obligation: number } | null>(null);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; total_pages?: number } | null>(null);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [preview, setPreview] = useState<RecurringPreviewResponse | null>(null);
  const [summaryPreview, setSummaryPreview] = useState<RecurringPreviewResponse | null>(null);

  // ── Loading / error ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [summaryPreviewLoading, setSummaryPreviewLoading] = useState(true);

  // ── Filters & sort ─────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RecurringRuleStatus>('active');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [sortBy, setSortBy] = useState<'next_due_date' | 'amount' | 'name' | 'created_at'>('next_due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // ── Preview period ─────────────────────────────────────────────────────────
  const [previewDays, setPreviewDays] = useState<30 | 60 | 90>(30);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelingRule, setCancelingRule] = useState<RecurringRule | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [skippingRule, setSkippingRule] = useState<RecurringRule | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [skipLoading, setSkipLoading] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pausingRule, setPausingRule] = useState<RecurringRule | null>(null);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [resumingRule, setResumingRule] = useState<RecurringRule | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [triggeringRule, setTriggeringRule] = useState<RecurringRule | null>(null);
  const [triggerLoading, setTriggerLoading] = useState(false);

  // ── Detail modal ─────────────────────────────────────────────────────────
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailRuleId, setDetailRuleId] = useState<string | null>(null);

  // ── Action loading is managed per-modal (pauseLoading, resumeLoading, etc.)
  // Buttons disable when any modal loading state is active
  const anyActionLoading = pauseLoading || resumeLoading || triggerLoading || skipLoading || cancelLoading;

  // ── Reset page on filter change ────────────────────────────────────────────
  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, frequencyFilter, sortBy, sortOrder]);

  // ── Fetch rules ────────────────────────────────────────────────────────────
  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRecurringRules({
        page,
        limit: PAGE_SIZE,
        status: statusFilter,
        category_id: categoryFilter || undefined,
        frequency: (frequencyFilter as RecurringFrequency) || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setRules(response.data);
      setSummary(response.summary);
      setMeta(response.meta);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load recurring rules';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, frequencyFilter, sortBy, sortOrder]);

  // ── Fetch preview ──────────────────────────────────────────────────────────
  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const data = await getRecurringPreview(previewDays);
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewDays]);

  // ── Fetch 30-day summary preview (fixed, separate from toggle) ────────────
  const fetchSummaryPreview = useCallback(async () => {
    setSummaryPreviewLoading(true);
    try {
      const data = await getRecurringPreview(30);
      setSummaryPreview(data);
    } catch {
      setSummaryPreview(null);
    } finally {
      setSummaryPreviewLoading(false);
    }
  }, []);

  // ── Fetch categories (for filter + form) ───────────────────────────────────
  const fetchCategories = useCallback(async () => {
    try {
      const cats = await getFinancialCategories({ include_inactive: false });
      setCategories(cats);
    } catch {
      // Non-blocking — filter just won't have options
    }
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (rbacLoading || !canView) return;
    fetchRules();
  }, [fetchRules, rbacLoading, canView]);

  useEffect(() => {
    if (rbacLoading || !canView) return;
    fetchPreview();
  }, [fetchPreview, rbacLoading, canView]);

  useEffect(() => {
    if (rbacLoading || !canView) return;
    fetchSummaryPreview();
  }, [fetchSummaryPreview, rbacLoading, canView]);

  useEffect(() => {
    if (rbacLoading || !canView) return;
    fetchCategories();
  }, [fetchCategories, rbacLoading, canView]);

  // ── Category filter options ────────────────────────────────────────────────
  const categoryFilterOptions: SelectOption[] = [
    { value: '', label: 'All Categories' },
    ...categories.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name })),
  ];

  // ── Action handlers ────────────────────────────────────────────────────────
  const refreshAll = () => {
    fetchRules();
    fetchPreview();
    fetchSummaryPreview();
  };

  // ── Pause (with confirmation modal) ────────────────────────────────────────
  const openPauseModal = (rule: RecurringRule) => {
    setPausingRule(rule);
    setPauseModalOpen(true);
  };

  const handleConfirmPause = async () => {
    if (!pausingRule) return;
    setPauseLoading(true);
    try {
      await pauseRecurringRule(pausingRule.id);
      toast.success('Rule paused');
      setPauseModalOpen(false);
      setPausingRule(null);
      refreshAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to pause rule');
    } finally {
      setPauseLoading(false);
    }
  };

  // ── Resume (with confirmation modal) ─────────────────────────────────────
  const openResumeModal = (rule: RecurringRule) => {
    setResumingRule(rule);
    setResumeModalOpen(true);
  };

  const handleConfirmResume = async () => {
    if (!resumingRule) return;
    setResumeLoading(true);
    try {
      await resumeRecurringRule(resumingRule.id);
      toast.success('Rule resumed');
      setResumeModalOpen(false);
      setResumingRule(null);
      refreshAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resume rule');
    } finally {
      setResumeLoading(false);
    }
  };

  // ── Trigger Now (with confirmation modal) ────────────────────────────────
  const openTriggerModal = (rule: RecurringRule) => {
    setTriggeringRule(rule);
    setTriggerModalOpen(true);
  };

  const handleConfirmTrigger = async () => {
    if (!triggeringRule) return;
    setTriggerLoading(true);
    try {
      await triggerRecurringRule(triggeringRule.id);
      toast.success('Entry generation queued. It will appear shortly.');
      setTriggerModalOpen(false);
      setTriggeringRule(null);
      // Delayed refresh — background processing
      setTimeout(() => refreshAll(), 3000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to trigger rule');
    } finally {
      setTriggerLoading(false);
    }
  };

  // ── Skip (with modal + reason) ───────────────────────────────────────────
  const openSkipModal = (rule: RecurringRule) => {
    setSkippingRule(rule);
    setSkipReason('');
    setSkipModalOpen(true);
  };

  const handleConfirmSkip = async () => {
    if (!skippingRule) return;
    setSkipLoading(true);
    try {
      const updated = await skipRecurringRule(skippingRule.id, skipReason.trim() ? { reason: skipReason.trim() } : undefined);
      toast.success(`Next occurrence skipped. New next due: ${formatDate(updated.next_due_date)}`);
      setSkipModalOpen(false);
      setSkippingRule(null);
      refreshAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to skip occurrence');
    } finally {
      setSkipLoading(false);
    }
  };

  const openCancelModal = (rule: RecurringRule) => {
    setCancelingRule(rule);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelingRule) return;
    setCancelLoading(true);
    try {
      await cancelRecurringRule(cancelingRule.id);
      toast.success(`"${cancelingRule.name}" cancelled`);
      setCancelModalOpen(false);
      setCancelingRule(null);
      refreshAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel rule');
    } finally {
      setCancelLoading(false);
    }
  };

  const openEditModal = (rule: RecurringRule) => {
    setEditingRule(rule);
    setFormModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setFormModalOpen(true);
  };

  const handleFormSuccess = () => {
    setFormModalOpen(false);
    setEditingRule(null);
    refreshAll();
  };

  // ── Detail modal ─────────────────────────────────────────────────────────
  const openDetailModal = (rule: RecurringRule) => {
    setDetailRuleId(rule.id);
    setDetailModalOpen(true);
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = meta ? getPageCount(meta) : 1;

  // ── RBAC guards ────────────────────────────────────────────────────────────
  if (rbacLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <RefreshCw className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view recurring expenses.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─── Breadcrumb ────────────────────────────────────────────────────── */}
      <Breadcrumb
        items={[
          { label: 'Financial', href: '/financial' },
          { label: 'Recurring Expenses' },
        ]}
        showHome
      />

      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Recurring Expenses
        </h1>
        <Button onClick={openCreateModal} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Create Rule
        </Button>
      </div>

      {/* ─── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                  <Hash className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Active Rules
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {summary?.total_active_rules ?? 0}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Monthly Obligation
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(summary?.monthly_obligation ?? 0)}/mo
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30">
                  <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Next 30 Days
                  </p>
                  {summaryPreviewLoading ? (
                    <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(summaryPreview?.total_obligations ?? 0)}
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-1.5">
                        {summaryPreview?.occurrences.length ?? 0} occurrence{(summaryPreview?.occurrences.length ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ─── Filters ───────────────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select
            label="Status"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as RecurringRuleStatus)}
          />
          <Select
            label="Category"
            options={categoryFilterOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
            searchable
          />
          <Select
            label="Frequency"
            options={FREQUENCY_FILTER_OPTIONS}
            value={frequencyFilter}
            onChange={setFrequencyFilter}
          />
          <Select
            label="Sort By"
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={(v) => setSortBy(v as 'next_due_date' | 'amount' | 'name' | 'created_at')}
          />
          <Select
            label="Order"
            options={SORT_ORDER_OPTIONS}
            value={sortOrder}
            onChange={(v) => setSortOrder(v as 'asc' | 'desc')}
          />
        </div>
      </Card>

      {/* ─── Rules list ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <RuleCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertTriangle className="h-10 w-10 text-red-500 dark:text-red-400 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
              Failed to Load Rules
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
            <Button variant="secondary" onClick={fetchRules}>
              Try Again
            </Button>
          </div>
        </Card>
      ) : rules.length === 0 ? (
        <Card className="p-8 sm:p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-full bg-gray-50 dark:bg-gray-700/50 mb-4">
              <RefreshCw className="h-10 w-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
              No Recurring Rules
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
              {statusFilter === 'active'
                ? 'Set up automated recurring expenses like rent, insurance, or subscriptions to save time on repetitive entries.'
                : `No rules with status "${STATUS_LABEL[statusFilter]}".`}
            </p>
            {statusFilter === 'active' && (
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Rule
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule.id} className="p-4 sm:p-5 hover:shadow-md transition-shadow">
                {/* Header: name (clickable) + status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <button
                      type="button"
                      onClick={() => openDetailModal(rule)}
                      className="text-base font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline truncate text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                    >
                      {rule.name}
                    </button>
                  </div>
                  <Badge variant={STATUS_BADGE_VARIANT[rule.status]}>
                    {STATUS_LABEL[rule.status]}
                  </Badge>
                </div>

                {/* Info lines */}
                <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(rule.amount)}/{FREQUENCY_SHORT[rule.frequency]}
                    <span className="font-normal text-gray-500 dark:text-gray-400 ml-2">
                      {formatFrequencyDisplay(rule)}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">Category:</span>{' '}
                    {rule.category.name}
                    {(rule.vendor_name || rule.supplier?.name) && (
                      <>
                        <span className="mx-1.5 text-gray-300 dark:text-gray-600">|</span>
                        <span className="text-gray-500 dark:text-gray-400">Vendor:</span>{' '}
                        {rule.vendor_name || rule.supplier?.name}
                      </>
                    )}
                  </p>
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">Next due:</span>{' '}
                    {formatDate(rule.next_due_date)}
                    <span className="mx-1.5 text-gray-300 dark:text-gray-600">|</span>
                    <span className="text-gray-500 dark:text-gray-400">Generated:</span>{' '}
                    {rule.occurrences_generated} so far
                  </p>
                  {rule.auto_confirm && (
                    <p className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                      Auto-confirm
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100 dark:border-gray-700/50">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openDetailModal(rule)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {rule.status === 'active' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openPauseModal(rule)}
                        disabled={anyActionLoading}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openSkipModal(rule)}
                        disabled={anyActionLoading}
                      >
                        <SkipForward className="h-4 w-4 mr-1" />
                        Skip
                      </Button>
                      {canTrigger && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openTriggerModal(rule)}
                          disabled={anyActionLoading}
                        >
                          <Zap className="h-4 w-4 mr-1" />
                          Trigger Now
                        </Button>
                      )}
                    </>
                  )}
                  {rule.status === 'paused' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openResumeModal(rule)}
                      disabled={anyActionLoading}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Resume
                    </Button>
                  )}
                  {(rule.status === 'active' || rule.status === 'paused') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditModal(rule)}
                      disabled={anyActionLoading}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {canCancel && (rule.status === 'active' || rule.status === 'paused') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openCancelModal(rule)}
                      disabled={anyActionLoading}
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onNext={() => setPage((p) => Math.min(p + 1, totalPages))}
              onPrevious={() => setPage((p) => Math.max(p - 1, 1))}
            />
          )}
        </>
      )}

      {/* ─── Upcoming Obligations Preview ──────────────────────────────────── */}
      <div className="pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            Upcoming Obligations Preview
          </h2>
          <div className="flex gap-2">
            {([30, 60, 90] as const).map((days) => (
              <Button
                key={days}
                size="sm"
                variant={previewDays === days ? 'primary' : 'secondary'}
                onClick={() => setPreviewDays(days)}
              >
                {days} days
              </Button>
            ))}
          </div>
        </div>

        {previewLoading ? (
          <Card className="p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-5 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              ))}
            </div>
          </Card>
        ) : preview && preview.occurrences.length > 0 ? (
          <Card className="overflow-hidden">
            {/* Total bar */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Total obligations in next {preview.period_days} days:{' '}
                <span className="text-blue-600 dark:text-blue-400">
                  {formatCurrency(preview.total_obligations)}
                </span>
              </p>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Rule Name</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Frequency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {preview.occurrences.map((occ, idx) => (
                    <tr
                      key={`${occ.rule_id}-${occ.due_date}-${idx}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatDate(occ.due_date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {occ.rule_name}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right whitespace-nowrap">
                        {formatCurrency(occ.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {occ.category_name}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="info" className="capitalize">
                          {occ.frequency}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {preview.occurrences.map((occ, idx) => (
                <div key={`${occ.rule_id}-${occ.due_date}-${idx}`} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {occ.rule_name}
                    </span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(occ.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatDate(occ.due_date)}</span>
                    <span>{occ.category_name}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <Calendar className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No upcoming obligations in the next {previewDays} days
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* ─── Create / Edit Modal ───────────────────────────────────────────── */}
      <RecurringRuleFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingRule(null);
        }}
        onSuccess={handleFormSuccess}
        rule={editingRule}
        categories={categories}
      />

      {/* ─── Pause Confirmation Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={pauseModalOpen}
        onClose={() => !pauseLoading && setPauseModalOpen(false)}
        title="Pause Rule"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Pause <span className="font-semibold text-gray-900 dark:text-gray-100">&quot;{pausingRule?.name}&quot;</span>?
            No entries will be generated while paused.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setPauseModalOpen(false)} disabled={pauseLoading}>
              Keep Active
            </Button>
            <Button onClick={handleConfirmPause} loading={pauseLoading}>
              <Pause className="h-4 w-4 mr-1.5" />
              Pause Rule
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Resume Confirmation Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={resumeModalOpen}
        onClose={() => !resumeLoading && setResumeModalOpen(false)}
        title="Resume Rule"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Resume <span className="font-semibold text-gray-900 dark:text-gray-100">&quot;{resumingRule?.name}&quot;</span>?
            Entry generation will restart.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setResumeModalOpen(false)} disabled={resumeLoading}>
              Keep Paused
            </Button>
            <Button onClick={handleConfirmResume} loading={resumeLoading}>
              <Play className="h-4 w-4 mr-1.5" />
              Resume Rule
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Trigger Now Confirmation Modal ────────────────────────────────── */}
      <Modal
        isOpen={triggerModalOpen}
        onClose={() => !triggerLoading && setTriggerModalOpen(false)}
        title="Generate Entry Now"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            This will immediately generate the next entry for{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              &quot;{triggeringRule?.name}&quot;
            </span>.
          </p>
          {triggeringRule && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(triggeringRule.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Category:</span>
                <span className="text-gray-900 dark:text-gray-100">{triggeringRule.category.name}</span>
              </div>
              {(triggeringRule.vendor_name || triggeringRule.supplier?.name) && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Vendor:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {triggeringRule.vendor_name || triggeringRule.supplier?.name}
                  </span>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The entry will be processed in the background and may take a few seconds to appear.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setTriggerModalOpen(false)} disabled={triggerLoading}>
              Cancel
            </Button>
            <Button onClick={handleConfirmTrigger} loading={triggerLoading}>
              <Zap className="h-4 w-4 mr-1.5" />
              Generate Entry
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Skip Occurrence Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={skipModalOpen}
        onClose={() => !skipLoading && setSkipModalOpen(false)}
        title="Skip Next Occurrence"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Skip the next occurrence of{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              &quot;{skippingRule?.name}&quot;
            </span>
            {skippingRule && (
              <>
                {' '}scheduled for{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatDate(skippingRule.next_due_date)}
                </span>
              </>
            )}
            ?
          </p>

          <Textarea
            label="Reason (optional)"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            maxLength={500}
            showCharacterCount
            placeholder="Why are you skipping this occurrence?"
            rows={3}
            resize="none"
          />

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => setSkipModalOpen(false)}
              disabled={skipLoading}
            >
              Keep It
            </Button>
            <Button
              variant="secondary"
              onClick={handleConfirmSkip}
              loading={skipLoading}
            >
              <SkipForward className="h-4 w-4 mr-1.5" />
              Skip Occurrence
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Cancel Rule Modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => !cancelLoading && setCancelModalOpen(false)}
        title="Cancel Recurring Rule"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p>
                Are you sure you want to cancel{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  &quot;{cancelingRule?.name}&quot;
                </span>
                ?
              </p>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                No more entries will be generated. Previously generated entries will NOT be deleted.
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelLoading}
            >
              Keep Rule
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              loading={cancelLoading}
            >
              Cancel Rule
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Rule Detail Modal ─────────────────────────────────────────────── */}
      <RuleDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setDetailRuleId(null);
        }}
        ruleId={detailRuleId}
        onRuleChanged={refreshAll}
      />
    </div>
  );
}
