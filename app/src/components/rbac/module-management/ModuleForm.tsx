'use client';

// ============================================================================
// ModuleForm Component
// ============================================================================
// Form for creating or editing modules.
// ============================================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Layers, Save, X, AlertCircle } from 'lucide-react';
import type { Module, ModuleFormData } from '@/lib/types/rbac';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import * as rbacApi from '@/lib/api/rbac';
import { formatErrorForDisplay } from '@/lib/utils/errors';
import toast from 'react-hot-toast';

// Form validation schema
const moduleFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Module name is required')
    .max(50, 'Module name must be less than 50 characters')
    .regex(/^[a-z_]+$/, 'Module name can only contain lowercase letters and underscores'),
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be less than 100 characters'),
  description: z
    .string()
    .max(200, 'Description must be less than 200 characters')
    .optional()
    .nullable(),
  sort_order: z
    .number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be 0 or greater')
    .max(999, 'Sort order must be less than 1000'),
  is_active: z.boolean(),
});

type ModuleFormSchemaData = z.infer<typeof moduleFormSchema>;

interface ModuleFormProps {
  module?: Module; // If editing, pass existing module
  onSuccess?: (module: Module) => void;
  onCancel?: () => void;
}

/**
 * ModuleForm - Create or edit module
 *
 * @param module - Existing module (for edit mode)
 * @param onSuccess - Callback when module is saved
 * @param onCancel - Callback when form is cancelled
 *
 * @example
 * // Create mode
 * <ModuleForm
 *   onSuccess={(newModule) => router.push('/admin/rbac/modules')}
 *   onCancel={() => router.back()}
 * />
 *
 * // Edit mode
 * <ModuleForm
 *   module={existingModule}
 *   onSuccess={(updated) => router.push('/admin/rbac/modules')}
 *   onCancel={() => router.back()}
 * />
 */
export default function ModuleForm({
  module,
  onSuccess,
  onCancel,
}: ModuleFormProps) {
  const router = useRouter();
  const isEditMode = !!module;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ModuleFormSchemaData>({
    resolver: zodResolver(moduleFormSchema),
    defaultValues: {
      name: module?.name || '',
      display_name: module?.display_name || '',
      description: module?.description || '',
      sort_order: module?.sort_order || 0,
      is_active: module?.is_active ?? true,
    },
  });

  const isActive = watch('is_active');

  /**
   * Handle form submission
   */
  const onSubmit = async (data: ModuleFormSchemaData) => {
    setSubmitting(true);
    setError(null);

    try {
      let savedModule: Module;

      if (isEditMode) {
        // Update existing module (cannot change name)
        const updateData: Partial<ModuleFormData> = {
          display_name: data.display_name.trim(),
          description: data.description?.trim() || null,
          sort_order: data.sort_order,
          is_active: data.is_active,
        };
        savedModule = await rbacApi.updateModule(module.id, updateData);
        toast.success(`Module "${savedModule.display_name}" updated successfully`);
      } else {
        // Create new module
        const formData: ModuleFormData = {
          name: data.name.trim().toLowerCase(),
          display_name: data.display_name.trim(),
          description: data.description?.trim() || null,
          sort_order: data.sort_order,
          is_active: data.is_active,
        };
        savedModule = await rbacApi.createModule(formData);
        toast.success(`Module "${savedModule.display_name}" created successfully`);
      }

      if (onSuccess) {
        onSuccess(savedModule);
      } else {
        router.push('/admin/rbac/modules');
      }
    } catch (err) {
      console.error('[ModuleForm] Failed to save module:', err);
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
          <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isEditMode ? 'Edit Module' : 'Create New Module'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isEditMode
                ? 'Update module details'
                : 'Define a new platform feature module'}
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

      {/* Form */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Module Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Module Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              type="text"
              {...register('name')}
              placeholder="e.g., leads, users, voice_ai"
              disabled={submitting || isEditMode}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Use lowercase letters and underscores only (snake_case)
            </p>
            {isEditMode && (
              <p className="mt-1 text-xs text-gray-500">
                Module name cannot be changed for existing modules
              </p>
            )}
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="display_name"
              type="text"
              {...register('display_name')}
              placeholder="e.g., Lead Management, User Administration"
              disabled={submitting}
            />
            {errors.display_name && (
              <p className="mt-1 text-sm text-red-600">{errors.display_name.message}</p>
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
              placeholder="Describe what this module manages..."
              rows={3}
              disabled={submitting}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Sort Order */}
          <div>
            <label htmlFor="sort_order" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sort Order <span className="text-red-500">*</span>
            </label>
            <Input
              id="sort_order"
              type="number"
              {...register('sort_order', { valueAsNumber: true })}
              placeholder="0"
              disabled={submitting}
            />
            {errors.sort_order && (
              <p className="mt-1 text-sm text-red-600">{errors.sort_order.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Lower numbers appear first in lists
            </p>
          </div>

          {/* Active Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <ToggleSwitch
              enabled={isActive}
              onChange={(enabled) => setValue('is_active', enabled)}
              label={isActive ? 'Active' : 'Inactive'}
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              {isActive
                ? 'Module is active and visible in the system'
                : 'Module is inactive and hidden from users'}
            </p>
          </div>
        </div>
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
          disabled={submitting}
        >
          {submitting ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {isEditMode ? 'Update Module' : 'Create Module'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
