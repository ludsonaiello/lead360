import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../core/file-storage/file-storage.service';

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
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockFileStorageService = {
    uploadLogo: jest.fn(),
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
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.findBySubdomain('acme-roofing');

      expect(result).toEqual(mockTenant);
      expect(mockPrismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { subdomain: 'acme-roofing' },
        include: {
          subscription_plan: true,
        },
      });
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
        addresses: [],
        licenses: [],
        insurance: {},
        payment_terms: {},
        business_hours: {},
        custom_hours: [],
        service_areas: [],
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.findById('tenant-123');

      expect(result).toEqual(mockTenant);
      expect(mockPrismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        include: {
          subscription_plan: true,
          addresses: {
            orderBy: { is_default: 'desc' },
          },
          licenses: {
            include: { license_type: true },
            orderBy: { expiry_date: 'asc' },
          },
          insurance: true,
          payment_terms: true,
          business_hours: true,
          custom_hours: {
            orderBy: { date: 'asc' },
          },
          service_areas: true,
        },
      });
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
    it('should upload logo and update tenant', async () => {
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

      mockFileStorageService.uploadLogo.mockResolvedValue(mockFileResult);
      mockPrismaService.tenant.update.mockResolvedValue({
        id: 'tenant-123',
        logo_file_id: 'file-123',
      });

      const result = await service.uploadLogo('tenant-123', mockFile);

      expect(result).toEqual({
        url: '/public/tenant-123/images/logo.png',
      });
      expect(mockFileStorageService.uploadLogo).toHaveBeenCalledWith('tenant-123', mockFile);
      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: { logo_file_id: 'file-123' },
      });
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
