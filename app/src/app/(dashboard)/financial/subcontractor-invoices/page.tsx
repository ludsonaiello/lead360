/**
 * Subcontractor Invoices List Page
 * Sprint 24 — Subcontractor Invoices CRUD
 * List, filter, create, approve, mark paid, edit amount, view detail
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  Plus,
  ArrowLeft,
  Eye,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Clock,
  Paperclip,
  Download,
  ExternalLink,
  Edit3,
  ShieldCheck,
  Banknote,
  Briefcase,
  FolderKanban,
  ClipboardList,
  Calendar,
  Hash,
  User,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import {
  getSubcontractorInvoices,
  createSubcontractorInvoice,
  updateSubcontractorInvoice,
  getSubcontractorInvoiceList,
} from '@/lib/api/financial';
import { getProjects, getProjectTasks, formatDate, formatCurrency } from '@/lib/api/projects';
import { getSubcontractors } from '@/lib/api/subcontractors';
import type {
  SubcontractorInvoice,
  CreateSubcontractorInvoiceDto,
  SubcontractorInvoiceStatus,
  PaginatedResponse,
} from '@/lib/types/financial';
import { getPageCount } from '@/lib/types/financial';

// ========== CONSTANTS ==========

const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const CAN_MANAGE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
];

const STATUS_BADGE_CONFIG: Record<
  SubcontractorInvoiceStatus,
  { variant: 'warning' | 'blue' | 'success'; label: string }
> = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'blue', label: 'Approved' },
  paid: { variant: 'success', label: 'Paid' },
};

const STATUS_ICON: Record<SubcontractorInvoiceStatus, LucideIcon> = {
  pending: Clock,
  approved: ShieldCheck,
  paid: CheckCircle,
};

// ========== HELPER COMPONENTS ==========

function InvoiceStatusBadge({ status }: { status: SubcontractorInvoiceStatus }) {
  const config = STATUS_BADGE_CONFIG[status];
  const Icon = STATUS_ICON[status];
  return <Badge variant={config.variant} icon={Icon}>{config.label}</Badge>;
}

// ========== TYPES ==========

interface SelectOption {
  value: string;
  label: string;
}

interface TaskOption {
  value: string;
  label: string;
}

// ========== COMPONENT ==========

export default function SubcontractorInvoicesPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();

  const canView = hasRole(CAN_VIEW_ROLES);
  const canManage = hasRole(CAN_MANAGE_ROLES);

  // List state
  const [invoices, setInvoices] = useState<PaginatedResponse<SubcontractorInvoice> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filter state
  const [filterSubcontractor, setFilterSubcontractor] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Filter options
  const [subcontractorOptions, setSubcontractorOptions] = useState<SelectOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<SelectOption[]>([]);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    subcontractor_id: '',
    project_id: '',
    task_id: '',
    amount: 0,
    invoice_number: '',
    invoice_date: '',
    notes: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createTaskOptions, setCreateTaskOptions] = useState<TaskOption[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Approve confirm modal
  const [approveInvoice, setApproveInvoice] = useState<SubcontractorInvoice | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);

  // Mark paid confirm modal
  const [paidInvoice, setPaidInvoice] = useState<SubcontractorInvoice | null>(null);
  const [paidLoading, setPaidLoading] = useState(false);

  // Edit amount modal
  const [editAmountInvoice, setEditAmountInvoice] = useState<SubcontractorInvoice | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editAmountError, setEditAmountError] = useState('');
  const [editAmountLoading, setEditAmountLoading] = useState(false);

  // View detail modal
  const [viewInvoice, setViewInvoice] = useState<SubcontractorInvoice | null>(null);

  // Per-subcontractor invoice list modal
  const [subInvoiceListSub, setSubInvoiceListSub] = useState<{ id: string; name: string } | null>(null);
  const [subInvoiceListData, setSubInvoiceListData] = useState<SubcontractorInvoice[]>([]);
  const [subInvoiceListLoading, setSubInvoiceListLoading] = useState(false);

  // ========== DATA LOADING ==========

  const loadFilterOptions = useCallback(async () => {
    try {
      const [subData, projData] = await Promise.all([
        getSubcontractors({ limit: 100, is_active: true }),
        getProjects({ limit: 100 }),
      ]);
      setSubcontractorOptions(
        subData.data.map((s) => ({
          value: s.id,
          label: `${s.business_name}${s.trade_specialty ? ` (${s.trade_specialty})` : ''}`,
        }))
      );
      setProjectOptions(
        projData.data.map((p) => ({
          value: p.id,
          label: `${p.name} (${p.project_number})`,
        }))
      );
    } catch {
      // Non-blocking — filters simply won't populate
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubcontractorInvoices({
        page,
        limit: PAGE_SIZE,
        subcontractor_id: filterSubcontractor || undefined,
        project_id: filterProject || undefined,
        status: filterStatus || undefined,
      });
      setInvoices(data);
    } catch {
      toast.error('Failed to load subcontractor invoices');
    } finally {
      setLoading(false);
    }
  }, [page, filterSubcontractor, filterProject, filterStatus]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    if (canView) loadInvoices();
  }, [loadInvoices, canView]);

  useEffect(() => {
    setPage(1);
  }, [filterSubcontractor, filterProject, filterStatus]);

  // ========== CREATE MODAL ==========

  const openCreateModal = () => {
    setCreateForm({
      subcontractor_id: '',
      project_id: '',
      task_id: '',
      amount: 0,
      invoice_number: '',
      invoice_date: '',
      notes: '',
    });
    setCreateErrors({});
    setCreateTaskOptions([]);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowCreateModal(true);
  };

  // Load tasks when project changes in create form
  useEffect(() => {
    if (!createForm.project_id) {
      setCreateTaskOptions([]);
      setCreateForm((prev) => ({ ...prev, task_id: '' }));
      return;
    }
    let cancelled = false;
    const loadTasks = async () => {
      setLoadingTasks(true);
      try {
        const taskData = await getProjectTasks(createForm.project_id, { limit: 100 });
        if (!cancelled) {
          setCreateTaskOptions(
            taskData.data.map((t) => ({ value: t.id, label: t.title }))
          );
          // Reset task selection when project changes
          setCreateForm((prev) => ({ ...prev, task_id: '' }));
        }
      } catch {
        if (!cancelled) {
          setCreateTaskOptions([]);
          toast.error('Failed to load tasks for selected project');
        }
      } finally {
        if (!cancelled) setLoadingTasks(false);
      }
    };
    loadTasks();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createForm.project_id]);

  const validateCreate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!createForm.subcontractor_id) errs.subcontractor_id = 'Subcontractor is required';
    if (!createForm.project_id) errs.project_id = 'Project is required';
    if (!createForm.task_id) errs.task_id = 'Task is required';
    if (!createForm.amount || createForm.amount < 0.01) errs.amount = 'Amount must be at least $0.01';
    if (createForm.invoice_number && createForm.invoice_number.length > 100) {
      errs.invoice_number = 'Invoice number must be 100 characters or less';
    }
    setCreateErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCreate()) return;

    setCreateSubmitting(true);
    try {
      if (selectedFile) {
        // Build FormData for file upload
        const formData = new FormData();
        formData.append('subcontractor_id', createForm.subcontractor_id);
        formData.append('project_id', createForm.project_id);
        formData.append('task_id', createForm.task_id);
        formData.append('amount', String(createForm.amount));
        if (createForm.invoice_number) formData.append('invoice_number', createForm.invoice_number);
        if (createForm.invoice_date) formData.append('invoice_date', createForm.invoice_date);
        if (createForm.notes) formData.append('notes', createForm.notes);
        formData.append('file', selectedFile);
        await createSubcontractorInvoice(formData);
      } else {
        // Send as JSON without file
        const dto: CreateSubcontractorInvoiceDto = {
          subcontractor_id: createForm.subcontractor_id,
          project_id: createForm.project_id,
          task_id: createForm.task_id,
          amount: createForm.amount,
          invoice_number: createForm.invoice_number || undefined,
          invoice_date: createForm.invoice_date || undefined,
          notes: createForm.notes || undefined,
        };
        await createSubcontractorInvoice(dto);
      }

      toast.success('Subcontractor invoice created');
      setShowCreateModal(false);
      loadInvoices();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Failed to create invoice');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  // ========== STATUS TRANSITIONS ==========

  const handleApprove = async () => {
    if (!approveInvoice) return;
    setApproveLoading(true);
    try {
      await updateSubcontractorInvoice(approveInvoice.id, { status: 'approved' });
      toast.success('Invoice approved');
      setApproveInvoice(null);
      loadInvoices();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Failed to approve invoice');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!paidInvoice) return;
    setPaidLoading(true);
    try {
      await updateSubcontractorInvoice(paidInvoice.id, { status: 'paid' });
      toast.success('Invoice marked as paid');
      setPaidInvoice(null);
      loadInvoices();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Failed to mark invoice as paid');
    } finally {
      setPaidLoading(false);
    }
  };

  // ========== EDIT AMOUNT ==========

  const openEditAmountModal = (inv: SubcontractorInvoice) => {
    setEditAmountInvoice(inv);
    setEditAmount(parseFloat(inv.amount));
    setEditAmountError('');
  };

  const handleEditAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAmountInvoice) return;
    if (!editAmount || editAmount < 0.01) {
      setEditAmountError('Amount must be at least $0.01');
      return;
    }
    setEditAmountLoading(true);
    try {
      await updateSubcontractorInvoice(editAmountInvoice.id, { amount: editAmount });
      toast.success('Invoice amount updated');
      setEditAmountInvoice(null);
      loadInvoices();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Failed to update amount');
    } finally {
      setEditAmountLoading(false);
    }
  };

  // ========== PER-SUBCONTRACTOR LIST ==========

  const openSubInvoiceList = async (subId: string, subName: string) => {
    setSubInvoiceListSub({ id: subId, name: subName });
    setSubInvoiceListLoading(true);
    setSubInvoiceListData([]);
    try {
      const data = await getSubcontractorInvoiceList(subId);
      setSubInvoiceListData(data);
    } catch {
      toast.error('Failed to load invoices for this subcontractor');
    } finally {
      setSubInvoiceListLoading(false);
    }
  };

  // ========== HELPERS ==========

  const clearFilters = () => {
    setFilterSubcontractor('');
    setFilterProject('');
    setFilterStatus('');
  };

  const hasActiveFilters = filterSubcontractor || filterProject || filterStatus;

  const totalPages = invoices ? getPageCount(invoices.meta) : 1;

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
        <p className="text-gray-500 dark:text-gray-400 mb-4">You do not have permission to view subcontractor invoices.</p>
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/financial" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subcontractor Invoices</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage invoices received from subcontractors
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={openCreateModal} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Invoice
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={filterStatus}
            onChange={(val) => setFilterStatus(val)}
            placeholder="All Statuses"
          />
        </div>
        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {filterSubcontractor && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const sub = subcontractorOptions.find((s) => s.value === filterSubcontractor);
                    if (sub) openSubInvoiceList(sub.value, sub.label);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  View All Invoices
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
        ) : !invoices || invoices.data.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No invoices found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {hasActiveFilters
                ? 'No invoices match your current filters. Try adjusting your search criteria.'
                : 'Start by creating a subcontractor invoice to track payments owed.'}
            </p>
            {canManage && !hasActiveFilters && (
              <Button onClick={openCreateModal} className="flex items-center gap-2 mx-auto">
                <Plus className="w-4 h-4" />
                Create Invoice
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
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Project / Task</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Invoice #</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.data.map((inv) => {
                    const amount = parseFloat(inv.amount);
                    return (
                      <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-3 text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div>
                              <span className="font-medium">{inv.subcontractor.business_name}</span>
                              {inv.subcontractor.trade_specialty && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{inv.subcontractor.trade_specialty}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          <div>
                            <div>{inv.project.name}</div>
                            <div className="text-xs text-gray-400">{inv.task.title}</div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(amount)}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {inv.invoice_number || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {inv.invoice_date ? formatDate(inv.invoice_date) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-3">
                          <InvoiceStatusBadge status={inv.status} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.status === 'pending' && canManage && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setApproveInvoice(inv)}
                                  className="flex items-center gap-1 text-xs"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditAmountModal(inv)}
                                  className="flex items-center gap-1 text-xs"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Edit
                                </Button>
                              </>
                            )}
                            {inv.status === 'approved' && canManage && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setPaidInvoice(inv)}
                                className="flex items-center gap-1 text-xs"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                Mark Paid
                              </Button>
                            )}
                            <button
                              onClick={() => setViewInvoice(inv)}
                              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="View details"
                              aria-label={`View invoice from ${inv.subcontractor.business_name}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
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
              {invoices.data.map((inv) => {
                const amount = parseFloat(inv.amount);
                return (
                  <div key={inv.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {inv.subcontractor.business_name}
                        </span>
                        {inv.subcontractor.trade_specialty && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            ({inv.subcontractor.trade_specialty})
                          </span>
                        )}
                        {inv.invoice_number && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {inv.invoice_number}
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white text-lg ml-2 flex-shrink-0">
                        {formatCurrency(amount)}
                      </span>
                    </div>

                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <FolderKanban className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{inv.project.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{inv.task.title}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{inv.invoice_date ? formatDate(inv.invoice_date) : 'No date'}</span>
                        <InvoiceStatusBadge status={inv.status} />
                      </div>
                      {inv.file_name && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="truncate">{inv.file_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      {inv.status === 'pending' && canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setApproveInvoice(inv)}
                            className="flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditAmountModal(inv)}
                            className="flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Amount
                          </Button>
                        </>
                      )}
                      {inv.status === 'approved' && canManage && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPaidInvoice(inv)}
                          className="flex items-center gap-1"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          Mark Paid
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setViewInvoice(inv)}
                        className="flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6">
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  onNext={() => setPage((p) => p + 1)}
                  onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* ========== CREATE MODAL ========== */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Subcontractor Invoice" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Subcontractor"
            required
            searchable
            options={subcontractorOptions}
            value={createForm.subcontractor_id}
            onChange={(val) => {
              setCreateForm({ ...createForm, subcontractor_id: val });
              setCreateErrors((prev) => ({ ...prev, subcontractor_id: '' }));
            }}
            error={createErrors.subcontractor_id}
            placeholder="Select subcontractor"
          />

          <Select
            label="Project"
            required
            searchable
            options={projectOptions}
            value={createForm.project_id}
            onChange={(val) => {
              setCreateForm((prev) => ({ ...prev, project_id: val, task_id: '' }));
              setCreateErrors((prev) => ({ ...prev, project_id: '', task_id: '' }));
            }}
            error={createErrors.project_id}
            placeholder="Select project"
          />

          <Select
            label="Task"
            required
            searchable
            options={createTaskOptions}
            value={createForm.task_id}
            onChange={(val) => {
              setCreateForm({ ...createForm, task_id: val });
              setCreateErrors((prev) => ({ ...prev, task_id: '' }));
            }}
            error={createErrors.task_id}
            placeholder={loadingTasks ? 'Loading tasks...' : (createForm.project_id ? 'Select task' : 'Select a project first')}
            disabled={!createForm.project_id || loadingTasks}
          />

          <MoneyInput
            label="Amount"
            required
            value={createForm.amount}
            onChange={(val) => {
              setCreateForm({ ...createForm, amount: val });
              setCreateErrors((prev) => ({ ...prev, amount: '' }));
            }}
            error={createErrors.amount}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Invoice Number"
              value={createForm.invoice_number}
              onChange={(e) => {
                setCreateForm({ ...createForm, invoice_number: e.target.value });
                setCreateErrors((prev) => ({ ...prev, invoice_number: '' }));
              }}
              placeholder="Subcontractor's invoice #"
              maxLength={100}
              error={createErrors.invoice_number}
            />

            <DatePicker
              label="Invoice Date"
              value={createForm.invoice_date}
              onChange={(e) => setCreateForm({ ...createForm, invoice_date: e.target.value })}
            />
          </div>

          <Textarea
            label="Notes"
            value={createForm.notes}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            placeholder="Optional notes"
            rows={2}
          />

          {/* File attachment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Attachment
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                  file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700
                  dark:file:bg-blue-900/30 dark:file:text-blue-300
                  hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50
                  file:cursor-pointer file:transition-colors"
                aria-label="Attach invoice document"
              />
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-sm text-red-500 hover:text-red-700 whitespace-nowrap"
                >
                  Remove
                </button>
              )}
            </div>
            {selectedFile && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <Paperclip className="w-3 h-3 inline mr-1" />
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={createSubmitting} disabled={createSubmitting}>
              Create Invoice
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* ========== APPROVE CONFIRM MODAL ========== */}
      <ConfirmModal
        isOpen={!!approveInvoice}
        onClose={() => setApproveInvoice(null)}
        onConfirm={handleApprove}
        title="Approve Invoice"
        message={
          approveInvoice
            ? `Approve invoice for ${formatCurrency(parseFloat(approveInvoice.amount))} from ${approveInvoice.subcontractor.business_name}?`
            : ''
        }
        confirmText="Approve"
        variant="info"
        loading={approveLoading}
      />

      {/* ========== MARK PAID CONFIRM MODAL ========== */}
      <ConfirmModal
        isOpen={!!paidInvoice}
        onClose={() => setPaidInvoice(null)}
        onConfirm={handleMarkPaid}
        title="Mark as Paid"
        message={
          paidInvoice
            ? `Mark invoice as paid? This confirms payment of ${formatCurrency(parseFloat(paidInvoice.amount))} to ${paidInvoice.subcontractor.business_name}.`
            : ''
        }
        confirmText="Mark Paid"
        variant="warning"
        loading={paidLoading}
      />

      {/* ========== EDIT AMOUNT MODAL ========== */}
      <Modal
        isOpen={!!editAmountInvoice}
        onClose={() => setEditAmountInvoice(null)}
        title="Edit Invoice Amount"
        size="sm"
      >
        {editAmountInvoice && (
          <form onSubmit={handleEditAmount} className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Update amount for invoice from{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {editAmountInvoice.subcontractor.business_name}
              </span>
            </p>
            <MoneyInput
              label="Amount"
              required
              value={editAmount}
              onChange={(val) => {
                setEditAmount(val);
                setEditAmountError('');
              }}
              error={editAmountError}
            />
            <ModalActions>
              <Button type="button" variant="secondary" onClick={() => setEditAmountInvoice(null)} disabled={editAmountLoading}>
                Cancel
              </Button>
              <Button type="submit" loading={editAmountLoading} disabled={editAmountLoading}>
                Update Amount
              </Button>
            </ModalActions>
          </form>
        )}
      </Modal>

      {/* ========== VIEW DETAIL MODAL ========== */}
      <Modal isOpen={!!viewInvoice} onClose={() => setViewInvoice(null)} title="Invoice Details" size="lg">
        {viewInvoice && (
          <div className="space-y-5">
            {/* Status timeline */}
            <div className="flex items-center gap-2 justify-center py-3">
              {(['pending', 'approved', 'paid'] as SubcontractorInvoiceStatus[]).map((step, idx) => {
                const isActive = step === viewInvoice.status;
                const isPast =
                  (step === 'pending' && (viewInvoice.status === 'approved' || viewInvoice.status === 'paid')) ||
                  (step === 'approved' && viewInvoice.status === 'paid');
                const StepIcon = STATUS_ICON[step];
                return (
                  <React.Fragment key={step}>
                    {idx > 0 && (
                      <div className={`flex-1 h-0.5 ${isPast || isActive ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                    )}
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isPast
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : isActive
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        <StepIcon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-medium ${
                        isPast || isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                      }`}>
                        {STATUS_BADGE_CONFIG[step].label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Subcontractor
                </label>
                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="font-medium">{viewInvoice.subcontractor.business_name}</div>
                    {viewInvoice.subcontractor.trade_specialty && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{viewInvoice.subcontractor.trade_specialty}</div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Amount
                </label>
                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="text-lg font-bold">{formatCurrency(parseFloat(viewInvoice.amount))}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Project
                </label>
                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <FolderKanban className="w-4 h-4 text-gray-400" />
                  <div>
                    <div>{viewInvoice.project.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{viewInvoice.project.project_number}</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Task
                </label>
                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <ClipboardList className="w-4 h-4 text-gray-400" />
                  <span>{viewInvoice.task.title}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Invoice Number
                </label>
                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span>{viewInvoice.invoice_number || <span className="text-gray-400">Not provided</span>}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Invoice Date
                </label>
                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{viewInvoice.invoice_date ? formatDate(viewInvoice.invoice_date) : <span className="text-gray-400">Not provided</span>}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Status
                </label>
                <InvoiceStatusBadge status={viewInvoice.status} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Created
                </label>
                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{formatDate(viewInvoice.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {viewInvoice.notes && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Notes
                </label>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3">
                  {viewInvoice.notes}
                </p>
              </div>
            )}

            {/* File attachment */}
            {viewInvoice.file_url && viewInvoice.file_name && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Attachment
                </label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                  <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                    {viewInvoice.file_name}
                  </span>
                  <a
                    href={viewInvoice.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                    title="Open file"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <a
                    href={viewInvoice.file_url}
                    download={viewInvoice.file_name}
                    className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            <ModalActions>
              <Button variant="secondary" onClick={() => setViewInvoice(null)}>
                Close
              </Button>
            </ModalActions>
          </div>
        )}
      </Modal>

      {/* ========== PER-SUBCONTRACTOR INVOICE LIST MODAL ========== */}
      <Modal
        isOpen={!!subInvoiceListSub}
        onClose={() => setSubInvoiceListSub(null)}
        title={subInvoiceListSub ? `Invoices — ${subInvoiceListSub.name}` : 'Invoices'}
        size="lg"
      >
        {subInvoiceListLoading ? (
          <div className="py-12">
            <LoadingSpinner size="lg" centered />
          </div>
        ) : subInvoiceListData.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No invoices found for this subcontractor.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total</div>
                <div className="font-bold text-gray-900 dark:text-white">
                  {formatCurrency(subInvoiceListData.reduce((sum, i) => sum + parseFloat(i.amount), 0))}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Pending</div>
                <div className="font-bold text-yellow-600 dark:text-yellow-400">
                  {formatCurrency(subInvoiceListData.filter((i) => i.status === 'pending').reduce((sum, i) => sum + parseFloat(i.amount), 0))}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Paid</div>
                <div className="font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(subInvoiceListData.filter((i) => i.status === 'paid').reduce((sum, i) => sum + parseFloat(i.amount), 0))}
                </div>
              </div>
            </div>

            {/* Invoice list */}
            {subInvoiceListData.map((inv) => (
              <div key={inv.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between mb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {inv.project.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{inv.task.title}</div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(parseFloat(inv.amount))}</div>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {inv.invoice_number && <span>#{inv.invoice_number}</span>}
                  {inv.invoice_date && <span>{formatDate(inv.invoice_date)}</span>}
                  {inv.file_name && (
                    <span className="flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {inv.file_name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <ModalActions>
          <Button variant="secondary" onClick={() => setSubInvoiceListSub(null)}>
            Close
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
