/**
 * Select Component
 * Dropdown select with search/filter using Headless UI Listbox
 */

'use client';

import React, { Fragment, forwardRef, useState } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  className?: string;
  name?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      value,
      onChange,
      placeholder = 'Select an option',
      disabled = false,
      required = false,
      searchable = false,
      className = '',
      name,
    },
    ref
  ) => {
    const [searchQuery, setSearchQuery] = useState('');

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = searchable && searchQuery
      ? options.filter((option) =>
          option.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : options;

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
            {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
          </label>
        )}

        <Listbox value={value} onChange={onChange} disabled={disabled}>
          {({ open }) => (
            <div className="relative">
              <Listbox.Button
                ref={ref}
                className={`
                  relative w-full px-4 py-3 border-2 rounded-lg text-left
                  text-gray-900 dark:text-gray-100 font-medium
                  bg-white dark:bg-gray-700
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
                  transition-all duration-200
                  ${error
                    ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'}
                `}
              >
                <span className={`block truncate ${!selectedOption ? 'text-gray-400 dark:text-gray-500' : ''}`}>
                  {selectedOption?.label || placeholder}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
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
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {searchable && (
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {filteredOptions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      No options found
                    </div>
                  ) : (
                    filteredOptions.map((option) => (
                      <Listbox.Option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                        className={({ active }) =>
                          `relative cursor-pointer select-none py-3 pl-10 pr-4 ${
                            active
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                              : 'text-gray-900 dark:text-gray-100'
                          } ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`
                        }
                      >
                        {({ selected }) => (
                          <>
                            <span className={`block truncate ${selected ? 'font-semibold' : 'font-medium'}`}>
                              {option.label}
                            </span>
                            {selected && (
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
          )}
        </Listbox>

        {/* Hidden input for react-hook-form */}
        {name && <input type="hidden" name={name} value={value || ''} />}

        {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
