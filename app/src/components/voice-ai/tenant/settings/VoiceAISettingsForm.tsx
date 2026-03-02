/**
 * Voice AI Tenant Settings Form
 * Complete form for managing tenant Voice AI behavior settings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, X } from 'lucide-react';
import voiceAiApi from '@/lib/api/voice-ai';
import type { TenantVoiceAISettings } from '@/lib/types/voice-ai';
import { LanguageSelector } from './LanguageSelector';
import { ToolToggles } from './ToolToggles';
import { PlanUpgradeNotice } from './PlanUpgradeNotice';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';

// Validation schema
const settingsSchema = z.object({
  is_enabled: z.boolean(),
  enabled_languages: z.array(z.string()).min(1, 'Select at least one language'),
  custom_greeting: z.string().max(500, 'Must be 500 characters or less').nullable().optional(),
  custom_instructions: z.string().max(3000, 'Must be 3000 characters or less').nullable().optional(),
  booking_enabled: z.boolean(),
  lead_creation_enabled: z.boolean(),
  transfer_enabled: z.boolean(),
  default_transfer_number: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format (+15551234567)')
    .nullable()
    .optional()
    .or(z.literal('')),
  max_call_duration_seconds: z
    .number()
    .int()
    .min(60, 'Minimum 60 seconds')
    .max(3600, 'Maximum 3600 seconds')
    .nullable()
    .optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface VoiceAISettingsFormProps {
  readOnly?: boolean;
}

export const VoiceAISettingsForm: React.FC<VoiceAISettingsFormProps> = ({ readOnly = false }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TenantVoiceAISettings | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [planIncludesVoiceAI, setPlanIncludesVoiceAI] = useState(true);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      is_enabled: false,
      enabled_languages: ['en'],
      custom_greeting: null,
      custom_instructions: null,
      booking_enabled: true,
      lead_creation_enabled: true,
      transfer_enabled: true,
      default_transfer_number: null,
      max_call_duration_seconds: null,
    },
  });

  // Watch custom fields to show clear buttons
  const customGreeting = watch('custom_greeting');
  const customInstructions = watch('custom_instructions');
  const defaultTransferNumber = watch('default_transfer_number');
  const maxCallDuration = watch('max_call_duration_seconds');

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await voiceAiApi.getTenantSettings();

      if (data) {
        setSettings(data);

        // Parse enabled_languages from JSON string to array
        let enabledLanguages: string[] = ['en'];
        if (data.enabled_languages) {
          try {
            enabledLanguages = JSON.parse(data.enabled_languages);
          } catch (e) {
            console.error('Failed to parse enabled_languages:', e);
          }
        }

        // Reset form with fetched data
        reset({
          is_enabled: data.is_enabled,
          enabled_languages: enabledLanguages,
          custom_greeting: data.custom_greeting || null,
          custom_instructions: data.custom_instructions || null,
          booking_enabled: data.booking_enabled,
          lead_creation_enabled: data.lead_creation_enabled,
          transfer_enabled: data.transfer_enabled,
          default_transfer_number: data.default_transfer_number || null,
          max_call_duration_seconds: data.max_call_duration_seconds || null,
        });
      } else {
        // No settings configured yet - use defaults
        reset({
          is_enabled: false,
          enabled_languages: ['en'],
          custom_greeting: null,
          custom_instructions: null,
          booking_enabled: true,
          lead_creation_enabled: true,
          transfer_enabled: true,
          default_transfer_number: null,
          max_call_duration_seconds: null,
        });
      }

      // Check if plan includes Voice AI
      // Note: This check would ideally come from the backend response
      // For now, we'll assume it's included unless we get a 403 error
      setPlanIncludesVoiceAI(true);
    } catch (error: any) {
      console.error('Failed to load settings:', error);

      if (error?.response?.status === 403 && error?.response?.data?.message?.includes('plan')) {
        setPlanIncludesVoiceAI(false);
      } else {
        toast.error('Failed to load settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    try {
      setSaving(true);

      // Prepare payload - convert empty strings to null for nullable fields
      const payload: any = {
        is_enabled: data.is_enabled,
        enabled_languages: data.enabled_languages,
        booking_enabled: data.booking_enabled,
        lead_creation_enabled: data.lead_creation_enabled,
        transfer_enabled: data.transfer_enabled,
      };

      // Handle nullable fields - empty string means null
      if (data.custom_greeting !== undefined) {
        payload.custom_greeting = data.custom_greeting === '' ? null : data.custom_greeting;
      }

      if (data.custom_instructions !== undefined) {
        payload.custom_instructions = data.custom_instructions === '' ? null : data.custom_instructions;
      }

      if (data.default_transfer_number !== undefined) {
        payload.default_transfer_number = data.default_transfer_number === '' ? null : data.default_transfer_number;
      }

      if (data.max_call_duration_seconds !== undefined) {
        payload.max_call_duration_seconds = data.max_call_duration_seconds;
      }

      const result = await voiceAiApi.updateTenantSettings(payload);
      setSettings(result);

      // Parse enabled_languages for form reset
      let enabledLanguages: string[] = ['en'];
      if (result.enabled_languages) {
        try {
          enabledLanguages = JSON.parse(result.enabled_languages);
        } catch (e) {
          console.error('Failed to parse enabled_languages:', e);
        }
      }

      // Reset form with updated data (clears dirty state)
      reset({
        is_enabled: result.is_enabled,
        enabled_languages: enabledLanguages,
        custom_greeting: result.custom_greeting || null,
        custom_instructions: result.custom_instructions || null,
        booking_enabled: result.booking_enabled,
        lead_creation_enabled: result.lead_creation_enabled,
        transfer_enabled: result.transfer_enabled,
        default_transfer_number: result.default_transfer_number || null,
        max_call_duration_seconds: result.max_call_duration_seconds || null,
      });

      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Failed to save settings:', error);

      if (error?.response?.status === 403 && error?.response?.data?.message?.includes('plan')) {
        setErrorMessage('Your subscription plan does not include Voice AI. Please upgrade to enable this feature.');
        setPlanIncludesVoiceAI(false);
      } else {
        setErrorMessage(error?.response?.data?.message || 'Failed to save settings. Please try again.');
      }

      setShowErrorModal(true);
    } finally {
      setSaving(false);
    }
  };

  // Clear custom greeting
  const handleClearGreeting = () => {
    setValue('custom_greeting', null, { shouldDirty: true });
  };

  // Clear custom instructions
  const handleClearInstructions = () => {
    setValue('custom_instructions', null, { shouldDirty: true });
  };

  // Clear transfer number
  const handleClearTransferNumber = () => {
    setValue('default_transfer_number', null, { shouldDirty: true });
  };

  // Clear max duration
  const handleClearMaxDuration = () => {
    setValue('max_call_duration_seconds', null, { shouldDirty: true });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Show upgrade notice if plan doesn't include Voice AI
  if (!planIncludesVoiceAI) {
    return <PlanUpgradeNotice />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Usage Notice (if available) */}
        {settings?.monthly_minutes_override !== null && settings?.monthly_minutes_override !== undefined && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-semibold">Plan includes:</span> {settings.monthly_minutes_override} minutes per month
            </p>
          </div>
        )}

        {/* Enable/Disable Section */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Enable Voice AI Agent</h2>
          <Controller
            name="is_enabled"
            control={control}
            render={({ field }) => (
              <ToggleSwitch
                label="Enable Voice AI Agent"
                enabled={field.value}
                onChange={field.onChange}
                disabled={readOnly}
                description="Turn on to activate the Voice AI agent for incoming calls"
              />
            )}
          />
        </div>

        {/* Languages Section */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Languages</h2>
          <Controller
            name="enabled_languages"
            control={control}
            render={({ field }) => (
              <LanguageSelector
                value={field.value}
                onChange={field.onChange}
                error={errors.enabled_languages?.message}
                disabled={readOnly}
              />
            )}
          />
        </div>

        {/* Custom Messaging Section */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Custom Messaging</h2>

          {/* Custom Greeting */}
          <div className="relative">
            <Textarea
              label="Custom Greeting (Optional)"
              {...register('custom_greeting')}
              placeholder="Thank you for calling {business_name}! How can I help you today?"
              error={errors.custom_greeting?.message}
              helperText="Use {business_name} as placeholder. Leave empty to use global default."
              rows={3}
              disabled={readOnly}
              maxLength={500}
            />
            {customGreeting && !readOnly && (
              <button
                type="button"
                onClick={handleClearGreeting}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                title="Clear greeting (revert to default)"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {customGreeting && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {customGreeting.length} / 500 characters
              </p>
            )}
          </div>

          {/* Custom Instructions */}
          <div className="relative">
            <Textarea
              label="Custom Instructions (Optional)"
              {...register('custom_instructions')}
              placeholder="Always ask if it is an emergency. Mention we serve the Miami area."
              error={errors.custom_instructions?.message}
              helperText="Additional instructions for the agent. Leave empty if not needed."
              rows={4}
              disabled={readOnly}
              maxLength={3000}
            />
            {customInstructions && !readOnly && (
              <button
                type="button"
                onClick={handleClearInstructions}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                title="Clear instructions"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {customInstructions && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {customInstructions.length} / 3000 characters
              </p>
            )}
          </div>
        </div>

        {/* Agent Capabilities Section */}
        <ToolToggles control={control} disabled={readOnly} />

        {/* Call Settings Section */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Call Settings</h2>

          {/* Default Transfer Number */}
          <div className="relative">
            <Controller
              name="default_transfer_number"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  label="Default Transfer Number (Optional)"
                  value={field.value || ''}
                  onChange={field.onChange}
                  error={errors.default_transfer_number?.message}
                  helperText="Fallback number if transfer is enabled but no specific number selected. Must be E.164 format (e.g., +15551234567)"
                  disabled={readOnly}
                />
              )}
            />
            {defaultTransferNumber && !readOnly && (
              <button
                type="button"
                onClick={handleClearTransferNumber}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                title="Clear transfer number"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Max Call Duration */}
          <div className="relative">
            <Input
              label="Maximum Call Duration (Optional)"
              type="number"
              {...register('max_call_duration_seconds', {
                setValueAs: (v) => (v === '' || v === null ? null : parseInt(v, 10)),
              })}
              placeholder="600"
              error={errors.max_call_duration_seconds?.message}
              helperText="Maximum call duration in seconds (60-3600). Leave empty to use global default."
              disabled={readOnly}
              min={60}
              max={3600}
            />
            {maxCallDuration !== null && maxCallDuration !== undefined && !readOnly && (
              <button
                type="button"
                onClick={handleClearMaxDuration}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                title="Clear duration (use global default)"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Admin Notes (View-Only) */}
        {settings?.admin_notes && (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Admin Notes</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{settings.admin_notes}</p>
          </div>
        )}

        {/* Form Actions */}
        {!readOnly && (
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => reset()} disabled={saving || !isDirty}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !isDirty}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        )}
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <Modal isOpen onClose={() => setShowSuccessModal(false)} title="Settings Saved">
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Your Voice AI settings have been saved successfully.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setShowSuccessModal(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <Modal isOpen onClose={() => setShowErrorModal(false)} title="Error">
          <div className="space-y-4">
            <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
            <div className="flex justify-end">
              <Button onClick={() => setShowErrorModal(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default VoiceAISettingsForm;
