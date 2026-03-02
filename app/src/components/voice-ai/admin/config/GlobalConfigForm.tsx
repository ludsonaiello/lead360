'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Key, Server, Settings, MessageSquare, Languages, Wrench, Phone, Bot, MessageCircle } from 'lucide-react';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import type { GlobalConfig } from '@/lib/types/voice-ai';
import ProviderSelector from './ProviderSelector';
import JSONEditor from './JSONEditor';
import RegenerateKeyModal from './RegenerateKeyModal';
import LiveKitConfig from './LiveKitConfig';
import ProviderConfigBuilder from './ProviderConfigBuilder';
import ArrayEditor from './ArrayEditor';
import PhrasesList from './PhrasesList';

/**
 * JSON validation helper
 */
const isValidJSON = (str: string | null | undefined): boolean => {
  if (!str || str.trim() === '') return true;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

/**
 * Form validation schema (matches API documentation)
 */
const globalConfigSchema = z.object({
  agent_enabled: z.boolean(),
  default_stt_provider_id: z.string().uuid().optional().nullable(),
  default_llm_provider_id: z.string().uuid().optional().nullable(),
  default_tts_provider_id: z.string().uuid().optional().nullable(),
  default_stt_config: z
    .string()
    .optional()
    .nullable()
    .refine((val) => isValidJSON(val), { message: 'Must be valid JSON' }),
  default_llm_config: z
    .string()
    .optional()
    .nullable()
    .refine((val) => isValidJSON(val), { message: 'Must be valid JSON' }),
  default_tts_config: z
    .string()
    .optional()
    .nullable()
    .refine((val) => isValidJSON(val), { message: 'Must be valid JSON' }),
  default_voice_id: z.string().optional().nullable(),
  default_language: z.string().min(2).max(10).optional().nullable(),
  default_languages: z
    .string()
    .optional()
    .nullable()
    .refine((val) => isValidJSON(val), { message: 'Must be valid JSON array' }),
  default_greeting_template: z.string().max(500).optional().nullable(),
  default_system_prompt: z.string().max(3000).optional().nullable(),
  default_max_call_duration_seconds: z
    .number()
    .min(60, 'Must be at least 60 seconds')
    .max(3600, 'Must be at most 3600 seconds')
    .optional()
    .nullable(),
  default_transfer_behavior: z.string().optional().nullable(),
  default_tools_enabled: z
    .string()
    .optional()
    .nullable()
    .refine((val) => isValidJSON(val), { message: 'Must be valid JSON object' }),
  livekit_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .nullable()
    .or(z.literal('')),
  livekit_sip_trunk_url: z.string().optional().nullable(),
  livekit_api_key: z.string().optional().nullable(),
  livekit_api_secret: z.string().optional().nullable(),
  max_concurrent_calls: z
    .number()
    .min(1, 'Must be at least 1')
    .max(100, 'Must be at most 100')
    .optional()
    .nullable(),
  // Sprint Voice-UX-01: Conversational Phrases (2026-02-27)
  recovery_messages: z
    .array(z.string().max(150))
    .min(1)
    .max(10)
    .optional()
    .nullable(),
  filler_phrases: z
    .array(z.string().max(150))
    .min(1)
    .max(10)
    .optional()
    .nullable(),
  long_wait_messages: z
    .array(z.string().max(150))
    .min(1)
    .max(10)
    .optional()
    .nullable(),
  system_error_messages: z
    .array(z.string().max(150))
    .min(1)
    .max(10)
    .optional()
    .nullable(),
});

type GlobalConfigFormData = z.infer<typeof globalConfigSchema>;

interface GlobalConfigFormProps {
  config: GlobalConfig;
  onSubmit: (data: GlobalConfigFormData) => Promise<void>;
  isSubmitting?: boolean;
}

/**
 * Global Configuration Form
 * 9 sections: Agent Status, Providers, Voice & Language, Agent Behavior,
 * Tool Toggles, Call Handling, LiveKit Config, Agent API Key, Conversational Phrases
 */
export default function GlobalConfigForm({
  config,
  onSubmit,
  isSubmitting = false,
}: GlobalConfigFormProps) {
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [agentKeyPreview, setAgentKeyPreview] = useState(config.agent_api_key_preview);

  // Parse tools_enabled JSON for toggle switches
  const parseToolsEnabled = (jsonStr: string): Record<string, boolean> => {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return { booking: false, lead_creation: false, call_transfer: false };
    }
  };

  const [toolsEnabled, setToolsEnabled] = useState(
    parseToolsEnabled(config.default_tools_enabled)
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GlobalConfigFormData>({
    resolver: zodResolver(globalConfigSchema),
    defaultValues: {
      agent_enabled: config.agent_enabled,
      default_stt_provider_id: config.default_stt_provider?.id || null,
      default_llm_provider_id: config.default_llm_provider?.id || null,
      default_tts_provider_id: config.default_tts_provider?.id || null,
      default_stt_config: config.default_stt_config,
      default_llm_config: config.default_llm_config,
      default_tts_config: config.default_tts_config,
      default_voice_id: config.default_voice_id,
      default_language: config.default_language,
      default_languages: config.default_languages,
      default_greeting_template: config.default_greeting_template,
      default_system_prompt: config.default_system_prompt,
      default_max_call_duration_seconds: config.default_max_call_duration_seconds,
      default_transfer_behavior: config.default_transfer_behavior,
      default_tools_enabled: config.default_tools_enabled,
      livekit_url: config.livekit_url,
      livekit_sip_trunk_url: config.livekit_sip_trunk_url,
      livekit_api_key: '',
      livekit_api_secret: '',
      max_concurrent_calls: config.max_concurrent_calls,
      // Sprint Voice-UX-01: Conversational Phrases (2026-02-27)
      recovery_messages: config.recovery_messages || null,
      filler_phrases: config.filler_phrases || null,
      long_wait_messages: config.long_wait_messages || null,
      system_error_messages: config.system_error_messages || null,
    },
  });

  const agentEnabled = watch('agent_enabled');

  const handleToolToggle = (toolName: string, enabled: boolean) => {
    const newTools = { ...toolsEnabled, [toolName]: enabled };
    setToolsEnabled(newTools);
    setValue('default_tools_enabled', JSON.stringify(newTools));
  };

  const handleFormSubmit = async (data: GlobalConfigFormData) => {
    await onSubmit(data);
  };

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
        {/* Section 1: Agent Status */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bot className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              1. Agent Status
            </h2>
          </div>
          <div className="space-y-4">
            <ToggleSwitch
              label="Enable Voice AI Agent Globally"
              enabled={agentEnabled}
              onChange={(enabled) => setValue('agent_enabled', enabled)}
              description="When disabled, all voice AI features will be unavailable across the platform"
            />
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Current Status:</strong>{' '}
                <span
                  className={
                    agentEnabled
                      ? 'text-green-600 dark:text-green-400 font-semibold'
                      : 'text-red-600 dark:text-red-400 font-semibold'
                  }
                >
                  {agentEnabled ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Default Providers */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Server className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              2. Default Providers
            </h2>
          </div>
          <div className="space-y-6">
            {/* STT Provider */}
            <div className="space-y-3">
              <ProviderSelector
                value={watch('default_stt_provider_id')}
                onChange={(value) => setValue('default_stt_provider_id', value)}
                providerType="STT"
                label="Default STT Provider (Speech-to-Text)"
                disabled={isSubmitting}
              />
              <ProviderConfigBuilder
                providerId={watch('default_stt_provider_id')}
                value={watch('default_stt_config')}
                onChange={(value) => setValue('default_stt_config', value)}
                label="STT Configuration"
                placeholder='{"model":"nova-2-phonecall","punctuate":true}'
                disabled={isSubmitting}
              />
              {errors.default_stt_config && (
                <p className="text-sm text-red-600">{errors.default_stt_config.message}</p>
              )}
            </div>

            {/* LLM Provider */}
            <div className="space-y-3">
              <ProviderSelector
                value={watch('default_llm_provider_id')}
                onChange={(value) => setValue('default_llm_provider_id', value)}
                providerType="LLM"
                label="Default LLM Provider (Language Model)"
                disabled={isSubmitting}
              />
              <ProviderConfigBuilder
                providerId={watch('default_llm_provider_id')}
                value={watch('default_llm_config')}
                onChange={(value) => setValue('default_llm_config', value)}
                label="LLM Configuration"
                placeholder='{"model":"gpt-4o-mini","temperature":0,"max_tokens":500}'
                disabled={isSubmitting}
              />
              {errors.default_llm_config && (
                <p className="text-sm text-red-600">{errors.default_llm_config.message}</p>
              )}
            </div>

            {/* TTS Provider */}
            <div className="space-y-3">
              <ProviderSelector
                value={watch('default_tts_provider_id')}
                onChange={(value) => setValue('default_tts_provider_id', value)}
                providerType="TTS"
                label="Default TTS Provider (Text-to-Speech)"
                disabled={isSubmitting}
              />
              <ProviderConfigBuilder
                providerId={watch('default_tts_provider_id')}
                value={watch('default_tts_config')}
                onChange={(value) => setValue('default_tts_config', value)}
                label="TTS Configuration"
                placeholder='{"model":"sonic-multilingual","speed":1}'
                disabled={isSubmitting}
              />
              {errors.default_tts_config && (
                <p className="text-sm text-red-600">{errors.default_tts_config.message}</p>
              )}
            </div>
          </div>
        </section>

        {/* Section 3: Voice & Language */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Languages className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              3. Voice & Language
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Default Voice ID"
              placeholder="e.g., agent_UB73EHZHv65uQTn44Hddho"
              {...register('default_voice_id')}
              error={errors.default_voice_id?.message}
              disabled={isSubmitting}
            />
            <Input
              label="Default Language"
              placeholder="en"
              {...register('default_language')}
              error={errors.default_language?.message}
              disabled={isSubmitting}
              helperText="BCP-47 language code (e.g., 'en', 'pt', 'es')"
            />
            <div className="md:col-span-2">
              <ArrayEditor
                value={watch('default_languages')}
                onChange={(value) => setValue('default_languages', value)}
                label="Enabled Languages"
                placeholder="en, pt, es, fr, de"
                disabled={isSubmitting}
                helperText="Enter language codes separated by commas (e.g., en, pt, es)"
                error={errors.default_languages?.message}
              />
            </div>
          </div>
        </section>

        {/* Section 4: Agent Behavior */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <MessageSquare className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              4. Agent Behavior
            </h2>
          </div>
          <div className="space-y-6">
            <Textarea
              label="Default Greeting Template"
              placeholder="Hello, thank you for calling {business_name}! How can I help you today?"
              {...register('default_greeting_template')}
              error={errors.default_greeting_template?.message}
              rows={3}
              disabled={isSubmitting}
              helperText="Use {business_name} as placeholder. Max 500 characters."
            />
            <Textarea
              label="Default System Prompt"
              placeholder="You are a helpful phone assistant. Be concise, friendly, and professional."
              {...register('default_system_prompt')}
              error={errors.default_system_prompt?.message}
              rows={5}
              disabled={isSubmitting}
              helperText="Base prompt for all agent conversations. Max 3000 characters."
            />
          </div>
        </section>

        {/* Section 5: Tool Toggles */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Wrench className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              5. Default Tools Enabled
            </h2>
          </div>
          <div className="space-y-4">
            <ToggleSwitch
              label="Lead Creation"
              enabled={toolsEnabled.lead_creation || false}
              onChange={(enabled) => handleToolToggle('lead_creation', enabled)}
              description="Allow agents to create leads during calls"
              disabled={isSubmitting}
            />
            <ToggleSwitch
              label="Booking"
              enabled={toolsEnabled.booking || false}
              onChange={(enabled) => handleToolToggle('booking', enabled)}
              description="Allow agents to schedule appointments"
              disabled={isSubmitting}
            />
            <ToggleSwitch
              label="Call Transfer"
              enabled={toolsEnabled.call_transfer || false}
              onChange={(enabled) => handleToolToggle('call_transfer', enabled)}
              description="Allow agents to transfer calls to human operators"
              disabled={isSubmitting}
            />
          </div>
        </section>

        {/* Section 6: Call Handling */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Phone className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              6. Call Handling
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              type="number"
              label="Max Call Duration (seconds)"
              placeholder="300"
              {...register('default_max_call_duration_seconds', { valueAsNumber: true })}
              error={errors.default_max_call_duration_seconds?.message}
              disabled={isSubmitting}
              helperText="Range: 60-3600 seconds"
            />
            <Select
              label="Transfer Behavior"
              value={watch('default_transfer_behavior') || ''}
              onChange={(value) => setValue('default_transfer_behavior', value)}
              error={errors.default_transfer_behavior?.message}
              options={[
                { value: 'end_call', label: 'End Call' },
                { value: 'voicemail', label: 'Voicemail' },
                { value: 'hold', label: 'Hold' },
              ]}
              disabled={isSubmitting}
            />
            <Input
              type="number"
              label="Max Concurrent Calls"
              placeholder="10"
              {...register('max_concurrent_calls', { valueAsNumber: true })}
              error={errors.max_concurrent_calls?.message}
              disabled={isSubmitting}
              helperText="Range: 1-100"
            />
          </div>
        </section>

        {/* Section 7: LiveKit Configuration */}
        <LiveKitConfig
          register={register}
          errors={errors}
          livekitApiKeySet={config.livekit_api_key_set}
          livekitApiSecretSet={config.livekit_api_secret_set}
          disabled={isSubmitting}
        />

        {/* Section 8: Agent API Key */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Key className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              8. Agent API Key
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current Key Preview
                </p>
                <p className="text-lg font-mono text-gray-900 dark:text-gray-100">
                  {agentKeyPreview}
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                onClick={() => setRegenerateModalOpen(true)}
                disabled={isSubmitting}
              >
                Regenerate Key
              </Button>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>Warning:</strong> Regenerating the key will invalidate all existing agents
                using the old key.
              </p>
            </div>
          </div>
        </section>

        {/* Section 9: Conversational Phrases - Sprint Voice-UX-01 */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <MessageCircle className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              9. Conversational Phrases
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Customize how the AI agent communicates during different scenarios.
            The agent will randomly select from these phrases to sound more natural and human-like.
          </p>
          <div className="space-y-8">
            {/* Recovery Messages */}
            <PhrasesList
              value={watch('recovery_messages')}
              onChange={(value) => setValue('recovery_messages', value)}
              label="Recovery Messages"
              description="Used when the agent doesn't understand or gets empty input from the caller"
              placeholder="Sorry, I didn't catch that. Could you repeat?"
              disabled={isSubmitting}
            />

            {/* Filler Phrases */}
            <PhrasesList
              value={watch('filler_phrases')}
              onChange={(value) => setValue('filler_phrases', value)}
              label="Filler Phrases"
              description="Spoken before checking information or calling tools"
              placeholder="Let me check that for you."
              disabled={isSubmitting}
            />

            {/* Long Wait Messages */}
            <PhrasesList
              value={watch('long_wait_messages')}
              onChange={(value) => setValue('long_wait_messages', value)}
              label="Long Wait Messages"
              description="Periodic updates during operations taking longer than 20 seconds"
              placeholder="Still checking, just a moment..."
              disabled={isSubmitting}
            />

            {/* System Error Messages */}
            <PhrasesList
              value={watch('system_error_messages')}
              onChange={(value) => setValue('system_error_messages', value)}
              label="System Error Messages"
              description="Generic messages for system errors (database, API failures)"
              placeholder="I'm having some trouble right now. Could you try again?"
              disabled={isSubmitting}
            />
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Tip:</strong> Use friendly, conversational language. Avoid technical terms like "error", "system", or "processing".
              The agent will randomly select phrases to sound more natural.
            </p>
          </div>
        </section>

        {/* Submit Button */}
        <div className="flex gap-3 justify-end sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 -mx-6 -mb-6">
          <Button type="submit" loading={isSubmitting}>
            <Save className="w-5 h-5" />
            Save Configuration
          </Button>
        </div>
      </form>

      {/* Regenerate Key Modal */}
      <RegenerateKeyModal
        isOpen={regenerateModalOpen}
        onClose={() => setRegenerateModalOpen(false)}
        onSuccess={(preview) => setAgentKeyPreview(preview)}
      />
    </>
  );
}
