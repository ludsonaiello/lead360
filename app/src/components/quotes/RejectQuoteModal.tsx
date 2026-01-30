/**
 * Reject Quote Modal Component
 * Modal for rejecting quotes with required reason
 */

'use client';

import React, { useState } from 'react';
import { XCircle, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

interface RejectQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReject: (comments: string) => void;
  quoteNumber: string;
  quoteTitle: string;
  quoteTotal: number;
  approvalLevel: number;
}

export function RejectQuoteModal({
  isOpen,
  onClose,
  onReject,
  quoteNumber,
  quoteTitle,
  quoteTotal,
  approvalLevel,
}: RejectQuoteModalProps) {
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReject = async () => {
    // Validate comments
    if (!comments.trim()) {
      setError('Rejection reason is required');
      return;
    }

    if (comments.trim().length < 10) {
      setError('Rejection reason must be at least 10 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onReject(comments.trim());
      // If successful, modal will close via parent component
    } catch (err: any) {
      // Extract error message from response
      const errorMessage = err.response?.data?.message || err.message || 'Failed to reject quote';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setComments('');
      setError('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent
        icon={<XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />}
        title="Reject Quote"
        description={`You are rejecting this quote at Level ${approvalLevel}`}
      >
        {/* Warning Message */}
        <div className="flex items-start gap-3 mb-4 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border-2 border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-800 dark:text-red-200">
              Rejection requires a reason
            </p>
            <p className="text-red-700 dark:text-red-300 mt-1">
              This action will reset the quote to draft status and all previous approvals will be cleared.
            </p>
          </div>
        </div>

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

        {/* Required Rejection Reason */}
        <div>
          <Textarea
            label="Rejection Reason *"
            value={comments}
            onChange={(e) => {
              setComments(e.target.value);
              if (error) setError('');
            }}
            placeholder="Explain why this quote is being rejected..."
            rows={4}
            required
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Minimum 10 characters required
            </p>
            <p
              className={`text-xs ${
                comments.length < 10
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {comments.length} / 10 characters
            </p>
          </div>
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
          variant="danger"
          onClick={handleReject}
          loading={loading}
          disabled={loading || comments.trim().length < 10}
        >
          <XCircle className="w-4 h-4" />
          Reject Quote
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default RejectQuoteModal;
