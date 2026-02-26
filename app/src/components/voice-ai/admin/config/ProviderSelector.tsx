'use client';

import React, { useEffect, useState } from 'react';
import Select from '@/components/ui/Select';
import voiceAiApi from '@/lib/api/voice-ai';
import type { VoiceAIProvider, ProviderType } from '@/lib/types/voice-ai';
import { AlertCircle } from 'lucide-react';

interface ProviderSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  providerType: ProviderType;
  label: string;
  disabled?: boolean;
}

/**
 * Provider Selector Component
 * Dropdown for selecting STT/LLM/TTS providers
 */
export default function ProviderSelector({
  value,
  onChange,
  providerType,
  label,
  disabled = false,
}: ProviderSelectorProps) {
  const [providers, setProviders] = useState<VoiceAIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await voiceAiApi.getAllProviders({
          provider_type: providerType,
          is_active: true,
        });
        setProviders(data);
      } catch (err: any) {
        console.error('Failed to fetch providers:', err);
        setError(err.message || 'Failed to load providers');
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [providerType]);

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-10 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  const options = [
    { value: '', label: '-- Select Provider --' },
    ...providers.map((provider) => ({
      value: provider.id,
      label: provider.display_name,
    })),
  ];

  return (
    <div className="space-y-2">
      <Select
        label={label}
        value={value || ''}
        onChange={(val) => onChange(val || null)}
        options={options}
        disabled={disabled}
      />
      {providers.length === 0 && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          No active {providerType} providers found. Create one in the Providers page.
        </p>
      )}
    </div>
  );
}
