import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TenantLicenseService } from './tenant-license.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('TenantLicenseService', () => {
  let service: TenantLicenseService;
  let prisma: PrismaService;

  const mockPrismaService = {
    tenantLicense: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    licenseType: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantLicenseService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TenantLicenseService>(TenantLicenseService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create license with audit logging', async () => {
      const createDto = {
        license_type_id: 'type-123',
        license_number: 'CA-123456',
        issuing_state: 'CA',
        issue_date: '2024-01-01',
        expiry_date: '2026-01-01',
      };

      const createdLicense = {
        id: 'license-123',
        tenant_id: 'tenant-123',
        ...createDto,
      };

      // Mock license type exists
      mockPrismaService.licenseType.findUnique.mockResolvedValue({
        id: 'type-123',
        name: 'Contractor License',
      });

      mockPrismaService.tenantLicense.create.mockResolvedValue(createdLicense);

      const result = await service.create('tenant-123', createDto as any, 'user-123');

      expect(result).toEqual(createdLicense);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('findExpiring', () => {
    it('should find licenses expiring within specified days', async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringLicenses = [
        {
          id: 'license-1',
          tenant_id: 'tenant-123',
          license_number: 'CA-111111',
          expiry_date: thirtyDaysFromNow,
        },
      ];

      mockPrismaService.tenantLicense.findMany.mockResolvedValue(expiringLicenses);

      const result = await service.findExpiring('tenant-123', 30);

      expect(result).toEqual(expiringLicenses);
      expect(result.length).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete license with audit logging', async () => {
      const license = {
        id: 'license-123',
        tenant_id: 'tenant-123',
        license_number: 'CA-123456',
      };

      mockPrismaService.tenantLicense.findFirst.mockResolvedValue(license);
      mockPrismaService.tenantLicense.delete.mockResolvedValue(license);

      const result = await service.delete('tenant-123', 'license-123', 'user-123');

      expect(result).toEqual({ message: 'License deleted successfully' });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if license not found', async () => {
      mockPrismaService.tenantLicense.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('tenant-123', 'nonexistent', 'user-123')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
