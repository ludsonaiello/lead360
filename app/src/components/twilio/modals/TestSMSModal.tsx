/**
 * Test SMS Modal
 * Allows Owner/Admin to send a test SMS by providing destination phone number
 */

'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { MessageSquare } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { PhoneInput } from '@/components/ui/PhoneInput';

import { testSMSConfig } from '@/lib/api/twilio-tenant';

interface TestSMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  configId: string;
  fromPhone: string;
}

export function TestSMSModal({
  isOpen,
  onClose,
  configId,
  fromPhone,
}: TestSMSModalProps) {
  const [loading, setLoading] = useState(false);
  const [toPhone, setToPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone number
    if (!toPhone) {
      setError('Phone number is required');
      return;
    }

    if (!/^\+[1-9]\d{1,14}$/.test(toPhone)) {
      setError('Phone must be in E.164 format (e.g., +19781234567)');
      return;
    }

    // Check if to/from numbers are the same
    if (toPhone === fromPhone) {
      setError(`Cannot send test SMS to the same number (${fromPhone}). Please use a different phone number.`);
      return;
    }

    try {
      setLoading(true);
      const result = await testSMSConfig(configId, toPhone);
      toast.success(`Test SMS sent successfully to ${toPhone}!`);
      onClose();
      setToPhone('');
      setError('');
    } catch (error: any) {
      console.error('Error sending test SMS:', error);
      const message = error.data?.message || 'Failed to send test SMS';
      toast.error(message);

      // Set form error for specific cases
      if (message.includes('same number')) {
        setError('Cannot send to the same number as configured FROM number');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setToPhone('');
      setError('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Send Test SMS"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex gap-3">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Test SMS Configuration
                  </h4>
                  <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                    A test message will be sent from <strong>{fromPhone}</strong> to verify your Twilio configuration.
                  </p>
                </div>
              </div>
            </div>

            {/* Destination Phone Input */}
            <PhoneInput
              label="Send Test SMS To"
              value={toPhone}
              onChange={(e) => {
                setToPhone(e.target.value);
                if (error) setError('');
              }}
              error={error}
              required
              helperText="Enter a phone number to receive the test SMS (must be different from your FROM number)"
              disabled={loading}
              placeholder="(555) 123-4567"
            />

            {/* Warning Notice */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> This will send an actual SMS using your Twilio account. Standard SMS charges apply.
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
          >
            Send Test SMS
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
