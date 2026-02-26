'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import Textarea from '@/components/ui/Textarea';

interface JSONEditorProps {
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
  disabled?: boolean;
}

/**
 * JSON Editor Component
 * Validates JSON syntax in real-time and provides visual feedback
 */
export default function JSONEditor({
  value,
  onChange,
  placeholder = 'Enter JSON configuration...',
  label,
  rows = 4,
  disabled = false,
}: JSONEditorProps) {
  const [jsonValue, setJsonValue] = useState(value || '');
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setJsonValue(value || '');
  }, [value]);

  const validateJSON = (str: string): boolean => {
    if (!str || str.trim() === '') {
      setIsValid(true);
      setErrorMessage('');
      return true;
    }

    try {
      JSON.parse(str);
      setIsValid(true);
      setErrorMessage('');
      return true;
    } catch (error: any) {
      setIsValid(false);
      setErrorMessage(error.message || 'Invalid JSON');
      return false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setJsonValue(newValue);

    const valid = validateJSON(newValue);
    if (valid || newValue.trim() === '') {
      onChange(newValue);
    }
  };

  const handleBlur = () => {
    // Format JSON on blur if valid
    if (jsonValue && jsonValue.trim() !== '' && isValid) {
      try {
        const formatted = JSON.stringify(JSON.parse(jsonValue), null, 2);
        setJsonValue(formatted);
        onChange(formatted);
      } catch (error) {
        // Keep original if formatting fails
      }
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="relative">
        <Textarea
          value={jsonValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={`font-mono text-sm ${
            !isValid
              ? 'border-red-500 dark:border-red-400 focus:border-red-500 focus:ring-red-500'
              : jsonValue && jsonValue.trim() !== ''
              ? 'border-green-500 dark:border-green-400'
              : ''
          }`}
        />
        {jsonValue && jsonValue.trim() !== '' && (
          <div className="absolute right-3 top-3">
            {isValid ? (
              <Check className="h-5 w-5 text-green-500 dark:text-green-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
            )}
          </div>
        )}
      </div>
      {!isValid && errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Enter valid JSON. It will be auto-formatted on blur.
      </p>
    </div>
  );
}
