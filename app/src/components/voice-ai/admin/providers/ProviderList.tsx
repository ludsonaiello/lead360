'use client';

// ============================================================================
// ProviderList Component
// ============================================================================
// Display list of AI providers with search, filtering, and actions
// ============================================================================

import React, { useState } from 'react';
import { Search, Plus, Bot } from 'lucide-react';
import type { VoiceAIProvider, ProviderFilters, ProviderType } from '@/lib/types/voice-ai';
import ProviderCard from './ProviderCard';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface ProviderListProps {
  providers: VoiceAIProvider[];
  loading?: boolean;
  onEdit?: (providerId: string) => void;
  onDelete?: (providerId: string) => void;
  onCreate?: () => void;
  onFilterChange?: (filters: ProviderFilters) => void;
  currentFilters?: ProviderFilters;
}

/**
 * ProviderList - Display list of providers with search and filters
 */
export default function ProviderList({
  providers,
  loading = false,
  onEdit,
  onDelete,
  onCreate,
  onFilterChange,
  currentFilters = {},
}: ProviderListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [providerTypeFilter, setProviderTypeFilter] = useState<ProviderType | ''>('');

  /**
   * Filter providers by search query, active status, and provider type
   */
  const filteredProviders = providers.filter((provider) => {
    // Filter by active status
    if (!showInactive && !provider.is_active) {
      return false;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        provider.provider_key.toLowerCase().includes(query) ||
        provider.display_name.toLowerCase().includes(query) ||
        provider.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  /**
   * Sort providers by created_at DESC (most recent first)
   * As per sprint requirement line 283
   */
  const sortedProviders = [...filteredProviders].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  /**
   * Handle provider type filter change
   */
  const handleProviderTypeChange = (value: string) => {
    const type = value as ProviderType | '';
    setProviderTypeFilter(type);
    if (onFilterChange) {
      onFilterChange({
        ...currentFilters,
        provider_type: type || undefined,
      });
    }
  };

  /**
   * Handle show inactive toggle
   */
  const handleShowInactiveChange = (checked: boolean) => {
    setShowInactive(checked);
    if (onFilterChange && !checked) {
      onFilterChange({
        ...currentFilters,
        is_active: true,
      });
    } else if (onFilterChange) {
      const newFilters = { ...currentFilters };
      delete newFilters.is_active;
      onFilterChange(newFilters);
    }
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with search and filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 w-full max-w-md">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filters and actions */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Provider type filter */}
          <div className="w-full sm:w-40">
            <Select
              options={[
                { value: '', label: 'All Types' },
                { value: 'STT', label: 'STT' },
                { value: 'LLM', label: 'LLM' },
                { value: 'TTS', label: 'TTS' },
              ]}
              value={providerTypeFilter}
              onChange={handleProviderTypeChange}
              placeholder="Filter by type"
            />
          </div>

          {/* Show inactive toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => handleShowInactiveChange(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show inactive
          </label>

          {/* Create button */}
          {onCreate && (
            <Button
              onClick={onCreate}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Provider
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing <strong className="text-gray-900 dark:text-gray-100">{sortedProviders.length}</strong> of{' '}
        <strong className="text-gray-900 dark:text-gray-100">{providers.length}</strong> providers
      </div>

      {/* Provider list */}
      {sortedProviders.length === 0 ? (
        <div className="text-center py-12">
          <Bot className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {searchQuery || providerTypeFilter ? 'No providers match your filters' : 'No providers found'}
          </p>
          {(searchQuery || providerTypeFilter) && (
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your search or filters
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1">
          {sortedProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
