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
import {
  Plus,
  FileText,
  CheckCircle,
  ArrowRight,
  DollarSign,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSubcontractorInvoices,
  createSubcontractorInvoice,
  updateSubcontractorInvoice,
} from '@/lib/api/financial';
import { getSubcontractors } from '@/lib/api/subcontractors';
import { getProjectTasks, formatDate, formatCurrency } from '@/lib/api/projects';
import type {
  SubcontractorInvoice,
  Subcontractor,
  SubcontractorInvoiceStatus,
  PaginatedResponse,
} from '@/lib/types/financial';
import type { ProjectTask } from '@/lib/types/projects';

interface InvoiceSectionProps {
  projectId: string;
  onDataChange: () => void;
}

const STATUS_CONFIG: Record<SubcontractorInvoiceStatus, { label: string; variant: 'warning' | 'blue' | 'success' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'blue' },
  paid: { label: 'Paid', variant: 'success' },
};

export default function InvoiceSection({ projectId, onDataChange }: InvoiceSectionProps) {
  const [invoices, setInvoices] = useState<PaginatedResponse<SubcontractorInvoice> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    subcontractor_id: '',
    task_id: '',
    amount: 0,
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Status change modal
  const [statusInvoice, setStatusInvoice] = useState<SubcontractorInvoice | null>(null);
  const [newStatus, setNewStatus] = useState<SubcontractorInvoiceStatus | ''>('');
  const [changingStatus, setChangingStatus] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubcontractorInvoices({
        project_id: projectId,
        status: statusFilter || undefined,
        page,
        limit: 20,
      });
      setInvoices(data);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter, page]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const openCreate = async () => {
    setShowCreate(true);
    setForm({
      subcontractor_id: '',
      task_id: '',
      amount: 0,
      invoice_number: '',
      invoice_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setInvoiceFile(null);
    setFormErrors({});

    try {
      const [subData, taskData] = await Promise.all([
        getSubcontractors({ limit: 100 }),
        getProjectTasks(projectId, { limit: 100 }),
      ]);
      setSubcontractors(subData.data.filter((s) => s.is_active));
      setTasks(taskData.data);
    } catch {
      toast.error('Failed to load data');
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.subcontractor_id) errs.subcontractor_id = 'Subcontractor is required';
    if (!form.task_id) errs.task_id = 'Task is required';
    if (!form.amount || form.amount <= 0) errs.amount = 'Amount must be greater than 0';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (invoiceFile) {
        const formData = new FormData();
        formData.append('file', invoiceFile);
        formData.append('subcontractor_id', form.subcontractor_id);
        formData.append('task_id', form.task_id);
        formData.append('project_id', projectId);
        formData.append('amount', form.amount.toString());
        if (form.invoice_number) formData.append('invoice_number', form.invoice_number);
        if (form.invoice_date) formData.append('invoice_date', form.invoice_date);
        if (form.notes) formData.append('notes', form.notes);
        await createSubcontractorInvoice(formData);
      } else {
        await createSubcontractorInvoice({
          subcontractor_id: form.subcontractor_id,
          task_id: form.task_id,
          project_id: projectId,
          amount: form.amount,
          invoice_number: form.invoice_number || undefined,
          invoice_date: form.invoice_date || undefined,
          notes: form.notes || undefined,
        });
      }
      toast.success('Invoice created');
      setShowCreate(false);
      loadInvoices();
      onDataChange();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const getNextStatus = (current: SubcontractorInvoiceStatus): SubcontractorInvoiceStatus | null => {
    if (current === 'pending') return 'approved';
    if (current === 'approved') return 'paid';
    return null;
  };

  const openStatusChange = (invoice: SubcontractorInvoice) => {
    const next = getNextStatus(invoice.status);
    if (!next) return;
    setStatusInvoice(invoice);
    setNewStatus(next);
  };

  const handleStatusChange = async () => {
    if (!statusInvoice || !newStatus) return;

    setChangingStatus(true);
    try {
      await updateSubcontractorInvoice(statusInvoice.id, { status: newStatus as SubcontractorInvoiceStatus });
      toast.success(`Invoice ${newStatus === 'approved' ? 'approved' : 'marked as paid'}`);
      setStatusInvoice(null);
      setNewStatus('');
      loadInvoices();
      onDataChange();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to update status');
    } finally {
      setChangingStatus(false);
    }
  };

  const subOptions = subcontractors.map((s) => ({
    value: s.id,
    label: `${s.business_name}${s.trade_specialty ? ` (${s.trade_specialty})` : ''}`,
  }));

  const taskOptions = tasks.map((t) => ({
    value: t.id,
    label: t.title,
  }));

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'paid', label: 'Paid' },
  ];

  return (
    <>
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Subcontractor Invoices</h3>
          <div className="flex items-center gap-2">
            <div className="w-36">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(val) => { setStatusFilter(val); setPage(1); }}
                placeholder="All"
              />
            </div>
            <Button size="sm" onClick={openCreate} className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              New Invoice
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-12"><LoadingSpinner size="lg" centered /></div>
        ) : !invoices || invoices.data.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">No invoices yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create invoices for subcontractor work.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Invoice #</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Subcontractor</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Task</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-center py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.data.map((inv) => {
                    const next = getNextStatus(inv.status);
                    const config = STATUS_CONFIG[inv.status];
                    return (
                      <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-3 text-gray-900 dark:text-white font-medium">
                          {inv.invoice_number || '-'}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          {inv.subcontractor.business_name}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          {inv.task.title}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(typeof inv.amount === 'string' ? parseFloat(inv.amount) : inv.amount)}
                        </td>
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {inv.invoice_date ? formatDate(inv.invoice_date) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {next && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openStatusChange(inv)}
                              className="flex items-center gap-1 ml-auto"
                            >
                              {next === 'approved' ? (
                                <><CheckCircle className="w-3.5 h-3.5" /> Approve</>
                              ) : (
                                <><DollarSign className="w-3.5 h-3.5" /> Mark Paid</>
                              )}
                            </Button>
                          )}
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
                const next = getNextStatus(inv.status);
                const config = STATUS_CONFIG[inv.status];
                return (
                  <div key={inv.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {inv.invoice_number || 'No #'}
                      </span>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    <div className="text-sm space-y-1 text-gray-500 dark:text-gray-400">
                      <div>{inv.subcontractor.business_name}</div>
                      <div>Task: {inv.task.title}</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(typeof inv.amount === 'string' ? parseFloat(inv.amount) : inv.amount)}
                      </div>
                    </div>
                    {next && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openStatusChange(inv)}
                          className="w-full flex items-center justify-center gap-1"
                        >
                          {next === 'approved' ? 'Approve' : 'Mark Paid'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {(invoices.meta.pages ?? 0) > 1 && (
              <div className="mt-4">
                <PaginationControls
                  currentPage={page}
                  totalPages={invoices.meta.pages ?? 1}
                  onNext={() => setPage((p) => p + 1)}
                  onPrevious={() => setPage((p) => p - 1)}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Create Invoice Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Invoice" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Subcontractor"
            required
            searchable
            options={subOptions}
            value={form.subcontractor_id}
            onChange={(val) => setForm({ ...form, subcontractor_id: val })}
            error={formErrors.subcontractor_id}
            placeholder="Select subcontractor"
          />

          <Select
            label="Task"
            required
            searchable
            options={taskOptions}
            value={form.task_id}
            onChange={(val) => setForm({ ...form, task_id: val })}
            error={formErrors.task_id}
            placeholder="Select task"
          />

          <MoneyInput
            label="Amount"
            required
            value={form.amount}
            onChange={(val) => setForm({ ...form, amount: val })}
            error={formErrors.amount}
          />

          <Input
            label="Invoice Number"
            value={form.invoice_number}
            onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
            placeholder="e.g., SUB-INV-001"
            maxLength={100}
          />

          <DatePicker
            label="Invoice Date"
            value={form.invoice_date}
            onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
          />

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes"
            rows={2}
          />

          {/* File Upload (PDF) */}
          <div className="w-full">
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Invoice File (optional)
            </label>
            {invoiceFile ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <FileText className="w-6 h-6 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{invoiceFile.name}</p>
                  <p className="text-xs text-gray-500">{(invoiceFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceFile(null)}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Click to upload PDF</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setInvoiceFile(file);
                  }}
                />
              </label>
            )}
          </div>

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting}>
              Create Invoice
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* Status Change Confirmation Modal */}
      {statusInvoice && newStatus && (
        <Modal
          isOpen={!!statusInvoice}
          onClose={() => { setStatusInvoice(null); setNewStatus(''); }}
          title="Confirm Status Change"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Change invoice <span className="font-semibold">{statusInvoice.invoice_number || 'this invoice'}</span> from{' '}
              <Badge variant={STATUS_CONFIG[statusInvoice.status].variant}>
                {STATUS_CONFIG[statusInvoice.status].label}
              </Badge>
              {' '}to{' '}
              <Badge variant={STATUS_CONFIG[newStatus as SubcontractorInvoiceStatus].variant}>
                {STATUS_CONFIG[newStatus as SubcontractorInvoiceStatus].label}
              </Badge>
              ?
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This action cannot be reversed. Invoice status transitions are forward-only.
            </p>
            <ModalActions>
              <Button
                variant="secondary"
                onClick={() => { setStatusInvoice(null); setNewStatus(''); }}
                disabled={changingStatus}
              >
                Cancel
              </Button>
              <Button onClick={handleStatusChange} loading={changingStatus} disabled={changingStatus}>
                Confirm
              </Button>
            </ModalActions>
          </div>
        </Modal>
      )}
    </>
  );
}
