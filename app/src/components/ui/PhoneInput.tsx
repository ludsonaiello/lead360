/**
 * Phone Input Component
 * Phone input with automatic formatting (US format)
 * Automatically adds +1 prefix, user only types the 10-digit number
 * Stores value in E.164 format (+15551234567) for react-hook-form
 */

import React, { forwardRef, useState, useEffect } from 'react';

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', onChange, value, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);

    const formatPhoneNumber = (input: string): string => {
      // Remove all non-digits
      const cleaned = input.replace(/\D/g, '');

      // Format based on length (only 10 digits, no country code)
      if (cleaned.length === 0) return '';
      if (cleaned.length <= 3) return `(${cleaned}`;
      if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      const cleaned = input.replace(/\D/g, '');

      // Limit to 10 digits (US phone number without country code)
      if (cleaned.length > 10) return;

      const formatted = formatPhoneNumber(input);
      setDisplayValue(formatted);

      // Create E.164 format with +1 prefix for react-hook-form
      const e164Value = cleaned.length > 0 ? `+1${cleaned}` : '';

      // Call onChange with synthetic event that has E.164 format
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: e164Value,
            name: props.name,
          },
        } as React.ChangeEvent<HTMLInputElement>;

        onChange(syntheticEvent);
      }
    };

    // Initialize display value from prop value ONLY on mount or when value changes from external source
    useEffect(() => {
      // Only update if we haven't initialized yet OR if the value changed externally (not from user typing)
      if (!isInitialized) {
        if (value && typeof value === 'string') {
          // Remove the +1 prefix specifically (US numbers only)
          const digitsOnly = value.replace(/^\+1/, '');
          // For US numbers, we expect exactly 10 digits after removing +1
          if (digitsOnly.length === 10 && /^\d{10}$/.test(digitsOnly)) {
            setDisplayValue(formatPhoneNumber(digitsOnly));
          }
        }
        setIsInitialized(true);
      }
    }, [value, isInitialized]);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={props.id} className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
            {props.required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
          </label>
        )}

        {/* Hidden input for react-hook-form (stores E.164 format) */}
        <input
          ref={ref}
          type="hidden"
          value={value || ''}
          name={props.name}
        />

        {/* Visible formatted input with +1 prefix displayed */}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              {leftIcon}
            </div>
          )}
          <div className={`absolute ${leftIcon ? 'left-11' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-900 dark:text-gray-100 font-medium pointer-events-none`}>
            +1
          </div>
          <input
            type="tel"
            value={displayValue}
            onChange={handleChange}
            className={`
              w-full ${leftIcon ? 'pl-[4.5rem]' : 'pl-12'} ${rightIcon ? 'pr-11' : 'pr-4'} py-3 border-2 rounded-lg
              text-gray-900 dark:text-gray-100 font-medium
              bg-white dark:bg-gray-700
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
              transition-all duration-200
              ${error
                ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600'}
              ${className}
            `}
            disabled={props.disabled}
            placeholder="(555) 123-4567"
            id={props.id}
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

PhoneInput.displayName = 'PhoneInput';

export default PhoneInput;
