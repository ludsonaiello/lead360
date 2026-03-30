import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FinancialEntryLineItemService } from './financial-entry-line-item.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const OTHER_TENANT_ID = 'tenant-uuid-999';
const USER_ID = 'user-uuid-001';
const OTHER_USER_ID = 'user-uuid-002';
const ENTRY_ID = 'entry-uuid-001';
const ITEM_ID = 'item-uuid-001';
const PRODUCT_ID = 'product-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockEntryRecord = (overrides: any = {}) => ({
  id: ENTRY_ID,
  tenant_id: TENANT_ID,
  created_by_user_id: USER_ID,
  submission_status: 'pending_review',
  ...overrides,
});

const mockLineItemRecord = (overrides: any = {}) => ({
  id: ITEM_ID,
  tenant_id: TENANT_ID,
  financial_entry_id: ENTRY_ID,
  description: '2x4 lumber',
  quantity: new Decimal(2),
  unit_price: new Decimal(10),
  total: new Decimal(20),
  unit_of_measure: 'each',
  supplier_product_id: null,
  order_index: 0,
  notes: null,
  created_at: new Date('2026-03-27T10:00:00.000Z'),
  updated_at: new Date('2026-03-27T10:00:00.000Z'),
  ...overrides,
});

const mockSupplierProduct = (overrides: any = {}) => ({
  id: PRODUCT_ID,
  tenant_id: TENANT_ID,
  name: 'Crushed Stone',
  unit_of_measure: 'ton',
  unit_price: new Decimal(45.5),
  is_active: true,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  financial_entry: {
    findFirst: jest.fn(),
  },
  financial_entry_line_item: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  supplier_product: {
    findFirst: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FinancialEntryLineItemService', () => {
  let service: FinancialEntryLineItemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialEntryLineItemService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<FinancialEntryLineItemService>(FinancialEntryLineItemService);
    jest.resetAllMocks();
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------

  describe('create()', () => {
    const dto = {
      description: '2x4 lumber',
      quantity: 2,
      unit_price: 10,
    };

    it('should create a line item and compute total', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(null);
      mockPrismaService.financial_entry_line_item.create.mockResolvedValue(
        mockLineItemRecord(),
      );

      const result = await service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], dto);

      const createCall = mockPrismaService.financial_entry_line_item.create.mock.calls[0][0];
      expect(Number(createCall.data.total)).toBe(20); // 2 * 10
      expect(result).toEqual(mockLineItemRecord());
    });

    it('should auto-fill from supplier product when supplier_product_id provided', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(mockSupplierProduct());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(null);
      mockPrismaService.financial_entry_line_item.create.mockResolvedValue(
        mockLineItemRecord({ supplier_product_id: PRODUCT_ID }),
      );

      await service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Owner'], {
        description: 'Stone',
        quantity: 1,
        unit_price: 45.5,
        supplier_product_id: PRODUCT_ID,
      });

      const createCall = mockPrismaService.financial_entry_line_item.create.mock.calls[0][0];
      expect(createCall.data.unit_of_measure).toBe('ton');
      expect(createCall.data.supplier_product_id).toBe(PRODUCT_ID);
    });

    it('should prefer user-provided values over supplier product auto-fill', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(mockSupplierProduct());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(null);
      mockPrismaService.financial_entry_line_item.create.mockResolvedValue(
        mockLineItemRecord(),
      );

      await service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Owner'], {
        description: 'Stone',
        quantity: 1,
        unit_price: 50, // user override
        unit_of_measure: 'bag', // user override
        supplier_product_id: PRODUCT_ID,
      });

      const createCall = mockPrismaService.financial_entry_line_item.create.mock.calls[0][0];
      expect(createCall.data.unit_of_measure).toBe('bag');
      expect(Number(createCall.data.unit_price)).toBe(50);
    });

    it('should auto-increment order_index when not provided', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(
        { order_index: 2 },
      );
      mockPrismaService.financial_entry_line_item.create.mockResolvedValue(
        mockLineItemRecord({ order_index: 3 }),
      );

      await service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Owner'], dto);

      const createCall = mockPrismaService.financial_entry_line_item.create.mock.calls[0][0];
      expect(createCall.data.order_index).toBe(3);
    });

    it('should use provided order_index when specified', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.create.mockResolvedValue(
        mockLineItemRecord({ order_index: 5 }),
      );

      await service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Owner'], {
        ...dto,
        order_index: 5,
      });

      const createCall = mockPrismaService.financial_entry_line_item.create.mock.calls[0][0];
      expect(createCall.data.order_index).toBe(5);
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Owner'], dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when Employee adds to another users entry', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(
        mockEntryRecord({ created_by_user_id: OTHER_USER_ID }),
      );

      await expect(
        service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when Employee adds to confirmed entry', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(
        mockEntryRecord({ submission_status: 'confirmed' }),
      );

      await expect(
        service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Employee to add to their own denied entry', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(
        mockEntryRecord({ submission_status: 'denied' }),
      );
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(null);
      mockPrismaService.financial_entry_line_item.create.mockResolvedValue(
        mockLineItemRecord(),
      );

      const result = await service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Employee'], dto);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when supplier product is invalid', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Owner'], {
          ...dto,
          supplier_product_id: 'bad-uuid',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include tenant_id in the created line item', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(null);
      mockPrismaService.financial_entry_line_item.create.mockResolvedValue(
        mockLineItemRecord(),
      );

      await service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Owner'], dto);

      const createCall = mockPrismaService.financial_entry_line_item.create.mock.calls[0][0];
      expect(createCall.data.tenant_id).toBe(TENANT_ID);
    });

    it('should call auditLogger with action "created"', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(null);
      mockPrismaService.financial_entry_line_item.create.mockResolvedValue(
        mockLineItemRecord(),
      );

      await service.create(TENANT_ID, ENTRY_ID, USER_ID, ['Owner'], dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'financial_entry_line_item',
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // findAll()
  // -----------------------------------------------------------------------

  describe('findAll()', () => {
    it('should return line items ordered by order_index', async () => {
      const items = [
        mockLineItemRecord({ id: 'i-1', order_index: 0 }),
        mockLineItemRecord({ id: 'i-2', order_index: 1 }),
      ];
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findMany.mockResolvedValue(items);

      const result = await service.findAll(TENANT_ID, ENTRY_ID, USER_ID, ['Owner']);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.financial_entry_line_item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_ID, financial_entry_id: ENTRY_ID },
          orderBy: { order_index: 'asc' },
        }),
      );
    });

    it('should return empty array when no line items exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findMany.mockResolvedValue([]);

      const result = await service.findAll(TENANT_ID, ENTRY_ID, USER_ID, ['Owner']);
      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(TENANT_ID, ENTRY_ID, USER_ID, ['Owner']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce cross-tenant isolation', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(OTHER_TENANT_ID, ENTRY_ID, USER_ID, ['Owner']),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.financial_entry.findFirst).toHaveBeenCalledWith({
        where: { id: ENTRY_ID, tenant_id: OTHER_TENANT_ID },
      });
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------

  describe('update()', () => {
    it('should update description and return updated item', async () => {
      const existing = mockLineItemRecord();
      const updated = mockLineItemRecord({ description: 'Updated lumber' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry_line_item.update.mockResolvedValue(updated);

      const result = await service.update(
        TENANT_ID, ENTRY_ID, ITEM_ID, USER_ID, ['Owner'],
        { description: 'Updated lumber' },
      );

      expect(result.description).toBe('Updated lumber');
    });

    it('should recompute total when quantity changes', async () => {
      const existing = mockLineItemRecord({ quantity: new Decimal(2), unit_price: new Decimal(10) });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry_line_item.update.mockResolvedValue(
        mockLineItemRecord({ quantity: new Decimal(5), total: new Decimal(50) }),
      );

      await service.update(
        TENANT_ID, ENTRY_ID, ITEM_ID, USER_ID, ['Owner'],
        { quantity: 5 },
      );

      const updateCall = mockPrismaService.financial_entry_line_item.update.mock.calls[0][0];
      expect(Number(updateCall.data.total)).toBe(50); // 5 * 10
    });

    it('should recompute total when unit_price changes', async () => {
      const existing = mockLineItemRecord({ quantity: new Decimal(2), unit_price: new Decimal(10) });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry_line_item.update.mockResolvedValue(
        mockLineItemRecord({ unit_price: new Decimal(15), total: new Decimal(30) }),
      );

      await service.update(
        TENANT_ID, ENTRY_ID, ITEM_ID, USER_ID, ['Owner'],
        { unit_price: 15 },
      );

      const updateCall = mockPrismaService.financial_entry_line_item.update.mock.calls[0][0];
      expect(Number(updateCall.data.total)).toBe(30); // 2 * 15
    });

    it('should NOT recompute total when only notes change', async () => {
      const existing = mockLineItemRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry_line_item.update.mockResolvedValue(
        mockLineItemRecord({ notes: 'updated note' }),
      );

      await service.update(
        TENANT_ID, ENTRY_ID, ITEM_ID, USER_ID, ['Owner'],
        { notes: 'updated note' },
      );

      const updateCall = mockPrismaService.financial_entry_line_item.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('total');
    });

    it('should throw NotFoundException when line item does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, ENTRY_ID, 'nonexistent', USER_ID, ['Owner'], { description: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate supplier_product_id if provided', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(mockLineItemRecord());
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, ENTRY_ID, ITEM_ID, USER_ID, ['Owner'], {
          supplier_product_id: 'bad-uuid',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call auditLogger with before/after', async () => {
      const existing = mockLineItemRecord();
      const updated = mockLineItemRecord({ description: 'Changed' });
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry_line_item.update.mockResolvedValue(updated);

      await service.update(
        TENANT_ID, ENTRY_ID, ITEM_ID, USER_ID, ['Owner'],
        { description: 'Changed' },
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'financial_entry_line_item',
          before: existing,
          after: updated,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------

  describe('delete()', () => {
    it('should delete a line item and return success message', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(mockLineItemRecord());
      mockPrismaService.financial_entry_line_item.delete.mockResolvedValue(mockLineItemRecord());

      const result = await service.delete(TENANT_ID, ENTRY_ID, ITEM_ID, USER_ID, ['Owner']);

      expect(result).toEqual({ message: 'Line item deleted successfully.' });
      expect(mockPrismaService.financial_entry_line_item.delete).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
      });
    });

    it('should throw NotFoundException when line item does not exist', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(TENANT_ID, ENTRY_ID, 'nonexistent', USER_ID, ['Owner']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce RBAC — Employee cannot delete on others entry', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(
        mockEntryRecord({ created_by_user_id: OTHER_USER_ID }),
      );

      await expect(
        service.delete(TENANT_ID, ENTRY_ID, ITEM_ID, USER_ID, ['Employee']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should call auditLogger with action "deleted"', async () => {
      const existing = mockLineItemRecord();
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(mockEntryRecord());
      mockPrismaService.financial_entry_line_item.findFirst.mockResolvedValue(existing);
      mockPrismaService.financial_entry_line_item.delete.mockResolvedValue(existing);

      await service.delete(TENANT_ID, ENTRY_ID, ITEM_ID, USER_ID, ['Owner']);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'financial_entry_line_item',
          entityId: ITEM_ID,
          before: existing,
        }),
      );
    });

    it('should enforce cross-tenant isolation', async () => {
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(OTHER_TENANT_ID, ENTRY_ID, ITEM_ID, USER_ID, ['Owner']),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
