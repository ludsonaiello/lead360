/**
 * DeleteEventModal Component
 * Modal for deleting a communication event with safety checks
 */

'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { deleteCommunicationEvent } from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';
import type { CommunicationEvent } from '@/lib/types/twilio-admin';

export interface DeleteEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CommunicationEvent;
  onSuccess: () => void;
}

export function DeleteEventModal({ isOpen, onClose, event, onSuccess }: DeleteEventModalProps) {
  const [reason, setReason] = useState('');
  const [forceDelete, setForceDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [error, setError] = useState('');

  const isDelivered = event.status === 'delivered' || event.status === 'sent';

  const handleDelete = async () => {
    // Validation
    if (!reason.trim()) {
      setError('Please provide a reason for deleting this event');
      return;
    }

    if (isDelivered && !forceDelete) {
      setError('You must check the force delete option to delete a delivered/sent message');
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await deleteCommunicationEvent(event.id, {
        reason: reason.trim(),
        force: forceDelete || undefined,
      });
      handleClose();
      setSuccessModalOpen(true);
      onSuccess();
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setForceDelete(false);
    setDeleting(false);
    setError('');
    onClose();
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Delete Communication Event" size="md">
        <ModalContent>
          <div className="space-y-4">
            {/* Event Summary */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{event.channel.toUpperCase()}</Badge>
                <Badge
                  variant={
                    event.status === 'delivered' || event.status === 'sent'
                      ? 'default'
                      : 'destructive'
                  }
                >
                  {event.status}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">To:</span> {event.to_phone}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">From:</span> {event.from_phone}
                </p>
                {event.text_body && (
                  <p className="text-gray-700 dark:text-gray-300 mt-2 p-2 bg-white dark:bg-gray-800 rounded text-xs">
                    {event.text_body}
                  </p>
                )}
              </div>
            </div>

            {/* Reason */}
            <div>
              <Label htmlFor="reason" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Reason for Deletion <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Explain why you're deleting this event (e.g., 'Test message sent to production by mistake')"
                rows={4}
                className={`mt-1 ${error ? 'border-red-500' : ''}`}
                disabled={deleting}
              />
              {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
              {!error && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This reason will be logged for audit purposes
                </p>
              )}
            </div>

            {/* Force Delete Checkbox (only for delivered/sent messages) */}
            {isDelivered && (
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={forceDelete}
                    onCheckedChange={(checked) => {
                      setForceDelete(checked as boolean);
                      if (error) setError('');
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-200">
                      Force delete delivered/sent message
                    </p>
                    <p className="text-xs text-red-800 dark:text-red-300 mt-1">
                      This message was successfully delivered/sent. Deleting it will only remove
                      it from our records, not from the recipient's device.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Warning Box */}
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Permanent Action
              </p>
              <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                This action cannot be undone. The event will be permanently deleted from the
                system, but your deletion will be logged for audit purposes.
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button onClick={handleClose} variant="outline" disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting || !reason.trim() || (isDelivered && !forceDelete)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {deleting ? 'Deleting...' : 'Delete Event'}
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Deletion Failed"
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Event Deleted"
        message="The communication event has been permanently deleted and your action has been logged for audit."
      />
    </>
  );
}
