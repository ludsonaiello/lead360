'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { reactivateUser } from '@/lib/api/users';
import type { MembershipItem } from '@/lib/types/users';

// =============================================================================
// Types
// =============================================================================

interface ReactivateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MembershipItem | null;
}

// =============================================================================
// Component
// =============================================================================

export default function ReactivateUserModal({ isOpen, onClose, onSuccess, member }: ReactivateUserModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState(false);

  // ---------------------------------------------------------------------------
  // Reset state when modal opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConflictError(false);
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
    setConflictError(false);

    try {
      await reactivateUser(member.id);

      toast.success(`${memberName} has been reactivated`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };

      if (apiError.status === 409) {
        setConflictError(true);
        setError('User is currently active in another organization.');
      } else if (apiError.status === 404) {
        setError(apiError.message || 'Inactive membership not found.');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Reactivate User" size="md">
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Confirmation text */}
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Reactivate <strong className="text-gray-900 dark:text-gray-100">{memberName}</strong>?
                They will be able to log in and access the platform again.
              </p>
            </div>

            {/* Conflict error banner (409) — persistent */}
            {conflictError && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                      Cannot Reactivate
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      This user is currently active in another organization. A user can only be active in one organization at a time.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* General error banner */}
            {error && !conflictError && (
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
            variant="primary"
            loading={submitting}
            disabled={conflictError}
          >
            Reactivate
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
