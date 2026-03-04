'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, User, Mail, Phone } from 'lucide-react';
import { getLeads } from '@/lib/api/leads';
import { formatPhone } from '@/lib/api/leads';
import type { Lead, LeadListItem } from '@/lib/types/leads';

interface LeadAutocompleteProps {
  value?: Lead | null;
  onChange: (lead: Lead | null) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  disabled?: boolean;
}

export default function LeadAutocomplete({
  value,
  onChange,
  placeholder = 'Search for a lead by name, phone, or email...',
  className = '',
  error,
  disabled = false,
}: LeadAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search effect (300ms as per requirements)
  useEffect(() => {
    console.log('[LeadAutocomplete] Query changed:', query, 'Length:', query.length);

    if (query.length < 2) {
      console.log('[LeadAutocomplete] Query too short, clearing results');
      setLeads([]);
      setShowDropdown(false);
      setErrorMessage(null);
      return;
    }

    console.log('[LeadAutocomplete] Setting up debounced search for:', query);
    const timer = setTimeout(async () => {
      try {
        console.log('[LeadAutocomplete] Starting API call for query:', query);
        setIsLoading(true);
        setErrorMessage(null);

        const response = await getLeads({ search: query, limit: 10 });
        console.log('[LeadAutocomplete] API Response:', response);
        console.log('[LeadAutocomplete] Response.data:', response.data);
        console.log('[LeadAutocomplete] Number of leads:', response.data.length);

        setLeads(response.data);
        setShowDropdown(response.data.length > 0);

        console.log('[LeadAutocomplete] State updated - leads:', response.data.length, 'showDropdown:', response.data.length > 0);
      } catch (err) {
        console.error('[LeadAutocomplete] Lead search error:', err);
        console.error('[LeadAutocomplete] Error details:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          response: (err as any)?.response,
          status: (err as any)?.response?.status,
          data: (err as any)?.response?.data,
        });
        setErrorMessage('Failed to search leads. Please try again.');
        setLeads([]);
        setShowDropdown(false);
      } finally {
        setIsLoading(false);
        console.log('[LeadAutocomplete] Search completed');
      }
    }, 300); // 300ms debounce as per requirements

    return () => {
      console.log('[LeadAutocomplete] Clearing timer for query:', query);
      clearTimeout(timer);
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || leads.length === 0) {
      if (e.key === 'Escape' && value) {
        // Allow clearing selection with Escape
        handleClear();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < leads.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < leads.length) {
          handleSelect(leads[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelect = (lead: LeadListItem) => {
    console.log('[LeadAutocomplete] Lead selected:', lead);
    // Cast LeadListItem to Lead for compatibility with onChange callback
    // This is safe because CreateAppointmentModal only uses lead.id
    onChange(lead as unknown as Lead);
    setQuery('');
    setLeads([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setLeads([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    setErrorMessage(null);
    inputRef.current?.focus();
  };

  const getPrimaryEmail = (lead: Lead | LeadListItem): string | null => {
    const primary = lead.emails?.find(e => e.is_primary);
    return primary?.email || lead.emails?.[0]?.email || null;
  };

  const getPrimaryPhone = (lead: Lead | LeadListItem): string | null => {
    const primary = lead.phones?.find(p => p.is_primary);
    return primary?.phone || lead.phones?.[0]?.phone || null;
  };

  const getDisplayName = (lead: Lead | LeadListItem): string => {
    return `${lead.first_name} ${lead.last_name}`.trim();
  };

  // Debug logging for render
  console.log('[LeadAutocomplete] Render - State:', {
    query,
    leadsCount: leads.length,
    showDropdown,
    isLoading,
    hasValue: !!value,
    errorMessage,
  });

  return (
    <div className={`relative ${className}`}>
      {/* Selected Lead Display */}
      {value && (
        <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {getDisplayName(value)}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {getPrimaryEmail(value) && (
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Mail className="w-3 h-3" />
                      {getPrimaryEmail(value)}
                    </div>
                  )}
                  {getPrimaryPhone(value) && (
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Phone className="w-3 h-3" />
                      {formatPhone(getPrimaryPhone(value)!)}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search Input */}
      {!value && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            ) : (
              <Search className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && leads.length > 0 && setShowDropdown(true)}
            placeholder={placeholder}
            disabled={disabled}
            className={`block w-full pl-10 pr-10 py-2 border ${
              error || errorMessage
                ? 'border-red-300 dark:border-red-600'
                : 'border-gray-300 dark:border-gray-600'
            } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label="Search for lead"
            aria-invalid={!!error || !!errorMessage}
            aria-describedby={error || errorMessage ? 'lead-autocomplete-error' : undefined}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {(error || errorMessage) && (
        <p
          id="lead-autocomplete-error"
          className="mt-1 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error || errorMessage}
        </p>
      )}

      {/* Suggestions Dropdown */}
      {(() => {
        console.log('[LeadAutocomplete] Dropdown condition:', { showDropdown, hasValue: !!value, shouldShow: showDropdown && !value });
        return null;
      })()}
      {showDropdown && !value && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto"
          role="listbox"
        >
          {(() => {
            console.log('[LeadAutocomplete] Rendering dropdown with leads:', leads);
            return null;
          })()}
          {leads.map((lead, index) => {
            const primaryEmail = getPrimaryEmail(lead);
            const primaryPhone = getPrimaryPhone(lead);
            const displayName = getDisplayName(lead);

            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => handleSelect(lead)}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : ''
                } ${
                  index === 0
                    ? 'rounded-t-lg'
                    : index === leads.length - 1
                    ? 'rounded-b-lg'
                    : ''
                }`}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <div className="mt-0.5 text-gray-500 dark:text-gray-400">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {displayName}
                  </p>
                  <div className="flex flex-col gap-1 mt-1">
                    {primaryEmail && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{primaryEmail}</span>
                      </div>
                    )}
                    {primaryPhone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span>{formatPhone(primaryPhone)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Status: <span className="capitalize">{lead.status}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* No Results */}
      {(() => {
        const shouldShowNoResults = showDropdown && !value && query.length >= 2 && leads.length === 0 && !isLoading && !errorMessage;
        console.log('[LeadAutocomplete] No Results condition:', {
          showDropdown,
          hasValue: !!value,
          queryLength: query.length,
          leadsLength: leads.length,
          isLoading,
          errorMessage,
          shouldShowNoResults,
        });
        return null;
      })()}
      {showDropdown && !value && query.length >= 2 && leads.length === 0 && !isLoading && !errorMessage && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            No leads found for &quot;{query}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
