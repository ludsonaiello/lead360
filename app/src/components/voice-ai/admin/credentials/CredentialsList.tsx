'use client';

// ============================================================================
// CredentialsList Component
// ============================================================================
// Display list of providers with credential status, search, and filters
// ============================================================================

import React, { useState } from 'react';
import { Search, Shield, CheckCircle, XCircle, Eye, Trash2, Plus, RefreshCw, Filter } from 'lucide-react';
import type { ProviderWithCredential, ProviderType } from '@/lib/types/voice-ai';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface CredentialsListProps {
  providers: ProviderWithCredential[];
  loading?: boolean;
  onAddCredential?: (provider: ProviderWithCredential) => void;
  onUpdateCredential?: (provider: ProviderWithCredential) => void;
  onDeleteCredential?: (provider: ProviderWithCredential) => void;
  onTestConnection?: (provider: ProviderWithCredential) => void;
  testing?: boolean;
}

/**
 * CredentialsList - Display providers with credential management and filters
 */
export default function CredentialsList({
  providers,
  loading = false,
  onAddCredential,
  onUpdateCredential,
  onDeleteCredential,
  onTestConnection,
  testing = false,
}: CredentialsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [providerTypeFilter, setProviderTypeFilter] = useState<ProviderType | 'ALL'>('ALL');
  const [credentialStatusFilter, setCredentialStatusFilter] = useState<'ALL' | 'HAS_CREDENTIAL' | 'NO_CREDENTIAL'>('ALL');

  /**
   * Filter providers by search query, type, and credential status
   */
  const filteredProviders = providers.filter((provider) => {
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        provider.provider_key.toLowerCase().includes(query) ||
        provider.display_name.toLowerCase().includes(query) ||
        provider.provider_type.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    // Filter by provider type
    if (providerTypeFilter !== 'ALL' && provider.provider_type !== providerTypeFilter) {
      return false;
    }

    // Filter by credential status
    if (credentialStatusFilter === 'HAS_CREDENTIAL' && !provider.has_credential) {
      return false;
    }
    if (credentialStatusFilter === 'NO_CREDENTIAL' && provider.has_credential) {
      return false;
    }

    return true;
  });

  /**
   * Sort providers: those with credentials first, then alphabetically
   */
  const sortedProviders = [...filteredProviders].sort((a, b) => {
    // First, sort by credential status (has credential first)
    if (a.has_credential && !b.has_credential) return -1;
    if (!a.has_credential && b.has_credential) return 1;

    // Then alphabetically by display_name
    return a.display_name.localeCompare(b.display_name);
  });

  /**
   * Get badge variant for provider type
   */
  const getProviderTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
      STT: 'info',
      LLM: 'success',
      TTS: 'warning',
    };
    return variants[type] || 'default';
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setSearchQuery('');
    setProviderTypeFilter('ALL');
    setCredentialStatusFilter('ALL');
  };

  const hasActiveFilters = searchQuery || providerTypeFilter !== 'ALL' || credentialStatusFilter !== 'ALL';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filters
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Provider Type Filter */}
          <Select
            value={providerTypeFilter}
            onChange={(value) => setProviderTypeFilter(value as ProviderType | 'ALL')}
            options={[
              { value: 'ALL', label: 'All Types' },
              { value: 'STT', label: 'STT (Speech-to-Text)' },
              { value: 'LLM', label: 'LLM (Language Model)' },
              { value: 'TTS', label: 'TTS (Text-to-Speech)' },
            ]}
            placeholder="Select provider type"
          />

          {/* Credential Status Filter */}
          <Select
            value={credentialStatusFilter}
            onChange={(value) => setCredentialStatusFilter(value as any)}
            options={[
              { value: 'ALL', label: 'All Status' },
              { value: 'HAS_CREDENTIAL', label: 'Has Credential' },
              { value: 'NO_CREDENTIAL', label: 'No Credential' },
            ]}
            placeholder="Select credential status"
          />
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Active filters:</span>
          {searchQuery && (
            <Badge variant="default">
              Search: "{searchQuery}"
            </Badge>
          )}
          {providerTypeFilter !== 'ALL' && (
            <Badge variant={getProviderTypeBadge(providerTypeFilter)}>
              {providerTypeFilter}
            </Badge>
          )}
          {credentialStatusFilter !== 'ALL' && (
            <Badge variant={credentialStatusFilter === 'HAS_CREDENTIAL' ? 'success' : 'warning'}>
              {credentialStatusFilter === 'HAS_CREDENTIAL' ? 'Has Credential' : 'No Credential'}
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Masked Key
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedProviders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                      {hasActiveFilters
                        ? 'No providers found matching your filters'
                        : 'No providers available'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-2"
                      >
                        Clear filters to see all providers
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                sortedProviders.map((provider) => (
                  <tr
                    key={provider.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {/* Provider Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {provider.logo_url && (
                          <img
                            src={provider.logo_url}
                            alt={provider.display_name}
                            className="h-8 w-8 rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {provider.display_name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {provider.provider_key}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="px-6 py-4">
                      <Badge variant={getProviderTypeBadge(provider.provider_type)}>
                        {provider.provider_type}
                      </Badge>
                    </td>

                    {/* Credential Status */}
                    <td className="px-6 py-4">
                      {provider.has_credential ? (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-5 w-5" />
                          <span className="text-sm font-medium">Set</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                          <XCircle className="h-5 w-5" />
                          <span className="text-sm font-medium">Not Set</span>
                        </div>
                      )}
                    </td>

                    {/* Masked Key */}
                    <td className="px-6 py-4">
                      {provider.credential_masked_key ? (
                        <code className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                          {provider.credential_masked_key}
                        </code>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {provider.has_credential ? (
                          <>
                            {/* Test Connection */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onTestConnection?.(provider)}
                              disabled={testing}
                              title="Test Connection"
                            >
                              <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
                            </Button>

                            {/* Update Credential */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onUpdateCredential?.(provider)}
                              title="Update Credential"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* Delete Credential */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteCredential?.(provider)}
                              title="Delete Credential"
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {/* Add Credential */}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => onAddCredential?.(provider)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Credential
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {sortedProviders.length} of {providers.length} providers
        {providers.filter((p) => p.has_credential).length > 0 && (
          <span>
            {' '}
            ({providers.filter((p) => p.has_credential).length} with credentials)
          </span>
        )}
      </div>
    </div>
  );
}
