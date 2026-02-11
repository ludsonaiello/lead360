/**
 * CallFilters Component
 * Advanced filtering for call monitoring
 */

'use client';

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import Button from '@/components/ui/Button';
import { getAllTenants } from '@/lib/api/admin';
import type { CallFilters as CallFiltersType } from '@/lib/types/twilio-admin';

interface CallFiltersProps {
  filters: CallFiltersType;
  onChange: (filters: CallFiltersType) => void;
  onReset: () => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'initiated', label: 'Initiated' },
  { value: 'ringing', label: 'Ringing' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'canceled', label: 'Canceled' },
];

const DIRECTION_OPTIONS = [
  { value: '', label: 'All Directions' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];

export function CallFilters({ filters, onChange, onReset }: CallFiltersProps) {
  const [tenants, setTenants] = useState<Array<{ id: string; company_name: string }>>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  // Load tenants for filter dropdown
  useEffect(() => {
    async function loadTenants() {
      try {
        setLoadingTenants(true);
        const response = await getAllTenants({ limit: 1000 });
        setTenants(response.data || []);
      } catch (error) {
        console.error('Failed to load tenants:', error);
      } finally {
        setLoadingTenants(false);
      }
    }
    loadTenants();
  }, []);

  const handleDateRangeChange = (start: Date | null, end: Date | null) => {
    onChange({
      ...filters,
      start_date: start ? start.toISOString() : undefined,
      end_date: end ? end.toISOString() : undefined,
    });
  };

  const hasActiveFilters = Boolean(
    filters.tenant_id ||
      filters.status ||
      filters.direction ||
      filters.start_date ||
      filters.end_date ||
      searchInput
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-4 border border-gray-200 dark:border-gray-700">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by phone number..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Trigger search on Enter
              onChange({ ...filters, page: 1 });
            }
          }}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput('');
              onChange({ ...filters, page: 1 });
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tenant Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tenant
          </label>
          <select
            value={filters.tenant_id || ''}
            onChange={(e) => onChange({ ...filters, tenant_id: e.target.value || undefined, page: 1 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loadingTenants}
          >
            <option value="">All Tenants</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.company_name}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => onChange({ ...filters, status: e.target.value || undefined, page: 1 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Direction */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Direction
          </label>
          <select
            value={filters.direction || ''}
            onChange={(e) =>
              onChange({
                ...filters,
                direction: e.target.value ? (e.target.value as 'inbound' | 'outbound') : undefined,
                page: 1,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Results per page */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Per Page
          </label>
          <select
            value={filters.limit || 20}
            onChange={(e) =>
              onChange({ ...filters, limit: parseInt(e.target.value), page: 1 })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* Date Range Picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Date Range
        </label>
        <DateRangePicker
          startDate={filters.start_date ? new Date(filters.start_date) : null}
          endDate={filters.end_date ? new Date(filters.end_date) : null}
          onChange={handleDateRangeChange}
        />
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onReset}>
            <X className="h-4 w-4 mr-2" />
            Reset Filters
          </Button>
        </div>
      )}
    </div>
  );
}
