import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethodRegistryService } from './payment-method-registry.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

// ── Constants ──────────────────────────────────────────────
const TENANT_A = 'tenant-aaa-001';
const TENANT_B = 'tenant-bbb-002';
const USER_ID = 'user-001';
const PM_ID_1 = 'pm-001';
const PM_ID_2 = 'pm-002';

// ── Mock Factories ─────────────────────────────────────────
const mockPaymentMethod = (overrides: any = {}) => ({
  id: PM_ID_1,
  tenant_id: TENANT_A,
  nickname: 'Chase Business Visa',
  type: 'credit_card',
  bank_name: 'Chase',
  last_four: '4521',
  notes: null,
  is_default: false,
  is_active: true,
  created_by_user_id: USER_ID,
  updated_by_user_id: null,
  created_at: new Date('2026-03-01'),
  updated_at: new Date('2026-03-01'),
  ...overrides,
});

// ── Mock Services ──────────────────────────────────────────
const mockPrismaService = {
  payment_method_registry: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  financial_entry: {
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn().mockResolvedValue(undefined),
};

// ── Tests ──────────────────────────────────────────────────
describe('PaymentMethodRegistryService', () => {
  let service: PaymentMethodRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodRegistryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<PaymentMethodRegistryService>(
      PaymentMethodRegistryService,
    );
    jest.clearAllMocks();

    // Default: usage count = 0, no last used date
    mockPrismaService.financial_entry.count.mockResolvedValue(0);
    mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);
  });

  // ─────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────

  describe('create()', () => {
    const createDto = {
      nickname: 'Chase Business Visa',
      type: 'credit_card',
      bank_name: 'Chase',
      last_four: '4521',
    };

    it('should create a payment method and return it with usage data', async () => {
      mockPrismaService.payment_method_registry.count.mockResolvedValue(5);
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.create.mockResolvedValue(
        mockPaymentMethod(),
      );

      const result = await service.create(TENANT_A, USER_ID, createDto);

      expect(result.nickname).toBe('Chase Business Visa');
      expect(result.usage_count).toBe(0);
      expect(result.last_used_date).toBeNull();
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'payment_method_registry',
          tenantId: TENANT_A,
        }),
      );
    });

    it('should throw ConflictException if nickname already exists (case-insensitive)', async () => {
      mockPrismaService.payment_method_registry.count.mockResolvedValue(5);
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        mockPaymentMethod(),
      );

      await expect(
        service.create(TENANT_A, USER_ID, createDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if tenant has 50 active payment methods', async () => {
      mockPrismaService.payment_method_registry.count.mockResolvedValue(50);

      await expect(
        service.create(TENANT_A, USER_ID, createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should unset existing defaults when creating with is_default=true', async () => {
      mockPrismaService.payment_method_registry.count.mockResolvedValue(5);
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.create.mockResolvedValue(
        mockPaymentMethod({ is_default: true }),
      );

      await service.create(TENANT_A, USER_ID, {
        ...createDto,
        is_default: true,
      });

      expect(
        mockPrismaService.payment_method_registry.updateMany,
      ).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_A, is_default: true },
        data: { is_default: false },
      });
    });

    it('should NOT unset defaults when creating with is_default=false', async () => {
      mockPrismaService.payment_method_registry.count.mockResolvedValue(5);
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.create.mockResolvedValue(
        mockPaymentMethod(),
      );

      await service.create(TENANT_A, USER_ID, {
        ...createDto,
        is_default: false,
      });

      expect(
        mockPrismaService.payment_method_registry.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('should include tenant_id in 50-method limit count', async () => {
      mockPrismaService.payment_method_registry.count.mockResolvedValue(50);

      await expect(
        service.create(TENANT_A, USER_ID, createDto),
      ).rejects.toThrow(BadRequestException);

      expect(
        mockPrismaService.payment_method_registry.count,
      ).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_A, is_active: true },
      });
    });

    it('should include tenant_id in nickname uniqueness check', async () => {
      mockPrismaService.payment_method_registry.count.mockResolvedValue(5);
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        mockPaymentMethod(),
      );

      await expect(
        service.create(TENANT_A, USER_ID, createDto),
      ).rejects.toThrow(ConflictException);

      expect(
        mockPrismaService.payment_method_registry.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_A,
          nickname: createDto.nickname,
        },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // findAll()
  // ─────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('should return array of payment methods with usage data', async () => {
      mockPrismaService.payment_method_registry.findMany.mockResolvedValue([
        mockPaymentMethod(),
        mockPaymentMethod({
          id: PM_ID_2,
          nickname: 'Petty Cash',
          type: 'cash',
        }),
      ]);

      const result = await service.findAll(TENANT_A, {});

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('usage_count');
      expect(result[0]).toHaveProperty('last_used_date');
    });

    it('should filter by is_active=true by default', async () => {
      mockPrismaService.payment_method_registry.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_A, {});

      expect(
        mockPrismaService.payment_method_registry.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
            is_active: true,
          }),
        }),
      );
    });

    it('should include inactive when is_active=false', async () => {
      mockPrismaService.payment_method_registry.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_A, { is_active: false });

      const callArgs =
        mockPrismaService.payment_method_registry.findMany.mock.calls[0][0];
      // When is_active=false, the where clause should NOT filter by is_active
      expect(callArgs.where.is_active).toBeUndefined();
    });

    it('should filter by type when provided', async () => {
      mockPrismaService.payment_method_registry.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_A, { type: 'credit_card' });

      expect(
        mockPrismaService.payment_method_registry.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'credit_card' }),
        }),
      );
    });

    it('should order by is_default DESC then nickname ASC', async () => {
      mockPrismaService.payment_method_registry.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_A, {});

      expect(
        mockPrismaService.payment_method_registry.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ is_default: 'desc' }, { nickname: 'asc' }],
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should return a payment method with usage data', async () => {
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        mockPaymentMethod(),
      );

      const result = await service.findOne(TENANT_A, PM_ID_1);

      expect(result.id).toBe(PM_ID_1);
      expect(result).toHaveProperty('usage_count');
      expect(result).toHaveProperty('last_used_date');
    });

    it('should throw NotFoundException if record does not exist', async () => {
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.findOne(TENANT_A, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should NOT return records from other tenants (tenant isolation)', async () => {
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.findOne(TENANT_B, PM_ID_1),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.payment_method_registry.findFirst,
      ).toHaveBeenCalledWith({
        where: { id: PM_ID_1, tenant_id: TENANT_B },
      });
    });

    it('should return enriched data with usage_count and last_used_date when usage exists', async () => {
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        mockPaymentMethod(),
      );
      const lastDate = new Date('2026-03-15');
      mockPrismaService.financial_entry.count.mockResolvedValue(12);
      mockPrismaService.financial_entry.findFirst.mockResolvedValue({
        entry_date: lastDate,
      });

      const result = await service.findOne(TENANT_A, PM_ID_1);

      expect(result.usage_count).toBe(12);
      expect(result.last_used_date).toEqual(lastDate);
    });
  });

  // ─────────────────────────────────────────────────────────
  // update()
  // ─────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should update a payment method and return it with usage data', async () => {
      const existing = mockPaymentMethod();
      const updated = mockPaymentMethod({ nickname: 'Updated Name' });
      // IMPORTANT: Use mockResolvedValueOnce for sequential findFirst calls.
      // First call: findOne() looks up the record.
      // Second call: duplicate nickname check — must return null (no conflict).
      mockPrismaService.payment_method_registry.findFirst
        .mockResolvedValueOnce(existing) // findOne
        .mockResolvedValueOnce(null); // duplicate nickname check — no conflict
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        updated,
      );

      const result = await service.update(TENANT_A, PM_ID_1, USER_ID, {
        nickname: 'Updated Name',
      });

      expect(result.nickname).toBe('Updated Name');
      expect(result).toHaveProperty('usage_count');
      expect(result).toHaveProperty('last_used_date');
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'updated' }),
      );
    });

    it('should throw ConflictException if updated nickname conflicts with another record', async () => {
      mockPrismaService.payment_method_registry.findFirst
        .mockResolvedValueOnce(mockPaymentMethod()) // findOne
        .mockResolvedValueOnce(mockPaymentMethod({ id: PM_ID_2 })); // duplicate check

      await expect(
        service.update(TENANT_A, PM_ID_1, USER_ID, {
          nickname: 'Existing Name',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if record does not exist', async () => {
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.update(TENANT_A, 'nonexistent', USER_ID, {
          nickname: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip nickname uniqueness check when nickname is not in DTO', async () => {
      const existing = mockPaymentMethod();
      const updated = mockPaymentMethod({ notes: 'Updated notes' });
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValueOnce(
        existing,
      );
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        updated,
      );

      await service.update(TENANT_A, PM_ID_1, USER_ID, {
        notes: 'Updated notes',
      });

      // findFirst should only be called once (findOne), not twice (no nickname check)
      expect(
        mockPrismaService.payment_method_registry.findFirst,
      ).toHaveBeenCalledTimes(1);
    });

    it('should exclude self from nickname uniqueness check', async () => {
      const existing = mockPaymentMethod();
      mockPrismaService.payment_method_registry.findFirst
        .mockResolvedValueOnce(existing) // findOne
        .mockResolvedValueOnce(null); // duplicate check — no conflict
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        mockPaymentMethod({ nickname: 'New Name' }),
      );

      await service.update(TENANT_A, PM_ID_1, USER_ID, {
        nickname: 'New Name',
      });

      // Verify the duplicate check excludes the current record
      expect(
        mockPrismaService.payment_method_registry.findFirst,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          tenant_id: TENANT_A,
          nickname: 'New Name',
          id: { not: PM_ID_1 },
        },
      });
    });

    it('should set updated_by_user_id on every update', async () => {
      const existing = mockPaymentMethod();
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValueOnce(
        existing,
      );
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        mockPaymentMethod({ notes: 'test' }),
      );

      await service.update(TENANT_A, PM_ID_1, USER_ID, { notes: 'test' });

      expect(
        mockPrismaService.payment_method_registry.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            updated_by_user_id: USER_ID,
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // softDelete()
  // ─────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('should set is_active=false and return the deactivated record', async () => {
      const existing = mockPaymentMethod({ is_default: false });
      const deactivated = mockPaymentMethod({ is_active: false });
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        deactivated,
      );

      const result = await service.softDelete(TENANT_A, PM_ID_1, USER_ID);

      expect(
        mockPrismaService.payment_method_registry.update,
      ).toHaveBeenCalledWith({
        where: { id: PM_ID_1 },
        data: { is_active: false, updated_by_user_id: USER_ID },
      });
      expect(result.is_active).toBe(false);
      expect(result).toHaveProperty('usage_count');
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'deleted' }),
      );
    });

    it('should auto-assign default to most recent active method when deleting the default', async () => {
      const existing = mockPaymentMethod({ is_default: true });
      const deactivated = mockPaymentMethod({
        is_default: true,
        is_active: false,
      });
      const newDefault = mockPaymentMethod({
        id: PM_ID_2,
        nickname: 'Petty Cash',
        is_default: false,
      });

      mockPrismaService.payment_method_registry.findFirst
        .mockResolvedValueOnce(existing) // findOne
        .mockResolvedValueOnce(newDefault); // find new default candidate (inside tx)
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.update
        .mockResolvedValueOnce(deactivated) // soft delete (inside tx)
        .mockResolvedValueOnce({ ...newDefault, is_default: true }); // set new default (inside tx)

      await service.softDelete(TENANT_A, PM_ID_1, USER_ID);

      // Verify the new default was set
      expect(
        mockPrismaService.payment_method_registry.update,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockPrismaService.payment_method_registry.update,
      ).toHaveBeenLastCalledWith({
        where: { id: PM_ID_2 },
        data: { is_default: true },
      });
    });

    it('should NOT reassign default when deleting a non-default method', async () => {
      const existing = mockPaymentMethod({ is_default: false });
      const deactivated = mockPaymentMethod({
        is_active: false,
        is_default: false,
      });
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        deactivated,
      );

      await service.softDelete(TENANT_A, PM_ID_1, USER_ID);

      // Only called once (the soft delete), not twice (no reassignment)
      expect(
        mockPrismaService.payment_method_registry.update,
      ).toHaveBeenCalledTimes(1);
    });

    it('should not reassign default when deleting the last active method', async () => {
      const existing = mockPaymentMethod({ is_default: true });
      const deactivated = mockPaymentMethod({
        is_default: true,
        is_active: false,
      });

      mockPrismaService.payment_method_registry.findFirst
        .mockResolvedValueOnce(existing) // findOne
        .mockResolvedValueOnce(null); // no other active methods (inside tx)
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        deactivated,
      );

      await service.softDelete(TENANT_A, PM_ID_1, USER_ID);

      // Only called once (the soft delete), no reassignment
      expect(
        mockPrismaService.payment_method_registry.update,
      ).toHaveBeenCalledTimes(1);
    });

    it('should find new default candidate ordered by created_at desc', async () => {
      const existing = mockPaymentMethod({ is_default: true });
      const deactivated = mockPaymentMethod({
        is_default: true,
        is_active: false,
      });

      mockPrismaService.payment_method_registry.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null); // no candidate (inside tx)
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        deactivated,
      );

      await service.softDelete(TENANT_A, PM_ID_1, USER_ID);

      // Verify the new-default lookup query (now inside transaction)
      expect(
        mockPrismaService.payment_method_registry.findFirst,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          tenant_id: TENANT_A,
          is_active: true,
          id: { not: PM_ID_1 },
        },
        orderBy: { created_at: 'desc' },
      });
    });

    it('should execute soft-delete and default reassignment atomically in $transaction', async () => {
      const existing = mockPaymentMethod({ is_default: true });
      const deactivated = mockPaymentMethod({
        is_default: true,
        is_active: false,
      });
      const newDefault = mockPaymentMethod({
        id: PM_ID_2,
        nickname: 'Petty Cash',
        is_default: false,
      });

      mockPrismaService.payment_method_registry.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(newDefault);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.update
        .mockResolvedValueOnce(deactivated)
        .mockResolvedValueOnce({ ...newDefault, is_default: true });

      await service.softDelete(TENANT_A, PM_ID_1, USER_ID);

      // Verify $transaction was called (atomicity)
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────
  // setDefault()
  // ─────────────────────────────────────────────────────────

  describe('setDefault()', () => {
    it('should atomically set the specified method as default', async () => {
      const record = mockPaymentMethod({ is_active: true });
      const updated = mockPaymentMethod({ is_default: true });

      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        record,
      );
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        updated,
      );

      const result = await service.setDefault(TENANT_A, PM_ID_1, USER_ID);

      expect(
        mockPrismaService.payment_method_registry.updateMany,
      ).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_A, is_default: true },
        data: { is_default: false },
      });
      expect(result.is_default).toBe(true);
    });

    it('should throw BadRequestException if payment method is inactive', async () => {
      const record = mockPaymentMethod({ is_active: false });
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        record,
      );

      await expect(
        service.setDefault(TENANT_A, PM_ID_1, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if record does not exist', async () => {
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.setDefault(TENANT_A, 'nonexistent', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call audit log with action "updated" after setting default', async () => {
      const record = mockPaymentMethod({ is_active: true });
      const updated = mockPaymentMethod({ is_default: true });

      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        record,
      );
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        updated,
      );

      await service.setDefault(TENANT_A, PM_ID_1, USER_ID);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'payment_method_registry',
          entityId: PM_ID_1,
          tenantId: TENANT_A,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should set updated_by_user_id in the transaction update', async () => {
      const record = mockPaymentMethod({ is_active: true });
      const updated = mockPaymentMethod({ is_default: true });

      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        record,
      );
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.payment_method_registry.update.mockResolvedValue(
        updated,
      );

      await service.setDefault(TENANT_A, PM_ID_1, USER_ID);

      expect(
        mockPrismaService.payment_method_registry.update,
      ).toHaveBeenCalledWith({
        where: { id: PM_ID_1 },
        data: {
          is_default: true,
          updated_by_user_id: USER_ID,
        },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // findDefault()
  // ─────────────────────────────────────────────────────────

  describe('findDefault()', () => {
    it('should return the default payment method with usage data', async () => {
      const defaultMethod = mockPaymentMethod({ is_default: true });
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        defaultMethod,
      );

      const result = await service.findDefault(TENANT_A);

      expect(result).toBeTruthy();
      expect(result.is_default).toBe(true);
      expect(result).toHaveProperty('usage_count');
    });

    it('should return null when no default exists', async () => {
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        null,
      );

      const result = await service.findDefault(TENANT_A);

      expect(result).toBeNull();
    });

    it('should only return active defaults', async () => {
      mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(
        null,
      );

      await service.findDefault(TENANT_A);

      expect(
        mockPrismaService.payment_method_registry.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_A,
          is_default: true,
          is_active: true,
        },
      });
    });
  });
});
