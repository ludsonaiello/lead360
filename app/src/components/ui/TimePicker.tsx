/**
 * TimePicker Component
 * Time selection with clock icon (HH:MM format, 24-hour)
 */

import React, { forwardRef } from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={props.id} className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
            {props.required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
            <Clock className="w-5 h-5" />
          </div>

          <input
            ref={ref}
            type="time"
            className={`
              w-full pl-11 pr-4 py-3 border-2 rounded-lg
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
            {...props}
          />
        </div>

        {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>}
      </div>
    );
  }
);

TimePicker.displayName = 'TimePicker';

export default TimePicker;
