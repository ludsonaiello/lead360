'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { deactivateUser } from '@/lib/api/users';
import type { MembershipItem } from '@/lib/types/users';

// =============================================================================
// Types
// =============================================================================

interface DeactivateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MembershipItem | null;
}

// =============================================================================
// Component
// =============================================================================

export default function DeactivateUserModal({ isOpen, onClose, onSuccess, member }: DeactivateUserModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Reset state when modal opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      setReason('');
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
      await deactivateUser(member.id, reason.trim() ? { reason: reason.trim() } : undefined);

      toast.success(`${memberName} has been deactivated`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };

      if (apiError.status === 400) {
        setError(apiError.message || 'Tenant must have at least one active Owner.');
      } else if (apiError.status === 404) {
        setError(apiError.message || 'Active membership not found.');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Deactivate User" size="md">
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Warning banner */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  This will immediately log{' '}
                  <strong>{memberName}</strong>{' '}
                  out of the platform. Their session will be terminated. Are you sure?
                </p>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Reason input */}
            <Input
              id="deactivate-reason"
              label="Reason (optional)"
              type="text"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g., Employee terminated"
              maxLength={500}
            />

            {reason.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                {reason.length}/500 characters
              </p>
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
            Deactivate
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
