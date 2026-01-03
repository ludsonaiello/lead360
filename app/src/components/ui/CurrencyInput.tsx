/**
 * CurrencyInput Component
 * Simple currency input with natural typing - NO BULLSHIT JUMPING
 * Type naturally: 1500 stays 1500, then formats to 1,500.00 on blur
 */

import React, { forwardRef, useState, useEffect, useRef } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  value?: number | null;
  onChange?: (value: number | null) => void;
  onBlur?: () => void;
  max?: number;
  min?: number;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      value,
      onChange,
      onBlur,
      max = 99999999.99,
      min = 0,
      className = '',
      ...props
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Format number with commas and decimals
    const formatCurrency = (num: number): string => {
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    // Update display when value changes from outside (like form reset)
    useEffect(() => {
      if (!isFocused) {
        if (value !== null && value !== undefined) {
          setDisplayValue(formatCurrency(value));
        } else {
          setDisplayValue('');
        }
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;

      // Allow only digits and one decimal point
      const cleaned = input.replace(/[^\d.]/g, '');

      // Prevent multiple decimal points
      const parts = cleaned.split('.');
      let formatted = parts[0];
      if (parts.length > 1) {
        formatted = parts[0] + '.' + parts.slice(1).join('').substring(0, 2);
      }

      // Update display with raw input
      setDisplayValue(formatted);

      // Parse to number and call onChange
      const numValue = formatted === '' ? null : parseFloat(formatted);

      // Validate max/min
      if (numValue !== null) {
        if (numValue > max) return;
        if (numValue < min) return;
      }

      if (onChange) {
        onChange(numValue);
      }
    };

    const handleFocus = () => {
      setIsFocused(true);
      // Show raw number when focused
      if (value !== null && value !== undefined) {
        setDisplayValue(value.toString());
      }
    };

    const handleBlur = () => {
      setIsFocused(false);

      // Format on blur
      if (value !== null && value !== undefined) {
        setDisplayValue(formatCurrency(value));
      } else if (displayValue) {
        // If user typed something but it's not a valid number
        const num = parseFloat(displayValue);
        if (!isNaN(num)) {
          setDisplayValue(formatCurrency(num));
        } else {
          setDisplayValue('');
        }
      }

      if (onBlur) {
        onBlur();
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={props.id} className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
            {props.required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
          </label>
        )}

        {/* Hidden input for react-hook-form */}
        <input
          ref={ref}
          type="hidden"
          value={value ?? ''}
          name={props.name}
        />

        {/* Visible input */}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={props.disabled}
            placeholder={props.placeholder || '0.00'}
            id={props.id}
            className={`
              w-full px-4 py-3 border-2 rounded-lg
              text-gray-900 dark:text-gray-100 font-medium
              bg-white dark:bg-gray-700
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
              transition-all duration-200
              ${error
                ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600'}
              ${leftIcon ? 'pl-11' : ''}
              ${rightIcon ? 'pr-11' : ''}
              ${className}
            `}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>

        {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>}
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';

export default CurrencyInput;
