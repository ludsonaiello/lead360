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
import { Plus, Users, Briefcase, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getCrewPayments,
  createCrewPayment,
  getSubcontractorPayments,
  createSubcontractorPayment,
  getCrewMembers,
  getSubcontractors,
} from '@/lib/api/financial';
import { formatCurrency, formatDate } from '@/lib/api/projects';
import type {
  CrewPayment,
  SubcontractorPayment,
  CrewMember,
  Subcontractor,
  PaymentMethod,
  PaginatedResponse,
} from '@/lib/types/financial';

interface PaymentSectionProps {
  projectId: string;
  onDataChange: () => void;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  check: 'Check',
  bank_transfer: 'Bank Transfer',
  venmo: 'Venmo',
  zelle: 'Zelle',
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
];

type PaymentTab = 'crew' | 'subcontractor';

export default function PaymentSection({ projectId, onDataChange }: PaymentSectionProps) {
  const [activeTab, setActiveTab] = useState<PaymentTab>('crew');

  // Crew payments
  const [crewPayments, setCrewPayments] = useState<PaginatedResponse<CrewPayment> | null>(null);
  const [crewPage, setCrewPage] = useState(1);
  const [crewLoading, setCrewLoading] = useState(true);

  // Subcontractor payments
  const [subPayments, setSubPayments] = useState<PaginatedResponse<SubcontractorPayment> | null>(null);
  const [subPage, setSubPage] = useState(1);
  const [subLoading, setSubLoading] = useState(true);

  // Crew payment form
  const [showCrewForm, setShowCrewForm] = useState(false);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [crewSubmitting, setCrewSubmitting] = useState(false);
  const [crewForm, setCrewForm] = useState({
    crew_member_id: '',
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '' as PaymentMethod | '',
    reference_number: '',
    notes: '',
  });
  const [crewFormErrors, setCrewFormErrors] = useState<Record<string, string>>({});

  // Subcontractor payment form
  const [showSubForm, setShowSubForm] = useState(false);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subForm, setSubForm] = useState({
    subcontractor_id: '',
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '' as PaymentMethod | '',
    reference_number: '',
    notes: '',
  });
  const [subFormErrors, setSubFormErrors] = useState<Record<string, string>>({});

  const today = new Date().toISOString().split('T')[0];

  const loadCrewPayments = useCallback(async () => {
    setCrewLoading(true);
    try {
      const data = await getCrewPayments({ project_id: projectId, page: crewPage, limit: 20 });
      setCrewPayments(data);
    } catch {
      toast.error('Failed to load crew payments');
    } finally {
      setCrewLoading(false);
    }
  }, [projectId, crewPage]);

  const loadSubPayments = useCallback(async () => {
    setSubLoading(true);
    try {
      const data = await getSubcontractorPayments({ project_id: projectId, page: subPage, limit: 20 });
      setSubPayments(data);
    } catch {
      toast.error('Failed to load subcontractor payments');
    } finally {
      setSubLoading(false);
    }
  }, [projectId, subPage]);

  useEffect(() => {
    loadCrewPayments();
  }, [loadCrewPayments]);

  useEffect(() => {
    loadSubPayments();
  }, [loadSubPayments]);

  // Crew payment form
  const openCrewForm = async () => {
    setShowCrewForm(true);
    setCrewForm({
      crew_member_id: '',
      amount: 0,
      payment_date: today,
      payment_method: '',
      reference_number: '',
      notes: '',
    });
    setCrewFormErrors({});
    try {
      const data = await getCrewMembers({ limit: 100 });
      setCrewMembers(data.data.filter((c) => c.is_active));
    } catch {
      toast.error('Failed to load crew members');
    }
  };

  const validateCrewForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!crewForm.crew_member_id) errs.crew_member_id = 'Crew member is required';
    if (!crewForm.amount || crewForm.amount <= 0) errs.amount = 'Amount must be greater than 0';
    if (!crewForm.payment_date) errs.payment_date = 'Payment date is required';
    if (crewForm.payment_date > today) errs.payment_date = 'Date cannot be in the future';
    if (!crewForm.payment_method) errs.payment_method = 'Payment method is required';
    setCrewFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCrewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCrewForm()) return;

    setCrewSubmitting(true);
    try {
      await createCrewPayment({
        crew_member_id: crewForm.crew_member_id,
        project_id: projectId,
        amount: crewForm.amount,
        payment_date: crewForm.payment_date,
        payment_method: crewForm.payment_method as PaymentMethod,
        reference_number: crewForm.reference_number || undefined,
        notes: crewForm.notes || undefined,
      });
      toast.success('Crew payment recorded');
      setShowCrewForm(false);
      loadCrewPayments();
      onDataChange();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setCrewSubmitting(false);
    }
  };

  // Subcontractor payment form
  const openSubForm = async () => {
    setShowSubForm(true);
    setSubForm({
      subcontractor_id: '',
      amount: 0,
      payment_date: today,
      payment_method: '',
      reference_number: '',
      notes: '',
    });
    setSubFormErrors({});
    try {
      const data = await getSubcontractors({ limit: 100 });
      setSubcontractors(data.data.filter((s) => s.is_active));
    } catch {
      toast.error('Failed to load subcontractors');
    }
  };

  const validateSubForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!subForm.subcontractor_id) errs.subcontractor_id = 'Subcontractor is required';
    if (!subForm.amount || subForm.amount <= 0) errs.amount = 'Amount must be greater than 0';
    if (!subForm.payment_date) errs.payment_date = 'Payment date is required';
    if (subForm.payment_date > today) errs.payment_date = 'Date cannot be in the future';
    if (!subForm.payment_method) errs.payment_method = 'Payment method is required';
    setSubFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSubForm()) return;

    setSubSubmitting(true);
    try {
      await createSubcontractorPayment({
        subcontractor_id: subForm.subcontractor_id,
        project_id: projectId,
        amount: subForm.amount,
        payment_date: subForm.payment_date,
        payment_method: subForm.payment_method as PaymentMethod,
        reference_number: subForm.reference_number || undefined,
        notes: subForm.notes || undefined,
      });
      toast.success('Subcontractor payment recorded');
      setShowSubForm(false);
      loadSubPayments();
      onDataChange();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setSubSubmitting(false);
    }
  };

  const crewMemberOptions = crewMembers.map((c) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

  const subcontractorOptions = subcontractors.map((s) => ({
    value: s.id,
    label: `${s.business_name}${s.trade_specialty ? ` (${s.trade_specialty})` : ''}`,
  }));

  return (
    <>
      <Card className="p-6">
        {/* Tab Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button
              onClick={() => setActiveTab('crew')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'crew'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Users className="w-4 h-4" />
              Crew Payments
            </button>
            <button
              onClick={() => setActiveTab('subcontractor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'subcontractor'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Subcontractor Payments
            </button>
          </div>
          <Button
            size="sm"
            onClick={activeTab === 'crew' ? openCrewForm : openSubForm}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </Button>
        </div>

        {/* Crew Payments */}
        {activeTab === 'crew' && (
          crewLoading ? (
            <div className="py-12"><LoadingSpinner size="lg" centered /></div>
          ) : !crewPayments || crewPayments.data.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                <CreditCard className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">No crew payments recorded yet</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Crew Member</th>
                      <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                      <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                      <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Method</th>
                      <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Reference</th>
                      <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crewPayments.data.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-3 text-gray-900 dark:text-white">
                          {p.crew_member.first_name} {p.crew_member.last_name}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(parseFloat(p.amount))}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(p.payment_date)}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="info">{PAYMENT_METHOD_LABELS[p.payment_method]}</Badge>
                        </td>
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400">
                          {p.reference_number || '-'}
                        </td>
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-[150px] truncate">
                          {p.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {crewPayments.data.map((p) => (
                  <div key={p.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {p.crew_member.first_name} {p.crew_member.last_name}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(parseFloat(p.amount))}</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                      <div>{formatDate(p.payment_date)} via {PAYMENT_METHOD_LABELS[p.payment_method]}</div>
                      {p.reference_number && <div>Ref: {p.reference_number}</div>}
                      {p.notes && <div className="truncate">{p.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {crewPayments.meta.pages > 1 && (
                <div className="mt-4">
                  <PaginationControls
                    currentPage={crewPage}
                    totalPages={crewPayments.meta.pages}
                    onNext={() => setCrewPage((p) => p + 1)}
                    onPrevious={() => setCrewPage((p) => p - 1)}
                  />
                </div>
              )}
            </>
          )
        )}

        {/* Subcontractor Payments */}
        {activeTab === 'subcontractor' && (
          subLoading ? (
            <div className="py-12"><LoadingSpinner size="lg" centered /></div>
          ) : !subPayments || subPayments.data.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                <CreditCard className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">No subcontractor payments recorded yet</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Subcontractor</th>
                      <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                      <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                      <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Method</th>
                      <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Reference</th>
                      <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subPayments.data.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-3 text-gray-900 dark:text-white">
                          {p.subcontractor.business_name}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(parseFloat(p.amount))}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(p.payment_date)}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="info">{PAYMENT_METHOD_LABELS[p.payment_method]}</Badge>
                        </td>
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400">
                          {p.reference_number || '-'}
                        </td>
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-[150px] truncate">
                          {p.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {subPayments.data.map((p) => (
                  <div key={p.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {p.subcontractor.business_name}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(parseFloat(p.amount))}</span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                      <div>{formatDate(p.payment_date)} via {PAYMENT_METHOD_LABELS[p.payment_method]}</div>
                      {p.reference_number && <div>Ref: {p.reference_number}</div>}
                      {p.notes && <div className="truncate">{p.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {subPayments.meta.pages > 1 && (
                <div className="mt-4">
                  <PaginationControls
                    currentPage={subPage}
                    totalPages={subPayments.meta.pages}
                    onNext={() => setSubPage((p) => p + 1)}
                    onPrevious={() => setSubPage((p) => p - 1)}
                  />
                </div>
              )}
            </>
          )
        )}
      </Card>

      {/* Crew Payment Form Modal */}
      <Modal isOpen={showCrewForm} onClose={() => setShowCrewForm(false)} title="Record Crew Payment" size="lg">
        <form onSubmit={handleCrewSubmit} className="space-y-4">
          <Select
            label="Crew Member"
            required
            searchable
            options={crewMemberOptions}
            value={crewForm.crew_member_id}
            onChange={(val) => setCrewForm({ ...crewForm, crew_member_id: val })}
            error={crewFormErrors.crew_member_id}
            placeholder="Select crew member"
          />

          <MoneyInput
            label="Amount"
            required
            value={crewForm.amount}
            onChange={(val) => setCrewForm({ ...crewForm, amount: val })}
            error={crewFormErrors.amount}
          />

          <DatePicker
            label="Payment Date"
            required
            value={crewForm.payment_date}
            onChange={(e) => setCrewForm({ ...crewForm, payment_date: e.target.value })}
            max={today}
            error={crewFormErrors.payment_date}
          />

          <Select
            label="Payment Method"
            required
            options={PAYMENT_METHOD_OPTIONS}
            value={crewForm.payment_method}
            onChange={(val) => setCrewForm({ ...crewForm, payment_method: val as PaymentMethod })}
            error={crewFormErrors.payment_method}
            placeholder="Select method"
          />

          <Input
            label="Reference Number"
            value={crewForm.reference_number}
            onChange={(e) => setCrewForm({ ...crewForm, reference_number: e.target.value })}
            placeholder="e.g., Check #1234"
            maxLength={200}
          />

          <Textarea
            label="Notes"
            value={crewForm.notes}
            onChange={(e) => setCrewForm({ ...crewForm, notes: e.target.value })}
            placeholder="Optional notes"
            rows={2}
          />

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setShowCrewForm(false)} disabled={crewSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={crewSubmitting} disabled={crewSubmitting}>
              Record Payment
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* Subcontractor Payment Form Modal */}
      <Modal isOpen={showSubForm} onClose={() => setShowSubForm(false)} title="Record Subcontractor Payment" size="lg">
        <form onSubmit={handleSubSubmit} className="space-y-4">
          <Select
            label="Subcontractor"
            required
            searchable
            options={subcontractorOptions}
            value={subForm.subcontractor_id}
            onChange={(val) => setSubForm({ ...subForm, subcontractor_id: val })}
            error={subFormErrors.subcontractor_id}
            placeholder="Select subcontractor"
          />

          <MoneyInput
            label="Amount"
            required
            value={subForm.amount}
            onChange={(val) => setSubForm({ ...subForm, amount: val })}
            error={subFormErrors.amount}
          />

          <DatePicker
            label="Payment Date"
            required
            value={subForm.payment_date}
            onChange={(e) => setSubForm({ ...subForm, payment_date: e.target.value })}
            max={today}
            error={subFormErrors.payment_date}
          />

          <Select
            label="Payment Method"
            required
            options={PAYMENT_METHOD_OPTIONS}
            value={subForm.payment_method}
            onChange={(val) => setSubForm({ ...subForm, payment_method: val as PaymentMethod })}
            error={subFormErrors.payment_method}
            placeholder="Select method"
          />

          <Input
            label="Reference Number"
            value={subForm.reference_number}
            onChange={(e) => setSubForm({ ...subForm, reference_number: e.target.value })}
            placeholder="e.g., Wire #5678"
            maxLength={200}
          />

          <Textarea
            label="Notes"
            value={subForm.notes}
            onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
            placeholder="Optional notes"
            rows={2}
          />

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setShowSubForm(false)} disabled={subSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={subSubmitting} disabled={subSubmitting}>
              Record Payment
            </Button>
          </ModalActions>
        </form>
      </Modal>
    </>
  );
}
