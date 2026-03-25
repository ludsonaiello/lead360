import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  GoogleMapsService,
  ValidatedAddress,
} from '../../leads/services/google-maps.service';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { ListSuppliersDto, SupplierSortBy, SortOrder } from '../dto/list-suppliers.dto';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const OTHER_TENANT_ID = 'tenant-uuid-999';
const USER_ID = 'user-uuid-001';
const SUPPLIER_ID = 'supplier-uuid-001';
const CATEGORY_ID_1 = 'cat-uuid-001';
const CATEGORY_ID_2 = 'cat-uuid-002';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockSupplierRecord = (overrides: any = {}) => ({
  id: SUPPLIER_ID,
  tenant_id: TENANT_ID,
  name: 'ABC Building Supply',
  legal_name: 'ABC Building Supply LLC',
  website: 'https://www.abcsupply.com',
  phone: '5551234567',
  email: 'orders@abcsupply.com',
  contact_name: 'John Smith',
  address_line1: '123 Industrial Blvd',
  address_line2: null,
  city: 'Houston',
  state: 'TX',
  zip_code: '77001',
  country: 'US',
  latitude: new Decimal('29.76040000'),
  longitude: new Decimal('-95.36980000'),
  google_place_id: 'ChIJAYWNSLS4QIYROwVl894CDco',
  notes: 'Preferred vendor for bulk lumber',
  is_preferred: true,
  is_active: true,
  total_spend: new Decimal('0.00'),
  last_purchase_date: null,
  created_by_user_id: USER_ID,
  updated_by_user_id: null,
  created_at: new Date('2026-03-18T10:00:00.000Z'),
  updated_at: new Date('2026-03-18T10:00:00.000Z'),
  ...overrides,
});

const mockFullSupplierRecord = (overrides: any = {}) => ({
  ...mockSupplierRecord(),
  category_assignments: [
    {
      id: 'assign-001',
      supplier_id: SUPPLIER_ID,
      supplier_category_id: CATEGORY_ID_1,
      tenant_id: TENANT_ID,
      created_at: new Date('2026-03-18T10:00:00.000Z'),
      supplier_category: {
        id: CATEGORY_ID_1,
        name: 'Roofing Materials',
        color: '#3B82F6',
      },
    },
  ],
  products: [],
  created_by: {
    id: USER_ID,
    first_name: 'John',
    last_name: 'Doe',
  },
  ...overrides,
});

const mockValidatedAddress: ValidatedAddress = {
  address_line1: '123 Industrial Blvd',
  address_line2: undefined,
  city: 'Houston',
  state: 'TX',
  zip_code: '77001',
  country: 'US',
  latitude: 29.7604,
  longitude: -95.3698,
  google_place_id: 'ChIJAYWNSLS4QIYROwVl894CDco',
};

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockTx = {
  supplier: {
    create: jest.fn(),
    update: jest.fn(),
  },
  supplier_category_assignment: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockPrismaService = {
  supplier: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  supplier_category: {
    findMany: jest.fn(),
  },
  supplier_category_assignment: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  financial_entry: {
    aggregate: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  financial_category: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((cb: any) => cb(mockTx)),
  $queryRaw: jest.fn(),
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

const mockGoogleMapsService = {
  validateAddress: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupplierService', () => {
  let service: SupplierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        { provide: GoogleMapsService, useValue: mockGoogleMapsService },
      ],
    }).compile();

    service = module.get<SupplierService>(SupplierService);

    jest.clearAllMocks();

    // Default: $transaction executes the callback with mockTx
    mockPrismaService.$transaction.mockImplementation((cb: any) => cb(mockTx));
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------

  describe('create()', () => {
    const dto: CreateSupplierDto = {
      name: 'ABC Building Supply',
      legal_name: 'ABC Building Supply LLC',
      phone: '5551234567',
      email: 'orders@abcsupply.com',
      contact_name: 'John Smith',
      address_line1: '123 Industrial Blvd',
      city: 'Houston',
      state: 'TX',
      zip_code: '77001',
      is_preferred: true,
      category_ids: [CATEGORY_ID_1],
    };

    beforeEach(() => {
      // Default happy path mocks
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(null) // uniqueness check
        .mockResolvedValueOnce(mockFullSupplierRecord()); // findOne after create
      mockPrismaService.supplier_category.findMany.mockResolvedValue([
        { id: CATEGORY_ID_1, tenant_id: TENANT_ID },
      ]);
      mockGoogleMapsService.validateAddress.mockResolvedValue(
        mockValidatedAddress,
      );
      mockTx.supplier.create.mockResolvedValue(mockSupplierRecord());
      mockTx.supplier_category_assignment.createMany.mockResolvedValue({
        count: 1,
      });
    });

    it('should create a supplier successfully with all fields', async () => {
      const result = await service.create(TENANT_ID, USER_ID, dto);

      expect(result).toBeDefined();
      expect(result.name).toBe('ABC Building Supply');
      expect(mockTx.supplier.create).toHaveBeenCalledTimes(1);
      expect(mockTx.supplier_category_assignment.createMany).toHaveBeenCalledTimes(1);
    });

    it('should include tenant_id in name uniqueness check', async () => {
      await service.create(TENANT_ID, USER_ID, dto);

      expect(mockPrismaService.supplier.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          tenant_id: TENANT_ID,
          name: dto.name,
        },
      });
    });

    it('should throw ConflictException when supplier name already exists', async () => {
      mockPrismaService.supplier.findFirst.mockReset();
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(ConflictException);

      mockPrismaService.supplier.findFirst.mockReset();
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(
        `Supplier "${dto.name}" already exists for this tenant.`,
      );
    });

    it('should validate category_ids belong to tenant', async () => {
      await service.create(TENANT_ID, USER_ID, dto);

      expect(mockPrismaService.supplier_category.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [CATEGORY_ID_1] },
          tenant_id: TENANT_ID,
        },
      });
    });

    it('should throw BadRequestException when category_ids are invalid', async () => {
      mockPrismaService.supplier.findFirst.mockReset();
      mockPrismaService.supplier.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.supplier_category.findMany.mockResolvedValue([]); // none found

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(
        'One or more category IDs are invalid or do not belong to this tenant.',
      );
    });

    it('should call GoogleMapsService.validateAddress when address info provided', async () => {
      await service.create(TENANT_ID, USER_ID, dto);

      expect(mockGoogleMapsService.validateAddress).toHaveBeenCalledTimes(1);
      expect(mockGoogleMapsService.validateAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          address_line1: '123 Industrial Blvd',
          zip_code: '77001',
        }),
      );
    });

    it('should NOT call GoogleMapsService when no address info provided', async () => {
      const dtoWithoutAddress: CreateSupplierDto = {
        name: 'No Address Supplier',
      };
      mockPrismaService.supplier.findFirst.mockReset();
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockFullSupplierRecord({ name: 'No Address Supplier' }));
      mockTx.supplier.create.mockResolvedValue(
        mockSupplierRecord({ name: 'No Address Supplier' }),
      );

      await service.create(TENANT_ID, USER_ID, dtoWithoutAddress);

      expect(mockGoogleMapsService.validateAddress).not.toHaveBeenCalled();
    });

    it('should throw UnprocessableEntityException when google_place_id provided and address resolution fails', async () => {
      mockGoogleMapsService.validateAddress.mockRejectedValue(
        new Error('API key invalid'),
      );
      const dtoWithPlaceId: CreateSupplierDto = {
        name: 'Place ID Supplier',
        address_line1: '123 Main St',
        zip_code: '77001',
        google_place_id: 'ChIJAYWNSLS4QIYROwVl894CDco',
      };
      mockPrismaService.supplier.findFirst.mockReset();
      mockPrismaService.supplier.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.create(TENANT_ID, USER_ID, dtoWithPlaceId),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should gracefully handle address resolution failure when no google_place_id', async () => {
      mockGoogleMapsService.validateAddress.mockRejectedValue(
        new Error('API key invalid'),
      );
      const dtoWithAddress: CreateSupplierDto = {
        name: 'Fallback Supplier',
        address_line1: '123 Main St',
        zip_code: '77001',
      };
      mockPrismaService.supplier.findFirst.mockReset();
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockFullSupplierRecord({ name: 'Fallback Supplier' }));
      mockTx.supplier.create.mockResolvedValue(
        mockSupplierRecord({ name: 'Fallback Supplier' }),
      );

      // Should NOT throw — address resolution failure is logged, not blocking
      const result = await service.create(TENANT_ID, USER_ID, dtoWithAddress);
      expect(result).toBeDefined();
    });

    it('should create category assignments in the same transaction', async () => {
      await service.create(TENANT_ID, USER_ID, dto);

      expect(mockTx.supplier_category_assignment.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            supplier_category_id: CATEGORY_ID_1,
            tenant_id: TENANT_ID,
          }),
        ]),
      });
    });

    it('should skip category assignment when category_ids not provided', async () => {
      const dtoNoCats: CreateSupplierDto = { name: 'No Cats Supplier' };
      mockPrismaService.supplier.findFirst.mockReset();
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockFullSupplierRecord({ name: 'No Cats Supplier' }));
      mockTx.supplier.create.mockResolvedValue(
        mockSupplierRecord({ name: 'No Cats Supplier' }),
      );

      await service.create(TENANT_ID, USER_ID, dtoNoCats);

      expect(mockTx.supplier_category_assignment.createMany).not.toHaveBeenCalled();
    });

    it('should call auditLogger with action "created"', async () => {
      await service.create(TENANT_ID, USER_ID, dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'supplier',
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should not call auditLogger when creation is blocked by uniqueness', async () => {
      mockPrismaService.supplier.findFirst.mockReset();
      mockPrismaService.supplier.findFirst.mockResolvedValueOnce(
        mockSupplierRecord(),
      );

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow();

      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // findAll()
  // -------------------------------------------------------------------------

  describe('findAll()', () => {
    const mockListItem = (overrides: any = {}) => ({
      ...mockSupplierRecord(),
      category_assignments: [
        {
          supplier_category: {
            id: CATEGORY_ID_1,
            name: 'Roofing Materials',
            color: '#3B82F6',
          },
        },
      ],
      _count: { products: 5 },
      ...overrides,
    });

    it('should return paginated list with tenant_id filter', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([mockListItem()]);
      mockPrismaService.supplier.count.mockResolvedValue(1);

      const query: ListSuppliersDto = {};
      const result = await service.findAll(TENANT_ID, query);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        pages: 1,
      });
    });

    it('should include tenant_id in all queries', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([]);
      mockPrismaService.supplier.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {});

      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
      expect(mockPrismaService.supplier.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      });
    });

    it('should default to is_active=true', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([]);
      mockPrismaService.supplier.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {});

      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: true }),
        }),
      );
    });

    it('should apply search filter to name, contact_name, and email', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([]);
      mockPrismaService.supplier.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { search: 'ABC' });

      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'ABC' } },
              { contact_name: { contains: 'ABC' } },
              { email: { contains: 'ABC' } },
            ],
          }),
        }),
      );
    });

    it('should filter by category_id via category_assignments junction', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([]);
      mockPrismaService.supplier.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { category_id: CATEGORY_ID_1 });

      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category_assignments: {
              some: { supplier_category_id: CATEGORY_ID_1 },
            },
          }),
        }),
      );
    });

    it('should apply is_preferred filter when provided', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([]);
      mockPrismaService.supplier.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { is_preferred: true });

      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_preferred: true }),
        }),
      );
    });

    it('should use custom sort_by and sort_order', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([]);
      mockPrismaService.supplier.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {
        sort_by: SupplierSortBy.TOTAL_SPEND,
        sort_order: SortOrder.DESC,
      });

      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { total_spend: 'desc' },
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([]);
      mockPrismaService.supplier.count.mockResolvedValue(50);

      const result = await service.findAll(TENANT_ID, { page: 3, limit: 10 });

      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
      expect(result.meta.pages).toBe(5);
    });

    it('should transform category_assignments into flat categories array', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([mockListItem()]);
      mockPrismaService.supplier.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_ID, {});

      expect(result.data[0].categories).toEqual([
        { id: CATEGORY_ID_1, name: 'Roofing Materials', color: '#3B82F6' },
      ]);
      expect(result.data[0].product_count).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // findOne()
  // -------------------------------------------------------------------------

  describe('findOne()', () => {
    it('should return a supplier with categories and products', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockFullSupplierRecord(),
      );

      const result = await service.findOne(TENANT_ID, SUPPLIER_ID);

      expect(result.name).toBe('ABC Building Supply');
      expect(result.categories).toEqual([
        { id: CATEGORY_ID_1, name: 'Roofing Materials', color: '#3B82F6' },
      ]);
      expect(result.category_assignments).toBeUndefined();
    });

    it('should include tenant_id in the query', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockFullSupplierRecord(),
      );

      await service.findOne(TENANT_ID, SUPPLIER_ID);

      expect(mockPrismaService.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SUPPLIER_ID, tenant_id: TENANT_ID },
        }),
      );
    });

    it('should throw NotFoundException when supplier not found', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.findOne(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow('Supplier not found.');
    });

    it('should throw NotFoundException for cross-tenant access attempt', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(OTHER_TENANT_ID, SUPPLIER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SUPPLIER_ID, tenant_id: OTHER_TENANT_ID },
        }),
      );
    });

    it('should include only active products', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockFullSupplierRecord(),
      );

      await service.findOne(TENANT_ID, SUPPLIER_ID);

      expect(mockPrismaService.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            products: expect.objectContaining({
              where: { is_active: true },
            }),
          }),
        }),
      );
    });

    it('should include created_by user with id, first_name, last_name', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockFullSupplierRecord(),
      );

      const result = await service.findOne(TENANT_ID, SUPPLIER_ID);

      expect(result.created_by).toEqual({
        id: USER_ID,
        first_name: 'John',
        last_name: 'Doe',
      });
    });
  });

  // -------------------------------------------------------------------------
  // update()
  // -------------------------------------------------------------------------

  describe('update()', () => {
    const dto: UpdateSupplierDto = {
      name: 'Updated Supply Co',
      phone: '5559999999',
    };

    beforeEach(() => {
      mockPrismaService.supplier.findFirst.mockReset();
    });

    it('should update a supplier successfully', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(mockSupplierRecord()) // existing check
        .mockResolvedValueOnce(null) // name uniqueness check
        .mockResolvedValueOnce(mockFullSupplierRecord({ name: 'Updated Supply Co' })); // findOne
      mockTx.supplier.update.mockResolvedValue(
        mockSupplierRecord({ name: 'Updated Supply Co' }),
      );

      const result = await service.update(TENANT_ID, SUPPLIER_ID, USER_ID, dto);

      expect(result.name).toBe('Updated Supply Co');
      expect(mockTx.supplier.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when supplier not found', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update(TENANT_ID, 'nonexistent-id', USER_ID, dto),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should check name uniqueness when name changes', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(mockSupplierRecord({ name: 'Old Name' }))
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce(mockFullSupplierRecord({ name: 'New Name' }));
      mockTx.supplier.update.mockResolvedValue(
        mockSupplierRecord({ name: 'New Name' }),
      );

      await service.update(TENANT_ID, SUPPLIER_ID, USER_ID, { name: 'New Name' });

      expect(mockPrismaService.supplier.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          tenant_id: TENANT_ID,
          name: 'New Name',
          id: { not: SUPPLIER_ID },
        },
      });
    });

    it('should skip uniqueness check when name is unchanged (case-insensitive)', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(mockSupplierRecord({ name: 'ABC Supply' }))
        .mockResolvedValueOnce(mockFullSupplierRecord({ name: 'abc supply' }));
      mockTx.supplier.update.mockResolvedValue(
        mockSupplierRecord({ name: 'abc supply' }),
      );

      await service.update(TENANT_ID, SUPPLIER_ID, USER_ID, { name: 'abc supply' });

      // Only 2 calls to findFirst: existing check + findOne after update
      // No uniqueness call because name is same (case-insensitive)
      expect(mockPrismaService.supplier.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when new name already exists', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(mockSupplierRecord({ name: 'Old Name' }))
        .mockResolvedValueOnce(mockSupplierRecord({ id: 'other-id', name: 'Taken Name' }));

      await expect(
        service.update(TENANT_ID, SUPPLIER_ID, USER_ID, { name: 'Taken Name' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should validate category_ids when provided', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(mockSupplierRecord())
        .mockResolvedValueOnce(mockFullSupplierRecord());
      mockPrismaService.supplier_category.findMany.mockResolvedValue([
        { id: CATEGORY_ID_1, tenant_id: TENANT_ID },
        { id: CATEGORY_ID_2, tenant_id: TENANT_ID },
      ]);
      mockTx.supplier.update.mockResolvedValue(mockSupplierRecord());
      mockTx.supplier_category_assignment.deleteMany.mockResolvedValue({ count: 1 });
      mockTx.supplier_category_assignment.createMany.mockResolvedValue({ count: 2 });

      await service.update(TENANT_ID, SUPPLIER_ID, USER_ID, {
        category_ids: [CATEGORY_ID_1, CATEGORY_ID_2],
      });

      expect(mockPrismaService.supplier_category.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [CATEGORY_ID_1, CATEGORY_ID_2] },
          tenant_id: TENANT_ID,
        },
      });
    });

    it('should throw BadRequestException when category_ids are invalid during update', async () => {
      // First assertion: check exception type
      mockPrismaService.supplier.findFirst.mockResolvedValueOnce(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier_category.findMany.mockResolvedValue([
        { id: CATEGORY_ID_1, tenant_id: TENANT_ID },
      ]); // Only 1 found, but 2 requested

      await expect(
        service.update(TENANT_ID, SUPPLIER_ID, USER_ID, {
          category_ids: [CATEGORY_ID_1, 'nonexistent-cat-id'],
        }),
      ).rejects.toThrow(BadRequestException);

      // Second assertion: check exception message (re-provide the mock)
      mockPrismaService.supplier.findFirst.mockResolvedValueOnce(
        mockSupplierRecord(),
      );

      await expect(
        service.update(TENANT_ID, SUPPLIER_ID, USER_ID, {
          category_ids: [CATEGORY_ID_1, 'nonexistent-cat-id'],
        }),
      ).rejects.toThrow(
        'One or more category IDs are invalid or do not belong to this tenant.',
      );

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should replace category assignments in transaction when category_ids provided', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(mockSupplierRecord())
        .mockResolvedValueOnce(mockFullSupplierRecord());
      mockPrismaService.supplier_category.findMany.mockResolvedValue([
        { id: CATEGORY_ID_1, tenant_id: TENANT_ID },
      ]);
      mockTx.supplier.update.mockResolvedValue(mockSupplierRecord());
      mockTx.supplier_category_assignment.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.supplier_category_assignment.createMany.mockResolvedValue({ count: 1 });

      await service.update(TENANT_ID, SUPPLIER_ID, USER_ID, {
        category_ids: [CATEGORY_ID_1],
      });

      // Should delete existing assignments first
      expect(mockTx.supplier_category_assignment.deleteMany).toHaveBeenCalledWith({
        where: { supplier_id: SUPPLIER_ID, tenant_id: TENANT_ID },
      });
      // Then create new ones
      expect(mockTx.supplier_category_assignment.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            supplier_category_id: CATEGORY_ID_1,
            tenant_id: TENANT_ID,
          }),
        ]),
      });
    });

    it('should allow clearing all category assignments with empty array', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(mockSupplierRecord())
        .mockResolvedValueOnce(mockFullSupplierRecord());
      mockTx.supplier.update.mockResolvedValue(mockSupplierRecord());
      mockTx.supplier_category_assignment.deleteMany.mockResolvedValue({ count: 2 });

      await service.update(TENANT_ID, SUPPLIER_ID, USER_ID, {
        category_ids: [],
      });

      // Should delete existing assignments
      expect(mockTx.supplier_category_assignment.deleteMany).toHaveBeenCalled();
      // Should NOT create new ones
      expect(mockTx.supplier_category_assignment.createMany).not.toHaveBeenCalled();
    });

    it('should set updated_by_user_id on every update', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(mockSupplierRecord())
        .mockResolvedValueOnce(mockFullSupplierRecord());
      mockTx.supplier.update.mockResolvedValue(mockSupplierRecord());

      await service.update(TENANT_ID, SUPPLIER_ID, USER_ID, { notes: 'new notes' });

      expect(mockTx.supplier.update).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: expect.objectContaining({
          updated_by_user_id: USER_ID,
        }),
      });
    });

    it('should call auditLogger with before and after state', async () => {
      const existing = mockSupplierRecord();
      const updated = mockFullSupplierRecord({ name: 'Updated Supply Co' });
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(updated);
      mockTx.supplier.update.mockResolvedValue(
        mockSupplierRecord({ name: 'Updated Supply Co' }),
      );

      await service.update(TENANT_ID, SUPPLIER_ID, USER_ID, dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'supplier',
          entityId: SUPPLIER_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: existing,
        }),
      );
    });

    it('should call GoogleMapsService when address fields change', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(mockSupplierRecord())
        .mockResolvedValueOnce(mockFullSupplierRecord());
      mockGoogleMapsService.validateAddress.mockResolvedValue(mockValidatedAddress);
      mockTx.supplier.update.mockResolvedValue(mockSupplierRecord());

      await service.update(TENANT_ID, SUPPLIER_ID, USER_ID, {
        address_line1: '456 New Rd',
      });

      expect(mockGoogleMapsService.validateAddress).toHaveBeenCalledTimes(1);
    });

    it('should NOT call GoogleMapsService when no address fields changed', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(mockSupplierRecord())
        .mockResolvedValueOnce(mockFullSupplierRecord());
      mockTx.supplier.update.mockResolvedValue(mockSupplierRecord());

      await service.update(TENANT_ID, SUPPLIER_ID, USER_ID, { notes: 'updated note' });

      expect(mockGoogleMapsService.validateAddress).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for cross-tenant update attempt', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update(OTHER_TENANT_ID, SUPPLIER_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // softDelete()
  // -------------------------------------------------------------------------

  describe('softDelete()', () => {
    it('should set is_active to false', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier.update.mockResolvedValue(
        mockSupplierRecord({ is_active: false }),
      );

      const result = await service.softDelete(TENANT_ID, SUPPLIER_ID, USER_ID);

      expect(result.is_active).toBe(false);
      expect(mockPrismaService.supplier.update).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: {
          is_active: false,
          updated_by_user_id: USER_ID,
        },
      });
    });

    it('should include tenant_id in the lookup query', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.supplier.update.mockResolvedValue(
        mockSupplierRecord({ is_active: false }),
      );

      await service.softDelete(TENANT_ID, SUPPLIER_ID, USER_ID);

      expect(mockPrismaService.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID, tenant_id: TENANT_ID },
      });
    });

    it('should throw NotFoundException when supplier not found', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(TENANT_ID, 'nonexistent-id', USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.supplier.update).not.toHaveBeenCalled();
    });

    it('should call auditLogger with action "deleted"', async () => {
      const existing = mockSupplierRecord();
      const updated = mockSupplierRecord({ is_active: false });
      mockPrismaService.supplier.findFirst.mockResolvedValue(existing);
      mockPrismaService.supplier.update.mockResolvedValue(updated);

      await service.softDelete(TENANT_ID, SUPPLIER_ID, USER_ID);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith({
        action: 'deleted',
        entityType: 'supplier',
        entityId: SUPPLIER_ID,
        tenantId: TENANT_ID,
        actorUserId: USER_ID,
        before: existing,
        after: updated,
        description: `Supplier soft-deleted: ${existing.name}`,
      });
    });

    it('should throw NotFoundException for cross-tenant delete attempt', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete(OTHER_TENANT_ID, SUPPLIER_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // findForMap()
  // -------------------------------------------------------------------------

  describe('findForMap()', () => {
    it('should return only active suppliers with lat/lng', async () => {
      const mapSupplier = {
        id: SUPPLIER_ID,
        name: 'ABC Supply',
        latitude: new Decimal('29.76040000'),
        longitude: new Decimal('-95.36980000'),
        city: 'Houston',
        state: 'TX',
        is_preferred: true,
        total_spend: new Decimal('5000.00'),
        category_assignments: [
          {
            supplier_category: {
              id: CATEGORY_ID_1,
              name: 'Roofing',
              color: '#3B82F6',
            },
          },
        ],
      };
      mockPrismaService.supplier.findMany.mockResolvedValue([mapSupplier]);

      const result = await service.findForMap(TENANT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].categories).toEqual([
        { id: CATEGORY_ID_1, name: 'Roofing', color: '#3B82F6' },
      ]);
    });

    it('should filter by tenant_id, is_active, and non-null coordinates', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([]);

      await service.findForMap(TENANT_ID);

      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: TENANT_ID,
            is_active: true,
            latitude: { not: null },
            longitude: { not: null },
          },
        }),
      );
    });

    it('should not return suppliers from other tenants', async () => {
      mockPrismaService.supplier.findMany.mockResolvedValue([]);

      await service.findForMap(OTHER_TENANT_ID);

      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: OTHER_TENANT_ID,
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getStatistics()
  // -------------------------------------------------------------------------

  describe('getStatistics()', () => {
    it('should return supplier statistics from financial_entry', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('15000.00') } })
        .mockResolvedValueOnce({
          _min: { entry_date: new Date('2026-01-15') },
          _max: { entry_date: new Date('2026-03-10') },
        });
      mockPrismaService.financial_entry.count.mockResolvedValue(25);
      mockPrismaService.financial_entry.groupBy.mockResolvedValue([]);
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.getStatistics(TENANT_ID, SUPPLIER_ID);

      expect(result.supplier_id).toBe(SUPPLIER_ID);
      expect(result.total_spend).toEqual(new Decimal('15000.00'));
      expect(result.transaction_count).toBe(25);
      expect(result.last_purchase_date).toEqual(new Date('2026-03-10'));
      expect(result.first_purchase_date).toEqual(new Date('2026-01-15'));
    });

    it('should include tenant_id in all financial_entry queries', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValue({ _sum: { amount: null }, _min: { entry_date: null }, _max: { entry_date: null } });
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.groupBy.mockResolvedValue([]);
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await service.getStatistics(TENANT_ID, SUPPLIER_ID);

      // Check first aggregate call (total spend)
      expect(mockPrismaService.financial_entry.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should throw NotFoundException when supplier not found', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.getStatistics(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should resolve category names for spend_by_category', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('5000.00') } })
        .mockResolvedValueOnce({
          _min: { entry_date: new Date('2026-01-01') },
          _max: { entry_date: new Date('2026-03-01') },
        });
      mockPrismaService.financial_entry.count.mockResolvedValue(10);
      mockPrismaService.financial_entry.groupBy.mockResolvedValue([
        { category_id: 'fin-cat-001', _sum: { amount: new Decimal('3000.00') } },
        { category_id: 'fin-cat-002', _sum: { amount: new Decimal('2000.00') } },
      ]);
      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockPrismaService.financial_category.findMany.mockResolvedValue([
        { id: 'fin-cat-001', name: 'Materials' },
        { id: 'fin-cat-002', name: 'Equipment' },
      ]);

      const result = await service.getStatistics(TENANT_ID, SUPPLIER_ID);

      expect(result.spend_by_category).toEqual([
        { category_name: 'Materials', total_spend: new Decimal('3000.00') },
        { category_name: 'Equipment', total_spend: new Decimal('2000.00') },
      ]);
    });

    it('should return empty arrays when no financial entries exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(
        mockSupplierRecord(),
      );
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({
          _min: { entry_date: null },
          _max: { entry_date: null },
        });
      mockPrismaService.financial_entry.count.mockResolvedValue(0);
      mockPrismaService.financial_entry.groupBy.mockResolvedValue([]);
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.getStatistics(TENANT_ID, SUPPLIER_ID);

      expect(result.total_spend).toBe(0);
      expect(result.transaction_count).toBe(0);
      expect(result.last_purchase_date).toBeNull();
      expect(result.first_purchase_date).toBeNull();
      expect(result.spend_by_category).toEqual([]);
      expect(result.spend_by_month).toEqual([]);
    });

    it('should throw NotFoundException for cross-tenant statistics access', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.getStatistics(OTHER_TENANT_ID, SUPPLIER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // updateSpendTotals()
  // -------------------------------------------------------------------------

  describe('updateSpendTotals()', () => {
    it('should update total_spend and last_purchase_date from aggregate queries', async () => {
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('12500.00') } })
        .mockResolvedValueOnce({ _max: { entry_date: new Date('2026-03-15') } });
      mockPrismaService.supplier.update.mockResolvedValue(
        mockSupplierRecord({
          total_spend: new Decimal('12500.00'),
          last_purchase_date: new Date('2026-03-15'),
        }),
      );

      await service.updateSpendTotals(TENANT_ID, SUPPLIER_ID);

      expect(mockPrismaService.supplier.update).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: {
          total_spend: new Decimal('12500.00'),
          last_purchase_date: new Date('2026-03-15'),
        },
      });
    });

    it('should include tenant_id in aggregate queries', async () => {
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _max: { entry_date: null } });
      mockPrismaService.supplier.update.mockResolvedValue(mockSupplierRecord());

      await service.updateSpendTotals(TENANT_ID, SUPPLIER_ID);

      expect(mockPrismaService.financial_entry.aggregate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { tenant_id: TENANT_ID, supplier_id: SUPPLIER_ID },
        }),
      );
      expect(mockPrismaService.financial_entry.aggregate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { tenant_id: TENANT_ID, supplier_id: SUPPLIER_ID },
        }),
      );
    });

    it('should set total_spend to 0 and last_purchase_date to null when no entries exist', async () => {
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _max: { entry_date: null } });
      mockPrismaService.supplier.update.mockResolvedValue(mockSupplierRecord());

      await service.updateSpendTotals(TENANT_ID, SUPPLIER_ID);

      expect(mockPrismaService.supplier.update).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: {
          total_spend: new Decimal(0),
          last_purchase_date: null,
        },
      });
    });

    it('should use Prisma aggregate (not JS summation)', async () => {
      mockPrismaService.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('100.00') } })
        .mockResolvedValueOnce({ _max: { entry_date: new Date() } });
      mockPrismaService.supplier.update.mockResolvedValue(mockSupplierRecord());

      await service.updateSpendTotals(TENANT_ID, SUPPLIER_ID);

      // Ensure aggregate was called, not findMany
      expect(mockPrismaService.financial_entry.aggregate).toHaveBeenCalledTimes(2);
    });
  });
});
