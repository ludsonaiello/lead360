/**
 * DeallocatePhoneNumberModal Component
 * Modal for deallocating a phone number from a tenant
 */

'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { AlertTriangle } from 'lucide-react';
import type { PhoneNumber, DeallocatePhoneNumberDto } from '@/lib/types/twilio-admin';

export interface DeallocatePhoneNumberModalProps {
  open: boolean;
  onClose: () => void;
  phoneNumber: PhoneNumber | null;
  onDeallocate: (sid: string, data: DeallocatePhoneNumberDto) => Promise<void>;
}

export function DeallocatePhoneNumberModal({
  open,
  onClose,
  phoneNumber,
  onDeallocate
}: DeallocatePhoneNumberModalProps) {
  const [deleteConfig, setDeleteConfig] = useState(false);
  const [reason, setReason] = useState('');
  const [deallocating, setDeallocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!phoneNumber) return null;

  const handleDeallocate = async () => {
    setDeallocating(true);
    setError(null);
    try {
      await onDeallocate(phoneNumber.sid, {
        delete_config: deleteConfig,
        reason: reason || undefined
      });
      // Reset form
      setDeleteConfig(false);
      setReason('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to deallocate phone number');
    } finally {
      setDeallocating(false);
    }
  };

  const handleClose = () => {
    if (!deallocating) {
      setDeleteConfig(false);
      setReason('');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={open} onClose={handleClose} size="md">
      <ModalContent title="Deallocate Phone Number">
        <div className="space-y-4">
          {/* Warning */}
          <div className="flex gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Deallocate Number
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                This will remove the number from {phoneNumber.allocated_to_tenant?.company_name} and
                make it available for reallocation.
              </p>
            </div>
          </div>

          {/* Phone Number Display */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Phone Number
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {phoneNumber.friendly_name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Currently allocated to: <span className="font-medium">{phoneNumber.allocated_to_tenant?.company_name}</span>
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason (Optional)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for deallocation (for audit log)"
              rows={3}
              className="w-full"
            />
          </div>

          {/* Delete Config Toggle */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Also Delete Tenant Configuration
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Remove the SMS/WhatsApp config that uses this number
              </p>
            </div>
            <ToggleSwitch
              enabled={deleteConfig}
              onChange={(value) => setDeleteConfig(value)}
            />
          </div>

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
        <Button onClick={handleClose} variant="secondary" disabled={deallocating}>
          Cancel
        </Button>
        <Button onClick={handleDeallocate} variant="danger" disabled={deallocating}>
          {deallocating ? 'Deallocating...' : 'Deallocate Number'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
