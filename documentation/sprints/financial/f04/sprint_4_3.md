# Sprint 4_3 — Service Layer Part 1: Enriched Query Builder + Read Operations

**Module:** Financial
**File:** ./documentation/sprints/financial/f04/sprint_4_3.md
**Type:** Backend — Service Layer
**Depends On:** Sprint 4_2 (all DTOs compiled)
**Gate:** STOP — All read methods written with correct syntax. Do NOT start dev server (expected break until Sprint 4_6)
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

Rebuild the read operations in `FinancialEntryService` to support the full enriched response shape, role-based access control, Employee scoping, and all new filter parameters. Also build the shared enrichment include clause that ALL entry queries will use.

This sprint modifies: `getEntryById()`, adds `getEntries()` (new method with full filtering), adds `getPendingEntries()`, and builds the shared enrichment helper.

Existing methods `getProjectEntries()`, `getTaskEntries()`, `getProjectCostSummary()`, and `getTaskCostSummary()` are NOT modified in this sprint — they continue to work with the old query shape. They will be updated later when needed.

---

## Pre-Sprint Checklist

- [ ] Read the current `financial-entry.service.ts` in full: `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts`
- [ ] Read ALL new DTOs created in Sprint 4_2
- [ ] Read the Prisma schema for `financial_entry` and all related models
- [ ] Verify the following relations exist in the Prisma schema:
  - `financial_entry.supplier` → `supplier`
  - `financial_entry.payment_method_registry_rel` → `payment_method_registry` (check the actual relation name)
  - `financial_entry.purchased_by_user` → `user`
  - `financial_entry.purchased_by_crew_member` → `crew_member`
  - `financial_entry.created_by` → `user`
  - `financial_entry.category` → `financial_category`
  - `financial_entry.project` → `project`
  - `financial_entry.rejected_by` → `user`

**IMPORTANT:** Read the actual Prisma schema to discover the exact relation names. The names listed above are educated guesses based on the F-01/F-02/F-03 contracts. The live schema is the source of truth. Use whatever relation names exist.

---

## Dev Server

> ⚠️ **DO NOT start the dev server in this sprint.** The service method signature changes break the existing controller. The dev server will not compile until Sprint 4_6. If port 8000 is in use from a previous sprint, kill it:
>
> ```
> lsof -i :8000
> kill {PID}
> ```

---

## Tasks

### Task 1 — Build Enriched Include Clause

**What:** Add a private method or constant to `FinancialEntryService` that returns the Prisma `include` clause for the enriched response shape. ALL entry queries that return entries to the client must use this include.

**The enriched include must join:**

```typescript
private getEnrichedInclude() {
  return {
    category: {
      select: {
        id: true,
        name: true,
        type: true,
        classification: true,  // financial_category_classification enum
      },
    },
    project: {
      select: {
        id: true,
        name: true,
      },
    },
    task: {
      select: {
        id: true,
        title: true,
      },
    },
    supplier: {
      select: {
        id: true,
        name: true,
      },
    },
    payment_method_registry_rel: {  // ← CHECK actual relation name in schema
      select: {
        id: true,
        nickname: true,
      },
    },
    purchased_by_user: {  // ← CHECK actual relation name in schema
      select: {
        id: true,
        first_name: true,
        last_name: true,
      },
    },
    purchased_by_crew_member: {  // ← CHECK actual relation name in schema
      select: {
        id: true,
        first_name: true,
        last_name: true,
      },
    },
    created_by: {
      select: {
        id: true,
        first_name: true,
        last_name: true,
      },
    },
    rejected_by: {
      select: {
        id: true,
        first_name: true,
        last_name: true,
      },
    },
  };
}
```

**CRITICAL:** You MUST read the actual Prisma schema to discover the correct relation names for:
- The supplier relation on financial_entry
- The payment method registry relation on financial_entry
- The purchased_by_user relation on financial_entry
- The purchased_by_crew_member relation on financial_entry
- The task relation on financial_entry (might be nullable since not all entries have tasks)

Use whatever names the schema defines. Do NOT guess — read the schema file.

**Why:** This ensures a consistent, enriched response shape across all endpoints. No raw FK IDs without human-readable labels.

---

### Task 2 — Build Response Transformer

**What:** Add a private method that transforms the raw Prisma result (with includes) into the flat enriched response shape specified by the contract.

```typescript
private transformToEnrichedResponse(entry: any) {
  return {
    id: entry.id,
    tenant_id: entry.tenant_id,
    project_id: entry.project_id,
    project_name: entry.project?.name ?? null,
    task_id: entry.task_id,
    task_title: entry.task?.title ?? null,
    category_id: entry.category_id,
    category_name: entry.category.name,
    category_type: entry.category.type,
    category_classification: entry.category.classification,
    entry_type: entry.entry_type,
    amount: entry.amount,
    tax_amount: entry.tax_amount,
    entry_date: entry.entry_date,
    entry_time: entry.entry_time,
    vendor_name: entry.vendor_name,
    supplier_id: entry.supplier_id,
    supplier_name: entry.supplier?.name ?? null,
    payment_method: entry.payment_method,
    payment_method_registry_id: entry.payment_method_registry_id,
    payment_method_nickname: entry.payment_method_registry_rel?.nickname ?? null,  // ← CHECK relation name
    purchased_by_user_id: entry.purchased_by_user_id,
    purchased_by_user_name: entry.purchased_by_user
      ? `${entry.purchased_by_user.first_name} ${entry.purchased_by_user.last_name}`
      : null,
    purchased_by_crew_member_id: entry.purchased_by_crew_member_id,
    purchased_by_crew_member_name: entry.purchased_by_crew_member
      ? `${entry.purchased_by_crew_member.first_name} ${entry.purchased_by_crew_member.last_name}`
      : null,
    submission_status: entry.submission_status,
    rejection_reason: entry.rejection_reason,
    rejected_by_user_id: entry.rejected_by_user_id,
    rejected_at: entry.rejected_at,
    is_recurring_instance: entry.is_recurring_instance,
    recurring_rule_id: entry.recurring_rule_id,
    has_receipt: entry.has_receipt,
    notes: entry.notes,
    created_by_user_id: entry.created_by_user_id,
    created_by_name: `${entry.created_by.first_name} ${entry.created_by.last_name}`,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}
```

**IMPORTANT:** Adapt the relation field names to match whatever the actual Prisma schema uses. The names above are based on the contract — read the live schema and adjust.

**Why:** The API contract specifies a flat enriched response with joined human-readable names. This transformer produces that shape.

---

### Task 3 — Add Role Hierarchy Helper

**What:** Add a private helper method to determine the user's highest-priority role:

```typescript
/**
 * Determine highest-priority role from the user's role array.
 * Priority: Owner > Admin > Manager > Bookkeeper > Employee
 */
private getHighestRole(roles: string[]): string {
  const priority = ['Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee'];
  for (const role of priority) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return 'Employee'; // Fallback — most restrictive
}

/**
 * Check if user has a privileged role (Owner, Admin, Manager, or Bookkeeper).
 */
private isPrivilegedRole(roles: string[]): boolean {
  const privileged = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
  return roles.some((r) => privileged.includes(r));
}
```

**Why:** The service needs to determine role-based behavior for submission_status defaulting, entry visibility, edit/delete permissions, etc. The role comes from the JWT `roles` array.

---

### Task 4 — Add Private `fetchEntryOrFail()` Method

**What:** Add a private method that fetches an entry with enriched include and throws if not found. This is the internal fetch used by ALL service methods (create, update, delete, approve, reject, resubmit). It does NOT enforce role checks — those are handled by each public method individually.

```typescript
/**
 * Internal fetch — no role checks. Used by service methods that do their own RBAC.
 */
private async fetchEntryOrFail(tenantId: string, entryId: string) {
  const entry = await this.prisma.financial_entry.findFirst({
    where: {
      id: entryId,
      tenant_id: tenantId,
    },
    include: this.getEnrichedInclude(),
  });

  if (!entry) {
    throw new NotFoundException('Financial entry not found');
  }

  return entry;
}
```

**Why:** Separating the raw fetch from role enforcement prevents circular dependencies. `getEntryById()` (public, called from controller) enforces Employee visibility. `fetchEntryOrFail()` (private, called from updateEntry, deleteEntry, approveEntry, etc.) just fetches without role checks — the calling method handles its own RBAC.

---

### Task 5 — Rebuild `getEntryById()`

**What:** Replace the existing `getEntryById()` method with a new version that uses `fetchEntryOrFail()` plus Employee role enforcement.

**New signature:**
```typescript
async getEntryById(
  tenantId: string,
  entryId: string,
  userId: string,
  userRoles: string[],
)
```

**Logic:**
1. Call `fetchEntryOrFail(tenantId, entryId)` — handles 404
2. If user is Employee (`!isPrivilegedRole(userRoles)`):
   - Check `entry.created_by_user_id === userId`
   - If not → throw `ForbiddenException('Access denied. You can only view your own entries.')`
3. Return `transformToEnrichedResponse(entry)`

**IMPORTANT:** Import `ForbiddenException` from `@nestjs/common`.

> ⚠️ **COMPILATION NOTE:** This changes the method signature from `(tenantId, entryId)` to `(tenantId, entryId, userId, userRoles)`. The existing controller still calls it with 2 args — this will cause a TypeScript compilation error. This is expected. The controller is rebuilt in Sprint 4_6. **Do NOT attempt to start the dev server.** The existing `updateEntry()` and `deleteEntry()` methods also call `getEntryById()` internally — they will use `fetchEntryOrFail()` after Sprint 4_4 rebuilds them.

**Why:** Employees can only see entries they created. Other roles see any tenant entry.

---

### Task 6 — Add New `getEntries()` Method

**What:** Add a completely new method that supports ALL filter parameters from `ListFinancialEntriesQueryDto`. This does NOT replace `getProjectEntries()` — it's a new method used by the new controller route.

**Signature:**
```typescript
async getEntries(
  tenantId: string,
  userId: string,
  userRoles: string[],
  query: ListFinancialEntriesQueryDto,
)
```

**Logic:**

1. Build `where` clause:

```typescript
const where: any = { tenant_id: tenantId };

// EMPLOYEE SCOPING — forced, cannot be bypassed
if (!this.isPrivilegedRole(userRoles)) {
  where.created_by_user_id = userId;
}

// Optional filters
if (query.project_id) where.project_id = query.project_id;
if (query.task_id) where.task_id = query.task_id;
if (query.category_id) where.category_id = query.category_id;
if (query.entry_type) where.entry_type = query.entry_type;
if (query.supplier_id) where.supplier_id = query.supplier_id;
if (query.payment_method) where.payment_method = query.payment_method;
if (query.submission_status) where.submission_status = query.submission_status;
if (query.purchased_by_user_id) where.purchased_by_user_id = query.purchased_by_user_id;
if (query.purchased_by_crew_member_id) where.purchased_by_crew_member_id = query.purchased_by_crew_member_id;

// Category type filter (requires join)
if (query.category_type) {
  where.category = { ...where.category, type: query.category_type };
}

// Classification filter (requires join)
if (query.classification) {
  where.category = { ...where.category, classification: query.classification };
}

// Date range
if (query.date_from || query.date_to) {
  where.entry_date = {};
  if (query.date_from) where.entry_date.gte = new Date(query.date_from);
  if (query.date_to) where.entry_date.lte = new Date(query.date_to);
}

// Boolean filters
if (query.has_receipt !== undefined) where.has_receipt = query.has_receipt;
if (query.is_recurring_instance !== undefined) where.is_recurring_instance = query.is_recurring_instance;

// Search (vendor_name and notes)
if (query.search) {
  where.OR = [
    { vendor_name: { contains: query.search } },
    { notes: { contains: query.search } },
  ];
}
```

2. Pagination:
```typescript
const page = query.page || 1;
const limit = Math.min(query.limit || 20, 100);
const skip = (page - 1) * limit;
```

3. Sorting:
```typescript
const sortBy = query.sort_by || 'entry_date';
const sortOrder = query.sort_order || 'desc';
const orderBy = { [sortBy]: sortOrder };
```

4. Execute query + count + summary aggregations in parallel:
```typescript
const [data, total, expenseSum, incomeSum, taxSum] = await Promise.all([
  this.prisma.financial_entry.findMany({
    where,
    include: this.getEnrichedInclude(),
    orderBy,
    skip,
    take: limit,
  }),
  this.prisma.financial_entry.count({ where }),
  this.prisma.financial_entry.aggregate({
    where: { ...where, entry_type: 'expense' },
    _sum: { amount: true },
  }),
  this.prisma.financial_entry.aggregate({
    where: { ...where, entry_type: 'income' },
    _sum: { amount: true },
  }),
  this.prisma.financial_entry.aggregate({
    where,
    _sum: { tax_amount: true },
  }),
]);
```

5. Return enriched response:
```typescript
return {
  data: data.map((entry) => this.transformToEnrichedResponse(entry)),
  meta: {
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  },
  summary: {
    total_expenses: Number(expenseSum._sum.amount || 0),
    total_income: Number(incomeSum._sum.amount || 0),
    total_tax: Number(taxSum._sum.tax_amount || 0),
    entry_count: total,
  },
};
```

**CRITICAL:** The `summary` block is computed from the FULL result set (using the same `where` filter but without pagination) — not just the current page. The aggregate queries above do this correctly because they use `where` without `skip`/`take`.

**Import required:**
```typescript
import { ListFinancialEntriesQueryDto } from '../dto/list-financial-entries-query.dto';
```

---

### Task 7 — Add `getPendingEntries()` Method

**What:** New method to list entries with `submission_status = pending_review`.

**Signature:**
```typescript
async getPendingEntries(
  tenantId: string,
  query: ListPendingEntriesQueryDto,
)
```

**Logic:**
```typescript
const page = query.page || 1;
const limit = Math.min(query.limit || 20, 100);
const skip = (page - 1) * limit;

const where: any = {
  tenant_id: tenantId,
  submission_status: 'pending_review',
};

if (query.submitted_by_user_id) {
  where.created_by_user_id = query.submitted_by_user_id;
}

if (query.date_from || query.date_to) {
  where.entry_date = {};
  if (query.date_from) where.entry_date.gte = new Date(query.date_from);
  if (query.date_to) where.entry_date.lte = new Date(query.date_to);
}

const [data, total, expenseSum, incomeSum, taxSum] = await Promise.all([
  this.prisma.financial_entry.findMany({
    where,
    include: this.getEnrichedInclude(),
    orderBy: { entry_date: 'desc' },
    skip,
    take: limit,
  }),
  this.prisma.financial_entry.count({ where }),
  this.prisma.financial_entry.aggregate({
    where: { ...where, entry_type: 'expense' },
    _sum: { amount: true },
  }),
  this.prisma.financial_entry.aggregate({
    where: { ...where, entry_type: 'income' },
    _sum: { amount: true },
  }),
  this.prisma.financial_entry.aggregate({
    where,
    _sum: { tax_amount: true },
  }),
]);

return {
  data: data.map((entry) => this.transformToEnrichedResponse(entry)),
  meta: {
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  },
  summary: {
    total_expenses: Number(expenseSum._sum.amount || 0),
    total_income: Number(incomeSum._sum.amount || 0),
    total_tax: Number(taxSum._sum.tax_amount || 0),
    entry_count: total,
  },
};
```

**Import required:**
```typescript
import { ListPendingEntriesQueryDto } from '../dto/list-pending-entries-query.dto';
```

---

### Task 8 — Verify File Syntax

**What:** Verify the service file is syntactically valid TypeScript. Check that all imports resolve and all method signatures are consistent within the file.

> ⚠️ **DO NOT start the dev server in this sprint.** The `getEntryById()` signature change breaks the existing controller (calls with 2 args, now requires 4). The existing `updateEntry()` and `deleteEntry()` also call `getEntryById()` with the old 2-arg signature — these will be rebuilt in Sprint 4_4 to use `fetchEntryOrFail()`. Full compilation check happens in Sprint 4_6.

**Acceptance:** The `financial-entry.service.ts` file has no syntax errors. All new methods have consistent types. All imports resolve to real files.

---

## Business Rules Enforced in This Sprint

- **BR-01:** Employees see only their own entries across all list operations (`created_by_user_id = userId` filter enforced silently).
- **BR-02:** Employee cannot access entries created by other users via `getEntryById()` — returns 403.
- **BR-03:** All responses return enriched data with joined human-readable labels (not raw FK IDs).
- **BR-04:** The `summary` block in list responses is computed from the full filtered result set, not just the current page.
- **BR-05:** Role hierarchy: Owner > Admin > Manager > Bookkeeper > Employee.

---

## Integration Points

| Service/Module | Import Path | Method Used |
|---------------|-------------|-------------|
| `PrismaService` | `../../../core/database/prisma.service` | `financial_entry.findFirst`, `findMany`, `count`, `aggregate` |
| `ListFinancialEntriesQueryDto` | `../dto/list-financial-entries-query.dto` | Query parameter DTO |
| `ListPendingEntriesQueryDto` | `../dto/list-pending-entries-query.dto` | Pending query parameter DTO |

---

## Acceptance Criteria

- [ ] `getEnrichedInclude()` returns include clause with ALL joins (category, project, task, supplier, payment method registry, purchased_by_user, purchased_by_crew_member, created_by, rejected_by)
- [ ] `transformToEnrichedResponse()` produces flat response with all fields from the contract
- [ ] `fetchEntryOrFail()` fetches with enriched include and throws NotFoundException if not found
- [ ] `getHighestRole()` returns correct priority role
- [ ] `isPrivilegedRole()` correctly identifies Owner/Admin/Manager/Bookkeeper
- [ ] `getEntryById()` uses `fetchEntryOrFail()` internally
- [ ] `getEntryById()` enforces Employee ownership check (throws ForbiddenException)
- [ ] `getEntryById()` returns enriched response
- [ ] `getEntries()` supports ALL filter parameters from `ListFinancialEntriesQueryDto`
- [ ] `getEntries()` enforces Employee scoping (silently filters by `created_by_user_id`)
- [ ] `getEntries()` returns `summary` block with correct totals from full result set
- [ ] `getEntries()` supports sorting by `entry_date`, `amount`, `created_at`
- [ ] `getEntries()` supports search across `vendor_name` and `notes`
- [ ] `getPendingEntries()` pre-filters to `submission_status = pending_review`
- [ ] `getPendingEntries()` returns enriched response with summary block
- [ ] Existing methods (`getProjectEntries`, `getTaskEntries`, `getProjectCostSummary`, `getTaskCostSummary`) are NOT broken
- [ ] Service file is syntactically valid TypeScript (no errors within the file itself)
- [ ] Dev server NOT started (expected compilation break — controller uses old signatures until Sprint 4_6)

---

## Gate Marker

**STOP** — All read methods and helpers must be written with correct TypeScript syntax. All imports must resolve. **Do NOT start the dev server** — the old controller and old write methods still reference the old `getEntryById()` signature. Full compilation check happens in Sprint 4_6.

---

## Handoff Notes

After this sprint, the following methods are available in `FinancialEntryService`:

| Method | Signature | Status |
|--------|-----------|--------|
| `fetchEntryOrFail` | `(tenantId, entryId)` | NEW (private) — raw fetch with enriched include, no role checks |
| `getEntryById` | `(tenantId, entryId, userId, userRoles)` | Updated — uses fetchEntryOrFail + Employee role enforcement |
| `getEntries` | `(tenantId, userId, userRoles, query)` | NEW — full filter/sort/paginate with Employee scoping |
| `getPendingEntries` | `(tenantId, query)` | NEW — pending review list |
| `getEnrichedInclude` | `()` | NEW (private) — shared include clause |
| `transformToEnrichedResponse` | `(entry)` | NEW (private) — response transformer |
| `getHighestRole` | `(roles)` | NEW (private) — role priority helper |
| `isPrivilegedRole` | `(roles)` | NEW (private) — privilege check helper |

Sprint 4_4 will rebuild `createEntry()`, `updateEntry()`, and `deleteEntry()` using these helpers.
