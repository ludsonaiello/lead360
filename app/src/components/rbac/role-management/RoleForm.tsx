'use client';

// ============================================================================
// RoleForm Component
// ============================================================================
// Form for creating or editing roles with permission selection.
// Uses PermissionBuilder for interactive permission assignment.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Shield, Save, X, AlertCircle } from 'lucide-react';
import type { RoleWithPermissions, RoleFormData } from '@/lib/types/rbac';
import PermissionBuilder from './PermissionBuilder';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import * as rbacApi from '@/lib/api/rbac';
import { formatErrorForDisplay } from '@/lib/utils/errors';
import toast from 'react-hot-toast';

// Form validation schema
const roleFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(50, 'Role name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s_-]+$/, 'Role name can only contain letters, numbers, spaces, hyphens, and underscores'),
  description: z
    .string()
    .max(200, 'Description must be less than 200 characters')
    .optional()
    .nullable(),
});

type RoleFormSchemaData = z.infer<typeof roleFormSchema>;

interface RoleFormProps {
  role?: RoleWithPermissions; // If editing, pass existing role
  onSuccess?: (role: RoleWithPermissions) => void;
  onCancel?: () => void;
}

/**
 * RoleForm - Create or edit role with permissions
 *
 * @param role - Existing role (for edit mode)
 * @param onSuccess - Callback when role is saved
 * @param onCancel - Callback when form is cancelled
 *
 * @example
 * // Create mode
 * <RoleForm
 *   onSuccess={(newRole) => router.push('/admin/rbac/roles')}
 *   onCancel={() => router.back()}
 * />
 *
 * @example
 * // Edit mode
 * <RoleForm
 *   role={existingRole}
 *   onSuccess={(updatedRole) => toast.success('Role updated')}
 *   onCancel={() => router.back()}
 * />
 */
export default function RoleForm({ role, onSuccess, onCancel }: RoleFormProps) {
  const router = useRouter();
  const isEditMode = !!role;

  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<RoleFormSchemaData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: role?.name || '',
      description: role?.description || '',
    },
  });

  /**
   * Load existing permissions (edit mode)
   */
  useEffect(() => {
    if (role) {
      // Handle both role_permissions (plural) and role_permission (singular)
      const rolePerms = role.role_permissions || (role as any).role_permission;

      if (rolePerms && Array.isArray(rolePerms)) {
        console.log('[RoleForm] Loading permissions from role:', rolePerms.length);

        // Extract permission_id from each item (handles nested structure)
        const permissionIds = rolePerms
          .map((rp: any) => rp.permission_id || rp.permission?.id)
          .filter(Boolean); // Remove any undefined values

        console.log('[RoleForm] Extracted permission IDs:', permissionIds);
        setSelectedPermissionIds(permissionIds);
      }
    }
  }, [role]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: RoleFormSchemaData) => {
    // Validation: Must have at least one permission
    if (selectedPermissionIds.length === 0) {
      setError('Please select at least one permission for this role');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData: RoleFormData = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        permission_ids: selectedPermissionIds,
      };

      let savedRole: RoleWithPermissions;

      if (isEditMode) {
        // Update existing role
        savedRole = await rbacApi.updateRole(role.id, formData);
        toast.success(`Role "${savedRole.name}" updated successfully`);
      } else {
        // Create new role
        savedRole = await rbacApi.createRole(formData);
        toast.success(`Role "${savedRole.name}" created successfully`);
      }

      if (onSuccess) {
        onSuccess(savedRole);
      } else {
        router.push('/admin/rbac/roles');
      }
    } catch (err) {
      console.error('[RoleForm] Failed to save role:', err);
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
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isEditMode ? 'Edit Role' : 'Create New Role'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isEditMode
                ? 'Update role details and permissions'
                : 'Define a new role with specific permissions'}
            </p>
          </div>
        </div>
      </div>

      {/* System role warning (edit mode only) */}
      {isEditMode && role.is_system && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">System Role</p>
              <p className="text-sm text-yellow-700 mt-1">
                This is a system role. Modifying it may affect core functionality.
              </p>
            </div>
          </div>
        </div>
      )}

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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Basic Information
        </h3>

        <div className="space-y-4">
          {/* Role Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              type="text"
              {...register('name')}
              placeholder="e.g., Project Manager, Sales Rep"
              disabled={submitting || (isEditMode && role.is_system)}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
            {isEditMode && role.is_system && (
              <p className="mt-1 text-xs text-gray-500">
                System role names cannot be changed
              </p>
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
              placeholder="Describe what this role is responsible for..."
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Permissions <span className="text-red-500">*</span>
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select the permissions this role should have. Users with this role will be able to perform these actions.
        </p>

        <PermissionBuilder
          selectedPermissionIds={selectedPermissionIds}
          onChange={setSelectedPermissionIds}
          disabled={submitting}
        />

        {selectedPermissionIds.length === 0 && (
          <p className="mt-2 text-sm text-red-600">
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
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {isEditMode ? 'Update Role' : 'Create Role'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
