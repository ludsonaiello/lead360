'use client';

// ============================================================================
// DeleteConfirmModal Component
// ============================================================================
// Confirmation modal for deleting a transfer number
// ============================================================================

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { TransferNumber } from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';

interface DeleteConfirmModalProps {
  transferNumber: TransferNumber | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * DeleteConfirmModal - Confirm deletion of transfer number
 */
export function DeleteConfirmModal({
  transferNumber,
  isOpen,
  onClose,
  onSuccess,
}: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle delete transfer number
   */
  const handleDelete = async () => {
    if (!transferNumber) return;

    setDeleting(true);
    setError(null);

    try {
      await voiceAiApi.deleteTransferNumber(transferNumber.id);
      toast.success(`Transfer number "${transferNumber.label}" deleted successfully`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[DeleteConfirmModal] Failed to delete transfer number:', err);
      const errorMessage =
        err.response?.data?.message || 'Failed to delete transfer number';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  if (!transferNumber) return null;

  // Format phone number for display
  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/^\+1/, '');
    if (cleaned.length === 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Delete Transfer Number
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            disabled={deleting}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Warning Message */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
            Are you sure you want to delete this transfer number?
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">
            The transfer number will be soft-deleted and will no longer appear in the agent's
            available transfers. This action can be undone by contacting support.
          </p>
        </div>

        {/* Transfer Number Details */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Label:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {transferNumber.label}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Phone Number:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatPhoneNumber(transferNumber.phone_number)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                {transferNumber.transfer_type.replace('_', ' ')}
              </span>
            </div>
            {transferNumber.is_default && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Default:</span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">
                  Yes (Default transfer number)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleting}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Transfer Number'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
