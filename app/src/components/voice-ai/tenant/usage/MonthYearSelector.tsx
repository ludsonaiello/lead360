'use client';

// ============================================================================
// MonthYearSelector Component
// ============================================================================
// Dropdown selectors for filtering usage data by month and year
// ============================================================================

import React from 'react';
import Select from '@/components/ui/Select';

interface MonthYearSelectorProps {
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

/**
 * Generate year options (current year ± 2 years)
 */
const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];

  for (let year = currentYear - 2; year <= currentYear + 2; year++) {
    years.push({
      value: year.toString(),
      label: year.toString(),
    });
  }

  return years;
};

/**
 * Month options (1-12)
 */
const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

/**
 * MonthYearSelector Component
 */
export function MonthYearSelector({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
}: MonthYearSelectorProps) {
  const yearOptions = getYearOptions();

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Filter by:
        </label>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Month Selector */}
          <div className="w-full sm:w-48">
            <Select
              value={selectedMonth.toString()}
              onChange={(value) => onMonthChange(parseInt(value, 10))}
              options={MONTH_OPTIONS}
              className="w-full"
            />
          </div>

          {/* Year Selector */}
          <div className="w-full sm:w-32">
            <Select
              value={selectedYear.toString()}
              onChange={(value) => onYearChange(parseInt(value, 10))}
              options={yearOptions}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
