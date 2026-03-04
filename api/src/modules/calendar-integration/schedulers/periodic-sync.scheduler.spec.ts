import { Test, TestingModule } from '@nestjs/testing';
import { PeriodicSyncScheduler } from './periodic-sync.scheduler';
import { PrismaService } from '../../../core/database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

describe('PeriodicSyncScheduler', () => {
  let scheduler: PeriodicSyncScheduler;
  let prisma: jest.Mocked<PrismaService>;
  let syncQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    // Create mock services
    const mockPrismaService = {
      calendar_provider_connection: {
        findMany: jest.fn(),
      },
    };

    const mockSyncQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodicSyncScheduler,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken('calendar-sync'),
          useValue: mockSyncQueue,
        },
      ],
    }).compile();

    scheduler = module.get<PeriodicSyncScheduler>(PeriodicSyncScheduler);
    prisma = module.get(PrismaService);
    syncQueue = module.get(getQueueToken('calendar-sync'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('handlePeriodicSync', () => {
    it('should do nothing when no active connections exist', async () => {
      // Arrange
      prisma.calendar_provider_connection.findMany.mockResolvedValue([]);

      // Act
      await scheduler.handlePeriodicSync();

      // Assert
      expect(prisma.calendar_provider_connection.findMany).toHaveBeenCalledWith(
        {
          where: {
            is_active: true,
            sync_status: 'active',
          },
          orderBy: [
            {
              last_sync_at: {
                sort: 'asc',
                nulls: 'first',
              },
            },
          ],
          select: {
            id: true,
            tenant_id: true,
            provider_type: true,
            last_sync_at: true,
          },
        },
      );
      expect(syncQueue.add).not.toHaveBeenCalled();
    });

    it('should queue sync job for a single active connection', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-123',
        tenant_id: 'tenant-123',
        provider_type: 'google_calendar',
        last_sync_at: new Date('2026-03-03T06:00:00Z'),
      };

      prisma.calendar_provider_connection.findMany.mockResolvedValue([
        mockConnection,
      ]);
      syncQueue.add.mockResolvedValue(undefined as any);

      // Act
      await scheduler.handlePeriodicSync();

      // Assert
      expect(prisma.calendar_provider_connection.findMany).toHaveBeenCalledTimes(
        1,
      );
      expect(syncQueue.add).toHaveBeenCalledTimes(1);
      expect(syncQueue.add).toHaveBeenCalledWith('incremental-sync', {
        tenantId: 'tenant-123',
        connectionId: 'conn-123',
        trigger: 'scheduled',
      });
    });

    it('should queue sync jobs for multiple active connections', async () => {
      // Arrange
      const mockConnections = [
        {
          id: 'conn-1',
          tenant_id: 'tenant-1',
          provider_type: 'google_calendar',
          last_sync_at: new Date('2026-03-03T06:00:00Z'),
        },
        {
          id: 'conn-2',
          tenant_id: 'tenant-2',
          provider_type: 'google_calendar',
          last_sync_at: new Date('2026-03-03T08:00:00Z'),
        },
        {
          id: 'conn-3',
          tenant_id: 'tenant-3',
          provider_type: 'google_calendar',
          last_sync_at: null, // Never synced - should be prioritized
        },
      ];

      prisma.calendar_provider_connection.findMany.mockResolvedValue(
        mockConnections,
      );
      syncQueue.add.mockResolvedValue(undefined as any);

      // Act
      await scheduler.handlePeriodicSync();

      // Assert
      expect(syncQueue.add).toHaveBeenCalledTimes(3);

      // Verify all connections were queued
      expect(syncQueue.add).toHaveBeenNthCalledWith(1, 'incremental-sync', {
        tenantId: 'tenant-1',
        connectionId: 'conn-1',
        trigger: 'scheduled',
      });

      expect(syncQueue.add).toHaveBeenNthCalledWith(2, 'incremental-sync', {
        tenantId: 'tenant-2',
        connectionId: 'conn-2',
        trigger: 'scheduled',
      });

      expect(syncQueue.add).toHaveBeenNthCalledWith(3, 'incremental-sync', {
        tenantId: 'tenant-3',
        connectionId: 'conn-3',
        trigger: 'scheduled',
      });
    });

    it('should continue queuing other connections if one fails', async () => {
      // Arrange
      const mockConnections = [
        {
          id: 'conn-1',
          tenant_id: 'tenant-1',
          provider_type: 'google_calendar',
          last_sync_at: new Date('2026-03-03T06:00:00Z'),
        },
        {
          id: 'conn-2',
          tenant_id: 'tenant-2',
          provider_type: 'google_calendar',
          last_sync_at: new Date('2026-03-03T08:00:00Z'),
        },
        {
          id: 'conn-3',
          tenant_id: 'tenant-3',
          provider_type: 'google_calendar',
          last_sync_at: new Date('2026-03-03T10:00:00Z'),
        },
      ];

      prisma.calendar_provider_connection.findMany.mockResolvedValue(
        mockConnections,
      );

      // First queue succeeds, second fails, third succeeds
      syncQueue.add
        .mockResolvedValueOnce(undefined as any)
        .mockRejectedValueOnce(new Error('Queue connection error'))
        .mockResolvedValueOnce(undefined as any);

      // Act
      await scheduler.handlePeriodicSync();

      // Assert
      expect(syncQueue.add).toHaveBeenCalledTimes(3);

      // Verify connections 1 and 3 were queued despite connection 2 failing
      expect(syncQueue.add).toHaveBeenNthCalledWith(1, 'incremental-sync', {
        tenantId: 'tenant-1',
        connectionId: 'conn-1',
        trigger: 'scheduled',
      });

      expect(syncQueue.add).toHaveBeenNthCalledWith(3, 'incremental-sync', {
        tenantId: 'tenant-3',
        connectionId: 'conn-3',
        trigger: 'scheduled',
      });
    });

    it('should not throw error if database query fails', async () => {
      // Arrange
      prisma.calendar_provider_connection.findMany.mockRejectedValue(
        new Error('Database connection error'),
      );

      // Act & Assert
      await expect(scheduler.handlePeriodicSync()).resolves.not.toThrow();
      expect(syncQueue.add).not.toHaveBeenCalled();
    });

    it('should handle connections that have never been synced (null last_sync_at)', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-new',
        tenant_id: 'tenant-new',
        provider_type: 'google_calendar',
        last_sync_at: null,
      };

      prisma.calendar_provider_connection.findMany.mockResolvedValue([
        mockConnection,
      ]);
      syncQueue.add.mockResolvedValue(undefined as any);

      // Act
      await scheduler.handlePeriodicSync();

      // Assert
      expect(syncQueue.add).toHaveBeenCalledWith('incremental-sync', {
        tenantId: 'tenant-new',
        connectionId: 'conn-new',
        trigger: 'scheduled',
      });
    });
  });

  describe('triggerManualSync', () => {
    it('should call handlePeriodicSync when manually triggered', async () => {
      // Arrange
      const handlePeriodicSyncSpy = jest
        .spyOn(scheduler, 'handlePeriodicSync')
        .mockResolvedValue(undefined);

      // Act
      await scheduler.triggerManualSync();

      // Assert
      expect(handlePeriodicSyncSpy).toHaveBeenCalledTimes(1);
    });
  });
});
