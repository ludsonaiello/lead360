/**
 * Tool Toggles Component
 * Toggle switches for Voice AI agent capabilities (booking, leads, transfer)
 */

'use client';

import React from 'react';
import { Control, Controller } from 'react-hook-form';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';

interface ToolTogglesProps {
  control: Control<any>;
  disabled?: boolean;
}

export const ToolToggles: React.FC<ToolTogglesProps> = ({ control, disabled = false }) => {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Agent Capabilities</h2>

      <Controller
        name="booking_enabled"
        control={control}
        render={({ field }) => (
          <ToggleSwitch
            label="Allow agent to book appointments"
            enabled={field.value}
            onChange={field.onChange}
            disabled={disabled}
          />
        )}
      />

      <Controller
        name="lead_creation_enabled"
        control={control}
        render={({ field }) => (
          <ToggleSwitch
            label="Allow agent to create leads"
            enabled={field.value}
            onChange={field.onChange}
            disabled={disabled}
          />
        )}
      />

      <Controller
        name="transfer_enabled"
        control={control}
        render={({ field }) => (
          <ToggleSwitch
            label="Allow agent to transfer calls to human operators"
            enabled={field.value}
            onChange={field.onChange}
            disabled={disabled}
          />
        )}
      />
    </div>
  );
};

export default ToolToggles;
