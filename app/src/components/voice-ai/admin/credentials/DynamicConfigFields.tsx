'use client';

// ============================================================================
// DynamicConfigFields Component
// ============================================================================
// Dynamically generates form fields based on provider's JSON Schema
// ============================================================================

import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Info } from 'lucide-react';
import Input from '@/components/ui/Input';
import type { SchemaField } from '@/lib/utils/json-schema-parser';

interface DynamicConfigFieldsProps {
  fields: SchemaField[];
  register: UseFormRegister<any>;
  errors: FieldErrors;
}

/**
 * DynamicConfigFields - Renders form fields based on JSON Schema
 */
export default function DynamicConfigFields({
  fields,
  register,
  errors,
}: DynamicConfigFieldsProps) {
  if (fields.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium mb-1">No Configuration Schema Available</p>
            <p>
              This provider does not have a configuration schema defined. You can leave
              the configuration empty or provide custom JSON if needed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <p>
          Provider-specific configuration options. Leave empty to use defaults.
        </p>
      </div>

      {fields.map((field) => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {/* Render field based on type */}
          {field.type === 'enum' ? (
            // Select dropdown for enum (native select for better react-hook-form integration)
            <select
              {...register(field.name, {
                required: field.required ? `${field.label} is required` : false,
              })}
              className={`
                w-full px-3 py-2 border rounded-lg
                bg-white dark:bg-gray-800
                border-gray-300 dark:border-gray-600
                text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${errors[field.name] ? 'border-red-500' : ''}
              `}
            >
              <option value="">Select {field.label}</option>
              {field.enum?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : field.type === 'boolean' ? (
            // Checkbox for boolean
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register(field.name)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Enable {field.label}
              </span>
            </label>
          ) : field.type === 'number' || field.type === 'integer' ? (
            // Number input
            <Input
              type="number"
              {...register(field.name, {
                required: field.required ? `${field.label} is required` : false,
                valueAsNumber: true,
                min: field.minimum,
                max: field.maximum,
              })}
              placeholder={
                field.default !== undefined ? `Default: ${field.default}` : undefined
              }
              error={errors[field.name]?.message as string}
              min={field.minimum}
              max={field.maximum}
              step={field.type === 'integer' ? 1 : 0.1}
            />
          ) : (
            // Text input for string
            <Input
              type="text"
              {...register(field.name, {
                required: field.required ? `${field.label} is required` : false,
              })}
              placeholder={
                field.default !== undefined ? `Default: ${field.default}` : undefined
              }
              error={errors[field.name]?.message as string}
            />
          )}

          {/* Helper text / description */}
          {field.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {field.description}
            </p>
          )}

          {/* Range hint for numbers */}
          {(field.type === 'number' || field.type === 'integer') &&
            (field.minimum !== undefined || field.maximum !== undefined) && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {field.minimum !== undefined && field.maximum !== undefined
                  ? `Range: ${field.minimum} - ${field.maximum}`
                  : field.minimum !== undefined
                  ? `Minimum: ${field.minimum}`
                  : `Maximum: ${field.maximum}`}
              </p>
            )}
        </div>
      ))}
    </div>
  );
}
