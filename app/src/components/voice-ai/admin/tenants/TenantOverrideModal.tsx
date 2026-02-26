'use client';

// ============================================================================
// TenantOverrideModal Component
// ============================================================================
// Modal form for managing admin overrides for tenant Voice AI settings
// ============================================================================

import React, { useState } from 'react';
import { X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import TenantOverrideForm from './TenantOverrideForm';
import type { TenantVoiceAISummary, VoiceAIProvider } from '@/lib/types/voice-ai';

interface TenantOverrideModalProps {
  tenant: TenantVoiceAISummary;
  providers: VoiceAIProvider[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * TenantOverrideModal - Modal wrapper for tenant override form
 */
export default function TenantOverrideModal({
  tenant,
  providers,
  isOpen,
  onClose,
  onSuccess,
}: TenantOverrideModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Override Settings - ${tenant.company_name}`}
      size="2xl"
    >
      <div className="space-y-4">
        {/* Tenant Info */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Plan:
              </span>{' '}
              <span className="text-gray-900 dark:text-gray-100">
                {tenant.plan_name}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Current Status:
              </span>{' '}
              <span
                className={
                  tenant.is_enabled
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-400'
                }
              >
                {tenant.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Minutes Used:
              </span>{' '}
              <span className="text-gray-900 dark:text-gray-100">
                {tenant.minutes_used} / {tenant.minutes_included}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Has Override:
              </span>{' '}
              <span
                className={
                  tenant.has_admin_override
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-gray-600 dark:text-gray-400'
                }
              >
                {tenant.has_admin_override ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <TenantOverrideForm
          tenantId={tenant.tenant_id}
          providers={providers}
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      </div>
    </Modal>
  );
}
