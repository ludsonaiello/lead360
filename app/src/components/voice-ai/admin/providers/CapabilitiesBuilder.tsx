'use client';

// ============================================================================
// CapabilitiesBuilder Component
// ============================================================================
// Tag/chip input for adding/removing provider capabilities
// Outputs JSON array as string
// ============================================================================

import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface CapabilitiesBuilderProps {
  value: string; // JSON array as string
  onChange: (value: string) => void;
  error?: string;
}

/**
 * CapabilitiesBuilder - Visual builder for capabilities array
 */
export default function CapabilitiesBuilder({
  value,
  onChange,
  error,
}: CapabilitiesBuilderProps) {
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [newCapability, setNewCapability] = useState('');

  // Parse value on mount/change
  useEffect(() => {
    if (value && value.trim() !== '') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setCapabilities(parsed);
        }
      } catch {
        // Invalid JSON, keep current state
      }
    } else {
      setCapabilities([]);
    }
  }, []);

  // Update parent when capabilities change
  const updateValue = (caps: string[]) => {
    setCapabilities(caps);
    if (caps.length === 0) {
      onChange('');
    } else {
      onChange(JSON.stringify(caps));
    }
  };

  /**
   * Add new capability
   */
  const handleAdd = () => {
    const trimmed = newCapability.trim();
    if (trimmed && !capabilities.includes(trimmed)) {
      updateValue([...capabilities, trimmed]);
      setNewCapability('');
    }
  };

  /**
   * Remove capability
   */
  const handleRemove = (index: number) => {
    updateValue(capabilities.filter((_, i) => i !== index));
  };

  /**
   * Handle Enter key
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  // Common capability suggestions
  const suggestions = [
    'streaming',
    'multilingual',
    'punctuation',
    'diarization',
    'function_calling',
    'voice_cloning',
    'emotion',
    'real_time',
  ];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
        Capabilities
      </label>

      {/* Current capabilities as chips */}
      {capabilities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {capabilities.map((cap, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
            >
              <span>{cap}</span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new capability */}
      <div className="flex gap-2">
        <Input
          value={newCapability}
          onChange={(e) => setNewCapability(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter capability (e.g., streaming)"
          className="flex-1"
          error={error}
        />
        <Button
          type="button"
          onClick={handleAdd}
          variant="secondary"
          className="flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      {/* Quick suggestions */}
      {capabilities.length === 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="mb-2">Common capabilities:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setNewCapability(suggestion);
                }}
                className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
