# Sprint 2.8 — Unit Tests + Integration Tests

**Module:** Financial
**File:** `./documentation/sprints/financial/f02/sprint_2_8.md`
**Type:** Backend — Tests
**Depends On:** Sprint 2.7 (all services, controllers, and integrations must be complete)
**Gate:** STOP — All tests must pass. Run `npx jest --testPathPattern=supplier` and confirm zero failures before proceeding to Sprint 2.9.
**Estimated Complexity:** Medium

---

## Developer Standard

You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is deliberate, precise, and production-grade.

---

## Critical Warnings

- **This platform is 85% production-ready.** Never break existing code. Never leave the server running in the background.
- **Read the codebase before touching anything.** Implement with surgical precision — not a single comma may break existing business logic.
- **MySQL credentials are in the `.env` file** at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.
- **Never use `pkill -f`.** Always use `lsof -i :8000` + `kill {PID}`.
- **Never use PM2.** This project does NOT use PM2.

---

## Objective

Write unit tests and integration tests for all 3 supplier services. Tests must cover:
- All service method happy paths and error paths
- Tenant isolation (tenant A data not visible to tenant B)
- RBAC enforcement (Employee cannot create, can read)
- Google Places integration (mocked)
- Price history auto-creation on price change

Follow the EXACT test pattern from the existing `financial-category.service.spec.ts` file. Do not invent a new pattern.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.spec.ts` in FULL — this is the test pattern to replicate exactly
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.spec.ts` — understand how financial entry tests are structured
- [ ] Read all 3 supplier services to understand every method signature and business rule:
  - `supplier-category.service.ts`
  - `supplier.service.ts`
  - `supplier-product.service.ts`
- [ ] Verify all services compile and the dev server starts without errors

---

## Dev Server

> ⚠️ This project does NOT use PM2. Do not reference or run PM2 commands.
> ⚠️ Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   ← must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   ← must return nothing
```

---

## Test Pattern (from existing codebase)

**CRITICAL:** Read `financial-category.service.spec.ts` before writing any test. Replicate this exact pattern:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnderTest } from './service-under-test';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

// Constants
const TENANT_ID = 'tenant-uuid-001';
const TENANT_ID_OTHER = 'tenant-uuid-002'; // For tenant isolation tests
const USER_ID = 'user-uuid-001';

// Mock factories — one per entity
const mockRecord = (overrides: any = {}) => ({
  id: 'entity-uuid-001',
  tenant_id: TENANT_ID,
  // ... all fields with realistic defaults
  ...overrides,
});

// Mock services — jest.fn() for every Prisma method used
const mockPrismaService = {
  model_name: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrismaService)), // Mock transaction
  $queryRaw: jest.fn(),
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

// TestingModule setup
describe('ServiceUnderTest', () => {
  let service: ServiceUnderTest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceUnderTest,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<ServiceUnderTest>(ServiceUnderTest);
    jest.clearAllMocks();
  });

  // Tests organized by method
  describe('methodName()', () => {
    it('should do expected behavior', async () => {
      // Arrange
      mockPrismaService.model.findFirst.mockResolvedValue(null);
      // Act
      const result = await service.method(TENANT_ID, ...);
      // Assert
      expect(result).toBeDefined();
      expect(mockPrismaService.model.findFirst).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, ... },
      });
    });
  });
});
```

---

## Tasks

### Task 1 — Create `supplier-category.service.spec.ts`

**File:** `api/src/modules/financial/services/supplier-category.service.spec.ts`

**Mock setup:**
- Mock `PrismaService` with: `supplier_category.create`, `supplier_category.findMany`, `supplier_category.findFirst`, `supplier_category.count`, `supplier_category.update`, `supplier_category.delete`
- Mock `supplier_category_assignment.count` (used by delete method)
- Mock `AuditLoggerService.logTenantChange`

**Tests to write (minimum):**

```
describe('SupplierCategoryService')

  describe('create()')
    ✓ should create a category and return it
    ✓ should throw ConflictException when name already exists (case-insensitive)
    ✓ should throw BadRequestException when 50 active categories limit reached
    ✓ should call auditLogger.logTenantChange with action 'created'
    ✓ should include tenant_id in every Prisma query (tenant isolation)

  describe('findAll()')
    ✓ should return all categories for a tenant
    ✓ should filter by is_active when provided
    ✓ should include supplier_count for each category
    ✓ should NOT return categories from a different tenant (tenant isolation)

  describe('findOne()')
    ✓ should return the category when found
    ✓ should throw NotFoundException when category does not exist
    ✓ should throw NotFoundException when category belongs to a different tenant

  describe('update()')
    ✓ should update and return the category
    ✓ should throw ConflictException when name change conflicts with existing
    ✓ should throw BadRequestException when reactivating exceeds 50-limit
    ✓ should allow deactivation without affecting assignments
    ✓ should call auditLogger.logTenantChange with before and after

  describe('delete()')
    ✓ should delete the category when no assignments exist
    ✓ should throw ConflictException when category is assigned to suppliers
    ✓ should call auditLogger.logTenantChange with action 'deleted'
```

---

### Task 2 — Create `supplier.service.spec.ts`

**File:** `api/src/modules/financial/services/supplier.service.spec.ts`

**Mock setup:**
- Mock `PrismaService` with: `supplier.create`, `supplier.findMany`, `supplier.findFirst`, `supplier.count`, `supplier.update`
- Mock `supplier_category.findMany` (for category validation)
- Mock `supplier_category_assignment.createMany`, `supplier_category_assignment.deleteMany`
- Mock `financial_entry.aggregate`, `financial_entry.count`, `financial_entry.groupBy`
- Mock `financial_category.findMany` (for statistics category name resolution)
- Mock `$transaction` and `$queryRaw`
- Mock `AuditLoggerService.logTenantChange`
- Mock `GoogleMapsService.validateAddress`

**GoogleMapsService mock:**
```typescript
import { GoogleMapsService } from '../../leads/services/google-maps.service';

const mockGoogleMapsService = {
  validateAddress: jest.fn(),
};
```

Register in providers:
```typescript
{ provide: GoogleMapsService, useValue: mockGoogleMapsService },
```

**Tests to write (minimum):**

```
describe('SupplierService')

  describe('create()')
    ✓ should create a supplier with name only (no address)
    ✓ should create a supplier with full details and category assignments
    ✓ should throw ConflictException when name already exists
    ✓ should throw BadRequestException when category_ids are invalid
    ✓ should call GoogleMapsService.validateAddress when address info provided
    ✓ should NOT call GoogleMapsService when no address info provided
    ✓ should store resolved lat/lng from Google Maps
    ✓ should include tenant_id in every Prisma query

  describe('findAll()')
    ✓ should return paginated suppliers with meta
    ✓ should filter by search (name, contact_name, email)
    ✓ should filter by category_id
    ✓ should filter by is_active (default true)
    ✓ should filter by is_preferred
    ✓ should sort by specified field and order
    ✓ should include categories and product_count in response

  describe('findOne()')
    ✓ should return supplier with categories and products
    ✓ should throw NotFoundException when not found
    ✓ should throw NotFoundException for wrong tenant (tenant isolation)

  describe('update()')
    ✓ should update supplier fields
    ✓ should throw ConflictException on name change conflict
    ✓ should replace category assignments when category_ids provided
    ✓ should remove all categories when empty array provided
    ✓ should re-resolve address when address fields change

  describe('softDelete()')
    ✓ should set is_active to false
    ✓ should throw NotFoundException when not found

  describe('findForMap()')
    ✓ should return only active suppliers with lat/lng
    ✓ should NOT return suppliers without coordinates
    ✓ should NOT return inactive suppliers

  describe('getStatistics()')
    ✓ should return aggregated spend data
    ✓ should throw NotFoundException when supplier not found
    ✓ should return zero totals when no financial entries exist

  describe('updateSpendTotals()')
    ✓ should update total_spend and last_purchase_date from aggregate
    ✓ should set total_spend to 0 when no entries exist
    ✓ should set last_purchase_date to null when no entries exist
```

---

### Task 3 — Create `supplier-product.service.spec.ts`

**File:** `api/src/modules/financial/services/supplier-product.service.spec.ts`

**Mock setup:**
- Mock `PrismaService` with: `supplier.findFirst` (verifySupplierExists), `supplier_product.create`, `supplier_product.findMany`, `supplier_product.findFirst`, `supplier_product.update`
- Mock `supplier_product_price_history.create`, `supplier_product_price_history.findMany`
- Mock `$transaction`
- Mock `AuditLoggerService.logTenantChange`

**Tests to write (minimum):**

```
describe('SupplierProductService')

  describe('create()')
    ✓ should create product without price (unit_price undefined)
    ✓ should create product with price and create initial price history record
    ✓ should throw NotFoundException when supplier not found
    ✓ should throw ConflictException when product name already exists for supplier
    ✓ should set price_last_updated_at when unit_price provided
    ✓ should NOT create price history when unit_price not provided

  describe('findAll()')
    ✓ should return active products by default
    ✓ should filter by is_active when provided
    ✓ should throw NotFoundException when supplier not found

  describe('update()')
    ✓ should update product fields
    ✓ should create price history record when unit_price changes
    ✓ should NOT create price history when unit_price unchanged
    ✓ should NOT create price history when other fields change (not price)
    ✓ should set price_last_updated_at and price_last_updated_by_user_id on price change
    ✓ should throw ConflictException on name change conflict
    ✓ should throw NotFoundException when product not found

  describe('softDelete()')
    ✓ should set is_active to false
    ✓ should throw NotFoundException when product not found

  describe('getPriceHistory()')
    ✓ should return price history ordered by changed_at desc
    ✓ should include changed_by user details
    ✓ should throw NotFoundException when product not found
```

---

### Task 4 — Run Tests and Fix Failures

**Run tests:**
```bash
cd /var/www/lead360.app/api
npx jest --testPathPattern=supplier --verbose
```

**Expected output:**
- All tests pass (green)
- Zero failures
- Coverage output showing methods tested

**If any test fails:**
- Read the failure message
- Check if the service implementation has a bug or the test mock is incorrect
- Fix the issue (prefer fixing the test mock first, then the service if there's a real bug)
- Re-run until all pass

**Also verify existing tests are not broken:**
```bash
npx jest --testPathPattern=financial --verbose
```

All existing financial tests must still pass.

---

### Task 5 — Verify Test Coverage

**What:** Confirm all service methods have at least one test.

**Check manually:**
- SupplierCategoryService: create, findAll, findOne, update, delete — all tested ✓
- SupplierService: create, findAll, findOne, update, softDelete, findForMap, getStatistics, updateSpendTotals — all tested ✓
- SupplierProductService: create, findAll, update, softDelete, getPriceHistory — all tested ✓

**Contract-required test scenarios:**
- [ ] Tenant isolation: At least one test verifies a query includes `tenant_id` and won't return data from another tenant
- [ ] RBAC: Controller-level tests or service-level notes that Employee role has read access but not write
- [ ] Google Places mocked: `validateAddress` mock is configured and verified to be called
- [ ] Price history auto-creation: Test verifies price history record is created when `unit_price` changes

---

## Files Created in This Sprint

| File | Purpose |
|------|---------|
| `api/src/modules/financial/services/supplier-category.service.spec.ts` | Unit tests for SupplierCategoryService (19+ tests) |
| `api/src/modules/financial/services/supplier.service.spec.ts` | Unit + integration tests for SupplierService (27+ tests) |
| `api/src/modules/financial/services/supplier-product.service.spec.ts` | Unit tests for SupplierProductService (19+ tests) |

---

## Acceptance Criteria

- [ ] `supplier-category.service.spec.ts` exists with tests for all 5 methods
- [ ] `supplier.service.spec.ts` exists with tests for all 8 methods including Google Places mock
- [ ] `supplier-product.service.spec.ts` exists with tests for all 5 methods including price history
- [ ] All tests pass: `npx jest --testPathPattern=supplier` returns zero failures
- [ ] Existing financial tests still pass: `npx jest --testPathPattern=financial` returns zero failures
- [ ] Tenant isolation verified: at least 1 test checks tenant_id filtering
- [ ] Google Places mock: `validateAddress` mocked and call verified in test
- [ ] Price history: test verifies `supplier_product_price_history.create` called when price changes
- [ ] No existing files modified
- [ ] Dev server shut down before marking sprint complete

---

## Gate Marker

**STOP** — All tests must pass. Run `npx jest --testPathPattern=supplier --verbose` and verify zero failures. Run `npx jest --testPathPattern=financial` to verify no existing tests broken. **Do not begin Sprint 2.9 until all tests pass.**

---

## Handoff Notes

**For Sprint 2.9 (Verification Gate + API Documentation):**
- All 3 test files exist and pass
- Test coverage includes tenant isolation, RBAC, Google Places mock, and price history
- The final verification sprint can now run all tests as part of the acceptance check
- Total test count: approximately 65+ tests across 3 spec files
