import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectNumberGeneratorService } from './project-number-generator.service';
import { ProjectTemplateService } from './project-template.service';
import { ProjectActivityService } from './project-activity.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FinancialEntryService } from '../../financial/services/financial-entry.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const TENANT_B_ID = 'tenant-uuid-002';
const USER_ID = 'user-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const QUOTE_ID = 'quote-uuid-001';
const LEAD_ID = 'lead-uuid-001';
const TEMPLATE_ID = 'template-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockQuote = (overrides: any = {}) => ({
  id: QUOTE_ID,
  tenant_id: TENANT_ID,
  lead_id: LEAD_ID,
  title: 'Kitchen Remodel',
  status: 'approved',
  total: 45000.0,
  deletion_locked: false,
  items: [
    {
      id: 'item-1',
      title: 'Cabinets',
      description: 'Custom kitchen cabinets',
      order_index: 0,
    },
    {
      id: 'item-2',
      title: 'Countertops',
      description: 'Granite countertops',
      order_index: 1,
    },
  ],
  ...overrides,
});

const mockProjectRecord = (overrides: any = {}) => ({
  id: PROJECT_ID,
  tenant_id: TENANT_ID,
  quote_id: QUOTE_ID,
  lead_id: LEAD_ID,
  project_number: 'PRJ-2026-0001',
  name: 'Kitchen Remodel',
  description: null,
  status: 'planned',
  start_date: null,
  target_completion_date: null,
  actual_completion_date: null,
  permit_required: false,
  assigned_pm_user_id: null,
  contract_value: 45000.0,
  estimated_cost: null,
  progress_percent: 0.0,
  is_standalone: false,
  portal_enabled: true,
  deletion_locked: false,
  notes: null,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-03-13T10:00:00.000Z'),
  updated_at: new Date('2026-03-13T10:00:00.000Z'),
  ...overrides,
});

const mockProjectWithRelations = (overrides: any = {}) => ({
  ...mockProjectRecord(),
  assigned_pm_user: null,
  quote: { id: QUOTE_ID, quote_number: 'Q-2026-001', title: 'Kitchen Remodel' },
  lead: { id: LEAD_ID, first_name: 'John', last_name: 'Smith' },
  created_by_user: { id: USER_ID, first_name: 'Jane', last_name: 'Admin' },
  ...overrides,
});

const mockTemplate = {
  id: TEMPLATE_ID,
  tenant_id: TENANT_ID,
  name: 'Kitchen Template',
  tasks: [
    {
      title: 'Final Inspection',
      description: 'Building inspector visit',
      estimated_duration_days: 1,
      category: null,
      order_index: 0,
    },
  ],
};

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockTx = {
  project: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  quote: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    update: jest.fn(),
  },
  tenant: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  project_task: {
    create: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  project_template: {
    findFirst: jest.fn(),
  },
  task_dependency: {
    create: jest.fn(),
  },
};

const mockPrismaService = {
  project: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  quote: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    update: jest.fn(),
  },
  project_task: {
    create: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  project_template: {
    findFirst: jest.fn(),
  },
  task_dependency: {
    create: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockTx)),
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
  log: jest.fn(),
};

const mockFinancialEntryService = {
  getProjectCostSummary: jest.fn(),
};

const mockProjectNumberGenerator = {
  generate: jest.fn(),
  validateFormat: jest.fn(),
  previewNextNumber: jest.fn(),
};

const mockProjectTemplateService = {
  findOne: jest.fn(),
};

const mockProjectActivityService = {
  logActivity: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        { provide: FinancialEntryService, useValue: mockFinancialEntryService },
        {
          provide: ProjectNumberGeneratorService,
          useValue: mockProjectNumberGenerator,
        },
        {
          provide: ProjectTemplateService,
          useValue: mockProjectTemplateService,
        },
        {
          provide: ProjectActivityService,
          useValue: mockProjectActivityService,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    jest.resetAllMocks();
    // Restore default $transaction behavior after reset
    mockPrismaService.$transaction.mockImplementation((fn) => fn(mockTx));
  });

  // =========================================================================
  // createFromQuote()
  // =========================================================================

  describe('createFromQuote()', () => {
    const dto = { name: 'My Kitchen Project' };

    beforeEach(() => {
      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote());
      mockPrismaService.project.findFirst.mockResolvedValue(null); // no duplicate
      mockTx.project.create.mockResolvedValue(mockProjectRecord());
      mockTx.quote.update.mockResolvedValue({});
      mockTx.lead.update.mockResolvedValue({});
      mockTx.project_task.create.mockResolvedValue({});
      mockProjectNumberGenerator.generate.mockResolvedValue('PRJ-2026-0001');

      // findOne mocks for the return
      mockPrismaService.project.findFirst
        .mockResolvedValueOnce(null) // duplicate check
        .mockResolvedValueOnce(mockProjectWithRelations()); // findOne
      mockPrismaService.project_task.count.mockResolvedValue(2);
    });

    it('should create a project from an approved quote', async () => {
      const result = await service.createFromQuote(
        TENANT_ID,
        USER_ID,
        QUOTE_ID,
        dto,
      );

      expect(result).toBeDefined();
      expect(mockTx.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            quote_id: QUOTE_ID,
            lead_id: LEAD_ID,
            name: 'My Kitchen Project',
            is_standalone: false,
            created_by_user_id: USER_ID,
          }),
        }),
      );
    });

    it('should lock the quote after project creation', async () => {
      await service.createFromQuote(TENANT_ID, USER_ID, QUOTE_ID, dto);

      expect(mockTx.quote.update).toHaveBeenCalledWith({
        where: { id: QUOTE_ID },
        data: { deletion_locked: true },
      });
    });

    it('should update lead status to customer', async () => {
      await service.createFromQuote(TENANT_ID, USER_ID, QUOTE_ID, dto);

      expect(mockTx.lead.update).toHaveBeenCalledWith({
        where: { id: LEAD_ID },
        data: { status: 'customer' },
      });
    });

    it('should create tasks from quote items', async () => {
      await service.createFromQuote(TENANT_ID, USER_ID, QUOTE_ID, dto);

      // Should create 2 tasks (from 2 quote items)
      expect(mockTx.project_task.create).toHaveBeenCalledTimes(2);
      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Cabinets',
            quote_item_id: 'item-1',
            status: 'not_started',
            order_index: 0,
          }),
        }),
      );
      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Countertops',
            quote_item_id: 'item-2',
            status: 'not_started',
            order_index: 1,
          }),
        }),
      );
    });

    it('should use quote title as name when dto.name is not provided', async () => {
      mockPrismaService.project.findFirst
        .mockReset()
        .mockResolvedValueOnce(null) // duplicate check
        .mockResolvedValueOnce(mockProjectWithRelations());

      await service.createFromQuote(TENANT_ID, USER_ID, QUOTE_ID, {});

      expect(mockTx.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Kitchen Remodel', // from quote.title
          }),
        }),
      );
    });

    it('should reject quote with status "draft"', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(
        mockQuote({ status: 'draft' }),
      );

      await expect(
        service.createFromQuote(TENANT_ID, USER_ID, QUOTE_ID, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject quote with status "sent"', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(
        mockQuote({ status: 'sent' }),
      );

      await expect(
        service.createFromQuote(TENANT_ID, USER_ID, QUOTE_ID, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept quote with status "started"', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(
        mockQuote({ status: 'started' }),
      );

      const result = await service.createFromQuote(
        TENANT_ID,
        USER_ID,
        QUOTE_ID,
        dto,
      );

      expect(result).toBeDefined();
    });

    it('should accept quote with status "concluded"', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(
        mockQuote({ status: 'concluded' }),
      );

      const result = await service.createFromQuote(
        TENANT_ID,
        USER_ID,
        QUOTE_ID,
        dto,
      );

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException for non-existent quote', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.createFromQuote(TENANT_ID, USER_ID, QUOTE_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if project already exists for quote', async () => {
      // Must reset to clear Once queue from beforeEach, then set fresh mock
      mockPrismaService.project.findFirst.mockReset();
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProjectRecord(),
      );

      await expect(
        service.createFromQuote(TENANT_ID, USER_ID, QUOTE_ID, dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should apply template tasks when template_id is provided', async () => {
      mockProjectTemplateService.findOne.mockResolvedValue(mockTemplate);
      mockTx.project_template.findFirst.mockResolvedValue(mockTemplate);

      await service.createFromQuote(TENANT_ID, USER_ID, QUOTE_ID, {
        template_id: TEMPLATE_ID,
      });

      // 2 quote items + 1 template task = 3 total
      expect(mockTx.project_task.create).toHaveBeenCalledTimes(3);
      // Template task should have order_index = 2 (after 0, 1 from items)
      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Final Inspection',
            order_index: 2,
          }),
        }),
      );
    });

    it('should create audit log entry', async () => {
      await service.createFromQuote(TENANT_ID, USER_ID, QUOTE_ID, dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'project',
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });
  });

  // =========================================================================
  // createStandalone()
  // =========================================================================

  describe('createStandalone()', () => {
    const dto = {
      name: 'Office Build-out',
      description: 'Interior renovation',
      estimated_cost: 25000,
    };

    beforeEach(() => {
      mockTx.project.create.mockResolvedValue(
        mockProjectRecord({
          is_standalone: true,
          quote_id: null,
          lead_id: null,
          name: 'Office Build-out',
        }),
      );
      mockProjectNumberGenerator.generate.mockResolvedValue('PRJ-2026-0002');
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProjectWithRelations({
          is_standalone: true,
          quote_id: null,
          lead_id: null,
          quote: null,
          lead: null,
        }),
      );
      mockPrismaService.project_task.count.mockResolvedValue(0);
    });

    it('should create standalone project with is_standalone = true', async () => {
      const result = await service.createStandalone(TENANT_ID, USER_ID, dto);

      expect(result).toBeDefined();
      expect(mockTx.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            name: 'Office Build-out',
            is_standalone: true,
            portal_enabled: false,
            created_by_user_id: USER_ID,
          }),
        }),
      );
    });

    it('should not set quote_id or lead_id', async () => {
      await service.createStandalone(TENANT_ID, USER_ID, dto);

      const createCall = mockTx.project.create.mock.calls[0][0];
      expect(createCall.data.quote_id).toBeUndefined();
      expect(createCall.data.lead_id).toBeUndefined();
    });

    it('should apply template tasks when template_id provided', async () => {
      mockProjectTemplateService.findOne.mockResolvedValue(mockTemplate);
      mockTx.project_template.findFirst.mockResolvedValue(mockTemplate);

      await service.createStandalone(TENANT_ID, USER_ID, {
        ...dto,
        template_id: TEMPLATE_ID,
      });

      expect(mockTx.project_task.create).toHaveBeenCalledTimes(1);
      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Final Inspection',
            order_index: 0,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // findAll()
  // =========================================================================

  describe('findAll()', () => {
    it('should return paginated projects with task counts', async () => {
      const projects = [
        {
          ...mockProjectRecord(),
          assigned_pm_user: null,
          quote: null,
          lead: null,
          _count: { tasks: 5 },
        },
      ];
      mockPrismaService.project.findMany.mockResolvedValue(projects);
      mockPrismaService.project.count.mockResolvedValue(1);
      mockPrismaService.project_task.groupBy.mockResolvedValue([
        { project_id: PROJECT_ID, _count: { id: 2 } },
      ]);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].task_count).toBe(5);
      expect(result.data[0].completed_task_count).toBe(2);
      expect(result.data[0].assigned_pm).toBeNull();
      expect(result.data[0].assigned_pm_user).toBeUndefined();
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter by status', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);
      mockPrismaService.project_task.groupBy.mockResolvedValue([]);

      await service.findAll(TENANT_ID, { status: 'in_progress' });

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            status: 'in_progress',
          }),
        }),
      );
    });

    it('should filter by assigned_pm_user_id', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);
      mockPrismaService.project_task.groupBy.mockResolvedValue([]);

      await service.findAll(TENANT_ID, {
        assigned_pm_user_id: 'pm-uuid-001',
      });

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assigned_pm_user_id: 'pm-uuid-001',
          }),
        }),
      );
    });

    it('should search by name or project_number', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);
      mockPrismaService.project_task.groupBy.mockResolvedValue([]);

      await service.findAll(TENANT_ID, { search: 'Kitchen' });

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'Kitchen' } },
              { project_number: { contains: 'Kitchen' } },
            ],
          }),
        }),
      );
    });

    it('should clamp limit to max 100', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);
      mockPrismaService.project_task.groupBy.mockResolvedValue([]);

      await service.findAll(TENANT_ID, { limit: 500 });

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should always filter by tenant_id', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.project.count.mockResolvedValue(0);
      mockPrismaService.project_task.groupBy.mockResolvedValue([]);

      await service.findAll(TENANT_ID, {});

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // findOne()
  // =========================================================================

  describe('findOne()', () => {
    it('should return project with relations and task counts', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProjectWithRelations(),
      );
      mockPrismaService.project_task.count
        .mockResolvedValueOnce(5)  // total tasks
        .mockResolvedValueOnce(2); // completed tasks

      const result = await service.findOne(TENANT_ID, PROJECT_ID);

      expect(result).toBeDefined();
      expect(result.task_count).toBe(5);
      expect(result.completed_task_count).toBe(2);
      expect(result.assigned_pm).toBeNull();
    });

    it('should throw NotFoundException for non-existent project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter by tenant_id (tenant isolation)', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_B_ID, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROJECT_ID, tenant_id: TENANT_B_ID },
        }),
      );
    });
  });

  // =========================================================================
  // update()
  // =========================================================================

  describe('update()', () => {
    beforeEach(() => {
      mockPrismaService.project.findFirst
        .mockResolvedValueOnce(mockProjectRecord()) // existing check
        .mockResolvedValueOnce(mockProjectWithRelations()); // findOne return
      mockPrismaService.project.update.mockResolvedValue(
        mockProjectRecord({ status: 'in_progress' }),
      );
      mockPrismaService.project_task.count.mockResolvedValue(0);
    });

    it('should update project status', async () => {
      await service.update(TENANT_ID, PROJECT_ID, USER_ID, {
        status: 'in_progress' as any,
      });

      expect(mockPrismaService.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'in_progress' }),
        }),
      );
    });

    it('should auto-set actual_completion_date when status becomes completed', async () => {
      await service.update(TENANT_ID, PROJECT_ID, USER_ID, {
        status: 'completed' as any,
      });

      expect(mockPrismaService.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            actual_completion_date: expect.any(Date),
          }),
        }),
      );
    });

    it('should clear actual_completion_date when moving away from completed', async () => {
      mockPrismaService.project.findFirst
        .mockReset()
        .mockResolvedValueOnce(
          mockProjectRecord({ status: 'completed' }),
        )
        .mockResolvedValueOnce(mockProjectWithRelations());

      await service.update(TENANT_ID, PROJECT_ID, USER_ID, {
        status: 'in_progress' as any,
      });

      expect(mockPrismaService.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actual_completion_date: null,
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent project', async () => {
      mockPrismaService.project.findFirst.mockReset().mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, 'non-existent', USER_ID, { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log with before/after', async () => {
      await service.update(TENANT_ID, PROJECT_ID, USER_ID, {
        name: 'Updated Name',
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'project',
          entityId: PROJECT_ID,
          before: expect.any(Object),
          after: expect.any(Object),
        }),
      );
    });
  });

  // =========================================================================
  // softDelete()
  // =========================================================================

  describe('softDelete()', () => {
    it('should soft-delete a project with no active tasks', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProjectRecord(),
      );
      mockPrismaService.project_task.count.mockResolvedValue(0);
      mockPrismaService.project.update.mockResolvedValue({});

      const result = await service.softDelete(TENANT_ID, PROJECT_ID, USER_ID);

      expect(result.message).toBe('Project deleted successfully');
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
        data: { status: 'canceled' },
      });
    });

    it('should reject deletion when active tasks exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProjectRecord(),
      );
      mockPrismaService.project_task.count.mockResolvedValue(3);

      await expect(
        service.softDelete(TENANT_ID, PROJECT_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject deletion when project is locked', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProjectRecord({ deletion_locked: true }),
      );

      await expect(
        service.softDelete(TENANT_ID, PROJECT_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(TENANT_ID, 'non-existent', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getFinancialSummary()
  // =========================================================================

  describe('getFinancialSummary()', () => {
    it('should return combined financial summary', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        project_number: 'PRJ-2026-0001',
        contract_value: 45000.0,
        estimated_cost: 32000.0,
        progress_percent: 40.0,
      });
      mockFinancialEntryService.getProjectCostSummary.mockResolvedValue({
        project_id: PROJECT_ID,
        total_actual_cost: 12500.0,
        cost_by_category: {
          labor: 5000,
          material: 4000,
          subcontractor: 2500,
          equipment: 500,
          other: 500,
        },
        entry_count: 8,
      });
      mockPrismaService.project_task.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(4);

      const result = await service.getFinancialSummary(TENANT_ID, PROJECT_ID);

      expect(result.project_id).toBe(PROJECT_ID);
      expect(result.contract_value).toBe(45000.0);
      expect(result.estimated_cost).toBe(32000.0);
      expect(result.total_actual_cost).toBe(12500.0);
      expect(result.task_count).toBe(10);
      expect(result.completed_task_count).toBe(4);
    });

    it('should throw NotFoundException for non-existent project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getFinancialSummary(TENANT_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // recomputeProgress()
  // =========================================================================

  describe('recomputeProgress()', () => {
    it('should compute progress as (done / total) * 100', async () => {
      mockPrismaService.project_task.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(4); // done
      mockPrismaService.project.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.recomputeProgress(TENANT_ID, PROJECT_ID);

      expect(result.progress_percent).toBe(40);
      expect(result.totalTasks).toBe(10);
      expect(result.doneTasks).toBe(4);
      expect(mockPrismaService.project.updateMany).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_ID },
        data: { progress_percent: 40 },
      });
    });

    it('should return 0% when no tasks exist', async () => {
      mockPrismaService.project_task.count.mockResolvedValue(0);
      mockPrismaService.project.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.recomputeProgress(TENANT_ID, PROJECT_ID);

      expect(result.progress_percent).toBe(0);
    });

    it('should return 100% when all tasks are done', async () => {
      mockPrismaService.project_task.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);
      mockPrismaService.project.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.recomputeProgress(TENANT_ID, PROJECT_ID);

      expect(result.progress_percent).toBe(100);
    });

    it('should handle fractional percentages correctly', async () => {
      mockPrismaService.project_task.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(1); // done
      mockPrismaService.project.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.recomputeProgress(TENANT_ID, PROJECT_ID);

      expect(result.progress_percent).toBe(33.33);
    });

    it('should use updateMany with tenant_id for tenant isolation', async () => {
      mockPrismaService.project_task.count.mockResolvedValue(0);
      mockPrismaService.project.updateMany.mockResolvedValue({ count: 1 });

      await service.recomputeProgress(TENANT_ID, PROJECT_ID);

      expect(mockPrismaService.project.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // applyTemplate()
  // =========================================================================

  describe('applyTemplate()', () => {
    const templateWithDeps = {
      id: TEMPLATE_ID,
      tenant_id: TENANT_ID,
      name: 'Full Kitchen Template',
      is_active: true,
      tasks: [
        {
          id: 'tt-1',
          order_index: 0,
          title: 'Demolition',
          description: 'Remove existing fixtures',
          estimated_duration_days: 3,
          category: 'labor',
          depends_on_order_index: null,
        },
        {
          id: 'tt-2',
          order_index: 1,
          title: 'Plumbing Rough-In',
          description: null,
          estimated_duration_days: 2,
          category: 'subcontractor',
          depends_on_order_index: 0,
        },
        {
          id: 'tt-3',
          order_index: 2,
          title: 'Install Cabinets',
          description: 'Mount wall and base cabinets',
          estimated_duration_days: 4,
          category: 'labor',
          depends_on_order_index: 1,
        },
      ],
    };

    let taskCreateCounter: number;

    beforeEach(() => {
      taskCreateCounter = 0;
      mockPrismaService.project_template.findFirst.mockResolvedValue(
        templateWithDeps,
      );
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProjectRecord(),
      );

      // Aggregate returns max order_index = null (no existing tasks)
      mockTx.project_task.aggregate.mockResolvedValue({
        _max: { order_index: null },
      });

      // Each task create returns an object with a unique id
      mockTx.project_task.create.mockImplementation(() => {
        const id = `created-task-${taskCreateCounter++}`;
        return Promise.resolve({ id });
      });

      mockTx.task_dependency.create.mockResolvedValue({ id: 'dep-1' });
    });

    it('should create tasks from template and resolve dependencies', async () => {
      const result = await service.applyTemplate(
        TENANT_ID,
        PROJECT_ID,
        TEMPLATE_ID,
        USER_ID,
      );

      expect(result.tasks_created).toBe(3);
      expect(result.dependencies_created).toBe(2);

      // Verify 3 tasks were created
      expect(mockTx.project_task.create).toHaveBeenCalledTimes(3);

      // Verify tasks have correct order_index starting from 0
      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Demolition',
            order_index: 0,
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
            status: 'not_started',
          }),
        }),
      );
      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Plumbing Rough-In',
            order_index: 1,
          }),
        }),
      );
      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Install Cabinets',
            order_index: 2,
          }),
        }),
      );

      // Verify 2 dependencies were created (tasks 1→0, 2→1)
      expect(mockTx.task_dependency.create).toHaveBeenCalledTimes(2);
      expect(mockTx.task_dependency.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            task_id: 'created-task-1', // Plumbing
            depends_on_task_id: 'created-task-0', // Demolition
            dependency_type: 'finish_to_start',
            created_by_user_id: USER_ID,
          }),
        }),
      );
      expect(mockTx.task_dependency.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            task_id: 'created-task-2', // Install Cabinets
            depends_on_task_id: 'created-task-1', // Plumbing
          }),
        }),
      );
    });

    it('should append tasks after existing tasks', async () => {
      // Project already has 5 tasks (max order_index = 4)
      mockTx.project_task.aggregate.mockResolvedValue({
        _max: { order_index: 4 },
      });

      await service.applyTemplate(TENANT_ID, PROJECT_ID, TEMPLATE_ID, USER_ID);

      // First template task should start at order_index 5
      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Demolition',
            order_index: 5, // 4 + 1 + 0
          }),
        }),
      );
      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Plumbing Rough-In',
            order_index: 6,
          }),
        }),
      );
      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Install Cabinets',
            order_index: 7,
          }),
        }),
      );
    });

    it('should throw NotFoundException when template not found', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue(null);

      await expect(
        service.applyTemplate(TENANT_ID, PROJECT_ID, TEMPLATE_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when template is inactive', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue({
        ...templateWithDeps,
        is_active: false,
      });

      await expect(
        service.applyTemplate(TENANT_ID, PROJECT_ID, TEMPLATE_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.applyTemplate(TENANT_ID, PROJECT_ID, TEMPLATE_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return zeros when template has no tasks', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue({
        ...templateWithDeps,
        tasks: [],
      });

      const result = await service.applyTemplate(
        TENANT_ID,
        PROJECT_ID,
        TEMPLATE_ID,
        USER_ID,
      );

      expect(result.tasks_created).toBe(0);
      expect(result.dependencies_created).toBe(0);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should enforce tenant isolation — template must belong to tenant', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue(null);

      await expect(
        service.applyTemplate(TENANT_B_ID, PROJECT_ID, TEMPLATE_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project_template.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_B_ID,
          }),
        }),
      );
    });

    it('should create tasks with correct field mappings', async () => {
      await service.applyTemplate(TENANT_ID, PROJECT_ID, TEMPLATE_ID, USER_ID);

      expect(mockTx.project_task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Demolition',
            description: 'Remove existing fixtures',
            estimated_duration_days: 3,
            category: 'labor',
            status: 'not_started',
            created_by_user_id: USER_ID,
          }),
        }),
      );
    });

    it('should handle template with no dependencies', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue({
        ...templateWithDeps,
        tasks: [
          {
            id: 'tt-1',
            order_index: 0,
            title: 'Task A',
            description: null,
            estimated_duration_days: null,
            category: null,
            depends_on_order_index: null,
          },
          {
            id: 'tt-2',
            order_index: 1,
            title: 'Task B',
            description: null,
            estimated_duration_days: null,
            category: null,
            depends_on_order_index: null,
          },
        ],
      });

      const result = await service.applyTemplate(
        TENANT_ID,
        PROJECT_ID,
        TEMPLATE_ID,
        USER_ID,
      );

      expect(result.tasks_created).toBe(2);
      expect(result.dependencies_created).toBe(0);
      expect(mockTx.task_dependency.create).not.toHaveBeenCalled();
    });

    it('should create audit log entry', async () => {
      await service.applyTemplate(TENANT_ID, PROJECT_ID, TEMPLATE_ID, USER_ID);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'project',
          entityId: PROJECT_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should log activity for template application', async () => {
      await service.applyTemplate(TENANT_ID, PROJECT_ID, TEMPLATE_ID, USER_ID);

      expect(mockProjectActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          project_id: PROJECT_ID,
          user_id: USER_ID,
          activity_type: 'task_created',
        }),
      );
    });
  });

  // =========================================================================
  // Tenant Isolation
  // =========================================================================

  describe('Tenant Isolation', () => {
    it('should not return projects from other tenants (findOne)', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_B_ID, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not update projects from other tenants', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_B_ID, PROJECT_ID, USER_ID, { name: 'Hack' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not delete projects from other tenants', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(TENANT_B_ID, PROJECT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

// ===========================================================================
// ProjectNumberGeneratorService
// ===========================================================================

describe('ProjectNumberGeneratorService', () => {
  let service: ProjectNumberGeneratorService;

  const mockPrisma = {
    tenant: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectNumberGeneratorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectNumberGeneratorService>(
      ProjectNumberGeneratorService,
    );
    jest.resetAllMocks();
  });

  describe('generate()', () => {
    it('should generate formatted project number PRJ-YYYY-NNNN', async () => {
      const tx = {
        tenant: {
          findFirst: jest.fn().mockResolvedValue({
            next_project_number: 1,
          }),
          update: jest.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementation((fn) => fn(tx));

      const result = await service.generate(TENANT_ID);
      const year = new Date().getFullYear();

      expect(result).toBe(`PRJ-${year}-0001`);
    });

    it('should pad number to 4 digits', async () => {
      const tx = {
        tenant: {
          findFirst: jest.fn().mockResolvedValue({
            next_project_number: 42,
          }),
          update: jest.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementation((fn) => fn(tx));

      const result = await service.generate(TENANT_ID);
      const year = new Date().getFullYear();

      expect(result).toBe(`PRJ-${year}-0042`);
    });

    it('should increment tenant next_project_number', async () => {
      const tx = {
        tenant: {
          findFirst: jest.fn().mockResolvedValue({
            next_project_number: 5,
          }),
          update: jest.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementation((fn) => fn(tx));

      await service.generate(TENANT_ID);

      expect(tx.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        data: { next_project_number: 6 },
      });
    });

    it('should throw Error if tenant not found', async () => {
      const tx = {
        tenant: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementation((fn) => fn(tx));

      await expect(service.generate(TENANT_ID)).rejects.toThrow(
        `Tenant not found: ${TENANT_ID}`,
      );
    });

    it('should use provided transaction when available', async () => {
      const tx = {
        tenant: {
          findFirst: jest.fn().mockResolvedValue({
            next_project_number: 1,
          }),
          update: jest.fn(),
        },
      };

      await service.generate(TENANT_ID, tx);

      // Should NOT call prisma.$transaction
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      // Should use the provided transaction
      expect(tx.tenant.findFirst).toHaveBeenCalled();
    });
  });

  describe('validateFormat()', () => {
    it('should return true for valid format', () => {
      expect(service.validateFormat('PRJ-2026-0001')).toBe(true);
      expect(service.validateFormat('PRJ-2026-0042')).toBe(true);
      expect(service.validateFormat('PRJ-2026-10000')).toBe(true);
    });

    it('should return false for invalid format', () => {
      expect(service.validateFormat('Q-2026-001')).toBe(false);
      expect(service.validateFormat('PRJ2026-0001')).toBe(false);
      expect(service.validateFormat('PRJ-26-0001')).toBe(false);
      expect(service.validateFormat('')).toBe(false);
    });
  });
});
