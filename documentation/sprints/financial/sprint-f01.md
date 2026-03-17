# Sprint F-01 — Financial Module Foundation Migration

**Module**: Financial  
**Sprint**: F-01  
**Status**: Ready for Development  
**Type**: Schema Migration + DTO Update (No new tables)  
**Estimated Complexity**: Medium  
**Blocks**: F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, F-10 — nothing else in the Financial Module can begin until this sprint is complete.

---

## Purpose

The current financial module has three structural deficiencies that prevent the business-level general ledger from being built:

1. `financial_entry.project_id` is required — this blocks recording any expense that is not tied to a project (gas, insurance, office supplies, recurring overhead).
2. `payment_method` enum is incomplete — it is missing `credit_card`, `debit_card`, and `ACH`, which are standard U.S. business payment methods.
3. `financial_category` has no classification field — there is no distinction between project cost-of-goods-sold categories (labor, materials, subs, equipment) and business overhead categories (insurance, fuel, utilities, marketing, taxes, tools). Without this distinction, a P&L report cannot be structured correctly.
4. `financial_category_type` enum covers project costs only — overhead category types do not exist yet.

This sprint makes all four of those changes and updates every layer that touches them: Prisma schema, database migrations, DTOs, and service validation logic.

**No new tables are created in this sprint.** This is purely a migration and update sprint.

---

## Scope

### In Scope

- Make `financial_entry.project_id` nullable in Prisma schema, migration, DTO, and service
- Add `credit_card`, `debit_card`, `ACH` to `payment_method` enum
- Add `classification` field to `financial_category` model with new enum `financial_category_classification`
- Expand `financial_category_type` enum with overhead types: `insurance`, `fuel`, `utilities`, `office`, `marketing`, `taxes`, `tools`, `other_overhead`
- Update `financial_category` indexes to reflect new fields
- Update `CreateFinancialEntryDto` — make `project_id` optional with `@IsOptional()`
- Update `FinancialEntryService.createEntry()` — remove hard dependency on `project_id` in validation
- Update `FinancialEntryService.getProjectEntries()` — must not break when project_id is null
- Update `FinancialEntryService.getProjectCostSummary()` — confirm it still works correctly (it filters by project_id, so no change needed — but must be verified)
- Seed system-default overhead categories for every existing tenant (migration seed)
- Update all existing indexes on `financial_entry` that include `project_id` — composite indexes must treat nullable project_id correctly
- 100% API documentation update for all changed endpoints
- Full test coverage for: nullable project_id creation, overhead category creation, new payment method values

### Out of Scope

- No new tables (supplier, payment method registry, recurring rules — those are F-02 through F-04)
- No new endpoints
- No frontend changes
- No changes to `financial_entry` beyond making `project_id` nullable
- No changes to `receipt` table
- No changes to crew or subcontractor payment tables

---

## Platform Architecture Patterns (Mandatory)

The agent executing this sprint must follow all Lead360 platform patterns:

- **Tenant isolation**: Every query must include `tenant_id` filter. The migration must not touch or expose data across tenants.
- **AuditLoggerService**: Any service method that creates or modifies records must call `AuditLoggerService` with the correct action, actor, and before/after payload. This includes the category seed.
- **TenantId decorator**: All controller methods must use `@TenantId()` to extract `tenant_id` from JWT. Never trust `tenant_id` from request body.
- **EncryptionService**: Not applicable to this sprint — no sensitive fields involved.
- **FilesService**: Not applicable to this sprint.
- **Migrations**: Must run `npx prisma migrate dev --name financial_foundation_migration` after schema changes. Migration file must be committed alongside schema changes. Must run `npx prisma generate` after migration.

---

## Data Model Changes

### 1. Enum: `payment_method` — Add 3 Values

**Current state:**
```
cash | check | bank_transfer | venmo | zelle
```

**Updated state:**
```
cash | check | bank_transfer | venmo | zelle | credit_card | debit_card | ACH
```

**Rules:**
- `bank_transfer` and `ACH` are kept as distinct values. Bank transfer is a generic wire/transfer. ACH is a specific U.S. electronic payment network. They are used in different contexts and must remain separate.
- Existing records are unaffected — this is an additive change.

---

### 2. New Enum: `financial_category_classification`

```
cost_of_goods_sold | operating_expense
```

**Values:**
- `cost_of_goods_sold` — direct project costs: labor, materials, subcontractors, equipment. These costs are attributable to specific revenue-generating work.
- `operating_expense` — overhead and business running costs: insurance, fuel, utilities, office, marketing, taxes, tools. These costs exist regardless of whether a project is active.

**Why this matters:** A correct P&L report requires separating COGS from OpEx. Gross Profit = Revenue − COGS. Net Profit = Gross Profit − Operating Expenses. Without this field, all expenses are treated identically and the P&L is structurally incorrect.

---

### 3. Enum: `financial_category_type` — Add Overhead Types

**Current state:**
```
labor | material | subcontractor | equipment | other
```

**Updated state:**
```
labor | material | subcontractor | equipment | insurance | fuel | utilities | office | marketing | taxes | tools | other
```

**Note:** `other_overhead` was considered but rejected. A single `other` value is sufficient as a catch-all. The `classification` field on the category record determines whether an `other` category is COGS or OpEx.

---

### 4. Model: `financial_category` — Add `classification` Field

**New field to add:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `classification` | `financial_category_classification` | Required | `cost_of_goods_sold` | Whether this category is a direct project cost or a business overhead expense |

**Updated index:** Add `@@index([tenant_id, classification])` to support P&L filtering by classification.

**Business rules:**
- System-default categories with types `labor`, `material`, `subcontractor`, `equipment` must have `classification = cost_of_goods_sold`.
- System-default categories with types `insurance`, `fuel`, `utilities`, `office`, `marketing`, `taxes`, `tools` must have `classification = operating_expense`.
- The `other` type can have either classification — determined when the tenant creates a custom category.
- Tenant cannot change the `classification` of a system-default category (`is_system_default = true`).
- Tenant can set `classification` freely on their own custom categories.

---

### 5. Model: `financial_entry` — Make `project_id` Nullable

**Current state:**
```
project_id   String   @db.VarChar(36)   // Required
```

**Updated state:**
```
project_id   String?  @db.VarChar(36)   // Optional (nullable)
```

**Cascade change:** The Prisma relation `project → project (Restrict)` must change to allow null:
```
project   project?   @relation(...)   // Optional relation
```

**Index impact:** The existing indexes that include `project_id` must be reviewed:
- `@@index([tenant_id, project_id])` — Keep. MariaDB handles nullable columns in composite indexes correctly. NULL values are indexed and filtered as expected.
- `@@index([tenant_id, project_id, category_id])` — Keep with same reasoning.
- `@@index([tenant_id, task_id])` — Unaffected.
- `@@index([tenant_id, entry_date])` — Unaffected.
- `@@index([tenant_id, crew_member_id])` — Unaffected.
- `@@index([tenant_id, subcontractor_id])` — Unaffected.

**New index to add:**
- `@@index([tenant_id, classification_scope])` — where `classification_scope` refers to filtering entries that have no project (overhead). This is achieved by filtering `project_id IS NULL` in queries — no new index field needed, the existing `[tenant_id, project_id]` index covers this.

---

## Migration Seed: System-Default Overhead Categories

After the schema migration runs, a seed script must create system-default overhead categories for every existing tenant. This ensures no tenant is left without the new overhead category types.

**Categories to seed (for every tenant):**

| name | type | classification | is_system_default |
|------|------|----------------|-------------------|
| Insurance | insurance | operating_expense | true |
| Fuel & Vehicle | fuel | operating_expense | true |
| Utilities | utilities | operating_expense | true |
| Office & Admin | office | operating_expense | true |
| Marketing & Advertising | marketing | operating_expense | true |
| Taxes & Licenses | taxes | operating_expense | true |
| Tools & Equipment Purchase | tools | operating_expense | true |

**Existing system-default categories** (already seeded from Gate 1) must have their `classification` field updated:

| type | classification to set |
|------|-----------------------|
| labor | cost_of_goods_sold |
| material | cost_of_goods_sold |
| subcontractor | cost_of_goods_sold |
| equipment | cost_of_goods_sold |
| other | cost_of_goods_sold (default — tenant can override) |

**Seed rules:**
- Seed is idempotent — if a category with `is_system_default = true` and the same `type` already exists for a tenant, skip it (do not duplicate).
- `created_by_user_id` is null for system-default categories — this is already allowed by the schema.
- Seed must run as part of the migration, not as a manual step.

---

## DTO Changes

### `CreateFinancialEntryDto`

**Current state:**
```typescript
@IsString()
@IsUUID()
project_id: string;  // Required — no @IsOptional()
```

**Updated state:**
```typescript
@IsOptional()
@IsString()
@IsUUID()
project_id?: string;  // Optional
```

**Additional new fields on CreateFinancialEntryDto** (add these — they will be wired up fully in Sprint F-04, but the DTO must be ready now to avoid a second migration):

| Field | Decorator | Type | Notes |
|-------|-----------|------|-------|
| `payment_method` | `@IsOptional()` | `payment_method` enum | Optional — references the expanded enum |
| `supplier_id` | `@IsOptional() @IsUUID()` | `string?` | Nullable FK — actual supplier table built in F-02 |
| `purchased_by_user_id` | `@IsOptional() @IsUUID()` | `string?` | Who bought it — user |
| `purchased_by_crew_member_id` | `@IsOptional() @IsUUID()` | `string?` | Who bought it — crew member |
| `entry_time` | `@IsOptional()` | `string?` | Time of purchase, stored as `TIME` or appended to `entry_date` |
| `tax_amount` | `@IsOptional() @IsDecimal()` | `Decimal?` | Tax paid on this purchase |
| `submission_status` | `@IsOptional()` | `expense_submission_status` enum | `pending_review` or `confirmed` — default `confirmed` for Owner/Admin/Manager/Bookkeeper, `pending_review` for Employee |

**Note on new DTO fields:** These fields are added to the DTO now to be part of the migration so the schema changes are atomic. The service logic wiring for these fields (validation, role-based defaulting, two-tier submit/post enforcement) is implemented in Sprint F-04. The agent must add the fields to the schema and DTO but may stub the service logic with a comment `// TODO: F-04 — wire submission_status role logic`.

**New enum to add to schema:**
```
enum expense_submission_status {
  pending_review
  confirmed
}
```

**New fields on `financial_entry` schema model** (to be added alongside `project_id` nullable change):

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `payment_method` | `payment_method?` | Optional | null |
| `supplier_id` | `String? @db.VarChar(36)` | Optional | null |
| `purchased_by_user_id` | `String? @db.VarChar(36)` | Optional | null |
| `purchased_by_crew_member_id` | `String? @db.VarChar(36)` | Optional | null |
| `entry_time` | `DateTime? @db.Time(0)` | Optional | null |
| `tax_amount` | `Decimal? @db.Decimal(10,2)` | Optional | null |
| `submission_status` | `expense_submission_status @default(confirmed)` | Required | confirmed |
| `is_recurring_instance` | `Boolean @default(false)` | Required | false |
| `recurring_rule_id` | `String? @db.VarChar(36)` | Optional | null |

**Relations to add to `financial_entry`:**
- `supplier` → `supplier?` — FK to supplier table (built in F-02; add the field now, relation added in F-02 when table exists)
- `purchased_by_user` → `user?` — FK to user via `purchased_by_user_id`
- `purchased_by_crew_member` → `crew_member?` — FK to crew_member via `purchased_by_crew_member_id`

**Important:** `supplier_id` and `recurring_rule_id` FKs reference tables that do not exist yet (`supplier` and `recurring_expense_rule`). Add the columns to `financial_entry` as plain `String?` fields without a Prisma relation definition. The relation will be added in F-02 and F-06 when those tables are created. This avoids blocking this migration on downstream tables.

---

## API Changes

### Endpoints That Change Behavior

**No new endpoints are created in this sprint.**

The following existing endpoints change their validation behavior:

#### `POST /financial/entries`

**Before:** `project_id` is required. Request without it returns 400.  
**After:** `project_id` is optional. Request without it is valid and creates a business-level expense entry.

**Updated request body:**
```
project_id        string (UUID)    optional  — omit for business-level expenses
task_id           string (UUID)    optional
category_id       string (UUID)    required
entry_type        enum             required  (expense | income)
amount            decimal          required
entry_date        date             required
vendor_name       string           optional  — free-text fallback if no supplier_id
payment_method    enum             optional  — expanded enum now includes credit_card, debit_card, ACH
supplier_id       string (UUID)    optional  — stub field, no validation against supplier table yet
purchased_by_user_id              optional
purchased_by_crew_member_id       optional
entry_time        time             optional
tax_amount        decimal          optional
submission_status enum             optional  — defaults to confirmed
notes             string           optional
```

**Response:** Unchanged shape. No new fields in response yet — that is F-04.

**Error cases (updated):**
- `project_id` missing → now valid (no error)
- `project_id` present but not a valid UUID → 400 Bad Request
- `project_id` present but not belonging to this tenant → 404 Not Found (service must validate if provided)
- `category_id` not belonging to this tenant → 400 Bad Request
- `amount` zero or negative → 400 Bad Request

#### `GET /financial/entries` (project entries list)

**Before:** Filtered by `project_id` — implied always present.  
**After:** `project_id` query param becomes optional. If omitted, returns all entries for the tenant across all projects (and business-level entries). If provided, filters to that project only.

**This is a behavior-expanding change, not a breaking change.**

---

## Service Logic Changes

### `FinancialEntryService`

**`createEntry(tenantId, userId, dto)`**

Remove the implicit requirement that `project_id` exists. Add conditional validation:
- If `project_id` is provided, verify it belongs to `tenantId` — throw `NotFoundException` if not found.
- If `project_id` is not provided, skip project validation entirely.
- `task_id` validation: if `task_id` is provided, it must belong to the same `tenantId`. It does not need to belong to the provided `project_id` in this sprint (that cross-validation is enforced at the DB relation level).

**`getProjectEntries(tenantId, query)`**

Update query filter logic:
- If `project_id` is in query params, filter by it.
- If `project_id` is not in query params, return all entries for the tenant (do not implicitly require project_id).

**`getProjectCostSummary(tenantId, projectId)`**

No change needed — this method always receives a `projectId` argument and filters by it. The summary is project-scoped and that is correct. Leave as-is.

---

## Business Rules

1. A financial entry without a `project_id` is a **business-level expense**. It belongs to the tenant, not to any project. It contributes to the business P&L but not to any project's cost summary.
2. A financial entry with a `project_id` is a **project expense**. It contributes to both the project cost summary and the business P&L.
3. Once a `project_id` is set on an entry, it cannot be changed (update does not allow modifying `project_id`). This rule already exists and is preserved.
4. A category marked `is_system_default = true` cannot be deleted by a tenant. This rule already exists and is preserved.
5. A category marked `is_system_default = true` cannot have its `classification` changed by a tenant.
6. `submission_status` defaults to `confirmed` for all roles in this sprint. Role-based defaulting (Employee → `pending_review`) is implemented in F-04.
7. `tax_amount`, if provided, must be less than `amount`. Validation required in service.

---

## Migration Strategy

This sprint introduces both schema changes and a data migration (seeding classification on existing categories). The approach:

**Step 1 — Schema migration**
Run a single Prisma migration that:
- Makes `project_id` nullable on `financial_entry`
- Adds `classification` field to `financial_category` with default `cost_of_goods_sold`
- Adds new values to `payment_method` enum
- Adds new values to `financial_category_type` enum
- Adds new `financial_category_classification` enum
- Adds new `expense_submission_status` enum
- Adds all new optional fields to `financial_entry`

**Step 2 — Data migration within the same migration file**
After the schema changes, run raw SQL within the migration to:
- Set `classification = 'operating_expense'` on all existing `financial_category` records where `type IN ('insurance', 'fuel', 'utilities', 'office', 'marketing', 'taxes', 'tools')`
- Set `classification = 'cost_of_goods_sold'` on all existing records where `type IN ('labor', 'material', 'subcontractor', 'equipment', 'other')`
- Insert system-default overhead categories for each tenant (idempotent insert — skip if already exists)

**Step 3 — Generate client**
Run `npx prisma generate`

**Step 4 — Verify**
Run existing test suite. Confirm no existing tests break. All existing financial entry tests must pass — the only behavior change is `project_id` becoming optional.

---

## Acceptance Criteria

The sprint is complete when all of the following are true:

**Schema:**
- [ ] `financial_entry.project_id` is nullable in schema and verified in database
- [ ] `payment_method` enum contains all 8 values: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH`
- [ ] `financial_category_classification` enum exists with `cost_of_goods_sold` and `operating_expense`
- [ ] `financial_category.classification` field exists and is required
- [ ] `financial_category_type` enum contains all 12 values
- [ ] All new optional fields on `financial_entry` exist in schema
- [ ] `expense_submission_status` enum exists
- [ ] Migration runs cleanly from scratch with `npx prisma migrate reset`

**Data:**
- [ ] All existing `financial_category` records have `classification` set correctly based on their `type`
- [ ] All tenants have the 7 system-default overhead categories seeded
- [ ] Seed is idempotent — running migration twice does not create duplicate categories

**Service:**
- [ ] `POST /financial/entries` without `project_id` returns 201 Created
- [ ] `POST /financial/entries` with valid `project_id` returns 201 Created (existing behavior preserved)
- [ ] `POST /financial/entries` with invalid `project_id` UUID format returns 400
- [ ] `POST /financial/entries` with `project_id` not belonging to tenant returns 404
- [ ] `POST /financial/entries` with `tax_amount` >= `amount` returns 400
- [ ] `GET /financial/entries` without `project_id` query param returns all tenant entries
- [ ] `GET /financial/entries` with `project_id` returns only that project's entries

**Tests:**
- [ ] Unit test: create entry without `project_id` — success
- [ ] Unit test: create entry with `project_id` from different tenant — 404
- [ ] Unit test: create entry with `tax_amount` exceeding `amount` — 400
- [ ] Unit test: `payment_method` accepts `credit_card`, `debit_card`, `ACH`
- [ ] Integration test: overhead category seed runs correctly
- [ ] Integration test: existing financial entry tests all pass without modification
- [ ] Tenant isolation test: entry without `project_id` is scoped to correct tenant

**Documentation:**
- [ ] `api/documentation/financial_REST_API.md` updated to reflect:
  - `project_id` as optional on POST endpoint
  - New `payment_method` values documented
  - New optional fields documented with types and descriptions
  - Updated error codes table

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Existing tests assume `project_id` always present | Medium — tests fail | High — DTO change is breaking for test mocks | Audit all existing financial entry tests before running migration. Update mocks to not require `project_id`. |
| Enum additions in MariaDB require `ALTER TABLE` | Low — MariaDB supports additive enum changes | Low | Prisma handles this via migration SQL. Verify migration SQL before applying to production. |
| Seed creates duplicate categories if run on partially-migrated DB | Low | Low | Idempotent seed using `upsert` or existence check before insert. |
| `purchased_by_user_id` and `purchased_by_crew_member_id` both nullable with no mutual exclusion | Low — data quality issue | Medium | Business rule: these are both optional and both can be null. Mutual exclusion is enforced in F-04 service logic, not this sprint. Document this as a known deferral. |

---

## Dependencies

### Requires (must be complete before this sprint)
- Project Management Module backend — complete (confirmed via audit)
- Financial Module Gate 1, 2, 3 — complete (confirmed via codebase)
- `project` table — exists (confirmed via audit)
- `crew_member` table — exists (confirmed via audit)
- `user` table — exists (confirmed via audit)

### Blocks (cannot start until this sprint is complete)
- Sprint F-02 — Supplier Registry
- Sprint F-03 — Payment Method Registry
- Sprint F-04 — General Expense Entry Engine
- Sprint F-05 — Receipt OCR
- Sprint F-06 — Recurring Expense Engine
- Sprint F-07 — Project Financial Intelligence
- Sprint F-08 — Draw Schedule → Invoice Automation
- Sprint F-09 — Business Financial Dashboard
- Sprint F-10 — QuickBooks/Xero Export Readiness

---

## File Change Summary

### Files Modified
- `api/prisma/schema.prisma` — enum additions, field additions, nullable change
- `api/prisma/migrations/[timestamp]_financial_foundation_migration/migration.sql` — generated migration + seed SQL
- `api/src/modules/financial/dto/create-financial-entry.dto.ts` — `project_id` optional, new optional fields
- `api/src/modules/financial/services/financial-entry.service.ts` — remove project_id requirement from createEntry, update getProjectEntries
- `api/documentation/financial_REST_API.md` — update endpoint documentation

### Files Created
- None — this sprint modifies existing files only

### Files That Must NOT Be Modified
- Any file outside `api/src/modules/financial/` and `api/prisma/`
- No frontend files
- No other module files
- `api/src/modules/projects/` — do not touch
- `api/src/modules/quotes/` — do not touch

---

## Notes for Executing Agent

1. Read the current `api/src/modules/financial/services/financial-entry.service.ts` in full before making any changes. Understand all 8 public methods and their current logic before modifying anything.
2. Read the current `api/src/modules/financial/dto/create-financial-entry.dto.ts` in full before modifying.
3. Do not remove any existing validation — only relax the `project_id` requirement. All other existing validations are preserved.
4. The `UpdateFinancialEntryDto` does not include `project_id` and should not be changed — once set, `project_id` is immutable.
5. After migration runs, verify with a direct DB query that `financial_entry.project_id` is nullable in the actual database schema, not just in Prisma schema.
6. Produce 100% updated API documentation before marking the sprint complete. No endpoint that changed behavior may remain undocumented.