/**
 * Job Filters Component
 * Filter controls for job list
 */

'use client';

import React from 'react';
import { JobFilters as JobFiltersType, JobStatus } from '@/lib/types/jobs';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { X } from 'lucide-react';

interface JobFiltersProps {
  filters: JobFiltersType;
  onFilterChange: (filters: Partial<JobFiltersType>) => void;
  onReset: () => void;
  className?: string;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const jobTypeOptions = [
  { value: '', label: 'All Job Types' },
  { value: 'send-email', label: 'Send Email' },
  { value: 'expiry-check', label: 'Expiry Check' },
  { value: 'data-cleanup', label: 'Data Cleanup' },
  { value: 'partition-maintenance', label: 'Partition Maintenance' },
  { value: 'file-retention', label: 'File Retention' },
  { value: 'job-retention', label: 'Job Retention' },
];

export function JobFilters({ filters, onFilterChange, onReset, className = '' }: JobFiltersProps) {
  const hasActiveFilters = !!(
    filters.status ||
    filters.job_type ||
    filters.date_from ||
    filters.date_to
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Status Filter */}
        <Select
          value={filters.status || ''}
          onChange={(value) => onFilterChange({ status: (value || undefined) as JobStatus | undefined })}
          options={statusOptions}
          label="Status"
        />

        {/* Job Type Filter */}
        <Select
          value={filters.job_type || ''}
          onChange={(value) => onFilterChange({ job_type: value || undefined })}
          options={jobTypeOptions}
          label="Job Type"
        />

        {/* Date Range Filter */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Date Range
          </label>
          <DateRangePicker
            startDate={filters.date_from ? new Date(filters.date_from) : null}
            endDate={filters.date_to ? new Date(filters.date_to) : null}
            onChange={(start, end) => {
              onFilterChange({
                date_from: start ? start.toISOString().split('T')[0] : undefined,
                date_to: end ? end.toISOString().split('T')[0] : undefined,
              });
            }}
          />
        </div>
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Active filters applied
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
          >
            <X className="w-4 h-4 mr-1" />
            Reset Filters
          </Button>
        </div>
      )}
    </div>
  );
}

export default JobFilters;
