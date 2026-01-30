/**
 * Restore Version Modal Component
 * Confirmation modal for restoring previous versions
 * Shows preview of changes and requires reason for restore
 */

'use client';

import React, { useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import {
  restoreVersion,
  formatVersionNumber,
  getVersionNumberString,
  type QuoteVersion,
} from '@/lib/api/quote-versions';
import toast from 'react-hot-toast';

interface RestoreVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: QuoteVersion;
  onRestore: () => void;
}

export function RestoreVersionModal({
  isOpen,
  onClose,
  version,
  onRestore,
}: RestoreVersionModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get version details
  const versionTotal = version.snapshot_data?.quote?.total || 0;
  const versionItemCount = version.snapshot_data?.items?.length || 0;

  // Format money
  const formatMoney = (amount: number): string => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Handle restore
  const handleRestore = async () => {
    // Validate reason
    if (!reason.trim()) {
      setError('Reason for restore is required');
      return;
    }

    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const versionNumber = getVersionNumberString(version);
      await restoreVersion(version.quote_id, versionNumber, { reason: reason.trim() });

      toast.success(`Version ${formatVersionNumber(version.version_number)} has been restored`);

      onRestore();
      handleClose();
    } catch (error: any) {
      // Check for known backend error
      if (error.response?.status === 500 && error.response?.data?.message?.includes('DecimalError')) {
        toast.error('There is a known issue with version restore. Please contact support.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to restore version');
      }
      setError(error.response?.data?.message || 'Failed to restore version');
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    if (!loading) {
      setReason('');
      setError('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent
        icon={<RotateCcw className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
        title="Restore Version"
        description={`Restore to ${formatVersionNumber(version.version_number)}`}
      >
        {/* Warning Message */}
        <div className="flex items-start gap-3 mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-900 dark:text-yellow-100">
              Restoring to {formatVersionNumber(version.version_number)}
            </p>
            <p className="text-yellow-800 dark:text-yellow-200 mt-1">
              This will create a backup of the current state and restore the quote to the selected version. A new version will be created.
            </p>
          </div>
        </div>

        {/* Version Info */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-sm mb-3 text-gray-900 dark:text-gray-100">
            Version Details
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Version:</span>
              <span className="font-semibold">
                {formatVersionNumber(version.version_number)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Created:</span>
              <span className="font-medium">{formatDate(version.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Items:</span>
              <span className="font-medium">{versionItemCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total:</span>
              <span className="font-semibold text-lg">{formatMoney(versionTotal)}</span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>What happens next:</strong>
          </p>
          <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>Current quote state will be backed up automatically</li>
            <li>Quote will be restored to version {formatVersionNumber(version.version_number)}</li>
            <li>A new version will be created with your restore reason</li>
            <li>All items, groups, and settings will be restored</li>
          </ul>
        </div>

        {/* Required Reason */}
        <Textarea
          label="Reason for Restore *"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError('');
          }}
          placeholder="Customer requested original pricing, correcting error, etc."
          rows={3}
          required
          error={error}
        />

        {/* Known Issue Warning */}
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-800 dark:text-red-200">
            <strong>Note:</strong> There is a known backend issue with version restore that may cause failures. If you encounter an error, please contact support.
          </p>
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleRestore}
          loading={loading}
          disabled={loading || !reason.trim()}
        >
          <RotateCcw className="w-4 h-4" />
          Restore Version
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default RestoreVersionModal;
