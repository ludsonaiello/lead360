'use client';

// ============================================================================
// ConfigSchemaBuilder Component
// ============================================================================
// Simplified JSON Schema builder for common provider config patterns
// Outputs JSON Schema as string
// ============================================================================

import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

interface ConfigSchemaBuilderProps {
  value: string; // JSON Schema as string
  onChange: (value: string) => void;
  error?: string;
}

interface SchemaProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  required: boolean;
  default?: string;
  description?: string;
  enumValues?: string[]; // For enum type
  min?: number; // For number type
  max?: number; // For number type
}

/**
 * ConfigSchemaBuilder - Visual builder for JSON Schema
 */
export default function ConfigSchemaBuilder({
  value,
  onChange,
  error,
}: ConfigSchemaBuilderProps) {
  const [properties, setProperties] = useState<SchemaProperty[]>([]);
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [rawJson, setRawJson] = useState('');
  // Store raw enum input strings per property index
  const [enumInputs, setEnumInputs] = useState<Record<number, string>>({});

  // Parse value on mount
  useEffect(() => {
    if (value && value.trim() !== '') {
      try {
        const parsed = JSON.parse(value);
        if (parsed.type === 'object' && parsed.properties) {
          const props: SchemaProperty[] = Object.entries(parsed.properties).map(([name, schema]: [string, any]) => {
            const prop: SchemaProperty = {
              name,
              type: schema.enum ? 'enum' : (schema.type || 'string'),
              required: parsed.required?.includes(name) || false,
              default: schema.default !== undefined ? String(schema.default) : undefined,
              description: schema.description,
            };

            if (schema.enum) {
              prop.enumValues = schema.enum;
            }
            if (schema.type === 'number' || schema.type === 'integer') {
              prop.min = schema.minimum;
              prop.max = schema.maximum;
            }

            return prop;
          });
          setProperties(props);

          // Initialize enum inputs
          const inputs: Record<number, string> = {};
          props.forEach((prop, idx) => {
            if (prop.enumValues) {
              inputs[idx] = prop.enumValues.join(', ');
            }
          });
          setEnumInputs(inputs);
        }
        setRawJson(value);
      } catch {
        setRawJson(value);
      }
    }
  }, []);

  // Update parent when properties change
  const updateValue = (props: SchemaProperty[]) => {
    setProperties(props);

    if (props.length === 0) {
      onChange('');
      setRawJson('');
    } else {
      const schema: any = {
        type: 'object',
        properties: {},
        required: props.filter((p) => p.required).map((p) => p.name),
      };

      props.forEach((prop) => {
        const propSchema: any = {
          type: prop.type === 'enum' ? 'string' : prop.type,
        };

        if (prop.description) {
          propSchema.description = prop.description;
        }

        if (prop.default !== undefined && prop.default !== '') {
          if (prop.type === 'number') {
            propSchema.default = parseFloat(prop.default);
          } else if (prop.type === 'boolean') {
            propSchema.default = prop.default === 'true';
          } else {
            propSchema.default = prop.default;
          }
        }

        if (prop.type === 'enum' && prop.enumValues && prop.enumValues.length > 0) {
          propSchema.enum = prop.enumValues;
        }

        if (prop.type === 'number') {
          if (prop.min !== undefined) propSchema.minimum = prop.min;
          if (prop.max !== undefined) propSchema.maximum = prop.max;
        }

        schema.properties[prop.name] = propSchema;
      });

      if (schema.required.length === 0) {
        delete schema.required;
      }

      const json = JSON.stringify(schema);
      onChange(json);
      setRawJson(json);
    }
  };

  /**
   * Add new property
   */
  const handleAdd = () => {
    updateValue([
      ...properties,
      { name: 'new_property', type: 'string', required: false },
    ]);
  };

  /**
   * Remove property
   */
  const handleRemove = (index: number) => {
    updateValue(properties.filter((_, i) => i !== index));
  };

  /**
   * Update property
   */
  const handleUpdate = (index: number, updates: Partial<SchemaProperty>) => {
    const updated = [...properties];
    updated[index] = { ...updated[index], ...updates };

    // If switching to enum type, initialize enum input
    if (updates.type === 'enum' && !enumInputs[index]) {
      setEnumInputs({ ...enumInputs, [index]: 'option1' });
    }

    // If enumValues is being updated, sync to enumInputs
    if (updates.enumValues) {
      setEnumInputs({ ...enumInputs, [index]: updates.enumValues.join(', ') });
    }

    updateValue(updated);
  };

  /**
   * Handle raw JSON edit
   */
  const handleRawJsonSave = () => {
    try {
      JSON.parse(rawJson); // Validate
      onChange(rawJson);
      setShowRawEditor(false);
    } catch {
      // Invalid JSON, don't save
    }
  };

  if (showRawEditor) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
            Config Schema (Raw JSON)
          </label>
          <Button
            type="button"
            onClick={() => setShowRawEditor(false)}
            variant="secondary"
            size="sm"
          >
            Switch to Builder
          </Button>
        </div>

        <Textarea
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          rows={12}
          className="font-mono text-sm"
          placeholder='{"type":"object","properties":{"model":{"type":"string"}}}'
        />

        <div className="flex gap-2">
          <Button type="button" onClick={handleRawJsonSave} variant="primary" size="sm">
            Save
          </Button>
          <Button
            type="button"
            onClick={() => {
              setRawJson(value);
              setShowRawEditor(false);
            }}
            variant="secondary"
            size="sm"
          >
            Cancel
          </Button>
        </div>

        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          Config Schema
        </label>
        <Button
          type="button"
          onClick={() => setShowRawEditor(true)}
          variant="ghost"
          size="sm"
        >
          Edit Raw JSON
        </Button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Define configuration properties for this provider
      </p>

      {/* Existing properties */}
      {properties.length > 0 && (
        <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          {properties.map((prop, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
              {/* Name and Type */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Property Name"
                  value={prop.name}
                  onChange={(e) => handleUpdate(index, { name: e.target.value })}
                  placeholder="model"
                />
                <Select
                  label="Type"
                  options={[
                    { value: 'string', label: 'String' },
                    { value: 'number', label: 'Number' },
                    { value: 'boolean', label: 'Boolean' },
                    { value: 'enum', label: 'Enum (Select)' },
                  ]}
                  value={prop.type}
                  onChange={(val) =>
                    handleUpdate(index, { type: val as any, enumValues: val === 'enum' ? ['option1'] : undefined })
                  }
                />
              </div>

              {/* Enum values (if type is enum) */}
              {prop.type === 'enum' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Enum Options (comma or semicolon separated)
                  </label>
                  <Input
                    value={enumInputs[index] || ''}
                    onChange={(e) => {
                      // Store raw input in local state
                      setEnumInputs({ ...enumInputs, [index]: e.target.value });
                    }}
                    onBlur={() => {
                      // Parse into array when user finishes editing
                      const rawValue = enumInputs[index] || '';
                      const enumArray = rawValue
                        .split(/[,;]/)
                        .map((v) => v.trim())
                        .filter((v) => v !== '');

                      handleUpdate(index, {
                        enumValues: enumArray.length > 0 ? enumArray : ['option1']
                      });
                    }}
                    placeholder="nova-2, nova-2-general, nova-2-phonecall"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Separate options with commas or semicolons
                  </p>
                </div>
              )}

              {/* Min/Max (if type is number) */}
              {prop.type === 'number' && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    label="Minimum"
                    value={prop.min !== undefined ? prop.min : ''}
                    onChange={(e) =>
                      handleUpdate(index, { min: e.target.value ? parseFloat(e.target.value) : undefined })
                    }
                    placeholder="0"
                  />
                  <Input
                    type="number"
                    label="Maximum"
                    value={prop.max !== undefined ? prop.max : ''}
                    onChange={(e) =>
                      handleUpdate(index, { max: e.target.value ? parseFloat(e.target.value) : undefined })
                    }
                    placeholder="100"
                  />
                </div>
              )}

              {/* Default value */}
              <Input
                label="Default Value"
                value={prop.default || ''}
                onChange={(e) => handleUpdate(index, { default: e.target.value })}
                placeholder={prop.type === 'enum' ? 'Select default from enum' : 'Default value'}
              />

              {/* Description */}
              <Input
                label="Description"
                value={prop.description || ''}
                onChange={(e) => handleUpdate(index, { description: e.target.value })}
                placeholder="Description of this property"
              />

              {/* Required checkbox and delete button */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prop.required}
                    onChange={(e) => handleUpdate(index, { required: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
                </label>

                <Button
                  type="button"
                  onClick={() => handleRemove(index)}
                  variant="danger"
                  size="sm"
                >
                  <X className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      <Button
        type="button"
        onClick={handleAdd}
        variant="secondary"
        className="w-full flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Property
      </Button>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* JSON Preview */}
      {value && (
        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded max-h-32 overflow-auto">
          {value}
        </div>
      )}
    </div>
  );
}
