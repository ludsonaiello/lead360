import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantManagementService } from './tenant-management.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('TenantManagementService', () => {
  let service: TenantManagementService;
  let prismaService: jest.Mocked<PrismaService>;
  let auditLogger: jest.Mocked<AuditLoggerService>;

  const mockTenant = {
    id: 'tenant-123',
    subdomain: 'acme-roofing',
    company_name: 'Acme Roofing LLC',
    is_active: true,
    deleted_at: null,
    created_at: new Date(),
  };

  const mockOwner = {
    id: 'user-123',
    email: 'owner@acme.com',
    first_name: 'John',
    last_name: 'Doe',
    tenant_id: 'tenant-123',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      tenant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      rbac_role: {
        findUnique: jest.fn(),
      },
      tenant_business_hours: {
        create: jest.fn(),
      },
      user_role: {
        create: jest.fn(),
      },
      refresh_token: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    const mockAuditLogger = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantManagementService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
      ],
    }).compile();

    service = module.get<TenantManagementService>(TenantManagementService);
    prismaService = module.get(PrismaService);
    auditLogger = module.get(AuditLoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTenantManually', () => {
    const createDto = {
      subdomain: 'acme-roofing',
      business_name: 'Acme Roofing LLC',
      owner_email: 'owner@acme.com',
      owner_password: 'SecurePass123!',
      owner_first_name: 'John',
      owner_last_name: 'Doe',
      skip_email_verification: false,
    };

    it('should create tenant with owner user', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.rbac_role.findUnique.mockResolvedValue({
        id: 'role-owner',
        name: 'Owner',
      });

      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          tenant_business_hours: {
            create: jest.fn().mockResolvedValue({}),
          },
          user: {
            create: jest.fn().mockResolvedValue(mockOwner),
          },
          user_role: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.createTenantManually(createDto, 'admin-123');

      expect(result).toHaveProperty('tenant');
      expect(result).toHaveProperty('owner');
      expect(result).toHaveProperty('message');
      expect(auditLogger.log).toHaveBeenCalled();
    });

    it('should throw error if subdomain already exists', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(
        service.createTenantManually(createDto, 'admin-123'),
      ).rejects.toThrow('Subdomain already exists');
    });

    it('should throw error if owner email already exists', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);
      prismaService.user.findUnique.mockResolvedValue(mockOwner);

      await expect(
        service.createTenantManually(createDto, 'admin-123'),
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('suspendTenant', () => {
    it('should suspend active tenant', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      prismaService.tenant.update.mockResolvedValue({
        ...mockTenant,
        is_active: false,
      });

      const result = await service.suspendTenant('tenant-123', 'admin-123', 'Payment overdue');

      expect(result.is_active).toBe(false);
      expect(prismaService.refresh_token.deleteMany).toHaveBeenCalledWith({
        where: {
          user: { tenant_id: 'tenant-123' },
        },
      });
      expect(auditLogger.log).toHaveBeenCalled();
    });

    it('should throw error if tenant not found', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.suspendTenant('tenant-123', 'admin-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if tenant already suspended', async () => {
      prismaService.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        is_active: false,
      });

      await expect(
        service.suspendTenant('tenant-123', 'admin-123'),
      ).rejects.toThrow('Tenant is already suspended');
    });
  });

  describe('activateTenant', () => {
    it('should activate suspended tenant', async () => {
      prismaService.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        is_active: false,
      });
      prismaService.tenant.update.mockResolvedValue(mockTenant);

      const result = await service.activateTenant('tenant-123', 'admin-123');

      expect(result.is_active).toBe(true);
      expect(auditLogger.log).toHaveBeenCalled();
    });

    it('should throw error if tenant already active', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(
        service.activateTenant('tenant-123', 'admin-123'),
      ).rejects.toThrow('Tenant is already active');
    });
  });

  describe('deleteTenant', () => {
    it('should soft delete tenant', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      prismaService.tenant.update.mockResolvedValue({
        ...mockTenant,
        deleted_at: new Date(),
      });

      const result = await service.deleteTenant('tenant-123', 'admin-123');

      expect(result).toHaveProperty('message');
      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: { deleted_at: expect.any(Date) },
      });
      expect(auditLogger.log).toHaveBeenCalled();
    });

    it('should throw error if tenant not found', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteTenant('tenant-123', 'admin-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if tenant already deleted', async () => {
      prismaService.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        deleted_at: new Date(),
      });

      await expect(
        service.deleteTenant('tenant-123', 'admin-123'),
      ).rejects.toThrow('Tenant is already deleted');
    });
  });

  describe('getTenantDetails', () => {
    it('should return tenant with full details', async () => {
      prismaService.tenant.findUnique.mockResolvedValue({
        ...mockTenant,
        users: [mockOwner],
        files: [],
        scheduled_jobs: [],
        _count: {
          users: 5,
          files: 10,
          scheduled_jobs: 3,
        },
      });

      const result = await service.getTenantDetails('tenant-123');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('stats');
    });

    it('should throw error if tenant not found', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.getTenantDetails('tenant-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listTenants', () => {
    it('should return paginated tenant list', async () => {
      prismaService.tenant.findMany.mockResolvedValue([mockTenant]);
      prismaService.tenant.count.mockResolvedValue(1);

      const result = await service.listTenants(
        { status: 'active', page: 1, limit: 20 },
        { page: 1, limit: 20 },
      );

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by status', async () => {
      prismaService.tenant.findMany.mockResolvedValue([mockTenant]);
      prismaService.tenant.count.mockResolvedValue(1);

      await service.listTenants(
        { status: 'suspended' },
        { page: 1, limit: 20 },
      );

      expect(prismaService.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: false }),
        }),
      );
    });
  });
});
