'use client';

// ============================================================================
// ConfigBuilder Component
// ============================================================================
// Key-value pair builder for configuration objects
// Outputs JSON object as string
// ============================================================================

import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

interface ConfigBuilderProps {
  value: string; // JSON object as string
  onChange: (value: string) => void
  error?: string;
  label: string;
  helperText?: string;
  placeholder?: string;
}

interface ConfigEntry {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean';
}

/**
 * ConfigBuilder - Visual builder for config objects
 */
export default function ConfigBuilder({
  value,
  onChange,
  error,
  label,
  helperText,
  placeholder = '{"key": "value"}',
}: ConfigBuilderProps) {
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<'string' | 'number' | 'boolean'>('string');

  // Parse value on mount
  useEffect(() => {
    if (value && value.trim() !== '') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          const parsedEntries: ConfigEntry[] = Object.entries(parsed).map(([k, v]) => ({
            key: k,
            value: String(v),
            type: typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string',
          }));
          setEntries(parsedEntries);
        }
      } catch {
        // Invalid JSON, keep current state
      }
    }
  }, []);

  // Update parent when entries change
  const updateValue = (newEntries: ConfigEntry[]) => {
    setEntries(newEntries);

    if (newEntries.length === 0) {
      onChange('');
    } else {
      const obj: Record<string, any> = {};
      newEntries.forEach((entry) => {
        if (entry.type === 'number') {
          obj[entry.key] = parseFloat(entry.value);
        } else if (entry.type === 'boolean') {
          obj[entry.key] = entry.value === 'true';
        } else {
          obj[entry.key] = entry.value;
        }
      });
      onChange(JSON.stringify(obj));
    }
  };

  /**
   * Add new entry
   */
  const handleAdd = () => {
    if (newKey.trim() && newValue.trim()) {
      const exists = entries.find((e) => e.key === newKey.trim());
      if (!exists) {
        updateValue([...entries, { key: newKey.trim(), value: newValue.trim(), type: newType }]);
        setNewKey('');
        setNewValue('');
        setNewType('string');
      }
    }
  };

  /**
   * Remove entry
   */
  const handleRemove = (index: number) => {
    updateValue(entries.filter((_, i) => i !== index));
  };

  /**
   * Update entry
   */
  const handleUpdate = (index: number, field: 'key' | 'value' | 'type', val: string) => {
    const updated = [...entries];
    if (field === 'type') {
      updated[index].type = val as 'string' | 'number' | 'boolean';
      // Convert value to match type
      if (val === 'boolean') {
        updated[index].value = 'false';
      }
    } else {
      updated[index][field] = val;
    }
    updateValue(updated);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
        {label}
      </label>

      {helperText && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{helperText}</p>
      )}

      {/* Existing entries */}
      {entries.length > 0 && (
        <div className="space-y-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
          {entries.map((entry, index) => (
            <div key={index} className="flex gap-2 items-start">
              <Input
                value={entry.key}
                onChange={(e) => handleUpdate(index, 'key', e.target.value)}
                placeholder="key"
                className="flex-1"
              />
              <Select
                options={[
                  { value: 'string', label: 'Text' },
                  { value: 'number', label: 'Number' },
                  { value: 'boolean', label: 'Boolean' },
                ]}
                value={entry.type}
                onChange={(val) => handleUpdate(index, 'type', val)}
                className="w-32"
              />
              {entry.type === 'boolean' ? (
                <Select
                  options={[
                    { value: 'true', label: 'true' },
                    { value: 'false', label: 'false' },
                  ]}
                  value={entry.value}
                  onChange={(val) => handleUpdate(index, 'value', val)}
                  className="flex-1"
                />
              ) : (
                <Input
                  type={entry.type === 'number' ? 'number' : 'text'}
                  value={entry.value}
                  onChange={(e) => handleUpdate(index, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1"
                />
              )}
              <Button
                type="button"
                onClick={() => handleRemove(index)}
                variant="danger"
                size="sm"
                className="flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new entry */}
      <div className="flex gap-2 items-end">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="key"
          className="flex-1"
          label="Key"
        />
        <Select
          options={[
            { value: 'string', label: 'Text' },
            { value: 'number', label: 'Number' },
            { value: 'boolean', label: 'Boolean' },
          ]}
          value={newType}
          onChange={(val) => setNewType(val as any)}
          className="w-32"
          label="Type"
        />
        {newType === 'boolean' ? (
          <Select
            options={[
              { value: 'true', label: 'true' },
              { value: 'false', label: 'false' },
            ]}
            value={newValue || 'false'}
            onChange={(val) => setNewValue(val)}
            className="flex-1"
            label="Value"
          />
        ) : (
          <Input
            type={newType === 'number' ? 'number' : 'text'}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="value"
            className="flex-1"
            label="Value"
          />
        )}
        <Button
          type="button"
          onClick={handleAdd}
          variant="secondary"
          className="flex items-center gap-1 mb-1"
        >
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* JSON Preview */}
      {value && (
        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
          {value}
        </div>
      )}
    </div>
  );
}
