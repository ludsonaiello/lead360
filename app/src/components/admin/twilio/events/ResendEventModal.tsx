/**
 * ResendEventModal Component
 * Modal for resending a failed communication event
 */

'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { resendCommunicationEvent } from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';
import type { CommunicationEvent } from '@/lib/types/twilio-admin';

export interface ResendEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CommunicationEvent;
  onSuccess: () => void;
}

export function ResendEventModal({ isOpen, onClose, event, onSuccess }: ResendEventModalProps) {
  const [resending, setResending] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const handleResend = async () => {
    setResending(true);

    try {
      await resendCommunicationEvent(event.id);
      handleClose();
      setSuccessModalOpen(true);
      onSuccess();
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setResending(false);
    }
  };

  const handleClose = () => {
    setResending(false);
    onClose();
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Resend Communication Event" size="md">
        <ModalContent>
          <div className="space-y-4">
            {/* Event Summary */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{event.channel.toUpperCase()}</Badge>
                <Badge variant={event.status === 'failed' ? 'destructive' : 'default'}>
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
                  <p className="text-gray-700 dark:text-gray-300 mt-2 p-2 bg-white dark:bg-gray-800 rounded">
                    {event.text_body}
                  </p>
                )}
              </div>
            </div>

            {/* Warning Box */}
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">Warning</p>
              <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                This will queue the message for retry. The recipient may receive a duplicate
                message if the original was actually delivered.
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button onClick={handleClose} variant="outline" disabled={resending}>
            Cancel
          </Button>
          <Button onClick={handleResend} disabled={resending} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Send className="h-4 w-4 mr-1" />
            {resending ? 'Resending...' : 'Resend Message'}
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Resend Failed"
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Message Queued for Retry"
        message="The message has been successfully queued for retry and will be processed shortly."
      />
    </>
  );
}
