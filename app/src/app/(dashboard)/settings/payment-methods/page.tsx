/**
 * Payment Methods Registry Settings Page
 * Full CRUD: list, create, edit, set default, deactivate/reactivate
 * Sprint 4 — Financial Frontend
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Star,
  Search,
  ArrowLeft,
  Shield,
  Banknote,
  FileCheck,
  Building2,
  Smartphone,
  Zap,
  ArrowLeftRight,
  RotateCcw,
  ArrowUpDown,
  Check,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Menu, Transition } from '@headlessui/react';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  permanentDeletePaymentMethod,
  setDefaultPaymentMethod,
} from '@/lib/api/financial';
import type {
  PaymentMethodRegistry,
  PaymentMethodType,
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
} from '@/lib/types/financial';
import type { SelectOption } from '@/components/ui/Select';
import type { LucideIcon } from 'lucide-react';

// ========== CONSTANTS ==========

const MAX_ACTIVE_METHODS = 50;

const PAYMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'ACH', label: 'ACH' },
];

const TYPE_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Types' },
  ...PAYMENT_TYPE_OPTIONS,
];

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  cash: 'Cash',
  check: 'Check',
  bank_transfer: 'Bank Transfer',
  venmo: 'Venmo',
  zelle: 'Zelle',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  ACH: 'ACH',
};

const TYPE_ICONS: Record<PaymentMethodType, LucideIcon> = {
  cash: Banknote,
  check: FileCheck,
  bank_transfer: Building2,
  venmo: Smartphone,
  zelle: Zap,
  credit_card: CreditCard,
  debit_card: CreditCard,
  ACH: ArrowLeftRight,
};

const TYPE_BADGE_VARIANT: Record<PaymentMethodType, 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'cyan' | 'gray' | 'pink' | 'amber' | 'neutral'> = {
  cash: 'green',
  check: 'blue',
  bank_transfer: 'indigo',
  venmo: 'purple',
  zelle: 'orange',
  credit_card: 'cyan',
  debit_card: 'pink',
  ACH: 'amber',
};

// Roles that can view this page
const VIEW_ROLES = ['Owner', 'Admin', 'Bookkeeper'];
// Roles that can create/edit
const MANAGE_ROLES = ['Owner', 'Admin', 'Bookkeeper'];
// Roles that can delete
const DELETE_ROLES = ['Owner', 'Admin'];

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'type', label: 'Group by Type' },
  { value: 'uses_desc', label: 'Most Used' },
  { value: 'uses_asc', label: 'Least Used' },
  { value: 'last_used_desc', label: 'Recently Used' },
  { value: 'last_used_asc', label: 'Least Recently Used' },
] as const;

// ========== PAYMENT METHOD FORM MODAL ==========

interface PaymentMethodFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  method: PaymentMethodRegistry | null; // null = create mode
  existingNicknames: string[];
}

function PaymentMethodFormModal({ isOpen, onClose, onSuccess, method, existingNicknames }: PaymentMethodFormModalProps) {
  const isEdit = method !== null;

  const [nickname, setNickname] = useState('');
  const [type, setType] = useState<string>('');
  const [bankName, setBankName] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [notes, setNotes] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ nickname?: string; type?: string; lastFour?: string }>({});

  // Reset form when modal opens/closes or method changes
  useEffect(() => {
    if (isOpen) {
      if (method) {
        setNickname(method.nickname);
        setType(method.type);
        setBankName(method.bank_name || '');
        setLastFour(method.last_four || '');
        setNotes(method.notes || '');
        setIsDefault(false); // Not shown in edit mode per API (use set-default action)
      } else {
        setNickname('');
        setType('');
        setBankName('');
        setLastFour('');
        setNotes('');
        setIsDefault(false);
      }
      setErrors({});
    }
  }, [isOpen, method]);

  const validate = (): boolean => {
    const newErrors: { nickname?: string; type?: string; lastFour?: string } = {};

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      newErrors.nickname = 'Nickname is required';
    } else if (trimmedNickname.length > 100) {
      newErrors.nickname = 'Nickname must be 100 characters or fewer';
    } else {
      // Check uniqueness (case-insensitive), exclude current method in edit mode
      const isDuplicate = existingNicknames.some(
        (n) => n.toLowerCase() === trimmedNickname.toLowerCase() && (!isEdit || n.toLowerCase() !== method!.nickname.toLowerCase()),
      );
      if (isDuplicate) {
        newErrors.nickname = 'A payment method with this nickname already exists';
      }
    }

    if (!type) {
      newErrors.type = 'Type is required';
    }

    if (lastFour && !/^\d{4}$/.test(lastFour)) {
      newErrors.lastFour = 'Must be exactly 4 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLastFourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 4
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setLastFour(value);
    if (errors.lastFour) setErrors((prev) => ({ ...prev, lastFour: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    try {
      if (isEdit && method) {
        const dto: UpdatePaymentMethodDto = {
          nickname: nickname.trim(),
          type: type as PaymentMethodType,
          bank_name: bankName.trim() || undefined,
          last_four: lastFour || undefined,
          notes: notes.trim() || undefined,
        };
        await updatePaymentMethod(method.id, dto);
        toast.success(`"${nickname.trim()}" updated successfully`);
      } else {
        const dto: CreatePaymentMethodDto = {
          nickname: nickname.trim(),
          type: type as PaymentMethodType,
          bank_name: bankName.trim() || undefined,
          last_four: lastFour || undefined,
          notes: notes.trim() || undefined,
          is_default: isDefault || undefined,
        };
        await createPaymentMethod(dto);
        toast.success(`"${nickname.trim()}" created successfully`);
      }
      onSuccess();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'An unexpected error occurred';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Payment Method' : 'Add Payment Method'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nickname"
          placeholder="e.g., Chase Business Visa"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            if (errors.nickname) setErrors((prev) => ({ ...prev, nickname: undefined }));
          }}
          error={errors.nickname}
          maxLength={100}
          required
        />

        <Select
          label="Type"
          placeholder="Select payment type"
          options={PAYMENT_TYPE_OPTIONS}
          value={type}
          onChange={(val) => {
            setType(val);
            if (errors.type) setErrors((prev) => ({ ...prev, type: undefined }));
          }}
          error={errors.type}
          searchable
          required
        />

        <Input
          label="Bank Name"
          placeholder="e.g., JPMorgan Chase"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          maxLength={100}
        />

        <div>
          <label
            htmlFor="lastFour"
            className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
          >
            Last Four Digits
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-mono text-sm select-none">
              ••••
            </span>
            <input
              id="lastFour"
              type="text"
              inputMode="numeric"
              pattern="\d{0,4}"
              placeholder="1234"
              value={lastFour}
              onChange={handleLastFourChange}
              maxLength={4}
              className={`
                w-full pl-14 pr-4 py-3 border-2 rounded-lg
                text-gray-900 dark:text-gray-100 font-mono font-medium tracking-widest
                bg-white dark:bg-gray-700
                placeholder:text-gray-400 dark:placeholder:text-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                transition-all duration-200
                ${errors.lastFour
                  ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'}
              `}
              aria-label="Last four digits of card or account number"
              aria-invalid={!!errors.lastFour}
            />
          </div>
          {errors.lastFour && (
            <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">{errors.lastFour}</p>
          )}
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Optional — last 4 digits of card or account number
          </p>
        </div>

        <Textarea
          label="Notes"
          placeholder="Optional notes about this payment method"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          resize="vertical"
        />

        {!isEdit && (
          <div className="pt-2">
            <ToggleSwitch
              enabled={isDefault}
              onChange={setIsDefault}
              label="Set as Default"
              description="This will be your default payment method"
            />
          </div>
        )}

        <ModalActions>
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving}>
            {isEdit ? 'Save Changes' : 'Add Method'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

// ========== MAIN PAGE ==========

export default function PaymentMethodsPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canView = hasRole(VIEW_ROLES);
  const canManage = hasRole(MANAGE_ROLES);
  const canDelete = hasRole(DELETE_ROLES);

  // Data
  const [methods, setMethods] = useState<PaymentMethodRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name_asc');

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodRegistry | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethodRegistry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hardDeleteModalOpen, setHardDeleteModalOpen] = useState(false);
  const [methodToHardDelete, setMethodToHardDelete] = useState<PaymentMethodRegistry | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);

  // Action loading states
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // Default (no is_active param) returns active only.
      // is_active=false returns all (including inactive).
      const data = await getPaymentMethods(
        showInactive ? { is_active: false } : undefined,
      );
      setMethods(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load payment methods';
      setFetchError(message);
      console.error('Failed to load payment methods:', error);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    if (canView) {
      loadMethods();
    }
  }, [canView, loadMethods]);

  // Derived data
  const activeCount = useMemo(
    () => methods.filter((m) => m.is_active).length,
    [methods],
  );

  const existingNicknames = useMemo(
    () => methods.map((m) => m.nickname),
    [methods],
  );

  // Client-side filtering + sorting
  const filteredMethods = useMemo(() => {
    const filtered = methods.filter((m) => {
      const matchesSearch =
        !searchQuery.trim() ||
        m.nickname.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (m.bank_name && m.bank_name.toLowerCase().includes(searchQuery.toLowerCase().trim()));
      const matchesType = !typeFilter || m.type === typeFilter;
      return matchesSearch && matchesType;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.nickname.localeCompare(b.nickname);
        case 'name_desc':
          return b.nickname.localeCompare(a.nickname);
        case 'type':
          return a.type.localeCompare(b.type) || a.nickname.localeCompare(b.nickname);
        case 'uses_desc':
          return b.usage_count - a.usage_count || a.nickname.localeCompare(b.nickname);
        case 'uses_asc':
          return a.usage_count - b.usage_count || a.nickname.localeCompare(b.nickname);
        case 'last_used_desc': {
          const aDate = a.last_used_date ? new Date(a.last_used_date).getTime() : 0;
          const bDate = b.last_used_date ? new Date(b.last_used_date).getTime() : 0;
          return bDate - aDate || a.nickname.localeCompare(b.nickname);
        }
        case 'last_used_asc': {
          const aDate = a.last_used_date ? new Date(a.last_used_date).getTime() : Infinity;
          const bDate = b.last_used_date ? new Date(b.last_used_date).getTime() : Infinity;
          return aDate - bDate || a.nickname.localeCompare(b.nickname);
        }
        default:
          return a.nickname.localeCompare(b.nickname);
      }
    });
  }, [methods, searchQuery, typeFilter, sortBy]);

  // Handlers
  const handleCreate = () => {
    setEditingMethod(null);
    setFormModalOpen(true);
  };

  const handleEdit = (method: PaymentMethodRegistry) => {
    setEditingMethod(method);
    setFormModalOpen(true);
  };

  const handleFormSuccess = () => {
    setFormModalOpen(false);
    setEditingMethod(null);
    loadMethods();
  };

  const handleDeleteClick = (method: PaymentMethodRegistry) => {
    setMethodToDelete(method);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!methodToDelete) return;

    setDeleting(true);
    try {
      await deletePaymentMethod(methodToDelete.id);
      toast.success(`"${methodToDelete.nickname}" deactivated`);
      setDeleteModalOpen(false);
      setMethodToDelete(null);
      loadMethods();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to deactivate payment method';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async (method: PaymentMethodRegistry) => {
    setSettingDefaultId(method.id);
    try {
      await setDefaultPaymentMethod(method.id);
      toast.success(`"${method.nickname}" set as default payment method`);
      loadMethods();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to set default';
      toast.error(message);
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleReactivate = async (method: PaymentMethodRegistry) => {
    setReactivatingId(method.id);
    try {
      await updatePaymentMethod(method.id, { is_active: true });
      toast.success(`"${method.nickname}" reactivated`);
      loadMethods();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to reactivate';
      toast.error(message);
    } finally {
      setReactivatingId(null);
    }
  };

  const handleHardDeleteClick = (method: PaymentMethodRegistry) => {
    setMethodToHardDelete(method);
    setHardDeleteModalOpen(true);
  };

  const confirmHardDelete = async () => {
    if (!methodToHardDelete) return;

    setHardDeleting(true);
    try {
      await permanentDeletePaymentMethod(methodToHardDelete.id);
      toast.success(`"${methodToHardDelete.nickname}" permanently deleted`);
      setHardDeleteModalOpen(false);
      setMethodToHardDelete(null);
      loadMethods();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to permanently delete payment method';
      toast.error(message);
    } finally {
      setHardDeleting(false);
    }
  };

  // Format last used date
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Build delete confirmation message
  const deleteConfirmMessage = useMemo(() => {
    if (!methodToDelete) return '';
    let msg = `Are you sure you want to deactivate "${methodToDelete.nickname}"? It will no longer be available for new entries. Existing entries using this method will not be affected.`;
    if (methodToDelete.is_default) {
      msg += '\n\nThis is your default payment method. The default will be cleared.';
    }
    return msg;
  }, [methodToDelete]);

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
          You don&apos;t have permission to manage payment methods.
        </p>
      </div>
    );
  }

  // ======= MAIN RENDER =======

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Back link */}
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
              Payment Methods
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage your payment accounts, cards, and methods
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Active counter */}
            {!loading && !fetchError && (
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {activeCount}/{MAX_ACTIVE_METHODS} active
              </span>
            )}
            {canManage && (
              <Button
                variant="primary"
                onClick={handleCreate}
                size="sm"
                disabled={activeCount >= MAX_ACTIVE_METHODS}
              >
                <Plus className="w-4 h-4" />
                Add Method
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search by nickname or bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-5 h-5" />}
              />
            </div>
            <div className="w-full sm:w-56">
              <Select
                options={TYPE_FILTER_OPTIONS}
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="All Types"
              />
            </div>
            <div className="flex items-center">
              <Menu as="div" className="relative">
                <Menu.Button className="inline-flex items-center justify-center gap-2 px-3 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <ArrowUpDown className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">
                    {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                  </span>
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-1 w-56 origin-top-right rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none py-1">
                    {SORT_OPTIONS.map((option) => (
                      <Menu.Item key={option.value}>
                        {({ active }) => (
                          <button
                            type="button"
                            onClick={() => setSortBy(option.value)}
                            className={`
                              flex items-center justify-between w-full px-4 py-2.5 text-sm
                              ${active ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-200'}
                              ${sortBy === option.value ? 'font-semibold' : 'font-medium'}
                            `}
                          >
                            {option.label}
                            {sortBy === option.value && (
                              <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </button>
                        )}
                      </Menu.Item>
                    ))}
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
            <div className="flex items-center">
              <ToggleSwitch
                enabled={showInactive}
                onChange={setShowInactive}
                label="Show Deactivated"
              />
            </div>
          </div>
        </Card>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <LoadingSpinner size="lg" />
          </div>
        ) : fetchError ? (
          <Card className="p-8 sm:p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Failed to Load Payment Methods
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{fetchError}</p>
              <Button variant="primary" onClick={loadMethods} size="sm">
                Try Again
              </Button>
            </div>
          </Card>
        ) : filteredMethods.length === 0 ? (
          <Card className="p-8 sm:p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                {searchQuery || typeFilter ? (
                  <Search className="w-8 h-8 text-gray-400" />
                ) : (
                  <CreditCard className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {searchQuery || typeFilter
                  ? 'No payment methods match your filters'
                  : 'No payment methods yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery || typeFilter
                  ? 'Try adjusting your search or filter'
                  : 'Add your first payment method to start tracking purchases'}
              </p>
              {!searchQuery && !typeFilter && canManage && (
                <Button variant="primary" onClick={handleCreate} size="sm">
                  <Plus className="w-4 h-4" />
                  Add Method
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredMethods.map((method) => {
              const TypeIcon = TYPE_ICONS[method.type];
              const isSettingDefault = settingDefaultId === method.id;
              const isReactivating = reactivatingId === method.id;

              return (
                <Card
                  key={method.id}
                  className={`p-4 hover:shadow-md transition-shadow ${
                    !method.is_active ? 'opacity-60' : ''
                  }`}
                >
                  {/* Header row: icon + name + default badge */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`
                        flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                        ${method.is_active
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}
                      `}
                    >
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                          {method.nickname}
                        </h3>
                        {method.is_default && method.is_active && (
                          <Badge variant="warning" icon={Star}>
                            Default
                          </Badge>
                        )}
                      </div>
                      {!method.is_active && (
                        <Badge variant="neutral" label="Inactive" className="mt-1" />
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Type:</span>
                      <Badge variant={TYPE_BADGE_VARIANT[method.type]}>
                        {TYPE_LABELS[method.type]}
                      </Badge>
                    </div>

                    {method.bank_name && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Bank:</span>
                        <span className="truncate">{method.bank_name}</span>
                      </div>
                    )}

                    {method.last_four && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Last 4:</span>
                        <span className="font-mono tracking-wider">•••• {method.last_four}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 pt-1">
                      <span>Used: {method.usage_count} {method.usage_count === 1 ? 'time' : 'times'}</span>
                      <span>Last: {formatDate(method.last_used_date)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    {method.is_active ? (
                      <>
                        {/* Set Default — hidden if already default */}
                        {!method.is_default && canManage && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSetDefault(method)}
                            loading={isSettingDefault}
                            disabled={isSettingDefault}
                          >
                            <Star className="w-4 h-4" />
                            <span className="hidden sm:inline">Set Default</span>
                          </Button>
                        )}

                        {canManage && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEdit(method)}
                            className="flex-1 min-w-0"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </Button>
                        )}

                        {canDelete && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteClick(method)}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        {canManage && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleReactivate(method)}
                            loading={isReactivating}
                            className="flex-1"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reactivate
                          </Button>
                        )}
                        {canDelete && method.usage_count === 0 && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleHardDeleteClick(method)}
                          >
                            <XCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">Delete Permanently</span>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Count footer */}
        {!loading && !fetchError && filteredMethods.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Showing {filteredMethods.length} of {methods.length} payment methods
          </p>
        )}
      </div>

      {/* Create/Edit Modal */}
      <PaymentMethodFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingMethod(null);
        }}
        onSuccess={handleFormSuccess}
        method={editingMethod}
        existingNicknames={existingNicknames}
      />

      {/* Soft Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setMethodToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Deactivate Payment Method"
        message={deleteConfirmMessage}
        confirmText="Deactivate"
        variant="danger"
        loading={deleting}
      />

      {/* Hard Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={hardDeleteModalOpen}
        onClose={() => {
          setHardDeleteModalOpen(false);
          setMethodToHardDelete(null);
        }}
        onConfirm={confirmHardDelete}
        title="Permanently Delete Payment Method"
        message={`Are you sure you want to permanently delete "${methodToHardDelete?.nickname}"? This action cannot be undone. The record will be removed from the database entirely.`}
        confirmText="Delete Permanently"
        variant="danger"
        loading={hardDeleting}
      />
    </>
  );
}
