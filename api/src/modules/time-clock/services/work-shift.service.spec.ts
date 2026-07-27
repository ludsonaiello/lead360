import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkShiftService } from './work-shift.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  BulkCreateWorkShiftDto,
  CreateWorkShiftDto,
  UpdateWorkShiftDto,
} from '../dto/work-shift.dto';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_TENANT_ID = '99999999-9999-9999-9999-999999999999';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const EMPLOYEE_PROFILE_ID = '33333333-3333-3333-3333-333333333333';
const PROJECT_ID = '44444444-4444-4444-4444-444444444444';
const TASK_ID = '55555555-5555-5555-5555-555555555555';
const SHIFT_ID = '66666666-6666-6666-6666-666666666666';

const START_ISO = '2026-04-20T08:00:00.000Z';
const END_ISO = '2026-04-20T17:00:00.000Z';

const mockShiftRecord = (overrides: Record<string, unknown> = {}) => ({
  id: SHIFT_ID,
  tenant_id: TENANT_ID,
  employee_profile_id: EMPLOYEE_PROFILE_ID,
  project_id: PROJECT_ID,
  task_id: null,
  scheduled_start: new Date(START_ISO),
  scheduled_end: new Date(END_ISO),
  title: 'Morning Shift',
  notes: null,
  status: 'scheduled',
  reminder_sent_at: null,
  published_at: new Date('2026-04-12T10:00:00.000Z'),
  created_by_user_id: USER_ID,
  created_at: new Date('2026-04-12T10:00:00.000Z'),
  updated_at: new Date('2026-04-12T10:00:00.000Z'),
  employee_profile: {
    id: EMPLOYEE_PROFILE_ID,
    user: {
      id: 'user-uuid-002',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
    },
  },
  project: { id: PROJECT_ID, name: 'Test Project' },
  ...overrides,
});

const mockPrismaService = {
  work_shift: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  employee_profile: {
    findFirst: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  project_task: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

describe('WorkShiftService', () => {
  let service: WorkShiftService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        WorkShiftService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = moduleRef.get<WorkShiftService>(WorkShiftService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------
  // findAll()
  // ---------------------------------------------------------------------
  describe('findAll()', () => {
    it('should return paginated shifts filtered by tenant with defaults', async () => {
      const records = [mockShiftRecord()];
      mockPrismaService.work_shift.findMany.mockResolvedValue(records);
      mockPrismaService.work_shift.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_ID, {});

      expect(result).toEqual({
        data: records,
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      expect(mockPrismaService.work_shift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_ID },
          skip: 0,
          take: 20,
          orderBy: { scheduled_start: 'asc' },
        }),
      );
      expect(mockPrismaService.work_shift.count).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID },
      });
    });

    it('should apply custom pagination and compute totalPages', async () => {
      mockPrismaService.work_shift.findMany.mockResolvedValue([]);
      mockPrismaService.work_shift.count.mockResolvedValue(45);

      const result = await service.findAll(TENANT_ID, { page: 2, limit: 20 });

      expect(result.meta).toEqual({
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
      });
      expect(mockPrismaService.work_shift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it('should filter by employee_profile_id, project_id, status', async () => {
      mockPrismaService.work_shift.findMany.mockResolvedValue([]);
      mockPrismaService.work_shift.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {
        employee_profile_id: EMPLOYEE_PROFILE_ID,
        project_id: PROJECT_ID,
        status: 'scheduled',
      });

      expect(mockPrismaService.work_shift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: TENANT_ID,
            employee_profile_id: EMPLOYEE_PROFILE_ID,
            project_id: PROJECT_ID,
            status: 'scheduled',
          },
        }),
      );
    });

    it('should filter by date range on scheduled_start', async () => {
      mockPrismaService.work_shift.findMany.mockResolvedValue([]);
      mockPrismaService.work_shift.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {
        date_from: START_ISO,
        date_to: END_ISO,
      });

      const callArg =
        mockPrismaService.work_shift.findMany.mock.calls[0][0].where;
      expect(callArg.tenant_id).toBe(TENANT_ID);
      expect(callArg.scheduled_start.gte).toEqual(new Date(START_ISO));
      expect(callArg.scheduled_start.lte).toEqual(new Date(END_ISO));
    });

    it('should never leak across tenants', async () => {
      mockPrismaService.work_shift.findMany.mockResolvedValue([]);
      mockPrismaService.work_shift.count.mockResolvedValue(0);

      await service.findAll(OTHER_TENANT_ID, {});

      const call = mockPrismaService.work_shift.findMany.mock.calls[0][0];
      expect(call.where.tenant_id).toBe(OTHER_TENANT_ID);
    });
  });

  // ---------------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------------
  describe('create()', () => {
    const baseDto: CreateWorkShiftDto = {
      employee_profile_id: EMPLOYEE_PROFILE_ID,
      scheduled_start: START_ISO,
      scheduled_end: END_ISO,
    };

    it('should create a shift with status scheduled and published_at set', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      const created = mockShiftRecord();
      mockPrismaService.work_shift.create.mockResolvedValue(created);

      const result = await service.create(TENANT_ID, USER_ID, baseDto);

      expect(result).toBe(created);
      expect(mockPrismaService.work_shift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            employee_profile_id: EMPLOYEE_PROFILE_ID,
            project_id: null,
            task_id: null,
            status: 'scheduled',
            created_by_user_id: USER_ID,
          }),
        }),
      );
      const createCall =
        mockPrismaService.work_shift.create.mock.calls[0][0].data;
      expect(createCall.scheduled_start).toEqual(new Date(START_ISO));
      expect(createCall.scheduled_end).toEqual(new Date(END_ISO));
      expect(createCall.published_at).toBeInstanceOf(Date);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'work_shift',
          entityId: SHIFT_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should throw BadRequestException when end <= start', async () => {
      await expect(
        service.create(TENANT_ID, USER_ID, {
          ...baseDto,
          scheduled_end: START_ISO,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(
        mockPrismaService.employee_profile.findFirst,
      ).not.toHaveBeenCalled();
      expect(mockPrismaService.work_shift.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee profile not in tenant', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT_ID, USER_ID, baseDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.work_shift.create).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when project not in tenant', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, {
          ...baseDto,
          project_id: PROJECT_ID,
        }),
      ).rejects.toThrow(/Project not found/);
      expect(mockPrismaService.work_shift.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when task not in tenant', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, {
          ...baseDto,
          project_id: PROJECT_ID,
          task_id: TASK_ID,
        }),
      ).rejects.toThrow(/Task not found/);
      expect(mockPrismaService.work_shift.create).not.toHaveBeenCalled();
    });

    it('should scope employee profile lookup to the caller tenant', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue(null);
      await expect(
        service.create(OTHER_TENANT_ID, USER_ID, baseDto),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.employee_profile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: EMPLOYEE_PROFILE_ID, tenant_id: OTHER_TENANT_ID },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------
  // bulkCreate()
  // ---------------------------------------------------------------------
  describe('bulkCreate()', () => {
    const buildDto = (): BulkCreateWorkShiftDto => ({
      shifts: [
        {
          employee_profile_id: EMPLOYEE_PROFILE_ID,
          scheduled_start: START_ISO,
          scheduled_end: END_ISO,
        },
        {
          employee_profile_id: EMPLOYEE_PROFILE_ID,
          scheduled_start: '2026-04-21T08:00:00.000Z',
          scheduled_end: '2026-04-21T17:00:00.000Z',
        },
      ],
    });

    it('should validate ALL then create in a transaction, audit per shift', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      const created = [
        mockShiftRecord({ id: 'shift-1' }),
        mockShiftRecord({ id: 'shift-2' }),
      ];
      mockPrismaService.work_shift.create.mockImplementation((args: any) => ({
        args,
      }));
      mockPrismaService.$transaction.mockResolvedValue(created);

      const result = await service.bulkCreate(TENANT_ID, USER_ID, buildDto());

      expect(result).toEqual({ created: 2, shifts: created });
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(2);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          action: 'created',
          entityType: 'work_shift',
          entityId: 'shift-1',
        }),
      );
    });

    it('should reject the entire batch when any shift has end <= start', async () => {
      const dto = buildDto();
      dto.shifts[1].scheduled_end = dto.shifts[1].scheduled_start;

      await expect(service.bulkCreate(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should reject the entire batch when any employee does not belong to tenant', async () => {
      mockPrismaService.employee_profile.findFirst
        .mockResolvedValueOnce({ id: EMPLOYEE_PROFILE_ID })
        .mockResolvedValueOnce(null);

      await expect(
        service.bulkCreate(TENANT_ID, USER_ID, buildDto()),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------------
  describe('findOne()', () => {
    it('should return a shift scoped by tenant', async () => {
      const record = mockShiftRecord();
      mockPrismaService.work_shift.findFirst.mockResolvedValue(record);

      const result = await service.findOne(TENANT_ID, SHIFT_ID);

      expect(result).toBe(record);
      expect(mockPrismaService.work_shift.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SHIFT_ID, tenant_id: TENANT_ID },
        }),
      );
    });

    it('should throw NotFoundException when shift belongs to another tenant', async () => {
      mockPrismaService.work_shift.findFirst.mockResolvedValue(null);
      await expect(service.findOne(OTHER_TENANT_ID, SHIFT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------
  // update()
  // ---------------------------------------------------------------------
  describe('update()', () => {
    it('should update allowed fields and emit audit log with before/after', async () => {
      const existing = mockShiftRecord();
      mockPrismaService.work_shift.findFirst.mockResolvedValue(existing);
      const updated = mockShiftRecord({
        title: 'Updated',
        status: 'completed',
      });
      mockPrismaService.work_shift.update.mockResolvedValue(updated);

      const dto: UpdateWorkShiftDto = { title: 'Updated', status: 'completed' };
      const result = await service.update(TENANT_ID, USER_ID, SHIFT_ID, dto);

      expect(result).toBe(updated);
      expect(mockPrismaService.work_shift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SHIFT_ID },
          data: expect.objectContaining({
            title: 'Updated',
            status: 'completed',
          }),
        }),
      );
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'work_shift',
          entityId: SHIFT_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: existing,
          after: updated,
        }),
      );
    });

    it('should throw BadRequestException when new end <= existing start', async () => {
      const existing = mockShiftRecord();
      mockPrismaService.work_shift.findFirst.mockResolvedValue(existing);

      await expect(
        service.update(TENANT_ID, USER_ID, SHIFT_ID, {
          scheduled_end: START_ISO,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.work_shift.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when shift does not belong to tenant', async () => {
      mockPrismaService.work_shift.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, USER_ID, SHIFT_ID, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.work_shift.update).not.toHaveBeenCalled();
    });

    it('should validate new employee_profile belongs to tenant', async () => {
      mockPrismaService.work_shift.findFirst.mockResolvedValue(
        mockShiftRecord(),
      );
      mockPrismaService.employee_profile.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, USER_ID, SHIFT_ID, {
          employee_profile_id: EMPLOYEE_PROFILE_ID,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.work_shift.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // remove()
  // ---------------------------------------------------------------------
  describe('remove()', () => {
    it('should hard-delete a scheduled shift and emit audit log', async () => {
      const existing = mockShiftRecord({ status: 'scheduled' });
      mockPrismaService.work_shift.findFirst.mockResolvedValue(existing);
      mockPrismaService.work_shift.delete.mockResolvedValue(existing);

      const result = await service.remove(TENANT_ID, USER_ID, SHIFT_ID);

      expect(result).toEqual({ message: 'Shift deleted successfully' });
      expect(mockPrismaService.work_shift.delete).toHaveBeenCalledWith({
        where: { id: SHIFT_ID },
      });
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'work_shift',
          entityId: SHIFT_ID,
          before: existing,
        }),
      );
    });

    it('should allow deleting a cancelled shift', async () => {
      const existing = mockShiftRecord({ status: 'cancelled' });
      mockPrismaService.work_shift.findFirst.mockResolvedValue(existing);
      mockPrismaService.work_shift.delete.mockResolvedValue(existing);

      const result = await service.remove(TENANT_ID, USER_ID, SHIFT_ID);
      expect(result.message).toBe('Shift deleted successfully');
    });

    it('should throw BadRequestException when status is in_progress', async () => {
      mockPrismaService.work_shift.findFirst.mockResolvedValue(
        mockShiftRecord({ status: 'in_progress' }),
      );

      await expect(
        service.remove(TENANT_ID, USER_ID, SHIFT_ID),
      ).rejects.toThrow(/Cannot delete shift with status in_progress/);
      expect(mockPrismaService.work_shift.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when status is completed', async () => {
      mockPrismaService.work_shift.findFirst.mockResolvedValue(
        mockShiftRecord({ status: 'completed' }),
      );

      await expect(
        service.remove(TENANT_ID, USER_ID, SHIFT_ID),
      ).rejects.toThrow(/Cannot delete shift with status completed/);
    });

    it('should throw NotFoundException when shift does not exist in tenant', async () => {
      mockPrismaService.work_shift.findFirst.mockResolvedValue(null);
      await expect(
        service.remove(TENANT_ID, USER_ID, SHIFT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------
  // findMine()
  // ---------------------------------------------------------------------
  describe('findMine()', () => {
    it('should return only published shifts for current user', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      const records = [mockShiftRecord()];
      mockPrismaService.work_shift.findMany.mockResolvedValue(records);
      mockPrismaService.work_shift.count.mockResolvedValue(1);

      const result = await service.findMine(TENANT_ID, USER_ID, {});

      expect(result).toEqual({
        data: records,
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      expect(mockPrismaService.employee_profile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: USER_ID, tenant_id: TENANT_ID },
        }),
      );
      expect(mockPrismaService.work_shift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            employee_profile_id: EMPLOYEE_PROFILE_ID,
            published_at: { not: null },
          }),
        }),
      );
    });

    it('should apply status and date filters', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      mockPrismaService.work_shift.findMany.mockResolvedValue([]);
      mockPrismaService.work_shift.count.mockResolvedValue(0);

      await service.findMine(TENANT_ID, USER_ID, {
        status: 'scheduled',
        date_from: START_ISO,
        date_to: END_ISO,
      });

      const where =
        mockPrismaService.work_shift.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('scheduled');
      expect(where.scheduled_start.gte).toEqual(new Date(START_ISO));
      expect(where.scheduled_start.lte).toEqual(new Date(END_ISO));
    });

    it('should throw NotFoundException when employee profile missing', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue(null);

      await expect(service.findMine(TENANT_ID, USER_ID, {})).rejects.toThrow(
        /No employee profile found for current user/,
      );
    });
  });
});
