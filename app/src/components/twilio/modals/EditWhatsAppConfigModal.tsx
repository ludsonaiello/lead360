/**
 * Edit WhatsApp Configuration Modal
 * Allows Owner/Admin to update existing WhatsApp configuration
 */

'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';

import { updateWhatsAppConfig } from '@/lib/api/twilio-tenant';
import type { WhatsAppConfig, UpdateWhatsAppConfigRequest } from '@/lib/types/twilio-tenant';

interface EditWhatsAppConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  config: WhatsAppConfig;
}

export function EditWhatsAppConfigModal({
  isOpen,
  onClose,
  onSuccess,
  config,
}: EditWhatsAppConfigModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Remove whatsapp: prefix for editing (will be added back by backend)
  const phoneWithoutPrefix = config.from_phone.replace(/^whatsapp:/, '');
  
  const [formData, setFormData] = useState<UpdateWhatsAppConfigRequest>({
    from_phone: phoneWithoutPrefix,
    account_sid: '',
    auth_token: '',
    webhook_secret: '',
    is_active: config.is_active,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Account SID validation (if provided)
    if (formData.account_sid && !/^AC[a-z0-9]{32}$/i.test(formData.account_sid)) {
      newErrors.account_sid = 'Account SID must start with AC and be 34 characters';
    }

    // Auth Token validation (if provided)
    if (formData.auth_token && formData.auth_token.length < 32) {
      newErrors.auth_token = 'Auth Token must be at least 32 characters';
    }

    // From Phone validation (if provided)
    if (formData.from_phone) {
      // Remove whatsapp: prefix if present for validation
      const phoneWithoutPrefix = formData.from_phone.replace(/^whatsapp:/, '');
      if (!/^\+[1-9]\d{1,14}$/.test(phoneWithoutPrefix)) {
        newErrors.from_phone = 'Phone must be in E.164 format';
      }
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

      // Build payload (only include changed fields)
      const payload: UpdateWhatsAppConfigRequest = {};
      if (formData.account_sid) payload.account_sid = formData.account_sid;
      if (formData.auth_token) payload.auth_token = formData.auth_token;
      
      // Check if phone changed (compare without prefix)
      const currentPhoneWithoutPrefix = config.from_phone.replace(/^whatsapp:/, '');
      const newPhoneWithoutPrefix = formData.from_phone?.replace(/^whatsapp:/, '') || '';
      if (newPhoneWithoutPrefix !== currentPhoneWithoutPrefix) {
        payload.from_phone = newPhoneWithoutPrefix;
      }
      
      if (formData.webhook_secret) payload.webhook_secret = formData.webhook_secret;
      if (formData.is_active !== config.is_active) payload.is_active = formData.is_active;

      // Check if any fields changed
      if (Object.keys(payload).length === 0) {
        toast.error('No changes to save');
        return;
      }

      await updateWhatsAppConfig(config.id, payload);
      toast.success('WhatsApp configuration updated successfully');
      onSuccess();
      onClose();

      // Reset credentials fields
      setFormData({
        from_phone: phoneWithoutPrefix,
        account_sid: '',
        auth_token: '',
        webhook_secret: '',
        is_active: config.is_active,
      });
      setErrors({});
    } catch (error: any) {
      console.error('Error updating WhatsApp config:', error);
      const message = error.data?.message || 'Failed to update WhatsApp configuration';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        from_phone: phoneWithoutPrefix,
        account_sid: '',
        auth_token: '',
        webhook_secret: '',
        is_active: config.is_active,
      });
      setErrors({});
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit WhatsApp Configuration"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* From Phone */}
            <PhoneInput
              label="WhatsApp-Enabled Phone Number"
              value={formData.from_phone || ''}
              onChange={(e) => {
                setFormData({ ...formData, from_phone: e.target.value });
                if (errors.from_phone) setErrors({ ...errors, from_phone: '' });
              }}
              error={errors.from_phone}
              helperText="Update your Twilio WhatsApp-enabled phone number. The 'whatsapp:' prefix will be added automatically."
              disabled={loading}
            />

            {/* Account SID (optional update) */}
            <Input
              label="Update Account SID (Optional)"
              name="account_sid"
              value={formData.account_sid || ''}
              onChange={(e) => {
                setFormData({ ...formData, account_sid: e.target.value });
                if (errors.account_sid) setErrors({ ...errors, account_sid: '' });
              }}
              placeholder="Leave empty to keep current value"
              error={errors.account_sid}
              helperText="Only fill if you want to change your Account SID"
              disabled={loading}
            />

            {/* Auth Token (optional update) */}
            <Input
              label="Update Auth Token (Optional)"
              name="auth_token"
              type="password"
              value={formData.auth_token || ''}
              onChange={(e) => {
                setFormData({ ...formData, auth_token: e.target.value });
                if (errors.auth_token) setErrors({ ...errors, auth_token: '' });
              }}
              placeholder="Leave empty to keep current value"
              error={errors.auth_token}
              helperText="Only fill if you want to change your Auth Token"
              disabled={loading}
            />

            {/* Webhook Secret (optional update) */}
            <Input
              label="Update Webhook Secret (Optional)"
              name="webhook_secret"
              value={formData.webhook_secret || ''}
              onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
              placeholder="Leave empty to keep current value"
              helperText="Update webhook secret if needed"
              disabled={loading}
            />

            {/* Security Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> For security, current credentials are never displayed. Leave credential fields empty to keep existing values.
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
            Save Changes
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
