/**
 * AllocatePhoneNumberModal Component
 * Modal for allocating a phone number to a tenant
 */

'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { PhoneNumber, AllocatePhoneNumberDto, Tenant } from '@/lib/types/twilio-admin';

export interface AllocatePhoneNumberModalProps {
  open: boolean;
  onClose: () => void;
  phoneNumber: PhoneNumber | null;
  tenants: Tenant[];
  onAllocate: (sid: string, data: AllocatePhoneNumberDto) => Promise<void>;
}

export function AllocatePhoneNumberModal({
  open,
  onClose,
  phoneNumber,
  tenants,
  onAllocate
}: AllocatePhoneNumberModalProps) {
  const [tenantId, setTenantId] = useState('');
  const [purpose, setPurpose] = useState<'SMS Only' | 'Calls Only' | 'SMS + Calls' | 'WhatsApp'>('SMS + Calls');
  const [allocating, setAllocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!phoneNumber) return null;

  const handleAllocate = async () => {
    if (!tenantId) {
      setError('Please select a tenant');
      return;
    }

    setAllocating(true);
    setError(null);
    try {
      await onAllocate(phoneNumber.sid, {
        tenant_id: tenantId,
        purpose
      });
      // Reset form
      setTenantId('');
      setPurpose('SMS + Calls');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to allocate phone number');
    } finally {
      setAllocating(false);
    }
  };

  const handleClose = () => {
    if (!allocating) {
      setTenantId('');
      setPurpose('SMS + Calls');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={open} onClose={handleClose} size="md">
      <ModalContent title="Allocate Phone Number">
        <div className="space-y-4">
          {/* Phone Number Display */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Phone Number
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {phoneNumber.friendly_name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {phoneNumber.phone_number}
            </p>
          </div>

          {/* Tenant Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Tenant <span className="text-red-500">*</span>
            </label>
            <Select
              value={tenantId}
              onChange={(value) => setTenantId(value)}
              options={[
                { value: '', label: 'Choose a tenant' },
                ...tenants.map((tenant) => ({
                  value: tenant.id,
                  label: tenant.company_name
                }))
              ]}
              searchable={true}
              className="w-full"
            />
          </div>

          {/* Purpose Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Purpose
            </label>
            <Select
              value={purpose}
              onChange={(value) => setPurpose(value as any)}
              options={[
                { value: 'SMS Only', label: 'SMS Only' },
                { value: 'Calls Only', label: 'Calls Only' },
                { value: 'SMS + Calls', label: 'SMS + Calls' },
                { value: 'WhatsApp', label: 'WhatsApp' }
              ]}
              className="w-full"
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
        <Button onClick={handleClose} variant="secondary" disabled={allocating}>
          Cancel
        </Button>
        <Button onClick={handleAllocate} variant="primary" disabled={allocating || !tenantId}>
          {allocating ? 'Allocating...' : 'Allocate Number'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
