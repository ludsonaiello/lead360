'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { deleteUser } from '@/lib/api/users';
import type { MembershipItem } from '@/lib/types/users';

// =============================================================================
// Types
// =============================================================================

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MembershipItem | null;
}

// =============================================================================
// Component
// =============================================================================

export default function DeleteUserModal({ isOpen, onClose, onSuccess, member }: DeleteUserModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Reset state when modal opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const memberName = member ? `${member.first_name} ${member.last_name}` : '';

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!member) return;

    setSubmitting(true);
    setError(null);

    try {
      await deleteUser(member.id);

      toast.success(`${memberName} has been removed`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };

      if (apiError.status === 404) {
        setError(apiError.message || 'Membership not found.');
      } else if (apiError.status === 403) {
        setError(apiError.message || 'You do not have permission to delete this user.');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Delete User" size="md">
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Red warning banner */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                    This action cannot be undone
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    <strong>{memberName}</strong> will be permanently removed from this organization.
                  </p>
                </div>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                {error}
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
            variant="danger"
            loading={submitting}
          >
            Delete User
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
