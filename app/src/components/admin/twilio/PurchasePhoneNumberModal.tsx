/**
 * PurchasePhoneNumberModal Component
 * Modal for purchasing a new Twilio phone number
 */

'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AlertTriangle } from 'lucide-react';
import type { PurchasePhoneNumberDto, Tenant } from '@/lib/types/twilio-admin';

export interface PurchasePhoneNumberModalProps {
  open: boolean;
  onClose: () => void;
  onPurchase: (data: PurchasePhoneNumberDto) => Promise<void>;
  tenants: Tenant[];
}

export function PurchasePhoneNumberModal({
  open,
  onClose,
  onPurchase,
  tenants
}: PurchasePhoneNumberModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [purpose, setPurpose] = useState<'SMS Only' | 'Calls Only' | 'SMS + Calls' | 'WhatsApp'>('SMS + Calls');
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async () => {
    if (!phoneNumber) {
      setError('Phone number is required');
      return;
    }

    setPurchasing(true);
    setError(null);
    try {
      await onPurchase({
        phone_number: phoneNumber,
        tenant_id: tenantId || undefined,
        purpose
      });
      // Reset form
      setPhoneNumber('');
      setTenantId('');
      setPurpose('SMS + Calls');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to purchase phone number');
    } finally {
      setPurchasing(false);
    }
  };

  const handleClose = () => {
    if (!purchasing) {
      setPhoneNumber('');
      setTenantId('');
      setPurpose('SMS + Calls');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={open} onClose={handleClose} size="md">
      <ModalContent title="Purchase Phone Number">
        <div className="space-y-4">
          {/* Phone Number Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <Input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+15555555555"
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Enter the phone number you want to purchase (E.164 format)
            </p>
          </div>

          {/* Tenant Selection (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Allocate to Tenant (Optional)
            </label>
            <Select
              value={tenantId}
              onChange={(value) => setTenantId(value)}
              options={[
                { value: '', label: 'None (Keep Available)' },
                ...tenants.map((tenant) => ({
                  value: tenant.id,
                  label: tenant.company_name
                }))
              ]}
              searchable={true}
              className="w-full"
            />
          </div>

          {/* Purpose Selection (only if tenant selected) */}
          {tenantId && (
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
          )}

          {/* Warning Notice */}
          <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Note
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Purchasing a number will charge your Twilio account. Monthly cost is typically $1.00/month.
              </p>
            </div>
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
        <Button onClick={handleClose} variant="outline" disabled={purchasing}>
          Cancel
        </Button>
        <Button onClick={handlePurchase} variant="primary" disabled={purchasing || !phoneNumber}>
          {purchasing ? 'Purchasing...' : 'Purchase Number'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
