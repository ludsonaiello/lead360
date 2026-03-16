// ============================================================================
// AdminActivateModal
// ============================================================================
// Confirmation modal to activate a deactivated user account.
// Platform Admin action — triggers POST /admin/users/:id/activate
// ============================================================================

'use client';

import React, { useState } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import { Button } from '@/components/ui/Button';
import { adminActivateUser } from '@/lib/api/users';
import type { AdminUserDetail } from '@/lib/types/users';
import toast from 'react-hot-toast';
import { UserCheck } from 'lucide-react';

interface AdminActivateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: AdminUserDetail | null;
}

export default function AdminActivateModal({
  isOpen,
  onClose,
  onSuccess,
  user,
}: AdminActivateModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);

    try {
      await adminActivateUser(user.id);
      toast.success(`${user.first_name} ${user.last_name} has been activated`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };
      if (apiError.status === 409) {
        setError('User is already active');
      } else {
        setError(apiError.message || 'Failed to activate user');
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Activate User" size="md">
      <ModalContent
        icon={<UserCheck className="h-6 w-6 text-green-500" />}
      >
        <p>
          Activate{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{fullName}</span>?
        </p>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          They will be able to log in and access the platform again.
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
        <Button variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>
          Activate
        </Button>
      </ModalActions>
    </Modal>
  );
}
