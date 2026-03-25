# Sprint 2.7 — Financial Entry Integration: Supplier Spend Tracking

**Module:** Financial
**File:** `./documentation/sprints/financial/f02/sprint_2_7.md`
**Type:** Backend — Integration
**Depends On:** Sprint 2.6 (Controllers + Module Registration)
**Gate:** NONE
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

Wire the `supplier_id` field into the financial entry flow. When a financial entry is created, updated, or deleted with a `supplier_id`, the supplier's `total_spend` and `last_purchase_date` must be automatically updated.

This sprint modifies **existing files** — extreme care is required. Do NOT break any existing functionality.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` in FULL — understand every method, every query, every field
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts` — understand current fields
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/update-financial-entry.dto.ts` — understand current fields
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/supplier.service.ts` — verify `updateSpendTotals()` method exists
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` — verify SupplierService is registered and exported

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

## Tasks

### Task 1 — Add `supplier_id` to `CreateFinancialEntryDto`

**File:** `api/src/modules/financial/dto/create-financial-entry.dto.ts`

**What to add:** Add the `supplier_id` field to the existing DTO. Place it after the `subcontractor_id` field (or wherever the vendor/supplier fields are grouped).

```typescript
@ApiPropertyOptional({
  description: 'Supplier UUID — links this expense to a registered supplier',
  example: '550e8400-e29b-41d4-a716-446655440000',
})
@IsOptional()
@IsString()
@IsUUID()
supplier_id?: string;
```

**IMPORTANT:** The existing file uses `@IsUUID()` without a version argument and puts `@IsOptional()` before `@IsString()`. Match this convention exactly. Do NOT use `@IsUUID('4')` — the existing fields in this file use `@IsUUID()`.

**Required imports:** `IsUUID` is already imported in this file (used by `project_id`, `task_id`, etc.). No new import needed.

**Do NOT:** Remove or modify any existing fields. Only add the new field.

---

### Task 2 — Add `supplier_id` to `UpdateFinancialEntryDto`

**File:** `api/src/modules/financial/dto/update-financial-entry.dto.ts`

**Check if this DTO extends `PartialType(CreateFinancialEntryDto)`.** The real file uses `PartialType(OmitType(CreateFinancialEntryDto, ['project_id'] as const))`. Since `supplier_id` is NOT in the OmitType list, it is automatically inherited as an optional field. **No changes needed to this file.**

**If the DTO defines fields manually** (not using PartialType), add the same field:

```typescript
@ApiPropertyOptional({
  description: 'Supplier UUID — links this expense to a registered supplier',
  example: '550e8400-e29b-41d4-a716-446655440000',
})
@IsOptional()
@IsString()
@IsUUID()
supplier_id?: string;
```

**Do NOT:** Remove or modify any existing fields.

---

### Task 3 — Inject `SupplierService` into `FinancialEntryService`

**File:** `api/src/modules/financial/services/financial-entry.service.ts`

**Step 1:** Add import at the top:
```typescript
import { SupplierService } from './supplier.service';
```

**Step 2:** Add to the constructor:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLogger: AuditLoggerService,
  private readonly supplierService: SupplierService, // ← ADD THIS
) {}
```

**CRITICAL:** Since both `FinancialEntryService` and `SupplierService` are in the same module, there is no circular dependency issue. `SupplierService` is already registered as a provider in `financial.module.ts`.

---

### Task 4 — Modify `createEntry` Method

**File:** `api/src/modules/financial/services/financial-entry.service.ts`

**What to modify:** In the `createEntry` method, add supplier validation and spend tracking.

**Step 1:** Before creating the entry, validate supplier_id if provided:
```typescript
// Validate supplier_id belongs to this tenant (if provided)
if (dto.supplier_id) {
  const supplier = await this.prisma.supplier.findFirst({
    where: { id: dto.supplier_id, tenant_id: tenantId },
  });
  if (!supplier) {
    throw new NotFoundException('Supplier not found for this tenant.');
  }
}
```

**Add import if not present:**
```typescript
import { NotFoundException } from '@nestjs/common';
```

**Step 2:** In the `data` object of `prisma.financial_entry.create()`, add:
```typescript
supplier_id: dto.supplier_id ?? null,
```

**Step 3:** AFTER the entry is created and AFTER the audit log, add spend tracking:
```typescript
// Update supplier spend totals if entry is linked to a supplier
if (dto.supplier_id) {
  await this.supplierService.updateSpendTotals(tenantId, dto.supplier_id);
}
```

**Do NOT:** Change any existing behavior. The supplier_id is optional — entries without supplier_id continue to work exactly as before.

---

### Task 5 — Modify `updateEntry` Method

**File:** `api/src/modules/financial/services/financial-entry.service.ts`

**What to modify:** Handle supplier_id changes on update.

**Step 1:** Before updating, capture the old supplier_id. The real variable name in the existing code is `existing` (from `const existing = await this.getEntryById(tenantId, entryId)`):
```typescript
const oldSupplierId = existing.supplier_id;
```

**Step 2:** If `dto.supplier_id` is provided and different from current, validate the new supplier:
```typescript
if (dto.supplier_id !== undefined && dto.supplier_id !== oldSupplierId) {
  if (dto.supplier_id) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplier_id, tenant_id: tenantId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found for this tenant.');
    }
  }
}
```

**Step 3:** In the update `data` object, add:
```typescript
...(dto.supplier_id !== undefined && { supplier_id: dto.supplier_id ?? null }),
```

**Step 4:** AFTER the update and audit log, update spend totals:
```typescript
// Update supplier spend totals for both old and new supplier
if (dto.supplier_id !== undefined || dto.amount !== undefined) {
  // If supplier changed, update both old and new
  const newSupplierId = dto.supplier_id !== undefined ? dto.supplier_id : oldSupplierId;

  if (oldSupplierId && oldSupplierId !== newSupplierId) {
    await this.supplierService.updateSpendTotals(tenantId, oldSupplierId);
  }
  if (newSupplierId) {
    await this.supplierService.updateSpendTotals(tenantId, newSupplierId);
  }
}
```

---

### Task 6 — Modify `deleteEntry` Method

**File:** `api/src/modules/financial/services/financial-entry.service.ts`

**What to modify:** Update supplier spend totals when an entry is deleted.

**Step 1:** Before deleting, capture the supplier_id. The real variable name in the existing code is `existing` (from `const existing = await this.getEntryById(tenantId, entryId)`):
```typescript
const supplierId = existing.supplier_id;
```

**Step 2:** AFTER the delete and audit log, update spend totals:
```typescript
// Update supplier spend totals if entry was linked to a supplier
if (supplierId) {
  await this.supplierService.updateSpendTotals(tenantId, supplierId);
}
```

---

### Task 7 — Update `include` in Entry Queries (Optional Enhancement)

**File:** `api/src/modules/financial/services/financial-entry.service.ts`

**What to modify:** In the `getEntryById`, `getProjectEntries`, and `createEntry` response includes, add the supplier relation so the API response includes supplier name.

In the `include` object of entry queries, add:
```typescript
supplier: {
  select: { id: true, name: true },
},
```

**This is optional but recommended** — it allows the frontend to display the supplier name without a separate API call.

**Do NOT:** Add supplier include to list queries that would cause N+1 performance issues. Only add it to single-entry fetches and the create response.

---

### Task 8 — Verify Integration

**Steps:**

1. Start the dev server
2. Wait for health check
3. Verify the server compiles without errors
4. Check that existing financial entry endpoints still work:
   ```bash
   # Get a valid JWT token first (use test credentials)
   TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | \
     jq -r '.access_token')

   # Test existing financial entries endpoint
   curl -s http://localhost:8000/financial/entries \
     -H "Authorization: Bearer $TOKEN" | head -c 200
   ```
5. Stop the dev server

---

## Files Modified in This Sprint

| File | Changes |
|------|---------|
| `api/src/modules/financial/dto/create-financial-entry.dto.ts` | Add `supplier_id` optional field |
| `api/src/modules/financial/dto/update-financial-entry.dto.ts` | Add `supplier_id` optional field (if not using PartialType) |
| `api/src/modules/financial/services/financial-entry.service.ts` | Inject SupplierService, validate supplier_id, update spend on create/update/delete |

---

## Business Rules Enforced in This Sprint

- BR-01: `supplier_id` is optional — financial entries can still be created without a supplier
- BR-02: If `supplier_id` is provided, it must reference a valid supplier belonging to the same tenant
- BR-03: Creating a financial_entry with `supplier_id` updates `supplier.total_spend` and `supplier.last_purchase_date`
- BR-04: Updating a financial_entry that changes `supplier_id` or `amount` triggers spend recalculation for both old and new suppliers
- BR-05: Deleting a financial_entry with `supplier_id` recalculates the supplier's spend totals
- BR-06: `updateSpendTotals` uses Prisma aggregate `_sum` — never loads all entries into memory
- BR-07: Existing financial entry functionality is not affected — supplier_id is purely additive

---

## Acceptance Criteria

- [ ] `CreateFinancialEntryDto` includes optional `supplier_id` field with UUID validation
- [ ] `UpdateFinancialEntryDto` includes optional `supplier_id` field
- [ ] `FinancialEntryService` constructor injects `SupplierService`
- [ ] `createEntry()` validates supplier_id and calls `updateSpendTotals` after creation
- [ ] `updateEntry()` handles supplier_id changes and calls `updateSpendTotals` for affected suppliers
- [ ] `deleteEntry()` calls `updateSpendTotals` when deleted entry had a supplier_id
- [ ] Existing financial entry CRUD functionality is not broken
- [ ] Server starts without circular dependency errors
- [ ] Dev server shut down before marking sprint complete

---

## Gate Marker

**NONE** — Proceed to Sprint 2.8.

---

## Handoff Notes

**For Sprint 2.8 (Unit + Integration Tests):**
- All supplier endpoints are now fully functional
- Financial entry integration is wired — creating entries with supplier_id updates supplier spend
- All 3 services (SupplierCategoryService, SupplierService, SupplierProductService) are ready for unit testing
- Existing test files in `api/src/modules/financial/services/*.spec.ts` provide the pattern to follow
- Tests must cover: service methods, tenant isolation, RBAC, Google Places mocking, price history auto-creation
