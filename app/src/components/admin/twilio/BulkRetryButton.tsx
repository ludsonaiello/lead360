/**
 * Bulk Retry Button Component
 * Sprint 4: Transcription Monitoring
 * Handles bulk retry of multiple failed transcriptions with progress tracking
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { bulkRetryTranscriptions } from '@/lib/api/twilio-admin';
import { RotateCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface BulkRetryButtonProps {
  selectedIds: string[];
  onSuccess?: () => void;
  onClear?: () => void;
}

export function BulkRetryButton({ selectedIds, onSuccess, onClear }: BulkRetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [results, setResults] = useState<{
    succeeded: string[];
    failed: { id: string; error: string }[];
  } | null>(null);

  const handleRetry = async () => {
    setShowConfirmModal(false);
    setIsRetrying(true);

    try {
      const retryResults = await bulkRetryTranscriptions(selectedIds);
      setResults(retryResults);
      setShowResultModal(true);

      if (retryResults.succeeded.length > 0) {
        onSuccess?.();
      }

      // Clear selection after bulk retry
      onClear?.();
    } catch (error: any) {
      console.error('[BulkRetryButton] Bulk retry failed:', error);
      setResults({
        succeeded: [],
        failed: selectedIds.map(id => ({ id, error: 'Unknown error' })),
      });
      setShowResultModal(true);
    } finally {
      setIsRetrying(false);
    }
  };

  const isDisabled = selectedIds.length === 0;

  return (
    <>
      <Button
        onClick={() => setShowConfirmModal(true)}
        disabled={isDisabled || isRetrying}
        variant="primary"
        size="md"
        loading={isRetrying}
      >
        {!isRetrying && <RotateCw className="h-4 w-4" />}
        {isRetrying
          ? `Retrying ${selectedIds.length} transcription${selectedIds.length > 1 ? 's' : ''}...`
          : `Retry Selected (${selectedIds.length})`}
      </Button>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Bulk Retry"
        size="md"
      >
        <ModalContent>
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to retry{' '}
            <span className="font-semibold">{selectedIds.length}</span> failed transcription
            {selectedIds.length > 1 ? 's' : ''}?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            This action will queue all selected transcriptions for reprocessing. The process may
            take several minutes depending on the number of items.
          </p>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setShowConfirmModal(false)} variant="secondary">
            Cancel
          </Button>
          <Button onClick={handleRetry} variant="primary">
            <RotateCw className="h-4 w-4" />
            Start Retry
          </Button>
        </ModalActions>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title={
          <div className="flex items-center gap-2">
            {results && results.failed.length === 0 ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">Bulk Retry Complete</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-yellow-600 dark:text-yellow-400">Bulk Retry Partial Success</span>
              </>
            )}
          </div>
        }
        size="lg"
      >
        <ModalContent>
          {results && (
            <div className="space-y-4">
              {/* Success Summary */}
              {results.succeeded.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Successfully Queued: {results.succeeded.length}
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    These transcriptions have been queued for retry and will be processed shortly.
                  </p>
                </div>
              )}

              {/* Failure Summary */}
              {results.failed.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
                    <AlertCircle className="h-5 w-5" />
                    Failed to Queue: {results.failed.length}
                  </div>
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                      {results.failed.map((item, index) => (
                        <li key={index} className="font-mono text-xs">
                          {item.id}: {item.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Overall Summary */}
              <div className="text-sm text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between">
                  <span>Total Attempted:</span>
                  <span className="font-medium">{selectedIds.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className="font-medium">
                    {((results.succeeded.length / selectedIds.length) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setShowResultModal(false)} variant="primary">
            Close
          </Button>
        </ModalActions>
      </Modal>
    </>
  );
}

export default BulkRetryButton;
