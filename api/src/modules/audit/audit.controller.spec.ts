import { Test, TestingModule } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { AuditReaderService } from './services/audit-reader.service';
import { AuditExportService } from './services/audit-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../rbac/guards/permission.guard';

describe('AuditController', () => {
  let controller: AuditController;
  let readerService: jest.Mocked<AuditReaderService>;
  let exportService: jest.Mocked<AuditExportService>;

  const mockUser = {
    id: 'user-123',
    tenant_id: 'tenant-456',
    is_platform_admin: false,
  };

  const mockPlatformAdmin = {
    id: 'admin-123',
    tenant_id: null,
    is_platform_admin: true,
  };

  const mockAuditLogs = {
    data: [
      {
        id: 'log-1',
        tenant_id: 'tenant-456',
        actor_user_id: 'user-123',
        description: 'Lead created',
        action_type: 'created',
        created_at: new Date(),
      },
    ],
    pagination: {
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    },
  };

  beforeEach(async () => {
    const mockReaderService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByUser: jest.fn(),
    };

    const mockExportService = {
      export: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditReaderService,
          useValue: mockReaderService,
        },
        {
          provide: AuditExportService,
          useValue: mockExportService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuditController>(AuditController);
    readerService = module.get(AuditReaderService);
    exportService = module.get(AuditExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return audit logs for regular user', async () => {
      readerService.findAll.mockResolvedValue(mockAuditLogs);

      const result = await controller.findAll(
        { user: mockUser },
        { page: 1, limit: 50 },
      );

      expect(result).toEqual(mockAuditLogs);
      expect(readerService.findAll).toHaveBeenCalledWith(
        { page: 1, limit: 50 },
        false,
        'tenant-456',
      );
    });

    it('should pass isPlatformAdmin flag for platform admin', async () => {
      readerService.findAll.mockResolvedValue(mockAuditLogs);

      await controller.findAll(
        { user: mockPlatformAdmin },
        { page: 1, limit: 50 },
      );

      expect(readerService.findAll).toHaveBeenCalledWith(
        { page: 1, limit: 50 },
        true,
        null,
      );
    });

    it('should pass all query filters to service', async () => {
      readerService.findAll.mockResolvedValue(mockAuditLogs);

      const query = {
        page: 2,
        limit: 25,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        actor_user_id: 'user-789',
        actor_type: 'user' as const,
        action_type: 'created' as const,
        entity_type: 'lead',
        entity_id: 'lead-123',
        status: 'success' as const,
        search: 'Lead created',
      };

      await controller.findAll({ user: mockUser }, query);

      expect(readerService.findAll).toHaveBeenCalledWith(
        query,
        false,
        'tenant-456',
      );
    });

    it('should handle user without is_platform_admin flag', async () => {
      const userWithoutFlag = { id: 'user-123', tenant_id: 'tenant-456' };
      readerService.findAll.mockResolvedValue(mockAuditLogs);

      await controller.findAll({ user: userWithoutFlag }, {});

      expect(readerService.findAll).toHaveBeenCalledWith(
        {},
        false,
        'tenant-456',
      );
    });
  });

  describe('export', () => {
    it('should export audit logs to CSV', async () => {
      const exportData = {
        data: 'Timestamp,Actor,Action\n2026-01-01,John Doe,created',
        filename: 'audit-log-testco-2026-01-01-2026-01-31.csv',
        contentType: 'text/csv',
      };
      exportService.export.mockResolvedValue(exportData);

      const result = await controller.export(
        { user: mockUser },
        { format: 'csv', start_date: '2026-01-01', end_date: '2026-01-31' },
      );

      expect(result).toBeInstanceOf(StreamableFile);
      expect(exportService.export).toHaveBeenCalledWith(
        { format: 'csv', start_date: '2026-01-01', end_date: '2026-01-31' },
        false,
        'tenant-456',
      );
    });

    it('should export audit logs to JSON', async () => {
      const exportData = {
        data: '[{"id":"log-1","timestamp":"2026-01-01T00:00:00Z"}]',
        filename: 'audit-log-testco-all-all.json',
        contentType: 'application/json',
      };
      exportService.export.mockResolvedValue(exportData);

      const result = await controller.export(
        { user: mockUser },
        { format: 'json' },
      );

      expect(result).toBeInstanceOf(StreamableFile);
      expect(exportService.export).toHaveBeenCalledWith(
        { format: 'json' },
        false,
        'tenant-456',
      );
    });

    it('should allow platform admin to export', async () => {
      const exportData = {
        data: 'CSV data',
        filename: 'audit-log.csv',
        contentType: 'text/csv',
      };
      exportService.export.mockResolvedValue(exportData);

      await controller.export({ user: mockPlatformAdmin }, {});

      expect(exportService.export).toHaveBeenCalledWith({}, true, null);
    });
  });

  describe('findOne', () => {
    it('should return single audit log by id', async () => {
      const mockLog = {
        id: 'log-123',
        tenant_id: 'tenant-456',
        description: 'Lead created',
      };
      readerService.findOne.mockResolvedValue(mockLog);

      const result = await controller.findOne({ user: mockUser }, 'log-123');

      expect(result).toEqual(mockLog);
      expect(readerService.findOne).toHaveBeenCalledWith(
        'log-123',
        false,
        'tenant-456',
      );
    });

    it('should allow platform admin to view any log', async () => {
      const mockLog = {
        id: 'log-123',
        tenant_id: 'other-tenant',
        description: 'Lead created',
      };
      readerService.findOne.mockResolvedValue(mockLog);

      await controller.findOne({ user: mockPlatformAdmin }, 'log-123');

      expect(readerService.findOne).toHaveBeenCalledWith('log-123', true, null);
    });
  });

  describe('findByUser', () => {
    it('should return audit logs for specific user', async () => {
      readerService.findByUser.mockResolvedValue(mockAuditLogs);

      const result = await controller.findByUser(
        { user: mockUser },
        'user-789',
        { page: 1, limit: 50 },
      );

      expect(result).toEqual(mockAuditLogs);
      expect(readerService.findByUser).toHaveBeenCalledWith(
        'user-789',
        { page: 1, limit: 50 },
        false,
        'tenant-456',
      );
    });

    it('should apply date filters for user logs', async () => {
      readerService.findByUser.mockResolvedValue(mockAuditLogs);

      await controller.findByUser({ user: mockUser }, 'user-789', {
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      });

      expect(readerService.findByUser).toHaveBeenCalledWith(
        'user-789',
        { start_date: '2026-01-01', end_date: '2026-01-31' },
        false,
        'tenant-456',
      );
    });
  });

  describe('findByTenant', () => {
    it('should return audit logs for specific tenant (platform admin)', async () => {
      readerService.findAll.mockResolvedValue(mockAuditLogs);

      const result = await controller.findByTenant(
        { user: mockPlatformAdmin },
        'tenant-other',
        { page: 1, limit: 50 },
      );

      expect(result).toEqual(mockAuditLogs);
      expect(readerService.findAll).toHaveBeenCalledWith(
        { page: 1, limit: 50, tenant_id: 'tenant-other' },
        true,
        'tenant-other',
      );
    });

    it('should force tenantId from URL parameter', async () => {
      readerService.findAll.mockResolvedValue(mockAuditLogs);

      await controller.findByTenant({ user: mockPlatformAdmin }, 'tenant-123', {
        page: 1,
      });

      const callArgs = readerService.findAll.mock.calls[0];
      expect(callArgs[0]).toHaveProperty('tenant_id', 'tenant-123');
      expect(callArgs[2]).toBe('tenant-123');
    });

    it('should apply date filters for tenant logs', async () => {
      readerService.findAll.mockResolvedValue(mockAuditLogs);

      await controller.findByTenant({ user: mockPlatformAdmin }, 'tenant-123', {
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      });

      expect(readerService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-123',
          start_date: '2026-01-01',
          end_date: '2026-01-31',
        }),
        true,
        'tenant-123',
      );
    });
  });
});
