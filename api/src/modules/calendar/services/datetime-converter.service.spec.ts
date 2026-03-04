import { Test, TestingModule } from '@nestjs/testing';
import { DateTimeConverterService } from './datetime-converter.service';

describe('DateTimeConverterService', () => {
  let service: DateTimeConverterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DateTimeConverterService],
    }).compile();

    service = module.get<DateTimeConverterService>(DateTimeConverterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('localToUtc', () => {
    it('should convert EST to UTC (winter time, UTC-5)', () => {
      // January 15, 2024 14:30 EST → 19:30 UTC
      const result = service.localToUtc(
        '2024-01-15',
        '14:30',
        'America/New_York',
      );

      expect(result.toISOString()).toBe('2024-01-15T19:30:00.000Z');
    });

    it('should convert EDT to UTC (summer time, UTC-4)', () => {
      // July 15, 2024 14:30 EDT → 18:30 UTC
      const result = service.localToUtc(
        '2024-07-15',
        '14:30',
        'America/New_York',
      );

      expect(result.toISOString()).toBe('2024-07-15T18:30:00.000Z');
    });

    it('should convert PST to UTC (winter time, UTC-8)', () => {
      // January 15, 2024 10:00 PST → 18:00 UTC
      const result = service.localToUtc(
        '2024-01-15',
        '10:00',
        'America/Los_Angeles',
      );

      expect(result.toISOString()).toBe('2024-01-15T18:00:00.000Z');
    });

    it('should convert PDT to UTC (summer time, UTC-7)', () => {
      // July 15, 2024 10:00 PDT → 17:00 UTC
      const result = service.localToUtc(
        '2024-07-15',
        '10:00',
        'America/Los_Angeles',
      );

      expect(result.toISOString()).toBe('2024-07-15T17:00:00.000Z');
    });

    /**
     * DST Edge Case: Spring Forward (2 AM doesn't exist)
     *
     * On March 10, 2024 at 2:00 AM EST, clocks spring forward to 3:00 AM EDT.
     * The hour from 2:00 AM to 3:00 AM doesn't exist.
     * date-fns-tz v3 treats non-existent times as already being in the new timezone (EDT).
     */
    it('should handle DST spring forward (2 AM does not exist)', () => {
      // March 10, 2024 at 2:30 AM doesn't exist (springs forward at 2:00 AM)
      // date-fns-tz v3 treats this as 2:30 AM EDT (after spring forward)
      // 2:30 AM EDT (UTC-4) = 6:30 AM UTC
      const result = service.localToUtc(
        '2024-03-10',
        '02:30',
        'America/New_York',
      );

      // Treated as 2:30 AM EDT (UTC-4) = 6:30 UTC
      expect(result.toISOString()).toBe('2024-03-10T06:30:00.000Z');
    });

    /**
     * DST Edge Case: Fall Back (2 AM happens twice)
     *
     * On November 3, 2024 at 2:00 AM, clocks fall back to 1:00 AM.
     * The hour from 1:00 AM to 2:00 AM happens twice.
     * date-fns-tz uses the first occurrence (before falling back).
     */
    it('should handle DST fall back (2 AM happens twice, use first occurrence)', () => {
      // November 3, 2024 at 1:30 AM happens twice
      // First occurrence: 1:30 AM EDT (UTC-4) = 5:30 AM UTC
      const result = service.localToUtc(
        '2024-11-03',
        '01:30',
        'America/New_York',
      );

      // Uses first occurrence: 1:30 AM EDT (UTC-4) = 5:30 UTC
      expect(result.toISOString()).toBe('2024-11-03T05:30:00.000Z');
    });

    it('should handle midnight (00:00)', () => {
      // January 15, 2024 00:00 EST → 05:00 UTC
      const result = service.localToUtc(
        '2024-01-15',
        '00:00',
        'America/New_York',
      );

      expect(result.toISOString()).toBe('2024-01-15T05:00:00.000Z');
    });

    it('should handle 23:59', () => {
      // January 15, 2024 23:59 EST → January 16 04:59 UTC
      const result = service.localToUtc(
        '2024-01-15',
        '23:59',
        'America/New_York',
      );

      expect(result.toISOString()).toBe('2024-01-16T04:59:00.000Z');
    });
  });

  describe('utcToLocal', () => {
    it('should convert UTC to EST (winter time)', () => {
      // 2024-01-15T19:30:00Z → 2024-01-15 14:30 EST
      const utcDate = new Date('2024-01-15T19:30:00Z');
      const result = service.utcToLocal(utcDate, 'America/New_York');

      expect(result.localDate).toBe('2024-01-15');
      expect(result.localTime).toBe('14:30');
    });

    it('should convert UTC to EDT (summer time)', () => {
      // 2024-07-15T18:30:00Z → 2024-07-15 14:30 EDT
      const utcDate = new Date('2024-07-15T18:30:00Z');
      const result = service.utcToLocal(utcDate, 'America/New_York');

      expect(result.localDate).toBe('2024-07-15');
      expect(result.localTime).toBe('14:30');
    });

    it('should convert UTC to PST (winter time)', () => {
      // 2024-01-15T18:00:00Z → 2024-01-15 10:00 PST
      const utcDate = new Date('2024-01-15T18:00:00Z');
      const result = service.utcToLocal(utcDate, 'America/Los_Angeles');

      expect(result.localDate).toBe('2024-01-15');
      expect(result.localTime).toBe('10:00');
    });

    it('should handle date change when converting UTC to local', () => {
      // 2024-01-15T02:00:00Z → 2024-01-14 21:00 EST (previous day)
      const utcDate = new Date('2024-01-15T02:00:00Z');
      const result = service.utcToLocal(utcDate, 'America/New_York');

      expect(result.localDate).toBe('2024-01-14');
      expect(result.localTime).toBe('21:00');
    });
  });

  describe('calculateEndTime', () => {
    it('should calculate end time within same day', () => {
      // 2024-01-15 14:30 + 60 minutes = 15:30 (same day)
      const result = service.calculateEndTime(
        '2024-01-15',
        '14:30',
        60,
        'America/New_York',
      );

      expect(result.endDate).toBe('2024-01-15');
      expect(result.endTime).toBe('15:30');
    });

    it('should handle midnight crossing (11:30 PM + 60 min = 12:30 AM next day)', () => {
      // 2024-01-15 23:30 + 60 minutes = 2024-01-16 00:30
      const result = service.calculateEndTime(
        '2024-01-15',
        '23:30',
        60,
        'America/New_York',
      );

      expect(result.endDate).toBe('2024-01-16');
      expect(result.endTime).toBe('00:30');
    });

    it('should handle 30-minute appointments', () => {
      // 2024-01-15 14:00 + 30 minutes = 14:30
      const result = service.calculateEndTime(
        '2024-01-15',
        '14:00',
        30,
        'America/New_York',
      );

      expect(result.endDate).toBe('2024-01-15');
      expect(result.endTime).toBe('14:30');
    });

    it('should handle 90-minute appointments', () => {
      // 2024-01-15 14:00 + 90 minutes = 15:30
      const result = service.calculateEndTime(
        '2024-01-15',
        '14:00',
        90,
        'America/New_York',
      );

      expect(result.endDate).toBe('2024-01-15');
      expect(result.endTime).toBe('15:30');
    });

    /**
     * DST Edge Case: Appointment spanning DST transition (spring forward)
     *
     * On March 10, 2024 at 2:00 AM EST, clocks spring forward to 3:00 AM EDT.
     * An appointment starting at 1:30 AM EST + 60 minutes in UTC = 2:30 AM EST
     * But since we're working in UTC and converting back, we get the actual time.
     */
    it('should handle appointments spanning DST spring forward', () => {
      // March 10, 2024 01:30 EST + 60 minutes in UTC
      // 01:30 EST (UTC-5) = 06:30 UTC
      // 06:30 UTC + 60 min = 07:30 UTC
      // 07:30 UTC = 03:30 EDT (UTC-4) - after spring forward
      const result = service.calculateEndTime(
        '2024-03-10',
        '01:30',
        60,
        'America/New_York',
      );

      expect(result.endDate).toBe('2024-03-10');
      expect(result.endTime).toBe('03:30');
    });

    /**
     * DST Edge Case: Appointment spanning DST transition (fall back)
     *
     * On November 3, 2024 at 2:00 AM, clocks fall back to 1:00 AM.
     * An appointment starting at 00:30 AM + 120 minutes should end at 02:30 AM
     * (the first occurrence of 02:30 after falling back).
     */
    it('should handle appointments spanning DST fall back', () => {
      // November 3, 2024 00:30 + 120 minutes
      // Spans the fall back at 2 AM → 1 AM
      const result = service.calculateEndTime(
        '2024-11-03',
        '00:30',
        120,
        'America/New_York',
      );

      expect(result.endDate).toBe('2024-11-03');
      expect(result.endTime).toBe('01:30');
    });
  });

  describe('calculateAppointmentUtcRange', () => {
    it('should calculate UTC range for EST appointment', () => {
      // 2024-01-15 14:30 EST, 60 minutes
      // Start: 19:30 UTC, End: 20:30 UTC
      const result = service.calculateAppointmentUtcRange(
        '2024-01-15',
        '14:30',
        60,
        'America/New_York',
      );

      expect(result.startDatetimeUtc.toISOString()).toBe(
        '2024-01-15T19:30:00.000Z',
      );
      expect(result.endDatetimeUtc.toISOString()).toBe(
        '2024-01-15T20:30:00.000Z',
      );
    });

    it('should calculate UTC range for EDT appointment', () => {
      // 2024-07-15 14:30 EDT, 60 minutes
      // Start: 18:30 UTC, End: 19:30 UTC
      const result = service.calculateAppointmentUtcRange(
        '2024-07-15',
        '14:30',
        60,
        'America/New_York',
      );

      expect(result.startDatetimeUtc.toISOString()).toBe(
        '2024-07-15T18:30:00.000Z',
      );
      expect(result.endDatetimeUtc.toISOString()).toBe(
        '2024-07-15T19:30:00.000Z',
      );
    });

    it('should calculate UTC range spanning midnight', () => {
      // 2024-01-15 23:30 EST, 60 minutes
      // Start: 2024-01-16 04:30 UTC, End: 2024-01-16 05:30 UTC
      const result = service.calculateAppointmentUtcRange(
        '2024-01-15',
        '23:30',
        60,
        'America/New_York',
      );

      expect(result.startDatetimeUtc.toISOString()).toBe(
        '2024-01-16T04:30:00.000Z',
      );
      expect(result.endDatetimeUtc.toISOString()).toBe(
        '2024-01-16T05:30:00.000Z',
      );
    });

    it('should handle 30-minute slot', () => {
      const result = service.calculateAppointmentUtcRange(
        '2024-01-15',
        '14:00',
        30,
        'America/New_York',
      );

      expect(result.startDatetimeUtc.toISOString()).toBe(
        '2024-01-15T19:00:00.000Z',
      );
      expect(result.endDatetimeUtc.toISOString()).toBe(
        '2024-01-15T19:30:00.000Z',
      );
    });

    it('should handle DST spring forward in UTC range', () => {
      // March 10, 2024 01:30 EST + 60 minutes
      // Crosses DST boundary at 2 AM → 3 AM
      const result = service.calculateAppointmentUtcRange(
        '2024-03-10',
        '01:30',
        60,
        'America/New_York',
      );

      // Start: 01:30 EST (UTC-5) = 06:30 UTC
      expect(result.startDatetimeUtc.toISOString()).toBe(
        '2024-03-10T06:30:00.000Z',
      );
      // End: 06:30 UTC + 60 min = 07:30 UTC
      expect(result.endDatetimeUtc.toISOString()).toBe(
        '2024-03-10T07:30:00.000Z',
      );
    });
  });

  describe('isValidTimezone', () => {
    it('should validate common US timezones', () => {
      expect(service.isValidTimezone('America/New_York')).toBe(true);
      expect(service.isValidTimezone('America/Chicago')).toBe(true);
      expect(service.isValidTimezone('America/Denver')).toBe(true);
      expect(service.isValidTimezone('America/Los_Angeles')).toBe(true);
    });

    it('should validate international timezones', () => {
      expect(service.isValidTimezone('Europe/London')).toBe(true);
      expect(service.isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(service.isValidTimezone('Australia/Sydney')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(service.isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(service.isValidTimezone('Not_A_Real_Timezone')).toBe(false);
      expect(service.isValidTimezone('')).toBe(false);
      expect(service.isValidTimezone(null as any)).toBe(false);
      expect(service.isValidTimezone(undefined as any)).toBe(false);
    });
  });
});
