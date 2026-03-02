'use client';

// ============================================================================
// PhrasesList Component
// ============================================================================
// Sprint Voice-UX-02: Admin UI for Conversational Phrases
// Manages array of strings (phrases) with add/delete/edit functionality
// ============================================================================

import React, { useState } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface PhrasesListProps {
  value: string[] | null;
  onChange: (value: string[]) => void;
  label: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * PhrasesList Component
 *
 * Manages a list of conversational phrases with:
 * - Add/edit/delete functionality
 * - Character counter (150 max per phrase)
 * - Validation (1-10 phrases required)
 * - Inline editing for each phrase
 */
export default function PhrasesList({
  value,
  onChange,
  label,
  description,
  placeholder = 'Enter a phrase...',
  disabled = false,
}: PhrasesListProps) {
  const phrases = value || [];
  const [newPhrase, setNewPhrase] = useState('');

  /**
   * Add a new phrase to the list
   */
  const addPhrase = () => {
    if (newPhrase.trim() && phrases.length < 10) {
      onChange([...phrases, newPhrase.trim()]);
      setNewPhrase('');
    }
  };

  /**
   * Delete a phrase from the list
   */
  const deletePhrase = (index: number) => {
    onChange(phrases.filter((_, i) => i !== index));
  };

  /**
   * Update an existing phrase
   */
  const updatePhrase = (index: number, text: string) => {
    const updated = [...phrases];
    updated[index] = text;
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Label and Description */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </h3>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </p>
        )}
      </div>

      {/* Validation Warning */}
      {phrases.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            At least 1 phrase is required
          </p>
        </div>
      )}

      {/* Current Phrases */}
      {phrases.length > 0 ? (
        <div className="space-y-2">
          {phrases.map((phrase, index) => (
            <div key={index} className="flex items-start gap-2">
              <Input
                value={phrase}
                onChange={(e) => updatePhrase(index, e.target.value)}
                disabled={disabled}
                maxLength={150}
                helperText={`${phrase.length}/150 characters`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => deletePhrase(index)}
                disabled={disabled || phrases.length <= 1}
                title="Delete phrase"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No phrases added yet. Add your first phrase below.
          </p>
        </div>
      )}

      {/* Add New Phrase */}
      {phrases.length < 10 && (
        <div className="flex items-center gap-2">
          <Input
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addPhrase()}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={150}
            helperText={`${newPhrase.length}/150 characters`}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addPhrase}
            disabled={disabled || !newPhrase.trim()}
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      )}

      {/* Counter */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {phrases.length} of 10 phrases (min: 1, max: 10)
      </p>
    </div>
  );
}
