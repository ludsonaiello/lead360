import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectTemplateService } from './project-template.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ProjectTaskCategory } from '../dto/create-project-template.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-uuid-001';
const TENANT_B = 'tenant-uuid-002';
const USER_ID = 'user-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockTemplateRecord = (overrides: any = {}) => ({
  id: 'tpl-uuid-001',
  tenant_id: TENANT_A,
  name: 'Standard Roofing Project',
  description: 'Complete roof replacement template',
  industry_type: 'Roofing',
  is_active: true,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-01-15T10:30:00.000Z'),
  updated_at: new Date('2026-01-15T10:30:00.000Z'),
  tasks: [],
  ...overrides,
});

const mockTaskRecord = (overrides: any = {}) => ({
  id: 'task-uuid-001',
  template_id: 'tpl-uuid-001',
  tenant_id: TENANT_A,
  title: 'Remove existing shingles',
  description: 'Strip old roofing material',
  estimated_duration_days: 2,
  category: 'labor',
  order_index: 0,
  depends_on_order_index: null,
  created_at: new Date('2026-01-15T10:30:00.000Z'),
  updated_at: new Date('2026-01-15T10:30:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  project_template: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project_template_task: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ProjectTemplateService', () => {
  let service: ProjectTemplateService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectTemplateService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<ProjectTemplateService>(ProjectTemplateService);
  });

  // =========================================================================
  // CREATE
  // =========================================================================

  describe('create', () => {
    it('should create a template without tasks', async () => {
      const dto = {
        name: 'Standard Roofing Project',
        description: 'Complete roof replacement template',
        industry_type: 'Roofing',
      };

      const createdTemplate = mockTemplateRecord();

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          project_template: {
            create: jest.fn().mockResolvedValue(createdTemplate),
            findFirst: jest.fn().mockResolvedValue(createdTemplate),
          },
          project_template_task: {
            createMany: jest.fn(),
          },
        };
        return fn(tx);
      });

      const result = await service.create(TENANT_A, USER_ID, dto);

      expect(result).toBeDefined();
      expect(result.id).toBe('tpl-uuid-001');
      expect(result.tenant_id).toBe(TENANT_A);
      expect(result.name).toBe('Standard Roofing Project');
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'project_template',
          entityId: 'tpl-uuid-001',
          tenantId: TENANT_A,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should create a template with tasks in a single transaction', async () => {
      const dto = {
        name: 'Roofing Template',
        tasks: [
          { title: 'Remove shingles', order_index: 0, category: ProjectTaskCategory.LABOR },
          {
            title: 'Install underlayment',
            order_index: 1,
            depends_on_order_index: 0,
            category: ProjectTaskCategory.MATERIAL,
          },
        ],
      };

      const tasks = [
        mockTaskRecord({ order_index: 0 }),
        mockTaskRecord({
          id: 'task-uuid-002',
          title: 'Install underlayment',
          order_index: 1,
          depends_on_order_index: 0,
          category: 'material',
        }),
      ];
      const createdTemplate = mockTemplateRecord({ tasks });

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const txCreateMany = jest.fn().mockResolvedValue({ count: 2 });
        const tx = {
          project_template: {
            create: jest.fn().mockResolvedValue({ id: 'tpl-uuid-001' }),
            findFirst: jest.fn().mockResolvedValue(createdTemplate),
          },
          project_template_task: {
            createMany: txCreateMany,
          },
        };
        const result = await fn(tx);
        expect(txCreateMany).toHaveBeenCalledTimes(1);
        return result;
      });

      const result = await service.create(TENANT_A, USER_ID, dto);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].order_index).toBe(0);
      expect(result.tasks[1].depends_on_order_index).toBe(0);
    });

    it('should throw BadRequestException for invalid depends_on_order_index', async () => {
      const dto = {
        name: 'Bad Template',
        tasks: [
          { title: 'Task A', order_index: 0 },
          { title: 'Task B', order_index: 1, depends_on_order_index: 5 },
        ],
      };

      await expect(service.create(TENANT_A, USER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for self-referencing dependency', async () => {
      const dto = {
        name: 'Self Ref Template',
        tasks: [
          { title: 'Task A', order_index: 0, depends_on_order_index: 0 },
        ],
      };

      await expect(service.create(TENANT_A, USER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate order_index', async () => {
      const dto = {
        name: 'Duplicate Index Template',
        tasks: [
          { title: 'Task A', order_index: 0 },
          { title: 'Task B', order_index: 0 },
        ],
      };

      await expect(service.create(TENANT_A, USER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for circular dependency (A→B, B→A)', async () => {
      const dto = {
        name: 'Circular Template',
        tasks: [
          { title: 'Task A', order_index: 0, depends_on_order_index: 1 },
          { title: 'Task B', order_index: 1, depends_on_order_index: 0 },
        ],
      };

      await expect(service.create(TENANT_A, USER_ID, dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(TENANT_A, USER_ID, dto)).rejects.toThrow(/[Cc]ircular dependency/);
    });

    it('should throw BadRequestException for longer circular chain (A→B, B→C, C→A)', async () => {
      const dto = {
        name: 'Long Circular Template',
        tasks: [
          { title: 'Task A', order_index: 0, depends_on_order_index: 2 },
          { title: 'Task B', order_index: 1, depends_on_order_index: 0 },
          { title: 'Task C', order_index: 2, depends_on_order_index: 1 },
        ],
      };

      await expect(service.create(TENANT_A, USER_ID, dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(TENANT_A, USER_ID, dto)).rejects.toThrow(/[Cc]ircular dependency/);
    });
  });

  // =========================================================================
  // FIND ALL
  // =========================================================================

  describe('findAll', () => {
    it('should return paginated templates for tenant', async () => {
      const templates = [
        mockTemplateRecord(),
        mockTemplateRecord({ id: 'tpl-uuid-002', name: 'Painting Template' }),
      ];

      mockPrismaService.project_template.findMany.mockResolvedValue(templates);
      mockPrismaService.project_template.count.mockResolvedValue(2);

      const result = await service.findAll(TENANT_A);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by tenant_id in all queries', async () => {
      mockPrismaService.project_template.findMany.mockResolvedValue([]);
      mockPrismaService.project_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A);

      expect(mockPrismaService.project_template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );
      expect(mockPrismaService.project_template.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );
    });

    it('should filter by is_active', async () => {
      mockPrismaService.project_template.findMany.mockResolvedValue([]);
      mockPrismaService.project_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { is_active: true });

      expect(mockPrismaService.project_template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A, is_active: true }),
        }),
      );
    });

    it('should filter by industry_type', async () => {
      mockPrismaService.project_template.findMany.mockResolvedValue([]);
      mockPrismaService.project_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { industry_type: 'Roofing' });

      expect(mockPrismaService.project_template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A, industry_type: 'Roofing' }),
        }),
      );
    });

    it('should cap limit at 100', async () => {
      mockPrismaService.project_template.findMany.mockResolvedValue([]);
      mockPrismaService.project_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { limit: 999 });

      expect(mockPrismaService.project_template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should include tasks ordered by order_index', async () => {
      mockPrismaService.project_template.findMany.mockResolvedValue([]);
      mockPrismaService.project_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A);

      expect(mockPrismaService.project_template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            tasks: { orderBy: { order_index: 'asc' } },
          }),
        }),
      );
    });
  });

  // =========================================================================
  // FIND ONE
  // =========================================================================

  describe('findOne', () => {
    it('should return template with tasks', async () => {
      const template = mockTemplateRecord({
        tasks: [mockTaskRecord()],
      });

      mockPrismaService.project_template.findFirst.mockResolvedValue(template);

      const result = await service.findOne(TENANT_A, 'tpl-uuid-001');

      expect(result.id).toBe('tpl-uuid-001');
      expect(result.tasks).toHaveLength(1);
      expect(mockPrismaService.project_template.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tpl-uuid-001', tenant_id: TENANT_A },
        }),
      );
    });

    it('should throw NotFoundException for non-existent template', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_A, 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should not return template from another tenant (tenant isolation)', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_B, 'tpl-uuid-001')).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project_template.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tpl-uuid-001', tenant_id: TENANT_B },
        }),
      );
    });
  });

  // =========================================================================
  // UPDATE
  // =========================================================================

  describe('update', () => {
    it('should update template fields without replacing tasks', async () => {
      const existing = mockTemplateRecord({ tasks: [mockTaskRecord()] });
      const updated = mockTemplateRecord({
        name: 'Updated Template',
        tasks: [mockTaskRecord()],
      });

      mockPrismaService.project_template.findFirst.mockResolvedValue(existing);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          project_template: {
            update: jest.fn().mockResolvedValue(updated),
            findFirst: jest.fn().mockResolvedValue(updated),
          },
          project_template_task: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        };
        return fn(tx);
      });

      const result = await service.update(TENANT_A, 'tpl-uuid-001', USER_ID, {
        name: 'Updated Template',
      });

      expect(result.name).toBe('Updated Template');
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'project_template',
        }),
      );
    });

    it('should replace all tasks when tasks array is provided', async () => {
      const existing = mockTemplateRecord({ tasks: [mockTaskRecord()] });
      const newTasks = [
        mockTaskRecord({ id: 'new-task-1', title: 'New Task 1', order_index: 0 }),
        mockTaskRecord({ id: 'new-task-2', title: 'New Task 2', order_index: 1 }),
      ];
      const updated = mockTemplateRecord({ tasks: newTasks });

      mockPrismaService.project_template.findFirst.mockResolvedValue(existing);

      const txDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const txCreateMany = jest.fn().mockResolvedValue({ count: 2 });

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          project_template: {
            update: jest.fn(),
            findFirst: jest.fn().mockResolvedValue(updated),
          },
          project_template_task: {
            deleteMany: txDeleteMany,
            createMany: txCreateMany,
          },
        };
        return fn(tx);
      });

      const result = await service.update(TENANT_A, 'tpl-uuid-001', USER_ID, {
        tasks: [
          { title: 'New Task 1', order_index: 0 },
          { title: 'New Task 2', order_index: 1 },
        ],
      });

      expect(txDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { template_id: 'tpl-uuid-001', tenant_id: TENANT_A },
        }),
      );
      expect(txCreateMany).toHaveBeenCalledTimes(1);
      expect(result.tasks).toHaveLength(2);
    });

    it('should throw NotFoundException for non-existent template on update', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_A, 'non-existent', USER_ID, { name: 'Fail' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not update template from another tenant (tenant isolation)', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_B, 'tpl-uuid-001', USER_ID, { name: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate task dependencies on update', async () => {
      const existing = mockTemplateRecord({ tasks: [] });
      mockPrismaService.project_template.findFirst.mockResolvedValue(existing);

      await expect(
        service.update(TENANT_A, 'tpl-uuid-001', USER_ID, {
          tasks: [
            { title: 'Task A', order_index: 0 },
            { title: 'Task B', order_index: 1, depends_on_order_index: 99 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // DELETE
  // =========================================================================

  describe('delete', () => {
    it('should hard delete template in a transaction', async () => {
      const existing = mockTemplateRecord();

      const txDelete = jest.fn().mockResolvedValue(existing);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          project_template: {
            findFirst: jest.fn().mockResolvedValue(existing),
            delete: txDelete,
          },
        };
        return fn(tx);
      });

      await service.delete(TENANT_A, 'tpl-uuid-001', USER_ID);

      expect(txDelete).toHaveBeenCalledWith({
        where: { id: 'tpl-uuid-001' },
      });
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'project_template',
          entityId: 'tpl-uuid-001',
        }),
      );
    });

    it('should throw NotFoundException for non-existent template on delete', async () => {
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          project_template: {
            findFirst: jest.fn().mockResolvedValue(null),
            delete: jest.fn(),
          },
        };
        return fn(tx);
      });

      await expect(
        service.delete(TENANT_A, 'non-existent', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not delete template from another tenant (tenant isolation)', async () => {
      const txDelete = jest.fn();
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          project_template: {
            findFirst: jest.fn().mockResolvedValue(null),
            delete: txDelete,
          },
        };
        return fn(tx);
      });

      await expect(
        service.delete(TENANT_B, 'tpl-uuid-001', USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(txDelete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TENANT ISOLATION
  // =========================================================================

  describe('Tenant Isolation', () => {
    it('findAll should only query with the provided tenant_id', async () => {
      mockPrismaService.project_template.findMany.mockResolvedValue([]);
      mockPrismaService.project_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A);

      const whereArg = mockPrismaService.project_template.findMany.mock.calls[0][0].where;
      expect(whereArg.tenant_id).toBe(TENANT_A);
    });

    it('findOne should include tenant_id in where clause', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_B, 'tpl-uuid-001')).rejects.toThrow(NotFoundException);

      const whereArg = mockPrismaService.project_template.findFirst.mock.calls[0][0].where;
      expect(whereArg.tenant_id).toBe(TENANT_B);
      expect(whereArg.id).toBe('tpl-uuid-001');
    });

    it('update should include tenant_id check before allowing modification', async () => {
      mockPrismaService.project_template.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_B, 'tpl-uuid-001', USER_ID, { name: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('delete should include tenant_id check before allowing deletion', async () => {
      const txDelete = jest.fn();
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          project_template: {
            findFirst: jest.fn().mockResolvedValue(null),
            delete: txDelete,
          },
        };
        return fn(tx);
      });

      await expect(
        service.delete(TENANT_B, 'tpl-uuid-001', USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(txDelete).not.toHaveBeenCalled();
    });
  });
});
