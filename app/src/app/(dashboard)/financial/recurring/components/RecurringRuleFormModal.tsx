'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Calendar,
  RefreshCw,
  Building2,
  Settings,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import ModalActions from '@/components/ui/ModalActions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { SelectOption } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  getSuppliers,
  getPaymentMethods,
  createRecurringRule,
  updateRecurringRule,
} from '@/lib/api/financial';
import type {
  RecurringRule,
  RecurringFrequency,
  FinancialCategory,
  SupplierListItem,
  PaymentMethodRegistry,
  CreateRecurringRuleDto,
  UpdateRecurringRuleDto,
} from '@/lib/types/financial';

// ────────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────────

interface RecurringRuleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  rule: RecurringRule | null; // null → create, non-null → edit
  categories: FinancialCategory[];
}

// ────────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS: SelectOption[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

const DAY_OF_WEEK_OPTIONS: SelectOption[] = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const FREQUENCY_UNIT: Record<RecurringFrequency, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  annual: 'year',
};

// ────────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────────

export default function RecurringRuleFormModal({
  isOpen,
  onClose,
  onSuccess,
  rule,
  categories,
}: RecurringRuleFormModalProps) {
  const isEdit = rule !== null;

  // ── Form fields ────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [taxAmount, setTaxAmount] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [interval, setInterval] = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [notes, setNotes] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [nextDueDateUnlocked, setNextDueDateUnlocked] = useState(false);

  // ── Reference data ─────────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRegistry[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(false);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ── Load suppliers & payment methods when modal opens ──────────────────────
  const loadReferenceData = useCallback(async () => {
    setReferenceLoading(true);
    try {
      const [suppliersRes, methods] = await Promise.all([
        getSuppliers({ page: 1, limit: 100, is_active: true }),
        getPaymentMethods({ is_active: true }),
      ]);
      setSuppliers(suppliersRes.data);
      setPaymentMethods(methods);
    } catch {
      toast.error('Failed to load form options');
    } finally {
      setReferenceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadReferenceData();
  }, [isOpen, loadReferenceData]);

  // ── Populate / reset form ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (rule) {
      setName(rule.name);
      setDescription(rule.description || '');
      setCategoryId(rule.category_id);
      setAmount(parseFloat(rule.amount));
      setTaxAmount(rule.tax_amount ? parseFloat(rule.tax_amount) : null);
      setFrequency(rule.frequency);
      setInterval(rule.interval.toString());
      setDayOfMonth(rule.day_of_month?.toString() || '');
      setDayOfWeek(rule.day_of_week?.toString() || '');
      setStartDate(rule.start_date.split('T')[0]);
      setEndDate(rule.end_date ? rule.end_date.split('T')[0] : '');
      setRecurrenceCount(rule.recurrence_count?.toString() || '');
      setSupplierId(rule.supplier_id || '');
      setVendorName(rule.vendor_name || '');
      setPaymentMethodId(rule.payment_method_registry_id || '');
      setAutoConfirm(rule.auto_confirm);
      setNotes(rule.notes || '');
      setNextDueDate(rule.next_due_date.split('T')[0]);
      setNextDueDateUnlocked(false);
    } else {
      setName('');
      setDescription('');
      setCategoryId('');
      setAmount(null);
      setTaxAmount(null);
      setFrequency('monthly');
      setInterval('1');
      setDayOfMonth('');
      setDayOfWeek('');
      setStartDate('');
      setEndDate('');
      setRecurrenceCount('');
      setSupplierId('');
      setVendorName('');
      setPaymentMethodId('');
      setAutoConfirm(true);
      setNotes('');
      setNextDueDate('');
      setNextDueDateUnlocked(false);
    }
    setErrors({});
  }, [isOpen, rule]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const showDayOfWeek = frequency === 'weekly';
  const showDayOfMonth =
    frequency === 'monthly' || frequency === 'quarterly' || frequency === 'annual';

  const intervalNum = parseInt(interval) || 1;
  const intervalExplanation =
    intervalNum > 1
      ? `Every ${intervalNum} ${FREQUENCY_UNIT[frequency]}s`
      : `Every ${FREQUENCY_UNIT[frequency]}`;

  // Use local date to avoid UTC shift (e.g., 10PM EDT = next day in UTC)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: Record<string, string> = {};

    if (!name.trim()) e.name = 'Rule name is required';
    else if (name.trim().length > 200) e.name = 'Must be 200 characters or less';

    if (!categoryId) e.categoryId = 'Category is required';

    if (amount === null || amount === undefined) e.amount = 'Amount is required';
    else if (amount < 0.01) e.amount = 'Must be at least $0.01';

    if (taxAmount !== null && taxAmount !== undefined && amount !== null && amount !== undefined) {
      if (taxAmount >= amount) e.taxAmount = 'Tax must be less than the amount';
    }

    if (!isEdit) {
      if (!startDate) e.startDate = 'Start date is required';
      else if (startDate < today) e.startDate = 'Must be today or in the future';
    }

    if (endDate && startDate && endDate <= startDate) {
      e.endDate = 'Must be after start date';
    }

    const parsedInterval = parseInt(interval);
    if (interval && (isNaN(parsedInterval) || parsedInterval < 1 || parsedInterval > 12)) {
      e.interval = 'Must be between 1 and 12';
    }

    if (dayOfMonth) {
      const dom = parseInt(dayOfMonth);
      if (isNaN(dom) || dom < 1 || dom > 28) e.dayOfMonth = 'Must be between 1 and 28';
    }

    if (recurrenceCount) {
      const rc = parseInt(recurrenceCount);
      if (isNaN(rc) || rc < 1) e.recurrenceCount = 'Must be at least 1';
    }

    if (vendorName && vendorName.length > 200) e.vendorName = 'Must be 200 characters or less';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const shared = {
        name: name.trim(),
        category_id: categoryId,
        amount: amount!,
        frequency,
        description: description.trim() || undefined,
        tax_amount: taxAmount ?? undefined,
        supplier_id: supplierId || undefined,
        vendor_name: vendorName.trim() || undefined,
        payment_method_registry_id: paymentMethodId || undefined,
        interval: parseInt(interval) || 1,
        day_of_month: showDayOfMonth && dayOfMonth ? parseInt(dayOfMonth) : undefined,
        day_of_week: showDayOfWeek && dayOfWeek ? parseInt(dayOfWeek) : undefined,
        end_date: endDate || undefined,
        recurrence_count: recurrenceCount ? parseInt(recurrenceCount) : undefined,
        auto_confirm: autoConfirm,
        notes: notes.trim() || undefined,
      };

      if (isEdit) {
        const updateDto: UpdateRecurringRuleDto = { ...shared };
        // Include next_due_date only when user explicitly unlocked and changed it
        if (nextDueDateUnlocked && nextDueDate && nextDueDate !== rule!.next_due_date.split('T')[0]) {
          updateDto.next_due_date = nextDueDate;
        }
        await updateRecurringRule(rule!.id, updateDto);
        toast.success('Rule updated successfully');
      } else {
        const dto: CreateRecurringRuleDto = { ...shared, start_date: startDate };
        await createRecurringRule(dto);
        toast.success('Rule created successfully');
      }
      onSuccess();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'An unexpected error occurred';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // ── Select options ─────────────────────────────────────────────────────────
  const categoryOptions: SelectOption[] = categories
    .filter((c) => c.is_active)
    .map((c) => ({ value: c.id, label: c.name }));

  const supplierOptions: SelectOption[] = [
    { value: '', label: 'None' },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ];

  const paymentMethodOptions: SelectOption[] = [
    { value: '', label: 'None' },
    ...paymentMethods.map((m) => ({
      value: m.id,
      label: `${m.nickname}${m.last_four ? ` (****${m.last_four})` : ''}`,
    })),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={
        <span className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {isEdit ? 'Edit Recurring Rule' : 'Create Recurring Rule'}
        </span>
      }
      size="xl"
    >
      {referenceLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ─── Section 1: Basic Information ─────────────────────────────── */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Basic Information
            </h4>
            <div className="space-y-4">
              <Input
                label="Rule Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                required
                maxLength={200}
                placeholder="e.g., Office Rent"
              />

              <Textarea
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                resize="none"
              />

              <Select
                label="Category"
                options={categoryOptions}
                value={categoryId}
                onChange={setCategoryId}
                error={errors.categoryId}
                required
                searchable
                placeholder="Select a category..."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CurrencyInput
                  label="Amount"
                  value={amount}
                  onChange={setAmount}
                  error={errors.amount}
                  required
                  leftIcon={<DollarSign className="h-4 w-4" />}
                  placeholder="0.00"
                  min={0.01}
                />
                <CurrencyInput
                  label="Tax Amount"
                  value={taxAmount}
                  onChange={setTaxAmount}
                  error={errors.taxAmount}
                  leftIcon={<DollarSign className="h-4 w-4" />}
                  placeholder="0.00"
                  helperText="Must be less than amount"
                />
              </div>
            </div>
          </div>

          {/* ─── Section 2: Schedule ──────────────────────────────────────── */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Schedule
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Frequency"
                  options={FREQUENCY_OPTIONS}
                  value={frequency}
                  onChange={(v) => setFrequency(v as RecurringFrequency)}
                  required
                />
                <Input
                  label="Interval"
                  type="number"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  error={errors.interval}
                  min={1}
                  max={12}
                  helperText={intervalExplanation}
                />
              </div>

              {showDayOfMonth && (
                <Input
                  label="Day of Month"
                  type="number"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  error={errors.dayOfMonth}
                  min={1}
                  max={28}
                  placeholder="1–28"
                  helperText="Leave empty to use the start date's day."
                />
              )}

              {showDayOfWeek && (
                <Select
                  label="Day of Week"
                  options={DAY_OF_WEEK_OPTIONS}
                  value={dayOfWeek}
                  onChange={setDayOfWeek}
                  placeholder="Select a day..."
                  helperText="Leave empty to use the start date's day."
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  error={errors.startDate}
                  required={!isEdit}
                  min={isEdit ? undefined : today}
                  disabled={isEdit}
                  helperText={isEdit ? 'Cannot be changed after creation' : undefined}
                />
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  error={errors.endDate}
                  min={startDate || today}
                  helperText="Leave empty for indefinite"
                />
              </div>

              {/* Next Due Date — edit mode only, behind unlock gate */}
              {isEdit && (
                <div className="space-y-2">
                  {!nextDueDateUnlocked ? (
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Next due date:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">{nextDueDate}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNextDueDateUnlocked(true)}
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-800 dark:text-amber-300">
                          <p className="font-semibold">Careful — changing the next due date affects when the next entry will be generated.</p>
                          <p className="mt-1 text-amber-700 dark:text-amber-400">
                            Only change this if you deleted a generated entry and need to re-align the schedule, or if you triggered an entry manually and the date advanced incorrectly.
                          </p>
                        </div>
                      </div>
                      <DatePicker
                        label="Next Due Date"
                        value={nextDueDate}
                        onChange={(e) => setNextDueDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              <Input
                label="Max Occurrences"
                type="number"
                value={recurrenceCount}
                onChange={(e) => setRecurrenceCount(e.target.value)}
                error={errors.recurrenceCount}
                min={1}
                placeholder="Unlimited"
                helperText="Stop after this many occurrences"
              />
            </div>
          </div>

          {/* ─── Section 3: Vendor & Payment ──────────────────────────────── */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Vendor & Payment
            </h4>
            <div className="space-y-4">
              <Select
                label="Supplier"
                options={supplierOptions}
                value={supplierId}
                onChange={setSupplierId}
                searchable
                placeholder="Select a supplier..."
              />
              <Input
                label="Vendor Name"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                error={errors.vendorName}
                maxLength={200}
                placeholder="Free text vendor name..."
                leftIcon={<Building2 className="h-4 w-4" />}
              />
              <Select
                label="Payment Account"
                options={paymentMethodOptions}
                value={paymentMethodId}
                onChange={setPaymentMethodId}
                searchable
                placeholder="Select a payment method..."
              />
            </div>
          </div>

          {/* ─── Section 4: Options ───────────────────────────────────────── */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Options
            </h4>
            <div className="space-y-4">
              <ToggleSwitch
                enabled={autoConfirm}
                onChange={setAutoConfirm}
                label="Auto-Confirm"
                description="When off, generated entries will go to pending review"
              />
              <Textarea
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                resize="none"
              />
            </div>
          </div>

          {/* ─── Actions ──────────────────────────────────────────────────── */}
          <ModalActions>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              {isEdit ? 'Save Changes' : 'Create Rule'}
            </Button>
          </ModalActions>
        </form>
      )}
    </Modal>
  );
}
