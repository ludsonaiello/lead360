'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { Plus, Pencil, Trash2, Receipt, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getFinancialEntries,
  getFinancialCategories,
  deleteFinancialEntry,
} from '@/lib/api/financial';
import { formatCurrency, formatDate } from '@/lib/api/projects';
import type { FinancialEntry, FinancialCategory, PaginatedResponse } from '@/lib/types/financial';
import CostEntryFormModal from './CostEntryFormModal';

interface CostEntryTableProps {
  projectId: string;
  onDataChange: () => void;
}

const CATEGORY_TYPE_VARIANTS: Record<string, 'blue' | 'green' | 'purple' | 'orange' | 'gray'> = {
  labor: 'blue',
  material: 'green',
  subcontractor: 'purple',
  equipment: 'orange',
  other: 'gray',
};

export default function CostEntryTable({ projectId, onDataChange }: CostEntryTableProps) {
  const [entries, setEntries] = useState<PaginatedResponse<FinancialEntry> | null>(null);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterHasReceipt, setFilterHasReceipt] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editEntry, setEditEntry] = useState<FinancialEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<FinancialEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // When receipt filter is active, fetch all entries for proper client-side filtering
      const useClientFilter = !!filterHasReceipt;
      const data = await getFinancialEntries({
        project_id: projectId,
        category_id: filterCategory || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        page: useClientFilter ? 1 : page,
        limit: useClientFilter ? 100 : 20,
      });
      // Client-side filter for has_receipt (API doesn't support this filter)
      if (filterHasReceipt === 'yes') {
        data.data = data.data.filter((e) => e.has_receipt);
      } else if (filterHasReceipt === 'no') {
        data.data = data.data.filter((e) => !e.has_receipt);
      }
      if (useClientFilter) {
        data.meta.total = data.data.length;
        data.meta.pages = 1;
        data.meta.page = 1;
      }
      setEntries(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load cost entries');
    } finally {
      setLoading(false);
    }
  }, [projectId, filterCategory, filterDateFrom, filterDateTo, filterHasReceipt, page]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const loadCats = async () => {
      try {
        const data = await getFinancialCategories();
        setCategories(data);
      } catch {
        // categories are for filter dropdown, non-blocking
      }
    };
    loadCats();
  }, []);

  const handleEntryCreated = () => {
    loadEntries();
    onDataChange();
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;
    setDeleting(true);
    try {
      await deleteFinancialEntry(deleteEntry.id);
      toast.success('Cost entry deleted');
      setDeleteEntry(null);
      loadEntries();
      onDataChange();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to delete entry');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setFilterCategory('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterHasReceipt('');
    setPage(1);
  };

  const hasActiveFilters = filterCategory || filterDateFrom || filterDateTo || filterHasReceipt;

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <>
      <Card className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cost Entries</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => { setEditEntry(null); setShowFormModal(true); }}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Cost
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                options={categoryOptions}
                value={filterCategory}
                onChange={(val) => { setFilterCategory(val); setPage(1); }}
                placeholder="All Categories"
                searchable
              />
              <DatePicker
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                placeholder="From date"
              />
              <DatePicker
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                placeholder="To date"
              />
              <Select
                options={[
                  { value: '', label: 'All Entries' },
                  { value: 'yes', label: 'Has Receipt' },
                  { value: 'no', label: 'No Receipt' },
                ]}
                value={filterHasReceipt}
                onChange={(val) => { setFilterHasReceipt(val); setPage(1); }}
                placeholder="Receipt Status"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="py-12">
            <LoadingSpinner size="lg" centered />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 dark:text-red-400">{error}</div>
        ) : !entries || entries.data.length === 0 ? (
          <div className="py-12 text-center">
            <DollarIcon />
            <p className="text-gray-500 dark:text-gray-400 mt-2">No cost entries yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Add your first cost entry to start tracking expenses.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Category</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Vendor</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Notes</th>
                    <th className="text-center py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Receipt</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.data.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 px-3 text-gray-900 dark:text-white whitespace-nowrap">
                        {formatDate(entry.entry_date)}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={CATEGORY_TYPE_VARIANTS[entry.category.type] || 'gray'}>
                          {entry.category.name}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount)}
                      </td>
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                        {entry.vendor_name || '-'}
                      </td>
                      <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                        {entry.notes || '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {entry.has_receipt ? (
                          <Receipt className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditEntry(entry); setShowFormModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteEntry(entry)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {entries.data.map((entry) => (
                <div key={entry.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={CATEGORY_TYPE_VARIANTS[entry.category.type] || 'gray'}>
                      {entry.category.name}
                    </Badge>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                    <div>{formatDate(entry.entry_date)}</div>
                    {entry.vendor_name && <div>Vendor: {entry.vendor_name}</div>}
                    {entry.notes && <div className="truncate">{entry.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    {entry.has_receipt && (
                      <Badge variant="success" icon={Receipt}>Receipt</Badge>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={() => { setEditEntry(entry); setShowFormModal(true); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteEntry(entry)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {entries.meta.pages > 1 && (
              <div className="mt-4">
                <PaginationControls
                  currentPage={page}
                  totalPages={entries.meta.pages}
                  onNext={() => setPage((p) => p + 1)}
                  onPrevious={() => setPage((p) => p - 1)}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Form Modal */}
      {showFormModal && (
        <CostEntryFormModal
          isOpen={showFormModal}
          onClose={() => { setShowFormModal(false); setEditEntry(null); }}
          onSuccess={handleEntryCreated}
          projectId={projectId}
          entry={editEntry}
        />
      )}

      {/* Delete Confirmation */}
      {deleteEntry && (
        <DeleteConfirmationModal
          isOpen={!!deleteEntry}
          onClose={() => setDeleteEntry(null)}
          onConfirm={handleDelete}
          title="Delete Cost Entry"
          message={`Are you sure you want to delete this ${formatCurrency(typeof deleteEntry.amount === 'string' ? parseFloat(deleteEntry.amount) : deleteEntry.amount)} cost entry? This action cannot be undone.`}
          isDeleting={deleting}
        />
      )}
    </>
  );
}

function DollarIcon() {
  return (
    <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
}
