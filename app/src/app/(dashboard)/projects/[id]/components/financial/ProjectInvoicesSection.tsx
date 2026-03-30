'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useRBAC } from '@/contexts/RBACContext';
import {
  Plus,
  FileText,
  Eye,
  Pencil,
  Send,
  Ban,
  DollarSign,
  Receipt as ReceiptIcon,
  Banknote,
  Hash,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Milestone as MilestoneIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getProjectInvoices,
  createProjectInvoice,
  updateProjectInvoice,
  sendInvoice,
  voidInvoice,
  recordInvoicePayment,
  getProjectInvoice,
  getInvoicePayments,
  getProjectFinancialSummary,
  getPaymentMethods,
} from '@/lib/api/financial';
import { formatCurrency, formatDate } from '@/lib/api/projects';
import type {
  ProjectInvoice,
  InvoicePayment,
  InvoiceStatus,
  PaymentMethodType,
  PaginatedResponse,
  ProjectFinancialSummary,
  PaymentMethodRegistry,
} from '@/lib/types/financial';
import { getPageCount } from '@/lib/types/financial';

// ========== HELPERS ==========

/** Safely parse amount (API may return number or string) */
const safeNum = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : parseFloat(val) || 0;
};

/** Payment progress bar — shows paid percentage with green fill */
function PaymentProgressBar({ total, paid, compact = false }: { total: number; paid: number; compact?: boolean }) {
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  const isFull = pct >= 100;
  return (
    <div className={compact ? '' : 'mt-2'}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">
          {formatCurrency(paid)} paid{!compact && ` (${pct.toFixed(1)}%)`}
        </span>
        {compact && (
          <span className={`font-medium ${isFull ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {pct.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isFull ? 'bg-green-500' : 'bg-green-400'}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pct.toFixed(1)}% paid`}
        />
      </div>
    </div>
  );
}

// ========== STATUS CONFIG ==========

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; variant: 'gray' | 'blue' | 'orange' | 'success' | 'danger' }> = {
  draft: { label: 'Draft', variant: 'gray' },
  sent: { label: 'Sent', variant: 'blue' },
  partial: { label: 'Partial', variant: 'orange' },
  paid: { label: 'Paid', variant: 'success' },
  voided: { label: 'Voided', variant: 'danger' },
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'voided', label: 'Voided' },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'ACH', label: 'ACH' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
];

// ========== PROPS ==========

interface ProjectInvoicesSectionProps {
  projectId: string;
  onDataChange: () => void;
}

export default function ProjectInvoicesSection({ projectId, onDataChange }: ProjectInvoicesSectionProps) {
  const { hasRole } = useRBAC();

  // RBAC — Sprint 16 spec:
  // create/edit/send/void: Owner, Admin, Manager
  // list/read/payment recording: Owner, Admin, Manager, Bookkeeper
  const canCreate = hasRole(['Owner', 'Admin', 'Manager']);
  const canRecordPayment = hasRole(['Owner', 'Admin', 'Manager', 'Bookkeeper']);
  const canVoid = hasRole(['Owner', 'Admin']);

  // List state
  const [invoicesData, setInvoicesData] = useState<PaginatedResponse<ProjectInvoice> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Summary state
  const [summary, setSummary] = useState<ProjectFinancialSummary['revenue'] | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState<ProjectInvoice | null>(null);
  const [sendTarget, setSendTarget] = useState<ProjectInvoice | null>(null);
  const [voidTarget, setVoidTarget] = useState<ProjectInvoice | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<ProjectInvoice | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<ProjectInvoice | null>(null);
  const [detailPayments, setDetailPayments] = useState<InvoicePayment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form state (shared for create/edit)
  const [form, setForm] = useState({
    description: '',
    amount: 0,
    tax_amount: 0,
    due_date: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);

  // Void form state
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');
  const [voiding, setVoiding] = useState(false);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '' as PaymentMethodType | '',
    payment_method_registry_id: '',
    reference_number: '',
    notes: '',
  });
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Payment method registry (for "Payment Account" select)
  const [paymentMethodsRegistry, setPaymentMethodsRegistry] = useState<PaymentMethodRegistry[]>([]);

  // ========== DATA FETCHING ==========

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProjectInvoices(projectId, {
        page,
        limit: 20,
        status: (statusFilter || undefined) as InvoiceStatus | undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setInvoicesData(data);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, statusFilter, dateFrom, dateTo]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getProjectFinancialSummary(projectId);
      setSummary(data.revenue);
    } catch {
      // Non-blocking — summary cards just won't show
    }
  }, [projectId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Load payment method registry for "Payment Account" select
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const methods = await getPaymentMethods({ is_active: true });
        setPaymentMethodsRegistry(methods);
      } catch {
        // Non-blocking — payment account select will just be empty
      }
    };
    loadPaymentMethods();
  }, []);

  const refreshAll = () => {
    loadInvoices();
    loadSummary();
    onDataChange();
  };

  // ========== CREATE / EDIT ==========

  const resetForm = () => {
    setForm({ description: '', amount: 0, tax_amount: 0, due_date: '', notes: '' });
    setFormErrors({});
  };

  const openCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEdit = (inv: ProjectInvoice) => {
    if (inv.status !== 'draft') {
      toast.error('Only draft invoices can be edited.');
      return;
    }
    setForm({
      description: inv.description,
      amount: safeNum(inv.amount),
      tax_amount: safeNum(inv.tax_amount),
      due_date: inv.due_date ? inv.due_date.split('T')[0] : '',
      notes: inv.notes || '',
    });
    setFormErrors({});
    setEditInvoice(inv);
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.description.trim()) errs.description = 'Description is required';
    else if (form.description.length > 500) errs.description = 'Max 500 characters';
    if (!form.amount || form.amount < 0.01) errs.amount = 'Amount must be at least $0.01';
    if (form.tax_amount < 0) errs.tax_amount = 'Tax cannot be negative';
    if (form.notes.length > 5000) errs.notes = 'Max 5000 characters';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      await createProjectInvoice(projectId, {
        description: form.description.trim(),
        amount: form.amount,
        tax_amount: form.tax_amount || undefined,
        due_date: form.due_date || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success('Invoice created');
      setShowCreateModal(false);
      refreshAll();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInvoice || !validateForm()) return;
    setSubmitting(true);
    try {
      await updateProjectInvoice(projectId, editInvoice.id, {
        description: form.description.trim(),
        amount: form.amount,
        tax_amount: form.tax_amount,
        due_date: form.due_date || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success('Invoice updated');
      setEditInvoice(null);
      refreshAll();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to update invoice');
    } finally {
      setSubmitting(false);
    }
  };

  // ========== SEND ==========

  const handleSend = async () => {
    if (!sendTarget) return;
    setSending(true);
    try {
      await sendInvoice(projectId, sendTarget.id);
      toast.success(`Invoice ${sendTarget.invoice_number} marked as sent`);
      setSendTarget(null);
      refreshAll();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  // ========== VOID ==========

  const openVoid = (inv: ProjectInvoice) => {
    setVoidTarget(inv);
    setVoidReason('');
    setVoidError('');
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      setVoidError('Reason is required');
      return;
    }
    if (voidReason.length > 500) {
      setVoidError('Max 500 characters');
      return;
    }
    setVoiding(true);
    try {
      await voidInvoice(projectId, voidTarget.id, { voided_reason: voidReason.trim() });
      toast.success(`Invoice ${voidTarget.invoice_number} voided`);
      setVoidTarget(null);
      refreshAll();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to void invoice');
    } finally {
      setVoiding(false);
    }
  };

  // ========== RECORD PAYMENT ==========

  const openRecordPayment = (inv: ProjectInvoice) => {
    setPaymentTarget(inv);
    setPaymentForm({
      amount: safeNum(inv.amount_due),
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: '',
      payment_method_registry_id: '',
      reference_number: '',
      notes: '',
    });
    setPaymentErrors({});
  };

  const validatePayment = (): boolean => {
    const errs: Record<string, string> = {};
    if (!paymentForm.amount || paymentForm.amount < 0.01) errs.amount = 'Amount must be at least $0.01';
    if (paymentTarget && paymentForm.amount > safeNum(paymentTarget.amount_due)) {
      errs.amount = `Amount cannot exceed remaining balance of ${formatCurrency(safeNum(paymentTarget.amount_due))}`;
    }
    if (!paymentForm.payment_date) errs.payment_date = 'Payment date is required';
    if (!paymentForm.payment_method) errs.payment_method = 'Payment method is required';
    if (paymentForm.reference_number.length > 200) errs.reference_number = 'Max 200 characters';
    if (paymentForm.notes.length > 5000) errs.notes = 'Max 5000 characters';
    setPaymentErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget || !validatePayment()) return;
    setRecordingPayment(true);
    const remaining = safeNum(paymentTarget.amount_due);
    const invoiceNum = paymentTarget.invoice_number;
    try {
      await recordInvoicePayment(projectId, paymentTarget.id, {
        amount: paymentForm.amount,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method as PaymentMethodType,
        payment_method_registry_id: paymentForm.payment_method_registry_id || undefined,
        reference_number: paymentForm.reference_number.trim() || undefined,
        notes: paymentForm.notes.trim() || undefined,
      });
      toast.success(`Payment of ${formatCurrency(paymentForm.amount)} recorded for ${invoiceNum}`);
      // If payment covers the remaining balance, invoice is now fully paid
      if (paymentForm.amount >= remaining) {
        toast.success(`Invoice ${invoiceNum} marked as paid!`);
      }
      setPaymentTarget(null);
      refreshAll();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  // ========== VIEW DETAIL ==========

  const openDetail = async (inv: ProjectInvoice) => {
    setDetailLoading(true);
    setDetailInvoice(inv);
    setDetailPayments([]);
    try {
      const [fullInvoice, payments] = await Promise.all([
        getProjectInvoice(projectId, inv.id),
        getInvoicePayments(projectId, inv.id),
      ]);
      setDetailInvoice(fullInvoice);
      setDetailPayments(payments);
    } catch {
      toast.error('Failed to load invoice details');
    } finally {
      setDetailLoading(false);
    }
  };

  // ========== ACTION BUTTONS ==========

  const getActions = (inv: ProjectInvoice) => {
    const actions: React.ReactNode[] = [];
    const status = inv.status;

    if (status === 'draft' && canCreate) {
      actions.push(
        <Button key="edit" variant="secondary" size="sm" onClick={() => openEdit(inv)} className="flex items-center gap-1">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
      );
      actions.push(
        <Button key="send" variant="secondary" size="sm" onClick={() => setSendTarget(inv)} className="flex items-center gap-1">
          <Send className="w-3.5 h-3.5" /> Send
        </Button>
      );
    }

    if ((status === 'sent' || status === 'partial') && canRecordPayment) {
      actions.push(
        <Button key="payment" variant="secondary" size="sm" onClick={() => openRecordPayment(inv)} className="flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5" /> Record Payment
        </Button>
      );
    }

    if ((status === 'draft' || status === 'sent') && canVoid) {
      actions.push(
        <Button key="void" variant="danger" size="sm" onClick={() => openVoid(inv)} className="flex items-center gap-1">
          <Ban className="w-3.5 h-3.5" /> Void
        </Button>
      );
    }

    actions.push(
      <Button key="view" variant="ghost" size="sm" onClick={() => openDetail(inv)} className="flex items-center gap-1">
        <Eye className="w-3.5 h-3.5" /> View
      </Button>
    );

    return actions;
  };

  // ========== RENDER HELPERS ==========

  const totalPages = invoicesData ? getPageCount(invoicesData.meta) : 1;

  const renderSummaryCards = () => {
    if (!summary) return null;
    const cards = [
      { label: 'Total Invoiced', value: formatCurrency(summary.total_invoiced), icon: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { label: 'Collected', value: formatCurrency(summary.total_collected), icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
      { label: 'Outstanding', value: formatCurrency(summary.outstanding), icon: AlertTriangle, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
      { label: 'Invoice Count', value: summary.invoice_count.toString(), icon: Hash, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    ];

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`${card.bg} rounded-lg p-4 border border-gray-200 dark:border-gray-700`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</span>
              </div>
              <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFilters = () => (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="w-full sm:w-40">
        <Select
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(val) => { setStatusFilter(val); setPage(1); }}
          placeholder="All Statuses"
        />
      </div>
      <div className="w-full sm:w-40">
        <DatePicker
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          label=""
          helperText="From"
        />
      </div>
      <div className="w-full sm:w-40">
        <DatePicker
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          label=""
          helperText="To"
        />
      </div>
      {(statusFilter || dateFrom || dateTo) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
          className="self-start sm:self-end"
        >
          Clear
        </Button>
      )}
    </div>
  );

  // ========== DESKTOP TABLE ==========

  const renderDesktopTable = () => {
    if (!invoicesData) return null;
    return (
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Invoice #</th>
              <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Description</th>
              <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
              <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Paid</th>
              <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Remaining</th>
              <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Due Date</th>
              <th className="text-center py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
              <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium min-w-[140px]">Progress</th>
              <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoicesData.data.map((inv) => {
              const config = STATUS_CONFIG[inv.status];
              return (
                <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 px-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {inv.invoice_number}
                  </td>
                  <td className="py-3 px-3 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                    {inv.description}
                    {inv.milestone_id && (
                      <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Milestone: {(inv as ProjectInvoice & { milestone_description?: string }).milestone_description || (inv.milestone?.description ?? '')}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(safeNum(inv.amount) + safeNum(inv.tax_amount))}
                  </td>
                  <td className="py-3 px-3 text-right text-green-600 dark:text-green-400 whitespace-nowrap">
                    {formatCurrency(safeNum(inv.amount_paid))}
                  </td>
                  <td className="py-3 px-3 text-right text-orange-600 dark:text-orange-400 whitespace-nowrap">
                    {formatCurrency(safeNum(inv.amount_due))}
                  </td>
                  <td className="py-3 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {inv.due_date ? formatDate(inv.due_date) : '-'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Badge variant={config.variant} className={inv.status === 'voided' ? 'line-through' : ''}>
                      {config.label}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    {inv.status !== 'draft' && inv.status !== 'voided' ? (
                      <PaymentProgressBar
                        total={safeNum(inv.amount) + safeNum(inv.tax_amount)}
                        paid={safeNum(inv.amount_paid)}
                        compact
                      />
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {getActions(inv)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ========== MOBILE CARDS ==========

  const renderMobileCards = () => {
    if (!invoicesData) return null;
    return (
      <div className="md:hidden space-y-3">
        {invoicesData.data.map((inv) => {
          const config = STATUS_CONFIG[inv.status];
          return (
            <div key={inv.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              {/* Header: invoice number + status */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">{inv.invoice_number}</span>
                </div>
                <Badge variant={config.variant} className={inv.status === 'voided' ? 'line-through' : ''}>
                  {config.label}
                </Badge>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-2">{inv.description}</p>

              {/* Milestone link */}
              {inv.milestone_id && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Milestone: {(inv as ProjectInvoice & { milestone_description?: string }).milestone_description || (inv.milestone?.description ?? '')}
                </p>
              )}

              {/* Amount details */}
              <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                <div>
                  <span className="block text-xs text-gray-400 dark:text-gray-500">Amount</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(safeNum(inv.amount) + safeNum(inv.tax_amount))}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400 dark:text-gray-500">Paid</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(safeNum(inv.amount_paid))}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400 dark:text-gray-500">Remaining</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {formatCurrency(safeNum(inv.amount_due))}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              {inv.status !== 'draft' && inv.status !== 'voided' && (
                <div className="mb-3">
                  <PaymentProgressBar
                    total={safeNum(inv.amount) + safeNum(inv.tax_amount)}
                    paid={safeNum(inv.amount_paid)}
                  />
                </div>
              )}

              {/* Due date */}
              {inv.due_date && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Due: {formatDate(inv.due_date)}
                </p>
              )}

              {/* Actions */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
                {getActions(inv)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ========== FORM MODAL (Create / Edit) ==========

  const renderFormModal = (isEdit: boolean) => {
    const isOpen = isEdit ? !!editInvoice : showCreateModal;
    const onClose = () => isEdit ? setEditInvoice(null) : setShowCreateModal(false);
    const onSubmit = isEdit ? handleEditSubmit : handleCreateSubmit;
    const title = isEdit ? `Edit Invoice — ${editInvoice?.invoice_number}` : 'New Invoice';

    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Description"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            error={formErrors.description}
            placeholder="e.g., Progress billing - Phase 1"
            maxLength={500}
          />

          <MoneyInput
            label="Amount"
            required
            value={form.amount}
            onChange={(val) => setForm({ ...form, amount: val })}
            error={formErrors.amount}
          />

          <MoneyInput
            label="Tax Amount"
            value={form.tax_amount}
            onChange={(val) => setForm({ ...form, tax_amount: val })}
            error={formErrors.tax_amount}
            placeholder="0.00"
          />

          <DatePicker
            label="Due Date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            error={formErrors.notes}
            placeholder="Optional notes (e.g., Net 30 terms)"
            rows={3}
            maxLength={5000}
            showCharacterCount
          />

          <ModalActions>
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting}>
              {isEdit ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </ModalActions>
        </form>
      </Modal>
    );
  };

  // ========== SEND MODAL ==========

  const renderSendModal = () => {
    if (!sendTarget) return null;
    const total = safeNum(sendTarget.amount) + safeNum(sendTarget.tax_amount);
    return (
      <Modal isOpen={!!sendTarget} onClose={() => setSendTarget(null)} title="Mark Invoice as Sent" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Mark <span className="font-semibold">{sendTarget.invoice_number}</span> as sent?
            This indicates the invoice has been delivered to the client.
          </p>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Invoice total: {formatCurrency(total)}
            </p>
          </div>
          <ModalActions>
            <Button variant="secondary" onClick={() => setSendTarget(null)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} loading={sending} disabled={sending}>
              Mark as Sent
            </Button>
          </ModalActions>
        </div>
      </Modal>
    );
  };

  // ========== VOID MODAL ==========

  const renderVoidModal = () => {
    if (!voidTarget) return null;
    return (
      <Modal isOpen={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void Invoice" size="sm">
        <div className="space-y-4">
          <div className="flex gap-3 items-start p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">
              This action cannot be undone. Invoice <span className="font-semibold">{voidTarget.invoice_number}</span> will be permanently voided.
            </p>
          </div>

          <Textarea
            label="Reason for voiding"
            required
            value={voidReason}
            onChange={(e) => { setVoidReason(e.target.value); setVoidError(''); }}
            error={voidError}
            placeholder="e.g., Duplicate invoice — already billed on INV-0003"
            rows={3}
            maxLength={500}
            showCharacterCount
          />

          <ModalActions>
            <Button variant="secondary" onClick={() => setVoidTarget(null)} disabled={voiding}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleVoid} loading={voiding} disabled={voiding || !voidReason.trim()}>
              Void Invoice
            </Button>
          </ModalActions>
        </div>
      </Modal>
    );
  };

  // ========== RECORD PAYMENT MODAL ==========

  const renderPaymentModal = () => {
    if (!paymentTarget) return null;
    const remaining = safeNum(paymentTarget.amount_due);
    return (
      <Modal isOpen={!!paymentTarget} onClose={() => setPaymentTarget(null)} title={`Record Payment — ${paymentTarget.invoice_number}`} size="md">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Invoice Total</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(safeNum(paymentTarget.amount) + safeNum(paymentTarget.tax_amount))}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500 dark:text-gray-400">Already Paid</span>
              <span className="text-green-600 dark:text-green-400">{formatCurrency(safeNum(paymentTarget.amount_paid))}</span>
            </div>
            <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">Remaining</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(remaining)}</span>
            </div>
          </div>

          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <MoneyInput
                  label="Payment Amount"
                  required
                  value={paymentForm.amount}
                  onChange={(val) => setPaymentForm({ ...paymentForm, amount: val })}
                  error={paymentErrors.amount}
                />
              </div>
              {paymentForm.amount < remaining && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPaymentForm({ ...paymentForm, amount: remaining })}
                  className="mb-1 whitespace-nowrap flex-shrink-0"
                >
                  Pay Full Balance
                </Button>
              )}
            </div>
          </div>

          <DatePicker
            label="Payment Date"
            required
            value={paymentForm.payment_date}
            onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
            error={paymentErrors.payment_date}
          />

          <Select
            label="Payment Method"
            required
            options={PAYMENT_METHOD_OPTIONS}
            value={paymentForm.payment_method}
            onChange={(val) => setPaymentForm({ ...paymentForm, payment_method: val as PaymentMethodType })}
            error={paymentErrors.payment_method}
            placeholder="Select method"
          />

          {paymentMethodsRegistry.length > 0 && (
            <Select
              label="Payment Account"
              options={[
                { value: '', label: 'None' },
                ...paymentMethodsRegistry.map((pm) => ({
                  value: pm.id,
                  label: `${pm.nickname}${pm.last_four ? ` ···${pm.last_four}` : ''}${pm.bank_name ? ` (${pm.bank_name})` : ''}`,
                })),
              ]}
              value={paymentForm.payment_method_registry_id}
              onChange={(val) => setPaymentForm({ ...paymentForm, payment_method_registry_id: val })}
              placeholder="Select payment account (optional)"
              searchable
            />
          )}

          <Input
            label="Reference Number"
            value={paymentForm.reference_number}
            onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
            error={paymentErrors.reference_number}
            placeholder="e.g., CHK-4521 or transaction ID"
            maxLength={200}
          />

          <Textarea
            label="Notes"
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            error={paymentErrors.notes}
            placeholder="Optional payment notes"
            rows={2}
            maxLength={5000}
          />

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setPaymentTarget(null)} disabled={recordingPayment}>
              Cancel
            </Button>
            <Button type="submit" loading={recordingPayment} disabled={recordingPayment}>
              Record Payment
            </Button>
          </ModalActions>
        </form>
      </Modal>
    );
  };

  // ========== DETAIL MODAL ==========

  const renderDetailModal = () => {
    if (!detailInvoice) return null;
    const inv = detailInvoice;
    const config = STATUS_CONFIG[inv.status];

    return (
      <Modal isOpen={!!detailInvoice} onClose={() => setDetailInvoice(null)} title={`Invoice ${inv.invoice_number}`} size="lg">
        {detailLoading ? (
          <div className="py-8"><LoadingSpinner size="lg" centered /></div>
        ) : (
          <div className="space-y-6">
            {/* Status + Header */}
            <div className="flex items-center justify-between">
              <Badge variant={config.variant} className={inv.status === 'voided' ? 'line-through' : ''}>
                {config.label}
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Created: {formatDate(inv.created_at)}
              </span>
            </div>

            {/* Invoice Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Description</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">{inv.description}</p>
              </div>
              {inv.notes && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes</label>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{inv.notes}</p>
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                <Banknote className="w-4 h-4 mx-auto mb-1 text-gray-400" />
                <span className="block text-xs text-gray-500 dark:text-gray-400">Amount</span>
                <span className="block font-bold text-gray-900 dark:text-white">{formatCurrency(safeNum(inv.amount))}</span>
              </div>
              {safeNum(inv.tax_amount) > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <ReceiptIcon className="w-4 h-4 mx-auto mb-1 text-gray-400" />
                  <span className="block text-xs text-gray-500 dark:text-gray-400">Tax</span>
                  <span className="block font-bold text-gray-900 dark:text-white">{formatCurrency(safeNum(inv.tax_amount))}</span>
                </div>
              )}
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <CheckCircle className="w-4 h-4 mx-auto mb-1 text-green-500" />
                <span className="block text-xs text-gray-500 dark:text-gray-400">Paid</span>
                <span className="block font-bold text-green-600 dark:text-green-400">{formatCurrency(safeNum(inv.amount_paid))}</span>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                <span className="block text-xs text-gray-500 dark:text-gray-400">Due</span>
                <span className="block font-bold text-orange-600 dark:text-orange-400">{formatCurrency(safeNum(inv.amount_due))}</span>
              </div>
            </div>

            {/* Dates + Milestone */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {inv.due_date && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>Due: {formatDate(inv.due_date)}</span>
                </div>
              )}
              {inv.sent_at && (
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Send className="w-4 h-4 flex-shrink-0" />
                  <span>Sent: {formatDate(inv.sent_at)}</span>
                </div>
              )}
              {inv.paid_at && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Paid: {formatDate(inv.paid_at)}</span>
                </div>
              )}
              {inv.milestone && (
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <MilestoneIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Draw #{inv.milestone.draw_number}: {inv.milestone.description}</span>
                </div>
              )}
            </div>

            {/* Status Timeline */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Timeline</h4>
              <div className="space-y-2">
                <TimelineEntry icon={<Clock className="w-3.5 h-3.5" />} label="Created" date={inv.created_at} color="gray" />
                {inv.sent_at && <TimelineEntry icon={<Send className="w-3.5 h-3.5" />} label="Sent" date={inv.sent_at} color="blue" />}
                {detailPayments.map((p) => (
                  <TimelineEntry
                    key={p.id}
                    icon={<DollarSign className="w-3.5 h-3.5" />}
                    label={`Payment: ${formatCurrency(safeNum(p.amount))} (${p.payment_method}${p.reference_number ? ` — ${p.reference_number}` : ''})`}
                    date={p.created_at}
                    color="green"
                  />
                ))}
                {inv.paid_at && <TimelineEntry icon={<CheckCircle className="w-3.5 h-3.5" />} label="Fully Paid" date={inv.paid_at} color="green" />}
                {inv.voided_at && (
                  <TimelineEntry icon={<XCircle className="w-3.5 h-3.5" />} label={`Voided: ${inv.voided_reason || ''}`} date={inv.voided_at} color="red" />
                )}
              </div>
            </div>

            {/* Payment History */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Payment History</h4>
              {detailPayments.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  <DollarSign className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No payments recorded yet.</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                          <th className="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                          <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Method</th>
                          <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Reference</th>
                          <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailPayments.map((p) => (
                          <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {formatDate(p.payment_date)}
                            </td>
                            <td className="py-2 px-2 text-right font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                              {formatCurrency(safeNum(p.amount))}
                            </td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300 capitalize whitespace-nowrap">
                              {p.payment_method.replaceAll('_', ' ')}
                            </td>
                            <td className="py-2 px-2 text-gray-500 dark:text-gray-400">
                              {p.reference_number || '-'}
                            </td>
                            <td className="py-2 px-2 text-gray-500 dark:text-gray-400 max-w-[180px] truncate">
                              {p.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-3">
                    {detailPayments.map((p) => (
                      <div key={p.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{formatDate(p.payment_date)}</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(safeNum(p.amount))}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                          {p.payment_method.replaceAll('_', ' ')}
                          {p.reference_number && <span> &middot; Ref: {p.reference_number}</span>}
                        </p>
                        {p.notes && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{p.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Totals summary */}
                  <div className="mt-3 flex items-center justify-between px-2 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Total Payments: <span className="font-medium text-gray-900 dark:text-white">{detailPayments.length}</span>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Total Paid:{' '}
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(detailPayments.reduce((sum, p) => sum + safeNum(p.amount), 0))}
                      </span>
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Voided info */}
            {inv.status === 'voided' && inv.voided_reason && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <Ban className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">Voided</p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">{inv.voided_reason}</p>
                    {inv.voided_at && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1">{formatDate(inv.voided_at)}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <ModalActions>
              <Button variant="secondary" onClick={() => setDetailInvoice(null)}>Close</Button>
            </ModalActions>
          </div>
        )}
      </Modal>
    );
  };

  // ========== MAIN RENDER ==========

  return (
    <>
      <Card className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Project Invoices</h3>
          {canCreate && (
            <Button size="sm" onClick={openCreate} className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              New Invoice
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        {renderSummaryCards()}

        {/* Filters */}
        {renderFilters()}

        {/* Content */}
        {loading ? (
          <SkeletonTable rows={5} columns={7} />
        ) : !invoicesData || invoicesData.data.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No invoices found</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {statusFilter || dateFrom || dateTo
                ? 'Try adjusting your filters.'
                : 'Create an invoice to bill your client for project work.'}
            </p>
            {canCreate && !statusFilter && !dateFrom && !dateTo && (
              <Button size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1.5" /> Create First Invoice
              </Button>
            )}
          </div>
        ) : (
          <>
            {renderDesktopTable()}
            {renderMobileCards()}

            {totalPages > 1 && (
              <div className="mt-4">
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  onNext={() => setPage((p) => Math.min(p + 1, totalPages))}
                  onPrevious={() => setPage((p) => Math.max(p - 1, 1))}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Modals */}
      {renderFormModal(false)}
      {renderFormModal(true)}
      {renderSendModal()}
      {renderVoidModal()}
      {renderPaymentModal()}
      {renderDetailModal()}
    </>
  );
}

// ========== SUB-COMPONENT: Timeline Entry ==========

function TimelineEntry({
  icon,
  label,
  date,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  date: string;
  color: 'gray' | 'blue' | 'green' | 'red';
}) {
  const colorMap = {
    gray: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
        {formatDate(date)}
      </span>
    </div>
  );
}
