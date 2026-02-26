'use client';

// ============================================================================
// ProviderConfigBuilder Component
// ============================================================================
// Smart form builder for provider configurations
// Reads provider's config_schema and generates appropriate form fields
// ============================================================================

import React, { useState, useEffect } from 'react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import Button from '@/components/ui/Button';
import { Code, Wrench } from 'lucide-react';
import voiceAiApi from '@/lib/api/voice-ai';
import type { VoiceAIProvider } from '@/lib/types/voice-ai';

interface ProviderConfigBuilderProps {
  providerId: string | null;
  value: string | null; // JSON string
  onChange: (value: string | null) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

interface ConfigField {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean';
  default?: any;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  required: boolean;
}

/**
 * ProviderConfigBuilder
 * Generates form fields from provider's config_schema
 */
export default function ProviderConfigBuilder({
  providerId,
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
}: ProviderConfigBuilderProps) {
  const [provider, setProvider] = useState<VoiceAIProvider | null>(null);
  const [fields, setFields] = useState<ConfigField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [useRawEditor, setUseRawEditor] = useState(false);
  const [rawJson, setRawJson] = useState(value || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch provider and parse schema
  useEffect(() => {
    if (!providerId) {
      setFields([]);
      setFormData({});
      setProvider(null);
      return;
    }

    const fetchProvider = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await voiceAiApi.getProviderById(providerId);
        setProvider(data);

        // Parse config_schema
        if (data.config_schema) {
          const schema = JSON.parse(data.config_schema);
          if (schema.type === 'object' && schema.properties) {
            const parsedFields: ConfigField[] = Object.entries(schema.properties).map(
              ([name, prop]: [string, any]) => ({
                name,
                type: prop.enum ? 'string' : prop.type || 'string',
                default: prop.default,
                description: prop.description,
                enum: prop.enum,
                minimum: prop.minimum,
                maximum: prop.maximum,
                required: schema.required?.includes(name) || false,
              })
            );
            setFields(parsedFields);

            // Initialize form data from value or defaults
            const initialData: Record<string, any> = {};
            if (value) {
              try {
                const parsed = JSON.parse(value);
                Object.assign(initialData, parsed);
              } catch {
                // Invalid JSON, use defaults
              }
            }

            // Fill in defaults for missing fields
            parsedFields.forEach((field) => {
              if (!(field.name in initialData) && field.default !== undefined) {
                initialData[field.name] = field.default;
              }
            });

            setFormData(initialData);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch provider:', err);
        setError(err.message || 'Failed to load provider schema');
      } finally {
        setLoading(false);
      }
    };

    fetchProvider();
  }, [providerId]);

  // Update value prop when provider changes
  useEffect(() => {
    if (value !== rawJson && !useRawEditor) {
      setRawJson(value || '');
    }
  }, [value, rawJson, useRawEditor]);

  // Update parent when form data changes
  const handleFieldChange = (fieldName: string, fieldValue: any) => {
    const newData = { ...formData, [fieldName]: fieldValue };
    setFormData(newData);
    const json = JSON.stringify(newData);
    setRawJson(json);
    onChange(json);
  };

  // Handle raw JSON editor
  const handleRawJsonChange = (newValue: string) => {
    setRawJson(newValue);
    try {
      const parsed = JSON.parse(newValue);
      setFormData(parsed);
      onChange(newValue);
    } catch {
      // Invalid JSON, don't update formData
      onChange(newValue);
    }
  };

  // Render form field based on type
  const renderField = (field: ConfigField) => {
    const fieldValue = formData[field.name];

    // Enum (select dropdown)
    if (field.enum && field.enum.length > 0) {
      return (
        <Select
          key={field.name}
          label={field.name.replace(/_/g, ' ').toUpperCase()}
          value={fieldValue || field.default || ''}
          onChange={(val) => handleFieldChange(field.name, val)}
          options={field.enum.map((opt) => ({ value: opt, label: opt }))}
          disabled={disabled}
          helperText={field.description}
          required={field.required}
        />
      );
    }

    // Boolean (toggle switch)
    if (field.type === 'boolean') {
      return (
        <div key={field.name} className="space-y-2">
          <ToggleSwitch
            label={field.name.replace(/_/g, ' ').toUpperCase()}
            enabled={fieldValue !== undefined ? fieldValue : field.default || false}
            onChange={(enabled) => handleFieldChange(field.name, enabled)}
            description={field.description}
            disabled={disabled}
          />
        </div>
      );
    }

    // Number/Integer
    if (field.type === 'number' || field.type === 'integer') {
      return (
        <Input
          key={field.name}
          type="number"
          label={field.name.replace(/_/g, ' ').toUpperCase()}
          value={fieldValue !== undefined ? fieldValue : field.default || ''}
          onChange={(e) =>
            handleFieldChange(
              field.name,
              e.target.value ? parseFloat(e.target.value) : undefined
            )
          }
          disabled={disabled}
          helperText={
            field.description ||
            (field.minimum !== undefined && field.maximum !== undefined
              ? `Range: ${field.minimum}-${field.maximum}`
              : '')
          }
          required={field.required}
        />
      );
    }

    // String (default)
    return (
      <Input
        key={field.name}
        label={field.name.replace(/_/g, ' ').toUpperCase()}
        value={fieldValue !== undefined ? fieldValue : field.default || ''}
        onChange={(e) => handleFieldChange(field.name, e.target.value)}
        disabled={disabled}
        helperText={field.description}
        placeholder={field.default}
        required={field.required}
      />
    );
  };

  // No provider selected
  if (!providerId) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </label>
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select a provider above to configure
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </label>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-lg"></div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </label>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  // No schema defined
  if (fields.length === 0) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </label>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            This provider has no configuration schema defined. You can enter raw JSON below if
            needed.
          </p>
        </div>
        <textarea
          value={rawJson}
          onChange={(e) => handleRawJsonChange(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder={placeholder || '{}'}
          disabled={disabled}
        />
      </div>
    );
  }

  // Raw editor mode
  if (useRawEditor) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
            {label} (Raw JSON)
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setUseRawEditor(false)}
          >
            <Wrench className="w-4 h-4" />
            Switch to Form
          </Button>
        </div>
        <textarea
          value={rawJson}
          onChange={(e) => handleRawJsonChange(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={6}
          placeholder={placeholder || '{}'}
          disabled={disabled}
        />
      </div>
    );
  }

  // Form builder mode
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setUseRawEditor(true)}
        >
          <Code className="w-4 h-4" />
          Edit Raw JSON
        </Button>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Provider: <strong className="text-gray-900 dark:text-gray-100">{provider?.display_name}</strong>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => renderField(field))}
        </div>

        {/* JSON Preview */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            View JSON Preview
          </summary>
          <pre className="mt-2 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto max-h-32">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
