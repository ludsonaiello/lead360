/**
 * ResolveAlertModal Component
 * Modal for resolving a system alert with required resolution notes
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/Badge';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { resolveAlert } from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';
import type { SystemAlertDetail } from '@/lib/types/twilio-admin';

export interface ResolveAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: SystemAlertDetail;
  onSuccess: () => void;
}

export function ResolveAlertModal({
  isOpen,
  onClose,
  alert,
  onSuccess,
}: ResolveAlertModalProps) {
  const [resolution, setResolution] = useState('');
  const [resolving, setResolving] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [error, setError] = useState('');

  const handleResolve = async () => {
    // Validation
    if (!resolution.trim()) {
      setError('Resolution notes are required');
      return;
    }

    setResolving(true);
    setError('');

    try {
      await resolveAlert(alert.id, { resolution: resolution.trim() });
      handleClose();
      setSuccessModalOpen(true);
      onSuccess();
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setResolving(false);
    }
  };

  const handleClose = () => {
    setResolution('');
    setResolving(false);
    setError('');
    onClose();
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Resolve Alert" size="md">
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

            {/* Resolution Notes Field */}
            <div>
              <Label htmlFor="resolution" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Resolution Notes <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="resolution"
                value={resolution}
                onChange={(e) => {
                  setResolution(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Describe how the issue was resolved (e.g., 'Restarted webhook processor service. Issue was caused by memory leak.')"
                rows={5}
                className={`mt-1 ${error ? 'border-red-500' : ''}`}
                disabled={resolving}
              />
              {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
              {!error && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Required - document how this issue was fixed for future reference
                </p>
              )}
            </div>

            {/* Info Box */}
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-900 dark:text-green-200">
                Resolving Alert
              </p>
              <p className="text-xs text-green-800 dark:text-green-300 mt-1">
                This will mark the alert as resolved and close it. The alert and your resolution
                notes will be saved in the history for auditing.
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button onClick={handleClose} variant="outline" disabled={resolving}>
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            disabled={resolving || !resolution.trim()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {resolving ? 'Resolving...' : 'Resolve Alert'}
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Resolution Failed"
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Alert Resolved"
        message="The alert has been successfully resolved and closed. Your resolution notes have been saved."
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
