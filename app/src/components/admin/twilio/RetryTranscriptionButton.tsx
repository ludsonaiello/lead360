/**
 * Retry Transcription Button Component
 * Sprint 4: Transcription Monitoring
 * Handles individual transcription retry with loading states and feedback
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { retryTranscription } from '@/lib/api/twilio-admin';
import { RotateCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface RetryTranscriptionButtonProps {
  transcriptionId: string;
  onSuccess?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  showIcon?: boolean;
}

export function RetryTranscriptionButton({
  transcriptionId,
  onSuccess,
  size = 'sm',
  variant = 'secondary',
  showIcon = true,
}: RetryTranscriptionButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryTranscription(transcriptionId);
      setShowSuccessModal(true);
      onSuccess?.();
    } catch (error: any) {
      console.error('[RetryTranscriptionButton] Retry failed:', error);
      setErrorMessage(error?.response?.data?.message || 'Failed to retry transcription');
      setShowErrorModal(true);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleRetry}
        disabled={isRetrying}
        size={size}
        variant={variant}
        loading={isRetrying}
      >
        {!isRetrying && showIcon && <RotateCw className="h-4 w-4" />}
        {isRetrying ? 'Retrying...' : 'Retry'}
      </Button>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            Retry Initiated
          </div>
        }
        size="md"
      >
        <ModalContent>
          <p className="text-gray-700 dark:text-gray-300">
            Transcription has been queued for retry. It may take a few minutes to process.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            The transcription status will update automatically once processing is complete.
          </p>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setShowSuccessModal(false)} variant="primary">
            OK
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            Retry Failed
          </div>
        }
        size="md"
      >
        <ModalContent>
          <p className="text-red-600 dark:text-red-400 font-medium">{errorMessage}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Please try again later or contact support if the issue persists.
          </p>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setShowErrorModal(false)} variant="secondary">
            Close
          </Button>
        </ModalActions>
      </Modal>
    </>
  );
}

export default RetryTranscriptionButton;
