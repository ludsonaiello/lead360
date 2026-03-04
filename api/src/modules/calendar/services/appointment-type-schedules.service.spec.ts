import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppointmentTypeSchedulesService } from './appointment-type-schedules.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('AppointmentTypeSchedulesService', () => {
  let service: AppointmentTypeSchedulesService;
  let prisma: PrismaService;
  let auditLogger: AuditLoggerService;

  const mockPrisma = {
    appointment_type: {
      findFirst: jest.fn(),
    },
    appointment_type_schedule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const mockAuditLogger = {
    log: jest.fn(),
    logTenantChange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentTypeSchedulesService,
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

    service = module.get<AppointmentTypeSchedulesService>(
      AppointmentTypeSchedulesService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    auditLogger = module.get<AuditLoggerService>(AuditLoggerService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findSchedules', () => {
    const tenantId = 'tenant-123';
    const appointmentTypeId = 'apt-type-123';

    it('should return schedules for an appointment type', async () => {
      const mockAppointmentType = {
        id: appointmentTypeId,
        tenant_id: tenantId,
      };
      const mockSchedules = [
        {
          id: 'sched-1',
          appointment_type_id: appointmentTypeId,
          day_of_week: 0,
          is_available: false,
        },
        {
          id: 'sched-2',
          appointment_type_id: appointmentTypeId,
          day_of_week: 1,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
        },
      ];

      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );
      mockPrisma.appointment_type_schedule.findMany.mockResolvedValue(
        mockSchedules,
      );

      const result = await service.findSchedules(tenantId, appointmentTypeId);

      expect(result).toEqual(mockSchedules);
      expect(mockPrisma.appointment_type.findFirst).toHaveBeenCalledWith({
        where: { id: appointmentTypeId, tenant_id: tenantId },
      });
      expect(mockPrisma.appointment_type_schedule.findMany).toHaveBeenCalledWith(
        {
          where: { appointment_type_id: appointmentTypeId },
          orderBy: { day_of_week: 'asc' },
        },
      );
    });

    it('should throw NotFoundException if appointment type not found', async () => {
      mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

      await expect(
        service.findSchedules(tenantId, appointmentTypeId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation', async () => {
      mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

      await expect(
        service.findSchedules('other-tenant', appointmentTypeId),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.appointment_type.findFirst).toHaveBeenCalledWith({
        where: { id: appointmentTypeId, tenant_id: 'other-tenant' },
      });
    });
  });

  describe('bulkUpdateSchedules', () => {
    const tenantId = 'tenant-123';
    const appointmentTypeId = 'apt-type-123';
    const userId = 'user-123';

    const validBulkUpdate = {
      schedules: [
        {
          day_of_week: 0,
          is_available: false,
          window1_start: null,
          window1_end: null,
          window2_start: null,
          window2_end: null,
        },
        {
          day_of_week: 1,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
          window2_start: null,
          window2_end: null,
        },
        {
          day_of_week: 2,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
          window2_start: null,
          window2_end: null,
        },
        {
          day_of_week: 3,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
          window2_start: null,
          window2_end: null,
        },
        {
          day_of_week: 4,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
          window2_start: null,
          window2_end: null,
        },
        {
          day_of_week: 5,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
          window2_start: null,
          window2_end: null,
        },
        {
          day_of_week: 6,
          is_available: false,
          window1_start: null,
          window1_end: null,
          window2_start: null,
          window2_end: null,
        },
      ],
    };

    it('should bulk update all 7 days', async () => {
      const mockAppointmentType = {
        id: appointmentTypeId,
        tenant_id: tenantId,
      };

      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );
      mockPrisma.appointment_type_schedule.findMany.mockResolvedValue([]);
      mockPrisma.appointment_type_schedule.upsert.mockImplementation(
        (args) => {
          return Promise.resolve({
            id: `sched-${args.create.day_of_week}`,
            ...args.create,
          });
        },
      );

      const result = await service.bulkUpdateSchedules(
        tenantId,
        appointmentTypeId,
        userId,
        validBulkUpdate,
      );

      expect(result).toHaveLength(7);
      expect(mockPrisma.appointment_type_schedule.upsert).toHaveBeenCalledTimes(
        7,
      );
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalled();
    });

    it('should throw BadRequestException if missing days', async () => {
      const invalidBulkUpdate = {
        schedules: [
          {
            day_of_week: 0,
            is_available: false,
            window1_start: null,
            window1_end: null,
            window2_start: null,
            window2_end: null,
          },
          // Missing days 1-6
        ],
      };

      const mockAppointmentType = {
        id: appointmentTypeId,
        tenant_id: tenantId,
      };

      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );

      await expect(
        service.bulkUpdateSchedules(
          tenantId,
          appointmentTypeId,
          userId,
          invalidBulkUpdate as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if duplicate days', async () => {
      const invalidBulkUpdate = {
        schedules: [
          {
            day_of_week: 0,
            is_available: false,
            window1_start: null,
            window1_end: null,
            window2_start: null,
            window2_end: null,
          },
          {
            day_of_week: 0,
            is_available: false,
            window1_start: null,
            window1_end: null,
            window2_start: null,
            window2_end: null,
          },
          // ... (still missing proper 1-6)
        ],
      };

      const mockAppointmentType = {
        id: appointmentTypeId,
        tenant_id: tenantId,
      };

      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );

      await expect(
        service.bulkUpdateSchedules(
          tenantId,
          appointmentTypeId,
          userId,
          invalidBulkUpdate as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if appointment type not found', async () => {
      mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

      await expect(
        service.bulkUpdateSchedules(
          tenantId,
          appointmentTypeId,
          userId,
          validBulkUpdate,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSingleDaySchedule', () => {
    const tenantId = 'tenant-123';
    const appointmentTypeId = 'apt-type-123';
    const userId = 'user-123';
    const dayOfWeek = 1;

    const validUpdateDto = {
      is_available: true,
      window1_start: '09:00',
      window1_end: '17:00',
      window2_start: null,
      window2_end: null,
    };

    it('should update a single day schedule', async () => {
      const mockAppointmentType = {
        id: appointmentTypeId,
        tenant_id: tenantId,
      };
      const existingSchedule = {
        id: 'sched-1',
        appointment_type_id: appointmentTypeId,
        day_of_week: dayOfWeek,
        is_available: false,
      };
      const updatedSchedule = {
        id: 'sched-1',
        appointment_type_id: appointmentTypeId,
        day_of_week: dayOfWeek,
        ...validUpdateDto,
      };

      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );
      mockPrisma.appointment_type_schedule.findUnique.mockResolvedValue(
        existingSchedule,
      );
      mockPrisma.appointment_type_schedule.upsert.mockResolvedValue(
        updatedSchedule,
      );

      const result = await service.updateSingleDaySchedule(
        tenantId,
        appointmentTypeId,
        dayOfWeek,
        userId,
        validUpdateDto,
      );

      expect(result).toEqual(updatedSchedule);
      expect(mockPrisma.appointment_type_schedule.upsert).toHaveBeenCalled();
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalled();
    });

    it('should throw BadRequestException if dayOfWeek is invalid', async () => {
      await expect(
        service.updateSingleDaySchedule(
          tenantId,
          appointmentTypeId,
          -1,
          userId,
          validUpdateDto,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateSingleDaySchedule(
          tenantId,
          appointmentTypeId,
          7,
          userId,
          validUpdateDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if appointment type not found', async () => {
      mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSingleDaySchedule(
          tenantId,
          appointmentTypeId,
          dayOfWeek,
          userId,
          validUpdateDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create schedule if it does not exist (upsert)', async () => {
      const mockAppointmentType = {
        id: appointmentTypeId,
        tenant_id: tenantId,
      };
      const newSchedule = {
        id: 'sched-new',
        appointment_type_id: appointmentTypeId,
        day_of_week: dayOfWeek,
        ...validUpdateDto,
      };

      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );
      mockPrisma.appointment_type_schedule.findUnique.mockResolvedValue(null);
      mockPrisma.appointment_type_schedule.upsert.mockResolvedValue(
        newSchedule,
      );

      const result = await service.updateSingleDaySchedule(
        tenantId,
        appointmentTypeId,
        dayOfWeek,
        userId,
        validUpdateDto,
      );

      expect(result).toEqual(newSchedule);
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
        }),
      );
    });
  });
});
