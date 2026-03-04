// ============================================================================
// DayView Calendar Component
// ============================================================================
// Displays appointments for a single day with time slots from 6 AM to 9 PM
// Includes swipe navigation for mobile (left/right to change days)
// ============================================================================

'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import Button from '@/components/ui/Button';
import AppointmentBlock from './AppointmentBlock';
import ExternalBlockIndicator from './ExternalBlockIndicator';
import NonAvailableSlot from './NonAvailableSlot';
import type { AppointmentWithRelations, ExternalBlock, AppointmentTypeSchedule } from '@/lib/types/calendar';
import {
  TIME_SLOTS,
  HOURS_HEIGHT_DAY,
  SWIPE_THRESHOLD,
  formatTime,
  formatFullDate,
  isToday,
  formatDateKey,
  calculateTopPosition,
  calculateHeight,
  isTimeInVisibleRange,
  getCurrentTimePosition,
  calculateExternalBlockPosition,
  generateNonAvailableSlots,
} from './calendar.utils';

// ============================================================================
// Types
// ============================================================================

interface DayViewCalendarProps {
  appointments: AppointmentWithRelations[];
  currentDate: Date;
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

export default function DayViewCalendar({
  appointments,
  currentDate,
  externalBlocks = [],
  schedule = [],
  onNavigatePrevious,
  onNavigateNext,
  onNavigateToday,
  onAppointmentClick,
  loading = false,
}: DayViewCalendarProps) {
  const dayContainerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Filter appointments for current day
  const dayAppointments = useMemo(() => {
    const dateKey = formatDateKey(currentDate);
    return appointments.filter((appointment) => appointment.scheduled_date === dateKey);
  }, [appointments, currentDate]);

  // Filter external blocks for current day
  const dayBlocks = useMemo(() => {
    const dateKey = formatDateKey(currentDate);
    return externalBlocks.filter((block) => {
      const blockDate = new Date(block.start_datetime_utc);
      return formatDateKey(blockDate) === dateKey;
    });
  }, [externalBlocks, currentDate]);

  // Get schedule for current day of week
  const daySchedule = useMemo(() => {
    const dayOfWeek = currentDate.getDay();
    return schedule.find((s) => s.day_of_week === dayOfWeek);
  }, [schedule, currentDate]);

  // Generate non-available slots
  const nonAvailableSlots = useMemo(() => {
    return daySchedule ? generateNonAvailableSlots(daySchedule, HOURS_HEIGHT_DAY) : [];
  }, [daySchedule]);

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > SWIPE_THRESHOLD;
    const isRightSwipe = distance < -SWIPE_THRESHOLD;

    if (isLeftSwipe) {
      onNavigateNext(); // Swipe left = next day
    }
    if (isRightSwipe) {
      onNavigatePrevious(); // Swipe right = previous day
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Scroll to current time on mount (if viewing today)
  useEffect(() => {
    if (isToday(currentDate) && dayContainerRef.current) {
      const currentTimePos = getCurrentTimePosition(HOURS_HEIGHT_DAY);
      if (currentTimePos !== null) {
        const scrollPosition = currentTimePos - 100; // Offset for visibility
        setTimeout(() => {
          dayContainerRef.current?.scrollTo({
            top: Math.max(0, scrollPosition),
            behavior: 'smooth',
          });
        }, 100);
      }
    }
  }, [currentDate]);

  return (
    <div className="relative space-y-4">
      {/* Navigation Header */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {formatFullDate(currentDate)}
            </h2>
            {isToday(currentDate) && (
              <p className="text-sm text-brand-600 dark:text-brand-400 font-medium">
                Today
              </p>
            )}
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

      {/* Mobile Swipe Notice */}
      <div className="md:hidden bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2">
        <p className="text-xs text-blue-800 dark:text-blue-200 text-center">
          Swipe left or right to navigate between days
        </p>
      </div>

      {/* Day View Container */}
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Day Grid */}
        <div className="overflow-y-auto max-h-[800px]" ref={dayContainerRef}>
          <div className="grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] divide-x divide-gray-200 dark:divide-gray-700">
            {/* Time Labels Column */}
            <div className="bg-gray-50 dark:bg-gray-900">
              {TIME_SLOTS.map((hour) => (
                <div
                  key={hour}
                  className="h-[80px] px-2 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 text-right border-b border-gray-200 dark:border-gray-700"
                >
                  {formatTime(hour)}
                </div>
              ))}
            </div>

            {/* Appointments Column */}
            <div className="relative min-h-[1280px] bg-white dark:bg-gray-800">
              {/* Time slot backgrounds */}
              {TIME_SLOTS.map((hour) => (
                <div
                  key={hour}
                  className="h-[80px] border-b border-gray-100 dark:border-gray-700/50"
                />
              ))}

              {/* Non-available hours (grayed out) */}
              {nonAvailableSlots.map((slot, index) => (
                <NonAvailableSlot
                  key={`non-available-${index}`}
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
                  HOURS_HEIGHT_DAY
                );
                if (!position) return null;

                return (
                  <ExternalBlockIndicator
                    key={block.id}
                    block={block}
                    variant="day"
                    style={{
                      top: `${position.top}px`,
                      height: `${Math.max(position.height, 30)}px`,
                    }}
                  />
                );
              })}

              {/* Current time indicator (only if viewing today) */}
              {isToday(currentDate) && (() => {
                const topPosition = getCurrentTimePosition(HOURS_HEIGHT_DAY);

                if (topPosition !== null) {
                  return (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{ top: `${topPosition}px` }}
                    >
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-800" />
                        <div className="flex-1 h-0.5 bg-red-500" />
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Appointments */}
              {dayAppointments.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <CalendarIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      No appointments scheduled
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      {isToday(currentDate) ? 'for today' : 'for this day'}
                    </p>
                  </div>
                </div>
              ) : (
                dayAppointments.map((appointment) => {
                  // Skip if appointment is outside our view (before 6 AM or at/after 10 PM)
                  if (!isTimeInVisibleRange(appointment.start_time)) return null;

                  const top = calculateTopPosition(appointment.start_time, HOURS_HEIGHT_DAY);
                  const height = calculateHeight(appointment.start_time, appointment.end_time, HOURS_HEIGHT_DAY);

                  return (
                    <AppointmentBlock
                      key={appointment.id}
                      appointment={appointment}
                      variant="standard"
                      onClick={onAppointmentClick}
                      showTooltip={false} // Don't show tooltip in day view since block is larger
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 60)}px`, // Minimum height of 60px
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading appointments...</p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {dayAppointments.length} {dayAppointments.length === 1 ? 'Appointment' : 'Appointments'}
            </div>
          </div>

          {dayAppointments.length > 0 && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-sm" />
                <span className="text-gray-600 dark:text-gray-400">
                  {dayAppointments.filter(a => a.status === 'confirmed').length} Confirmed
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                <span className="text-gray-600 dark:text-gray-400">
                  {dayAppointments.filter(a => a.status === 'scheduled').length} Scheduled
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
