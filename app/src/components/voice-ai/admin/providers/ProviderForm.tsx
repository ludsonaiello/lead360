'use client';

// ============================================================================
// ProviderForm Component
// ============================================================================
// Form for creating/editing AI providers with full validation
// Handles ALL fields including JSON fields (capabilities, config_schema, etc.)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, X } from 'lucide-react';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import type { VoiceAIProvider, ProviderType } from '@/lib/types/voice-ai';
import CapabilitiesBuilder from './CapabilitiesBuilder';
import PricingInfoBuilder from './PricingInfoBuilder';
import ConfigBuilder from './ConfigBuilder';
import ConfigSchemaBuilder from './ConfigSchemaBuilder';

/**
 * JSON validation helper
 */
const isValidJSON = (str: string | null | undefined): boolean => {
  if (!str || str.trim() === '') return true; // Empty is valid (optional)
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

/**
 * Form validation schema
 */
const providerFormSchema = z.object({
  provider_key: z
    .string()
    .min(1, 'Provider key is required')
    .max(50, 'Provider key must be 50 characters or less')
    .regex(/^[a-z0-9_-]+$/, 'Provider key must be lowercase letters, numbers, hyphens, or underscores only'),
  provider_type: z.enum(['STT', 'LLM', 'TTS'], {
    required_error: 'Provider type is required',
  }),
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be 100 characters or less'),
  description: z.string().optional(),
  logo_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  documentation_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  capabilities: z
    .string()
    .optional()
    .refine((val) => isValidJSON(val), {
      message: 'Must be valid JSON array (e.g., ["streaming","multilingual"])',
    }),
  config_schema: z
    .string()
    .optional()
    .refine((val) => isValidJSON(val), {
      message: 'Must be valid JSON object',
    }),
  default_config: z
    .string()
    .optional()
    .refine((val) => isValidJSON(val), {
      message: 'Must be valid JSON object',
    }),
  pricing_info: z
    .string()
    .optional()
    .refine((val) => isValidJSON(val), {
      message: 'Must be valid JSON object',
    }),
  is_active: z.boolean().default(true),
});

type ProviderFormData = z.infer<typeof providerFormSchema>;

interface ProviderFormProps {
  provider?: VoiceAIProvider | null;
  onSubmit: (data: ProviderFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/**
 * ProviderForm - Create/edit provider form
 */
export default function ProviderForm({
  provider,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ProviderFormProps) {
  const isEditMode = !!provider;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProviderFormData>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: provider
      ? {
          provider_key: provider.provider_key,
          provider_type: provider.provider_type,
          display_name: provider.display_name,
          description: provider.description || '',
          logo_url: provider.logo_url || '',
          documentation_url: provider.documentation_url || '',
          capabilities: provider.capabilities || '',
          config_schema: provider.config_schema || '',
          default_config: provider.default_config || '',
          pricing_info: provider.pricing_info || '',
          is_active: provider.is_active,
        }
      : {
          provider_key: '',
          provider_type: 'STT',
          display_name: '',
          description: '',
          logo_url: '',
          documentation_url: '',
          capabilities: '',
          config_schema: '',
          default_config: '',
          pricing_info: '',
          is_active: true,
        },
  });

  const providerType = watch('provider_type');
  const isActive = watch('is_active');

  /**
   * Handle form submission
   */
  const handleFormSubmit = async (data: ProviderFormData) => {
    // Convert empty strings to null for optional fields
    const cleanedData: any = {
      ...data,
      description: data.description?.trim() || null,
      logo_url: data.logo_url?.trim() || null,
      documentation_url: data.documentation_url?.trim() || null,
      capabilities: data.capabilities?.trim() || null,
      config_schema: data.config_schema?.trim() || null,
      default_config: data.default_config?.trim() || null,
      pricing_info: data.pricing_info?.trim() || null,
    };

    await onSubmit(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
      {/* Basic Information */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
          Basic Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Provider Key */}
          <Input
            {...register('provider_key')}
            label="Provider Key"
            placeholder="deepgram"
            error={errors.provider_key?.message}
            helperText="Unique identifier (lowercase, no spaces)"
            required
            disabled={isEditMode} // Cannot change provider_key after creation
          />

          {/* Provider Type */}
          <Select
            label="Provider Type"
            options={[
              { value: 'STT', label: 'STT (Speech-to-Text)' },
              { value: 'LLM', label: 'LLM (Language Model)' },
              { value: 'TTS', label: 'TTS (Text-to-Speech)' },
            ]}
            value={providerType}
            onChange={(value) => setValue('provider_type', value as ProviderType)}
            required
            error={errors.provider_type?.message}
          />
        </div>

        {/* Display Name */}
        <Input
          {...register('display_name')}
          label="Display Name"
          placeholder="Deepgram"
          error={errors.display_name?.message}
          helperText="Human-readable name shown in UI"
          required
        />

        {/* Description */}
        <Textarea
          {...register('description')}
          label="Description"
          placeholder="State-of-the-art speech recognition with Nova-2 model"
          error={errors.description?.message}
          helperText="Brief description of this provider"
          rows={3}
          showCharacterCount={false}
        />
      </div>

      {/* Links */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
          Links
        </h2>

        <Input
          {...register('logo_url')}
          label="Logo URL"
          placeholder="https://deepgram.com/favicon.ico"
          error={errors.logo_url?.message}
          helperText="URL to provider logo image"
        />

        <Input
          {...register('documentation_url')}
          label="Documentation URL"
          placeholder="https://developers.deepgram.com"
          error={errors.documentation_url?.message}
          helperText="Link to provider documentation"
        />
      </div>

      {/* Configuration (Smart Builders) */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
          Configuration
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
            (Use builders or edit JSON directly)
          </span>
        </h2>

        {/* Capabilities Builder */}
        <CapabilitiesBuilder
          value={watch('capabilities') || ''}
          onChange={(val) => setValue('capabilities', val)}
          error={errors.capabilities?.message}
        />

        {/* Config Schema Builder */}
        <ConfigSchemaBuilder
          value={watch('config_schema') || ''}
          onChange={(val) => setValue('config_schema', val)}
          error={errors.config_schema?.message}
        />

        {/* Default Config Builder */}
        <ConfigBuilder
          label="Default Config"
          helperText="Default configuration values for this provider"
          value={watch('default_config') || ''}
          onChange={(val) => setValue('default_config', val)}
          error={errors.default_config?.message}
          placeholder='{"model":"nova-2","punctuate":true}'
        />

        {/* Pricing Info Builder */}
        <PricingInfoBuilder
          value={watch('pricing_info') || ''}
          onChange={(val) => setValue('pricing_info', val)}
          error={errors.pricing_info?.message}
        />
      </div>

      {/* Status */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
          Status
        </h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            {...register('is_active')}
            type="checkbox"
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Active Provider
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isActive
                ? 'Provider is available for use'
                : 'Provider is disabled and unavailable'}
            </p>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          onClick={onCancel}
          variant="secondary"
          disabled={isSubmitting}
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>

        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          <Save className="w-4 h-4 mr-2" />
          {isEditMode ? 'Update Provider' : 'Create Provider'}
        </Button>
      </div>
    </form>
  );
}
