// ============================================================================
// WeekView Calendar Component
// ============================================================================
// Displays appointments in a 7-day week grid with time slots from 6 AM to 9 PM
// ============================================================================

'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import Button from '@/components/ui/Button';
import AppointmentBlock from './AppointmentBlock';
import ExternalBlockIndicator from './ExternalBlockIndicator';
import NonAvailableSlot from './NonAvailableSlot';
import type { AppointmentWithRelations, ExternalBlock, AppointmentTypeSchedule } from '@/lib/types/calendar';
import {
  TIME_SLOTS,
  DAYS_OF_WEEK,
  HOURS_HEIGHT_WEEK,
  formatTime,
  formatDateHeader,
  isToday,
  getWeekDates,
  groupAppointmentsByDate,
  calculateTopPosition,
  calculateHeight,
  isTimeInVisibleRange,
  formatDateKey,
  calculateExternalBlockPosition,
  generateNonAvailableSlots,
} from './calendar.utils';

// ============================================================================
// Types
// ============================================================================

interface WeekViewCalendarProps {
  appointments: AppointmentWithRelations[];
  currentWeekStart: Date;
  externalBlocks?: ExternalBlock[];
  schedule?: AppointmentTypeSchedule[];
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onNavigateToday: () => void;
  onAppointmentClick?: (appointment: AppointmentWithRelations) => void;
  loading?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export default function WeekViewCalendar({
  appointments,
  currentWeekStart,
  externalBlocks = [],
  schedule = [],
  onNavigatePrevious,
  onNavigateNext,
  onNavigateToday,
  onAppointmentClick,
  loading = false,
}: WeekViewCalendarProps) {
  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart]);

  // Group appointments by date
  const appointmentsByDate = useMemo(
    () => groupAppointmentsByDate(appointments, weekDates),
    [appointments, weekDates]
  );

  // Group external blocks by date
  const externalBlocksByDate = useMemo(() => {
    const grouped: Record<string, ExternalBlock[]> = {};

    weekDates.forEach((date) => {
      const dateKey = formatDateKey(date);
      grouped[dateKey] = [];
    });

    externalBlocks.forEach((block) => {
      const blockDate = new Date(block.start_datetime_utc);
      const dateKey = formatDateKey(blockDate);
      if (grouped[dateKey]) {
        grouped[dateKey].push(block);
      }
    });

    return grouped;
  }, [externalBlocks, weekDates]);

  return (
    <div className="relative space-y-4">
      {/* Navigation Header */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {weekDates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Week of {formatDateHeader(weekDates[0])} - {formatDateHeader(weekDates[6])}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onNavigateToday} variant="secondary" size="sm">
            Today
          </Button>
          <Button onClick={onNavigatePrevious} variant="secondary" size="sm">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button onClick={onNavigateNext} variant="secondary" size="sm">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {/* Mobile Notice */}
        <div className="md:hidden bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Scroll horizontally to view all days
          </p>
        </div>

        {/* Scrollable Container for Week Header and Time Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Week Header */}
            <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
              {/* Time column header */}
              <div className="p-2 text-center bg-gray-50 dark:bg-gray-900">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Time</span>
              </div>

              {/* Day headers */}
              {weekDates.map((date, index) => (
                <div
                  key={index}
                  className={`p-2 text-center ${
                    isToday(date)
                      ? 'bg-brand-50 dark:bg-brand-900/20'
                      : 'bg-gray-50 dark:bg-gray-900'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {DAYS_OF_WEEK[date.getDay()].substring(0, 3)}
                  </div>
                  <div
                    className={`text-lg font-semibold mt-1 ${
                      isToday(date)
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {date.getDate()}
                  </div>
                </div>
              ))}
            </div>

            {/* Time Grid */}
            <div className="grid grid-cols-8 divide-x divide-gray-200 dark:divide-gray-700">
          {/* Time Labels Column */}
          <div className="bg-gray-50 dark:bg-gray-900">
            {TIME_SLOTS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 text-right border-b border-gray-200 dark:border-gray-700"
              >
                {formatTime(hour)}
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDates.map((date, dayIndex) => {
            const dateKey = formatDateKey(date);
            const dayAppointments = appointmentsByDate[dateKey] || [];
            const dayBlocks = externalBlocksByDate[dateKey] || [];

            // Get schedule for this day of week
            const dayOfWeek = date.getDay();
            const daySchedule = schedule.find((s) => s.day_of_week === dayOfWeek);
            const nonAvailableSlots = daySchedule ? generateNonAvailableSlots(daySchedule, HOURS_HEIGHT_WEEK) : [];

            return (
              <div
                key={dayIndex}
                className={`relative min-h-[960px] ${
                  isToday(date) ? 'bg-brand-50/20 dark:bg-brand-900/10' : ''
                }`}
              >
                {/* Time slot backgrounds */}
                {TIME_SLOTS.map((hour) => (
                  <div
                    key={hour}
                    className="h-[60px] border-b border-gray-100 dark:border-gray-700/50"
                  />
                ))}

                {/* Non-available hours (grayed out) */}
                {nonAvailableSlots.map((slot, index) => (
                  <NonAvailableSlot
                    key={`non-available-${dayIndex}-${index}`}
                    style={{
                      top: `${slot.top}px`,
                      height: `${slot.height}px`,
                    }}
                  />
                ))}

                {/* External blocks */}
                {dayBlocks.map((block) => {
                  const position = calculateExternalBlockPosition(
                    block.start_datetime_utc,
                    block.end_datetime_utc,
                    HOURS_HEIGHT_WEEK
                  );
                  if (!position) return null;

                  return (
                    <ExternalBlockIndicator
                      key={block.id}
                      block={block}
                      variant="week"
                      style={{
                        top: `${position.top}px`,
                        height: `${Math.max(position.height, 20)}px`,
                      }}
                    />
                  );
                })}

                {/* Appointments */}
                {dayAppointments.map((appointment) => {
                  // Skip if appointment is outside our view (before 6 AM or at/after 10 PM)
                  if (!isTimeInVisibleRange(appointment.start_time)) return null;

                  const top = calculateTopPosition(appointment.start_time, HOURS_HEIGHT_WEEK);
                  const height = calculateHeight(appointment.start_time, appointment.end_time, HOURS_HEIGHT_WEEK);

                  return (
                    <AppointmentBlock
                      key={appointment.id}
                      appointment={appointment}
                      variant="compact"
                      onClick={onAppointmentClick}
                      showTooltip={true}
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 30)}px`, // Minimum height of 30px
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading appointments...</p>
          </div>
        </div>
      )}
    </div>
  );
}
