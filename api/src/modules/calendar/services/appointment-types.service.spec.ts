import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppointmentTypesService } from './appointment-types.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('AppointmentTypesService', () => {
  let service: AppointmentTypesService;
  let prisma: PrismaService;
  let auditLogger: AuditLoggerService;

  const mockPrisma = {
    appointment_type: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
    },
  };

  const mockAuditLogger = {
    log: jest.fn(),
    logTenantChange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentTypesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
      ],
    }).compile();

    service = module.get<AppointmentTypesService>(AppointmentTypesService);
    prisma = module.get<PrismaService>(PrismaService);
    auditLogger = module.get<AuditLoggerService>(AuditLoggerService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const createDto = {
      name: 'Quote Visit',
      description: 'Schedule a quote visit',
      slot_duration_minutes: 60,
      is_default: false,
    };

    it('should create an appointment type', async () => {
      const expected = { id: 'apt-123', ...createDto };
      mockPrisma.appointment_type.create.mockResolvedValue(expected);

      const result = await service.create(tenantId, userId, createDto);

      expect(result).toEqual(expected);
      expect(mockPrisma.appointment_type.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: tenantId,
          created_by_user_id: userId,
          name: createDto.name,
          description: createDto.description,
        }),
      });
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalled();
    });

    it('should unset previous default when is_default is true', async () => {
      const createDtoWithDefault = { ...createDto, is_default: true };
      const expected = { id: 'apt-123', ...createDtoWithDefault };

      mockPrisma.appointment_type.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.appointment_type.create.mockResolvedValue(expected);

      await service.create(tenantId, userId, createDtoWithDefault);

      expect(mockPrisma.appointment_type.updateMany).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          is_default: true,
        },
        data: {
          is_default: false,
        },
      });
    });

    it('should not unset previous default when is_default is false', async () => {
      const expected = { id: 'apt-123', ...createDto };
      mockPrisma.appointment_type.create.mockResolvedValue(expected);

      await service.create(tenantId, userId, createDto);

      expect(mockPrisma.appointment_type.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const tenantId = 'tenant-123';

    it('should return paginated appointment types', async () => {
      const mockItems = [
        { id: 'apt-1', name: 'Quote Visit', tenant_id: tenantId },
        { id: 'apt-2', name: 'Consultation', tenant_id: tenantId },
      ];

      mockPrisma.appointment_type.findMany.mockResolvedValue(mockItems);
      mockPrisma.appointment_type.count.mockResolvedValue(2);

      const result = await service.findAll(tenantId, { page: 1, limit: 20 });

      expect(result.items).toEqual(mockItems);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        total_pages: 1,
      });
    });

    it('should filter by tenant_id', async () => {
      mockPrisma.appointment_type.findMany.mockResolvedValue([]);
      mockPrisma.appointment_type.count.mockResolvedValue(0);

      await service.findAll(tenantId, {});

      expect(mockPrisma.appointment_type.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: tenantId,
          }),
        }),
      );
    });

    it('should filter by is_active', async () => {
      mockPrisma.appointment_type.findMany.mockResolvedValue([]);
      mockPrisma.appointment_type.count.mockResolvedValue(0);

      await service.findAll(tenantId, { is_active: true });

      expect(mockPrisma.appointment_type.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: tenantId,
            is_active: true,
          }),
        }),
      );
    });

    it('should search by name', async () => {
      mockPrisma.appointment_type.findMany.mockResolvedValue([]);
      mockPrisma.appointment_type.count.mockResolvedValue(0);

      await service.findAll(tenantId, { search: 'Quote' });

      expect(mockPrisma.appointment_type.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: tenantId,
            name: { contains: 'Quote' },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    const tenantId = 'tenant-123';
    const id = 'apt-123';

    it('should return an appointment type', async () => {
      const expected = { id, name: 'Quote Visit', tenant_id: tenantId };
      mockPrisma.appointment_type.findFirst.mockResolvedValue(expected);

      const result = await service.findOne(tenantId, id);

      expect(result).toEqual(expected);
      expect(mockPrisma.appointment_type.findFirst).toHaveBeenCalledWith({
        where: { id, tenant_id: tenantId },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

      await expect(service.findOne(tenantId, id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should enforce tenant isolation', async () => {
      mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

      await expect(service.findOne('other-tenant', id)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.appointment_type.findFirst).toHaveBeenCalledWith({
        where: { id, tenant_id: 'other-tenant' },
        include: expect.any(Object),
      });
    });
  });

  describe('update', () => {
    const tenantId = 'tenant-123';
    const id = 'apt-123';
    const userId = 'user-123';

    it('should update an appointment type', async () => {
      const existing = {
        id,
        name: 'Old Name',
        is_default: false,
        tenant_id: tenantId,
      };
      const updateDto = { name: 'New Name' };
      const updated = { ...existing, ...updateDto };

      mockPrisma.appointment_type.findFirst.mockResolvedValue(existing);
      mockPrisma.appointment_type.update.mockResolvedValue(updated);

      const result = await service.update(tenantId, id, userId, updateDto);

      expect(result).toEqual(updated);
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalled();
    });

    it('should unset previous default when changing is_default to true', async () => {
      const existing = {
        id,
        name: 'Test',
        is_default: false,
        tenant_id: tenantId,
      };
      const updateDto = { is_default: true };

      mockPrisma.appointment_type.findFirst.mockResolvedValue(existing);
      mockPrisma.appointment_type.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.appointment_type.update.mockResolvedValue({
        ...existing,
        ...updateDto,
      });

      await service.update(tenantId, id, userId, updateDto);

      expect(mockPrisma.appointment_type.updateMany).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          is_default: true,
          id: { not: id },
        },
        data: {
          is_default: false,
        },
      });
    });

    it('should throw NotFoundException if appointment type not found', async () => {
      mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

      await expect(
        service.update(tenantId, id, userId, { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    const tenantId = 'tenant-123';
    const id = 'apt-123';
    const userId = 'user-123';

    it('should soft delete an appointment type', async () => {
      const existing = { id, name: 'Test', tenant_id: tenantId };

      mockPrisma.appointment_type.findFirst.mockResolvedValue(existing);
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.appointment_type.update.mockResolvedValue({
        ...existing,
        is_active: false,
      });

      await service.delete(tenantId, id, userId);

      expect(mockPrisma.appointment_type.update).toHaveBeenCalledWith({
        where: {
          id,
          tenant_id: tenantId,
        },
        data: {
          is_active: false,
          is_default: false,
        },
      });
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalled();
    });

    it('should throw BadRequestException if active appointments exist', async () => {
      const existing = { id, name: 'Test', tenant_id: tenantId };

      mockPrisma.appointment_type.findFirst.mockResolvedValue(existing);
      mockPrisma.appointment.count.mockResolvedValue(5);

      await expect(service.delete(tenantId, id, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if appointment type not found', async () => {
      mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

      await expect(service.delete(tenantId, id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
