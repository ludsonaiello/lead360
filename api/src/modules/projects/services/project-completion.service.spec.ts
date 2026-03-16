import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectCompletionService } from './project-completion.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-uuid-001';
const TENANT_B = 'tenant-uuid-002';
const USER_ID = 'user-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const CHECKLIST_ID = 'checklist-uuid-001';
const TEMPLATE_ID = 'template-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockProject = (overrides: any = {}) => ({
  id: PROJECT_ID,
  tenant_id: TENANT_A,
  status: 'in_progress',
  name: 'Test Project',
  project_number: 'PRJ-001',
  ...overrides,
});

const mockChecklist = (overrides: any = {}) => ({
  id: CHECKLIST_ID,
  tenant_id: TENANT_A,
  project_id: PROJECT_ID,
  template_id: null,
  completed_at: null,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-06-10T10:00:00Z'),
  items: [],
  punch_list_items: [],
  ...overrides,
});

const mockChecklistItem = (overrides: any = {}) => ({
  id: 'item-uuid-001',
  tenant_id: TENANT_A,
  checklist_id: CHECKLIST_ID,
  title: 'Final inspection passed',
  is_required: true,
  is_completed: false,
  completed_at: null,
  completed_by_user_id: null,
  notes: null,
  template_item_id: null,
  order_index: 0,
  updated_at: new Date(),
  ...overrides,
});

const mockPunchListItem = (overrides: any = {}) => ({
  id: 'punch-uuid-001',
  tenant_id: TENANT_A,
  checklist_id: CHECKLIST_ID,
  project_id: PROJECT_ID,
  title: 'Touch up paint on trim',
  description: null,
  status: 'open',
  assigned_to_crew_id: null,
  assigned_to_crew: null,
  resolved_at: null,
  reported_by_user_id: USER_ID,
  resolved_by_user_id: null,
  created_at: new Date('2026-06-10T10:00:00Z'),
  updated_at: new Date(),
  ...overrides,
});

const mockTemplate = (overrides: any = {}) => ({
  id: TEMPLATE_ID,
  tenant_id: TENANT_A,
  name: 'Standard Completion',
  items: [
    {
      id: 'tpl-item-001',
      title: 'Final inspection',
      is_required: true,
      order_index: 0,
    },
    {
      id: 'tpl-item-002',
      title: 'Customer walkthrough',
      is_required: true,
      order_index: 1,
    },
    {
      id: 'tpl-item-003',
      title: 'Warranty docs',
      is_required: false,
      order_index: 2,
    },
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  project: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  project_completion_checklist: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  project_completion_checklist_item: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
  },
  punch_list_item: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  completion_checklist_template: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ProjectCompletionService', () => {
  let service: ProjectCompletionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectCompletionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<ProjectCompletionService>(ProjectCompletionService);
  });

  // =========================================================================
  // getCompletion
  // =========================================================================

  describe('getCompletion', () => {
    it('should return formatted checklist with items and punch list', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());

      const checklist = mockChecklist({
        items: [
          mockChecklistItem(),
          mockChecklistItem({
            id: 'item-uuid-002',
            title: 'Customer walkthrough',
            order_index: 1,
          }),
        ],
        punch_list_items: [mockPunchListItem()],
      });

      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        checklist,
      );

      const result = await service.getCompletion(TENANT_A, PROJECT_ID);

      expect(result.id).toBe(CHECKLIST_ID);
      expect(result.project_id).toBe(PROJECT_ID);
      expect(result.items).toHaveLength(2);
      expect(result.punch_list).toHaveLength(1);
      expect(result.items[0].title).toBe('Final inspection passed');
      expect(result.punch_list[0].title).toBe('Touch up paint on trim');
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getCompletion(TENANT_A, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getCompletion(TENANT_A, PROJECT_ID),
      ).rejects.toThrow('Project not found');
    });

    it('should throw NotFoundException if no checklist exists', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.getCompletion(TENANT_A, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getCompletion(TENANT_A, PROJECT_ID),
      ).rejects.toThrow('No completion checklist exists for this project');
    });

    it('should enforce tenant isolation on project lookup', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getCompletion(TENANT_B, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_B },
      });
    });
  });

  // =========================================================================
  // startCompletion
  // =========================================================================

  describe('startCompletion', () => {
    it('should create an empty checklist when no template_id provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      // No existing checklist
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValueOnce(
        null,
      );

      const createdChecklist = mockChecklist();
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          project_completion_checklist: {
            create: jest.fn().mockResolvedValue({ id: CHECKLIST_ID }),
            findFirst: jest.fn().mockResolvedValue(createdChecklist),
          },
          project_completion_checklist_item: {
            createMany: jest.fn(),
          },
        };
        return fn(tx);
      });

      const result = await service.startCompletion(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        {},
      );

      expect(result.id).toBe(CHECKLIST_ID);
      expect(result.project_id).toBe(PROJECT_ID);
      expect(result.items).toHaveLength(0);
      expect(result.punch_list).toHaveLength(0);
    });

    it('should copy items from template when template_id provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      // No existing checklist
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValueOnce(
        null,
      );

      const template = mockTemplate();
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        template,
      );

      const copiedItems = template.items.map((item, i) =>
        mockChecklistItem({
          id: `item-uuid-${i}`,
          title: item.title,
          is_required: item.is_required,
          template_item_id: item.id,
          order_index: item.order_index,
        }),
      );

      const createdChecklist = mockChecklist({
        template_id: TEMPLATE_ID,
        items: copiedItems,
      });

      let txCreateManyData: any;
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const txCreateMany = jest.fn().mockImplementation((args) => {
          txCreateManyData = args.data;
          return { count: 3 };
        });
        const tx = {
          project_completion_checklist: {
            create: jest.fn().mockResolvedValue({ id: CHECKLIST_ID }),
            findFirst: jest.fn().mockResolvedValue(createdChecklist),
          },
          project_completion_checklist_item: {
            createMany: txCreateMany,
          },
        };
        return fn(tx);
      });

      const result = await service.startCompletion(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { template_id: TEMPLATE_ID },
      );

      expect(result.template_id).toBe(TEMPLATE_ID);
      expect(result.items).toHaveLength(3);
      expect(txCreateManyData).toHaveLength(3);
      expect(txCreateManyData[0].template_item_id).toBe('tpl-item-001');
      expect(txCreateManyData[0].tenant_id).toBe(TENANT_A);
    });

    it('should throw ConflictException if checklist already exists', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );

      await expect(
        service.startCompletion(TENANT_A, PROJECT_ID, USER_ID, {}),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.startCompletion(TENANT_A, PROJECT_ID, USER_ID, {}),
      ).rejects.toThrow(
        'A completion checklist already exists for this project',
      );
    });

    it('should throw NotFoundException if template_id does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.startCompletion(TENANT_A, PROJECT_ID, USER_ID, {
          template_id: 'non-existent',
        }),
      ).rejects.toThrow('Checklist template not found');
    });

    it('should log audit entry on creation', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValueOnce(
        null,
      );

      const createdChecklist = mockChecklist();
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          project_completion_checklist: {
            create: jest.fn().mockResolvedValue({ id: CHECKLIST_ID }),
            findFirst: jest.fn().mockResolvedValue(createdChecklist),
          },
          project_completion_checklist_item: {
            createMany: jest.fn(),
          },
        };
        return fn(tx);
      });

      await service.startCompletion(TENANT_A, PROJECT_ID, USER_ID, {});

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'project_completion_checklist',
          entityId: CHECKLIST_ID,
          tenantId: TENANT_A,
          actorUserId: USER_ID,
        }),
      );
    });
  });

  // =========================================================================
  // completeItem
  // =========================================================================

  describe('completeItem', () => {
    beforeEach(() => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
    });

    it('should mark item as completed with timestamp and user', async () => {
      const checklist = mockChecklist();
      // getChecklistForProject call
      mockPrismaService.project_completion_checklist.findFirst
        .mockResolvedValueOnce(checklist) // getChecklistForProject
        .mockResolvedValueOnce(checklist) // evaluateChecklistCompletion
        .mockResolvedValueOnce(checklist); // getCompletion (re-fetch)

      const item = mockChecklistItem();
      mockPrismaService.project_completion_checklist_item.findFirst.mockResolvedValue(
        item,
      );

      const updatedItem = mockChecklistItem({
        is_completed: true,
        completed_at: new Date(),
        completed_by_user_id: USER_ID,
      });
      mockPrismaService.project_completion_checklist_item.update.mockResolvedValue(
        updatedItem,
      );

      // evaluateChecklistCompletion
      mockPrismaService.project_completion_checklist_item.findMany.mockResolvedValue(
        [{ is_completed: true }],
      );
      mockPrismaService.project_completion_checklist.update.mockResolvedValue(
        mockChecklist({ completed_at: new Date() }),
      );

      // Re-fetch for getCompletion response
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist({ items: [updatedItem], punch_list_items: [] }),
      );

      const result = await service.completeItem(
        TENANT_A,
        PROJECT_ID,
        'item-uuid-001',
        USER_ID,
        { notes: 'Passed' },
      );

      expect(
        mockPrismaService.project_completion_checklist_item.update,
      ).toHaveBeenCalledWith({
        where: { id: 'item-uuid-001' },
        data: expect.objectContaining({
          is_completed: true,
          completed_by_user_id: USER_ID,
          notes: 'Passed',
        }),
      });

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if item not found', async () => {
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );
      mockPrismaService.project_completion_checklist_item.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.completeItem(
          TENANT_A,
          PROJECT_ID,
          'non-existent',
          USER_ID,
          {},
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.completeItem(
          TENANT_A,
          PROJECT_ID,
          'non-existent',
          USER_ID,
          {},
        ),
      ).rejects.toThrow('Checklist item not found');
    });

    it('should log audit entry on item completion', async () => {
      const checklist = mockChecklist();
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        checklist,
      );

      const item = mockChecklistItem();
      mockPrismaService.project_completion_checklist_item.findFirst.mockResolvedValue(
        item,
      );
      mockPrismaService.project_completion_checklist_item.update.mockResolvedValue(
        mockChecklistItem({ is_completed: true }),
      );
      mockPrismaService.project_completion_checklist_item.findMany.mockResolvedValue(
        [{ is_completed: true }],
      );
      mockPrismaService.project_completion_checklist.update.mockResolvedValue(
        mockChecklist({ completed_at: new Date() }),
      );

      // getCompletion re-fetch
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist({ items: [], punch_list_items: [] }),
      );

      await service.completeItem(
        TENANT_A,
        PROJECT_ID,
        'item-uuid-001',
        USER_ID,
        {},
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'project_completion_checklist_item',
          entityId: 'item-uuid-001',
        }),
      );
    });

    it('should set checklist.completed_at when all required items are done', async () => {
      const checklist = mockChecklist();
      mockPrismaService.project_completion_checklist.findFirst
        .mockResolvedValueOnce(checklist) // getChecklistForProject
        .mockResolvedValueOnce({ completed_at: null }) // evaluateChecklistCompletion (current state)
        .mockResolvedValueOnce(
          mockChecklist({ items: [], punch_list_items: [] }),
        ); // getCompletion

      const item = mockChecklistItem();
      mockPrismaService.project_completion_checklist_item.findFirst.mockResolvedValue(
        item,
      );
      mockPrismaService.project_completion_checklist_item.update.mockResolvedValue(
        mockChecklistItem({ is_completed: true }),
      );

      // All required items complete
      mockPrismaService.project_completion_checklist_item.findMany.mockResolvedValue(
        [{ is_completed: true }, { is_completed: true }],
      );

      mockPrismaService.project_completion_checklist.update.mockResolvedValue(
        mockChecklist({ completed_at: new Date() }),
      );

      await service.completeItem(
        TENANT_A,
        PROJECT_ID,
        'item-uuid-001',
        USER_ID,
        {},
      );

      expect(
        mockPrismaService.project_completion_checklist.update,
      ).toHaveBeenCalledWith({
        where: { id: CHECKLIST_ID },
        data: { completed_at: expect.any(Date) },
      });
    });
  });

  // =========================================================================
  // addManualItem
  // =========================================================================

  describe('addManualItem', () => {
    it('should add a manual item to the checklist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );

      mockPrismaService.project_completion_checklist_item.create.mockResolvedValue(
        mockChecklistItem({ title: 'Manual item' }),
      );

      // evaluateChecklistCompletion
      mockPrismaService.project_completion_checklist_item.findMany.mockResolvedValue(
        [{ is_completed: false }],
      );
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist({ items: [], punch_list_items: [] }),
      );

      const result = await service.addManualItem(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { title: 'Manual item', order_index: 5 },
      );

      expect(
        mockPrismaService.project_completion_checklist_item.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_A,
          checklist_id: CHECKLIST_ID,
          title: 'Manual item',
          is_required: true,
          order_index: 5,
        }),
      });

      expect(result).toBeDefined();
    });

    it('should default is_required to true', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );
      mockPrismaService.project_completion_checklist_item.create.mockResolvedValue(
        mockChecklistItem(),
      );
      mockPrismaService.project_completion_checklist_item.findMany.mockResolvedValue(
        [],
      );

      await service.addManualItem(TENANT_A, PROJECT_ID, USER_ID, {
        title: 'Test',
        order_index: 0,
      });

      expect(
        mockPrismaService.project_completion_checklist_item.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({ is_required: true }),
      });
    });

    it('should log audit entry', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );
      mockPrismaService.project_completion_checklist_item.create.mockResolvedValue(
        mockChecklistItem(),
      );
      mockPrismaService.project_completion_checklist_item.findMany.mockResolvedValue(
        [],
      );

      await service.addManualItem(TENANT_A, PROJECT_ID, USER_ID, {
        title: 'Audit test',
        order_index: 0,
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'project_completion_checklist_item',
        }),
      );
    });
  });

  // =========================================================================
  // addPunchListItem
  // =========================================================================

  describe('addPunchListItem', () => {
    it('should create a punch list item with status open', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );

      const created = mockPunchListItem();
      mockPrismaService.punch_list_item.create.mockResolvedValue(created);

      // getCompletion re-fetch
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist({ items: [], punch_list_items: [created] }),
      );

      const result = await service.addPunchListItem(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { title: 'Touch up paint on trim' },
      );

      expect(mockPrismaService.punch_list_item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_A,
          checklist_id: CHECKLIST_ID,
          project_id: PROJECT_ID,
          title: 'Touch up paint on trim',
          reported_by_user_id: USER_ID,
        }),
      });

      expect(result.punch_list).toHaveLength(1);
    });

    it('should set assigned_to_crew_id when provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );
      mockPrismaService.punch_list_item.create.mockResolvedValue(
        mockPunchListItem(),
      );

      // getCompletion re-fetch
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist({ items: [], punch_list_items: [] }),
      );

      await service.addPunchListItem(TENANT_A, PROJECT_ID, USER_ID, {
        title: 'Fix issue',
        assigned_to_crew_id: 'crew-uuid-001',
      });

      expect(mockPrismaService.punch_list_item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assigned_to_crew_id: 'crew-uuid-001',
        }),
      });
    });

    it('should log audit entry', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );
      mockPrismaService.punch_list_item.create.mockResolvedValue(
        mockPunchListItem(),
      );
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist({ items: [], punch_list_items: [] }),
      );

      await service.addPunchListItem(TENANT_A, PROJECT_ID, USER_ID, {
        title: 'Test punch',
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'punch_list_item',
        }),
      );
    });
  });

  // =========================================================================
  // updatePunchListItem
  // =========================================================================

  describe('updatePunchListItem', () => {
    it('should update punch list item status', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );

      const existing = mockPunchListItem();
      mockPrismaService.punch_list_item.findFirst.mockResolvedValue(existing);

      const updated = mockPunchListItem({ status: 'in_progress' });
      mockPrismaService.punch_list_item.update.mockResolvedValue(updated);

      // getCompletion re-fetch
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist({ items: [], punch_list_items: [updated] }),
      );

      const result = await service.updatePunchListItem(
        TENANT_A,
        PROJECT_ID,
        'punch-uuid-001',
        USER_ID,
        { status: 'in_progress' },
      );

      expect(mockPrismaService.punch_list_item.update).toHaveBeenCalledWith({
        where: { id: 'punch-uuid-001' },
        data: { status: 'in_progress' },
      });

      expect(result).toBeDefined();
    });

    it('should set resolved_at and resolved_by when status becomes resolved', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );

      const existing = mockPunchListItem({ status: 'in_progress' });
      mockPrismaService.punch_list_item.findFirst.mockResolvedValue(existing);
      mockPrismaService.punch_list_item.update.mockResolvedValue(
        mockPunchListItem({ status: 'resolved' }),
      );
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist({ items: [], punch_list_items: [] }),
      );

      await service.updatePunchListItem(
        TENANT_A,
        PROJECT_ID,
        'punch-uuid-001',
        USER_ID,
        { status: 'resolved' },
      );

      expect(mockPrismaService.punch_list_item.update).toHaveBeenCalledWith({
        where: { id: 'punch-uuid-001' },
        data: expect.objectContaining({
          status: 'resolved',
          resolved_at: expect.any(Date),
          resolved_by_user_id: USER_ID,
        }),
      });
    });

    it('should clear resolved_at when re-opening from resolved', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );

      const existing = mockPunchListItem({
        status: 'resolved',
        resolved_at: new Date(),
        resolved_by_user_id: USER_ID,
      });
      mockPrismaService.punch_list_item.findFirst.mockResolvedValue(existing);
      mockPrismaService.punch_list_item.update.mockResolvedValue(
        mockPunchListItem({ status: 'open' }),
      );
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist({ items: [], punch_list_items: [] }),
      );

      await service.updatePunchListItem(
        TENANT_A,
        PROJECT_ID,
        'punch-uuid-001',
        USER_ID,
        { status: 'open' },
      );

      expect(mockPrismaService.punch_list_item.update).toHaveBeenCalledWith({
        where: { id: 'punch-uuid-001' },
        data: expect.objectContaining({
          status: 'open',
          resolved_at: null,
          resolved_by_user_id: null,
        }),
      });
    });

    it('should throw NotFoundException if punch list item not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );
      mockPrismaService.punch_list_item.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePunchListItem(
          TENANT_A,
          PROJECT_ID,
          'non-existent',
          USER_ID,
          { status: 'resolved' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should log audit entry on update', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );
      mockPrismaService.punch_list_item.findFirst.mockResolvedValue(
        mockPunchListItem(),
      );
      mockPrismaService.punch_list_item.update.mockResolvedValue(
        mockPunchListItem({ status: 'resolved' }),
      );
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist({ items: [], punch_list_items: [] }),
      );

      await service.updatePunchListItem(
        TENANT_A,
        PROJECT_ID,
        'punch-uuid-001',
        USER_ID,
        { status: 'resolved' },
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'punch_list_item',
          entityId: 'punch-uuid-001',
        }),
      );
    });
  });

  // =========================================================================
  // completeProject
  // =========================================================================

  describe('completeProject', () => {
    it('should complete project when all items done and punch list resolved', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());

      const checklist = mockChecklist({
        items: [
          mockChecklistItem({ is_required: true, is_completed: true }),
          mockChecklistItem({
            id: 'item-2',
            is_required: false,
            is_completed: false,
          }),
        ],
        punch_list_items: [
          mockPunchListItem({ status: 'resolved' }),
        ],
      });

      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        checklist,
      );

      mockPrismaService.project.update.mockResolvedValue(
        mockProject({ status: 'completed', actual_completion_date: new Date() }),
      );

      const result = await service.completeProject(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
      );

      expect(result.status).toBe('completed');
      expect(result.actual_completion_date).toBeDefined();
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
        data: {
          status: 'completed',
          actual_completion_date: expect.any(Date),
        },
      });
    });

    it('should throw 409 with incomplete items when required items not done', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());

      const checklist = mockChecklist({
        items: [
          mockChecklistItem({
            id: 'item-1',
            title: 'Incomplete required',
            is_required: true,
            is_completed: false,
          }),
          mockChecklistItem({
            id: 'item-2',
            title: 'Done required',
            is_required: true,
            is_completed: true,
          }),
        ],
        punch_list_items: [],
      });

      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        checklist,
      );

      try {
        await service.completeProject(TENANT_A, PROJECT_ID, USER_ID);
        fail('Should have thrown ConflictException');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        const response = (error as ConflictException).getResponse();
        expect((response as any).incomplete_checklist_items).toHaveLength(1);
        expect((response as any).incomplete_checklist_items[0].title).toBe(
          'Incomplete required',
        );
      }
    });

    it('should throw 409 with unresolved punch list items', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());

      const checklist = mockChecklist({
        items: [
          mockChecklistItem({ is_required: true, is_completed: true }),
        ],
        punch_list_items: [
          mockPunchListItem({
            id: 'punch-1',
            title: 'Unresolved issue',
            status: 'open',
          }),
          mockPunchListItem({
            id: 'punch-2',
            title: 'In progress issue',
            status: 'in_progress',
          }),
        ],
      });

      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        checklist,
      );

      try {
        await service.completeProject(TENANT_A, PROJECT_ID, USER_ID);
        fail('Should have thrown ConflictException');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        const response = (error as ConflictException).getResponse();
        expect((response as any).unresolved_punch_list_items).toHaveLength(2);
      }
    });

    it('should throw ConflictException if no checklist exists', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.completeProject(TENANT_A, PROJECT_ID, USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('should log audit entry on project completion', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());

      const checklist = mockChecklist({
        items: [
          mockChecklistItem({ is_required: true, is_completed: true }),
        ],
        punch_list_items: [],
      });

      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        checklist,
      );
      mockPrismaService.project.update.mockResolvedValue(
        mockProject({ status: 'completed' }),
      );

      await service.completeProject(TENANT_A, PROJECT_ID, USER_ID);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'project',
          entityId: PROJECT_ID,
          after: { status: 'completed' },
        }),
      );
    });
  });

  // =========================================================================
  // Tenant Isolation
  // =========================================================================

  describe('Tenant Isolation', () => {
    it('getCompletion should enforce tenant_id on project lookup', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getCompletion(TENANT_B, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_B },
      });
    });

    it('startCompletion should enforce tenant_id on template lookup', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ tenant_id: TENANT_B }),
      );
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValueOnce(
        null,
      );
      mockPrismaService.completion_checklist_template.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.startCompletion(TENANT_B, PROJECT_ID, USER_ID, {
          template_id: TEMPLATE_ID,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.completion_checklist_template.findFirst,
      ).toHaveBeenCalledWith({
        where: { id: TEMPLATE_ID, tenant_id: TENANT_B },
        include: expect.any(Object),
      });
    });

    it('completeItem should enforce tenant_id on item lookup', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );
      mockPrismaService.project_completion_checklist_item.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.completeItem(TENANT_A, PROJECT_ID, 'item-uuid-001', USER_ID, {}),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.project_completion_checklist_item.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: 'item-uuid-001',
          checklist_id: CHECKLIST_ID,
          tenant_id: TENANT_A,
        },
      });
    });

    it('updatePunchListItem should enforce tenant_id on punch list lookup', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_completion_checklist.findFirst.mockResolvedValue(
        mockChecklist(),
      );
      mockPrismaService.punch_list_item.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePunchListItem(
          TENANT_A,
          PROJECT_ID,
          'punch-uuid-001',
          USER_ID,
          { status: 'resolved' },
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.punch_list_item.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'punch-uuid-001',
          checklist_id: CHECKLIST_ID,
          tenant_id: TENANT_A,
        },
      });
    });
  });
});
