import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CalendarDashboardService } from './calendar-dashboard.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('CalendarDashboardService', () => {
  let service: CalendarDashboardService;
  let prisma: PrismaService;

  const mockPrisma = {
    appointment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarDashboardService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<CalendarDashboardService>(CalendarDashboardService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUpcomingAppointments', () => {
    const tenantId = 'tenant-123';

    const mockUpcomingAppointments = [
      {
        id: 'apt-1',
        scheduled_date: '2026-03-15',
        start_time: '09:00',
        end_time: '10:00',
        start_datetime_utc: new Date('2026-03-15T14:00:00Z'),
        status: 'scheduled',
        appointment_type: {
          name: 'Quote Visit',
        },
        lead: {
          first_name: 'John',
          last_name: 'Doe',
          addresses: [
            {
              address_line1: '123 Main St',
            },
          ],
        },
      },
      {
        id: 'apt-2',
        scheduled_date: '2026-03-16',
        start_time: '14:00',
        end_time: '15:30',
        start_datetime_utc: new Date('2026-03-16T19:00:00Z'),
        status: 'confirmed',
        appointment_type: {
          name: 'Quote Visit',
        },
        lead: {
          first_name: 'Jane',
          last_name: 'Smith',
          addresses: [],
        },
      },
    ];

    it('should return upcoming appointments with default limit', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue(
        mockUpcomingAppointments,
      );

      const result = await service.getUpcomingAppointments(tenantId);

      expect(result).toEqual({
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
            address: undefined,
            status: 'confirmed',
          },
        ],
        count: 2,
      });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          status: {
            in: ['scheduled', 'confirmed'],
          },
          start_datetime_utc: {
            gte: expect.any(Date),
          },
        },
        orderBy: [{ start_datetime_utc: 'asc' }],
        take: 5,
        include: expect.any(Object),
      });
    });

    it('should return upcoming appointments with custom limit', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([
        mockUpcomingAppointments[0],
      ]);

      const result = await service.getUpcomingAppointments(tenantId, 10);

      expect(result.count).toBe(1);
      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('should return empty array when no upcoming appointments', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getUpcomingAppointments(tenantId);

      expect(result).toEqual({
        items: [],
        count: 0,
      });
    });

    it('should filter by tenant_id and future dates only', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      await service.getUpcomingAppointments(tenantId);

      const callArgs = mockPrisma.appointment.findMany.mock.calls[0][0];
      expect(callArgs.where.tenant_id).toBe(tenantId);
      expect(callArgs.where.start_datetime_utc.gte).toBeInstanceOf(Date);
      expect(callArgs.where.status.in).toEqual(['scheduled', 'confirmed']);
    });
  });

  describe('getNewAppointments', () => {
    const tenantId = 'tenant-123';

    const mockNewAppointments = [
      {
        id: 'apt-3',
        scheduled_date: '2026-03-20',
        start_time: '11:00',
        end_time: '12:00',
        status: 'scheduled',
        source: 'voice_ai',
        created_at: new Date('2026-03-03T10:00:00Z'),
        appointment_type: {
          name: 'Quote Visit',
        },
        lead: {
          first_name: 'Bob',
          last_name: 'Johnson',
        },
      },
    ];

    it('should return new unacknowledged appointments with default limit', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue(mockNewAppointments);

      const result = await service.getNewAppointments(tenantId);

      expect(result).toEqual({
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
      });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          acknowledged_at: null,
          status: {
            in: ['scheduled', 'confirmed'],
          },
        },
        orderBy: [{ created_at: 'desc' }],
        take: 10,
        include: expect.any(Object),
      });
    });

    it('should return new appointments with custom limit', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue(mockNewAppointments);

      const result = await service.getNewAppointments(tenantId, 20);

      expect(result.count).toBe(1);
      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        }),
      );
    });

    it('should return empty array when no new appointments', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getNewAppointments(tenantId);

      expect(result).toEqual({
        items: [],
        count: 0,
      });
    });

    it('should filter by acknowledged_at IS NULL', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      await service.getNewAppointments(tenantId);

      const callArgs = mockPrisma.appointment.findMany.mock.calls[0][0];
      expect(callArgs.where.acknowledged_at).toBeNull();
      expect(callArgs.where.tenant_id).toBe(tenantId);
      expect(callArgs.where.status.in).toEqual(['scheduled', 'confirmed']);
    });
  });

  describe('acknowledgeAppointment', () => {
    const tenantId = 'tenant-123';
    const appointmentId = 'apt-123';

    const mockAppointment = {
      id: appointmentId,
      tenant_id: tenantId,
      acknowledged_at: null,
    };

    it('should acknowledge an appointment successfully', async () => {
      const acknowledgedAt = new Date();
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        acknowledged_at: acknowledgedAt,
      });

      const result = await service.acknowledgeAppointment(
        tenantId,
        appointmentId,
      );

      expect(result).toEqual({
        message: 'Appointment acknowledged successfully',
        appointment_id: appointmentId,
        acknowledged_at: acknowledgedAt,
      });

      expect(mockPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: {
          id: appointmentId,
          tenant_id: tenantId,
        },
      });

      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: appointmentId },
        data: {
          acknowledged_at: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException when appointment not found', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.acknowledgeAppointment(tenantId, appointmentId),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.appointment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when appointment belongs to different tenant', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.acknowledgeAppointment('different-tenant', appointmentId),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.appointment.update).not.toHaveBeenCalled();
    });

    it('should acknowledge an already acknowledged appointment', async () => {
      const firstAcknowledgedAt = new Date('2026-03-01T10:00:00Z');
      const secondAcknowledgedAt = new Date('2026-03-03T12:00:00Z');

      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        acknowledged_at: firstAcknowledgedAt,
      });

      mockPrisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        acknowledged_at: secondAcknowledgedAt,
      });

      const result = await service.acknowledgeAppointment(
        tenantId,
        appointmentId,
      );

      expect(result.acknowledged_at).toEqual(secondAcknowledgedAt);
      expect(mockPrisma.appointment.update).toHaveBeenCalled();
    });
  });
});
