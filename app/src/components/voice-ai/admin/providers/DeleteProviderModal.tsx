'use client';

// ============================================================================
// DeleteProviderModal Component
// ============================================================================
// Confirmation modal for deleting a provider
// Shows warning about cascade deletion of credentials and usage records
// ============================================================================

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { VoiceAIProvider } from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';

interface DeleteProviderModalProps {
  provider: VoiceAIProvider;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * DeleteProviderModal - Confirm provider deletion
 */
export default function DeleteProviderModal({
  provider,
  isOpen,
  onClose,
  onSuccess,
}: DeleteProviderModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle delete confirmation
   */
  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await voiceAiApi.deleteProvider(provider.id);
      toast.success(`Provider "${provider.display_name}" deleted successfully`);
      onSuccess();
    } catch (err: any) {
      console.error('[DeleteProviderModal] Failed to delete provider:', err);
      const errorMessage = err.message || 'Failed to delete provider';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span>Delete Provider</span>
        </div>
      }
      size="md"
    >
      <ModalContent>
        <div className="space-y-4">
          {/* Warning message */}
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
              This action cannot be undone
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Deleting this provider will permanently remove:
            </p>
            <ul className="mt-2 ml-4 list-disc text-sm text-red-700 dark:text-red-300 space-y-1">
              <li>Provider configuration and metadata</li>
              <li>All associated credentials (API keys, secrets)</li>
              <li>All usage records and call logs</li>
              <li>Any global configuration references</li>
            </ul>
          </div>

          {/* Provider details */}
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              You are about to delete:
            </p>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="font-bold text-gray-900 dark:text-gray-100">
                {provider.display_name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {provider.provider_key}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Type: {provider.provider_type}
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Confirmation prompt */}
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            Are you sure you want to delete this provider?
          </p>
        </div>
      </ModalContent>

      <ModalActions>
        <Button
          onClick={onClose}
          variant="secondary"
          disabled={deleting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          variant="danger"
          loading={deleting}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete Provider'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
