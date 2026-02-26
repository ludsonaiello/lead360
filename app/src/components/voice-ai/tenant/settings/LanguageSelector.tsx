/**
 * Language Selector Component
 * Multi-select dropdown for Voice AI supported languages
 */

'use client';

import React from 'react';
import { MultiSelect, MultiSelectOption } from '@/components/ui/MultiSelect';

const LANGUAGE_OPTIONS: MultiSelectOption[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ru', label: 'Russian' },
];

interface LanguageSelectorProps {
  value: string[];
  onChange: (languages: string[]) => void;
  error?: string;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  error,
  disabled = false,
}) => {
  return (
    <MultiSelect
      label="Enabled Languages"
      options={LANGUAGE_OPTIONS}
      value={value}
      onChange={onChange}
      placeholder="Select languages"
      required
      error={error}
      disabled={disabled}
      searchable
      helperText="Select one or more languages the Voice AI agent should support"
    />
  );
};

export default LanguageSelector;
