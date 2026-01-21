/**
 * DynamicForm Component
 * Generates form fields from JSON Schema
 * Used for provider credentials and configuration forms
 */

'use client';

import React from 'react';
import { DynamicField } from './DynamicField';
import type { JSONSchema } from '@/lib/types/communication';

interface DynamicFormProps {
  schema: JSONSchema;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  className?: string;
}

export function DynamicForm({
  schema,
  values,
  onChange,
  errors,
  disabled = false,
  className = '',
}: DynamicFormProps) {
  if (!schema || !schema.properties) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        No configuration required
      </div>
    );
  }

  const properties = schema.properties;
  const required = schema.required || [];

  const handleFieldChange = (fieldName: string, fieldValue: any) => {
    onChange({
      ...values,
      [fieldName]: fieldValue,
    });
  };

  const fieldEntries = Object.entries(properties);

  if (fieldEntries.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        No configuration required
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {fieldEntries.map(([fieldName, fieldSchema]: [string, any]) => (
        <DynamicField
          key={fieldName}
          name={fieldName}
          schema={fieldSchema}
          value={values[fieldName]}
          onChange={(val) => handleFieldChange(fieldName, val)}
          required={required.includes(fieldName)}
          error={errors?.[fieldName]}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export default DynamicForm;
