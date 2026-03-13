import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FinancialCategoryService } from './financial-category.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateFinancialCategoryDto, FinancialCategoryType } from '../dto/create-financial-category.dto';
import { UpdateFinancialCategoryDto } from '../dto/update-financial-category.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const CATEGORY_ID = 'category-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockCategoryRecord = (overrides: any = {}) => ({
  id: CATEGORY_ID,
  tenant_id: TENANT_ID,
  name: 'Materials - Concrete',
  type: 'material',
  description: 'Concrete and cement expenses',
  is_system_default: false,
  is_active: true,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-01-15T10:00:00.000Z'),
  updated_at: new Date('2026-01-15T10:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  financial_category: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
  log: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FinancialCategoryService', () => {
  let service: FinancialCategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialCategoryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<FinancialCategoryService>(FinancialCategoryService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // findAllForTenant()
  // -----------------------------------------------------------------------

  describe('findAllForTenant()', () => {
    it('should return active categories for the given tenant', async () => {
      const records = [
        mockCategoryRecord({ id: 'cat-001', type: 'equipment', name: 'Equipment Rental' }),
        mockCategoryRecord({ id: 'cat-002', type: 'labor', name: 'Labor - General' }),
        mockCategoryRecord({ id: 'cat-003', type: 'material', name: 'Materials - Concrete' }),
      ];
      mockPrismaService.financial_category.findMany.mockResolvedValue(records);

      const result = await service.findAllForTenant(TENANT_ID);

      expect(result).toEqual(records);
      expect(result).toHaveLength(3);
    });

    it('should filter by tenant_id and is_active=true', async () => {
      mockPrismaService.financial_category.findMany.mockResolvedValue([]);

      await service.findAllForTenant(TENANT_ID);

      expect(mockPrismaService.financial_category.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          is_active: true,
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    });

    it('should order results by type ascending then name ascending', async () => {
      mockPrismaService.financial_category.findMany.mockResolvedValue([]);

      await service.findAllForTenant(TENANT_ID);

      const callArgs = mockPrismaService.financial_category.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual([{ type: 'asc' }, { name: 'asc' }]);
    });

    it('should return empty array when no active categories exist', async () => {
      mockPrismaService.financial_category.findMany.mockResolvedValue([]);

      const result = await service.findAllForTenant(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('should not return categories from a different tenant', async () => {
      mockPrismaService.financial_category.findMany.mockResolvedValue([]);

      await service.findAllForTenant('other-tenant-uuid');

      expect(mockPrismaService.financial_category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'other-tenant-uuid',
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // createCategory()
  // -----------------------------------------------------------------------

  describe('createCategory()', () => {
    const dto: CreateFinancialCategoryDto = {
      name: 'Materials - Concrete',
      type: FinancialCategoryType.MATERIAL,
      description: 'Concrete and cement expenses',
    };

    it('should create a custom category with is_system_default=false', async () => {
      const createdRecord = mockCategoryRecord();
      mockPrismaService.financial_category.create.mockResolvedValue(createdRecord);

      const result = await service.createCategory(TENANT_ID, USER_ID, dto);

      expect(mockPrismaService.financial_category.create).toHaveBeenCalledWith({
        data: {
          tenant_id: TENANT_ID,
          name: dto.name,
          type: dto.type,
          description: dto.description,
          is_system_default: false,
          created_by_user_id: USER_ID,
        },
      });
      expect(result).toEqual(createdRecord);
    });

    it('should set description to null when not provided in dto', async () => {
      const dtoWithoutDescription: CreateFinancialCategoryDto = {
        name: 'Custom Category',
        type: FinancialCategoryType.OTHER,
      };
      const createdRecord = mockCategoryRecord({ description: null, name: 'Custom Category', type: 'other' });
      mockPrismaService.financial_category.create.mockResolvedValue(createdRecord);

      await service.createCategory(TENANT_ID, USER_ID, dtoWithoutDescription);

      expect(mockPrismaService.financial_category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: null,
        }),
      });
    });

    it('should include tenant_id and created_by_user_id in the created record', async () => {
      mockPrismaService.financial_category.create.mockResolvedValue(mockCategoryRecord());

      await service.createCategory(TENANT_ID, USER_ID, dto);

      expect(mockPrismaService.financial_category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_ID,
          created_by_user_id: USER_ID,
        }),
      });
    });

    it('should call auditLogger.logTenantChange with action "created"', async () => {
      const createdRecord = mockCategoryRecord();
      mockPrismaService.financial_category.create.mockResolvedValue(createdRecord);

      await service.createCategory(TENANT_ID, USER_ID, dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith({
        action: 'created',
        entityType: 'financial_category',
        entityId: createdRecord.id,
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        after: createdRecord,
        description: `Created financial category "${createdRecord.name}" (${createdRecord.type})`,
      });
    });

    it('should return the created category record', async () => {
      const createdRecord = mockCategoryRecord({ id: 'new-cat-uuid' });
      mockPrismaService.financial_category.create.mockResolvedValue(createdRecord);

      const result = await service.createCategory(TENANT_ID, USER_ID, dto);

      expect(result.id).toBe('new-cat-uuid');
      expect(result.name).toBe('Materials - Concrete');
      expect(result.type).toBe('material');
    });
  });

  // -----------------------------------------------------------------------
  // updateCategory()
  // -----------------------------------------------------------------------

  describe('updateCategory()', () => {
    const dto: UpdateFinancialCategoryDto = {
      name: 'Materials - Updated Name',
      description: 'Updated description',
    };

    it('should update name and description when both are provided', async () => {
      const existing = mockCategoryRecord();
      const updated = mockCategoryRecord({
        name: 'Materials - Updated Name',
        description: 'Updated description',
        updated_at: new Date('2026-02-01T10:00:00.000Z'),
      });
      mockPrismaService.financial_category.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_category.update.mockResolvedValue(updated);

      const result = await service.updateCategory(TENANT_ID, CATEGORY_ID, USER_ID, dto);

      expect(mockPrismaService.financial_category.update).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        data: {
          name: 'Materials - Updated Name',
          description: 'Updated description',
        },
      });
      expect(result).toEqual(updated);
    });

    it('should update only name when description is not provided', async () => {
      const nameOnlyDto: UpdateFinancialCategoryDto = { name: 'New Name Only' };
      const existing = mockCategoryRecord();
      const updated = mockCategoryRecord({ name: 'New Name Only' });
      mockPrismaService.financial_category.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_category.update.mockResolvedValue(updated);

      await service.updateCategory(TENANT_ID, CATEGORY_ID, USER_ID, nameOnlyDto);

      expect(mockPrismaService.financial_category.update).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        data: {
          name: 'New Name Only',
        },
      });
    });

    it('should update only description when name is not provided', async () => {
      const descOnlyDto: UpdateFinancialCategoryDto = { description: 'New desc only' };
      const existing = mockCategoryRecord();
      const updated = mockCategoryRecord({ description: 'New desc only' });
      mockPrismaService.financial_category.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_category.update.mockResolvedValue(updated);

      await service.updateCategory(TENANT_ID, CATEGORY_ID, USER_ID, descOnlyDto);

      expect(mockPrismaService.financial_category.update).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        data: {
          description: 'New desc only',
        },
      });
    });

    it('should look up the existing record by id and tenant_id', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategoryRecord());
      mockPrismaService.financial_category.update.mockResolvedValue(mockCategoryRecord());

      await service.updateCategory(TENANT_ID, CATEGORY_ID, USER_ID, dto);

      expect(mockPrismaService.financial_category.findFirst).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, tenant_id: TENANT_ID },
      });
    });

    it('should call auditLogger.logTenantChange with before and after state', async () => {
      const existing = mockCategoryRecord();
      const updated = mockCategoryRecord({
        name: 'Materials - Updated Name',
        description: 'Updated description',
      });
      mockPrismaService.financial_category.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_category.update.mockResolvedValue(updated);

      await service.updateCategory(TENANT_ID, CATEGORY_ID, USER_ID, dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith({
        action: 'updated',
        entityType: 'financial_category',
        entityId: CATEGORY_ID,
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        before: existing,
        after: updated,
        description: `Updated financial category "${updated.name}"`,
      });
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCategory(TENANT_ID, 'nonexistent-id', USER_ID, dto),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.updateCategory(TENANT_ID, 'nonexistent-id', USER_ID, dto),
      ).rejects.toThrow('Financial category not found');
    });

    it('should not call update or audit log when category is not found', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCategory(TENANT_ID, 'nonexistent-id', USER_ID, dto),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_category.update).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when tenant_id does not match (cross-tenant isolation)', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCategory('other-tenant-uuid', CATEGORY_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_category.findFirst).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, tenant_id: 'other-tenant-uuid' },
      });
    });
  });

  // -----------------------------------------------------------------------
  // deactivateCategory()
  // -----------------------------------------------------------------------

  describe('deactivateCategory()', () => {
    it('should set is_active to false for a custom category', async () => {
      const existing = mockCategoryRecord({ is_system_default: false });
      const deactivated = mockCategoryRecord({ is_system_default: false, is_active: false });
      mockPrismaService.financial_category.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_category.update.mockResolvedValue(deactivated);

      const result = await service.deactivateCategory(TENANT_ID, CATEGORY_ID, USER_ID);

      expect(mockPrismaService.financial_category.update).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        data: { is_active: false },
      });
      expect(result.is_active).toBe(false);
    });

    it('should look up the existing record by id and tenant_id', async () => {
      const existing = mockCategoryRecord({ is_system_default: false });
      mockPrismaService.financial_category.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_category.update.mockResolvedValue(
        mockCategoryRecord({ is_active: false }),
      );

      await service.deactivateCategory(TENANT_ID, CATEGORY_ID, USER_ID);

      expect(mockPrismaService.financial_category.findFirst).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, tenant_id: TENANT_ID },
      });
    });

    it('should call auditLogger.logTenantChange with action "deleted"', async () => {
      const existing = mockCategoryRecord({ is_system_default: false });
      const deactivated = mockCategoryRecord({ is_system_default: false, is_active: false });
      mockPrismaService.financial_category.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_category.update.mockResolvedValue(deactivated);

      await service.deactivateCategory(TENANT_ID, CATEGORY_ID, USER_ID);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith({
        action: 'deleted',
        entityType: 'financial_category',
        entityId: CATEGORY_ID,
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        before: existing,
        after: deactivated,
        description: `Deactivated financial category "${existing.name}"`,
      });
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivateCategory(TENANT_ID, 'nonexistent-id', USER_ID),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.deactivateCategory(TENANT_ID, 'nonexistent-id', USER_ID),
      ).rejects.toThrow('Financial category not found');
    });

    it('should not call update or audit log when category is not found', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivateCategory(TENANT_ID, 'nonexistent-id', USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_category.update).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when category is a system default', async () => {
      const systemDefault = mockCategoryRecord({ is_system_default: true, name: 'Labor - General' });
      mockPrismaService.financial_category.findFirst.mockResolvedValue(systemDefault);

      await expect(
        service.deactivateCategory(TENANT_ID, CATEGORY_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.deactivateCategory(TENANT_ID, CATEGORY_ID, USER_ID),
      ).rejects.toThrow('System default categories cannot be deactivated');
    });

    it('should not call update or audit log when category is a system default', async () => {
      const systemDefault = mockCategoryRecord({ is_system_default: true });
      mockPrismaService.financial_category.findFirst.mockResolvedValue(systemDefault);

      await expect(
        service.deactivateCategory(TENANT_ID, CATEGORY_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.financial_category.update).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for cross-tenant access attempt', async () => {
      mockPrismaService.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivateCategory('other-tenant-uuid', CATEGORY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_category.findFirst).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, tenant_id: 'other-tenant-uuid' },
      });
    });
  });

  // -----------------------------------------------------------------------
  // seedDefaultCategories()
  // -----------------------------------------------------------------------

  describe('seedDefaultCategories()', () => {
    it('should create all 9 default categories when none exist', async () => {
      mockPrismaService.financial_category.count.mockResolvedValue(0);
      mockPrismaService.financial_category.findMany.mockResolvedValue([]);
      mockPrismaService.financial_category.createMany.mockResolvedValue({ count: 9 });

      await service.seedDefaultCategories(TENANT_ID);

      expect(mockPrismaService.financial_category.createMany).toHaveBeenCalledTimes(1);

      const createManyCall = mockPrismaService.financial_category.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(9);

      // Verify each record has required fields
      for (const record of createManyCall.data) {
        expect(record.tenant_id).toBe(TENANT_ID);
        expect(record.is_system_default).toBe(true);
        expect(record.is_active).toBe(true);
        expect(record.created_by_user_id).toBeNull();
      }
    });

    it('should include all expected default category names and types', async () => {
      mockPrismaService.financial_category.count.mockResolvedValue(0);
      mockPrismaService.financial_category.findMany.mockResolvedValue([]);
      mockPrismaService.financial_category.createMany.mockResolvedValue({ count: 9 });

      await service.seedDefaultCategories(TENANT_ID);

      const createManyCall = mockPrismaService.financial_category.createMany.mock.calls[0][0];
      const createdNames = createManyCall.data.map((d: any) => d.name);

      expect(createdNames).toContain('Labor - General');
      expect(createdNames).toContain('Labor - Crew Overtime');
      expect(createdNames).toContain('Materials - General');
      expect(createdNames).toContain('Materials - Tools');
      expect(createdNames).toContain('Materials - Safety Equipment');
      expect(createdNames).toContain('Subcontractor - General');
      expect(createdNames).toContain('Equipment Rental');
      expect(createdNames).toContain('Fuel & Transportation');
      expect(createdNames).toContain('Miscellaneous');

      // Verify types are correct
      const laborGeneral = createManyCall.data.find((d: any) => d.name === 'Labor - General');
      expect(laborGeneral.type).toBe('labor');

      const materialsGeneral = createManyCall.data.find((d: any) => d.name === 'Materials - General');
      expect(materialsGeneral.type).toBe('material');

      const subcontractorGeneral = createManyCall.data.find((d: any) => d.name === 'Subcontractor - General');
      expect(subcontractorGeneral.type).toBe('subcontractor');

      const equipmentRental = createManyCall.data.find((d: any) => d.name === 'Equipment Rental');
      expect(equipmentRental.type).toBe('equipment');

      const fuelTransport = createManyCall.data.find((d: any) => d.name === 'Fuel & Transportation');
      expect(fuelTransport.type).toBe('other');
    });

    it('should skip seeding entirely when all 9 defaults already exist', async () => {
      mockPrismaService.financial_category.count.mockResolvedValue(9);

      await service.seedDefaultCategories(TENANT_ID);

      expect(mockPrismaService.financial_category.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.financial_category.createMany).not.toHaveBeenCalled();
    });

    it('should skip seeding when count exceeds 9', async () => {
      mockPrismaService.financial_category.count.mockResolvedValue(12);

      await service.seedDefaultCategories(TENANT_ID);

      expect(mockPrismaService.financial_category.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.financial_category.createMany).not.toHaveBeenCalled();
    });

    it('should create only missing categories when some already exist', async () => {
      mockPrismaService.financial_category.count.mockResolvedValue(3);
      mockPrismaService.financial_category.findMany.mockResolvedValue([
        { name: 'Labor - General' },
        { name: 'Materials - General' },
        { name: 'Miscellaneous' },
      ]);
      mockPrismaService.financial_category.createMany.mockResolvedValue({ count: 6 });

      await service.seedDefaultCategories(TENANT_ID);

      expect(mockPrismaService.financial_category.createMany).toHaveBeenCalledTimes(1);

      const createManyCall = mockPrismaService.financial_category.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(6);

      const createdNames = createManyCall.data.map((d: any) => d.name);
      expect(createdNames).not.toContain('Labor - General');
      expect(createdNames).not.toContain('Materials - General');
      expect(createdNames).not.toContain('Miscellaneous');

      expect(createdNames).toContain('Labor - Crew Overtime');
      expect(createdNames).toContain('Materials - Tools');
      expect(createdNames).toContain('Materials - Safety Equipment');
      expect(createdNames).toContain('Subcontractor - General');
      expect(createdNames).toContain('Equipment Rental');
      expect(createdNames).toContain('Fuel & Transportation');
    });

    it('should not call createMany when existing names cover all defaults (count < 9 but names match)', async () => {
      // Edge case: count is less than 9 but all names are accounted for
      // This could happen if count query is eventually consistent or a race condition
      mockPrismaService.financial_category.count.mockResolvedValue(8);
      mockPrismaService.financial_category.findMany.mockResolvedValue([
        { name: 'Labor - General' },
        { name: 'Labor - Crew Overtime' },
        { name: 'Materials - General' },
        { name: 'Materials - Tools' },
        { name: 'Materials - Safety Equipment' },
        { name: 'Subcontractor - General' },
        { name: 'Equipment Rental' },
        { name: 'Fuel & Transportation' },
        { name: 'Miscellaneous' },
      ]);

      await service.seedDefaultCategories(TENANT_ID);

      expect(mockPrismaService.financial_category.createMany).not.toHaveBeenCalled();
    });

    it('should query only system default categories for the given tenant', async () => {
      mockPrismaService.financial_category.count.mockResolvedValue(0);
      mockPrismaService.financial_category.findMany.mockResolvedValue([]);
      mockPrismaService.financial_category.createMany.mockResolvedValue({ count: 9 });

      await service.seedDefaultCategories(TENANT_ID);

      expect(mockPrismaService.financial_category.count).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          is_system_default: true,
        },
      });

      expect(mockPrismaService.financial_category.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          is_system_default: true,
        },
        select: { name: true },
      });
    });

    it('should set tenant_id on every created default category record', async () => {
      mockPrismaService.financial_category.count.mockResolvedValue(0);
      mockPrismaService.financial_category.findMany.mockResolvedValue([]);
      mockPrismaService.financial_category.createMany.mockResolvedValue({ count: 9 });

      const customTenantId = 'different-tenant-uuid';
      await service.seedDefaultCategories(customTenantId);

      const createManyCall = mockPrismaService.financial_category.createMany.mock.calls[0][0];
      for (const record of createManyCall.data) {
        expect(record.tenant_id).toBe(customTenantId);
      }
    });
  });
});
