/**
 * AcknowledgeAlertModal Component
 * Modal for acknowledging a system alert with optional comment
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/Badge';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { acknowledgeAlert } from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';
import type { SystemAlertDetail } from '@/lib/types/twilio-admin';

export interface AcknowledgeAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: SystemAlertDetail;
  onSuccess: () => void;
}

export function AcknowledgeAlertModal({
  isOpen,
  onClose,
  alert,
  onSuccess,
}: AcknowledgeAlertModalProps) {
  const [comment, setComment] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const handleAcknowledge = async () => {
    setAcknowledging(true);

    try {
      await acknowledgeAlert(alert.id, comment.trim() ? { comment: comment.trim() } : undefined);
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
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Acknowledge Alert" size="md">
        <ModalContent>
          <div className="space-y-4">
            {/* Alert Summary */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <Badge variant={getSeverityVariant(alert.severity)} className="mb-2">
                {alert.severity}
              </Badge>
              <p className="font-medium text-gray-900 dark:text-gray-100">{alert.message}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Created {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
              </p>
            </div>

            {/* Comment Field */}
            <div>
              <Label htmlFor="comment" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Comment (Optional)
              </Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment about this alert (e.g., 'Investigating with dev team')"
                rows={4}
                className="mt-1"
                disabled={acknowledging}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your comment will be visible to other admins in the alert history
              </p>
            </div>

            {/* Info Box */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Note</p>
              <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                Acknowledging an alert marks it as reviewed but does not resolve it. You can
                resolve it later once the issue is fixed.
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button onClick={handleClose} variant="outline" disabled={acknowledging}>
            Cancel
          </Button>
          <Button onClick={handleAcknowledge} disabled={acknowledging} className="bg-blue-600 hover:bg-blue-700 text-white">
            <CheckCircle className="h-4 w-4 mr-1" />
            {acknowledging ? 'Acknowledging...' : 'Acknowledge Alert'}
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Acknowledgement Failed"
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Alert Acknowledged"
        message="The alert has been successfully acknowledged and marked as reviewed."
      />
    </>
  );
}

function getSeverityVariant(severity: string): 'destructive' | 'default' | 'secondary' {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'destructive';
    case 'MEDIUM':
      return 'default';
    default:
      return 'secondary';
  }
}
