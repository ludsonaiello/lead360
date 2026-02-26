import React from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { CallLogFilters as FilterType } from '@/lib/types/voice-ai';
import { Search } from 'lucide-react';

interface CallLogFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  onApply: () => void;
  onReset: () => void;
  tenants: Array<{ id: string; name: string }>;
  loading: boolean;
}

/**
 * Call Log Filters Component
 * Filter controls for call logs (tenant, date range, outcome, status, pagination)
 */
export default function CallLogFiltersComponent({
  filters,
  onFiltersChange,
  onApply,
  onReset,
  tenants,
  loading,
}: CallLogFiltersProps) {
  const handleFilterChange = (key: keyof FilterType, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value === '' ? undefined : value,
    });
  };

  // Prepare tenant options
  const tenantOptions = [
    { value: '', label: 'All Tenants' },
    ...tenants.map((tenant) => ({
      value: tenant.id,
      label: tenant.name,
    })),
  ];

  // Outcome options
  const outcomeOptions = [
    { value: '', label: 'All Outcomes' },
    { value: 'lead_created', label: 'Lead Created' },
    { value: 'transferred', label: 'Transferred' },
    { value: 'abandoned', label: 'Abandoned' },
    { value: 'completed', label: 'Completed' },
  ];

  // Status options
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'transferred', label: 'Transferred' },
  ];

  // Limit options
  const limitOptions = [
    { value: '20', label: '20' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tenant Filter */}
        <div>
          <Select
            label="Tenant"
            options={tenantOptions}
            value={filters.tenantId || ''}
            onChange={(value) => handleFilterChange('tenantId', value)}
            searchable
          />
        </div>

        {/* From Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            From Date
          </label>
          <Input
            type="date"
            value={filters.from || ''}
            onChange={(e) => handleFilterChange('from', e.target.value)}
          />
        </div>

        {/* To Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            To Date
          </label>
          <Input
            type="date"
            value={filters.to || ''}
            onChange={(e) => handleFilterChange('to', e.target.value)}
          />
        </div>

        {/* Outcome Filter */}
        <div>
          <Select
            label="Outcome"
            options={outcomeOptions}
            value={filters.outcome || ''}
            onChange={(value) => handleFilterChange('outcome', value)}
          />
        </div>

        {/* Status Filter */}
        <div>
          <Select
            label="Status"
            options={statusOptions}
            value={filters.status || ''}
            onChange={(value) => handleFilterChange('status', value)}
          />
        </div>

        {/* Items Per Page */}
        <div>
          <Select
            label="Items Per Page"
            options={limitOptions}
            value={filters.limit?.toString() || '20'}
            onChange={(value) => handleFilterChange('limit', parseInt(value))}
          />
        </div>
      </div>

      {/* Filter Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button onClick={onApply} disabled={loading}>
          <Search className="h-4 w-4 mr-2" />
          Apply Filters
        </Button>
        <Button variant="outline" onClick={onReset} disabled={loading}>
          Reset
        </Button>
      </div>
    </div>
  );
}
