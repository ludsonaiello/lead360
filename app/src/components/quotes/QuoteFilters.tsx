/**
 * QuoteFilters Component
 * Collapsible filter panel for quotes with status, vendor, date range filters
 */

'use client';

import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { Select, SelectOption } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getVendors } from '@/lib/api/vendors';
import {
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  RotateCcw,
} from 'lucide-react';
import type { QuoteFilters as QuoteFiltersType, QuoteStatus } from '@/lib/types/quotes';

interface QuoteFiltersProps {
  filters: QuoteFiltersType;
  onChange: (filters: QuoteFiltersType) => void;
  onReset: () => void;
  className?: string;
}

const STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'ready', label: 'Ready' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'read', label: 'Read' },
  { value: 'opened', label: 'Email Opened' },
  { value: 'downloaded', label: 'Downloaded' },
  { value: 'email_failed', label: 'Email Failed' },
  { value: 'denied', label: 'Denied' },
  { value: 'lost', label: 'Lost' },
  { value: 'started', label: 'Started' },
  { value: 'concluded', label: 'Concluded' },
];

export function QuoteFilters({
  filters,
  onChange,
  onReset,
  className = '',
}: QuoteFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [vendors, setVendors] = useState<SelectOption[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<QuoteStatus[]>(
    filters.status ? [filters.status] : []
  );

  // Load vendors on mount
  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const response = await getVendors({ limit: 100 });
      const vendorOptions: SelectOption[] = response.data.map((v) => ({
        value: v.id,
        label: v.name + (v.is_default ? ' (Default)' : ''),
      }));
      setVendors(vendorOptions);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  // Count active filters
  const getActiveFilterCount = (): number => {
    let count = 0;
    if (selectedStatuses.length > 0) count++;
    if (filters.vendor_id) count++;
    if (filters.created_from) count++;
    if (filters.created_to) count++;
    if (filters.search) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  const handleStatusToggle = (status: QuoteStatus) => {
    let newStatuses: QuoteStatus[];
    if (selectedStatuses.includes(status)) {
      newStatuses = selectedStatuses.filter((s) => s !== status);
    } else {
      newStatuses = [...selectedStatuses, status];
    }
    setSelectedStatuses(newStatuses);

    // Update filters - if multiple statuses, use first one (or undefined if none)
    onChange({
      ...filters,
      status: newStatuses.length > 0 ? newStatuses[0] : undefined,
    });
  };

  const handleVendorChange = (vendorId: string) => {
    onChange({
      ...filters,
      vendor_id: vendorId || undefined,
    });
  };

  const handleDateFromChange = (date: string) => {
    onChange({
      ...filters,
      created_from: date || undefined,
    });
  };

  const handleDateToChange = (date: string) => {
    onChange({
      ...filters,
      created_to: date || undefined,
    });
  };

  const handleResetFilters = () => {
    setSelectedStatuses([]);
    onReset();
  };

  return (
    <Card className={`${className}`}>
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Filters
          </h3>
          {activeFilterCount > 0 && (
            <Badge variant="blue">{activeFilterCount}</Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Expandable Filter Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Status Filter - Multi-select Checkboxes */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Status
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`
                    flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${
                      selectedStatuses.includes(option.value)
                        ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-500 dark:border-blue-600'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(option.value)}
                    onChange={() => handleStatusToggle(option.value)}
                    className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Vendor Filter */}
          <div>
            <Select
              label="Vendor"
              options={[{ value: '', label: 'All Vendors' }, ...vendors]}
              value={filters.vendor_id || ''}
              onChange={handleVendorChange}
              searchable
            />
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker
              label="Created From"
              value={filters.created_from || ''}
              onChange={(e) => handleDateFromChange(e.target.value)}
            />
            <DatePicker
              label="Created To"
              value={filters.created_to || ''}
              onChange={(e) => handleDateToChange(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              disabled={activeFilterCount === 0}
            >
              <RotateCcw className="w-4 h-4" />
              Reset Filters
            </Button>

            {activeFilterCount > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default QuoteFilters;
