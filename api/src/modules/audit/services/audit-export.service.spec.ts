import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuditExportService } from './audit-export.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('AuditExportService', () => {
  let service: AuditExportService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockTenantId = 'tenant-123';

  const mockAuditLogs = [
    {
      id: 'log-1',
      tenant_id: mockTenantId,
      actor_user_id: 'user-1',
      actor_type: 'user',
      entity_type: 'lead',
      entity_id: 'lead-1',
      description: 'Lead created',
      action_type: 'created',
      status: 'success',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      error_message: null,
      before_json: null,
      after_json: { name: 'Test Lead' },
      metadata_json: { source: 'web' },
      created_at: new Date('2026-01-01T10:00:00Z'),
      actor: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      },
      tenant: {
        legal_name: 'Test Company LLC',
        subdomain: 'testco',
      },
    },
    {
      id: 'log-2',
      tenant_id: mockTenantId,
      actor_user_id: 'user-1',
      actor_type: 'user',
      entity_type: 'lead',
      entity_id: 'lead-1',
      description: 'Lead updated',
      action_type: 'updated',
      status: 'success',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      error_message: null,
      before_json: { name: 'Test Lead' },
      after_json: { name: 'Updated Lead' },
      metadata_json: null,
      created_at: new Date('2026-01-02T14:30:00Z'),
      actor: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      },
      tenant: {
        legal_name: 'Test Company LLC',
        subdomain: 'testco',
      },
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      auditLog: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditExportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditExportService>(AuditExportService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('export', () => {
    it('should enforce 10,000 row limit', async () => {
      prismaService.audit_log.count.mockResolvedValue(10001);

      await expect(service.export({}, false, mockTenantId)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.export({}, false, mockTenantId)).rejects.toThrow(
        /Too many results.*10001.*Maximum 10000/,
      );
    });

    it('should throw error if no results found', async () => {
      prismaService.audit_log.count.mockResolvedValue(0);

      await expect(service.export({}, false, mockTenantId)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.export({}, false, mockTenantId)).rejects.toThrow(
        /No audit logs found/,
      );
    });

    it('should enforce tenant isolation for non-platform admin', async () => {
      prismaService.audit_log.count.mockResolvedValue(2);
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);

      await service.export({}, false, mockTenantId);

      expect(prismaService.audit_log.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenant_id: mockTenantId,
        }),
      });
    });

    it('should throw error if tenantId missing for non-platform admin', async () => {
      await expect(service.export({}, false, undefined)).rejects.toThrow(
        'Tenant ID is required for non-platform admin users',
      );
    });

    it('should allow cross-tenant export for platform admin', async () => {
      prismaService.audit_log.count.mockResolvedValue(2);
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);

      await service.export({}, true, undefined);

      expect(prismaService.audit_log.count).toHaveBeenCalledWith({
        where: expect.not.objectContaining({
          tenant_id: expect.anything(),
        }),
      });
    });

    it('should apply date filters', async () => {
      prismaService.audit_log.count.mockResolvedValue(2);
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);

      await service.export(
        {
          start_date: '2026-01-01',
          end_date: '2026-01-31',
        },
        false,
        mockTenantId,
      );

      expect(prismaService.audit_log.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          created_at: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31'),
          },
        }),
      });
    });

    it('should apply all filters', async () => {
      prismaService.audit_log.count.mockResolvedValue(1);
      prismaService.audit_log.findMany.mockResolvedValue([mockAuditLogs[0]]);

      await service.export(
        {
          actor_user_id: 'user-1',
          actor_type: 'user',
          action_type: 'created',
          entity_type: 'lead',
          status: 'success',
          search: 'Lead created',
        },
        false,
        mockTenantId,
      );

      expect(prismaService.audit_log.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          actor_user_id: 'user-1',
          actor_type: 'user',
          action_type: 'created',
          entity_type: 'lead',
          status: 'success',
          description: { contains: 'Lead created' },
        }),
      });
    });
  });

  describe('CSV export', () => {
    it('should export to CSV format', async () => {
      prismaService.audit_log.count.mockResolvedValue(2);
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);

      const result = await service.export(
        { format: 'csv' },
        false,
        mockTenantId,
      );

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^audit-log-testco-.+\.csv$/);
      expect(result.data).toContain('Timestamp');
      expect(result.data).toContain('Actor');
      expect(result.data).toContain('John Doe (john@example.com)');
      expect(result.data).toContain('Lead created');
      expect(result.data).toContain('Lead updated');
    });

    it('should include all required CSV columns', async () => {
      prismaService.audit_log.count.mockResolvedValue(1);
      prismaService.audit_log.findMany.mockResolvedValue([mockAuditLogs[0]]);

      const result = await service.export(
        { format: 'csv' },
        false,
        mockTenantId,
      );

      const headers = [
        'Timestamp',
        'Actor',
        'Actor Type',
        'Tenant',
        'Action',
        'Entity Type',
        'Entity ID',
        'Description',
        'Status',
        'IP Address',
        'Error Message',
      ];

      headers.forEach((header) => {
        expect(result.data).toContain(header);
      });
    });

    it('should handle null values in CSV', async () => {
      const logWithNulls = {
        ...mockAuditLogs[0],
        actor: null,
        ip_address: null,
        error_message: null,
      };
      prismaService.audit_log.count.mockResolvedValue(1);
      prismaService.audit_log.findMany.mockResolvedValue([logWithNulls]);

      const result = await service.export(
        { format: 'csv' },
        false,
        mockTenantId,
      );

      expect(result.data).toContain('N/A');
    });

    it('should generate filename with date range', async () => {
      prismaService.audit_log.count.mockResolvedValue(2);
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);

      const result = await service.export(
        {
          format: 'csv',
          start_date: '2026-01-01',
          end_date: '2026-01-31',
        },
        false,
        mockTenantId,
      );

      expect(result.filename).toBe(
        'audit-log-testco-2026-01-01-2026-01-31.csv',
      );
    });
  });

  describe('JSON export', () => {
    it('should export to JSON format', async () => {
      prismaService.audit_log.count.mockResolvedValue(2);
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);

      const result = await service.export(
        { format: 'json' },
        false,
        mockTenantId,
      );

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toMatch(/^audit-log-testco-.+\.json$/);

      const parsed = JSON.parse(result.data);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toHaveProperty('id', 'log-1');
      expect(parsed[0]).toHaveProperty('timestamp');
      expect(parsed[0]).toHaveProperty('actor');
      expect(parsed[0]).toHaveProperty('tenant');
      expect(parsed[0]).toHaveProperty('action');
      expect(parsed[0]).toHaveProperty('entity');
      expect(parsed[0]).toHaveProperty('changes');
      expect(parsed[0]).toHaveProperty('metadata');
      expect(parsed[0]).toHaveProperty('request');
    });

    it('should include all structured data in JSON', async () => {
      prismaService.audit_log.count.mockResolvedValue(1);
      prismaService.audit_log.findMany.mockResolvedValue([mockAuditLogs[0]]);

      const result = await service.export(
        { format: 'json' },
        false,
        mockTenantId,
      );

      const parsed = JSON.parse(result.data);
      const log = parsed[0];

      expect(log.actor).toEqual({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        type: 'user',
      });

      expect(log.tenant).toEqual({
        id: mockTenantId,
        name: 'Test Company LLC',
        subdomain: 'testco',
      });

      expect(log.action).toEqual({
        type: 'created',
        description: 'Lead created',
        status: 'success',
        error_message: null,
      });

      expect(log.entity).toEqual({
        type: 'lead',
        id: 'lead-1',
      });

      expect(log.changes).toEqual({
        before: null,
        after: { name: 'Test Lead' },
      });

      expect(log.metadata).toEqual({ source: 'web' });

      expect(log.request).toEqual({
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      });
    });

    it('should format JSON with proper indentation', async () => {
      prismaService.audit_log.count.mockResolvedValue(1);
      prismaService.audit_log.findMany.mockResolvedValue([mockAuditLogs[0]]);

      const result = await service.export(
        { format: 'json' },
        false,
        mockTenantId,
      );

      // Check for proper indentation (JSON.stringify with 2 spaces)
      expect(result.data).toContain('  ');
      expect(result.data).toMatch(/\[\n {2}\{/);
    });
  });

  describe('default format', () => {
    it('should default to CSV if format not specified', async () => {
      prismaService.audit_log.count.mockResolvedValue(2);
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);

      const result = await service.export({}, false, mockTenantId);

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/\.csv$/);
    });
  });
});
