'use client';

// ============================================================================
// DeleteCredentialModal Component
// ============================================================================
// Confirmation modal for deleting provider credentials
// ============================================================================

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { ProviderWithCredential } from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';

interface DeleteCredentialModalProps {
  provider: ProviderWithCredential;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * DeleteCredentialModal - Confirm deletion of provider credential
 */
export default function DeleteCredentialModal({
  provider,
  isOpen,
  onClose,
  onSuccess,
}: DeleteCredentialModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle delete credential
   */
  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await voiceAiApi.deleteCredential(provider.id);
      toast.success(`Credential deleted for ${provider.display_name}`);
      onSuccess();
    } catch (err: any) {
      console.error('[DeleteCredentialModal] Failed to delete credential:', err);
      const errorMessage =
        err.response?.data?.message || 'Failed to delete credential';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
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
                Delete Credential
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {provider.display_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Warning Message */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
            This will permanently remove the stored API key.
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">
            The provider will no longer be usable until a new credential is added. This
            action cannot be undone.
          </p>
        </div>

        {/* Provider Details */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Provider:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {provider.display_name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {provider.provider_type}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Masked Key:</span>
              <code className="text-gray-900 dark:text-gray-100 font-mono">
                {provider.credential_masked_key}
              </code>
            </div>
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
            Delete Credential
          </Button>
        </div>
      </div>
    </Modal>
  );
}
