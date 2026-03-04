import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { addDays, format, parseISO, differenceInDays } from 'date-fns';
import { DateTimeConverterService } from './datetime-converter.service';

/**
 * SlotCalculationService
 *
 * Core slot calculation algorithm for availability checking.
 * Sprint 07a: Basic slot generation from appointment type schedule
 * Sprint 08: Advanced features (custom hours, external blocks, DST, max_lookahead_weeks)
 *
 * Algorithm:
 * 1. Load appointment type + weekly schedule
 * 2. Validate max_lookahead_weeks constraint
 * 3. Load custom hours (holidays, closures, modified hours)
 * 4. Load external calendar blocks (Google Calendar integration)
 * 5. For each day in date range:
 *    - Check custom hours (closed day or modified hours)
 *    - Generate all possible slot start times (interval = slot_duration_minutes)
 *    - Filter slots that don't fit in window (start + duration > window end)
 *    - Subtract existing appointments (status IN [scheduled, confirmed])
 *    - Subtract external blocks (calendar integrations)
 * 6. Return ordered list of available slots
 */
@Injectable()
export class SlotCalculationService {
  private readonly logger = new Logger(SlotCalculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly datetimeConverter: DateTimeConverterService,
  ) {}

  /**
   * Generate available slots for a date range and appointment type
   *
   * Sprint 07a: Core algorithm (basic slot generation)
   * Sprint 08: Advanced features (custom hours, external blocks, DST, max_lookahead_weeks)
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param appointmentTypeId - Appointment type ID
   * @param dateFrom - Start date (YYYY-MM-DD)
   * @param dateTo - End date (YYYY-MM-DD)
   * @returns Array of available slots grouped by date
   */
  async getAvailableSlots(
    tenantId: string,
    appointmentTypeId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<{
    appointment_type: any;
    timezone: string;
    date_range: { from: string; to: string };
    available_dates: Array<{
      date: string;
      day_name: string;
      slots: Array<{ start_time: string; end_time: string }>;
    }>;
    total_available_slots: number;
  }> {
    this.logger.log(
      `Calculating slots for tenant: ${tenantId}, type: ${appointmentTypeId}, range: ${dateFrom} to ${dateTo}`,
    );

    // Step 1: Load tenant (for timezone)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });

    if (!tenant) {
      throw new BadRequestException(`Tenant ${tenantId} not found`);
    }

    // Step 2: Load appointment type (verify ownership)
    const appointmentType = await this.prisma.appointment_type.findFirst({
      where: {
        id: appointmentTypeId,
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        schedules: {
          orderBy: {
            day_of_week: 'asc',
          },
        },
      },
    });

    if (!appointmentType) {
      throw new BadRequestException(
        `Appointment type ${appointmentTypeId} not found or is not active`,
      );
    }

    // Step 2b: Sprint 08 - Validate max_lookahead_weeks constraint
    const dateFromObj = parseISO(dateFrom);
    const dateToObj = parseISO(dateTo);
    const daysDiff = differenceInDays(dateToObj, dateFromObj) + 1; // +1 to include both dates
    const maxDays = appointmentType.max_lookahead_weeks * 7;

    if (daysDiff > maxDays) {
      throw new BadRequestException(
        `Date range exceeds maximum lookahead of ${appointmentType.max_lookahead_weeks} weeks (${maxDays} days). Requested: ${daysDiff} days.`,
      );
    }

    // Step 3: Load existing appointments in date range (scheduled or confirmed)
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        tenant_id: tenantId,
        appointment_type_id: appointmentTypeId,
        scheduled_date: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: {
          in: ['scheduled', 'confirmed'],
        },
      },
      select: {
        scheduled_date: true,
        start_time: true,
        end_time: true,
      },
    });

    this.logger.debug(
      `Found ${existingAppointments.length} existing appointments in range`,
    );

    // Step 4: Sprint 08 - Load custom hours for date range (holidays, closures, modified hours)
    // Note: tenant_custom_hours.date is DateTime type, so we must use Date objects not strings
    const customHours = await this.prisma.tenant_custom_hours.findMany({
      where: {
        tenant_id: tenantId,
        date: {
          gte: dateFromObj,
          lte: dateToObj,
        },
      },
    });

    this.logger.debug(
      `Found ${customHours.length} custom hours entries in range`,
    );

    // Create a map for quick lookup: date -> custom hours
    const customHoursMap = new Map(
      customHours.map((ch) => [format(ch.date, 'yyyy-MM-dd'), ch]),
    );

    // Step 5: Sprint 08 - Load external calendar blocks (Google Calendar integration)
    // External blocks are stored in UTC, so we need to convert date range to UTC for query
    const dateFromUtc = this.datetimeConverter.localToUtc(
      dateFrom,
      '00:00',
      tenant.timezone,
    );
    const dateToUtc = this.datetimeConverter.localToUtc(
      dateTo,
      '23:59',
      tenant.timezone,
    );

    const externalBlocks = await this.prisma.calendar_external_block.findMany({
      where: {
        tenant_id: tenantId,
        // Block overlaps with date range if: block_start <= dateTo AND block_end >= dateFrom
        start_datetime_utc: {
          lte: dateToUtc,
        },
        end_datetime_utc: {
          gte: dateFromUtc,
        },
      },
      select: {
        start_datetime_utc: true,
        end_datetime_utc: true,
        is_all_day: true,
      },
    });

    this.logger.debug(
      `Found ${externalBlocks.length} external calendar blocks in range`,
    );

    // Step 6: Generate slots for each day in the range
    const availableDates: Array<{
      date: string;
      day_name: string;
      slots: Array<{ start_time: string; end_time: string }>;
    }> = [];

    let currentDate = dateFromObj;
    let totalSlots = 0;

    while (currentDate <= dateToObj) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      this.logger.debug(`Processing date: ${dateStr} (day ${dayOfWeek})`);

      // Sprint 08: Check if this date has custom hours (holidays, closures, modified hours)
      const customHour = customHoursMap.get(dateStr);

      if (customHour && customHour.closed) {
        // Entire day is closed (holiday, special closure)
        this.logger.debug(
          `Date ${dateStr} is closed (reason: ${customHour.reason}), skipping`,
        );
        currentDate = addDays(currentDate, 1);
        continue;
      }

      // Determine schedule to use: custom hours override regular schedule
      let schedule;
      if (customHour) {
        // Use custom hours instead of regular schedule
        this.logger.debug(
          `Using custom hours for ${dateStr} (reason: ${customHour.reason})`,
        );
        schedule = {
          is_available: true,
          window1_start: customHour.open_time1,
          window1_end: customHour.close_time1,
          window2_start: customHour.open_time2,
          window2_end: customHour.close_time2,
        };
      } else {
        // Use regular schedule for this day of week
        schedule = appointmentType.schedules.find(
          (s) => s.day_of_week === dayOfWeek,
        );
      }

      if (schedule && schedule.is_available) {
        this.logger.debug(`Day ${dayOfWeek} is available, generating slots`);

        // Generate slots for this day (includes external block filtering)
        const slots = this.generateSlotsForDay(
          dateStr,
          schedule,
          appointmentType.slot_duration_minutes,
          existingAppointments,
          externalBlocks,
          tenant.timezone,
        );

        if (slots.length > 0) {
          availableDates.push({
            date: dateStr,
            day_name: this.getDayName(dayOfWeek),
            slots,
          });
          totalSlots += slots.length;
        }
      } else {
        this.logger.debug(`Day ${dayOfWeek} is not available, skipping`);
      }

      // Move to next day
      currentDate = addDays(currentDate, 1);
    }

    this.logger.log(
      `Generated ${totalSlots} total available slots across ${availableDates.length} dates`,
    );

    return {
      appointment_type: {
        id: appointmentType.id,
        name: appointmentType.name,
        slot_duration_minutes: appointmentType.slot_duration_minutes,
      },
      timezone: tenant.timezone,
      date_range: {
        from: dateFrom,
        to: dateTo,
      },
      available_dates: availableDates,
      total_available_slots: totalSlots,
    };
  }

  /**
   * Generate slots for a single day
   *
   * Handles:
   * - Regular slots (slot_duration_minutes > 0)
   * - All Day slots (slot_duration_minutes = 0)
   * - Dual time windows (window1 and window2)
   * - Slot must fit within window (start + duration <= window end)
   * - Subtract existing appointments (overlaps)
   * - Sprint 08: Subtract external calendar blocks
   *
   * @param date - Date string (YYYY-MM-DD)
   * @param schedule - Day schedule with windows
   * @param slotDurationMinutes - Slot duration (0 = All Day)
   * @param existingAppointments - Existing appointments to subtract
   * @param externalBlocks - External calendar blocks to subtract (Sprint 08)
   * @param timezone - Tenant timezone for UTC conversion (Sprint 08)
   * @returns Array of available slots
   */
  private generateSlotsForDay(
    date: string,
    schedule: any,
    slotDurationMinutes: number,
    existingAppointments: any[],
    externalBlocks: any[],
    timezone: string,
  ): Array<{ start_time: string; end_time: string }> {
    const slots: Array<{ start_time: string; end_time: string }> = [];

    // All Day slot handling (slot_duration_minutes = 0)
    if (slotDurationMinutes === 0) {
      return this.generateAllDaySlot(
        date,
        schedule,
        existingAppointments,
        externalBlocks,
        timezone,
      );
    }

    // Regular slots: Process window1
    if (schedule.window1_start && schedule.window1_end) {
      const window1Slots = this.generateSlotsForWindow(
        date,
        schedule.window1_start,
        schedule.window1_end,
        slotDurationMinutes,
        existingAppointments,
        externalBlocks,
        timezone,
      );
      slots.push(...window1Slots);
    }

    // Regular slots: Process window2 (if exists)
    if (schedule.window2_start && schedule.window2_end) {
      const window2Slots = this.generateSlotsForWindow(
        date,
        schedule.window2_start,
        schedule.window2_end,
        slotDurationMinutes,
        existingAppointments,
        externalBlocks,
        timezone,
      );
      slots.push(...window2Slots);
    }

    return slots;
  }

  /**
   * Generate All Day slot (slot_duration_minutes = 0)
   *
   * Returns one slot for the entire day if:
   * - No existing all-day appointments
   * - No existing appointments that would conflict with an all-day booking
   * - Sprint 08: No external blocks on this date
   *
   * @param date - Date string (YYYY-MM-DD)
   * @param schedule - Day schedule
   * @param existingAppointments - Existing appointments
   * @param externalBlocks - External calendar blocks (Sprint 08)
   * @param timezone - Tenant timezone (Sprint 08)
   * @returns Array with one All Day slot or empty array
   */
  private generateAllDaySlot(
    date: string,
    schedule: any,
    existingAppointments: any[],
    externalBlocks: any[],
    timezone: string,
  ): Array<{ start_time: string; end_time: string }> {
    // Check if there are any existing appointments on this date
    const appointmentsOnDate = existingAppointments.filter(
      (apt) => apt.scheduled_date === date,
    );

    if (appointmentsOnDate.length > 0) {
      this.logger.debug(
        `All Day slot blocked: ${appointmentsOnDate.length} existing appointments on ${date}`,
      );
      return []; // Any existing appointment blocks the All Day slot
    }

    // Sprint 08: Check if there are any external blocks on this date
    const hasExternalBlock = externalBlocks.some((block) => {
      // Convert block times to local date
      const blockStartLocal = this.datetimeConverter.utcToLocal(
        block.start_datetime_utc,
        timezone,
      );
      const blockEndLocal = this.datetimeConverter.utcToLocal(
        block.end_datetime_utc,
        timezone,
      );

      // Check if block overlaps with this date
      return blockStartLocal.localDate === date || blockEndLocal.localDate === date;
    });

    if (hasExternalBlock) {
      this.logger.debug(
        `All Day slot blocked: external calendar blocks on ${date}`,
      );
      return []; // Any external block blocks the All Day slot
    }

    // Return one All Day slot
    // Use the first window's start/end as placeholders for display
    // (In practice, an All Day appointment consumes the entire availability)
    const startTime = schedule.window1_start || '08:00';
    const endTime = schedule.window1_end || '17:00';

    this.logger.debug(`All Day slot available on ${date}`);
    return [{ start_time: startTime, end_time: endTime }];
  }

  /**
   * Generate slots for a single time window
   *
   * Algorithm:
   * 1. Start at window_start
   * 2. Generate slot if (start + duration) <= window_end
   * 3. Increment start by slot_duration_minutes
   * 4. Repeat until no more slots fit
   * 5. Filter out slots that overlap with existing appointments
   * 6. Sprint 08: Filter out slots that overlap with external calendar blocks
   *
   * @param date - Date string (YYYY-MM-DD)
   * @param windowStart - Window start time (HH:MM)
   * @param windowEnd - Window end time (HH:MM)
   * @param slotDurationMinutes - Slot duration
   * @param existingAppointments - Existing appointments
   * @param externalBlocks - External calendar blocks (Sprint 08)
   * @param timezone - Tenant timezone for UTC conversion (Sprint 08)
   * @returns Array of available slots
   */
  private generateSlotsForWindow(
    date: string,
    windowStart: string,
    windowEnd: string,
    slotDurationMinutes: number,
    existingAppointments: any[],
    externalBlocks: any[],
    timezone: string,
  ): Array<{ start_time: string; end_time: string }> {
    const slots: Array<{ start_time: string; end_time: string }> = [];

    // Convert times to minutes since midnight for easier math
    const windowStartMinutes = this.timeToMinutes(windowStart);
    const windowEndMinutes = this.timeToMinutes(windowEnd);

    let currentStartMinutes = windowStartMinutes;

    // Generate all possible slots that fit in the window
    while (currentStartMinutes + slotDurationMinutes <= windowEndMinutes) {
      const slotStartTime = this.minutesToTime(currentStartMinutes);
      const slotEndTime = this.minutesToTime(
        currentStartMinutes + slotDurationMinutes,
      );

      // Check if this slot overlaps with any existing appointment
      const overlapsAppointment = this.slotOverlapsWithAppointments(
        date,
        slotStartTime,
        slotEndTime,
        existingAppointments,
      );

      if (overlapsAppointment) {
        this.logger.debug(
          `Slot ${date} ${slotStartTime}-${slotEndTime} overlaps with existing appointment, skipped`,
        );
        currentStartMinutes += slotDurationMinutes;
        continue;
      }

      // Sprint 08: Check if this slot overlaps with any external calendar block
      const overlapsExternalBlock = this.slotOverlapsWithExternalBlocks(
        date,
        slotStartTime,
        slotEndTime,
        externalBlocks,
        timezone,
      );

      if (overlapsExternalBlock) {
        this.logger.debug(
          `Slot ${date} ${slotStartTime}-${slotEndTime} overlaps with external calendar block, skipped`,
        );
        currentStartMinutes += slotDurationMinutes;
        continue;
      }

      // Slot is available
      slots.push({
        start_time: slotStartTime,
        end_time: slotEndTime,
      });

      // Move to next slot
      currentStartMinutes += slotDurationMinutes;
    }

    this.logger.debug(
      `Generated ${slots.length} slots for window ${windowStart}-${windowEnd} on ${date}`,
    );

    return slots;
  }

  /**
   * Check if a slot overlaps with any existing appointments
   *
   * Overlap detection:
   * - Slot: [slotStart, slotEnd)
   * - Appointment: [aptStart, aptEnd)
   * - Overlap if: slotStart < aptEnd AND slotEnd > aptStart
   *
   * @param date - Date string (YYYY-MM-DD)
   * @param slotStart - Slot start time (HH:MM)
   * @param slotEnd - Slot end time (HH:MM)
   * @param existingAppointments - Existing appointments
   * @returns true if overlap, false otherwise
   */
  private slotOverlapsWithAppointments(
    date: string,
    slotStart: string,
    slotEnd: string,
    existingAppointments: any[],
  ): boolean {
    const slotStartMinutes = this.timeToMinutes(slotStart);
    const slotEndMinutes = this.timeToMinutes(slotEnd);

    for (const apt of existingAppointments) {
      if (apt.scheduled_date !== date) {
        continue; // Different date, no overlap
      }

      const aptStartMinutes = this.timeToMinutes(apt.start_time);
      const aptEndMinutes = this.timeToMinutes(apt.end_time);

      // Overlap check: slot overlaps if it starts before appointment ends AND ends after appointment starts
      if (slotStartMinutes < aptEndMinutes && slotEndMinutes > aptStartMinutes) {
        return true; // Overlap detected
      }
    }

    return false; // No overlap
  }

  /**
   * Sprint 08: Check if a slot overlaps with any external calendar blocks
   *
   * External blocks are stored in UTC, so we must convert the local slot time to UTC first.
   *
   * Overlap detection:
   * - Slot (in UTC): [slotStartUtc, slotEndUtc)
   * - External Block (in UTC): [blockStart, blockEnd)
   * - Overlap if: slotStartUtc < blockEnd AND slotEndUtc > blockStart
   *
   * @param date - Date string (YYYY-MM-DD) in local timezone
   * @param slotStart - Slot start time (HH:MM) in local timezone
   * @param slotEnd - Slot end time (HH:MM) in local timezone
   * @param externalBlocks - External calendar blocks (stored in UTC)
   * @param timezone - Tenant timezone for conversion
   * @returns true if overlap, false otherwise
   */
  private slotOverlapsWithExternalBlocks(
    date: string,
    slotStart: string,
    slotEnd: string,
    externalBlocks: any[],
    timezone: string,
  ): boolean {
    if (externalBlocks.length === 0) {
      return false; // No external blocks to check
    }

    // Convert slot start and end times to UTC
    const slotStartUtc = this.datetimeConverter.localToUtc(
      date,
      slotStart,
      timezone,
    );
    const slotEndUtc = this.datetimeConverter.localToUtc(date, slotEnd, timezone);

    for (const block of externalBlocks) {
      const blockStartUtc = block.start_datetime_utc;
      const blockEndUtc = block.end_datetime_utc;

      // Overlap check: slot overlaps if it starts before block ends AND ends after block starts
      if (slotStartUtc < blockEndUtc && slotEndUtc > blockStartUtc) {
        this.logger.debug(
          `Overlap detected: Slot ${date} ${slotStart}-${slotEnd} (UTC: ${slotStartUtc.toISOString()}-${slotEndUtc.toISOString()}) ` +
            `overlaps with external block (UTC: ${blockStartUtc.toISOString()}-${blockEndUtc.toISOString()})`,
        );
        return true; // Overlap detected
      }
    }

    return false; // No overlap
  }

  /**
   * Convert HH:MM time string to minutes since midnight
   * @param time - Time string in HH:MM format
   * @returns Minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to HH:MM time string
   * @param minutes - Minutes since midnight
   * @returns Time string in HH:MM format
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Get day name from day of week number
   * @param dayOfWeek - Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
   * @returns Day name
   */
  private getDayName(dayOfWeek: number): string {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return days[dayOfWeek];
  }
}
