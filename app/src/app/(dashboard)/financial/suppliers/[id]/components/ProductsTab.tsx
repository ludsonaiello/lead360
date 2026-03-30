/**
 * ProductsTab — Supplier Products List & Management
 * Sprint 7 — Financial Frontend
 *
 * Replaces the Sprint 6 placeholder. Shows product cards with
 * name, SKU, unit, price, and action buttons (Edit, Price History, Delete).
 * RBAC: Owner/Admin/Manager/Bookkeeper for create/update; Owner/Admin/Bookkeeper for delete.
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  History,
  Tag,
  Ruler,
  DollarSign,
  Calendar,
  Filter,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import toast from 'react-hot-toast';
import {
  getSupplierProducts,
  deleteSupplierProduct,
  updateSupplierProduct,
} from '@/lib/api/financial';
import type { SupplierProduct } from '@/lib/types/financial';
import ProductFormModal from './ProductFormModal';
import PriceHistoryModal from './PriceHistoryModal';

// ========== CONSTANTS ==========

const CAN_MANAGE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const CAN_DELETE_ROLES = ['Owner', 'Admin', 'Bookkeeper'];
const CAN_HARD_DELETE_ROLES = ['Owner', 'Admin'];

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A\u2013Z' },
  { value: 'name_desc', label: 'Name Z\u2013A' },
  { value: 'price_asc', label: 'Price: Low \u2192 High' },
  { value: 'price_desc', label: 'Price: High \u2192 Low' },
  { value: 'updated_desc', label: 'Recently Updated' },
  { value: 'sku_asc', label: 'SKU A\u2013Z' },
];

// ========== HELPERS ==========

function formatCurrency4(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ========== TYPES ==========

interface ProductsTabProps {
  supplierId: string;
  canManage: boolean;
  canDelete: boolean;
  canHardDelete: boolean;
}

// ========== SKELETON LOADER ==========

function ProductsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ========== PRODUCT CARD ==========

interface ProductCardProps {
  product: SupplierProduct;
  canManage: boolean;
  canDelete: boolean;
  canHardDelete: boolean;
  onEdit: (product: SupplierProduct) => void;
  onDelete: (product: SupplierProduct) => void;
  onHardDelete: (product: SupplierProduct) => void;
  onPriceHistory: (product: SupplierProduct) => void;
  onReactivate: (product: SupplierProduct) => void;
}

function ProductCard({
  product,
  canManage,
  canDelete,
  canHardDelete,
  onEdit,
  onDelete,
  onHardDelete,
  onPriceHistory,
  onReactivate,
}: ProductCardProps) {
  const inactive = !product.is_active;

  return (
    <div
      className={`group rounded-lg border transition-colors ${
        inactive
          ? 'bg-gray-50 dark:bg-gray-900 border-dashed border-gray-300 dark:border-gray-600 opacity-75'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
              inactive
                ? 'bg-gray-200 dark:bg-gray-700'
                : 'bg-blue-50 dark:bg-blue-900/30'
            }`}
          >
            <Package
              className={`w-5 h-5 ${
                inactive
                  ? 'text-gray-400 dark:text-gray-500'
                  : 'text-blue-600 dark:text-blue-400'
              }`}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Name + Inactive badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className={`text-base font-semibold truncate ${
                  inactive
                    ? 'text-gray-500 dark:text-gray-400 line-through'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {product.name}
              </h4>
              {inactive && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                  Inactive
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                {product.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600 dark:text-gray-400">
              {product.sku && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">SKU:</span> {product.sku}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-medium">Unit:</span> {product.unit_of_measure}
              </span>
              {product.unit_price && parseFloat(product.unit_price) > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">Price:</span>{' '}
                  <span className="text-green-700 dark:text-green-400 font-semibold">
                    {formatCurrency4(product.unit_price)}
                  </span>
                </span>
              )}
              {product.price_last_updated_at && (
                <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  Updated {formatDate(product.price_last_updated_at)}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Reactivate button — prominent on inactive products */}
              {inactive && canManage && (
                <button
                  type="button"
                  onClick={() => onReactivate(product)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                    text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30
                    hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors
                    border border-green-200 dark:border-green-800
                    focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                  aria-label={`Reactivate ${product.name}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reactivate
                </button>
              )}

              <button
                type="button"
                onClick={() => onPriceHistory(product)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                  text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30
                  hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                aria-label={`View price history for ${product.name}`}
              >
                <History className="w-3.5 h-3.5" />
                Price History
              </button>

              {canManage && (
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                    text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700
                    hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                  aria-label={`Edit ${product.name}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}

              {canDelete && product.is_active && (
                <button
                  type="button"
                  onClick={() => onDelete(product)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                    text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30
                    hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                  aria-label={`Deactivate ${product.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Permanent delete — only on inactive products, Owner/Admin only */}
              {canHardDelete && inactive && (
                <button
                  type="button"
                  onClick={() => onHardDelete(product)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                    text-red-100 bg-red-600 dark:bg-red-700
                    hover:bg-red-700 dark:hover:bg-red-600 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                  aria-label={`Permanently delete ${product.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Permanently Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== MAIN COMPONENT ==========

export default function ProductsTab({ supplierId, canManage, canDelete, canHardDelete }: ProductsTabProps) {
  // Data
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search, sort, filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [showInactive, setShowInactive] = useState(false);

  // Form modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);

  // Price history modal
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Soft delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<SupplierProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Hard delete modal
  const [hardDeleteModalOpen, setHardDeleteModalOpen] = useState(false);
  const [hardDeletingProduct, setHardDeletingProduct] = useState<SupplierProduct | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState('');

  // ===== Data fetching =====

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      if (showInactive) {
        // Backend defaults to is_active=true, so fetch both active and inactive separately
        const [active, inactive] = await Promise.all([
          getSupplierProducts(supplierId, { is_active: true }),
          getSupplierProducts(supplierId, { is_active: false }),
        ]);
        // Merge: active first, then inactive — sort applied later by the memo
        setProducts([...active, ...inactive]);
      } else {
        const data = await getSupplierProducts(supplierId, { is_active: true });
        setProducts(data);
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setFetchError(apiErr?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [supplierId, showInactive]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ===== Filtered & sorted products =====

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.sku && p.sku.toLowerCase().includes(query)) ||
          p.unit_of_measure.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'price_asc':
          return (parseFloat(a.unit_price) || 0) - (parseFloat(b.unit_price) || 0);
        case 'price_desc':
          return (parseFloat(b.unit_price) || 0) - (parseFloat(a.unit_price) || 0);
        case 'updated_desc':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'sku_asc':
          return (a.sku ?? '').localeCompare(b.sku ?? '');
        default:
          return 0;
      }
    });

    return result;
  }, [products, searchQuery, sortBy]);

  // Existing product names for uniqueness check
  const existingNames = useMemo(
    () => products.map((p) => p.name.toLowerCase()),
    [products]
  );

  // ===== Actions =====

  const handleCreate = () => {
    setEditingProduct(null);
    setFormModalOpen(true);
  };

  const handleEdit = (product: SupplierProduct) => {
    setEditingProduct(product);
    setFormModalOpen(true);
  };

  const handlePriceHistory = (product: SupplierProduct) => {
    setPriceHistoryProduct({ id: product.id, name: product.name });
    setPriceHistoryOpen(true);
  };

  const handleReactivate = async (product: SupplierProduct) => {
    try {
      await updateSupplierProduct(supplierId, product.id, { is_active: true });
      toast.success(`Product "${product.name}" reactivated`);
      loadProducts();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      toast.error(apiErr?.message || 'Failed to reactivate product');
    }
  };

  const handleDeleteClick = (product: SupplierProduct) => {
    setDeletingProduct(product);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      await deleteSupplierProduct(supplierId, deletingProduct.id);
      toast.success(`Product "${deletingProduct.name}" deleted`);
      setDeleteModalOpen(false);
      setDeletingProduct(null);
      loadProducts();
    } catch (err: unknown) {
      // Axios interceptor rejects with { status, message, error, data }
      const apiErr = err as { message?: string };
      const message = apiErr?.message || 'Failed to delete product';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleHardDeleteClick = (product: SupplierProduct) => {
    setHardDeletingProduct(product);
    setHardDeleteConfirmText('');
    setHardDeleteModalOpen(true);
  };

  const handleHardDeleteConfirm = async () => {
    if (!hardDeletingProduct) return;
    setHardDeleting(true);
    try {
      await deleteSupplierProduct(supplierId, hardDeletingProduct.id, true);
      toast.success(`Product "${hardDeletingProduct.name}" permanently deleted`);
      setHardDeleteModalOpen(false);
      setHardDeletingProduct(null);
      setHardDeleteConfirmText('');
      loadProducts();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      toast.error(apiErr?.message || 'Failed to permanently delete product');
    } finally {
      setHardDeleting(false);
    }
  };

  const handleFormSuccess = () => {
    loadProducts();
  };

  // ===== Render =====

  return (
    <div className="space-y-4">
      {/* Header: search, sort, filter, add button */}
      <div className="space-y-3">
        {/* Top row: search + add button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 max-w-sm">
            <Input
              id="product-search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {canManage && (
            <Button variant="primary" size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          )}
        </div>

        {/* Second row: sort + filter (only when there are products) */}
        {products.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-full sm:w-48">
              <Select
                options={SORT_OPTIONS}
                value={sortBy}
                onChange={(val) => setSortBy(val)}
                placeholder="Sort by..."
              />
            </div>

            <label htmlFor="show-inactive-filter" className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600 dark:text-gray-400">
              <input
                id="show-inactive-filter"
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
              />
              <Filter className="w-3.5 h-3.5" />
              Show inactive
            </label>
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && <ProductsSkeleton />}

      {/* Error state */}
      {!loading && fetchError && (
        <Card className="p-8">
          <div className="text-center">
            <Package className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {fetchError}
            </p>
            <Button variant="secondary" size="sm" onClick={loadProducts}>
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !fetchError && products.length === 0 && (
        <Card className="p-8 sm:p-12">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Products Yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
              Add products to track materials, items, and pricing for this supplier.
            </p>
            {canManage && (
              <Button variant="primary" size="sm" onClick={handleCreate}>
                <Plus className="w-4 h-4" />
                Add First Product
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* No search results */}
      {!loading &&
        !fetchError &&
        products.length > 0 &&
        filteredProducts.length === 0 && (
          <Card className="p-8">
            <div className="text-center">
              <Search className="w-8 h-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No products match &ldquo;{searchQuery}&rdquo;
              </p>
            </div>
          </Card>
        )}

      {/* Product list */}
      {!loading && !fetchError && filteredProducts.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>

          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              canManage={canManage}
              canDelete={canDelete}
              canHardDelete={canHardDelete}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onHardDelete={handleHardDeleteClick}
              onPriceHistory={handlePriceHistory}
              onReactivate={handleReactivate}
            />
          ))}
        </div>
      )}

      {/* ===== Modals ===== */}

      {/* Create/Edit product modal */}
      <ProductFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={handleFormSuccess}
        supplierId={supplierId}
        product={editingProduct}
        existingNames={existingNames}
      />

      {/* Price history modal — keep mounted for exit animation */}
      <PriceHistoryModal
        isOpen={priceHistoryOpen}
        onClose={() => setPriceHistoryOpen(false)}
        supplierId={supplierId}
        productId={priceHistoryProduct?.id ?? ''}
        productName={priceHistoryProduct?.name ?? ''}
      />

      {/* Delete confirmation modal — keep mounted for exit animation */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        message={
          deletingProduct
            ? `Are you sure you want to delete "${deletingProduct.name}"? This product will be deactivated and hidden from the active list.`
            : ''
        }
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />

      {/* Permanent delete confirmation modal */}
      <Modal
        isOpen={hardDeleteModalOpen}
        onClose={() => {
          setHardDeleteModalOpen(false);
          setHardDeletingProduct(null);
          setHardDeleteConfirmText('');
        }}
        title="Permanently Delete Product"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 text-red-600 dark:text-red-500" />
            <div className="space-y-2">
              <p className="text-gray-700 dark:text-gray-300">
                You are about to{' '}
                <span className="font-bold text-red-600 dark:text-red-400">permanently delete</span>{' '}
                the product{' '}
                <span className="font-semibold">&quot;{hardDeletingProduct?.name}&quot;</span>.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This action is <strong>irreversible</strong>. The product and all its price history
                records will be permanently removed.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="hard-delete-confirm"
              className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
            >
              Type <span className="font-mono text-red-600 dark:text-red-400">delete</span> to confirm
            </label>
            <Input
              id="hard-delete-confirm"
              value={hardDeleteConfirmText}
              onChange={(e) => setHardDeleteConfirmText(e.target.value)}
              placeholder="delete"
            />
          </div>

          <ModalActions>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setHardDeleteModalOpen(false);
                setHardDeletingProduct(null);
                setHardDeleteConfirmText('');
              }}
              disabled={hardDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleHardDeleteConfirm}
              loading={hardDeleting}
              disabled={hardDeleteConfirmText.toLowerCase() !== 'delete'}
            >
              <Trash2 className="w-4 h-4" />
              Permanently Delete
            </Button>
          </ModalActions>
        </div>
      </Modal>
    </div>
  );
}
