/**
 * Approve Quote Modal Component
 * Confirmation modal for approving quotes at a specific level
 */

'use client';

import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

interface ApproveQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (comments?: string) => void;
  quoteNumber: string;
  quoteTitle: string;
  quoteTotal: number;
  approvalLevel: number;
}

export function ApproveQuoteModal({
  isOpen,
  onClose,
  onApprove,
  quoteNumber,
  quoteTitle,
  quoteTotal,
  approvalLevel,
}: ApproveQuoteModalProps) {
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await onApprove(comments.trim() || undefined);
      // If successful, modal will close via parent component
    } catch (err: any) {
      // Extract error message from response
      const errorMessage = err.response?.data?.message || err.message || 'Failed to approve quote';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setComments('');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent
        icon={<CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />}
        title="Approve Quote"
        description={`You are approving this quote at Level ${approvalLevel}`}
      >
        {/* Quote Summary */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Quote Number:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {quoteNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Title:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-right max-w-[200px] truncate">
                {quoteTitle}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Total:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                ${quoteTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Optional Comments */}
        <div>
          <Textarea
            label="Comments (Optional)"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Add any comments about your approval..."
            rows={3}
          />
          {comments.length > 0 && (
            <div className="flex items-center justify-end mt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {comments.length} characters
              </p>
            </div>
          )}
        </div>

        {/* Info Message */}
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            By approving, you confirm that you have reviewed this quote and authorize it to proceed to the next approval level.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </ModalContent>

      <ModalActions>
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleApprove}
          loading={loading}
          disabled={loading}
        >
          <CheckCircle2 className="w-4 h-4" />
          Approve Quote
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default ApproveQuoteModal;
