'use client';

// ============================================================================
// TenantOverrideForm Component
// ============================================================================
// Form for managing admin overrides with nullable semantics
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, X, AlertCircle, Loader2 } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { VoiceAIProvider, TenantOverrideDto, VoiceAgentProfile } from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';

interface TenantOverrideFormProps {
  tenantId: string;
  providers: VoiceAIProvider[];
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Form validation schema
 */
const overrideFormSchema = z.object({
  force_enabled: z.string(), // 'true', 'false', or 'null'
  override_minutes: z.boolean(), // Whether to override minutes
  monthly_minutes_override: z.coerce
    .number()
    .min(0, 'Minutes must be 0 or greater')
    .optional()
    .nullable(),
  stt_provider_override_id: z.string().optional().nullable(),
  llm_provider_override_id: z.string().optional().nullable(),
  tts_provider_override_id: z.string().optional().nullable(),
  default_agent_profile_id: z.string().optional().nullable(), // Sprint 12: Default profile
  admin_notes: z.string().optional().nullable(),
});

type OverrideFormData = z.infer<typeof overrideFormSchema>;

/**
 * TenantOverrideForm - Form for managing tenant overrides with nullable semantics
 */
export default function TenantOverrideForm({
  tenantId,
  providers,
  onSuccess,
  onCancel,
}: TenantOverrideFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<VoiceAgentProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);

  // Filter providers by type
  const sttProviders = providers.filter((p) => p.provider_type === 'STT');
  const llmProviders = providers.filter((p) => p.provider_type === 'LLM');
  const ttsProviders = providers.filter((p) => p.provider_type === 'TTS');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<OverrideFormData>({
    resolver: zodResolver(overrideFormSchema),
    defaultValues: {
      force_enabled: 'null',
      override_minutes: false,
      monthly_minutes_override: null,
      stt_provider_override_id: '',
      llm_provider_override_id: '',
      tts_provider_override_id: '',
      default_agent_profile_id: '',
      admin_notes: '',
    },
  });

  /**
   * Fetch tenant's voice agent profiles (Admin endpoint)
   */
  useEffect(() => {
    const fetchTenantProfiles = async () => {
      try {
        setProfilesLoading(true);
        const tenantProfiles = await voiceAiApi.getTenantAgentProfiles(tenantId);
        setProfiles(tenantProfiles);
      } catch (err: any) {
        console.error('[TenantOverrideForm] Failed to fetch tenant profiles:', err);
        toast.error('Failed to load tenant profiles');
        setProfiles([]);
      } finally {
        setProfilesLoading(false);
      }
    };

    fetchTenantProfiles();
  }, [tenantId]);

  /**
   * Fetch current override values on mount
   */
  useEffect(() => {
    const fetchCurrentOverrides = async () => {
      try {
        setLoading(true);
        const overrides = await voiceAiApi.getTenantOverride(tenantId);

        // Map backend response to form values
        const formValues: OverrideFormData = {
          force_enabled:
            overrides.force_enabled === null
              ? 'null'
              : overrides.force_enabled
              ? 'true'
              : 'false',
          override_minutes: overrides.monthly_minutes_override !== null,
          monthly_minutes_override: overrides.monthly_minutes_override,
          stt_provider_override_id: overrides.stt_provider_override_id || '',
          llm_provider_override_id: overrides.llm_provider_override_id || '',
          tts_provider_override_id: overrides.tts_provider_override_id || '',
          default_agent_profile_id: overrides.default_agent_profile_id || '',
          admin_notes: overrides.admin_notes || '',
        };

        reset(formValues);
      } catch (err: any) {
        console.error('[TenantOverrideForm] Failed to fetch current overrides:', err);
        toast.error('Failed to load current override settings');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentOverrides();
  }, [tenantId, reset]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: OverrideFormData) => {
    setSubmitting(true);
    try {
      // Build request payload with nullable semantics
      const payload: TenantOverrideDto = {};

      // force_enabled: 'true' -> true, 'false' -> false, 'null' -> null
      if (data.force_enabled === 'true') {
        payload.force_enabled = true;
      } else if (data.force_enabled === 'false') {
        payload.force_enabled = false;
      } else {
        payload.force_enabled = null;
      }

      // monthly_minutes_override: if checkbox unchecked, set to null
      if (data.override_minutes && data.monthly_minutes_override !== null) {
        payload.monthly_minutes_override = data.monthly_minutes_override;
      } else {
        payload.monthly_minutes_override = null;
      }

      // Provider overrides: empty string -> null (remove override)
      payload.stt_provider_override_id = data.stt_provider_override_id || null;
      payload.llm_provider_override_id = data.llm_provider_override_id || null;
      payload.tts_provider_override_id = data.tts_provider_override_id || null;

      // Default agent profile: empty string -> null (remove override)
      payload.default_agent_profile_id = data.default_agent_profile_id || null;

      // Admin notes: empty string -> null
      payload.admin_notes = data.admin_notes?.trim() || null;

      await voiceAiApi.updateTenantOverride(tenantId, payload);
      toast.success('Override settings updated successfully');
      onSuccess();
    } catch (err: any) {
      console.error('[TenantOverrideForm] Failed to update override:', err);
      toast.error(err.response?.data?.message || 'Failed to update override settings');
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading spinner while fetching current overrides
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading current settings...
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Infrastructure Overrides Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Infrastructure Overrides
        </h3>

        {/* Force Enabled/Disabled */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Force Enable/Disable
          </label>
          <select
            {...register('force_enabled')}
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="null">Let Tenant Control (remove override)</option>
            <option value="true">Force Enable</option>
            <option value="false">Force Disable</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Override tenant's ability to enable/disable Voice AI
          </p>
        </div>

        {/* Monthly Minutes Override */}
        <div>
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="override_minutes"
              {...register('override_minutes')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="override_minutes"
              className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Override monthly minutes
            </label>
          </div>

          {watch('override_minutes') && (
            <div>
              <Input
                type="number"
                {...register('monthly_minutes_override')}
                min={0}
                placeholder="Enter minutes quota"
              />
              {errors.monthly_minutes_override && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.monthly_minutes_override.message}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Override the monthly minutes quota (unchecking reverts to plan default)
              </p>
            </div>
          )}
        </div>

        {/* STT Provider Override */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            STT Provider Override
          </label>
          <select
            {...register('stt_provider_override_id')}
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Use Global Default (remove override)</option>
            {sttProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.display_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Override Speech-to-Text provider for this tenant
          </p>
        </div>

        {/* LLM Provider Override */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            LLM Provider Override
          </label>
          <select
            {...register('llm_provider_override_id')}
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Use Global Default (remove override)</option>
            {llmProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.display_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Override Language Model provider for this tenant
          </p>
        </div>

        {/* TTS Provider Override */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            TTS Provider Override
          </label>
          <select
            {...register('tts_provider_override_id')}
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Use Global Default (remove override)</option>
            {ttsProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.display_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Override Text-to-Speech provider for this tenant
          </p>
        </div>

        {/* Default Agent Profile */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Default Agent Profile
          </label>
          <select
            {...register('default_agent_profile_id')}
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={profilesLoading}
          >
            <option value="">No default (use tenant settings)</option>
            {profiles.length === 0 && !profilesLoading ? (
              <option value="" disabled>
                No profiles available for this tenant
              </option>
            ) : (
              profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.title} ({profile.language_code.toUpperCase()})
                  {!profile.is_active ? ' - INACTIVE' : ''}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Profile used when IVR voice_ai action has no profile specified. Only profiles owned by this tenant can be selected.
          </p>
        </div>
      </div>

      {/* Admin Notes Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Admin Notes
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Internal Notes (Admin Only)
          </label>
          <textarea
            {...register('admin_notes')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            placeholder="e.g., VIP customer - extra quota approved by CEO"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Internal notes visible only to platform admins
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">Nullable Semantics:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
              <li>Setting a field removes the override and reverts to default</li>
              <li>Unchecking minutes override reverts to plan default</li>
              <li>Selecting "Use Global Default" removes provider override</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          <Save className="h-4 w-4 mr-1" />
          {submitting ? 'Saving...' : 'Save Override'}
        </Button>
      </div>
    </form>
  );
}
