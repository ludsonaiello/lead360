/**
 * Bundle Management Page
 * Manage bundles (collections of library items)
 * Features: search, filters, pagination, CRUD operations
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Power,
  Package,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  getBundles,
  deleteBundle,
  duplicateBundle,
  toggleBundleActive,
} from '@/lib/api/bundles';
import { formatMoney } from '@/lib/api/quotes';
import type { Bundle } from '@/lib/types/quotes';

export default function BundleManagementPage() {
  const router = useRouter();

  // Data
  const [bundles, setBundles] = useState<Bundle[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'updated_at' | 'is_active'>('name');

  // Expanded items (for viewing bundle contents)
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Loading & Modals
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingBundle, setDeletingBundle] = useState<Bundle | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load data
  useEffect(() => {
    loadData();
  }, [searchQuery, activeFilter, sortBy, currentPage]);

  const loadData = async () => {
    try {
      setLoading(true);

      const data = await getBundles({
        page: currentPage,
        limit: 20,
        is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
        sort_by: sortBy,
        sort_order: 'asc',
      });

      // Filter by search on client side (if API doesn't support it)
      let filteredData = data?.data || [];
      if (searchQuery && filteredData.length > 0) {
        const query = searchQuery.toLowerCase();
        filteredData = filteredData.filter(
          (b) =>
            b.name.toLowerCase().includes(query) ||
            (b.description && b.description.toLowerCase().includes(query))
        );
      }

      setBundles(filteredData);
      setTotalPages(data?.pagination?.totalPages || 1);
      setTotalItems(data?.pagination?.total || 0);
    } catch (err: any) {
      console.error('Failed to load bundles:', err);
      // Set empty arrays on error
      setBundles([]);
      setTotalPages(1);
      setTotalItems(0);
      showError(err.message || 'Failed to load bundles');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setSuccessModalOpen(true);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalOpen(true);
  };

  const toggleExpanded = (bundleId: string) => {
    const newExpanded = new Set(expandedBundles);
    if (newExpanded.has(bundleId)) {
      newExpanded.delete(bundleId);
    } else {
      newExpanded.add(bundleId);
    }
    setExpandedBundles(newExpanded);
  };

  const handleDuplicate = async (bundle: Bundle) => {
    try {
      await duplicateBundle(bundle.id);
      await loadData();
      showSuccess(`Bundle "${bundle.name}" duplicated successfully`);
    } catch (err: any) {
      showError(err.message || 'Failed to duplicate bundle');
    }
  };

  const handleToggleActive = async (bundle: Bundle) => {
    try {
      await toggleBundleActive(bundle.id);
      await loadData();
      showSuccess(`Bundle ${bundle.is_active ? 'deactivated' : 'activated'} successfully`);
    } catch (err: any) {
      showError(err.message || 'Failed to update bundle status');
    }
  };

  const handleDeleteClick = (bundle: Bundle) => {
    setDeletingBundle(bundle);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBundle) return;

    try {
      setDeleteLoading(true);
      await deleteBundle(deletingBundle.id);
      setDeleteModalOpen(false);
      await loadData();
      showSuccess('Bundle deleted successfully');
    } catch (err: any) {
      showError(
        err.response?.data?.message ||
          err.message ||
          'Failed to delete bundle. It may be in use.'
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  // Options
  const activeOptions = [
    { value: 'all', label: 'All Bundles' },
    { value: 'active', label: 'Active Only' },
    { value: 'inactive', label: 'Inactive Only' },
  ];

  const sortOptions = [
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'created_at', label: 'Recently Created' },
    { value: 'updated_at', label: 'Recently Updated' },
    { value: 'is_active', label: 'Status (Active First)' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Bundles</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage item bundles for quick quote building ({totalItems} total)
          </p>
        </div>
        <Button onClick={() => router.push('/library/bundles/new')}>
          <Plus className="w-4 h-4" />
          Create Bundle
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="space-y-4">
          <Input
            leftIcon={<Search className="w-5 h-5" />}
            placeholder="Search bundles..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              value={activeFilter}
              onChange={(value) => {
                setActiveFilter(value as any);
                setCurrentPage(1);
              }}
              options={activeOptions}
            />

            <Select
              value={sortBy}
              onChange={(value) => setSortBy(value as any)}
              options={sortOptions}
            />
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
        </div>
      )}

      {/* Empty State */}
      {!loading && bundles.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <Package className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              No bundles found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Create bundles to quickly add multiple items to quotes'}
            </p>
            {!searchQuery && (
              <Button onClick={() => router.push('/library/bundles/new')}>
                <Plus className="w-4 h-4" />
                Create First Bundle
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Bundles List */}
      {!loading && bundles.length > 0 && (
        <div className="space-y-4">
          {bundles.map((bundle) => {
            const isExpanded = expandedBundles.has(bundle.id);

            return (
              <Card key={bundle.id} className="overflow-hidden">
                {/* Bundle Header */}
                <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <button
                    onClick={() => toggleExpanded(bundle.id)}
                    className="flex-1 flex items-center gap-4 text-left"
                  >
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {bundle.name}
                        </h3>
                        {bundle.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      {bundle.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {bundle.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <span>{bundle._count.items} items</span>
                        <span>•</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {formatMoney(bundle.total_cost)} total
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/library/bundles/${bundle.id}/edit`)}
                      title="Edit bundle"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(bundle)}
                      title="Duplicate bundle"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(bundle)}
                      title={bundle.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <Power
                        className={`w-4 h-4 ${
                          bundle.is_active
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(bundle)}
                      title="Delete bundle"
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* Bundle Items (Expanded) */}
                {isExpanded && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Bundle Items
                    </h4>
                    <div className="space-y-2">
                      {bundle.items.map((bundleItem) => (
                        <div
                          key={bundleItem.id}
                          className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {bundleItem.title}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {bundleItem.quantity} {bundleItem.unit_measurement.abbreviation}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <Card className="p-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleteLoading && setDeleteModalOpen(false)}
        title="Delete Bundle"
        size="sm"
      >
        <ModalContent>
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                Are you sure you want to delete "{deletingBundle?.name}"?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This action cannot be undone. You can deactivate it instead to keep it hidden.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm} loading={deleteLoading}>
            Delete Bundle
          </Button>
        </ModalActions>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Success"
        size="sm"
      >
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{successMessage}</p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setSuccessModalOpen(false)}>Close</Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        size="sm"
      >
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <XCircle className="w-16 h-16 text-red-500 dark:text-red-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Operation Failed
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{errorMessage}</p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={() => setErrorModalOpen(false)}>
            Close
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
