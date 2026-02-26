'use client';

// ============================================================================
// AvailableHoursEditor Component
// ============================================================================
// Visual editor for available_hours JSON field
// Allows setting time windows per day of the week
// Format: {"mon":[["09:00","17:00"]],"tue":[["09:00","17:00"]]}
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface AvailableHoursEditorProps {
  value: string; // JSON string or empty
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Correct format: array of [open, close] tuples
type TimeRange = [string, string]; // ["09:00", "17:00"]

interface WeekSchedule {
  [day: string]: TimeRange[]; // Array of [open, close] tuples
}

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

/**
 * AvailableHoursEditor - Visual editor for available hours
 */
export function AvailableHoursEditor({
  value,
  onChange,
  disabled = false,
}: AvailableHoursEditorProps) {
  const [schedule, setSchedule] = useState<WeekSchedule>({});
  const [alwaysAvailable, setAlwaysAvailable] = useState(true);

  // Initialize from JSON string
  useEffect(() => {
    if (!value || value.trim() === '') {
      setAlwaysAvailable(true);
      setSchedule({});
    } else {
      try {
        const parsed = JSON.parse(value);

        // Handle both old format (objects) and new format (arrays) for backwards compatibility
        const normalizedSchedule: WeekSchedule = {};

        for (const day in parsed) {
          const dayData = parsed[day];

          if (Array.isArray(dayData)) {
            // Check if it's the correct format (array of arrays)
            if (dayData.length > 0 && Array.isArray(dayData[0])) {
              // Correct format: [["09:00", "17:00"]]
              normalizedSchedule[day] = dayData as TimeRange[];
            } else if (dayData.length > 0 && typeof dayData[0] === 'object' && 'open' in dayData[0]) {
              // Old format: [{open: "09:00", close: "17:00"}] - convert to new format
              normalizedSchedule[day] = dayData.map((range: any) => [range.open, range.close] as TimeRange);
            }
          } else if (typeof dayData === 'object' && 'open' in dayData) {
            // Very old format: {open: "09:00", close: "17:00"} - convert to new format
            normalizedSchedule[day] = [[dayData.open, dayData.close] as TimeRange];
          }
        }

        setSchedule(normalizedSchedule);
        setAlwaysAvailable(false);
      } catch (e) {
        console.error('Invalid JSON in available_hours:', e);
        setAlwaysAvailable(true);
        setSchedule({});
      }
    }
  }, [value]);

  // Update parent when schedule changes
  const updateSchedule = (newSchedule: WeekSchedule) => {
    setSchedule(newSchedule);
    if (Object.keys(newSchedule).length === 0) {
      onChange('');
    } else {
      onChange(JSON.stringify(newSchedule));
    }
  };

  // Toggle always available
  const toggleAlwaysAvailable = () => {
    if (alwaysAvailable) {
      // Switch to custom hours - set default business hours
      const defaultSchedule: WeekSchedule = {
        mon: [['09:00', '17:00']],
        tue: [['09:00', '17:00']],
        wed: [['09:00', '17:00']],
        thu: [['09:00', '17:00']],
        fri: [['09:00', '17:00']],
      };
      setAlwaysAvailable(false);
      updateSchedule(defaultSchedule);
    } else {
      // Switch to always available
      setAlwaysAvailable(true);
      updateSchedule({});
    }
  };

  // Add time range to a day
  const addTimeRange = (dayKey: string) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[dayKey]) {
      newSchedule[dayKey] = [];
    }
    newSchedule[dayKey].push(['09:00', '17:00']);
    updateSchedule(newSchedule);
  };

  // Remove time range from a day
  const removeTimeRange = (dayKey: string, index: number) => {
    const newSchedule = { ...schedule };
    newSchedule[dayKey].splice(index, 1);
    if (newSchedule[dayKey].length === 0) {
      delete newSchedule[dayKey];
    }
    updateSchedule(newSchedule);
  };

  // Update time range
  const updateTimeRange = (
    dayKey: string,
    index: number,
    field: 0 | 1, // 0 = open, 1 = close
    value: string
  ) => {
    const newSchedule = { ...schedule };
    newSchedule[dayKey][index][field] = value;
    updateSchedule(newSchedule);
  };

  return (
    <div className="space-y-4">
      {/* Always Available Toggle */}
      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 block">
              {alwaysAvailable ? 'Always Available' : 'Custom Hours'}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {alwaysAvailable ? 'Available 24/7' : 'Specific time windows'}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant={alwaysAvailable ? 'outline' : 'primary'}
          size="sm"
          onClick={toggleAlwaysAvailable}
          disabled={disabled}
          className={alwaysAvailable ? 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 font-semibold' : ''}
        >
          {alwaysAvailable ? (
            <>
              <Clock className="h-4 w-4 mr-1.5" />
              Set Custom Hours
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 mr-1.5" />
              Make Always Available
            </>
          )}
        </Button>
      </div>

      {/* Custom Hours Editor */}
      {!alwaysAvailable && (
        <div className="space-y-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Set specific availability windows for each day. Leave a day empty if not available.
          </p>

          {DAYS.map((day) => (
            <div
              key={day.key}
              className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {day.label}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTimeRange(day.key)}
                  disabled={disabled}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Hours
                </Button>
              </div>

              {/* Time Ranges */}
              {schedule[day.key] && schedule[day.key].length > 0 ? (
                <div className="space-y-2">
                  {schedule[day.key].map((range, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={range[0]}
                        onChange={(e) =>
                          updateTimeRange(day.key, index, 0, e.target.value)
                        }
                        disabled={disabled}
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">to</span>
                      <Input
                        type="time"
                        value={range[1]}
                        onChange={(e) =>
                          updateTimeRange(day.key, index, 1, e.target.value)
                        }
                        disabled={disabled}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTimeRange(day.key, index)}
                        disabled={disabled}
                        className="text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                  Not available on this day
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
