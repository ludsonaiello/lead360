/**
 * Suppliers List Page
 * Full CRUD list with search, filters, sort, pagination, delete
 * Sprint 6 — Financial Frontend
 */

'use client';

import React, { useState, useEffect, useCallback, Fragment, useRef } from 'react';
import {
  Building2,
  Plus,
  Search,
  ArrowLeft,
  ArrowUpDown,
  Shield,
  Star,
  MapPin,
  Mail,
  DollarSign,
  Package,
  Eye,
  Edit2,
  Trash2,
  Check,
  X,
  Power,
  RotateCcw,
  AlertTriangle,
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
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import {
  getSuppliers,
  deleteSupplier,
  updateSupplier,
  getSupplierCategories,
} from '@/lib/api/financial';
import type {
  SupplierListItem,
  SupplierCategory,
  ListSuppliersParams,
} from '@/lib/types/financial';
import { getPageCount } from '@/lib/types/financial';

// ========== CONSTANTS ==========

const SORT_OPTIONS = [
  { value: 'name:asc', label: 'Name A-Z' },
  { value: 'name:desc', label: 'Name Z-A' },
  { value: 'total_spend:desc', label: 'Highest Spend' },
  { value: 'total_spend:asc', label: 'Lowest Spend' },
  { value: 'last_purchase_date:desc', label: 'Recent Purchase' },
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'created_at:asc', label: 'Oldest First' },
] as const;

const PREFERRED_OPTIONS = [
  { value: '', label: 'All Suppliers' },
  { value: 'true', label: 'Preferred Only' },
  { value: 'false', label: 'Non-Preferred Only' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All' },
];

const PAGE_SIZE = 20;

// Roles
const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee'];
const CAN_MANAGE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const CAN_DELETE_ROLES = ['Owner', 'Admin', 'Bookkeeper'];

// ========== HELPERS ==========

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatLocation(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return null;
}

// ========== SUPPLIER CARD ==========

interface SupplierCardProps {
  supplier: SupplierListItem;
  canManage: boolean;
  canDelete: boolean;
  onDelete: (supplier: SupplierListItem) => void;
  onToggleActive: (supplier: SupplierListItem) => void;
}

function SupplierCard({ supplier, canManage, canDelete, onDelete, onToggleActive }: SupplierCardProps) {
  const location = formatLocation(supplier.city, supplier.state);

  return (
    <Card className={`p-4 sm:p-5 hover:shadow-md transition-shadow ${!supplier.is_active ? 'opacity-60' : ''}`}>
      {/* Header: Name + Preferred badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex-shrink-0">
            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug break-words">
              {supplier.name}
            </h3>
            {supplier.legal_name && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {supplier.legal_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!supplier.is_active && <Badge variant="neutral" label="Inactive" />}
          {supplier.is_preferred && (
            <Badge variant="amber" icon={Star}>Preferred</Badge>
          )}
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 mb-3 pl-12">
        {location && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}
        {supplier.email && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{supplier.email}</span>
          </div>
        )}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-medium">
            <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
            {formatCurrency(supplier.total_spend)}
          </span>
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <Package className="h-3.5 w-3.5 flex-shrink-0" />
            {supplier.product_count} {supplier.product_count === 1 ? 'Product' : 'Products'}
          </span>
        </div>
      </div>

      {/* Category badges */}
      {supplier.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4 pl-12">
          {supplier.categories.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
            >
              {cat.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
              )}
              {cat.name}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Link href={`/financial/suppliers/${supplier.id}`} className="flex-1 min-w-[80px]">
          <Button variant="secondary" size="sm" className="w-full">
            <Eye className="w-4 h-4" />
            View
          </Button>
        </Link>
        {canManage && (
          <Link href={`/financial/suppliers/${supplier.id}/edit`} className="flex-1 min-w-[80px]">
            <Button variant="secondary" size="sm" className="w-full">
              <Edit2 className="w-4 h-4" />
              Edit
            </Button>
          </Link>
        )}
        {canManage && (
          <Button
            variant={supplier.is_active ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => onToggleActive(supplier)}
            className="flex-1 min-w-[80px]"
          >
            {supplier.is_active ? (
              <><Power className="w-4 h-4" /> Deactivate</>
            ) : (
              <><RotateCcw className="w-4 h-4" /> Reactivate</>
            )}
          </Button>
        )}
        {canDelete && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(supplier)}
            className="flex-1 min-w-[80px]"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}

// ========== SKELETON LOADER ==========

function SupplierCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2 mb-3 pl-12">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/5" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
      </div>
      <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
      </div>
    </Card>
  );
}

// ========== MAIN PAGE ==========

export default function SuppliersPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canView = hasRole(CAN_VIEW_ROLES);
  const canManage = hasRole(CAN_MANAGE_ROLES);
  const canDelete = hasRole(CAN_DELETE_ROLES);

  // Data state
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Categories for filter
  const [categories, setCategories] = useState<SupplierCategory[]>([]);

  // Filters & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [preferredFilter, setPreferredFilter] = useState('');
  const [sortKey, setSortKey] = useState('name:asc');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [currentPage, setCurrentPage] = useState(1);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Toggle active modal
  const [toggleActiveModalOpen, setToggleActiveModalOpen] = useState(false);
  const [supplierToToggle, setSupplierToToggle] = useState<SupplierListItem | null>(null);
  const [toggling, setToggling] = useState(false);

  // Search debounce
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  // Load categories for filter dropdown
  useEffect(() => {
    if (!canView) return;
    getSupplierCategories({ is_active: true })
      .then(setCategories)
      .catch((err) => console.error('Failed to load supplier categories:', err));
  }, [canView]);

  // Build params and load suppliers
  // Note: The backend defaults is_active=true when omitted, so to show "all"
  // we must fetch both active and inactive in parallel and merge results.
  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const [sort_by, sort_order] = sortKey.split(':') as [
      ListSuppliersParams['sort_by'],
      ListSuppliersParams['sort_order']
    ];

    const baseParams: ListSuppliersParams = {
      page: currentPage,
      limit: PAGE_SIZE,
      sort_by,
      sort_order,
    };

    if (debouncedSearch.trim()) baseParams.search = debouncedSearch.trim();
    if (categoryFilter) baseParams.category_id = categoryFilter;
    if (preferredFilter === 'true') baseParams.is_preferred = true;
    if (preferredFilter === 'false') baseParams.is_preferred = false;

    try {
      if (statusFilter === 'all') {
        // Backend always filters by is_active, so fetch both in parallel
        const [activeResult, inactiveResult] = await Promise.all([
          getSuppliers({ ...baseParams, is_active: true }),
          getSuppliers({ ...baseParams, is_active: false }),
        ]);
        // Merge and sort client-side for the combined view
        const combined = [...activeResult.data, ...inactiveResult.data];
        const totalCombined = activeResult.meta.total + inactiveResult.meta.total;

        // Sort combined results to match selected sort
        combined.sort((a, b) => {
          const dir = sort_order === 'desc' ? -1 : 1;
          switch (sort_by) {
            case 'total_spend':
              return (parseFloat(a.total_spend) - parseFloat(b.total_spend)) * dir;
            case 'last_purchase_date': {
              const aDate = a.last_purchase_date ? new Date(a.last_purchase_date).getTime() : 0;
              const bDate = b.last_purchase_date ? new Date(b.last_purchase_date).getTime() : 0;
              return (aDate - bDate) * dir;
            }
            case 'created_at':
              return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
            default:
              return a.name.localeCompare(b.name) * dir;
          }
        });

        setSuppliers(combined);
        setTotalItems(totalCombined);
        setTotalPages(Math.ceil(totalCombined / PAGE_SIZE) || 1);
      } else {
        const result = await getSuppliers({
          ...baseParams,
          is_active: statusFilter === 'active',
        });
        setSuppliers(result.data);
        setTotalItems(result.meta.total);
        setTotalPages(getPageCount(result.meta));
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load suppliers';
      setFetchError(message);
      console.error('Failed to load suppliers:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortKey, statusFilter, debouncedSearch, categoryFilter, preferredFilter]);

  useEffect(() => {
    if (canView) {
      loadSuppliers();
    }
  }, [canView, loadSuppliers]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, preferredFilter, statusFilter, sortKey]);

  // Handlers
  const handleDeleteClick = (supplier: SupplierListItem) => {
    setSupplierToDelete(supplier);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;

    setDeleting(true);
    try {
      await deleteSupplier(supplierToDelete.id, true);
      toast.success(`Supplier "${supplierToDelete.name}" permanently deleted`);
      setDeleteModalOpen(false);
      setSupplierToDelete(null);
      setDeleteConfirmText('');
      loadSuppliers();
    } catch (error: unknown) {
      const raw = (error as { message?: string })?.message || 'Failed to delete supplier';

      // Friendly message when supplier has financial dependencies
      if (raw.includes('recurring rule') || raw.includes('financial entry')) {
        toast.error(
          `This supplier can't be permanently deleted because it's linked to existing financial records. You can deactivate it instead.`,
        );
      } else {
        toast.error(raw);
      }
    } finally {
      setDeleting(false);
    }
  };

  // Toggle active handlers
  const handleToggleActiveClick = (supplier: SupplierListItem) => {
    setSupplierToToggle(supplier);
    setToggleActiveModalOpen(true);
  };

  const confirmToggleActive = async () => {
    if (!supplierToToggle) return;

    const newActiveState = !supplierToToggle.is_active;
    setToggling(true);
    try {
      await updateSupplier(supplierToToggle.id, { is_active: newActiveState });
      toast.success(
        newActiveState
          ? `Supplier "${supplierToToggle.name}" reactivated`
          : `Supplier "${supplierToToggle.name}" deactivated`
      );
      setToggleActiveModalOpen(false);
      setSupplierToToggle(null);
      loadSuppliers();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update supplier status';
      toast.error(message);
    } finally {
      setToggling(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setCategoryFilter('');
    setPreferredFilter('');
    setSortKey('name:asc');
    setStatusFilter('active');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || categoryFilter || preferredFilter || statusFilter !== 'active' || sortKey !== 'name:asc';

  // Category options for filter select
  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
  ];

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
          You don&apos;t have permission to view suppliers.
        </p>
      </div>
    );
  }

  // ======= MAIN RENDER =======

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Breadcrumb */}
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
              Suppliers
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage your vendor registry and contacts
            </p>
          </div>
          {canManage && (
            <Link href="/financial/suppliers/new">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4" />
                Add Supplier
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="space-y-3">
            {/* Row 1: Search + Sort */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search by name, legal name, or contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-5 h-5" />}
                  rightIcon={
                    searchQuery ? (
                      <button
                        type="button"
                        onClick={() => { setSearchQuery(''); setDebouncedSearch(''); }}
                        className="hover:text-gray-700 dark:hover:text-gray-200"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : undefined
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                {/* Sort */}
                <Menu as="div" className="relative">
                  <Menu.Button className="inline-flex items-center justify-center gap-2 px-3 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <ArrowUpDown className="w-5 h-5" />
                    <span className="text-sm font-medium hidden sm:inline">
                      {SORT_OPTIONS.find((o) => o.value === sortKey)?.label}
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
                              onClick={() => setSortKey(option.value)}
                              className={`
                                flex items-center justify-between w-full px-4 py-2.5 text-sm
                                ${active ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-200'}
                                ${sortKey === option.value ? 'font-semibold' : 'font-medium'}
                              `}
                            >
                              {option.label}
                              {sortKey === option.value && (
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

            {/* Row 2: Category filter + Preferred filter + Active toggle + Clear */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="w-full sm:w-48">
                <Select
                  options={categoryOptions}
                  value={categoryFilter}
                  onChange={(val) => setCategoryFilter(val)}
                  placeholder="All Categories"
                  searchable={categories.length > 5}
                />
              </div>
              <div className="w-full sm:w-48">
                <Select
                  options={PREFERRED_OPTIONS}
                  value={preferredFilter}
                  onChange={(val) => setPreferredFilter(val)}
                  placeholder="All Suppliers"
                />
              </div>
              <div className="w-full sm:w-40">
                <Select
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val as 'active' | 'inactive' | 'all')}
                  placeholder="Status"
                />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium whitespace-nowrap"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SupplierCardSkeleton key={i} />
            ))}
          </div>
        ) : fetchError ? (
          <Card className="p-8 sm:p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Failed to Load Suppliers
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{fetchError}</p>
              <Button variant="primary" onClick={loadSuppliers} size="sm">
                Try Again
              </Button>
            </div>
          </Card>
        ) : suppliers.length === 0 ? (
          <Card className="p-8 sm:p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                {debouncedSearch || categoryFilter || preferredFilter || statusFilter !== 'active' ? (
                  <Search className="w-8 h-8 text-gray-400" />
                ) : (
                  <Building2 className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {debouncedSearch || categoryFilter || preferredFilter || statusFilter !== 'active'
                  ? 'No suppliers match your filters'
                  : 'No suppliers yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {debouncedSearch || categoryFilter || preferredFilter || statusFilter !== 'active'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Add your first supplier to start tracking vendor information and spending'}
              </p>
              {!(debouncedSearch || categoryFilter || preferredFilter || statusFilter !== 'active') && canManage && (
                <Link href="/financial/suppliers/new">
                  <Button variant="primary" size="sm">
                    <Plus className="w-4 h-4" />
                    Add Supplier
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* Supplier cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {suppliers.map((supplier) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  canManage={canManage}
                  canDelete={canDelete}
                  onDelete={handleDeleteClick}
                  onToggleActive={handleToggleActiveClick}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onNext={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                onPrevious={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                onGoToPage={setCurrentPage}
              />
            )}

            {/* Count footer */}
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Showing {suppliers.length} of {totalItems} suppliers
            </p>
          </>
        )}
      </div>

      {/* Permanent Delete Confirmation Modal */}
      {canDelete && (
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSupplierToDelete(null);
            setDeleteConfirmText('');
          }}
          title="Permanently Delete Supplier"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-red-600 dark:text-red-500" />
              <div className="space-y-2">
                <p className="text-gray-700 dark:text-gray-300">
                  You are about to <span className="font-bold text-red-600 dark:text-red-400">permanently delete</span> the supplier{' '}
                  <span className="font-semibold">&quot;{supplierToDelete?.name}&quot;</span>.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This action is irreversible. All associated products, price history, and category assignments will also be deleted. If this supplier has financial entries or recurring expense rules, you will need to deactivate it instead.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="delete-confirm"
                className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
              >
                Type <span className="font-mono text-red-600 dark:text-red-400">delete</span> to confirm
              </label>
              <Input
                id="delete-confirm"
                placeholder="Type delete to confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>

            <ModalActions>
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSupplierToDelete(null);
                  setDeleteConfirmText('');
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                loading={deleting}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
              >
                <Trash2 className="w-4 h-4" />
                Permanently Delete
              </Button>
            </ModalActions>
          </div>
        </Modal>
      )}

      {/* Deactivate/Reactivate Confirmation Modal */}
      {canManage && (
        <ConfirmModal
          isOpen={toggleActiveModalOpen}
          onClose={() => {
            setToggleActiveModalOpen(false);
            setSupplierToToggle(null);
          }}
          onConfirm={confirmToggleActive}
          title={supplierToToggle?.is_active ? 'Deactivate Supplier' : 'Reactivate Supplier'}
          message={
            supplierToToggle?.is_active
              ? `Are you sure you want to deactivate "${supplierToToggle?.name}"? The supplier will be hidden from active lists but can be reactivated later.`
              : `Are you sure you want to reactivate "${supplierToToggle?.name}"? The supplier will appear in active lists again.`
          }
          confirmText={supplierToToggle?.is_active ? 'Deactivate' : 'Reactivate'}
          variant={supplierToToggle?.is_active ? 'warning' : 'info'}
          loading={toggling}
        />
      )}
    </>
  );
}
