/**
 * RejectModal Component
 * Modal with required rejection reason for rejecting a pending expense entry
 * Sprint 10 — Task 3
 */

'use client';

import React, { useState } from 'react';
import { XCircle, Calendar, Tag, DollarSign, User } from 'lucide-react';
import toast from 'react-hot-toast';

import { Modal, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

import { rejectEntry } from '@/lib/api/financial';
import type { FinancialEntry } from '@/lib/types/financial';

// ========== HELPERS ==========

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ========== PROPS ==========

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: FinancialEntry | null;
}

// ========== COMPONENT ==========

export function RejectModal({ isOpen, onClose, onSuccess, entry }: RejectModalProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    setReasonError('');
    onClose();
  };

  const validate = (): boolean => {
    if (!reason.trim()) {
      setReasonError('Rejection reason is required');
      return false;
    }
    setReasonError('');
    return true;
  };

  const handleReject = async () => {
    if (!entry) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      await rejectEntry(entry.id, { rejection_reason: reason.trim() });
      toast.success('Expense rejected. The submitter will be notified.');
      setReason('');
      setReasonError('');
      onClose();
      onSuccess();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Failed to reject expense';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!entry) return null;

  const isExpense = entry.entry_type === 'expense';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          Reject Expense
        </span>
      }
      size="md"
    >
      <div className="space-y-4">
        {/* Entry Summary */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>{formatDate(entry.entry_date)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Tag className="h-4 w-4 flex-shrink-0" />
            <span>{entry.category_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
            <span className={`text-lg font-bold ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {formatCurrency(entry.amount)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <User className="h-4 w-4 flex-shrink-0" />
            <span>Submitted by {entry.created_by_name}</span>
          </div>
          {entry.project_name && (
            <div className="text-sm text-gray-500 dark:text-gray-400 pl-6">
              Project: {entry.project_name}
            </div>
          )}
        </div>

        {/* Rejection Reason (required) */}
        <Textarea
          id="rejection-reason"
          label="Rejection Reason"
          placeholder="Explain why this expense is being rejected..."
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (reasonError && e.target.value.trim()) setReasonError('');
          }}
          maxLength={500}
          showCharacterCount
          rows={4}
          resize="vertical"
          required
          error={reasonError}
        />
      </div>

      <ModalActions>
        <Button variant="secondary" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleReject}
          loading={submitting}
          disabled={submitting}
        >
          Reject
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default RejectModal;
