/**
 * BulkAcknowledgeAlertsModal Component
 * Modal for bulk acknowledging multiple alerts with optional comment
 */

'use client';

import React, { useState } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/Textarea';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { bulkAcknowledgeAlerts } from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';

export interface BulkAcknowledgeAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAlertIds: string[];
  onSuccess: () => void;
}

export function BulkAcknowledgeAlertsModal({
  isOpen,
  onClose,
  selectedAlertIds,
  onSuccess,
}: BulkAcknowledgeAlertsModalProps) {
  const [comment, setComment] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [result, setResult] = useState<{
    acknowledged_count: number;
    not_found_count: number;
    total: number;
  } | null>(null);

  const handleAcknowledge = async () => {
    setAcknowledging(true);

    try {
      const response = await bulkAcknowledgeAlerts({
        alert_ids: selectedAlertIds,
        comment: comment.trim() || undefined,
      });

      setResult({
        acknowledged_count: response.acknowledged_count,
        not_found_count: response.not_found_ids.length,
        total: response.total_requested,
      });

      handleClose();
      setSuccessModalOpen(true);
      onSuccess();
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setAcknowledging(false);
    }
  };

  const handleClose = () => {
    setComment('');
    setAcknowledging(false);
    onClose();
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
    setResult(null);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Acknowledge Alerts" size="md">
        <ModalContent>
          <div className="space-y-4">
            {/* Bulk Action Info */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                Bulk Action
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                You are about to acknowledge {selectedAlertIds.length} alert(s) with the same
                comment.
              </p>
            </div>

            {/* Comment Field */}
            <div>
              <Label
                htmlFor="bulkComment"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Comment (Optional)
              </Label>
              <Textarea
                id="bulkComment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment for all selected alerts (e.g., 'All related to same Twilio outage')"
                rows={4}
                className="mt-1"
                disabled={acknowledging}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This comment will be applied to all selected alerts
              </p>
            </div>

            {/* Best-Effort Notice */}
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Best-Effort Operation
              </p>
              <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                This operation will acknowledge all valid alerts. If any alert IDs are invalid or
                not found, they will be skipped and reported in the results.
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button onClick={handleClose} variant="secondary" disabled={acknowledging}>
            Cancel
          </Button>
          <Button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {acknowledging
              ? 'Acknowledging...'
              : `Acknowledge ${selectedAlertIds.length} Alert(s)`}
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Bulk Acknowledgement Failed"
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Bulk Acknowledgement Complete"
        message={
          result
            ? `Successfully acknowledged ${result.acknowledged_count} alert(s).${
                result.not_found_count > 0
                  ? ` ${result.not_found_count} alert(s) were not found or invalid.`
                  : ''
              }`
            : 'Alerts have been successfully acknowledged.'
        }
      />
    </>
  );
}
