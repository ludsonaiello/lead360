# Sprint 4_7 — Unit Tests for FinancialEntryService

**Module:** Financial
**File:** ./documentation/sprints/financial/f04/sprint_4_7.md
**Type:** Backend — Unit Tests
**Depends On:** Sprint 4_6 (controller wired, all endpoints responding)
**Gate:** STOP — All tests pass, coverage > 80% for FinancialEntryService
**Estimated Complexity:** High

---

> **You are a masterclass-level engineer.** Your code makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is intentional, precise, and production-grade.

> ⚠️ **CRITICAL WARNINGS:**
> - This platform is **85% production-ready**. Never break existing code. Not a single comma.
> - Never leave the dev server running in the background when you finish.
> - Read the codebase BEFORE touching anything. Implement with surgical precision.
> - MySQL credentials are in `/var/www/lead360.app/api/.env`
> - This project does **NOT** use PM2. Do not reference or run any PM2 command.

---

## Objective

Write comprehensive unit tests for all new and modified methods in `FinancialEntryService`. Tests must cover role-based behavior, validation rules, error cases, and the pending workflow (approve/reject/resubmit).

---

## Pre-Sprint Checklist

- [ ] Read the existing test file: `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.spec.ts`
- [ ] Read the current `financial-entry.service.ts` in full — understand every method
- [ ] Read all DTOs to understand field names and validation rules
- [ ] Understand the mock setup pattern used in existing tests

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

Tests do NOT require the dev server to be running. But run it briefly at the end to verify compilation.

Run tests with:
  cd /var/www/lead360.app/api && npx jest src/modules/financial/services/financial-entry.service.spec.ts --verbose

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID} (if running)
  Confirm port is free: lsof -i :8000   ← must return nothing
```

---

## Tasks

### Task 1 — Update Test File Setup

**File:** `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.spec.ts`

**What:** The existing test file needs to be updated to:
1. Add new mock methods for all Prisma models the service now uses
2. Update the mock entry factory to include all F-04 fields
3. Add mock for `SupplierService` or the Prisma supplier model (depending on Sprint 4_4 approach)

**Updated mock factories:**

```typescript
const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const OTHER_USER_ID = 'user-uuid-002';
const PROJECT_ID = 'project-uuid-001';
const CATEGORY_ID = 'category-uuid-001';
const TASK_ID = 'task-uuid-001';
const ENTRY_ID = 'entry-uuid-001';
const SUPPLIER_ID = 'supplier-uuid-001';
const REGISTRY_ID = 'registry-uuid-001';
const CREW_MEMBER_ID = 'crew-uuid-001';

const OWNER_ROLES = ['Owner'];
const ADMIN_ROLES = ['Admin'];
const MANAGER_ROLES = ['Manager'];
const BOOKKEEPER_ROLES = ['Bookkeeper'];
const EMPLOYEE_ROLES = ['Employee'];

const mockCategory = (overrides: any = {}) => ({
  id: CATEGORY_ID,
  name: 'Materials',
  type: 'material',
  classification: 'cost_of_goods_sold',
  ...overrides,
});

const mockEntryRecord = (overrides: any = {}) => ({
  id: ENTRY_ID,
  tenant_id: TENANT_ID,
  project_id: PROJECT_ID,
  project: { id: PROJECT_ID, name: 'Kitchen Remodel' },
  task_id: null,
  task: null,
  category_id: CATEGORY_ID,
  category: mockCategory(),
  entry_type: 'expense',
  amount: 450.00,
  tax_amount: null,
  entry_date: new Date('2026-03-10'),
  entry_time: null,
  vendor_name: 'Home Depot',
  supplier_id: null,
  supplier: null,
  payment_method: null,
  payment_method_registry_id: null,
  // Use actual relation name from schema (check Sprint 4_3):
  payment_method_registry_rel: null,
  purchased_by_user_id: null,
  purchased_by_user: null,
  purchased_by_crew_member_id: null,
  purchased_by_crew_member: null,
  submission_status: 'confirmed',
  rejection_reason: null,
  rejected_by_user_id: null,
  rejected_at: null,
  rejected_by: null,
  is_recurring_instance: false,
  recurring_rule_id: null,
  has_receipt: false,
  notes: '2x4 studs for framing',
  created_by_user_id: USER_ID,
  created_by: { id: USER_ID, first_name: 'John', last_name: 'Doe' },
  updated_by_user_id: null,
  created_at: new Date('2026-03-10T10:00:00.000Z'),
  updated_at: new Date('2026-03-10T10:00:00.000Z'),
  ...overrides,
});
```

**Updated Prisma mock — add all models the service now queries:**

```typescript
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
```

**IMPORTANT:** Read the actual service to see which Prisma models it queries. Add mocks for ALL of them.

---

### Task 2 — Role-Based Behavior Tests for `createEntry()`

**Test cases:**

```
describe('createEntry() — Role-based submission_status', () => {
  it('should force submission_status to pending_review for Employee role')
  it('should default submission_status to confirmed for Owner role')
  it('should default submission_status to confirmed for Admin role')
  it('should default submission_status to confirmed for Manager role')
  it('should default submission_status to confirmed for Bookkeeper role')
  it('should allow Owner to explicitly set submission_status to pending_review')
  it('should ignore Employee submission_status override attempt — always pending_review')
})
```

For each test:
1. Mock category validation to pass
2. Mock Prisma create to return mock entry
3. Call `service.createEntry(TENANT_ID, USER_ID, [role], dto)`
4. Assert the `create` call data includes correct `submission_status`

---

### Task 3 — Validation Tests for `createEntry()`

```
describe('createEntry() — Validation', () => {
  it('should throw 400 when both purchased_by_user_id and purchased_by_crew_member_id provided')
  it('should throw 400 when tax_amount >= amount')
  it('should throw 404 when category_id not found in tenant')
  it('should throw 404 when project_id not found in tenant')
  it('should throw 404 when task_id not found in tenant')
  it('should throw 404 when supplier_id not found or inactive')
  it('should throw 404 when payment_method_registry_id not found or inactive')
  it('should throw 404 when purchased_by_user_id not in tenant')
  it('should throw 404 when purchased_by_crew_member_id not in tenant')
  it('should auto-copy payment_method type from registry when payment_method_registry_id provided')
  it('should call updateSupplierSpendTotals when supplier_id is provided')
  it('should NOT call updateSupplierSpendTotals when supplier_id is not provided')
})
```

---

### Task 4 — Role-Based Tests for `getEntries()`

```
describe('getEntries() — Employee scoping', () => {
  it('should add created_by_user_id filter for Employee role')
  it('should NOT add created_by_user_id filter for Owner role')
  it('should NOT add created_by_user_id filter for Manager role')
  it('should return summary block with correct totals')
  it('should apply all filter parameters correctly')
  it('should support search across vendor_name and notes')
  it('should paginate correctly')
  it('should sort by entry_date desc by default')
})
```

---

### Task 5 — Role-Based Tests for `getEntryById()`

```
describe('getEntryById() — Role enforcement', () => {
  it('should return entry for Owner regardless of creator')
  it('should return entry for Employee when they are the creator')
  it('should throw ForbiddenException for Employee when they are NOT the creator')
  it('should throw NotFoundException when entry not found')
  it('should return enriched response with all joined fields')
})
```

---

### Task 6 — Role-Based Tests for `updateEntry()`

```
describe('updateEntry() — Role enforcement', () => {
  it('should allow Owner to edit any entry in any status')
  it('should allow Manager to edit any entry in any status')
  it('should allow Bookkeeper to edit any entry in any status')
  it('should allow Employee to edit own pending_review entry')
  it('should throw ForbiddenException when Employee edits another user entry')
  it('should throw ForbiddenException when Employee edits own confirmed entry')
  it('should update supplier spend when supplier_id changes')
  it('should update BOTH old and new supplier spend on supplier change')
  it('should re-copy payment method type when payment_method_registry_id changes')
})
```

---

### Task 7 — Role-Based Tests for `deleteEntry()`

```
describe('deleteEntry() — Role enforcement', () => {
  it('should allow Owner to delete any entry')
  it('should allow Admin to delete any entry')
  it('should throw ForbiddenException for Manager')
  it('should throw ForbiddenException for Bookkeeper')
  it('should allow Employee to delete own pending_review entry')
  it('should throw ForbiddenException when Employee deletes own confirmed entry')
  it('should throw ForbiddenException when Employee deletes another user entry')
  it('should call updateSupplierSpendTotals when deleted entry had supplier_id')
})
```

---

### Task 8 — Pending Workflow Tests

```
describe('approveEntry()', () => {
  it('should set submission_status to confirmed')
  it('should throw BadRequestException when entry is already confirmed')
  it('should throw NotFoundException when entry not found')
  it('should audit log with EXPENSE_APPROVED action')
})

describe('rejectEntry()', () => {
  it('should set rejection_reason, rejected_by_user_id, rejected_at')
  it('should NOT change submission_status — stays pending_review')
  it('should throw BadRequestException when entry is not pending')
  it('should throw NotFoundException when entry not found')
  it('should audit log with EXPENSE_REJECTED action')
})

describe('resubmitEntry()', () => {
  it('should clear rejection_reason, rejected_by_user_id, rejected_at')
  it('should keep submission_status as pending_review')
  it('should apply optional field updates from dto')
  it('should throw BadRequestException when entry was not rejected (rejected_at is null)')
  it('should throw ForbiddenException when Employee resubmits another user entry')
  it('should allow Owner to resubmit any entry')
  it('should audit log with EXPENSE_RESUBMITTED action')
})
```

---

### Task 9 — Export Tests

```
describe('exportEntries()', () => {
  it('should return CSV string with correct headers')
  it('should throw BadRequestException when result set exceeds 10000 rows')
  it('should escape commas and quotes in CSV fields')
  it('should include all required CSV columns')
  it('should handle null fields gracefully (empty string in CSV)')
})
```

---

### Task 10 — Tenant Isolation Tests

```
describe('Tenant isolation', () => {
  it('should always include tenant_id in getEntries where clause')
  it('should always include tenant_id in getEntryById where clause')
  it('should always include tenant_id in getPendingEntries where clause')
  it('should always include tenant_id in createEntry data')
  it('should not return entry when queried with different tenant_id')
})
```

---

### Task 11 — Run Tests

**What:** Run the test suite:

```bash
cd /var/www/lead360.app/api && npx jest src/modules/financial/services/financial-entry.service.spec.ts --verbose
```

**Acceptance:** All tests pass.

**If tests fail:** Fix the tests OR fix the service code (if the test reveals a bug). Document any service fixes made.

---

### Task 12 — Run Full Financial Module Tests

**What:** Verify existing tests still pass:

```bash
cd /var/www/lead360.app/api && npx jest src/modules/financial/ --verbose
```

**Acceptance:** ALL financial module tests pass — not just the entry service tests.

---

## Acceptance Criteria

- [ ] At least 40 test cases covering all service methods
- [ ] Role-based submission_status tests: Employee → pending_review, Owner → confirmed
- [ ] Mutual exclusion test: both purchased_by fields → 400
- [ ] Tax amount test: tax_amount >= amount → 400
- [ ] Payment method auto-copy test
- [ ] Supplier spend update tests (create, update, delete)
- [ ] Employee scoping test for getEntries
- [ ] Employee ownership test for getEntryById (ForbiddenException)
- [ ] Employee edit restriction test (own pending only)
- [ ] Manager/Bookkeeper delete restriction test (403)
- [ ] Full approve flow test
- [ ] Full reject flow test (status stays pending_review)
- [ ] Full resubmit flow test (clears rejection fields)
- [ ] Resubmit non-rejected entry → 400 test
- [ ] Export CSV headers test
- [ ] Export 10,000 limit test
- [ ] Tenant isolation tests
- [ ] ALL existing financial module tests still pass
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — All unit tests must pass. All existing tests must still pass. Run the full financial module test suite before proceeding.

---

## Handoff Notes

After this sprint, the `FinancialEntryService` has comprehensive unit test coverage. Sprint 4_8 will produce the API documentation. Sprint 4_9 will perform final verification.
