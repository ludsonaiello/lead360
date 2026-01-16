/**
 * Industry Multi-Select Component
 * Searchable multi-select dropdown for selecting multiple industries
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Search } from 'lucide-react';
import type { Industry } from '@/lib/types/admin';

interface IndustryMultiSelectProps {
  industries: Industry[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export function IndustryMultiSelect({
  industries,
  selectedIds,
  onChange,
  error,
  disabled = false,
  placeholder = 'Select industries',
  label,
  required = false,
}: IndustryMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get selected industries
  const selectedIndustries = industries.filter((industry) =>
    selectedIds.includes(industry.id)
  );

  // Filter industries based on search
  const filteredIndustries = industries.filter((industry) =>
    industry.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const toggleIndustry = (industryId: string) => {
    if (selectedIds.includes(industryId)) {
      onChange(selectedIds.filter((id) => id !== industryId));
    } else {
      onChange([...selectedIds, industryId]);
    }
  };

  const removeIndustry = (industryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((id) => id !== industryId));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Selected Industries + Dropdown Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full min-h-[42px] px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 flex-1">
            {selectedIndustries.length === 0 ? (
              <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
            ) : (
              selectedIndustries.map((industry) => (
                <span
                  key={industry.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm rounded"
                >
                  {industry.name}
                  <span
                    onClick={(e) => removeIndustry(industry.id, e)}
                    className={`hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onKeyDown={(e) => {
                      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        removeIndustry(industry.id, e as any);
                      }
                    }}
                  >
                    <X className="w-3 h-3" />
                  </span>
                </span>
              ))
            )}
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-72 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search industries..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto max-h-56">
            {filteredIndustries.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                No industries found
              </div>
            ) : (
              filteredIndustries.map((industry) => {
                const isSelected = selectedIds.includes(industry.id);
                return (
                  <button
                    key={industry.id}
                    type="button"
                    onClick={() => toggleIndustry(industry.id)}
                    className={`w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Industry Name & Description */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {industry.name}
                      </div>
                      {industry.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {industry.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}

      {/* Helper Text */}
      {!error && selectedIndustries.length > 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
          {selectedIndustries.length} {selectedIndustries.length === 1 ? 'industry' : 'industries'} selected
        </p>
      )}
    </div>
  );
}

export default IndustryMultiSelect;
