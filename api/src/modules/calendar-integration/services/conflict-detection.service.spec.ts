import { Test, TestingModule } from '@nestjs/testing';
import { ConflictDetectionService } from './conflict-detection.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';

describe('ConflictDetectionService', () => {
  let service: ConflictDetectionService;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    appointment: {
      findUnique: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
    },
    calendar_external_block: {
      count: jest.fn(),
    },
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictDetectionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<ConflictDetectionService>(ConflictDetectionService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectConflicts', () => {
    it('should detect conflicts and create notifications', async () => {
      const mockConflicts = [
        {
          appointment_id: 'appt-1',
          block_id: 'block-1',
        },
        {
          appointment_id: 'appt-2',
          block_id: 'block-2',
        },
      ];

      const mockAppointment1 = {
        id: 'appt-1',
        tenant_id: 'tenant-1',
        scheduled_date: '2026-03-10',
        start_time: '09:00',
        end_time: '10:30',
        lead: {
          first_name: 'John',
          last_name: 'Smith',
        },
        appointment_type: {
          name: 'Quote Visit',
        },
      };

      const mockAppointment2 = {
        id: 'appt-2',
        tenant_id: 'tenant-1',
        scheduled_date: '2026-03-12',
        start_time: '14:00',
        end_time: '15:30',
        lead: {
          first_name: 'Jane',
          last_name: 'Doe',
        },
        appointment_type: {
          name: 'Quote Visit',
        },
      };

      mockPrismaService.$queryRaw.mockResolvedValue(mockConflicts);
      mockPrismaService.appointment.findUnique
        .mockResolvedValueOnce(mockAppointment1)
        .mockResolvedValueOnce(mockAppointment2);
      mockPrismaService.notification.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      const result = await service.detectConflicts('tenant-1');

      expect(result.conflictsFound).toBe(2);
      expect(result.notificationsCreated).toBe(2);
      expect(result.conflicts).toHaveLength(2);
      expect(result.conflicts[0]).toEqual({
        appointmentId: 'appt-1',
        externalBlockId: 'block-1',
      });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.appointment.findUnique).toHaveBeenCalledTimes(2);
      expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);

      expect(notificationsService.createNotification).toHaveBeenNthCalledWith(
        1,
        {
          tenant_id: 'tenant-1',
          user_id: null,
          type: 'calendar_conflict',
          title: 'Calendar Conflict Detected',
          message:
            'External calendar event overlaps with appointment: Quote Visit with John Smith on 2026-03-10 at 09:00',
          action_url: '/calendar',
          related_entity_type: 'appointment',
          related_entity_id: 'appt-1',
        },
      );
    });

    it('should return zero conflicts when none found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.detectConflicts('tenant-1');

      expect(result.conflictsFound).toBe(0);
      expect(result.notificationsCreated).toBe(0);
      expect(result.conflicts).toHaveLength(0);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('should skip notification if one already exists for the conflict', async () => {
      const mockConflicts = [
        {
          appointment_id: 'appt-1',
          block_id: 'block-1',
        },
      ];

      const mockAppointment = {
        id: 'appt-1',
        tenant_id: 'tenant-1',
        scheduled_date: '2026-03-10',
        start_time: '09:00',
        end_time: '10:30',
        lead: {
          first_name: 'John',
          last_name: 'Smith',
        },
        appointment_type: {
          name: 'Quote Visit',
        },
      };

      const existingNotification = {
        id: 'existing-notif-1',
        tenant_id: 'tenant-1',
        type: 'calendar_conflict',
        related_entity_id: 'appt-1',
        is_read: false,
      };

      mockPrismaService.$queryRaw.mockResolvedValue(mockConflicts);
      mockPrismaService.appointment.findUnique.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.notification.findFirst.mockResolvedValue(
        existingNotification,
      );

      const result = await service.detectConflicts('tenant-1');

      expect(result.conflictsFound).toBe(1);
      expect(result.notificationsCreated).toBe(0);
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('should skip notification if appointment not found', async () => {
      const mockConflicts = [
        {
          appointment_id: 'appt-deleted',
          block_id: 'block-1',
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockConflicts);
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      const result = await service.detectConflicts('tenant-1');

      expect(result.conflictsFound).toBe(1);
      expect(result.notificationsCreated).toBe(0);
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('should continue processing other conflicts if one notification fails', async () => {
      const mockConflicts = [
        {
          appointment_id: 'appt-1',
          block_id: 'block-1',
        },
        {
          appointment_id: 'appt-2',
          block_id: 'block-2',
        },
      ];

      const mockAppointment1 = {
        id: 'appt-1',
        tenant_id: 'tenant-1',
        scheduled_date: '2026-03-10',
        start_time: '09:00',
        end_time: '10:30',
        lead: {
          first_name: 'John',
          last_name: 'Smith',
        },
        appointment_type: {
          name: 'Quote Visit',
        },
      };

      const mockAppointment2 = {
        id: 'appt-2',
        tenant_id: 'tenant-1',
        scheduled_date: '2026-03-12',
        start_time: '14:00',
        end_time: '15:30',
        lead: {
          first_name: 'Jane',
          last_name: 'Doe',
        },
        appointment_type: {
          name: 'Quote Visit',
        },
      };

      mockPrismaService.$queryRaw.mockResolvedValue(mockConflicts);
      mockPrismaService.appointment.findUnique
        .mockResolvedValueOnce(mockAppointment1)
        .mockResolvedValueOnce(mockAppointment2);
      mockPrismaService.notification.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // First notification fails, second succeeds
      mockNotificationsService.createNotification
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ id: 'notif-2' });

      const result = await service.detectConflicts('tenant-1');

      expect(result.conflictsFound).toBe(2);
      expect(result.notificationsCreated).toBe(1); // Only second succeeded
      expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
    });

    it('should throw error if database query fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(service.detectConflicts('tenant-1')).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('detectConflictForAppointment', () => {
    it('should return true if conflict exists', async () => {
      const mockAppointment = {
        tenant_id: 'tenant-1',
        start_datetime_utc: new Date('2026-03-10T14:00:00Z'),
        end_datetime_utc: new Date('2026-03-10T15:30:00Z'),
      };

      mockPrismaService.appointment.findUnique.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.calendar_external_block.count.mockResolvedValue(1);

      const result = await service.detectConflictForAppointment('appt-1');

      expect(result).toBe(true);
      expect(prisma.appointment.findUnique).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        select: {
          tenant_id: true,
          start_datetime_utc: true,
          end_datetime_utc: true,
        },
      });
      expect(prisma.calendar_external_block.count).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          AND: [
            { start_datetime_utc: { lt: mockAppointment.end_datetime_utc } },
            { end_datetime_utc: { gt: mockAppointment.start_datetime_utc } },
          ],
        },
      });
    });

    it('should return false if no conflict exists', async () => {
      const mockAppointment = {
        tenant_id: 'tenant-1',
        start_datetime_utc: new Date('2026-03-10T14:00:00Z'),
        end_datetime_utc: new Date('2026-03-10T15:30:00Z'),
      };

      mockPrismaService.appointment.findUnique.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.calendar_external_block.count.mockResolvedValue(0);

      const result = await service.detectConflictForAppointment('appt-1');

      expect(result).toBe(false);
    });

    it('should throw error if appointment not found', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.detectConflictForAppointment('appt-nonexistent'),
      ).rejects.toThrow('Appointment appt-nonexistent not found');
    });

    it('should throw error if database query fails', async () => {
      mockPrismaService.appointment.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.detectConflictForAppointment('appt-1'),
      ).rejects.toThrow('Database error');
    });
  });
});
