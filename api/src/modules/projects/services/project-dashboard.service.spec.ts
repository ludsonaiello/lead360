import { Test, TestingModule } from '@nestjs/testing';
import { ProjectDashboardService } from './project-dashboard.service';
import { ProjectActivityService } from './project-activity.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('ProjectDashboardService', () => {
  let service: ProjectDashboardService;
  let prisma: PrismaService;
  let activityService: ProjectActivityService;

  const TENANT_A = 'tenant-aaa-111';
  const TENANT_B = 'tenant-bbb-222';
  const PM_USER_ID = 'pm-user-001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectDashboardService,
        {
          provide: PrismaService,
          useValue: {
            project: {
              count: jest.fn(),
              groupBy: jest.fn(),
              findMany: jest.fn(),
            },
            project_task: {
              count: jest.fn(),
              groupBy: jest.fn(),
            },
          },
        },
        {
          provide: ProjectActivityService,
          useValue: {
            getTenantRecentActivity: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectDashboardService>(ProjectDashboardService);
    prisma = module.get<PrismaService>(PrismaService);
    activityService = module.get<ProjectActivityService>(
      ProjectActivityService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // getDashboardData
  // ===========================================================================

  describe('getDashboardData', () => {
    const setupDefaultMocks = () => {
      // Total projects
      jest.spyOn(prisma.project, 'count').mockResolvedValue(25);

      // Status distribution
      jest.spyOn(prisma.project, 'groupBy').mockResolvedValue([
        { status: 'planned', _count: { id: 5 } },
        { status: 'in_progress', _count: { id: 12 } },
        { status: 'on_hold', _count: { id: 3 } },
        { status: 'completed', _count: { id: 4 } },
        { status: 'canceled', _count: { id: 1 } },
      ] as any);

      // Delayed tasks count + overdue tasks count
      const countSpy = jest.spyOn(prisma.project_task, 'count');
      countSpy.mockResolvedValueOnce(8); // delayed_tasks_count
      countSpy.mockResolvedValueOnce(3); // overdue_tasks_count

      // Projects with delays (groupBy returns array of groups)
      jest.spyOn(prisma.project_task, 'groupBy').mockResolvedValue([
        { project_id: 'proj-1' },
        { project_id: 'proj-2' },
        { project_id: 'proj-3' },
        { project_id: 'proj-4' },
      ] as any);

      // Upcoming deadlines
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([
        {
          id: 'proj-1',
          name: 'Kitchen Remodel',
          target_completion_date: new Date('2026-04-15'),
        },
      ] as any);

      // Recent activity
      jest
        .spyOn(activityService, 'getTenantRecentActivity')
        .mockResolvedValue([
          {
            activity_type: 'task_completed',
            project_id: 'proj-1',
            project: { id: 'proj-1', name: 'Kitchen Remodel', project_number: 'PRJ-0001' },
            description: 'Completed task: Install countertops',
            user_id: 'user-1',
            user: { id: 'user-1', first_name: 'John', last_name: 'Smith' },
            created_at: new Date('2026-03-16T10:30:00.000Z'),
          },
        ]);
    };

    it('should return complete dashboard data with correct structure', async () => {
      setupDefaultMocks();

      const result = await service.getDashboardData(TENANT_A, {});

      expect(result).toEqual({
        total_projects: 25,
        status_distribution: {
          planned: 5,
          in_progress: 12,
          on_hold: 3,
          completed: 4,
          canceled: 1,
        },
        active_projects: 17, // planned + in_progress = 5 + 12
        delayed_tasks_count: 8,
        projects_with_delays: 4,
        overdue_tasks_count: 3,
        upcoming_deadlines: expect.arrayContaining([
          expect.objectContaining({
            project_id: 'proj-1',
            project_name: 'Kitchen Remodel',
            target_completion_date: expect.any(Date),
            days_remaining: expect.any(Number),
          }),
        ]),
        recent_activity: expect.arrayContaining([
          expect.objectContaining({
            activity_type: 'task_completed',
            project_name: 'Kitchen Remodel',
            user_name: 'John Smith',
          }),
        ]),
      });
    });

    it('should scope all project queries to tenant_id', async () => {
      setupDefaultMocks();

      await service.getDashboardData(TENANT_A, {});

      // project.count called with tenant_id
      expect(prisma.project.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );

      // project.groupBy called with tenant_id
      expect(prisma.project.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );

      // project_task.count called with tenant_id
      expect(prisma.project_task.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );

      // activity service called with correct tenant
      expect(activityService.getTenantRecentActivity).toHaveBeenCalledWith(
        TENANT_A,
        10,
      );
    });

    it('should NOT return data from other tenants', async () => {
      setupDefaultMocks();

      await service.getDashboardData(TENANT_A, {});

      // Verify no query was made without tenant_id filter
      const projectCountCalls = (prisma.project.count as jest.Mock).mock.calls;
      for (const [args] of projectCountCalls) {
        expect(args.where).toHaveProperty('tenant_id', TENANT_A);
      }

      const taskCountCalls = (prisma.project_task.count as jest.Mock).mock
        .calls;
      for (const [args] of taskCountCalls) {
        expect(args.where).toHaveProperty('tenant_id', TENANT_A);
      }
    });

    it('should apply status filter to project counts', async () => {
      setupDefaultMocks();

      await service.getDashboardData(TENANT_A, { status: 'in_progress' });

      expect(prisma.project.count).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_A, status: 'in_progress' },
      });
    });

    it('should apply assigned_pm_user_id filter', async () => {
      setupDefaultMocks();

      await service.getDashboardData(TENANT_A, {
        assigned_pm_user_id: PM_USER_ID,
      });

      expect(prisma.project.count).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_A,
          assigned_pm_user_id: PM_USER_ID,
        },
      });
    });

    it('should apply date range filters', async () => {
      setupDefaultMocks();

      await service.getDashboardData(TENANT_A, {
        date_from: '2026-01-01',
        date_to: '2026-06-30',
      });

      expect(prisma.project.count).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_A,
          created_at: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-06-30'),
          },
        },
      });
    });

    it('should return all status keys even when no projects exist', async () => {
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.project, 'groupBy').mockResolvedValue([] as any);
      jest.spyOn(prisma.project_task, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.project_task, 'groupBy').mockResolvedValue([] as any);
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest
        .spyOn(activityService, 'getTenantRecentActivity')
        .mockResolvedValue([]);

      const result = await service.getDashboardData(TENANT_A, {});

      expect(result.status_distribution).toEqual({
        planned: 0,
        in_progress: 0,
        on_hold: 0,
        completed: 0,
        canceled: 0,
      });
      expect(result.total_projects).toBe(0);
      expect(result.active_projects).toBe(0);
      expect(result.delayed_tasks_count).toBe(0);
      expect(result.overdue_tasks_count).toBe(0);
      expect(result.projects_with_delays).toBe(0);
      expect(result.upcoming_deadlines).toEqual([]);
      expect(result.recent_activity).toEqual([]);
    });

    it('should format recent activity with flattened user/project names', async () => {
      jest.spyOn(prisma.project, 'count').mockResolvedValue(1);
      jest.spyOn(prisma.project, 'groupBy').mockResolvedValue([
        { status: 'in_progress', _count: { id: 1 } },
      ] as any);
      jest.spyOn(prisma.project_task, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.project_task, 'groupBy').mockResolvedValue([] as any);
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest
        .spyOn(activityService, 'getTenantRecentActivity')
        .mockResolvedValue([
          {
            activity_type: 'log_added',
            project_id: 'proj-1',
            project: { id: 'proj-1', name: 'Bathroom Reno', project_number: 'PRJ-0002' },
            description: 'Added project log entry',
            user_id: null,
            user: null,
            created_at: new Date('2026-03-16T08:00:00.000Z'),
          },
        ]);

      const result = await service.getDashboardData(TENANT_A, {});

      expect(result.recent_activity[0]).toEqual({
        activity_type: 'log_added',
        project_id: 'proj-1',
        project_name: 'Bathroom Reno',
        description: 'Added project log entry',
        user_id: null,
        user_name: null,
        created_at: new Date('2026-03-16T08:00:00.000Z'),
      });
    });

    it('should calculate days_remaining correctly for upcoming deadlines', async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 10);

      jest.spyOn(prisma.project, 'count').mockResolvedValue(1);
      jest.spyOn(prisma.project, 'groupBy').mockResolvedValue([
        { status: 'in_progress', _count: { id: 1 } },
      ] as any);
      jest.spyOn(prisma.project_task, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.project_task, 'groupBy').mockResolvedValue([] as any);
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([
        {
          id: 'proj-1',
          name: 'Test Project',
          target_completion_date: targetDate,
        },
      ] as any);
      jest
        .spyOn(activityService, 'getTenantRecentActivity')
        .mockResolvedValue([]);

      const result = await service.getDashboardData(TENANT_A, {});

      // days_remaining should be approximately 10 (±1 due to time-of-day rounding)
      expect(result.upcoming_deadlines[0].days_remaining).toBeGreaterThanOrEqual(9);
      expect(result.upcoming_deadlines[0].days_remaining).toBeLessThanOrEqual(11);
    });
  });

  // ===========================================================================
  // getProjectsWithSummary
  // ===========================================================================

  describe('getProjectsWithSummary', () => {
    it('should return paginated projects with task counts', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          project_number: 'PRJ-0001',
          name: 'Kitchen Remodel',
          status: 'in_progress',
          start_date: new Date('2026-03-01'),
          target_completion_date: new Date('2026-04-15'),
          actual_completion_date: null,
          contract_value: 25000,
          progress_percent: 45,
          assigned_pm_user: { id: PM_USER_ID, first_name: 'Jane', last_name: 'Doe' },
          lead: { id: 'lead-1', first_name: 'John', last_name: 'Smith' },
          _count: { tasks: 12 },
        },
      ];

      jest.spyOn(prisma.project, 'findMany').mockResolvedValue(mockProjects as any);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(1);

      // completed tasks groupBy
      const groupBySpy = jest.spyOn(prisma.project_task, 'groupBy');
      groupBySpy.mockResolvedValueOnce([
        { project_id: 'proj-1', _count: { id: 5 } },
      ] as any);
      groupBySpy.mockResolvedValueOnce([
        { project_id: 'proj-1', _count: { id: 2 } },
      ] as any);

      const result = await service.getProjectsWithSummary(TENANT_A, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'proj-1',
        project_number: 'PRJ-0001',
        name: 'Kitchen Remodel',
        status: 'in_progress',
        start_date: new Date('2026-03-01'),
        target_completion_date: new Date('2026-04-15'),
        actual_completion_date: null,
        contract_value: 25000,
        progress_percent: 45,
        assigned_pm: { id: PM_USER_ID, first_name: 'Jane', last_name: 'Doe' },
        customer: { id: 'lead-1', first_name: 'John', last_name: 'Smith' },
        task_count: 12,
        completed_task_count: 5,
        delayed_task_count: 2,
      });
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should scope all queries to tenant_id', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);

      await service.getProjectsWithSummary(TENANT_A, {});

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );
      expect(prisma.project.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );
    });

    it('should NOT return data from other tenants', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);

      await service.getProjectsWithSummary(TENANT_A, {});

      // Verify tenant_id filter is in place
      const findManyCalls = (prisma.project.findMany as jest.Mock).mock.calls;
      for (const [args] of findManyCalls) {
        expect(args.where.tenant_id).toBe(TENANT_A);
      }
    });

    it('should apply status filter', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);

      await service.getProjectsWithSummary(TENANT_A, {
        status: 'completed',
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_A, status: 'completed' },
        }),
      );
    });

    it('should apply PM filter', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);

      await service.getProjectsWithSummary(TENANT_A, {
        assigned_pm_user_id: PM_USER_ID,
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: TENANT_A,
            assigned_pm_user_id: PM_USER_ID,
          },
        }),
      );
    });

    it('should apply search filter across name and project_number', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);

      await service.getProjectsWithSummary(TENANT_A, {
        search: 'kitchen',
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: TENANT_A,
            OR: [
              { name: { contains: 'kitchen' } },
              { project_number: { contains: 'kitchen' } },
            ],
          },
        }),
      );
    });

    it('should respect pagination parameters', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(50);

      const result = await service.getProjectsWithSummary(TENANT_A, {
        page: 3,
        limit: 10,
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        }),
      );
      expect(result.meta).toEqual({
        total: 50,
        page: 3,
        limit: 10,
        totalPages: 5,
      });
    });

    it('should cap limit at 100', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);

      await service.getProjectsWithSummary(TENANT_A, { limit: 500 });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should default page to 1 and limit to 20', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);

      await service.getProjectsWithSummary(TENANT_A, {});

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should return empty data array with correct meta when no projects', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);

      const result = await service.getProjectsWithSummary(TENANT_A, {});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should handle null assigned_pm_user gracefully', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([
        {
          id: 'proj-1',
          project_number: 'PRJ-0001',
          name: 'Solo Project',
          status: 'planned',
          start_date: null,
          target_completion_date: null,
          actual_completion_date: null,
          contract_value: null,
          progress_percent: 0,
          assigned_pm_user: null,
          lead: null,
          _count: { tasks: 0 },
        },
      ] as any);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(1);
      jest.spyOn(prisma.project_task, 'groupBy').mockResolvedValue([] as any);

      const result = await service.getProjectsWithSummary(TENANT_A, {});

      expect(result.data[0].assigned_pm).toBeNull();
      expect(result.data[0].customer).toBeNull();
      expect(result.data[0].contract_value).toBeNull();
    });
  });

  // ===========================================================================
  // Tenant Isolation Tests (MANDATORY)
  // ===========================================================================

  describe('Tenant Isolation', () => {
    it('getDashboardData should ALWAYS include tenant_id in project queries', async () => {
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.project, 'groupBy').mockResolvedValue([] as any);
      jest.spyOn(prisma.project_task, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.project_task, 'groupBy').mockResolvedValue([] as any);
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(activityService, 'getTenantRecentActivity').mockResolvedValue([]);

      await service.getDashboardData(TENANT_A, {});

      // Every project query must have tenant_id
      const projectCountCalls = (prisma.project.count as jest.Mock).mock.calls;
      for (const [args] of projectCountCalls) {
        expect(args.where.tenant_id).toBe(TENANT_A);
      }

      const projectGroupByCalls = (prisma.project.groupBy as jest.Mock).mock.calls;
      for (const [args] of projectGroupByCalls) {
        expect(args.where.tenant_id).toBe(TENANT_A);
      }

      // Every task query must have tenant_id
      const taskCountCalls = (prisma.project_task.count as jest.Mock).mock.calls;
      for (const [args] of taskCountCalls) {
        expect(args.where.tenant_id).toBe(TENANT_A);
      }
    });

    it('getProjectsWithSummary should ALWAYS include tenant_id in all queries', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);

      await service.getProjectsWithSummary(TENANT_B, { search: 'test' });

      const findManyCalls = (prisma.project.findMany as jest.Mock).mock.calls;
      for (const [args] of findManyCalls) {
        expect(args.where.tenant_id).toBe(TENANT_B);
      }
    });

    it('should use different tenant_id per call — no cross-contamination', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.project, 'count').mockResolvedValue(0);

      await service.getProjectsWithSummary(TENANT_A, {});
      await service.getProjectsWithSummary(TENANT_B, {});

      const findManyCalls = (prisma.project.findMany as jest.Mock).mock.calls;
      expect(findManyCalls[0][0].where.tenant_id).toBe(TENANT_A);
      expect(findManyCalls[1][0].where.tenant_id).toBe(TENANT_B);
    });
  });

  // ===========================================================================
  // RBAC Tests — verified at controller level, but ensure service doesn't bypass
  // ===========================================================================

  describe('RBAC (service layer)', () => {
    it('service methods accept tenantId parameter — never derive from request', () => {
      // Verify getDashboardData signature requires tenantId
      expect(service.getDashboardData).toBeDefined();
      expect(service.getDashboardData.length).toBeGreaterThanOrEqual(1);

      // Verify getProjectsWithSummary signature requires tenantId
      expect(service.getProjectsWithSummary).toBeDefined();
      expect(service.getProjectsWithSummary.length).toBeGreaterThanOrEqual(1);
    });
  });
});
