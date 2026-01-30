/**
 * Item Library Page
 * Full page for managing reusable quote items
 * Features: search, filters, pagination, CRUD operations
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { BulkImportModal } from '@/components/library/BulkImportModal';
import {
  Plus,
  Upload,
  Search,
  Edit,
  Trash2,
  Package,
  Power,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  getLibraryItems,
  deleteLibraryItem,
  toggleLibraryItemActive,
} from '@/lib/api/library-items';
import { getUnitMeasurements } from '@/lib/api/units';
import { formatMoney } from '@/lib/api/quotes';
import type { LibraryItem, UnitMeasurement } from '@/lib/types/quotes';

export default function ItemLibraryPage() {
  const router = useRouter();

  // Data
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [units, setUnits] = useState<UnitMeasurement[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [sortBy, setSortBy] = useState<'title' | 'usage_count' | 'created_at'>('title');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Loading & Modals
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<LibraryItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, [searchQuery, unitFilter, activeFilter, sortBy, currentPage]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [itemsData, unitsData] = await Promise.all([
        getLibraryItems({
          search: searchQuery || undefined,
          unit_measurement_id: unitFilter || undefined,
          is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
          sort_by: sortBy,
          sort_order: 'asc',
          page: currentPage,
          limit: 20,
        }),
        units.length > 0 ? Promise.resolve({ data: units }) : getUnitMeasurements(),
      ]);

      setItems(itemsData?.data || []);
      setTotalPages(itemsData?.pagination?.totalPages || 1);
      setTotalItems(itemsData?.pagination?.total || 0);

      if (units.length === 0) {
        const allUnits = unitsData?.data || [];
        setUnits(allUnits);
      }
    } catch (err: any) {
      console.error('Failed to load library items:', err);
      showError(err.message || 'Failed to load library items');
      // Set empty arrays on error
      setItems([]);
      setTotalPages(1);
      setTotalItems(0);
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

  const handleDeleteClick = (item: LibraryItem) => {
    setDeletingItem(item);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;

    try {
      setDeleteLoading(true);
      await deleteLibraryItem(deletingItem.id);
      setDeleteModalOpen(false);
      await loadData();
      showSuccess('Library item deleted successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to delete library item');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleActive = async (item: LibraryItem) => {
    try {
      await toggleLibraryItemActive(item.id);
      await loadData();
      showSuccess(`Item ${item.is_active ? 'deactivated' : 'activated'} successfully`);
    } catch (err: any) {
      showError(err.message || 'Failed to update item status');
    }
  };

  // Options
  const unitOptions = [
    { value: '', label: 'All Units' },
    ...units.map((u) => ({ value: u.id, label: `${u.name} (${u.abbreviation})` })),
  ];

  const activeOptions = [
    { value: 'all', label: 'All Items' },
    { value: 'active', label: 'Active Only' },
    { value: 'inactive', label: 'Inactive Only' },
  ];

  const sortOptions = [
    { value: 'title', label: 'Name (A-Z)' },
    { value: 'usage_count', label: 'Most Used' },
    { value: 'created_at', label: 'Recently Added' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Item Library</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage reusable quote items ({totalItems} total)
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setBulkImportModalOpen(true)}>
            <Upload className="w-4 h-4" />
            Bulk Import
          </Button>
          <Button onClick={() => router.push('/library/items/new')}>
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="space-y-4">
          <Input
            leftIcon={<Search className="w-5 h-5" />}
            placeholder="Search library items..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              value={unitFilter}
              onChange={(value) => {
                setUnitFilter(value);
                setCurrentPage(1);
              }}
              options={unitOptions}
            />

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
      {!loading && items.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <Package className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              No items found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Create library items to reuse them in quotes'}
            </p>
            {!searchQuery && (
              <Button onClick={() => router.push('/library/items/new')}>
                <Plus className="w-4 h-4" />
                Add First Item
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Desktop Table View */}
      {!loading && items.length > 0 && (
        <Card className="overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Title
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Unit
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Cost/Unit
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Usage
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                      {item.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate max-w-md">
                          {item.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                      {item.unit_measurement?.abbreviation || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatMoney(
                        item.total_cost_per_unit ||
                        (item.material_cost_per_unit || 0) +
                        (item.labor_cost_per_unit || 0) +
                        (item.equipment_cost_per_unit || 0) +
                        (item.subcontract_cost_per_unit || 0) +
                        (item.other_cost_per_unit || 0)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                      {item.usage_count}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/library/items/${item.id}/edit`)}
                          title="Edit item"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(item)}
                          title={item.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Power
                            className={`w-4 h-4 ${
                              item.is_active
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-400 dark:text-gray-500'
                            }`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(item)}
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden p-4 space-y-3">
            {items.map((item) => (
              <Card key={item.id} className="p-4 border">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</h4>
                    {item.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.description}</p>
                    )}
                  </div>
                  {item.is_active ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Unit</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {item.unit_measurement?.abbreviation || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Usage</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{item.usage_count}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Cost/Unit</p>
                    <p className="font-bold text-blue-600 dark:text-blue-400">
                      {formatMoney(
                        item.total_cost_per_unit ||
                        (item.material_cost_per_unit || 0) +
                        (item.labor_cost_per_unit || 0) +
                        (item.equipment_cost_per_unit || 0) +
                        (item.subcontract_cost_per_unit || 0) +
                        (item.other_cost_per_unit || 0)
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/library/items/${item.id}/edit`)}
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleToggleActive(item)}>
                    <Power className="w-4 h-4" />
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteClick(item)}>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 flex items-center justify-between">
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
            </div>
          )}
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleteLoading && setDeleteModalOpen(false)}
        title="Delete Library Item"
        size="sm"
      >
        <ModalContent>
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                Are you sure you want to delete "{deletingItem?.title}"?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This action cannot be undone. This item has been used in {deletingItem?.usage_count}{' '}
                {deletingItem?.usage_count === 1 ? 'quote' : 'quotes'}.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm} loading={deleteLoading}>
            Delete Item
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

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={bulkImportModalOpen}
        onClose={() => setBulkImportModalOpen(false)}
        onSuccess={() => {
          showSuccess('Library items imported successfully');
          loadData();
        }}
      />
    </div>
  );
}
