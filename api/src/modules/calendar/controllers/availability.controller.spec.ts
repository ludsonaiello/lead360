import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityController } from './availability.controller';
import { SlotCalculationService } from '../services/slot-calculation.service';

describe('AvailabilityController', () => {
  let controller: AvailabilityController;
  let slotCalculationService: SlotCalculationService;

  const mockSlotCalculationService = {
    getAvailableSlots: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [
        {
          provide: SlotCalculationService,
          useValue: mockSlotCalculationService,
        },
      ],
    }).compile();

    controller = module.get<AvailabilityController>(AvailabilityController);
    slotCalculationService = module.get<SlotCalculationService>(
      SlotCalculationService,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /calendar/availability', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const appointment_typeId = 'apt-type-123';
    const dateFrom = '2026-03-02';
    const dateTo = '2026-03-16';

    const mockRequest = {
      user: {
        tenant_id: tenantId,
        id: userId,
      },
    };

    const mockQuery = {
      appointment_type_id: appointment_typeId,
      date_from: dateFrom,
      date_to: dateTo,
    };

    it('should return available slots successfully', async () => {
      const mockResponse = {
        appointment_type: {
          id: appointment_typeId,
          name: 'Quote Visit',
          slot_duration_minutes: 90,
        },
        timezone: 'America/New_York',
        date_range: {
          from: dateFrom,
          to: dateTo,
        },
        available_dates: [
          {
            date: '2026-03-02',
            day_name: 'Monday',
            slots: [
              { start_time: '08:00', end_time: '09:30' },
              { start_time: '09:30', end_time: '11:00' },
            ],
          },
          {
            date: '2026-03-05',
            day_name: 'Thursday',
            slots: [
              { start_time: '08:00', end_time: '09:30' },
              { start_time: '09:30', end_time: '11:00' },
            ],
          },
        ],
        total_available_slots: 4,
      };

      mockSlotCalculationService.getAvailableSlots.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.getAvailability(mockRequest, mockQuery);

      expect(result).toEqual(mockResponse);
      expect(slotCalculationService.getAvailableSlots).toHaveBeenCalledWith(
        tenantId,
        appointment_typeId,
        dateFrom,
        dateTo,
      );
      expect(slotCalculationService.getAvailableSlots).toHaveBeenCalledTimes(1);
    });

    it('should include tenant timezone in response', async () => {
      const mockResponse = {
        appointment_type: {
          id: appointment_typeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
        },
        timezone: 'America/Los_Angeles',
        date_range: {
          from: dateFrom,
          to: dateTo,
        },
        available_dates: [],
        total_available_slots: 0,
      };

      mockSlotCalculationService.getAvailableSlots.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.getAvailability(mockRequest, mockQuery);

      expect(result.timezone).toBe('America/Los_Angeles');
    });

    it('should return empty slots when no availability', async () => {
      const mockResponse = {
        appointment_type: {
          id: appointment_typeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
        },
        timezone: 'America/New_York',
        date_range: {
          from: dateFrom,
          to: dateTo,
        },
        available_dates: [],
        total_available_slots: 0,
      };

      mockSlotCalculationService.getAvailableSlots.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.getAvailability(mockRequest, mockQuery);

      expect(result.total_available_slots).toBe(0);
      expect(result.available_dates).toEqual([]);
    });

    it('should call slot calculation service with correct tenant isolation', async () => {
      const tenant2Request = {
        user: {
          tenant_id: 'tenant-456',
          id: 'user-456',
        },
      };

      const mockResponse = {
        appointment_type: {
          id: appointment_typeId,
          name: 'Quote Visit',
          slot_duration_minutes: 60,
        },
        timezone: 'America/New_York',
        date_range: {
          from: dateFrom,
          to: dateTo,
        },
        available_dates: [],
        total_available_slots: 0,
      };

      mockSlotCalculationService.getAvailableSlots.mockResolvedValue(
        mockResponse,
      );

      await controller.getAvailability(tenant2Request, mockQuery);

      // Verify that the correct tenant_id is passed (tenant isolation)
      expect(slotCalculationService.getAvailableSlots).toHaveBeenCalledWith(
        'tenant-456',
        appointment_typeId,
        dateFrom,
        dateTo,
      );
    });

    it('should propagate errors from slot calculation service', async () => {
      mockSlotCalculationService.getAvailableSlots.mockRejectedValue(
        new Error('Appointment type not found'),
      );

      await expect(
        controller.getAvailability(mockRequest, mockQuery),
      ).rejects.toThrow('Appointment type not found');
    });
  });
});
