'use client';

// ============================================================================
// CloneRoleModal Component
// ============================================================================
// Modal for cloning an existing role with all its permissions.
// User provides new name and optional description.
// ============================================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, AlertCircle, CheckCircle } from 'lucide-react';
import type { CloneRoleModalProps } from '@/lib/types/rbac';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import * as rbacApi from '@/lib/api/rbac';
import { formatErrorForDisplay } from '@/lib/utils/errors';

// Form validation schema
const cloneRoleSchema = z.object({
  new_name: z
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

type CloneRoleFormData = z.infer<typeof cloneRoleSchema>;

/**
 * CloneRoleModal - Clone existing role with new name
 *
 * @param role - Role to clone
 * @param isOpen - Whether modal is open
 * @param onClose - Callback when modal closes
 * @param onSuccess - Callback when role is cloned successfully
 *
 * @example
 * <CloneRoleModal
 *   role={role}
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={(newRole) => {
 *     toast.success('Role cloned');
 *     refreshRoles();
 *   }}
 * />
 */
export default function CloneRoleModal({
  role,
  isOpen,
  onClose,
  onSuccess,
}: CloneRoleModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CloneRoleFormData>({
    resolver: zodResolver(cloneRoleSchema),
    defaultValues: {
      new_name: `${role.name} (Copy)`,
      description: role.description || '',
    },
  });

  /**
   * Handle form submission
   */
  const onSubmit = async (data: CloneRoleFormData) => {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const newRole = await rbacApi.cloneRole(role.id, data.new_name.trim());

      setSuccessMessage(`Role "${newRole.name}" created successfully with all permissions copied.`);

      // Call success callback after short delay
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(newRole);
        }
        handleClose();
      }, 1500);
    } catch (err) {
      console.error('[CloneRoleModal] Failed to clone role:', err);
      const errorInfo = formatErrorForDisplay(err);
      setError(errorInfo.message);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    if (!submitting) {
      setError(null);
      setSuccessMessage(null);
      reset();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalContent
        title="Clone Role"
        description={`Create a copy of "${role.name}" with all its permissions. Provide a new name for the cloned role.`}
        icon={<Copy className="w-6 h-6 text-blue-600" />}
      >
        {/* Success state */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">Success!</p>
                <p className="text-sm text-green-600 mt-1">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {!successMessage && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                The cloned role will have the same permissions as <strong>{role.name}</strong>.
                You can edit the permissions later.
              </p>
            </div>

            {/* New role name */}
            <div>
              <label htmlFor="new_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Role Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="new_name"
                type="text"
                {...register('new_name')}
                placeholder="Enter new role name"
                disabled={submitting}
              />
              {errors.new_name && (
                <p className="mt-1 text-sm text-red-600">{errors.new_name.message}</p>
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
                placeholder="Describe this role..."
                rows={3}
                disabled={submitting}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}
          </form>
        )}
      </ModalContent>

      {/* Modal actions */}
      {!successMessage && (
        <ModalActions>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit(onSubmit)}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Cloning...
              </>
            ) : (
              'Clone Role'
            )}
          </Button>
        </ModalActions>
      )}
    </Modal>
  );
}
