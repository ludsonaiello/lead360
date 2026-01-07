/**
 * FileFilters Component
 * Advanced filtering controls for file gallery
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Filter, Calendar } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { FileFilters as FileFiltersType, FileCategory, EntityType } from '@/lib/types/files';
import { FILE_CATEGORY_CONFIG } from '@/lib/types/files';

interface FileFiltersProps {
  filters: FileFiltersType;
  onFiltersChange: (filters: Partial<FileFiltersType>) => void;
  showEntityFilters?: boolean;
}

export function FileFilters({
  filters,
  onFiltersChange,
  showEntityFilters = true,
}: FileFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFiltersChange({ search: searchValue || undefined });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue, filters.search, onFiltersChange]);

  const handleResetFilters = () => {
    setSearchValue('');
    onFiltersChange({
      category: undefined,
      entity_type: undefined,
      entity_id: undefined,
      file_type: undefined,
      start_date: undefined,
      end_date: undefined,
      search: undefined,
    });
  };

  const activeFilterCount = [
    filters.category,
    filters.entity_type,
    filters.file_type,
    filters.start_date,
    filters.search,
  ].filter(Boolean).length;

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...Object.entries(FILE_CATEGORY_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.label,
    })),
  ];

  const entityTypeOptions = [
    { value: '', label: 'All Entities' },
    { value: 'tenant', label: 'Business' },
    { value: 'user', label: 'Users' },
    { value: 'quote', label: 'Quotes' },
    { value: 'project', label: 'Projects' },
    { value: 'invoice', label: 'Invoices' },
    { value: 'expense', label: 'Expenses' },
  ];

  const fileTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'image', label: 'Images' },
    { value: 'pdf', label: 'PDFs' },
    { value: 'document', label: 'Documents' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="p-4 space-y-4">
        {/* Top Row: Search + Mobile Filter Toggle */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search files..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-10 pr-8"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <Badge variant="info" label={activeFilterCount.toString()} />
            )}
          </button>

          {/* Reset Button */}
          {activeFilterCount > 0 && (
            <Button onClick={handleResetFilters} variant="ghost" size="sm" className="hidden md:flex">
              <X className="w-4 h-4 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {/* Desktop Filters (Always Visible) */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Category Filter */}
          <Select
            label=""
            value={filters.category || ''}
            onChange={(value) =>
              onFiltersChange({ category: (value as FileCategory) || undefined })
            }
            options={categoryOptions}
          />

          {/* Entity Type Filter */}
          {showEntityFilters && (
            <Select
              label=""
              value={filters.entity_type || ''}
              onChange={(value) =>
                onFiltersChange({ entity_type: (value as EntityType) || undefined })
              }
              options={entityTypeOptions}
            />
          )}

          {/* File Type Filter */}
          <Select
            label=""
            value={filters.file_type || ''}
            onChange={(value) =>
              onFiltersChange({ file_type: (value as any) || undefined })
            }
            options={fileTypeOptions}
          />

          {/* Date Range Filter */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {filters.start_date || filters.end_date ? 'Date Range' : 'All Time'}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Filters (Collapsible) */}
        {showMobileFilters && (
          <div className="md:hidden space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Select
              label="Category"
              value={filters.category || ''}
              onChange={(value) =>
                onFiltersChange({ category: (value as FileCategory) || undefined })
              }
              options={categoryOptions}
            />

            {showEntityFilters && (
              <Select
                label="Entity Type"
                value={filters.entity_type || ''}
                onChange={(value) =>
                  onFiltersChange({ entity_type: (value as EntityType) || undefined })
                }
                options={entityTypeOptions}
              />
            )}

            <Select
              label="File Type"
              value={filters.file_type || ''}
              onChange={(value) =>
                onFiltersChange({ file_type: (value as any) || undefined })
              }
              options={fileTypeOptions}
            />

            <Button onClick={handleResetFilters} variant="ghost" className="w-full">
              <X className="w-4 h-4 mr-2" />
              Reset Filters
            </Button>
          </div>
        )}

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">Active filters:</span>

            {filters.category && (
              <Badge variant="blue" className="flex items-center gap-1">
                {FILE_CATEGORY_CONFIG[filters.category].label}
                <button
                  onClick={() => onFiltersChange({ category: undefined })}
                  className="hover:bg-blue-700 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {filters.entity_type && (
              <Badge variant="purple" className="flex items-center gap-1">
                {entityTypeOptions.find((o) => o.value === filters.entity_type)?.label}
                <button
                  onClick={() => onFiltersChange({ entity_type: undefined })}
                  className="hover:bg-purple-700 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {filters.file_type && (
              <Badge variant="green" className="flex items-center gap-1">
                {fileTypeOptions.find((o) => o.value === filters.file_type)?.label}
                <button
                  onClick={() => onFiltersChange({ file_type: undefined })}
                  className="hover:bg-green-700 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {filters.search && (
              <Badge variant="gray" className="flex items-center gap-1">
                "{filters.search}"
                <button
                  onClick={() => {
                    setSearchValue('');
                    onFiltersChange({ search: undefined });
                  }}
                  className="hover:bg-gray-700 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
