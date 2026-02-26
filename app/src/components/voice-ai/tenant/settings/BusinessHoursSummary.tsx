'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, Settings, AlertCircle, Loader2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import * as tenantApi from '@/lib/api/tenant';
import { BusinessHours } from '@/lib/types/tenant';

interface DayHours {
  dayName: string;
  isClosed: boolean;
  open1: string | null;
  close1: string | null;
  open2: string | null;
  close2: string | null;
}

export function BusinessHoursSummary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);

  useEffect(() => {
    loadBusinessHours();
  }, []);

  const loadBusinessHours = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tenantApi.getBusinessHours();
      setBusinessHours(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load business hours');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string | null): string => {
    if (!time) return '';

    // Parse 24-hour time "09:00" or "17:00"
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);

    // Convert to 12-hour format
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatShifts = (day: DayHours): string => {
    if (day.isClosed) return 'Closed';

    const shifts: string[] = [];

    // First shift
    if (day.open1 && day.close1) {
      shifts.push(`${formatTime(day.open1)} - ${formatTime(day.close1)}`);
    }

    // Second shift (lunch break support)
    if (day.open2 && day.close2) {
      shifts.push(`${formatTime(day.open2)} - ${formatTime(day.close2)}`);
    }

    return shifts.length > 0 ? shifts.join(', ') : 'Closed';
  };

  // Transform flat API structure to array for display
  const getDaysArray = (hours: BusinessHours): DayHours[] => {
    return [
      {
        dayName: 'Monday',
        isClosed: hours.monday_closed,
        open1: hours.monday_open1,
        close1: hours.monday_close1,
        open2: hours.monday_open2,
        close2: hours.monday_close2,
      },
      {
        dayName: 'Tuesday',
        isClosed: hours.tuesday_closed,
        open1: hours.tuesday_open1,
        close1: hours.tuesday_close1,
        open2: hours.tuesday_open2,
        close2: hours.tuesday_close2,
      },
      {
        dayName: 'Wednesday',
        isClosed: hours.wednesday_closed,
        open1: hours.wednesday_open1,
        close1: hours.wednesday_close1,
        open2: hours.wednesday_open2,
        close2: hours.wednesday_close2,
      },
      {
        dayName: 'Thursday',
        isClosed: hours.thursday_closed,
        open1: hours.thursday_open1,
        close1: hours.thursday_close1,
        open2: hours.thursday_open2,
        close2: hours.thursday_close2,
      },
      {
        dayName: 'Friday',
        isClosed: hours.friday_closed,
        open1: hours.friday_open1,
        close1: hours.friday_close1,
        open2: hours.friday_open2,
        close2: hours.friday_close2,
      },
      {
        dayName: 'Saturday',
        isClosed: hours.saturday_closed,
        open1: hours.saturday_open1,
        close1: hours.saturday_close1,
        open2: hours.saturday_open2,
        close2: hours.saturday_close2,
      },
      {
        dayName: 'Sunday',
        isClosed: hours.sunday_closed,
        open1: hours.sunday_open1,
        close1: hours.sunday_close1,
        open2: hours.sunday_open2,
        close2: hours.sunday_close2,
      },
    ];
  };

  // Check if hours are configured (any day has hours)
  const hasConfiguredHours = (hours: BusinessHours): boolean => {
    return !!(
      hours.monday_open1 ||
      hours.tuesday_open1 ||
      hours.wednesday_open1 ||
      hours.thursday_open1 ||
      hours.friday_open1 ||
      hours.saturday_open1 ||
      hours.sunday_open1
    );
  };

  // Loading state
  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
          <AlertCircle className="h-5 w-5" />
          <h3 className="font-semibold">Error Loading Business Hours</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadBusinessHours}
          className="mt-3"
        >
          Try Again
        </Button>
      </Card>
    );
  }

  // Main content
  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Business Hours
          </h3>
        </div>
        <Link href="/settings/business#hours">
          <Button variant="secondary" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Edit Hours
          </Button>
        </Link>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        The Voice AI agent uses these hours to inform callers when you're open
      </p>

      {/* Content: Empty state or hours list */}
      {!businessHours || !hasConfiguredHours(businessHours) ? (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Business hours not configured</AlertTitle>
          <AlertDescription>
            Set your operating hours so the AI agent can inform callers when you're available.
            <Link
              href="/settings/business#hours"
              className="underline ml-1 font-medium hover:text-yellow-800 dark:hover:text-yellow-200"
            >
              Configure now →
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          {getDaysArray(businessHours).map((day) => (
            <div
              key={day.dayName}
              className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
            >
              <span className="font-medium text-gray-900 dark:text-gray-100 w-24">
                {day.dayName}
              </span>
              <span
                className={
                  day.isClosed
                    ? 'text-gray-500 dark:text-gray-400 italic'
                    : 'text-gray-700 dark:text-gray-300'
                }
              >
                {formatShifts(day)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
