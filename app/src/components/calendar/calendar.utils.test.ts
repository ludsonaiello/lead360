/**
 * Calendar Utilities Tests
 * Sprint 41: Calendar Frontend Testing
 *
 * Tests cover all utility functions for calendar components:
 * - Time utilities
 * - Date utilities
 * - Status utilities
 * - Grouping utilities
 * - External blocks utilities
 * - Schedule availability utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AppointmentStatus } from '@/lib/types/calendar';
import {
  // Constants
  TIME_SLOTS,
  DAYS_OF_WEEK,
  HOURS_HEIGHT_WEEK,
  HOURS_HEIGHT_DAY,
  SWIPE_THRESHOLD,
  // Time utilities
  formatTime,
  parseTime,
  calculateTopPosition,
  calculateHeight,
  isTimeInVisibleRange,
  // Date utilities
  formatDateHeader,
  formatFullDate,
  isToday,
  getWeekDates,
  getSundayOfWeek,
  formatDateKey,
  // Status utilities
  getStatusColor,
  getStatusBadgeColor,
  formatStatusLabel,
  // Grouping utilities
  groupAppointmentsByDate,
  // Current time utilities
  getCurrentTimePosition,
  // External blocks utilities
  utcToLocalTime,
  calculateExternalBlockPosition,
  // Schedule availability utilities
  isTimeSlotAvailable,
  generateNonAvailableSlots,
  type ScheduleWindow,
} from './calendar.utils';

// ============================================================================
// Constants Tests
// ============================================================================

describe('Calendar Constants', () => {
  it('defines correct time slots from 6 AM to 9 PM', () => {
    expect(TIME_SLOTS).toHaveLength(16);
    expect(TIME_SLOTS[0]).toBe(6);
    expect(TIME_SLOTS[15]).toBe(21);
  });

  it('defines all 7 days of week starting with Sunday', () => {
    expect(DAYS_OF_WEEK).toHaveLength(7);
    expect(DAYS_OF_WEEK[0]).toBe('Sunday');
    expect(DAYS_OF_WEEK[6]).toBe('Saturday');
  });

  it('defines correct hour heights for different views', () => {
    expect(HOURS_HEIGHT_WEEK).toBe(60);
    expect(HOURS_HEIGHT_DAY).toBe(80);
  });

  it('defines swipe threshold for mobile navigation', () => {
    expect(SWIPE_THRESHOLD).toBe(50);
  });
});

// ============================================================================
// Time Utilities Tests
// ============================================================================

describe('Time Utilities', () => {
  describe('formatTime', () => {
    it('formats midnight correctly', () => {
      expect(formatTime(0)).toBe('12 AM');
    });

    it('formats noon correctly', () => {
      expect(formatTime(12)).toBe('12 PM');
    });

    it('formats AM hours correctly', () => {
      expect(formatTime(1)).toBe('1 AM');
      expect(formatTime(6)).toBe('6 AM');
      expect(formatTime(11)).toBe('11 AM');
    });

    it('formats PM hours correctly', () => {
      expect(formatTime(13)).toBe('1 PM');
      expect(formatTime(14)).toBe('2 PM');
      expect(formatTime(21)).toBe('9 PM');
      expect(formatTime(23)).toBe('11 PM');
    });
  });

  describe('parseTime', () => {
    it('parses time string correctly', () => {
      expect(parseTime('09:30')).toEqual({ hours: 9, minutes: 30 });
      expect(parseTime('14:45')).toEqual({ hours: 14, minutes: 45 });
      expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
    });

    it('handles single-digit hours and minutes', () => {
      expect(parseTime('9:5')).toEqual({ hours: 9, minutes: 5 });
    });
  });

  describe('calculateTopPosition', () => {
    it('calculates position for 6 AM (start of day)', () => {
      expect(calculateTopPosition('06:00')).toBe(0);
    });

    it('calculates position for 7 AM', () => {
      expect(calculateTopPosition('07:00')).toBe(60);
    });

    it('calculates position for 9:30 AM', () => {
      expect(calculateTopPosition('09:30')).toBe(210); // 3.5 hours * 60
    });

    it('calculates position for 2 PM', () => {
      expect(calculateTopPosition('14:00')).toBe(480); // 8 hours * 60
    });

    it('uses custom hour height when provided', () => {
      expect(calculateTopPosition('07:00', 80)).toBe(80);
      expect(calculateTopPosition('09:30', 80)).toBe(280);
    });
  });

  describe('calculateHeight', () => {
    it('calculates height for 30-minute appointment', () => {
      expect(calculateHeight('09:00', '09:30')).toBe(30);
    });

    it('calculates height for 1-hour appointment', () => {
      expect(calculateHeight('09:00', '10:00')).toBe(60);
    });

    it('calculates height for 2-hour appointment', () => {
      expect(calculateHeight('09:00', '11:00')).toBe(120);
    });

    it('calculates height for 45-minute appointment', () => {
      expect(calculateHeight('09:00', '09:45')).toBe(45);
    });

    it('uses custom hour height when provided', () => {
      expect(calculateHeight('09:00', '10:00', 80)).toBe(80);
      expect(calculateHeight('09:00', '11:00', 80)).toBe(160);
    });
  });

  describe('isTimeInVisibleRange', () => {
    it('returns true for times within 6 AM - 10 PM', () => {
      expect(isTimeInVisibleRange('06:00')).toBe(true);
      expect(isTimeInVisibleRange('09:30')).toBe(true);
      expect(isTimeInVisibleRange('14:00')).toBe(true);
      expect(isTimeInVisibleRange('21:59')).toBe(true);
    });

    it('returns false for times before 6 AM', () => {
      expect(isTimeInVisibleRange('05:59')).toBe(false);
      expect(isTimeInVisibleRange('00:00')).toBe(false);
    });

    it('returns false for times at or after 10 PM', () => {
      expect(isTimeInVisibleRange('22:00')).toBe(false);
      expect(isTimeInVisibleRange('23:00')).toBe(false);
    });
  });
});

// ============================================================================
// Date Utilities Tests
// ============================================================================

describe('Date Utilities', () => {
  describe('formatDateHeader', () => {
    it('formats date correctly', () => {
      const date = new Date('2026-03-15');
      expect(formatDateHeader(date)).toBe('Mar 15');
    });

    it('formats different months correctly', () => {
      expect(formatDateHeader(new Date('2026-01-01'))).toBe('Jan 1');
      expect(formatDateHeader(new Date('2026-12-31'))).toBe('Dec 31');
    });
  });

  describe('formatFullDate', () => {
    it('formats full date correctly', () => {
      const date = new Date('2026-03-15');
      expect(formatFullDate(date)).toMatch(/Sunday, March 15, 2026/);
    });
  });

  describe('isToday', () => {
    beforeEach(() => {
      // Set fake time to March 15, 2026 12:00 PM
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-15T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true for today', () => {
      const today = new Date('2026-03-15');
      expect(isToday(today)).toBe(true);
    });

    it('returns false for yesterday', () => {
      const yesterday = new Date('2026-03-14');
      expect(isToday(yesterday)).toBe(false);
    });

    it('returns false for tomorrow', () => {
      const tomorrow = new Date('2026-03-16');
      expect(isToday(tomorrow)).toBe(false);
    });
  });

  describe('getWeekDates', () => {
    it('generates 7 dates starting from Sunday', () => {
      const sunday = new Date('2026-03-15'); // Sunday
      const dates = getWeekDates(sunday);

      expect(dates).toHaveLength(7);
      expect(dates[0].getDate()).toBe(15); // Sunday
      expect(dates[6].getDate()).toBe(21); // Saturday
    });

    it('handles month boundaries correctly', () => {
      const sunday = new Date('2026-03-29'); // Last Sunday of March
      const dates = getWeekDates(sunday);

      expect(dates).toHaveLength(7);
      expect(dates[0].getMonth()).toBe(2); // March (0-indexed)
      expect(dates[6].getMonth()).toBe(3); // April
    });
  });

  describe('getSundayOfWeek', () => {
    it('returns the same date for Sunday', () => {
      const sunday = new Date('2026-03-15');
      const result = getSundayOfWeek(sunday);
      expect(result.getDate()).toBe(15);
    });

    it('returns previous Sunday for Monday', () => {
      const monday = new Date('2026-03-16');
      const result = getSundayOfWeek(monday);
      expect(result.getDate()).toBe(15);
    });

    it('returns previous Sunday for Saturday', () => {
      const saturday = new Date('2026-03-21');
      const result = getSundayOfWeek(saturday);
      expect(result.getDate()).toBe(15);
    });
  });

  describe('formatDateKey', () => {
    it('formats date to YYYY-MM-DD', () => {
      const date = new Date('2026-03-15');
      expect(formatDateKey(date)).toBe('2026-03-15');
    });

    it('pads single-digit months and days', () => {
      const date = new Date('2026-01-05');
      expect(formatDateKey(date)).toBe('2026-01-05');
    });
  });
});

// ============================================================================
// Status Utilities Tests
// ============================================================================

describe('Status Utilities', () => {
  describe('getStatusColor', () => {
    it('returns blue classes for scheduled status', () => {
      const color = getStatusColor('scheduled');
      expect(color).toContain('bg-blue-500');
      expect(color).toContain('border-blue-600');
    });

    it('returns green classes for confirmed status', () => {
      const color = getStatusColor('confirmed');
      expect(color).toContain('bg-green-500');
    });

    it('returns gray classes for completed status', () => {
      const color = getStatusColor('completed');
      expect(color).toContain('bg-gray-500');
    });

    it('returns red classes for cancelled status', () => {
      const color = getStatusColor('cancelled');
      expect(color).toContain('bg-red-500');
    });

    it('returns orange classes for no_show status', () => {
      const color = getStatusColor('no_show');
      expect(color).toContain('bg-orange-500');
    });

    it('returns purple classes for rescheduled status', () => {
      const color = getStatusColor('rescheduled');
      expect(color).toContain('bg-purple-500');
    });

    it('returns yellow classes for in_progress status', () => {
      const color = getStatusColor('in_progress');
      expect(color).toContain('bg-yellow-500');
    });

    it('returns gray classes for unknown status', () => {
      const color = getStatusColor('unknown' as AppointmentStatus);
      expect(color).toContain('bg-gray-500');
    });
  });

  describe('getStatusBadgeColor', () => {
    it('returns light blue classes for scheduled status', () => {
      const color = getStatusBadgeColor('scheduled');
      expect(color).toContain('bg-blue-100');
      expect(color).toContain('text-blue-800');
    });

    it('returns light green classes for confirmed status', () => {
      const color = getStatusBadgeColor('confirmed');
      expect(color).toContain('bg-green-100');
    });

    it('includes dark mode classes', () => {
      const color = getStatusBadgeColor('scheduled');
      expect(color).toContain('dark:bg-blue-900/20');
      expect(color).toContain('dark:text-blue-400');
    });
  });

  describe('formatStatusLabel', () => {
    it('formats single-word status', () => {
      expect(formatStatusLabel('scheduled')).toBe('Scheduled');
      expect(formatStatusLabel('confirmed')).toBe('Confirmed');
    });

    it('formats multi-word status with underscores', () => {
      expect(formatStatusLabel('no_show')).toBe('No Show');
      expect(formatStatusLabel('in_progress')).toBe('In Progress');
    });
  });
});

// ============================================================================
// Grouping Utilities Tests
// ============================================================================

describe('Grouping Utilities', () => {
  describe('groupAppointmentsByDate', () => {
    it('groups appointments by date correctly', () => {
      const appointments = [
        { id: '1', scheduled_date: '2026-03-15' },
        { id: '2', scheduled_date: '2026-03-15' },
        { id: '3', scheduled_date: '2026-03-16' },
      ];

      const dates = [new Date('2026-03-15'), new Date('2026-03-16')];

      const grouped = groupAppointmentsByDate(appointments, dates);

      expect(grouped['2026-03-15']).toHaveLength(2);
      expect(grouped['2026-03-16']).toHaveLength(1);
    });

    it('creates empty arrays for dates with no appointments', () => {
      const appointments = [{ id: '1', scheduled_date: '2026-03-15' }];
      const dates = [new Date('2026-03-15'), new Date('2026-03-16')];

      const grouped = groupAppointmentsByDate(appointments, dates);

      expect(grouped['2026-03-15']).toHaveLength(1);
      expect(grouped['2026-03-16']).toHaveLength(0);
    });

    it('ignores appointments outside provided dates', () => {
      const appointments = [
        { id: '1', scheduled_date: '2026-03-15' },
        { id: '2', scheduled_date: '2026-03-20' }, // Outside provided dates
      ];

      const dates = [new Date('2026-03-15')];

      const grouped = groupAppointmentsByDate(appointments, dates);

      expect(grouped['2026-03-15']).toHaveLength(1);
      expect(grouped['2026-03-20']).toBeUndefined();
    });
  });
});

// ============================================================================
// Current Time Position Tests
// ============================================================================

describe('getCurrentTimePosition', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns position for time within visible range', () => {
    // Mock current time to 9:30 AM
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T09:30:00'));

    const position = getCurrentTimePosition();
    expect(position).toBe(210); // 3.5 hours from 6 AM * 60
  });

  it('returns null for time before 6 AM', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T05:00:00'));

    expect(getCurrentTimePosition()).toBeNull();
  });

  it('returns null for time at or after 10 PM', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T22:00:00'));

    expect(getCurrentTimePosition()).toBeNull();
  });
});

// ============================================================================
// External Blocks Utilities Tests
// ============================================================================

describe('External Blocks Utilities', () => {
  describe('utcToLocalTime', () => {
    it('converts UTC datetime to local time string', () => {
      const utcDatetime = '2026-03-15T14:30:00Z';
      const localTime = utcToLocalTime(utcDatetime);
      // Result will vary based on timezone, but format should be HH:mm
      expect(localTime).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('calculateExternalBlockPosition', () => {
    it('calculates position for block within visible range', () => {
      // Times in UTC (will be converted to local)
      const startUtc = '2026-03-15T14:00:00Z';
      const endUtc = '2026-03-15T15:00:00Z';

      const result = calculateExternalBlockPosition(startUtc, endUtc);

      // If local time is within 6 AM - 10 PM range, should return position
      if (result) {
        expect(result).toHaveProperty('top');
        expect(result).toHaveProperty('height');
        expect(result.top).toBeGreaterThanOrEqual(0);
        expect(result.height).toBeGreaterThan(0);
      } else {
        // Block is outside visible range (before 6 AM or at/after 10 PM local time)
        expect(result).toBeNull();
      }
    });
  });
});

// ============================================================================
// Schedule Availability Utilities Tests
// ============================================================================

describe('Schedule Availability Utilities', () => {
  describe('isTimeSlotAvailable', () => {
    const schedule: ScheduleWindow = {
      is_available: true,
      window1_start: '09:00',
      window1_end: '12:00',
      window2_start: '14:00',
      window2_end: '17:00',
    };

    it('returns false when schedule is not available', () => {
      const unavailableSchedule: ScheduleWindow = {
        is_available: false,
        window1_start: null,
        window1_end: null,
        window2_start: null,
        window2_end: null,
      };

      expect(isTimeSlotAvailable('10:00', unavailableSchedule)).toBe(false);
    });

    it('returns false when schedule is undefined', () => {
      expect(isTimeSlotAvailable('10:00', undefined)).toBe(false);
    });

    it('returns true for time in window 1', () => {
      expect(isTimeSlotAvailable('09:00', schedule)).toBe(true);
      expect(isTimeSlotAvailable('10:30', schedule)).toBe(true);
      expect(isTimeSlotAvailable('11:59', schedule)).toBe(true);
    });

    it('returns true for time in window 2', () => {
      expect(isTimeSlotAvailable('14:00', schedule)).toBe(true);
      expect(isTimeSlotAvailable('15:30', schedule)).toBe(true);
      expect(isTimeSlotAvailable('16:59', schedule)).toBe(true);
    });

    it('returns false for time outside windows', () => {
      expect(isTimeSlotAvailable('08:59', schedule)).toBe(false);
      expect(isTimeSlotAvailable('12:00', schedule)).toBe(false);
      expect(isTimeSlotAvailable('13:00', schedule)).toBe(false);
      expect(isTimeSlotAvailable('17:00', schedule)).toBe(false);
    });

    it('handles schedule with only window 1', () => {
      const oneWindowSchedule: ScheduleWindow = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '17:00',
        window2_start: null,
        window2_end: null,
      };

      expect(isTimeSlotAvailable('10:00', oneWindowSchedule)).toBe(true);
      expect(isTimeSlotAvailable('18:00', oneWindowSchedule)).toBe(false);
    });
  });

  describe('generateNonAvailableSlots', () => {
    it('generates full-day slot when not available', () => {
      const unavailableSchedule: ScheduleWindow = {
        is_available: false,
        window1_start: null,
        window1_end: null,
        window2_start: null,
        window2_end: null,
      };

      const slots = generateNonAvailableSlots(unavailableSchedule);

      expect(slots).toHaveLength(1);
      expect(slots[0].top).toBe(0);
      expect(slots[0].height).toBe(TIME_SLOTS.length * HOURS_HEIGHT_WEEK);
    });

    it('generates full-day slot when schedule is undefined', () => {
      const slots = generateNonAvailableSlots(undefined);

      expect(slots).toHaveLength(1);
      expect(slots[0].top).toBe(0);
    });

    it('generates slots before, between, and after windows', () => {
      const schedule: ScheduleWindow = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '12:00',
        window2_start: '14:00',
        window2_end: '17:00',
      };

      const slots = generateNonAvailableSlots(schedule);

      // Should have 3 slots: before 9 AM, between 12-2 PM, after 5 PM
      expect(slots).toHaveLength(3);

      // First slot: 6 AM - 9 AM
      expect(slots[0].top).toBe(0);
      expect(slots[0].height).toBe(180); // 3 hours * 60

      // Second slot: 12 PM - 2 PM
      expect(slots[1].top).toBe(360); // 6 hours from start
      expect(slots[1].height).toBe(120); // 2 hours * 60

      // Third slot: 5 PM - 10 PM
      expect(slots[2].top).toBe(660); // 11 hours from start
      expect(slots[2].height).toBe(300); // 5 hours * 60
    });

    it('generates slots with only one window', () => {
      const schedule: ScheduleWindow = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '17:00',
        window2_start: null,
        window2_end: null,
      };

      const slots = generateNonAvailableSlots(schedule);

      // Should have 2 slots: before 9 AM and after 5 PM
      expect(slots).toHaveLength(2);
    });

    it('handles window starting at day start', () => {
      const schedule: ScheduleWindow = {
        is_available: true,
        window1_start: '06:00',
        window1_end: '12:00',
        window2_start: null,
        window2_end: null,
      };

      const slots = generateNonAvailableSlots(schedule);

      // Should only have slot after 12 PM
      expect(slots).toHaveLength(1);
      expect(slots[0].top).toBe(360); // 6 hours from start
    });

    it('handles window ending at day end', () => {
      const schedule: ScheduleWindow = {
        is_available: true,
        window1_start: '14:00',
        window1_end: '22:00',
        window2_start: null,
        window2_end: null,
      };

      const slots = generateNonAvailableSlots(schedule);

      // Should only have slot before 2 PM
      expect(slots).toHaveLength(1);
      expect(slots[0].top).toBe(0);
      expect(slots[0].height).toBe(480); // 8 hours * 60
    });
  });
});
