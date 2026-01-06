// Date Range Picker Component
// Uses react-datepicker for date selection with presets

'use client';

import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar } from 'lucide-react';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import type { DateRangePreset } from '@/lib/types/audit';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  className?: string;
}

// Preset date ranges
const DATE_PRESETS: DateRangePreset[] = [
  {
    label: 'Today',
    getValue: () => ({
      start: startOfDay(new Date()),
      end: endOfDay(new Date())
    })
  },
  {
    label: 'Last 7 Days',
    getValue: () => ({
      start: startOfDay(subDays(new Date(), 7)),
      end: endOfDay(new Date())
    })
  },
  {
    label: 'Last 30 Days',
    getValue: () => ({
      start: startOfDay(subDays(new Date(), 30)),
      end: endOfDay(new Date())
    })
  },
  {
    label: 'Last 90 Days',
    getValue: () => ({
      start: startOfDay(subDays(new Date(), 90)),
      end: endOfDay(new Date())
    })
  }
];

/**
 * Date range picker with preset options
 *
 * Features:
 * - Preset ranges (Today, Last 7/30/90 Days)
 * - Custom range selection
 * - Mobile-friendly
 *
 * @example
 * ```tsx
 * <DateRangePicker
 *   startDate={startDate}
 *   endDate={endDate}
 *   onChange={(start, end) => {
 *     setStartDate(start);
 *     setEndDate(end);
 *   }}
 * />
 * ```
 */
export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  className = ''
}: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);

  const handlePresetClick = (preset: DateRangePreset) => {
    const { start, end } = preset.getValue();
    onChange(start, end);
    setShowCustom(false);
  };

  const handleCustomRange = () => {
    setShowCustom(true);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePresetClick(preset)}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {preset.label}
          </button>
        ))}

        <button
          type="button"
          onClick={handleCustomRange}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Custom Range
        </button>

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => {
              onChange(null, null);
              setShowCustom(false);
            }}
            className="px-3 py-1.5 text-sm font-medium rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Custom Date Range Picker */}
      {showCustom && (
        <div className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/50">
          <Calendar className="h-4 w-4 text-gray-500" />

          <div className="flex items-center gap-2">
            <DatePicker
              selected={startDate}
              onChange={(date: Date | null) => onChange(date, endDate)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              maxDate={new Date()}
              placeholderText="Start date"
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              dateFormat="MMM d, yyyy"
            />

            <span className="text-gray-500">to</span>

            <DatePicker
              selected={endDate}
              onChange={(date: Date | null) => onChange(startDate, date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate || undefined}
              maxDate={new Date()}
              placeholderText="End date"
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              dateFormat="MMM d, yyyy"
            />
          </div>
        </div>
      )}

      {/* Selected Range Display */}
      {(startDate || endDate) && !showCustom && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {startDate && endDate
            ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
            : startDate
            ? `From ${startDate.toLocaleDateString()}`
            : endDate
            ? `Until ${endDate.toLocaleDateString()}`
            : ''}
        </div>
      )}
    </div>
  );
}
