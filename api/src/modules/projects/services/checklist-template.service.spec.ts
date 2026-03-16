import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ChecklistTemplateService } from './checklist-template.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

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
  id: 'clt-uuid-001',
  tenant_id: TENANT_A,
  name: 'Standard Roofing Completion',
  description: 'Checklist for residential roofing projects',
  is_active: true,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-01-15T10:00:00.000Z'),
  updated_at: new Date('2026-01-15T10:00:00.000Z'),
  items: [],
  ...overrides,
});

const mockItemRecord = (overrides: any = {}) => ({
  id: 'cli-uuid-001',
  template_id: 'clt-uuid-001',
  tenant_id: TENANT_A,
  title: 'Final inspection passed',
  description: null,
  is_required: true,
  order_index: 0,
  created_at: new Date('2026-01-15T10:00:00.000Z'),
  updated_at: new Date('2026-01-15T10:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  completion_checklist_template: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  completion_checklist_template_item: {
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

describe('ChecklistTemplateService', () => {
  let service: ChecklistTemplateService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecklistTemplateService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<ChecklistTemplateService>(ChecklistTemplateService);
  });

  // =========================================================================
  // CREATE
  // =========================================================================

  describe('create', () => {
    it('should create a template with items in a transaction', async () => {
      const dto = {
        name: 'Standard Roofing Completion',
        description: 'Checklist for residential roofing projects',
        items: [
          { title: 'Final inspection passed', order_index: 0 },
          {
            title: 'Customer walkthrough completed',
            description: 'Walk customer through all work',
            is_required: true,
            order_index: 1,
          },
          { title: 'Debris cleanup', order_index: 2 },
          {
            title: 'Warranty documentation provided',
            is_required: false,
            order_index: 3,
          },
        ],
      };

      const items = [
        mockItemRecord({ order_index: 0 }),
        mockItemRecord({
          id: 'cli-uuid-002',
          title: 'Customer walkthrough completed',
          description: 'Walk customer through all work',
          order_index: 1,
        }),
        mockItemRecord({
          id: 'cli-uuid-003',
          title: 'Debris cleanup',
          order_index: 2,
        }),
        mockItemRecord({
          id: 'cli-uuid-004',
          title: 'Warranty documentation provided',
          is_required: false,
          order_index: 3,
        }),
      ];
      const createdTemplate = mockTemplateRecord({ items });

      // No existing template with same name
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const txCreateMany = jest.fn().mockResolvedValue({ count: 4 });
        const tx = {
          completion_checklist_template: {
            create: jest
              .fn()
              .mockResolvedValue({ id: 'clt-uuid-001', tenant_id: TENANT_A }),
            findFirst: jest.fn().mockResolvedValue(createdTemplate),
          },
          completion_checklist_template_item: {
            createMany: txCreateMany,
          },
        };
        const result = await fn(tx);
        expect(txCreateMany).toHaveBeenCalledTimes(1);
        return result;
      });

      const result = await service.create(TENANT_A, USER_ID, dto);

      expect(result).toBeDefined();
      expect(result!.id).toBe('clt-uuid-001');
      expect(result!.tenant_id).toBe(TENANT_A);
      expect(result!.name).toBe('Standard Roofing Completion');
      expect(result!.items).toHaveLength(4);
      expect(result!.items[0].order_index).toBe(0);
      expect(result!.items[3].is_required).toBe(false);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'completion_checklist_template',
          entityId: 'clt-uuid-001',
          tenantId: TENANT_A,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should throw ConflictException if template name already exists for tenant', async () => {
      const dto = {
        name: 'Standard Roofing Completion',
        items: [{ title: 'Item 1', order_index: 0 }],
      };

      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        mockTemplateRecord(),
      );

      await expect(
        service.create(TENANT_A, USER_ID, dto),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.create(TENANT_A, USER_ID, dto),
      ).rejects.toThrow('A checklist template with this name already exists');
    });

    it('should allow same template name for different tenants', async () => {
      const dto = {
        name: 'Standard Roofing Completion',
        items: [{ title: 'Item 1', order_index: 0 }],
      };

      const createdTemplate = mockTemplateRecord({
        tenant_id: TENANT_B,
        items: [mockItemRecord({ tenant_id: TENANT_B })],
      });

      // No existing for TENANT_B
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          completion_checklist_template: {
            create: jest.fn().mockResolvedValue({ id: 'clt-uuid-001' }),
            findFirst: jest.fn().mockResolvedValue(createdTemplate),
          },
          completion_checklist_template_item: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return fn(tx);
      });

      const result = await service.create(TENANT_B, USER_ID, dto);
      expect(result).toBeDefined();
    });

    it('should set is_required to true by default when not provided', async () => {
      const dto = {
        name: 'Test Template',
        items: [{ title: 'Item without explicit is_required', order_index: 0 }],
      };

      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      let capturedCreateManyData: any;
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const txCreateMany = jest.fn().mockImplementation((args) => {
          capturedCreateManyData = args.data;
          return { count: 1 };
        });
        const tx = {
          completion_checklist_template: {
            create: jest.fn().mockResolvedValue({ id: 'clt-uuid-001' }),
            findFirst: jest.fn().mockResolvedValue(
              mockTemplateRecord({
                name: 'Test Template',
                items: [mockItemRecord({ is_required: true })],
              }),
            ),
          },
          completion_checklist_template_item: {
            createMany: txCreateMany,
          },
        };
        return fn(tx);
      });

      await service.create(TENANT_A, USER_ID, dto);

      expect(capturedCreateManyData[0].is_required).toBe(true);
    });
  });

  // =========================================================================
  // FIND ALL
  // =========================================================================

  describe('findAll', () => {
    it('should return paginated templates for tenant', async () => {
      const templates = [
        mockTemplateRecord(),
        mockTemplateRecord({ id: 'clt-uuid-002', name: 'Painting Completion' }),
      ];

      mockPrismaService.completion_checklist_template.findMany.mockResolvedValue(
        templates,
      );
      mockPrismaService.completion_checklist_template.count.mockResolvedValue(2);

      const result = await service.findAll(TENANT_A);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by tenant_id in all queries', async () => {
      mockPrismaService.completion_checklist_template.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.completion_checklist_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A);

      expect(
        mockPrismaService.completion_checklist_template.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );
      expect(
        mockPrismaService.completion_checklist_template.count,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );
    });

    it('should filter by is_active when provided', async () => {
      mockPrismaService.completion_checklist_template.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.completion_checklist_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { is_active: true });

      expect(
        mockPrismaService.completion_checklist_template.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
            is_active: true,
          }),
        }),
      );
    });

    it('should cap limit at 100', async () => {
      mockPrismaService.completion_checklist_template.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.completion_checklist_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { limit: 999 });

      expect(
        mockPrismaService.completion_checklist_template.findMany,
      ).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });

    it('should set minimum page to 1', async () => {
      mockPrismaService.completion_checklist_template.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.completion_checklist_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { page: -5 });

      expect(
        mockPrismaService.completion_checklist_template.findMany,
      ).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
    });

    it('should include items ordered by order_index', async () => {
      mockPrismaService.completion_checklist_template.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.completion_checklist_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A);

      expect(
        mockPrismaService.completion_checklist_template.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            items: { orderBy: { order_index: 'asc' } },
          }),
        }),
      );
    });

    it('should calculate correct pagination for page 2', async () => {
      mockPrismaService.completion_checklist_template.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.completion_checklist_template.count.mockResolvedValue(
        50,
      );

      const result = await service.findAll(TENANT_A, { page: 2, limit: 10 });

      expect(
        mockPrismaService.completion_checklist_template.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.page).toBe(2);
    });
  });

  // =========================================================================
  // FIND ONE
  // =========================================================================

  describe('findOne', () => {
    it('should return template with items', async () => {
      const template = mockTemplateRecord({
        items: [
          mockItemRecord(),
          mockItemRecord({
            id: 'cli-uuid-002',
            title: 'Customer walkthrough',
            order_index: 1,
          }),
        ],
      });

      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        template,
      );

      const result = await service.findOne(TENANT_A, 'clt-uuid-001');

      expect(result.id).toBe('clt-uuid-001');
      expect(result.items).toHaveLength(2);
      expect(
        mockPrismaService.completion_checklist_template.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'clt-uuid-001', tenant_id: TENANT_A },
        }),
      );
    });

    it('should throw NotFoundException for non-existent template', async () => {
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.findOne(TENANT_A, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return template from another tenant (tenant isolation)', async () => {
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.findOne(TENANT_B, 'clt-uuid-001'),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.completion_checklist_template.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'clt-uuid-001', tenant_id: TENANT_B },
        }),
      );
    });
  });

  // =========================================================================
  // UPDATE
  // =========================================================================

  describe('update', () => {
    it('should update template fields without replacing items', async () => {
      const existing = mockTemplateRecord({
        items: [mockItemRecord()],
      });
      const updated = mockTemplateRecord({
        name: 'Updated Checklist',
        items: [mockItemRecord()],
      });

      // existence check — dto has no name, so no uniqueness check fires
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        existing,
      );

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          completion_checklist_template: {
            update: jest.fn().mockResolvedValue(updated),
            findFirst: jest.fn().mockResolvedValue(updated),
          },
          completion_checklist_template_item: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        };
        return fn(tx);
      });

      const result = await service.update(TENANT_A, 'clt-uuid-001', USER_ID, {
        description: 'Updated description',
      });

      expect(result!.name).toBe('Updated Checklist');
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'completion_checklist_template',
        }),
      );
    });

    it('should replace all items when items array is provided', async () => {
      const existing = mockTemplateRecord({
        items: [mockItemRecord()],
      });
      const newItems = [
        mockItemRecord({
          id: 'new-item-1',
          title: 'New Item 1',
          order_index: 0,
        }),
        mockItemRecord({
          id: 'new-item-2',
          title: 'New Item 2',
          order_index: 1,
        }),
      ];
      const updated = mockTemplateRecord({ items: newItems });

      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        existing,
      );

      const txDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const txCreateMany = jest.fn().mockResolvedValue({ count: 2 });

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          completion_checklist_template: {
            update: jest.fn(),
            findFirst: jest.fn().mockResolvedValue(updated),
          },
          completion_checklist_template_item: {
            deleteMany: txDeleteMany,
            createMany: txCreateMany,
          },
        };
        return fn(tx);
      });

      const result = await service.update(TENANT_A, 'clt-uuid-001', USER_ID, {
        items: [
          { title: 'New Item 1', order_index: 0 },
          { title: 'New Item 2', order_index: 1 },
        ],
      });

      expect(txDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { template_id: 'clt-uuid-001', tenant_id: TENANT_A },
        }),
      );
      expect(txCreateMany).toHaveBeenCalledTimes(1);
      expect(result!.items).toHaveLength(2);
    });

    it('should throw ConflictException when renaming to existing name', async () => {
      const existing = mockTemplateRecord();

      mockPrismaService.completion_checklist_template.findFirst
        .mockResolvedValueOnce(existing) // existence check
        .mockResolvedValueOnce(
          mockTemplateRecord({ id: 'clt-uuid-002', name: 'Taken Name' }),
        ); // uniqueness check

      await expect(
        service.update(TENANT_A, 'clt-uuid-001', USER_ID, {
          name: 'Taken Name',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow keeping the same name (no conflict with self)', async () => {
      const existing = mockTemplateRecord();

      mockPrismaService.completion_checklist_template.findFirst
        .mockResolvedValueOnce(existing) // existence check
        .mockResolvedValueOnce(null); // uniqueness check (NOT: { id } excludes self)

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          completion_checklist_template: {
            update: jest.fn(),
            findFirst: jest.fn().mockResolvedValue(existing),
          },
          completion_checklist_template_item: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        };
        return fn(tx);
      });

      // Same name but different field changes — should not conflict
      const result = await service.update(TENANT_A, 'clt-uuid-001', USER_ID, {
        name: 'Standard Roofing Completion', // same as existing
        description: 'Updated desc',
      });

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException for non-existent template on update', async () => {
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.update(TENANT_A, 'non-existent', USER_ID, {
          name: 'Fail',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not update template from another tenant (tenant isolation)', async () => {
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.update(TENANT_B, 'clt-uuid-001', USER_ID, {
          name: 'Hacked',
        }),
      ).rejects.toThrow(NotFoundException);
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
          completion_checklist_template: {
            findFirst: jest.fn().mockResolvedValue(existing),
            delete: txDelete,
          },
        };
        return fn(tx);
      });

      await service.delete(TENANT_A, 'clt-uuid-001', USER_ID);

      expect(txDelete).toHaveBeenCalledWith({
        where: { id: 'clt-uuid-001' },
      });
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'completion_checklist_template',
          entityId: 'clt-uuid-001',
        }),
      );
    });

    it('should throw NotFoundException for non-existent template on delete', async () => {
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          completion_checklist_template: {
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
          completion_checklist_template: {
            findFirst: jest.fn().mockResolvedValue(null),
            delete: txDelete,
          },
        };
        return fn(tx);
      });

      await expect(
        service.delete(TENANT_B, 'clt-uuid-001', USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(txDelete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TENANT ISOLATION (explicit dedicated block)
  // =========================================================================

  describe('Tenant Isolation', () => {
    it('findAll should only query with the provided tenant_id', async () => {
      mockPrismaService.completion_checklist_template.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.completion_checklist_template.count.mockResolvedValue(0);

      await service.findAll(TENANT_A);

      const whereArg =
        mockPrismaService.completion_checklist_template.findMany.mock
          .calls[0][0].where;
      expect(whereArg.tenant_id).toBe(TENANT_A);
    });

    it('findOne should include tenant_id in where clause', async () => {
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.findOne(TENANT_B, 'clt-uuid-001'),
      ).rejects.toThrow(NotFoundException);

      const whereArg =
        mockPrismaService.completion_checklist_template.findFirst.mock
          .calls[0][0].where;
      expect(whereArg.tenant_id).toBe(TENANT_B);
      expect(whereArg.id).toBe('clt-uuid-001');
    });

    it('update should include tenant_id check before allowing modification', async () => {
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.update(TENANT_B, 'clt-uuid-001', USER_ID, {
          name: 'Hacked',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('delete should include tenant_id check before allowing deletion', async () => {
      const txDelete = jest.fn();
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          completion_checklist_template: {
            findFirst: jest.fn().mockResolvedValue(null),
            delete: txDelete,
          },
        };
        return fn(tx);
      });

      await expect(
        service.delete(TENANT_B, 'clt-uuid-001', USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(txDelete).not.toHaveBeenCalled();
    });

    it('create should check uniqueness only within the requesting tenant', async () => {
      // Verifies the findFirst uniqueness check uses tenantId filter
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          completion_checklist_template: {
            create: jest.fn().mockResolvedValue({ id: 'clt-uuid-new' }),
            findFirst: jest.fn().mockResolvedValue(
              mockTemplateRecord({ id: 'clt-uuid-new', items: [] }),
            ),
          },
          completion_checklist_template_item: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return fn(tx);
      });

      await service.create(TENANT_A, USER_ID, {
        name: 'Unique Name',
        items: [{ title: 'Item', order_index: 0 }],
      });

      expect(
        mockPrismaService.completion_checklist_template.findFirst,
      ).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_A, name: 'Unique Name' },
      });
    });
  });

  // =========================================================================
  // RBAC (verified at controller level, but service tests confirm audit)
  // =========================================================================

  describe('Audit Logging', () => {
    it('should log audit entry on create', async () => {
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          completion_checklist_template: {
            create: jest.fn().mockResolvedValue({ id: 'clt-uuid-001' }),
            findFirst: jest
              .fn()
              .mockResolvedValue(mockTemplateRecord({ items: [] })),
          },
          completion_checklist_template_item: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return fn(tx);
      });

      await service.create(TENANT_A, USER_ID, {
        name: 'Standard Roofing Completion',
        items: [{ title: 'Item', order_index: 0 }],
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'completion_checklist_template',
          tenantId: TENANT_A,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should log audit entry on update', async () => {
      const existing = mockTemplateRecord({ items: [] });
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        existing,
      );

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          completion_checklist_template: {
            update: jest.fn(),
            findFirst: jest
              .fn()
              .mockResolvedValue(
                mockTemplateRecord({ description: 'Updated', items: [] }),
              ),
          },
          completion_checklist_template_item: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        };
        return fn(tx);
      });

      await service.update(TENANT_A, 'clt-uuid-001', USER_ID, {
        description: 'Updated',
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'completion_checklist_template',
        }),
      );
    });

    it('should log audit entry on delete', async () => {
      const existing = mockTemplateRecord();
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          completion_checklist_template: {
            findFirst: jest.fn().mockResolvedValue(existing),
            delete: jest.fn().mockResolvedValue(existing),
          },
        };
        return fn(tx);
      });

      await service.delete(TENANT_A, 'clt-uuid-001', USER_ID);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'completion_checklist_template',
          entityId: 'clt-uuid-001',
        }),
      );
    });
  });
});
