import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TenantBusinessHoursService } from './tenant-business-hours.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('TenantBusinessHoursService', () => {
  let service: TenantBusinessHoursService;
  let prisma: PrismaService;

  const mockPrismaService = {
    tenantBusinessHours: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantBusinessHoursService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TenantBusinessHoursService>(TenantBusinessHoursService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreate', () => {
    it('should return existing business hours if found', async () => {
      const mockHours = {
        id: 'hours-123',
        tenant_id: 'tenant-123',
        monday_closed: false,
        monday_open1: '09:00',
        monday_close1: '17:00',
      };

      mockPrismaService.tenantBusinessHours.findUnique.mockResolvedValue(mockHours);

      const result = await service.findOrCreate('tenant-123');

      expect(result).toEqual(mockHours);
      expect(mockPrismaService.tenantBusinessHours.create).not.toHaveBeenCalled();
    });

    it('should create default business hours if not found', async () => {
      mockPrismaService.tenantBusinessHours.findUnique.mockResolvedValue(null);

      const defaultHours = {
        id: 'hours-123',
        tenant_id: 'tenant-123',
        monday_closed: false,
        monday_open1: '09:00',
        monday_close1: '17:00',
        tuesday_closed: false,
        tuesday_open1: '09:00',
        tuesday_close1: '17:00',
        wednesday_closed: false,
        wednesday_open1: '09:00',
        wednesday_close1: '17:00',
        thursday_closed: false,
        thursday_open1: '09:00',
        thursday_close1: '17:00',
        friday_closed: false,
        friday_open1: '09:00',
        friday_close1: '17:00',
        saturday_closed: true,
        sunday_closed: true,
      };

      mockPrismaService.tenantBusinessHours.create.mockResolvedValue(defaultHours);

      const result = await service.findOrCreate('tenant-123');

      expect(result).toEqual(defaultHours);
      expect(mockPrismaService.tenantBusinessHours.create).toHaveBeenCalled();
    });
  });

  describe('update - Time Validation', () => {
    beforeEach(() => {
      // Mock existing business hours
      mockPrismaService.tenantBusinessHours.findUnique.mockResolvedValue({
        id: 'hours-123',
        tenant_id: 'tenant-123',
      });
    });

    it('should successfully update valid business hours', async () => {
      const validUpdate = {
        monday_closed: false,
        monday_open1: '08:00',
        monday_close1: '17:00',
      };

      const updatedHours = {
        id: 'hours-123',
        ...validUpdate,
      };

      mockPrismaService.tenantBusinessHours.update.mockResolvedValue(updatedHours);

      const result = await service.update('tenant-123', validUpdate, 'user-123');

      expect(result).toEqual(updatedHours);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should throw error if opening time >= closing time', async () => {
      const invalidUpdate = {
        monday_closed: false,
        monday_open1: '17:00',
        monday_close1: '08:00', // Close before open - INVALID
      };

      await expect(
        service.update('tenant-123', invalidUpdate, 'user-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if opening time equals closing time', async () => {
      const invalidUpdate = {
        monday_closed: false,
        monday_open1: '09:00',
        monday_close1: '09:00', // Same time - INVALID
      };

      await expect(
        service.update('tenant-123', invalidUpdate, 'user-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if day is open but missing times', async () => {
      const invalidUpdate = {
        monday_closed: false,
        // Missing monday_open1 and monday_close1
      };

      await expect(
        service.update('tenant-123', invalidUpdate, 'user-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow closed day without time validation', async () => {
      const validUpdate = {
        monday_closed: true,
        // No need for open/close times when closed
      };

      const updatedHours = {
        id: 'hours-123',
        ...validUpdate,
      };

      mockPrismaService.tenantBusinessHours.update.mockResolvedValue(updatedHours);

      const result = await service.update('tenant-123', validUpdate, 'user-123');

      expect(result).toEqual(updatedHours);
    });

    it('should validate second shift times (lunch break)', async () => {
      const validUpdate = {
        monday_closed: false,
        monday_open1: '08:00',
        monday_close1: '12:00',
        monday_open2: '13:00', // After lunch
        monday_close2: '17:00',
      };

      const updatedHours = {
        id: 'hours-123',
        ...validUpdate,
      };

      mockPrismaService.tenantBusinessHours.update.mockResolvedValue(updatedHours);

      const result = await service.update('tenant-123', validUpdate, 'user-123');

      expect(result).toEqual(updatedHours);
    });

    it('should throw error if second shift overlaps first shift', async () => {
      const invalidUpdate = {
        monday_closed: false,
        monday_open1: '08:00',
        monday_close1: '14:00',
        monday_open2: '13:00', // Before first shift ends - INVALID
        monday_close2: '17:00',
      };

      await expect(
        service.update('tenant-123', invalidUpdate, 'user-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if open2 >= close2', async () => {
      const invalidUpdate = {
        monday_closed: false,
        monday_open1: '08:00',
        monday_close1: '12:00',
        monday_open2: '17:00',
        monday_close2: '13:00', // Close before open - INVALID
      };

      await expect(
        service.update('tenant-123', invalidUpdate, 'user-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateTimeLogic (edge cases)', () => {
    beforeEach(() => {
      mockPrismaService.tenantBusinessHours.findUnique.mockResolvedValue({
        id: 'hours-123',
      });
    });

    it('should validate all 7 days independently', async () => {
      const updateAllDays = {
        monday_closed: false,
        monday_open1: '08:00',
        monday_close1: '17:00',
        tuesday_closed: false,
        tuesday_open1: '09:00',
        tuesday_close1: '18:00',
        wednesday_closed: false,
        wednesday_open1: '07:00',
        wednesday_close1: '15:00',
        thursday_closed: false,
        thursday_open1: '10:00',
        thursday_close1: '19:00',
        friday_closed: false,
        friday_open1: '08:00',
        friday_close1: '16:00',
        saturday_closed: false,
        saturday_open1: '09:00',
        saturday_close1: '13:00',
        sunday_closed: true,
      };

      mockPrismaService.tenantBusinessHours.update.mockResolvedValue(updateAllDays);

      const result = await service.update('tenant-123', updateAllDays, 'user-123');

      expect(result).toBeDefined();
    });
  });
});
