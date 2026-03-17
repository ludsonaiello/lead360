# Sprint 3_6 — Unit Tests: PaymentMethodRegistryService

**Module:** Financial
**File:** ./documentation/sprints/financial/f03/sprint_3_6.md
**Type:** Backend (Tests)
**Depends On:** Sprint 3_5 (Financial Entry Integration must be complete)
**Gate:** NONE — proceed to Sprint 3_7 when all tests pass
**Estimated Complexity:** Medium

> **You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality.** Every line you write must reflect that standard.

> **WARNING:** This platform is 85% production-ready. Never leave the dev server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

---

## Objective

Write comprehensive unit tests for `PaymentMethodRegistryService`. Cover all 7 service methods, all business rules (nickname uniqueness, last_four validation, default atomicity, 50-method limit, soft-delete with default reassignment), tenant isolation, and edge cases. Achieve >80% service coverage.

---

## Pre-Sprint Checklist

- [ ] Sprint 3_5 complete — all endpoints working, auto-copy integration tested
- [ ] Read existing test files for patterns:
  - `/var/www/lead360.app/api/src/modules/financial/services/crew-payment.service.spec.ts` (if exists)
  - Or any other `.spec.ts` file in the financial module or quotes module
- [ ] Read the service being tested:
  - `/var/www/lead360.app/api/src/modules/financial/services/payment-method-registry.service.ts`
- [ ] Check the test runner command: `cd /var/www/lead360.app/api && npx jest --passWithNoTests`

---

## Dev Server

> This project does NOT use PM2. Do not reference or run PM2 commands.
> Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

**For this sprint, you do NOT need the dev server running.** Tests run with Jest, not via the HTTP server. However, if you need to verify compilation:

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   <- must return nothing before proceeding
```

**Run tests with:**
```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern="payment-method-registry" --verbose
```

**MySQL credentials** are in `/var/www/lead360.app/api/.env` — do not hardcode any database credentials.

**BEFORE marking the sprint COMPLETE:**
Ensure no dev server is left running:
```
lsof -i :8000
```
If a process is found, kill it.

---

## Tasks

### Task 1 — Read Existing Test Patterns

**What:** Search for and read existing `.spec.ts` files in the codebase to understand test conventions:

```bash
find /var/www/lead360.app/api/src -name "*.spec.ts" -type f | head -20
```

Read at least 2 existing spec files to understand:
- How `PrismaService` is mocked
- How `AuditLoggerService` is mocked
- The `TestingModule` setup pattern
- Test naming conventions
- How assertions are structured

**Do NOT:** Write tests before reading existing patterns.

---

### Task 2 — Create the Test File

**What:** Create the file at:
```
/var/www/lead360.app/api/src/modules/financial/services/payment-method-registry.service.spec.ts
```

**Test file structure:**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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

    service = module.get<PaymentMethodRegistryService>(PaymentMethodRegistryService);
    jest.clearAllMocks();

    // Default: usage count = 0, no last used date
    mockPrismaService.financial_entry.count.mockResolvedValue(0);
    mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);
  });

  // Tests defined in Tasks 3–9 below
});
```

---

### Task 3 — Tests for `create()` Method

Add these test cases inside the `describe` block:

```typescript
describe('create()', () => {
  const createDto = {
    nickname: 'Chase Business Visa',
    type: 'credit_card',
    bank_name: 'Chase',
    last_four: '4521',
  };

  it('should create a payment method and return it with usage data', async () => {
    mockPrismaService.payment_method_registry.count.mockResolvedValue(5); // under limit
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(null); // no duplicate
    mockPrismaService.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrismaService);
    });
    mockPrismaService.payment_method_registry.create.mockResolvedValue(mockPaymentMethod());

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
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(mockPaymentMethod());

    await expect(service.create(TENANT_A, USER_ID, createDto)).rejects.toThrow(ConflictException);
  });

  it('should throw BadRequestException if tenant has 50 active payment methods', async () => {
    mockPrismaService.payment_method_registry.count.mockResolvedValue(50);

    await expect(service.create(TENANT_A, USER_ID, createDto)).rejects.toThrow(BadRequestException);
  });

  it('should unset existing defaults when creating with is_default=true', async () => {
    mockPrismaService.payment_method_registry.count.mockResolvedValue(5);
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(null);
    mockPrismaService.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrismaService);
    });
    mockPrismaService.payment_method_registry.create.mockResolvedValue(
      mockPaymentMethod({ is_default: true }),
    );

    await service.create(TENANT_A, USER_ID, { ...createDto, is_default: true });

    expect(mockPrismaService.payment_method_registry.updateMany).toHaveBeenCalledWith({
      where: { tenant_id: TENANT_A, is_default: true },
      data: { is_default: false },
    });
  });

  it('should NOT unset defaults when creating with is_default=false', async () => {
    mockPrismaService.payment_method_registry.count.mockResolvedValue(5);
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(null);
    mockPrismaService.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrismaService);
    });
    mockPrismaService.payment_method_registry.create.mockResolvedValue(mockPaymentMethod());

    await service.create(TENANT_A, USER_ID, { ...createDto, is_default: false });

    expect(mockPrismaService.payment_method_registry.updateMany).not.toHaveBeenCalled();
  });
});
```

---

### Task 4 — Tests for `findAll()` Method

```typescript
describe('findAll()', () => {
  it('should return array of payment methods with usage data', async () => {
    mockPrismaService.payment_method_registry.findMany.mockResolvedValue([
      mockPaymentMethod(),
      mockPaymentMethod({ id: PM_ID_2, nickname: 'Petty Cash', type: 'cash' }),
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

    expect(mockPrismaService.payment_method_registry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_A, is_active: true }),
      }),
    );
  });

  it('should include inactive when is_active=false', async () => {
    mockPrismaService.payment_method_registry.findMany.mockResolvedValue([]);

    await service.findAll(TENANT_A, { is_active: false });

    const callArgs = mockPrismaService.payment_method_registry.findMany.mock.calls[0][0];
    // When is_active=false, the where clause should NOT filter by is_active
    expect(callArgs.where.is_active).toBeUndefined();
  });

  it('should filter by type when provided', async () => {
    mockPrismaService.payment_method_registry.findMany.mockResolvedValue([]);

    await service.findAll(TENANT_A, { type: 'credit_card' });

    expect(mockPrismaService.payment_method_registry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'credit_card' }),
      }),
    );
  });

  it('should order by is_default DESC then nickname ASC', async () => {
    mockPrismaService.payment_method_registry.findMany.mockResolvedValue([]);

    await service.findAll(TENANT_A, {});

    expect(mockPrismaService.payment_method_registry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ is_default: 'desc' }, { nickname: 'asc' }],
      }),
    );
  });
});
```

---

### Task 5 — Tests for `findOne()` Method

```typescript
describe('findOne()', () => {
  it('should return a payment method with usage data', async () => {
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(mockPaymentMethod());

    const result = await service.findOne(TENANT_A, PM_ID_1);

    expect(result.id).toBe(PM_ID_1);
    expect(result).toHaveProperty('usage_count');
    expect(result).toHaveProperty('last_used_date');
  });

  it('should throw NotFoundException if record does not exist', async () => {
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(null);

    await expect(service.findOne(TENANT_A, 'nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('should NOT return records from other tenants (tenant isolation)', async () => {
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(null);

    await expect(service.findOne(TENANT_B, PM_ID_1)).rejects.toThrow(NotFoundException);

    expect(mockPrismaService.payment_method_registry.findFirst).toHaveBeenCalledWith({
      where: { id: PM_ID_1, tenant_id: TENANT_B },
    });
  });
});
```

---

### Task 6 — Tests for `update()` Method

```typescript
describe('update()', () => {
  it('should update a payment method and return it with usage data', async () => {
    const existing = mockPaymentMethod();
    const updated = mockPaymentMethod({ nickname: 'Updated Name' });
    // IMPORTANT: Use mockResolvedValueOnce for sequential findFirst calls.
    // First call: findOne() looks up the record.
    // Second call: duplicate nickname check — must return null (no conflict).
    mockPrismaService.payment_method_registry.findFirst
      .mockResolvedValueOnce(existing)  // findOne
      .mockResolvedValueOnce(null);     // duplicate nickname check — no conflict
    mockPrismaService.payment_method_registry.update.mockResolvedValue(updated);

    const result = await service.update(TENANT_A, PM_ID_1, USER_ID, { nickname: 'Updated Name' });

    expect(result.nickname).toBe('Updated Name');
    expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'updated' }),
    );
  });

  it('should throw ConflictException if updated nickname conflicts with another record', async () => {
    mockPrismaService.payment_method_registry.findFirst
      .mockResolvedValueOnce(mockPaymentMethod()) // findOne
      .mockResolvedValueOnce(mockPaymentMethod({ id: PM_ID_2 })); // duplicate check

    await expect(
      service.update(TENANT_A, PM_ID_1, USER_ID, { nickname: 'Existing Name' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if record does not exist', async () => {
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(null);

    await expect(
      service.update(TENANT_A, 'nonexistent', USER_ID, { nickname: 'Test' }),
    ).rejects.toThrow(NotFoundException);
  });
});
```

---

### Task 7 — Tests for `softDelete()` Method

```typescript
describe('softDelete()', () => {
  it('should set is_active=false and return the deactivated record', async () => {
    const existing = mockPaymentMethod({ is_default: false });
    const deactivated = mockPaymentMethod({ is_active: false });
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(existing);
    mockPrismaService.payment_method_registry.update.mockResolvedValue(deactivated);

    const result = await service.softDelete(TENANT_A, PM_ID_1, USER_ID);

    expect(mockPrismaService.payment_method_registry.update).toHaveBeenCalledWith({
      where: { id: PM_ID_1 },
      data: { is_active: false, updated_by_user_id: USER_ID },
    });
    expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'deleted' }),
    );
  });

  it('should auto-assign default to most recent active method when deleting the default', async () => {
    const existing = mockPaymentMethod({ is_default: true });
    const deactivated = mockPaymentMethod({ is_default: true, is_active: false });
    const newDefault = mockPaymentMethod({ id: PM_ID_2, nickname: 'Petty Cash', is_default: false });

    mockPrismaService.payment_method_registry.findFirst
      .mockResolvedValueOnce(existing) // findOne
      .mockResolvedValueOnce(newDefault); // find new default candidate
    mockPrismaService.payment_method_registry.update
      .mockResolvedValueOnce(deactivated) // soft delete
      .mockResolvedValueOnce({ ...newDefault, is_default: true }); // set new default

    await service.softDelete(TENANT_A, PM_ID_1, USER_ID);

    // Verify the new default was set
    expect(mockPrismaService.payment_method_registry.update).toHaveBeenCalledTimes(2);
    expect(mockPrismaService.payment_method_registry.update).toHaveBeenLastCalledWith({
      where: { id: PM_ID_2 },
      data: { is_default: true },
    });
  });

  it('should NOT reassign default when deleting a non-default method', async () => {
    const existing = mockPaymentMethod({ is_default: false });
    const deactivated = mockPaymentMethod({ is_active: false, is_default: false });
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(existing);
    mockPrismaService.payment_method_registry.update.mockResolvedValue(deactivated);

    await service.softDelete(TENANT_A, PM_ID_1, USER_ID);

    // Only called once (the soft delete), not twice (no reassignment)
    expect(mockPrismaService.payment_method_registry.update).toHaveBeenCalledTimes(1);
  });

  it('should not reassign default when deleting the last active method', async () => {
    const existing = mockPaymentMethod({ is_default: true });
    const deactivated = mockPaymentMethod({ is_default: true, is_active: false });

    mockPrismaService.payment_method_registry.findFirst
      .mockResolvedValueOnce(existing) // findOne
      .mockResolvedValueOnce(null); // no other active methods
    mockPrismaService.payment_method_registry.update.mockResolvedValue(deactivated);

    await service.softDelete(TENANT_A, PM_ID_1, USER_ID);

    // Only called once (the soft delete), no reassignment
    expect(mockPrismaService.payment_method_registry.update).toHaveBeenCalledTimes(1);
  });
});
```

---

### Task 8 — Tests for `setDefault()` and `findDefault()` Methods

```typescript
describe('setDefault()', () => {
  it('should atomically set the specified method as default', async () => {
    const record = mockPaymentMethod({ is_active: true });
    const updated = mockPaymentMethod({ is_default: true });

    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(record);
    mockPrismaService.$transaction.mockImplementation(async (fn) => {
      return fn(mockPrismaService);
    });
    mockPrismaService.payment_method_registry.update.mockResolvedValue(updated);

    const result = await service.setDefault(TENANT_A, PM_ID_1, USER_ID);

    expect(mockPrismaService.payment_method_registry.updateMany).toHaveBeenCalledWith({
      where: { tenant_id: TENANT_A, is_default: true },
      data: { is_default: false },
    });
    expect(result.is_default).toBe(true);
  });

  it('should throw BadRequestException if payment method is inactive', async () => {
    const record = mockPaymentMethod({ is_active: false });
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(record);

    await expect(service.setDefault(TENANT_A, PM_ID_1, USER_ID)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if record does not exist', async () => {
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(null);

    await expect(service.setDefault(TENANT_A, 'nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
  });
});

describe('findDefault()', () => {
  it('should return the default payment method with usage data', async () => {
    const defaultMethod = mockPaymentMethod({ is_default: true });
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(defaultMethod);

    const result = await service.findDefault(TENANT_A);

    expect(result).toBeTruthy();
    expect(result.is_default).toBe(true);
    expect(result).toHaveProperty('usage_count');
  });

  it('should return null when no default exists', async () => {
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(null);

    const result = await service.findDefault(TENANT_A);

    expect(result).toBeNull();
  });

  it('should only return active defaults', async () => {
    mockPrismaService.payment_method_registry.findFirst.mockResolvedValue(null);

    await service.findDefault(TENANT_A);

    expect(mockPrismaService.payment_method_registry.findFirst).toHaveBeenCalledWith({
      where: {
        tenant_id: TENANT_A,
        is_default: true,
        is_active: true,
      },
    });
  });
});
```

---

### Task 9 — Run All Tests

**What:** Run the test suite:

```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern="payment-method-registry" --verbose
```

**Acceptance:** All tests pass. Zero failures.

If any tests fail, debug and fix them. Common issues:
- Mock not returning the expected shape
- `$transaction` mock not calling the callback correctly
- Jest mock call order not matching (use `mockResolvedValueOnce` for sequential calls)

---

### Task 10 — Verify No Existing Tests Broken

**What:** Run the full test suite (or at least the financial module tests):

```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern="financial" --verbose --passWithNoTests
```

**Acceptance:** All existing tests still pass. Zero regressions.

---

## Patterns to Apply

### Test Module Setup Pattern

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    ServiceUnderTest,
    { provide: PrismaService, useValue: mockPrismaService },
    { provide: AuditLoggerService, useValue: mockAuditLoggerService },
  ],
}).compile();
```

### Mock Prisma Pattern

```typescript
const mockPrismaService = {
  model_name: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};
```

### Transaction Mock Pattern

```typescript
mockPrismaService.$transaction.mockImplementation(async (fn) => {
  return fn(mockPrismaService);
});
```

### Sequential Mock Returns

```typescript
mockPrismaService.model.findFirst
  .mockResolvedValueOnce(firstResult)   // first call
  .mockResolvedValueOnce(secondResult); // second call
```

---

## Business Rules Tested

| Business Rule | Test Description |
|---|---|
| BR-01: Unique nickname per tenant | ConflictException on duplicate |
| BR-03: Single default per tenant | `setDefault` calls `updateMany` to clear others |
| BR-04: Atomic default changes | `$transaction` is used |
| BR-06: Inactive cannot be default | `setDefault` throws BadRequestException |
| BR-07: Auto-reassign default on delete | `softDelete` finds and sets new default |
| BR-08: 50-method limit | `create` throws BadRequestException at 50 |
| Tenant isolation | `findOne` uses `tenant_id` in query |

---

## Acceptance Criteria

- [ ] Test file exists at `payment-method-registry.service.spec.ts`
- [ ] Tests cover all 7 public service methods: `create`, `findAll`, `findOne`, `update`, `softDelete`, `setDefault`, `findDefault`
- [ ] Tests cover error cases: 404 not found, 409 conflict, 400 bad request
- [ ] Tests verify tenant isolation (queries include `tenant_id`)
- [ ] Tests verify default atomicity ($transaction pattern)
- [ ] Tests verify soft-delete with auto-default-reassignment
- [ ] Tests verify 50-method limit enforcement
- [ ] Tests verify audit logging is called on CUD operations
- [ ] All tests pass: `npx jest --testPathPattern="payment-method-registry" --verbose`
- [ ] No existing tests broken
- [ ] No frontend code was modified
- [ ] Dev server is not left running

---

## Gate Marker

NONE — Proceed to Sprint 3_7 when all tests pass.

---

## Handoff Notes

**For Sprint 3_7 (API Documentation + Final Gate):**
- All service methods are tested and working
- The test file serves as executable documentation of all business rules
- Tests confirm: create, findAll, findOne, update, softDelete, setDefault, findDefault all work correctly
- Tenant isolation is verified in tests
