/**
 * MaskedInput Component
 * Generic masked input using react-imask (React 19 compatible)
 * Supports EIN (XX-XXXXXXX), ZIP (XXXXX-XXXX), routing numbers, etc.
 */

import React, { forwardRef } from 'react';
import { IMaskInput } from 'react-imask';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'mask'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  mask: string;
  maskChar?: string | null;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAccept?: (value: string) => void;
}

export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, mask, maskChar = '_', className = '', onChange, onAccept, value, ...props }, ref) => {
    // Convert react-input-mask style masks to IMask format
    // "99-9999999" -> "00-0000000" (0 = any digit)
    const imaskMask = mask.replace(/9/g, '0');

    const handleAccept = (value: string) => {
      // Create a synthetic event for compatibility with react-hook-form
      if (onChange) {
        const syntheticEvent = {
          target: {
            name: props.name,
            value: value,
          },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }

      if (onAccept) {
        onAccept(value);
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

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              {leftIcon}
            </div>
          )}

          <IMaskInput
            {...props}
            value={String(value || '')}
            mask={imaskMask}
            unmask={false}
            lazy={maskChar === null}
            placeholderChar={maskChar || '_'}
            onAccept={handleAccept}
            inputRef={ref}
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

MaskedInput.displayName = 'MaskedInput';

export default MaskedInput;
