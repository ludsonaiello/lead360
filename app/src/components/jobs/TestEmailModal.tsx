/**
 * Test Email Modal Component
 * Send test email to verify SMTP configuration
 */

'use client';

import React, { useState } from 'react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CheckCircle, Mail } from 'lucide-react';

interface TestEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (email: string) => Promise<void>;
  isSending: boolean;
}

export function TestEmailModal({ isOpen, onClose, onSend, isSending }: TestEmailModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validate = (): boolean => {
    if (!email) {
      setError('Email address is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email address');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSend = async () => {
    if (!validate()) return;

    try {
      await onSend(email);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        setEmail('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send test email');
    }
  };

  const handleClose = () => {
    setEmail('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Send Test Email" size="md">
      <ModalContent>
        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-green-800 dark:text-green-300 mb-2">
              Test email sent successfully!
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Check your inbox at {email}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="To Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              error={error || undefined}
              autoFocus
            />
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded">
              <Mail className="w-4 h-4 inline-block mr-1" />
              This will send a test email using your current SMTP settings.
            </div>
          </div>
        )}
      </ModalContent>

      {!success && (
        <ModalActions>
          <Button variant="secondary" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSend} disabled={isSending || !email}>
            {isSending ? 'Sending...' : 'Send Test Email'}
          </Button>
        </ModalActions>
      )}
    </Modal>
  );
}

export default TestEmailModal;
