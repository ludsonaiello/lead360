/**
 * Textarea Component
 * Multi-line text input with character counter and resize control
 */

import React, { forwardRef, useState, useEffect } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCharacterCount?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      showCharacterCount = false,
      resize = 'vertical',
      maxLength,
      className = '',
      value,
      ...props
    },
    ref
  ) => {
    const [charCount, setCharCount] = useState(0);

    useEffect(() => {
      if (value && typeof value === 'string') {
        setCharCount(value.length);
      } else {
        setCharCount(0);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      props.onChange?.(e);
    };

    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize',
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={props.id} className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
            {props.required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          value={value}
          maxLength={maxLength}
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
            ${resizeClasses[resize]}
            ${className}
          `}
          onChange={handleChange}
          {...props}
        />

        <div className="flex justify-between items-center mt-2">
          <div className="flex-1">
            {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
            {helperText && !error && <p className="text-sm text-gray-600 dark:text-gray-400">{helperText}</p>}
          </div>

          {showCharacterCount && maxLength && (
            <p className={`text-sm font-medium ml-4 ${charCount > maxLength ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {charCount} / {maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
