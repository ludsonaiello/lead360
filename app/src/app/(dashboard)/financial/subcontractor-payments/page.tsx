/**
 * Subcontractor Payments Page
 * Sprint 25 — Subcontractor Payments Recording
 * List, filter, create payments, view detail, payment history with summary
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Plus,
  ArrowLeft,
  Eye,
  Pencil,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Banknote,
  FileCheck,
  Building2,
  Smartphone,
  Zap,
  ArrowLeftRight,
  History,
  DollarSign,
  CreditCard,
  FileText,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import {
  getSubcontractorPayments,
  createSubcontractorPayment,
  updateSubcontractorPayment,
  deleteSubcontractorPayment,
  getSubcontractorPaymentHistory,
  getSubcontractorPaymentSummary,
} from '@/lib/api/financial';
import { getSubcontractors } from '@/lib/api/subcontractors';
import { getProjects, formatDate, formatCurrency } from '@/lib/api/projects';
import type {
  SubcontractorPayment,
  CreateSubcontractorPaymentDto,
  UpdateSubcontractorPaymentDto,
  SubcontractorPaymentSummary,
  PaymentMethodType,
  PaginatedResponse,
} from '@/lib/types/financial';

// ========== CONSTANTS ==========

const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Bookkeeper'];
const CAN_CREATE_ROLES = ['Owner', 'Admin', 'Bookkeeper'];
const CAN_MANAGE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const CAN_VIEW_HISTORY_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const PAGE_SIZE = 20;

const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  cash: 'Cash',
  check: 'Check',
  bank_transfer: 'Bank Transfer',
  venmo: 'Venmo',
  zelle: 'Zelle',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  ACH: 'ACH',
};

const PAYMENT_METHOD_ICONS: Record<PaymentMethodType, LucideIcon> = {
  cash: Banknote,
  check: FileCheck,
  bank_transfer: Building2,
  venmo: Smartphone,
  zelle: Zap,
  credit_card: CreditCard,
  debit_card: CreditCard,
  ACH: ArrowLeftRight,
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'ACH', label: 'ACH' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
];

const PAYMENT_METHOD_BADGE_VARIANT: Record<PaymentMethodType, 'blue' | 'green' | 'purple' | 'cyan' | 'orange' | 'indigo' | 'amber' | 'info'> = {
  cash: 'green',
  check: 'blue',
  bank_transfer: 'purple',
  venmo: 'cyan',
  zelle: 'orange',
  credit_card: 'indigo',
  debit_card: 'amber',
  ACH: 'info',
};

// ========== HELPER COMPONENTS ==========

function PaymentMethodBadge({ method }: { method: PaymentMethodType }) {
  const Icon = PAYMENT_METHOD_ICONS[method];
  return (
    <Badge variant={PAYMENT_METHOD_BADGE_VARIANT[method]} icon={Icon}>
      {PAYMENT_METHOD_LABELS[method]}
    </Badge>
  );
}

// ========== TYPES ==========

interface SubcontractorOption {
  value: string;
  label: string;
}

interface ProjectOption {
  value: string;
  label: string;
}

// ========== COMPONENT ==========

export default function SubcontractorPaymentsPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();

  const canView = hasRole(CAN_VIEW_ROLES);
  const canCreate = hasRole(CAN_CREATE_ROLES);
  const canManage = hasRole(CAN_MANAGE_ROLES);
  const canViewHistory = hasRole(CAN_VIEW_HISTORY_ROLES);

  // List state
  const [payments, setPayments] = useState<PaginatedResponse<SubcontractorPayment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filter state
  const [filterSubcontractor, setFilterSubcontractor] = useState('');
  const [filterProject, setFilterProject] = useState('');

  // Filter options
  const [subcontractorOptions, setSubcontractorOptions] = useState<SubcontractorOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    subcontractor_id: '',
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '' as PaymentMethodType | '',
    project_id: '',
    reference_number: '',
    notes: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewItem, setViewItem] = useState<SubcontractorPayment | null>(null);

  // Payment History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySubcontractor, setHistorySubcontractor] = useState<{ id: string; name: string } | null>(null);
  const [historyData, setHistoryData] = useState<PaginatedResponse<SubcontractorPayment> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyProjectFilter, setHistoryProjectFilter] = useState('');
  const [paymentSummary, setPaymentSummary] = useState<SubcontractorPaymentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editItem, setEditItem] = useState<SubcontractorPayment | null>(null);
  const [editForm, setEditForm] = useState({
    amount: 0,
    payment_date: '',
    payment_method: '' as PaymentMethodType | '',
    project_id: '',
    reference_number: '',
    notes: '',
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState<SubcontractorPayment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // ========== DATA LOADING ==========

  const loadFilterOptions = useCallback(async () => {
    try {
      const [subData, projectData] = await Promise.all([
        getSubcontractors({ limit: 100 }),
        getProjects({ limit: 100 }),
      ]);
      setSubcontractorOptions(
        subData.data
          .filter((s) => s.is_active)
          .map((s) => ({
            value: s.id,
            label: `${s.business_name}${s.trade_specialty ? ` (${s.trade_specialty})` : ''}`,
          }))
      );
      setProjectOptions(
        projectData.data.map((p) => ({
          value: p.id,
          label: `${p.name} (${p.project_number})`,
        }))
      );
    } catch {
      // Non-blocking — filters still work without pre-loaded options
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubcontractorPayments({
        page,
        limit: PAGE_SIZE,
        subcontractor_id: filterSubcontractor || undefined,
        project_id: filterProject || undefined,
      });
      setPayments(data);
    } catch {
      toast.error('Failed to load subcontractor payments');
    } finally {
      setLoading(false);
    }
  }, [page, filterSubcontractor, filterProject]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    if (canView) loadPayments();
  }, [loadPayments, canView]);

  useEffect(() => {
    setPage(1);
  }, [filterSubcontractor, filterProject]);

  // ========== CREATE MODAL ==========

  const openCreateModal = () => {
    setCreateForm({
      subcontractor_id: '',
      amount: 0,
      payment_date: today,
      payment_method: '',
      project_id: '',
      reference_number: '',
      notes: '',
    });
    setCreateErrors({});
    setShowCreateModal(true);
  };

  const validateCreate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!createForm.subcontractor_id) errs.subcontractor_id = 'Subcontractor is required';
    if (!createForm.amount || createForm.amount <= 0) errs.amount = 'Amount must be greater than $0.00';
    if (!createForm.payment_date) errs.payment_date = 'Payment date is required';
    if (createForm.payment_date > today) errs.payment_date = 'Payment date cannot be in the future';
    if (!createForm.payment_method) errs.payment_method = 'Payment method is required';
    if (createForm.reference_number && createForm.reference_number.length > 200) {
      errs.reference_number = 'Reference number must be 200 characters or less';
    }
    setCreateErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCreate()) return;

    setCreateSubmitting(true);
    try {
      const dto: CreateSubcontractorPaymentDto = {
        subcontractor_id: createForm.subcontractor_id,
        amount: createForm.amount,
        payment_date: createForm.payment_date,
        payment_method: createForm.payment_method as PaymentMethodType,
        project_id: createForm.project_id || undefined,
        reference_number: createForm.reference_number || undefined,
        notes: createForm.notes || undefined,
      };
      await createSubcontractorPayment(dto);

      const subName = subcontractorOptions.find((s) => s.value === createForm.subcontractor_id)?.label || 'subcontractor';
      toast.success(`Payment of ${formatCurrency(createForm.amount)} recorded for ${subName}`);
      setShowCreateModal(false);
      loadPayments();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // ========== VIEW MODAL ==========

  const openViewModal = (payment: SubcontractorPayment) => {
    setViewItem(payment);
    setShowViewModal(true);
  };

  // ========== EDIT MODAL ==========

  const openEditModal = (payment: SubcontractorPayment) => {
    setEditItem(payment);
    setEditForm({
      amount: parseFloat(payment.amount),
      payment_date: payment.payment_date.split('T')[0],
      payment_method: payment.payment_method,
      project_id: payment.project_id || '',
      reference_number: payment.reference_number || '',
      notes: payment.notes || '',
    });
    setEditErrors({});
    setShowEditModal(true);
  };

  const validateEdit = (): boolean => {
    const errs: Record<string, string> = {};
    if (!editForm.amount || editForm.amount <= 0) errs.amount = 'Amount must be greater than $0.00';
    if (!editForm.payment_date) errs.payment_date = 'Payment date is required';
    if (editForm.payment_date > today) errs.payment_date = 'Payment date cannot be in the future';
    if (!editForm.payment_method) errs.payment_method = 'Payment method is required';
    if (editForm.reference_number && editForm.reference_number.length > 200) {
      errs.reference_number = 'Reference number must be 200 characters or less';
    }
    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !validateEdit()) return;

    setEditSubmitting(true);
    try {
      const dto: UpdateSubcontractorPaymentDto = {
        amount: editForm.amount,
        payment_date: editForm.payment_date,
        payment_method: editForm.payment_method as PaymentMethodType,
        project_id: editForm.project_id || undefined,
        reference_number: editForm.reference_number || undefined,
        notes: editForm.notes || undefined,
      };
      await updateSubcontractorPayment(editItem.id, dto);
      toast.success('Payment updated successfully');
      setShowEditModal(false);
      setEditItem(null);
      loadPayments();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to update payment');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ========== DELETE ==========

  const openDeleteModal = (payment: SubcontractorPayment) => {
    setDeleteItem(payment);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    setDeleting(true);
    try {
      await deleteSubcontractorPayment(deleteItem.id);
      toast.success('Payment deleted successfully');
      setShowDeleteModal(false);
      setDeleteItem(null);
      loadPayments();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to delete payment');
    } finally {
      setDeleting(false);
    }
  };

  // ========== PAYMENT HISTORY MODAL ==========

  const openHistoryModal = (subcontractorId: string, subcontractorName: string) => {
    setHistorySubcontractor({ id: subcontractorId, name: subcontractorName });
    setHistoryPage(1);
    setHistoryProjectFilter('');
    setPaymentSummary(null);
    setShowHistoryModal(true);
  };

  const loadHistory = useCallback(async () => {
    if (!historySubcontractor) return;
    setHistoryLoading(true);
    try {
      const data = await getSubcontractorPaymentHistory(historySubcontractor.id, {
        page: historyPage,
        limit: PAGE_SIZE,
        project_id: historyProjectFilter || undefined,
      });
      setHistoryData(data);
    } catch {
      toast.error('Failed to load payment history');
    } finally {
      setHistoryLoading(false);
    }
  }, [historySubcontractor, historyPage, historyProjectFilter]);

  const loadSummary = useCallback(async () => {
    if (!historySubcontractor) return;
    setSummaryLoading(true);
    try {
      const summary = await getSubcontractorPaymentSummary(historySubcontractor.id);
      setPaymentSummary(summary);
    } catch {
      // Non-blocking — summary is supplementary
    } finally {
      setSummaryLoading(false);
    }
  }, [historySubcontractor]);

  useEffect(() => {
    if (showHistoryModal && historySubcontractor) {
      loadHistory();
    }
  }, [loadHistory, showHistoryModal, historySubcontractor]);

  useEffect(() => {
    if (showHistoryModal && historySubcontractor) {
      loadSummary();
    }
  }, [loadSummary, showHistoryModal, historySubcontractor]);

  // ========== HELPERS ==========

  const clearFilters = () => {
    setFilterSubcontractor('');
    setFilterProject('');
  };

  const hasActiveFilters = filterSubcontractor || filterProject;

  // ========== RBAC GUARD ==========

  if (rbacLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" centered />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">You do not have permission to view subcontractor payments.</p>
        <Link href="/financial">
          <Button variant="secondary" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Financial
          </Button>
        </Link>
      </div>
    );
  }

  // ========== RENDER ==========

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Financial', href: '/financial' },
          { label: 'Subcontractor Payments' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/financial" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subcontractor Payments</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Record and track payments made to subcontractors
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={openCreateModal} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Record Payment
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Subcontractor"
            searchable
            options={[{ value: '', label: 'All Subcontractors' }, ...subcontractorOptions]}
            value={filterSubcontractor}
            onChange={(val) => setFilterSubcontractor(val)}
            placeholder="All Subcontractors"
          />
          <Select
            label="Project"
            searchable
            options={[{ value: '', label: 'All Projects' }, ...projectOptions]}
            value={filterProject}
            onChange={(val) => setFilterProject(val)}
            placeholder="All Projects"
          />
        </div>
        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {filterSubcontractor && canViewHistory && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const sub = subcontractorOptions.find((s) => s.value === filterSubcontractor);
                    if (sub) openHistoryModal(sub.value, sub.label);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5" />
                  View Payment History
                </Button>
              )}
            </div>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </Card>

      {/* Content */}
      <Card className="p-6">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner size="lg" centered />
          </div>
        ) : !payments || payments.data.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <Wallet className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No payments recorded
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {hasActiveFilters
                ? 'No payments match your current filters. Try adjusting your search criteria.'
                : 'Start recording subcontractor payments to track compensation.'}
            </p>
            {canCreate && !hasActiveFilters && (
              <Button onClick={openCreateModal} className="flex items-center gap-2 mx-auto">
                <Plus className="w-4 h-4" />
                Record Payment
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Subcontractor</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Method</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Project</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Reference</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.data.map((p) => {
                    const amount = parseFloat(p.amount);
                    return (
                      <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-3 text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div>
                              <span className="font-medium">{p.subcontractor.business_name}</span>
                              {p.subcontractor.trade_specialty && (
                                <div className="text-xs text-gray-400">{p.subcontractor.trade_specialty}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(amount)}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(p.payment_date)}
                        </td>
                        <td className="py-3 px-3">
                          <PaymentMethodBadge method={p.payment_method} />
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          {p.project ? (
                            <div>
                              <div>{p.project.name}</div>
                              <div className="text-xs text-gray-400">{p.project.project_number}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          {p.reference_number ? (
                            <span className="text-sm">{p.reference_number}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openViewModal(p)}
                              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="View details"
                              aria-label={`View payment for ${p.subcontractor.business_name}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={() => openEditModal(p)}
                                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  title="Edit payment"
                                  aria-label={`Edit payment for ${p.subcontractor.business_name}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openDeleteModal(p)}
                                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Delete payment"
                                  aria-label={`Delete payment for ${p.subcontractor.business_name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {payments.data.map((p) => {
                const amount = parseFloat(p.amount);
                return (
                  <div key={p.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {p.subcontractor.business_name}
                        </span>
                        {p.subcontractor.trade_specialty && (
                          <div className="text-xs text-gray-400">{p.subcontractor.trade_specialty}</div>
                        )}
                        {p.project && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {p.project.name}
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white text-lg">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span>{formatDate(p.payment_date)}</span>
                        <PaymentMethodBadge method={p.payment_method} />
                      </div>
                      {p.reference_number && (
                        <div className="text-xs">Ref: {p.reference_number}</div>
                      )}
                      {p.notes && (
                        <div className="text-xs text-gray-400 line-clamp-2">{p.notes}</div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openViewModal(p)}
                        className="flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditModal(p)}
                            className="flex items-center gap-1.5"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openDeleteModal(p)}
                            className="flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {(payments.meta.pages ?? 0) > 1 && (
              <div className="mt-6">
                <PaginationControls
                  currentPage={page}
                  totalPages={payments.meta.pages ?? 1}
                  onNext={() => setPage((p) => p + 1)}
                  onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* ========== CREATE MODAL ========== */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Record Subcontractor Payment" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Subcontractor"
            required
            searchable
            options={subcontractorOptions}
            value={createForm.subcontractor_id}
            onChange={(val) => setCreateForm({ ...createForm, subcontractor_id: val })}
            error={createErrors.subcontractor_id}
            placeholder="Select subcontractor"
          />

          <MoneyInput
            label="Amount"
            required
            value={createForm.amount}
            onChange={(val) => setCreateForm({ ...createForm, amount: val })}
            error={createErrors.amount}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DatePicker
              label="Payment Date"
              required
              value={createForm.payment_date}
              onChange={(e) => setCreateForm({ ...createForm, payment_date: e.target.value })}
              max={today}
              error={createErrors.payment_date}
            />

            <Select
              label="Payment Method"
              required
              options={PAYMENT_METHOD_OPTIONS}
              value={createForm.payment_method}
              onChange={(val) => setCreateForm({ ...createForm, payment_method: val as PaymentMethodType })}
              error={createErrors.payment_method}
              placeholder="Select method"
            />
          </div>

          <Select
            label="Project"
            searchable
            options={[{ value: '', label: 'No project' }, ...projectOptions]}
            value={createForm.project_id}
            onChange={(val) => setCreateForm({ ...createForm, project_id: val })}
            placeholder="Select project (optional)"
          />

          <Input
            label="Reference Number"
            value={createForm.reference_number}
            onChange={(e) => setCreateForm({ ...createForm, reference_number: e.target.value })}
            placeholder="e.g., Check #1234, Transaction ID"
            maxLength={200}
            error={createErrors.reference_number}
          />

          <Textarea
            label="Notes"
            value={createForm.notes}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            placeholder="Optional notes about this payment"
            rows={2}
          />

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={createSubmitting} disabled={createSubmitting}>
              Record Payment
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* ========== VIEW MODAL ========== */}
      <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Payment Details" size="lg">
        {viewItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Subcontractor
                </label>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {viewItem.subcontractor.business_name}
                </p>
                {viewItem.subcontractor.trade_specialty && (
                  <p className="text-xs text-gray-400">{viewItem.subcontractor.trade_specialty}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Amount
                </label>
                <p className="text-lg text-gray-900 dark:text-white font-bold">
                  {formatCurrency(parseFloat(viewItem.amount))}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Payment Date
                </label>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(viewItem.payment_date)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Payment Method
                </label>
                <div>
                  <PaymentMethodBadge method={viewItem.payment_method} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Project
                </label>
                {viewItem.project ? (
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">{viewItem.project.name}</p>
                    <p className="text-xs text-gray-400">{viewItem.project.project_number}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">—</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Reference Number
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {viewItem.reference_number || '—'}
                </p>
              </div>
            </div>

            {viewItem.notes && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Notes
                </label>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{viewItem.notes}</p>
              </div>
            )}

            <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
              Recorded: {formatDate(viewItem.created_at)}
            </div>

            <ModalActions>
              <Button type="button" variant="secondary" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
              {canManage && (
                <>
                  <Button
                    onClick={() => {
                      setShowViewModal(false);
                      openEditModal(viewItem);
                    }}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => {
                      setShowViewModal(false);
                      openDeleteModal(viewItem);
                    }}
                    variant="danger"
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </>
              )}
              {canViewHistory && (
                <Button
                  onClick={() => {
                    setShowViewModal(false);
                    openHistoryModal(
                      viewItem.subcontractor_id,
                      `${viewItem.subcontractor.business_name}${viewItem.subcontractor.trade_specialty ? ` (${viewItem.subcontractor.trade_specialty})` : ''}`
                    );
                  }}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <History className="w-4 h-4" />
                  View History
                </Button>
              )}
            </ModalActions>
          </div>
        )}
      </Modal>

      {/* ========== PAYMENT HISTORY MODAL ========== */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`Payment History — ${historySubcontractor?.name || ''}`}
        size="xl"
      >
        <div className="space-y-4">
          {/* Payment Summary Card */}
          {summaryLoading ? (
            <div className="py-6">
              <LoadingSpinner size="sm" centered />
            </div>
          ) : paymentSummary && (
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Payment Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Invoiced</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(paymentSummary.total_invoiced)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-0.5">Paid</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(paymentSummary.total_paid)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-0.5">Pending</p>
                  <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                    {formatCurrency(paymentSummary.total_pending)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  {paymentSummary.invoices_count} invoice{paymentSummary.invoices_count !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" />
                  {paymentSummary.payments_count} payment{paymentSummary.payments_count !== 1 ? 's' : ''}
                </span>
                {paymentSummary.total_approved > 0 && (
                  <span>Approved: {formatCurrency(paymentSummary.total_approved)}</span>
                )}
              </div>
            </div>
          )}

          {/* History filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Select
                label="Filter by Project"
                searchable
                options={[{ value: '', label: 'All Projects' }, ...projectOptions]}
                value={historyProjectFilter}
                onChange={(val) => {
                  setHistoryProjectFilter(val);
                  setHistoryPage(1);
                }}
                placeholder="All Projects"
              />
            </div>
          </div>

          {/* History content */}
          {historyLoading ? (
            <div className="py-12">
              <LoadingSpinner size="lg" centered />
            </div>
          ) : !historyData || historyData.data.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                <DollarSign className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">No payments found for this subcontractor.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {historyData.data.map((p) => {
                  const amount = parseFloat(p.amount);
                  return (
                    <div key={p.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(amount)}
                        </span>
                        <PaymentMethodBadge method={p.payment_method} />
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
                        <div>{formatDate(p.payment_date)}</div>
                        {p.project && (
                          <div>
                            {p.project.name} ({p.project.project_number})
                          </div>
                        )}
                        {p.reference_number && <div>Ref: {p.reference_number}</div>}
                        {p.notes && (
                          <div className="text-xs text-gray-400 line-clamp-2">{p.notes}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {(historyData.meta.pages ?? 0) > 1 && (
                <div className="mt-4">
                  <PaginationControls
                    currentPage={historyPage}
                    totalPages={historyData.meta.pages ?? 1}
                    onNext={() => setHistoryPage((p) => p + 1)}
                    onPrevious={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  />
                </div>
              )}
            </>
          )}

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setShowHistoryModal(false)}>
              Close
            </Button>
          </ModalActions>
        </div>
      </Modal>

      {/* ========== EDIT MODAL ========== */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Subcontractor Payment" size="lg">
        <form onSubmit={handleEdit} className="space-y-4">
          {editItem && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{editItem.subcontractor.business_name}</span>
                {editItem.subcontractor.trade_specialty && (
                  <span className="text-gray-400"> ({editItem.subcontractor.trade_specialty})</span>
                )}
              </p>
            </div>
          )}

          <MoneyInput
            label="Amount"
            required
            value={editForm.amount}
            onChange={(val) => setEditForm({ ...editForm, amount: val })}
            error={editErrors.amount}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DatePicker
              label="Payment Date"
              required
              value={editForm.payment_date}
              onChange={(e) => setEditForm({ ...editForm, payment_date: e.target.value })}
              max={today}
              error={editErrors.payment_date}
            />

            <Select
              label="Payment Method"
              required
              options={PAYMENT_METHOD_OPTIONS}
              value={editForm.payment_method}
              onChange={(val) => setEditForm({ ...editForm, payment_method: val as PaymentMethodType })}
              error={editErrors.payment_method}
              placeholder="Select method"
            />
          </div>

          <Select
            label="Project"
            searchable
            options={[{ value: '', label: 'No project' }, ...projectOptions]}
            value={editForm.project_id}
            onChange={(val) => setEditForm({ ...editForm, project_id: val })}
            placeholder="Select project (optional)"
          />

          <Input
            label="Reference Number"
            value={editForm.reference_number}
            onChange={(e) => setEditForm({ ...editForm, reference_number: e.target.value })}
            placeholder="e.g., Check #1234, Transaction ID"
            maxLength={200}
            error={editErrors.reference_number}
          />

          <Textarea
            label="Notes"
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            placeholder="Optional notes about this payment"
            rows={2}
          />

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)} disabled={editSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={editSubmitting} disabled={editSubmitting}>
              Save Changes
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* ========== DELETE CONFIRMATION MODAL ========== */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteItem(null);
        }}
        title="Delete Payment"
        size="md"
      >
        {deleteItem && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-red-600 dark:text-red-500" />
              <div className="space-y-2">
                <p className="text-gray-700 dark:text-gray-300">
                  Are you sure you want to delete this payment of{' '}
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatCurrency(parseFloat(deleteItem.amount))}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold">{deleteItem.subcontractor.business_name}</span>?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This action cannot be undone. The payment record will be permanently removed.
                </p>
              </div>
            </div>

            <ModalActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteItem(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                loading={deleting}
                disabled={deleting}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Payment
              </Button>
            </ModalActions>
          </div>
        )}
      </Modal>
    </div>
  );
}
