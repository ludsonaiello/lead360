'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, User, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSearchSuggestions } from '@/lib/api/quote-search';
import type { SearchSuggestion } from '@/lib/types/quotes';

interface SearchAutocompleteProps {
  placeholder?: string;
  className?: string;
}

export default function SearchAutocomplete({
  placeholder = 'Search quotes...',
  className = '',
}: SearchAutocompleteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search effect
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const response = await getSearchSuggestions({ query, limit: 10 });
        setSuggestions(response.suggestions);
        setShowDropdown(response.suggestions.length > 0);
      } catch (error) {
        console.error('Search suggestions error:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
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

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelect = (suggestion: SearchSuggestion) => {
    if (suggestion.type === 'quote_number') {
      // Navigate to quote detail (assuming quote number can be used to find ID)
      // For now, navigate to quotes list with search
      router.push(`/quotes?search=${encodeURIComponent(suggestion.value)}`);
    } else if (suggestion.type === 'customer') {
      router.push(`/quotes?customer=${encodeURIComponent(suggestion.value)}`);
    } else {
      router.push(`/quotes?item=${encodeURIComponent(suggestion.value)}`);
    }
    setQuery('');
    setShowDropdown(false);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quote_number':
        return <FileText className="w-4 h-4" />;
      case 'customer':
        return <User className="w-4 h-4" />;
      case 'item':
        return <Package className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'quote_number':
        return 'Quote';
      case 'customer':
        return 'Customer';
      case 'item':
        return 'Item';
      default:
        return '';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
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
          onFocus={() => query.length >= 2 && suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelect(suggestion)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : ''
              } ${
                index === 0
                  ? 'rounded-t-lg'
                  : index === suggestions.length - 1
                  ? 'rounded-b-lg'
                  : ''
              }`}
            >
              <div className="text-gray-500 dark:text-gray-400">
                {getTypeIcon(suggestion.type)}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {suggestion.value}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {getTypeLabel(suggestion.type)} · Used {suggestion.usage_count} times
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showDropdown && query.length >= 2 && suggestions.length === 0 && !isLoading && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            No results found for "{query}"
          </p>
        </div>
      )}
    </div>
  );
}
