import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantService } from './tenant.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../core/file-storage/file-storage.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('TenantService', () => {
  let service: TenantService;
  let prisma: PrismaService;
  let fileStorage: FileStorageService;

  const mockPrismaService = {
    tenant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    tenantBusinessHours: {
      create: jest.fn(),
    },
    tenantAddress: {
      count: jest.fn(),
    },
    tenantLicense: {
      count: jest.fn(),
    },
    tenantInsurance: {
      findUnique: jest.fn(),
    },
    subscriptionPlan: {
      findFirst: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    file: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockFileStorageService = {
    uploadLogo: jest.fn(),
    deleteFileByPath: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'UPLOADS_PATH') return '/var/www/lead360.app/app/uploads/public';
      return undefined;
    }),
  };

  const mockAuditLogger = {
    log: jest.fn(),
    logAuth: jest.fn(),
    logTenantChange: jest.fn(),
    logRBACChange: jest.fn(),
    logFailedAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FileStorageService,
          useValue: mockFileStorageService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    prisma = module.get<PrismaService>(PrismaService);
    fileStorage = module.get<FileStorageService>(FileStorageService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findBySubdomain', () => {
    it('should find tenant by subdomain with subscription plan', async () => {
      const mockTenant = {
        id: 'tenant-123',
        subdomain: 'acme-roofing',
        company_name: 'Acme Roofing LLC',
        is_active: true,
        subscription_plan: { id: 'plan-123', name: 'Professional' },
        logo_file: null,
        venmo_qr_code_file: null,
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.findBySubdomain('acme-roofing');

      expect(result).toEqual(mockTenant);
      expect(mockPrismaService.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { subdomain: 'acme-roofing' },
        }),
      );
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.findBySubdomain('nonexistent')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if tenant is inactive', async () => {
      const inactiveTenant = {
        id: 'tenant-123',
        subdomain: 'inactive-tenant',
        is_active: false,
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(inactiveTenant);

      await expect(
        service.findBySubdomain('inactive-tenant')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('checkSubdomainAvailability', () => {
    const reservedSubdomains = ['www', 'app', 'api', 'admin', 'mail', 'ftp', 'smtp'];

    it('should return unavailable for reserved subdomains', async () => {
      for (const subdomain of reservedSubdomains) {
        const result = await service.checkSubdomainAvailability(subdomain);
        expect(result).toEqual({
          available: false,
          reason: 'This subdomain is reserved and cannot be used',
        });
      }
    });

    it('should return available if subdomain is not taken', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      const result = await service.checkSubdomainAvailability('my-company');

      expect(result).toEqual({
        available: true,
      });
    });

    it('should return unavailable if subdomain is taken', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        subdomain: 'acme-roofing',
      });

      const result = await service.checkSubdomainAvailability('acme-roofing');

      expect(result).toEqual({
        available: false,
        reason: 'This subdomain is already taken',
      });
    });
  });

  describe('findById', () => {
    it('should find tenant by ID with all relations', async () => {
      const mockTenant = {
        id: 'tenant-123',
        subdomain: 'acme-roofing',
        company_name: 'Acme Roofing LLC',
        subscription_plan: {},
        logo_file: null,
        venmo_qr_code_file: null,
        addresses: [],
        licenses: [],
        insurance: {},
        payment_terms: {},
        business_hours: {},
        custom_hours: [],
        service_areas: [],
        tenant_services: [],
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.findById('tenant-123');

      expect(result).toEqual({
        ...mockTenant,
        services_offered: [],
      });
      expect(mockPrismaService.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-123' },
        }),
      );
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.findById('nonexistent')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update tenant with audit logging', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';
      const updateData = {
        company_name: 'New Company Name',
        primary_contact_phone: '5551234567',
      };

      const existingTenant = {
        id: tenantId,
        company_name: 'Old Company Name',
        primary_contact_phone: '5559999999',
      };

      const updatedTenant = {
        id: tenantId,
        ...updateData,
        subscription_plan: {},
        updated_at: new Date(),
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(existingTenant);
      mockPrismaService.tenant.update.mockResolvedValue(updatedTenant);

      const result = await service.update(tenantId, updateData, userId);

      expect(result).toEqual(updatedTenant);
      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: updateData,
        include: {
          subscription_plan: true,
        },
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', {}, 'user-123')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadLogo', () => {
    it('should upload logo and update tenant with file metadata', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';
      const mockFile = {
        originalname: 'logo.png',
        mimetype: 'image/png',
        buffer: Buffer.from('fake-image-data'),
        size: 1024 * 1024, // 1MB
      } as Express.Multer.File;

      const mockFileResult = {
        file_id: 'file-123',
        url: '/public/tenant-123/images/logo.png',
      };

      // Mock tenant findUnique (no existing logo)
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        logo_file_id: null,
      });

      mockFileStorageService.uploadLogo.mockResolvedValue(mockFileResult);
      mockPrismaService.file.create.mockResolvedValue({
        id: 1,
        file_id: 'file-123',
      });
      mockPrismaService.tenant.update.mockResolvedValue({
        id: tenantId,
        logo_file_id: 'file-123',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.uploadLogo(tenantId, mockFile, userId);

      expect(result).toEqual({
        file_id: 'file-123',
        url: '/public/tenant-123/images/logo.png',
        metadata: {
          original_filename: 'logo.png',
          mime_type: 'image/png',
          size_bytes: 1024 * 1024,
          storage_path: '/var/www/lead360.app/app/uploads/public/tenant-123/images/file-123.png',
        },
      });

      // Verify file upload
      expect(mockFileStorageService.uploadLogo).toHaveBeenCalledWith(tenantId, mockFile);

      // Verify File record created
      expect(mockPrismaService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          file_id: 'file-123',
          tenant_id: tenantId,
          original_filename: 'logo.png',
          mime_type: 'image/png',
          size_bytes: 1024 * 1024,
          category: 'logo',
          uploaded_by: userId,
          entity_type: 'tenant_logo',
          entity_id: tenantId,
        }),
      });

      // Verify tenant updated
      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tenantId },
          data: { logo_file_id: 'file-123' },
        }),
      );

      // Verify audit log created
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'tenant_logo_uploaded',
          entity_type: 'tenant',
        }),
      });
    });

    it('should replace existing logo (hard delete old file)', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';
      const mockFile = {
        originalname: 'new-logo.png',
        mimetype: 'image/png',
        buffer: Buffer.from('fake-image-data'),
        size: 2 * 1024 * 1024, // 2MB
      } as Express.Multer.File;

      const oldFileId = 'old-file-123';
      const newFileId = 'new-file-456';

      // Mock tenant with existing logo
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        logo_file_id: oldFileId,
      });

      // Mock old file record
      mockPrismaService.file.findUnique.mockResolvedValue({
        id: 1,
        file_id: oldFileId,
        storage_path: '/var/www/lead360.app/app/uploads/public/tenant-123/images/old-file-123.png',
      });

      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);
      mockPrismaService.file.delete.mockResolvedValue({});

      mockFileStorageService.uploadLogo.mockResolvedValue({
        file_id: newFileId,
        url: '/public/tenant-123/images/new-logo.png',
      });

      mockPrismaService.file.create.mockResolvedValue({
        id: 2,
        file_id: newFileId,
      });

      mockPrismaService.tenant.update.mockResolvedValue({
        id: tenantId,
        logo_file_id: newFileId,
      });

      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.uploadLogo(tenantId, mockFile, userId);

      // Verify old file was hard deleted from filesystem
      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(
        '/var/www/lead360.app/app/uploads/public/tenant-123/images/old-file-123.png',
      );

      // Verify old file record was deleted from database
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });

      // Verify new file was uploaded
      expect(mockFileStorageService.uploadLogo).toHaveBeenCalled();
      expect(mockPrismaService.file.create).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return tenant statistics', async () => {
      mockPrismaService.user.count.mockResolvedValue(5);
      mockPrismaService.tenantAddress.count.mockResolvedValue(3);
      mockPrismaService.tenantLicense.count
        .mockResolvedValueOnce(10) // Total licenses
        .mockResolvedValueOnce(2); // Expiring licenses
      mockPrismaService.tenantInsurance.findUnique.mockResolvedValue({
        gl_expiry_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days away
        wc_expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days away (expiring soon)
      });

      const result = await service.getStatistics('tenant-123');

      expect(result).toEqual({
        users: 5,
        addresses: 3,
        licenses: 10,
        expiring_licenses: 2,
        insurance_expiring_soon: {
          gl: false,
          wc: true,
        },
      });
    });
  });
});
