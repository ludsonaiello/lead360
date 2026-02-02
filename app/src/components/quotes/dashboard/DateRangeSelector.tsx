'use client';

import { useState, useEffect } from 'react';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { format, startOfYear } from 'date-fns';
import Button from '@/components/ui/Button';
import { Calendar } from 'lucide-react';

interface DateRangeSelectorProps {
  onDateChange: (from: string | null, to: string | null) => void;
  defaultPreset?: 'last_7' | 'last_30' | 'last_90' | 'this_year';
}

/**
 * Date range selector wrapper for dashboard
 *
 * Wraps the existing DateRangePicker component and converts Date objects
 * to YYYY-MM-DD strings required by the dashboard API.
 *
 * Includes additional "This Year" preset not in base DateRangePicker.
 */
export default function DateRangeSelector({
  onDateChange,
  defaultPreset = 'last_30',
}: DateRangeSelectorProps) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Apply default preset on mount
  useEffect(() => {
    if (defaultPreset === 'this_year') {
      const start = startOfYear(new Date());
      const end = new Date();
      setStartDate(start);
      setEndDate(end);
      onDateChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
    }
  }, []);

  const handleDateChange = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);

    if (start && end) {
      const fromStr = format(start, 'yyyy-MM-dd');
      const toStr = format(end, 'yyyy-MM-dd');
      onDateChange(fromStr, toStr);
    } else {
      onDateChange(null, null);
    }
  };

  const handleThisYearClick = () => {
    const start = startOfYear(new Date());
    const end = new Date();
    setStartDate(start);
    setEndDate(end);
    onDateChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-3">
      {/* Date Range Picker with built-in presets */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onChange={handleDateChange}
      />

      {/* Additional "This Year" preset */}
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleThisYearClick}
        >
          <Calendar className="w-4 h-4" />
          This Year
        </Button>
      </div>
    </div>
  );
}
