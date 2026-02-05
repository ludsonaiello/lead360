'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Code, X } from 'lucide-react';

interface VariableTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  label?: string;
  helpText?: string;
}

/**
 * Text field that supports inserting Handlebars variables
 * Shows detected variables as tags and allows inserting new ones
 */
export default function VariableTextField({
  value,
  onChange,
  placeholder = 'Enter text...',
  multiline = false,
  rows = 3,
  label,
  helpText,
}: VariableTextFieldProps) {
  const [showVariableInput, setShowVariableInput] = useState(false);
  const [variableToInsert, setVariableToInsert] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Extract variables from text (e.g., {{customer.name}}, {{quote.total}})
  const extractVariables = (text: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1].trim());
    }
    return matches;
  };

  const detectedVariables = extractVariables(value);

  const handleInsertVariable = () => {
    if (!variableToInsert.trim()) return;

    const cursorPosition = inputRef.current?.selectionStart || value.length;
    const beforeCursor = value.substring(0, cursorPosition);
    const afterCursor = value.substring(cursorPosition);

    const variable = variableToInsert.startsWith('{{') && variableToInsert.endsWith('}}')
      ? variableToInsert
      : `{{${variableToInsert}}}`;

    const newValue = beforeCursor + variable + afterCursor;
    onChange(newValue);
    setVariableToInsert('');
    setShowVariableInput(false);

    // Focus back on the input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(
          cursorPosition + variable.length,
          cursorPosition + variable.length
        );
      }
    }, 0);
  };

  const handleRemoveVariable = (variable: string) => {
    const newValue = value.replace(new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`, 'g'), '');
    onChange(newValue);
  };

  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs text-gray-600 dark:text-gray-400 block font-medium">
          {label}
        </label>
      )}

      {/* Main Input */}
      <div className="relative">
        <InputComponent
          ref={inputRef as any}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={multiline ? rows : undefined}
          className="w-full px-3 py-2 pr-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
        />
        <button
          onClick={() => setShowVariableInput(!showVariableInput)}
          className="absolute right-2 top-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Insert variable"
        >
          <Code className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Variable Quick Insert */}
      {showVariableInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={variableToInsert}
            onChange={(e) => setVariableToInsert(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleInsertVariable();
              } else if (e.key === 'Escape') {
                setShowVariableInput(false);
                setVariableToInsert('');
              }
            }}
            placeholder="e.g., customer.name or quote.total"
            className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={handleInsertVariable}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
          >
            Insert
          </button>
        </div>
      )}

      {/* Detected Variables */}
      {detectedVariables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {detectedVariables.map((variable, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-mono"
            >
              <Code className="w-3 h-3" />
              <span>{variable}</span>
              <button
                onClick={() => handleRemoveVariable(variable)}
                className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded p-0.5 transition-colors"
                title="Remove this variable"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {helpText && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{helpText}</p>
      )}
    </div>
  );
}
