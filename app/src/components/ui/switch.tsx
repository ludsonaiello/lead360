/**
 * Switch Component (lowercase export)
 * Re-exports ToggleSwitch as Switch for shadcn/ui compatibility
 */

'use client';

import React from 'react';
import { ToggleSwitch } from './ToggleSwitch';

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked = false, onCheckedChange, disabled = false, className = '' }: SwitchProps) {
  return (
    <ToggleSwitch
      enabled={checked}
      onChange={onCheckedChange}
      disabled={disabled}
      className={className}
    />
  );
}
