// ============================================================================
// AdminResetPasswordModal
// ============================================================================
// Confirmation modal to send a password reset email for a user.
// Platform Admin action — triggers POST /admin/users/:id/reset-password
// ============================================================================

'use client';

import React, { useState } from 'react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import { Button } from '@/components/ui/Button';
import { adminResetPassword } from '@/lib/api/users';
import type { AdminUserDetail } from '@/lib/types/users';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';

interface AdminResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: AdminUserDetail | null;
}

export default function AdminResetPasswordModal({
  isOpen,
  onClose,
  onSuccess,
  user,
}: AdminResetPasswordModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await adminResetPassword(user.id);
      toast.success(`Password reset email sent to ${result.email}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to send password reset email';
      setError(message);
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Reset Password" size="md">
      <ModalContent
        icon={<KeyRound className="h-6 w-6 text-blue-500" />}
      >
        <p>
          Send a password reset email to{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{user.email}</span>?
        </p>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          The user will receive an email with a link to set a new password.
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
          Send Reset Email
        </Button>
      </ModalActions>
    </Modal>
  );
}
