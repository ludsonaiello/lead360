/**
 * HoursInput Component
 * Duration input with separate Hours and Minutes fields.
 * Accepts and returns decimal hours (e.g., 7.5 = 7h 30m).
 * Drop-in replacement for number inputs — same value/onChange contract as MoneyInput.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface HoursInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

function decimalToHM(decimal: number): { hours: number; minutes: number } {
  if (!decimal || isNaN(decimal) || decimal < 0) return { hours: 0, minutes: 0 };
  const hours = Math.floor(decimal);
  let minutes = Math.round((decimal - hours) * 60);
  if (minutes >= 60) {
    return { hours: hours + 1, minutes: 0 };
  }
  return { hours, minutes };
}

function hmToDecimal(hours: number, minutes: number): number {
  const h = isNaN(hours) ? 0 : Math.max(0, hours);
  const m = isNaN(minutes) ? 0 : Math.min(59, Math.max(0, minutes));
  return Math.round((h + m / 60) * 100) / 100;
}

export function HoursInput({
  label,
  value,
  onChange,
  error,
  helperText,
  disabled = false,
  required = false,
  id,
}: HoursInputProps) {
  const [hoursStr, setHoursStr] = useState('');
  const [minutesStr, setMinutesStr] = useState('');

  // Sync display from external value — never show "0", use empty + placeholder instead
  useEffect(() => {
    const { hours, minutes } = decimalToHM(value);
    setHoursStr(hours === 0 ? '' : String(hours));
    setMinutesStr(minutes === 0 ? '' : String(minutes));
  }, [value]);

  const emitChange = useCallback(
    (h: string, m: string) => {
      const hours = h === '' ? 0 : parseInt(h, 10);
      const minutes = m === '' ? 0 : parseInt(m, 10);
      onChange(hmToDecimal(isNaN(hours) ? 0 : hours, isNaN(minutes) ? 0 : minutes));
    },
    [onChange],
  );

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setHoursStr(raw);
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    // Clamp to 59 while typing
    if (raw !== '' && parseInt(raw, 10) > 59) return;
    setMinutesStr(raw);
  };

  const handleHoursBlur = () => {
    const h = hoursStr === '' ? 0 : parseInt(hoursStr, 10);
    const normalized = isNaN(h) ? 0 : Math.max(0, h);
    setHoursStr(normalized === 0 ? '' : String(normalized));
    emitChange(String(normalized), minutesStr);
  };

  const handleMinutesBlur = () => {
    const m = minutesStr === '' ? 0 : parseInt(minutesStr, 10);
    const normalized = isNaN(m) ? 0 : Math.min(59, Math.max(0, m));
    setMinutesStr(normalized === 0 ? '' : String(normalized));
    emitChange(hoursStr, String(normalized));
  };

  const inputClasses = `
    w-full pr-8 pl-3 py-3 border-2 rounded-lg
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
  `;

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

      <div className="flex items-center gap-2">
        {/* Hours */}
        <div className="relative flex-1">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            value={hoursStr}
            onChange={handleHoursChange}
            onBlur={handleHoursBlur}
            placeholder="0"
            disabled={disabled}
            className={inputClasses}
            aria-label={label ? `${label} — hours` : 'Hours'}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400 dark:text-gray-500 pointer-events-none">
            h
          </span>
        </div>

        {/* Minutes */}
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="numeric"
            value={minutesStr}
            onChange={handleMinutesChange}
            onBlur={handleMinutesBlur}
            placeholder="0"
            disabled={disabled}
            className={inputClasses}
            aria-label={label ? `${label} — minutes` : 'Minutes'}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400 dark:text-gray-500 pointer-events-none">
            m
          </span>
        </div>
      </div>

      {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
}

export default HoursInput;
