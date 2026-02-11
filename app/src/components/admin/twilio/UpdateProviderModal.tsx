/**
 * UpdateProviderModal Component
 * Form to update Twilio system provider credentials
 */

'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { updateSystemProvider } from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';

export interface UpdateProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UpdateProviderModal({ isOpen, onClose, onSuccess }: UpdateProviderModalProps) {
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  // Validation logic
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!accountSid.trim()) {
      newErrors.account_sid = 'Account SID is required';
    } else if (!/^AC[a-z0-9]{32}$/.test(accountSid)) {
      newErrors.account_sid = 'Invalid Account SID format (must start with AC and be 34 characters)';
    }

    if (!authToken.trim()) {
      newErrors.auth_token = 'Auth Token is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      await updateSystemProvider({
        account_sid: accountSid,
        auth_token: authToken,
      });

      // Close modal immediately and show success
      handleClose();
      onSuccess();
      setSuccessModalOpen(true);
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
      setSubmitting(false);
    }
  };

  // Handle success modal close
  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
  };

  // Handle modal close
  const handleClose = () => {
    setAccountSid('');
    setAuthToken('');
    setErrors({});
    setSubmitting(false);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Update Provider Credentials"
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <ModalContent>
            <div className="space-y-4">
              {/* Warning Banner */}
              <div className="flex gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Important: Update Impact
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Updating credentials will affect all communication services. Make sure the new credentials are valid.
                  </p>
                </div>
              </div>

              {/* Account SID */}
              <div>
                <label htmlFor="account_sid" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Account SID <span className="text-red-500">*</span>
                </label>
                <Input
                  id="account_sid"
                  type="text"
                  value={accountSid}
                  onChange={(e) => {
                    setAccountSid(e.target.value);
                    if (errors.account_sid) {
                      setErrors({ ...errors, account_sid: '' });
                    }
                  }}
                  placeholder="AC1234567890abcdef1234567890abcd"
                  error={errors.account_sid}
                  disabled={submitting}
                />
                {!errors.account_sid && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Must start with AC and be exactly 34 characters
                  </p>
                )}
              </div>

              {/* Auth Token */}
              <div>
                <label htmlFor="auth_token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Auth Token <span className="text-red-500">*</span>
                </label>
                <Input
                  id="auth_token"
                  type="password"
                  value={authToken}
                  onChange={(e) => {
                    setAuthToken(e.target.value);
                    if (errors.auth_token) {
                      setErrors({ ...errors, auth_token: '' });
                    }
                  }}
                  placeholder="Your Twilio Auth Token"
                  error={errors.auth_token}
                  disabled={submitting}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Found in your Twilio Console under Account Settings
                </p>
              </div>
            </div>
          </ModalContent>

          <ModalActions>
            <Button
              type="button"
              onClick={handleClose}
              variant="secondary"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Update Credentials'}
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Update Failed"
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Credentials Updated"
        message="Your Twilio provider credentials have been successfully updated."
      />
    </>
  );
}
