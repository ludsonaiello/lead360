// ============================================================================
// AdminDeleteUserModal
// ============================================================================
// Confirmation modal to soft-delete a user account.
// Platform Admin action — triggers DELETE /admin/users/:id
// Redirects to /admin/users on success.
// ============================================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ModalActions } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import { Button } from '@/components/ui/Button';
import { adminDeleteUser } from '@/lib/api/users';
import type { AdminUserDetail } from '@/lib/types/users';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

interface AdminDeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUserDetail | null;
}

export default function AdminDeleteUserModal({
  isOpen,
  onClose,
  user,
}: AdminDeleteUserModalProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);

    try {
      await adminDeleteUser(user.id);
      toast.success(`${user.first_name} ${user.last_name} has been deleted`);
      onClose();
      router.push('/admin/users');
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };
      if (apiError.status === 409) {
        setError('User is already deleted');
      } else {
        setError(apiError.message || 'Failed to delete user');
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete User" size="md">
      <ModalContent
        icon={<AlertTriangle className="h-6 w-6 text-red-500" />}
      >
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">
            This will soft-delete{' '}
            <span className="font-bold">{fullName}</span>.
            They will be marked as deleted and deactivated.
          </p>
        </div>

        <p className="mt-3 text-gray-500 dark:text-gray-400">
          The user will no longer be able to log in. This action can be reversed by a platform administrator.
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
          Delete User
        </Button>
      </ModalActions>
    </Modal>
  );
}
