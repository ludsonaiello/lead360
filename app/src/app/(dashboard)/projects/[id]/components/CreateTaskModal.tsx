'use client';

import React, { useState } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { createProjectTask } from '@/lib/api/projects';
import type { CreateTaskDto, TaskCategory } from '@/lib/types/projects';
import toast from 'react-hot-toast';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  nextOrderIndex: number;
  onSuccess: () => void;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  projectId,
  nextOrderIndex,
  onSuccess,
}: CreateTaskModalProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    estimated_duration_days: '',
    estimated_start_date: '',
    estimated_end_date: '',
    category: '' as string,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = [
    { value: '', label: 'Select category' },
    { value: 'labor', label: 'Labor' },
    { value: 'material', label: 'Material' },
    { value: 'subcontractor', label: 'Subcontractor' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'other', label: 'Other' },
  ];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) newErrors.title = 'Title is required';
    if (form.title.length > 200) newErrors.title = 'Title must be 200 characters or less';
    if (form.estimated_duration_days && (isNaN(Number(form.estimated_duration_days)) || Number(form.estimated_duration_days) <= 0)) {
      newErrors.estimated_duration_days = 'Must be a positive number';
    }
    if (form.estimated_start_date && form.estimated_end_date) {
      if (new Date(form.estimated_end_date) < new Date(form.estimated_start_date)) {
        newErrors.estimated_end_date = 'End date must be after start date';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const dto: CreateTaskDto = {
        title: form.title.trim(),
        order_index: nextOrderIndex,
      };
      if (form.description.trim()) dto.description = form.description.trim();
      if (form.estimated_duration_days) dto.estimated_duration_days = Number(form.estimated_duration_days);
      if (form.estimated_start_date) dto.estimated_start_date = form.estimated_start_date;
      if (form.estimated_end_date) dto.estimated_end_date = form.estimated_end_date;
      if (form.category) dto.category = form.category as TaskCategory;
      if (form.notes.trim()) dto.notes = form.notes.trim();

      await createProjectTask(projectId, dto);
      toast.success('Task created');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Task" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          error={errors.title}
          placeholder="e.g., Foundation Pour"
          maxLength={200}
        />

        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Describe the task..."
          rows={3}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePicker
            label="Start Date"
            value={form.estimated_start_date}
            onChange={(e) => setForm((f) => ({ ...f, estimated_start_date: e.target.value }))}
          />
          <DatePicker
            label="End Date"
            value={form.estimated_end_date}
            onChange={(e) => setForm((f) => ({ ...f, estimated_end_date: e.target.value }))}
            error={errors.estimated_end_date}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Duration (days)"
            type="number"
            min={1}
            value={form.estimated_duration_days}
            onChange={(e) => setForm((f) => ({ ...f, estimated_duration_days: e.target.value }))}
            error={errors.estimated_duration_days}
            placeholder="e.g., 3"
          />
          <Select
            label="Category"
            options={categoryOptions}
            value={form.category}
            onChange={(val) => setForm((f) => ({ ...f, category: val }))}
          />
        </div>

        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Internal notes..."
          rows={2}
        />

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create Task
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
