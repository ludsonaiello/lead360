# Sprint 1.3 — Service Logic: Nullable project_id, Classification, Tax Validation

**Module:** Financial
**File:** `./documentation/sprints/financial/f01/sprint_1_3.md`
**Type:** Backend (Service Layer)
**Depends On:** Sprint 1.2 (all DTOs must compile cleanly)
**Gate:** STOP — All service methods must work correctly. Existing endpoint behavior must be preserved for project-scoped entries. Dev server must compile and respond to health check.
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

Update the service layer to support:
1. Creating financial entries without `project_id` (business-level expenses)
2. Conditional project validation — only when `project_id` is provided
3. `tax_amount` validation — must be less than `amount`
4. Optional `project_id` filtering in list queries
5. Category `classification` on create and update
6. Prevent classification change on system-default categories
7. Pass new fields to Prisma on entry creation
8. Update `seedDefaultCategories()` to include classification and overhead types
9. Update `getProjectCostSummary()` to handle new category types in the summary

---

## Pre-Sprint Checklist

- [ ] Confirm Sprint 1.2 is complete: `cd /var/www/lead360.app/api && npx tsc --noEmit` succeeds
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — understand all 8 public methods
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.ts` — understand all 5 public methods and `DEFAULT_CATEGORIES` array
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts` — confirm project_id is optional
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries.dto.ts` — confirm project_id is optional

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   <- must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   <- must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   <- must return nothing
```

---

## Tasks

### Task 1 — Update `FinancialEntryService.createEntry()`

**File:** `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts`

**Current logic (lines 26-71):**
```typescript
async createEntry(tenantId: string, userId: string, dto: CreateFinancialEntryDto) {
  await this.validateCategoryBelongsToTenant(tenantId, dto.category_id);
  this.validateEntryDateNotFuture(dto.entry_date);

  const entry = await this.prisma.financial_entry.create({
    data: {
      tenant_id: tenantId,
      project_id: dto.project_id,
      task_id: dto.task_id ?? null,
      category_id: dto.category_id,
      entry_type: 'expense',
      amount: dto.amount,
      entry_date: new Date(dto.entry_date),
      vendor_name: dto.vendor_name ?? null,
      crew_member_id: dto.crew_member_id ?? null,
      subcontractor_id: dto.subcontractor_id ?? null,
      notes: dto.notes ?? null,
      has_receipt: false,
      created_by_user_id: userId,
    },
    include: {
      category: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  await this.auditLogger.logTenantChange({
    action: 'created',
    entityType: 'financial_entry',
    entityId: entry.id,
    tenantId,
    actorUserId: userId,
    after: entry,
    description: `Created financial entry of $${dto.amount} for project ${dto.project_id}`,
  });

  return entry;
}
```

**Required changes:**

**1a. Add conditional project validation.** After the category validation and before `this.validateEntryDateNotFuture()`, add:

```typescript
// Validate project belongs to tenant — only if project_id is provided
if (dto.project_id) {
  const project = await this.prisma.project.findFirst({
    where: {
      id: dto.project_id,
      tenant_id: tenantId,
    },
  });
  if (!project) {
    throw new NotFoundException('Project not found or does not belong to this tenant');
  }
}
```

Import `NotFoundException` — it is already imported at the top of the file.

**1b. Add task_id tenant validation** (after the project validation block):

```typescript
// Validate task belongs to tenant — only if task_id is provided
if (dto.task_id) {
  const task = await this.prisma.project_task.findFirst({
    where: {
      id: dto.task_id,
      tenant_id: tenantId,
    },
  });
  if (!task) {
    throw new NotFoundException('Task not found or does not belong to this tenant');
  }
}
```

**Note:** `task_id` is a bare `String?` field on `financial_entry` — there is NO Prisma relation for it, so the FK is not enforced at the DB level. Service-level validation is the only way to ensure the task belongs to the correct tenant. The contract specifies: "task_id validation: if task_id is provided, it must belong to the same tenantId."

**1c. Add tax_amount validation** (after the task_id validation block):

```typescript
// Validate tax_amount is less than amount (if provided)
if (dto.tax_amount !== undefined && dto.tax_amount !== null) {
  if (dto.tax_amount >= dto.amount) {
    throw new BadRequestException('Tax amount must be less than the entry amount');
  }
}
```

**1d. Update the Prisma `create` data to include new fields:**

```typescript
const entry = await this.prisma.financial_entry.create({
  data: {
    tenant_id: tenantId,
    project_id: dto.project_id ?? null,
    task_id: dto.task_id ?? null,
    category_id: dto.category_id,
    entry_type: 'expense',
    amount: dto.amount,
    entry_date: new Date(dto.entry_date),
    vendor_name: dto.vendor_name ?? null,
    crew_member_id: dto.crew_member_id ?? null,
    subcontractor_id: dto.subcontractor_id ?? null,
    notes: dto.notes ?? null,
    has_receipt: false,
    payment_method: dto.payment_method ?? null,
    supplier_id: dto.supplier_id ?? null,
    purchased_by_user_id: dto.purchased_by_user_id ?? null,
    purchased_by_crew_member_id: dto.purchased_by_crew_member_id ?? null,
    entry_time: dto.entry_time ? new Date(`1970-01-01T${dto.entry_time}`) : null,
    tax_amount: dto.tax_amount ?? null,
    submission_status: dto.submission_status ?? 'confirmed',
    // TODO: F-04 — wire submission_status role logic (Employee → pending_review)
    created_by_user_id: userId,
  },
  include: {
    category: {
      select: { id: true, name: true, type: true },
    },
  },
});
```

**1e. Update the audit log description** to handle nullable project_id:

```typescript
description: dto.project_id
  ? `Created financial entry of $${dto.amount} for project ${dto.project_id}`
  : `Created business-level financial entry of $${dto.amount}`,
```

---

### Task 2 — Update `FinancialEntryService.getProjectEntries()`

**Current logic (lines 76-131):**
```typescript
async getProjectEntries(tenantId: string, query: ListFinancialEntriesDto) {
  // ...
  const where: any = {
    tenant_id: tenantId,
    project_id: query.project_id,  // <-- REQUIRED currently
  };
  // ...
}
```

**Change the where clause to conditionally include project_id:**

```typescript
const where: any = {
  tenant_id: tenantId,
};

if (query.project_id) {
  where.project_id = query.project_id;
}
```

**This means:**
- If `project_id` is in query params, filter by it (existing behavior preserved).
- If `project_id` is NOT in query params, return all entries for the tenant across all projects AND business-level entries.

**Do NOT change any other filter logic** (task_id, category_id, date_from, date_to, pagination).

---

### Task 3 — Update `FinancialEntryService.updateEntry()`

**Current logic (lines 177-230):**

The `updateEntry()` method already excludes `project_id` from updates (it uses `UpdateFinancialEntryDto` which omits `project_id`). No structural change needed.

**Add handling for the new fields in the data object.** Find the section that builds the `data` object:

```typescript
const data: any = {
  updated_by_user_id: userId,
};

if (dto.task_id !== undefined) data.task_id = dto.task_id ?? null;
if (dto.category_id !== undefined) data.category_id = dto.category_id;
if (dto.amount !== undefined) data.amount = dto.amount;
if (dto.entry_date !== undefined) data.entry_date = new Date(dto.entry_date);
if (dto.vendor_name !== undefined) data.vendor_name = dto.vendor_name ?? null;
if (dto.crew_member_id !== undefined) data.crew_member_id = dto.crew_member_id ?? null;
if (dto.subcontractor_id !== undefined) data.subcontractor_id = dto.subcontractor_id ?? null;
if (dto.notes !== undefined) data.notes = dto.notes ?? null;
```

**Add new field handling after the existing lines:**

```typescript
if (dto.payment_method !== undefined) data.payment_method = dto.payment_method ?? null;
if (dto.supplier_id !== undefined) data.supplier_id = dto.supplier_id ?? null;
if (dto.purchased_by_user_id !== undefined) data.purchased_by_user_id = dto.purchased_by_user_id ?? null;
if (dto.purchased_by_crew_member_id !== undefined) data.purchased_by_crew_member_id = dto.purchased_by_crew_member_id ?? null;
if (dto.entry_time !== undefined) data.entry_time = dto.entry_time ? new Date(`1970-01-01T${dto.entry_time}`) : null;
if (dto.tax_amount !== undefined) data.tax_amount = dto.tax_amount ?? null;
if (dto.submission_status !== undefined) data.submission_status = dto.submission_status;
```

**Add tax_amount validation in updateEntry** — after the entry_date validation block, add:

```typescript
// Validate tax_amount if being changed
if (dto.tax_amount !== undefined && dto.tax_amount !== null) {
  const effectiveAmount = dto.amount !== undefined ? dto.amount : Number(existing.amount);
  if (dto.tax_amount >= effectiveAmount) {
    throw new BadRequestException('Tax amount must be less than the entry amount');
  }
}
```

---

### Task 4 — Update `FinancialEntryService.getProjectCostSummary()`

**Current logic (lines 258-300):**

The `costByCategory` map only has 5 category types:
```typescript
const costByCategory: Record<string, number> = {
  labor: 0,
  material: 0,
  subcontractor: 0,
  equipment: 0,
  other: 0,
};
```

**Add the 7 new category types:**
```typescript
const costByCategory: Record<string, number> = {
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
};
```

**Update the return object** to include all 12 types in `cost_by_category`:
```typescript
return {
  project_id: projectId,
  total_actual_cost: Math.round(totalActualCost * 100) / 100,
  cost_by_category: {
    labor: Math.round(costByCategory.labor * 100) / 100,
    material: Math.round(costByCategory.material * 100) / 100,
    subcontractor: Math.round(costByCategory.subcontractor * 100) / 100,
    equipment: Math.round(costByCategory.equipment * 100) / 100,
    insurance: Math.round(costByCategory.insurance * 100) / 100,
    fuel: Math.round(costByCategory.fuel * 100) / 100,
    utilities: Math.round(costByCategory.utilities * 100) / 100,
    office: Math.round(costByCategory.office * 100) / 100,
    marketing: Math.round(costByCategory.marketing * 100) / 100,
    taxes: Math.round(costByCategory.taxes * 100) / 100,
    tools: Math.round(costByCategory.tools * 100) / 100,
    other: Math.round(costByCategory.other * 100) / 100,
  },
  entry_count: entries.length,
};
```

**This method still receives `projectId` as a required argument** and filters by it. No structural change needed. Leave as-is beyond the category map expansion.

---

### Task 5 — Update `FinancialCategoryService`

**File:** `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.ts`

**5a. Update `DEFAULT_CATEGORIES` array** to include classification and overhead types:

```typescript
const DEFAULT_CATEGORIES: { name: string; type: string; classification: string }[] = [
  { name: 'Labor - General', type: 'labor', classification: 'cost_of_goods_sold' },
  { name: 'Labor - Crew Overtime', type: 'labor', classification: 'cost_of_goods_sold' },
  { name: 'Materials - General', type: 'material', classification: 'cost_of_goods_sold' },
  { name: 'Materials - Tools', type: 'equipment', classification: 'cost_of_goods_sold' },
  { name: 'Materials - Safety Equipment', type: 'equipment', classification: 'cost_of_goods_sold' },
  { name: 'Subcontractor - General', type: 'subcontractor', classification: 'cost_of_goods_sold' },
  { name: 'Equipment Rental', type: 'equipment', classification: 'cost_of_goods_sold' },
  { name: 'Fuel & Transportation', type: 'other', classification: 'cost_of_goods_sold' },
  { name: 'Miscellaneous', type: 'other', classification: 'cost_of_goods_sold' },
  // Overhead categories (operating expenses)
  { name: 'Insurance', type: 'insurance', classification: 'operating_expense' },
  { name: 'Fuel & Vehicle', type: 'fuel', classification: 'operating_expense' },
  { name: 'Utilities', type: 'utilities', classification: 'operating_expense' },
  { name: 'Office & Admin', type: 'office', classification: 'operating_expense' },
  { name: 'Marketing & Advertising', type: 'marketing', classification: 'operating_expense' },
  { name: 'Taxes & Licenses', type: 'taxes', classification: 'operating_expense' },
  { name: 'Tools & Equipment Purchase', type: 'tools', classification: 'operating_expense' },
];
```

**5b. Update `seedDefaultCategories()`** to include classification in the `createMany` call:

In the `createMany` data mapper, add `classification`:
```typescript
await this.prisma.financial_category.createMany({
  data: toCreate.map((cat) => ({
    tenant_id: tenantId,
    name: cat.name,
    type: cat.type as any,
    classification: cat.classification as any,
    is_system_default: true,
    is_active: true,
    created_by_user_id: null,
  })),
});
```

**5c. Update `createCategory()`** to accept and pass classification:

```typescript
async createCategory(
  tenantId: string,
  userId: string,
  dto: CreateFinancialCategoryDto,
) {
  const category = await this.prisma.financial_category.create({
    data: {
      tenant_id: tenantId,
      name: dto.name,
      type: dto.type,
      classification: dto.classification ?? 'cost_of_goods_sold',
      description: dto.description ?? null,
      is_system_default: false,
      created_by_user_id: userId,
    },
  });

  // ... audit log (unchanged)
}
```

**5d. Update `updateCategory()`** to handle classification with system-default protection:

After the `NotFoundException` check and before the `prisma.update` call, add:

```typescript
// Prevent classification change on system-default categories
if (dto.classification !== undefined && existing.is_system_default) {
  throw new BadRequestException(
    'Cannot change the classification of a system-default category',
  );
}
```

Add `classification` to the update data:
```typescript
const updated = await this.prisma.financial_category.update({
  where: { id: categoryId },
  data: {
    ...(dto.name !== undefined && { name: dto.name }),
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.classification !== undefined && { classification: dto.classification }),
  },
});
```

**5e. Update `findAllForTenant()`** — include `classification` in the select/return if using select. Currently it returns all fields via `findMany` without a select, so `classification` will be returned automatically. No change needed.

---

### Task 6 — Verify with Live Endpoints

Start the dev server and test the critical scenarios:

**Test 1: Create entry without project_id (new behavior)**
```bash
curl -s -X POST http://localhost:8000/api/v1/financial/entries \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "{VALID_CATEGORY_ID}",
    "amount": 150.00,
    "entry_date": "2026-03-15",
    "vendor_name": "State Farm Insurance",
    "notes": "Monthly business insurance"
  }'
```
**Expected:** 201 Created with entry data, `project_id: null`

**Test 2: Create entry with project_id (existing behavior preserved)**
```bash
curl -s -X POST http://localhost:8000/api/v1/financial/entries \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "{VALID_PROJECT_ID}",
    "category_id": "{VALID_CATEGORY_ID}",
    "amount": 450.00,
    "entry_date": "2026-03-15",
    "vendor_name": "Home Depot"
  }'
```
**Expected:** 201 Created with entry data, `project_id: {VALID_PROJECT_ID}`

**Test 3: List entries without project_id (all tenant entries)**
```bash
curl -s "http://localhost:8000/api/v1/financial/entries?page=1&limit=10" \
  -H "Authorization: Bearer {TOKEN}"
```
**Expected:** 200 OK with all entries for the tenant (both project and business-level)

**Test 4: List entries with project_id (filtered)**
```bash
curl -s "http://localhost:8000/api/v1/financial/entries?project_id={VALID_PROJECT_ID}&page=1&limit=10" \
  -H "Authorization: Bearer {TOKEN}"
```
**Expected:** 200 OK with entries filtered to that project only

**Test 5: Create entry with tax_amount >= amount (should fail)**
```bash
curl -s -X POST http://localhost:8000/api/v1/financial/entries \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "{VALID_CATEGORY_ID}",
    "amount": 100.00,
    "tax_amount": 100.00,
    "entry_date": "2026-03-15"
  }'
```
**Expected:** 400 Bad Request — "Tax amount must be less than the entry amount"

**To get a valid token for testing:**
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "contact@honeydo4you.com", "password": "978@F32c"}'
```
Extract the `access_token` from the response.

**After testing, shut down the server:**
```bash
lsof -i :8000
kill {PID}
lsof -i :8000   # Must return nothing
```

---

## Patterns Applied

### Multi-Tenant Enforcement
```typescript
// Every Prisma query must include tenant_id
const where: any = {
  tenant_id: tenantId,
};
```

### AuditLoggerService
```typescript
await this.auditLogger.logTenantChange({
  action: 'created' | 'updated' | 'deleted',
  entityType: 'financial_entry',
  entityId: entry.id,
  tenantId,
  actorUserId: userId,
  before?: existingRecord,
  after?: updatedRecord,
  description: 'Human-readable description of what changed',
});
```

---

## Business Rules Enforced in This Sprint

- **BR-01:** A financial entry without `project_id` is a business-level expense. It belongs to the tenant, not to any project.
- **BR-02:** A financial entry with `project_id` is a project expense. The project must belong to the same tenant.
- **BR-03:** `tax_amount` must be less than `amount` if provided.
- **BR-04:** System-default categories cannot have their `classification` changed.
- **BR-05:** `submission_status` defaults to `confirmed` for all roles in this sprint. Role-based logic deferred to F-04.
- **BR-06:** Once `project_id` is set, it cannot be changed (existing rule, preserved by `UpdateFinancialEntryDto` excluding it).
- **BR-07:** The `classification` field determines whether a category is COGS or OpEx for P&L reporting.

---

## Acceptance Criteria

- [ ] `POST /financial/entries` without `project_id` returns 201 Created
- [ ] `POST /financial/entries` with valid `project_id` returns 201 Created (existing behavior preserved)
- [ ] `POST /financial/entries` with `project_id` not belonging to tenant returns 404
- [ ] `POST /financial/entries` with `task_id` not belonging to tenant returns 404
- [ ] `POST /financial/entries` with `tax_amount >= amount` returns 400
- [ ] `GET /financial/entries` without `project_id` query param returns all tenant entries
- [ ] `GET /financial/entries` with `project_id` returns only that project's entries
- [ ] New fields (`payment_method`, `supplier_id`, etc.) are stored correctly on create
- [ ] New fields can be updated via `PATCH /financial/entries/:id`
- [ ] Category creation accepts `classification` field
- [ ] Category update rejects `classification` change on system-default categories
- [ ] `getProjectCostSummary` includes all 12 category types
- [ ] `seedDefaultCategories()` seeds 16 categories (9 COGS + 7 overhead) with correct classifications
- [ ] All Prisma queries include `tenant_id` filter
- [ ] All mutations call `AuditLoggerService`
- [ ] Dev server compiles and all existing endpoints still work
- [ ] Dev server is shut down

---

## Gate Marker

**STOP** — Verify:
1. All existing financial endpoints still work (create, list, get, update, delete entries)
2. New nullable project_id behavior works correctly
3. Tax amount validation works
4. Category classification is enforced

---

## Handoff Notes

**For Sprint 1.4 (Unit Tests):**
- `createEntry()` now accepts optional `project_id` — tests need new cases for null project_id
- `createEntry()` now validates project belongs to tenant when provided — test with mock `prisma.project.findFirst`
- `createEntry()` now validates task_id belongs to tenant when provided — test with mock `prisma.project_task.findFirst`
- `createEntry()` now validates `tax_amount < amount` — test boundary cases
- `getProjectEntries()` now conditionally filters by `project_id` — test with and without
- `getProjectCostSummary()` now returns 12 category types — test assertions must include all 12
- `updateEntry()` now handles 7 new fields — test field passthrough
- `FinancialCategoryService.createCategory()` now accepts `classification` — test default and explicit values
- `FinancialCategoryService.updateCategory()` rejects classification change on system defaults — test guard
- `FinancialCategoryService.seedDefaultCategories()` now creates 16 categories — test count and classifications
