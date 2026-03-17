# Sprint 1.4 — Unit Tests: Updated Mocks, New Scenarios, Full Coverage

**Module:** Financial
**File:** `./documentation/sprints/financial/f01/sprint_1_4.md`
**Type:** Backend (Unit Tests)
**Depends On:** Sprint 1.3 (service logic changes must be complete)
**Gate:** NONE — Tests must all pass, but this does not block Sprint 1.5.
**Estimated Complexity:** High

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

Update and expand the existing unit tests for `FinancialEntryService` and `FinancialCategoryService` to cover all changes from Sprints 1.1–1.3:

1. Update existing test mocks to handle nullable `project_id`
2. Add tests for creating entries without `project_id`
3. Add tests for project validation when `project_id` IS provided
4. Add tests for `tax_amount` validation
5. Add tests for new payment method enum values
6. Add tests for listing entries without `project_id` filter
7. Update `getProjectCostSummary` assertions for 12 category types
8. Add tests for category `classification` on create/update
9. Add tests for system-default classification protection
10. Update `seedDefaultCategories` tests

---

## Pre-Sprint Checklist

- [ ] Confirm Sprint 1.3 is complete: dev server compiles, all existing endpoints work
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.spec.ts` in full
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.spec.ts` in full
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — understand current implementation
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.ts` — understand current implementation

---

## Dev Server

> Unit tests do NOT require the dev server to be running. Tests use mocked Prisma.

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   <- must return nothing

Run tests with:
  cd /var/www/lead360.app/api && npx jest --testPathPattern="src/modules/financial/services" --verbose

Do NOT start the dev server for this sprint unless needed to debug compilation issues.
```

---

## Tasks

### Task 1 — Update `financial-entry.service.spec.ts` — Mock Infrastructure

**File:** `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.spec.ts`

**1a. Add `project` mock to `mockPrismaService`:**

The existing mock object has:
```typescript
const mockPrismaService = {
  financial_entry: { ... },
  financial_category: { findFirst: jest.fn() },
};
```

**Add `project` and `project_task` mocks:**
```typescript
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
  project: {
    findFirst: jest.fn(),
  },
  project_task: {
    findFirst: jest.fn(),
  },
};
```

**1b. Update `mockEntryRecord` factory** to include new fields:

```typescript
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
  payment_method: null,
  supplier_id: null,
  purchased_by_user_id: null,
  purchased_by_crew_member_id: null,
  entry_time: null,
  tax_amount: null,
  submission_status: 'confirmed',
  is_recurring_instance: false,
  recurring_rule_id: null,
  created_by_user_id: USER_ID,
  updated_by_user_id: null,
  created_at: new Date('2026-03-10T10:00:00.000Z'),
  updated_at: new Date('2026-03-10T10:00:00.000Z'),
  category: mockCategory(),
  ...overrides,
});
```

---

### Task 2 — Update Existing `createEntry()` Tests

**2a. Update existing `createEntry()` tests** to add `project` and `project_task` mocks:

The service now validates project (if `project_id` is provided) and task (if `task_id` is provided). Every existing test that calls `service.createEntry()` with a DTO containing `project_id` needs:

```typescript
mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });
```

And every existing test that passes `task_id` (e.g., the test `'should pass optional fields (task_id, crew_member_id, subcontractor_id) to create'`) also needs:

```typescript
mockPrismaService.project_task.findFirst.mockResolvedValue({ id: TASK_ID, tenant_id: TENANT_ID });
```

Add these lines before each `service.createEntry()` call in every existing test that uses these fields. Without these mocks, existing tests will fail with `NotFoundException` because the project/task validation will find nothing.

**2b. Update the `create` call expectation** to include new fields:

The assertion on `mockPrismaService.financial_entry.create` must now include:
```typescript
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
    payment_method: null,
    supplier_id: null,
    purchased_by_user_id: null,
    purchased_by_crew_member_id: null,
    entry_time: null,
    tax_amount: null,
    submission_status: 'confirmed',
    created_by_user_id: USER_ID,
  },
  include: {
    category: {
      select: { id: true, name: true, type: true },
    },
  },
});
```

**2c. Update the "minimal DTO" test** to not require `project_id`:

The test `'should set null for optional fields when they are not provided'` currently creates a minimal DTO with `project_id: PROJECT_ID`. Now `project_id` is optional. Keep this test as-is (it tests with project_id). We add a separate test without project_id (Task 3).

---

### Task 3 — Add New `createEntry()` Tests

**3a. Create entry WITHOUT `project_id` (new behavior):**

```typescript
it('should create entry without project_id (business-level expense)', async () => {
  const dtoWithoutProject = {
    category_id: CATEGORY_ID,
    amount: 150.0,
    entry_date: '2026-03-10',
    vendor_name: 'State Farm',
    notes: 'Monthly insurance',
  };

  mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
  const createdEntry = mockEntryRecord({ project_id: null, vendor_name: 'State Farm', notes: 'Monthly insurance', amount: 150.0 });
  mockPrismaService.financial_entry.create.mockResolvedValue(createdEntry);

  const result = await service.createEntry(TENANT_ID, USER_ID, dtoWithoutProject as any);

  // Verify project validation was NOT called
  expect(mockPrismaService.project.findFirst).not.toHaveBeenCalled();

  // Verify create was called with project_id: null
  expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        project_id: null,
        tenant_id: TENANT_ID,
      }),
    }),
  );

  expect(result.project_id).toBeNull();
});
```

**3b. Create entry with `project_id` from a different tenant (404):**

```typescript
it('should throw NotFoundException when project_id does not belong to tenant', async () => {
  mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
  mockPrismaService.project.findFirst.mockResolvedValue(null); // Project not found for this tenant

  const dto = {
    project_id: 'other-tenant-project-id',
    category_id: CATEGORY_ID,
    amount: 100.0,
    entry_date: '2026-03-10',
  };

  await expect(
    service.createEntry(TENANT_ID, USER_ID, dto as any),
  ).rejects.toThrow(NotFoundException);

  expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
    where: {
      id: 'other-tenant-project-id',
      tenant_id: TENANT_ID,
    },
  });

  expect(mockPrismaService.financial_entry.create).not.toHaveBeenCalled();
});
```

**3c. Create entry with `task_id` from a different tenant (404):**

```typescript
it('should throw NotFoundException when task_id does not belong to tenant', async () => {
  mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
  mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });
  mockPrismaService.project_task.findFirst.mockResolvedValue(null); // Task not found for this tenant

  const dto = {
    project_id: PROJECT_ID,
    task_id: 'other-tenant-task-id',
    category_id: CATEGORY_ID,
    amount: 100.0,
    entry_date: '2026-03-10',
  };

  await expect(
    service.createEntry(TENANT_ID, USER_ID, dto as any),
  ).rejects.toThrow(NotFoundException);

  expect(mockPrismaService.project_task.findFirst).toHaveBeenCalledWith({
    where: {
      id: 'other-tenant-task-id',
      tenant_id: TENANT_ID,
    },
  });

  expect(mockPrismaService.financial_entry.create).not.toHaveBeenCalled();
});
```

**3d. Tax amount validation — tax_amount >= amount (400):**

```typescript
it('should throw BadRequestException when tax_amount is greater than or equal to amount', async () => {
  mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
  mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });

  const dto = {
    project_id: PROJECT_ID,
    category_id: CATEGORY_ID,
    amount: 100.0,
    tax_amount: 100.0,
    entry_date: '2026-03-10',
  };

  await expect(
    service.createEntry(TENANT_ID, USER_ID, dto as any),
  ).rejects.toThrow(BadRequestException);

  await expect(
    service.createEntry(TENANT_ID, USER_ID, dto as any),
  ).rejects.toThrow('Tax amount must be less than the entry amount');
});
```

**3e. Tax amount validation — tax_amount exceeds amount (400):**

```typescript
it('should throw BadRequestException when tax_amount exceeds amount', async () => {
  mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
  mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });

  const dto = {
    project_id: PROJECT_ID,
    category_id: CATEGORY_ID,
    amount: 100.0,
    tax_amount: 150.0,
    entry_date: '2026-03-10',
  };

  await expect(
    service.createEntry(TENANT_ID, USER_ID, dto as any),
  ).rejects.toThrow(BadRequestException);
});
```

**3f. Tax amount valid — tax_amount < amount (success):**

```typescript
it('should accept tax_amount when it is less than amount', async () => {
  mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
  mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT_ID });

  const dto = {
    project_id: PROJECT_ID,
    category_id: CATEGORY_ID,
    amount: 100.0,
    tax_amount: 8.50,
    entry_date: '2026-03-10',
  };

  mockPrismaService.financial_entry.create.mockResolvedValue(
    mockEntryRecord({ amount: 100.0, tax_amount: 8.50 }),
  );

  const result = await service.createEntry(TENANT_ID, USER_ID, dto as any);
  expect(result.tax_amount).toBe(8.50);
});
```

**3g. New payment method values accepted:**

```typescript
it('should accept new payment_method values (credit_card, debit_card, ACH)', async () => {
  mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());

  for (const method of ['credit_card', 'debit_card', 'ACH']) {
    const dto = {
      category_id: CATEGORY_ID,
      amount: 50.0,
      entry_date: '2026-03-10',
      payment_method: method,
    };

    mockPrismaService.financial_entry.create.mockResolvedValue(
      mockEntryRecord({ project_id: null, payment_method: method }),
    );

    const result = await service.createEntry(TENANT_ID, USER_ID, dto as any);

    expect(mockPrismaService.financial_entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payment_method: method,
        }),
      }),
    );
  }
});
```

**3h. Audit log description for business-level expense (no project_id):**

```typescript
it('should use business-level description in audit log when project_id is omitted', async () => {
  mockPrismaService.financial_category.findFirst.mockResolvedValue(mockCategory());
  mockPrismaService.financial_entry.create.mockResolvedValue(
    mockEntryRecord({ project_id: null, amount: 200 }),
  );

  await service.createEntry(TENANT_ID, USER_ID, {
    category_id: CATEGORY_ID,
    amount: 200,
    entry_date: '2026-03-10',
  } as any);

  expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
    expect.objectContaining({
      description: expect.stringContaining('business-level'),
    }),
  );
});
```

---

### Task 4 — Update `getProjectEntries()` Tests

**4a. Test listing without project_id (all tenant entries):**

```typescript
it('should return all tenant entries when project_id is not provided', async () => {
  const entries = [mockEntryRecord(), mockEntryRecord({ id: 'e2', project_id: null })];
  mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);
  mockPrismaService.financial_entry.count.mockResolvedValue(2);

  const result = await service.getProjectEntries(TENANT_ID, {
    page: 1,
    limit: 20,
  });

  // Verify project_id is NOT in the where clause
  const callArgs = mockPrismaService.financial_entry.findMany.mock.calls[0][0];
  expect(callArgs.where).toEqual({
    tenant_id: TENANT_ID,
  });
  expect(callArgs.where).not.toHaveProperty('project_id');

  expect(result.data).toHaveLength(2);
});
```

**4b. Existing tests with `project_id` should still pass** as-is. The service still supports filtering by project_id. No changes needed to existing passing tests — just ensure they pass.

---

### Task 5 — Update `getProjectCostSummary()` Tests

**Update the assertion** in the "should return zeroes when project has no entries" test:

```typescript
expect(result).toEqual({
  project_id: PROJECT_ID,
  total_actual_cost: 0,
  cost_by_category: {
    labor: 0,
    material: 0,
    subcontractor: 0,
    equipment: 0,
    insurance: 0,
    fuel: 0,
    utilities: 0,
    office: 0,
    marketing: 0,
    taxes: 0,
    tools: 0,
    other: 0,
  },
  entry_count: 0,
});
```

**Update the aggregation test** to include a new overhead category type:

```typescript
it('should aggregate costs including overhead category types', async () => {
  const entries = [
    mockEntryRecord({ id: 'e1', amount: 500, category: { type: 'labor' } }),
    mockEntryRecord({ id: 'e2', amount: 200, category: { type: 'insurance' } }),
    mockEntryRecord({ id: 'e3', amount: 100, category: { type: 'fuel' } }),
  ];
  mockPrismaService.financial_entry.findMany.mockResolvedValue(entries);

  const result = await service.getProjectCostSummary(TENANT_ID, PROJECT_ID);

  expect(result.total_actual_cost).toBe(800);
  expect(result.cost_by_category.labor).toBe(500);
  expect(result.cost_by_category.insurance).toBe(200);
  expect(result.cost_by_category.fuel).toBe(100);
  expect(result.cost_by_category.material).toBe(0);
});
```

**Also update the "should aggregate costs by category type" test** — update the assertion for `cost_by_category` to include 12 keys instead of 5.

---

### Task 6 — Update `financial-category.service.spec.ts`

**File:** `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.spec.ts`

Read this file first, then add tests for:

**6a. Create category with explicit classification:**

```typescript
it('should create category with explicit classification', async () => {
  mockPrismaService.financial_category.create.mockResolvedValue({
    id: 'cat-001',
    tenant_id: TENANT_ID,
    name: 'Vehicle Insurance',
    type: 'insurance',
    classification: 'operating_expense',
    is_system_default: false,
  });

  const result = await service.createCategory(TENANT_ID, USER_ID, {
    name: 'Vehicle Insurance',
    type: 'insurance' as any,
    classification: 'operating_expense' as any,
  });

  expect(mockPrismaService.financial_category.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        classification: 'operating_expense',
      }),
    }),
  );
});
```

**6b. Create category defaults to cost_of_goods_sold when classification is omitted:**

```typescript
it('should default classification to cost_of_goods_sold when not provided', async () => {
  mockPrismaService.financial_category.create.mockResolvedValue({
    id: 'cat-002',
    classification: 'cost_of_goods_sold',
  });

  await service.createCategory(TENANT_ID, USER_ID, {
    name: 'Custom Labor',
    type: 'labor' as any,
  });

  expect(mockPrismaService.financial_category.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        classification: 'cost_of_goods_sold',
      }),
    }),
  );
});
```

**6c. Update category — reject classification change on system-default:**

```typescript
it('should throw BadRequestException when changing classification of system-default category', async () => {
  mockPrismaService.financial_category.findFirst.mockResolvedValue({
    id: 'cat-system',
    tenant_id: TENANT_ID,
    is_system_default: true,
    classification: 'cost_of_goods_sold',
  });

  await expect(
    service.updateCategory(TENANT_ID, 'cat-system', USER_ID, {
      classification: 'operating_expense' as any,
    }),
  ).rejects.toThrow(BadRequestException);

  expect(mockPrismaService.financial_category.update).not.toHaveBeenCalled();
});
```

**6d. Update category — allow classification change on custom category:**

```typescript
it('should allow classification change on custom (non-system-default) category', async () => {
  mockPrismaService.financial_category.findFirst.mockResolvedValue({
    id: 'cat-custom',
    tenant_id: TENANT_ID,
    is_system_default: false,
    classification: 'cost_of_goods_sold',
  });

  mockPrismaService.financial_category.update.mockResolvedValue({
    id: 'cat-custom',
    classification: 'operating_expense',
  });

  await service.updateCategory(TENANT_ID, 'cat-custom', USER_ID, {
    classification: 'operating_expense' as any,
  });

  expect(mockPrismaService.financial_category.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        classification: 'operating_expense',
      }),
    }),
  );
});
```

**6e. seedDefaultCategories — seeds 16 categories with correct classifications:**

```typescript
it('should seed 16 default categories (9 COGS + 7 overhead) for a new tenant', async () => {
  mockPrismaService.financial_category.count.mockResolvedValue(0);
  mockPrismaService.financial_category.findMany.mockResolvedValue([]);
  mockPrismaService.financial_category.createMany.mockResolvedValue({ count: 16 });

  await service.seedDefaultCategories(TENANT_ID);

  expect(mockPrismaService.financial_category.createMany).toHaveBeenCalled();

  const createManyArg = mockPrismaService.financial_category.createMany.mock.calls[0][0];
  expect(createManyArg.data).toHaveLength(16);

  // Verify COGS categories
  const cogsCategories = createManyArg.data.filter((c: any) => c.classification === 'cost_of_goods_sold');
  expect(cogsCategories.length).toBe(9);

  // Verify overhead categories
  const overheadCategories = createManyArg.data.filter((c: any) => c.classification === 'operating_expense');
  expect(overheadCategories.length).toBe(7);

  // Verify specific overhead types
  const overheadTypes = overheadCategories.map((c: any) => c.type);
  expect(overheadTypes).toContain('insurance');
  expect(overheadTypes).toContain('fuel');
  expect(overheadTypes).toContain('utilities');
  expect(overheadTypes).toContain('office');
  expect(overheadTypes).toContain('marketing');
  expect(overheadTypes).toContain('taxes');
  expect(overheadTypes).toContain('tools');
});
```

---

### Task 7 — Run All Financial Tests

```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern="src/modules/financial/services" --verbose
```

**Expected:** All tests pass. Zero failures.

If any existing tests fail due to the changes:
- Update mock assertions to include new fields
- Do NOT delete or skip existing tests
- Every existing test must still pass — the change is backward-compatible

---

## Acceptance Criteria

- [ ] All existing tests pass without modification (or are updated minimally to handle new mock fields)
- [ ] New test: create entry without `project_id` — success (project_id = null)
- [ ] New test: create entry with `project_id` from different tenant — NotFoundException
- [ ] New test: create entry with `task_id` from different tenant — NotFoundException
- [ ] New test: `tax_amount >= amount` — BadRequestException
- [ ] New test: `tax_amount > amount` — BadRequestException
- [ ] New test: valid `tax_amount < amount` — success
- [ ] New test: new payment methods (`credit_card`, `debit_card`, `ACH`) accepted
- [ ] New test: audit log uses business-level description when no project_id
- [ ] New test: `getProjectEntries` without `project_id` returns all tenant entries
- [ ] Updated test: `getProjectCostSummary` zeroes include all 12 category types
- [ ] New test: `getProjectCostSummary` aggregates overhead category types correctly
- [ ] New test: create category with explicit classification
- [ ] New test: create category defaults to `cost_of_goods_sold`
- [ ] New test: reject classification change on system-default category
- [ ] New test: allow classification change on custom category
- [ ] New test: `seedDefaultCategories` creates 16 categories with correct classifications
- [ ] `npx jest --testPathPattern="src/modules/financial/services" --verbose` — ALL tests pass

---

## Gate Marker

**NONE** — This sprint does not block Sprint 1.5, but all tests must pass before the final verification gate.

---

## Handoff Notes

**For Sprint 1.5 (Verification Gate + API Documentation):**
- All unit tests should be green
- The test file paths are:
  - `api/src/modules/financial/services/financial-entry.service.spec.ts`
  - `api/src/modules/financial/services/financial-category.service.spec.ts`
- Run `npx jest --testPathPattern="src/modules/financial/services" --verbose` to verify
