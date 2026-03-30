'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import type { LucideIcon } from 'lucide-react';
import {
  Plus,
  FileText,
  Pencil,
  Trash2,
  CircleDot,
  Circle,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Milestone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  generateMilestoneInvoice,
} from '@/lib/api/financial';
import { getProjectSummary, formatCurrency } from '@/lib/api/projects';
import type {
  DrawMilestone,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  GenerateMilestoneInvoiceDto,
  MilestoneStatus,
  DrawCalculationType,
} from '@/lib/types/financial';

interface MilestonesSectionProps {
  projectId: string;
  onDataChange: () => void;
}

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; variant: 'gray' | 'blue' | 'success'; icon: LucideIcon }> = {
  pending: { label: 'Pending', variant: 'gray', icon: Circle },
  invoiced: { label: 'Invoiced', variant: 'blue', icon: CircleDot },
  paid: { label: 'Paid', variant: 'success', icon: CheckCircle2 },
};

export default function MilestonesSection({ projectId, onDataChange }: MilestonesSectionProps) {
  const { hasRole } = useRBAC();
  const canManage = hasRole(['Owner', 'Admin', 'Manager']);
  const canDelete = hasRole(['Owner', 'Admin']);

  const [milestones, setMilestones] = useState<DrawMilestone[]>([]);
  const [contractValue, setContractValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Create/Edit modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editMilestone, setEditMilestone] = useState<DrawMilestone | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    draw_number: '',
    description: '',
    calculation_type: 'percentage' as DrawCalculationType,
    value: '',
    calculated_amount: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete confirmation
  const [deletingMilestone, setDeletingMilestone] = useState<DrawMilestone | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Generate Invoice modal
  const [invoiceMilestone, setInvoiceMilestone] = useState<DrawMilestone | null>(null);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    description: '',
    due_date: '',
    tax_amount: 0,
    notes: '',
  });

  // ── Data Loading ────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [milestonesData, summaryData] = await Promise.all([
        getMilestones(projectId),
        getProjectSummary(projectId),
      ]);
      setMilestones(milestonesData);
      setContractValue(summaryData.contract_value);
    } catch {
      toast.error('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Computed Values ─────────────────────────────────────────────

  const totalMilestoneValue = milestones.reduce((sum, m) => sum + (m.calculated_amount ?? 0), 0);
  const milestonePercentage = contractValue && contractValue > 0
    ? Math.round((totalMilestoneValue / contractValue) * 100)
    : 0;
  const hasValueMismatch = contractValue !== null && contractValue > 0 && Math.abs(totalMilestoneValue - contractValue) > 0.01;

  // ── Create / Edit ───────────────────────────────────────────────

  const openCreateModal = () => {
    const nextDrawNumber = milestones.length > 0
      ? Math.max(...milestones.map((m) => m.draw_number)) + 1
      : 1;
    setEditMilestone(null);
    setForm({
      draw_number: String(nextDrawNumber),
      description: '',
      calculation_type: 'percentage',
      value: '',
      calculated_amount: '',
      notes: '',
    });
    setFormErrors({});
    setShowFormModal(true);
  };

  const openEditModal = (milestone: DrawMilestone) => {
    setEditMilestone(milestone);
    setForm({
      draw_number: String(milestone.draw_number),
      description: milestone.description,
      calculation_type: milestone.calculation_type,
      value: String(milestone.value),
      calculated_amount: '',
      notes: milestone.notes || '',
    });
    setFormErrors({});
    setShowFormModal(true);
  };

  const getCalculatedPreview = (): number => {
    const val = parseFloat(form.value);
    if (isNaN(val) || val <= 0) return 0;
    if (form.calculation_type === 'percentage') {
      return contractValue ? (val / 100) * contractValue : 0;
    }
    return val;
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const isEdit = !!editMilestone;

    if (!isEdit) {
      const drawNum = parseInt(form.draw_number, 10);
      if (!form.draw_number || isNaN(drawNum) || drawNum < 1) {
        errors.draw_number = 'Draw number must be a positive integer';
      } else if (milestones.some((m) => m.draw_number === drawNum)) {
        errors.draw_number = 'Draw number already exists for this project';
      }
    }

    if (!form.description.trim()) {
      errors.description = 'Description is required';
    } else if (form.description.length > 255) {
      errors.description = 'Description must be 255 characters or less';
    }

    if (!isEdit) {
      const val = parseFloat(form.value);
      if (!form.value || isNaN(val) || val <= 0) {
        errors.value = 'Value must be greater than 0';
      } else if (form.calculation_type === 'percentage' && val > 100) {
        errors.value = 'Percentage cannot exceed 100%';
      }
    }

    if (form.calculated_amount) {
      const ca = parseFloat(form.calculated_amount);
      if (isNaN(ca) || ca < 0.01) {
        errors.calculated_amount = 'Amount must be at least $0.01';
      }
    }

    if (form.notes.length > 5000) {
      errors.notes = 'Notes must be 5000 characters or less';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);

    try {
      if (editMilestone) {
        const dto: UpdateMilestoneDto = {
          description: form.description.trim(),
          notes: form.notes.trim(),
        };
        if (editMilestone.status === 'pending' && form.calculated_amount) {
          dto.calculated_amount = parseFloat(form.calculated_amount);
        }
        await updateMilestone(projectId, editMilestone.id, dto);
        toast.success('Milestone updated');
      } else {
        const dto: CreateMilestoneDto = {
          draw_number: parseInt(form.draw_number, 10),
          description: form.description.trim(),
          calculation_type: form.calculation_type,
          value: parseFloat(form.value),
        };
        if (form.calculated_amount) {
          dto.calculated_amount = parseFloat(form.calculated_amount);
        }
        if (form.notes.trim()) {
          dto.notes = form.notes.trim();
        }
        await createMilestone(projectId, dto);
        toast.success('Milestone created');
      }
      setShowFormModal(false);
      setEditMilestone(null);
      loadData();
      onDataChange();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e.response?.data?.message || e.message || 'Failed to save milestone');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deletingMilestone) return;
    setDeleting(true);
    try {
      await deleteMilestone(projectId, deletingMilestone.id);
      toast.success('Milestone deleted');
      setDeletingMilestone(null);
      loadData();
      onDataChange();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e.response?.data?.message || e.message || 'Failed to delete milestone');
    } finally {
      setDeleting(false);
    }
  };

  // ── Generate Invoice ────────────────────────────────────────────

  const openInvoiceModal = (milestone: DrawMilestone) => {
    setInvoiceMilestone(milestone);
    setInvoiceForm({
      description: milestone.description,
      due_date: '',
      tax_amount: 0,
      notes: '',
    });
  };

  const handleGenerateInvoice = async () => {
    if (!invoiceMilestone) return;
    setInvoiceSubmitting(true);

    try {
      const dto: GenerateMilestoneInvoiceDto = {};
      if (invoiceForm.description.trim() && invoiceForm.description.trim() !== invoiceMilestone.description) {
        dto.description = invoiceForm.description.trim();
      }
      if (invoiceForm.due_date) {
        dto.due_date = invoiceForm.due_date;
      }
      if (invoiceForm.tax_amount > 0) {
        dto.tax_amount = invoiceForm.tax_amount;
      }
      if (invoiceForm.notes.trim()) {
        dto.notes = invoiceForm.notes.trim();
      }

      const invoice = await generateMilestoneInvoice(projectId, invoiceMilestone.id, dto);
      toast.success(`Invoice ${invoice.invoice_number} generated from milestone`);
      setInvoiceMilestone(null);
      loadData();
      onDataChange();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e.response?.data?.message || e.message || 'Failed to generate invoice');
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="p-8">
        <LoadingSpinner size="lg" centered />
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Milestone className="w-5 h-5" />
              Draw Schedule
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Billing milestones for this project
            </p>
          </div>
          {canManage && (
            <Button onClick={openCreateModal} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Milestone
            </Button>
          )}
        </div>

        {/* Contract Value Summary */}
        {contractValue !== null && contractValue > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contract Value</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(contractValue)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Milestone Value</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalMilestoneValue)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Coverage</p>
              <div className="flex items-center gap-2 mt-1">
                <p className={`text-lg font-bold ${hasValueMismatch ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                  {milestonePercentage}%
                </p>
                {hasValueMismatch && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {totalMilestoneValue > contractValue ? 'Over' : 'Under'} contract
                  </span>
                )}
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    hasValueMismatch
                      ? totalMilestoneValue > contractValue
                        ? 'bg-amber-500'
                        : 'bg-amber-400'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(milestonePercentage, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {milestones.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <Milestone className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">No milestones yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Add draw milestones to define billing stages for this project.
            </p>
            {canManage && (
              <Button onClick={openCreateModal} size="sm" variant="secondary">
                <Plus className="w-4 h-4 mr-1" />
                Add First Milestone
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 w-12">#</th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-600 dark:text-gray-300">Description</th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 w-28">Type</th>
                    <th className="text-right py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 w-32">Amount</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 w-28">Status</th>
                    <th className="text-right py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 w-44">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {milestones.map((milestone) => {
                    const statusConf = STATUS_CONFIG[milestone.status];
                    const StatusIcon = statusConf.icon;
                    return (
                      <tr key={milestone.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">
                          {milestone.draw_number}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-gray-900 dark:text-white font-medium">{milestone.description}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {milestone.quote_draw_entry_id && (
                              <Badge variant="indigo" label="From Quote" />
                            )}
                            {milestone.notes && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
                                {milestone.notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-gray-600 dark:text-gray-300">
                            {milestone.calculation_type === 'percentage'
                              ? `${milestone.value}%`
                              : formatCurrency(milestone.value)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(milestone.calculated_amount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant={statusConf.variant} icon={StatusIcon} label={statusConf.label} />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1">
                            {milestone.status === 'pending' && canManage && (
                              <>
                                <button
                                  onClick={() => openInvoiceModal(milestone)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md
                                    text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20
                                    hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                  title="Generate Invoice"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Invoice
                                </button>
                                <button
                                  onClick={() => openEditModal(milestone)}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors"
                                  title="Edit Milestone"
                                  aria-label={`Edit milestone: ${milestone.description}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {canDelete && (
                                  <button
                                    onClick={() => setDeletingMilestone(milestone)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600 transition-colors"
                                    title="Delete Milestone"
                                    aria-label={`Delete milestone: ${milestone.description}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                            {(milestone.status === 'invoiced' || milestone.status === 'paid') && milestone.invoice_number && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                                <ExternalLink className="w-3.5 h-3.5" />
                                {milestone.invoice_number}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {milestones.map((milestone) => {
                const statusConf = STATUS_CONFIG[milestone.status];
                const StatusIcon = statusConf.icon;
                return (
                  <div key={milestone.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-500 dark:text-gray-400">#{milestone.draw_number}</span>
                          <Badge variant={statusConf.variant} icon={StatusIcon} label={statusConf.label} />
                          {milestone.quote_draw_entry_id && (
                            <Badge variant="indigo" label="From Quote" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {milestone.description}
                        </p>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatCurrency(milestone.calculated_amount)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {milestone.calculation_type === 'percentage'
                            ? `${milestone.value}%`
                            : 'Fixed'}
                        </p>
                      </div>
                    </div>

                    {milestone.notes && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1 mb-2">
                        {milestone.notes}
                      </p>
                    )}

                    {/* Actions bar */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      {milestone.status === 'pending' && canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openInvoiceModal(milestone)}
                            className="text-xs"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1" />
                            Generate Invoice
                          </Button>
                          <div className="flex-1" />
                          <button
                            onClick={() => openEditModal(milestone)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600"
                            title="Edit Milestone"
                            aria-label={`Edit milestone: ${milestone.description}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setDeletingMilestone(milestone)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600"
                              title="Delete Milestone"
                              aria-label={`Delete milestone: ${milestone.description}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      {(milestone.status === 'invoiced' || milestone.status === 'paid') && milestone.invoice_number && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                          <ExternalLink className="w-3.5 h-3.5" />
                          {milestone.invoice_number}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* ── Create / Edit Modal ──────────────────────────────────── */}
      <Modal
        isOpen={showFormModal}
        onClose={() => { setShowFormModal(false); setEditMilestone(null); }}
        title={editMilestone ? 'Edit Milestone' : 'Add Milestone'}
        size="lg"
      >
        <div className="space-y-4">
          {!editMilestone && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Draw Number"
                type="number"
                value={form.draw_number}
                onChange={(e) => setForm({ ...form, draw_number: e.target.value })}
                error={formErrors.draw_number}
                required
                min={1}
                step={1}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Calculation Type <span className="text-red-500">*</span>
                </label>
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, calculation_type: 'percentage', calculated_amount: '' })}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                      form.calculation_type === 'percentage'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Percentage
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, calculation_type: 'fixed_amount', calculated_amount: '' })}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                      form.calculation_type === 'fixed_amount'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Fixed Amount
                  </button>
                </div>
              </div>
            </div>
          )}

          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            error={formErrors.description}
            required
            placeholder="e.g., 50% at framing complete"
            maxLength={255}
          />

          {!editMilestone && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {form.calculation_type === 'percentage' ? (
                <Input
                  label="Percentage (%)"
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  error={formErrors.value}
                  required
                  min={0.01}
                  max={100}
                  step={0.01}
                  placeholder="e.g., 50"
                />
              ) : (
                <MoneyInput
                  label="Fixed Amount"
                  value={form.value ? parseFloat(form.value) : 0}
                  onChange={(val) => setForm({ ...form, value: String(val) })}
                  error={formErrors.value}
                  required
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Calculated Amount (Preview)
                </label>
                <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(getCalculatedPreview())}
                </div>
                {form.calculation_type === 'percentage' && contractValue && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {form.value || '0'}% of {formatCurrency(contractValue)} contract
                  </p>
                )}
                {form.calculation_type === 'percentage' && !contractValue && (
                  <p className="text-xs text-amber-500 mt-1">
                    No contract value set — percentage cannot be calculated
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Amount Override (for edit or create) */}
          {(editMilestone ? editMilestone.status === 'pending' : true) && (
            <MoneyInput
              label={editMilestone ? 'Override Amount' : 'Override Calculated Amount (optional)'}
              value={form.calculated_amount ? parseFloat(form.calculated_amount) : 0}
              onChange={(val) => setForm({ ...form, calculated_amount: val > 0 ? String(val) : '' })}
              error={formErrors.calculated_amount}
              helperText={editMilestone
                ? `Leave empty to keep current amount (${formatCurrency(editMilestone.calculated_amount)})`
                : 'Leave empty to use the auto-calculated amount above'}
            />
          )}

          {editMilestone && editMilestone.status !== 'pending' && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Amount cannot be changed — milestone has been invoiced.</span>
            </div>
          )}

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            error={formErrors.notes}
            placeholder="Optional notes about this milestone..."
            rows={3}
            maxLength={5000}
          />
        </div>

        <ModalActions>
          <Button variant="ghost" onClick={() => { setShowFormModal(false); setEditMilestone(null); }} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleFormSubmit} disabled={submitting} loading={submitting}>
            {editMilestone ? 'Update Milestone' : 'Create Milestone'}
          </Button>
        </ModalActions>
      </Modal>

      {/* ── Generate Invoice Modal ───────────────────────────────── */}
      <Modal
        isOpen={!!invoiceMilestone}
        onClose={() => setInvoiceMilestone(null)}
        title="Generate Invoice from Milestone"
        size="lg"
      >
        {invoiceMilestone && (
          <>
            {/* Milestone summary */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-300 uppercase tracking-wide">
                    Draw #{invoiceMilestone.draw_number}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                    {invoiceMilestone.description}
                  </p>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(invoiceMilestone.calculated_amount)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Invoice Description"
                value={invoiceForm.description}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                placeholder="Defaults to milestone description"
                maxLength={500}
              />

              <DatePicker
                label="Due Date"
                value={invoiceForm.due_date}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
              />

              <MoneyInput
                label="Tax Amount"
                value={invoiceForm.tax_amount}
                onChange={(val) => setInvoiceForm({ ...invoiceForm, tax_amount: val })}
              />

              <Textarea
                label="Notes"
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                placeholder="e.g., Net 30 terms"
                rows={3}
                maxLength={5000}
              />
            </div>

            <ModalActions>
              <Button variant="ghost" onClick={() => setInvoiceMilestone(null)} disabled={invoiceSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleGenerateInvoice} disabled={invoiceSubmitting} loading={invoiceSubmitting}>
                <FileText className="w-4 h-4 mr-1" />
                Generate Invoice
              </Button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* ── Delete Confirmation ──────────────────────────────────── */}
      {deletingMilestone && (
        <DeleteConfirmationModal
          isOpen={!!deletingMilestone}
          onClose={() => setDeletingMilestone(null)}
          onConfirm={handleDelete}
          title="Delete Milestone"
          message={`Are you sure you want to delete Draw #${deletingMilestone.draw_number} — "${deletingMilestone.description}" (${formatCurrency(deletingMilestone.calculated_amount)})? This action cannot be undone.`}
          isDeleting={deleting}
        />
      )}
    </>
  );
}
