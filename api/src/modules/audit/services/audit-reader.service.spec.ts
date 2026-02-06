import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditReaderService } from './audit-reader.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('AuditReaderService', () => {
  let service: AuditReaderService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockTenantId = 'tenant-123';
  const mockOtherTenantId = 'tenant-456';

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
      created_at: new Date('2026-01-01'),
      actor: {
        id: 'user-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      },
      tenant: {
        id: mockTenantId,
        legal_name: 'Test Company',
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
      created_at: new Date('2026-01-02'),
      actor: {
        id: 'user-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      },
      tenant: {
        id: mockTenantId,
        legal_name: 'Test Company',
        subdomain: 'testco',
      },
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      auditLog: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditReaderService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditReaderService>(AuditReaderService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should enforce tenant isolation for non-platform admin', async () => {
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);
      prismaService.audit_log.count.mockResolvedValue(2);

      await service.findAll({}, false, mockTenantId);

      expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: mockTenantId,
          }),
        }),
      );
    });

    it('should throw error if tenantId missing for non-platform admin', async () => {
      await expect(service.findAll({}, false, undefined)).rejects.toThrow(
        'Tenant ID is required for non-platform admin users',
      );
    });

    it('should allow cross-tenant access for platform admin', async () => {
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);
      prismaService.audit_log.count.mockResolvedValue(2);

      await service.findAll({}, true, undefined);

      expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            tenant_id: expect.anything(),
          }),
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      prismaService.audit_log.findMany.mockResolvedValue([mockAuditLogs[0]]);
      prismaService.audit_log.count.mockResolvedValue(2);

      const result = await service.findAll(
        { page: 2, limit: 1 },
        false,
        mockTenantId,
      );

      expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1,
          take: 1,
        }),
      );
      expect(result.pagination).toEqual({
        total: 2,
        page: 2,
        limit: 1,
        totalPages: 2,
      });
    });

    it('should apply date range filters', async () => {
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);
      prismaService.audit_log.count.mockResolvedValue(2);

      await service.findAll(
        {
          start_date: '2026-01-01',
          end_date: '2026-01-31',
        },
        false,
        mockTenantId,
      );

      expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          }),
        }),
      );
    });

    it('should apply actor filters', async () => {
      prismaService.audit_log.findMany.mockResolvedValue([mockAuditLogs[0]]);
      prismaService.audit_log.count.mockResolvedValue(1);

      await service.findAll(
        {
          actor_user_id: 'user-1',
          actor_type: 'user',
        },
        false,
        mockTenantId,
      );

      expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            actor_user_id: 'user-1',
            actor_type: 'user',
          }),
        }),
      );
    });

    it('should apply action and status filters', async () => {
      prismaService.audit_log.findMany.mockResolvedValue([mockAuditLogs[0]]);
      prismaService.audit_log.count.mockResolvedValue(1);

      await service.findAll(
        {
          action_type: 'created',
          status: 'success',
        },
        false,
        mockTenantId,
      );

      expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action_type: 'created',
            status: 'success',
          }),
        }),
      );
    });

    it('should apply search filter', async () => {
      prismaService.audit_log.findMany.mockResolvedValue([mockAuditLogs[0]]);
      prismaService.audit_log.count.mockResolvedValue(1);

      await service.findAll(
        {
          search: 'Lead created',
        },
        false,
        mockTenantId,
      );

      expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            description: { contains: 'Lead created' },
          }),
        }),
      );
    });

    it('should return paginated results', async () => {
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);
      prismaService.audit_log.count.mockResolvedValue(2);

      const result = await service.findAll({}, false, mockTenantId);

      expect(result).toEqual({
        data: mockAuditLogs,
        pagination: {
          total: 2,
          page: 1,
          limit: 50,
          totalPages: 1,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should find log by id', async () => {
      prismaService.audit_log.findUnique.mockResolvedValue(mockAuditLogs[0]);

      const result = await service.findOne('log-1', false, mockTenantId);

      expect(result).toEqual(mockAuditLogs[0]);
      expect(prismaService.audit_log.findUnique).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if log not found', async () => {
      prismaService.audit_log.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', false, mockTenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation for non-platform admin', async () => {
      const otherTenantLog = {
        ...mockAuditLogs[0],
        tenant_id: mockOtherTenantId,
      };
      prismaService.audit_log.findUnique.mockResolvedValue(otherTenantLog);

      await expect(
        service.findOne('log-1', false, mockTenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow cross-tenant access for platform admin', async () => {
      const otherTenantLog = {
        ...mockAuditLogs[0],
        tenant_id: mockOtherTenantId,
      };
      prismaService.audit_log.findUnique.mockResolvedValue(otherTenantLog);

      const result = await service.findOne('log-1', true, mockTenantId);

      expect(result).toEqual(otherTenantLog);
    });
  });

  describe('findByUser', () => {
    it('should verify user belongs to tenant for non-platform admin', async () => {
      prismaService.user.findFirst.mockResolvedValue({
        id: 'user-1',
        tenant_id: mockTenantId,
      });
      prismaService.audit_log.findMany.mockResolvedValue([mockAuditLogs[0]]);
      prismaService.audit_log.count.mockResolvedValue(1);

      await service.findByUser('user-1', {}, false, mockTenantId);

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', tenant_id: mockTenantId },
      });
    });

    it('should throw NotFoundException if user not in tenant', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findByUser('user-other', {}, false, mockTenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip user verification for platform admin', async () => {
      prismaService.audit_log.findMany.mockResolvedValue(mockAuditLogs);
      prismaService.audit_log.count.mockResolvedValue(2);

      await service.findByUser('user-1', {}, true, undefined);

      expect(prismaService.user.findFirst).not.toHaveBeenCalled();
    });

    it('should filter logs by user id', async () => {
      prismaService.user.findFirst.mockResolvedValue({
        id: 'user-1',
        tenant_id: mockTenantId,
      });
      prismaService.audit_log.findMany.mockResolvedValue([mockAuditLogs[0]]);
      prismaService.audit_log.count.mockResolvedValue(1);

      await service.findByUser('user-1', {}, false, mockTenantId);

      expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            actor_user_id: 'user-1',
          }),
        }),
      );
    });
  });

  describe('count', () => {
    it('should count logs with filters', async () => {
      prismaService.audit_log.count.mockResolvedValue(5);

      const result = await service.count(
        {
          action_type: 'created',
        },
        false,
        mockTenantId,
      );

      expect(result).toBe(5);
      expect(prismaService.audit_log.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenant_id: mockTenantId,
          action_type: 'created',
        }),
      });
    });

    it('should enforce tenant isolation', async () => {
      await expect(service.count({}, false, undefined)).rejects.toThrow(
        'Tenant ID is required for non-platform admin users',
      );
    });
  });
});
