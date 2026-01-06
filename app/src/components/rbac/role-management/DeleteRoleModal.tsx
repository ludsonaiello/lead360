'use client';

// ============================================================================
// DeleteRoleModal Component
// ============================================================================
// Modal for deleting a role with safety checks.
// Prevents deletion if role has users assigned or is a system role.
// ============================================================================

import React, { useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import type { DeleteRoleModalProps } from '@/lib/types/rbac';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import * as rbacApi from '@/lib/api/rbac';
import { formatErrorForDisplay } from '@/lib/utils/errors';

/**
 * DeleteRoleModal - Delete role with safety checks
 *
 * Safety checks:
 * - Cannot delete system roles
 * - Cannot delete roles with users assigned
 * - Shows warning and confirmation
 *
 * @param role - Role to delete (with user count)
 * @param isOpen - Whether modal is open
 * @param onClose - Callback when modal closes
 * @param onSuccess - Callback when role is deleted successfully
 *
 * @example
 * <DeleteRoleModal
 *   role={role}
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => {
 *     toast.success('Role deleted');
 *     refreshRoles();
 *   }}
 * />
 */
export default function DeleteRoleModal({
  role,
  isOpen,
  onClose,
  onSuccess,
}: DeleteRoleModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const userCount = role._count?.user_roles || 0;
  const canDelete = !role.is_system && userCount === 0;

  /**
   * Handle delete
   */
  const handleDelete = async () => {
    if (!canDelete) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await rbacApi.deleteRole(role.id);

      setSuccessMessage(`Role "${role.name}" has been deleted successfully.`);

      // Call success callback after short delay
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        handleClose();
      }, 1500);
    } catch (err) {
      console.error('[DeleteRoleModal] Failed to delete role:', err);
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent
        title="Delete Role"
        description={`Are you sure you want to delete "${role.name}"?`}
        icon={<Trash2 className="w-6 h-6 text-red-600" />}
      >
        {/* Success state */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">Success!</p>
                <p className="text-sm text-green-600 mt-1">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Cannot delete - system role */}
        {!successMessage && role.is_system && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Cannot Delete System Role</p>
                <p className="text-sm text-red-600 mt-1">
                  This is a system role and cannot be deleted. System roles are essential for the platform to function properly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cannot delete - has users */}
        {!successMessage && !role.is_system && userCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Cannot Delete Role</p>
                <p className="text-sm text-red-600 mt-1">
                  This role is currently assigned to <strong>{userCount}</strong> user(s).
                  Please remove all users from this role before deleting it.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Can delete - show confirmation */}
        {!successMessage && canDelete && (
          <div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Warning</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    This action cannot be undone. The role and all its permission associations will be permanently deleted.
                  </p>
                </div>
              </div>
            </div>

            {/* Role info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Role Name:</dt>
                  <dd className="font-medium text-gray-900">{role.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Permissions:</dt>
                  <dd className="font-medium text-gray-900">
                    {role.role_permissions?.length || 0}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Users:</dt>
                  <dd className="font-medium text-gray-900">{userCount}</dd>
                </div>
              </dl>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
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
          {canDelete && (
            <Button
              type="button"
              variant="primary"
              onClick={handleDelete}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Role
                </>
              )}
            </Button>
          )}
        </ModalActions>
      )}
    </Modal>
  );
}
