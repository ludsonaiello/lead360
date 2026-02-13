/**
 * Create SMS Configuration Modal
 * Allows Owner/Admin to create new SMS configuration with Twilio credentials
 */

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { AlertCircle } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';

import { createSMSConfig } from '@/lib/api/twilio-tenant';
import { getAvailableProviders } from '@/lib/api/communication';
import type { CreateSMSConfigRequest } from '@/lib/types/twilio-tenant';
import type { CommunicationProvider } from '@/lib/types/communication';

interface CreateSMSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateSMSConfigModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSMSConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [fetchingProvider, setFetchingProvider] = useState(true);
  const [providerId, setProviderId] = useState<string>('');

  const [formData, setFormData] = useState<CreateSMSConfigRequest>({
    provider_id: '',
    account_sid: '',
    auth_token: '',
    from_phone: '',
    webhook_secret: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch Twilio SMS provider_id on mount
  useEffect(() => {
    if (isOpen) {
      fetchTwilioSMSProvider();
    }
  }, [isOpen]);

  const fetchTwilioSMSProvider = async () => {
    try {
      setFetchingProvider(true);

      // Fetch SMS providers
      const providers = await getAvailableProviders({ type: 'sms' });

      // Find Twilio SMS provider
      const twilioSmsProvider = providers.find(
        (p: CommunicationProvider) => p.provider_key === 'twilio_sms'
      );

      if (!twilioSmsProvider) {
        toast.error('Twilio SMS provider not found. Contact your administrator.');
        onClose();
        return;
      }

      setProviderId(twilioSmsProvider.id);
      setFormData(prev => ({ ...prev, provider_id: twilioSmsProvider.id }));
    } catch (error: any) {
      console.error('Error fetching Twilio SMS provider:', error);
      toast.error('Failed to load SMS provider configuration');
      onClose();
    } finally {
      setFetchingProvider(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Account SID validation
    if (!formData.account_sid) {
      newErrors.account_sid = 'Account SID is required';
    } else if (!/^AC[a-z0-9]{32}$/i.test(formData.account_sid)) {
      newErrors.account_sid = 'Account SID must start with AC and be 34 characters (AC + 32 alphanumeric)';
    }

    // Auth Token validation
    if (!formData.auth_token) {
      newErrors.auth_token = 'Auth Token is required';
    } else if (formData.auth_token.length < 32) {
      newErrors.auth_token = 'Auth Token must be at least 32 characters';
    }

    // From Phone validation
    if (!formData.from_phone) {
      newErrors.from_phone = 'Phone number is required';
    } else if (!/^\+[1-9]\d{1,14}$/.test(formData.from_phone)) {
      newErrors.from_phone = 'Phone must be in E.164 format (e.g., +19781234567)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      setLoading(true);

      // Remove webhook_secret if empty
      const payload = { ...formData };
      if (!payload.webhook_secret) {
        delete payload.webhook_secret;
      }

      await createSMSConfig(payload);
      toast.success('SMS configuration created successfully');
      onSuccess();
      onClose();

      // Reset form
      setFormData({
        provider_id: providerId,
        account_sid: '',
        auth_token: '',
        from_phone: '',
        webhook_secret: '',
      });
      setErrors({});
    } catch (error: any) {
      console.error('Error creating SMS config:', error);
      const message = error.data?.message || 'Failed to create SMS configuration';
      toast.error(message);

      // Handle specific errors
      if (error.status === 409) {
        setErrors({ account_sid: 'Active SMS configuration already exists. Deactivate existing config first.' });
      } else if (error.status === 400) {
        // Invalid credentials
        setErrors({ account_sid: 'Invalid Twilio credentials. Please check Account SID and Auth Token.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        provider_id: providerId,
        account_sid: '',
        auth_token: '',
        from_phone: '',
        webhook_secret: '',
      });
      setErrors({});
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Configure SMS Provider"
      size="lg"
    >
      {fetchingProvider ? (
        <div className="py-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading provider configuration...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <ModalContent>
            <div className="space-y-4">
              {/* Account SID */}
              <Input
                label="Twilio Account SID"
                name="account_sid"
                value={formData.account_sid}
                onChange={(e) => {
                  setFormData({ ...formData, account_sid: e.target.value });
                  if (errors.account_sid) setErrors({ ...errors, account_sid: '' });
                }}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                error={errors.account_sid}
                required
                helperText="Your Twilio Account SID (starts with AC, 34 characters)"
                disabled={loading}
              />

              {/* Auth Token */}
              <Input
                label="Twilio Auth Token"
                name="auth_token"
                type="password"
                value={formData.auth_token}
                onChange={(e) => {
                  setFormData({ ...formData, auth_token: e.target.value });
                  if (errors.auth_token) setErrors({ ...errors, auth_token: '' });
                }}
                placeholder="Enter your Twilio Auth Token"
                error={errors.auth_token}
                required
                helperText="Your Twilio Auth Token (at least 32 characters, will be encrypted)"
                disabled={loading}
              />

              {/* From Phone */}
              <PhoneInput
                label="Twilio Phone Number"
                value={formData.from_phone}
                onChange={(e) => {
                  setFormData({ ...formData, from_phone: e.target.value });
                  if (errors.from_phone) setErrors({ ...errors, from_phone: '' });
                }}
                error={errors.from_phone}
                required
                helperText="Your Twilio phone number in E.164 format (e.g., +19781234567)"
                disabled={loading}
              />

              {/* Webhook Secret (Optional) */}
              <Input
                label="Webhook Secret (Optional)"
                name="webhook_secret"
                value={formData.webhook_secret || ''}
                onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
                placeholder="Optional webhook secret for signature verification"
                helperText="Optional secret for Twilio webhook signature verification"
                disabled={loading}
              />

              {/* Security Notice */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                      Security
                    </h4>
                    <p className="mt-1 text-xs text-yellow-800 dark:text-yellow-200">
                      Your credentials will be encrypted before storage and validated against Twilio's API before saving.
                    </p>
                  </div>
                </div>
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
              disabled={fetchingProvider}
            >
              Create Configuration
            </Button>
          </ModalActions>
        </form>
      )}
    </Modal>
  );
}
