/**
 * ChangeSharePasswordModal Component
 * Modal to change password for an existing share link
 * Implementation: Revokes old link and creates new one with same settings but new password
 */

'use client';

import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { createShareLink, revokeShareLink } from '@/lib/api/files';
import type { ShareLink } from '@/lib/types/files';
import toast from 'react-hot-toast';

interface ChangeSharePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareLink: ShareLink;
  onSuccess?: (newShareLink: ShareLink) => void;
}

export function ChangeSharePasswordModal({
  isOpen,
  onClose,
  shareLink,
  onSuccess,
}: ChangeSharePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setIsChanging(true);

      // Step 1: Revoke old share link
      await revokeShareLink(shareLink.id);

      // Step 2: Create new share link with same settings but new password
      const response = await createShareLink({
        file_id: shareLink.file_id,
        password: newPassword,
        expires_at: shareLink.expires_at,
        max_downloads: shareLink.max_downloads,
      });

      toast.success('Share link password changed successfully');
      onSuccess?.(response.share_link);
      onClose();

      // Reset form
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      const message = error?.message || 'Failed to change password';
      toast.error(message);
    } finally {
      setIsChanging(false);
    }
  };

  const handleClose = () => {
    if (!isChanging) {
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Change Share Link Password">
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Password Change Process</p>
                <p>
                  This will revoke the current share link and create a new one with the same
                  expiration and download limits, but with a new password. The URL will remain the same.
                </p>
              </div>
            </div>

            {/* File Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                File
              </label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">
                {shareLink.file_name || 'Unknown file'}
              </p>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Password *
              </label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                required
                minLength={6}
                disabled={isChanging}
                autoFocus
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password *
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                minLength={6}
                disabled={isChanging}
              />
            </div>

            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        newPassword.length < 6
                          ? 'w-1/3 bg-red-500'
                          : newPassword.length < 10
                          ? 'w-2/3 bg-yellow-500'
                          : 'w-full bg-green-500'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {newPassword.length < 6
                      ? 'Weak'
                      : newPassword.length < 10
                      ? 'Medium'
                      : 'Strong'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </ModalContent>

        <ModalActions>
          <Button onClick={handleClose} variant="ghost" disabled={isChanging} type="button">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isChanging}>
            {isChanging ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Changing Password...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Change Password
              </>
            )}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
