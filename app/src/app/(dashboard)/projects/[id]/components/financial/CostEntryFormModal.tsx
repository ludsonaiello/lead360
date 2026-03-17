'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import toast from 'react-hot-toast';
import {
  getFinancialCategories,
  createFinancialEntry,
  updateFinancialEntry,
} from '@/lib/api/financial';
import { getProjectTasks } from '@/lib/api/projects';
import type { FinancialCategory, FinancialEntry } from '@/lib/types/financial';
import type { ProjectTask } from '@/lib/types/projects';

interface CostEntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  entry?: FinancialEntry | null;
}

export default function CostEntryFormModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  entry,
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
    entry_date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      setForm({
        category_id: entry.category_id,
        task_id: entry.task_id || '',
        amount: typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount,
        entry_date: entry.entry_date.split('T')[0],
        vendor_name: entry.vendor_name || '',
        notes: entry.notes || '',
      });
    } else {
      setForm({
        category_id: '',
        task_id: '',
        amount: 0,
        entry_date: new Date().toISOString().split('T')[0],
        vendor_name: '',
        notes: '',
      });
    }
    setErrors({});
  }, [entry, isOpen]);

  const today = new Date().toISOString().split('T')[0];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.category_id) newErrors.category_id = 'Category is required';
    if (!form.amount || form.amount <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (!form.entry_date) newErrors.entry_date = 'Date is required';
    if (form.entry_date > today) newErrors.entry_date = 'Date cannot be in the future';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isEdit && entry) {
        await updateFinancialEntry(entry.id, {
          category_id: form.category_id,
          task_id: form.task_id || null,
          amount: form.amount,
          entry_date: form.entry_date,
          vendor_name: form.vendor_name || undefined,
          notes: form.notes || undefined,
        });
        toast.success('Cost entry updated');
      } else {
        await createFinancialEntry({
          project_id: projectId,
          category_id: form.category_id,
          task_id: form.task_id || null,
          amount: form.amount,
          entry_date: form.entry_date,
          vendor_name: form.vendor_name || undefined,
          notes: form.notes || undefined,
        });
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

  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: `${cat.name} (${cat.type})`,
  }));

  const taskOptions = [
    { value: '', label: 'No task (project-level)' },
    ...tasks.map((t) => ({ value: t.id, label: t.title })),
  ];

  return (
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

        <MoneyInput
          label="Amount"
          required
          value={form.amount}
          onChange={(val) => setForm({ ...form, amount: val })}
          error={errors.amount}
        />

        <DatePicker
          label="Date"
          required
          value={form.entry_date}
          onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
          max={today}
          error={errors.entry_date}
        />

        <Select
          label="Task (optional)"
          searchable
          options={taskOptions}
          value={form.task_id}
          onChange={(val) => setForm({ ...form, task_id: val })}
          disabled={loadingData}
          placeholder={loadingData ? 'Loading tasks...' : 'Select a task (optional)'}
        />

        <Input
          label="Vendor Name"
          value={form.vendor_name}
          onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
          placeholder="e.g., Home Depot"
          maxLength={200}
        />

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
  );
}
