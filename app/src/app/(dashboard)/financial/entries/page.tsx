/**
 * Financial Entries List Page
 * Sprint 8 — Advanced filters, summary cards, entry cards, detail modal, RBAC delete
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Receipt as ReceiptIcon,
  Plus,
  Search,
  ArrowLeft,
  ArrowUpDown,
  Shield,
  DollarSign,
  TrendingUp,
  FileText,
  Hash,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { PaginationControls } from '@/components/ui/PaginationControls';
import {
  getFinancialEntries,
  getFinancialCategories,
  getSuppliers,
  deleteFinancialEntry,
  getFinancialEntry,
  exportEntries,
} from '@/lib/api/financial';
import { getProjects } from '@/lib/api/projects';
import { listUsers } from '@/lib/api/users';
import type {
  FinancialEntry,
  FinancialEntryListResponse,
  ListFinancialEntriesParams,
  FinancialCategory,
  CategoryType,
  CategoryClassification,
  EntryType,
  PaymentMethodType,
  SubmissionStatus,
} from '@/lib/types/financial';
import type { Project } from '@/lib/types/projects';
import type { MembershipItem } from '@/lib/types/users';
import { getPageCount } from '@/lib/types/financial';
import { EntryCard, EntryCardSkeleton } from './components/EntryCard';
import { EntryDetailModal } from './components/EntryDetailModal';
import { EntryFormModal } from './components/EntryFormModal';
import { ExportConfirmModal } from './components/ExportConfirmModal';
import { ReceiptUploadModal } from './components/ReceiptUploadModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

// ========== CONSTANTS ==========

const PAGE_SIZE = 20;

const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee'];
const CAN_DELETE_ROLES = ['Owner', 'Admin'];

const CATEGORY_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'labor', label: 'Labor' },
  { value: 'material', label: 'Material' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'office', label: 'Office' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'tools', label: 'Tools' },
  { value: 'other', label: 'Other' },
];

const CLASSIFICATION_OPTIONS = [
  { value: '', label: 'All Classifications' },
  { value: 'cost_of_goods_sold', label: 'COGS' },
  { value: 'operating_expense', label: 'OpEx' },
];

const ENTRY_TYPE_OPTIONS = [
  { value: '', label: 'All Entry Types' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'All Payment Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'ACH', label: 'ACH' },
];

const SUBMISSION_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'denied', label: 'Denied' },
];

const HAS_RECEIPT_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

const IS_RECURRING_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

const SORT_BY_OPTIONS = [
  { value: 'entry_date', label: 'Entry Date' },
  { value: 'amount', label: 'Amount' },
  { value: 'created_at', label: 'Created At' },
];

const SORT_ORDER_OPTIONS = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
];

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

// ========== SKELETON FOR SUMMARY ==========

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

// ========== MAIN PAGE ==========

export default function FinancialEntriesPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();
  const { user } = useAuth();
  const canView = hasRole(CAN_VIEW_ROLES);
  const canDelete = hasRole(CAN_DELETE_ROLES);
  const isEmployee = hasRole(['Employee']) && !hasRole(['Owner', 'Admin', 'Manager', 'Bookkeeper']);

  // Data state
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [summary, setSummary] = useState<FinancialEntryListResponse['summary'] | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Supporting data for filters
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<MembershipItem[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryTypeFilter, setCategoryTypeFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hasReceiptFilter, setHasReceiptFilter] = useState('');
  const [isRecurringFilter, setIsRecurringFilter] = useState('');
  const [purchasedByUserFilter, setPurchasedByUserFilter] = useState('');

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<'entry_date' | 'amount' | 'created_at'>('entry_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Filters panel visibility
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Detail modal
  const [detailEntry, setDetailEntry] = useState<FinancialEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Delete
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<FinancialEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Entry form modal (create/edit/resubmit)
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [formMode, setFormMode] = useState<'edit' | 'resubmit'>('edit');

  // Receipt upload modal (Sprint 12)
  const [receiptUploadModalOpen, setReceiptUploadModalOpen] = useState(false);

  // Search debounce
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  // Expand filters on desktop by default
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setFiltersExpanded(mql.matches);
  }, []);

  // Load supporting data for filters (Task 5)
  useEffect(() => {
    if (!canView) return;

    Promise.all([
      getProjects({ limit: 200 }).then((res) => setProjects(res.data)).catch((err) => console.error('Failed to load projects:', err)),
      getFinancialCategories().then(setCategories).catch((err) => console.error('Failed to load categories:', err)),
      getSuppliers({ limit: 100, is_active: true }).then((res) => setSuppliers(res.data.map((s) => ({ id: s.id, name: s.name })))).catch((err) => console.error('Failed to load suppliers:', err)),
      listUsers({ limit: 100 }).then((res) => setUsers(res.data)).catch((err) => console.error('Failed to load users:', err)),
    ]);
  }, [canView]);

  // Build params and load entries
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const params: ListFinancialEntriesParams = {
      page: currentPage,
      limit: PAGE_SIZE,
      sort_by: sortBy,
      sort_order: sortOrder,
    };

    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (projectFilter) params.project_id = projectFilter;
    if (categoryFilter) params.category_id = categoryFilter;
    if (categoryTypeFilter) params.category_type = categoryTypeFilter as CategoryType;
    if (classificationFilter) params.classification = classificationFilter as CategoryClassification;
    if (entryTypeFilter) params.entry_type = entryTypeFilter as EntryType;
    if (supplierFilter) params.supplier_id = supplierFilter;
    if (paymentMethodFilter) params.payment_method = paymentMethodFilter as PaymentMethodType;
    if (submissionStatusFilter) params.submission_status = submissionStatusFilter as SubmissionStatus;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (hasReceiptFilter === 'true') params.has_receipt = true;
    if (hasReceiptFilter === 'false') params.has_receipt = false;
    if (isRecurringFilter === 'true') params.is_recurring_instance = true;
    if (isRecurringFilter === 'false') params.is_recurring_instance = false;
    if (purchasedByUserFilter) params.purchased_by_user_id = purchasedByUserFilter;

    try {
      const result = await getFinancialEntries(params);
      setEntries(result.data);
      setSummary(result.summary);
      setTotalItems(result.meta.total);
      setTotalPages(getPageCount(result.meta));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load financial entries';
      setFetchError(message);
      console.error('Failed to load entries:', error);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage, sortBy, sortOrder, debouncedSearch,
    projectFilter, categoryFilter, categoryTypeFilter, classificationFilter,
    entryTypeFilter, supplierFilter, paymentMethodFilter, submissionStatusFilter,
    dateFrom, dateTo, hasReceiptFilter, isRecurringFilter, purchasedByUserFilter,
  ]);

  useEffect(() => {
    if (canView) loadEntries();
  }, [canView, loadEntries]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    projectFilter, categoryFilter, categoryTypeFilter, classificationFilter,
    entryTypeFilter, supplierFilter, paymentMethodFilter, submissionStatusFilter,
    dateFrom, dateTo, hasReceiptFilter, isRecurringFilter, purchasedByUserFilter,
    sortBy, sortOrder,
  ]);

  // Count active filters
  const activeFilterCount = [
    debouncedSearch, projectFilter, categoryFilter, categoryTypeFilter,
    classificationFilter, entryTypeFilter, supplierFilter, paymentMethodFilter,
    submissionStatusFilter, dateFrom, dateTo, hasReceiptFilter,
    isRecurringFilter, purchasedByUserFilter,
  ].filter(Boolean).length;

  // Build active filter summary for export confirmation modal
  const activeFilterSummary = React.useMemo(() => {
    const filters: { label: string; value: string }[] = [];
    if (debouncedSearch) filters.push({ label: 'Search', value: debouncedSearch });
    if (projectFilter) {
      const p = projects.find((x) => x.id === projectFilter);
      filters.push({ label: 'Project', value: p?.name || projectFilter });
    }
    if (categoryFilter) {
      const c = categories.find((x) => x.id === categoryFilter);
      filters.push({ label: 'Category', value: c?.name || categoryFilter });
    }
    if (categoryTypeFilter) {
      const opt = CATEGORY_TYPE_OPTIONS.find((x) => x.value === categoryTypeFilter);
      filters.push({ label: 'Type', value: opt?.label || categoryTypeFilter });
    }
    if (classificationFilter) {
      const opt = CLASSIFICATION_OPTIONS.find((x) => x.value === classificationFilter);
      filters.push({ label: 'Classification', value: opt?.label || classificationFilter });
    }
    if (entryTypeFilter) {
      const opt = ENTRY_TYPE_OPTIONS.find((x) => x.value === entryTypeFilter);
      filters.push({ label: 'Entry Type', value: opt?.label || entryTypeFilter });
    }
    if (supplierFilter) {
      const s = suppliers.find((x) => x.id === supplierFilter);
      filters.push({ label: 'Supplier', value: s?.name || supplierFilter });
    }
    if (paymentMethodFilter) {
      const opt = PAYMENT_METHOD_OPTIONS.find((x) => x.value === paymentMethodFilter);
      filters.push({ label: 'Payment Method', value: opt?.label || paymentMethodFilter });
    }
    if (submissionStatusFilter) {
      const opt = SUBMISSION_STATUS_OPTIONS.find((x) => x.value === submissionStatusFilter);
      filters.push({ label: 'Status', value: opt?.label || submissionStatusFilter });
    }
    if (dateFrom) filters.push({ label: 'From', value: dateFrom });
    if (dateTo) filters.push({ label: 'To', value: dateTo });
    if (hasReceiptFilter) filters.push({ label: 'Has Receipt', value: hasReceiptFilter === 'true' ? 'Yes' : 'No' });
    if (isRecurringFilter) filters.push({ label: 'Recurring', value: isRecurringFilter === 'true' ? 'Yes' : 'No' });
    if (purchasedByUserFilter) {
      const u = users.find((x) => x.user_id === purchasedByUserFilter);
      filters.push({ label: 'Purchased By', value: u ? `${u.first_name} ${u.last_name}` : purchasedByUserFilter });
    }
    return filters;
  }, [
    debouncedSearch, projectFilter, categoryFilter, categoryTypeFilter,
    classificationFilter, entryTypeFilter, supplierFilter, paymentMethodFilter,
    submissionStatusFilter, dateFrom, dateTo, hasReceiptFilter,
    isRecurringFilter, purchasedByUserFilter, projects, categories, suppliers, users,
  ]);

  // Clear filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setProjectFilter('');
    setCategoryFilter('');
    setCategoryTypeFilter('');
    setClassificationFilter('');
    setEntryTypeFilter('');
    setSupplierFilter('');
    setPaymentMethodFilter('');
    setSubmissionStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setHasReceiptFilter('');
    setIsRecurringFilter('');
    setPurchasedByUserFilter('');
    setSortBy('entry_date');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // View detail
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

  // Delete handlers
  const handleDeleteClick = (entry: FinancialEntry) => {
    setEntryToDelete(entry);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    setDeleting(true);
    try {
      await deleteFinancialEntry(entryToDelete.id);
      toast.success('Financial entry deleted successfully');
      setDeleteModalOpen(false);
      setEntryToDelete(null);
      loadEntries();
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete entry';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  // Export handler — triggered from confirmation modal
  const handleExport = async () => {
    setExporting(true);
    try {
      const params: ListFinancialEntriesParams = {};
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (projectFilter) params.project_id = projectFilter;
      if (categoryFilter) params.category_id = categoryFilter;
      if (categoryTypeFilter) params.category_type = categoryTypeFilter as CategoryType;
      if (classificationFilter) params.classification = classificationFilter as CategoryClassification;
      if (entryTypeFilter) params.entry_type = entryTypeFilter as EntryType;
      if (supplierFilter) params.supplier_id = supplierFilter;
      if (paymentMethodFilter) params.payment_method = paymentMethodFilter as PaymentMethodType;
      if (submissionStatusFilter) params.submission_status = submissionStatusFilter as SubmissionStatus;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (hasReceiptFilter === 'true') params.has_receipt = true;
      if (hasReceiptFilter === 'false') params.has_receipt = false;
      if (isRecurringFilter === 'true') params.is_recurring_instance = true;
      if (isRecurringFilter === 'false') params.is_recurring_instance = false;
      if (purchasedByUserFilter) params.purchased_by_user_id = purchasedByUserFilter;

      const blob = await exportEntries(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setExportModalOpen(false);
      toast.success('Export downloaded successfully');
    } catch {
      toast.error('Export failed. Make sure there are entries matching your filters.');
    } finally {
      setExporting(false);
    }
  };

  // Open form modal in create mode
  const handleNewEntry = () => {
    setEditingEntry(null);
    setFormMode('edit');
    setFormModalOpen(true);
  };

  // Open form modal in edit mode
  const handleEdit = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    setFormMode('edit');
    setFormModalOpen(true);
  };

  // Open form modal in resubmit mode (for rejected entries owned by current user)
  const handleResubmit = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    setFormMode('resubmit');
    setFormModalOpen(true);
  };

  // Called on form success (create or edit)
  const handleFormSuccess = () => {
    loadEntries();
  };

  // Can this user delete this specific entry?
  const canDeleteEntry = (entry: FinancialEntry): boolean => {
    if (canDelete) return true; // Owner/Admin can delete any
    if (isEmployee && entry.created_by_user_id === user?.id && (entry.submission_status === 'pending_review' || entry.submission_status === 'denied')) return true;
    return false;
  };

  // Can this user resubmit this entry? (denied entries owned by current user)
  const canResubmitEntry = (entry: FinancialEntry): boolean => {
    return (
      entry.created_by_user_id === user?.id &&
      entry.submission_status === 'denied'
    );
  };

  // Filter select options
  const projectOptions = [
    { value: '', label: 'All Projects' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name })),
  ];

  const supplierOptions = [
    { value: '', label: 'All Suppliers' },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ];

  const userOptions = [
    { value: '', label: 'All Users' },
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
          You don&apos;t have permission to view financial entries.
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Financial Entries
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage expenses and income across all projects
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasRole(['Owner', 'Admin', 'Bookkeeper']) && (
              <Button variant="secondary" size="sm" onClick={() => setExportModalOpen(true)} disabled={exporting}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            )}
            {hasRole(['Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee']) && (
              <Button variant="secondary" size="sm" onClick={() => setReceiptUploadModalOpen(true)}>
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload Receipt</span>
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={handleNewEntry}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Entry</span>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {loading && !summary ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              <SummaryCard
                label="Total Expenses"
                value={formatCurrency(summary?.total_expenses ?? 0)}
                icon={<DollarSign className="h-5 w-5 text-red-600 dark:text-red-400" />}
                colorClass="bg-red-50 dark:bg-red-900/30"
              />
              <SummaryCard
                label="Total Income"
                value={formatCurrency(summary?.total_income ?? 0)}
                icon={<TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />}
                colorClass="bg-green-50 dark:bg-green-900/30"
              />
              <SummaryCard
                label="Total Tax"
                value={formatCurrency(summary?.total_tax ?? 0)}
                icon={<FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                colorClass="bg-blue-50 dark:bg-blue-900/30"
              />
              <SummaryCard
                label="Entries"
                value={String(summary?.entry_count ?? 0)}
                icon={<Hash className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
                colorClass="bg-purple-50 dark:bg-purple-900/30"
              />
            </>
          )}
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="space-y-3">
            {/* Search Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search vendor, notes, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-5 h-5" />}
                  rightIcon={
                    searchQuery ? (
                      <button
                        type="button"
                        onClick={() => { setSearchQuery(''); setDebouncedSearch(''); }}
                        className="hover:text-gray-700 dark:hover:text-gray-200"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : undefined
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                {/* Filter toggle for mobile */}
                <button
                  type="button"
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className="inline-flex items-center gap-2 px-3 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 relative"
                  aria-label="Toggle filters"
                  aria-expanded={filtersExpanded}
                >
                  <Filter className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">Filters</span>
                  {filtersExpanded ? (
                    <ChevronUp className="w-4 h-4 hidden sm:block" />
                  ) : (
                    <ChevronDown className="w-4 h-4 hidden sm:block" />
                  )}
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Sort controls */}
                <div className="hidden sm:flex items-center gap-2">
                  <Select
                    options={SORT_BY_OPTIONS}
                    value={sortBy}
                    onChange={(val) => setSortBy(val as 'entry_date' | 'amount' | 'created_at')}
                    placeholder="Sort by"
                  />
                  <button
                    type="button"
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    className="inline-flex items-center gap-1.5 px-3 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label={`Sort ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
                  >
                    <ArrowUpDown className="w-5 h-5" />
                    <span className="text-sm font-medium">{sortOrder === 'desc' ? 'Desc' : 'Asc'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile sort */}
            <div className="flex sm:hidden gap-2">
              <div className="flex-1">
                <Select
                  options={SORT_BY_OPTIONS}
                  value={sortBy}
                  onChange={(val) => setSortBy(val as 'entry_date' | 'amount' | 'created_at')}
                  placeholder="Sort by"
                />
              </div>
              <div className="w-32">
                <Select
                  options={SORT_ORDER_OPTIONS}
                  value={sortOrder}
                  onChange={(val) => setSortOrder(val as 'asc' | 'desc')}
                  placeholder="Order"
                />
              </div>
            </div>

            {/* Expanded filters */}
            {filtersExpanded && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                {/* Row 1: Project, Category, Category Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Select
                    label="Project"
                    options={projectOptions}
                    value={projectFilter}
                    onChange={setProjectFilter}
                    placeholder="All Projects"
                    searchable={projects.length > 5}
                  />
                  <Select
                    label="Category"
                    options={categoryOptions}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    placeholder="All Categories"
                    searchable={categories.length > 5}
                  />
                  <Select
                    label="Category Type"
                    options={CATEGORY_TYPE_OPTIONS}
                    value={categoryTypeFilter}
                    onChange={setCategoryTypeFilter}
                    placeholder="All Types"
                  />
                </div>

                {/* Row 2: Classification, Entry Type, Supplier */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Select
                    label="Classification"
                    options={CLASSIFICATION_OPTIONS}
                    value={classificationFilter}
                    onChange={setClassificationFilter}
                    placeholder="All Classifications"
                  />
                  <Select
                    label="Entry Type"
                    options={ENTRY_TYPE_OPTIONS}
                    value={entryTypeFilter}
                    onChange={setEntryTypeFilter}
                    placeholder="All Entry Types"
                  />
                  <Select
                    label="Supplier"
                    options={supplierOptions}
                    value={supplierFilter}
                    onChange={setSupplierFilter}
                    placeholder="All Suppliers"
                    searchable={suppliers.length > 5}
                  />
                </div>

                {/* Row 3: Payment Method, Status, Purchased By */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Select
                    label="Payment Method"
                    options={PAYMENT_METHOD_OPTIONS}
                    value={paymentMethodFilter}
                    onChange={setPaymentMethodFilter}
                    placeholder="All Payment Methods"
                  />
                  <Select
                    label="Status"
                    options={SUBMISSION_STATUS_OPTIONS}
                    value={submissionStatusFilter}
                    onChange={setSubmissionStatusFilter}
                    placeholder="All Statuses"
                  />
                  <Select
                    label="Purchased By"
                    options={userOptions}
                    value={purchasedByUserFilter}
                    onChange={setPurchasedByUserFilter}
                    placeholder="All Users"
                    searchable={users.length > 5}
                  />
                </div>

                {/* Row 4: Dates, Has Receipt, Recurring */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <DatePicker
                    label="Date From"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <DatePicker
                    label="Date To"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                  <Select
                    label="Has Receipt"
                    options={HAS_RECEIPT_OPTIONS}
                    value={hasReceiptFilter}
                    onChange={setHasReceiptFilter}
                    placeholder="All"
                  />
                  <Select
                    label="Recurring"
                    options={IS_RECURRING_OPTIONS}
                    value={isRecurringFilter}
                    onChange={setIsRecurringFilter}
                    placeholder="All"
                  />
                </div>

                {/* Clear Filters */}
                {activeFilterCount > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                    >
                      Clear All Filters ({activeFilterCount})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <EntryCardSkeleton key={i} />
            ))}
          </div>
        ) : fetchError ? (
          <Card className="p-8 sm:p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <ReceiptIcon className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Failed to Load Entries
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{fetchError}</p>
              <Button variant="primary" onClick={loadEntries} size="sm">
                Try Again
              </Button>
            </div>
          </Card>
        ) : entries.length === 0 ? (
          <Card className="p-8 sm:p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                {activeFilterCount > 0 ? (
                  <Search className="w-8 h-8 text-gray-400" />
                ) : (
                  <ReceiptIcon className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {activeFilterCount > 0
                  ? 'No entries match your filters'
                  : 'No financial entries yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {activeFilterCount > 0
                  ? 'Try adjusting your search or filter criteria'
                  : 'Create your first financial entry to start tracking expenses and income'}
              </p>
              {activeFilterCount === 0 && (
                <Button variant="primary" size="sm" onClick={handleNewEntry}>
                  <Plus className="w-4 h-4" />
                  New Entry
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* Entry cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  canDelete={canDeleteEntry(entry)}
                  canResubmit={canResubmitEntry(entry)}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onResubmit={handleResubmit}
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

            {/* Count footer */}
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Showing {entries.length} of {totalItems} entries
            </p>
          </>
        )}
      </div>

      {/* Entry Detail Modal */}
      <EntryDetailModal
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setDetailEntry(null); }}
        entry={detailEntry}
        loading={detailLoading}
      />

      {/* Entry Form Modal (Create/Edit/Resubmit) */}
      <EntryFormModal
        isOpen={formModalOpen}
        onClose={() => { setFormModalOpen(false); setEditingEntry(null); setFormMode('edit'); }}
        onSuccess={handleFormSuccess}
        entry={editingEntry}
        mode={formMode}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setEntryToDelete(null); }}
        onConfirm={confirmDelete}
        title={entryToDelete?.is_recurring_instance ? 'Delete Recurring Entry' : 'Delete Financial Entry'}
        message={
          entryToDelete
            ? entryToDelete.is_recurring_instance
              ? `This entry for ${formatCurrency(entryToDelete.amount)} (${entryToDelete.category_name}) was auto-generated by a recurring rule. Deleting it will NOT update the recurring rule's next due date. After deleting, check the recurring rule's schedule and update the next due date if needed to avoid skipping or duplicating an occurrence. This action cannot be undone.`
              : `Are you sure you want to delete the ${entryToDelete.entry_type} entry for ${formatCurrency(entryToDelete.amount)} (${entryToDelete.category_name})? This action cannot be undone.`
            : 'Are you sure you want to delete this entry?'
        }
        confirmText="Delete Entry"
        variant="danger"
        loading={deleting}
      />

      {/* Export Confirmation Modal */}
      <ExportConfirmModal
        isOpen={exportModalOpen}
        onClose={() => { setExportModalOpen(false); }}
        onConfirm={handleExport}
        entryCount={totalItems}
        activeFilters={activeFilterSummary}
        loading={exporting}
      />

      {/* Receipt Upload Modal (Sprint 12) */}
      <ReceiptUploadModal
        isOpen={receiptUploadModalOpen}
        onClose={() => setReceiptUploadModalOpen(false)}
        onSuccess={() => {
          setReceiptUploadModalOpen(false);
          loadEntries();
        }}
      />
    </>
  );
}
