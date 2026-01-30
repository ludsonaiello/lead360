/**
 * MoneyInput Component
 * Currency input with automatic formatting ($1,234.56)
 * Handles parsing and formatting for money values
 */

'use client';

import React, { useState, useEffect, forwardRef } from 'react';
import { DollarSign } from 'lucide-react';

interface MoneyInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  id?: string;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      label,
      value,
      onChange,
      error,
      helperText,
      disabled = false,
      required = false,
      placeholder = '0.00',
      id,
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = useState('');

    // Format number to display string
    const formatValue = (num: number): string => {
      if (num === 0 || isNaN(num)) return '';
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    // Parse display string to number
    const parseValue = (str: string): number => {
      if (!str) return 0;
      const cleaned = str.replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    // Update display when value changes externally
    useEffect(() => {
      setDisplayValue(formatValue(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;

      // Allow typing decimal point and numbers
      const cleaned = input.replace(/[^0-9.]/g, '');

      // Prevent multiple decimal points
      const parts = cleaned.split('.');
      let formatted = parts[0];
      if (parts.length > 1) {
        formatted += '.' + parts.slice(1).join('').substring(0, 2);
      }

      setDisplayValue(formatted);
    };

    const handleBlur = () => {
      const numValue = parseValue(displayValue);
      onChange(numValue);
      setDisplayValue(formatValue(numValue));
    };

    const handleFocus = () => {
      // Remove formatting on focus for easier editing
      const numValue = parseValue(displayValue);
      if (numValue === 0) {
        setDisplayValue('');
      } else {
        setDisplayValue(numValue.toString());
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
          >
            {label}
            {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
            <DollarSign className="w-5 h-5" />
          </div>

          <input
            ref={ref}
            id={id}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholder={placeholder}
            disabled={disabled}
            className={`
              w-full pl-11 pr-4 py-3 border-2 rounded-lg
              text-gray-900 dark:text-gray-100 font-medium
              bg-white dark:bg-gray-700
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
              transition-all duration-200
              ${
                error
                  ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }
            `}
          />
        </div>

        {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

MoneyInput.displayName = 'MoneyInput';

export default MoneyInput;
