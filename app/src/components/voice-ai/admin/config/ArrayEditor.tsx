'use client';

// ============================================================================
// ArrayEditor Component
// ============================================================================
// User-friendly editor for JSON arrays (e.g., ["en", "pt", "es"])
// Allows comma/semicolon separated input, converts to/from JSON array
// ============================================================================

import React, { useState, useEffect } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Check, X, Code, List } from 'lucide-react';

interface ArrayEditorProps {
  value: string | null; // JSON array string: ["en","pt","es"]
  onChange: (value: string | null) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  helperText?: string;
  error?: string;
}

/**
 * ArrayEditor Component
 * Converts between user-friendly comma-separated input and JSON array
 */
export default function ArrayEditor({
  value,
  onChange,
  label,
  placeholder = 'en, pt, es',
  disabled = false,
  helperText,
  error,
}: ArrayEditorProps) {
  const [rawInput, setRawInput] = useState('');
  const [useRawEditor, setUseRawEditor] = useState(false);
  const [rawJson, setRawJson] = useState(value || '');
  const [isValid, setIsValid] = useState(true);

  // Parse JSON array to comma-separated string
  const parseArrayToString = (jsonStr: string | null): string => {
    if (!jsonStr || jsonStr.trim() === '') return '';
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.join(', ');
      }
    } catch {
      // Invalid JSON
    }
    return '';
  };

  // Initialize from value
  useEffect(() => {
    const parsed = parseArrayToString(value);
    setRawInput(parsed);
    setRawJson(value || '');
    setIsValid(validateJson(value));
  }, [value]);

  // Validate JSON
  const validateJson = (jsonStr: string | null): boolean => {
    if (!jsonStr || jsonStr.trim() === '') return true;
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed);
    } catch {
      return false;
    }
  };

  // Handle user input change
  const handleInputChange = (input: string) => {
    setRawInput(input);

    // Convert to JSON array
    const items = input
      .split(/[,;]/)
      .map((v) => v.trim())
      .filter((v) => v !== '');

    if (items.length === 0) {
      onChange(null);
      setRawJson('');
      setIsValid(true);
    } else {
      const json = JSON.stringify(items);
      onChange(json);
      setRawJson(json);
      setIsValid(true);
    }
  };

  // Handle raw JSON change
  const handleRawJsonChange = (input: string) => {
    setRawJson(input);
    const valid = validateJson(input);
    setIsValid(valid);

    if (valid || input.trim() === '') {
      onChange(input || null);
      setRawInput(parseArrayToString(input));
    }
  };

  // Save raw JSON
  const handleRawJsonSave = () => {
    if (isValid) {
      onChange(rawJson || null);
      setUseRawEditor(false);
    }
  };

  // Raw JSON editor mode
  if (useRawEditor) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
            {label} (Raw JSON)
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setUseRawEditor(false)}
          >
            <List className="w-4 h-4" />
            Simple Editor
          </Button>
        </div>

        <div className="relative">
          <textarea
            value={rawJson}
            onChange={(e) => handleRawJsonChange(e.target.value)}
            className={`
              w-full px-4 py-3 pr-12 border-2 rounded-lg font-mono text-sm
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500
              ${
                error || !isValid
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }
              ${disabled ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}
            `}
            rows={3}
            placeholder={placeholder}
            disabled={disabled}
          />

          {/* Validation Icon */}
          <div className="absolute right-3 top-3">
            {isValid ? (
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <X className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
          </div>
        </div>

        {!isValid && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Invalid JSON array format. Expected: ["item1","item2"]
          </p>
        )}

        {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

        {helperText && !error && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{helperText}</p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleRawJsonSave}
            disabled={!isValid}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setRawJson(value || '');
              setUseRawEditor(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Simple editor mode
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setUseRawEditor(true)}
        >
          <Code className="w-4 h-4" />
          Raw JSON
        </Button>
      </div>

      <div className="relative">
        <Input
          value={rawInput}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          helperText={helperText || 'Separate items with commas or semicolons'}
        />

        {/* Validation Icon */}
        {rawInput && (
          <div className="absolute right-3 top-3">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
        )}
      </div>

      {/* JSON Preview */}
      {rawJson && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            View JSON Preview
          </summary>
          <pre className="mt-1 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-24">
            {rawJson}
          </pre>
        </details>
      )}
    </div>
  );
}
