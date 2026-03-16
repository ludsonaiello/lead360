import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ProjectTaskService } from './project-task.service';
import { ProjectService } from './project.service';
import { ProjectActivityService } from './project-activity.service';
import { TaskDependencyService } from './task-dependency.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ProjectTaskCategoryEnum } from '../dto/create-project-task.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const TENANT_B_ID = 'tenant-uuid-002';
const USER_ID = 'user-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const TASK_ID = 'task-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockProject = (overrides: any = {}) => ({
  id: PROJECT_ID,
  tenant_id: TENANT_ID,
  project_number: 'PRJ-2026-0001',
  ...overrides,
});

const mockTaskRecord = (overrides: any = {}) => ({
  id: TASK_ID,
  tenant_id: TENANT_ID,
  project_id: PROJECT_ID,
  quote_item_id: null,
  title: 'Install new shingles',
  description: 'Premium architectural shingles',
  status: 'not_started',
  estimated_duration_days: 3,
  estimated_start_date: new Date('2026-04-05'),
  estimated_end_date: new Date('2026-04-07'),
  actual_start_date: null,
  actual_end_date: null,
  is_delayed: false,
  order_index: 0,
  category: 'labor',
  notes: null,
  created_by_user_id: USER_ID,
  deleted_at: null,
  created_at: new Date('2026-03-13T10:00:00.000Z'),
  updated_at: new Date('2026-03-13T10:00:00.000Z'),
  task_assignees: [],
  dependencies: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  project: {
    findFirst: jest.fn(),
  },
  project_task: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

const mockAuditLogger = {
  logTenantChange: jest.fn(),
};

const mockProjectService = {
  recomputeProgress: jest.fn().mockResolvedValue({
    progress_percent: 0,
    totalTasks: 1,
    doneTasks: 0,
  }),
};

const mockActivityService = {
  logActivity: jest.fn(),
};

const mockTaskDependencyService = {
  validateStatusTransition: jest.fn().mockResolvedValue([]),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ProjectTaskService', () => {
  let service: ProjectTaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectTaskService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ProjectActivityService, useValue: mockActivityService },
        { provide: TaskDependencyService, useValue: mockTaskDependencyService },
      ],
    }).compile();

    service = module.get<ProjectTaskService>(ProjectTaskService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  // =========================================================================
  // CREATE
  // =========================================================================

  describe('create', () => {
    const createDto = {
      title: 'Install new shingles',
      description: 'Premium architectural shingles',
      estimated_duration_days: 3,
      estimated_start_date: '2026-04-05',
      estimated_end_date: '2026-04-07',
      category: ProjectTaskCategoryEnum.labor,
      order_index: 0,
    };

    it('should create a task and return formatted response', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.project_task.create.mockResolvedValue(mockTaskRecord());

      const result = await service.create(TENANT_ID, PROJECT_ID, USER_ID, createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(TASK_ID);
      expect(result.title).toBe('Install new shingles');
      expect(result.assignees).toEqual([]);
      expect(result.dependencies).toEqual([]);

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_ID },
        select: { id: true, project_number: true },
      });

      expect(mockPrisma.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
            title: 'Install new shingles',
            created_by_user_id: USER_ID,
          }),
        }),
      );
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, PROJECT_ID, USER_ID, createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when project belongs to another tenant', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null); // findFirst with wrong tenant returns null

      await expect(
        service.create(TENANT_B_ID, PROJECT_ID, USER_ID, createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should recompute project progress after creation', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.project_task.create.mockResolvedValue(mockTaskRecord());

      await service.create(TENANT_ID, PROJECT_ID, USER_ID, createDto);

      expect(mockProjectService.recomputeProgress).toHaveBeenCalledWith(
        TENANT_ID,
        PROJECT_ID,
      );
    });

    it('should create audit log and activity log', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.project_task.create.mockResolvedValue(mockTaskRecord());

      await service.create(TENANT_ID, PROJECT_ID, USER_ID, createDto);

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'project_task',
          entityId: TASK_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );

      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          project_id: PROJECT_ID,
          activity_type: 'task_created',
        }),
      );
    });
  });

  // =========================================================================
  // FIND ALL — paginated
  // =========================================================================

  describe('findAll', () => {
    it('should return paginated tasks ordered by order_index', async () => {
      const tasks = [
        mockTaskRecord({ id: 'task-1', order_index: 0 }),
        mockTaskRecord({ id: 'task-2', order_index: 1 }),
      ];
      mockPrisma.project_task.findMany.mockResolvedValue(tasks);
      mockPrisma.project_task.count.mockResolvedValue(2);

      const result = await service.findAll(TENANT_ID, PROJECT_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      expect(mockPrisma.project_task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
            deleted_at: null,
          }),
          orderBy: { order_index: 'asc' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by status when provided', async () => {
      mockPrisma.project_task.findMany.mockResolvedValue([]);
      mockPrisma.project_task.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, PROJECT_ID, {
        status: 'in_progress',
      });

      expect(mockPrisma.project_task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
            status: 'in_progress',
            deleted_at: null,
          }),
        }),
      );
    });

    it('should cap limit at 100', async () => {
      mockPrisma.project_task.findMany.mockResolvedValue([]);
      mockPrisma.project_task.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, PROJECT_ID, { limit: 500 });

      expect(mockPrisma.project_task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should default to page 1 and limit 20', async () => {
      mockPrisma.project_task.findMany.mockResolvedValue([]);
      mockPrisma.project_task.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, PROJECT_ID, {});

      expect(mockPrisma.project_task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should exclude soft-deleted tasks', async () => {
      mockPrisma.project_task.findMany.mockResolvedValue([]);
      mockPrisma.project_task.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, PROJECT_ID);

      expect(mockPrisma.project_task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deleted_at: null }),
        }),
      );
    });
  });

  // =========================================================================
  // FIND ONE — with is_delayed
  // =========================================================================

  describe('findOne', () => {
    it('should return task with computed is_delayed', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTaskRecord());

      const result = await service.findOne(TENANT_ID, PROJECT_ID, TASK_ID);

      expect(result).toBeDefined();
      expect(result.id).toBe(TASK_ID);
      expect(typeof result.is_delayed).toBe('boolean');
    });

    it('should throw NotFoundException when task not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_ID, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return soft-deleted tasks', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_ID, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.project_task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: TASK_ID,
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
            deleted_at: null,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // UPDATE — with status transitions
  // =========================================================================

  describe('update', () => {
    it('should update task fields without status change', async () => {
      const existing = mockTaskRecord();
      const updated = mockTaskRecord({ title: 'Updated title' });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      const result = await service.update(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        { title: 'Updated title' },
      );

      expect(result.title).toBe('Updated title');
      // Should NOT recompute progress for non-status changes
      expect(mockProjectService.recomputeProgress).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when task not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          title: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    // Status transition: not_started → in_progress
    it('should allow transition not_started → in_progress', async () => {
      const existing = mockTaskRecord({ status: 'not_started' });
      const updated = mockTaskRecord({
        status: 'in_progress',
        actual_start_date: new Date(),
      });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      const result = await service.update(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        { status: 'in_progress' as any },
      );

      expect(result.status).toBe('in_progress');
      expect(mockProjectService.recomputeProgress).toHaveBeenCalledWith(
        TENANT_ID,
        PROJECT_ID,
      );
    });

    // Status transition: not_started → blocked
    it('should allow transition not_started → blocked', async () => {
      const existing = mockTaskRecord({ status: 'not_started' });
      const updated = mockTaskRecord({ status: 'blocked' });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        status: 'blocked' as any,
      });

      expect(mockPrisma.project_task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'blocked' }),
        }),
      );
    });

    // Status transition: in_progress → done
    it('should allow transition in_progress → done and auto-set actual_end_date', async () => {
      const existing = mockTaskRecord({
        status: 'in_progress',
        actual_start_date: new Date('2026-04-06'),
      });
      const updated = mockTaskRecord({
        status: 'done',
        actual_start_date: new Date('2026-04-06'),
        actual_end_date: new Date(),
      });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        status: 'done' as any,
      });

      expect(mockPrisma.project_task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'done',
            actual_end_date: expect.any(Date),
          }),
        }),
      );
    });

    // Status transition: in_progress → blocked
    it('should allow transition in_progress → blocked', async () => {
      const existing = mockTaskRecord({ status: 'in_progress' });
      const updated = mockTaskRecord({ status: 'blocked' });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        status: 'blocked' as any,
      });

      expect(mockPrisma.project_task.update).toHaveBeenCalled();
    });

    // Status transition: blocked → in_progress
    it('should allow transition blocked → in_progress', async () => {
      const existing = mockTaskRecord({ status: 'blocked' });
      const updated = mockTaskRecord({ status: 'in_progress' });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        status: 'in_progress' as any,
      });

      expect(mockPrisma.project_task.update).toHaveBeenCalled();
    });

    // Auto-set actual_start_date on first in_progress
    it('should auto-set actual_start_date on first move to in_progress', async () => {
      const existing = mockTaskRecord({
        status: 'not_started',
        actual_start_date: null,
      });
      const updated = mockTaskRecord({
        status: 'in_progress',
        actual_start_date: new Date(),
      });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        status: 'in_progress' as any,
      });

      expect(mockPrisma.project_task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actual_start_date: expect.any(Date),
          }),
        }),
      );
    });

    // Should NOT auto-set actual_start_date on re-entry to in_progress (from blocked)
    it('should not overwrite actual_start_date when returning to in_progress from blocked', async () => {
      const originalStartDate = new Date('2026-04-06');
      const existing = mockTaskRecord({
        status: 'blocked',
        actual_start_date: originalStartDate,
      });
      const updated = mockTaskRecord({
        status: 'in_progress',
        actual_start_date: originalStartDate,
      });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        status: 'in_progress' as any,
      });

      // Should NOT have actual_start_date in update data since it already exists
      const updateCall = mockPrisma.project_task.update.mock.calls[0][0];
      expect(updateCall.data.actual_start_date).toBeUndefined();
    });

    // User-provided dates should NOT be overridden by auto-set

    it('should respect user-provided actual_end_date when moving to done', async () => {
      const existing = mockTaskRecord({
        status: 'in_progress',
        actual_start_date: new Date('2026-04-06'),
      });
      const userDate = '2026-04-15';
      const updated = mockTaskRecord({
        status: 'done',
        actual_start_date: new Date('2026-04-06'),
        actual_end_date: new Date(userDate),
      });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        status: 'done' as any,
        actual_end_date: userDate,
      });

      // Should use user-provided date, NOT auto-generated new Date()
      const updateCall = mockPrisma.project_task.update.mock.calls[0][0];
      expect(updateCall.data.actual_end_date).toEqual(new Date(userDate));
    });

    it('should respect user-provided actual_start_date when moving to in_progress', async () => {
      const existing = mockTaskRecord({
        status: 'not_started',
        actual_start_date: null,
      });
      const userDate = '2026-04-01';
      const updated = mockTaskRecord({
        status: 'in_progress',
        actual_start_date: new Date(userDate),
      });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        status: 'in_progress' as any,
        actual_start_date: userDate,
      });

      // Should use user-provided date, NOT auto-generated new Date()
      const updateCall = mockPrisma.project_task.update.mock.calls[0][0];
      expect(updateCall.data.actual_start_date).toEqual(new Date(userDate));
    });

    // INVALID transitions

    it('should reject transition not_started → done', async () => {
      const existing = mockTaskRecord({ status: 'not_started' });
      mockPrisma.project_task.findFirst.mockResolvedValue(existing);

      await expect(
        service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          status: 'done' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition done → in_progress (no going back)', async () => {
      const existing = mockTaskRecord({ status: 'done' });
      mockPrisma.project_task.findFirst.mockResolvedValue(existing);

      await expect(
        service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          status: 'in_progress' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition done → not_started', async () => {
      const existing = mockTaskRecord({ status: 'done' });
      mockPrisma.project_task.findFirst.mockResolvedValue(existing);

      await expect(
        service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          status: 'not_started' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition blocked → done', async () => {
      const existing = mockTaskRecord({ status: 'blocked' });
      mockPrisma.project_task.findFirst.mockResolvedValue(existing);

      await expect(
        service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          status: 'done' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition blocked → not_started', async () => {
      const existing = mockTaskRecord({ status: 'blocked' });
      mockPrisma.project_task.findFirst.mockResolvedValue(existing);

      await expect(
        service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          status: 'not_started' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // DEPENDENCY VALIDATION on status transition (Sprint 14 integration)

    it('should call validateStatusTransition when changing status', async () => {
      const existing = mockTaskRecord({ status: 'not_started' });
      const updated = mockTaskRecord({ status: 'in_progress' });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);
      mockTaskDependencyService.validateStatusTransition.mockResolvedValue([]);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        status: 'in_progress' as any,
      });

      expect(
        mockTaskDependencyService.validateStatusTransition,
      ).toHaveBeenCalledWith(TENANT_ID, TASK_ID, 'in_progress');
    });

    it('should throw ConflictException when blocking dependencies exist', async () => {
      const existing = mockTaskRecord({ status: 'not_started' });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockTaskDependencyService.validateStatusTransition.mockResolvedValue([
        {
          dependency_id: 'dep-1',
          depends_on_task_id: 'task-prereq',
          depends_on_task_title: 'Remove old shingles',
          depends_on_task_status: 'in_progress',
          dependency_type: 'finish_to_start',
        },
      ]);

      await expect(
        service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          status: 'in_progress' as any,
        }),
      ).rejects.toThrow(ConflictException);

      // Should NOT have called update
      expect(mockPrisma.project_task.update).not.toHaveBeenCalled();
    });

    it('should not call validateStatusTransition when status is not changing', async () => {
      const existing = mockTaskRecord();
      const updated = mockTaskRecord({ title: 'New title' });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        title: 'New title',
      });

      expect(
        mockTaskDependencyService.validateStatusTransition,
      ).not.toHaveBeenCalled();
    });

    // Audit log on update
    it('should create audit log with before/after on update', async () => {
      const existing = mockTaskRecord();
      const updated = mockTaskRecord({ notes: 'Updated notes' });

      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        notes: 'Updated notes',
      });

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'project_task',
          entityId: TASK_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: existing,
          after: updated,
        }),
      );
    });
  });

  // =========================================================================
  // SOFT DELETE
  // =========================================================================

  describe('softDelete', () => {
    it('should soft-delete a task and recompute progress', async () => {
      const existing = mockTaskRecord();
      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue({
        ...existing,
        deleted_at: new Date(),
      });

      await service.softDelete(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID);

      expect(mockPrisma.project_task.update).toHaveBeenCalledWith({
        where: { id: TASK_ID },
        data: { deleted_at: expect.any(Date) },
      });

      expect(mockProjectService.recomputeProgress).toHaveBeenCalledWith(
        TENANT_ID,
        PROJECT_ID,
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not delete tasks from other tenants', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(TENANT_B_ID, PROJECT_ID, TASK_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log on soft delete', async () => {
      const existing = mockTaskRecord();
      mockPrisma.project_task.findFirst.mockResolvedValue(existing);
      mockPrisma.project_task.update.mockResolvedValue({
        ...existing,
        deleted_at: new Date(),
      });

      await service.softDelete(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID);

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'project_task',
          entityId: TASK_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: existing,
        }),
      );
    });
  });

  // =========================================================================
  // is_delayed COMPUTATION — edge cases
  // =========================================================================

  describe('is_delayed computation', () => {
    it('should return false when status is done (regardless of dates)', async () => {
      const task = mockTaskRecord({
        status: 'done',
        estimated_end_date: new Date('2026-01-01'), // far in the past
        actual_end_date: new Date('2026-06-01'), // way past estimated
      });
      mockPrisma.project_task.findFirst.mockResolvedValue(task);

      const result = await service.findOne(TENANT_ID, PROJECT_ID, TASK_ID);
      expect(result.is_delayed).toBe(false);
    });

    it('should return true when actual_end_date > estimated_end_date and not done', async () => {
      const task = mockTaskRecord({
        status: 'in_progress',
        estimated_end_date: new Date('2026-04-07'),
        actual_end_date: new Date('2026-04-10'), // 3 days past estimated
      });
      mockPrisma.project_task.findFirst.mockResolvedValue(task);

      const result = await service.findOne(TENANT_ID, PROJECT_ID, TASK_ID);
      expect(result.is_delayed).toBe(true);
    });

    it('should return true when no actual_end_date, estimated_end_date is past, and status is not done', async () => {
      const task = mockTaskRecord({
        status: 'in_progress',
        estimated_end_date: new Date('2020-01-01'), // far in the past
        actual_end_date: null,
      });
      mockPrisma.project_task.findFirst.mockResolvedValue(task);

      const result = await service.findOne(TENANT_ID, PROJECT_ID, TASK_ID);
      expect(result.is_delayed).toBe(true);
    });

    it('should return false when no estimated_end_date is set', async () => {
      const task = mockTaskRecord({
        status: 'in_progress',
        estimated_end_date: null,
        actual_end_date: null,
      });
      mockPrisma.project_task.findFirst.mockResolvedValue(task);

      const result = await service.findOne(TENANT_ID, PROJECT_ID, TASK_ID);
      expect(result.is_delayed).toBe(false);
    });

    it('should return false when estimated_end_date is in the future', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const task = mockTaskRecord({
        status: 'in_progress',
        estimated_end_date: futureDate,
        actual_end_date: null,
      });
      mockPrisma.project_task.findFirst.mockResolvedValue(task);

      const result = await service.findOne(TENANT_ID, PROJECT_ID, TASK_ID);
      expect(result.is_delayed).toBe(false);
    });

    it('should return false for not_started task with future estimated_end_date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const task = mockTaskRecord({
        status: 'not_started',
        estimated_end_date: futureDate,
        actual_end_date: null,
      });
      mockPrisma.project_task.findFirst.mockResolvedValue(task);

      const result = await service.findOne(TENANT_ID, PROJECT_ID, TASK_ID);
      expect(result.is_delayed).toBe(false);
    });
  });

  // =========================================================================
  // TENANT ISOLATION
  // =========================================================================

  describe('tenant isolation', () => {
    it('should not return tasks from other tenants in findAll', async () => {
      mockPrisma.project_task.findMany.mockResolvedValue([]);
      mockPrisma.project_task.count.mockResolvedValue(0);

      await service.findAll(TENANT_B_ID, PROJECT_ID);

      expect(mockPrisma.project_task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_B_ID,
          }),
        }),
      );
    });

    it('should not find task from other tenant in findOne', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_B_ID, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not update task from other tenant', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_B_ID, PROJECT_ID, TASK_ID, USER_ID, {
          title: 'Hacked',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not delete task from other tenant', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(TENANT_B_ID, PROJECT_ID, TASK_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
