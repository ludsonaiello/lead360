'use client';

// ============================================================================
// BatchRoleAssignmentModal Component
// ============================================================================
// Modal for assigning roles to multiple users at once.
// Useful for bulk operations on user lists.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, AlertCircle, CheckCircle } from 'lucide-react';
import type { BatchRoleAssignmentModalProps, Role } from '@/lib/types/rbac';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import * as rbacApi from '@/lib/api/rbac';
import { formatErrorForDisplay } from '@/lib/utils/errors';

// Form validation schema
const batchRoleAssignmentSchema = z.object({
  role_ids: z.array(z.string()).min(1, 'Select at least one role to assign'),
});

type BatchRoleAssignmentFormData = z.infer<typeof batchRoleAssignmentSchema>;

/**
 * BatchRoleAssignmentModal - Assign roles to multiple users
 *
 * Features:
 * - Checkbox list of all available roles
 * - Assigns selected roles to all selected users
 * - Shows success summary (users updated, roles assigned)
 * - Handles errors gracefully
 *
 * @param userIds - Array of user IDs to assign roles to
 * @param isOpen - Whether modal is open
 * @param onClose - Callback when modal closes
 * @param onSuccess - Callback when roles are successfully assigned
 *
 * @example
 * const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <BatchRoleAssignmentModal
 *   userIds={selectedUserIds}
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => {
 *     toast.success('Roles assigned');
 *     refreshUserList();
 *   }}
 * />
 */
export default function BatchRoleAssignmentModal({
  userIds,
  isOpen,
  onClose,
  onSuccess,
}: BatchRoleAssignmentModalProps) {
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<BatchRoleAssignmentFormData>({
    resolver: zodResolver(batchRoleAssignmentSchema),
    defaultValues: {
      role_ids: [],
    },
  });

  const selectedRoleIds = watch('role_ids');

  /**
   * Load available roles
   */
  useEffect(() => {
    const loadRoles = async () => {
      if (!isOpen) return;

      setLoading(true);
      setError(null);

      try {
        const roles = await rbacApi.getAllRoles();
        // Filter only active roles
        const activeRoles = roles.filter((role) => role.is_active && !role.deleted_at);
        setAllRoles(activeRoles);
      } catch (err) {
        console.error('[BatchRoleAssignmentModal] Failed to load roles:', err);
        const errorInfo = formatErrorForDisplay(err);
        setError(errorInfo.message);
      } finally {
        setLoading(false);
      }
    };

    loadRoles();
  }, [isOpen]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: BatchRoleAssignmentFormData) => {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Assign roles to all selected users
      const response = await rbacApi.batchAssignRoles({
        user_ids: userIds,
        role_ids: data.role_ids,
      });

      // Show success message
      const message = `
        Successfully assigned ${response.roles_assigned} role(s) to ${response.users_updated} user(s).
      `;
      setSuccessMessage(message);

      // Call success callback after short delay
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('[BatchRoleAssignmentModal] Failed to assign roles:', err);
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
        title="Assign Roles to Multiple Users"
        description={`Select roles to assign to ${userIds.length} selected user(s). These roles will be added to the users' existing roles.`}
        icon={<Users className="w-6 h-6 text-blue-600" />}
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
            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>{userIds.length}</strong> user(s) selected.
                Selected roles will be <strong>added</strong> to their existing roles (not replaced).
              </p>
            </div>

            {/* Role list */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allRoles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
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
                Assigning...
              </>
            ) : (
              `Assign to ${userIds.length} User(s)`
            )}
          </Button>
        </ModalActions>
      )}
    </Modal>
  );
}
