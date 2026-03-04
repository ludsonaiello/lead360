import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CalendarDashboardController } from './calendar-dashboard.controller';
import { CalendarDashboardService } from '../services/calendar-dashboard.service';

describe('CalendarDashboardController', () => {
  let controller: CalendarDashboardController;
  let dashboardService: CalendarDashboardService;

  const mockDashboardService = {
    getUpcomingAppointments: jest.fn(),
    getNewAppointments: jest.fn(),
    acknowledgeAppointment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarDashboardController],
      providers: [
        {
          provide: CalendarDashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<CalendarDashboardController>(
      CalendarDashboardController,
    );
    dashboardService = module.get<CalendarDashboardService>(
      CalendarDashboardService,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /calendar/dashboard/upcoming', () => {
    const tenantId = 'tenant-123';

    const mockUpcomingResponse = {
      items: [
        {
          id: 'apt-1',
          appointment_type_name: 'Quote Visit',
          lead_first_name: 'John',
          lead_last_name: 'Doe',
          scheduled_date: '2026-03-15',
          start_time: '09:00',
          end_time: '10:00',
          address: '123 Main St',
          status: 'scheduled',
        },
        {
          id: 'apt-2',
          appointment_type_name: 'Quote Visit',
          lead_first_name: 'Jane',
          lead_last_name: 'Smith',
          scheduled_date: '2026-03-16',
          start_time: '14:00',
          end_time: '15:30',
          status: 'confirmed',
        },
      ],
      count: 2,
    };

    it('should return upcoming appointments with default limit', async () => {
      mockDashboardService.getUpcomingAppointments.mockResolvedValue(
        mockUpcomingResponse,
      );

      const result = await controller.getUpcoming({}, tenantId);

      expect(result).toEqual(mockUpcomingResponse);
      expect(dashboardService.getUpcomingAppointments).toHaveBeenCalledWith(
        tenantId,
        5,
      );
      expect(dashboardService.getUpcomingAppointments).toHaveBeenCalledTimes(1);
    });

    it('should return upcoming appointments with custom limit', async () => {
      mockDashboardService.getUpcomingAppointments.mockResolvedValue({
        items: [mockUpcomingResponse.items[0]],
        count: 1,
      });

      const result = await controller.getUpcoming({ limit: 10 }, tenantId);

      expect(result.count).toBe(1);
      expect(dashboardService.getUpcomingAppointments).toHaveBeenCalledWith(
        tenantId,
        10,
      );
    });

    it('should return empty array when no upcoming appointments', async () => {
      mockDashboardService.getUpcomingAppointments.mockResolvedValue({
        items: [],
        count: 0,
      });

      const result = await controller.getUpcoming({}, tenantId);

      expect(result).toEqual({
        items: [],
        count: 0,
      });
    });

    it('should enforce tenant isolation', async () => {
      mockDashboardService.getUpcomingAppointments.mockResolvedValue({
        items: [],
        count: 0,
      });

      await controller.getUpcoming({}, 'tenant-456');

      expect(dashboardService.getUpcomingAppointments).toHaveBeenCalledWith(
        'tenant-456',
        5,
      );
    });

    it('should throw BadRequestException when tenant_id is null', async () => {
      await expect(controller.getUpcoming({}, null)).rejects.toThrow(
        BadRequestException,
      );

      expect(dashboardService.getUpcomingAppointments).not.toHaveBeenCalled();
    });

    it('should propagate errors from service', async () => {
      mockDashboardService.getUpcomingAppointments.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getUpcoming({}, tenantId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('GET /calendar/dashboard/new', () => {
    const tenantId = 'tenant-123';

    const mockNewResponse = {
      items: [
        {
          id: 'apt-3',
          appointment_type_name: 'Quote Visit',
          lead_first_name: 'Bob',
          lead_last_name: 'Johnson',
          scheduled_date: '2026-03-20',
          start_time: '11:00',
          end_time: '12:00',
          source: 'voice_ai',
          created_at: new Date('2026-03-03T10:00:00Z'),
          status: 'scheduled',
        },
      ],
      count: 1,
    };

    it('should return new appointments with default limit', async () => {
      mockDashboardService.getNewAppointments.mockResolvedValue(
        mockNewResponse,
      );

      const result = await controller.getNew({}, tenantId);

      expect(result).toEqual(mockNewResponse);
      expect(dashboardService.getNewAppointments).toHaveBeenCalledWith(
        tenantId,
        10,
      );
      expect(dashboardService.getNewAppointments).toHaveBeenCalledTimes(1);
    });

    it('should return new appointments with custom limit', async () => {
      mockDashboardService.getNewAppointments.mockResolvedValue(
        mockNewResponse,
      );

      const result = await controller.getNew({ limit: 20 }, tenantId);

      expect(result.count).toBe(1);
      expect(dashboardService.getNewAppointments).toHaveBeenCalledWith(
        tenantId,
        20,
      );
    });

    it('should return empty array when no new appointments', async () => {
      mockDashboardService.getNewAppointments.mockResolvedValue({
        items: [],
        count: 0,
      });

      const result = await controller.getNew({}, tenantId);

      expect(result).toEqual({
        items: [],
        count: 0,
      });
    });

    it('should enforce tenant isolation', async () => {
      mockDashboardService.getNewAppointments.mockResolvedValue({
        items: [],
        count: 0,
      });

      await controller.getNew({}, 'tenant-789');

      expect(dashboardService.getNewAppointments).toHaveBeenCalledWith(
        'tenant-789',
        10,
      );
    });

    it('should throw BadRequestException when tenant_id is null', async () => {
      await expect(controller.getNew({}, null)).rejects.toThrow(
        BadRequestException,
      );

      expect(dashboardService.getNewAppointments).not.toHaveBeenCalled();
    });

    it('should propagate errors from service', async () => {
      mockDashboardService.getNewAppointments.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getNew({}, tenantId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('PATCH /calendar/dashboard/new/:id/acknowledge', () => {
    const tenantId = 'tenant-123';
    const appointmentId = 'apt-123';

    const mockAcknowledgeResponse = {
      message: 'Appointment acknowledged successfully',
      appointment_id: appointmentId,
      acknowledged_at: new Date('2026-03-03T12:00:00Z'),
    };

    it('should acknowledge appointment successfully', async () => {
      mockDashboardService.acknowledgeAppointment.mockResolvedValue(
        mockAcknowledgeResponse,
      );

      const result = await controller.acknowledge(appointmentId, tenantId);

      expect(result).toEqual(mockAcknowledgeResponse);
      expect(dashboardService.acknowledgeAppointment).toHaveBeenCalledWith(
        tenantId,
        appointmentId,
      );
      expect(dashboardService.acknowledgeAppointment).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when appointment not found', async () => {
      mockDashboardService.acknowledgeAppointment.mockRejectedValue(
        new NotFoundException(
          `Appointment with ID ${appointmentId} not found or access denied`,
        ),
      );

      await expect(
        controller.acknowledge(appointmentId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation', async () => {
      mockDashboardService.acknowledgeAppointment.mockResolvedValue(
        mockAcknowledgeResponse,
      );

      await controller.acknowledge(appointmentId, 'tenant-999');

      expect(dashboardService.acknowledgeAppointment).toHaveBeenCalledWith(
        'tenant-999',
        appointmentId,
      );
    });

    it('should throw BadRequestException when tenant_id is null', async () => {
      await expect(controller.acknowledge(appointmentId, null)).rejects.toThrow(
        BadRequestException,
      );

      expect(dashboardService.acknowledgeAppointment).not.toHaveBeenCalled();
    });

    it('should not allow acknowledging appointment from different tenant', async () => {
      mockDashboardService.acknowledgeAppointment.mockRejectedValue(
        new NotFoundException(
          `Appointment with ID ${appointmentId} not found or access denied`,
        ),
      );

      await expect(
        controller.acknowledge(appointmentId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate errors from service', async () => {
      mockDashboardService.acknowledgeAppointment.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.acknowledge(appointmentId, tenantId),
      ).rejects.toThrow('Database error');
    });
  });
});
