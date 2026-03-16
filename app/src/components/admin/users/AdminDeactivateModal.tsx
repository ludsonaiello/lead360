// ============================================================================
// AdminDeactivateModal
// ============================================================================
// Confirmation modal to deactivate a user account.
// Platform Admin action — triggers PATCH /admin/users/:id/deactivate
// ============================================================================

'use client';

import React, { useState } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import { Button } from '@/components/ui/Button';
import { adminDeactivateUser } from '@/lib/api/users';
import type { AdminUserDetail } from '@/lib/types/users';
import toast from 'react-hot-toast';
import { UserX } from 'lucide-react';

interface AdminDeactivateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: AdminUserDetail | null;
}

export default function AdminDeactivateModal({
  isOpen,
  onClose,
  onSuccess,
  user,
}: AdminDeactivateModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);

    try {
      await adminDeactivateUser(user.id);
      toast.success(`${user.first_name} ${user.last_name} has been deactivated`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };
      if (apiError.status === 409) {
        setError('User is already inactive');
      } else {
        setError(apiError.message || 'Failed to deactivate user');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setError(null);
      onClose();
    }
  };

  if (!user) return null;

  const fullName = `${user.first_name} ${user.last_name}`;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Deactivate User" size="md">
      <ModalContent
        icon={<UserX className="h-6 w-6 text-yellow-500" />}
      >
        <p>
          Deactivate{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{fullName}</span>?
        </p>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          They will be immediately logged out and unable to access the platform until reactivated.
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </ModalContent>

      <ModalActions>
        <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" onClick={handleSubmit} loading={submitting}>
          Deactivate
        </Button>
      </ModalActions>
    </Modal>
  );
}
