'use client';

// ============================================================================
// TenantsList Component
// ============================================================================
// Display paginated table of tenants with Voice AI usage and overrides
// ============================================================================

import React, { useState } from 'react';
import { Search, Settings, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { TenantVoiceAISummary, TenantFilters } from '@/lib/types/voice-ai';
import TenantUsageBar from './TenantUsageBar';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface TenantsListProps {
  tenants: TenantVoiceAISummary[];
  loading?: boolean;
  onOverride: (tenant: TenantVoiceAISummary) => void;
  onFilterChange?: (filters: TenantFilters) => void;
  currentFilters: TenantFilters;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * TenantsList - Display paginated table of tenants with search
 */
export default function TenantsList({
  tenants,
  loading = false,
  onOverride,
  onFilterChange,
  currentFilters,
  totalPages,
  total,
  onPageChange,
}: TenantsListProps) {
  const [searchQuery, setSearchQuery] = useState(currentFilters.search || '');

  /**
   * Handle search
   */
  const handleSearch = () => {
    if (onFilterChange) {
      onFilterChange({
        ...currentFilters,
        search: searchQuery.trim() || undefined,
        page: 1, // Reset to first page on search
      });
    }
  };

  /**
   * Handle search input key press
   */
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  /**
   * Clear search
   */
  const handleClearSearch = () => {
    setSearchQuery('');
    if (onFilterChange) {
      onFilterChange({
        ...currentFilters,
        search: undefined,
        page: 1,
      });
    }
  };

  /**
   * Calculate usage percentage
   */
  const getUsagePercentage = (used: number, included: number): number => {
    if (included === 0) return 0;
    return Math.min(Math.round((used / included) * 100), 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 max-w-md">
          <Input
            leftIcon={<Search className="h-5 w-5" />}
            placeholder="Search by company name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleSearchKeyPress}
          />
        </div>
        <Button onClick={handleSearch}>Search</Button>
        {currentFilters.search && (
          <Button variant="outline" onClick={handleClearSearch}>
            Clear
          </Button>
        )}
      </div>

      {/* Pagination Info */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Page {currentFilters.page || 1} of {totalPages} (showing{' '}
        {tenants.length} of {total} tenants)
      </div>

      {/* Table */}
      {tenants.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No tenants found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {currentFilters.search
              ? 'Try a different search term'
              : 'No tenants available'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  In Plan
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Enabled
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Minutes (Used/Limit)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {tenants.map((tenant) => {
                const usagePercent = getUsagePercentage(
                  tenant.minutes_used,
                  tenant.minutes_included
                );

                return (
                  <tr
                    key={tenant.tenant_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {/* Company */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {tenant.company_name}
                        </span>
                        {tenant.has_admin_override && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                            title="Has admin override"
                          >
                            Override
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {tenant.plan_name}
                    </td>

                    {/* In Plan */}
                    <td className="px-4 py-4 text-center">
                      {tenant.voice_ai_included_in_plan ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                      )}
                    </td>

                    {/* Enabled */}
                    <td className="px-4 py-4 text-center">
                      {tenant.is_enabled ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400 mx-auto" />
                      )}
                    </td>

                    {/* Minutes */}
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {tenant.minutes_used} / {tenant.minutes_included}
                    </td>

                    {/* Usage Bar */}
                    <td className="px-4 py-4">
                      <TenantUsageBar
                        used={tenant.minutes_used}
                        limit={tenant.minutes_included}
                        percentage={usagePercent}
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOverride(tenant)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Override
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => onPageChange((currentFilters.page || 1) - 1)}
            disabled={currentFilters.page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentFilters.page || 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => onPageChange((currentFilters.page || 1) + 1)}
            disabled={currentFilters.page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
