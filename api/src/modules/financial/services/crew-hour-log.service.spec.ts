import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CrewHourLogService } from './crew-hour-log.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const CREW_MEMBER_ID = 'crew-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const TASK_ID = 'task-uuid-001';
const HOUR_LOG_ID = 'hourlog-uuid-001';

const mockHourLog = (overrides: any = {}) => ({
  id: HOUR_LOG_ID,
  tenant_id: TENANT_ID,
  crew_member_id: CREW_MEMBER_ID,
  project_id: PROJECT_ID,
  task_id: null,
  log_date: new Date('2026-03-15'),
  hours_regular: 8.0,
  hours_overtime: 2.0,
  source: 'manual',
  clockin_event_id: null,
  notes: 'Framing work',
  created_by_user_id: USER_ID,
  created_at: new Date(),
  updated_at: new Date(),
  crew_member: { id: CREW_MEMBER_ID, first_name: 'John', last_name: 'Doe' },
  project: { id: PROJECT_ID, name: 'Test Project', project_number: 'P-001' },
  task: null,
  ...overrides,
});

const mockPrismaService = {
  crew_hour_log: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  crew_member: {
    findFirst: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  project_task: {
    findFirst: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

describe('CrewHourLogService', () => {
  let service: CrewHourLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrewHourLogService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<CrewHourLogService>(CrewHourLogService);
    jest.clearAllMocks();
  });

  describe('logHours()', () => {
    const dto = {
      crew_member_id: CREW_MEMBER_ID,
      project_id: PROJECT_ID,
      log_date: '2026-03-15',
      hours_regular: 8.0,
      hours_overtime: 2.0,
      notes: 'Framing work',
    };

    it('should create an hour log and call audit log', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue({ id: CREW_MEMBER_ID });
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
      mockPrismaService.crew_hour_log.create.mockResolvedValue(mockHourLog());

      const result = await service.logHours(TENANT_ID, USER_ID, dto as any);

      expect(mockPrismaService.crew_hour_log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            crew_member_id: CREW_MEMBER_ID,
            project_id: PROJECT_ID,
            hours_regular: 8.0,
            hours_overtime: 2.0,
            source: 'manual',
            clockin_event_id: null,
          }),
        }),
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalled();
      expect(result.id).toBe(HOUR_LOG_ID);
    });

    it('should throw NotFoundException when crew member does not belong to tenant', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.logHours(TENANT_ID, USER_ID, dto as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.crew_hour_log.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when project does not belong to tenant', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue({ id: CREW_MEMBER_ID });
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.logHours(TENANT_ID, USER_ID, dto as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.crew_hour_log.create).not.toHaveBeenCalled();
    });

    it('should validate task belongs to project when task_id provided', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue({ id: CREW_MEMBER_ID });
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.logHours(TENANT_ID, USER_ID, { ...dto, task_id: TASK_ID } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should default hours_overtime to 0 when not provided', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue({ id: CREW_MEMBER_ID });
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
      mockPrismaService.crew_hour_log.create.mockResolvedValue(mockHourLog({ hours_overtime: 0 }));

      await service.logHours(TENANT_ID, USER_ID, {
        crew_member_id: CREW_MEMBER_ID,
        project_id: PROJECT_ID,
        log_date: '2026-03-15',
        hours_regular: 8.0,
      } as any);

      expect(mockPrismaService.crew_hour_log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hours_overtime: 0,
          }),
        }),
      );
    });
  });

  describe('updateHours()', () => {
    it('should update hour log and call audit log with before/after', async () => {
      const existing = mockHourLog();
      mockPrismaService.crew_hour_log.findFirst.mockResolvedValue(existing);
      const updated = mockHourLog({ hours_regular: 10.0 });
      mockPrismaService.crew_hour_log.update.mockResolvedValue(updated);

      const result = await service.updateHours(TENANT_ID, HOUR_LOG_ID, USER_ID, {
        hours_regular: 10.0,
      });

      expect(mockPrismaService.crew_hour_log.update).toHaveBeenCalledWith({
        where: { id: HOUR_LOG_ID },
        data: { hours_regular: 10.0 },
        include: expect.any(Object),
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          before: existing,
          after: updated,
        }),
      );

      expect(result.hours_regular).toBe(10.0);
    });

    it('should throw NotFoundException when hour log does not exist', async () => {
      mockPrismaService.crew_hour_log.findFirst.mockResolvedValue(null);

      await expect(
        service.updateHours(TENANT_ID, 'nonexistent', USER_ID, { hours_regular: 10 }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.crew_hour_log.update).not.toHaveBeenCalled();
    });
  });

  describe('listHours()', () => {
    it('should return paginated results with tenant_id filter', async () => {
      mockPrismaService.crew_hour_log.findMany.mockResolvedValue([mockHourLog()]);
      mockPrismaService.crew_hour_log.count.mockResolvedValue(1);

      const result = await service.listHours(TENANT_ID, { page: 1, limit: 20 });

      expect(mockPrismaService.crew_hour_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply date filters when provided', async () => {
      mockPrismaService.crew_hour_log.findMany.mockResolvedValue([]);
      mockPrismaService.crew_hour_log.count.mockResolvedValue(0);

      await service.listHours(TENANT_ID, {
        date_from: '2026-03-01',
        date_to: '2026-03-31',
      });

      expect(mockPrismaService.crew_hour_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            log_date: {
              gte: new Date('2026-03-01'),
              lte: new Date('2026-03-31'),
            },
          }),
        }),
      );
    });
  });

  describe('Tenant isolation', () => {
    it('should always include tenant_id in getHoursForProject', async () => {
      mockPrismaService.crew_hour_log.findMany.mockResolvedValue([]);

      await service.getHoursForProject(TENANT_ID, PROJECT_ID);

      expect(mockPrismaService.crew_hour_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
          }),
        }),
      );
    });

    it('should always include tenant_id in getHoursForCrew', async () => {
      mockPrismaService.crew_hour_log.findMany.mockResolvedValue([]);

      await service.getHoursForCrew(TENANT_ID, CREW_MEMBER_ID);

      expect(mockPrismaService.crew_hour_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            crew_member_id: CREW_MEMBER_ID,
          }),
        }),
      );
    });
  });
});
