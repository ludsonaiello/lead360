'use client';

// ============================================================================
// CredentialFormModal Component
// ============================================================================
// Modal form for adding/updating provider credentials with smart dynamic fields
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Shield, X, Settings } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import DynamicConfigFields from './DynamicConfigFields';
import type { ProviderWithCredential } from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';
import {
  parseConfigSchema,
  buildConfigFromFields,
  parseConfigToFields,
  type SchemaField,
} from '@/lib/utils/json-schema-parser';

interface CredentialFormModalProps {
  provider: ProviderWithCredential;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Form validation schema (only API key is validated here, config fields validated dynamically)
 */
const credentialFormSchema = z.object({
  api_key: z.string().min(10, 'API key must be at least 10 characters'),
});

type CredentialFormData = z.infer<typeof credentialFormSchema>;

/**
 * CredentialFormModal - Add/update credential with smart dynamic config form
 */
export default function CredentialFormModal({
  provider,
  isOpen,
  onClose,
  onSuccess,
}: CredentialFormModalProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Parse provider's config schema to generate form fields
  const configFields: SchemaField[] = useMemo(() => {
    return parseConfigSchema(provider.config_schema);
  }, [provider.config_schema]);

  // Initialize form with dynamic fields
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
  } = useForm<any>({
    resolver: zodResolver(credentialFormSchema),
    defaultValues: {
      api_key: '',
      // Initialize config field values with defaults
      ...configFields.reduce((acc, field) => {
        acc[field.name] = field.default ?? '';
        return acc;
      }, {} as Record<string, any>),
    },
  });

  /**
   * Handle form submission
   */
  const onSubmit = async (data: CredentialFormData & Record<string, any>) => {
    setSubmitting(true);
    try {
      // Extract API key
      const { api_key, ...configValues } = data;

      // Build additional_config from dynamic fields
      const additional_config =
        configFields.length > 0
          ? buildConfigFromFields(configFields, configValues)
          : null;

      // Submit to API
      await voiceAiApi.upsertCredential(provider.id, {
        api_key,
        additional_config,
      });

      toast.success(
        `Credential ${provider.has_credential ? 'updated' : 'added'} successfully`
      );

      // Clear form (security - don't keep plain key in memory)
      reset();
      onSuccess();
    } catch (err: any) {
      console.error('[CredentialFormModal] Failed to save credential:', err);
      const errorMessage =
        err.response?.data?.message || 'Failed to save credential';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    // Clear form on close (security)
    reset();
    setShowApiKey(false);
    setShowAdvanced(false);
    onClose();
  };

  /**
   * Get badge variant for provider type
   */
  const getProviderTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
      STT: 'info',
      LLM: 'success',
      TTS: 'warning',
    };
    return variants[type] || 'default';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {provider.has_credential ? 'Update' : 'Add'} Credential
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-600 dark:text-gray-400">
                  {provider.display_name}
                </span>
                <Badge variant={getProviderTypeBadge(provider.provider_type)}>
                  {provider.provider_type}
                </Badge>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* API Key Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                {...register('api_key')}
                type={showApiKey ? 'text' : 'password'}
                placeholder="Enter provider API key"
                error={errors.api_key?.message as string}
                className="pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This will be encrypted before storage. Never shared or displayed after
              saving.
            </p>
          </div>

          {/* Configuration Section */}
          {configFields.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
              >
                <Settings className="h-4 w-4" />
                <span>Provider Configuration</span>
                <span className="text-gray-500 dark:text-gray-400">
                  ({configFields.length} options)
                </span>
              </button>

              {showAdvanced && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <DynamicConfigFields
                    fields={configFields}
                    register={register}
                    errors={errors}
                  />
                </div>
              )}
            </div>
          )}

          {/* No Config Schema - Show Info */}
          {configFields.length === 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong className="text-gray-900 dark:text-gray-100">
                    No additional configuration needed
                  </strong>
                  <br />
                  This provider will use default settings. You can configure advanced
                  options later if needed.
                </p>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium mb-1">Security Information</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-300">
                  <li>API key is encrypted with AES-256-GCM before storage</li>
                  <li>Original key is never stored or returned by the server</li>
                  <li>Only masked version is displayed (e.g., "sk-p...xyz")</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {provider.has_credential ? 'Update' : 'Save'} Credential
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
