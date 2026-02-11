/**
 * EditWebhookConfigModal Component
 * Modal for editing webhook configuration
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { AlertTriangle } from 'lucide-react';
import type { WebhookConfig, UpdateWebhookConfigDto } from '@/lib/types/twilio-admin';

export interface EditWebhookConfigModalProps {
  open: boolean;
  onClose: () => void;
  currentConfig: WebhookConfig;
  onSave: (data: UpdateWebhookConfigDto) => Promise<void>;
}

export function EditWebhookConfigModal({
  open,
  onClose,
  currentConfig,
  onSave
}: EditWebhookConfigModalProps) {
  const [baseUrl, setBaseUrl] = useState(currentConfig.base_url);
  const [signatureVerification, setSignatureVerification] = useState(currentConfig.security.signature_verification);
  const [rotateSecret, setRotateSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens or config changes
  useEffect(() => {
    if (open) {
      setBaseUrl(currentConfig.base_url);
      setSignatureVerification(currentConfig.security.signature_verification);
      setRotateSecret(false);
      setError(null);
    }
  }, [open, currentConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        base_url: baseUrl,
        signature_verification: signatureVerification,
        rotate_secret: rotateSecret
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update webhook configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="md">
      <ModalContent title="Edit Webhook Configuration">
        <div className="space-y-4">
          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Base URL
            </label>
            <Input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.lead360.app"
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Base URL for all webhook endpoints
            </p>
          </div>

          {/* Signature Verification */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Signature Verification
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Verify webhook signatures for security
              </p>
            </div>
            <ToggleSwitch
              enabled={signatureVerification}
              onChange={setSignatureVerification}
            />
          </div>

          {/* Rotate Webhook Secret */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Rotate Webhook Secret
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Generate new webhook secret (invalidates old secret)
              </p>
            </div>
            <ToggleSwitch
              enabled={rotateSecret}
              onChange={setRotateSecret}
            />
          </div>

          {/* Warning for Secret Rotation */}
          {rotateSecret && (
            <div className="flex gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Warning: Secret Rotation
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Rotating the webhook secret will invalidate the old secret. Ensure you update
                  all webhook configurations in Twilio with the new secret.
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
          )}
        </div>
      </ModalContent>

      <ModalActions>
        <Button onClick={onClose} variant="outline" disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
