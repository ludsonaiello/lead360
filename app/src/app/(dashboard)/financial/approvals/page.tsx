/**
 * Financial Approvals Page
 * Sprint 10 — Expense approval queue for managers/admins
 * Pending entries with approve/reject workflow, filters, pagination
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  ArrowLeft,
  Shield,
  DollarSign,
  Users,
  Calendar,
  Tag,
  FolderOpen,
  User,
  CreditCard,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
  Paperclip,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { PaginationControls } from '@/components/ui/PaginationControls';

import {
  getPendingEntries,
  getFinancialEntry,
} from '@/lib/api/financial';
import { listUsers } from '@/lib/api/users';
import type {
  FinancialEntry,
  FinancialEntryListResponse,
  ListPendingEntriesParams,
} from '@/lib/types/financial';
import { getPageCount } from '@/lib/types/financial';
import type { MembershipItem } from '@/lib/types/users';

import { EntryDetailModal } from '../entries/components/EntryDetailModal';
import { ApproveModal } from './components/ApproveModal';
import { RejectModal } from './components/RejectModal';

// ========== CONSTANTS ==========

const PAGE_SIZE = 20;
const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];

const CATEGORY_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  labor: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300' },
  material: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300' },
  subcontractor: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300' },
  equipment: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-300' },
  insurance: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-800 dark:text-cyan-300' },
  fuel: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300' },
  utilities: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-800 dark:text-teal-300' },
  office: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-300' },
  marketing: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-800 dark:text-pink-300' },
  taxes: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300' },
  tools: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-300' },
  other: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-300' },
};

// ========== HELPERS ==========

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatPaymentMethod(method: string | null, nickname: string | null): string | null {
  if (!method) return null;
  const label = method
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  if (nickname) return `${label} — ${nickname}`;
  return label;
}

/** Count unique submitters from entries list */
function countUniqueSubmitters(entries: FinancialEntry[]): number {
  const ids = new Set(entries.map((e) => e.created_by_user_id));
  return ids.size;
}

// ========== SUMMARY CARD ==========

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  colorClass: string;
}

function SummaryCard({ label, value, icon, colorClass }: SummaryCardProps) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colorClass} flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{label}</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-28" />
        </div>
      </div>
    </Card>
  );
}

// ========== PENDING ENTRY CARD ==========

interface PendingEntryCardProps {
  entry: FinancialEntry;
  onApprove: (entry: FinancialEntry) => void;
  onReject: (entry: FinancialEntry) => void;
  onView: (entry: FinancialEntry) => void;
}

function PendingEntryCard({ entry, onApprove, onReject, onView }: PendingEntryCardProps) {
  const amount = parseFloat(entry.amount);
  const isExpense = entry.entry_type === 'expense';
  const typeColors = CATEGORY_TYPE_COLORS[entry.category_type] || CATEGORY_TYPE_COLORS.other;
  const paymentDisplay = formatPaymentMethod(entry.payment_method, entry.payment_method_nickname);
  const isRejected = entry.submission_status === 'denied';
  const purchasedBy = entry.purchased_by_user_name || entry.purchased_by_crew_member_name;

  return (
    <Card className="p-4 sm:p-5 hover:shadow-md transition-shadow flex flex-col">
      {/* Header: Date + Amount */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0">
            <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {formatDate(entry.entry_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isExpense ? (
            <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
          ) : (
            <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
          )}
          <span className={`text-lg font-bold ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {formatCurrency(amount)}
          </span>
        </div>
      </div>

      {/* Category with type badge */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${typeColors.bg} ${typeColors.text}`}>
          <Tag className="w-3 h-3" />
          {entry.category_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {entry.category_name}
        </span>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 mb-3 flex-1">
        {/* Project */}
        {entry.project_name && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">
              {entry.project_name}
              {entry.task_title && <span className="text-gray-400 dark:text-gray-500"> — {entry.task_title}</span>}
            </span>
          </div>
        )}

        {/* Submitted by */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <User className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">Submitted by {entry.created_by_name}</span>
        </div>

        {/* Vendor / Supplier */}
        {(entry.supplier_name || entry.vendor_name) && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Tag className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{entry.supplier_name || entry.vendor_name}</span>
          </div>
        )}

        {/* Payment Method */}
        {paymentDisplay && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{paymentDisplay}</span>
          </div>
        )}

        {/* Purchased by */}
        {purchasedBy && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <User className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Purchased by {purchasedBy}</span>
          </div>
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <Badge variant="warning" icon={Clock} label="Pending Review" />
        {entry.has_receipt && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400" title="Has receipt">
            <Paperclip className="w-3.5 h-3.5" />
            Receipt
          </span>
        )}
        {entry.is_recurring_instance && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400" title="Recurring entry">
            <RefreshCw className="w-3.5 h-3.5" />
            Recurring
          </span>
        )}
      </div>

      {/* Rejection Warning Banner */}
      {isRejected && (
        <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                Previously Rejected
              </p>
              {entry.rejection_reason && (
                <p className="text-sm text-amber-700 dark:text-amber-300/80 break-words">
                  &ldquo;{entry.rejection_reason}&rdquo;
                </p>
              )}
              <div className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                {entry.rejected_by_name && (
                  <p>Rejected by {entry.rejected_by_name}</p>
                )}
                {entry.rejected_at && (
                  <p>{formatDateTime(entry.rejected_at)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="primary"
          size="sm"
          onClick={() => onApprove(entry)}
          className="flex-1 min-w-[70px]"
        >
          <CheckCircle2 className="w-4 h-4" />
          Approve
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onReject(entry)}
          className="flex-1 min-w-[70px]"
        >
          <XCircle className="w-4 h-4" />
          Reject
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onView(entry)}
          className="flex-1 min-w-[70px]"
        >
          <Eye className="w-4 h-4" />
          View
        </Button>
      </div>
    </Card>
  );
}

// ========== ENTRY CARD SKELETON ==========

function PendingEntryCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        </div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20" />
      </div>
      <div className="flex gap-2 mb-3">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-28" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
      <div className="flex gap-2 mb-3">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
      </div>
      <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
      </div>
    </Card>
  );
}

// ========== MAIN PAGE ==========

export default function FinancialApprovalsPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canView = hasRole(CAN_VIEW_ROLES);

  // Data state
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [summary, setSummary] = useState<FinancialEntryListResponse['summary'] | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Supporting data for filters
  const [users, setUsers] = useState<MembershipItem[]>([]);

  // Filters
  const [submitterFilter, setSubmitterFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Detail modal
  const [detailEntry, setDetailEntry] = useState<FinancialEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Approve modal
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [entryToApprove, setEntryToApprove] = useState<FinancialEntry | null>(null);

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [entryToReject, setEntryToReject] = useState<FinancialEntry | null>(null);

  // Load supporting data (users for submitter filter)
  useEffect(() => {
    if (!canView) return;
    listUsers({ limit: 100 })
      .then((res) => setUsers(res.data))
      .catch((err) => console.error('Failed to load users:', err));
  }, [canView]);

  // Load pending entries
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const params: ListPendingEntriesParams = {
      page: currentPage,
      limit: PAGE_SIZE,
    };

    if (submitterFilter) params.submitted_by_user_id = submitterFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    try {
      const result = await getPendingEntries(params);
      setEntries(result.data);
      setSummary(result.summary);
      setTotalItems(result.meta.total);
      setTotalPages(getPageCount(result.meta));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load pending entries';
      setFetchError(message);
      console.error('Failed to load pending entries:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, submitterFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (canView) loadEntries();
  }, [canView, loadEntries]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [submitterFilter, dateFrom, dateTo]);

  // Compute unique submitter count from current list (best-effort from current page)
  const uniqueSubmitters = countUniqueSubmitters(entries);

  // Total pending amount (expenses + income from summary)
  const totalPendingAmount = (summary?.total_expenses ?? 0) + (summary?.total_income ?? 0);

  // Handlers
  const handleApproveClick = (entry: FinancialEntry) => {
    setEntryToApprove(entry);
    setApproveModalOpen(true);
  };

  const handleRejectClick = (entry: FinancialEntry) => {
    setEntryToReject(entry);
    setRejectModalOpen(true);
  };

  const handleView = async (entry: FinancialEntry) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const full = await getFinancialEntry(entry.id);
      setDetailEntry(full);
    } catch {
      toast.error('Failed to load entry details');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApproveSuccess = () => {
    loadEntries();
  };

  const handleRejectSuccess = () => {
    loadEntries();
  };

  // Clear filters
  const handleClearFilters = () => {
    setSubmitterFilter('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const activeFilterCount = [submitterFilter, dateFrom, dateTo].filter(Boolean).length;

  // Filter options
  const submitterOptions = [
    { value: '', label: 'All Submitters' },
    ...users.map((u) => ({ value: u.user_id, label: `${u.first_name} ${u.last_name}` })),
  ];

  // ======= RENDER GUARDS =======

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
        <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          You don&apos;t have permission to view expense approvals.
        </p>
      </div>
    );
  }

  // ======= MAIN RENDER =======

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Breadcrumb */}
        <div>
          <Link
            href="/financial"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Financial
          </Link>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Expense Approvals
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Review and approve pending expense submissions
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {loading && !summary ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              <SummaryCard
                label="Pending"
                value={String(summary?.entry_count ?? 0)}
                icon={<Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
                colorClass="bg-amber-50 dark:bg-amber-900/30"
              />
              <SummaryCard
                label="Total Amount"
                value={formatCurrency(totalPendingAmount)}
                icon={<DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                colorClass="bg-blue-50 dark:bg-blue-900/30"
              />
              <SummaryCard
                label="Submitted By"
                value={`${uniqueSubmitters} user${uniqueSubmitters !== 1 ? 's' : ''}`}
                icon={<Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
                colorClass="bg-purple-50 dark:bg-purple-900/30"
              />
            </>
          )}
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <Select
                label="Submitted By"
                options={submitterOptions}
                value={submitterFilter}
                onChange={setSubmitterFilter}
                placeholder="All Submitters"
                searchable={users.length > 5}
              />
            </div>
            <div className="flex-1 w-full">
              <DatePicker
                label="Date From"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1 w-full">
              <DatePicker
                label="Date To"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            {activeFilterCount > 0 && (
              <div className="flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Error State */}
        {fetchError && (
          <Card className="p-6">
            <div className="flex flex-col items-center text-center">
              <AlertTriangle className="h-10 w-10 text-red-500 dark:text-red-400 mb-3" />
              <p className="text-gray-700 dark:text-gray-300 mb-4">{fetchError}</p>
              <Button variant="primary" size="sm" onClick={loadEntries}>
                Retry
              </Button>
            </div>
          </Card>
        )}

        {/* Loading Skeleton */}
        {loading && !fetchError && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <PendingEntryCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !fetchError && entries.length === 0 && (
          <Card className="p-8 sm:p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-green-50 dark:bg-green-900/30 mb-4">
                <CheckSquare className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Pending Entries
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                {activeFilterCount > 0
                  ? 'No entries match your current filters. Try adjusting or clearing filters.'
                  : 'All caught up! There are no pending entries for review.'}
              </p>
              {activeFilterCount > 0 && (
                <Button variant="secondary" size="sm" onClick={handleClearFilters} className="mt-4">
                  Clear Filters
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Entry Cards Grid */}
        {!loading && !fetchError && entries.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {entries.map((entry) => (
                <PendingEntryCard
                  key={entry.id}
                  entry={entry}
                  onApprove={handleApproveClick}
                  onReject={handleRejectClick}
                  onView={handleView}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onNext={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                onPrevious={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                onGoToPage={setCurrentPage}
              />
            )}

            {/* Results count */}
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Showing {entries.length} of {totalItems} pending {totalItems === 1 ? 'entry' : 'entries'}
            </p>
          </>
        )}
      </div>

      {/* Modals */}
      <ApproveModal
        isOpen={approveModalOpen}
        onClose={() => { setApproveModalOpen(false); setEntryToApprove(null); }}
        onSuccess={handleApproveSuccess}
        entry={entryToApprove}
      />

      <RejectModal
        isOpen={rejectModalOpen}
        onClose={() => { setRejectModalOpen(false); setEntryToReject(null); }}
        onSuccess={handleRejectSuccess}
        entry={entryToReject}
      />

      <EntryDetailModal
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setDetailEntry(null); }}
        entry={detailEntry}
        loading={detailLoading}
      />
    </>
  );
}
