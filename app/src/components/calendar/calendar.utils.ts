// ============================================================================
// Calendar Utility Functions
// ============================================================================
// Shared utilities for calendar components
// ============================================================================

import type { AppointmentStatus } from '@/lib/types/calendar';

// ============================================================================
// Constants
// ============================================================================

export const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM (6, 7, 8, ... 21)
export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const HOURS_HEIGHT_WEEK = 60; // Height in pixels per hour slot (week view)
export const HOURS_HEIGHT_DAY = 80; // Height in pixels per hour slot (day view)
export const SWIPE_THRESHOLD = 50; // Minimum swipe distance in pixels

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Format hour number to 12-hour time string
 * @example formatTime(14) => "2 PM"
 */
export const formatTime = (hour: number): string => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
};

/**
 * Parse time string (HH:mm) to hours and minutes
 * @example parseTime("14:30") => { hours: 14, minutes: 30 }
 */
export const parseTime = (timeStr: string): { hours: number; minutes: number } => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};

/**
 * Calculate top position for appointment block based on start time
 * @param timeStr - Time in HH:mm format
 * @param hoursHeight - Height per hour (default: 60px for week view)
 * @returns Top position in pixels
 */
export const calculateTopPosition = (timeStr: string, hoursHeight: number = HOURS_HEIGHT_WEEK): number => {
  const { hours, minutes } = parseTime(timeStr);
  const offsetFromStart = hours - 6; // 6 AM is the start
  return offsetFromStart * hoursHeight + (minutes / 60) * hoursHeight;
};

/**
 * Calculate height for appointment block based on duration
 * @param startTime - Start time in HH:mm format
 * @param endTime - End time in HH:mm format
 * @param hoursHeight - Height per hour (default: 60px for week view)
 * @returns Height in pixels
 */
export const calculateHeight = (
  startTime: string,
  endTime: string,
  hoursHeight: number = HOURS_HEIGHT_WEEK
): number => {
  const start = parseTime(startTime);
  const end = parseTime(endTime);

  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  const durationMinutes = endMinutes - startMinutes;

  return (durationMinutes / 60) * hoursHeight;
};

/**
 * Check if an appointment is within the visible time range (6 AM - 10 PM)
 * @param timeStr - Time in HH:mm format
 * @returns true if time is within visible range
 */
export const isTimeInVisibleRange = (timeStr: string): boolean => {
  const { hours } = parseTime(timeStr);
  return hours >= 6 && hours < 22;
};

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Format date header for display
 * @example formatDateHeader(new Date('2026-03-15')) => "Mar 15"
 */
export const formatDateHeader = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Format full date for display
 * @example formatFullDate(new Date('2026-03-15')) => "Saturday, March 15, 2026"
 */
export const formatFullDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Check if date is today
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

/**
 * Get array of dates for a week starting from Sunday
 * @param weekStart - Start date (should be a Sunday)
 * @returns Array of 7 dates
 */
export const getWeekDates = (weekStart: Date): Date[] => {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(date);
  }
  return dates;
};

/**
 * Get Sunday of the current week
 * @param date - Any date
 * @returns Sunday of that week
 */
export const getSundayOfWeek = (date: Date): Date => {
  const day = date.getDay();
  const diff = date.getDate() - day;
  const sunday = new Date(date);
  sunday.setDate(diff);
  return sunday;
};

/**
 * Format date to YYYY-MM-DD string
 */
export const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// ============================================================================
// Status Utilities
// ============================================================================

/**
 * Get color classes for appointment status
 * @param status - Appointment status
 * @returns Tailwind CSS classes for background, border, and text
 */
export const getStatusColor = (status: AppointmentStatus): string => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600 focus:ring-blue-500';
    case 'confirmed':
      return 'bg-green-500 border-green-600 text-white hover:bg-green-600 focus:ring-green-500';
    case 'completed':
      return 'bg-gray-500 border-gray-600 text-white hover:bg-gray-600 focus:ring-gray-500';
    case 'cancelled':
      return 'bg-red-500 border-red-600 text-white hover:bg-red-600 focus:ring-red-500';
    case 'no_show':
      return 'bg-orange-500 border-orange-600 text-white hover:bg-orange-600 focus:ring-orange-500';
    case 'rescheduled':
      return 'bg-purple-500 border-purple-600 text-white hover:bg-purple-600 focus:ring-purple-500';
    case 'in_progress':
      return 'bg-yellow-500 border-yellow-600 text-white hover:bg-yellow-600 focus:ring-yellow-500';
    default:
      return 'bg-gray-500 border-gray-600 text-white hover:bg-gray-600 focus:ring-gray-500';
  }
};

/**
 * Get badge color classes for appointment status (lighter colors for badges)
 */
export const getStatusBadgeColor = (status: AppointmentStatus): string => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    case 'confirmed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    case 'completed':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    case 'no_show':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
    case 'rescheduled':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
  }
};

/**
 * Format status for display
 * @example formatStatusLabel("no_show") => "No Show"
 */
export const formatStatusLabel = (status: AppointmentStatus): string => {
  return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

// ============================================================================
// Grouping Utilities
// ============================================================================

/**
 * Group appointments by date
 * @param appointments - Array of appointments
 * @param dates - Array of dates to group by
 * @returns Record of date keys to appointments
 */
export const groupAppointmentsByDate = <T extends { scheduled_date: string }>(
  appointments: T[],
  dates: Date[]
): Record<string, T[]> => {
  const grouped: Record<string, T[]> = {};

  // Initialize empty arrays for each date
  dates.forEach((date) => {
    const dateKey = formatDateKey(date);
    grouped[dateKey] = [];
  });

  // Group appointments by date
  appointments.forEach((appointment) => {
    const appointmentDate = appointment.scheduled_date;
    if (grouped[appointmentDate]) {
      grouped[appointmentDate].push(appointment);
    }
  });

  return grouped;
};

// ============================================================================
// Current Time Indicator Utilities
// ============================================================================

/**
 * Calculate position for current time indicator
 * @param hoursHeight - Height per hour
 * @returns Position in pixels or null if outside visible range
 */
export const getCurrentTimePosition = (hoursHeight: number = HOURS_HEIGHT_WEEK): number | null => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();

  if (currentHour < 6 || currentHour >= 22) {
    return null; // Outside visible range
  }

  const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
  return calculateTopPosition(timeStr, hoursHeight);
};

// ============================================================================
// External Blocks Utilities (Sprint 31)
// ============================================================================

/**
 * Convert UTC datetime to local time string (HH:mm)
 * @param utcDatetime - ISO 8601 datetime string in UTC
 * @returns Local time string in HH:mm format
 */
export const utcToLocalTime = (utcDatetime: string): string => {
  const date = new Date(utcDatetime);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Calculate position and height for external block
 * @param startUtc - Block start datetime in UTC (ISO 8601)
 * @param endUtc - Block end datetime in UTC (ISO 8601)
 * @param hoursHeight - Height per hour
 * @returns Position and height in pixels, or null if outside visible range
 */
export const calculateExternalBlockPosition = (
  startUtc: string,
  endUtc: string,
  hoursHeight: number = HOURS_HEIGHT_WEEK
): { top: number; height: number } | null => {
  const startLocal = utcToLocalTime(startUtc);
  const endLocal = utcToLocalTime(endUtc);

  // Check if block is within visible range (6 AM - 10 PM)
  if (!isTimeInVisibleRange(startLocal)) {
    return null;
  }

  const top = calculateTopPosition(startLocal, hoursHeight);
  const height = calculateHeight(startLocal, endLocal, hoursHeight);

  return { top, height };
};

// ============================================================================
// Schedule Availability Utilities (Sprint 31)
// ============================================================================

export interface ScheduleWindow {
  is_available: boolean;
  window1_start: string | null;
  window1_end: string | null;
  window2_start: string | null;
  window2_end: string | null;
}

/**
 * Check if a time slot is available based on appointment type schedule
 * @param timeStr - Time in HH:mm format
 * @param schedule - Day schedule configuration
 * @returns true if time is within available windows
 */
export const isTimeSlotAvailable = (timeStr: string, schedule: ScheduleWindow | undefined): boolean => {
  if (!schedule || !schedule.is_available) {
    return false;
  }

  const { hours, minutes } = parseTime(timeStr);
  const timeMinutes = hours * 60 + minutes;

  // Check window 1
  if (schedule.window1_start && schedule.window1_end) {
    const start1 = parseTime(schedule.window1_start);
    const end1 = parseTime(schedule.window1_end);
    const start1Minutes = start1.hours * 60 + start1.minutes;
    const end1Minutes = end1.hours * 60 + end1.minutes;

    if (timeMinutes >= start1Minutes && timeMinutes < end1Minutes) {
      return true;
    }
  }

  // Check window 2
  if (schedule.window2_start && schedule.window2_end) {
    const start2 = parseTime(schedule.window2_start);
    const end2 = parseTime(schedule.window2_end);
    const start2Minutes = start2.hours * 60 + start2.minutes;
    const end2Minutes = end2.hours * 60 + end2.minutes;

    if (timeMinutes >= start2Minutes && timeMinutes < end2Minutes) {
      return true;
    }
  }

  return false;
};

/**
 * Generate non-available time slots for a day based on schedule
 * @param schedule - Day schedule configuration
 * @param hoursHeight - Height per hour
 * @returns Array of {top, height} for each non-available slot
 */
export const generateNonAvailableSlots = (
  schedule: ScheduleWindow | undefined,
  hoursHeight: number = HOURS_HEIGHT_WEEK
): Array<{ top: number; height: number }> => {
  const slots: Array<{ top: number; height: number }> = [];

  if (!schedule || !schedule.is_available) {
    // Entire day is non-available
    slots.push({
      top: 0,
      height: TIME_SLOTS.length * hoursHeight,
    });
    return slots;
  }

  // Calculate non-available periods
  const availablePeriods: Array<{ start: string; end: string }> = [];

  if (schedule.window1_start && schedule.window1_end) {
    availablePeriods.push({
      start: schedule.window1_start,
      end: schedule.window1_end,
    });
  }

  if (schedule.window2_start && schedule.window2_end) {
    availablePeriods.push({
      start: schedule.window2_start,
      end: schedule.window2_end,
    });
  }

  if (availablePeriods.length === 0) {
    // No windows defined, entire day is non-available
    slots.push({
      top: 0,
      height: TIME_SLOTS.length * hoursHeight,
    });
    return slots;
  }

  // Sort available periods by start time
  availablePeriods.sort((a, b) => {
    const aStart = parseTime(a.start);
    const bStart = parseTime(b.start);
    return aStart.hours * 60 + aStart.minutes - (bStart.hours * 60 + bStart.minutes);
  });

  // Generate non-available slots
  const dayStart = '06:00'; // 6 AM
  const dayEnd = '22:00'; // 10 PM

  // Before first window
  const firstWindowStart = availablePeriods[0].start;
  if (firstWindowStart > dayStart) {
    const top = calculateTopPosition(dayStart, hoursHeight);
    const height = calculateHeight(dayStart, firstWindowStart, hoursHeight);
    slots.push({ top, height });
  }

  // Between windows
  for (let i = 0; i < availablePeriods.length - 1; i++) {
    const currentEnd = availablePeriods[i].end;
    const nextStart = availablePeriods[i + 1].start;

    if (currentEnd < nextStart) {
      const top = calculateTopPosition(currentEnd, hoursHeight);
      const height = calculateHeight(currentEnd, nextStart, hoursHeight);
      slots.push({ top, height });
    }
  }

  // After last window
  const lastWindowEnd = availablePeriods[availablePeriods.length - 1].end;
  if (lastWindowEnd < dayEnd) {
    const top = calculateTopPosition(lastWindowEnd, hoursHeight);
    const height = calculateHeight(lastWindowEnd, dayEnd, hoursHeight);
    slots.push({ top, height });
  }

  return slots;
};
