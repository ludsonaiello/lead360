// ============================================================================
// Plan Voice Config Form Component
// ============================================================================
// Form for editing Voice AI configuration for a subscription plan
// ============================================================================

'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import type { SubscriptionPlan } from '@/lib/types/voice-ai';
import { Save, AlertCircle } from 'lucide-react';

/**
 * Form validation schema (matches API documentation)
 */
const planVoiceConfigSchema = z.object({
  voice_ai_enabled: z.boolean(),
  voice_ai_minutes_included: z
    .number()
    .min(0, 'Minutes must be at least 0')
    .int('Minutes must be a whole number'),
  voice_ai_overage_rate: z
    .number()
    .min(0, 'Overage rate must be at least 0')
    .optional()
    .nullable(),
  block_overage: z.boolean(), // Helper field for UI toggle
});

type PlanVoiceConfigFormData = z.infer<typeof planVoiceConfigSchema>;

interface PlanVoiceConfigFormProps {
  plan: SubscriptionPlan;
  onSubmit: (data: Omit<PlanVoiceConfigFormData, 'block_overage'>) => Promise<void>;
  isSubmitting?: boolean;
}

export default function PlanVoiceConfigForm({
  plan,
  onSubmit,
  isSubmitting = false,
}: PlanVoiceConfigFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<PlanVoiceConfigFormData>({
    resolver: zodResolver(planVoiceConfigSchema),
    defaultValues: {
      voice_ai_enabled: plan.voice_ai_enabled,
      voice_ai_minutes_included: plan.voice_ai_minutes_included,
      voice_ai_overage_rate:
        plan.voice_ai_overage_rate !== null ? parseFloat(plan.voice_ai_overage_rate) : 0,
      block_overage: plan.voice_ai_overage_rate === null,
    },
  });

  const voiceAiEnabled = watch('voice_ai_enabled');
  const blockOverage = watch('block_overage');

  /**
   * Handle form submission
   * Convert block_overage toggle to null/number for API
   */
  const handleFormSubmit = async (data: PlanVoiceConfigFormData) => {
    const submitData = {
      voice_ai_enabled: data.voice_ai_enabled,
      voice_ai_minutes_included: data.voice_ai_minutes_included,
      voice_ai_overage_rate: data.block_overage ? null : data.voice_ai_overage_rate,
    };

    await onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Voice AI Enabled Toggle */}
      <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
        <Controller
          name="voice_ai_enabled"
          control={control}
          render={({ field }) => (
            <ToggleSwitch
              label="Enable Voice AI for this plan"
              description="Allow tenants on this plan to use Voice AI features"
              enabled={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {/* Conditional Fields - Only show if Voice AI is enabled */}
      {voiceAiEnabled ? (
        <div className="space-y-6">
          {/* Monthly Minutes Included */}
          <div>
            <label
              htmlFor="voice_ai_minutes_included"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Monthly Minutes Included <span className="text-red-500">*</span>
            </label>
            <Input
              id="voice_ai_minutes_included"
              type="number"
              min="0"
              step="1"
              {...register('voice_ai_minutes_included', { valueAsNumber: true })}
              placeholder="e.g., 100"
              error={errors.voice_ai_minutes_included?.message}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Number of Voice AI minutes included in the monthly subscription (0 = no included minutes)
            </p>
          </div>

          {/* Overage Behavior Section */}
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Overage Behavior
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  What happens when a tenant exceeds their monthly minute quota?
                </p>
              </div>
            </div>

            {/* Block Overage Toggle */}
            <div className="pl-7">
              <Controller
                name="block_overage"
                control={control}
                render={({ field }) => (
                  <ToggleSwitch
                    label="Block calls when quota exceeded"
                    description="When enabled, calls will be blocked when quota is reached (overage_rate = null)"
                    enabled={field.value}
                    onChange={(enabled) => {
                      field.onChange(enabled);
                      // When enabled (blocking), set overage_rate to null
                      // When disabled (not blocking), set a sensible default
                      if (enabled) {
                        setValue('voice_ai_overage_rate', null);
                      } else {
                        setValue('voice_ai_overage_rate', 0.1);
                      }
                    }}
                  />
                )}
              />
            </div>

            {/* Overage Rate Input (shown when block_overage is false) */}
            {!blockOverage && (
              <div className="pl-7">
                <label
                  htmlFor="voice_ai_overage_rate"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Overage Rate (USD per minute)
                </label>
                <Input
                  id="voice_ai_overage_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('voice_ai_overage_rate', { valueAsNumber: true })}
                  placeholder="e.g., 0.10"
                  error={errors.voice_ai_overage_rate?.message}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Cost per minute for calls that exceed the included quota
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <strong>Voice AI is disabled for this plan.</strong>
              <p className="mt-1">
                Tenants on this plan will not have access to Voice AI features. Enable Voice AI above to
                configure minutes and overage settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          <Save className="h-4 w-4 mr-2" />
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
