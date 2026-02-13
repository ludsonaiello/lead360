/**
 * Add Phone to Whitelist Modal
 * Allows Owner/Admin to add phone numbers to office bypass whitelist
 * Whitelisted numbers bypass IVR and can make outbound calls
 */

'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Shield } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';

import { addPhoneToWhitelist } from '@/lib/api/twilio-tenant';
import type { AddPhoneToWhitelistRequest } from '@/lib/types/twilio-tenant';

interface AddPhoneWhitelistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPhoneWhitelistModal({
  isOpen,
  onClose,
  onSuccess,
}: AddPhoneWhitelistModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AddPhoneToWhitelistRequest>({
    phone_number: '',
    label: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Phone number validation (E.164 format)
    if (!formData.phone_number) {
      newErrors.phone_number = 'Phone number is required';
    } else if (!/^\+[1-9]\d{1,14}$/.test(formData.phone_number)) {
      newErrors.phone_number =
        'Phone number must be in E.164 format (e.g., +12025551234)';
    }

    // Label validation
    if (!formData.label) {
      newErrors.label = 'Label is required';
    } else if (formData.label.length < 1 || formData.label.length > 100) {
      newErrors.label = 'Label must be between 1 and 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);

      await addPhoneToWhitelist(formData);

      toast.success('Phone number added to whitelist');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error adding phone to whitelist:', error);

      // Handle 409 Conflict (duplicate phone number)
      if (error.response?.status === 409) {
        setErrors({ phone_number: 'This phone number is already whitelisted' });
        toast.error('This phone number is already whitelisted');
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to add phone number to whitelist');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      phone_number: '',
      label: '',
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <form onSubmit={handleSubmit}>
        <ModalContent
          title="Add Phone to Whitelist"
          description="Whitelisted phone numbers bypass IVR and can make outbound calls using company's phone number"
          icon={<Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
        >
          <div className="space-y-4">
            {/* Security Notice */}
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Security Notice</p>
              <p className="text-xs">
                Verify phone number ownership before adding to whitelist. Regularly audit entries.
              </p>
            </div>

            {/* Phone Number Input */}
            <PhoneInput
              label="Phone Number"
              value={formData.phone_number}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone_number: e.target.value }))
              }
              error={errors.phone_number}
              required
              placeholder="(555) 123-4567"
              helpText="10-digit US phone number (auto-converts to E.164 format)"
            />

            {/* Label Input */}
            <Input
              label="Label"
              value={formData.label}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, label: e.target.value }))
              }
              error={errors.label}
              required
              placeholder="e.g., John Doe - Sales Manager's Mobile"
              helpText="Descriptive label to identify this phone number (1-100 characters)"
              maxLength={100}
            />

            {/* Label Guidelines */}
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p className="font-medium">Recommended format: &quot;Name - Role/Purpose&quot;</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>John Doe - Sales Manager&apos;s Mobile</li>
                <li>Office Phone - Front Desk</li>
                <li>Jane Smith - VP of Operations</li>
              </ul>
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
          <Button type="submit" variant="primary" loading={loading}>
            Add to Whitelist
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
