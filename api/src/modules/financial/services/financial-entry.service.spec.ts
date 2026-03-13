import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FinancialEntryService } from './financial-entry.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateFinancialEntryDto } from '../dto/create-financial-entry.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const CATEGORY_ID = 'category-uuid-001';
const TASK_ID = 'task-uuid-001';
const ENTRY_ID = 'entry-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockCategory = (overrides: any = {}) => ({
  id: CATEGORY_ID,
  name: 'Materials',
  type: 'material',
  ...overrides,
});

const mockEntryRecord = (overrides: any = {}) => ({
  id: ENTRY_ID,
  tenant_id: TENANT_ID,
  project_id: PROJECT_ID,
  task_id: null,
  category_id: CATEGORY_ID,
  entry_type: 'expense',
  amount: 450.0,
  entry_date: new Date('2026-03-10'),
  vendor_name: 'Home Depot',
  crew_member_id: null,
  subcontractor_id: null,
  notes: '2x4 studs for framing',
  has_receipt: false,
  created_by_user_id: USER_ID,
  updated_by_user_id: null,
  created_at: new Date('2026-03-10T10:00:00.000Z'),
  updated_at: new Date('2026-03-10T10:00:00.000Z'),
  category: mockCategory(),
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
  },
  financial_category: {
    findFirst: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
  log: jest.fn(),
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
      ],
    }).compile();

    service = module.get<FinancialEntryService>(FinancialEntryService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // createEntry()
  // -----------------------------------------------------------------------

  describe('createEntry()', () => {
    const dto: CreateFinancialEntryDto = {
      project_id: PROJECT_ID,
      category_id: CATEGORY_ID,
      amount: 450.0,
      entry_date: '2026-03-10',
      vendor_name: 'Home Depot',
      notes: '2x4 studs for framing',
    };

    it('should validate category belongs to tenant, create entry, and call audit log', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(
        mockCategory(),
      );
      const createdEntry = mockEntryRecord();
      mockPrismaService.financial_entry.create.mockResolvedValue(createdEntry);

      const result = await service.createEntry(TENANT_ID, USER_ID, dto);

      // Verify category validation was called with tenant_id
      expect(mockPrismaService.financial_category.findFirst).toHaveBeenCalledWith({
        where: {
          id: CATEGORY_ID,
          tenant_id: TENANT_ID,
          is_active: true,
        },
      });

      // Verify prisma.create was called with correct data
      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith({
        data: {
          tenant_id: TENANT_ID,
          project_id: PROJECT_ID,
          task_id: null,
          category_id: CATEGORY_ID,
          entry_type: 'expense',
          amount: 450.0,
          entry_date: new Date('2026-03-10'),
          vendor_name: 'Home Depot',
          crew_member_id: null,
          subcontractor_id: null,
          notes: '2x4 studs for framing',
          has_receipt: false,
          created_by_user_id: USER_ID,
        },
        include: {
          category: {
            select: { id: true, name: true, type: true },
          },
        },
      });

      // Verify audit log was called
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'financial_entry',
          entityId: ENTRY_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          after: createdEntry,
          description: `Created financial entry of $450 for project ${PROJECT_ID}`,
        }),
      );

      // Verify returned entry
      expect(result).toEqual(createdEntry);
      expect(result.id).toBe(ENTRY_ID);
      expect(result.category).toEqual(mockCategory());
    });

    it('should pass optional fields (task_id, crew_member_id, subcontractor_id) to create', async () => {
      const dtoWithOptionals: CreateFinancialEntryDto = {
        ...dto,
        task_id: TASK_ID,
        crew_member_id: 'crew-uuid-001',
        subcontractor_id: 'sub-uuid-001',
      };

      mockPrismaService.financial_category.findFirst.mockResolvedValue(
        mockCategory(),
      );
      mockPrismaService.financial_entry.create.mockResolvedValue(
        mockEntryRecord({
          task_id: TASK_ID,
          crew_member_id: 'crew-uuid-001',
          subcontractor_id: 'sub-uuid-001',
        }),
      );

      await service.createEntry(TENANT_ID, USER_ID, dtoWithOptionals);

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            task_id: TASK_ID,
            crew_member_id: 'crew-uuid-001',
            subcontractor_id: 'sub-uuid-001',
          }),
        }),
      );
    });

    it('should throw BadRequestException when category does not belong to tenant', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(
        'Financial category not found or does not belong to this tenant',
      );

      // Verify create was never called
      expect(mockPrismaService.financial_entry.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when entry_date is in the future', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(
        mockCategory(),
      );

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const dtoWithFutureDate: CreateFinancialEntryDto = {
        ...dto,
        entry_date: futureDateStr,
      };

      await expect(
        service.createEntry(TENANT_ID, USER_ID, dtoWithFutureDate),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEntry(TENANT_ID, USER_ID, dtoWithFutureDate),
      ).rejects.toThrow('Entry date cannot be in the future');

      // Verify create was never called
      expect(mockPrismaService.financial_entry.create).not.toHaveBeenCalled();
    });

    it('should allow entry_date that is today (not future)', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(
        mockCategory(),
      );

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const dtoWithToday: CreateFinancialEntryDto = {
        ...dto,
        entry_date: todayStr,
      };

      mockPrismaService.financial_entry.create.mockResolvedValue(
        mockEntryRecord({ entry_date: today }),
      );

      const result = await service.createEntry(TENANT_ID, USER_ID, dtoWithToday);

      expect(result).toBeDefined();
      expect(mockPrismaService.financial_entry.create).toHaveBeenCalled();
    });

    it('should set null for optional fields when they are not provided', async () => {
      const minimalDto: CreateFinancialEntryDto = {
        project_id: PROJECT_ID,
        category_id: CATEGORY_ID,
        amount: 100,
        entry_date: '2026-03-01',
      };

      mockPrismaService.financial_category.findFirst.mockResolvedValue(
        mockCategory(),
      );
      mockPrismaService.financial_entry.create.mockResolvedValue(
        mockEntryRecord({
          amount: 100,
          vendor_name: null,
          notes: null,
        }),
      );

      await service.createEntry(TENANT_ID, USER_ID, minimalDto);

      expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            task_id: null,
            vendor_name: null,
            crew_member_id: null,
            subcontractor_id: null,
            notes: null,
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getProjectEntries()
  // -----------------------------------------------------------------------

  describe('getProjectEntries()', () => {
    it('should return paginated results with tenant_id filter and category included', async () => {
      const entries = [
        mockEntryRecord(),
        mockEntryRecord({ id: 'entry-uuid-002', amount: 200 }),
      ];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);
      mockPrismaService.financial_entry.count.mockResolvedValue(2);

      const result = await service.getProjectEntries(TENANT_ID, {
        project_id: PROJECT_ID,
        page: 1,
        limit: 20,
      });

      // Verify tenant_id and project_id in query
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

    it('should apply category_id filter when provided', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(0);

      await service.getProjectEntries(TENANT_ID, {
        project_id: PROJECT_ID,
        category_id: CATEGORY_ID,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
            category_id: CATEGORY_ID,
          }),
        }),
      );
    });

    it('should apply date_from filter when provided', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(0);

      await service.getProjectEntries(TENANT_ID, {
        project_id: PROJECT_ID,
        date_from: '2026-01-01',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
            entry_date: {
              gte: new Date('2026-01-01'),
            },
          }),
        }),
      );
    });

    it('should apply date_to filter when provided', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(0);

      await service.getProjectEntries(TENANT_ID, {
        project_id: PROJECT_ID,
        date_to: '2026-03-31',
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
            entry_date: {
              lte: new Date('2026-03-31'),
            },
          }),
        }),
      );
    });

    it('should apply both date_from and date_to filters together', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(0);

      await service.getProjectEntries(TENANT_ID, {
        project_id: PROJECT_ID,
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

    it('should calculate pagination correctly for page 2', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(50);

      const result = await service.getProjectEntries(TENANT_ID, {
        project_id: PROJECT_ID,
        page: 2,
        limit: 20,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        }),
      );

      expect(result.meta).toEqual({
        total: 50,
        page: 2,
        limit: 20,
        pages: 3,
      });
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

    it('should default to page 1 and limit 20 when not provided', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);
      mockPrismaService.financial_entry.count.mockResolvedValue(0);

      await service.getProjectEntries(TENANT_ID, {
        project_id: PROJECT_ID,
      });

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getTaskEntries()
  // -----------------------------------------------------------------------

  describe('getTaskEntries()', () => {
    it('should return entries filtered by tenant_id and task_id with category included', async () => {
      const entries = [
        mockEntryRecord({ task_id: TASK_ID }),
        mockEntryRecord({ id: 'entry-uuid-002', task_id: TASK_ID, amount: 75 }),
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
      expect(result[0].task_id).toBe(TASK_ID);
    });

    it('should return empty array when no entries exist for task', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      const result = await service.getTaskEntries(TENANT_ID, 'nonexistent-task');

      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // getEntryById()
  // -----------------------------------------------------------------------

  describe('getEntryById()', () => {
    it('should return entry with category when found', async () => {
      const entry = mockEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);

      const result = await service.getEntryById(TENANT_ID, ENTRY_ID);

      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith({
        where: {
          id: ENTRY_ID,
          tenant_id: TENANT_ID,
        },
        include: {
          category: {
            select: { id: true, name: true, type: true },
          },
        },
      });

      expect(result).toEqual(entry);
      expect(result.id).toBe(ENTRY_ID);
      expect(result.category).toEqual(mockCategory());
    });

    it('should throw NotFoundException when entry is not found', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.getEntryById(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.getEntryById(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow('Financial entry not found');
    });

    it('should throw NotFoundException when entry belongs to different tenant', async () => {
      // findFirst returns null because tenant_id filter is in the query
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.getEntryById('other-tenant-id', ENTRY_ID),
      ).rejects.toThrow(NotFoundException);

      // Verify the query included the other tenant_id filter
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

  // -----------------------------------------------------------------------
  // updateEntry()
  // -----------------------------------------------------------------------

  describe('updateEntry()', () => {
    it('should update entry fields, set updated_by_user_id, and call audit log with before/after', async () => {
      const existingEntry = mockEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existingEntry);

      const updatedEntry = mockEntryRecord({
        amount: 600,
        vendor_name: 'Lowes',
        updated_by_user_id: USER_ID,
      });
      mockPrismaService.financial_entry.update.mockResolvedValue(updatedEntry);

      const result = await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, {
        amount: 600,
        vendor_name: 'Lowes',
      });

      // Verify getEntryById was called (tenant isolation check)
      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: ENTRY_ID,
            tenant_id: TENANT_ID,
          }),
        }),
      );

      // Verify update was called with correct data
      expect(mockPrismaService.financial_entry.update).toHaveBeenCalledWith({
        where: { id: ENTRY_ID },
        data: {
          updated_by_user_id: USER_ID,
          amount: 600,
          vendor_name: 'Lowes',
        },
        include: {
          category: {
            select: { id: true, name: true, type: true },
          },
        },
      });

      // Verify audit log was called with before and after
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'financial_entry',
          entityId: ENTRY_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: existingEntry,
          after: updatedEntry,
          description: `Updated financial entry ${ENTRY_ID}`,
        }),
      );

      expect(result).toEqual(updatedEntry);
    });

    it('should validate category when category_id is being changed', async () => {
      const existingEntry = mockEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existingEntry);
      mockPrismaService.financial_category.findFirst.mockResolvedValue(
        mockCategory({ id: 'new-category-id', name: 'Labor', type: 'labor' }),
      );
      mockPrismaService.financial_entry.update.mockResolvedValue(
        mockEntryRecord({ category_id: 'new-category-id' }),
      );

      await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, {
        category_id: 'new-category-id',
      });

      // Verify category validation was called
      expect(mockPrismaService.financial_category.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'new-category-id',
          tenant_id: TENANT_ID,
          is_active: true,
        },
      });
    });

    it('should throw BadRequestException when new category does not belong to tenant', async () => {
      const existingEntry = mockEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existingEntry);
      mockPrismaService.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, {
          category_id: 'invalid-category',
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify update was never called
      expect(mockPrismaService.financial_entry.update).not.toHaveBeenCalled();
    });

    it('should validate entry_date when it is being changed', async () => {
      const existingEntry = mockEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existingEntry);

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      await expect(
        service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, {
          entry_date: futureDateStr,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, {
          entry_date: futureDateStr,
        }),
      ).rejects.toThrow('Entry date cannot be in the future');

      // Verify update was never called
      expect(mockPrismaService.financial_entry.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEntry(TENANT_ID, 'nonexistent-id', USER_ID, {
          amount: 100,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_entry.update).not.toHaveBeenCalled();
    });

    it('should set nullable fields to null when explicitly set to null/undefined via ?? null', async () => {
      const existingEntry = mockEntryRecord({
        task_id: TASK_ID,
        vendor_name: 'Home Depot',
        crew_member_id: 'crew-001',
        notes: 'Some notes',
      });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existingEntry);
      mockPrismaService.financial_entry.update.mockResolvedValue(
        mockEntryRecord({
          task_id: null,
          vendor_name: null,
          crew_member_id: null,
          notes: null,
        }),
      );

      await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, {
        task_id: null as any,
        vendor_name: null as any,
        crew_member_id: null as any,
        notes: null as any,
      });

      expect(mockPrismaService.financial_entry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            task_id: null,
            vendor_name: null,
            crew_member_id: null,
            notes: null,
          }),
        }),
      );
    });

    it('should only update fields that are provided (partial update)', async () => {
      const existingEntry = mockEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existingEntry);
      mockPrismaService.financial_entry.update.mockResolvedValue(
        mockEntryRecord({ amount: 999 }),
      );

      await service.updateEntry(TENANT_ID, ENTRY_ID, USER_ID, {
        amount: 999,
      });

      const updateCall = mockPrismaService.financial_entry.update.mock.calls[0][0];

      // Should contain amount and updated_by_user_id
      expect(updateCall.data).toEqual({
        updated_by_user_id: USER_ID,
        amount: 999,
      });

      // Should NOT contain fields that were not in the dto
      expect(updateCall.data).not.toHaveProperty('vendor_name');
      expect(updateCall.data).not.toHaveProperty('notes');
      expect(updateCall.data).not.toHaveProperty('task_id');
      expect(updateCall.data).not.toHaveProperty('category_id');
    });
  });

  // -----------------------------------------------------------------------
  // deleteEntry()
  // -----------------------------------------------------------------------

  describe('deleteEntry()', () => {
    it('should hard delete entry and call audit log with before data', async () => {
      const existingEntry = mockEntryRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(existingEntry);
      mockPrismaService.financial_entry.delete.mockResolvedValue(existingEntry);

      const result = await service.deleteEntry(TENANT_ID, ENTRY_ID, USER_ID);

      // Verify getEntryById was called first (tenant isolation)
      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: ENTRY_ID,
            tenant_id: TENANT_ID,
          }),
        }),
      );

      // Verify hard delete
      expect(mockPrismaService.financial_entry.delete).toHaveBeenCalledWith({
        where: { id: ENTRY_ID },
      });

      // Verify audit log
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'financial_entry',
          entityId: ENTRY_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: existingEntry,
          description: `Deleted financial entry ${ENTRY_ID} ($${existingEntry.amount})`,
        }),
      );

      // Verify return message
      expect(result).toEqual({ message: 'Financial entry deleted successfully' });
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteEntry(TENANT_ID, 'nonexistent-id', USER_ID),
      ).rejects.toThrow(NotFoundException);

      // Verify delete was never called
      expect(mockPrismaService.financial_entry.delete).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when trying to delete entry from another tenant', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteEntry('other-tenant-id', ENTRY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: ENTRY_ID,
            tenant_id: 'other-tenant-id',
          }),
        }),
      );

      expect(mockPrismaService.financial_entry.delete).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getProjectCostSummary()
  // -----------------------------------------------------------------------

  describe('getProjectCostSummary()', () => {
    it('should aggregate costs by category type and return correct totals', async () => {
      const entries = [
        mockEntryRecord({
          id: 'e1',
          amount: 500,
          category: { type: 'labor' },
        }),
        mockEntryRecord({
          id: 'e2',
          amount: 300.50,
          category: { type: 'material' },
        }),
        mockEntryRecord({
          id: 'e3',
          amount: 1200,
          category: { type: 'subcontractor' },
        }),
        mockEntryRecord({
          id: 'e4',
          amount: 150.75,
          category: { type: 'equipment' },
        }),
        mockEntryRecord({
          id: 'e5',
          amount: 50,
          category: { type: 'other' },
        }),
        mockEntryRecord({
          id: 'e6',
          amount: 250,
          category: { type: 'labor' },
        }),
      ];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);

      const result = await service.getProjectCostSummary(TENANT_ID, PROJECT_ID);

      // Verify query includes tenant_id and project_id
      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          project_id: PROJECT_ID,
        },
        include: {
          category: {
            select: { type: true },
          },
        },
      });

      expect(result.project_id).toBe(PROJECT_ID);
      expect(result.entry_count).toBe(6);
      expect(result.total_actual_cost).toBe(2451.25);
      expect(result.cost_by_category).toEqual({
        labor: 750,
        material: 300.50,
        subcontractor: 1200,
        equipment: 150.75,
        other: 50,
      });
    });

    it('should return zeroes when project has no entries', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      const result = await service.getProjectCostSummary(TENANT_ID, PROJECT_ID);

      expect(result).toEqual({
        project_id: PROJECT_ID,
        total_actual_cost: 0,
        cost_by_category: {
          labor: 0,
          material: 0,
          subcontractor: 0,
          equipment: 0,
          other: 0,
        },
        entry_count: 0,
      });
    });

    it('should handle floating point precision correctly (rounding to 2 decimals)', async () => {
      const entries = [
        mockEntryRecord({ id: 'e1', amount: 10.1, category: { type: 'labor' } }),
        mockEntryRecord({ id: 'e2', amount: 10.2, category: { type: 'labor' } }),
      ];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);

      const result = await service.getProjectCostSummary(TENANT_ID, PROJECT_ID);

      // 10.1 + 10.2 might produce 20.299999... in IEEE 754
      // Service rounds to 2 decimal places
      expect(result.total_actual_cost).toBe(20.3);
      expect(result.cost_by_category.labor).toBe(20.3);
    });

    it('should handle entries with only one category type', async () => {
      const entries = [
        mockEntryRecord({ id: 'e1', amount: 100, category: { type: 'material' } }),
        mockEntryRecord({ id: 'e2', amount: 200, category: { type: 'material' } }),
      ];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);

      const result = await service.getProjectCostSummary(TENANT_ID, PROJECT_ID);

      expect(result.total_actual_cost).toBe(300);
      expect(result.cost_by_category.material).toBe(300);
      expect(result.cost_by_category.labor).toBe(0);
      expect(result.cost_by_category.subcontractor).toBe(0);
      expect(result.cost_by_category.equipment).toBe(0);
      expect(result.cost_by_category.other).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // getTaskCostSummary()
  // -----------------------------------------------------------------------

  describe('getTaskCostSummary()', () => {
    it('should return total cost and entry count for a task', async () => {
      const entries = [
        { amount: 150.50 },
        { amount: 300.25 },
        { amount: 75 },
      ];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);

      const result = await service.getTaskCostSummary(TENANT_ID, TASK_ID);

      // Verify query includes tenant_id and task_id
      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          task_id: TASK_ID,
        },
        select: { amount: true },
      });

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

    it('should handle floating point precision correctly', async () => {
      const entries = [
        { amount: 0.1 },
        { amount: 0.2 },
      ];
      mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);

      const result = await service.getTaskCostSummary(TENANT_ID, TASK_ID);

      // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754, should round to 0.3
      expect(result.total_actual_cost).toBe(0.3);
      expect(result.entry_count).toBe(2);
    });

    it('should always include tenant_id filter to enforce tenant isolation', async () => {
      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      await service.getTaskCostSummary('different-tenant', TASK_ID);

      expect(mockPrismaService.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'different-tenant',
          }),
        }),
      );
    });
  });
});
