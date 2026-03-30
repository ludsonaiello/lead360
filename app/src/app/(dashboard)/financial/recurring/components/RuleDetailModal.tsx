'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Pause,
  Play,
  SkipForward,
  Zap,
  XCircle,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  CreditCard,
  Hash,
  FileText,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getRecurringRule,
  getRecurringRuleHistory,
  pauseRecurringRule,
  resumeRecurringRule,
  triggerRecurringRule,
  skipRecurringRule,
  cancelRecurringRule,
} from '@/lib/api/financial';
import type {
  RecurringRuleDetail,
  RecurringRuleStatus,
  RecurringFrequency,
  FinancialEntry,
  SubmissionStatus,
} from '@/lib/types/financial';
import { getPageCount } from '@/lib/types/financial';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { PaginationControls } from '@/components/ui/PaginationControls';

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

interface RuleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleId: string | null;
  onRuleChanged: () => void; // Callback to refresh parent list after any action
}

// ────────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────────

const CAN_ACTION_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const CAN_TRIGGER_CANCEL_ROLES = ['Owner', 'Admin'];
const HISTORY_PAGE_SIZE = 10;

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

const SUBMISSION_STATUS_VARIANT: Record<SubmissionStatus, 'success' | 'warning' | 'danger'> = {
  confirmed: 'success',
  pending_review: 'warning',
  denied: 'danger',
};

const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  confirmed: 'Confirmed',
  pending_review: 'Pending Review',
  denied: 'Denied',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFrequencyDisplay(rule: RecurringRuleDetail): string {
  const prefix = rule.interval > 1 ? `Every ${rule.interval} ` : 'Every ';

  switch (rule.frequency) {
    case 'daily':
      return rule.interval > 1 ? `${prefix}days` : 'Daily';
    case 'weekly': {
      const day = rule.day_of_week !== null ? ` on ${DAY_NAMES[rule.day_of_week]}` : '';
      return rule.interval > 1 ? `${prefix}weeks${day}` : `Weekly${day}`;
    }
    case 'monthly': {
      const dom = rule.day_of_month ? ` on the ${ordinal(rule.day_of_month)}` : '';
      return rule.interval > 1 ? `${prefix}months${dom}` : `Monthly${dom}`;
    }
    case 'quarterly': {
      const dom = rule.day_of_month ? ` on the ${ordinal(rule.day_of_month)}` : '';
      return rule.interval > 1 ? `${prefix}quarters${dom}` : `Quarterly${dom}`;
    }
    case 'annual': {
      const dom = rule.day_of_month ? ` on the ${ordinal(rule.day_of_month)}` : '';
      return rule.interval > 1 ? `${prefix}years${dom}` : `Annually${dom}`;
    }
    default:
      return rule.frequency;
  }
}

const FREQUENCY_UNIT: Record<RecurringFrequency, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  annual: 'year',
};

// ────────────────────────────────────────────────────────────────────────────────
// Skeleton
// ────────────────────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-1">
      <div className="flex items-center gap-3">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
      <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// History table row skeleton
// ────────────────────────────────────────────────────────────────────────────────

function HistoryRowSkeleton() {
  return (
    <div className="animate-pulse flex items-center justify-between p-3">
      <div className="flex items-center gap-4">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────────

export default function RuleDetailModal({ isOpen, onClose, ruleId, onRuleChanged }: RuleDetailModalProps) {
  const { hasRole } = useRBAC();
  const canAction = hasRole(CAN_ACTION_ROLES);
  const canTriggerCancel = hasRole(CAN_TRIGGER_CANCEL_ROLES);

  // ── Rule detail state ──────────────────────────────────────────────────────
  const [rule, setRule] = useState<RecurringRuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── History state ──────────────────────────────────────────────────────────
  const [history, setHistory] = useState<FinancialEntry[]>([]);
  const [historyMeta, setHistoryMeta] = useState<{ total: number; page: number; limit: number; total_pages?: number } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  // Input values — what the user types in the date pickers
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  // Committed values — what the API actually filters on (only updated on Apply/Clear)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Action modals ──────────────────────────────────────────────────────────
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [skipReason, setSkipReason] = useState('');

  // ── Action loading ─────────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Fetch rule detail ──────────────────────────────────────────────────────
  const fetchRule = useCallback(async () => {
    if (!ruleId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getRecurringRule(ruleId);
      setRule(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load rule details';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [ruleId]);

  // ── Fetch history ──────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!ruleId) return;
    setHistoryLoading(true);
    try {
      const response = await getRecurringRuleHistory(ruleId, {
        page: historyPage,
        limit: HISTORY_PAGE_SIZE,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setHistory(response.data);
      setHistoryMeta(response.meta);
    } catch {
      setHistory([]);
      setHistoryMeta(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [ruleId, historyPage, dateFrom, dateTo]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && ruleId) {
      setHistoryPage(1);
      setDateFromInput('');
      setDateToInput('');
      setDateFrom('');
      setDateTo('');
      fetchRule();
    }
  }, [isOpen, ruleId, fetchRule]);

  useEffect(() => {
    if (isOpen && ruleId) {
      fetchHistory();
    }
  }, [isOpen, ruleId, fetchHistory]);

  // ── Action handlers ────────────────────────────────────────────────────────
  const handlePause = async () => {
    if (!rule) return;
    setActionLoading('pause');
    try {
      await pauseRecurringRule(rule.id);
      toast.success('Rule paused');
      setPauseModalOpen(false);
      fetchRule();
      onRuleChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to pause rule');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    if (!rule) return;
    setActionLoading('resume');
    try {
      await resumeRecurringRule(rule.id);
      toast.success('Rule resumed');
      setResumeModalOpen(false);
      fetchRule();
      onRuleChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resume rule');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTrigger = async () => {
    if (!rule) return;
    setActionLoading('trigger');
    try {
      await triggerRecurringRule(rule.id);
      toast.success('Entry generation queued. It will appear shortly.');
      setTriggerModalOpen(false);
      // Delayed refresh — background processing takes time
      setTimeout(() => {
        fetchRule();
        fetchHistory();
        onRuleChanged();
      }, 3000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to trigger rule');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSkip = async () => {
    if (!rule) return;
    setActionLoading('skip');
    try {
      const updated = await skipRecurringRule(rule.id, skipReason.trim() ? { reason: skipReason.trim() } : undefined);
      toast.success(`Next occurrence skipped. New next due: ${formatDate(updated.next_due_date)}`);
      setSkipModalOpen(false);
      setSkipReason('');
      fetchRule();
      onRuleChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to skip occurrence');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!rule) return;
    setActionLoading('cancel');
    try {
      await cancelRecurringRule(rule.id);
      toast.success('Rule cancelled');
      setCancelModalOpen(false);
      fetchRule();
      onRuleChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel rule');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDateFilterApply = () => {
    // Commit input values to the actual filter state — useEffect handles the refetch
    setDateFrom(dateFromInput);
    setDateTo(dateToInput);
    setHistoryPage(1);
  };

  const handleDateFilterClear = () => {
    setDateFromInput('');
    setDateToInput('');
    setDateFrom('');
    setDateTo('');
    setHistoryPage(1);
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const historyTotalPages = historyMeta ? getPageCount(historyMeta) : 1;
  const isActionable = rule && (rule.status === 'active' || rule.status === 'paused');

  // ── Info row helper ────────────────────────────────────────────────────────
  function InfoRow({ icon: Icon, label, value, iconColor }: { icon: React.ElementType; label: string; value: React.ReactNode; iconColor?: string }) {
    return (
      <div className="flex items-start gap-3 py-2">
        <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${iconColor || 'text-gray-400 dark:text-gray-500'}`} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">{value}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Rule Details" size="lg">
        {loading ? (
          <DetailSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-red-500 dark:text-red-400 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Failed to Load</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <Button variant="secondary" onClick={fetchRule}>Try Again</Button>
          </div>
        ) : rule ? (
          <div className="space-y-6">
            {/* ─── Header: Name + Status ────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {rule.name}
                </h2>
              </div>
              <Badge variant={STATUS_BADGE_VARIANT[rule.status]}>
                {STATUS_LABEL[rule.status]}
              </Badge>
            </div>

            {/* ─── Description ──────────────────────────────────────────────── */}
            {rule.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{rule.description}</p>
            )}

            {/* ─── Core Info Grid ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <InfoRow
                icon={DollarSign}
                label="Amount"
                iconColor="text-green-500 dark:text-green-400"
                value={
                  <span>
                    {formatCurrency(rule.amount)}/{FREQUENCY_UNIT[rule.frequency]}
                    {rule.tax_amount && parseFloat(rule.tax_amount) > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        +{formatCurrency(rule.tax_amount)} tax
                      </span>
                    )}
                  </span>
                }
              />
              <InfoRow
                icon={FileText}
                label="Category"
                iconColor="text-purple-500 dark:text-purple-400"
                value={rule.category.name}
              />
              <InfoRow
                icon={Building2}
                label="Vendor"
                iconColor="text-orange-500 dark:text-orange-400"
                value={rule.vendor_name || rule.supplier?.name || <span className="text-gray-400 dark:text-gray-500 italic">None</span>}
              />
              <InfoRow
                icon={CreditCard}
                label="Payment Method"
                iconColor="text-blue-500 dark:text-blue-400"
                value={rule.payment_method?.nickname || <span className="text-gray-400 dark:text-gray-500 italic">None</span>}
              />
            </div>

            {/* ─── Schedule Section ─────────────────────────────────────────── */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                Schedule
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Frequency:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatFrequencyDisplay(rule)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Started:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(rule.start_date)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">End date:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {rule.end_date ? formatDate(rule.end_date) : 'No end date'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Auto-confirm:</span>{' '}
                  {rule.auto_confirm ? (
                    <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                    </span>
                  ) : (
                    <span className="font-medium text-gray-900 dark:text-gray-100">No</span>
                  )}
                </div>
                {rule.recurrence_count && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Max occurrences:</span>{' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">{rule.recurrence_count}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Progress Section ─────────────────────────────────────────── */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <Hash className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                Progress
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Generated:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {rule.occurrences_generated} {rule.occurrences_generated === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Next due:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(rule.next_due_date)}</span>
                </div>
              </div>

              {/* Upcoming preview */}
              {rule.next_occurrence_preview && rule.next_occurrence_preview.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Upcoming
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {rule.next_occurrence_preview.map((dateStr, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg"
                      >
                        <ChevronRight className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                        {formatDate(dateStr)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last generated entry */}
              {rule.last_generated_entry && (
                <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Last Generated Entry
                  </p>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      <span className="font-medium">{formatDate(rule.last_generated_entry.entry_date)}</span>
                      <span className="mx-2 text-gray-300 dark:text-gray-600">&mdash;</span>
                      <span className="font-semibold">{formatCurrency(rule.last_generated_entry.amount)}</span>
                    </div>
                    <Badge variant={SUBMISSION_STATUS_VARIANT[rule.last_generated_entry.submission_status]}>
                      {SUBMISSION_STATUS_LABEL[rule.last_generated_entry.submission_status]}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Notes ────────────────────────────────────────────────────── */}
            {rule.notes && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Notes</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{rule.notes}</p>
              </div>
            )}

            {/* ─── Action Buttons ───────────────────────────────────────────── */}
            {isActionable && canAction && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                {/* Primary actions — equal-width columns on mobile, inline on desktop */}
                {rule.status === 'active' && (
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPauseModalOpen(true)}
                      disabled={actionLoading !== null}
                    >
                      <Pause className="h-4 w-4 mr-1.5 flex-shrink-0" />
                      Pause
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSkipModalOpen(true)}
                      disabled={actionLoading !== null}
                    >
                      <SkipForward className="h-4 w-4 mr-1.5 flex-shrink-0" />
                      Skip Next
                    </Button>
                    {canTriggerCancel && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setTriggerModalOpen(true)}
                        disabled={actionLoading !== null}
                        className="col-span-2 sm:col-auto"
                      >
                        <Zap className="h-4 w-4 mr-1.5 flex-shrink-0" />
                        Trigger Now
                      </Button>
                    )}
                  </div>
                )}
                {rule.status === 'paused' && (
                  <div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setResumeModalOpen(true)}
                      disabled={actionLoading !== null}
                      className="w-full sm:w-auto"
                    >
                      <Play className="h-4 w-4 mr-1.5 flex-shrink-0" />
                      Resume
                    </Button>
                  </div>
                )}
                {/* Cancel — always its own row, danger styling */}
                {canTriggerCancel && (
                  <div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setCancelModalOpen(true)}
                      disabled={actionLoading !== null}
                      className="w-full sm:w-auto"
                    >
                      <XCircle className="h-4 w-4 mr-1.5 flex-shrink-0" />
                      Cancel Rule
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ─── Entry History Section ────────────────────────────────────── */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  Entry History
                  {historyMeta && (
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                      ({historyMeta.total} {historyMeta.total === 1 ? 'entry' : 'entries'})
                    </span>
                  )}
                </h3>
              </div>

              {/* Date range filter */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="From"
                    type="date"
                    value={dateFromInput}
                    onChange={(e) => setDateFromInput(e.target.value)}
                  />
                  <Input
                    label="To"
                    type="date"
                    value={dateToInput}
                    onChange={(e) => setDateToInput(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="secondary" onClick={handleDateFilterApply}>
                    Apply Filter
                  </Button>
                  {(dateFromInput || dateToInput) && (
                    <Button size="sm" variant="ghost" onClick={handleDateFilterClear}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {historyLoading ? (
                <div className="space-y-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <HistoryRowSkeleton key={i} />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {dateFrom || dateTo
                      ? 'No entries found for the selected date range.'
                      : 'No entries have been generated by this rule yet.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5 text-right">Amount</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Category</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {history.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              {formatDate(entry.entry_date)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right whitespace-nowrap">
                              {formatCurrency(entry.amount)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={SUBMISSION_STATUS_VARIANT[entry.submission_status]}>
                                {SUBMISSION_STATUS_LABEL[entry.submission_status]}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                              {entry.category_name}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatDate(entry.entry_date)}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {formatCurrency(entry.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{entry.category_name}</span>
                          <Badge variant={SUBMISSION_STATUS_VARIANT[entry.submission_status]}>
                            {SUBMISSION_STATUS_LABEL[entry.submission_status]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {historyTotalPages > 1 && (
                    <div className="mt-4">
                      <PaginationControls
                        currentPage={historyPage}
                        totalPages={historyTotalPages}
                        onNext={() => setHistoryPage((p) => Math.min(p + 1, historyTotalPages))}
                        onPrevious={() => setHistoryPage((p) => Math.max(p - 1, 1))}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ─── Footer: Close button ─────────────────────────────────────── */}
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ═══ Pause Confirmation Modal ═══════════════════════════════════════════ */}
      <Modal
        isOpen={pauseModalOpen}
        onClose={() => actionLoading !== 'pause' && setPauseModalOpen(false)}
        title="Pause Rule"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Pause <span className="font-semibold text-gray-900 dark:text-gray-100">&quot;{rule?.name}&quot;</span>?
            No entries will be generated while paused.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setPauseModalOpen(false)} disabled={actionLoading === 'pause'}>
              Keep Active
            </Button>
            <Button onClick={handlePause} loading={actionLoading === 'pause'}>
              <Pause className="h-4 w-4 mr-1.5" />
              Pause Rule
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══ Resume Confirmation Modal ══════════════════════════════════════════ */}
      <Modal
        isOpen={resumeModalOpen}
        onClose={() => actionLoading !== 'resume' && setResumeModalOpen(false)}
        title="Resume Rule"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Resume <span className="font-semibold text-gray-900 dark:text-gray-100">&quot;{rule?.name}&quot;</span>?
            Entry generation will restart.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setResumeModalOpen(false)} disabled={actionLoading === 'resume'}>
              Keep Paused
            </Button>
            <Button onClick={handleResume} loading={actionLoading === 'resume'}>
              <Play className="h-4 w-4 mr-1.5" />
              Resume Rule
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══ Trigger Now Confirmation Modal ═════════════════════════════════════ */}
      <Modal
        isOpen={triggerModalOpen}
        onClose={() => actionLoading !== 'trigger' && setTriggerModalOpen(false)}
        title="Generate Entry Now"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            This will immediately generate the next entry for{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">&quot;{rule?.name}&quot;</span>.
          </p>
          {rule && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(rule.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Category:</span>
                <span className="text-gray-900 dark:text-gray-100">{rule.category.name}</span>
              </div>
              {(rule.vendor_name || rule.supplier?.name) && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Vendor:</span>
                  <span className="text-gray-900 dark:text-gray-100">{rule.vendor_name || rule.supplier?.name}</span>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The entry will be processed in the background and may take a few seconds to appear.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setTriggerModalOpen(false)} disabled={actionLoading === 'trigger'}>
              Cancel
            </Button>
            <Button onClick={handleTrigger} loading={actionLoading === 'trigger'}>
              <Zap className="h-4 w-4 mr-1.5" />
              Generate Entry
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══ Skip Next Occurrence Modal ═════════════════════════════════════════ */}
      <Modal
        isOpen={skipModalOpen}
        onClose={() => {
          if (actionLoading !== 'skip') {
            setSkipModalOpen(false);
            setSkipReason('');
          }
        }}
        title="Skip Next Occurrence"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Skip the next occurrence of{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">&quot;{rule?.name}&quot;</span>
            {rule && (
              <>
                {' '}scheduled for{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(rule.next_due_date)}</span>
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
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => { setSkipModalOpen(false); setSkipReason(''); }}
              disabled={actionLoading === 'skip'}
            >
              Keep It
            </Button>
            <Button variant="secondary" onClick={handleSkip} loading={actionLoading === 'skip'}>
              <SkipForward className="h-4 w-4 mr-1.5" />
              Skip Occurrence
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══ Cancel Rule Modal ══════════════════════════════════════════════════ */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => actionLoading !== 'cancel' && setCancelModalOpen(false)}
        title="Cancel Recurring Rule"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p>
                Are you sure you want to cancel{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">&quot;{rule?.name}&quot;</span>?
              </p>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                No more entries will be generated. Previously generated entries will NOT be deleted.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setCancelModalOpen(false)} disabled={actionLoading === 'cancel'}>
              Keep Rule
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={actionLoading === 'cancel'}>
              Cancel Rule
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
