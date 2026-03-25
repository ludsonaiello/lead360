'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { createProjectFromQuote, getProjectTemplates, formatCurrency } from '@/lib/api/projects';
import type { CreateProjectFromQuoteDto } from '@/lib/types/projects';
import toast from 'react-hot-toast';

interface CreateProjectFromQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (projectId: string) => void;
  quoteId: string;
  quoteName: string;
  quoteTotal: number;
  quoteNumber: string;
}

export default function CreateProjectFromQuoteModal({
  isOpen, onClose, onSuccess, quoteId, quoteName, quoteTotal, quoteNumber,
}: CreateProjectFromQuoteModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CreateProjectFromQuoteDto>({
    name: quoteName,
    description: '',
    start_date: '',
    target_completion_date: '',
    permit_required: false,
    notes: '',
    template_id: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      getProjectTemplates()
        .then((res) => setTemplates(res.data || []))
        .catch(() => setTemplates([]));
    }
  }, [isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (form.name && form.name.length > 200) {
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
      const dto: CreateProjectFromQuoteDto = {};
      if (form.name?.trim()) dto.name = form.name.trim();
      if (form.description?.trim()) dto.description = form.description.trim();
      if (form.start_date) dto.start_date = form.start_date;
      if (form.target_completion_date) dto.target_completion_date = form.target_completion_date;
      if (form.permit_required) dto.permit_required = true;
      if (form.template_id) dto.template_id = form.template_id;
      if (form.notes?.trim()) dto.notes = form.notes.trim();

      const project = await createProjectFromQuote(quoteId, dto);
      toast.success('Project created successfully');
      onSuccess(project.id);
      handleClose();
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 409) {
        toast.error('A project already exists for this quote');
      } else if (error.status === 400) {
        toast.error(error.message || 'Quote must be approved before creating a project');
      } else {
        toast.error(error.message || 'Failed to create project');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({
      name: quoteName,
      description: '',
      start_date: '',
      target_completion_date: '',
      permit_required: false,
      notes: '',
      template_id: '',
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Create Project from ${quoteNumber}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Name"
          placeholder="Defaults to quote title if left empty"
          value={form.name || ''}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
        />

        {/* Contract Value — READ-ONLY display, not an input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Contract Value
          </label>
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-900 dark:text-gray-100">
            {formatCurrency(quoteTotal)}
          </div>
        </div>

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

        <ToggleSwitch
          label="Permit Required"
          enabled={form.permit_required || false}
          onChange={(enabled) => setForm({ ...form, permit_required: enabled })}
        />

        {/* Template Dropdown — optional */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project Template (optional)
          </label>
          <select
            value={form.template_id || ''}
            onChange={(e) => setForm({ ...form, template_id: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

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
