/**
 * BundleForm Component
 * Form for creating/editing bundles (collections of library items)
 * Full page form with library item selection and quantity
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { ArrowLeft, Save, Plus, Trash2, Search } from 'lucide-react';
import { getLibraryItems } from '@/lib/api/library-items';
import { formatMoney } from '@/lib/api/quotes';
import type {
  Bundle,
  LibraryItem,
  CreateBundleDto,
  UpdateBundleWithItemsDto,
} from '@/lib/types/quotes';

interface BundleFormProps {
  bundle?: Bundle; // undefined = create, defined = edit
  onSubmit: (data: CreateBundleDto | UpdateBundleWithItemsDto) => Promise<void>;
  loading?: boolean;
}

interface BundleItemForm {
  library_item_id: string;
  library_item?: LibraryItem; // For display
  quantity: number;
}

export function BundleForm({ bundle, onSubmit, loading = false }: BundleFormProps) {
  const router = useRouter();
  const isEdit = !!bundle;

  // Form state
  const [name, setName] = useState(bundle?.name || '');
  const [description, setDescription] = useState(bundle?.description || '');
  const [bundleItems, setBundleItems] = useState<BundleItemForm[]>([]);

  // Library selection modal
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize bundle items from existing bundle
  useEffect(() => {
    if (bundle && bundle.items) {
      const formItems: BundleItemForm[] = bundle.items.map((item) => {
        // Calculate total cost per unit from individual cost fields
        const totalCostPerUnit =
          parseFloat(item.material_cost_per_unit || '0') +
          parseFloat(item.labor_cost_per_unit || '0') +
          parseFloat(item.equipment_cost_per_unit || '0') +
          parseFloat(item.subcontract_cost_per_unit || '0') +
          parseFloat(item.other_cost_per_unit || '0');

        return {
          library_item_id: item.item_library_id,
          library_item: {
            id: item.item_library_id,
            title: item.title,
            description: item.description,
            total_cost_per_unit: totalCostPerUnit,
            unit_measurement: item.unit_measurement,
          } as any, // Simplified for display purposes
          quantity: parseFloat(item.quantity),
        };
      });
      setBundleItems(formItems);
    }
  }, [bundle]);

  // Load library items for selection
  const loadLibraryItems = async () => {
    try {
      setLibraryLoading(true);
      const data = await getLibraryItems({
        is_active: true,
        limit: 100,
        page: 1,
      });
      setLibraryItems(data.data);
    } catch (err: any) {
      console.error('Failed to load library items:', err);
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleAddItemClick = () => {
    loadLibraryItems();
    setLibraryModalOpen(true);
  };

  const handleSelectLibraryItem = (item: LibraryItem) => {
    // Check if item already exists in bundle
    const exists = bundleItems.some((bi) => bi.library_item_id === item.id);
    if (exists) {
      alert('This item is already in the bundle');
      return;
    }

    setBundleItems([
      ...bundleItems,
      {
        library_item_id: item.id,
        library_item: item,
        quantity: 1,
      },
    ]);
    setLibraryModalOpen(false);
    setSearchQuery('');
  };

  const handleRemoveItem = (index: number) => {
    setBundleItems(bundleItems.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, quantity: string) => {
    const num = parseFloat(quantity);
    if (isNaN(num) || num <= 0) return;

    const newItems = [...bundleItems];
    newItems[index].quantity = num;
    setBundleItems(newItems);
  };

  // Calculate total
  const totalCost = bundleItems.reduce((sum, item) => {
    if (item.library_item) {
      return sum + item.library_item.total_cost_per_unit * item.quantity;
    }
    return sum;
  }, 0);

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Bundle name is required';
    } else if (name.length > 200) {
      newErrors.name = 'Bundle name must be 200 characters or less';
    }

    if (description.length > 1000) {
      newErrors.description = 'Description must be 1000 characters or less';
    }

    if (bundleItems.length === 0) {
      newErrors.items = 'Bundle must contain at least one item';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const formData: CreateBundleDto | UpdateBundleWithItemsDto = {
      name: name.trim(),
      description: description.trim() || undefined,
      items: bundleItems.map((item) => ({
        library_item_id: item.library_item_id,
        quantity: item.quantity,
      })),
    };

    try {
      await onSubmit(formData);
    } catch (err) {
      // Error handled by parent
    }
  };

  // Filter library items by search
  const filteredLibraryItems = searchQuery
    ? libraryItems.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description &&
            item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : libraryItems;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Edit Bundle' : 'Create Bundle'}
          </h1>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            <Save className="w-4 h-4" />
            {isEdit ? 'Save Changes' : 'Create Bundle'}
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Basic Information
        </h2>
        <div className="space-y-4">
          <Input
            label="Bundle Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="e.g., Complete Kitchen Remodel, Basic Bathroom Package"
            required
            disabled={loading}
            autoFocus
          />

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Brief description of this bundle"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
            {errors.description && (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                {errors.description}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Bundle Items */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Bundle Items</h2>
          <Button type="button" variant="secondary" onClick={handleAddItemClick} disabled={loading}>
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
        </div>

        {errors.items && (
          <p className="mb-4 text-sm font-medium text-red-600 dark:text-red-400">{errors.items}</p>
        )}

        {bundleItems.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No items in bundle yet. Add library items to get started.
            </p>
            <Button type="button" variant="secondary" onClick={handleAddItemClick} disabled={loading}>
              <Plus className="w-4 h-4" />
              Add First Item
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {bundleItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {item.library_item?.title || 'Unknown Item'}
                  </p>
                  {item.library_item?.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {item.library_item.description}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {formatMoney(item.library_item?.total_cost_per_unit || 0)} per{' '}
                    {item.library_item?.unit_measurement?.abbreviation || 'unit'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-24">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.quantity.toString()}
                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="w-28 text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                    <p className="font-bold text-blue-600 dark:text-blue-400">
                      {formatMoney((item.library_item?.total_cost_per_unit || 0) * item.quantity)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(index)}
                    disabled={loading}
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border-2 border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Bundle Total ({bundleItems.length} {bundleItems.length === 1 ? 'item' : 'items'})
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatMoney(totalCost)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Library Item Selection Modal */}
      <Modal
        isOpen={libraryModalOpen}
        onClose={() => {
          setLibraryModalOpen(false);
          setSearchQuery('');
        }}
        title="Select Library Item"
        size="lg"
      >
        <ModalContent>
          <div className="space-y-4">
            <Input
              leftIcon={<Search className="w-5 h-5" />}
              placeholder="Search library items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {libraryLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
              </div>
            ) : filteredLibraryItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">
                  {searchQuery ? 'No items match your search' : 'No library items available'}
                </p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {filteredLibraryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectLibraryItem(item)}
                    className="w-full p-4 text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                  >
                    <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                    {item.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {item.description}
                      </p>
                    )}
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                      {formatMoney(item.total_cost_per_unit)} per{' '}
                      {item.unit_measurement?.abbreviation}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setLibraryModalOpen(false);
              setSearchQuery('');
            }}
          >
            Cancel
          </Button>
        </ModalActions>
      </Modal>
    </form>
  );
}
