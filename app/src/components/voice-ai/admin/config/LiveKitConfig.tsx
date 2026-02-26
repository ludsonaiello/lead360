'use client';

import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Settings } from 'lucide-react';
import Input from '@/components/ui/Input';

interface LiveKitConfigProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  livekitApiKeySet: boolean;
  livekitApiSecretSet: boolean;
  disabled?: boolean;
}

/**
 * LiveKit Configuration Component
 * Section 7: LiveKit server configuration and credentials
 */
export default function LiveKitConfig({
  register,
  errors,
  livekitApiKeySet,
  livekitApiSecretSet,
  disabled = false,
}: LiveKitConfigProps) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-brand-600 dark:text-brand-400" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          7. LiveKit Configuration
        </h2>
      </div>
      <div className="space-y-6">
        <Input
          label="LiveKit URL"
          placeholder="wss://your-project.livekit.cloud"
          {...register('livekit_url')}
          error={errors.livekit_url?.message}
          disabled={disabled}
          helperText="WebSocket URL (wss://...)"
        />
        <Input
          label="LiveKit SIP Trunk URL (optional)"
          placeholder="sip.livekit.cloud"
          {...register('livekit_sip_trunk_url')}
          error={errors.livekit_sip_trunk_url?.message}
          disabled={disabled}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Input
              type="password"
              label="LiveKit API Key"
              placeholder={livekitApiKeySet ? '••••••••' : 'Enter new key'}
              {...register('livekit_api_key')}
              error={errors.livekit_api_key?.message}
              disabled={disabled}
              helperText={
                livekitApiKeySet
                  ? '✓ Key is set (leave blank to keep current)'
                  : '✗ No key set'
              }
            />
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              label="LiveKit API Secret"
              placeholder={livekitApiSecretSet ? '••••••••' : 'Enter new secret'}
              {...register('livekit_api_secret')}
              error={errors.livekit_api_secret?.message}
              disabled={disabled}
              helperText={
                livekitApiSecretSet
                  ? '✓ Secret is set (leave blank to keep current)'
                  : '✗ No secret set'
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}
