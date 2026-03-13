import { Test, TestingModule } from '@nestjs/testing';
import { ProjectActivityService } from './project-activity.service';
import { PrismaService } from '../../../core/database/prisma.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-uuid-aaa';
const TENANT_B = 'tenant-uuid-bbb';
const PROJECT_A = 'project-uuid-aaa';
const PROJECT_B = 'project-uuid-bbb';
const USER_ID = 'user-uuid-001';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const mockActivityRecord = (overrides: any = {}) => ({
  id: 'activity-uuid-001',
  tenant_id: TENANT_A,
  project_id: PROJECT_A,
  user_id: USER_ID,
  activity_type: 'task_created',
  description: 'Task "Install Drywall" created',
  metadata: null,
  created_at: new Date('2026-03-13T10:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrismaService = {
  project_activity: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectActivityService', () => {
  let service: ProjectActivityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectActivityService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProjectActivityService>(ProjectActivityService);
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // logActivity()
  // -----------------------------------------------------------------------

  describe('logActivity()', () => {
    it('should create record with correct tenant_id and project_id', async () => {
      const record = mockActivityRecord();
      mockPrismaService.project_activity.create.mockResolvedValue(record);

      const result = await service.logActivity(TENANT_A, {
        project_id: PROJECT_A,
        user_id: USER_ID,
        activity_type: 'task_created',
        description: 'Task "Install Drywall" created',
      });

      expect(result).toBeDefined();
      expect(result.tenant_id).toBe(TENANT_A);
      expect(result.project_id).toBe(PROJECT_A);

      expect(mockPrismaService.project_activity.create).toHaveBeenCalledWith({
        data: {
          tenant_id: TENANT_A,
          project_id: PROJECT_A,
          user_id: USER_ID,
          activity_type: 'task_created',
          description: 'Task "Install Drywall" created',
          metadata: undefined,
        },
      });
    });

    it('should store metadata when provided', async () => {
      const meta = { old_status: 'planned', new_status: 'in_progress' };
      const record = mockActivityRecord({ metadata: meta });
      mockPrismaService.project_activity.create.mockResolvedValue(record);

      const result = await service.logActivity(TENANT_A, {
        project_id: PROJECT_A,
        user_id: USER_ID,
        activity_type: 'status_changed',
        description: 'Project status changed to in_progress',
        metadata: meta,
      });

      expect(result.metadata).toEqual(meta);
      expect(mockPrismaService.project_activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: meta,
        }),
      });
    });

    it('should set user_id to null when not provided', async () => {
      const record = mockActivityRecord({ user_id: null });
      mockPrismaService.project_activity.create.mockResolvedValue(record);

      await service.logActivity(TENANT_A, {
        project_id: PROJECT_A,
        activity_type: 'task_created',
        description: 'System-generated task',
      });

      expect(mockPrismaService.project_activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: null,
        }),
      });
    });

    it('should not throw when an unknown activity_type is used', async () => {
      const record = mockActivityRecord({ activity_type: 'custom_event' });
      mockPrismaService.project_activity.create.mockResolvedValue(record);

      const result = await service.logActivity(TENANT_A, {
        project_id: PROJECT_A,
        activity_type: 'custom_event',
        description: 'A custom event',
      });

      // Should still create the record (warn, but not reject)
      expect(result).toBeDefined();
    });

    it('should return null and not throw when prisma.create fails', async () => {
      mockPrismaService.project_activity.create.mockRejectedValue(
        new Error('DB connection lost'),
      );

      const result = await service.logActivity(TENANT_A, {
        project_id: PROJECT_A,
        activity_type: 'task_created',
        description: 'This should fail silently',
      });

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getProjectActivity()
  // -----------------------------------------------------------------------

  describe('getProjectActivity()', () => {
    it('should return activities ordered by created_at DESC', async () => {
      const activities = [
        mockActivityRecord({
          id: 'act-3',
          created_at: new Date('2026-03-13T12:00:00Z'),
        }),
        mockActivityRecord({
          id: 'act-2',
          created_at: new Date('2026-03-13T11:00:00Z'),
        }),
        mockActivityRecord({
          id: 'act-1',
          created_at: new Date('2026-03-13T10:00:00Z'),
        }),
      ];
      mockPrismaService.project_activity.findMany.mockResolvedValue(activities);

      const result = await service.getProjectActivity(TENANT_A, PROJECT_A);

      expect(result).toHaveLength(3);
      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_A,
          project_id: PROJECT_A,
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      });
    });

    it('should respect limit parameter', async () => {
      mockPrismaService.project_activity.findMany.mockResolvedValue([
        mockActivityRecord(),
      ]);

      await service.getProjectActivity(TENANT_A, PROJECT_A, 5);

      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it('should clamp limit to max 100', async () => {
      mockPrismaService.project_activity.findMany.mockResolvedValue([]);

      await service.getProjectActivity(TENANT_A, PROJECT_A, 500);

      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should clamp limit to min 1', async () => {
      mockPrismaService.project_activity.findMany.mockResolvedValue([]);

      await service.getProjectActivity(TENANT_A, PROJECT_A, 0);

      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        }),
      );
    });

    it('should include tenant_id in query (tenant isolation)', async () => {
      mockPrismaService.project_activity.findMany.mockResolvedValue([]);

      await service.getProjectActivity(TENANT_A, PROJECT_A);

      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getTenantRecentActivity()
  // -----------------------------------------------------------------------

  describe('getTenantRecentActivity()', () => {
    it('should return activities across multiple projects', async () => {
      const activities = [
        mockActivityRecord({ project_id: PROJECT_A }),
        mockActivityRecord({ id: 'act-2', project_id: PROJECT_B }),
      ];
      mockPrismaService.project_activity.findMany.mockResolvedValue(activities);

      const result = await service.getTenantRecentActivity(TENANT_A);

      expect(result).toHaveLength(2);
    });

    it('should include project name and user name via joins', async () => {
      mockPrismaService.project_activity.findMany.mockResolvedValue([]);

      await service.getTenantRecentActivity(TENANT_A);

      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            project: {
              select: {
                id: true,
                name: true,
                project_number: true,
              },
            },
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        }),
      );
    });

    it('should include tenant_id in query (tenant isolation)', async () => {
      mockPrismaService.project_activity.findMany.mockResolvedValue([]);

      await service.getTenantRecentActivity(TENANT_A);

      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_A },
        }),
      );
    });

    it('should respect limit parameter', async () => {
      mockPrismaService.project_activity.findMany.mockResolvedValue([]);

      await service.getTenantRecentActivity(TENANT_A, 10);

      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('should order by created_at DESC', async () => {
      mockPrismaService.project_activity.findMany.mockResolvedValue([]);

      await service.getTenantRecentActivity(TENANT_A);

      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Tenant Isolation (cross-cutting)
  // -----------------------------------------------------------------------

  describe('Tenant Isolation', () => {
    it('logActivity always uses the provided tenantId', async () => {
      mockPrismaService.project_activity.create.mockResolvedValue(
        mockActivityRecord({ tenant_id: TENANT_B }),
      );

      await service.logActivity(TENANT_B, {
        project_id: PROJECT_A,
        activity_type: 'task_created',
        description: 'Tenant B activity',
      });

      expect(mockPrismaService.project_activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_B,
        }),
      });
    });

    it('getProjectActivity filters by tenant_id — tenant B cannot see tenant A activities', async () => {
      mockPrismaService.project_activity.findMany.mockResolvedValue([]);

      await service.getProjectActivity(TENANT_B, PROJECT_A);

      // The query should filter by TENANT_B, not TENANT_A
      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: TENANT_B,
            project_id: PROJECT_A,
          },
        }),
      );
    });

    it('getTenantRecentActivity filters by tenant_id — tenant B cannot see tenant A activities', async () => {
      mockPrismaService.project_activity.findMany.mockResolvedValue([]);

      await service.getTenantRecentActivity(TENANT_B);

      expect(mockPrismaService.project_activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_B },
        }),
      );
    });
  });
});
