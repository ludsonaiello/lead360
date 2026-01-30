/**
 * ItemsList Component
 * Displays quote items in table (desktop) or card (mobile) format
 * Supports drag-and-drop reordering, cost breakdown expansion
 */

'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/lib/api/quotes';
import { updateQuoteItem } from '@/lib/api/quote-items';
import {
  Edit,
  Copy,
  Trash2,
  FolderInput,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Check,
  X,
} from 'lucide-react';
import type { QuoteItem } from '@/lib/types/quotes';
import toast from 'react-hot-toast';

interface ItemsListProps {
  items: QuoteItem[];
  quoteId: string;
  onEdit: (item: QuoteItem) => void;
  onDelete: (item: QuoteItem) => void;
  onDuplicate: (item: QuoteItem) => void;
  onMoveToGroup?: (item: QuoteItem) => void;
  onReorder?: (items: QuoteItem[]) => void;
  onItemUpdate?: () => void; // Callback to refresh quote totals
  showGroupActions?: boolean;
  readOnly?: boolean;
}

export function ItemsList({
  items,
  quoteId,
  onEdit,
  onDelete,
  onDuplicate,
  onMoveToGroup,
  onReorder,
  onItemUpdate,
  showGroupActions = false,
  readOnly = false,
}: ItemsListProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [localItems, setLocalItems] = useState(items);

  // Inline editing state
  const [editingField, setEditingField] = useState<{ itemId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Helper function to calculate total cost per unit if API doesn't provide it
  const calculateTotalCostPerUnit = (item: QuoteItem): number => {
    // If API already calculated it and it's not 0, use it
    if (item.total_cost_per_unit && item.total_cost_per_unit > 0) {
      return item.total_cost_per_unit;
    }

    // Otherwise, calculate from individual components
    return (
      (item.material_cost_per_unit || 0) +
      (item.labor_cost_per_unit || 0) +
      (item.equipment_cost_per_unit || 0) +
      (item.subcontract_cost_per_unit || 0) +
      (item.other_cost_per_unit || 0)
    );
  };

  // Update local items when props change
  React.useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localItems.findIndex((item) => item.id === active.id);
      const newIndex = localItems.findIndex((item) => item.id === over.id);

      const reorderedItems = arrayMove(localItems, oldIndex, newIndex);
      setLocalItems(reorderedItems);

      if (onReorder) {
        onReorder(reorderedItems);
      }
    }
  };

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Inline editing functions
  const startEdit = (itemId: string, field: string, currentValue: number) => {
    setEditingField({ itemId, field });
    setEditValue(currentValue.toString());
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async (item: QuoteItem) => {
    if (!editingField) return;

    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue < 0) {
      toast.error('Please enter a valid number');
      return;
    }

    setIsSaving(true);
    try {
      const updateData: any = {};

      // Map field to DTO property
      if (editingField.field === 'quantity') {
        updateData.quantity = newValue;
      } else if (editingField.field === 'material') {
        updateData.material_cost_per_unit = newValue;
      } else if (editingField.field === 'labor') {
        updateData.labor_cost_per_unit = newValue;
      } else if (editingField.field === 'equipment') {
        updateData.equipment_cost_per_unit = newValue;
      } else if (editingField.field === 'subcontract') {
        updateData.subcontract_cost_per_unit = newValue;
      } else if (editingField.field === 'other') {
        updateData.other_cost_per_unit = newValue;
      }

      await updateQuoteItem(quoteId, item.id, updateData);

      // Update local state
      const updatedItems = localItems.map((i) =>
        i.id === item.id ? { ...i, ...updateData } : i
      );
      setLocalItems(updatedItems);

      toast.success('Item updated successfully');
      setEditingField(null);
      setEditValue('');

      // Callback to refresh quote totals
      if (onItemUpdate) {
        onItemUpdate();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    } finally {
      setIsSaving(false);
    }
  };

  // Component for sortable table row
  const SortableRow = ({ item }: { item: QuoteItem }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <React.Fragment>
        <tr
          ref={setNodeRef}
          style={style}
          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          {/* Drag Handle */}
          {onReorder && !readOnly && (
            <td className="py-3 px-2 w-8">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <GripVertical className="w-4 h-4" />
              </div>
            </td>
          )}
          <td className="py-3 px-2">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {item.title}
              </p>
              {item.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {item.description}
                </p>
              )}
              <button
                onClick={() => toggleExpanded(item.id)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 flex items-center gap-1"
              >
                {expandedItems.has(item.id) ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Hide breakdown
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show cost breakdown
                  </>
                )}
              </button>
            </div>
          </td>
          <td className="py-3 px-2 text-right">
            {editingField?.itemId === item.id && editingField.field === 'quantity' ? (
              <div className="flex items-center justify-end gap-1">
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(item);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  disabled={isSaving}
                  autoFocus
                  className="w-20 px-2 py-1 text-sm text-right border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  step="0.01"
                  min="0"
                />
                <button
                  onClick={() => saveEdit(item)}
                  disabled={isSaving}
                  className="text-green-600 dark:text-green-400 hover:text-green-700 p-1"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={isSaving}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => !readOnly && startEdit(item.id, 'quantity', item.quantity)}
                disabled={readOnly}
                className={`text-gray-900 dark:text-gray-100 ${!readOnly ? 'hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer' : ''}`}
              >
                {item.quantity}
              </button>
            )}
          </td>
          <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
            {item.unit_measurement?.abbreviation || 'N/A'}
          </td>
          <td className="py-3 px-2 text-right font-medium text-gray-900 dark:text-gray-100">
            {formatMoney(calculateTotalCostPerUnit(item))}
          </td>
          <td className="py-3 px-2 text-right font-bold text-blue-600 dark:text-blue-400">
            {formatMoney(item.total_cost || 0)}
          </td>
          <td className="py-3 px-2">
            {!readOnly && (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(item)}
                  title="Edit item"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDuplicate(item)}
                  title="Duplicate item"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                {showGroupActions && onMoveToGroup && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMoveToGroup(item)}
                    title="Move to group"
                  >
                    <FolderInput className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(item)}
                  title="Delete item"
                >
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </Button>
              </div>
            )}
          </td>
        </tr>
        {/* Cost Breakdown Row */}
        {expandedItems.has(item.id) && (
          <tr className="bg-blue-50 dark:bg-blue-900/10">
            <td colSpan={onReorder ? 7 : 6} className="py-3 px-4">
              <div className="grid grid-cols-5 gap-4 text-sm">
                {/* Material Cost */}
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    Material
                  </p>
                  {editingField?.itemId === item.id && editingField.field === 'material' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(item);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        disabled={isSaving}
                        autoFocus
                        className="w-24 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        step="0.01"
                        min="0"
                      />
                      <button onClick={() => saveEdit(item)} disabled={isSaving} className="text-green-600 dark:text-green-400 p-1">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={cancelEdit} disabled={isSaving} className="text-red-600 dark:text-red-400 p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => !readOnly && startEdit(item.id, 'material', item.material_cost_per_unit || 0)}
                      disabled={readOnly}
                      className={`font-medium text-gray-900 dark:text-gray-100 ${!readOnly ? 'hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer' : ''}`}
                    >
                      {formatMoney(item.material_cost_per_unit)}
                    </button>
                  )}
                </div>

                {/* Labor Cost */}
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    Labor
                  </p>
                  {editingField?.itemId === item.id && editingField.field === 'labor' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(item);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        disabled={isSaving}
                        autoFocus
                        className="w-24 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        step="0.01"
                        min="0"
                      />
                      <button onClick={() => saveEdit(item)} disabled={isSaving} className="text-green-600 dark:text-green-400 p-1">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={cancelEdit} disabled={isSaving} className="text-red-600 dark:text-red-400 p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => !readOnly && startEdit(item.id, 'labor', item.labor_cost_per_unit || 0)}
                      disabled={readOnly}
                      className={`font-medium text-gray-900 dark:text-gray-100 ${!readOnly ? 'hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer' : ''}`}
                    >
                      {formatMoney(item.labor_cost_per_unit)}
                    </button>
                  )}
                </div>

                {/* Equipment Cost */}
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    Equipment
                  </p>
                  {editingField?.itemId === item.id && editingField.field === 'equipment' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(item);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        disabled={isSaving}
                        autoFocus
                        className="w-24 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        step="0.01"
                        min="0"
                      />
                      <button onClick={() => saveEdit(item)} disabled={isSaving} className="text-green-600 dark:text-green-400 p-1">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={cancelEdit} disabled={isSaving} className="text-red-600 dark:text-red-400 p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => !readOnly && startEdit(item.id, 'equipment', item.equipment_cost_per_unit || 0)}
                      disabled={readOnly}
                      className={`font-medium text-gray-900 dark:text-gray-100 ${!readOnly ? 'hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer' : ''}`}
                    >
                      {formatMoney(item.equipment_cost_per_unit)}
                    </button>
                  )}
                </div>

                {/* Subcontract Cost */}
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    Subcontract
                  </p>
                  {editingField?.itemId === item.id && editingField.field === 'subcontract' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(item);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        disabled={isSaving}
                        autoFocus
                        className="w-24 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        step="0.01"
                        min="0"
                      />
                      <button onClick={() => saveEdit(item)} disabled={isSaving} className="text-green-600 dark:text-green-400 p-1">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={cancelEdit} disabled={isSaving} className="text-red-600 dark:text-red-400 p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => !readOnly && startEdit(item.id, 'subcontract', item.subcontract_cost_per_unit || 0)}
                      disabled={readOnly}
                      className={`font-medium text-gray-900 dark:text-gray-100 ${!readOnly ? 'hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer' : ''}`}
                    >
                      {formatMoney(item.subcontract_cost_per_unit)}
                    </button>
                  )}
                </div>

                {/* Other Cost */}
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    Other
                  </p>
                  {editingField?.itemId === item.id && editingField.field === 'other' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(item);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        disabled={isSaving}
                        autoFocus
                        className="w-24 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        step="0.01"
                        min="0"
                      />
                      <button onClick={() => saveEdit(item)} disabled={isSaving} className="text-green-600 dark:text-green-400 p-1">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={cancelEdit} disabled={isSaving} className="text-red-600 dark:text-red-400 p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => !readOnly && startEdit(item.id, 'other', item.other_cost_per_unit || 0)}
                      disabled={readOnly}
                      className={`font-medium text-gray-900 dark:text-gray-100 ${!readOnly ? 'hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer' : ''}`}
                    >
                      {formatMoney(item.other_cost_per_unit)}
                    </button>
                  )}
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  if (localItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No items yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {onReorder && !readOnly && (
                  <th className="w-8 py-3 px-2"></th>
                )}
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Title
                </th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Qty
                </th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Unit
                </th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Cost/Unit
                </th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Total
                </th>
                {!readOnly && (
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <SortableContext
              items={localItems.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {localItems.map((item) => (
                  <SortableRow key={item.id} item={item} />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {localItems.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {item.title}
                </h4>
                {item.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {item.description}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">Quantity</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {item.quantity} {item.unit_measurement?.abbreviation}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Cost/Unit</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {formatMoney(calculateTotalCostPerUnit(item))}
                </p>
              </div>
            </div>
            <div className="mb-3 text-sm">
              <p className="text-gray-600 dark:text-gray-400">Total</p>
              <p className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                {formatMoney(item.total_cost || 0)}
              </p>
            </div>

            <button
              onClick={() => toggleExpanded(item.id)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-3 flex items-center gap-1"
            >
              {expandedItems.has(item.id) ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Hide breakdown
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show cost breakdown
                </>
              )}
            </button>

            {expandedItems.has(item.id) && (
              <div className="bg-blue-50 dark:bg-blue-900/10 rounded p-3 mb-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Material:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatMoney(item.material_cost_per_unit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Labor:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatMoney(item.labor_cost_per_unit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Equipment:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatMoney(item.equipment_cost_per_unit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Subcontract:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatMoney(item.subcontract_cost_per_unit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Other:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatMoney(item.other_cost_per_unit)}
                  </span>
                </div>
              </div>
            )}

            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(item)}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDuplicate(item)}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Duplicate
                </Button>
                {showGroupActions && onMoveToGroup && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMoveToGroup(item)}
                  >
                    <FolderInput className="w-4 h-4 mr-1" />
                    Move
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(item)}
                >
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
