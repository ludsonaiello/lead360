/**
 * EntryFormModal Component
 * Create/Edit financial entry form modal
 * Sprint 9 — Full-featured entry form with all F-04 enhancements
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  FolderOpen,
  ListChecks,
  Truck,
  CreditCard,
  UserCircle,
  Users,
  FileText,
  Clock,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Modal, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { SelectOption } from '@/components/ui/Select';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

import { useRBAC } from '@/contexts/RBACContext';

import {
  getFinancialCategories,
  getPaymentMethods,
  getSuppliers,
  createFinancialEntry,
  updateFinancialEntry,
  resubmitEntry,
  createLineItem,
  updateLineItem as apiUpdateLineItem,
  deleteLineItem as apiDeleteLineItem,
} from '@/lib/api/financial';
import { getProjects, getProjectTasks } from '@/lib/api/projects';
import { listUsers } from '@/lib/api/users';
import { getCrewMembers } from '@/lib/api/crew';

import type {
  FinancialEntry,
  FinancialCategory,
  PaymentMethodRegistry,
  CreateFinancialEntryDto,
  UpdateFinancialEntryDto,
  EntryType,
  PaymentMethodType,
  CategoryType,
} from '@/lib/types/financial';
import type { Project, ProjectTask } from '@/lib/types/projects';
import type { MembershipItem } from '@/lib/types/users';
import type { CrewMember } from '@/lib/types/crew';
import LineItemsSection, {
  type LocalLineItem,
  apiLineItemsToLocal,
  localItemToCreateDto,
} from '@/app/(dashboard)/projects/[id]/components/financial/LineItemsSection';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Info } from 'lucide-react';

// ========== PROPS ==========

interface EntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry?: FinancialEntry | null;
  defaultProjectId?: string;
  defaultTaskId?: string;
  /** When 'resubmit', calls resubmitEntry API instead of updateFinancialEntry */
  mode?: 'edit' | 'resubmit';
}

// ========== CONSTANTS ==========

const PAYMENT_METHOD_TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select payment type...' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'ACH', label: 'ACH' },
];

type PurchasedByMode = 'none' | 'team' | 'crew';

// Category type labels for grouping
const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  labor: 'Labor',
  material: 'Material',
  subcontractor: 'Subcontractor',
  equipment: 'Equipment',
  insurance: 'Insurance',
  fuel: 'Fuel',
  utilities: 'Utilities',
  office: 'Office',
  marketing: 'Marketing',
  taxes: 'Taxes',
  tools: 'Tools',
  other: 'Other',
};

// ========== HELPERS ==========

function formatPaymentAccountLabel(pm: PaymentMethodRegistry): string {
  const parts: string[] = [];
  if (pm.bank_name) parts.push(pm.bank_name);
  if (pm.nickname) parts.push(pm.nickname);
  if (pm.last_four) parts.push(`···· ${pm.last_four}`);
  if (parts.length === 0) {
    return pm.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return parts.join(' ');
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ========== FORM STATE ==========

interface FormState {
  entry_type: EntryType;
  category_id: string;
  amount: number;
  tax_amount: number;
  discount: number;
  entry_date: string;
  entry_time: string;
  project_id: string;
  task_id: string;
  supplier_id: string;
  vendor_name: string;
  payment_method: string;
  payment_method_registry_id: string;
  purchased_by_mode: PurchasedByMode;
  purchased_by_user_id: string;
  purchased_by_crew_member_id: string;
  notes: string;
  submit_as_pending: boolean;
}

interface FormErrors {
  category_id?: string;
  amount?: string;
  tax_amount?: string;
  entry_date?: string;
  entry_time?: string;
  payment_method?: string;
  task_id?: string;
  purchased_by?: string;
}

function createInitialFormState(
  entry?: FinancialEntry | null,
  defaultProjectId?: string,
  defaultTaskId?: string
): FormState {
  if (entry) {
    // Edit mode — populate from entry
    let purchasedByMode: PurchasedByMode = 'none';
    if (entry.purchased_by_user_id) purchasedByMode = 'team';
    else if (entry.purchased_by_crew_member_id) purchasedByMode = 'crew';

    return {
      entry_type: entry.entry_type,
      category_id: entry.category_id,
      amount: parseFloat(entry.amount) || 0,
      tax_amount: entry.tax_amount ? parseFloat(entry.tax_amount) : 0,
      discount: entry.discount ? parseFloat(entry.discount) : 0,
      entry_date: entry.entry_date ? entry.entry_date.split('T')[0] : todayISO(),
      entry_time: entry.entry_time || '',
      project_id: entry.project_id || '',
      task_id: entry.task_id || '',
      supplier_id: entry.supplier_id || '',
      vendor_name: entry.vendor_name || '',
      payment_method: entry.payment_method || '',
      payment_method_registry_id: entry.payment_method_registry_id || '',
      purchased_by_mode: purchasedByMode,
      purchased_by_user_id: entry.purchased_by_user_id || '',
      purchased_by_crew_member_id: entry.purchased_by_crew_member_id || '',
      notes: entry.notes || '',
      submit_as_pending: entry.submission_status === 'pending_review',
    };
  }

  // Create mode
  return {
    entry_type: 'expense',
    category_id: '',
    amount: 0,
    tax_amount: 0,
    discount: 0,
    entry_date: todayISO(),
    entry_time: '',
    project_id: defaultProjectId || '',
    task_id: defaultTaskId || '',
    supplier_id: '',
    vendor_name: '',
    payment_method: '',
    payment_method_registry_id: '',
    purchased_by_mode: 'none',
    purchased_by_user_id: '',
    purchased_by_crew_member_id: '',
    notes: '',
    submit_as_pending: false,
  };
}

// ========== COMPONENT ==========

export function EntryFormModal({
  isOpen,
  onClose,
  onSuccess,
  entry,
  defaultProjectId,
  defaultTaskId,
  mode = 'edit',
}: EntryFormModalProps) {
  const { hasRole } = useRBAC();

  const isEditMode = Boolean(entry);
  const isResubmitMode = mode === 'resubmit' && isEditMode;
  const isEmployee = hasRole(['Employee']) && !hasRole(['Owner', 'Admin', 'Manager', 'Bookkeeper']);
  const canSetStatus = hasRole(['Owner', 'Admin', 'Manager', 'Bookkeeper']);

  // ---------- Form state ----------
  const [form, setForm] = useState<FormState>(() =>
    createInitialFormState(entry, defaultProjectId, defaultTaskId)
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // ---------- Line items state ----------
  const [lineItems, setLineItems] = useState<LocalLineItem[]>([]);
  const [originalItemIds, setOriginalItemIds] = useState<Set<string>>(new Set());
  const [autoUpdateTotal, setAutoUpdateTotal] = useState<boolean | null>(null);
  const [showAutoUpdatePrompt, setShowAutoUpdatePrompt] = useState(false);
  const [showMismatchConfirm, setShowMismatchConfirm] = useState(false);

  // ---------- Reference data ----------
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRegistry[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<MembershipItem[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);

  // ---------- Reset form when modal opens ----------
  useEffect(() => {
    if (isOpen) {
      setForm(createInitialFormState(entry, defaultProjectId, defaultTaskId));
      setErrors({});
      setSubmitting(false);
      setShowMismatchConfirm(false);
      setShowAutoUpdatePrompt(false);

      if (entry?.line_items) {
        const localItems = apiLineItemsToLocal(entry.line_items);
        setLineItems(localItems);
        setOriginalItemIds(new Set(localItems.filter(i => i.id).map(i => i.id!)));
        setAutoUpdateTotal(localItems.length > 0 ? false : null);
      } else {
        setLineItems([]);
        setOriginalItemIds(new Set());
        setAutoUpdateTotal(null);
      }
    }
  }, [isOpen, entry, defaultProjectId, defaultTaskId]);

  // ---------- Load reference data on mount ----------
  useEffect(() => {
    if (!isOpen) return;
    setDataLoading(true);

    Promise.all([
      getFinancialCategories().catch((err) => {
        console.error('Failed to load categories:', err);
        return [] as FinancialCategory[];
      }),
      getPaymentMethods().catch((err) => {
        console.error('Failed to load payment methods:', err);
        return [] as PaymentMethodRegistry[];
      }),
      getSuppliers({ limit: 100, is_active: true }).then((res) =>
        res.data.map((s) => ({ id: s.id, name: s.name }))
      ).catch((err) => {
        console.error('Failed to load suppliers:', err);
        return [] as { id: string; name: string }[];
      }),
      getProjects({ limit: 200 }).then((res) => res.data).catch((err) => {
        console.error('Failed to load projects:', err);
        return [] as Project[];
      }),
      listUsers({ limit: 100 }).then((res) => res.data).catch((err) => {
        console.error('Failed to load team members:', err);
        return [] as MembershipItem[];
      }),
      getCrewMembers({ limit: 100, is_active: true }).then((res) => res.data).catch((err) => {
        console.error('Failed to load crew members:', err);
        return [] as CrewMember[];
      }),
    ]).then(([cats, pms, sups, projs, team, crew]) => {
      setCategories(cats);
      setPaymentMethods(pms);
      setSuppliers(sups);
      setProjects(projs);
      setTeamMembers(team);
      setCrewMembers(crew);
      setDataLoading(false);
    });
  }, [isOpen]);

  // ---------- Load tasks when project changes ----------
  const loadTasks = useCallback(async (projectId: string) => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    setTasksLoading(true);
    try {
      const res = await getProjectTasks(projectId, { limit: 200 });
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && form.project_id) {
      loadTasks(form.project_id);
    } else {
      setTasks([]);
    }
  }, [isOpen, form.project_id, loadTasks]);

  // ---------- Field change handlers ----------

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear related error
    if (field in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    }
  };

  const handleProjectChange = (projectId: string) => {
    updateField('project_id', projectId);
    // Reset task when project changes
    updateField('task_id', '');
    setTasks([]);
    if (projectId) {
      loadTasks(projectId);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    updateField('supplier_id', supplierId);
    if (supplierId) {
      const supplier = suppliers.find((s) => s.id === supplierId);
      if (supplier) {
        updateField('vendor_name', supplier.name);
      }
    }
  };

  const handlePaymentAccountChange = (registryId: string) => {
    updateField('payment_method_registry_id', registryId);
    if (registryId) {
      const pm = paymentMethods.find((p) => p.id === registryId);
      if (pm) {
        updateField('payment_method', pm.type);
      }
    }
  };

  const handlePurchasedByModeChange = (mode: PurchasedByMode) => {
    updateField('purchased_by_mode', mode);
    if (mode !== 'team') updateField('purchased_by_user_id', '');
    if (mode !== 'crew') updateField('purchased_by_crew_member_id', '');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.purchased_by;
      return next;
    });
  };

  // ---------- Line items logic ----------

  const itemsSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const computedTotal = Math.round((itemsSubtotal + form.tax_amount - form.discount) * 100) / 100;

  const handleLineItemsChange = useCallback((newItems: LocalLineItem[]) => {
    setLineItems(newItems);

    const newSubtotal = newItems.reduce((sum, item) => sum + item.total, 0);
    const newComputed = Math.round((newSubtotal + form.tax_amount - form.discount) * 100) / 100;

    if (newItems.length > 0 && newSubtotal > 0) {
      if (autoUpdateTotal === null) {
        if (form.amount > 0) {
          setShowAutoUpdatePrompt(true);
        } else {
          setAutoUpdateTotal(true);
          setForm(prev => ({ ...prev, amount: Math.max(0, newComputed) }));
        }
      } else if (autoUpdateTotal) {
        setForm(prev => ({ ...prev, amount: Math.max(0, newComputed) }));
      }
    }
  }, [autoUpdateTotal, form.tax_amount, form.discount, form.amount]);

  // Recalculate total when tax/discount changes if auto-update is on
  useEffect(() => {
    if (autoUpdateTotal && lineItems.length > 0) {
      const sub = lineItems.reduce((sum, item) => sum + item.total, 0);
      const computed = Math.round((sub + form.tax_amount - form.discount) * 100) / 100;
      setForm(prev => {
        if (prev.amount !== Math.max(0, computed)) {
          return { ...prev, amount: Math.max(0, computed) };
        }
        return prev;
      });
    }
  }, [form.tax_amount, form.discount, autoUpdateTotal, lineItems]);

  const validItems = lineItems.filter(i => i.description && i.total > 0);
  const hasMismatch = validItems.length > 0 && Math.abs(form.amount - computedTotal) > 0.01;

  // ---------- Validation ----------

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.category_id) {
      newErrors.category_id = 'Category is required';
    }

    if (form.amount <= 0) {
      newErrors.amount = 'Amount must be greater than $0.00';
    }

    if (form.tax_amount > 0 && form.tax_amount >= form.amount) {
      newErrors.tax_amount = 'Tax amount must be less than the entry amount';
    }

    if (!form.entry_date) {
      newErrors.entry_date = 'Entry date is required';
    }

    if (form.entry_time) {
      // Validate HH:MM or HH:MM:SS format
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
      if (!timeRegex.test(form.entry_time)) {
        newErrors.entry_time = 'Enter a valid time (HH:MM or HH:MM:SS)';
      }
    }

    if (!form.payment_method) {
      newErrors.payment_method = 'Payment method is required';
    }

    if (form.task_id && !form.project_id) {
      newErrors.task_id = 'A project must be selected when a task is set';
    }

    if (form.purchased_by_mode === 'team' && !form.purchased_by_user_id) {
      newErrors.purchased_by = 'Select a team member';
    }
    if (form.purchased_by_mode === 'crew' && !form.purchased_by_crew_member_id) {
      newErrors.purchased_by = 'Select a crew member';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---------- Submission ----------

  const handleSubmit = async () => {
    if (!validate()) return;

    // Check for total mismatch when line items exist
    const submitValidItems = lineItems.filter(i => i.description && i.total > 0);
    if (submitValidItems.length > 0) {
      const sub = submitValidItems.reduce((sum, item) => sum + item.total, 0);
      const expected = Math.round((sub + form.tax_amount - form.discount) * 100) / 100;
      const diff = Math.abs(form.amount - expected);
      if (diff > 0.01) {
        setShowMismatchConfirm(true);
        return;
      }
    }

    await doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);

    try {
      if (isEditMode && entry) {
        // Build UpdateDto with only changed fields
        const dto: UpdateFinancialEntryDto = {};

        if (form.entry_type !== entry.entry_type) dto.entry_type = form.entry_type;
        if (form.category_id !== entry.category_id) dto.category_id = form.category_id;
        if (form.amount !== parseFloat(entry.amount)) dto.amount = form.amount;
        if (form.tax_amount !== (entry.tax_amount ? parseFloat(entry.tax_amount) : 0)) {
          dto.tax_amount = form.tax_amount || undefined;
        }
        if (form.discount !== (entry.discount ? parseFloat(entry.discount) : 0)) {
          dto.discount = form.discount || undefined;
        }
        const entryDate = entry.entry_date ? entry.entry_date.split('T')[0] : '';
        if (form.entry_date !== entryDate) dto.entry_date = form.entry_date;
        if (form.entry_time !== (entry.entry_time || '')) {
          dto.entry_time = form.entry_time || undefined;
        }
        if (form.vendor_name !== (entry.vendor_name || '')) {
          dto.vendor_name = form.vendor_name || undefined;
        }

        // Nullable fields — send null to clear, string to set
        const supplierChanged = form.supplier_id !== (entry.supplier_id || '');
        if (supplierChanged) dto.supplier_id = form.supplier_id || null;

        if (form.payment_method !== (entry.payment_method || '')) {
          dto.payment_method = (form.payment_method as PaymentMethodType) || undefined;
        }

        const pmRegistryChanged = form.payment_method_registry_id !== (entry.payment_method_registry_id || '');
        if (pmRegistryChanged) dto.payment_method_registry_id = form.payment_method_registry_id || null;

        const prevUserId = entry.purchased_by_user_id || '';
        const prevCrewId = entry.purchased_by_crew_member_id || '';
        if (form.purchased_by_user_id !== prevUserId) {
          dto.purchased_by_user_id = form.purchased_by_user_id || null;
        }
        if (form.purchased_by_crew_member_id !== prevCrewId) {
          dto.purchased_by_crew_member_id = form.purchased_by_crew_member_id || null;
        }

        if (form.notes !== (entry.notes || '')) {
          dto.notes = form.notes || undefined;
        }

        // Check if line items have changed
        const currentItemIds = new Set(lineItems.filter(i => i.id).map(i => i.id!));
        const lineItemsChanged =
          lineItems.length !== originalItemIds.size ||
          lineItems.some(i => !i.id) ||
          [...originalItemIds].some(id => !currentItemIds.has(id));

        // Only send update if there are changes (skip check for resubmit — always send)
        if (!isResubmitMode && Object.keys(dto).length === 0 && !lineItemsChanged) {
          toast('No changes to save', { icon: 'ℹ️' });
          return;
        }

        if (isResubmitMode) {
          await resubmitEntry(entry.id, dto);
          toast.success('Expense resubmitted for review');
        } else {
          await updateFinancialEntry(entry.id, dto);
          toast.success('Entry updated successfully');
        }

        // Sync line items: delete removed, update existing, create new
        for (const oldId of originalItemIds) {
          if (!currentItemIds.has(oldId)) {
            await apiDeleteLineItem(entry.id, oldId);
          }
        }
        for (const item of lineItems) {
          if (item.description) {
            if (item.id && originalItemIds.has(item.id)) {
              await apiUpdateLineItem(entry.id, item.id, {
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                unit_of_measure: item.unit_of_measure || undefined,
                order_index: item.order_index,
                notes: item.notes || undefined,
              });
            } else {
              await createLineItem(entry.id, localItemToCreateDto(item));
            }
          }
        }
      } else {
        // Build CreateDto
        const dto: CreateFinancialEntryDto = {
          category_id: form.category_id,
          entry_type: form.entry_type,
          amount: form.amount,
          entry_date: form.entry_date,
        };

        if (form.tax_amount > 0) dto.tax_amount = form.tax_amount;
        if (form.discount > 0) dto.discount = form.discount;
        if (form.entry_time) dto.entry_time = form.entry_time;
        if (form.project_id) dto.project_id = form.project_id;
        if (form.task_id) dto.task_id = form.task_id;
        if (form.vendor_name) dto.vendor_name = form.vendor_name;
        if (form.supplier_id) dto.supplier_id = form.supplier_id;
        if (form.payment_method) dto.payment_method = form.payment_method as PaymentMethodType;
        if (form.payment_method_registry_id) dto.payment_method_registry_id = form.payment_method_registry_id;
        if (form.purchased_by_user_id) dto.purchased_by_user_id = form.purchased_by_user_id;
        if (form.purchased_by_crew_member_id) dto.purchased_by_crew_member_id = form.purchased_by_crew_member_id;
        if (form.notes) dto.notes = form.notes;

        // Submission status
        if (isEmployee) {
          dto.submission_status = 'pending_review';
        } else if (form.submit_as_pending) {
          dto.submission_status = 'pending_review';
        }

        const savedEntry = await createFinancialEntry(dto);
        toast.success('Entry created successfully');

        // Create line items on the new entry
        for (const item of lineItems) {
          if (item.description) {
            await createLineItem(savedEntry.id, localItemToCreateDto(item));
          }
        }
      }

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error instanceof Error ? error.message : 'Failed to save entry');
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Select options builders ----------

  // Group categories by type for better UX
  const categoryOptions: SelectOption[] = (() => {
    const activeCategories = categories.filter((c) => c.is_active);
    const grouped = new Map<CategoryType, FinancialCategory[]>();

    for (const cat of activeCategories) {
      if (!grouped.has(cat.type)) grouped.set(cat.type, []);
      grouped.get(cat.type)!.push(cat);
    }

    const options: SelectOption[] = [{ value: '', label: 'Select a category...' }];

    for (const [type, cats] of grouped) {
      // Add type header as a disabled option (visual grouping)
      options.push({
        value: `__group_${type}`,
        label: `── ${CATEGORY_TYPE_LABELS[type]} ──`,
        disabled: true,
      });
      for (const cat of cats) {
        options.push({
          value: cat.id,
          label: `${cat.name}`,
        });
      }
    }

    return options;
  })();

  const supplierOptions: SelectOption[] = [
    { value: '', label: 'Select a supplier...' },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ];

  const projectOptions: SelectOption[] = [
    { value: '', label: 'Select a project...' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const taskOptions: SelectOption[] = [
    { value: '', label: form.project_id ? (tasksLoading ? 'Loading tasks...' : 'Select a task...') : 'Select a project first' },
    ...tasks.map((t) => ({ value: t.id, label: t.title })),
  ];

  const paymentAccountOptions: SelectOption[] = [
    { value: '', label: 'Select an account...' },
    ...paymentMethods.filter((pm) => pm.is_active).map((pm) => ({
      value: pm.id,
      label: formatPaymentAccountLabel(pm),
    })),
  ];

  const teamMemberOptions: SelectOption[] = [
    { value: '', label: 'Select a team member...' },
    ...teamMembers
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({
        value: m.user_id,
        label: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
      })),
  ];

  const crewMemberOptions: SelectOption[] = [
    { value: '', label: 'Select a crew member...' },
    ...crewMembers
      .filter((c) => c.is_active)
      .map((c) => ({
        value: c.id,
        label: `${c.first_name} ${c.last_name}`,
      })),
  ];

  // ---------- RENDER ----------

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      title={
        <span className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {isResubmitMode ? 'Resubmit Expense' : isEditMode ? 'Edit Financial Entry' : 'New Financial Entry'}
        </span>
      }
      size="xl"
    >
      {dataLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading form data...</p>
        </div>
      ) : (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
          {/* ===== SECTION 1: Core (Required) ===== */}
          <section>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Entry Details
            </h4>

            {/* Entry Type Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Entry Type <span className="text-red-500 dark:text-red-400 ml-1">*</span>
              </label>
              <div className="flex rounded-lg border-2 border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  type="button"
                  onClick={() => updateField('entry_type', 'expense')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                    form.entry_type === 'expense'
                      ? 'bg-red-600 text-white dark:bg-red-700'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  aria-pressed={form.entry_type === 'expense'}
                >
                  <TrendingDown className="h-4 w-4" />
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => updateField('entry_type', 'income')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                    form.entry_type === 'income'
                      ? 'bg-green-600 text-white dark:bg-green-700'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  aria-pressed={form.entry_type === 'income'}
                >
                  <TrendingUp className="h-4 w-4" />
                  Income
                </button>
              </div>
            </div>

            {/* Category */}
            <div className="mb-4">
              <Select
                label="Category"
                options={categoryOptions}
                value={form.category_id}
                onChange={(val) => updateField('category_id', val)}
                placeholder="Select a category..."
                required
                searchable
                error={errors.category_id}
              />
            </div>

            {/* Line Items (before totals — items feed into amount) */}
            <div className="mb-4">
              <LineItemsSection
                items={lineItems}
                onChange={handleLineItemsChange}
                disabled={submitting}
              />
            </div>

            {/* Subtotal display when items exist */}
            {validItems.length > 0 && (
              <div className="p-3 mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Items Subtotal:</span>
                  <span className="font-medium text-gray-900 dark:text-white">${itemsSubtotal.toFixed(2)}</span>
                </div>
                {form.tax_amount > 0 && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-500 dark:text-gray-400">+ Tax:</span>
                    <span className="text-gray-700 dark:text-gray-300">${form.tax_amount.toFixed(2)}</span>
                  </div>
                )}
                {form.discount > 0 && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-500 dark:text-gray-400">- Discount:</span>
                    <span className="text-gray-700 dark:text-gray-300">${form.discount.toFixed(2)}</span>
                  </div>
                )}
                {(form.tax_amount > 0 || form.discount > 0) && (
                  <div className="flex items-center justify-between text-sm mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400">Computed Total:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">${computedTotal.toFixed(2)}</span>
                  </div>
                )}
                {hasMismatch && (
                  <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-400">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      The total (${form.amount.toFixed(2)}) does not match the computed total from items (${computedTotal.toFixed(2)}).
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Amount + Tax + Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <MoneyInput
                label="Amount (Total)"
                value={form.amount}
                onChange={(val) => updateField('amount', val)}
                required
                error={errors.amount}
                placeholder="0.00"
              />
              <MoneyInput
                label="Tax"
                value={form.tax_amount}
                onChange={(val) => updateField('tax_amount', val)}
                error={errors.tax_amount}
                placeholder="0.00"
              />
              <MoneyInput
                label="Discount"
                value={form.discount}
                onChange={(val) => updateField('discount', val)}
                placeholder="0.00"
              />
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label="Entry Date"
                value={form.entry_date}
                onChange={(e) => updateField('entry_date', e.target.value)}
                required
                error={errors.entry_date}
              />
              <div>
                <Input
                  label="Entry Time"
                  value={form.entry_time}
                  onChange={(e) => {
                    // Allow digits and colons only, max 8 chars (HH:MM:SS)
                    const raw = e.target.value.replace(/[^0-9:]/g, '').substring(0, 8);
                    updateField('entry_time', raw);
                  }}
                  placeholder="HH:MM:SS"
                  leftIcon={<Clock className="w-5 h-5" />}
                  helperText={errors.entry_time ? undefined : 'Optional (e.g. 14:30 or 14:30:00)'}
                  error={errors.entry_time}
                  maxLength={8}
                />
              </div>
            </div>
          </section>

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* ===== SECTION 2: Project Link (Optional) ===== */}
          <section>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Project Link
              <span className="text-xs font-normal normal-case text-gray-400 dark:text-gray-500">Optional</span>
            </h4>

            {isEditMode && (
              <div className="flex items-start gap-2 mb-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                <AlertCircle className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Project and task cannot be changed after creation. To reassign, delete this entry and create a new one.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Project"
                options={projectOptions}
                value={form.project_id}
                onChange={handleProjectChange}
                placeholder="Select a project..."
                searchable={projects.length > 5}
                disabled={isEditMode}
              />
              <Select
                label="Task"
                options={taskOptions}
                value={form.task_id}
                onChange={(val) => updateField('task_id', val)}
                placeholder={form.project_id ? 'Select a task...' : 'Select a project first'}
                disabled={isEditMode || !form.project_id || tasksLoading}
                searchable={tasks.length > 5}
                error={errors.task_id}
              />
            </div>
          </section>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* ===== SECTION 3: Vendor/Supplier (Optional) ===== */}
          <section>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Vendor / Supplier
              <span className="text-xs font-normal normal-case text-gray-400 dark:text-gray-500">Optional</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Supplier"
                options={supplierOptions}
                value={form.supplier_id}
                onChange={handleSupplierChange}
                placeholder="Select a supplier..."
                searchable={suppliers.length > 5}
              />
              <Input
                label="Vendor Name"
                value={form.vendor_name}
                onChange={(e) => updateField('vendor_name', e.target.value)}
                placeholder="Auto-filled from supplier or enter manually"
                helperText={form.supplier_id ? 'Auto-filled from supplier (editable)' : undefined}
              />
            </div>
          </section>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* ===== SECTION 4: Payment (Optional) ===== */}
          <section>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Payment Method"
                options={PAYMENT_METHOD_TYPE_OPTIONS}
                value={form.payment_method}
                onChange={(val) => updateField('payment_method', val)}
                placeholder="Select payment type..."
                required
                error={errors.payment_method}
              />
              <Select
                label="Payment Account"
                options={paymentAccountOptions}
                value={form.payment_method_registry_id}
                onChange={handlePaymentAccountChange}
                placeholder="Select an account..."
                searchable={paymentMethods.length > 5}
              />
            </div>
          </section>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* ===== SECTION 5: Purchased By (Optional) ===== */}
          <section>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              Purchased By
              <span className="text-xs font-normal normal-case text-gray-400 dark:text-gray-500">Optional</span>
            </h4>

            {/* Radio buttons */}
            <div className="flex flex-wrap gap-3 mb-4" role="radiogroup" aria-label="Purchased by selection">
              {(['none', 'team', 'crew'] as PurchasedByMode[]).map((mode) => {
                const labels: Record<PurchasedByMode, { label: string; icon: React.ReactNode }> = {
                  none: { label: 'None', icon: null },
                  team: { label: 'Team Member', icon: <Users className="h-4 w-4" /> },
                  crew: { label: 'Crew Member', icon: <UserCircle className="h-4 w-4" /> },
                };
                const info = labels[mode];
                const isSelected = form.purchased_by_mode === mode;

                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handlePurchasedByModeChange(mode)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {info.icon}
                    {info.label}
                  </button>
                );
              })}
            </div>

            {/* Conditional select */}
            {form.purchased_by_mode === 'team' && (
              <Select
                label="Team Member"
                options={teamMemberOptions}
                value={form.purchased_by_user_id}
                onChange={(val) => updateField('purchased_by_user_id', val)}
                placeholder="Select a team member..."
                searchable={teamMembers.length > 5}
                required
                error={errors.purchased_by}
              />
            )}

            {form.purchased_by_mode === 'crew' && (
              <Select
                label="Crew Member"
                options={crewMemberOptions}
                value={form.purchased_by_crew_member_id}
                onChange={(val) => updateField('purchased_by_crew_member_id', val)}
                placeholder="Select a crew member..."
                searchable={crewMembers.length > 5}
                required
                error={errors.purchased_by}
              />
            )}
          </section>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* ===== SECTION 6: Notes ===== */}
          <section>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
              <span className="text-xs font-normal normal-case text-gray-400 dark:text-gray-500">Optional</span>
            </h4>

            <Textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Add any notes about this entry..."
              rows={3}
              maxLength={2000}
              showCharacterCount
            />
          </section>

          {/* ===== SECTION 7: Submission Status ===== */}
          {!isEditMode && canSetStatus && (
            <>
              <hr className="border-gray-200 dark:border-gray-700" />
              <section>
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Submission Status
                </h4>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.submit_as_pending}
                    onChange={(e) => updateField('submit_as_pending', e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-2 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 dark:bg-gray-700 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Submit as Pending Review
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      When checked, this entry will require approval before being confirmed.
                      Unchecked means the entry is immediately confirmed.
                    </p>
                  </div>
                </label>
              </section>
            </>
          )}

          {/* Employee notice */}
          {!isEditMode && isEmployee && (
            <>
              <hr className="border-gray-200 dark:border-gray-700" />
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Your entry will be submitted for review and must be approved by a manager before it is confirmed.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer Actions */}
      {!dataLoading && (
        <ModalActions>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting}
          >
            {isResubmitMode ? 'Resubmit' : isEditMode ? 'Update Entry' : 'Create Entry'}
          </Button>
        </ModalActions>
      )}
    </Modal>

      {/* Prompt: Auto-update total from items? */}
      <ConfirmModal
        isOpen={showAutoUpdatePrompt}
        onClose={() => {
          setShowAutoUpdatePrompt(false);
          setAutoUpdateTotal(false);
        }}
        onConfirm={() => {
          setAutoUpdateTotal(true);
          setShowAutoUpdatePrompt(false);
          const sub = lineItems.reduce((sum, item) => sum + item.total, 0);
          const computed = Math.round((sub + form.tax_amount - form.discount) * 100) / 100;
          setForm(prev => ({ ...prev, amount: Math.max(0, computed) }));
        }}
        title="Update Total?"
        message="The total amount is already filled. Do you want to automatically update it based on item totals + tax - discount?"
        confirmText="Yes, update total"
        cancelText="No, keep current total"
        variant="info"
      />

      {/* Mismatch confirm on save */}
      <ConfirmModal
        isOpen={showMismatchConfirm}
        onClose={() => setShowMismatchConfirm(false)}
        onConfirm={async () => {
          setShowMismatchConfirm(false);
          await doSubmit();
        }}
        title="Total Mismatch"
        message={`The entry total ($${form.amount.toFixed(2)}) does not match the computed total from line items ($${computedTotal.toFixed(2)}). Do you want to save anyway? The total is the source of truth — line items are for tracking only.`}
        confirmText="Save Anyway"
        cancelText="Go Back"
        variant="warning"
        loading={submitting}
      />
    </>
  );
}

export default EntryFormModal;
