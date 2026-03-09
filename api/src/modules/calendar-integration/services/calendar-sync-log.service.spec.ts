import { Test, TestingModule } from '@nestjs/testing';
import { CalendarSyncLogService } from './calendar-sync-log.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('CalendarSyncLogService', () => {
  let service: CalendarSyncLogService;
  let prisma: PrismaService;

  const mockPrismaService = {
    calendar_sync_log: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarSyncLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CalendarSyncLogService>(CalendarSyncLogService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logSync', () => {
    it('should create a sync log entry successfully', async () => {
      const mockLogEntry = {
        id: 'log-1',
        tenant_id: 'tenant-1',
        connection_id: 'conn-1',
        direction: 'outbound',
        action: 'event_created',
        appointment_id: 'appt-1',
        external_event_id: 'gcal-event-1',
        status: 'success',
        error_message: null,
        metadata: null,
        created_at: new Date(),
      };

      mockPrismaService.calendar_sync_log.create.mockResolvedValue(
        mockLogEntry,
      );

      const result = await service.logSync({
        tenantId: 'tenant-1',
        connectionId: 'conn-1',
        direction: 'outbound',
        action: 'event_created',
        appointmentId: 'appt-1',
        externalEventId: 'gcal-event-1',
        status: 'success',
      });

      expect(prisma.calendar_sync_log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: 'tenant-1',
          connection_id: 'conn-1',
          direction: 'outbound',
          action: 'event_created',
          appointment_id: 'appt-1',
          external_event_id: 'gcal-event-1',
          status: 'success',
          error_message: null,
          // metadata can be null or Prisma.DbNull - not checking specific value
        }),
      });

      expect(result.id).toBe('log-1');
      expect(result.status).toBe('success');
    });

    it('should log failed sync with error message', async () => {
      const mockLogEntry = {
        id: 'log-2',
        tenant_id: 'tenant-1',
        connection_id: 'conn-1',
        direction: 'outbound',
        action: 'event_created',
        appointment_id: 'appt-1',
        external_event_id: null,
        status: 'failed',
        error_message: 'Token expired',
        metadata: { statusCode: 401 },
        created_at: new Date(),
      };

      mockPrismaService.calendar_sync_log.create.mockResolvedValue(
        mockLogEntry,
      );

      const result = await service.logSync({
        tenantId: 'tenant-1',
        connectionId: 'conn-1',
        direction: 'outbound',
        action: 'event_created',
        appointmentId: 'appt-1',
        status: 'failed',
        errorMessage: 'Token expired',
        metadata: { statusCode: 401 },
      });

      expect(result.status).toBe('failed');
      expect(prisma.calendar_sync_log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'failed',
          error_message: 'Token expired',
          metadata: { statusCode: 401 },
        }),
      });
    });

    it('should log skipped sync', async () => {
      const mockLogEntry = {
        id: 'log-3',
        tenant_id: 'tenant-1',
        connection_id: 'N/A',
        direction: 'outbound',
        action: 'event_created',
        appointment_id: 'appt-1',
        external_event_id: null,
        status: 'skipped',
        error_message: 'No active calendar connection',
        metadata: null,
        created_at: new Date(),
      };

      mockPrismaService.calendar_sync_log.create.mockResolvedValue(
        mockLogEntry,
      );

      const result = await service.logSync({
        tenantId: 'tenant-1',
        connectionId: 'N/A',
        direction: 'outbound',
        action: 'event_created',
        appointmentId: 'appt-1',
        status: 'skipped',
        errorMessage: 'No active calendar connection',
      });

      expect(result.status).toBe('skipped');
    });
  });

  describe('getRecentLogs', () => {
    it('should return recent logs for a tenant', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          tenant_id: 'tenant-1',
          connection_id: 'conn-1',
          direction: 'outbound',
          action: 'event_created',
          appointment_id: 'appt-1',
          external_event_id: 'gcal-1',
          status: 'success',
          error_message: null,
          created_at: new Date(),
        },
        {
          id: 'log-2',
          tenant_id: 'tenant-1',
          connection_id: 'conn-1',
          direction: 'outbound',
          action: 'event_updated',
          appointment_id: 'appt-2',
          external_event_id: 'gcal-2',
          status: 'success',
          error_message: null,
          created_at: new Date(),
        },
      ];

      mockPrismaService.calendar_sync_log.findMany.mockResolvedValue(mockLogs);

      const result = await service.getRecentLogs('tenant-1', 50);

      expect(prisma.calendar_sync_log.findMany).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-1' },
        orderBy: { created_at: 'desc' },
        take: 50,
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('log-1');
      expect(result[1].id).toBe('log-2');
    });

    it('should use default limit of 50', async () => {
      mockPrismaService.calendar_sync_log.findMany.mockResolvedValue([]);

      await service.getRecentLogs('tenant-1');

      expect(prisma.calendar_sync_log.findMany).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-1' },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    });
  });

  describe('getFailedLogs', () => {
    it('should return only failed logs', async () => {
      const mockFailedLogs = [
        {
          id: 'log-1',
          tenant_id: 'tenant-1',
          connection_id: 'conn-1',
          direction: 'outbound',
          action: 'event_created',
          appointment_id: 'appt-1',
          external_event_id: null,
          status: 'failed',
          error_message: 'Network timeout',
          metadata: { retries: 3 },
          created_at: new Date(),
        },
      ];

      mockPrismaService.calendar_sync_log.findMany.mockResolvedValue(
        mockFailedLogs,
      );

      const result = await service.getFailedLogs('tenant-1', 20);

      expect(prisma.calendar_sync_log.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          status: 'failed',
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBeUndefined(); // status is not in return type
      expect(result[0].errorMessage).toBe('Network timeout');
      expect(result[0].metadata).toEqual({ retries: 3 });
    });
  });

  describe('getLogsForAppointment', () => {
    it('should return logs for a specific appointment', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          tenant_id: 'tenant-1',
          connection_id: 'conn-1',
          direction: 'outbound',
          action: 'event_created',
          appointment_id: 'appt-1',
          external_event_id: 'gcal-1',
          status: 'success',
          error_message: null,
          created_at: new Date(),
        },
        {
          id: 'log-2',
          tenant_id: 'tenant-1',
          connection_id: 'conn-1',
          direction: 'outbound',
          action: 'event_updated',
          appointment_id: 'appt-1',
          external_event_id: 'gcal-1',
          status: 'success',
          error_message: null,
          created_at: new Date(),
        },
      ];

      mockPrismaService.calendar_sync_log.findMany.mockResolvedValue(mockLogs);

      const result = await service.getLogsForAppointment('appt-1');

      expect(prisma.calendar_sync_log.findMany).toHaveBeenCalledWith({
        where: { appointment_id: 'appt-1' },
        orderBy: { created_at: 'desc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('event_created');
      expect(result[1].action).toBe('event_updated');
    });
  });

  describe('countRecentFailures', () => {
    it('should count failed syncs in the last 24 hours', async () => {
      mockPrismaService.calendar_sync_log.count.mockResolvedValue(5);

      const result = await service.countRecentFailures('tenant-1');

      expect(prisma.calendar_sync_log.count).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          status: 'failed',
          created_at: {
            gte: expect.any(Date),
          },
        },
      });

      expect(result).toBe(5);
    });

    it('should return 0 if no recent failures', async () => {
      mockPrismaService.calendar_sync_log.count.mockResolvedValue(0);

      const result = await service.countRecentFailures('tenant-1');

      expect(result).toBe(0);
    });
  });

  describe('countRecentSuccesses - Sprint 16', () => {
    it('should count successful syncs in the last 24 hours', async () => {
      mockPrismaService.calendar_sync_log.count.mockResolvedValue(125);

      const result = await service.countRecentSuccesses('tenant-1');

      expect(prisma.calendar_sync_log.count).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          status: 'success',
          created_at: {
            gte: expect.any(Date),
          },
        },
      });

      expect(result).toBe(125);
    });

    it('should return 0 if no recent successes', async () => {
      mockPrismaService.calendar_sync_log.count.mockResolvedValue(0);

      const result = await service.countRecentSuccesses('tenant-1');

      expect(result).toBe(0);
    });
  });

  describe('getLastSyncTimestamp - Sprint 16', () => {
    it('should return the timestamp of the last successful sync', async () => {
      const lastSyncDate = new Date('2026-03-03T10:00:00Z');
      mockPrismaService.calendar_sync_log.findFirst.mockResolvedValue({
        created_at: lastSyncDate,
      });

      const result = await service.getLastSyncTimestamp('tenant-1');

      expect(prisma.calendar_sync_log.findFirst).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          status: 'success',
        },
        orderBy: {
          created_at: 'desc',
        },
        select: {
          created_at: true,
        },
      });

      expect(result).toEqual(lastSyncDate);
    });

    it('should return null if no successful syncs found', async () => {
      mockPrismaService.calendar_sync_log.findFirst.mockResolvedValue(null);

      const result = await service.getLastSyncTimestamp('tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('getPaginatedLogs - Sprint 16', () => {
    it('should return paginated logs with no filters', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          tenant_id: 'tenant-1',
          connection_id: 'conn-1',
          direction: 'outbound',
          action: 'event_created',
          appointment_id: 'appt-1',
          external_event_id: 'gcal-1',
          status: 'success',
          error_message: null,
          metadata: null,
          created_at: new Date('2026-03-03T10:00:00Z'),
        },
        {
          id: 'log-2',
          tenant_id: 'tenant-1',
          connection_id: 'conn-1',
          direction: 'inbound',
          action: 'webhook_received',
          appointment_id: null,
          external_event_id: null,
          status: 'success',
          error_message: null,
          metadata: { resourceState: 'exists' },
          created_at: new Date('2026-03-03T09:30:00Z'),
        },
      ];

      mockPrismaService.calendar_sync_log.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.calendar_sync_log.count.mockResolvedValue(234);

      const result = await service.getPaginatedLogs('tenant-1', {
        page: 1,
        limit: 50,
      });

      expect(prisma.calendar_sync_log.findMany).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-1' },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 50,
      });

      expect(prisma.calendar_sync_log.count).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-1' },
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('log-1');
      expect(result.data[1].id).toBe('log-2');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 234,
        totalPages: 5,
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.calendar_sync_log.findMany.mockResolvedValue([]);
      mockPrismaService.calendar_sync_log.count.mockResolvedValue(10);

      await service.getPaginatedLogs('tenant-1', {
        page: 1,
        limit: 50,
        status: 'failed',
      });

      expect(prisma.calendar_sync_log.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          status: 'failed',
        },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 50,
      });
    });

    it('should filter by direction', async () => {
      mockPrismaService.calendar_sync_log.findMany.mockResolvedValue([]);
      mockPrismaService.calendar_sync_log.count.mockResolvedValue(15);

      await service.getPaginatedLogs('tenant-1', {
        page: 1,
        limit: 50,
        direction: 'inbound',
      });

      expect(prisma.calendar_sync_log.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          direction: 'inbound',
        },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 50,
      });
    });

    it('should filter by action', async () => {
      mockPrismaService.calendar_sync_log.findMany.mockResolvedValue([]);
      mockPrismaService.calendar_sync_log.count.mockResolvedValue(8);

      await service.getPaginatedLogs('tenant-1', {
        page: 1,
        limit: 50,
        action: 'event_created',
      });

      expect(prisma.calendar_sync_log.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          action: 'event_created',
        },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 50,
      });
    });

    it('should apply multiple filters simultaneously', async () => {
      mockPrismaService.calendar_sync_log.findMany.mockResolvedValue([]);
      mockPrismaService.calendar_sync_log.count.mockResolvedValue(3);

      await service.getPaginatedLogs('tenant-1', {
        page: 2,
        limit: 25,
        status: 'success',
        direction: 'outbound',
        action: 'event_created',
      });

      expect(prisma.calendar_sync_log.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          status: 'success',
          direction: 'outbound',
          action: 'event_created',
        },
        orderBy: { created_at: 'desc' },
        skip: 25,
        take: 25,
      });
    });

    it('should calculate pagination correctly for page 2', async () => {
      mockPrismaService.calendar_sync_log.findMany.mockResolvedValue([]);
      mockPrismaService.calendar_sync_log.count.mockResolvedValue(150);

      const result = await service.getPaginatedLogs('tenant-1', {
        page: 2,
        limit: 50,
      });

      expect(prisma.calendar_sync_log.findMany).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-1' },
        orderBy: { created_at: 'desc' },
        skip: 50,
        take: 50,
      });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 50,
        total: 150,
        totalPages: 3,
      });
    });
  });
});
