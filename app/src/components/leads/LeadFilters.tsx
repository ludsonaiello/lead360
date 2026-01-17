/**
 * LeadFilters Component
 * Filter leads by status, source, and date range
 */

'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { LeadFilters as Filters } from '@/lib/types/leads';
import { Button } from '@/components/ui/Button';

interface LeadFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onReset: () => void;
  className?: string;
}

const statusOptions = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
  { value: 'lost', label: 'Lost' },
];

const sourceOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'email', label: 'Email' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'ai_phone', label: 'AI Phone' },
  { value: 'ai_sms', label: 'AI SMS' },
  { value: 'other', label: 'Other' },
];

export function LeadFilters({ filters, onChange, onReset, className = '' }: LeadFiltersProps) {
  const handleStatusChange = (status: string) => {
    const current = filters.status || [];
    const updated = current.includes(status as any)
      ? current.filter((s) => s !== status)
      : [...current, status as any];
    onChange({ ...filters, status: updated.length > 0 ? updated : undefined });
  };

  const handleSourceChange = (source: string) => {
    const current = filters.source || [];
    const updated = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source];
    onChange({ ...filters, source: updated.length > 0 ? updated : undefined });
  };

  const activeFilterCount =
    (filters.status?.length || 0) +
    (filters.source?.length || 0) +
    (filters.created_after ? 1 : 0) +
    (filters.created_before ? 1 : 0);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 dark:bg-blue-500 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </h3>
        {activeFilterCount > 0 && (
          <Button size="sm" variant="ghost" onClick={onReset}>
            <X className="w-4 h-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Status Filters */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Status</label>
        <div className="space-y-2">
          {statusOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.status?.includes(option.value as any) || false}
                onChange={() => handleStatusChange(option.value)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Source Filters */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Source</label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {sourceOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.source?.includes(option.value) || false}
                onChange={() => handleSourceChange(option.value)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Created Date</label>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={filters.created_after || ''}
              onChange={(e) => onChange({ ...filters, created_after: e.target.value || undefined })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={filters.created_before || ''}
              onChange={(e) => onChange({ ...filters, created_before: e.target.value || undefined })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeadFilters;
