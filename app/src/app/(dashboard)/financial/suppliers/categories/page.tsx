/**
 * Supplier Categories Management Page
 * Full CRUD: list, create, edit, delete supplier categories
 * Sprint 5 — Financial Frontend
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import {
  Tags,
  Plus,
  Edit2,
  Trash2,
  Search,
  ArrowLeft,
  Shield,
  ArrowUpDown,
  Check,
  Package,
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
import { Textarea } from '@/components/ui/Textarea';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ColorPicker } from '@/components/ui/ColorPicker';
import {
  getSupplierCategories,
  createSupplierCategory,
  updateSupplierCategory,
  deleteSupplierCategory,
} from '@/lib/api/financial';
import type {
  SupplierCategory,
  CreateSupplierCategoryDto,
  UpdateSupplierCategoryDto,
} from '@/lib/types/financial';

// ========== CONSTANTS ==========

const MAX_ACTIVE_CATEGORIES = 50;

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'suppliers_most', label: 'Most Suppliers' },
  { value: 'suppliers_least', label: 'Fewest Suppliers' },
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
] as const;

const DEFAULT_COLOR = '#007BFF';

// Roles that can create/edit
const CAN_MANAGE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
// Roles that can delete
const CAN_DELETE_ROLES = ['Owner', 'Admin', 'Bookkeeper'];
// Roles that can view
const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee'];

// ========== CATEGORY FORM MODAL ==========

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: SupplierCategory | null; // null = create mode
  activeCount: number;
}

function CategoryFormModal({ isOpen, onClose, onSuccess, category, activeCount }: CategoryFormModalProps) {
  const isEdit = category !== null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name);
        setDescription(category.description || '');
        setColor(category.color || DEFAULT_COLOR);
      } else {
        setName('');
        setDescription('');
        setColor(DEFAULT_COLOR);
      }
      setErrors({});
    }
  }, [isOpen, category]);

  const validate = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Name must be 100 characters or fewer';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Check max limit for new categories
    if (!isEdit && activeCount >= MAX_ACTIVE_CATEGORIES) {
      toast.error(`Maximum of ${MAX_ACTIVE_CATEGORIES} active categories reached. Deactivate or delete an existing category first.`);
      return;
    }

    setSaving(true);
    try {
      if (isEdit && category) {
        const dto: UpdateSupplierCategoryDto = {
          name: name.trim(),
          description: description.trim() || undefined,
          color: color || undefined,
        };
        await updateSupplierCategory(category.id, dto);
        toast.success(`Category "${name.trim()}" updated successfully`);
      } else {
        const dto: CreateSupplierCategoryDto = {
          name: name.trim(),
          description: description.trim() || undefined,
          color: color || undefined,
        };
        await createSupplierCategory(dto);
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
      title={isEdit ? 'Edit Supplier Category' : 'Create Supplier Category'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g., Roofing Supplies"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          error={errors.name}
          maxLength={100}
          required
        />

        <Textarea
          label="Description"
          placeholder="Optional description for this category"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          resize="vertical"
          maxLength={2000}
          showCharacterCount
        />

        <div className="relative">
          <ColorPicker
            label="Color"
            value={color}
            onChange={setColor}
            helperText="Choose a color to visually identify this category"
          />
        </div>

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

export default function SupplierCategoriesPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canView = hasRole(CAN_VIEW_ROLES);
  const canManage = hasRole(CAN_MANAGE_ROLES);
  const canDelete = hasRole(CAN_DELETE_ROLES);

  // Data
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('name_asc');

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SupplierCategory | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<SupplierCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeCount = useMemo(
    () => categories.filter((c) => c.is_active).length,
    [categories],
  );

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getSupplierCategories();
      setCategories(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load supplier categories';
      setFetchError(message);
      console.error('Failed to load supplier categories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) {
      loadCategories();
    }
  }, [canView, loadCategories]);

  // Client-side filtering + sorting
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = categories.filter((cat) => {
      if (!query) return true;
      return (
        cat.name.toLowerCase().includes(query) ||
        (cat.description && cat.description.toLowerCase().includes(query))
      );
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'suppliers_most':
          return b.supplier_count - a.supplier_count || a.name.localeCompare(b.name);
        case 'suppliers_least':
          return a.supplier_count - b.supplier_count || a.name.localeCompare(b.name);
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [categories, searchQuery, sortBy]);

  // Handlers
  const handleCreate = () => {
    setEditingCategory(null);
    setFormModalOpen(true);
  };

  const handleEdit = (category: SupplierCategory) => {
    setEditingCategory(category);
    setFormModalOpen(true);
  };

  const handleFormSuccess = () => {
    setFormModalOpen(false);
    setEditingCategory(null);
    loadCategories();
  };

  const handleDeleteClick = (category: SupplierCategory) => {
    setCategoryToDelete(category);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    setDeleting(true);
    try {
      await deleteSupplierCategory(categoryToDelete.id);
      toast.success(`Category "${categoryToDelete.name}" deleted`);
      setDeleteModalOpen(false);
      setCategoryToDelete(null);
      loadCategories();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete category';
      toast.error(message);
    } finally {
      setDeleting(false);
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

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          You don&apos;t have permission to view supplier categories.
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
            href="/financial/suppliers"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Suppliers
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Supplier Categories
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Organize suppliers into groups for easy management
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Active count badge */}
            <Badge variant={activeCount >= MAX_ACTIVE_CATEGORIES ? 'danger' : 'info'}>
              {activeCount}/{MAX_ACTIVE_CATEGORIES} Active
            </Badge>
            {canManage && (
              <Button
                variant="primary"
                onClick={handleCreate}
                size="sm"
                disabled={activeCount >= MAX_ACTIVE_CATEGORIES}
              >
                <Plus className="w-4 h-4" />
                Add Category
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-5 h-5" />}
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
                {searchQuery ? (
                  <Search className="w-8 h-8 text-gray-400" />
                ) : (
                  <Tags className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {searchQuery
                  ? 'No categories match your search'
                  : 'No supplier categories yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Create your first supplier category to start organizing your vendors'}
              </p>
              {!searchQuery && canManage && (
                <Button variant="primary" onClick={handleCreate} size="sm">
                  <Plus className="w-4 h-4" />
                  Add Category
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* Grid of category cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCategories.map((cat) => (
                <Card
                  key={cat.id}
                  className={`p-4 hover:shadow-md transition-shadow ${
                    !cat.is_active ? 'opacity-60' : ''
                  }`}
                >
                  {/* Header: color dot + name + inactive badge */}
                  <div className="flex items-start gap-3 mb-3">
                    {/* Color indicator */}
                    <span
                      className="mt-1 w-4 h-4 min-w-[1rem] rounded-full border border-gray-200 dark:border-gray-600 flex-shrink-0"
                      style={{ backgroundColor: cat.color || '#9CA3AF' }}
                      aria-label={`Color: ${cat.color || 'default gray'}`}
                    />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug flex-1 min-w-0 break-words">
                      {cat.name}
                    </h3>
                    {!cat.is_active && (
                      <Badge variant="neutral" label="Inactive" />
                    )}
                  </div>

                  {/* Description */}
                  {cat.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 pl-7">
                      {cat.description}
                    </p>
                  )}

                  {/* Supplier count badge */}
                  <div className="flex flex-wrap items-center gap-2 mb-4 pl-7">
                    <Badge
                      variant={cat.supplier_count > 0 ? 'blue' : 'neutral'}
                      icon={Package}
                    >
                      {cat.supplier_count} {cat.supplier_count === 1 ? 'Supplier' : 'Suppliers'}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    {canManage && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEdit(cat)}
                        className="flex-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteClick(cat)}
                        disabled={cat.supplier_count > 0}
                        title={
                          cat.supplier_count > 0
                            ? `Cannot delete: ${cat.supplier_count} supplier${cat.supplier_count === 1 ? '' : 's'} assigned`
                            : 'Delete category'
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Count footer */}
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Showing {filteredCategories.length} of {categories.length} categories
            </p>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {canManage && (
        <CategoryFormModal
          isOpen={formModalOpen}
          onClose={() => {
            setFormModalOpen(false);
            setEditingCategory(null);
          }}
          onSuccess={handleFormSuccess}
          category={editingCategory}
          activeCount={activeCount}
        />
      )}

      {/* Delete Confirmation Modal */}
      {canDelete && (
        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setCategoryToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="Delete Supplier Category"
          message={`Are you sure you want to delete "${categoryToDelete?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          loading={deleting}
        />
      )}
    </>
  );
}
