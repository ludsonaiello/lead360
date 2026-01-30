/**
 * Bypass Approval Modal Component
 * Owner-only modal for bypassing all approval levels with strong warnings
 */

'use client';

import React, { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

interface BypassApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBypass: (reason: string) => void;
  quoteNumber: string;
  quoteTitle: string;
}

export function BypassApprovalModal({
  isOpen,
  onClose,
  onBypass,
  quoteNumber,
  quoteTitle,
}: BypassApprovalModalProps) {
  const [reason, setReason] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBypass = async () => {
    // Validate reason
    if (!reason.trim()) {
      setError('Bypass reason is required');
      return;
    }

    if (reason.trim().length < 5) {
      setError('Bypass reason must be at least 5 characters');
      return;
    }

    if (!understood) {
      setError('You must acknowledge that you understand this action');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onBypass(reason.trim());
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('');
      setUnderstood(false);
      setError('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent
        icon={<Shield className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />}
        title="Bypass Approval"
        description="Owner override - Skip all approval levels"
      >
        {/* Strong Warning */}
        <div className="flex items-start gap-3 mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border-2 border-yellow-400 dark:border-yellow-600">
          <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-yellow-900 dark:text-yellow-100">
              Warning: Bypassing Approval Workflow
            </p>
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-2">
              This will skip <strong>all approval levels</strong> and mark the quote as ready to send to the customer.
            </p>
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-2">
              This action is <strong>audited</strong> and should only be used in emergency situations or when approval workflow does not apply.
            </p>
          </div>
        </div>

        {/* Quote Info */}
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
          </div>
        </div>

        {/* Required Reason */}
        <Textarea
          label="Reason for Bypass *"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError('');
          }}
          placeholder="Emergency approval - customer deadline, special circumstances, etc."
          rows={3}
          required
          error={error}
        />

        {/* Confirmation Checkbox */}
        <label className="flex items-start gap-3 mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => {
              setUnderstood(e.target.checked);
              if (error) setError('');
            }}
            className="mt-1 w-4 h-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I understand this bypasses all approval levels and takes full responsibility for this decision. This action is audited.
          </span>
        </label>

        {/* Additional Info */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> All bypassed approvals will be recorded in the audit log with your user ID, timestamp, and the reason provided.
          </p>
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleBypass}
          loading={loading}
          disabled={loading || !reason.trim() || !understood}
        >
          <Shield className="w-4 h-4" />
          Bypass Approval
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default BypassApprovalModal;
