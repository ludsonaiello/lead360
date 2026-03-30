/**
 * Crew Payments List Page
 * Sprint 23 — Crew Hours & Payments Management
 * List, filter, create crew payments, view payment history
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  Plus,
  Users,
  ArrowLeft,
  Eye,
  AlertCircle,
  Banknote,
  FileCheck,
  Building2,
  Smartphone,
  Zap,
  ArrowLeftRight,
  History,
  Calendar,
  Clock,
  DollarSign,
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
import {
  getCrewPayments,
  createCrewPayment,
  getCrewPaymentHistory,
} from '@/lib/api/financial';
import { getCrewMembers } from '@/lib/api/crew';
import { getProjects, formatDate, formatCurrency } from '@/lib/api/projects';
import type {
  CrewPayment,
  CreateCrewPaymentDto,
  PaymentMethodType,
  PaginatedResponse,
} from '@/lib/types/financial';

// ========== CONSTANTS ==========

const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Bookkeeper'];
const CAN_CREATE_ROLES = ['Owner', 'Admin', 'Bookkeeper'];
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

interface CrewOption {
  value: string;
  label: string;
}

interface ProjectOption {
  value: string;
  label: string;
}

// ========== COMPONENT ==========

export default function CrewPaymentsPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();

  const canView = hasRole(CAN_VIEW_ROLES);
  const canCreate = hasRole(CAN_CREATE_ROLES);
  const canViewHistory = hasRole(CAN_VIEW_HISTORY_ROLES);

  // List state
  const [payments, setPayments] = useState<PaginatedResponse<CrewPayment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filter state
  const [filterCrewMember, setFilterCrewMember] = useState('');
  const [filterProject, setFilterProject] = useState('');

  // Filter options
  const [crewOptions, setCrewOptions] = useState<CrewOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    crew_member_id: '',
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '' as PaymentMethodType | '',
    project_id: '',
    reference_number: '',
    period_start_date: '',
    period_end_date: '',
    hours_paid: '',
    notes: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewItem, setViewItem] = useState<CrewPayment | null>(null);

  // Payment History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCrewMember, setHistoryCrewMember] = useState<{ id: string; name: string } | null>(null);
  const [historyData, setHistoryData] = useState<PaginatedResponse<CrewPayment> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyProjectFilter, setHistoryProjectFilter] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // ========== DATA LOADING ==========

  const loadFilterOptions = useCallback(async () => {
    try {
      const [crewData, projectData] = await Promise.all([
        getCrewMembers({ limit: 100 }),
        getProjects({ limit: 100 }),
      ]);
      setCrewOptions(
        crewData.data
          .filter((c) => c.is_active)
          .map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))
      );
      setProjectOptions(
        projectData.data.map((p) => ({
          value: p.id,
          label: `${p.name} (${p.project_number})`,
        }))
      );
    } catch {
      // Non-blocking
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCrewPayments({
        page,
        limit: PAGE_SIZE,
        crew_member_id: filterCrewMember || undefined,
        project_id: filterProject || undefined,
      });
      setPayments(data);
    } catch {
      toast.error('Failed to load crew payments');
    } finally {
      setLoading(false);
    }
  }, [page, filterCrewMember, filterProject]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    if (canView) loadPayments();
  }, [loadPayments, canView]);

  useEffect(() => {
    setPage(1);
  }, [filterCrewMember, filterProject]);

  // ========== CREATE MODAL ==========

  const openCreateModal = () => {
    setCreateForm({
      crew_member_id: '',
      amount: 0,
      payment_date: today,
      payment_method: '',
      project_id: '',
      reference_number: '',
      period_start_date: '',
      period_end_date: '',
      hours_paid: '',
      notes: '',
    });
    setCreateErrors({});
    setShowCreateModal(true);
  };

  const validateCreate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!createForm.crew_member_id) errs.crew_member_id = 'Crew member is required';
    if (!createForm.amount || createForm.amount <= 0) errs.amount = 'Amount must be greater than $0.00';
    if (!createForm.payment_date) errs.payment_date = 'Payment date is required';
    if (createForm.payment_date > today) errs.payment_date = 'Payment date cannot be in the future';
    if (!createForm.payment_method) errs.payment_method = 'Payment method is required';
    if (createForm.period_end_date && createForm.period_start_date && createForm.period_end_date < createForm.period_start_date) {
      errs.period_end_date = 'Period end must be on or after period start';
    }
    if (createForm.hours_paid) {
      const hp = parseFloat(createForm.hours_paid);
      if (isNaN(hp) || hp < 0) errs.hours_paid = 'Hours must be 0 or more';
    }
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
      const dto: CreateCrewPaymentDto = {
        crew_member_id: createForm.crew_member_id,
        amount: createForm.amount,
        payment_date: createForm.payment_date,
        payment_method: createForm.payment_method as PaymentMethodType,
        project_id: createForm.project_id || undefined,
        reference_number: createForm.reference_number || undefined,
        period_start_date: createForm.period_start_date || undefined,
        period_end_date: createForm.period_end_date || undefined,
        hours_paid: createForm.hours_paid ? parseFloat(createForm.hours_paid) : undefined,
        notes: createForm.notes || undefined,
      };
      await createCrewPayment(dto);

      const memberName = crewOptions.find((c) => c.value === createForm.crew_member_id)?.label || 'crew member';
      toast.success(`Payment of ${formatCurrency(createForm.amount)} recorded for ${memberName}`);
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

  const openViewModal = (payment: CrewPayment) => {
    setViewItem(payment);
    setShowViewModal(true);
  };

  // ========== PAYMENT HISTORY MODAL ==========

  const openHistoryModal = (crewMemberId: string, crewMemberName: string) => {
    setHistoryCrewMember({ id: crewMemberId, name: crewMemberName });
    setHistoryPage(1);
    setHistoryProjectFilter('');
    setShowHistoryModal(true);
  };

  const loadHistory = useCallback(async () => {
    if (!historyCrewMember) return;
    setHistoryLoading(true);
    try {
      const data = await getCrewPaymentHistory(historyCrewMember.id, {
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
  }, [historyCrewMember, historyPage, historyProjectFilter]);

  useEffect(() => {
    if (showHistoryModal && historyCrewMember) loadHistory();
  }, [loadHistory, showHistoryModal, historyCrewMember]);

  const historyTotal = historyData?.data.reduce((sum, p) => sum + parseFloat(p.amount), 0) ?? 0;

  // ========== HELPERS ==========

  const clearFilters = () => {
    setFilterCrewMember('');
    setFilterProject('');
  };

  const hasActiveFilters = filterCrewMember || filterProject;

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
        <p className="text-gray-500 dark:text-gray-400 mb-4">You do not have permission to view crew payments.</p>
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crew Payments</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Record and track crew member compensation
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
            label="Crew Member"
            searchable
            options={[{ value: '', label: 'All Crew Members' }, ...crewOptions]}
            value={filterCrewMember}
            onChange={(val) => setFilterCrewMember(val)}
            placeholder="All Crew Members"
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
              {filterCrewMember && canViewHistory && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const member = crewOptions.find((c) => c.value === filterCrewMember);
                    if (member) openHistoryModal(member.value, member.label);
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
              <CreditCard className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No payments recorded
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {hasActiveFilters
                ? 'No payments match your current filters. Try adjusting your search criteria.'
                : 'Start recording crew payments to track compensation.'}
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
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Crew Member</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Method</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Project</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Period</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.data.map((p) => {
                    const amount = parseFloat(p.amount);
                    const hoursPaid = p.hours_paid ? parseFloat(p.hours_paid) : null;
                    return (
                      <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-3 text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="font-medium">
                              {p.crew_member.first_name} {p.crew_member.last_name}
                            </span>
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
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 text-xs">
                          {p.period_start_date && p.period_end_date ? (
                            <div>
                              <div>{formatDate(p.period_start_date)} – {formatDate(p.period_end_date)}</div>
                              {hoursPaid !== null && <div>{hoursPaid}h</div>}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => openViewModal(p)}
                            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="View details"
                            aria-label={`View payment for ${p.crew_member.first_name} ${p.crew_member.last_name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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
                const hoursPaid = p.hours_paid ? parseFloat(p.hours_paid) : null;
                return (
                  <div key={p.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {p.crew_member.first_name} {p.crew_member.last_name}
                        </span>
                        {p.project && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
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
                      {p.period_start_date && p.period_end_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(p.period_start_date)} – {formatDate(p.period_end_date)}
                        </div>
                      )}
                      {hoursPaid !== null && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {hoursPaid} hours
                        </div>
                      )}
                      {p.reference_number && (
                        <div className="text-xs">Ref: {p.reference_number}</div>
                      )}
                    </div>
                    <div className="flex justify-end mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openViewModal(p)}
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
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Record Crew Payment" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Crew Member"
            required
            searchable
            options={crewOptions}
            value={createForm.crew_member_id}
            onChange={(val) => setCreateForm({ ...createForm, crew_member_id: val })}
            error={createErrors.crew_member_id}
            placeholder="Select crew member"
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

          {/* Pay Period Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Pay Period (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DatePicker
                label="Period Start"
                value={createForm.period_start_date}
                onChange={(e) => setCreateForm({ ...createForm, period_start_date: e.target.value })}
              />
              <DatePicker
                label="Period End"
                value={createForm.period_end_date}
                onChange={(e) => setCreateForm({ ...createForm, period_end_date: e.target.value })}
                min={createForm.period_start_date}
                error={createErrors.period_end_date}
              />
              <Input
                label="Hours Paid"
                type="number"
                step="0.01"
                min="0"
                value={createForm.hours_paid}
                onChange={(e) => setCreateForm({ ...createForm, hours_paid: e.target.value })}
                error={createErrors.hours_paid}
                placeholder="e.g., 40"
              />
            </div>
          </div>

          <Textarea
            label="Notes"
            value={createForm.notes}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            placeholder="Optional notes"
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
                  Crew Member
                </label>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {viewItem.crew_member.first_name} {viewItem.crew_member.last_name}
                </p>
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

            {/* Pay period */}
            {(viewItem.period_start_date || viewItem.period_end_date || viewItem.hours_paid) && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                  Pay Period
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Start</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {viewItem.period_start_date ? formatDate(viewItem.period_start_date) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">End</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {viewItem.period_end_date ? formatDate(viewItem.period_end_date) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Hours Paid</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {viewItem.hours_paid ? `${parseFloat(viewItem.hours_paid)}h` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

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
              {canViewHistory && (
                <Button
                  onClick={() => {
                    setShowViewModal(false);
                    openHistoryModal(
                      viewItem.crew_member_id,
                      `${viewItem.crew_member.first_name} ${viewItem.crew_member.last_name}`
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
        title={`Payment History — ${historyCrewMember?.name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
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
            {historyData && historyData.data.length > 0 && (
              <div className="flex items-end">
                <div className="px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">Total Visible</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(historyTotal)}
                  </p>
                </div>
              </div>
            )}
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
              <p className="text-gray-500 dark:text-gray-400">No payments found for this crew member.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {historyData.data.map((p) => {
                  const amount = parseFloat(p.amount);
                  const hoursPaid = p.hours_paid ? parseFloat(p.hours_paid) : null;
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
                        {p.period_start_date && p.period_end_date && (
                          <div>
                            Period: {formatDate(p.period_start_date)} – {formatDate(p.period_end_date)}
                            {hoursPaid !== null && ` · ${hoursPaid}h`}
                          </div>
                        )}
                        {p.reference_number && <div>Ref: {p.reference_number}</div>}
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
    </div>
  );
}
