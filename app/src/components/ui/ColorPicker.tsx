/**
 * ColorPicker Component
 * Hex color selector with ChromePicker and preset colors
 */

'use client';

import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { ChromePicker, ColorResult } from 'react-color';
import { Palette } from 'lucide-react';

interface ColorPickerProps {
  label?: string;
  error?: string;
  helperText?: string;
  value?: string;
  onChange?: (color: string) => void;
  presets?: string[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
}

const DEFAULT_PRESETS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Orange
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
];

export const ColorPicker = forwardRef<HTMLInputElement, ColorPickerProps>(
  (
    {
      label,
      error,
      helperText,
      value = '#007BFF',
      onChange,
      presets = DEFAULT_PRESETS,
      required = false,
      disabled = false,
      className = '',
      name,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [color, setColor] = useState(value);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (value) {
        setColor(value);
      }
    }, [value]);

    // Close picker when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    const handleColorChange = (newColor: ColorResult) => {
      const hexColor = newColor.hex.toUpperCase();
      setColor(hexColor);
      onChange?.(hexColor);
    };

    const handlePresetClick = (presetColor: string) => {
      setColor(presetColor);
      onChange?.(presetColor);
      setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setColor(newValue);
      // Only call onChange if it's a valid hex color
      if (/^#[0-9A-F]{6}$/i.test(newValue)) {
        onChange?.(newValue.toUpperCase());
      }
    };

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
            {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
          </label>
        )}

        <div className="flex gap-3">
          {/* Color swatch button */}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={`
              w-12 h-12 border-2 rounded-lg flex items-center justify-center
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              ${error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}
            `}
            style={{ backgroundColor: color }}
          >
            <Palette className="w-5 h-5 text-white drop-shadow-md" />
          </button>

          {/* Hex input */}
          <div className="flex-1">
            <input
              ref={ref}
              type="text"
              value={color}
              onChange={handleInputChange}
              disabled={disabled}
              placeholder="#007BFF"
              maxLength={7}
              className={`
                w-full px-4 py-3 border-2 rounded-lg
                text-gray-900 dark:text-gray-100 font-medium uppercase
                bg-white dark:bg-gray-700
                placeholder:text-gray-400 dark:placeholder:text-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
                transition-all duration-200
                ${error
                  ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'}
              `}
            />
          </div>
        </div>

        {/* Hidden input for react-hook-form */}
        {name && <input type="hidden" name={name} value={color} />}

        {/* Color picker popover */}
        {isOpen && (
          <div ref={pickerRef} className="absolute z-50 mt-2">
            <ChromePicker color={color} onChange={handleColorChange} disableAlpha />

            {/* Preset colors */}
            {presets.length > 0 && (
              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Presets</p>
                <div className="grid grid-cols-8 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className="w-8 h-8 rounded-md border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ backgroundColor: preset }}
                      title={preset}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>}
      </div>
    );
  }
);

ColorPicker.displayName = 'ColorPicker';

export default ColorPicker;
