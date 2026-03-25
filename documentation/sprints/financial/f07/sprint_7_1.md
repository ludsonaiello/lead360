# Sprint 7_1 — Prerequisite Migration: Classification, Submission Status, and Tax Amount Fields

**Module:** Financial
**File:** ./documentation/sprints/financial/f07/sprint_7_1.md
**Type:** Migration
**Depends On:** NONE
**Gate:** STOP — Migration must pass. `npx prisma generate` must succeed. All 3 new fields must be confirmed in the database AND in the generated Prisma client before Sprint 7_2 begins.
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

Sprint F-07 (Project Financial Intelligence) depends on three fields that were planned in Sprint F-01 but may not have been applied to the live database yet:

1. `financial_category.classification` — separates COGS from operating expenses for P&L analysis
2. `financial_entry.submission_status` — separates confirmed entries from pending_review entries
3. `financial_entry.tax_amount` — tracks tax paid per expense entry

This sprint checks whether these fields exist. If they do, skip to verification. If they do NOT, add them to the Prisma schema and run the migration.

**This sprint adds ONLY the fields F-07 needs. It does NOT run the full F-01 migration.** The remaining F-01 changes (making project_id nullable, adding supplier_id, etc.) will be handled by F-01 separately.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` — locate the `financial_category` model and `financial_entry` model
- [ ] Check if `financial_category` already has a `classification` field
- [ ] Check if `financial_entry` already has `submission_status` and `tax_amount` fields
- [ ] Read `/var/www/lead360.app/api/.env` — confirm database credentials are present
- [ ] Confirm no migration is currently pending: `cd /var/www/lead360.app/api && npx prisma migrate status`

**IF ALL THREE FIELDS ALREADY EXIST:** Skip Tasks 1–6, go directly to Task 7 (Verification). Mark the sprint as complete.

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

### Task 1 — Create `financial_category_classification` Enum (if missing)

**What:** Check if the `financial_category_classification` enum already exists in `/var/www/lead360.app/api/prisma/schema.prisma`. If it does NOT exist, add it.

**Where:** Add the enum near the other financial enums (after `financial_entry_type` or after `payment_method`).

```prisma
enum financial_category_classification {
  cost_of_goods_sold
  operating_expense
}
```

**Why:** P&L reporting requires separating COGS from operating expenses. Gross Profit = Revenue - COGS.

**Do NOT:** Remove or rename any existing enums.

---

### Task 2 — Create `expense_submission_status` Enum (if missing)

**What:** Check if the `expense_submission_status` enum already exists. If it does NOT exist, add it near the other financial enums.

```prisma
enum expense_submission_status {
  pending_review
  confirmed
}
```

**Why:** Financial entries need to distinguish between confirmed (bookkeeper-approved) and pending_review (not yet confirmed) entries. This affects margin analysis calculations.

**Do NOT:** Create if already exists.

---

### Task 3 — Add `classification` Field to `financial_category` Model (if missing)

**What:** Check if `financial_category` already has a `classification` field. If it does NOT, add it.

**Current `financial_category` model** (located around line ~3395 in schema.prisma):
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

**Add this field immediately after the `type` field:**
```prisma
  classification     financial_category_classification @default(cost_of_goods_sold)
```

**Add this index before the `@@map` line:**
```prisma
  @@index([tenant_id, classification])
```

**After changes, the model should look like:**
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

**Do NOT:** Remove or change any existing fields. Do NOT modify any other model.

---

### Task 4 — Add `submission_status` and `tax_amount` Fields to `financial_entry` Model (if missing)

**What:** Check if `financial_entry` already has `submission_status` and `tax_amount` fields. If they do NOT exist, add them.

**Current `financial_entry` model** (located around line ~3418 in schema.prisma):
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
  // ... relations and indexes follow
}
```

**Add these two fields immediately after `has_receipt`:**
```prisma
  tax_amount                   Decimal?                   @db.Decimal(10, 2)
  submission_status            expense_submission_status   @default(confirmed)
```

**Add this index in the indexes section (before `@@map`):**
```prisma
  @@index([tenant_id, submission_status])
```

**Why `@default(confirmed)`:** All existing entries were created before the submission workflow existed, so they are implicitly confirmed. New entries from F-04 onwards will start as `pending_review`.

**IMPORTANT:** These two fields are the ONLY additions to `financial_entry` in this sprint. Do NOT add `payment_method`, `supplier_id`, `purchased_by_user_id`, `purchased_by_crew_member_id`, `entry_time`, `is_recurring_instance`, or `recurring_rule_id` — those belong to the full F-01 migration.

**Do NOT:** Make `project_id` nullable. Do NOT change any existing fields. Do NOT add any new relations. Only add the 2 fields and 1 index specified above.

---

### Task 5 — Run the Prisma Migration

**What:** Generate and apply the migration.

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name f07_prerequisite_fields
```

**After migration completes:**
```bash
npx prisma generate
```

**If migration fails:** Read the error carefully. Common issues:
- Enum already exists — if `financial_category_classification` or `expense_submission_status` already exists, the migration will fail. In that case, remove the duplicate enum from schema.prisma (keep the existing one) and retry.
- Column already exists — same approach, remove the duplicate field from schema.prisma and retry.

---

### Task 6 — Data Seed: Set Classification on Existing Categories

**What:** After migration, existing `financial_category` records need their `classification` set correctly. The `@default(cost_of_goods_sold)` handles COGS categories, but we must verify.

**Run this SQL:**
```bash
cd /var/www/lead360.app/api
mysql -u lead360_user -p'978@F32c' lead360 -e "
-- Verify: all existing categories should have classification = cost_of_goods_sold (the default)
-- The types labor, material, subcontractor, equipment, other are all COGS
-- No existing categories should be operating_expense since those types (insurance, fuel, etc.) don't exist yet
SELECT id, name, type, classification FROM financial_category LIMIT 20;
"
```

**If any categories have incorrect classification, fix them:**
```sql
-- Ensure all job-cost types are COGS (this should already be the case from default)
UPDATE financial_category
SET classification = 'cost_of_goods_sold'
WHERE type IN ('labor', 'material', 'subcontractor', 'equipment', 'other')
  AND classification != 'cost_of_goods_sold';
```

**Note:** There should be no `operating_expense` categories yet because the overhead category types (`insurance`, `fuel`, `utilities`, etc.) have not been added to the `financial_category_type` enum. Those will be added by the full F-01 migration. For now, all existing categories are COGS.

---

### Task 7 — Verify Migration Success

**What:** Confirm all changes are reflected in the database.

```bash
cd /var/www/lead360.app/api

# Verify classification field exists on financial_category
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_category LIKE 'classification';"
# Expected: classification | enum('cost_of_goods_sold','operating_expense') | NO | ... | cost_of_goods_sold

# Verify submission_status field exists on financial_entry
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_entry LIKE 'submission_status';"
# Expected: submission_status | enum('pending_review','confirmed') | NO | ... | confirmed

# Verify tax_amount field exists on financial_entry
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_entry LIKE 'tax_amount';"
# Expected: tax_amount | decimal(10,2) | YES | ... | NULL

# Verify all existing entries have submission_status = confirmed
mysql -u lead360_user -p'978@F32c' lead360 -e "SELECT submission_status, COUNT(*) as cnt FROM financial_entry GROUP BY submission_status;"
# Expected: all rows should be 'confirmed'

# Verify Prisma schema is in sync
npx prisma validate
```

---

### Task 8 — Verify Compilation

**What:** Start the dev server to confirm the application compiles without errors.

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Wait for compilation (60-120 seconds). Check for TypeScript errors. The server must compile cleanly.

```bash
curl -s http://localhost:8000/health
# Must return 200
```

**After confirming compilation succeeds, shut down the server:**
```bash
lsof -i :8000
kill {PID}
lsof -i :8000   # Must return nothing
```

---

## Acceptance Criteria

- [ ] `financial_category_classification` enum exists in schema.prisma with values: `cost_of_goods_sold`, `operating_expense`
- [ ] `expense_submission_status` enum exists in schema.prisma with values: `pending_review`, `confirmed`
- [ ] `financial_category.classification` field exists, is required, defaults to `cost_of_goods_sold`
- [ ] `financial_category` has `@@index([tenant_id, classification])`
- [ ] `financial_entry.submission_status` field exists, is required, defaults to `confirmed`
- [ ] `financial_entry.tax_amount` field exists as `Decimal? @db.Decimal(10, 2)`
- [ ] `financial_entry` has `@@index([tenant_id, submission_status])`
- [ ] All existing `financial_entry` rows have `submission_status = confirmed`
- [ ] All existing `financial_category` rows have `classification = cost_of_goods_sold`
- [ ] `npx prisma generate` succeeds
- [ ] `npx prisma validate` succeeds
- [ ] Application compiles without TypeScript errors
- [ ] Health check returns 200
- [ ] No existing fields, relations, or indexes were modified or removed
- [ ] Dev server is shut down

---

## Gate Marker

**STOP** — This migration must be verified complete before Sprint 7_2 begins. Confirm:
1. `npx prisma generate` succeeds without errors
2. All three fields exist in the actual database (not just Prisma schema)
3. All existing entries have `submission_status = confirmed`
4. The application compiles cleanly with `npm run start:dev`

---

## Handoff Notes

**For Sprint 7_2 (DTOs):**
- The Prisma client now has `financial_category_classification` and `expense_submission_status` enums available as TypeScript types
- `financial_entry.submission_status` is `expense_submission_status` (values: `pending_review`, `confirmed`)
- `financial_entry.tax_amount` is `Decimal | null`
- `financial_category.classification` is `financial_category_classification` (values: `cost_of_goods_sold`, `operating_expense`)
