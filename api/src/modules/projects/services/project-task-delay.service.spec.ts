import { Test, TestingModule } from '@nestjs/testing';
import { ProjectTaskService } from './project-task.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ProjectService } from './project.service';
import { ProjectActivityService } from './project-activity.service';
import { TaskDependencyService } from './task-dependency.service';

/**
 * Tests for Sprint 16 additions to ProjectTaskService:
 * - getDelayDashboard()
 * - computeIsDelayed() (existing, validated here)
 */
describe('ProjectTaskService — Delay Detection (Sprint 16)', () => {
  let service: ProjectTaskService;
  let prisma: PrismaService;

  const mockPrisma = {
    project: { findMany: jest.fn(), findFirst: jest.fn() },
    project_task: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockAuditLogger = {
    logTenantChange: jest.fn(),
  };

  const mockProjectService = {
    recomputeProgress: jest.fn(),
  };

  const mockProjectActivityService = {
    logActivity: jest.fn(),
  };

  const mockTaskDependencyService = {
    validateStatusTransition: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectTaskService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ProjectActivityService, useValue: mockProjectActivityService },
        { provide: TaskDependencyService, useValue: mockTaskDependencyService },
      ],
    }).compile();

    service = module.get<ProjectTaskService>(ProjectTaskService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  // -------------------------------------------------------------------------
  // getDelayDashboard
  // -------------------------------------------------------------------------

  describe('getDelayDashboard', () => {
    const tenantId = 'tenant-123';

    it('should return empty when no delayed tasks exist', async () => {
      mockPrisma.project_task.groupBy.mockResolvedValue([]);

      const result = await service.getDelayDashboard(tenantId);

      expect(result).toEqual({
        total_delayed_tasks: 0,
        projects_with_delays: [],
      });
    });

    it('should return aggregated delay counts per project', async () => {
      mockPrisma.project_task.groupBy.mockResolvedValue([
        { project_id: 'proj-1', _count: { id: 3 } },
        { project_id: 'proj-2', _count: { id: 2 } },
      ]);

      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'proj-1', name: 'Kitchen Remodel' },
        { id: 'proj-2', name: 'Roof Repair' },
      ]);

      const result = await service.getDelayDashboard(tenantId);

      expect(result.total_delayed_tasks).toBe(5);
      expect(result.projects_with_delays).toEqual([
        {
          project_id: 'proj-1',
          project_name: 'Kitchen Remodel',
          delayed_task_count: 3,
        },
        {
          project_id: 'proj-2',
          project_name: 'Roof Repair',
          delayed_task_count: 2,
        },
      ]);
    });

    it('should filter by tenant_id in all queries', async () => {
      mockPrisma.project_task.groupBy.mockResolvedValue([
        { project_id: 'proj-1', _count: { id: 1 } },
      ]);
      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'proj-1', name: 'P1' },
      ]);

      await service.getDelayDashboard(tenantId);

      expect(mockPrisma.project_task.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: tenantId }),
        }),
      );
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: tenantId }),
        }),
      );
    });

    it('should exclude deleted tasks', async () => {
      mockPrisma.project_task.groupBy.mockResolvedValue([]);

      await service.getDelayDashboard(tenantId);

      expect(mockPrisma.project_task.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deleted_at: null }),
        }),
      );
    });

    it('should exclude done tasks', async () => {
      mockPrisma.project_task.groupBy.mockResolvedValue([]);

      await service.getDelayDashboard(tenantId);

      expect(mockPrisma.project_task.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: 'done' } }),
        }),
      );
    });

    it('should handle project name not found gracefully', async () => {
      mockPrisma.project_task.groupBy.mockResolvedValue([
        { project_id: 'orphan-proj', _count: { id: 1 } },
      ]);
      mockPrisma.project.findMany.mockResolvedValue([]); // No matching project

      const result = await service.getDelayDashboard(tenantId);

      expect(result.projects_with_delays[0].project_name).toBe('Unknown');
    });
  });

  // -------------------------------------------------------------------------
  // computeIsDelayed (existing — Sprint 13, validated for Sprint 16)
  // -------------------------------------------------------------------------

  describe('computeIsDelayed via enrichTask', () => {
    it('should never mark done tasks as delayed', async () => {
      const pastDate = new Date('2025-01-01');
      mockPrisma.project_task.findFirst.mockResolvedValue({
        id: 'task-1',
        tenant_id: 'tenant-123',
        project_id: 'proj-1',
        title: 'Done Task',
        status: 'done',
        estimated_end_date: pastDate,
        actual_end_date: null,
        deleted_at: null,
        task_assignees: [],
        dependencies: [],
      });

      const result = await service.findOne('tenant-123', 'proj-1', 'task-1');

      expect(result.is_delayed).toBe(false);
    });

    it('should mark tasks as delayed when estimated_end_date is past and status is not done', async () => {
      const pastDate = new Date('2025-01-01');
      mockPrisma.project_task.findFirst.mockResolvedValue({
        id: 'task-2',
        tenant_id: 'tenant-123',
        project_id: 'proj-1',
        title: 'Overdue Task',
        status: 'in_progress',
        estimated_end_date: pastDate,
        actual_end_date: null,
        deleted_at: null,
        task_assignees: [],
        dependencies: [],
      });

      const result = await service.findOne('tenant-123', 'proj-1', 'task-2');

      expect(result.is_delayed).toBe(true);
    });

    it('should not mark future tasks as delayed', async () => {
      const futureDate = new Date('2027-12-31');
      mockPrisma.project_task.findFirst.mockResolvedValue({
        id: 'task-3',
        tenant_id: 'tenant-123',
        project_id: 'proj-1',
        title: 'Future Task',
        status: 'in_progress',
        estimated_end_date: futureDate,
        actual_end_date: null,
        deleted_at: null,
        task_assignees: [],
        dependencies: [],
      });

      const result = await service.findOne('tenant-123', 'proj-1', 'task-3');

      expect(result.is_delayed).toBe(false);
    });

    it('should mark tasks as delayed when actual_end_date exceeds estimated_end_date', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue({
        id: 'task-4',
        tenant_id: 'tenant-123',
        project_id: 'proj-1',
        title: 'Late Finish',
        status: 'in_progress',
        estimated_end_date: new Date('2026-03-01'),
        actual_end_date: new Date('2026-03-10'),
        deleted_at: null,
        task_assignees: [],
        dependencies: [],
      });

      const result = await service.findOne('tenant-123', 'proj-1', 'task-4');

      expect(result.is_delayed).toBe(true);
    });

    it('should not mark task as delayed when no estimated_end_date', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue({
        id: 'task-5',
        tenant_id: 'tenant-123',
        project_id: 'proj-1',
        title: 'No Estimate',
        status: 'in_progress',
        estimated_end_date: null,
        actual_end_date: null,
        deleted_at: null,
        task_assignees: [],
        dependencies: [],
      });

      const result = await service.findOne('tenant-123', 'proj-1', 'task-5');

      expect(result.is_delayed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Tenant isolation for getDelayDashboard
  // -------------------------------------------------------------------------

  describe('tenant isolation — getDelayDashboard', () => {
    it('should not return delay counts from other tenants', async () => {
      // When querying for tenant-a, should only get tenant-a data
      mockPrisma.project_task.groupBy.mockResolvedValue([
        { project_id: 'proj-a', _count: { id: 2 } },
      ]);
      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'proj-a', name: 'Tenant A Project' },
      ]);

      const result = await service.getDelayDashboard('tenant-a');

      // Verify the query included tenant_id: 'tenant-a'
      expect(mockPrisma.project_task.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: 'tenant-a' }),
        }),
      );

      expect(result.total_delayed_tasks).toBe(2);
    });
  });
});
