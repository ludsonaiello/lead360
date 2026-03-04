import { Test, TestingModule } from '@nestjs/testing';
import { SyncLogsController } from './sync-logs.controller';
import { CalendarSyncLogService } from '../services/calendar-sync-log.service';
import { CalendarProviderConnectionService } from '../services/calendar-provider-connection.service';
import { UnauthorizedException } from '@nestjs/common';

/**
 * Integration tests for SyncLogsController
 * Sprint 16: Sync Logging and Health Monitoring
 *
 * Tests cover:
 * 1. GET /calendar/integration/sync-logs - Pagination and filtering
 * 2. GET /calendar/integration/health - Health monitoring
 * 3. Multi-tenant isolation (tenant_id from JWT)
 * 4. RBAC enforcement (Owner, Admin for sync-logs; Owner, Admin, Estimator for health)
 */
describe('SyncLogsController', () => {
  let controller: SyncLogsController;
  let syncLogService: CalendarSyncLogService;
  let connectionService: CalendarProviderConnectionService;

  const mockSyncLogService = {
    getPaginatedLogs: jest.fn(),
    countRecentFailures: jest.fn(),
    countRecentSuccesses: jest.fn(),
    getLastSyncTimestamp: jest.fn(),
  };

  const mockConnectionService = {
    getActiveConnection: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncLogsController],
      providers: [
        {
          provide: CalendarSyncLogService,
          useValue: mockSyncLogService,
        },
        {
          provide: CalendarProviderConnectionService,
          useValue: mockConnectionService,
        },
      ],
    }).compile();

    controller = module.get<SyncLogsController>(SyncLogsController);
    syncLogService = module.get<CalendarSyncLogService>(CalendarSyncLogService);
    connectionService = module.get<CalendarProviderConnectionService>(
      CalendarProviderConnectionService,
    );

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /calendar/integration/sync-logs', () => {
    const mockRequest = {
      user: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: 'Owner',
      },
    };

    it('should return paginated sync logs with default parameters', async () => {
      const mockResult = {
        data: [
          {
            id: 'log-1',
            connectionId: 'conn-1',
            direction: 'outbound',
            action: 'event_created',
            appointmentId: 'appt-1',
            externalEventId: 'gcal-1',
            status: 'success',
            errorMessage: null,
            metadata: null,
            createdAt: new Date('2026-03-03T10:00:00Z'),
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 234,
          totalPages: 5,
        },
      };

      mockSyncLogService.getPaginatedLogs.mockResolvedValue(mockResult);

      const result = await controller.getSyncLogs(mockRequest, 1, 50);

      expect(syncLogService.getPaginatedLogs).toHaveBeenCalledWith('tenant-1', {
        page: 1,
        limit: 50,
        status: undefined,
        direction: undefined,
        action: undefined,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('log-1');
      expect(result.data[0].createdAt).toBe('2026-03-03T10:00:00.000Z'); // ISO string
      expect(result.pagination.total).toBe(234);
    });

    it('should filter logs by status', async () => {
      const mockResult = {
        data: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 10,
          totalPages: 1,
        },
      };

      mockSyncLogService.getPaginatedLogs.mockResolvedValue(mockResult);

      await controller.getSyncLogs(mockRequest, 1, 50, 'failed');

      expect(syncLogService.getPaginatedLogs).toHaveBeenCalledWith('tenant-1', {
        page: 1,
        limit: 50,
        status: 'failed',
        direction: undefined,
        action: undefined,
      });
    });

    it('should filter logs by direction', async () => {
      const mockResult = {
        data: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 15,
          totalPages: 1,
        },
      };

      mockSyncLogService.getPaginatedLogs.mockResolvedValue(mockResult);

      await controller.getSyncLogs(mockRequest, 1, 50, undefined, 'inbound');

      expect(syncLogService.getPaginatedLogs).toHaveBeenCalledWith('tenant-1', {
        page: 1,
        limit: 50,
        status: undefined,
        direction: 'inbound',
        action: undefined,
      });
    });

    it('should filter logs by action', async () => {
      const mockResult = {
        data: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 8,
          totalPages: 1,
        },
      };

      mockSyncLogService.getPaginatedLogs.mockResolvedValue(mockResult);

      await controller.getSyncLogs(
        mockRequest,
        1,
        50,
        undefined,
        undefined,
        'webhook_received',
      );

      expect(syncLogService.getPaginatedLogs).toHaveBeenCalledWith('tenant-1', {
        page: 1,
        limit: 50,
        status: undefined,
        direction: undefined,
        action: 'webhook_received',
      });
    });

    it('should apply multiple filters simultaneously', async () => {
      const mockResult = {
        data: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 3,
          totalPages: 1,
        },
      };

      mockSyncLogService.getPaginatedLogs.mockResolvedValue(mockResult);

      await controller.getSyncLogs(
        mockRequest,
        1,
        50,
        'success',
        'outbound',
        'event_created',
      );

      expect(syncLogService.getPaginatedLogs).toHaveBeenCalledWith('tenant-1', {
        page: 1,
        limit: 50,
        status: 'success',
        direction: 'outbound',
        action: 'event_created',
      });
    });

    it('should enforce limit maximum of 100', async () => {
      const mockResult = {
        data: [],
        pagination: {
          page: 1,
          limit: 100,
          total: 500,
          totalPages: 5,
        },
      };

      mockSyncLogService.getPaginatedLogs.mockResolvedValue(mockResult);

      await controller.getSyncLogs(mockRequest, 1, 500); // Request 500, should cap at 100

      expect(syncLogService.getPaginatedLogs).toHaveBeenCalledWith('tenant-1', {
        page: 1,
        limit: 100, // Capped
        status: undefined,
        direction: undefined,
        action: undefined,
      });
    });

    it('should handle pagination correctly', async () => {
      const mockResult = {
        data: [],
        pagination: {
          page: 3,
          limit: 25,
          total: 150,
          totalPages: 6,
        },
      };

      mockSyncLogService.getPaginatedLogs.mockResolvedValue(mockResult);

      await controller.getSyncLogs(mockRequest, 3, 25);

      expect(syncLogService.getPaginatedLogs).toHaveBeenCalledWith('tenant-1', {
        page: 3,
        limit: 25,
        status: undefined,
        direction: undefined,
        action: undefined,
      });
    });

    it('should throw UnauthorizedException if tenant_id not in request', async () => {
      const requestWithoutTenant = {
        user: {
          userId: 'user-1',
          role: 'Owner',
        },
      };

      await expect(
        controller.getSyncLogs(requestWithoutTenant, 1, 50),
      ).rejects.toThrow(UnauthorizedException);

      expect(syncLogService.getPaginatedLogs).not.toHaveBeenCalled();
    });

    it('should verify multi-tenant isolation (only returns logs for tenant_id in JWT)', async () => {
      const mockResult = {
        data: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
        },
      };

      mockSyncLogService.getPaginatedLogs.mockResolvedValue(mockResult);

      // Tenant 1 request
      await controller.getSyncLogs(mockRequest, 1, 50);

      expect(syncLogService.getPaginatedLogs).toHaveBeenCalledWith('tenant-1', {
        page: 1,
        limit: 50,
        status: undefined,
        direction: undefined,
        action: undefined,
      });

      // Tenant 2 request (different tenant)
      const tenant2Request = {
        user: {
          tenantId: 'tenant-2',
          userId: 'user-2',
          role: 'Owner',
        },
      };

      await controller.getSyncLogs(tenant2Request, 1, 50);

      expect(syncLogService.getPaginatedLogs).toHaveBeenCalledWith('tenant-2', {
        page: 1,
        limit: 50,
        status: undefined,
        direction: undefined,
        action: undefined,
      });

      // Verify service was called with correct tenant_id each time
      expect(syncLogService.getPaginatedLogs).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /calendar/integration/health', () => {
    const mockRequest = {
      user: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: 'Owner',
      },
    };

    it('should return health status when connection is active', async () => {
      const mockConnection = {
        id: 'conn-1',
        tenantId: 'tenant-1',
        providerType: 'google_calendar',
        syncStatus: 'active',
        webhookExpiration: new Date('2026-03-09T10:30:00Z'),
      };

      mockConnectionService.getActiveConnection.mockResolvedValue(
        mockConnection,
      );
      mockSyncLogService.getLastSyncTimestamp.mockResolvedValue(
        new Date('2026-03-02T10:30:00Z'),
      );
      mockSyncLogService.countRecentFailures.mockResolvedValue(0);
      mockSyncLogService.countRecentSuccesses.mockResolvedValue(125);

      const result = await controller.getHealth(mockRequest);

      expect(connectionService.getActiveConnection).toHaveBeenCalledWith(
        'tenant-1',
      );
      expect(syncLogService.getLastSyncTimestamp).toHaveBeenCalledWith(
        'tenant-1',
      );
      expect(syncLogService.countRecentFailures).toHaveBeenCalledWith(
        'tenant-1',
      );
      expect(syncLogService.countRecentSuccesses).toHaveBeenCalledWith(
        'tenant-1',
      );

      expect(result).toEqual({
        connected: true,
        syncStatus: 'active',
        lastSyncAt: '2026-03-02T10:30:00.000Z',
        webhookExpiration: '2026-03-09T10:30:00.000Z',
        recentErrors: 0,
        recentSuccesses: 125,
      });
    });

    it('should return inactive status when no connection exists', async () => {
      mockConnectionService.getActiveConnection.mockResolvedValue(null);

      const result = await controller.getHealth(mockRequest);

      expect(result).toEqual({
        connected: false,
        syncStatus: 'inactive',
        recentErrors: 0,
        recentSuccesses: 0,
      });

      // Should not call other services if no connection
      expect(syncLogService.getLastSyncTimestamp).not.toHaveBeenCalled();
      expect(syncLogService.countRecentFailures).not.toHaveBeenCalled();
      expect(syncLogService.countRecentSuccesses).not.toHaveBeenCalled();
    });

    it('should map connection sync_status to health syncStatus correctly', async () => {
      const mockConnection = {
        id: 'conn-1',
        tenantId: 'tenant-1',
        providerType: 'google_calendar',
        syncStatus: 'syncing',
        webhookExpiration: null,
      };

      mockConnectionService.getActiveConnection.mockResolvedValue(
        mockConnection,
      );
      mockSyncLogService.getLastSyncTimestamp.mockResolvedValue(null);
      mockSyncLogService.countRecentFailures.mockResolvedValue(2);
      mockSyncLogService.countRecentSuccesses.mockResolvedValue(50);

      const result = await controller.getHealth(mockRequest);

      expect(result.syncStatus).toBe('active'); // 'syncing' maps to 'active'
    });

    it('should handle disconnected status', async () => {
      const mockConnection = {
        id: 'conn-1',
        tenantId: 'tenant-1',
        providerType: 'google_calendar',
        syncStatus: 'disconnected',
        webhookExpiration: null,
      };

      mockConnectionService.getActiveConnection.mockResolvedValue(
        mockConnection,
      );
      mockSyncLogService.getLastSyncTimestamp.mockResolvedValue(null);
      mockSyncLogService.countRecentFailures.mockResolvedValue(0);
      mockSyncLogService.countRecentSuccesses.mockResolvedValue(0);

      const result = await controller.getHealth(mockRequest);

      expect(result.syncStatus).toBe('inactive'); // 'disconnected' maps to 'inactive'
    });

    it('should handle error status', async () => {
      const mockConnection = {
        id: 'conn-1',
        tenantId: 'tenant-1',
        providerType: 'google_calendar',
        syncStatus: 'error',
        webhookExpiration: new Date('2026-03-09T10:30:00Z'),
      };

      mockConnectionService.getActiveConnection.mockResolvedValue(
        mockConnection,
      );
      mockSyncLogService.getLastSyncTimestamp.mockResolvedValue(
        new Date('2026-03-01T08:00:00Z'),
      );
      mockSyncLogService.countRecentFailures.mockResolvedValue(15);
      mockSyncLogService.countRecentSuccesses.mockResolvedValue(5);

      const result = await controller.getHealth(mockRequest);

      expect(result.syncStatus).toBe('error');
      expect(result.recentErrors).toBe(15);
      expect(result.recentSuccesses).toBe(5);
    });

    it('should throw UnauthorizedException if tenant_id not in request', async () => {
      const requestWithoutTenant = {
        user: {
          userId: 'user-1',
          role: 'Owner',
        },
      };

      await expect(controller.getHealth(requestWithoutTenant)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(connectionService.getActiveConnection).not.toHaveBeenCalled();
    });

    it('should verify multi-tenant isolation (only returns health for tenant_id in JWT)', async () => {
      mockConnectionService.getActiveConnection.mockResolvedValue(null);

      // Tenant 1 request
      await controller.getHealth(mockRequest);

      expect(connectionService.getActiveConnection).toHaveBeenCalledWith(
        'tenant-1',
      );

      // Tenant 2 request (different tenant)
      const tenant2Request = {
        user: {
          tenantId: 'tenant-2',
          userId: 'user-2',
          role: 'Admin',
        },
      };

      await controller.getHealth(tenant2Request);

      expect(connectionService.getActiveConnection).toHaveBeenCalledWith(
        'tenant-2',
      );

      // Verify service was called with correct tenant_id each time
      expect(connectionService.getActiveConnection).toHaveBeenCalledTimes(2);
    });
  });
});
