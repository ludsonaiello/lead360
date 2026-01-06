'use client';

// ============================================================================
// ApplyTemplateModal Component
// ============================================================================
// Modal for applying a template to create a new role.
// ============================================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText, Save, X, AlertCircle } from 'lucide-react';
import type { RoleTemplateWithPermissions, RoleWithPermissions, ApplyTemplateRequest } from '@/lib/types/rbac';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import * as rbacApi from '@/lib/api/rbac';
import { formatErrorForDisplay } from '@/lib/utils/errors';
import toast from 'react-hot-toast';

// Form validation schema
const applyTemplateSchema = z.object({
  role_name: z
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

type ApplyTemplateSchemaData = z.infer<typeof applyTemplateSchema>;

interface ApplyTemplateModalProps {
  template: RoleTemplateWithPermissions;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (role: RoleWithPermissions) => void;
}

/**
 * ApplyTemplateModal - Apply template to create new role
 *
 * @param template - Template to apply
 * @param isOpen - Whether modal is open
 * @param onClose - Callback when modal is closed
 * @param onSuccess - Callback when role is created
 *
 * @example
 * <ApplyTemplateModal
 *   template={template}
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={(role) => router.push(`/admin/rbac/roles/${role.id}`)}
 * />
 */
export default function ApplyTemplateModal({
  template,
  isOpen,
  onClose,
  onSuccess,
}: ApplyTemplateModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ApplyTemplateSchemaData>({
    resolver: zodResolver(applyTemplateSchema),
    defaultValues: {
      role_name: '',
      description: '',
    },
  });

  /**
   * Handle form submission
   */
  const onSubmit = async (data: ApplyTemplateSchemaData) => {
    setSubmitting(true);
    setError(null);

    try {
      const requestData: ApplyTemplateRequest = {
        role_name: data.role_name.trim(),
        description: data.description?.trim() || null,
      };

      const newRole = await rbacApi.applyTemplate(template.id, requestData);
      toast.success(`Role "${newRole.name}" created from template successfully`);

      reset();
      onClose();

      if (onSuccess) {
        onSuccess(newRole);
      }
    } catch (err) {
      console.error('[ApplyTemplateModal] Failed to apply template:', err);
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
    reset();
    setError(null);
    onClose();
  };

  const permissionCount = template.role_template_permissions?.length || 0;

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} size="lg">
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Apply Template: {template.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Create a new role with {permissionCount} permission{permissionCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Template Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
              Template: {template.name}
            </p>
            {template.description && (
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {template.description}
              </p>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Role Name */}
            <div>
              <label htmlFor="role_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="role_name"
                type="text"
                {...register('role_name')}
                placeholder="e.g., Sales Manager - North"
                disabled={submitting}
              />
              {errors.role_name && (
                <p className="mt-1 text-sm text-red-600">{errors.role_name.message}</p>
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
                placeholder="Optional description for this role..."
                rows={3}
                disabled={submitting}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>
          </div>
        </ModalContent>

        <ModalActions>
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
                Creating Role...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create Role
              </>
            )}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
