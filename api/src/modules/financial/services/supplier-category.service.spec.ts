import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupplierCategoryService } from './supplier-category.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateSupplierCategoryDto } from '../dto/create-supplier-category.dto';
import { UpdateSupplierCategoryDto } from '../dto/update-supplier-category.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const OTHER_TENANT_ID = 'tenant-uuid-999';
const USER_ID = 'user-uuid-001';
const CATEGORY_ID = 'category-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockCategoryRecord = (overrides: any = {}) => ({
  id: CATEGORY_ID,
  tenant_id: TENANT_ID,
  name: 'Roofing Materials',
  description: 'Shingles, underlayment, flashing',
  color: '#3B82F6',
  is_active: true,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-03-18T10:00:00.000Z'),
  updated_at: new Date('2026-03-18T10:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  supplier_category: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  supplier_category_assignment: {
    count: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupplierCategoryService', () => {
  let service: SupplierCategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierCategoryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<SupplierCategoryService>(SupplierCategoryService);

    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------

  describe('create()', () => {
    const dto: CreateSupplierCategoryDto = {
      name: 'Roofing Materials',
      description: 'Shingles, underlayment, flashing',
      color: '#3B82F6',
    };

    it('should create a supplier category successfully', async () => {
      const createdRecord = mockCategoryRecord();
      mockPrismaService.supplier_category.count.mockResolvedValue(5);
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_category.create.mockResolvedValue(
        createdRecord,
      );

      const result = await service.create(TENANT_ID, USER_ID, dto);

      expect(result).toEqual(createdRecord);
      expect(mockPrismaService.supplier_category.create).toHaveBeenCalledWith({
        data: {
          tenant_id: TENANT_ID,
          name: dto.name,
          description: dto.description,
          color: dto.color,
          created_by_user_id: USER_ID,
        },
      });
    });

    it('should include tenant_id in the 50-limit count query', async () => {
      mockPrismaService.supplier_category.count.mockResolvedValue(0);
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_category.create.mockResolvedValue(
        mockCategoryRecord(),
      );

      await service.create(TENANT_ID, USER_ID, dto);

      expect(mockPrismaService.supplier_category.count).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, is_active: true },
      });
    });

    it('should throw BadRequestException when tenant has 50 active categories', async () => {
      mockPrismaService.supplier_category.count.mockResolvedValue(50);

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(
        'Maximum of 50 active supplier categories per tenant. Deactivate unused categories before creating new ones.',
      );

      expect(
        mockPrismaService.supplier_category.findFirst,
      ).not.toHaveBeenCalled();
      expect(
        mockPrismaService.supplier_category.create,
      ).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when tenant exceeds 50 active categories', async () => {
      mockPrismaService.supplier_category.count.mockResolvedValue(75);

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should check uniqueness with tenant_id filter', async () => {
      mockPrismaService.supplier_category.count.mockResolvedValue(10);
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_category.create.mockResolvedValue(
        mockCategoryRecord(),
      );

      await service.create(TENANT_ID, USER_ID, dto);

      expect(
        mockPrismaService.supplier_category.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          name: dto.name,
        },
      });
    });

    it('should throw ConflictException when category name already exists', async () => {
      mockPrismaService.supplier_category.count.mockResolvedValue(5);
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        mockCategoryRecord(),
      );

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(
        `Supplier category "${dto.name}" already exists for this tenant.`,
      );

      expect(
        mockPrismaService.supplier_category.create,
      ).not.toHaveBeenCalled();
    });

    it('should set description to null when not provided', async () => {
      const dtoWithoutOptionals: CreateSupplierCategoryDto = {
        name: 'Electrical',
      };
      mockPrismaService.supplier_category.count.mockResolvedValue(0);
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_category.create.mockResolvedValue(
        mockCategoryRecord({ description: null, color: null }),
      );

      await service.create(TENANT_ID, USER_ID, dtoWithoutOptionals);

      expect(mockPrismaService.supplier_category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: null,
          color: null,
        }),
      });
    });

    it('should call auditLogger.logTenantChange with action "created"', async () => {
      const createdRecord = mockCategoryRecord();
      mockPrismaService.supplier_category.count.mockResolvedValue(0);
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_category.create.mockResolvedValue(
        createdRecord,
      );

      await service.create(TENANT_ID, USER_ID, dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith({
        action: 'created',
        entityType: 'supplier_category',
        entityId: createdRecord.id,
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        after: createdRecord,
        description: `Supplier category created: ${createdRecord.name}`,
      });
    });

    it('should not call audit logger when creation is blocked by limit', async () => {
      mockPrismaService.supplier_category.count.mockResolvedValue(50);

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(BadRequestException);

      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should not call audit logger when creation is blocked by uniqueness', async () => {
      mockPrismaService.supplier_category.count.mockResolvedValue(5);
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        mockCategoryRecord(),
      );

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(ConflictException);

      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // findAll()
  // -----------------------------------------------------------------------

  describe('findAll()', () => {
    it('should return all categories for a tenant with supplier counts', async () => {
      const categories = [
        mockCategoryRecord({ id: 'cat-001', name: 'Electrical' }),
        mockCategoryRecord({ id: 'cat-002', name: 'Plumbing' }),
      ];
      mockPrismaService.supplier_category.findMany.mockResolvedValue(
        categories,
      );
      mockPrismaService.supplier_category_assignment.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(7);

      const result = await service.findAll(TENANT_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ ...categories[0], supplier_count: 3 });
      expect(result[1]).toEqual({ ...categories[1], supplier_count: 7 });
    });

    it('should filter by tenant_id in the query', async () => {
      mockPrismaService.supplier_category.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID);

      expect(
        mockPrismaService.supplier_category.findMany,
      ).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by is_active when provided as true', async () => {
      mockPrismaService.supplier_category.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, true);

      expect(
        mockPrismaService.supplier_category.findMany,
      ).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, is_active: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by is_active when provided as false', async () => {
      mockPrismaService.supplier_category.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, false);

      expect(
        mockPrismaService.supplier_category.findMany,
      ).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, is_active: false },
        orderBy: { name: 'asc' },
      });
    });

    it('should not include is_active in where when not provided', async () => {
      mockPrismaService.supplier_category.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID);

      expect(
        mockPrismaService.supplier_category.findMany,
      ).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID },
        orderBy: { name: 'asc' },
      });
    });

    it('should order categories by name ascending', async () => {
      mockPrismaService.supplier_category.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID);

      const callArgs =
        mockPrismaService.supplier_category.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ name: 'asc' });
    });

    it('should count only active suppliers in supplier_count', async () => {
      const categories = [mockCategoryRecord({ id: 'cat-001' })];
      mockPrismaService.supplier_category.findMany.mockResolvedValue(
        categories,
      );
      mockPrismaService.supplier_category_assignment.count.mockResolvedValue(5);

      await service.findAll(TENANT_ID);

      expect(
        mockPrismaService.supplier_category_assignment.count,
      ).toHaveBeenCalledWith({
        where: {
          supplier_category_id: 'cat-001',
          tenant_id: TENANT_ID,
          supplier: { is_active: true },
        },
      });
    });

    it('should return empty array when no categories exist', async () => {
      mockPrismaService.supplier_category.findMany.mockResolvedValue([]);

      const result = await service.findAll(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('should not return categories from a different tenant', async () => {
      mockPrismaService.supplier_category.findMany.mockResolvedValue([]);

      await service.findAll(OTHER_TENANT_ID);

      expect(
        mockPrismaService.supplier_category.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: OTHER_TENANT_ID,
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // findOne()
  // -----------------------------------------------------------------------

  describe('findOne()', () => {
    it('should return a category when found in the correct tenant', async () => {
      const record = mockCategoryRecord();
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(record);

      const result = await service.findOne(TENANT_ID, CATEGORY_ID);

      expect(result).toEqual(record);
      expect(
        mockPrismaService.supplier_category.findFirst,
      ).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, tenant_id: TENANT_ID },
      });
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.findOne(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow('Supplier category not found.');
    });

    it('should throw NotFoundException for cross-tenant access attempt', async () => {
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(OTHER_TENANT_ID, CATEGORY_ID),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.supplier_category.findFirst,
      ).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, tenant_id: OTHER_TENANT_ID },
      });
    });

    it('should include both id and tenant_id in the query for isolation', async () => {
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        mockCategoryRecord(),
      );

      await service.findOne(TENANT_ID, CATEGORY_ID);

      expect(
        mockPrismaService.supplier_category.findFirst,
      ).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, tenant_id: TENANT_ID },
      });
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------

  describe('update()', () => {
    const dto: UpdateSupplierCategoryDto = {
      name: 'Updated Roofing',
      description: 'Updated description',
    };

    it('should update a category successfully', async () => {
      const existing = mockCategoryRecord();
      const updated = mockCategoryRecord({
        name: 'Updated Roofing',
        description: 'Updated description',
        updated_at: new Date('2026-03-18T12:00:00.000Z'),
      });
      mockPrismaService.supplier_category.findFirst
        .mockResolvedValueOnce(existing) // findOne lookup
        .mockResolvedValueOnce(null); // uniqueness check (no duplicate)
      mockPrismaService.supplier_category.update.mockResolvedValue(updated);

      const result = await service.update(
        TENANT_ID,
        CATEGORY_ID,
        USER_ID,
        dto,
      );

      expect(result).toEqual(updated);
    });

    it('should update only provided fields using conditional spread', async () => {
      const existing = mockCategoryRecord();
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category.update.mockResolvedValue(existing);

      const partialDto: UpdateSupplierCategoryDto = { color: '#FF0000' };
      await service.update(TENANT_ID, CATEGORY_ID, USER_ID, partialDto);

      expect(mockPrismaService.supplier_category.update).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        data: { color: '#FF0000' },
      });
    });

    it('should check name uniqueness when name is being changed', async () => {
      const existing = mockCategoryRecord({ name: 'Old Name' });
      mockPrismaService.supplier_category.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null); // no duplicate
      mockPrismaService.supplier_category.update.mockResolvedValue(
        mockCategoryRecord({ name: 'New Name' }),
      );

      await service.update(TENANT_ID, CATEGORY_ID, USER_ID, {
        name: 'New Name',
      });

      // Second findFirst call is for uniqueness check
      expect(
        mockPrismaService.supplier_category.findFirst,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          tenant_id: TENANT_ID,
          name: 'New Name',
          id: { not: CATEGORY_ID },
        },
      });
    });

    it('should skip uniqueness check when name is not changed (same value, case-insensitive)', async () => {
      const existing = mockCategoryRecord({ name: 'Roofing Materials' });
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category.update.mockResolvedValue(existing);

      await service.update(TENANT_ID, CATEGORY_ID, USER_ID, {
        name: 'roofing materials', // same name different case
      });

      // findFirst called only once (the findOne lookup) — no uniqueness check
      expect(
        mockPrismaService.supplier_category.findFirst,
      ).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when new name already exists', async () => {
      const existing = mockCategoryRecord({ name: 'Old Name' });
      const duplicate = mockCategoryRecord({
        id: 'other-cat-id',
        name: 'Duplicate Name',
      });
      mockPrismaService.supplier_category.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(duplicate);

      await expect(
        service.update(TENANT_ID, CATEGORY_ID, USER_ID, {
          name: 'Duplicate Name',
        }),
      ).rejects.toThrow(ConflictException);

      expect(
        mockPrismaService.supplier_category.update,
      ).not.toHaveBeenCalled();
    });

    it('should check 50-limit when reactivating an inactive category', async () => {
      const existing = mockCategoryRecord({ is_active: false });
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category.count.mockResolvedValue(49);
      mockPrismaService.supplier_category.update.mockResolvedValue(
        mockCategoryRecord({ is_active: true }),
      );

      await service.update(TENANT_ID, CATEGORY_ID, USER_ID, {
        is_active: true,
      });

      expect(mockPrismaService.supplier_category.count).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, is_active: true },
      });
    });

    it('should throw BadRequestException when reactivating exceeds 50 limit', async () => {
      const existing = mockCategoryRecord({ is_active: false });
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category.count.mockResolvedValue(50);

      await expect(
        service.update(TENANT_ID, CATEGORY_ID, USER_ID, { is_active: true }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.update(TENANT_ID, CATEGORY_ID, USER_ID, { is_active: true }),
      ).rejects.toThrow(
        'Maximum of 50 active supplier categories per tenant.',
      );

      expect(
        mockPrismaService.supplier_category.update,
      ).not.toHaveBeenCalled();
    });

    it('should not check 50-limit when setting is_active on already-active category', async () => {
      const existing = mockCategoryRecord({ is_active: true });
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category.update.mockResolvedValue(existing);

      await service.update(TENANT_ID, CATEGORY_ID, USER_ID, {
        is_active: true,
      });

      expect(
        mockPrismaService.supplier_category.count,
      ).not.toHaveBeenCalled();
    });

    it('should not check 50-limit when deactivating', async () => {
      const existing = mockCategoryRecord({ is_active: true });
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category.update.mockResolvedValue(
        mockCategoryRecord({ is_active: false }),
      );

      await service.update(TENANT_ID, CATEGORY_ID, USER_ID, {
        is_active: false,
      });

      expect(
        mockPrismaService.supplier_category.count,
      ).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, 'nonexistent-id', USER_ID, dto),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.supplier_category.update,
      ).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should call auditLogger with before and after state', async () => {
      const existing = mockCategoryRecord();
      const updated = mockCategoryRecord({
        name: 'Updated Roofing',
        description: 'Updated description',
      });
      mockPrismaService.supplier_category.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      mockPrismaService.supplier_category.update.mockResolvedValue(updated);

      await service.update(TENANT_ID, CATEGORY_ID, USER_ID, dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith({
        action: 'updated',
        entityType: 'supplier_category',
        entityId: CATEGORY_ID,
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        before: existing,
        after: updated,
        description: `Supplier category updated: ${updated.name}`,
      });
    });

    it('should throw NotFoundException for cross-tenant update attempt', async () => {
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(OTHER_TENANT_ID, CATEGORY_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------

  describe('delete()', () => {
    it('should hard delete a category with no assignments', async () => {
      const existing = mockCategoryRecord();
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category_assignment.count.mockResolvedValue(0);
      mockPrismaService.supplier_category.delete.mockResolvedValue(existing);

      const result = await service.delete(TENANT_ID, CATEGORY_ID, USER_ID);

      expect(result).toEqual({
        message: 'Supplier category deleted successfully',
      });
      expect(mockPrismaService.supplier_category.delete).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
      });
    });

    it('should check assignment count with tenant_id filter', async () => {
      const existing = mockCategoryRecord();
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category_assignment.count.mockResolvedValue(0);
      mockPrismaService.supplier_category.delete.mockResolvedValue(existing);

      await service.delete(TENANT_ID, CATEGORY_ID, USER_ID);

      expect(
        mockPrismaService.supplier_category_assignment.count,
      ).toHaveBeenCalledWith({
        where: {
          supplier_category_id: CATEGORY_ID,
          tenant_id: TENANT_ID,
        },
      });
    });

    it('should throw ConflictException when category has supplier assignments', async () => {
      const existing = mockCategoryRecord();
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category_assignment.count.mockResolvedValue(3);

      await expect(
        service.delete(TENANT_ID, CATEGORY_ID, USER_ID),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.delete(TENANT_ID, CATEGORY_ID, USER_ID),
      ).rejects.toThrow(
        'Category is assigned to one or more suppliers. Deactivate it instead.',
      );

      expect(
        mockPrismaService.supplier_category.delete,
      ).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(TENANT_ID, 'nonexistent-id', USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.supplier_category_assignment.count,
      ).not.toHaveBeenCalled();
      expect(
        mockPrismaService.supplier_category.delete,
      ).not.toHaveBeenCalled();
    });

    it('should call auditLogger with action "deleted" and before state', async () => {
      const existing = mockCategoryRecord();
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category_assignment.count.mockResolvedValue(0);
      mockPrismaService.supplier_category.delete.mockResolvedValue(existing);

      await service.delete(TENANT_ID, CATEGORY_ID, USER_ID);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith({
        action: 'deleted',
        entityType: 'supplier_category',
        entityId: CATEGORY_ID,
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        before: existing,
        description: `Supplier category deleted: ${existing.name}`,
      });
    });

    it('should not call audit logger when delete is blocked by assignments', async () => {
      const existing = mockCategoryRecord();
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.supplier_category_assignment.count.mockResolvedValue(1);

      await expect(
        service.delete(TENANT_ID, CATEGORY_ID, USER_ID),
      ).rejects.toThrow(ConflictException);

      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for cross-tenant delete attempt', async () => {
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(OTHER_TENANT_ID, CATEGORY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.supplier_category.findFirst,
      ).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, tenant_id: OTHER_TENANT_ID },
      });
    });

    it('should block delete even if assignment is to an inactive supplier', async () => {
      const existing = mockCategoryRecord();
      mockPrismaService.supplier_category.findFirst.mockResolvedValue(
        existing,
      );
      // Assignment exists (doesn't matter if supplier is active or not)
      mockPrismaService.supplier_category_assignment.count.mockResolvedValue(1);

      await expect(
        service.delete(TENANT_ID, CATEGORY_ID, USER_ID),
      ).rejects.toThrow(ConflictException);

      // Confirm the count query does NOT filter by supplier.is_active
      expect(
        mockPrismaService.supplier_category_assignment.count,
      ).toHaveBeenCalledWith({
        where: {
          supplier_category_id: CATEGORY_ID,
          tenant_id: TENANT_ID,
        },
      });
    });
  });
});
