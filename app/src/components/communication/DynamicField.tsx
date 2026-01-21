/**
 * DynamicField Component
 * Renders appropriate input based on JSON Schema property type
 * Supports: string, number, boolean, enum
 */

'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import type { JSONSchemaProperty } from '@/lib/types/communication';

interface DynamicFieldProps {
  name: string;
  schema: JSONSchemaProperty;
  value: any;
  onChange: (value: any) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export function DynamicField({
  name,
  schema,
  value,
  onChange,
  required = false,
  error,
  disabled = false,
}: DynamicFieldProps) {
  // Generate label from field name (convert snake_case to Title Case)
  const label = name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const helperText = schema.description;

  // Boolean field → Toggle Switch
  if (schema.type === 'boolean') {
    return (
      <div className="space-y-2">
        <ToggleSwitch
          enabled={value ?? schema.default ?? false}
          onChange={onChange}
          label={label}
          description={helperText}
          disabled={disabled}
        />
        {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  // Enum field → Select
  if (schema.enum && Array.isArray(schema.enum)) {
    const options: SelectOption[] = schema.enum.map((enumValue) => ({
      value: String(enumValue),
      label: String(enumValue),
    }));

    // Ensure value is always a string (never undefined) to avoid controlled/uncontrolled warning
    const selectValue = value !== undefined && value !== null ? String(value) : (schema.default !== undefined ? String(schema.default) : '');

    return (
      <Select
        label={label}
        options={options}
        value={selectValue}
        onChange={(newValue) => {
          // Convert back to number if schema type is number
          if (schema.type === 'number' || schema.type === 'integer') {
            onChange(Number(newValue));
          } else {
            onChange(newValue);
          }
        }}
        placeholder={`Select ${label.toLowerCase()}`}
        required={required}
        error={error}
        helperText={helperText}
        disabled={disabled}
      />
    );
  }

  // Number field → Input type="number"
  if (schema.type === 'number' || schema.type === 'integer') {
    return (
      <Input
        label={label}
        type="number"
        value={value ?? schema.default ?? ''}
        onChange={(e) => {
          const numValue = e.target.value === '' ? null : Number(e.target.value);
          onChange(numValue);
        }}
        placeholder={helperText || `Enter ${label.toLowerCase()}`}
        required={required}
        error={error}
        helperText={helperText}
        disabled={disabled}
        min={schema.minimum}
        max={schema.maximum}
      />
    );
  }

  // Password field → Input type="password" with toggle
  if (schema.format === 'password' || name.toLowerCase().includes('password') || name.toLowerCase().includes('secret') || name.toLowerCase().includes('api_key') || name.toLowerCase().includes('apikey')) {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="relative">
        <Input
          label={label}
          type={showPassword ? "text" : "password"}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={helperText || `Enter ${label.toLowerCase()}`}
          required={required}
          error={error}
          helperText={helperText}
          disabled={disabled}
          pattern={schema.pattern}
        />
        {value && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            title={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    );
  }

  // Default: String field → Input type="text"
  return (
    <Input
      label={label}
      type="text"
      value={value ?? schema.default ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={helperText || `Enter ${label.toLowerCase()}`}
      required={required}
      error={error}
      helperText={helperText}
      disabled={disabled}
      pattern={schema.pattern}
    />
  );
}

export default DynamicField;
