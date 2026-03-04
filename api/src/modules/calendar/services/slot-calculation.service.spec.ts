import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SlotCalculationService } from './slot-calculation.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { DateTimeConverterService } from './datetime-converter.service';

describe('SlotCalculationService', () => {
  let service: SlotCalculationService;
  let prisma: PrismaService;
  let datetimeConverter: DateTimeConverterService;

  const mockPrisma = {
    tenant: {
      findUnique: jest.fn(),
    },
    appointment_type: {
      findFirst: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
    },
    tenant_custom_hours: {
      findMany: jest.fn(),
    },
    calendar_external_block: {
      findMany: jest.fn(),
    },
  };

  const mockDateTimeConverter = {
    localToUtc: jest.fn(),
    utcToLocal: jest.fn(),
    calculateAppointmentUtcRange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlotCalculationService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: DateTimeConverterService,
          useValue: mockDateTimeConverter,
        },
      ],
    }).compile();

    service = module.get<SlotCalculationService>(SlotCalculationService);
    prisma = module.get<PrismaService>(PrismaService);
    datetimeConverter = module.get<DateTimeConverterService>(
      DateTimeConverterService,
    );

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Default tenant mock (can be overridden in specific tests)
    mockPrisma.tenant.findUnique.mockResolvedValue({
      timezone: 'America/New_York',
    });

    // Sprint 08: Default mocks for new queries (empty arrays = no custom hours or external blocks)
    mockPrisma.tenant_custom_hours.findMany.mockResolvedValue([]);
    mockPrisma.calendar_external_block.findMany.mockResolvedValue([]);

    // Sprint 08: Default mock for DateTimeConverterService
    // Mock localToUtc to return a predictable UTC date
    mockDateTimeConverter.localToUtc.mockImplementation(
      (date: string, time: string, timezone: string) => {
        // Simple mock: parse date and time, return as UTC
        const [year, month, day] = date.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);
        return new Date(Date.UTC(year, month - 1, day, hour, minute));
      },
    );

    // Mock utcToLocal to return the same date/time (for simplicity in tests)
    mockDateTimeConverter.utcToLocal.mockImplementation(
      (utcDate: Date, timezone: string) => {
        const year = utcDate.getUTCFullYear();
        const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(utcDate.getUTCDate()).padStart(2, '0');
        const hour = String(utcDate.getUTCHours()).padStart(2, '0');
        const minute = String(utcDate.getUTCMinutes()).padStart(2, '0');
        return {
          localDate: `${year}-${month}-${day}`,
          localTime: `${hour}:${minute}`,
        };
      },
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAvailableSlots', () => {
    const tenantId = 'tenant-123';
    const appointmentTypeId = 'apt-type-123';

    const mockTenant = {
      timezone: 'America/New_York',
    };

    beforeEach(() => {
      // Mock tenant for all tests
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
    });

    describe('Basic slot generation', () => {
      it('should generate 8 slots for 60-minute appointments in an 8-hour window (09:00-17:00)', async () => {
        // Mock tenant
        mockPrisma.tenant.findUnique.mockResolvedValue({
          timezone: 'America/New_York',
        });

        // Appointment type: 60-minute slots
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]); // No existing appointments

        // Test on Monday, March 3, 2025
        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03', // Monday
          '2025-03-03',
        );

        expect(result.total_available_slots).toBe(8);
        expect(result.available_dates).toHaveLength(1);
        expect(result.available_dates[0].slots).toEqual([
          { start_time: '09:00', end_time: '10:00' },
          { start_time: '10:00', end_time: '11:00' },
          { start_time: '11:00', end_time: '12:00' },
          { start_time: '12:00', end_time: '13:00' },
          { start_time: '13:00', end_time: '14:00' },
          { start_time: '14:00', end_time: '15:00' },
          { start_time: '15:00', end_time: '16:00' },
          { start_time: '16:00', end_time: '17:00' },
        ]);
      });

      it('should generate slots for multiple days in a range', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          schedules: [
            {
              day_of_week: 0, // Sunday - NOT available
              is_available: false,
              window1_start: null,
              window1_end: null,
              window2_start: null,
              window2_end: null,
            },
            {
              day_of_week: 1, // Monday - Available
              is_available: true,
              window1_start: '09:00',
              window1_end: '12:00',
              window2_start: null,
              window2_end: null,
            },
            {
              day_of_week: 2, // Tuesday - NOT available
              is_available: false,
              window1_start: null,
              window1_end: null,
              window2_start: null,
              window2_end: null,
            },
            {
              day_of_week: 3, // Wednesday - Available
              is_available: true,
              window1_start: '14:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        // March 3-5, 2025 (Monday-Wednesday)
        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03', // Monday
          '2025-03-05', // Wednesday
        );

        // Monday: 3 slots (09:00, 10:00, 11:00)
        // Tuesday: 0 slots (not available)
        // Wednesday: 3 slots (14:00, 15:00, 16:00)
        expect(result.total_available_slots).toBe(6);
        expect(result.available_dates).toHaveLength(2);
        expect(result.available_dates[0].date).toBe('2025-03-03');
        expect(result.available_dates[0].day_name).toBe('Monday');
        expect(result.available_dates[0].slots).toHaveLength(3);
        expect(result.available_dates[1].date).toBe('2025-03-05');
        expect(result.available_dates[1].day_name).toBe('Wednesday');
        expect(result.available_dates[1].slots).toHaveLength(3);
      });

      it('should handle dual time windows (split shift / lunch break)', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          schedules: [
            {
              day_of_week: 4, // Thursday
              is_available: true,
              window1_start: '08:00',
              window1_end: '12:00', // Morning: 4 slots
              window2_start: '13:00',
              window2_end: '17:00', // Afternoon: 4 slots
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        // March 6, 2025 (Thursday)
        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-06',
          '2025-03-06',
        );

        // Morning: 08:00, 09:00, 10:00, 11:00 (4 slots)
        // Afternoon: 13:00, 14:00, 15:00, 16:00 (4 slots)
        expect(result.total_available_slots).toBe(8);
        expect(result.available_dates[0].slots).toEqual([
          { start_time: '08:00', end_time: '09:00' },
          { start_time: '09:00', end_time: '10:00' },
          { start_time: '10:00', end_time: '11:00' },
          { start_time: '11:00', end_time: '12:00' },
          { start_time: '13:00', end_time: '14:00' },
          { start_time: '14:00', end_time: '15:00' },
          { start_time: '15:00', end_time: '16:00' },
          { start_time: '16:00', end_time: '17:00' },
        ]);
      });
    });

    describe('Slot must fit within window', () => {
      it('should reject 4:30 PM (16:30) slot for 60-min appointment in window ending at 5 PM (17:00) - EXACT REQUIREMENT', async () => {
        // Sprint requirement: "Slot must fit: 4:30 PM slot for 60-min appointment in window ending 5 PM = rejected"
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '08:00',
              window1_end: '17:00', // 5 PM
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        // 60-minute slots in window 08:00-17:00:
        // 08:00-09:00 ✓
        // 09:00-10:00 ✓
        // ... (slots continue)
        // 16:00-17:00 ✓ (last slot that fits)
        // 16:30-17:30 ✗ (4:30 PM slot would end at 5:30 PM, beyond window end of 5 PM - REJECTED)

        // Verify that NO slot starts at 16:30
        const has16_30Slot = result.available_dates[0].slots.some(
          (slot) => slot.start_time === '16:30',
        );
        expect(has16_30Slot).toBe(false);

        // Last valid slot should be 16:00-17:00
        const lastSlot =
          result.available_dates[0].slots[
            result.available_dates[0].slots.length - 1
          ];
        expect(lastSlot.start_time).toBe('16:00');
        expect(lastSlot.end_time).toBe('17:00');
      });

      it('should NOT generate 16:30 slot for 90-min appointment in window ending at 17:00', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 90, // 90-minute slots
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00', // 8-hour window
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        // With 90-minute slots:
        // 09:00-10:30 ✓
        // 10:30-12:00 ✓
        // 12:00-13:30 ✓
        // 13:30-15:00 ✓
        // 15:00-16:30 ✓
        // 16:30-18:00 ✗ (ends after 17:00, doesn't fit)

        expect(result.total_available_slots).toBe(5);
        const lastSlot =
          result.available_dates[0].slots[
            result.available_dates[0].slots.length - 1
          ];
        expect(lastSlot.start_time).toBe('15:00');
        expect(lastSlot.end_time).toBe('16:30');
      });

      it('should handle 30-minute slots correctly', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quick Estimate',
          slot_duration_minutes: 30,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '14:00',
              window1_end: '16:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        // 30-minute slots in 2-hour window = 4 slots
        // 14:00-14:30, 14:30-15:00, 15:00-15:30, 15:30-16:00
        expect(result.total_available_slots).toBe(4);
        expect(result.available_dates[0].slots).toEqual([
          { start_time: '14:00', end_time: '14:30' },
          { start_time: '14:30', end_time: '15:00' },
          { start_time: '15:00', end_time: '15:30' },
          { start_time: '15:30', end_time: '16:00' },
        ]);
      });
    });

    describe('Existing appointments subtraction', () => {
      it('should subtract 09:00 slot when there is an existing appointment at 09:00', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '13:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        // Existing appointment at 09:00-10:00
        const existingAppointments = [
          {
            scheduled_date: '2025-03-03',
            start_time: '09:00',
            end_time: '10:00',
          },
        ];

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue(
          existingAppointments,
        );

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        // Window: 09:00-13:00 = 4 possible slots
        // Existing: 09:00-10:00
        // Available: 10:00, 11:00, 12:00 = 3 slots
        expect(result.total_available_slots).toBe(3);
        expect(result.available_dates[0].slots).toEqual([
          { start_time: '10:00', end_time: '11:00' },
          { start_time: '11:00', end_time: '12:00' },
          { start_time: '12:00', end_time: '13:00' },
        ]);
      });

      it('should handle overlapping appointments correctly (partial overlap)', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        // Existing appointment: 09:30-11:30 (overlaps with 09:00, 10:00, 11:00 slots)
        const existingAppointments = [
          {
            scheduled_date: '2025-03-03',
            start_time: '09:30',
            end_time: '11:30',
          },
        ];

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue(
          existingAppointments,
        );

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        // Slots that DON'T overlap with 09:30-11:30:
        // 09:00-10:00 ✗ (overlaps: 09:00 < 11:30 AND 10:00 > 09:30)
        // 10:00-11:00 ✗ (overlaps)
        // 11:00-12:00 ✗ (overlaps: 11:00 < 11:30 AND 12:00 > 09:30)
        // 12:00-13:00 ✓
        // 13:00-14:00 ✓
        // 14:00-15:00 ✓
        // 15:00-16:00 ✓
        // 16:00-17:00 ✓

        expect(result.total_available_slots).toBe(5);
        expect(result.available_dates[0].slots[0].start_time).toBe('12:00');
      });

      it('should handle multiple existing appointments on the same day', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        // Existing appointments: 09:00-10:00, 13:00-14:00, 15:00-16:00
        const existingAppointments = [
          {
            scheduled_date: '2025-03-03',
            start_time: '09:00',
            end_time: '10:00',
          },
          {
            scheduled_date: '2025-03-03',
            start_time: '13:00',
            end_time: '14:00',
          },
          {
            scheduled_date: '2025-03-03',
            start_time: '15:00',
            end_time: '16:00',
          },
        ];

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue(
          existingAppointments,
        );

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        // 8 possible slots - 3 booked = 5 available
        expect(result.total_available_slots).toBe(5);
        expect(result.available_dates[0].slots).toEqual([
          { start_time: '10:00', end_time: '11:00' },
          { start_time: '11:00', end_time: '12:00' },
          { start_time: '12:00', end_time: '13:00' },
          { start_time: '14:00', end_time: '15:00' },
          { start_time: '16:00', end_time: '17:00' },
        ]);
      });

      it('should not subtract appointments from different dates', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '11:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        // Existing appointment on a different date
        const existingAppointments = [
          {
            scheduled_date: '2025-03-10', // Different date
            start_time: '09:00',
            end_time: '10:00',
          },
        ];

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue(
          existingAppointments,
        );

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        // All slots should be available (appointment is on different date)
        expect(result.total_available_slots).toBe(2);
        expect(result.available_dates[0].slots).toEqual([
          { start_time: '09:00', end_time: '10:00' },
          { start_time: '10:00', end_time: '11:00' },
        ]);
      });
    });

    describe('All Day slots (duration = 0)', () => {
      it('should return one All Day slot when no existing appointments', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'All Day Service',
          slot_duration_minutes: 0, // All Day
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '08:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        expect(result.total_available_slots).toBe(1);
        expect(result.available_dates[0].slots).toHaveLength(1);
        expect(result.available_dates[0].slots[0].start_time).toBe('08:00');
        expect(result.available_dates[0].slots[0].end_time).toBe('17:00');
      });

      it('should block All Day slot when any existing appointment exists on that date', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'All Day Service',
          slot_duration_minutes: 0, // All Day
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '08:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        // ANY existing appointment on the date blocks the All Day slot
        const existingAppointments = [
          {
            scheduled_date: '2025-03-03',
            start_time: '14:00',
            end_time: '15:00',
          },
        ];

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue(
          existingAppointments,
        );

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        expect(result.total_available_slots).toBe(0);
        expect(result.available_dates).toHaveLength(0);
      });
    });

    describe('Error handling', () => {
      it('should throw BadRequestException when appointment type not found', async () => {
        mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

        await expect(
          service.getAvailableSlots(
            tenantId,
            'non-existent-id',
            '2025-03-03',
            '2025-03-03',
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when appointment type is not active', async () => {
        const inactiveAppointmentType = {
          id: appointmentTypeId,
          is_active: false,
          schedules: [],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(null); // Not found because is_active filter

        await expect(
          service.getAvailableSlots(
            tenantId,
            appointmentTypeId,
            '2025-03-03',
            '2025-03-03',
          ),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('Edge cases', () => {
      it('should return empty array when no days in the schedule are available', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: false, // NOT available
              window1_start: null,
              window1_end: null,
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        expect(result.total_available_slots).toBe(0);
        expect(result.available_dates).toHaveLength(0);
      });

      it('should return empty array when all slots are booked', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '11:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        // All slots booked
        const existingAppointments = [
          {
            scheduled_date: '2025-03-03',
            start_time: '09:00',
            end_time: '10:00',
          },
          {
            scheduled_date: '2025-03-03',
            start_time: '10:00',
            end_time: '11:00',
          },
        ];

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue(
          existingAppointments,
        );

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03',
          '2025-03-03',
        );

        expect(result.total_available_slots).toBe(0);
        expect(result.available_dates).toHaveLength(0);
      });
    });

    // ========================================
    // Sprint 08: Advanced Features Tests
    // ========================================

    describe('Sprint 08: max_lookahead_weeks validation', () => {
      it('should throw error when date range exceeds max_lookahead_weeks', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          max_lookahead_weeks: 4, // 4 weeks = 28 days
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );

        // Request 30 days (exceeds 28-day limit)
        await expect(
          service.getAvailableSlots(
            tenantId,
            appointmentTypeId,
            '2025-03-03',
            '2025-04-01', // 30 days
          ),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.getAvailableSlots(
            tenantId,
            appointmentTypeId,
            '2025-03-03',
            '2025-04-01',
          ),
        ).rejects.toThrow(
          'Date range exceeds maximum lookahead of 4 weeks (28 days)',
        );
      });

      it('should succeed when date range is within max_lookahead_weeks', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          max_lookahead_weeks: 4, // 4 weeks = 28 days
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        // Request 28 days exactly (should succeed)
        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03', // Monday
          '2025-03-30', // 28 days later (also Monday)
        );

        expect(result).toBeDefined();
        expect(result.total_available_slots).toBeGreaterThan(0);
      });
    });

    describe('Sprint 08: Custom hours (holidays and closures)', () => {
      it('should skip entire day when custom hour is marked as closed', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          max_lookahead_weeks: 8,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        // Custom hours: March 3, 2025 is closed (holiday)
        mockPrisma.tenant_custom_hours.findMany.mockResolvedValue([
          {
            tenant_id: tenantId,
            date: new Date('2025-03-03'),
            reason: 'Public Holiday',
            closed: true,
            open_time1: null,
            close_time1: null,
            open_time2: null,
            close_time2: null,
          },
        ]);

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03', // Monday (closed)
          '2025-03-03',
        );

        // Day is closed, no slots generated
        expect(result.total_available_slots).toBe(0);
        expect(result.available_dates).toHaveLength(0);
      });

      it('should use custom hours instead of regular schedule when available', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          max_lookahead_weeks: 8,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00', // Regular: 8 slots
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        // Custom hours: March 3, 2025 has modified hours (closing early)
        mockPrisma.tenant_custom_hours.findMany.mockResolvedValue([
          {
            tenant_id: tenantId,
            date: new Date('2025-03-03'),
            reason: 'Early closure',
            closed: false,
            open_time1: '09:00',
            close_time1: '12:00', // Only 3 hours instead of 8
            open_time2: null,
            close_time2: null,
          },
        ]);

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03', // Monday (custom hours)
          '2025-03-03',
        );

        // Custom hours: 09:00-12:00 = 3 slots
        expect(result.total_available_slots).toBe(3);
        expect(result.available_dates).toHaveLength(1);
        expect(result.available_dates[0].slots).toEqual([
          { start_time: '09:00', end_time: '10:00' },
          { start_time: '10:00', end_time: '11:00' },
          { start_time: '11:00', end_time: '12:00' },
        ]);
      });
    });

    describe('Sprint 08: External calendar blocks', () => {
      it('should exclude slots that overlap with external calendar blocks', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          max_lookahead_weeks: 8,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        // External block: 10:00-11:00 UTC (which is 10:00-11:00 in our mock)
        mockPrisma.calendar_external_block.findMany.mockResolvedValue([
          {
            tenant_id: tenantId,
            start_datetime_utc: new Date('2025-03-03T10:00:00Z'),
            end_datetime_utc: new Date('2025-03-03T11:00:00Z'),
            is_all_day: false,
          },
        ]);

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03', // Monday
          '2025-03-03',
        );

        // 8 slots normally, but 10:00 slot is blocked by external block
        expect(result.total_available_slots).toBe(7);
        expect(result.available_dates).toHaveLength(1);

        // Verify 10:00 slot is missing
        const slotTimes = result.available_dates[0].slots.map((s) => s.start_time);
        expect(slotTimes).not.toContain('10:00');
        expect(slotTimes).toContain('09:00');
        expect(slotTimes).toContain('11:00');
      });

      it('should exclude slot if partially overlapping with external block', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          max_lookahead_weeks: 8,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        // External block: 10:30-11:30 UTC (overlaps with 10:00-11:00 and 11:00-12:00 slots)
        mockPrisma.calendar_external_block.findMany.mockResolvedValue([
          {
            tenant_id: tenantId,
            start_datetime_utc: new Date('2025-03-03T10:30:00Z'),
            end_datetime_utc: new Date('2025-03-03T11:30:00Z'),
            is_all_day: false,
          },
        ]);

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03', // Monday
          '2025-03-03',
        );

        // 10:00 and 11:00 slots should both be excluded (partial overlap)
        const slotTimes = result.available_dates[0].slots.map((s) => s.start_time);
        expect(slotTimes).not.toContain('10:00');
        expect(slotTimes).not.toContain('11:00');
        expect(slotTimes).toContain('09:00');
        expect(slotTimes).toContain('12:00');
      });
    });

    describe('Sprint 08: DST transition handling', () => {
      it('should handle DST spring forward transition (2 AM non-existent hour)', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          max_lookahead_weeks: 8,
          schedules: [
            {
              day_of_week: 0, // Sunday (DST spring forward in 2025: March 9)
              is_available: true,
              window1_start: '01:00',
              window1_end: '04:00', // Includes the 2 AM hour
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        // Mock DateTimeConverter to simulate DST spring forward behavior
        // On March 9, 2025, 2:00 AM → 3:00 AM (2 AM doesn't exist)
        mockDateTimeConverter.localToUtc.mockImplementation(
          (date: string, time: string, timezone: string) => {
            const [year, month, day] = date.split('-').map(Number);
            let [hour, minute] = time.split(':').map(Number);

            // Simulate spring forward: 2 AM becomes 3 AM on March 9, 2025
            if (date === '2025-03-09' && hour === 2) {
              hour = 3; // Spring forward: 2 AM → 3 AM
            }

            return new Date(Date.UTC(year, month - 1, day, hour, minute));
          },
        );

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-09', // DST spring forward date
          '2025-03-09',
        );

        // Should generate slots: 01:00-02:00, 02:00-03:00 (becomes 03:00-04:00 UTC), 03:00-04:00
        // The 2 AM slot is created but represents 3 AM EDT due to DST
        // This is expected behavior - date-fns-tz handles DST transparently
        expect(result.total_available_slots).toBeGreaterThanOrEqual(2);
        expect(result.available_dates).toHaveLength(1);
      });

      it('should handle DST fall back transition (2 AM happens twice)', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          max_lookahead_weeks: 8,
          schedules: [
            {
              day_of_week: 0, // Sunday (DST fall back in 2025: November 2)
              is_available: true,
              window1_start: '01:00',
              window1_end: '04:00', // Includes the 2 AM hour
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        // Mock DateTimeConverter to simulate DST fall back behavior
        // On November 2, 2025, 2:00 AM happens twice (1 AM → 2 AM → 1 AM → 2 AM)
        // date-fns-tz uses the first occurrence
        mockDateTimeConverter.localToUtc.mockImplementation(
          (date: string, time: string, timezone: string) => {
            const [year, month, day] = date.split('-').map(Number);
            const [hour, minute] = time.split(':').map(Number);

            // No special handling needed - date-fns-tz uses first occurrence
            return new Date(Date.UTC(year, month - 1, day, hour, minute));
          },
        );

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-11-02', // DST fall back date
          '2025-11-02',
        );

        // Should generate slots normally: 01:00-02:00, 02:00-03:00, 03:00-04:00
        // The 2 AM slot represents the first occurrence (before fall back)
        expect(result.total_available_slots).toBe(3);
        expect(result.available_dates).toHaveLength(1);
      });
    });

    describe('Sprint 08: Combined scenarios (custom hours + external blocks)', () => {
      it('should handle both custom hours and external blocks together', async () => {
        const appointmentType = {
          id: appointmentTypeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
          max_lookahead_weeks: 8,
          schedules: [
            {
              day_of_week: 1, // Monday
              is_available: true,
              window1_start: '09:00',
              window1_end: '17:00',
              window2_start: null,
              window2_end: null,
            },
          ],
        };

        mockPrisma.appointment_type.findFirst.mockResolvedValue(
          appointmentType,
        );
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        // Custom hours: Modified hours 09:00-14:00 (instead of 09:00-17:00)
        mockPrisma.tenant_custom_hours.findMany.mockResolvedValue([
          {
            tenant_id: tenantId,
            date: new Date('2025-03-03'),
            reason: 'Early closure',
            closed: false,
            open_time1: '09:00',
            close_time1: '14:00', // 5 slots normally
            open_time2: null,
            close_time2: null,
          },
        ]);

        // External block: 11:00-12:00
        mockPrisma.calendar_external_block.findMany.mockResolvedValue([
          {
            tenant_id: tenantId,
            start_datetime_utc: new Date('2025-03-03T11:00:00Z'),
            end_datetime_utc: new Date('2025-03-03T12:00:00Z'),
            is_all_day: false,
          },
        ]);

        const result = await service.getAvailableSlots(
          tenantId,
          appointmentTypeId,
          '2025-03-03', // Monday
          '2025-03-03',
        );

        // Custom hours: 09:00-14:00 = 5 slots normally
        // External block removes 11:00 slot
        // Result: 4 slots (09:00, 10:00, 12:00, 13:00)
        expect(result.total_available_slots).toBe(4);
        expect(result.available_dates[0].slots).toEqual([
          { start_time: '09:00', end_time: '10:00' },
          { start_time: '10:00', end_time: '11:00' },
          { start_time: '12:00', end_time: '13:00' },
          { start_time: '13:00', end_time: '14:00' },
        ]);
      });
    });
  });
});
