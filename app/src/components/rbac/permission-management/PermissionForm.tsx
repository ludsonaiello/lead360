'use client';

// ============================================================================
// PermissionForm Component
// ============================================================================
// Form for creating or editing permissions.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Key, Save, X, AlertCircle } from 'lucide-react';
import type { Permission, PermissionWithModule, PermissionFormData, Module } from '@/lib/types/rbac';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import * as rbacApi from '@/lib/api/rbac';
import { formatErrorForDisplay } from '@/lib/utils/errors';
import toast from 'react-hot-toast';

// Form validation schema
const permissionFormSchema = z.object({
  module_id: z.string().min(1, 'Module is required'),
  action: z
    .string()
    .min(1, 'Action is required')
    .max(50, 'Action must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Action can only contain lowercase letters, numbers, and hyphens'),
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be less than 100 characters'),
  description: z
    .string()
    .max(200, 'Description must be less than 200 characters')
    .optional()
    .nullable(),
});

type PermissionFormSchemaData = z.infer<typeof permissionFormSchema>;

interface PermissionFormProps {
  permission?: PermissionWithModule; // If editing, pass existing permission
  modules: Module[];
  onSuccess?: (permission: Permission | PermissionWithModule) => void;
  onCancel?: () => void;
}

/**
 * PermissionForm - Create or edit permission
 *
 * @param permission - Existing permission (for edit mode)
 * @param modules - Available modules
 * @param onSuccess - Callback when permission is saved
 * @param onCancel - Callback when form is cancelled
 *
 * @example
 * // Create mode
 * <PermissionForm
 *   modules={modules}
 *   onSuccess={(newPermission) => router.push('/admin/rbac/permissions')}
 *   onCancel={() => router.back()}
 * />
 */
export default function PermissionForm({
  permission,
  modules,
  onSuccess,
  onCancel,
}: PermissionFormProps) {
  const router = useRouter();
  const isEditMode = !!permission;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<PermissionFormSchemaData>({
    resolver: zodResolver(permissionFormSchema),
    defaultValues: {
      module_id: permission?.module_id || '',
      action: permission?.action || '',
      display_name: permission?.display_name || '',
      description: permission?.description || '',
    },
  });

  const selectedModuleId = watch('module_id');
  const action = watch('action');

  /**
   * Get module options for dropdown
   */
  const moduleOptions = modules
    .filter((m) => m.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((module) => ({
      value: module.id,
      label: module.display_name,
    }));

  /**
   * Handle form submission
   */
  const onSubmit = async (data: PermissionFormSchemaData) => {
    setSubmitting(true);
    setError(null);

    try {
      const formData: PermissionFormData = {
        module_id: data.module_id,
        action: data.action.trim().toLowerCase(),
        display_name: data.display_name.trim(),
        description: data.description?.trim() || null,
      };

      let savedPermission: Permission | PermissionWithModule;

      if (isEditMode) {
        // Update existing permission
        savedPermission = await rbacApi.updatePermission(permission.id, formData);
        toast.success(`Permission "${savedPermission.display_name}" updated successfully`);
      } else {
        // Create new permission
        savedPermission = await rbacApi.createPermission(formData);
        toast.success(`Permission "${savedPermission.display_name}" created successfully`);
      }

      if (onSuccess) {
        onSuccess(savedPermission);
      } else {
        router.push('/admin/rbac/permissions');
      }
    } catch (err) {
      console.error('[PermissionForm] Failed to save permission:', err);
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

  /**
   * Get permission code preview
   */
  const getPermissionCode = () => {
    const module = modules.find((m) => m.id === selectedModuleId);
    if (module && action) {
      return `${module.name}:${action.toLowerCase()}`;
    }
    return '';
  };

  const permissionCode = getPermissionCode();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 text-green-600 rounded-lg">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isEditMode ? 'Edit Permission' : 'Create New Permission'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isEditMode
                ? 'Update permission details'
                : 'Define a new permission for a module'}
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
          {/* Module */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Module <span className="text-red-500">*</span>
            </label>
            <Select
              value={selectedModuleId}
              onChange={(value) => setValue('module_id', value)}
              options={moduleOptions}
              disabled={submitting || isEditMode}
            />
            {errors.module_id && (
              <p className="mt-1 text-sm text-red-600">{errors.module_id.message}</p>
            )}
            {isEditMode && (
              <p className="mt-1 text-xs text-gray-500">
                Module cannot be changed for existing permissions
              </p>
            )}
          </div>

          {/* Action */}
          <div>
            <label htmlFor="action" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Action <span className="text-red-500">*</span>
            </label>
            <Input
              id="action"
              type="text"
              {...register('action')}
              placeholder="e.g., view, create, edit, delete"
              disabled={submitting || isEditMode}
            />
            {errors.action && (
              <p className="mt-1 text-sm text-red-600">{errors.action.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Use lowercase letters, numbers, and hyphens only
            </p>
            {isEditMode && (
              <p className="mt-1 text-xs text-gray-500">
                Action cannot be changed for existing permissions
              </p>
            )}
          </div>

          {/* Permission code preview */}
          {permissionCode && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
                Permission Code:
              </p>
              <code className="text-sm font-mono text-blue-900 dark:text-blue-200">
                {permissionCode}
              </code>
            </div>
          )}

          {/* Display Name */}
          <div>
            <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="display_name"
              type="text"
              {...register('display_name')}
              placeholder="e.g., View Leads, Create Quotes"
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
              placeholder="Describe what this permission allows..."
              rows={3}
              disabled={submitting}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
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
              {isEditMode ? 'Update Permission' : 'Create Permission'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
