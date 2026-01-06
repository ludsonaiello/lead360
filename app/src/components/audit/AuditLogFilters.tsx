// Audit Log Filters Component
// Comprehensive filter UI for audit logs

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { AuditLogFilters } from '@/lib/types/audit';
import { ActionType, Status, ActorType } from '@/lib/types/audit';
import { formatISO } from 'date-fns';

interface AuditLogFiltersProps {
  filters: AuditLogFilters;
  onChange: (filters: Partial<AuditLogFilters>) => void;
  onReset: () => void;
  hideActorFilter?: boolean;
  className?: string;
}

// Action type options for dropdown
const ACTION_TYPE_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: ActionType.CREATED, label: 'Created' },
  { value: ActionType.UPDATED, label: 'Updated' },
  { value: ActionType.DELETED, label: 'Deleted' },
  { value: ActionType.ACCESSED, label: 'Accessed' },
  { value: ActionType.FAILED, label: 'Failed' }
];

// Status options
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: Status.SUCCESS, label: 'Success' },
  { value: Status.FAILURE, label: 'Failure' }
];

// Entity type options (common entities)
const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All Entity Types' },
  { value: 'user', label: 'User' },
  { value: 'tenant', label: 'Business Profile' },
  { value: 'tenant_address', label: 'Business Address' },
  { value: 'tenant_license', label: 'Professional License' },
  { value: 'role', label: 'Role' },
  { value: 'permission', label: 'Permission' },
  { value: 'user_role', label: 'User Role Assignment' },
  { value: 'auth_session', label: 'Login Session' },
  { value: 'file', label: 'File' }
];

// Debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Comprehensive filter UI for audit logs
 *
 * Features:
 * - Date range picker with presets
 * - Action type multi-select dropdown
 * - Entity type dropdown
 * - Status dropdown
 * - Debounced search input (500ms)
 * - Reset button
 * - Active filter count badge
 * - Responsive design
 *
 * @example
 * ```tsx
 * <AuditLogFilters
 *   filters={filters}
 *   onChange={setFilters}
 *   onReset={resetFilters}
 * />
 * ```
 */
export function AuditLogFilters({
  filters,
  onChange,
  onReset,
  hideActorFilter = false,
  className = ''
}: AuditLogFiltersProps) {
  const [searchText, setSearchText] = useState(filters.search || '');
  const debouncedSearch = useDebounce(searchText, 500);

  // Update filters when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onChange]);

  // Handle date range change
  const handleDateRangeChange = useCallback((start: Date | null, end: Date | null) => {
    onChange({
      start_date: start ? formatISO(start) : undefined,
      end_date: end ? formatISO(end) : undefined
    });
  }, [onChange]);

  // Count active filters
  const activeFilterCount = [
    filters.start_date,
    filters.end_date,
    filters.action_type,
    filters.entity_type,
    filters.status,
    filters.search,
    filters.actor_user_id
  ].filter(Boolean).length;

  const startDate = filters.start_date ? new Date(filters.start_date) : null;
  const endDate = filters.end_date ? new Date(filters.end_date) : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Date Range Picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Date Range
        </label>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateRangeChange}
        />
      </div>

      {/* Filter Dropdowns Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Action Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Action Type
          </label>
          <Select
            value={filters.action_type || ''}
            onChange={(value) => onChange({ action_type: value as ActionType || undefined })}
            options={ACTION_TYPE_OPTIONS}
            placeholder="All Actions"
          />
        </div>

        {/* Entity Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Entity Type
          </label>
          <Select
            value={filters.entity_type || ''}
            onChange={(value) => onChange({ entity_type: value || undefined })}
            options={ENTITY_TYPE_OPTIONS}
            placeholder="All Entity Types"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <Select
            value={filters.status || ''}
            onChange={(value) => onChange({ status: value as Status || undefined })}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
          />
        </div>

        {/* Reset Button */}
        <div className="flex items-end">
          <Button
            variant="secondary"
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Search Description
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search in description..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Search is debounced (updates after you stop typing)
        </p>
      </div>

      {/* Active Filters Badge */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full font-medium">
            {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
          </span>
        </div>
      )}
    </div>
  );
}
