'use client';

import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import type { LineItem, CreateLineItemDto } from '@/lib/types/financial';

/** Local line item shape used inside the form before the entry is saved */
export interface LocalLineItem {
  /** Only present for items already persisted */
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  unit_of_measure: string;
  notes: string;
  order_index: number;
}

interface LineItemsSectionProps {
  items: LocalLineItem[];
  onChange: (items: LocalLineItem[]) => void;
  disabled?: boolean;
}

const EMPTY_ITEM: Omit<LocalLineItem, 'order_index'> = {
  description: '',
  quantity: 1,
  unit_price: 0,
  total: 0,
  unit_of_measure: '',
  notes: '',
};

export default function LineItemsSection({
  items,
  onChange,
  disabled = false,
}: LineItemsSectionProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<LocalLineItem | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const computeTotal = (qty: number, price: number) =>
    Math.round(qty * price * 100) / 100;

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  // ---- Add new item ----
  const handleAddItem = useCallback(() => {
    const newItem: LocalLineItem = {
      ...EMPTY_ITEM,
      order_index: items.length,
    };
    const updated = [...items, newItem];
    onChange(updated);
    // Immediately start editing the new item
    setEditingIndex(updated.length - 1);
    setEditDraft({ ...newItem });
    setErrors({});
  }, [items, onChange]);

  // ---- Start inline edit ----
  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditDraft({ ...items[index] });
    setErrors({});
  };

  // ---- Validate editing item ----
  const validateDraft = (): boolean => {
    if (!editDraft) return false;
    const newErrors: Record<string, string> = {};
    if (!editDraft.description.trim()) newErrors.description = 'Required';
    if (editDraft.quantity <= 0) newErrors.quantity = 'Must be > 0';
    if (editDraft.unit_price < 0) newErrors.unit_price = 'Must be >= 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---- Confirm edit ----
  const handleConfirmEdit = () => {
    if (!editDraft || editingIndex === null) return;
    if (!validateDraft()) return;

    const updated = [...items];
    const total = computeTotal(editDraft.quantity, editDraft.unit_price);
    updated[editingIndex] = { ...editDraft, total };
    onChange(updated);
    setEditingIndex(null);
    setEditDraft(null);
    setErrors({});
  };

  // ---- Cancel edit (removes the item if it was a blank new add) ----
  const handleCancelEdit = () => {
    if (editingIndex !== null && editDraft) {
      // If item was blank (just added), remove it
      const item = items[editingIndex];
      if (!item.description && item.unit_price === 0 && !item.id) {
        const updated = items.filter((_, i) => i !== editingIndex);
        onChange(updated);
      }
    }
    setEditingIndex(null);
    setEditDraft(null);
    setErrors({});
  };

  // ---- Remove item ----
  const handleRemoveItem = (index: number) => {
    const updated = items
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, order_index: i }));
    onChange(updated);
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditDraft(null);
    } else if (editingIndex !== null && editingIndex > index) {
      // Shift editing index down since an item before it was removed
      setEditingIndex(editingIndex - 1);
    }
  };

  // ---- Render an item row in view mode ----
  const renderViewRow = (item: LocalLineItem, index: number) => (
    <div
      key={`item-${index}`}
      className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {item.description}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {item.quantity} {item.unit_of_measure || 'x'} @ ${item.unit_price.toFixed(2)} = ${item.total.toFixed(2)}
        </p>
      </div>
      {!disabled && (
        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => handleStartEdit(index)}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={`Edit ${item.description}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleRemoveItem(index)}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={`Remove ${item.description}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  // ---- Render an item row in edit mode ----
  const renderEditRow = (index: number) => {
    if (!editDraft) return null;
    return (
      <div
        key={`item-edit-${index}`}
        className="p-3 border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Input
              label="Description"
              required
              value={editDraft.description}
              onChange={(e) =>
                setEditDraft({ ...editDraft, description: e.target.value })
              }
              placeholder="e.g., 2x4 lumber"
              error={errors.description}
              maxLength={500}
            />
          </div>
          <div>
            <Input
              label="Quantity"
              required
              type="number"
              step="0.01"
              min="0.01"
              value={editDraft.quantity || ''}
              onChange={(e) => {
                const qty = parseFloat(e.target.value) || 0;
                setEditDraft({ ...editDraft, quantity: qty });
              }}
              error={errors.quantity}
            />
          </div>
          <div>
            <MoneyInput
              label="Unit Price"
              required
              value={editDraft.unit_price}
              onChange={(val) => setEditDraft({ ...editDraft, unit_price: val })}
              error={errors.unit_price}
            />
          </div>
          <div>
            <Input
              label="Unit (optional)"
              value={editDraft.unit_of_measure}
              onChange={(e) =>
                setEditDraft({ ...editDraft, unit_of_measure: e.target.value })
              }
              placeholder="e.g., each, ton, box"
              maxLength={50}
            />
          </div>
          <div className="flex items-end">
            <div className="w-full">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Item Total
              </label>
              <p className="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white font-medium border-2 border-gray-200 dark:border-gray-600">
                ${computeTotal(editDraft.quantity, editDraft.unit_price).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancelEdit}
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmEdit}
          >
            <Check className="w-4 h-4 mr-1" />
            Save Item
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          Line Items
        </label>
        {items.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Subtotal: <span className="font-medium text-gray-900 dark:text-white">${subtotal.toFixed(2)}</span>
          </span>
        )}
      </div>

      {items.length === 0 && editingIndex === null ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddItem}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Item
        </Button>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) =>
            editingIndex === index
              ? renderEditRow(index)
              : renderViewRow(item, index)
          )}

          {/* + button after the last item to add more */}
          {editingIndex === null && !disabled && (
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add another item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Convert API LineItem[] to LocalLineItem[] */
export function apiLineItemsToLocal(items: LineItem[]): LocalLineItem[] {
  return items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: parseFloat(item.quantity),
    unit_price: parseFloat(item.unit_price),
    total: parseFloat(item.total),
    unit_of_measure: item.unit_of_measure || '',
    notes: item.notes || '',
    order_index: item.order_index,
  }));
}

/** Convert LocalLineItem to CreateLineItemDto */
export function localItemToCreateDto(item: LocalLineItem): CreateLineItemDto {
  return {
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    unit_of_measure: item.unit_of_measure || undefined,
    order_index: item.order_index,
    notes: item.notes || undefined,
  };
}
