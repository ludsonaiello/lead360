/**
 * AddFromLibraryModal Component
 * Large modal for browsing and selecting library items to add to quote
 * Features: search, filters, multi-select
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Search, Package } from 'lucide-react';
import { getLibraryItems } from '@/lib/api/library-items';
import { getUnitMeasurements } from '@/lib/api/units';
import { formatMoney } from '@/lib/api/quotes';
import type { LibraryItem, UnitMeasurement } from '@/lib/types/quotes';

interface AddFromLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (itemIds: string[]) => Promise<void>;
  loading?: boolean;
}

export function AddFromLibraryModal({
  isOpen,
  onClose,
  onAddItems,
  loading = false,
}: AddFromLibraryModalProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [units, setUnits] = useState<UnitMeasurement[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [sortBy, setSortBy] = useState<'title' | 'usage_count' | 'created_at'>('title');

  // Loading
  const [loadingData, setLoadingData] = useState(false);

  // Load library items
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, searchQuery, unitFilter, activeFilter, sortBy]);

  const loadData = async () => {
    try {
      setLoadingData(true);

      const [itemsData, unitsData] = await Promise.all([
        getLibraryItems({
          search: searchQuery || undefined,
          unit_measurement_id: unitFilter || undefined,
          is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
          sort_by: sortBy,
          sort_order: 'asc',
          page: 1,
          limit: 100,
        }),
        getUnitMeasurements(),
      ]);

      setItems(itemsData?.data || []);
      const allUnits = unitsData?.data || [];
      setUnits(allUnits);
    } catch (err: any) {
      console.error('Failed to load library items:', err);
      setItems([]);
      setUnits([]);
    } finally {
      setLoadingData(false);
    }
  };

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItemIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItemIds(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedItemIds.size === items.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleAdd = async () => {
    if (selectedItemIds.size === 0) return;

    try {
      await onAddItems(Array.from(selectedItemIds));
      handleClose();
    } catch (err) {
      // Error handled by parent
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedItemIds(new Set());
      setSearchQuery('');
      setUnitFilter('');
      setActiveFilter('active');
      setSortBy('title');
      onClose();
    }
  };

  // Unit options
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

  const allSelected = items.length > 0 && selectedItemIds.size === items.length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add from Library" size="lg">
      <ModalContent>
        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <Input
            leftIcon={<Search className="w-5 h-5" />}
            placeholder="Search library items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loading || loadingData}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              value={unitFilter}
              onChange={setUnitFilter}
              options={unitOptions}
              disabled={loading || loadingData}
            />

            <Select
              value={activeFilter}
              onChange={(value) => setActiveFilter(value as any)}
              options={activeOptions}
              disabled={loading || loadingData}
            />

            <Select
              value={sortBy}
              onChange={(value) => setSortBy(value as any)}
              options={sortOptions}
              disabled={loading || loadingData}
            />
          </div>
        </div>

        {/* Loading State */}
        {loadingData && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
          </div>
        )}

        {/* Empty State */}
        {!loadingData && items.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No items found
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Create library items to reuse them in quotes'}
            </p>
          </div>
        )}

        {/* Desktop Table View */}
        {!loadingData && items.length > 0 && (
          <div className="hidden md:block overflow-x-auto max-h-[400px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-3 px-2 w-12">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleToggleAll}
                      disabled={loading}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Title
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Unit
                  </th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Usage
                  </th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Cost/Unit
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      selectedItemIds.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                    onClick={() => !loading && handleToggleItem(item.id)}
                  >
                    <td className="py-3 px-2">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => handleToggleItem(item.id)}
                        disabled={loading}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                      {item.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate max-w-xs">
                          {item.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                      {item.unit_measurement?.abbreviation || 'N/A'}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">
                      {item.usage_count}
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatMoney(
                        item.total_cost_per_unit ||
                        (item.material_cost_per_unit || 0) +
                        (item.labor_cost_per_unit || 0) +
                        (item.equipment_cost_per_unit || 0) +
                        (item.subcontract_cost_per_unit || 0) +
                        (item.other_cost_per_unit || 0)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Card View */}
        {!loadingData && items.length > 0 && (
          <div className="md:hidden space-y-3 max-h-[400px] overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => !loading && handleToggleItem(item.id)}
                className={`p-4 border rounded-lg cursor-pointer ${
                  selectedItemIds.has(item.id)
                    ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.has(item.id)}
                    onChange={() => handleToggleItem(item.id)}
                    disabled={loading}
                    className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</h4>
                    {item.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.description}</p>
                    )}
                    <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ModalContent>

      <ModalActions>
        <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleAdd}
          disabled={selectedItemIds.size === 0 || loading}
          loading={loading}
        >
          Add {selectedItemIds.size > 0 ? `${selectedItemIds.size} ` : ''}
          {selectedItemIds.size === 1 ? 'Item' : 'Items'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
