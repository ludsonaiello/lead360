/**
 * Approve Change Order Modal Component
 * Allows approving a change order with optional notes
 * Backend: POST /change-orders/:id/approve
 * DTO: ApproveChangeOrderDto { notes?: string }
 */

'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { approveChangeOrder } from '@/lib/api/change-orders';
import toast from 'react-hot-toast';

interface ApproveChangeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  changeOrderId: string;
  changeOrderNumber: string;
  changeOrderTitle: string;
  changeOrderTotal: number;
  onApproved?: () => void;
}

export function ApproveChangeOrderModal({
  isOpen,
  onClose,
  changeOrderId,
  changeOrderNumber,
  changeOrderTitle,
  changeOrderTotal,
  onApproved,
}: ApproveChangeOrderModalProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const formatMoney = (amount: number): string => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const dto = notes.trim() ? { notes: notes.trim() } : {};
      await approveChangeOrder(changeOrderId, dto);
      toast.success(`Change order ${changeOrderNumber} has been approved`);
      onApproved?.();
      onClose();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to approve change order';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleApprove();
    }
  };

  if (!isOpen) return null;

  const isIncrease = changeOrderTotal >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Approve Change Order
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
          {/* Change Order Summary */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              {changeOrderTitle}
            </p>
            <div className="flex items-center gap-2">
              {isIncrease ? (
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              <p className={`text-lg font-bold ${
                isIncrease
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {isIncrease ? '+' : '-'}{formatMoney(changeOrderTotal)}
              </p>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Approval Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add any notes about this approval..."
              rows={3}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Optional notes will be recorded in the audit log
            </p>
          </div>

          {/* Warning */}
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-800 dark:text-green-200">
                <p className="font-semibold mb-1">Approving this change order will:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Set the status to "Approved"</li>
                  <li>Add {isIncrease ? formatMoney(changeOrderTotal) : `subtract ${formatMoney(changeOrderTotal)}`} to the parent quote's revised total</li>
                  <li>Create a version snapshot</li>
                  <li>Record the approval in the audit log</li>
                </ul>
              </div>
            </div>
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
            variant="primary"
            onClick={handleApprove}
            disabled={loading}
            className="min-w-[120px] bg-green-600 hover:bg-green-700"
          >
            {loading ? 'Approving...' : 'Approve'}
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

export default ApproveChangeOrderModal;
