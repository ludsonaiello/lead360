'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { updateProject } from '@/lib/api/projects';
import type { Project, UpdateProjectDto } from '@/lib/types/projects';
import toast from 'react-hot-toast';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Project) => void;
  project: Project;
}

export default function EditProjectModal({ isOpen, onClose, onSuccess, project }: EditProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    target_completion_date: '',
    permit_required: false,
    portal_enabled: false,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && project) {
      setForm({
        name: project.name || '',
        description: project.description || '',
        start_date: project.start_date ? project.start_date.split('T')[0] : '',
        target_completion_date: project.target_completion_date ? project.target_completion_date.split('T')[0] : '',
        permit_required: project.permit_required,
        portal_enabled: project.portal_enabled,
        notes: project.notes || '',
      });
    }
  }, [isOpen, project]);

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
      const dto: UpdateProjectDto = {};
      if (form.name.trim() !== project.name) dto.name = form.name.trim();
      if ((form.description || '') !== (project.description || '')) dto.description = form.description;
      if (form.start_date !== (project.start_date ? project.start_date.split('T')[0] : '')) dto.start_date = form.start_date || undefined;
      if (form.target_completion_date !== (project.target_completion_date ? project.target_completion_date.split('T')[0] : '')) dto.target_completion_date = form.target_completion_date || undefined;
      if (form.permit_required !== project.permit_required) dto.permit_required = form.permit_required;
      if (form.portal_enabled !== project.portal_enabled) dto.portal_enabled = form.portal_enabled;
      if ((form.notes || '') !== (project.notes || '')) dto.notes = form.notes;

      if (Object.keys(dto).length === 0) {
        toast.success('No changes to save');
        onClose();
        return;
      }

      const updated = await updateProject(project.id, dto);
      toast.success('Project updated successfully');
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Project" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          required
        />

        <Textarea
          label="Description"
          placeholder="Brief project description..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePicker
            label="Start Date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
          <DatePicker
            label="Target Completion Date"
            value={form.target_completion_date}
            onChange={(e) => setForm({ ...form, target_completion_date: e.target.value })}
            error={errors.target_completion_date}
          />
        </div>

        <ToggleSwitch
          label="Permit Required"
          enabled={form.permit_required}
          onChange={(enabled) => setForm({ ...form, permit_required: enabled })}
        />

        <ToggleSwitch
          label="Portal Enabled"
          enabled={form.portal_enabled}
          onChange={(enabled) => setForm({ ...form, portal_enabled: enabled })}
        />

        <Textarea
          label="Notes"
          placeholder="Internal notes..."
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
