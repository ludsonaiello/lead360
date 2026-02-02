/**
 * Reject Change Order Modal Component
 * Allows rejecting a change order with a required reason
 * Backend: POST /change-orders/:id/reject
 * DTO: RejectChangeOrderDto { reason: string (min 10 chars) }
 */

'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { rejectChangeOrder } from '@/lib/api/change-orders';
import toast from 'react-hot-toast';

interface RejectChangeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  changeOrderId: string;
  changeOrderNumber: string;
  onRejected?: () => void;
}

export function RejectChangeOrderModal({
  isOpen,
  onClose,
  changeOrderId,
  changeOrderNumber,
  onRejected,
}: RejectChangeOrderModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation
  const reasonError = reason.trim().length > 0 && reason.trim().length < 10
    ? 'Rejection reason must be at least 10 characters'
    : '';

  const canSubmit = reason.trim().length >= 10 && !loading;

  const handleReject = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      await rejectChangeOrder(changeOrderId, { reason: reason.trim() });
      toast.success(`Change order ${changeOrderNumber} has been rejected`);
      onRejected?.();
      onClose();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to reject change order';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && canSubmit) {
      handleReject();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Reject Change Order
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {changeOrderNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Explain why this change order is being rejected (minimum 10 characters)..."
              rows={4}
              disabled={loading}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 ${
                reasonError
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {reasonError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{reasonError}</p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Minimum 10 characters required
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {reason.trim().length} characters
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> Rejecting this change order will set its status to "Denied" and cannot be undone. The rejection reason will be recorded in the audit log.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleReject}
            disabled={!canSubmit}
            className="min-w-[120px]"
          >
            {loading ? 'Rejecting...' : 'Reject Change Order'}
          </Button>
        </div>

        <div className="px-6 pb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Press Ctrl+Enter to submit
          </p>
        </div>
      </div>
    </div>
  );
}

export default RejectChangeOrderModal;
