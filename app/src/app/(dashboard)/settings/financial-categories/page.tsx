/**
 * Financial Categories Settings Page
 * Full CRUD: list, create, edit, deactivate categories
 * Sprint 3 — Financial Frontend
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import {
  Tags,
  Plus,
  Edit2,
  Power,
  RotateCcw,
  Search,
  ArrowLeft,
  Shield,
  Filter,
  ArrowUpDown,
  Check,
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
  getFinancialCategories,
  createFinancialCategory,
  updateFinancialCategory,
  deleteFinancialCategory,
} from '@/lib/api/financial';
import type {
  FinancialCategory,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryType,
  CategoryClassification,
} from '@/lib/types/financial';
import type { SelectOption } from '@/components/ui/Select';

// ========== CONSTANTS ==========

const CATEGORY_TYPE_OPTIONS: SelectOption[] = [
  { value: 'labor', label: 'Labor' },
  { value: 'material', label: 'Material' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'office', label: 'Office' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'tools', label: 'Tools' },
  { value: 'other', label: 'Other' },
];

const CLASSIFICATION_OPTIONS: SelectOption[] = [
  { value: 'cost_of_goods_sold', label: 'Cost of Goods Sold (COGS)' },
  { value: 'operating_expense', label: 'Operating Expense (OpEx)' },
];

const TYPE_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Types' },
  ...CATEGORY_TYPE_OPTIONS,
];

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'type', label: 'Group by Type' },
  { value: 'classification', label: 'Group by Classification' },
  { value: 'system_first', label: 'System Defaults First' },
  { value: 'custom_first', label: 'Custom First' },
] as const;

const TYPE_BADGE_VARIANT: Record<CategoryType, 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'danger' | 'cyan' | 'gray' | 'pink' | 'yellow' | 'amber' | 'neutral'> = {
  labor: 'blue',
  material: 'green',
  subcontractor: 'purple',
  equipment: 'orange',
  insurance: 'indigo',
  fuel: 'danger',
  utilities: 'cyan',
  office: 'gray',
  marketing: 'pink',
  taxes: 'yellow',
  tools: 'amber',
  other: 'neutral',
};

const TYPE_LABELS: Record<CategoryType, string> = {
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

const CLASSIFICATION_LABELS: Record<CategoryClassification, string> = {
  cost_of_goods_sold: 'COGS',
  operating_expense: 'OpEx',
};

const ALLOWED_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];

// ========== CATEGORY FORM MODAL ==========

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: FinancialCategory | null; // null = create mode
}

function CategoryFormModal({ isOpen, onClose, onSuccess, category }: CategoryFormModalProps) {
  const isEdit = category !== null;

  const [name, setName] = useState('');
  const [type, setType] = useState<string>('');
  const [classification, setClassification] = useState<string>('cost_of_goods_sold');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; type?: string }>({});

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name);
        setType(category.type);
        setClassification(category.classification);
        setDescription(category.description || '');
      } else {
        setName('');
        setType('');
        setClassification('cost_of_goods_sold');
        setDescription('');
      }
      setErrors({});
    }
  }, [isOpen, category]);

  const validate = (): boolean => {
    const newErrors: { name?: string; type?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length > 200) {
      newErrors.name = 'Name must be 200 characters or fewer';
    }

    if (!isEdit && !type) {
      newErrors.type = 'Type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    try {
      if (isEdit && category) {
        const dto: UpdateCategoryDto = {
          name: name.trim(),
          description: description.trim() || undefined,
        };
        // Only include classification if NOT a system default
        if (!category.is_system_default) {
          dto.classification = classification as CategoryClassification;
        }
        await updateFinancialCategory(category.id, dto);
        toast.success(`Category "${name.trim()}" updated successfully`);
      } else {
        const dto: CreateCategoryDto = {
          name: name.trim(),
          type: type as CategoryType,
          classification: classification as CategoryClassification,
          description: description.trim() || undefined,
        };
        await createFinancialCategory(dto);
        toast.success(`Category "${name.trim()}" created successfully`);
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
      title={isEdit ? 'Edit Category' : 'Create Category'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g., Drywall Materials"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          error={errors.name}
          maxLength={200}
          required
        />

        {isEdit ? (
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Type
            </label>
            <div className="flex items-center gap-2">
              <Badge variant={TYPE_BADGE_VARIANT[category!.type]}>
                {TYPE_LABELS[category!.type]}
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Type cannot be changed after creation
              </span>
            </div>
          </div>
        ) : (
          <Select
            label="Type"
            placeholder="Select a type"
            options={CATEGORY_TYPE_OPTIONS}
            value={type}
            onChange={(val) => {
              setType(val);
              if (errors.type) setErrors((prev) => ({ ...prev, type: undefined }));
            }}
            error={errors.type}
            searchable
            required
          />
        )}

        <Select
          label="Classification"
          options={CLASSIFICATION_OPTIONS}
          value={classification}
          onChange={setClassification}
          disabled={isEdit && category?.is_system_default === true}
          helperText={
            isEdit && category?.is_system_default
              ? 'Classification cannot be changed for system default categories'
              : undefined
          }
        />

        <Textarea
          label="Description"
          placeholder="Optional description for this category"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          resize="vertical"
        />

        <ModalActions>
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Category'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

// ========== MAIN PAGE ==========

export default function FinancialCategoriesPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canManage = hasRole(ALLOWED_ROLES);

  // Data
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy] = useState('name_asc');

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [categoryToDeactivate, setCategoryToDeactivate] = useState<FinancialCategory | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getFinancialCategories(
        showInactive ? { include_inactive: true } : undefined,
      );
      setCategories(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load categories';
      setFetchError(message);
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    if (canManage) {
      loadCategories();
    }
  }, [canManage, loadCategories]);

  // Client-side filtering + sorting
  const filteredCategories = useMemo(() => {
    const filtered = categories.filter((cat) => {
      const matchesSearch = cat.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim());
      const matchesType = !typeFilter || cat.type === typeFilter;
      return matchesSearch && matchesType;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'type':
          return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
        case 'classification':
          return a.classification.localeCompare(b.classification) || a.name.localeCompare(b.name);
        case 'system_first':
          if (a.is_system_default !== b.is_system_default) return a.is_system_default ? -1 : 1;
          return a.name.localeCompare(b.name);
        case 'custom_first':
          if (a.is_system_default !== b.is_system_default) return a.is_system_default ? 1 : -1;
          return a.name.localeCompare(b.name);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [categories, searchQuery, typeFilter, sortBy]);

  // Handlers
  const handleCreate = () => {
    setEditingCategory(null);
    setFormModalOpen(true);
  };

  const handleEdit = (category: FinancialCategory) => {
    setEditingCategory(category);
    setFormModalOpen(true);
  };

  const handleFormSuccess = () => {
    setFormModalOpen(false);
    setEditingCategory(null);
    loadCategories();
  };

  const handleDeactivateClick = (category: FinancialCategory) => {
    setCategoryToDeactivate(category);
    setDeactivateModalOpen(true);
  };

  const confirmDeactivate = async () => {
    if (!categoryToDeactivate) return;

    setDeactivating(true);
    try {
      await deleteFinancialCategory(categoryToDeactivate.id);
      toast.success(`Category "${categoryToDeactivate.name}" deactivated`);
      setDeactivateModalOpen(false);
      setCategoryToDeactivate(null);
      loadCategories();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to deactivate category';
      toast.error(message);
    } finally {
      setDeactivating(false);
    }
  };

  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const handleReactivate = async (category: FinancialCategory) => {
    setReactivatingId(category.id);
    try {
      await updateFinancialCategory(category.id, { is_active: true });
      toast.success(`Category "${category.name}" reactivated`);
      loadCategories();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to reactivate category';
      toast.error(message);
    } finally {
      setReactivatingId(null);
    }
  };

  // ======= RENDER GUARDS =======

  if (rbacLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          You don&apos;t have permission to manage financial categories.
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
              Financial Categories
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage expense and income categories for your financial entries
            </p>
          </div>
          <Button variant="primary" onClick={handleCreate} size="sm">
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search categories..."
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
                <Tags className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Failed to Load Categories
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{fetchError}</p>
              <Button variant="primary" onClick={loadCategories} size="sm">
                Try Again
              </Button>
            </div>
          </Card>
        ) : filteredCategories.length === 0 ? (
          <Card className="p-8 sm:p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                {searchQuery || typeFilter ? (
                  <Filter className="w-8 h-8 text-gray-400" />
                ) : (
                  <Tags className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {searchQuery || typeFilter
                  ? 'No categories match your filters'
                  : 'No categories yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery || typeFilter
                  ? 'Try adjusting your search or filter'
                  : 'Create your first category to start organizing expenses'}
              </p>
              {!searchQuery && !typeFilter && (
                <Button variant="primary" onClick={handleCreate} size="sm">
                  <Plus className="w-4 h-4" />
                  Add Category
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCategories.map((cat) => (
              <Card
                key={cat.id}
                className={`p-4 hover:shadow-md transition-shadow ${
                  !cat.is_active ? 'opacity-60' : ''
                }`}
              >
                {/* Category name */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug pr-2">
                    {cat.name}
                  </h3>
                  {!cat.is_active && (
                    <Badge variant="neutral" label="Inactive" />
                  )}
                </div>

                {/* Description */}
                {cat.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                    {cat.description}
                  </p>
                )}

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge variant={TYPE_BADGE_VARIANT[cat.type]}>
                    {TYPE_LABELS[cat.type]}
                  </Badge>
                  <Badge
                    variant={
                      cat.classification === 'cost_of_goods_sold'
                        ? 'info'
                        : 'warning'
                    }
                  >
                    {CLASSIFICATION_LABELS[cat.classification]}
                  </Badge>
                  {cat.is_system_default ? (
                    <Badge variant="indigo" icon={Shield}>
                      System Default
                    </Badge>
                  ) : (
                    <Badge variant="success">Custom</Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  {cat.is_active ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEdit(cat)}
                        className="flex-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </Button>
                      {!cat.is_system_default && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeactivateClick(cat)}
                        >
                          <Power className="w-4 h-4" />
                          Deactivate
                        </Button>
                      )}
                    </>
                  ) : (
                    !cat.is_system_default && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleReactivate(cat)}
                        loading={reactivatingId === cat.id}
                        className="flex-1"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reactivate
                      </Button>
                    )
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Category count footer */}
        {!loading && !fetchError && filteredCategories.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Showing {filteredCategories.length} of {categories.length} categories
          </p>
        )}
      </div>

      {/* Create/Edit Modal */}
      <CategoryFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingCategory(null);
        }}
        onSuccess={handleFormSuccess}
        category={editingCategory}
      />

      {/* Deactivate Confirmation Modal */}
      <ConfirmModal
        isOpen={deactivateModalOpen}
        onClose={() => {
          setDeactivateModalOpen(false);
          setCategoryToDeactivate(null);
        }}
        onConfirm={confirmDeactivate}
        title="Deactivate Category"
        message={`Are you sure you want to deactivate "${categoryToDeactivate?.name}"? It will no longer be available for new entries.`}
        confirmText="Deactivate"
        variant="danger"
        loading={deactivating}
      />
    </>
  );
}
