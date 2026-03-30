'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Info } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getFinancialCategories,
  createFinancialEntry,
  createTaskCost,
  updateFinancialEntry,
  createLineItem,
  updateLineItem as apiUpdateLineItem,
  deleteLineItem as apiDeleteLineItem,
} from '@/lib/api/financial';
import { getProjectTasks } from '@/lib/api/projects';
import type { FinancialCategory, FinancialEntry } from '@/lib/types/financial';
import type { ProjectTask } from '@/lib/types/projects';
import LineItemsSection, {
  type LocalLineItem,
  apiLineItemsToLocal,
  localItemToCreateDto,
} from './LineItemsSection';

interface CostEntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  entry?: FinancialEntry | null;
  /** Pre-select task and lock the field (used in task-level financial context) */
  defaultTaskId?: string;
  /** When true, task field is locked and createTaskCost API is used instead of createFinancialEntry */
  taskLocked?: boolean;
}

export default function CostEntryFormModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  entry,
  defaultTaskId,
  taskLocked = false,
}: CostEntryFormModalProps) {
  const isEdit = !!entry;

  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    category_id: '',
    task_id: '',
    amount: 0,
    tax_amount: 0,
    discount: 0,
    entry_date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<LocalLineItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track whether user chose to auto-update total from items
  const [autoUpdateTotal, setAutoUpdateTotal] = useState<boolean | null>(null);
  // For the prompt modal when total already filled
  const [showAutoUpdatePrompt, setShowAutoUpdatePrompt] = useState(false);
  // For mismatch confirm on save
  const [showMismatchConfirm, setShowMismatchConfirm] = useState(false);

  // Track the original line item ids for edit mode (to know what to create/update/delete)
  const [originalItemIds, setOriginalItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingData(true);
    const loadData = async () => {
      try {
        const [catData, taskData] = await Promise.all([
          getFinancialCategories(),
          getProjectTasks(projectId, { limit: 100 }),
        ]);
        if (!cancelled) {
          setCategories(catData);
          setTasks(taskData.data);
        }
      } catch {
        if (!cancelled) toast.error('Failed to load form data');
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [isOpen, projectId]);

  useEffect(() => {
    if (entry) {
      const amt = typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount;
      const tax = entry.tax_amount ? parseFloat(entry.tax_amount) : 0;
      const disc = entry.discount ? parseFloat(entry.discount) : 0;
      setForm({
        category_id: entry.category_id,
        task_id: entry.task_id || '',
        amount: amt,
        tax_amount: tax,
        discount: disc,
        entry_date: entry.entry_date.split('T')[0],
        vendor_name: entry.vendor_name || '',
        notes: entry.notes || '',
      });
      const localItems = apiLineItemsToLocal(entry.line_items || []);
      setLineItems(localItems);
      setOriginalItemIds(new Set(localItems.filter(i => i.id).map(i => i.id!)));
      // If editing and has items, default to auto-update off (preserve existing total)
      setAutoUpdateTotal(localItems.length > 0 ? false : null);
    } else {
      setForm({
        category_id: '',
        task_id: defaultTaskId || '',
        amount: 0,
        tax_amount: 0,
        discount: 0,
        entry_date: new Date().toISOString().split('T')[0],
        vendor_name: '',
        notes: '',
      });
      setLineItems([]);
      setOriginalItemIds(new Set());
      setAutoUpdateTotal(null);
    }
    setErrors({});
    setShowMismatchConfirm(false);
    setShowAutoUpdatePrompt(false);
  }, [entry, isOpen, defaultTaskId]);

  const today = new Date().toISOString().split('T')[0];

  // Compute the expected total from items
  const itemsSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const computedTotal = Math.round((itemsSubtotal + form.tax_amount - form.discount) * 100) / 100;

  // Handle line items change with auto-update logic
  const handleLineItemsChange = useCallback((newItems: LocalLineItem[]) => {
    setLineItems(newItems);

    const newSubtotal = newItems.reduce((sum, item) => sum + item.total, 0);
    const newComputedTotal = Math.round((newSubtotal + form.tax_amount - form.discount) * 100) / 100;

    if (newItems.length > 0 && newSubtotal > 0) {
      if (autoUpdateTotal === null) {
        // First time adding items — check if total was already filled
        if (form.amount > 0) {
          // Total was pre-filled, ask user
          setShowAutoUpdatePrompt(true);
        } else {
          // Total is empty, auto-update
          setAutoUpdateTotal(true);
          setForm(prev => ({ ...prev, amount: Math.max(0, newComputedTotal) }));
        }
      } else if (autoUpdateTotal) {
        // User chose to auto-update
        setForm(prev => ({ ...prev, amount: Math.max(0, newComputedTotal) }));
      }
    }
  }, [autoUpdateTotal, form.tax_amount, form.discount, form.amount]);

  // When tax or discount changes, recalculate if auto-update is on
  useEffect(() => {
    if (autoUpdateTotal && lineItems.length > 0) {
      const sub = lineItems.reduce((sum, item) => sum + item.total, 0);
      const computed = Math.round((sub + form.tax_amount - form.discount) * 100) / 100;
      setForm(prev => {
        if (prev.amount !== Math.max(0, computed)) {
          return { ...prev, amount: Math.max(0, computed) };
        }
        return prev;
      });
    }
  }, [form.tax_amount, form.discount, autoUpdateTotal, lineItems]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.category_id) newErrors.category_id = 'Category is required';
    if (!form.amount || form.amount <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (!form.entry_date) newErrors.entry_date = 'Date is required';
    if (form.entry_date > today) newErrors.entry_date = 'Date cannot be in the future';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      if (isEdit && entry) {
        await updateFinancialEntry(entry.id, {
          category_id: form.category_id,
          amount: form.amount,
          tax_amount: form.tax_amount || undefined,
          discount: form.discount || undefined,
          entry_date: form.entry_date,
          vendor_name: form.vendor_name || undefined,
          notes: form.notes || undefined,
        });

        // Sync line items: delete removed, update existing, create new
        const currentItemIds = new Set(lineItems.filter(i => i.id).map(i => i.id!));
        // Delete items that were removed
        for (const oldId of originalItemIds) {
          if (!currentItemIds.has(oldId)) {
            await apiDeleteLineItem(entry.id, oldId);
          }
        }
        // Update or create items
        for (const item of lineItems) {
          if (item.id && originalItemIds.has(item.id)) {
            await apiUpdateLineItem(entry.id, item.id, {
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              unit_of_measure: item.unit_of_measure || undefined,
              order_index: item.order_index,
              notes: item.notes || undefined,
            });
          } else {
            await createLineItem(entry.id, localItemToCreateDto(item));
          }
        }

        toast.success('Cost entry updated');
      } else {
        const baseDto = {
          category_id: form.category_id,
          amount: form.amount,
          tax_amount: form.tax_amount || undefined,
          discount: form.discount || undefined,
          entry_date: form.entry_date,
          vendor_name: form.vendor_name || undefined,
          notes: form.notes || undefined,
        };

        // Use task-scoped endpoint when locked to a task
        // Task endpoint auto-fills project_id, task_id, and entry_type from URL — do NOT send them
        const savedEntry = taskLocked && defaultTaskId
          ? await createTaskCost(projectId, defaultTaskId, baseDto)
          : await createFinancialEntry({
              ...baseDto,
              entry_type: 'expense',
              project_id: projectId,
              task_id: form.task_id || undefined,
            });

        // Create line items on the new entry
        for (const item of lineItems) {
          if (item.description) {
            await createLineItem(savedEntry.id, localItemToCreateDto(item));
          }
        }

        toast.success('Cost entry created');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || `Failed to ${isEdit ? 'update' : 'create'} cost entry`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Check for total mismatch when line items exist
    const validItems = lineItems.filter(i => i.description && i.total > 0);
    if (validItems.length > 0) {
      const sub = validItems.reduce((sum, item) => sum + item.total, 0);
      const expected = Math.round((sub + form.tax_amount - form.discount) * 100) / 100;
      const diff = Math.abs(form.amount - expected);
      if (diff > 0.01) {
        setShowMismatchConfirm(true);
        return;
      }
    }

    await doSubmit();
  };

  const handleMismatchConfirm = async () => {
    setShowMismatchConfirm(false);
    await doSubmit();
  };

  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: `${cat.name} (${cat.type})`,
  }));

  const taskOptions = [
    { value: '', label: 'No task (project-level)' },
    ...tasks.map((t) => ({ value: t.id, label: t.title })),
  ];

  const validItems = lineItems.filter(i => i.description && i.total > 0);
  const hasMismatch = validItems.length > 0 &&
    Math.abs(form.amount - computedTotal) > 0.01;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Cost Entry' : 'Add Cost Entry'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Category"
            required
            searchable
            options={categoryOptions}
            value={form.category_id}
            onChange={(val) => setForm({ ...form, category_id: val })}
            error={errors.category_id}
            disabled={loadingData}
            placeholder={loadingData ? 'Loading categories...' : 'Select a category'}
          />

          <DatePicker
            label="Date"
            required
            value={form.entry_date}
            onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
            max={today}
            error={errors.entry_date}
          />

          {taskLocked ? (
            <Input
              label="Task"
              value={tasks.find((t) => t.id === form.task_id)?.title || 'Loading...'}
              disabled
              helperText="Task is set from context"
            />
          ) : (
            <Select
              label="Task (optional)"
              searchable
              options={taskOptions}
              value={form.task_id}
              onChange={(val) => setForm({ ...form, task_id: val })}
              disabled={loadingData}
              placeholder={loadingData ? 'Loading tasks...' : 'Select a task (optional)'}
            />
          )}

          <Input
            label="Vendor Name"
            value={form.vendor_name}
            onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
            placeholder="e.g., Home Depot"
            maxLength={200}
          />

          {/* Line Items Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <LineItemsSection
              items={lineItems}
              onChange={handleLineItemsChange}
              disabled={submitting}
            />
          </div>

          {/* Subtotal display when items exist */}
          {validItems.length > 0 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Items Subtotal:</span>
                <span className="font-medium text-gray-900 dark:text-white">${itemsSubtotal.toFixed(2)}</span>
              </div>
              {form.tax_amount > 0 && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-500 dark:text-gray-400">+ Tax:</span>
                  <span className="text-gray-700 dark:text-gray-300">${form.tax_amount.toFixed(2)}</span>
                </div>
              )}
              {form.discount > 0 && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-500 dark:text-gray-400">- Discount:</span>
                  <span className="text-gray-700 dark:text-gray-300">${form.discount.toFixed(2)}</span>
                </div>
              )}
              {(form.tax_amount > 0 || form.discount > 0) && (
                <div className="flex items-center justify-between text-sm mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Computed Total:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">${computedTotal.toFixed(2)}</span>
                </div>
              )}
              {hasMismatch && (
                <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-400">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    The total (${form.amount.toFixed(2)}) does not match the computed total from items (${computedTotal.toFixed(2)}).
                    You can save anyway — the total is the source of truth.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MoneyInput
              label="Amount (Total)"
              required
              value={form.amount}
              onChange={(val) => setForm({ ...form, amount: val })}
              error={errors.amount}
            />
            <MoneyInput
              label="Tax"
              value={form.tax_amount}
              onChange={(val) => setForm({ ...form, tax_amount: val })}
            />
            <MoneyInput
              label="Discount"
              value={form.discount}
              onChange={(val) => setForm({ ...form, discount: val })}
            />
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes about this expense"
            rows={3}
          />

          <ModalActions>
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting}>
              {isEdit ? 'Update' : 'Add Entry'}
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* Prompt: Auto-update total from items? */}
      <ConfirmModal
        isOpen={showAutoUpdatePrompt}
        onClose={() => {
          setShowAutoUpdatePrompt(false);
          setAutoUpdateTotal(false);
        }}
        onConfirm={() => {
          setAutoUpdateTotal(true);
          setShowAutoUpdatePrompt(false);
          // Immediately update total
          const sub = lineItems.reduce((sum, item) => sum + item.total, 0);
          const computed = Math.round((sub + form.tax_amount - form.discount) * 100) / 100;
          setForm(prev => ({ ...prev, amount: Math.max(0, computed) }));
        }}
        title="Update Total?"
        message="The total amount is already filled. Do you want to automatically update it based on item totals + tax - discount?"
        confirmText="Yes, update total"
        cancelText="No, keep current total"
        variant="info"
      />

      {/* Mismatch confirm on save */}
      <ConfirmModal
        isOpen={showMismatchConfirm}
        onClose={() => setShowMismatchConfirm(false)}
        onConfirm={handleMismatchConfirm}
        title="Total Mismatch"
        message={`The entry total ($${form.amount.toFixed(2)}) does not match the computed total from line items ($${computedTotal.toFixed(2)}). Do you want to save anyway? The total is the source of truth — line items are for tracking only.`}
        confirmText="Save Anyway"
        cancelText="Go Back"
        variant="warning"
        loading={submitting}
      />
    </>
  );
}
