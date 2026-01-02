/**
 * Toggle Switch Component
 * Accessible toggle using Headless UI Switch
 */

'use client';

import React from 'react';
import { Switch } from '@headlessui/react';

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function ToggleSwitch({
  enabled,
  onChange,
  label,
  description,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <Switch.Group as="div" className="flex items-center">
      <Switch
        checked={enabled}
        onChange={onChange}
        disabled={disabled}
        className={`
          ${enabled ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900
        `}
      >
        <span className="sr-only">{label || 'Toggle'}</span>
        <span
          aria-hidden="true"
          className={`
            ${enabled ? 'translate-x-5' : 'translate-x-0'}
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
          `}
        />
      </Switch>

      {(label || description) && (
        <Switch.Label as="span" className="ml-3 cursor-pointer">
          {label && <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</span>}
          {description && (
            <span className="text-sm text-gray-600 dark:text-gray-400 block">{description}</span>
          )}
        </Switch.Label>
      )}
    </Switch.Group>
  );
}

export default ToggleSwitch;
