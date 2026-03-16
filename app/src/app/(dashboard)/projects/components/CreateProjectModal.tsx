'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { createProject } from '@/lib/api/projects';
import type { CreateProjectDto } from '@/lib/types/projects';
import toast from 'react-hot-toast';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CreateProjectDto>({
    name: '',
    description: '',
    start_date: '',
    target_completion_date: '',
    permit_required: false,
    estimated_cost: undefined,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (form.name.length > 200) {
      newErrors.name = 'Project name must be 200 characters or less';
    }
    if (form.start_date && form.target_completion_date && form.start_date > form.target_completion_date) {
      newErrors.target_completion_date = 'Target date must be after start date';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const dto: CreateProjectDto = {
        name: form.name.trim(),
      };
      if (form.description?.trim()) dto.description = form.description.trim();
      if (form.start_date) dto.start_date = form.start_date;
      if (form.target_completion_date) dto.target_completion_date = form.target_completion_date;
      if (form.permit_required) dto.permit_required = true;
      if (form.estimated_cost !== undefined && form.estimated_cost > 0) dto.estimated_cost = form.estimated_cost;
      if (form.notes?.trim()) dto.notes = form.notes.trim();

      await createProject(dto);
      toast.success('Project created successfully');
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({
      name: '',
      description: '',
      start_date: '',
      target_completion_date: '',
      permit_required: false,
      estimated_cost: undefined,
      notes: '',
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Project" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Name"
          placeholder="e.g. Kitchen Remodel - Smith Residence"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          required
        />

        <Textarea
          label="Description"
          placeholder="Brief project description..."
          value={form.description || ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePicker
            label="Start Date"
            value={form.start_date || ''}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
          <DatePicker
            label="Target Completion Date"
            value={form.target_completion_date || ''}
            onChange={(e) => setForm({ ...form, target_completion_date: e.target.value })}
            error={errors.target_completion_date}
          />
        </div>

        <MoneyInput
          label="Estimated Cost"
          value={form.estimated_cost ?? 0}
          onChange={(val) => setForm({ ...form, estimated_cost: val || undefined })}
        />

        <ToggleSwitch
          label="Permit Required"
          enabled={form.permit_required || false}
          onChange={(enabled) => setForm({ ...form, permit_required: enabled })}
        />

        <Textarea
          label="Notes"
          placeholder="Internal notes..."
          value={form.notes || ''}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" type="button" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
}
