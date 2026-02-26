// ============================================================================
// Plan Voice Config Modal Component
// ============================================================================
// Modal for editing Voice AI configuration for a subscription plan
// ============================================================================

'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import PlanVoiceConfigForm from './PlanVoiceConfigForm';
import voiceAiApi from '@/lib/api/voice-ai';
import type { SubscriptionPlan, UpdatePlanVoiceConfigRequest } from '@/lib/types/voice-ai';
import { Settings } from 'lucide-react';

interface PlanVoiceConfigModalProps {
  plan: SubscriptionPlan;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export default function PlanVoiceConfigModal({
  plan,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: PlanVoiceConfigModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: UpdatePlanVoiceConfigRequest) => {
    try {
      setSubmitting(true);

      await voiceAiApi.updatePlanVoiceConfig(plan.id, data);

      onSuccess(`Voice AI configuration updated successfully for "${plan.name}"!`);
    } catch (err: any) {
      console.error('Failed to update plan voice config:', err);

      // Handle validation errors (400)
      if (err.response?.status === 400) {
        const errorMsg = Array.isArray(err.response.data?.message)
          ? err.response.data.message.join(', ')
          : err.response.data?.message || 'Validation error';
        onError(errorMsg);
      }
      // Handle not found (404)
      else if (err.response?.status === 404) {
        onError('Plan not found. Please refresh and try again.');
      }
      // Handle forbidden (403)
      else if (err.response?.status === 403) {
        onError('You do not have permission to update plan configuration.');
      }
      // Generic error
      else {
        onError(err.message || 'Failed to update Voice AI configuration');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <span>Configure Voice AI for "{plan.name}"</span>
        </div>
      }
      size="lg"
    >
      <div className="mt-4">
        <PlanVoiceConfigForm plan={plan} onSubmit={handleSubmit} isSubmitting={submitting} />
      </div>
    </Modal>
  );
}
