import { Injectable, Logger } from '@nestjs/common';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addMinutes, format } from 'date-fns';

/**
 * DateTimeConverterService
 *
 * Handles timezone conversion between local time and UTC with DST support.
 * Uses IANA timezone identifiers (e.g., "America/New_York", "America/Los_Angeles").
 *
 * Sprint 05b: UTC Timezone Conversion
 */
@Injectable()
export class DateTimeConverterService {
  private readonly logger = new Logger(DateTimeConverterService.name);

  /**
   * Convert local date + time to UTC DateTime
   *
   * Handles DST transitions (using date-fns-tz v3 behavior):
   * - Spring forward (2 AM doesn't exist): Treats time as being in the new timezone (EDT)
   * - Fall back (2 AM happens twice): Uses first occurrence (before falling back)
   *
   * @param localDate - Local date in YYYY-MM-DD format
   * @param localTime - Local time in HH:MM format (24-hour)
   * @param timezone - IANA timezone identifier (e.g., "America/New_York")
   * @returns UTC DateTime object
   *
   * @example
   * localToUtc('2024-03-15', '14:30', 'America/New_York')
   * // Returns: 2024-03-15T18:30:00.000Z (during EST, UTC-5)
   *
   * @example
   * localToUtc('2024-07-15', '14:30', 'America/New_York')
   * // Returns: 2024-07-15T18:30:00.000Z (during EDT, UTC-4)
   */
  localToUtc(localDate: string, localTime: string, timezone: string): Date {
    try {
      // Combine date and time into ISO-like format
      const localDateTimeString = `${localDate}T${localTime}:00`;

      this.logger.debug(
        `Converting local time to UTC: ${localDateTimeString} in ${timezone}`,
      );

      // fromZonedTime handles DST transitions automatically (date-fns-tz v3):
      // - Spring forward: non-existent times are treated as being in the new timezone
      // - Fall back: ambiguous times use first occurrence (before falling back)
      const utcDateTime = fromZonedTime(localDateTimeString, timezone);

      this.logger.debug(
        `Converted to UTC: ${utcDateTime.toISOString()} (from ${localDateTimeString} ${timezone})`,
      );

      return utcDateTime;
    } catch (error) {
      this.logger.error(
        `Failed to convert local time to UTC: ${localDate} ${localTime} ${timezone}`,
        error,
      );
      throw new Error(
        `Invalid timezone conversion: ${localDate} ${localTime} in ${timezone}`,
      );
    }
  }

  /**
   * Convert UTC DateTime to local date + time
   *
   * @param utcDateTime - UTC DateTime object
   * @param timezone - IANA timezone identifier
   * @returns Object with local date (YYYY-MM-DD) and time (HH:MM)
   *
   * @example
   * utcToLocal(new Date('2024-03-15T18:30:00Z'), 'America/New_York')
   * // Returns: { localDate: '2024-03-15', localTime: '14:30' } (during EST)
   */
  utcToLocal(
    utcDateTime: Date,
    timezone: string,
  ): { localDate: string; localTime: string } {
    try {
      this.logger.debug(
        `Converting UTC to local time: ${utcDateTime.toISOString()} in ${timezone}`,
      );

      // Convert UTC to zoned time
      const zonedDateTime = toZonedTime(utcDateTime, timezone);

      // Extract date and time components
      const localDate = format(zonedDateTime, 'yyyy-MM-dd');
      const localTime = format(zonedDateTime, 'HH:mm');

      this.logger.debug(
        `Converted to local: ${localDate} ${localTime} (from ${utcDateTime.toISOString()} in ${timezone})`,
      );

      return { localDate, localTime };
    } catch (error) {
      this.logger.error(
        `Failed to convert UTC to local time: ${utcDateTime.toISOString()} ${timezone}`,
        error,
      );
      throw new Error(
        `Invalid timezone conversion: ${utcDateTime.toISOString()} in ${timezone}`,
      );
    }
  }

  /**
   * Calculate end time from start time + duration
   *
   * Handles midnight crossing (e.g., 11:30 PM + 60 minutes = 12:30 AM next day)
   *
   * @param localDate - Local start date in YYYY-MM-DD format
   * @param localTime - Local start time in HH:MM format
   * @param durationMinutes - Duration in minutes
   * @param timezone - IANA timezone identifier
   * @returns Object with end date (YYYY-MM-DD) and time (HH:MM)
   *
   * @example
   * calculateEndTime('2024-03-15', '23:30', 60, 'America/New_York')
   * // Returns: { endDate: '2024-03-16', endTime: '00:30' }
   */
  calculateEndTime(
    localDate: string,
    localTime: string,
    durationMinutes: number,
    timezone: string,
  ): { endDate: string; endTime: string } {
    try {
      this.logger.debug(
        `Calculating end time: ${localDate} ${localTime} + ${durationMinutes} minutes in ${timezone}`,
      );

      // Convert to UTC first
      const startUtc = this.localToUtc(localDate, localTime, timezone);

      // Add duration
      const endUtc = addMinutes(startUtc, durationMinutes);

      // Convert back to local time
      const { localDate: endDate, localTime: endTime } = this.utcToLocal(
        endUtc,
        timezone,
      );

      this.logger.debug(
        `Calculated end time: ${endDate} ${endTime} (from ${localDate} ${localTime} + ${durationMinutes} min)`,
      );

      return { endDate, endTime };
    } catch (error) {
      this.logger.error(
        `Failed to calculate end time: ${localDate} ${localTime} + ${durationMinutes} minutes`,
        error,
      );
      throw new Error(
        `Failed to calculate end time: ${localDate} ${localTime} + ${durationMinutes} minutes`,
      );
    }
  }

  /**
   * Calculate appointment time range in UTC
   *
   * Convenience method that combines:
   * 1. Local time → UTC conversion
   * 2. End time calculation
   *
   * @param scheduledDate - Local date in YYYY-MM-DD format
   * @param startTime - Local start time in HH:MM format
   * @param slotDurationMinutes - Duration in minutes
   * @param timezone - IANA timezone identifier
   * @returns Object with startDatetimeUtc and endDatetimeUtc
   *
   * @example
   * calculateAppointmentUtcRange('2024-03-15', '14:30', 60, 'America/New_York')
   * // Returns: {
   * //   startDatetimeUtc: Date('2024-03-15T19:30:00Z'),
   * //   endDatetimeUtc: Date('2024-03-15T20:30:00Z')
   * // }
   */
  calculateAppointmentUtcRange(
    scheduledDate: string,
    startTime: string,
    slotDurationMinutes: number,
    timezone: string,
  ): { startDatetimeUtc: Date; endDatetimeUtc: Date } {
    this.logger.debug(
      `Calculating appointment UTC range: ${scheduledDate} ${startTime}, duration: ${slotDurationMinutes} min, timezone: ${timezone}`,
    );

    // Convert start time to UTC
    const startDatetimeUtc = this.localToUtc(
      scheduledDate,
      startTime,
      timezone,
    );

    // Calculate end time in UTC (no need to convert back to local)
    const endDatetimeUtc = addMinutes(startDatetimeUtc, slotDurationMinutes);

    this.logger.debug(
      `Appointment UTC range: ${startDatetimeUtc.toISOString()} to ${endDatetimeUtc.toISOString()}`,
    );

    return { startDatetimeUtc, endDatetimeUtc };
  }

  /**
   * Validate IANA timezone identifier
   *
   * @param timezone - Timezone string to validate
   * @returns true if valid, false otherwise
   */
  isValidTimezone(timezone: string): boolean {
    if (!timezone || typeof timezone !== 'string') {
      return false;
    }

    try {
      // Use Intl.DateTimeFormat to validate timezone
      // This is more reliable than date-fns-tz for validation
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}
