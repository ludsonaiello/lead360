'use client';

import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { changeUserRole, listRoles } from '@/lib/api/users';
import type { MembershipItem, RoleInfo } from '@/lib/types/users';

// =============================================================================
// Types
// =============================================================================

interface ChangeRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MembershipItem | null;
}

// =============================================================================
// Component
// =============================================================================

export default function ChangeRoleModal({ isOpen, onClose, onSuccess, member }: ChangeRoleModalProps) {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Reset state + fetch roles when modal opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen && member) {
      setRoleId(member.role.id);
      setError(null);
      setSubmitting(false);
      fetchRoles();
    }
  }, [isOpen, member]);

  async function fetchRoles() {
    try {
      setLoadingRoles(true);
      const data = await listRoles();
      setRoles(data);
    } catch {
      setError('Failed to load roles. Please close and try again.');
    } finally {
      setLoadingRoles(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasChanged = member ? roleId !== member.role.id : false;
  const memberName = member ? `${member.first_name} ${member.last_name}` : '';

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!member || !hasChanged) return;

    setSubmitting(true);
    setError(null);

    try {
      await changeUserRole(member.id, { role_id: roleId });

      const selectedRole = roles.find((r) => r.id === roleId);
      toast.success(`Role updated to ${selectedRole?.name ?? 'new role'} for ${memberName}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };

      if (apiError.status === 403) {
        setError(apiError.message || 'Only an Owner or platform administrator can change the role of an Owner.');
      } else if (apiError.status === 404) {
        setError(apiError.message || 'Role not found or membership not found.');
      } else {
        setError(apiError.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!member) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Role" size="md">
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Member context */}
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Changing role for{' '}
              <strong className="text-gray-900 dark:text-gray-100">{memberName}</strong>{' '}
              <span className="text-gray-500 dark:text-gray-400">({member.email})</span>
            </p>

            {/* Error banner */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Role dropdown */}
            <div>
              <label
                htmlFor="change-role-select"
                className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
              >
                Role <span className="text-red-500 dark:text-red-400 ml-1">*</span>
              </label>

              {loadingRoles ? (
                <div className="flex items-center gap-2 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Loading roles...</span>
                </div>
              ) : (
                <select
                  id="change-role-select"
                  className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                  value={roleId}
                  onChange={(e) => {
                    setRoleId(e.target.value);
                    if (error) setError(null);
                  }}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Current role hint */}
            {!loadingRoles && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Shield className="w-3.5 h-3.5" />
                <span>
                  Current role: <strong className="text-gray-700 dark:text-gray-300">{member.role.name}</strong>
                </span>
              </div>
            )}
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={!hasChanged || loadingRoles || roles.length === 0}
          >
            Update Role
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
