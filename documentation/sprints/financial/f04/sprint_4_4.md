# Sprint 4_4 — Service Layer Part 2: Create + Update + Delete with Role Logic & Hooks

**Module:** Financial
**File:** ./documentation/sprints/financial/f04/sprint_4_4.md
**Type:** Backend — Service Layer
**Depends On:** Sprint 4_3 (enrichment helpers + read methods complete)
**Gate:** STOP — All CRUD methods written with correct syntax. Do NOT start dev server (expected break until Sprint 4_6)
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

Rebuild `createEntry()`, `updateEntry()`, and `deleteEntry()` in `FinancialEntryService` to support:
- All new F-04 fields
- Role-based `submission_status` defaulting
- Supplier spend tracking hooks
- Payment method auto-copy from registry
- Purchased-by mutual exclusion validation
- Tax amount validation
- Role-based edit/delete permissions

---

## Pre-Sprint Checklist

- [ ] Read the current `financial-entry.service.ts` in full (including Sprint 4_3 additions)
- [ ] Read `SupplierService` to find the `updateSpendTotals()` method signature and import path
- [ ] Read `PaymentMethodRegistryService` to find how to look up a registry entry by ID and get its `type` field
- [ ] Verify both services are exported from their respective modules
- [ ] Read `financial.module.ts` to understand current imports — you will need to inject `SupplierService` and potentially the `PaymentMethodRegistryService` (or use Prisma directly)

---

## Dev Server

> ⚠️ **DO NOT start the dev server in this sprint.** The service method signatures have changed but the controller still references old signatures. The dev server will not compile until Sprint 4_6. If port 8000 is in use from a previous sprint, kill it:
>
> ```
> lsof -i :8000
> kill {PID}
> ```

---

## Tasks

### Task 1 — Inject SupplierService (if exported from its module)

**What:** Read the financial module and supplier service. Determine if `SupplierService` is available for injection in `FinancialEntryService`.

**Two approaches:**
1. **If SupplierService is already a provider in FinancialModule** → inject it directly via constructor
2. **If SupplierService is in a separate module** → you may need to import that module in `FinancialModule`, OR use PrismaService directly to query the supplier table and update `total_spend`

**Decision:** Read the codebase. If `SupplierService` is already available in the financial module providers/exports, inject it. Otherwise, perform the supplier spend update directly via Prisma in `FinancialEntryService` — do NOT add cross-module dependencies unless they already exist.

**The supplier spend update logic (if using Prisma directly):**
```typescript
private async updateSupplierSpendTotals(tenantId: string, supplierId: string): Promise<void> {
  const [spendResult, lastPurchase] = await Promise.all([
    this.prisma.financial_entry.aggregate({
      where: { tenant_id: tenantId, supplier_id: supplierId },
      _sum: { amount: true },
    }),
    this.prisma.financial_entry.aggregate({
      where: { tenant_id: tenantId, supplier_id: supplierId },
      _max: { entry_date: true },
    }),
  ]);

  await this.prisma.supplier.update({
    where: { id: supplierId },
    data: {
      total_spend: spendResult._sum.amount || 0,
      last_purchase_date: lastPurchase._max.entry_date || null,
    },
  });
}
```

**Why:** When entries with a `supplier_id` are created, updated, or deleted, the supplier's denormalized `total_spend` and `last_purchase_date` must be recalculated.

---

### Task 2 — Add Validation Helpers

**What:** Add these private validation methods to the service:

```typescript
private async validateProjectBelongsToTenant(tenantId: string, projectId: string): Promise<void> {
  const project = await this.prisma.project.findFirst({
    where: { id: projectId, tenant_id: tenantId },
  });
  if (!project) {
    throw new NotFoundException('Project not found');
  }
}

private async validateTaskBelongsToTenant(tenantId: string, taskId: string): Promise<void> {
  const task = await this.prisma.project_task.findFirst({
    where: { id: taskId, tenant_id: tenantId },
  });
  if (!task) {
    throw new NotFoundException('Task not found');
  }
}

private async validateSupplierBelongsToTenant(tenantId: string, supplierId: string): Promise<void> {
  const supplier = await this.prisma.supplier.findFirst({
    where: { id: supplierId, tenant_id: tenantId, is_active: true },
  });
  if (!supplier) {
    throw new NotFoundException('Supplier not found or inactive');
  }
}

private async validatePaymentMethodRegistry(tenantId: string, registryId: string): Promise<string> {
  const registry = await this.prisma.payment_method_registry.findFirst({
    where: { id: registryId, tenant_id: tenantId, is_active: true },
  });
  if (!registry) {
    throw new NotFoundException('Payment method not found or inactive');
  }
  return registry.type; // Returns the payment_method enum value for auto-copy
}

private async validateUserBelongsToTenant(tenantId: string, userId: string): Promise<void> {
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { user_id: userId, tenant_id: tenantId, status: 'ACTIVE' },
  });
  if (!membership) {
    throw new NotFoundException('User not found in this tenant');
  }
}

private async validateCrewMemberBelongsToTenant(tenantId: string, crewMemberId: string): Promise<void> {
  const member = await this.prisma.crew_member.findFirst({
    where: { id: crewMemberId, tenant_id: tenantId, is_active: true },
  });
  if (!member) {
    throw new NotFoundException('Crew member not found or inactive');
  }
}

private validateTaxAmount(amount: number, taxAmount: number): void {
  if (taxAmount >= amount) {
    throw new BadRequestException('Tax amount must be less than the entry amount');
  }
}

private validatePurchasedByMutualExclusion(userId?: string | null, crewMemberId?: string | null): void {
  if (userId && crewMemberId) {
    throw new BadRequestException(
      'Cannot assign purchase to both a user and a crew member. Provide only one.',
    );
  }
}
```

**IMPORTANT:** Read the actual Prisma schema to confirm table/field names for `user_tenant_membership`, `crew_member`, `project_task`, `supplier`, `payment_method_registry`. Adjust the queries to match the live schema.

---

### Task 3 — Rebuild `createEntry()`

**What:** Replace the existing `createEntry()` method completely with the new F-04 logic.

**New signature:**
```typescript
async createEntry(
  tenantId: string,
  userId: string,
  userRoles: string[],
  dto: CreateFinancialEntryDto,
)
```

**Step-by-step logic:**

```
1. Validate category_id belongs to tenantId → 404 if not
2. If project_id provided → validate it belongs to tenantId → 404 if not
3. If task_id provided → validate it belongs to tenantId → 404 if not
4. If supplier_id provided → validate it belongs to tenantId and is active → 404 if not
5. Determine payment_method value:
   - If payment_method_registry_id provided:
     a. Validate it belongs to tenantId → 404 if not
     b. Auto-copy its type into payment_method (overrides any client-provided value)
   - Else: use dto.payment_method (may be null)
6. Validate purchased_by mutual exclusion → 400 if both provided
7. If purchased_by_user_id provided → validate user belongs to tenantId
8. If purchased_by_crew_member_id provided → validate crew member belongs to tenantId
9. Validate tax_amount < amount (if both provided) → 400 if not
10. Determine submission_status:
    - If !isPrivilegedRole(userRoles) → force 'pending_review' (ignore dto value)
    - Else → use dto.submission_status || 'confirmed'
11. Create the entry record via Prisma
12. If supplier_id provided → call updateSupplierSpendTotals(tenantId, supplier_id)
13. Audit log the creation
14. Return enriched response via transformToEnrichedResponse()
```

**Prisma create data shape:**
```typescript
const entry = await this.prisma.financial_entry.create({
  data: {
    tenant_id: tenantId,
    project_id: dto.project_id ?? null,
    task_id: dto.task_id ?? null,
    category_id: dto.category_id,
    entry_type: dto.entry_type,  // Prisma accepts the string value directly for enum fields
    amount: dto.amount,
    tax_amount: dto.tax_amount ?? null,
    entry_date: new Date(dto.entry_date),
    entry_time: dto.entry_time ?? null,
    vendor_name: dto.vendor_name ?? null,
    supplier_id: dto.supplier_id ?? null,
    payment_method: resolvedPaymentMethod ?? null,  // from step 5
    payment_method_registry_id: dto.payment_method_registry_id ?? null,
    purchased_by_user_id: dto.purchased_by_user_id ?? null,
    purchased_by_crew_member_id: dto.purchased_by_crew_member_id ?? null,
    submission_status: resolvedSubmissionStatus,  // from step 10 — Prisma accepts string for enum
    is_recurring_instance: false,
    recurring_rule_id: null,
    has_receipt: false,
    notes: dto.notes ?? null,
    created_by_user_id: userId,
  },
  include: this.getEnrichedInclude(),
});
```

**IMPORTANT:** After creating, re-fetch with enriched include OR use the result from the create (if include was used). The Prisma `create` with `include` should work.

---

### Task 4 — Rebuild `updateEntry()`

**What:** Replace the existing `updateEntry()` method with full F-04 logic.

**New signature:**
```typescript
async updateEntry(
  tenantId: string,
  entryId: string,
  userId: string,
  userRoles: string[],
  dto: UpdateFinancialEntryDto,
)
```

**Step-by-step logic:**

```
1. Fetch existing entry using fetchEntryOrFail(tenantId, entryId) → 404 if not found
   NOTE: Use fetchEntryOrFail(), NOT getEntryById() — the update method does its own RBAC.
2. Role enforcement:
   - If Employee (!isPrivilegedRole):
     a. Verify entry.created_by_user_id === userId → 403 if not
     b. Verify entry.submission_status === 'pending_review' → 403 if confirmed
3. Validate fields:
   - If dto.category_id → validate it belongs to tenant
   - If dto.supplier_id provided and not null → validate it belongs to tenant and is active
   - If dto.purchased_by_user_id → validate user belongs to tenant
   - If dto.purchased_by_crew_member_id → validate crew member belongs to tenant
   - Validate tax vs amount on the RESULTING state (not just dto values):
     const resultingAmount = dto.amount !== undefined ? dto.amount : Number(existing.amount);
     const resultingTax = dto.tax_amount !== undefined ? dto.tax_amount : (existing.tax_amount ? Number(existing.tax_amount) : null);
     if (resultingTax !== null && resultingTax >= resultingAmount) throw 400
4. Determine payment_method value if payment_method_registry_id changed:
   - If dto.payment_method_registry_id is provided and not null → validate and auto-copy type
   - If dto.payment_method_registry_id is explicitly null → clear payment_method too (set both to null)
5. Validate purchased_by mutual exclusion:
   - Check the RESULTING state (merge dto values with existing):
     - new_purchased_by_user_id = dto.purchased_by_user_id !== undefined ? dto.purchased_by_user_id : existing.purchased_by_user_id
     - new_purchased_by_crew_member_id = dto.purchased_by_crew_member_id !== undefined ? dto.purchased_by_crew_member_id : existing.purchased_by_crew_member_id
     - Validate mutual exclusion on the resulting pair
6. Handle supplier change:
   - Track old_supplier_id = existing.supplier_id
   - Track new_supplier_id = dto.supplier_id !== undefined ? dto.supplier_id : existing.supplier_id
7. Build update data object (only include fields that were provided in dto)
8. Execute Prisma update with enriched include
9. Supplier spend update:
   - If old_supplier_id !== new_supplier_id:
     - If old_supplier_id → updateSupplierSpendTotals(tenantId, old_supplier_id)
     - If new_supplier_id → updateSupplierSpendTotals(tenantId, new_supplier_id)
10. Audit log with before/after
11. Return enriched response
```

**Role enforcement detail:**
```
- Employee can edit own entries ONLY when submission_status = pending_review
- Manager and Bookkeeper can edit any entry in any status
- Owner and Admin can edit any entry in any status
```

---

### Task 5 — Rebuild `deleteEntry()`

**What:** Replace the existing `deleteEntry()` method with full F-04 logic.

**New signature:**
```typescript
async deleteEntry(
  tenantId: string,
  entryId: string,
  userId: string,
  userRoles: string[],
)
```

**Step-by-step logic:**

```
1. Fetch existing entry using fetchEntryOrFail(tenantId, entryId) → 404 if not found
   NOTE: Use fetchEntryOrFail(), NOT getEntryById() — the delete method does its own RBAC.
2. Role enforcement:
   - Owner, Admin → can delete any entry (any status)
   - Manager, Bookkeeper → CANNOT delete any entry → throw 403
   - Employee → can delete OWN entries ONLY when submission_status = pending_review
     a. Verify entry.created_by_user_id === userId → 403 if not
     b. Verify entry.submission_status === 'pending_review' → 403 if confirmed
3. Execute Prisma hard delete
4. If existing.supplier_id → updateSupplierSpendTotals(tenantId, existing.supplier_id)
5. Audit log with before data
6. Return { message: 'Entry deleted successfully' }
```

**Role enforcement detail (from contract matrix):**

| Role | Can Delete |
|------|-----------|
| Owner | Yes — any entry |
| Admin | Yes — any entry |
| Manager | No — 403 always |
| Bookkeeper | No — 403 always |
| Employee | Own pending_review entries only |

---

### Task 6 — Update Module Imports (if needed)

**What:** If you injected `SupplierService` into `FinancialEntryService`, ensure the module has it available:

Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts`. If `SupplierService` is already in the `providers` array, no change needed. If not, you may need to add it or import the supplier module.

**IMPORTANT:** Only modify `financial.module.ts` if absolutely necessary. If `SupplierService` is already available (it should be if F-02 added it to the financial module), just inject it via the constructor.

If `SupplierService` is NOT available, use the Prisma direct approach from Task 1 instead of injecting the service.

---

### Task 7 — Verify File Syntax

**What:** Verify the service file is syntactically valid TypeScript. Check that all new method signatures are consistent, all imports resolve, and no obvious type errors exist within the file.

> ⚠️ **DO NOT start the dev server in this sprint.** The old controller still calls `createEntry(tenantId, userId, dto)` with 3 args but the new signature requires 4 args `(tenantId, userId, userRoles, dto)`. Same for `updateEntry` and `deleteEntry`. The controller is rebuilt in Sprint 4_6. Full compilation check happens there.

**Acceptance:** The `financial-entry.service.ts` file has no syntax errors within itself. All method signatures use `fetchEntryOrFail()` for internal fetching (not `getEntryById()`).

---

## Business Rules Enforced in This Sprint

- **BR-06:** Employee creates always get `submission_status = pending_review` — forced by service, not negotiable.
- **BR-07:** Owner/Admin/Manager/Bookkeeper creates default to `submission_status = confirmed`, can opt to set `pending_review`.
- **BR-08:** `purchased_by_user_id` and `purchased_by_crew_member_id` are mutually exclusive.
- **BR-09:** `tax_amount` must be less than `amount` when both provided.
- **BR-10:** When `payment_method_registry_id` is set, its `type` auto-copies into `payment_method`.
- **BR-11:** Supplier `total_spend` and `last_purchase_date` updated on create and delete.
- **BR-12:** On update, if supplier changes, both old and new supplier spend totals are recalculated.
- **BR-13:** Employee can only edit own entries in `pending_review` status.
- **BR-14:** Manager and Bookkeeper cannot delete entries.
- **BR-15:** Only Owner and Admin can delete confirmed entries.
- **BR-16:** `project_id` and `task_id` are immutable after creation (not in update DTO).

---

## Acceptance Criteria

- [ ] `createEntry()` accepts `userRoles` parameter and enforces submission_status
- [ ] Employee create always results in `pending_review`
- [ ] Owner create defaults to `confirmed`
- [ ] `createEntry()` validates all FK fields against tenant
- [ ] `createEntry()` auto-copies payment method type from registry
- [ ] `createEntry()` validates purchased_by mutual exclusion
- [ ] `createEntry()` validates tax_amount < amount
- [ ] `createEntry()` calls supplier spend update after create
- [ ] `createEntry()` returns enriched response
- [ ] `updateEntry()` enforces Employee edit restrictions
- [ ] `updateEntry()` handles supplier change (both old and new spend updated)
- [ ] `updateEntry()` re-copies payment method type on registry change
- [ ] `deleteEntry()` enforces role-based deletion rules
- [ ] `deleteEntry()` calls supplier spend update after delete
- [ ] All write methods use `fetchEntryOrFail()` for internal entry fetching (not `getEntryById()`)
- [ ] Service file is syntactically valid TypeScript (no errors within the file itself)
- [ ] Dev server NOT started (expected compilation break — controller uses old signatures until Sprint 4_6)

---

## Gate Marker

**STOP** — All CRUD methods must be written with correct TypeScript syntax within the service file. All validation steps must be implemented. **Do NOT start the dev server** — the old controller still calls these methods with old signatures. Full compilation check happens in Sprint 4_6.

---

## Handoff Notes

After this sprint, `FinancialEntryService` has these CRUD methods ready:

| Method | Signature | Notes |
|--------|-----------|-------|
| `createEntry` | `(tenantId, userId, userRoles, dto)` | Full F-04 logic |
| `updateEntry` | `(tenantId, entryId, userId, userRoles, dto)` | Role enforcement + hooks |
| `deleteEntry` | `(tenantId, entryId, userId, userRoles)` | Role-based deletion |

Sprint 4_5 will add the pending workflow methods (approve, reject, resubmit) and the CSV export.
