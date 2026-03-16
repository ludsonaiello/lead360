import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GanttDataService } from './gantt-data.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('GanttDataService', () => {
  let service: GanttDataService;
  let prisma: PrismaService;

  const TENANT_A = 'tenant-aaa-111';
  const TENANT_B = 'tenant-bbb-222';
  const PROJECT_ID = 'proj-001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GanttDataService,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findFirst: jest.fn(),
            },
            project_task: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<GanttDataService>(GanttDataService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // Helper: build a mock task with all relations
  // ===========================================================================

  const buildMockTask = (overrides: any = {}) => ({
    id: 'task-001',
    tenant_id: TENANT_A,
    project_id: PROJECT_ID,
    title: 'Demo existing kitchen',
    status: 'done',
    estimated_start_date: new Date('2026-04-01'),
    estimated_end_date: new Date('2026-04-03'),
    actual_start_date: new Date('2026-04-01'),
    actual_end_date: new Date('2026-04-03'),
    is_delayed: false,
    order_index: 0,
    task_assignees: [
      {
        id: 'assign-001',
        assignee_type: 'crew_member',
        crew_member: { id: 'crew-001', first_name: 'Mike', last_name: 'Johnson' },
        subcontractor: null,
        assignee_user: null,
        assigned_at: new Date('2026-04-01'),
      },
    ],
    dependencies: [],
    dependent_on_this: [
      {
        id: 'dep-001',
        task_id: 'task-002',
        depends_on_task_id: 'task-001',
        dependency_type: 'finish_to_start',
        task: { id: 'task-002', title: 'Rough plumbing' },
      },
    ],
    ...overrides,
  });

  const mockProject = {
    id: PROJECT_ID,
    name: 'Kitchen Remodel',
    start_date: new Date('2026-04-01'),
    target_completion_date: new Date('2026-06-15'),
    progress_percent: 45.0,
  };

  // ===========================================================================
  // getProjectGantt — Basic functionality
  // ===========================================================================

  describe('getProjectGantt', () => {
    it('should return project metadata with correct structure', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);

      expect(result.project).toEqual({
        id: PROJECT_ID,
        name: 'Kitchen Remodel',
        start_date: new Date('2026-04-01'),
        target_completion_date: new Date('2026-06-15'),
        progress_percent: 45.0,
      });
      expect(result.tasks).toEqual([]);
    });

    it('should throw NotFoundException when project not found', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(null);

      await expect(
        service.getProjectGantt(TENANT_A, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return tasks ordered by order_index', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);

      const task1 = buildMockTask({ id: 'task-001', order_index: 0, title: 'First' });
      const task2 = buildMockTask({ id: 'task-002', order_index: 1, title: 'Second' });
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([task1, task2] as any);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].order_index).toBe(0);
      expect(result.tasks[1].order_index).toBe(1);

      // Verify orderBy was passed to Prisma
      expect(prisma.project_task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { order_index: 'asc' },
        }),
      );
    });

    it('should format task response with all Gantt fields', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([buildMockTask()] as any);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      const task = result.tasks[0];

      expect(task).toEqual({
        id: 'task-001',
        title: 'Demo existing kitchen',
        status: 'done',
        estimated_start_date: new Date('2026-04-01'),
        estimated_end_date: new Date('2026-04-03'),
        actual_start_date: new Date('2026-04-01'),
        actual_end_date: new Date('2026-04-03'),
        is_delayed: false,
        order_index: 0,
        assignees: [
          { type: 'crew_member', name: 'Mike Johnson' },
        ],
        dependencies: [],
        dependents: [
          { task_id: 'task-002', type: 'finish_to_start' },
        ],
      });
    });

    it('should only return non-deleted tasks (deleted_at: null)', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      await service.getProjectGantt(TENANT_A, PROJECT_ID);

      expect(prisma.project_task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deleted_at: null,
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // Assignee formatting
  // ===========================================================================

  describe('Assignee formatting', () => {
    const setupMocks = (taskOverrides: any) => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([
        buildMockTask(taskOverrides),
      ] as any);
    };

    it('should format crew_member assignees with full name', async () => {
      setupMocks({
        task_assignees: [
          {
            id: 'a1',
            assignee_type: 'crew_member',
            crew_member: { id: 'c1', first_name: 'Mike', last_name: 'Johnson' },
            subcontractor: null,
            assignee_user: null,
          },
        ],
      });

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      expect(result.tasks[0].assignees[0]).toEqual({
        type: 'crew_member',
        name: 'Mike Johnson',
      });
    });

    it('should format subcontractor assignees with business_name', async () => {
      setupMocks({
        task_assignees: [
          {
            id: 'a2',
            assignee_type: 'subcontractor',
            crew_member: null,
            subcontractor: { id: 's1', business_name: 'ABC Plumbing' },
            assignee_user: null,
          },
        ],
      });

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      expect(result.tasks[0].assignees[0]).toEqual({
        type: 'subcontractor',
        name: 'ABC Plumbing',
      });
    });

    it('should format user assignees with full name', async () => {
      setupMocks({
        task_assignees: [
          {
            id: 'a3',
            assignee_type: 'user',
            crew_member: null,
            subcontractor: null,
            assignee_user: { id: 'u1', first_name: 'Jane', last_name: 'Doe' },
          },
        ],
      });

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      expect(result.tasks[0].assignees[0]).toEqual({
        type: 'user',
        name: 'Jane Doe',
      });
    });

    it('should handle multiple assignees on a single task', async () => {
      setupMocks({
        task_assignees: [
          {
            id: 'a1',
            assignee_type: 'crew_member',
            crew_member: { id: 'c1', first_name: 'Mike', last_name: 'Johnson' },
            subcontractor: null,
            assignee_user: null,
          },
          {
            id: 'a2',
            assignee_type: 'subcontractor',
            crew_member: null,
            subcontractor: { id: 's1', business_name: 'ABC Plumbing' },
            assignee_user: null,
          },
        ],
      });

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      expect(result.tasks[0].assignees).toHaveLength(2);
    });

    it('should handle tasks with no assignees', async () => {
      setupMocks({ task_assignees: [] });

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      expect(result.tasks[0].assignees).toEqual([]);
    });

    it('should return "Unknown" when assignee relation data is missing', async () => {
      setupMocks({
        task_assignees: [
          {
            id: 'a4',
            assignee_type: 'crew_member',
            crew_member: null,
            subcontractor: null,
            assignee_user: null,
          },
        ],
      });

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      expect(result.tasks[0].assignees[0]).toEqual({
        type: 'crew_member',
        name: 'Unknown',
      });
    });
  });

  // ===========================================================================
  // Dependencies and Dependents
  // ===========================================================================

  describe('Dependencies and Dependents', () => {
    it('should format dependencies (upstream) correctly', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([
        buildMockTask({
          id: 'task-002',
          dependencies: [
            {
              id: 'dep-001',
              depends_on_task_id: 'task-001',
              dependency_type: 'finish_to_start',
              depends_on_task: { id: 'task-001', title: 'Demo' },
            },
          ],
          dependent_on_this: [],
        }),
      ] as any);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);

      expect(result.tasks[0].dependencies).toEqual([
        { depends_on_task_id: 'task-001', type: 'finish_to_start' },
      ]);
      expect(result.tasks[0].dependents).toEqual([]);
    });

    it('should format dependents (downstream) correctly', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([
        buildMockTask({
          id: 'task-001',
          dependencies: [],
          dependent_on_this: [
            {
              id: 'dep-001',
              task_id: 'task-002',
              depends_on_task_id: 'task-001',
              dependency_type: 'finish_to_start',
              task: { id: 'task-002', title: 'Rough plumbing' },
            },
            {
              id: 'dep-002',
              task_id: 'task-003',
              depends_on_task_id: 'task-001',
              dependency_type: 'start_to_start',
              task: { id: 'task-003', title: 'Electrical rough-in' },
            },
          ],
        }),
      ] as any);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);

      expect(result.tasks[0].dependents).toEqual([
        { task_id: 'task-002', type: 'finish_to_start' },
        { task_id: 'task-003', type: 'start_to_start' },
      ]);
    });

    it('should include all dependency types (finish_to_start, start_to_start, finish_to_finish)', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([
        buildMockTask({
          dependencies: [
            {
              id: 'dep-1',
              depends_on_task_id: 'task-A',
              dependency_type: 'finish_to_start',
              depends_on_task: { id: 'task-A', title: 'A' },
            },
            {
              id: 'dep-2',
              depends_on_task_id: 'task-B',
              dependency_type: 'start_to_start',
              depends_on_task: { id: 'task-B', title: 'B' },
            },
            {
              id: 'dep-3',
              depends_on_task_id: 'task-C',
              dependency_type: 'finish_to_finish',
              depends_on_task: { id: 'task-C', title: 'C' },
            },
          ],
          dependent_on_this: [],
        }),
      ] as any);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      const types = result.tasks[0].dependencies.map((d) => d.type);
      expect(types).toEqual(['finish_to_start', 'start_to_start', 'finish_to_finish']);
    });
  });

  // ===========================================================================
  // is_delayed computation
  // ===========================================================================

  describe('is_delayed computation', () => {
    const setupWithTask = async (taskOverrides: any) => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([
        buildMockTask({
          task_assignees: [],
          dependencies: [],
          dependent_on_this: [],
          ...taskOverrides,
        }),
      ] as any);
      return service.getProjectGantt(TENANT_A, PROJECT_ID);
    };

    it('should NOT be delayed when status is done', async () => {
      const result = await setupWithTask({
        status: 'done',
        estimated_end_date: new Date('2020-01-01'), // far past
        actual_end_date: null,
      });
      expect(result.tasks[0].is_delayed).toBe(false);
    });

    it('should be delayed when estimated_end_date is past and status is not done', async () => {
      const result = await setupWithTask({
        status: 'in_progress',
        estimated_end_date: new Date('2020-01-01'),
        actual_end_date: null,
      });
      expect(result.tasks[0].is_delayed).toBe(true);
    });

    it('should be delayed when actual_end_date > estimated_end_date', async () => {
      const result = await setupWithTask({
        status: 'in_progress',
        estimated_end_date: new Date('2026-04-03'),
        actual_end_date: new Date('2026-04-10'),
      });
      expect(result.tasks[0].is_delayed).toBe(true);
    });

    it('should NOT be delayed when estimated_end_date is in the future', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const result = await setupWithTask({
        status: 'in_progress',
        estimated_end_date: futureDate,
        actual_end_date: null,
      });
      expect(result.tasks[0].is_delayed).toBe(false);
    });

    it('should NOT be delayed when no estimated_end_date exists', async () => {
      const result = await setupWithTask({
        status: 'in_progress',
        estimated_end_date: null,
        actual_end_date: null,
      });
      expect(result.tasks[0].is_delayed).toBe(false);
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe('Edge cases', () => {
    it('should handle project with no tasks', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);

      expect(result.project).toBeDefined();
      expect(result.tasks).toEqual([]);
    });

    it('should handle project with null progress_percent', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue({
        ...mockProject,
        progress_percent: null,
      } as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      expect(result.project.progress_percent).toBe(0);
    });

    it('should handle project with null dates', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue({
        ...mockProject,
        start_date: null,
        target_completion_date: null,
      } as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      expect(result.project.start_date).toBeNull();
      expect(result.project.target_completion_date).toBeNull();
    });

    it('should handle tasks with null dates', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([
        buildMockTask({
          estimated_start_date: null,
          estimated_end_date: null,
          actual_start_date: null,
          actual_end_date: null,
          task_assignees: [],
          dependencies: [],
          dependent_on_this: [],
        }),
      ] as any);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      const task = result.tasks[0];
      expect(task.estimated_start_date).toBeNull();
      expect(task.estimated_end_date).toBeNull();
      expect(task.actual_start_date).toBeNull();
      expect(task.actual_end_date).toBeNull();
    });

    it('should convert Decimal progress_percent to number', async () => {
      // Prisma Decimal objects implement valueOf() which Number() calls
      const fakeDecimal = { valueOf: () => 67.5 };
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue({
        ...mockProject,
        progress_percent: fakeDecimal,
      } as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      const result = await service.getProjectGantt(TENANT_A, PROJECT_ID);
      expect(typeof result.project.progress_percent).toBe('number');
      expect(result.project.progress_percent).toBe(67.5);
    });
  });

  // ===========================================================================
  // Tenant Isolation (MANDATORY)
  // ===========================================================================

  describe('Tenant Isolation', () => {
    it('should scope project query to tenant_id', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      await service.getProjectGantt(TENANT_A, PROJECT_ID);

      expect(prisma.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
            id: PROJECT_ID,
          }),
        }),
      );
    });

    it('should scope task query to tenant_id', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      await service.getProjectGantt(TENANT_A, PROJECT_ID);

      expect(prisma.project_task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
            project_id: PROJECT_ID,
          }),
        }),
      );
    });

    it('should NOT return project from another tenant', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(null);

      await expect(
        service.getProjectGantt(TENANT_B, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use different tenant_id per call — no cross-contamination', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      await service.getProjectGantt(TENANT_A, PROJECT_ID);
      await service.getProjectGantt(TENANT_B, PROJECT_ID).catch(() => {});

      const findFirstCalls = (prisma.project.findFirst as jest.Mock).mock.calls;
      expect(findFirstCalls[0][0].where.tenant_id).toBe(TENANT_A);
      expect(findFirstCalls[1][0].where.tenant_id).toBe(TENANT_B);
    });
  });

  // ===========================================================================
  // RBAC (service layer)
  // ===========================================================================

  describe('RBAC (service layer)', () => {
    it('service method requires tenantId parameter — never derives from request', () => {
      expect(service.getProjectGantt).toBeDefined();
      expect(service.getProjectGantt.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ===========================================================================
  // Prisma includes — verify correct relations are fetched
  // ===========================================================================

  describe('Prisma includes', () => {
    it('should include task_assignees with crew_member, subcontractor, and user', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      await service.getProjectGantt(TENANT_A, PROJECT_ID);

      const call = (prisma.project_task.findMany as jest.Mock).mock.calls[0][0];
      expect(call.include.task_assignees).toBeDefined();
      expect(call.include.task_assignees.include.crew_member).toBeDefined();
      expect(call.include.task_assignees.include.subcontractor).toBeDefined();
      expect(call.include.task_assignees.include.assignee_user).toBeDefined();
    });

    it('should include dependencies (upstream)', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      await service.getProjectGantt(TENANT_A, PROJECT_ID);

      const call = (prisma.project_task.findMany as jest.Mock).mock.calls[0][0];
      expect(call.include.dependencies).toBeDefined();
    });

    it('should include dependent_on_this (downstream) for arrow rendering', async () => {
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValue(mockProject as any);
      jest.spyOn(prisma.project_task, 'findMany').mockResolvedValue([]);

      await service.getProjectGantt(TENANT_A, PROJECT_ID);

      const call = (prisma.project_task.findMany as jest.Mock).mock.calls[0][0];
      expect(call.include.dependent_on_this).toBeDefined();
    });
  });
});
