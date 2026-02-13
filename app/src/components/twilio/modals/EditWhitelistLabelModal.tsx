/**
 * Edit Whitelist Label Modal
 * Allows Owner/Admin to update the label for a whitelisted phone number
 * Note: Phone number itself cannot be changed (delete and re-add to change number)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Edit } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';

import { updateWhitelistLabel } from '@/lib/api/twilio-tenant';
import type { OfficeWhitelistEntry } from '@/lib/types/twilio-tenant';

interface EditWhitelistLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: OfficeWhitelistEntry | null;
}

export function EditWhitelistLabelModal({
  isOpen,
  onClose,
  onSuccess,
  entry,
}: EditWhitelistLabelModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ phone_number: '', label: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill form when entry changes
  useEffect(() => {
    if (entry) {
      setFormData({
        phone_number: entry.phone_number,
        label: entry.label,
      });
    }
  }, [entry]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Phone number validation (E.164 format)
    if (!formData.phone_number) {
      newErrors.phone_number = 'Phone number is required';
    } else if (!/^\+[1-9]\d{1,14}$/.test(formData.phone_number)) {
      newErrors.phone_number = 'Phone number must be in E.164 format';
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

    if (!validate() || !entry) {
      return;
    }

    try {
      setLoading(true);

      await updateWhitelistLabel(entry.id, formData);

      toast.success('Whitelist entry updated successfully');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error updating whitelist entry:', error);

      // Handle 409 Conflict (duplicate phone number)
      if (error.response?.status === 409) {
        setErrors({ phone_number: 'This phone number is already whitelisted' });
        toast.error('This phone number is already whitelisted');
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to update entry');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ phone_number: '', label: '' });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <form onSubmit={handleSubmit}>
        <ModalContent
          title="Edit Whitelist Entry"
          description="Update the phone number and label for this whitelist entry"
          icon={<Edit className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
        >
          <div className="space-y-4">
            {/* Phone Number Input (Now Editable!) */}
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
            Update Label
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
