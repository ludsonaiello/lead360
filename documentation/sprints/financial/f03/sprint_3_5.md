# Sprint 3_5 — Financial Entry Auto-Copy Integration

**Module:** Financial
**File:** ./documentation/sprints/financial/f03/sprint_3_5.md
**Type:** Backend (Integration — modifying existing code)
**Depends On:** Sprint 3_4 (Controller + Module Registration must be complete)
**Gate:** STOP — Financial entry creation with and without `payment_method_registry_id` must both work correctly before Sprint 3_6.
**Estimated Complexity:** Medium

> **You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality.** Every line you write must reflect that standard.

> **WARNING:** This platform is 85% production-ready. Never leave the dev server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

---

## Objective

Modify the `FinancialEntryService.createEntry()` method and `CreateFinancialEntryDto` to support the new `payment_method_registry_id` FK. When a financial entry is created with a `payment_method_registry_id`, the service automatically looks up the registry record and copies its `type` into the entry's `payment_method` field. This keeps the enum field accurate for queries that filter by payment type without joining the registry table.

Entries created WITHOUT a `payment_method_registry_id` continue to work as before — the raw `payment_method` enum can still be provided directly.

---

## Pre-Sprint Checklist

- [ ] Sprint 3_4 complete — all 6 payment method registry endpoints working
- [ ] Read carefully (FULL file — every line):
  - `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/controllers/financial-entry.controller.ts`
- [ ] Verify `financial_entry` model in Prisma schema has both:
  - `payment_method payment_method?` field (added by F-01)
  - `payment_method_registry_id String? @db.VarChar(36)` field (added by F-01)
  - `payment_method_registry_rel payment_method_registry? @relation(...)` (added by Sprint 3_1)
- [ ] Understand the existing `createEntry()` logic completely before making any changes

---

## Dev Server

> This project does NOT use PM2. Do not reference or run PM2 commands.
> Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

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

**MySQL credentials** are in `/var/www/lead360.app/api/.env` — do not hardcode any database credentials.

---

## Tasks

### Task 1 — Read Existing Financial Entry Code (MANDATORY)

**What:** Read the full content of these files. Do NOT skip any lines:

1. `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts`
2. `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts`
3. `/var/www/lead360.app/api/src/modules/financial/dto/update-financial-entry.dto.ts`
4. `/var/www/lead360.app/api/src/modules/financial/controllers/financial-entry.controller.ts`

**Why:** You are modifying an existing, working service that handles real financial data. You must understand every line before touching anything.

**Do NOT:** Skip this step. Do NOT make assumptions about what the code does.

---

### Task 2 — Update `CreateFinancialEntryDto`

**What:** Edit `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts` to add two new optional fields:

Add these fields to the class:

```typescript
@ApiPropertyOptional({
  description: 'Payment method type (use when not providing a payment_method_registry_id)',
  enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
  example: 'credit_card',
})
@IsOptional()
@IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
  message: 'payment_method must be one of: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH',
})
payment_method?: string;

@ApiPropertyOptional({
  description: 'Payment method registry ID. When provided, the registry record type is auto-copied to payment_method.',
  example: '550e8400-e29b-41d4-a716-446655440005',
})
@IsOptional()
@IsString()
@IsUUID()
payment_method_registry_id?: string;
```

**Add the missing imports** to the import line from `class-validator`:
- Add `IsEnum` to the existing import
- `IsString`, `IsOptional`, `IsUUID` should already be imported — verify

**Business rules:**
- Both fields are optional on the DTO level
- If `payment_method_registry_id` is provided, `payment_method` is auto-populated by the service (client does not need to send both)
- If neither is provided, the entry is created without payment method info (both remain null)
- If only `payment_method` is provided (no registry ID), it's stored directly — this is the "quick entry" flow

**Do NOT:**
- Remove or modify any existing fields in the DTO
- Make either field required
- Add any validation logic beyond what's shown — cross-field validation happens at the service level

---

### Task 3 — Update `FinancialEntryService.createEntry()`

**What:** Edit `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` to add the auto-copy logic.

**Step 1: Add the import for `PaymentMethodRegistryService`:**

At the top of the file, add:
```typescript
import { PaymentMethodRegistryService } from './payment-method-registry.service';
```

**Step 2: Add `PaymentMethodRegistryService` to the constructor:**

Change the constructor from:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLogger: AuditLoggerService,
) {}
```

To:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLogger: AuditLoggerService,
  private readonly paymentMethodRegistryService: PaymentMethodRegistryService,
) {}
```

**Step 3: Add auto-copy logic inside `createEntry()`:**

After the existing validation calls (`validateCategoryBelongsToTenant` and `validateEntryDateNotFuture`) and BEFORE the `prisma.financial_entry.create()` call, add:

```typescript
// Resolve payment method from registry if payment_method_registry_id is provided
let resolvedPaymentMethod = dto.payment_method ?? null;
let resolvedRegistryId = dto.payment_method_registry_id ?? null;

if (dto.payment_method_registry_id) {
  const registryRecord = await this.paymentMethodRegistryService.findOne(
    tenantId,
    dto.payment_method_registry_id,
  );
  // Auto-copy the registry record's type to the entry's payment_method
  resolvedPaymentMethod = registryRecord.type;
  resolvedRegistryId = registryRecord.id;
}
```

**Step 4: Add the new fields to the `data` object in the `prisma.financial_entry.create()` call:**

Add these two lines to the `data` object (alongside the existing fields):
```typescript
payment_method: resolvedPaymentMethod as any,
payment_method_registry_id: resolvedRegistryId,
```

**The complete updated `createEntry` data block should look like:**
```typescript
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
    payment_method: resolvedPaymentMethod as any,
    payment_method_registry_id: resolvedRegistryId,
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
```

**Do NOT:**
- Change the method signature of `createEntry()`
- Modify any other method in this service (getProjectEntries, getEntryById, updateEntry, deleteEntry, etc.)
- Remove or reorder any existing fields in the data object
- Make `payment_method` or `payment_method_registry_id` required
- Throw an error if neither payment field is provided — both are optional

---

### Task 4 — Verify No Breaking Changes

**What:** After making the changes, verify:

1. Start the dev server (follow Dev Server section above)
2. Health check passes
3. Existing financial entry endpoints still work:

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

# Test existing entry endpoints still work — list entries for any known project
# First, query any existing project to get a project_id:
#   curl -s http://localhost:8000/projects -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Then use that project_id below:
curl -s -X GET "http://localhost:8000/financial/entries?project_id=<use_real_project_id_from_above>" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Acceptance:** Existing entry creation (without payment method fields) continues to work exactly as before.

---

### Task 5 — Test Auto-Copy Flow

**What:** Test the auto-copy behavior:

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

# First, create a payment method to get its ID
PM_RESPONSE=$(curl -s -X POST http://localhost:8000/financial/payment-methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Test Visa","type":"credit_card","bank_name":"Test Bank","last_four":"9999"}')

echo "$PM_RESPONSE" | python3 -m json.tool

# Extract the payment method ID
PM_ID=$(echo "$PM_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

# Now create a financial entry WITH payment_method_registry_id
# (You'll need a valid project_id and category_id from the tenant)
# The payment_method should be auto-copied from the registry record's type (credit_card)
```

**Acceptance:**
- Entry created with `payment_method_registry_id` has `payment_method: "credit_card"` auto-populated
- Entry created without `payment_method_registry_id` but with `payment_method: "cash"` has `payment_method: "cash"` (direct)
- Entry created without either payment field has `payment_method: null` and `payment_method_registry_id: null`

---

### Task 6 — Test Direct Payment Method (Quick Entry Flow)

**What:** Verify that a financial entry can be created with a raw `payment_method` enum value and NO `payment_method_registry_id`:

```bash
# Create entry with raw payment_method only (quick entry flow)
# Get a real project_id and category_id first:
#   curl -s http://localhost:8000/projects -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
#   curl -s http://localhost:8000/settings/financial-categories -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Then substitute the real IDs below:
curl -s -X POST http://localhost:8000/financial/entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<real_project_id>",
    "category_id": "<real_category_id>",
    "amount": 50.00,
    "entry_date": "2026-03-15",
    "payment_method": "cash"
  }' | python3 -m json.tool
```

**Acceptance:** Entry is created with `payment_method: "cash"` and `payment_method_registry_id: null`.

---

## Patterns to Apply

### Service Dependency Injection Pattern

When adding a new dependency to an existing service constructor:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLogger: AuditLoggerService,
  private readonly paymentMethodRegistryService: PaymentMethodRegistryService, // NEW
) {}
```

Since `PaymentMethodRegistryService` is registered in the same `FinancialModule`, NestJS will resolve it automatically. No module import changes needed.

### Auto-Copy Pattern

```typescript
if (dto.payment_method_registry_id) {
  // Look up registry record (throws 404 if not found or wrong tenant)
  const registry = await this.paymentMethodRegistryService.findOne(tenantId, dto.payment_method_registry_id);
  // Copy type to payment_method
  resolvedPaymentMethod = registry.type;
}
```

---

## Business Rules Enforced in This Sprint

- BR-09: When a `financial_entry` is created with a `payment_method_registry_id`, the service copies the registry record's `type` into `financial_entry.payment_method` automatically.
- BR-10: The raw `payment_method` enum on `financial_entry` remains valid for entries created without a registry reference (quick entry flow). Both coexist.
- BR-BACKWARD-COMPAT: Existing entries created without payment method fields continue to work. The new fields default to null.

---

### Task 7 — Update Existing `financial-entry.service.spec.ts` (CRITICAL)

**What:** Edit `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.spec.ts` to fix test breakage caused by the new constructor dependency.

**Why:** Adding `PaymentMethodRegistryService` to the `FinancialEntryService` constructor breaks the existing test file in two ways:
1. The `TestingModule` doesn't provide a mock for `PaymentMethodRegistryService` — NestJS DI will throw: `"Can't resolve dependencies of FinancialEntryService"`
2. The exact-match assertion on `prisma.financial_entry.create` data (around line 130) doesn't include the two new fields — the assertion will fail

**Step 1: Add the import at the top of the test file:**

```typescript
import { PaymentMethodRegistryService } from './payment-method-registry.service';
```

**Step 2: Add a mock for `PaymentMethodRegistryService`:**

Below the existing `mockAuditLoggerService`, add:

```typescript
const mockPaymentMethodRegistryService = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  findDefault: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  setDefault: jest.fn(),
};
```

**Step 3: Register the mock in the `TestingModule` providers (around line 84-88):**

Add to the providers array:

```typescript
{ provide: PaymentMethodRegistryService, useValue: mockPaymentMethodRegistryService },
```

So the full providers array becomes:
```typescript
providers: [
  FinancialEntryService,
  { provide: PrismaService, useValue: mockPrismaService },
  { provide: AuditLoggerService, useValue: mockAuditLoggerService },
  { provide: PaymentMethodRegistryService, useValue: mockPaymentMethodRegistryService },
],
```

**Step 4: Update the exact-match assertion for `createEntry` (around line 130-151):**

The first `createEntry` test has an exact-match assertion on the `data` object. Add the two new fields to the expected data:

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
    payment_method: null,                  // NEW — no payment method in dto
    payment_method_registry_id: null,      // NEW — no registry ID in dto
    notes: '2x4 studs for framing',
    has_receipt: false,
    created_by_user_id: USER_ID,
  },
  include: {
    category: {
      select: { id: true, name: true, type: true },
    },
  },
});
```

**Step 5: Run the existing tests to verify they still pass:**

```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern="financial-entry.service" --verbose
```

**Acceptance:** All existing tests pass. Zero failures.

**Do NOT:**
- Remove or modify any existing test cases
- Skip adding the mock — the test WILL crash without it
- Change the test assertions in ways that don't match the actual service behavior

---

## Integration Points

| Dependency | Import Path | What It Provides |
|---|---|---|
| `PaymentMethodRegistryService` | `'./payment-method-registry.service'` | `findOne()` to look up registry record type |

---

## Files Modified in This Sprint

| File | Change |
|---|---|
| `api/src/modules/financial/dto/create-financial-entry.dto.ts` | Add `payment_method` and `payment_method_registry_id` optional fields |
| `api/src/modules/financial/services/financial-entry.service.ts` | Add auto-copy logic in `createEntry()`, add `PaymentMethodRegistryService` dependency |
| `api/src/modules/financial/services/financial-entry.service.spec.ts` | Add `PaymentMethodRegistryService` mock to providers, update `createEntry` data assertion to include new fields |

**Files That Must NOT Be Modified:**
- `api/src/modules/financial/controllers/financial-entry.controller.ts` — no changes needed, the controller passes the DTO to the service
- `api/src/modules/financial/financial.module.ts` — no changes needed, `PaymentMethodRegistryService` is already registered
- `api/src/modules/financial/services/crew-payment.service.ts` — do not touch
- `api/src/modules/financial/services/subcontractor-payment.service.ts` — do not touch
- Any frontend file

---

## Acceptance Criteria

- [ ] `CreateFinancialEntryDto` has `payment_method` (optional, enum) and `payment_method_registry_id` (optional, UUID) fields
- [ ] `FinancialEntryService.createEntry()` auto-copies registry type to `payment_method` when `payment_method_registry_id` is provided
- [ ] Entry creation WITHOUT payment method fields still works (backward compatible)
- [ ] Entry creation WITH raw `payment_method` enum (no registry ID) still works
- [ ] Entry creation WITH `payment_method_registry_id` populates both `payment_method` and `payment_method_registry_id`
- [ ] If `payment_method_registry_id` references a non-existent or wrong-tenant record, 404 is thrown
- [ ] No existing service methods were broken
- [ ] Existing `financial-entry.service.spec.ts` tests all pass with the updated mock
- [ ] Dev server compiles without errors
- [ ] No frontend code was modified
- [ ] Dev server is shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Do not proceed to Sprint 3_6 until:
1. Auto-copy flow works correctly (tested via curl)
2. Backward compatibility confirmed (existing entry creation still works)
3. Direct payment method flow works (quick entry without registry)
4. All existing `financial-entry.service.spec.ts` tests pass
5. Dev server compiles and health check passes

---

## Handoff Notes

**For Sprint 3_6 (Unit Tests):**
- Sprint 3_6 creates tests for `PaymentMethodRegistryService` (the new service) — NOT for `FinancialEntryService`
- The existing `financial-entry.service.spec.ts` was already updated in this sprint (Task 7) to mock `PaymentMethodRegistryService` — no further changes needed there
- The `PaymentMethodRegistryService` tests in Sprint 3_6 mock `PrismaService` and `AuditLoggerService` only — it has no dependency on `FinancialEntryService`
