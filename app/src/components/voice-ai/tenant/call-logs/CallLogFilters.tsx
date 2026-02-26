'use client';

// ============================================================================
// CallLogFilters Component
// ============================================================================
// Filter controls for call logs (date range, outcome, status, pagination)
// ============================================================================

import React from 'react';
import { Search, Calendar, Filter } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import Button from '@/components/ui/Button';

export interface CallLogFiltersState {
  from: string;
  to: string;
  outcome: string;
  status: string;
  page: number;
  limit: number;
}

interface CallLogFiltersProps {
  filters: CallLogFiltersState;
  onChange: (filters: CallLogFiltersState) => void;
  onSearch: () => void;
  onReset: () => void;
}

/**
 * CallLogFilters - Filter controls component
 */
export function CallLogFilters({
  filters,
  onChange,
  onSearch,
  onReset,
}: CallLogFiltersProps) {
  const handleDateRangeChange = (from: Date | null, to: Date | null) => {
    onChange({
      ...filters,
      from: from ? from.toISOString().split('T')[0] : '',
      to: to ? to.toISOString().split('T')[0] : '',
      page: 1, // Reset to first page on filter change
    });
  };

  const handleOutcomeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...filters,
      outcome: e.target.value,
      page: 1,
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...filters,
      status: e.target.value,
      page: 1,
    });
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...filters,
      limit: parseInt(e.target.value, 10),
      page: 1,
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Filters
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Range */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Calendar className="h-4 w-4 inline mr-1" />
            Date Range
          </label>
          <DateRangePicker
            startDate={filters.from ? new Date(filters.from) : null}
            endDate={filters.to ? new Date(filters.to) : null}
            onChange={handleDateRangeChange}
          />
        </div>

        {/* Outcome Filter */}
        <div>
          <label
            htmlFor="outcome-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Outcome
          </label>
          <select
            id="outcome-filter"
            value={filters.outcome}
            onChange={handleOutcomeChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Outcomes</option>
            <option value="lead_created">Lead Created</option>
            <option value="transferred">Transferred</option>
            <option value="abandoned">Abandoned</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label
            htmlFor="status-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={handleStatusChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="in_progress">In Progress</option>
            <option value="transferred">Transferred</option>
          </select>
        </div>
      </div>

      {/* Items per page + Action buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <label
            htmlFor="limit-filter"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Items per page:
          </label>
          <select
            id="limit-filter"
            value={filters.limit.toString()}
            onChange={handleLimitChange}
            className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSearch}
          >
            <Search className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
