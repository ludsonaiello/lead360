import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PortalProjectService } from './portal-project.service';
import { PrismaService } from '../../../core/database/prisma.service';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrismaService = {
  project: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  project_log: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  project_photo: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-aaa-111';
const TENANT_B = 'tenant-bbb-222';
const LEAD_ID = 'lead-123';
const LEAD_OTHER = 'lead-other-456';
const PROJECT_ID = 'project-001';

const mockProject = {
  id: PROJECT_ID,
  project_number: 'PRJ-2026-0001',
  name: 'Kitchen Remodel',
  status: 'in_progress',
  start_date: new Date('2026-04-01'),
  target_completion_date: new Date('2026-06-15'),
  progress_percent: 45.0,
};

const mockProjectDetail = {
  ...mockProject,
  description: 'Full kitchen renovation',
  actual_completion_date: null,
  permit_required: true,
  tasks: [
    {
      id: 'task-1',
      title: 'Demolition',
      status: 'done',
      order_index: 1,
      estimated_start_date: new Date('2026-04-01'),
      estimated_end_date: new Date('2026-04-05'),
    },
    {
      id: 'task-2',
      title: 'Plumbing',
      status: 'in_progress',
      order_index: 2,
      estimated_start_date: new Date('2026-04-06'),
      estimated_end_date: new Date('2026-04-15'),
    },
  ],
  permits: [
    {
      id: 'permit-1',
      permit_type: 'Building Permit',
      status: 'approved',
      submitted_date: new Date('2026-03-15'),
      approved_date: new Date('2026-03-28'),
    },
  ],
};

const mockPublicLog = {
  id: 'log-1',
  log_date: new Date('2026-04-10'),
  content: 'Demolition work completed ahead of schedule.',
  weather_delay: false,
  created_at: new Date('2026-04-10T14:00:00Z'),
  author: {
    first_name: 'Mike',
    last_name: 'Johnson',
  },
  attachments: [
    {
      id: 'att-1',
      file_url: '/public/tenant-aaa-111/images/demolition.jpg',
      file_name: 'demolition.jpg',
      file_type: 'photo',
    },
  ],
};

const mockPublicPhoto = {
  id: 'photo-1',
  file_url: '/public/tenant-aaa-111/images/kitchen-progress.jpg',
  thumbnail_url: '/public/tenant-aaa-111/images/kitchen-progress_thumb.webp',
  caption: 'Kitchen cabinets installed',
  taken_at: new Date('2026-05-01'),
  created_at: new Date('2026-05-01T12:00:00Z'),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PortalProjectService', () => {
  let service: PortalProjectService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalProjectService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PortalProjectService>(PortalProjectService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  // =========================================================================
  // listProjects
  // =========================================================================

  describe('listProjects', () => {
    it('should return paginated projects for the correct tenant and lead', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([mockProject]);
      mockPrismaService.project.count.mockResolvedValue(1);

      const result = await service.listProjects(TENANT_A, LEAD_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(PROJECT_ID);
      expect(result.data[0].project_number).toBe('PRJ-2026-0001');
      expect(result.data[0].name).toBe('Kitchen Remodel');
      expect(result.data[0].status).toBe('in_progress');
      expect(result.data[0].progress_percent).toBe(45.0);
      expect(result.data[0].start_date).toBe('2026-04-01');
      expect(result.data[0].target_completion_date).toBe('2026-06-15');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by tenant_id, lead_id, and portal_enabled=true', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);

      await service.listProjects(TENANT_A, LEAD_ID);

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
            lead_id: LEAD_ID,
            portal_enabled: true,
          }),
        }),
      );
    });

    it('should respect pagination parameters', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(50);

      const result = await service.listProjects(TENANT_A, LEAD_ID, {
        page: 3,
        limit: 10,
      });

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        }),
      );
      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
    });

    it('should clamp limit to max 100', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);

      await service.listProjects(TENANT_A, LEAD_ID, { limit: 999 });

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should clamp page to min 1', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);

      await service.listProjects(TENANT_A, LEAD_ID, { page: -5 });

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
        }),
      );
    });

    it('should only select safe-to-expose fields', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);

      await service.listProjects(TENANT_A, LEAD_ID);

      const selectArg =
        mockPrismaService.project.findMany.mock.calls[0][0].select;

      // These fields MUST be selected
      expect(selectArg.id).toBe(true);
      expect(selectArg.project_number).toBe(true);
      expect(selectArg.name).toBe(true);
      expect(selectArg.status).toBe(true);
      expect(selectArg.start_date).toBe(true);
      expect(selectArg.target_completion_date).toBe(true);
      expect(selectArg.progress_percent).toBe(true);

      // These fields MUST NOT be selected (sensitive data)
      expect(selectArg.contract_value).toBeUndefined();
      expect(selectArg.estimated_cost).toBeUndefined();
      expect(selectArg.notes).toBeUndefined();
      expect(selectArg.assigned_pm_user_id).toBeUndefined();
      expect(selectArg.created_by_user_id).toBeUndefined();
    });

    it('should return empty data for a lead with no projects', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);

      const result = await service.listProjects(TENANT_A, LEAD_OTHER);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    // -- Tenant Isolation --

    it('should not return projects from another tenant', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);

      await service.listProjects(TENANT_B, LEAD_ID);

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_B,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // getProjectDetail
  // =========================================================================

  describe('getProjectDetail', () => {
    it('should return sanitized project detail with tasks and permits', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProjectDetail);

      const result = await service.getProjectDetail(
        TENANT_A,
        LEAD_ID,
        PROJECT_ID,
      );

      // Project info
      expect(result.id).toBe(PROJECT_ID);
      expect(result.project_number).toBe('PRJ-2026-0001');
      expect(result.name).toBe('Kitchen Remodel');
      expect(result.description).toBe('Full kitchen renovation');
      expect(result.status).toBe('in_progress');
      expect(result.start_date).toBe('2026-04-01');
      expect(result.target_completion_date).toBe('2026-06-15');
      expect(result.actual_completion_date).toBeNull();
      expect(result.progress_percent).toBe(45.0);
      expect(result.permit_required).toBe(true);

      // Tasks
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].title).toBe('Demolition');
      expect(result.tasks[0].status).toBe('done');
      expect(result.tasks[0].order_index).toBe(1);
      expect(result.tasks[0].estimated_start_date).toBe('2026-04-01');

      // Permits
      expect(result.permits).toHaveLength(1);
      expect(result.permits[0].permit_type).toBe('Building Permit');
      expect(result.permits[0].status).toBe('approved');
    });

    it('should filter by tenant_id, lead_id, and portal_enabled=true', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProjectDetail);

      await service.getProjectDetail(TENANT_A, LEAD_ID, PROJECT_ID);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: PROJECT_ID,
            tenant_id: TENANT_A,
            lead_id: LEAD_ID,
            portal_enabled: true,
          },
        }),
      );
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getProjectDetail(TENANT_A, LEAD_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if project belongs to different lead', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getProjectDetail(TENANT_A, LEAD_OTHER, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if project is in different tenant', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getProjectDetail(TENANT_B, LEAD_ID, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not include sensitive fields in select', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProjectDetail);

      await service.getProjectDetail(TENANT_A, LEAD_ID, PROJECT_ID);

      const selectArg =
        mockPrismaService.project.findFirst.mock.calls[0][0].select;

      // MUST NOT select these sensitive fields
      expect(selectArg.contract_value).toBeUndefined();
      expect(selectArg.estimated_cost).toBeUndefined();
      expect(selectArg.notes).toBeUndefined();
      expect(selectArg.assigned_pm_user_id).toBeUndefined();
      expect(selectArg.created_by_user_id).toBeUndefined();

      // Tasks must not include sensitive fields
      const taskSelect = selectArg.tasks.select;
      expect(taskSelect.notes).toBeUndefined();
      expect(taskSelect.category).toBeUndefined();
      expect(taskSelect.description).toBeUndefined();
      expect(taskSelect.created_by_user_id).toBeUndefined();
    });

    it('should exclude deleted tasks', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProjectDetail);

      await service.getProjectDetail(TENANT_A, LEAD_ID, PROJECT_ID);

      const selectArg =
        mockPrismaService.project.findFirst.mock.calls[0][0].select;

      expect(selectArg.tasks.where).toEqual({ deleted_at: null });
    });

    it('should exclude deleted permits', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProjectDetail);

      await service.getProjectDetail(TENANT_A, LEAD_ID, PROJECT_ID);

      const selectArg =
        mockPrismaService.project.findFirst.mock.calls[0][0].select;

      expect(selectArg.permits.where).toEqual({ deleted_at: null });
    });
  });

  // =========================================================================
  // getPublicLogs
  // =========================================================================

  describe('getPublicLogs', () => {
    beforeEach(() => {
      // Default: project ownership verification passes
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    });

    it('should return only public logs with content, date, author, and attachments', async () => {
      mockPrismaService.project_log.findMany.mockResolvedValue([
        mockPublicLog,
      ]);
      mockPrismaService.project_log.count.mockResolvedValue(1);

      const result = await service.getPublicLogs(
        TENANT_A,
        PROJECT_ID,
        LEAD_ID,
      );

      expect(result.data).toHaveLength(1);
      const log = result.data[0];
      expect(log.id).toBe('log-1');
      expect(log.log_date).toBe('2026-04-10');
      expect(log.content).toBe(
        'Demolition work completed ahead of schedule.',
      );
      expect(log.author).toBe('Mike Johnson');
      expect(log.weather_delay).toBe(false);
      expect(log.attachments).toHaveLength(1);
      expect(log.attachments[0].file_url).toBe(
        '/public/tenant-aaa-111/images/demolition.jpg',
      );
    });

    it('should ALWAYS filter is_public=true', async () => {
      mockPrismaService.project_log.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.count.mockResolvedValue(0);

      await service.getPublicLogs(TENANT_A, PROJECT_ID, LEAD_ID);

      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_public: true,
          }),
        }),
      );
    });

    it('should filter by tenant_id and project_id', async () => {
      mockPrismaService.project_log.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.count.mockResolvedValue(0);

      await service.getPublicLogs(TENANT_A, PROJECT_ID, LEAD_ID);

      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
            project_id: PROJECT_ID,
          }),
        }),
      );
    });

    it('should verify project ownership before returning logs', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null); // Project not owned

      await expect(
        service.getPublicLogs(TENANT_A, PROJECT_ID, LEAD_OTHER),
      ).rejects.toThrow(NotFoundException);

      // Should NOT query logs at all if ownership fails
      expect(mockPrismaService.project_log.findMany).not.toHaveBeenCalled();
    });

    it('should respect pagination parameters', async () => {
      mockPrismaService.project_log.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.count.mockResolvedValue(30);

      const result = await service.getPublicLogs(
        TENANT_A,
        PROJECT_ID,
        LEAD_ID,
        { page: 2, limit: 10 },
      );

      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(3);
    });

    it('should handle author with missing name parts gracefully', async () => {
      const logWithPartialName = {
        ...mockPublicLog,
        author: { first_name: 'Mike', last_name: null },
      };
      mockPrismaService.project_log.findMany.mockResolvedValue([
        logWithPartialName,
      ]);
      mockPrismaService.project_log.count.mockResolvedValue(1);

      const result = await service.getPublicLogs(
        TENANT_A,
        PROJECT_ID,
        LEAD_ID,
      );

      expect(result.data[0].author).toBe('Mike');
    });
  });

  // =========================================================================
  // getPublicPhotos
  // =========================================================================

  describe('getPublicPhotos', () => {
    beforeEach(() => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    });

    it('should return only public photos with URLs', async () => {
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        mockPublicPhoto,
      ]);
      mockPrismaService.project_photo.count.mockResolvedValue(1);

      const result = await service.getPublicPhotos(
        TENANT_A,
        PROJECT_ID,
        LEAD_ID,
      );

      expect(result.data).toHaveLength(1);
      const photo = result.data[0];
      expect(photo.id).toBe('photo-1');
      expect(photo.file_url).toBe(
        '/public/tenant-aaa-111/images/kitchen-progress.jpg',
      );
      expect(photo.thumbnail_url).toBe(
        '/public/tenant-aaa-111/images/kitchen-progress_thumb.webp',
      );
      expect(photo.caption).toBe('Kitchen cabinets installed');
      expect(photo.taken_at).toBe('2026-05-01');
    });

    it('should ALWAYS filter is_public=true', async () => {
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);
      mockPrismaService.project_photo.count.mockResolvedValue(0);

      await service.getPublicPhotos(TENANT_A, PROJECT_ID, LEAD_ID);

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_public: true,
          }),
        }),
      );
    });

    it('should not select internal fields (file_id, uploaded_by, task_id, log_id)', async () => {
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);
      mockPrismaService.project_photo.count.mockResolvedValue(0);

      await service.getPublicPhotos(TENANT_A, PROJECT_ID, LEAD_ID);

      const selectArg =
        mockPrismaService.project_photo.findMany.mock.calls[0][0].select;

      // MUST NOT select internal fields
      expect(selectArg.file_id).toBeUndefined();
      expect(selectArg.uploaded_by_user_id).toBeUndefined();
      expect(selectArg.task_id).toBeUndefined();
      expect(selectArg.log_id).toBeUndefined();

      // MUST select safe fields
      expect(selectArg.id).toBe(true);
      expect(selectArg.file_url).toBe(true);
      expect(selectArg.thumbnail_url).toBe(true);
      expect(selectArg.caption).toBe(true);
      expect(selectArg.taken_at).toBe(true);
      expect(selectArg.created_at).toBe(true);
    });

    it('should verify project ownership before returning photos', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublicPhotos(TENANT_A, PROJECT_ID, LEAD_OTHER),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project_photo.findMany).not.toHaveBeenCalled();
    });

    it('should respect pagination parameters', async () => {
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);
      mockPrismaService.project_photo.count.mockResolvedValue(45);

      const result = await service.getPublicPhotos(
        TENANT_A,
        PROJECT_ID,
        LEAD_ID,
        { page: 3, limit: 15 },
      );

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 30,
          take: 15,
        }),
      );
      expect(result.meta.totalPages).toBe(3);
    });
  });

  // =========================================================================
  // Tenant Isolation (Cross-cutting)
  // =========================================================================

  describe('Tenant Isolation', () => {
    it('listProjects: tenant A cannot see tenant B projects', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);

      await service.listProjects(TENANT_A, LEAD_ID);

      const where =
        mockPrismaService.project.findMany.mock.calls[0][0].where;
      expect(where.tenant_id).toBe(TENANT_A);
    });

    it('getProjectDetail: returns 404 for cross-tenant access', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getProjectDetail(TENANT_B, LEAD_ID, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('getPublicLogs: verifies project ownership with tenant_id', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublicLogs(TENANT_B, PROJECT_ID, LEAD_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('getPublicPhotos: verifies project ownership with tenant_id', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublicPhotos(TENANT_B, PROJECT_ID, LEAD_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // Data Sanitization (Cross-cutting)
  // =========================================================================

  describe('Data Sanitization', () => {
    it('listProjects response contains no cost or crew data', async () => {
      const projectWithSensitiveFields = {
        ...mockProject,
        contract_value: 50000.0,
        estimated_cost: 35000.0,
        notes: 'Internal notes about this project',
        assigned_pm_user_id: 'user-pm-123',
      };
      mockPrismaService.project.findMany.mockResolvedValue([
        projectWithSensitiveFields,
      ]);
      mockPrismaService.project.count.mockResolvedValue(1);

      const result = await service.listProjects(TENANT_A, LEAD_ID);
      const project = result.data[0];

      // Even if Prisma somehow returned extra fields, our explicit
      // mapping ensures only safe fields are in the response
      expect(project).not.toHaveProperty('contract_value');
      expect(project).not.toHaveProperty('estimated_cost');
      expect(project).not.toHaveProperty('notes');
      expect(project).not.toHaveProperty('assigned_pm_user_id');
      expect(project).not.toHaveProperty('created_by_user_id');
    });

    it('getProjectDetail response contains no financial data', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProjectDetail);

      const result = await service.getProjectDetail(
        TENANT_A,
        LEAD_ID,
        PROJECT_ID,
      );

      expect(result).not.toHaveProperty('contract_value');
      expect(result).not.toHaveProperty('estimated_cost');
      expect(result).not.toHaveProperty('notes');
      expect(result).not.toHaveProperty('assigned_pm_user_id');
      expect(result).not.toHaveProperty('created_by_user_id');

      // Tasks must not contain sensitive fields
      for (const task of result.tasks) {
        expect(task).not.toHaveProperty('notes');
        expect(task).not.toHaveProperty('category');
        expect(task).not.toHaveProperty('description');
        expect(task).not.toHaveProperty('created_by_user_id');
      }

      // Permits must not contain sensitive fields
      for (const permit of result.permits) {
        expect(permit).not.toHaveProperty('notes');
        expect(permit).not.toHaveProperty('permit_number');
        expect(permit).not.toHaveProperty('issuing_authority');
        expect(permit).not.toHaveProperty('expiry_date');
      }
    });
  });
});
