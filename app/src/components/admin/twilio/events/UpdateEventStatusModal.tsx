/**
 * UpdateEventStatusModal Component
 * Modal for manually updating communication event status
 */

'use client';

import React, { useState } from 'react';
import { Edit } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { updateCommunicationEventStatus } from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';
import type { CommunicationEvent } from '@/lib/types/twilio-admin';

export interface UpdateEventStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CommunicationEvent;
  onSuccess: () => void;
}

export function UpdateEventStatusModal({
  isOpen,
  onClose,
  event,
  onSuccess,
}: UpdateEventStatusModalProps) {
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [error, setError] = useState('');

  const handleUpdate = async () => {
    // Validation
    if (!newStatus) {
      setError('Please select a new status');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for this status update');
      return;
    }

    setUpdating(true);
    setError('');

    try {
      await updateCommunicationEventStatus(event.id, {
        status: newStatus,
        reason: reason.trim(),
      });
      handleClose();
      setSuccessModalOpen(true);
      onSuccess();
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setUpdating(false);
    }
  };

  const handleClose = () => {
    setNewStatus('');
    setReason('');
    setUpdating(false);
    setError('');
    onClose();
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Update Event Status" size="md">
        <ModalContent>
          <div className="space-y-4">
            {/* Event Summary */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="neutral">{event.channel.toUpperCase()}</Badge>
                <Badge variant={event.status === 'failed' ? 'danger' : 'neutral'}>
                  Current: {event.status}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">To:</span> {event.to_phone}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">From:</span> {event.from_phone}
                </p>
              </div>
            </div>

            {/* New Status */}
            <div>
              <Label htmlFor="newStatus" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                New Status <span className="text-red-500">*</span>
              </Label>
              <select
                id="newStatus"
                value={newStatus}
                onChange={(e) => {
                  setNewStatus(e.target.value);
                  if (error) setError('');
                }}
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={updating}
              >
                <option value="">Select status...</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
                <option value="bounced">Bounced</option>
              </select>
            </div>

            {/* Reason */}
            <div>
              <Label htmlFor="reason" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Reason for Update <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Explain why you're manually updating this status (e.g., 'Webhook missed, confirmed delivery with recipient')"
                rows={4}
                className={`mt-1 ${error ? 'border-red-500' : ''}`}
                disabled={updating}
              />
              {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
              {!error && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This reason will be logged for audit purposes
                </p>
              )}
            </div>

            {/* Warning Box */}
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">Caution</p>
              <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                Manual status updates should only be used when the automatic status is incorrect.
                This action will be logged with your admin account.
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button onClick={handleClose} variant="secondary" disabled={updating}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={updating || !newStatus || !reason.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Edit className="h-4 w-4 mr-1" />
            {updating ? 'Updating...' : 'Update Status'}
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Status Update Failed"
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Status Updated"
        message="The event status has been successfully updated and logged for audit."
      />
    </>
  );
}
