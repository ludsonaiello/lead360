import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FinancialEntryService } from './financial-entry.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { SupplierService } from './supplier.service';
import { CreateFinancialEntryDto } from '../dto/create-financial-entry.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const OTHER_USER_ID = 'user-uuid-002';
const PROJECT_ID = 'project-uuid-001';
const CATEGORY_ID = 'category-uuid-001';
const TASK_ID = 'task-uuid-001';
const ENTRY_ID = 'entry-uuid-001';
const SUPPLIER_ID = 'supplier-uuid-001';
const PAYMENT_METHOD_REGISTRY_ID = 'pmr-uuid-001';
const CREW_MEMBER_ID = 'crew-uuid-001';

const OWNER_ROLES = ['Owner'];
const ADMIN_ROLES = ['Admin'];
const MANAGER_ROLES = ['Manager'];
const BOOKKEEPER_ROLES = ['Bookkeeper'];
const EMPLOYEE_ROLES = ['Employee'];

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockCategory = (overrides: any = {}) => ({
  id: CATEGORY_ID,
  name: 'Materials',
  type: 'material',
  classification: 'cost_of_goods_sold',
  ...overrides,
});

const mockProject = (overrides: any = {}) => ({
  id: PROJECT_ID,
  name: 'Kitchen Remodel',
  ...overrides,
});

const mockTask = (overrides: any = {}) => ({
  id: TASK_ID,
  title: 'Install Cabinets',
  ...overrides,
});

const mockSupplier = (overrides: any = {}) => ({
  id: SUPPLIER_ID,
  name: 'Home Depot',
  ...overrides,
});

const mockPaymentMethodRegistry = (overrides: any = {}) => ({
  id: PAYMENT_METHOD_REGISTRY_ID,
  nickname: 'Company Visa *4242',
  ...overrides,
});

const mockUser = (overrides: any = {}) => ({
  id: USER_ID,
  first_name: 'John',
  last_name: 'Doe',
  ...overrides,
});

const mockCrewMember = (overrides: any = {}) => ({
  id: CREW_MEMBER_ID,
  first_name: 'Mike',
  last_name: 'Smith',
  ...overrides,
});

const mockEnrichedEntryRecord = (overrides: any = {}) => ({
  id: ENTRY_ID,
  tenant_id: TENANT_ID,
  project_id: PROJECT_ID,
  task_id: null,
  category_id: CATEGORY_ID,
  entry_type: 'expense',
  amount: 450.0,
  entry_date: new Date('2026-03-10'),
  vendor_name: 'Home Depot',
  notes: '2x4 studs for framing',
  has_receipt: false,
  payment_method: null,
  payment_method_registry_id: null,
  supplier_id: null,
  purchased_by_user_id: null,
  purchased_by_crew_member_id: null,
  entry_time: null,
  tax_amount: null,
  submission_status: 'confirmed',
  rejection_reason: null,
  rejected_by_user_id: null,
  rejected_at: null,
  is_recurring_instance: false,
  recurring_rule_id: null,
  created_by_user_id: USER_ID,
  updated_by_user_id: null,
  created_at: new Date('2026-03-10T10:00:00.000Z'),
  updated_at: new Date('2026-03-10T10:00:00.000Z'),
  // Enriched relations
  category: mockCategory(),
  project: mockProject(),
  task: null,
  supplier: null,
  payment_method_registry_rel: null,
  purchased_by_user: null,
  purchased_by_crew_member: null,
  created_by: mockUser(),
  rejected_by: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  financial_entry: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  },
  financial_category: {
    findFirst: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  project_task: {
    findFirst: jest.fn(),
  },
  supplier: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  payment_method_registry: {
    findFirst: jest.fn(),
  },
  user_tenant_membership: {
    findFirst: jest.fn(),
  },
  crew_member: {
    findFirst: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
  log: jest.fn(),
};

const mockSupplierService = {
  updateSpendTotals: jest.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Shortcut to set up all validation mocks so a createEntry() call succeeds.
 * Returns the mock enriched entry record that the create mock will return.
 */
const setupCreateEntryMocks = (overrides: any = {}) => {
  mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
  mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });
  const entry = mockEnrichedEntryRecord(overrides);
  mockPrismaService.financial_entry.create.mockResolvedValue(entry);
  return entry;
};

const baseCreateDto: CreateFinancialEntryDto = {
  project_id: PROJECT_ID,
  category_id: CATEGORY_ID,
  entry_type: 'expense',
  amount: 450.0,
  entry_date: '2026-03-10',
  vendor_name: 'Home Depot',
  notes: '2x4 studs for framing',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FinancialEntryService', () => {
  let service: FinancialEntryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialEntryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        { provide: SupplierService, useValue: mockSupplierService },
      ],
    }).compile();

    service = module.get<FinancialEntryService>(FinancialEntryService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // =========================================================================
  // Sprint 4_3 — Task 1: getEnrichedInclude() (tested via fetchEntryOrFail)
  // =========================================================================

  describe('getEnrichedInclude() — via fetchEntryOrFail()', () => {
    it('should use enriched include with all joins when fetching entry', async () => {
      const entry = mockEnrichedEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      await service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Owner']);

      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith({
        where: {
          id: ENTRY_ID,
          tenant_id: TENANT_ID,
        },
        include: {
          category: { select: { id: true, name: true, type: true, classification: true } },
          project: { select: { id: true, name: true } },
          task: { select: { id: true, title: true } },
          supplier: { select: { id: true, name: true } },
          payment_method_registry_rel: { select: { id: true, nickname: true } },
          purchased_by_user: { select: { id: true, first_name: true, last_name: true } },
          purchased_by_crew_member: { select: { id: true, first_name: true, last_name: true } },
          created_by: { select: { id: true, first_name: true, last_name: true } },
          rejected_by: { select: { id: true, first_name: true, last_name: true } },
        },
      });
    });
  });

  // =========================================================================
  // Sprint 4_3 — Task 2: transformToEnrichedResponse()
  // =========================================================================

  describe('transformToEnrichedResponse() — via getEntryById()', () => {
    it('should produce flat enriched response with all human-readable labels', async () => {
      const entry = mockEnrichedEntryRecord({
        task_id: TASK_ID,
        task: mockTask(),
        supplier_id: SUPPLIER_ID,
        supplier: mockSupplier(),
        payment_method_registry_id: PAYMENT_METHOD_REGISTRY_ID,
        payment_method_registry_rel: mockPaymentMethodRegistry(),
        purchased_by_user_id: USER_ID,
        purchased_by_user: mockUser(),
        purchased_by_crew_member_id: CREW_MEMBER_ID,
        purchased_by_crew_member: mockCrewMember(),
        tax_amount: 35.50,
        payment_method: 'credit_card',
      });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      const result = await service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Owner']);

      expect(result.id).toBe(ENTRY_ID);
      expect(result.tenant_id).toBe(TENANT_ID);
      expect(result.project_name).toBe('Kitchen Remodel');
      expect(result.task_id).toBe(TASK_ID);
      expect(result.task_title).toBe('Install Cabinets');
      expect(result.category_name).toBe('Materials');
      expect(result.category_type).toBe('material');
      expect(result.category_classification).toBe('cost_of_goods_sold');
      expect(result.supplier_name).toBe('Home Depot');
      expect(result.payment_method_nickname).toBe('Company Visa *4242');
      expect(result.purchased_by_user_name).toBe('John Doe');
      expect(result.purchased_by_crew_member_name).toBe('Mike Smith');
      expect(result.created_by_name).toBe('John Doe');
      expect(result.created_by_user_id).toBe(USER_ID);
    });

    it('should return null for optional relations that are not set', async () => {
      const entry = mockEnrichedEntryRecord({
        project_id: null,
        project: null,
        task_id: null,
        task: null,
        supplier_id: null,
        supplier: null,
        payment_method_registry_id: null,
        payment_method_registry_rel: null,
        purchased_by_user_id: null,
        purchased_by_user: null,
        purchased_by_crew_member_id: null,
        purchased_by_crew_member: null,
        rejected_by_user_id: null,
        rejected_by: null,
      });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      const result = await service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Owner']);

      expect(result.project_name).toBeNull();
      expect(result.task_title).toBeNull();
      expect(result.supplier_name).toBeNull();
      expect(result.payment_method_nickname).toBeNull();
      expect(result.purchased_by_user_name).toBeNull();
      expect(result.purchased_by_crew_member_name).toBeNull();
    });
  });

  // =========================================================================
  // Sprint 4_3 — Task 3: Role Helpers
  // =========================================================================

  describe('isPrivilegedRole() — via getEntryById()', () => {
    it('should allow Owner to view any entry', async () => {
      const entry = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      const result = await service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Owner']);
      expect(result.id).toBe(ENTRY_ID);
    });

    it('should allow Admin to view any entry', async () => {
      const entry = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      const result = await service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Admin']);
      expect(result.id).toBe(ENTRY_ID);
    });

    it('should allow Manager to view any entry', async () => {
      const entry = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      const result = await service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Manager']);
      expect(result.id).toBe(ENTRY_ID);
    });

    it('should allow Bookkeeper to view any entry', async () => {
      const entry = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      const result = await service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Bookkeeper']);
      expect(result.id).toBe(ENTRY_ID);
    });

    it('should allow user with multiple roles including a privileged one', async () => {
      const entry = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      const result = await service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Employee', 'Manager']);
      expect(result.id).toBe(ENTRY_ID);
    });
  });

  // =========================================================================
  // Sprint 4_3 — Task 4: fetchEntryOrFail()
  // =========================================================================

  describe('fetchEntryOrFail() — via getEntryById()', () => {
    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.getEntryById(TENANT_ID, 'nonexistent-id', USER_ID, ['Owner']),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.getEntryById(TENANT_ID, 'nonexistent-id', USER_ID, ['Owner']),
      ).rejects.toThrow('Financial entry not found');
    });

    it('should throw NotFoundException when entry belongs to different tenant', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.getEntryById('other-tenant-id', ENTRY_ID, USER_ID, ['Owner']),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: ENTRY_ID,
            tenant_id: 'other-tenant-id',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Sprint 4_3 — Task 5: getEntryById() (rebuilt)
  // =========================================================================

  describe('getEntryById() — Sprint 4_3 rebuild', () => {
    it('should return enriched response for privileged user viewing any entry', async () => {
      const entry = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      const result = await service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Owner']);

      expect(result.id).toBe(ENTRY_ID);
      expect(result.created_by_name).toBe('John Doe');
      expect(result.category_classification).toBe('cost_of_goods_sold');
    });

    it('should allow Employee to view their own entry', async () => {
      const entry = mockEnrichedEntryRecord({ created_by_user_id: USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      const result = await service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Employee']);

      expect(result.id).toBe(ENTRY_ID);
    });

    it('should throw ForbiddenException when Employee tries to view another user\'s entry', async () => {
      const entry = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      await expect(
        service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Employee']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, ['Employee']),
      ).rejects.toThrow('Access denied. You can only view your own entries.');
    });

    it('should throw NotFoundException before ForbiddenException (entry must exist first)', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.getEntryById(TENANT_ID, 'nonexistent', USER_ID, ['Employee']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // Sprint 4_3 — Task 6: getEntries()
  // =========================================================================

  describe('getEntries()', () => {
    const defaultQuery = { page: 1, limit: 20 };

    const setupGetEntriesMocks = (entries: any[] = [], total = 0) => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);
      mockPrismaService.financial_entry.count.mockResolvedValue(total);
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 500 } })   // expense sum
        .mockResolvedValueOnce({ _sum: { amount: 200 } })   // income sum
        .mockResolvedValueOnce({ _sum: { tax_amount: 40 } }); // tax sum
    };

    it('should enforce Employee scoping — silently add created_by_user_id filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Employee'], defaultQuery);

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            created_by_user_id: USER_ID,
          }),
        }),
      );
    });

    it('should NOT add created_by_user_id filter for privileged roles', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      const callArgs = mockPrismaService.financial_entry.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('created_by_user_id');
    });

    it('should NOT add created_by_user_id filter for Bookkeeper', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Bookkeeper'], defaultQuery);

      const callArgs = mockPrismaService.financial_entry.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('created_by_user_id');
    });

    it('should NOT add created_by_user_id filter for Manager', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, MANAGER_ROLES, defaultQuery);

      const callArgs = mockPrismaService.financial_entry.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('created_by_user_id');
    });

    it('should apply project_id filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        project_id: PROJECT_ID,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project_id: PROJECT_ID,
          }),
        }),
      );
    });

    it('should apply task_id filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        task_id: TASK_ID,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            task_id: TASK_ID,
          }),
        }),
      );
    });

    it('should apply category_id filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        category_id: CATEGORY_ID,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category_id: CATEGORY_ID,
          }),
        }),
      );
    });

    it('should apply entry_type filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        entry_type: 'expense',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entry_type: 'expense',
          }),
        }),
      );
    });

    it('should apply supplier_id filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        supplier_id: SUPPLIER_ID,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supplier_id: SUPPLIER_ID,
          }),
        }),
      );
    });

    it('should apply payment_method filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        payment_method: 'credit_card',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            payment_method: 'credit_card',
          }),
        }),
      );
    });

    it('should apply submission_status filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        submission_status: 'pending_review',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            submission_status: 'pending_review',
          }),
        }),
      );
    });

    it('should apply purchased_by_user_id filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        purchased_by_user_id: USER_ID,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            purchased_by_user_id: USER_ID,
          }),
        }),
      );
    });

    it('should apply purchased_by_crew_member_id filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        purchased_by_crew_member_id: CREW_MEMBER_ID,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            purchased_by_crew_member_id: CREW_MEMBER_ID,
          }),
        }),
      );
    });

    it('should apply category_type filter via join', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        category_type: 'labor',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: expect.objectContaining({ type: 'labor' }),
          }),
        }),
      );
    });

    it('should apply classification filter via join', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        classification: 'operating_expense',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: expect.objectContaining({ classification: 'operating_expense' }),
          }),
        }),
      );
    });

    it('should apply both category_type and classification filters together', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        category_type: 'labor',
        classification: 'cost_of_goods_sold',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { type: 'labor', classification: 'cost_of_goods_sold' },
          }),
        }),
      );
    });

    it('should apply date range filters', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        date_from: '2026-01-01',
        date_to: '2026-03-31',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entry_date: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-03-31'),
            },
          }),
        }),
      );
    });

    it('should apply has_receipt boolean filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        has_receipt: true,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            has_receipt: true,
          }),
        }),
      );
    });

    it('should apply is_recurring_instance boolean filter', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        is_recurring_instance: false,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_recurring_instance: false,
          }),
        }),
      );
    });

    it('should apply search filter across vendor_name and notes', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        search: 'lumber',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { vendor_name: { contains: 'lumber' } },
              { notes: { contains: 'lumber' } },
            ],
          }),
        }),
      );
    });

    it('should support sorting by entry_date desc (default)', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { entry_date: 'desc' },
        }),
      );
    });

    it('should support sorting by amount asc', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        sort_by: 'amount',
        sort_order: 'asc',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { amount: 'asc' },
        }),
      );
    });

    it('should support sorting by created_at', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        sort_by: 'created_at',
        sort_order: 'desc',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
    });

    it('should calculate pagination correctly', async () => {
      setupGetEntriesMocks([], 50);

      const result = await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        page: 2,
        limit: 10,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );

      expect(result.meta).toEqual({
        total: 50,
        page: 2,
        limit: 10,
        total_pages: 5,
      });
    });

    it('should cap limit at 100', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], {
        page: 1,
        limit: 500,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should return summary block with aggregated totals from full result set', async () => {
      setupGetEntriesMocks([], 10);

      const result = await service.getEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      expect(result.summary).toEqual({
        total_expenses: 500,
        total_income: 200,
        total_tax: 40,
        entry_count: 10,
      });

      // Verify aggregate calls use the same where filter (not paginated)
      expect(mockPrismaService.financial_entry.aggregate).toHaveBeenCalledTimes(3);
    });

    it('should return enriched response data for each entry', async () => {
      const entries = [mockEnrichedEntryRecord()];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);
      mockPrismaService.financial_entry.count.mockResolvedValue(1);
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 450 } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { tax_amount: null } });

      const result = await service.getEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      expect(result.data[0].project_name).toBe('Kitchen Remodel');
      expect(result.data[0].category_name).toBe('Materials');
      expect(result.data[0].created_by_name).toBe('John Doe');
    });

    it('should handle zero results gracefully', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { tax_amount: null } });

      const result = await service.getEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.summary.total_expenses).toBe(0);
      expect(result.summary.total_income).toBe(0);
      expect(result.summary.total_tax).toBe(0);
    });

    it('should always include tenant_id in where clause', async () => {
      setupGetEntriesMocks();

      await service.getEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Sprint 4_3 — Task 7: getPendingEntries()
  // =========================================================================

  describe('getPendingEntries()', () => {
    const setupPendingMocks = (entries: any[] = [], total = 0) => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);
      mockPrismaService.financial_entry.count.mockResolvedValue(total);
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 300 } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { tax_amount: 25 } });
    };

    it('should pre-filter by submission_status = pending_review', async () => {
      setupPendingMocks();

      await service.getPendingEntries(TENANT_ID, { page: 1, limit: 20 });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            submission_status: 'pending_review',
          }),
        }),
      );
    });

    it('should apply submitted_by_user_id filter (maps to created_by_user_id)', async () => {
      setupPendingMocks();

      await service.getPendingEntries(TENANT_ID, {
        page: 1,
        limit: 20,
        submitted_by_user_id: USER_ID,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_by_user_id: USER_ID,
          }),
        }),
      );
    });

    it('should apply date range filters', async () => {
      setupPendingMocks();

      await service.getPendingEntries(TENANT_ID, {
        page: 1,
        limit: 20,
        date_from: '2026-03-01',
        date_to: '2026-03-31',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entry_date: {
              gte: new Date('2026-03-01'),
              lte: new Date('2026-03-31'),
            },
          }),
        }),
      );
    });

    it('should return enriched response with summary block', async () => {
      setupPendingMocks([], 5);

      const result = await service.getPendingEntries(TENANT_ID, { page: 1, limit: 20 });

      expect(result.summary).toEqual({
        total_expenses: 300,
        total_income: 0,
        total_tax: 25,
        entry_count: 5,
      });
      expect(result.meta.total).toBe(5);
    });

    it('should order by entry_date desc', async () => {
      setupPendingMocks();

      await service.getPendingEntries(TENANT_ID, { page: 1, limit: 20 });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { entry_date: 'desc' },
        }),
      );
    });

    it('should calculate pagination correctly', async () => {
      setupPendingMocks([], 30);

      const result = await service.getPendingEntries(TENANT_ID, { page: 2, limit: 10 });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );

      expect(result.meta).toEqual({
        total: 30,
        page: 2,
        limit: 10,
        total_pages: 3,
      });
    });

    it('should cap limit at 100', async () => {
      setupPendingMocks();

      await service.getPendingEntries(TENANT_ID, { page: 1, limit: 999 });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should always include tenant_id in where clause', async () => {
      setupPendingMocks();

      await service.getPendingEntries('different-tenant', { page: 1, limit: 20 });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'different-tenant',
          }),
        }),
      );
    });

    it('should use enriched include clause', async () => {
      setupPendingMocks();

      await service.getPendingEntries(TENANT_ID, { page: 1, limit: 20 });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            category: expect.any(Object),
            project: expect.any(Object),
            task: expect.any(Object),
            supplier: expect.any(Object),
            payment_method_registry_rel: expect.any(Object),
            purchased_by_user: expect.any(Object),
            purchased_by_crew_member: expect.any(Object),
            created_by: expect.any(Object),
            rejected_by: expect.any(Object),
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Sprint 4_7 — Task 2: Role-Based Behavior Tests for createEntry()
  // =========================================================================

  describe('createEntry() — Role-based submission_status', () => {
    it('should force submission_status to pending_review for Employee role', async () => {
      setupCreateEntryMocks({ submission_status: 'pending_review' });

      await service.createEntry(TENANT_ID, USER_ID, EMPLOYEE_ROLES, baseCreateDto);

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submission_status: 'pending_review',
          }),
        }),
      );
    });

    it('should default submission_status to confirmed for Owner role', async () => {
      setupCreateEntryMocks();

      await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto);

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submission_status: 'confirmed',
          }),
        }),
      );
    });

    it('should default submission_status to confirmed for Admin role', async () => {
      setupCreateEntryMocks();

      await service.createEntry(TENANT_ID, USER_ID, ADMIN_ROLES, baseCreateDto);

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submission_status: 'confirmed',
          }),
        }),
      );
    });

    it('should default submission_status to confirmed for Manager role', async () => {
      setupCreateEntryMocks();

      await service.createEntry(TENANT_ID, USER_ID, MANAGER_ROLES, baseCreateDto);

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submission_status: 'confirmed',
          }),
        }),
      );
    });

    it('should default submission_status to confirmed for Bookkeeper role', async () => {
      setupCreateEntryMocks();

      await service.createEntry(TENANT_ID, USER_ID, BOOKKEEPER_ROLES, baseCreateDto);

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submission_status: 'confirmed',
          }),
        }),
      );
    });

    it('should allow Owner to explicitly set submission_status to pending_review', async () => {
      setupCreateEntryMocks({ submission_status: 'pending_review' });

      await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
        ...baseCreateDto,
        submission_status: 'pending_review',
      });

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submission_status: 'pending_review',
          }),
        }),
      );
    });

    it('should ignore Employee submission_status override attempt — always pending_review', async () => {
      setupCreateEntryMocks({ submission_status: 'pending_review' });

      await service.createEntry(TENANT_ID, USER_ID, EMPLOYEE_ROLES, {
        ...baseCreateDto,
        submission_status: 'confirmed',
      });

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submission_status: 'pending_review',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Sprint 4_7 — Task 3: Validation Tests for createEntry()
  // =========================================================================

  describe('createEntry() — Validation', () => {
    it('should throw 400 when both purchased_by_user_id and purchased_by_crew_member_id provided', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          purchased_by_user_id: USER_ID,
          purchased_by_crew_member_id: CREW_MEMBER_ID,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          purchased_by_user_id: USER_ID,
          purchased_by_crew_member_id: CREW_MEMBER_ID,
        }),
      ).rejects.toThrow('Cannot assign purchase to both a user and a crew member.');
    });

    it('should throw 400 when tax_amount >= amount', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          amount: 100.0,
          tax_amount: 100.0,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          amount: 100.0,
          tax_amount: 100.0,
        }),
      ).rejects.toThrow('Tax amount must be less than the entry amount');
    });

    it('should throw 404 when category_id not found in tenant', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto),
      ).rejects.toThrow('Financial category not found or inactive');

      expect(mockPrismaService.financial_entry.create).not.toHaveBeenCalled();
    });

    it('should throw 404 when project_id not found in tenant', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto),
      ).rejects.toThrow('Project not found');

      expect(mockPrismaService.financial_entry.create).not.toHaveBeenCalled();
    });

    it('should throw 404 when task_id not found in tenant', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          task_id: 'nonexistent-task',
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          task_id: 'nonexistent-task',
        }),
      ).rejects.toThrow('Task not found');
    });

    it('should throw 404 when supplier_id not found or inactive', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          supplier_id: 'nonexistent-supplier',
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          supplier_id: 'nonexistent-supplier',
        }),
      ).rejects.toThrow('Supplier not found or inactive');
    });

    it('should throw 404 when payment_method_registry_id not found or inactive', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(null);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          payment_method_registry_id: 'nonexistent-pmr',
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          payment_method_registry_id: 'nonexistent-pmr',
        }),
      ).rejects.toThrow('Payment method not found or inactive');
    });

    it('should throw 404 when purchased_by_user_id not in tenant', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });
      mockPrismaService.user_tenant_membership.findFirst.mockResolvedValue(null);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          purchased_by_user_id: 'nonexistent-user',
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          purchased_by_user_id: 'nonexistent-user',
        }),
      ).rejects.toThrow('User not found in this tenant');
    });

    it('should throw 404 when purchased_by_crew_member_id not in tenant', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });
      mockPrismaService.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          purchased_by_crew_member_id: 'nonexistent-crew',
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          purchased_by_crew_member_id: 'nonexistent-crew',
        }),
      ).rejects.toThrow('Crew member not found or inactive');
    });

    it('should auto-copy payment_method type from registry when payment_method_registry_id provided', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue({
        id: PAYMENT_METHOD_REGISTRY_ID,
        type: 'credit_card',
        tenant_id: TENANT_ID,
        is_active: true,
      });
      mockPrismaService.financial_entry.create.mockResolvedValue(
        mockEnrichedEntryRecord({
          payment_method: 'credit_card',
          payment_method_registry_id: PAYMENT_METHOD_REGISTRY_ID,
          payment_method_registry_rel: mockPaymentMethodRegistry(),
        }),
      );

      await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
        ...baseCreateDto,
        payment_method_registry_id: PAYMENT_METHOD_REGISTRY_ID,
      });

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payment_method: 'credit_card',
            payment_method_registry_id: PAYMENT_METHOD_REGISTRY_ID,
          }),
        }),
      );
    });

    it('should call updateSupplierSpendTotals when supplier_id is provided', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });
      mockPrismaService.supplier.findFirst.mockResolvedValue({ id: SUPPLIER_ID, tenant_id: TENANT_ID, is_active: true });
      mockPrismaService.financial_entry.create.mockResolvedValue(
        mockEnrichedEntryRecord({ supplier_id: SUPPLIER_ID, supplier: mockSupplier() }),
      );

      await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
        ...baseCreateDto,
        supplier_id: SUPPLIER_ID,
      });

      expect(mockSupplierService.updateSpendTotals).toHaveBeenCalledWith(TENANT_ID, SUPPLIER_ID);
    });

    it('should NOT call updateSupplierSpendTotals when supplier_id is not provided', async () => {
      setupCreateEntryMocks();

      await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto);

      expect(mockSupplierService.updateSpendTotals).not.toHaveBeenCalled();
    });

    it('should validate category with tenant_id and is_active', async () => {
      setupCreateEntryMocks();

      await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto);

      expect(mockPrismaService.financial_category.findFirst).toHaveBeenCalledWith({
        where: {
          id: CATEGORY_ID,
          tenant_id: TENANT_ID,
          is_active: true,
        },
      });
    });

    it('should create entry with correct data shape and enriched include', async () => {
      setupCreateEntryMocks();

      await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto);

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith({
        data: {
          tenant_id: TENANT_ID,
          project_id: PROJECT_ID,
          task_id: null,
          category_id: CATEGORY_ID,
          entry_type: 'expense',
          amount: 450.0,
          tax_amount: null,
          entry_date: new Date('2026-03-10'),
          entry_time: null,
          vendor_name: 'Home Depot',
          supplier_id: null,
          payment_method: null,
          payment_method_registry_id: null,
          purchased_by_user_id: null,
          purchased_by_crew_member_id: null,
          submission_status: 'confirmed',
          is_recurring_instance: false,
          recurring_rule_id: null,
          has_receipt: false,
          notes: '2x4 studs for framing',
          created_by_user_id: USER_ID,
        },
        include: expect.objectContaining({
          category: expect.any(Object),
          project: expect.any(Object),
          task: expect.any(Object),
          supplier: expect.any(Object),
          payment_method_registry_rel: expect.any(Object),
          purchased_by_user: expect.any(Object),
          purchased_by_crew_member: expect.any(Object),
          created_by: expect.any(Object),
          rejected_by: expect.any(Object),
        }),
      });
    });

    it('should return enriched (transformed) response, not raw DB record', async () => {
      const entry = setupCreateEntryMocks();

      const result = await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto);

      // The result should have flat human-readable labels (transformToEnrichedResponse)
      expect(result.project_name).toBe('Kitchen Remodel');
      expect(result.category_name).toBe('Materials');
      expect(result.category_type).toBe('material');
      expect(result.created_by_name).toBe('John Doe');
      expect(result.id).toBe(ENTRY_ID);
    });

    it('should create entry without project_id (business-level expense)', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.financial_entry.create.mockResolvedValue(
        mockEnrichedEntryRecord({ project_id: null, project: null }),
      );

      const result = await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
        category_id: CATEGORY_ID,
        entry_type: 'expense',
        amount: 150.0,
        entry_date: '2026-03-10',
        vendor_name: 'State Farm',
        notes: 'Monthly insurance',
      });

      expect(mockPrismaService.project.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project_id: null,
            tenant_id: TENANT_ID,
          }),
        }),
      );
      expect(result.project_name).toBeNull();
    });

    it('should throw BadRequestException when entry_date is in the future', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          entry_date: futureDateStr,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
          ...baseCreateDto,
          entry_date: futureDateStr,
        }),
      ).rejects.toThrow('Entry date cannot be in the future');
    });

    it('should allow entry_date that is today', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      setupCreateEntryMocks({ entry_date: new Date(todayStr) });

      const result = await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
        ...baseCreateDto,
        entry_date: todayStr,
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.financial_entry.create).toHaveBeenCalled();
    });

    it('should accept tax_amount when it is less than amount', async () => {
      setupCreateEntryMocks({ amount: 100.0, tax_amount: 8.50 });

      const result = await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
        ...baseCreateDto,
        amount: 100.0,
        tax_amount: 8.50,
      });

      expect(result.tax_amount).toBe(8.50);
    });

    it('should log audit with correct action and entity info', async () => {
      const entry = setupCreateEntryMocks();

      await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'financial_entry',
          entityId: ENTRY_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          after: entry,
          description: `Created financial entry of $450 for project ${PROJECT_ID}`,
        }),
      );
    });

    it('should use business-level description in audit log when project_id is omitted', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
      mockPrismaService.financial_entry.create.mockResolvedValue(
        mockEnrichedEntryRecord({ project_id: null, project: null, amount: 200 }),
      );

      await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, {
        category_id: CATEGORY_ID,
        entry_type: 'expense',
        amount: 200,
        entry_date: '2026-03-10',
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('business-level'),
        }),
      );
    });
  });

  // =========================================================================
  // Sprint 4_7 — Task 4: getProjectEntries() (NOT modified — preserved)
  // =========================================================================

  describe('getProjectEntries()', () => {
    it('should return paginated results with tenant_id filter and category included', async () => {
      const entries = [
        mockEnrichedEntryRecord(),
        mockEnrichedEntryRecord({ id: 'entry-uuid-002', amount: 200 }),
      ];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);
      mockPrismaService.financial_entry.count.mockResolvedValue(2);

      const result = await service.getProjectEntries(TENANT_ID, {
        project_id: PROJECT_ID,
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
          }),
          include: {
            category: {
              select: { id: true, name: true, type: true },
            },
          },
          orderBy: { entry_date: 'desc' },
          skip: 0,
          take: 20,
        }),
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        pages: 1,
      });
    });

    it('should apply task_id filter when provided', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(0);

      await service.getProjectEntries(TENANT_ID, {
        project_id: PROJECT_ID,
        task_id: TASK_ID,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
            task_id: TASK_ID,
          }),
        }),
      );
    });

    it('should cap limit at 100 even if a higher value is requested', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(0);

      await service.getProjectEntries(TENANT_ID, {
        project_id: PROJECT_ID,
        limit: 500,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });
  });

  // =========================================================================
  // getTaskEntries() (NOT modified — preserved)
  // =========================================================================

  describe('getTaskEntries()', () => {
    it('should return entries filtered by tenant_id and task_id with category included', async () => {
      const entries = [
        mockEnrichedEntryRecord({ task_id: TASK_ID }),
        mockEnrichedEntryRecord({ id: 'entry-uuid-002', task_id: TASK_ID, amount: 75 }),
      ];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);

      const result = await service.getTaskEntries(TENANT_ID, TASK_ID);

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          task_id: TASK_ID,
        },
        include: {
          category: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: { entry_date: 'desc' },
      });

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no entries exist for task', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      const result = await service.getTaskEntries(TENANT_ID, 'nonexistent-task');

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // Sprint 4_7 — Task 6: Role-Based Tests for updateEntry()
  // =========================================================================

  describe('updateEntry() — Role enforcement', () => {
    it('should allow Owner to edit any entry in any status', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID, submission_status: 'confirmed' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({ ...existing, amount: 600 });

      const result = await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES, { amount: 600 });

      expect(result.id).toBe(ENTRY_ID);
      expect(mockPrismaService.financial_entry.update).toHaveBeenCalled();
    });

    it('should allow Manager to edit any entry in any status', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID, submission_status: 'confirmed' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({ ...existing, amount: 600 });

      const result = await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, MANAGER_ROLES, { amount: 600 });

      expect(result.id).toBe(ENTRY_ID);
    });

    it('should allow Bookkeeper to edit any entry in any status', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID, submission_status: 'confirmed' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({ ...existing, vendor_name: 'Updated' });

      const result = await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, BOOKKEEPER_ROLES, { vendor_name: 'Updated' });

      expect(result.id).toBe(ENTRY_ID);
    });

    it('should allow Employee to edit own pending_review entry', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: USER_ID, submission_status: 'pending_review' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({ ...existing, amount: 500 });

      const result = await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, EMPLOYEE_ROLES, { amount: 500 });

      expect(result.id).toBe(ENTRY_ID);
    });

    it('should throw ForbiddenException when Employee edits another user entry', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID, submission_status: 'pending_review' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, EMPLOYEE_ROLES, { amount: 500 }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, EMPLOYEE_ROLES, { amount: 500 }),
      ).rejects.toThrow('Access denied. You can only edit your own entries.');
    });

    it('should throw ForbiddenException when Employee edits own confirmed entry', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: USER_ID, submission_status: 'confirmed' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, EMPLOYEE_ROLES, { amount: 500 }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, EMPLOYEE_ROLES, { amount: 500 }),
      ).rejects.toThrow('Access denied. You can only edit entries with pending_review status.');
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEntry(TENANT_ID, 'nonexistent-id', USER_ID, OWNER_ROLES, { amount: 100 }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_entry.update).not.toHaveBeenCalled();
    });

    it('should set updated_by_user_id on update', async () => {
      const existing = mockEnrichedEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({ ...existing, updated_by_user_id: USER_ID, amount: 600 });

      await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES, { amount: 600 });

      expect(mockPrismaService.financial_entry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            updated_by_user_id: USER_ID,
            amount: 600,
          }),
        }),
      );
    });

    it('should update supplier spend when supplier_id changes', async () => {
      const oldSupplierId = 'old-supplier-uuid';
      const newSupplierId = 'new-supplier-uuid';
      const existing = mockEnrichedEntryRecord({ supplier_id: oldSupplierId });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.supplier.findFirst.mockResolvedValue({ id: newSupplierId, tenant_id: TENANT_ID, is_active: true });
      mockPrismaService.financial_entry.update.mockResolvedValue(
        mockEnrichedEntryRecord({ supplier_id: newSupplierId }),
      );

      await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES, { supplier_id: newSupplierId });

      expect(mockSupplierService.updateSpendTotals).toHaveBeenCalledWith(TENANT_ID, oldSupplierId);
      expect(mockSupplierService.updateSpendTotals).toHaveBeenCalledWith(TENANT_ID, newSupplierId);
      expect(mockSupplierService.updateSpendTotals).toHaveBeenCalledTimes(2);
    });

    it('should update BOTH old and new supplier spend on supplier change', async () => {
      const oldSupplierId = 'old-supplier-uuid';
      const newSupplierId = 'new-supplier-uuid';
      const existing = mockEnrichedEntryRecord({ supplier_id: oldSupplierId });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.supplier.findFirst.mockResolvedValue({ id: newSupplierId, tenant_id: TENANT_ID, is_active: true });
      mockPrismaService.financial_entry.update.mockResolvedValue(
        mockEnrichedEntryRecord({ supplier_id: newSupplierId }),
      );

      await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES, { supplier_id: newSupplierId });

      // Both old and new supplier spend must be recalculated
      const calls = mockSupplierService.updateSpendTotals.mock.calls;
      expect(calls).toContainEqual([TENANT_ID, oldSupplierId]);
      expect(calls).toContainEqual([TENANT_ID, newSupplierId]);
    });

    it('should re-copy payment method type when payment_method_registry_id changes', async () => {
      const existing = mockEnrichedEntryRecord({
        payment_method: 'cash',
        payment_method_registry_id: null,
      });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue({
        id: PAYMENT_METHOD_REGISTRY_ID,
        type: 'credit_card',
        tenant_id: TENANT_ID,
        is_active: true,
      });
      mockPrismaService.financial_entry.update.mockResolvedValue(
        mockEnrichedEntryRecord({
          payment_method: 'credit_card',
          payment_method_registry_id: PAYMENT_METHOD_REGISTRY_ID,
        }),
      );

      await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES, {
        payment_method_registry_id: PAYMENT_METHOD_REGISTRY_ID,
      });

      expect(mockPrismaService.financial_entry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payment_method: 'credit_card',
            payment_method_registry_id: PAYMENT_METHOD_REGISTRY_ID,
          }),
        }),
      );
    });

    it('should log audit with before/after data', async () => {
      const existing = mockEnrichedEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, amount: 600 };
      mockPrismaService.financial_entry.update.mockResolvedValue(updated);

      await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES, { amount: 600 });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'financial_entry',
          entityId: ENTRY_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: existing,
          after: updated,
        }),
      );
    });

    it('should use enriched include in the update call', async () => {
      const existing = mockEnrichedEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({ ...existing, amount: 600 });

      await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES, { amount: 600 });

      expect(mockPrismaService.financial_entry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            category: expect.any(Object),
            project: expect.any(Object),
            task: expect.any(Object),
            supplier: expect.any(Object),
            created_by: expect.any(Object),
            rejected_by: expect.any(Object),
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Sprint 4_7 — Task 7: Role-Based Tests for deleteEntry()
  // =========================================================================

  describe('deleteEntry() — Role enforcement', () => {
    it('should allow Owner to delete any entry', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID, submission_status: 'confirmed' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.delete.mockResolvedValue(existing);

      const result = await service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES);

      expect(result).toEqual({ message: 'Entry deleted successfully' });
      expect(mockPrismaService.financial_entry.delete).toHaveBeenCalledWith({
        where: { id: ENTRY_ID },
      });
    });

    it('should allow Admin to delete any entry', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID, submission_status: 'confirmed' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.delete.mockResolvedValue(existing);

      const result = await service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, ADMIN_ROLES);

      expect(result).toEqual({ message: 'Entry deleted successfully' });
    });

    it('should throw ForbiddenException for Manager', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);

      await expect(
        service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, MANAGER_ROLES),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, MANAGER_ROLES),
      ).rejects.toThrow('Managers and Bookkeepers are not authorized to delete financial entries.');
    });

    it('should throw ForbiddenException for Bookkeeper', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);

      await expect(
        service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, BOOKKEEPER_ROLES),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, BOOKKEEPER_ROLES),
      ).rejects.toThrow('Managers and Bookkeepers are not authorized to delete financial entries.');
    });

    it('should allow Employee to delete own pending_review entry', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: USER_ID, submission_status: 'pending_review' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.delete.mockResolvedValue(existing);

      const result = await service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, EMPLOYEE_ROLES);

      expect(result).toEqual({ message: 'Entry deleted successfully' });
    });

    it('should throw ForbiddenException when Employee deletes own confirmed entry', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: USER_ID, submission_status: 'confirmed' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);

      await expect(
        service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, EMPLOYEE_ROLES),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, EMPLOYEE_ROLES),
      ).rejects.toThrow('Access denied. You can only delete entries with pending_review status.');
    });

    it('should throw ForbiddenException when Employee deletes another user entry', async () => {
      const existing = mockEnrichedEntryRecord({ created_by_user_id: OTHER_USER_ID, submission_status: 'pending_review' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);

      await expect(
        service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, EMPLOYEE_ROLES),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, EMPLOYEE_ROLES),
      ).rejects.toThrow('Access denied. You can only delete your own entries.');
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteEntry(TENANT_ID, 'nonexistent-id', USER_ID, OWNER_ROLES),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_entry.delete).not.toHaveBeenCalled();
    });

    it('should call updateSupplierSpendTotals when deleted entry had supplier_id', async () => {
      const existing = mockEnrichedEntryRecord({ supplier_id: SUPPLIER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.delete.mockResolvedValue(existing);

      await service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES);

      expect(mockSupplierService.updateSpendTotals).toHaveBeenCalledWith(TENANT_ID, SUPPLIER_ID);
    });

    it('should NOT call updateSupplierSpendTotals when deleted entry had no supplier_id', async () => {
      const existing = mockEnrichedEntryRecord({ supplier_id: null });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.delete.mockResolvedValue(existing);

      await service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES);

      expect(mockSupplierService.updateSpendTotals).not.toHaveBeenCalled();
    });

    it('should log audit with before data on delete', async () => {
      const existing = mockEnrichedEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.delete.mockResolvedValue(existing);

      await service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'financial_entry',
          entityId: ENTRY_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: existing,
        }),
      );
    });
  });

  // =========================================================================
  // getProjectCostSummary() (NOT modified — preserved)
  // =========================================================================

  describe('getProjectCostSummary()', () => {
    it('should aggregate costs by category type and return correct totals', async () => {
      const entries = [
        mockEnrichedEntryRecord({ id: 'e1', amount: 500, category: { type: 'labor' } }),
        mockEnrichedEntryRecord({ id: 'e2', amount: 300.50, category: { type: 'material' } }),
        mockEnrichedEntryRecord({ id: 'e3', amount: 1200, category: { type: 'subcontractor' } }),
        mockEnrichedEntryRecord({ id: 'e4', amount: 150.75, category: { type: 'equipment' } }),
        mockEnrichedEntryRecord({ id: 'e5', amount: 50, category: { type: 'other' } }),
        mockEnrichedEntryRecord({ id: 'e6', amount: 250, category: { type: 'labor' } }),
      ];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);

      const result = await service.getProjectCostSummary(TENANT_ID, PROJECT_ID);

      expect(result.project_id).toBe(PROJECT_ID);
      expect(result.entry_count).toBe(6);
      expect(result.total_actual_cost).toBe(2451.25);
      expect(result.cost_by_category.labor).toBe(750);
      expect(result.cost_by_category.material).toBe(300.50);
      expect(result.cost_by_category.subcontractor).toBe(1200);
    });

    it('should return zeroes when project has no entries', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      const result = await service.getProjectCostSummary(TENANT_ID, PROJECT_ID);

      expect(result.total_actual_cost).toBe(0);
      expect(result.entry_count).toBe(0);
    });
  });

  // =========================================================================
  // getTaskCostSummary() (NOT modified — preserved)
  // =========================================================================

  describe('getTaskCostSummary()', () => {
    it('should return total cost and entry count for a task', async () => {
      const entries = [
        { amount: 150.50 },
        { amount: 300.25 },
        { amount: 75 },
      ];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);

      const result = await service.getTaskCostSummary(TENANT_ID, TASK_ID);

      expect(result).toEqual({
        task_id: TASK_ID,
        total_actual_cost: 525.75,
        entry_count: 3,
      });
    });

    it('should return zero cost and zero count when task has no entries', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      const result = await service.getTaskCostSummary(TENANT_ID, TASK_ID);

      expect(result).toEqual({
        task_id: TASK_ID,
        total_actual_cost: 0,
        entry_count: 0,
      });
    });
  });

  // =========================================================================
  // Sprint 4_5 — Task 1: approveEntry()
  // =========================================================================

  describe('approveEntry()', () => {
    const pendingEntry = () =>
      mockEnrichedEntryRecord({
        submission_status: 'pending_review',
        created_by_user_id: OTHER_USER_ID,
      });

    const confirmedEntry = () =>
      mockEnrichedEntryRecord({
        submission_status: 'confirmed',
        created_by_user_id: OTHER_USER_ID,
      });

    it('should set submission_status to confirmed when entry is pending_review', async () => {
      const existing = pendingEntry();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, submission_status: 'confirmed', updated_by_user_id: USER_ID };
      mockPrismaService.financial_entry.update.mockResolvedValue(updated);

      const result = await service.approveEntry(TENANT_ID, ENTRY_ID, USER_ID, {});

      expect(mockPrismaService.financial_entry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ENTRY_ID },
          data: {
            submission_status: 'confirmed',
            updated_by_user_id: USER_ID,
          },
        }),
      );
      expect(result.submission_status).toBe('confirmed');
    });

    it('should NOT clear rejection fields — preserves audit trail (BR-23)', async () => {
      const existing = pendingEntry();
      existing.rejection_reason = 'Old rejection reason';
      existing.rejected_by_user_id = OTHER_USER_ID;
      existing.rejected_at = new Date('2026-03-15');
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);

      const updated = {
        ...existing,
        submission_status: 'confirmed',
        updated_by_user_id: USER_ID,
      };
      mockPrismaService.financial_entry.update.mockResolvedValue(updated);

      const result = await service.approveEntry(TENANT_ID, ENTRY_ID, USER_ID, {});

      // Data object should NOT include any rejection field clearing
      const updateCall = mockPrismaService.financial_entry.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('rejection_reason');
      expect(updateCall.data).not.toHaveProperty('rejected_by_user_id');
      expect(updateCall.data).not.toHaveProperty('rejected_at');

      // The response still has the historical rejection data
      expect(result.rejection_reason).toBe('Old rejection reason');
    });

    it('should throw BadRequestException when entry is already confirmed (BR-17)', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(confirmedEntry());

      await expect(
        service.approveEntry(TENANT_ID, ENTRY_ID, USER_ID, {}),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.approveEntry(TENANT_ID, ENTRY_ID, USER_ID, {}),
      ).rejects.toThrow('Entry is not in pending_review status. Only pending entries can be approved.');

      expect(mockPrismaService.financial_entry.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.approveEntry(TENANT_ID, 'nonexistent', USER_ID, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should log audit with EXPENSE_APPROVED workflow action', async () => {
      const existing = pendingEntry();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, submission_status: 'confirmed' };
      mockPrismaService.financial_entry.update.mockResolvedValue(updated);

      await service.approveEntry(TENANT_ID, ENTRY_ID, USER_ID, { notes: 'Looks good' });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'financial_entry',
          entityId: ENTRY_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          metadata: { workflow_action: 'EXPENSE_APPROVED', approval_notes: 'Looks good' },
          description: `Approved financial entry ${ENTRY_ID}`,
        }),
      );
    });

    it('should use enriched include in the update call', async () => {
      const existing = pendingEntry();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({
        ...existing,
        submission_status: 'confirmed',
      });

      await service.approveEntry(TENANT_ID, ENTRY_ID, USER_ID, {});

      expect(mockPrismaService.financial_entry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            category: expect.any(Object),
            project: expect.any(Object),
            created_by: expect.any(Object),
            rejected_by: expect.any(Object),
          }),
        }),
      );
    });

    it('should use fetchEntryOrFail with tenant_id scoping', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.approveEntry('other-tenant', ENTRY_ID, USER_ID, {}),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ENTRY_ID, tenant_id: 'other-tenant' },
        }),
      );
    });
  });

  // =========================================================================
  // Sprint 4_5 — Task 2: rejectEntry()
  // =========================================================================

  describe('rejectEntry()', () => {
    const pendingEntry = () =>
      mockEnrichedEntryRecord({
        submission_status: 'pending_review',
        created_by_user_id: OTHER_USER_ID,
      });

    it('should set rejection fields without changing submission_status (BR-19)', async () => {
      const existing = pendingEntry();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);

      const updated = {
        ...existing,
        rejection_reason: 'Receipt is blurry',
        rejected_by_user_id: USER_ID,
        rejected_at: expect.any(Date),
        rejected_by: mockUser(),
      };
      mockPrismaService.financial_entry.update.mockResolvedValue(updated);

      const result = await service.rejectEntry(TENANT_ID, ENTRY_ID, USER_ID, {
        rejection_reason: 'Receipt is blurry',
      });

      expect(mockPrismaService.financial_entry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ENTRY_ID },
          data: {
            rejection_reason: 'Receipt is blurry',
            rejected_by_user_id: USER_ID,
            rejected_at: expect.any(Date),
            updated_by_user_id: USER_ID,
          },
        }),
      );

      // submission_status should NOT be in the update data
      const updateCall = mockPrismaService.financial_entry.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('submission_status');

      expect(result.rejection_reason).toBe('Receipt is blurry');
    });

    it('should throw BadRequestException when entry is already confirmed (BR-18)', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(
        mockEnrichedEntryRecord({ submission_status: 'confirmed' }),
      );

      await expect(
        service.rejectEntry(TENANT_ID, ENTRY_ID, USER_ID, {
          rejection_reason: 'Some reason',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.rejectEntry(TENANT_ID, ENTRY_ID, USER_ID, {
          rejection_reason: 'Some reason',
        }),
      ).rejects.toThrow('Entry is not in pending_review status. Only pending entries can be rejected.');
    });

    it('should throw BadRequestException when rejection_reason is empty (defense-in-depth)', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(pendingEntry());

      await expect(
        service.rejectEntry(TENANT_ID, ENTRY_ID, USER_ID, {
          rejection_reason: '   ',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.rejectEntry(TENANT_ID, ENTRY_ID, USER_ID, {
          rejection_reason: '   ',
        }),
      ).rejects.toThrow('Rejection reason is required');

      expect(mockPrismaService.financial_entry.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.rejectEntry(TENANT_ID, 'nonexistent', USER_ID, {
          rejection_reason: 'Some reason',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should log audit with EXPENSE_REJECTED workflow action and rejection_reason', async () => {
      const existing = pendingEntry();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({
        ...existing,
        rejection_reason: 'Missing receipt',
        rejected_by_user_id: USER_ID,
        rejected_at: new Date(),
        rejected_by: mockUser(),
      });

      await service.rejectEntry(TENANT_ID, ENTRY_ID, USER_ID, {
        rejection_reason: 'Missing receipt',
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'financial_entry',
          entityId: ENTRY_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          metadata: {
            workflow_action: 'EXPENSE_REJECTED',
            rejection_reason: 'Missing receipt',
          },
          description: `Rejected financial entry ${ENTRY_ID}: Missing receipt`,
        }),
      );
    });

    it('should use fetchEntryOrFail with tenant_id scoping', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.rejectEntry('other-tenant', ENTRY_ID, USER_ID, {
          rejection_reason: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ENTRY_ID, tenant_id: 'other-tenant' },
        }),
      );
    });
  });

  // =========================================================================
  // Sprint 4_5 — Task 3: resubmitEntry()
  // =========================================================================

  describe('resubmitEntry()', () => {
    const rejectedEntry = (overrides: any = {}) =>
      mockEnrichedEntryRecord({
        submission_status: 'pending_review',
        rejection_reason: 'Receipt too blurry',
        rejected_by_user_id: OTHER_USER_ID,
        rejected_at: new Date('2026-03-18'),
        rejected_by: mockUser({ id: OTHER_USER_ID, first_name: 'Jane', last_name: 'Admin' }),
        created_by_user_id: USER_ID,
        amount: 100.0,
        ...overrides,
      });

    it('should clear all three rejection fields (BR-21)', async () => {
      const existing = rejectedEntry();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      const updated = {
        ...existing,
        rejection_reason: null,
        rejected_by_user_id: null,
        rejected_at: null,
        rejected_by: null,
      };
      mockPrismaService.financial_entry.update.mockResolvedValue(updated);

      const result = await service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {});

      const updateData = mockPrismaService.financial_entry.update.mock.calls[0][0].data;
      expect(updateData.rejection_reason).toBeNull();
      expect(updateData.rejected_by_user_id).toBeNull();
      expect(updateData.rejected_at).toBeNull();

      expect(result.rejection_reason).toBeNull();
      expect(result.rejected_at).toBeNull();
    });

    it('should keep submission_status as pending_review (BR-22)', async () => {
      const existing = rejectedEntry();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({
        ...existing,
        rejection_reason: null,
        rejected_by_user_id: null,
        rejected_at: null,
        rejected_by: null,
      });

      await service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {});

      const updateData = mockPrismaService.financial_entry.update.mock.calls[0][0].data;
      expect(updateData).not.toHaveProperty('submission_status');
    });

    it('should throw BadRequestException when entry was not rejected (BR-20)', async () => {
      const notRejected = mockEnrichedEntryRecord({
        submission_status: 'pending_review',
        rejected_at: null,
        rejection_reason: null,
        rejected_by_user_id: null,
        created_by_user_id: USER_ID,
      });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(notRejected);

      await expect(
        service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {}),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {}),
      ).rejects.toThrow('Only rejected entries can be resubmitted. This entry has not been rejected.');
    });

    it('should throw BadRequestException when entry is confirmed with historical rejection', async () => {
      const confirmedWithHistory = mockEnrichedEntryRecord({
        submission_status: 'confirmed',
        rejected_at: new Date('2026-03-15'),
        rejection_reason: 'Old reason',
        rejected_by_user_id: OTHER_USER_ID,
        created_by_user_id: USER_ID,
      });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(confirmedWithHistory);

      await expect(
        service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {}),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {}),
      ).rejects.toThrow('Entry is not in pending_review status.');
    });

    it('should throw ForbiddenException when Employee tries to resubmit another user\'s entry', async () => {
      const existing = rejectedEntry({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);

      await expect(
        service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {}),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {}),
      ).rejects.toThrow('Access denied. You can only resubmit your own entries.');
    });

    it('should allow Employee to resubmit their own entry', async () => {
      const existing = rejectedEntry({ created_by_user_id: USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({
        ...existing,
        rejection_reason: null,
        rejected_by_user_id: null,
        rejected_at: null,
        rejected_by: null,
      });

      const result = await service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {});

      expect(result.id).toBe(ENTRY_ID);
      expect(result.rejection_reason).toBeNull();
    });

    it('should allow privileged user to resubmit any entry (no ownership check)', async () => {
      const existing = rejectedEntry({ created_by_user_id: OTHER_USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({
        ...existing,
        rejection_reason: null,
        rejected_by_user_id: null,
        rejected_at: null,
        rejected_by: null,
      });

      // Owner can resubmit anyone's entry
      const result = await service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Owner'], {});
      expect(result.id).toBe(ENTRY_ID);
    });

    it('should apply optional field updates when resubmitting', async () => {
      const existing = rejectedEntry({ created_by_user_id: USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_category.findFirst.mockResolvedValue(
        mockCategory({ id: 'new-category-id' }),
      );
      mockPrismaService.financial_entry.update.mockResolvedValue({
        ...existing,
        rejection_reason: null,
        rejected_by_user_id: null,
        rejected_at: null,
        rejected_by: null,
        amount: 200,
        category_id: 'new-category-id',
        vendor_name: 'Updated Vendor',
      });

      await service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {
        amount: 200,
        category_id: 'new-category-id',
        vendor_name: 'Updated Vendor',
      });

      const updateData = mockPrismaService.financial_entry.update.mock.calls[0][0].data;
      expect(updateData.amount).toBe(200);
      expect(updateData.category_id).toBe('new-category-id');
      expect(updateData.vendor_name).toBe('Updated Vendor');
      // Rejection fields still cleared
      expect(updateData.rejection_reason).toBeNull();
      expect(updateData.rejected_at).toBeNull();
    });

    it('should validate tax vs amount on RESULTING state', async () => {
      const existing = rejectedEntry({ created_by_user_id: USER_ID, amount: 100 });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);

      // Tax >= amount on the resulting state (existing amount=100, dto.tax_amount=100)
      await expect(
        service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {
          tax_amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {
          tax_amount: 100,
        }),
      ).rejects.toThrow('Tax amount must be less than the entry amount');
    });

    it('should validate purchased_by mutual exclusion on RESULTING state', async () => {
      const existing = rejectedEntry({
        created_by_user_id: USER_ID,
        purchased_by_user_id: USER_ID, // existing has user
      });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.crew_member.findFirst.mockResolvedValue(mockCrewMember());

      // Dto adds crew member without clearing user → mutual exclusion violation
      await expect(
        service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {
          purchased_by_crew_member_id: CREW_MEMBER_ID,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {
          purchased_by_crew_member_id: CREW_MEMBER_ID,
        }),
      ).rejects.toThrow('Cannot assign purchase to both a user and a crew member.');
    });

    it('should update supplier spend when supplier changes', async () => {
      const oldSupplierId = 'old-supplier-uuid';
      const newSupplierId = 'new-supplier-uuid';
      const existing = rejectedEntry({
        created_by_user_id: USER_ID,
        supplier_id: oldSupplierId,
      });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.supplier.findFirst.mockResolvedValue({
        id: newSupplierId,
        tenant_id: TENANT_ID,
        is_active: true,
      });
      mockPrismaService.financial_entry.update.mockResolvedValue({
        ...existing,
        rejection_reason: null,
        rejected_by_user_id: null,
        rejected_at: null,
        rejected_by: null,
        supplier_id: newSupplierId,
      });

      await service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {
        supplier_id: newSupplierId,
      });

      expect(mockSupplierService.updateSpendTotals).toHaveBeenCalledWith(TENANT_ID, oldSupplierId);
      expect(mockSupplierService.updateSpendTotals).toHaveBeenCalledWith(TENANT_ID, newSupplierId);
    });

    it('should log audit with EXPENSE_RESUBMITTED workflow action', async () => {
      const existing = rejectedEntry({ created_by_user_id: USER_ID });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry.update.mockResolvedValue({
        ...existing,
        rejection_reason: null,
        rejected_by_user_id: null,
        rejected_at: null,
        rejected_by: null,
      });

      await service.resubmitEntry(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], {});

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'financial_entry',
          entityId: ENTRY_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          metadata: { workflow_action: 'EXPENSE_RESUBMITTED' },
          description: `Resubmitted financial entry ${ENTRY_ID}`,
        }),
      );
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.resubmitEntry(TENANT_ID, 'nonexistent', USER_ID, ['Employee'], {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // Sprint 4_5 — Task 4: exportEntries()
  // =========================================================================

  describe('exportEntries()', () => {
    const defaultQuery = { page: 1, limit: 20 };

    it('should return CSV string with correct header row', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      const csv = await service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      const header = csv.split('\n')[0];
      expect(header).toBe(
        'Date,Time,Type,Category,Classification,Project,Task,Supplier,Vendor Name,Amount,Tax Amount,Payment Method,Payment Account,Purchased By,Submitted By,Status,Notes,Created At',
      );
    });

    it('should throw BadRequestException when result set exceeds 10,000 rows (BR-24)', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(10001);

      await expect(
        service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery),
      ).rejects.toThrow('Export limit exceeded. Apply date filters to narrow the result set.');

      // findMany should NOT have been called (short-circuit before fetching data)
      expect(mockPrismaService.financial_entry.findMany).not.toHaveBeenCalled();
    });

    it('should allow exactly 10,000 rows (boundary)', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(10000);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      const csv = await service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      expect(csv).toBeDefined();
      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalled();
    });

    it('should format entry data correctly in CSV rows', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(1);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([
        {
          entry_date: new Date('2026-03-15'),
          entry_time: new Date('1970-01-01T14:30:00Z'),
          entry_type: 'expense',
          amount: 125.50,
          tax_amount: 10.25,
          vendor_name: 'Home Depot',
          payment_method: 'credit_card',
          submission_status: 'confirmed',
          notes: 'Lumber purchase',
          created_at: new Date('2026-03-15T10:00:00.000Z'),
          has_receipt: true,
          category: { name: 'Materials', type: 'material', classification: 'cost_of_goods_sold' },
          project: { name: 'Kitchen Remodel' },
          task: { title: 'Install Cabinets' },
          supplier: { name: 'Home Depot Corp' },
          payment_method_registry_rel: { nickname: 'Company Visa *4242' },
          purchased_by_user: { first_name: 'John', last_name: 'Doe' },
          purchased_by_crew_member: null,
          created_by: { first_name: 'Jane', last_name: 'Admin' },
        },
      ]);

      const csv = await service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);
      const rows = csv.split('\n');

      expect(rows).toHaveLength(2); // header + 1 data row
      const dataRow = rows[1];
      expect(dataRow).toContain('2026-03-15'); // Date
      expect(dataRow).toContain('14:30:00'); // Time
      expect(dataRow).toContain('expense'); // Type
      expect(dataRow).toContain('Materials'); // Category
      expect(dataRow).toContain('Kitchen Remodel'); // Project
      expect(dataRow).toContain('Install Cabinets'); // Task
      expect(dataRow).toContain('Home Depot Corp'); // Supplier
      expect(dataRow).toContain('125.5'); // Amount
      expect(dataRow).toContain('10.25'); // Tax Amount
      expect(dataRow).toContain('John Doe'); // Purchased By
      expect(dataRow).toContain('Jane Admin'); // Submitted By
    });

    it('should properly escape commas and quotes in CSV fields', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(1);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([
        {
          entry_date: new Date('2026-03-15'),
          entry_time: null,
          entry_type: 'expense',
          amount: 50,
          tax_amount: null,
          vendor_name: 'Smith, Jones & Co',
          payment_method: null,
          submission_status: 'pending_review',
          notes: 'He said "check the invoice"',
          created_at: new Date('2026-03-15T10:00:00.000Z'),
          has_receipt: false,
          category: { name: 'Office', type: 'office', classification: 'operating_expense' },
          project: null,
          task: null,
          supplier: null,
          payment_method_registry_rel: null,
          purchased_by_user: null,
          purchased_by_crew_member: null,
          created_by: { first_name: 'Jane', last_name: 'Admin' },
        },
      ]);

      const csv = await service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);
      const dataRow = csv.split('\n')[1];

      // Vendor name with comma should be quoted
      expect(dataRow).toContain('"Smith, Jones & Co"');
      // Notes with quotes should be escaped
      expect(dataRow).toContain('"He said ""check the invoice"""');
    });

    it('should handle entries with null optional fields', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(1);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([
        {
          entry_date: new Date('2026-03-15'),
          entry_time: null,
          entry_type: 'expense',
          amount: 50,
          tax_amount: null,
          vendor_name: null,
          payment_method: null,
          submission_status: 'confirmed',
          notes: null,
          created_at: new Date('2026-03-15T10:00:00.000Z'),
          has_receipt: false,
          category: { name: 'Other', type: 'other', classification: null },
          project: null,
          task: null,
          supplier: null,
          payment_method_registry_rel: null,
          purchased_by_user: null,
          purchased_by_crew_member: null,
          created_by: { first_name: 'John', last_name: 'Doe' },
        },
      ]);

      const csv = await service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);
      const rows = csv.split('\n');

      // Should not crash — nulls become empty strings
      expect(rows).toHaveLength(2);
      expect(rows[1]).toContain('2026-03-15');
      expect(rows[1]).toContain('John Doe');
    });

    it('should enforce Employee scoping in filter', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      await service.exportEntries(TENANT_ID, USER_ID, ['Employee'], defaultQuery);

      // Count query should include Employee scoping
      expect(mockPrismaService.financial_entry.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenant_id: TENANT_ID,
          created_by_user_id: USER_ID,
        }),
      });
    });

    it('should use select (not include) for efficiency', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      await service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      const findManyCall = mockPrismaService.financial_entry.findMany.mock.calls[0][0];
      expect(findManyCall).toHaveProperty('select');
      expect(findManyCall).not.toHaveProperty('include');
    });

    it('should order by entry_date desc', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      await service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { entry_date: 'desc' },
        }),
      );
    });

    it('should NOT paginate — fetches all matching records (BR-25)', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(500);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      await service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);

      const findManyCall = mockPrismaService.financial_entry.findMany.mock.calls[0][0];
      expect(findManyCall).not.toHaveProperty('skip');
      expect(findManyCall).not.toHaveProperty('take');
    });

    it('should apply query filters (same as getEntries)', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      await service.exportEntries(TENANT_ID, USER_ID, ['Owner'], {
        ...defaultQuery,
        project_id: PROJECT_ID,
        entry_type: 'expense',
        date_from: '2026-01-01',
        date_to: '2026-03-31',
      });

      expect(mockPrismaService.financial_entry.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenant_id: TENANT_ID,
          project_id: PROJECT_ID,
          entry_type: 'expense',
          entry_date: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-03-31'),
          },
        }),
      });
    });

    it('should resolve purchased_by from crew_member when user is null', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(1);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([
        {
          entry_date: new Date('2026-03-15'),
          entry_time: null,
          entry_type: 'expense',
          amount: 75,
          tax_amount: null,
          vendor_name: null,
          payment_method: null,
          submission_status: 'confirmed',
          notes: null,
          created_at: new Date('2026-03-15T10:00:00.000Z'),
          has_receipt: false,
          category: { name: 'Materials', type: 'material', classification: 'cost_of_goods_sold' },
          project: null,
          task: null,
          supplier: null,
          payment_method_registry_rel: null,
          purchased_by_user: null,
          purchased_by_crew_member: { first_name: 'Mike', last_name: 'Smith' },
          created_by: { first_name: 'John', last_name: 'Doe' },
        },
      ]);

      const csv = await service.exportEntries(TENANT_ID, USER_ID, ['Owner'], defaultQuery);
      const dataRow = csv.split('\n')[1];

      expect(dataRow).toContain('Mike Smith');
    });

    it('should include all required CSV columns', async () => {
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      const csv = await service.exportEntries(TENANT_ID, USER_ID, OWNER_ROLES, defaultQuery);
      const header = csv.split('\n')[0];
      const columns = header.split(',');

      expect(columns).toContain('Date');
      expect(columns).toContain('Time');
      expect(columns).toContain('Type');
      expect(columns).toContain('Category');
      expect(columns).toContain('Classification');
      expect(columns).toContain('Project');
      expect(columns).toContain('Task');
      expect(columns).toContain('Supplier');
      expect(columns).toContain('Vendor Name');
      expect(columns).toContain('Amount');
      expect(columns).toContain('Tax Amount');
      expect(columns).toContain('Payment Method');
      expect(columns).toContain('Payment Account');
      expect(columns).toContain('Purchased By');
      expect(columns).toContain('Submitted By');
      expect(columns).toContain('Status');
      expect(columns).toContain('Notes');
      expect(columns).toContain('Created At');
    });
  });

  // =========================================================================
  // Sprint 4_7 — Task 10: Tenant Isolation Tests
  // =========================================================================

  describe('Tenant isolation', () => {
    it('should always include tenant_id in getEntries where clause', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.aggregate.mockResolvedValue({ _sum: { amount: null } });

      await service.getEntries(TENANT_ID, USER_ID, OWNER_ROLES, { page: 1, limit: 20 });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should always include tenant_id in getEntryById where clause', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.getEntryById(TENANT_ID, ENTRY_ID, USER_ID, OWNER_ROLES),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: ENTRY_ID,
            tenant_id: TENANT_ID,
          }),
        }),
      );
    });

    it('should always include tenant_id in getPendingEntries where clause', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.aggregate.mockResolvedValue({ _sum: { amount: null } });

      await service.getPendingEntries(TENANT_ID, { page: 1, limit: 20 });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should always include tenant_id in createEntry data', async () => {
      setupCreateEntryMocks();

      await service.createEntry(TENANT_ID, USER_ID, OWNER_ROLES, baseCreateDto);

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should not return entry when queried with different tenant_id', async () => {
      // Prisma returns null because the where clause includes the wrong tenant_id
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.getEntryById('different-tenant-id', ENTRY_ID, USER_ID, OWNER_ROLES),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'different-tenant-id',
          }),
        }),
      );
    });
  });
});
