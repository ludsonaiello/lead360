import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantAddressService } from './tenant-address.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('TenantAddressService', () => {
  let service: TenantAddressService;
  let prisma: PrismaService;

  const mockPrismaService = {
    tenantAddress: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantAddressService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TenantAddressService>(TenantAddressService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create first address as default', async () => {
      const createDto = {
        address_type: 'legal',
        line1: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        zip_code: '90001',
      };

      mockPrismaService.tenantAddress.count.mockResolvedValue(0); // No existing addresses
      mockPrismaService.tenantAddress.updateMany.mockResolvedValue({ count: 0 });

      const createdAddress = {
        id: 'addr-123',
        tenant_id: 'tenant-123',
        is_default: true,
        ...createDto,
      };

      mockPrismaService.tenantAddress.create.mockResolvedValue(createdAddress);

      const result = await service.create('tenant-123', createDto as any, 'user-123');

      expect(result.is_default).toBe(true);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should create non-default address if others exist', async () => {
      const createDto = {
        address_type: 'mailing',
        line1: '456 Oak Ave',
        city: 'San Diego',
        state: 'CA',
        zip_code: '92101',
        is_default: false,
      };

      mockPrismaService.tenantAddress.count.mockResolvedValue(2); // 2 existing addresses

      const createdAddress = {
        id: 'addr-456',
        tenant_id: 'tenant-123',
        ...createDto,
      };

      mockPrismaService.tenantAddress.create.mockResolvedValue(createdAddress);

      const result = await service.create('tenant-123', createDto as any, 'user-123');

      expect(result.is_default).toBe(false);
    });

    it('should throw error if legal address is PO Box', async () => {
      const createDto = {
        address_type: 'legal',
        line1: 'PO Box 123',
        city: 'Los Angeles',
        state: 'CA',
        zip_code: '90001',
        is_po_box: true,
      };

      await expect(
        service.create('tenant-123', createDto as any, 'user-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setAsDefault', () => {
    it('should set address as default and unset others', async () => {
      const addressId = 'addr-123';
      const tenantId = 'tenant-123';

      const address = {
        id: addressId,
        tenant_id: tenantId,
        address_type: 'legal',
        is_default: false,
      };

      mockPrismaService.tenantAddress.findFirst.mockResolvedValue(address);
      mockPrismaService.tenantAddress.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.tenantAddress.update.mockResolvedValue({
        ...address,
        is_default: true,
      });

      const result = await service.setAsDefault(tenantId, addressId, 'user-123');

      expect(result).toEqual({ message: 'Address set as default successfully' });
      expect(mockPrismaService.tenantAddress.updateMany).toHaveBeenCalled();
      expect(mockPrismaService.tenantAddress.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if address not found', async () => {
      mockPrismaService.tenantAddress.findFirst.mockResolvedValue(null);

      await expect(
        service.setAsDefault('tenant-123', 'nonexistent', 'user-123')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete non-default address', async () => {
      const address = {
        id: 'addr-123',
        tenant_id: 'tenant-123',
        address_type: 'mailing',
        is_default: false,
      };

      mockPrismaService.tenantAddress.findFirst.mockResolvedValue(address);
      mockPrismaService.tenantAddress.delete.mockResolvedValue(address);

      const result = await service.delete('tenant-123', 'addr-123', 'user-123');

      expect(result).toEqual({ message: 'Address deleted successfully' });
      expect(mockPrismaService.tenantAddress.delete).toHaveBeenCalled();
    });

    it('should throw error when deleting last legal address', async () => {
      const address = {
        id: 'addr-123',
        tenant_id: 'tenant-123',
        address_type: 'legal',
        is_default: true,
      };

      mockPrismaService.tenantAddress.findFirst.mockResolvedValue(address);
      mockPrismaService.tenantAddress.count.mockResolvedValue(1); // Only 1 legal address

      await expect(
        service.delete('tenant-123', 'addr-123', 'user-123')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should set next address as default when deleting default', async () => {
      const address = {
        id: 'addr-123',
        tenant_id: 'tenant-123',
        address_type: 'legal',
        is_default: true,
      };

      const nextAddress = {
        id: 'addr-456',
        tenant_id: 'tenant-123',
        address_type: 'legal',
        is_default: false,
      };

      mockPrismaService.tenantAddress.findFirst
        .mockResolvedValueOnce(address) // First call: findOne
        .mockResolvedValueOnce(nextAddress); // Second call: find next address
      mockPrismaService.tenantAddress.count.mockResolvedValue(2); // 2 legal addresses
      mockPrismaService.tenantAddress.update.mockResolvedValue({
        ...nextAddress,
        is_default: true,
      });
      mockPrismaService.tenantAddress.delete.mockResolvedValue(address);

      const result = await service.delete('tenant-123', 'addr-123', 'user-123');

      expect(result).toEqual({ message: 'Address deleted successfully' });
      expect(mockPrismaService.tenantAddress.update).toHaveBeenCalled();
      expect(mockPrismaService.tenantAddress.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if address not found', async () => {
      mockPrismaService.tenantAddress.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('tenant-123', 'nonexistent', 'user-123')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all addresses for tenant', async () => {
      const addresses = [
        {
          id: 'addr-1',
          tenant_id: 'tenant-123',
          address_type: 'legal',
          is_default: true,
        },
        {
          id: 'addr-2',
          tenant_id: 'tenant-123',
          address_type: 'mailing',
          is_default: false,
        },
      ];

      mockPrismaService.tenantAddress.findMany.mockResolvedValue(addresses);

      const result = await service.findAll('tenant-123');

      expect(result).toEqual(addresses);
      expect(result).toHaveLength(2);
    });
  });
});
