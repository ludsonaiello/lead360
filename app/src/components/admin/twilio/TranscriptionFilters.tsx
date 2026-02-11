/**
 * Transcription Filters Component
 * Sprint 4: Transcription Monitoring
 * Filter controls for transcription dashboard
 */

'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

interface TranscriptionFiltersProps {
  providers: string[];
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function TranscriptionFilters({
  providers,
  selectedProvider,
  onProviderChange,
  searchQuery,
  onSearchChange,
}: TranscriptionFiltersProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Provider Filter */}
        <div>
          <label
            htmlFor="provider-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Provider
          </label>
          <select
            id="provider-filter"
            value={selectedProvider}
            onChange={(e) => onProviderChange(e.target.value)}
            className="
              w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600
              rounded-lg text-gray-900 dark:text-gray-100 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              transition-colors
            "
          >
            <option value="">All Providers</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label
            htmlFor="search-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              id="search-filter"
              type="text"
              placeholder="Search by Call SID or Transcription ID..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="
                w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600
                rounded-lg text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                transition-colors
              "
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {(selectedProvider || searchQuery) && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
            {selectedProvider && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-800">
                Provider: {selectedProvider}
                <button
                  onClick={() => onProviderChange('')}
                  className="hover:text-blue-900 dark:hover:text-blue-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-800">
                Search: {searchQuery}
                <button
                  onClick={() => onSearchChange('')}
                  className="hover:text-blue-900 dark:hover:text-blue-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                onProviderChange('');
                onSearchChange('');
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TranscriptionFilters;
