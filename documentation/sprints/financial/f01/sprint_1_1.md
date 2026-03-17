# Sprint 1.1 — Schema Migration: Enums, Model Fields, Indexes, and Data Seed

**Module:** Financial
**File:** `./documentation/sprints/financial/f01/sprint_1_1.md`
**Type:** Migration
**Depends On:** NONE
**Gate:** STOP — Migration must run cleanly. `npx prisma generate` must succeed. All new enums and fields must be confirmed in the generated Prisma client before Sprint 1.2 begins.
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

Modify the Prisma schema to:
1. Make `financial_entry.project_id` nullable
2. Add 3 new values to `payment_method` enum
3. Create a new `financial_category_classification` enum
4. Add 7 new values to `financial_category_type` enum
5. Add a `classification` field to `financial_category` model
6. Create a new `expense_submission_status` enum
7. Add 9 new fields to `financial_entry` model
8. Add new indexes
9. Run the Prisma migration
10. Run a data migration to set `classification` on existing categories and seed overhead categories for all tenants

**No new tables are created.** This is purely a migration of existing models.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` in full — locate the `payment_method` enum (line ~3209), `financial_category_type` enum (line ~3382), `financial_category` model (line ~3395), and `financial_entry` model (line ~3418)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.ts` — understand the existing `DEFAULT_CATEGORIES` array and `seedDefaultCategories()` method
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — understand all current field usages
- [ ] Read `/var/www/lead360.app/api/.env` — confirm database credentials are present
- [ ] Confirm no migration is currently pending: `cd /var/www/lead360.app/api && npx prisma migrate status`

---

## Dev Server

> This sprint is migration-only. The dev server is NOT needed during schema changes.
> Only start the server at the very end to verify compilation.

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

### Task 1 — Update `payment_method` Enum

**What:** Add 3 new values to the existing `payment_method` enum in `schema.prisma`.

**Current state (line ~3209):**
```prisma
enum payment_method {
  cash
  check
  bank_transfer
  venmo
  zelle
}
```

**Updated state:**
```prisma
enum payment_method {
  cash
  check
  bank_transfer
  venmo
  zelle
  credit_card
  debit_card
  ACH
}
```

**Rules:**
- `bank_transfer` and `ACH` are distinct values. Do not merge them.
- Existing records are unaffected — this is an additive change.

**Do NOT:** Remove or rename any existing enum values.

---

### Task 2 — Create `financial_category_classification` Enum

**What:** Add a new enum immediately after the `payment_method` enum block.

```prisma
enum financial_category_classification {
  cost_of_goods_sold
  operating_expense
}
```

**Why:** P&L reporting requires separating COGS from operating expenses. Gross Profit = Revenue - COGS. Net Profit = Gross Profit - Operating Expenses.

---

### Task 3 — Update `financial_category_type` Enum

**What:** Add 7 new overhead category types.

**Current state (line ~3382):**
```prisma
enum financial_category_type {
  labor
  material
  subcontractor
  equipment
  other
}
```

**Updated state:**
```prisma
enum financial_category_type {
  labor
  material
  subcontractor
  equipment
  insurance
  fuel
  utilities
  office
  marketing
  taxes
  tools
  other
}
```

**Note:** `other` is a catch-all. The `classification` field on the category record determines whether an `other` category is COGS or OpEx.

**Do NOT:** Add `other_overhead` — a single `other` is sufficient.

---

### Task 4 — Create `expense_submission_status` Enum

**What:** Add a new enum near the other financial enums.

```prisma
enum expense_submission_status {
  pending_review
  confirmed
}
```

---

### Task 5 — Add `classification` Field to `financial_category` Model

**What:** Add a new required field with a default value.

**Current model (line ~3395):**
```prisma
model financial_category {
  id                 String                   @id @default(uuid()) @db.VarChar(36)
  tenant_id          String                   @db.VarChar(36)
  name               String                   @db.VarChar(200)
  type               financial_category_type
  description        String?                  @db.Text
  is_active          Boolean                  @default(true)
  is_system_default  Boolean                  @default(false)
  created_by_user_id String?                  @db.VarChar(36)
  created_at         DateTime                 @default(now())
  updated_at         DateTime                 @updatedAt

  // Relations
  tenant     tenant  @relation("financial_category_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  created_by user?   @relation("financial_category_created_by", fields: [created_by_user_id], references: [id], onDelete: SetNull)
  entries    financial_entry[]

  // Indexes
  @@index([tenant_id, type])
  @@index([tenant_id, is_active])
  @@map("financial_category")
}
```

**Add this field immediately after `type`:**
```prisma
  classification     financial_category_classification @default(cost_of_goods_sold)
```

**Add this index before the `@@map` line:**
```prisma
  @@index([tenant_id, classification])
```

**Resulting model (relevant portion):**
```prisma
model financial_category {
  id                 String                           @id @default(uuid()) @db.VarChar(36)
  tenant_id          String                           @db.VarChar(36)
  name               String                           @db.VarChar(200)
  type               financial_category_type
  classification     financial_category_classification @default(cost_of_goods_sold)
  description        String?                          @db.Text
  is_active          Boolean                          @default(true)
  is_system_default  Boolean                          @default(false)
  created_by_user_id String?                          @db.VarChar(36)
  created_at         DateTime                         @default(now())
  updated_at         DateTime                         @updatedAt

  // Relations
  tenant     tenant  @relation("financial_category_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  created_by user?   @relation("financial_category_created_by", fields: [created_by_user_id], references: [id], onDelete: SetNull)
  entries    financial_entry[]

  // Indexes
  @@index([tenant_id, type])
  @@index([tenant_id, is_active])
  @@index([tenant_id, classification])
  @@map("financial_category")
}
```

---

### Task 6 — Make `project_id` Nullable on `financial_entry` and Add New Fields

**What:** Change `project_id` from required to optional, and add 9 new fields.

**Current `financial_entry` model (line ~3418):**
```prisma
model financial_entry {
  id                 String                @id @default(uuid()) @db.VarChar(36)
  tenant_id          String                @db.VarChar(36)
  project_id         String                @db.VarChar(36)
  task_id            String?               @db.VarChar(36)
  category_id        String                @db.VarChar(36)
  entry_type         financial_entry_type  @default(expense)
  amount             Decimal               @db.Decimal(12, 2)
  entry_date         DateTime              @db.Date
  vendor_name        String?               @db.VarChar(200)
  crew_member_id     String?               @db.VarChar(36)
  subcontractor_id   String?               @db.VarChar(36)
  notes              String?               @db.Text
  has_receipt         Boolean               @default(false)
  created_by_user_id String                @db.VarChar(36)
  updated_by_user_id String?               @db.VarChar(36)
  created_at         DateTime              @default(now())
  updated_at         DateTime              @updatedAt

  // Relations
  tenant        tenant              @relation("financial_entry_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  category      financial_category  @relation(fields: [category_id], references: [id], onDelete: Restrict)
  created_by    user                @relation("financial_entry_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  updated_by    user?               @relation("financial_entry_updated_by", fields: [updated_by_user_id], references: [id], onDelete: SetNull)
  crew_member   crew_member?        @relation("financial_entry_crew_member", fields: [crew_member_id], references: [id], onDelete: SetNull)
  subcontractor subcontractor?      @relation("financial_entry_subcontractor", fields: [subcontractor_id], references: [id], onDelete: SetNull)
  project       project             @relation(fields: [project_id], references: [id], onDelete: Restrict)

  // Reverse relations
  receipts receipt[] @relation("receipt_financial_entry")

  // Indexes
  @@index([tenant_id, project_id])
  @@index([tenant_id, task_id])
  @@index([tenant_id, project_id, category_id])
  @@index([tenant_id, entry_date])
  @@index([tenant_id, crew_member_id])
  @@index([tenant_id, subcontractor_id])
  @@map("financial_entry")
}
```

**Changes:**

**6a. Make `project_id` nullable:**
```
project_id         String?               @db.VarChar(36)
```

**6b. Add 9 new fields immediately after `has_receipt`:**
```prisma
  payment_method               payment_method?
  supplier_id                  String?                    @db.VarChar(36)
  purchased_by_user_id         String?                    @db.VarChar(36)
  purchased_by_crew_member_id  String?                    @db.VarChar(36)
  entry_time                   DateTime?                  @db.Time(0)
  tax_amount                   Decimal?                   @db.Decimal(10, 2)
  submission_status            expense_submission_status   @default(confirmed)
  is_recurring_instance        Boolean                    @default(false)
  recurring_rule_id            String?                    @db.VarChar(36)
```

**6c. Update the `project` relation to optional:**
```prisma
  project       project?            @relation(fields: [project_id], references: [id], onDelete: Restrict)
```

**6d. Add 2 new relations** (for `purchased_by_user_id` and `purchased_by_crew_member_id`):
```prisma
  purchased_by_user        user?         @relation("financial_entry_purchased_by_user", fields: [purchased_by_user_id], references: [id], onDelete: SetNull)
  purchased_by_crew_member crew_member?  @relation("financial_entry_purchased_by_crew_member", fields: [purchased_by_crew_member_id], references: [id], onDelete: SetNull)
```

**IMPORTANT:** `supplier_id` and `recurring_rule_id` are plain `String?` fields — do NOT add Prisma relation definitions for them. The `supplier` and `recurring_expense_rule` tables do not exist yet (built in F-02 and F-06). Adding relations to nonexistent tables will fail the migration.

**6e. The `user` and `crew_member` models must have reverse relation fields added.** Find the `user` model and add:
```prisma
  purchased_financial_entries  financial_entry[] @relation("financial_entry_purchased_by_user")
```

Find the `crew_member` model and add:
```prisma
  purchased_financial_entries  financial_entry[] @relation("financial_entry_purchased_by_crew_member")
```

**Resulting `financial_entry` model:**
```prisma
model financial_entry {
  id                           String                     @id @default(uuid()) @db.VarChar(36)
  tenant_id                    String                     @db.VarChar(36)
  project_id                   String?                    @db.VarChar(36)
  task_id                      String?                    @db.VarChar(36)
  category_id                  String                     @db.VarChar(36)
  entry_type                   financial_entry_type       @default(expense)
  amount                       Decimal                    @db.Decimal(12, 2)
  entry_date                   DateTime                   @db.Date
  vendor_name                  String?                    @db.VarChar(200)
  crew_member_id               String?                    @db.VarChar(36)
  subcontractor_id             String?                    @db.VarChar(36)
  notes                        String?                    @db.Text
  has_receipt                   Boolean                    @default(false)
  payment_method               payment_method?
  supplier_id                  String?                    @db.VarChar(36)
  purchased_by_user_id         String?                    @db.VarChar(36)
  purchased_by_crew_member_id  String?                    @db.VarChar(36)
  entry_time                   DateTime?                  @db.Time(0)
  tax_amount                   Decimal?                   @db.Decimal(10, 2)
  submission_status            expense_submission_status   @default(confirmed)
  is_recurring_instance        Boolean                    @default(false)
  recurring_rule_id            String?                    @db.VarChar(36)
  created_by_user_id           String                     @db.VarChar(36)
  updated_by_user_id           String?                    @db.VarChar(36)
  created_at                   DateTime                   @default(now())
  updated_at                   DateTime                   @updatedAt

  // Relations
  tenant                   tenant              @relation("financial_entry_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  category                 financial_category  @relation(fields: [category_id], references: [id], onDelete: Restrict)
  created_by               user                @relation("financial_entry_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  updated_by               user?               @relation("financial_entry_updated_by", fields: [updated_by_user_id], references: [id], onDelete: SetNull)
  crew_member              crew_member?        @relation("financial_entry_crew_member", fields: [crew_member_id], references: [id], onDelete: SetNull)
  subcontractor            subcontractor?      @relation("financial_entry_subcontractor", fields: [subcontractor_id], references: [id], onDelete: SetNull)
  project                  project?            @relation(fields: [project_id], references: [id], onDelete: Restrict)
  purchased_by_user        user?               @relation("financial_entry_purchased_by_user", fields: [purchased_by_user_id], references: [id], onDelete: SetNull)
  purchased_by_crew_member crew_member?        @relation("financial_entry_purchased_by_crew_member", fields: [purchased_by_crew_member_id], references: [id], onDelete: SetNull)

  // Reverse relations
  receipts receipt[] @relation("receipt_financial_entry")

  // Indexes
  @@index([tenant_id, project_id])
  @@index([tenant_id, task_id])
  @@index([tenant_id, project_id, category_id])
  @@index([tenant_id, entry_date])
  @@index([tenant_id, crew_member_id])
  @@index([tenant_id, subcontractor_id])
  @@map("financial_entry")
}
```

**Do NOT:** Remove or rename any existing fields or indexes. Do NOT add relation definitions for `supplier_id` or `recurring_rule_id`.

---

### Task 7 — Run the Prisma Migration (Two-Step: Create, Then Apply)

**What:** Generate the migration file WITHOUT applying it, so we can append seed SQL before it runs.

**Step 1 — Create the migration file (do NOT apply yet):**
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --create-only --name financial_foundation_migration
```

This creates the migration file at `api/prisma/migrations/[timestamp]_financial_foundation_migration/migration.sql` but does NOT run it against the database.

**Step 2 — Append the seed SQL** (see Task 8 below). Edit the generated migration.sql file to add the data seed SQL at the bottom.

**Step 3 — Apply the migration (after Task 8 edits are done):**
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev
```

This applies the migration with the seed SQL included.

**Step 4 — Generate the Prisma client:**
```bash
npx prisma generate
```

**If migration fails:** Read the error message carefully. Common issues:
- Relation name conflicts — ensure all relation names are unique
- Missing reverse relation fields on `user` or `crew_member` models
- Enum values with invalid characters
- If the migration was already applied by accident (without `--create-only`), use `npx prisma db execute --file ./prisma/migrations/[timestamp]_financial_foundation_migration/seed.sql` to run the seed SQL separately

---

### Task 8 — Post-Migration Data Seed via Raw SQL

**What:** After the Prisma migration runs successfully, execute a data migration to:
1. Set `classification = 'operating_expense'` on existing categories with overhead types
2. Set `classification = 'cost_of_goods_sold'` on existing categories with project cost types
3. Insert 7 system-default overhead categories for every existing tenant

**IMPORTANT:** The Prisma migration will have already set `classification = 'cost_of_goods_sold'` as the default for all existing rows (because that is the `@default` value). So step 2 is already handled. But step 1 is NOT — any categories with types `insurance`, `fuel`, `utilities`, `office`, `marketing`, `taxes`, `tools` need their classification corrected. Since these types did not exist before this migration, there are no existing rows with these types. But we still need to seed the overhead categories.

**Run this SQL via Prisma's `$executeRawUnsafe` in a one-time seed script, OR manually add the SQL to the bottom of the generated migration file.**

**Preferred approach:** Edit the generated migration.sql file to append the seed SQL AFTER the schema changes. This keeps the data migration atomic with the schema migration.

**SQL to append to migration.sql:**

```sql
-- ============================================================================
-- DATA MIGRATION: Seed system-default overhead categories for every tenant
-- ============================================================================

-- For each existing tenant, insert 7 overhead categories if they don't already exist.
-- Uses UUID() for id generation (MariaDB built-in).

INSERT INTO financial_category (id, tenant_id, name, type, classification, description, is_active, is_system_default, created_by_user_id, created_at, updated_at)
SELECT UUID(), t.id, cat.name, cat.type, 'operating_expense', NULL, 1, 1, NULL, NOW(), NOW()
FROM tenant t
CROSS JOIN (
  SELECT 'Insurance' AS name, 'insurance' AS type
  UNION ALL SELECT 'Fuel & Vehicle', 'fuel'
  UNION ALL SELECT 'Utilities', 'utilities'
  UNION ALL SELECT 'Office & Admin', 'office'
  UNION ALL SELECT 'Marketing & Advertising', 'marketing'
  UNION ALL SELECT 'Taxes & Licenses', 'taxes'
  UNION ALL SELECT 'Tools & Equipment Purchase', 'tools'
) AS cat
WHERE NOT EXISTS (
  SELECT 1 FROM financial_category fc
  WHERE fc.tenant_id = t.id
    AND fc.is_system_default = 1
    AND fc.type = cat.type
);

-- Update existing system-default COGS categories to explicitly set classification
-- (The @default already sets this, but be explicit for clarity)
UPDATE financial_category
SET classification = 'cost_of_goods_sold'
WHERE is_system_default = 1
  AND type IN ('labor', 'material', 'subcontractor', 'equipment', 'other');
```

**Rules:**
- The seed is idempotent — the `WHERE NOT EXISTS` clause prevents duplicates.
- `created_by_user_id` is NULL for system-default categories (allowed by schema).
- The seed must run as part of the migration, not as a manual step.

**After editing the migration file**, go back to Task 7 Step 3 and apply:
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev
```

**IMPORTANT:** The migration file must be edited BEFORE it is applied (that's why Task 7 uses `--create-only`). If you already applied the migration without the seed SQL, run the seed SQL directly against the database:
```bash
mysql -u lead360_user -p'978@F32c' lead360 < ./path/to/seed.sql
```

---

### Task 9 — Verify Migration Success

**What:** Confirm all changes are reflected in the database.

```bash
cd /var/www/lead360.app/api

# Verify financial_entry.project_id is nullable
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_entry LIKE 'project_id';"

# Verify new enums exist in the schema
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_entry LIKE 'submission_status';"
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_entry LIKE 'payment_method';"
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_category LIKE 'classification';"

# Verify overhead categories were seeded
mysql -u lead360_user -p'978@F32c' lead360 -e "SELECT tenant_id, name, type, classification FROM financial_category WHERE is_system_default = 1 AND type IN ('insurance', 'fuel', 'utilities', 'office', 'marketing', 'taxes', 'tools') ORDER BY tenant_id, type;"

# Verify COGS classification is set on existing system defaults
mysql -u lead360_user -p'978@F32c' lead360 -e "SELECT tenant_id, name, type, classification FROM financial_category WHERE is_system_default = 1 AND type IN ('labor', 'material', 'subcontractor', 'equipment', 'other') LIMIT 20;"
```

**Expected outcomes:**
- `project_id` column shows `YES` in the Null column
- `submission_status` column exists with enum values `pending_review,confirmed`
- `payment_method` column includes `credit_card,debit_card,ACH`
- `classification` column exists with enum values `cost_of_goods_sold,operating_expense`
- 7 overhead categories exist per tenant
- COGS categories have `classification = cost_of_goods_sold`

---

### Task 10 — Verify Compilation

**What:** Start the dev server to confirm the application compiles without errors.

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Wait for compilation. Check for TypeScript errors. The server must compile cleanly.

**Note:** Some existing service code may have TypeScript warnings due to the `project_id` now being nullable where it was previously required. These will be resolved in Sprint 1.3 (Service Logic Changes). The application should still compile — Prisma types will now accept `null` for `project_id`.

**After confirming compilation succeeds, shut down the server:**
```bash
lsof -i :8000
kill {PID}
lsof -i :8000   # Must return nothing
```

---

## Acceptance Criteria

- [ ] `payment_method` enum in schema.prisma contains: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH`
- [ ] `financial_category_classification` enum exists with: `cost_of_goods_sold`, `operating_expense`
- [ ] `financial_category_type` enum contains all 12 values: `labor`, `material`, `subcontractor`, `equipment`, `insurance`, `fuel`, `utilities`, `office`, `marketing`, `taxes`, `tools`, `other`
- [ ] `expense_submission_status` enum exists with: `pending_review`, `confirmed`
- [ ] `financial_category.classification` field exists, is required, defaults to `cost_of_goods_sold`
- [ ] `financial_category` has `@@index([tenant_id, classification])`
- [ ] `financial_entry.project_id` is nullable (`String?`)
- [ ] `financial_entry.project` relation is optional (`project?`)
- [ ] All 9 new fields exist on `financial_entry` with correct types
- [ ] `user` model has `purchased_financial_entries` reverse relation
- [ ] `crew_member` model has `purchased_financial_entries` reverse relation
- [ ] No Prisma relation defined for `supplier_id` or `recurring_rule_id`
- [ ] Migration file exists at `api/prisma/migrations/[timestamp]_financial_foundation_migration/`
- [ ] `npx prisma generate` succeeds
- [ ] All tenants have 7 system-default overhead categories seeded
- [ ] All existing COGS system-default categories have `classification = cost_of_goods_sold`
- [ ] Application compiles without errors
- [ ] Dev server is shut down

---

## Gate Marker

**STOP** — This migration must be verified complete before Sprint 1.2 begins. Confirm:
1. `npx prisma generate` succeeds without errors
2. `financial_entry.project_id` is nullable in the actual database (not just Prisma schema)
3. All 7 overhead categories are seeded for every tenant
4. The application compiles cleanly with `npm run start:dev`

---

## Handoff Notes

**For Sprint 1.2 (DTO Updates):**
- The Prisma client now has `financial_category_classification`, `expense_submission_status` enums available
- `financial_entry.project_id` is `string | null` in Prisma types
- The `FinancialCategoryType` TypeScript enum in `create-financial-category.dto.ts` must be expanded to include the 7 new overhead types
- New DTO fields for `financial_entry` must match the Prisma field names exactly
- `CreateFinancialCategoryDto` needs a `classification` field
- `ListFinancialEntriesDto.project_id` must become optional
