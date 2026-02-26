'use client';

// ============================================================================
// TransferNumberModal Component
// ============================================================================
// Modal for creating/editing transfer numbers
// ============================================================================

import React, { useState } from 'react';
import { Phone, Edit } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { TransferNumberForm } from './TransferNumberForm';
import type { TransferNumber } from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';

interface TransferNumberModalProps {
  transferNumber?: TransferNumber | null; // null/undefined = create, object = edit
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * TransferNumberModal - Modal for create/edit transfer number
 */
export function TransferNumberModal({
  transferNumber,
  isOpen,
  onClose,
  onSuccess,
}: TransferNumberModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!transferNumber;

  /**
   * Handle form submission
   */
  const handleSubmit = async (data: any) => {
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit) {
        // Update existing transfer number
        await voiceAiApi.updateTransferNumber(transferNumber.id, data);
        toast.success(`Transfer number "${data.label}" updated successfully`);
      } else {
        // Create new transfer number
        await voiceAiApi.createTransferNumber(data);
        toast.success(`Transfer number "${data.label}" created successfully`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[TransferNumberModal] Failed to save transfer number:', err);

      // Handle specific error cases
      let errorMessage = 'Failed to save transfer number';

      if (err.response?.data?.message) {
        const apiMessage = err.response.data.message;

        if (typeof apiMessage === 'string') {
          errorMessage = apiMessage;
        } else if (Array.isArray(apiMessage)) {
          // Validation errors array
          errorMessage = apiMessage.join(', ');
        }
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      showCloseButton={!submitting}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            {isEdit ? (
              <Edit className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            ) : (
              <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isEdit ? 'Edit Transfer Number' : 'Create Transfer Number'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {isEdit
                ? 'Update the transfer number details'
                : 'Add a new call transfer destination'}
            </p>
          </div>
        </div>

        {/* Global Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Form */}
        <TransferNumberForm
          initialData={transferNumber}
          onSubmit={handleSubmit}
          onCancel={onClose}
          submitting={submitting}
        />
      </div>
    </Modal>
  );
}
