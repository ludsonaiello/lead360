import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupplierProductService } from './supplier-product.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateSupplierProductDto } from '../dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from '../dto/update-supplier-product.dto';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const OTHER_TENANT_ID = 'tenant-uuid-999';
const USER_ID = 'user-uuid-001';
const SUPPLIER_ID = 'supplier-uuid-001';
const PRODUCT_ID = 'product-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockSupplierRecord = (overrides: any = {}) => ({
  id: SUPPLIER_ID,
  tenant_id: TENANT_ID,
  name: 'ABC Building Supply',
  is_active: true,
  created_at: new Date('2026-03-18T10:00:00.000Z'),
  updated_at: new Date('2026-03-18T10:00:00.000Z'),
  ...overrides,
});

const mockProductRecord = (overrides: any = {}) => ({
  id: PRODUCT_ID,
  tenant_id: TENANT_ID,
  supplier_id: SUPPLIER_ID,
  name: 'Crushed Stone',
  description: '#57 crushed limestone',
  unit_of_measure: 'ton',
  unit_price: new Decimal(45.5),
  price_last_updated_at: new Date('2026-03-18'),
  price_last_updated_by_user_id: USER_ID,
  sku: 'CS-57-LM',
  is_active: true,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-03-18T10:00:00.000Z'),
  updated_at: new Date('2026-03-18T10:00:00.000Z'),
  ...overrides,
});

const mockPriceHistoryRecord = (overrides: any = {}) => ({
  id: 'history-uuid-001',
  tenant_id: TENANT_ID,
  supplier_product_id: PRODUCT_ID,
  supplier_id: SUPPLIER_ID,
  previous_price: null,
  new_price: new Decimal(45.5),
  changed_by_user_id: USER_ID,
  changed_at: new Date('2026-03-18T10:00:00.000Z'),
  notes: 'Initial price set on product creation',
  changed_by: { id: USER_ID, first_name: 'John', last_name: 'Doe' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

// Transaction mock: executes the callback with the mock prisma service
const createMockTx = (mockPrisma: any) => {
  return (callback: (tx: any) => Promise<any>) => callback(mockPrisma);
};

const mockPrismaService = {
  supplier: {
    findFirst: jest.fn(),
  },
  supplier_product: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  supplier_product_price_history: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupplierProductService', () => {
  let service: SupplierProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierProductService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<SupplierProductService>(SupplierProductService);

    jest.resetAllMocks();

    // Default: $transaction passes through to callback with mock prisma
    mockPrismaService.$transaction.mockImplementation(
      createMockTx(mockPrismaService),
    );
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------

  describe('create()', () => {
    const dto: CreateSupplierProductDto = {
      name: 'Crushed Stone',
      description: '#57 crushed limestone',
      unit_of_measure: 'ton',
      unit_price: 45.5,
      sku: 'CS-57-LM',
    };

    it('should create a supplier product successfully with price', async () => {
      const createdRecord = mockProductRecord();
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_product.create.mockResolvedValue(
        createdRecord,
      );
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      const result = await service.create(
        TENANT_ID,
        SUPPLIER_ID,
        USER_ID,
        dto,
      );

      expect(result).toEqual(createdRecord);
      expect(mockPrismaService.supplier_product.create).toHaveBeenCalledTimes(1);
      expect(
        mockPrismaService.supplier_product_price_history.create,
      ).toHaveBeenCalledTimes(1);
    });

    it('should create product WITHOUT price history when unit_price is not provided', async () => {
      const dtoNoPrice: CreateSupplierProductDto = {
        name: 'Gravel',
        unit_of_measure: 'yard',
      };
      const createdRecord = mockProductRecord({
        name: 'Gravel',
        unit_price: null,
        price_last_updated_at: null,
        price_last_updated_by_user_id: null,
        sku: null,
      });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_product.create.mockResolvedValue(
        createdRecord,
      );

      const result = await service.create(
        TENANT_ID,
        SUPPLIER_ID,
        USER_ID,
        dtoNoPrice,
      );

      expect(result).toEqual(createdRecord);
      expect(
        mockPrismaService.supplier_product_price_history.create,
      ).not.toHaveBeenCalled();
    });

    it('should set price_last_updated fields when unit_price is provided', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_product.create.mockResolvedValue(
        mockProductRecord(),
      );
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dto);

      const createCall =
        mockPrismaService.supplier_product.create.mock.calls[0][0];
      expect(createCall.data.price_last_updated_at).toBeInstanceOf(Date);
      expect(createCall.data.price_last_updated_by_user_id).toBe(USER_ID);
    });

    it('should set price fields to null when unit_price is not provided', async () => {
      const dtoNoPrice: CreateSupplierProductDto = {
        name: 'Sand',
        unit_of_measure: 'ton',
      };
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_product.create.mockResolvedValue(
        mockProductRecord({ unit_price: null }),
      );

      await service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dtoNoPrice);

      const createCall =
        mockPrismaService.supplier_product.create.mock.calls[0][0];
      expect(createCall.data.unit_price).toBeNull();
      expect(createCall.data.price_last_updated_at).toBeNull();
      expect(createCall.data.price_last_updated_by_user_id).toBeNull();
    });

    it('should verify supplier exists with tenant_id filter', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID, tenant_id: TENANT_ID },
      });
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, 'nonexistent-supplier', USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.create(TENANT_ID, 'nonexistent-supplier', USER_ID, dto),
      ).rejects.toThrow('Supplier not found.');

      expect(
        mockPrismaService.supplier_product.findFirst,
      ).not.toHaveBeenCalled();
      expect(
        mockPrismaService.supplier_product.create,
      ).not.toHaveBeenCalled();
    });

    it('should check name uniqueness with supplier_id and tenant_id', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_product.create.mockResolvedValue(
        mockProductRecord(),
      );
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dto);

      expect(
        mockPrismaService.supplier_product.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          supplier_id: SUPPLIER_ID,
          tenant_id: TENANT_ID,
          name: dto.name,
        },
      });
    });

    it('should throw ConflictException when product name already exists for supplier', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(
        mockProductRecord(),
      );

      await expect(
        service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dto),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dto),
      ).rejects.toThrow(
        `Product "${dto.name}" already exists for this supplier.`,
      );

      expect(
        mockPrismaService.supplier_product.create,
      ).not.toHaveBeenCalled();
    });

    it('should use a transaction for product + price history creation', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_product.create.mockResolvedValue(
        mockProductRecord(),
      );
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dto);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should create price history with previous_price = null for initial price', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_product.create.mockResolvedValue(
        mockProductRecord(),
      );
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dto);

      const historyCall =
        mockPrismaService.supplier_product_price_history.create.mock
          .calls[0][0];
      expect(historyCall.data.previous_price).toBeNull();
      expect(historyCall.data.notes).toBe(
        'Initial price set on product creation',
      );
    });

    it('should include tenant_id in price history record', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_product.create.mockResolvedValue(
        mockProductRecord(),
      );
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dto);

      const historyCall =
        mockPrismaService.supplier_product_price_history.create.mock
          .calls[0][0];
      expect(historyCall.data.tenant_id).toBe(TENANT_ID);
      expect(historyCall.data.supplier_id).toBe(SUPPLIER_ID);
    });

    it('should call auditLogger.logTenantChange with action "created"', async () => {
      const createdRecord = mockProductRecord();
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_product.create.mockResolvedValue(
        createdRecord,
      );
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith({
        action: 'created',
        entityType: 'supplier_product',
        entityId: expect.any(String),
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        after: createdRecord,
        description: `Supplier product created: ${createdRecord.name}`,
      });
    });

    it('should not call audit logger when creation is blocked', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, SUPPLIER_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should set optional fields to null when not provided', async () => {
      const minimalDto: CreateSupplierProductDto = {
        name: 'Paver Blocks',
        unit_of_measure: 'each',
      };
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier_product.create.mockResolvedValue(
        mockProductRecord({ description: null, sku: null, unit_price: null }),
      );

      await service.create(TENANT_ID, SUPPLIER_ID, USER_ID, minimalDto);

      const createCall =
        mockPrismaService.supplier_product.create.mock.calls[0][0];
      expect(createCall.data.description).toBeNull();
      expect(createCall.data.sku).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // findOne()
  // -----------------------------------------------------------------------

  describe('findOne()', () => {
    it('should return a product when found', async () => {
      const product = mockProductRecord();
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(product);

      const result = await service.findOne(TENANT_ID, SUPPLIER_ID, PRODUCT_ID);

      expect(result).toEqual(product);
    });

    it('should query with tenant_id, supplier_id, and product id', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(
        mockProductRecord(),
      );

      await service.findOne(TENANT_ID, SUPPLIER_ID, PRODUCT_ID);

      expect(
        mockPrismaService.supplier_product.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: PRODUCT_ID,
          supplier_id: SUPPLIER_ID,
          tenant_id: TENANT_ID,
        },
      });
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_ID, SUPPLIER_ID, PRODUCT_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne(TENANT_ID, SUPPLIER_ID, PRODUCT_ID),
      ).rejects.toThrow('Supplier not found.');
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_ID, SUPPLIER_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne(TENANT_ID, SUPPLIER_ID, 'nonexistent'),
      ).rejects.toThrow('Supplier product not found.');
    });

    it('should enforce cross-tenant isolation', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(OTHER_TENANT_ID, SUPPLIER_ID, PRODUCT_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID, tenant_id: OTHER_TENANT_ID },
      });
    });
  });

  // -----------------------------------------------------------------------
  // findAll()
  // -----------------------------------------------------------------------

  describe('findAll()', () => {
    it('should return active products sorted by name for a supplier', async () => {
      const products = [
        mockProductRecord({ id: 'p-001', name: 'Asphalt' }),
        mockProductRecord({ id: 'p-002', name: 'Concrete' }),
      ];
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findMany.mockResolvedValue(products);

      const result = await service.findAll(TENANT_ID, SUPPLIER_ID);

      expect(result).toEqual(products);
      expect(result).toHaveLength(2);
    });

    it('should default to is_active = true when isActive not specified', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, SUPPLIER_ID);

      expect(
        mockPrismaService.supplier_product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: TENANT_ID,
            supplier_id: SUPPLIER_ID,
            is_active: true,
          },
        }),
      );
    });

    it('should filter by is_active = false when explicitly passed', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, SUPPLIER_ID, false);

      expect(
        mockPrismaService.supplier_product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: TENANT_ID,
            supplier_id: SUPPLIER_ID,
            is_active: false,
          },
        }),
      );
    });

    it('should include correct select fields', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, SUPPLIER_ID);

      const callArgs =
        mockPrismaService.supplier_product.findMany.mock.calls[0][0];
      expect(callArgs.select).toEqual({
        id: true,
        name: true,
        description: true,
        unit_of_measure: true,
        unit_price: true,
        price_last_updated_at: true,
        sku: true,
        is_active: true,
        created_at: true,
      });
    });

    it('should order by name ascending', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, SUPPLIER_ID);

      const callArgs =
        mockPrismaService.supplier_product.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ name: 'asc' });
    });

    it('should include tenant_id and supplier_id in query', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, SUPPLIER_ID);

      const callArgs =
        mockPrismaService.supplier_product.findMany.mock.calls[0][0];
      expect(callArgs.where.tenant_id).toBe(TENANT_ID);
      expect(callArgs.where.supplier_id).toBe(SUPPLIER_ID);
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(TENANT_ID, 'nonexistent-supplier'),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.supplier_product.findMany,
      ).not.toHaveBeenCalled();
    });

    it('should return empty array when no products exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findMany.mockResolvedValue([]);

      const result = await service.findAll(TENANT_ID, SUPPLIER_ID);

      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------

  describe('update()', () => {
    const dto: UpdateSupplierProductDto = {
      name: 'Updated Crushed Stone',
      unit_price: 52.0,
    };

    it('should update a product successfully', async () => {
      const existing = mockProductRecord();
      const updated = mockProductRecord({
        name: 'Updated Crushed Stone',
        unit_price: new Decimal(52.0),
      });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst
        .mockResolvedValueOnce(existing) // existing lookup
        .mockResolvedValueOnce(null); // uniqueness check
      mockPrismaService.supplier_product.update.mockResolvedValue(updated);
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      const result = await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        dto,
      );

      expect(result).toEqual(updated);
    });

    it('should create price history record when price changes', async () => {
      const existing = mockProductRecord({ unit_price: new Decimal(45.5) });
      const updatedRecord = mockProductRecord({
        unit_price: new Decimal(52.0),
      });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      mockPrismaService.supplier_product.update.mockResolvedValue(
        updatedRecord,
      );
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        { unit_price: 52.0 },
      );

      expect(
        mockPrismaService.supplier_product_price_history.create,
      ).toHaveBeenCalledTimes(1);

      const historyCall =
        mockPrismaService.supplier_product_price_history.create.mock
          .calls[0][0];
      expect(historyCall.data.previous_price).toEqual(new Decimal(45.5));
      expect(historyCall.data.new_price).toEqual(new Decimal(52.0));
      expect(historyCall.data.tenant_id).toBe(TENANT_ID);
      expect(historyCall.data.supplier_product_id).toBe(PRODUCT_ID);
    });

    it('should NOT create price history when price is unchanged', async () => {
      const existing = mockProductRecord({ unit_price: new Decimal(45.5) });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(existing);
      mockPrismaService.supplier_product.update.mockResolvedValue(existing);

      await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        { unit_price: 45.5 }, // same price
      );

      expect(
        mockPrismaService.supplier_product_price_history.create,
      ).not.toHaveBeenCalled();
    });

    it('should create price history when existing price is null and new price is set', async () => {
      const existing = mockProductRecord({ unit_price: null });
      const updatedRecord = mockProductRecord({
        unit_price: new Decimal(30.0),
      });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(existing);
      mockPrismaService.supplier_product.update.mockResolvedValue(
        updatedRecord,
      );
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        { unit_price: 30.0 },
      );

      expect(
        mockPrismaService.supplier_product_price_history.create,
      ).toHaveBeenCalledTimes(1);

      const historyCall =
        mockPrismaService.supplier_product_price_history.create.mock
          .calls[0][0];
      expect(historyCall.data.previous_price).toBeNull();
    });

    it('should auto-set price tracking fields when price changes', async () => {
      const existing = mockProductRecord({ unit_price: new Decimal(45.5) });
      const updatedRecord = mockProductRecord({
        unit_price: new Decimal(55.0),
      });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      mockPrismaService.supplier_product.update.mockResolvedValue(
        updatedRecord,
      );
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        { unit_price: 55.0 },
      );

      const updateCall =
        mockPrismaService.supplier_product.update.mock.calls[0][0];
      expect(updateCall.data.price_last_updated_at).toBeInstanceOf(Date);
      expect(updateCall.data.price_last_updated_by_user_id).toBe(USER_ID);
    });

    it('should NOT set price tracking fields when price is unchanged', async () => {
      const existing = mockProductRecord({ unit_price: new Decimal(45.5) });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst
        .mockResolvedValueOnce(existing) // existing lookup
        .mockResolvedValueOnce(null); // uniqueness check — no duplicate
      mockPrismaService.supplier_product.update.mockResolvedValue(existing);

      await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        { name: 'Renamed Stone' },
      );

      const updateCall =
        mockPrismaService.supplier_product.update.mock.calls[0][0];
      expect(updateCall.data.price_last_updated_at).toBeUndefined();
      expect(updateCall.data.price_last_updated_by_user_id).toBeUndefined();
    });

    it('should check name uniqueness when name changes', async () => {
      const existing = mockProductRecord({ name: 'Old Name' });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null); // no duplicate
      mockPrismaService.supplier_product.update.mockResolvedValue(
        mockProductRecord({ name: 'New Name' }),
      );

      await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        { name: 'New Name' },
      );

      // Second findFirst call is for uniqueness check
      expect(
        mockPrismaService.supplier_product.findFirst,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          supplier_id: SUPPLIER_ID,
          tenant_id: TENANT_ID,
          name: 'New Name',
          id: { not: PRODUCT_ID },
        },
      });
    });

    it('should skip uniqueness check when name is the same (case-insensitive)', async () => {
      const existing = mockProductRecord({ name: 'Crushed Stone' });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(existing);
      mockPrismaService.supplier_product.update.mockResolvedValue(existing);

      await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        { name: 'crushed stone' }, // same name different case
      );

      // findFirst called only once (the existing lookup) — no uniqueness check
      expect(
        mockPrismaService.supplier_product.findFirst,
      ).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when new name already exists', async () => {
      const existing = mockProductRecord({ name: 'Old Name' });
      const duplicate = mockProductRecord({
        id: 'other-product-id',
        name: 'Duplicate Name',
      });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(duplicate);

      await expect(
        service.update(TENANT_ID, SUPPLIER_ID, PRODUCT_ID, USER_ID, {
          name: 'Duplicate Name',
        }),
      ).rejects.toThrow(ConflictException);

      expect(
        mockPrismaService.supplier_product.update,
      ).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, SUPPLIER_ID, PRODUCT_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(TENANT_ID, SUPPLIER_ID, PRODUCT_ID, USER_ID, dto),
      ).rejects.toThrow('Supplier not found.');
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          TENANT_ID,
          SUPPLIER_ID,
          'nonexistent-product',
          USER_ID,
          dto,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(
          TENANT_ID,
          SUPPLIER_ID,
          'nonexistent-product',
          USER_ID,
          dto,
        ),
      ).rejects.toThrow('Supplier product not found.');
    });

    it('should use a transaction for price history + product update', async () => {
      const existing = mockProductRecord();
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      mockPrismaService.supplier_product.update.mockResolvedValue(existing);
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        dto,
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should call auditLogger with before and after state', async () => {
      const existing = mockProductRecord();
      const updated = mockProductRecord({ name: 'Updated Crushed Stone' });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      mockPrismaService.supplier_product.update.mockResolvedValue(updated);
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        dto,
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'supplier_product',
          entityId: PRODUCT_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: existing,
          after: updated,
        }),
      );
    });

    it('should include "(price changed)" in audit description when price changed', async () => {
      const existing = mockProductRecord({ unit_price: new Decimal(45.5) });
      const updated = mockProductRecord({ unit_price: new Decimal(52.0) });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      mockPrismaService.supplier_product.update.mockResolvedValue(updated);
      mockPrismaService.supplier_product_price_history.create.mockResolvedValue(
        mockPriceHistoryRecord(),
      );

      await service.update(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
        { unit_price: 52.0 },
      );

      const auditCall =
        mockAuditLoggerService.logTenantChange.mock.calls[0][0];
      expect(auditCall.description).toContain('(price changed)');
    });
  });

  // -----------------------------------------------------------------------
  // softDelete()
  // -----------------------------------------------------------------------

  describe('softDelete()', () => {
    it('should soft delete a product by setting is_active = false', async () => {
      const existing = mockProductRecord();
      const updated = mockProductRecord({ is_active: false });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(existing);
      mockPrismaService.supplier_product.update.mockResolvedValue(updated);

      const result = await service.softDelete(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
      );

      expect(result).toEqual(updated);
      expect(result.is_active).toBe(false);
      expect(mockPrismaService.supplier_product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { is_active: false },
      });
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(TENANT_ID, SUPPLIER_ID, PRODUCT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.softDelete(TENANT_ID, SUPPLIER_ID, PRODUCT_ID, USER_ID),
      ).rejects.toThrow('Supplier not found.');
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(
          TENANT_ID,
          SUPPLIER_ID,
          'nonexistent-product',
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.softDelete(
          TENANT_ID,
          SUPPLIER_ID,
          'nonexistent-product',
          USER_ID,
        ),
      ).rejects.toThrow('Supplier product not found.');
    });

    it('should verify product belongs to supplier and tenant', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(TENANT_ID, SUPPLIER_ID, PRODUCT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.supplier_product.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: PRODUCT_ID,
          supplier_id: SUPPLIER_ID,
          tenant_id: TENANT_ID,
        },
      });
    });

    it('should call auditLogger with action "deleted"', async () => {
      const existing = mockProductRecord();
      const updated = mockProductRecord({ is_active: false });
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(existing);
      mockPrismaService.supplier_product.update.mockResolvedValue(updated);

      await service.softDelete(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
        USER_ID,
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith({
        action: 'deleted',
        entityType: 'supplier_product',
        entityId: PRODUCT_ID,
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        before: existing,
        after: updated,
        description: `Supplier product soft-deleted: ${existing.name}`,
      });
    });

    it('should not call audit logger when product not found', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(TENANT_ID, SUPPLIER_ID, PRODUCT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should enforce cross-tenant isolation', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(OTHER_TENANT_ID, SUPPLIER_ID, PRODUCT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID, tenant_id: OTHER_TENANT_ID },
      });
    });
  });

  // -----------------------------------------------------------------------
  // getPriceHistory()
  // -----------------------------------------------------------------------

  describe('getPriceHistory()', () => {
    it('should return price history ordered by changed_at desc', async () => {
      const historyRecords = [
        mockPriceHistoryRecord({
          id: 'h-002',
          previous_price: new Decimal(45.5),
          new_price: new Decimal(52.0),
          changed_at: new Date('2026-03-19T10:00:00.000Z'),
          notes: null,
        }),
        mockPriceHistoryRecord({
          id: 'h-001',
          previous_price: null,
          new_price: new Decimal(45.5),
          changed_at: new Date('2026-03-18T10:00:00.000Z'),
          notes: 'Initial price set on product creation',
        }),
      ];
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(
        mockProductRecord(),
      );
      mockPrismaService.supplier_product_price_history.findMany.mockResolvedValue(
        historyRecords,
      );

      const result = await service.getPriceHistory(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('h-002');
      expect(result[1].id).toBe('h-001');
    });

    it('should return mapped fields (id, previous_price, new_price, changed_at, changed_by, notes)', async () => {
      const historyRecord = mockPriceHistoryRecord();
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(
        mockProductRecord(),
      );
      mockPrismaService.supplier_product_price_history.findMany.mockResolvedValue(
        [historyRecord],
      );

      const result = await service.getPriceHistory(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
      );

      expect(result[0]).toEqual({
        id: historyRecord.id,
        previous_price: historyRecord.previous_price,
        new_price: historyRecord.new_price,
        changed_at: historyRecord.changed_at,
        changed_by: historyRecord.changed_by,
        notes: historyRecord.notes,
      });
      // Should not include tenant_id, supplier_product_id, etc.
      expect(result[0]).not.toHaveProperty('tenant_id');
      expect(result[0]).not.toHaveProperty('supplier_product_id');
    });

    it('should include changed_by user info (select: id, first_name, last_name)', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(
        mockProductRecord(),
      );
      mockPrismaService.supplier_product_price_history.findMany.mockResolvedValue(
        [],
      );

      await service.getPriceHistory(TENANT_ID, SUPPLIER_ID, PRODUCT_ID);

      expect(
        mockPrismaService.supplier_product_price_history.findMany,
      ).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          supplier_product_id: PRODUCT_ID,
        },
        orderBy: { changed_at: 'desc' },
        include: {
          changed_by: {
            select: { id: true, first_name: true, last_name: true },
          },
        },
      });
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.getPriceHistory(TENANT_ID, SUPPLIER_ID, PRODUCT_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPriceHistory(TENANT_ID, SUPPLIER_ID, PRODUCT_ID),
      ).rejects.toThrow('Supplier not found.');
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);

      await expect(
        service.getPriceHistory(TENANT_ID, SUPPLIER_ID, 'nonexistent-product'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPriceHistory(TENANT_ID, SUPPLIER_ID, 'nonexistent-product'),
      ).rejects.toThrow('Supplier product not found.');
    });

    it('should verify product belongs to supplier and tenant', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(null);

      await expect(
        service.getPriceHistory(TENANT_ID, SUPPLIER_ID, PRODUCT_ID),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.supplier_product.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: PRODUCT_ID,
          supplier_id: SUPPLIER_ID,
          tenant_id: TENANT_ID,
        },
      });
    });

    it('should return empty array when no price history exists', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_product.findFirst.mockResolvedValue(
        mockProductRecord(),
      );
      mockPrismaService.supplier_product_price_history.findMany.mockResolvedValue(
        [],
      );

      const result = await service.getPriceHistory(
        TENANT_ID,
        SUPPLIER_ID,
        PRODUCT_ID,
      );

      expect(result).toEqual([]);
    });

    it('should enforce cross-tenant isolation on history query', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.getPriceHistory(OTHER_TENANT_ID, SUPPLIER_ID, PRODUCT_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID, tenant_id: OTHER_TENANT_ID },
      });
    });
  });
});
