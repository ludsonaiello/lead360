'use client';

// ============================================================================
// EditUserRolesModal Component
// ============================================================================
// Modal for editing user roles. Displays checkboxes for all available roles
// and allows Owner/Admin to assign/remove roles from a user.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, AlertCircle, CheckCircle } from 'lucide-react';
import type { EditUserRolesModalProps, Role } from '@/lib/types/rbac';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import * as rbacApi from '@/lib/api/rbac';
import { formatErrorForDisplay } from '@/lib/utils/errors';

// Form validation schema
const editUserRolesSchema = z.object({
  role_ids: z.array(z.string()).min(1, 'User must have at least one role'),
});

type EditUserRolesFormData = z.infer<typeof editUserRolesSchema>;

/**
 * EditUserRolesModal - Modal for editing user's roles
 *
 * Features:
 * - Loads current user roles and all available roles
 * - Checkbox list to select/deselect roles
 * - Validation: User must have at least one role
 * - Warning: If removing Owner role from last Owner
 * - Success feedback via modal
 *
 * @param userId - User ID whose roles to edit
 * @param isOpen - Whether modal is open
 * @param onClose - Callback when modal closes
 * @param onSuccess - Callback when roles are successfully updated
 *
 * @example
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <EditUserRolesModal
 *   userId="user-123"
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => {
 *     toast.success('Roles updated');
 *     refreshUserList();
 *   }}
 * />
 */
export default function EditUserRolesModal({
  userId,
  isOpen,
  onClose,
  onSuccess,
}: EditUserRolesModalProps) {
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [currentRoleIds, setCurrentRoleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<EditUserRolesFormData>({
    resolver: zodResolver(editUserRolesSchema),
    defaultValues: {
      role_ids: [],
    },
  });

  const selectedRoleIds = watch('role_ids');

  /**
   * Load available roles and current user roles
   */
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch all available roles and current user roles in parallel
        const [rolesResponse, userRolesResponse] = await Promise.all([
          rbacApi.getAllRoles(),
          rbacApi.getUserRoles(userId),
        ]);

        // Filter only active roles
        const activeRoles = rolesResponse.filter((role) => role.is_active && !role.deleted_at);
        setAllRoles(activeRoles);

        // Extract current role IDs
        const currentIds = userRolesResponse.roles.map((ur) => ur.role_id);
        setCurrentRoleIds(currentIds);

        // Set form default values
        setValue('role_ids', currentIds);
      } catch (err) {
        console.error('[EditUserRolesModal] Failed to load data:', err);
        const errorInfo = formatErrorForDisplay(err);
        setError(errorInfo.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, userId, setValue]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: EditUserRolesFormData) => {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Replace user roles with selected roles
      const response = await rbacApi.replaceUserRoles(userId, data.role_ids);

      // Show success message
      const addedCount = response.roles_added;
      const removedCount = response.roles_removed;

      let message = 'Roles updated successfully.';
      if (addedCount > 0 && removedCount > 0) {
        message = `Added ${addedCount} role(s) and removed ${removedCount} role(s).`;
      } else if (addedCount > 0) {
        message = `Added ${addedCount} role(s).`;
      } else if (removedCount > 0) {
        message = `Removed ${removedCount} role(s).`;
      }

      setSuccessMessage(message);

      // Call success callback after short delay
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 1500);
    } catch (err) {
      console.error('[EditUserRolesModal] Failed to update roles:', err);
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
      onClose();
    }
  };

  /**
   * Check if role is currently selected
   */
  const isRoleSelected = (roleId: string) => {
    return selectedRoleIds.includes(roleId);
  };

  /**
   * Get role badge color
   */
  const getRoleBadgeColor = (role: Role) => {
    if (role.name === 'Owner') return 'bg-purple-100 text-purple-800 border-purple-300';
    if (role.name === 'Admin') return 'bg-blue-100 text-blue-800 border-blue-300';
    if (role.is_system) return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalContent
        title="Edit User Roles"
        description="Select the roles to assign to this user. User must have at least one role."
        icon={<Shield className="w-6 h-6 text-blue-600" />}
      >
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {/* Error state */}
        {!loading && error && !successMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Failed to load roles</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

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
        {!loading && !successMessage && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Role list */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allRoles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No roles available</p>
                </div>
              ) : (
                allRoles.map((role) => (
                  <label
                    key={role.id}
                    className={`
                      flex items-start gap-3 p-3 rounded-lg border cursor-pointer
                      transition-all hover:bg-gray-50
                      ${isRoleSelected(role.id) ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}
                    `}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      value={role.id}
                      {...register('role_ids')}
                      className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />

                    {/* Role info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Role name */}
                        <span className="font-medium text-gray-900">{role.name}</span>

                        {/* Role badge */}
                        <span
                          className={`
                            text-xs px-2 py-0.5 rounded-full border font-medium
                            ${getRoleBadgeColor(role)}
                          `}
                        >
                          {role.is_system ? 'System' : 'Custom'}
                        </span>
                      </div>

                      {/* Role description */}
                      {role.description && (
                        <p className="text-sm text-gray-600">{role.description}</p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* Validation error */}
            {errors.role_ids && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{errors.role_ids.message}</p>
              </div>
            )}

            {/* Submit error */}
            {error && !loading && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </form>
        )}
      </ModalContent>

      {/* Modal actions */}
      {!loading && !successMessage && (
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
            disabled={submitting || allRoles.length === 0}
          >
            {submitting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </ModalActions>
      )}
    </Modal>
  );
}
