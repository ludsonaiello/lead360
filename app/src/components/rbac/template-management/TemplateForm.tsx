'use client';

// ============================================================================
// TemplateForm Component
// ============================================================================
// Form for creating role templates with permission selection.
// ============================================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { FileText, Save, X, AlertCircle } from 'lucide-react';
import type { RoleTemplate, RoleTemplateFormData } from '@/lib/types/rbac';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import PermissionBuilder from '@/components/rbac/role-management/PermissionBuilder';
import * as rbacApi from '@/lib/api/rbac';
import { formatErrorForDisplay } from '@/lib/utils/errors';
import toast from 'react-hot-toast';

// Form validation schema
const templateFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(100, 'Template name must be less than 100 characters'),
  description: z
    .string()
    .max(200, 'Description must be less than 200 characters')
    .optional()
    .nullable(),
});

type TemplateFormSchemaData = z.infer<typeof templateFormSchema>;

interface TemplateFormProps {
  onSuccess?: (template: RoleTemplate) => void;
  onCancel?: () => void;
}

/**
 * TemplateForm - Create role template
 *
 * @param onSuccess - Callback when template is saved
 * @param onCancel - Callback when form is cancelled
 *
 * @example
 * <TemplateForm
 *   onSuccess={(newTemplate) => router.push('/admin/rbac/templates')}
 *   onCancel={() => router.back()}
 * />
 */
export default function TemplateForm({
  onSuccess,
  onCancel,
}: TemplateFormProps) {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TemplateFormSchemaData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  /**
   * Handle form submission
   */
  const onSubmit = async (data: TemplateFormSchemaData) => {
    setSubmitting(true);
    setError(null);

    // Validate at least one permission selected
    if (selectedPermissionIds.length === 0) {
      setError('Please select at least one permission for the template');
      setSubmitting(false);
      return;
    }

    try {
      const formData: RoleTemplateFormData = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        permission_ids: selectedPermissionIds,
      };

      const savedTemplate = await rbacApi.createTemplate(formData);
      toast.success(`Template "${savedTemplate.name}" created successfully`);

      if (onSuccess) {
        onSuccess(savedTemplate);
      } else {
        router.push('/admin/rbac/templates');
      }
    } catch (err) {
      console.error('[TemplateForm] Failed to create template:', err);
      const errorInfo = formatErrorForDisplay(err);
      setError(errorInfo.message);
      toast.error(errorInfo.message);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Create Role Template
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Define a reusable role template with permissions
            </p>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Basic Info */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Template Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              type="text"
              {...register('name')}
              placeholder="e.g., Sales Manager, Support Agent"
              disabled={submitting}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Describe this template..."
              rows={3}
              disabled={submitting}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Permissions */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Permissions
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Select permissions to include in this template
          </p>
        </div>

        <PermissionBuilder
          selectedPermissionIds={selectedPermissionIds}
          onChange={setSelectedPermissionIds}
        />

        {selectedPermissionIds.length === 0 && (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
            Please select at least one permission
          </p>
        )}
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          variant="secondary"
          onClick={handleCancel}
          disabled={submitting}
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || selectedPermissionIds.length === 0}
        >
          {submitting ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Creating...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Create Template
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
