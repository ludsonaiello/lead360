/**
 * MultiSelect Component
 * Multi-selection dropdown with search using Headless UI Listbox
 */

'use client';

import React, { Fragment, useState, useRef, useEffect } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown, X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: MultiSelectOption[];
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  className?: string;
  name?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  error,
  helperText,
  options,
  value = [],
  onChange,
  placeholder = 'Select options',
  disabled = false,
  required = false,
  searchable = false,
  className = '',
  name,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Determine dropdown direction based on available space
  useEffect(() => {
    const checkDropdownDirection = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        // If less than 400px below and more space above, open upward
        if (spaceBelow < 400 && spaceAbove > spaceBelow) {
          setDropdownDirection('up');
        } else {
          setDropdownDirection('down');
        }
      }
    };

    checkDropdownDirection();
    window.addEventListener('resize', checkDropdownDirection);
    window.addEventListener('scroll', checkDropdownDirection, true);

    return () => {
      window.removeEventListener('resize', checkDropdownDirection);
      window.removeEventListener('scroll', checkDropdownDirection, true);
    };
  }, []);

  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  const filteredOptions =
    searchable && searchQuery
      ? options.filter((option) => option.label.toLowerCase().includes(searchQuery.toLowerCase()))
      : options;

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange?.(value.filter((v) => v !== optionValue));
    } else {
      onChange?.([...value, optionValue]);
    }
  };

  const handleRemove = (optionValue: string) => {
    onChange?.(value.filter((v) => v !== optionValue));
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <Listbox value={value} onChange={onChange} disabled={disabled} multiple>
        {({ open }) => (
          <div className="relative">
            <div className="relative">
              <Listbox.Button
                ref={buttonRef}
                className={`
                  relative w-full min-h-[42px] cursor-default rounded-lg
                  bg-white dark:bg-gray-800
                  border ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                  py-2 pl-3 pr-10 text-left
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed
                  transition-all duration-200
                `}
              >
                <div className="flex flex-wrap gap-1">
                  {selectedOptions.length > 0 ? (
                    selectedOptions.map((option) => (
                      <span
                        key={option.value}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded"
                      >
                        {option.label}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(option.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemove(option.value);
                            }
                          }}
                          className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded cursor-pointer"
                          aria-label={`Remove ${option.label}`}
                        >
                          <X className="w-3 h-3" />
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
                  )}
                </div>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${open ? 'transform rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>

              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options
                  className={`
                    absolute z-50 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1
                    shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none
                    max-h-96
                    ${dropdownDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}
                  `}
                >
                  {searchable && (
                    <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 p-2 border-b border-gray-200 dark:border-gray-700">
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {filteredOptions.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No options found</div>
                  ) : (
                    filteredOptions.map((option) => (
                      <Listbox.Option
                        key={option.value}
                        className={({ active }) =>
                          `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                            active ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'
                          } ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`
                        }
                        value={option.value}
                        disabled={option.disabled}
                        onClick={() => handleToggle(option.value)}
                      >
                        {({ selected }) => (
                          <>
                            <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                              {option.label}
                            </span>
                            {value.includes(option.value) && (
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                                <Check className="h-5 w-5" aria-hidden="true" />
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))
                  )}
                </Listbox.Options>
              </Transition>
            </div>
          </div>
        )}
      </Listbox>

      {helperText && !error && (
        <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">{helperText}</p>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default MultiSelect;
