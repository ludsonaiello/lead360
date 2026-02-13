/**
 * Test WhatsApp Modal
 * Allows Owner/Admin to send a test WhatsApp message (self-test to configured number)
 */

'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { MessageCircle } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';

import { testWhatsAppConfig } from '@/lib/api/twilio-tenant';

interface TestWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  configId: string;
  fromPhone: string;
}

export function TestWhatsAppModal({
  isOpen,
  onClose,
  configId,
  fromPhone,
}: TestWhatsAppModalProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      const result = await testWhatsAppConfig(configId);
      toast.success(
        `Test WhatsApp message sent successfully!\nTwilio Message SID: ${result.twilio_message_sid}`,
        { duration: 5000 }
      );
      onClose();
    } catch (error: any) {
      console.error('Error sending test WhatsApp:', error);
      const message = error.data?.message || 'Failed to send test WhatsApp message';
      const hint = error.data?.hint;

      if (hint) {
        toast.error(`${message}\n\n${hint}`, { duration: 5000 });
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Send Test WhatsApp Message"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex gap-3">
                <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-green-900 dark:text-green-100">
                    Test WhatsApp Configuration
                  </h4>
                  <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                    A test WhatsApp message will be sent to <strong className="font-mono">{fromPhone}</strong> to verify your Twilio WhatsApp configuration.
                  </p>
                </div>
              </div>
            </div>

            {/* WhatsApp Business Account Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This number must be associated with an approved WhatsApp Business Account. First messages to new contacts may require template approval.
              </p>
            </div>

            {/* Warning Notice */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> This will send an actual WhatsApp message using your Twilio account. Standard WhatsApp messaging charges apply.
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
            Send Test WhatsApp
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
