# Sprint 10_1 — Prerequisite Verification + Schema Migration

**Module:** Financial
**File:** ./documentation/sprints/financial/f10/sprint_10_1.md
**Type:** Migration
**Depends On:** F-01, F-02, F-03, F-04, F-08 must all be complete and merged
**Gate:** STOP — Migration must run clean, both new tables must exist, Prisma client must regenerate without errors
**Estimated Complexity:** Medium

> **You are a masterclass-level engineer who makes Google, Amazon, and Apple engineers jealous of the quality of your work.**

> ⚠️ **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> ⚠️ **MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — do NOT hardcode database credentials anywhere.**

---

## Objective

Add the two new tables (`financial_export_log` and `financial_category_account_mapping`) and two new enums (`export_type` and `accounting_platform`) required by the F-10 QuickBooks/Xero Export Readiness feature. This sprint produces only schema changes and a migration — no service or controller code.

Before writing any schema changes, this sprint MUST verify that all prerequisite schema artifacts from F-01 through F-09 exist. If any prerequisite is missing, STOP immediately and report.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` — the ENTIRE file
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts`
- [ ] Verify the following prerequisite schema artifacts exist (these come from F-01 through F-09):

**From F-01 (Foundation Migration):**
- [ ] `financial_category` model has a `classification` field (enum: `cost_of_goods_sold`, `operating_expense`)
- [ ] `financial_entry.project_id` is nullable (optional)
- [ ] `payment_method` enum includes: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH`
- [ ] `financial_category_type` enum includes overhead types (beyond labor/material/subcontractor/equipment/other)

**From F-02 (Supplier Registry):**
- [ ] `supplier` model exists
- [ ] `financial_entry` has `supplier_id` field (FK to supplier)

**From F-03 (Payment Method Registry):**
- [ ] `payment_method_registry` model exists

**From F-04 (General Expense Entry Engine):**
- [ ] `financial_entry` has `submission_status` field (enum with at least `pending_review`, `confirmed`)
- [ ] `financial_entry` has `is_recurring_instance` field (Boolean)
- [ ] `financial_entry` has `tax_amount` field (Decimal)
- [ ] `financial_entry` has `payment_method` field

**From F-08 (Draw Schedule → Invoice Automation):**
- [ ] `project_invoice` model exists with fields: `invoice_number`, `amount`, `tax_amount`, `description`, `due_date`, `status`, `created_at`
- [ ] `project_invoice` has a `project_id` FK with a `project` relation (export uses `project.name` and `project.project_number`)
- [ ] `invoice_status_extended` enum exists (with at least: `draft`, `sent`, `partial`, `paid`, `voided`)

**If ANY of these prerequisites are missing, STOP. Do not proceed. Report which prerequisites are missing.**

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

### Task 1 — Verify Prerequisites

**What:** Run through the entire Pre-Sprint Checklist above by reading the Prisma schema and confirming every prerequisite artifact exists.

**Why:** F-10 depends on schema artifacts from F-01 through F-09. If any are missing, the export service will reference non-existent fields and fail.

**Expected output:** A confirmation that all prerequisites pass, OR a list of what is missing.

**Acceptance:** All checkboxes in the Pre-Sprint Checklist are verified.

**Do NOT:** Proceed to Task 2 if any prerequisite is missing. Stop and report.

---

### Task 2 — Add New Enums to Prisma Schema

**What:** Add two new enums to `schema.prisma`:

```prisma
// ============================================================================
// FINANCIAL EXPORT (Sprint F-10)
// ============================================================================

enum export_type {
  quickbooks_expenses
  quickbooks_invoices
  xero_expenses
  xero_invoices
  pl_csv
  entries_csv
}

enum accounting_platform {
  quickbooks
  xero
}
```

**Where:** Add these enums in the Financial section of `schema.prisma`, after the existing financial enums. Look for where the financial module enums are grouped (near `financial_category_type`, `financial_entry_type`, etc.) and add these immediately after.

**Why:** Both enums are required by the two new tables. They must exist before the models reference them.

**Acceptance:** The enums compile without error in Prisma schema validation.

**Do NOT:** Modify any existing enum. Do not add values to `payment_method` or any other existing enum.

---

### Task 3 — Add `financial_export_log` Table

**What:** Add this model to `schema.prisma`:

```prisma
model financial_export_log {
  id                  String           @id @default(uuid()) @db.VarChar(36)
  tenant_id           String           @db.VarChar(36)
  export_type         export_type
  date_from           DateTime?        @db.Date
  date_to             DateTime?        @db.Date
  record_count        Int
  file_name           String           @db.VarChar(255)
  filters_applied     String?          @db.Text
  exported_by_user_id String           @db.VarChar(36)
  created_at          DateTime         @default(now())

  // Relations
  tenant      tenant @relation("financial_export_log_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  exported_by user   @relation("financial_export_log_user", fields: [exported_by_user_id], references: [id], onDelete: Restrict)

  // Indexes
  @@index([tenant_id, export_type])
  @@index([tenant_id, created_at])
  @@index([tenant_id, exported_by_user_id])
  @@map("financial_export_log")
}
```

**Where:** Add after the existing financial models in `schema.prisma`, in the Financial Export section you created in Task 2.

**Why:** This table is an immutable audit record of every export performed. No update or delete operations. Records who exported what, when, and with what filters.

**CRITICAL — Relation names:** The relation names `"financial_export_log_tenant"` and `"financial_export_log_user"` must be unique across the entire schema. Check that no other model uses these relation names. If the `tenant` or `user` models already have many relations, you MUST also add the reverse relation fields to those models:

In the `tenant` model, add:
```prisma
financial_export_logs financial_export_log[] @relation("financial_export_log_tenant")
```

In the `user` model, add:
```prisma
financial_export_logs financial_export_log[] @relation("financial_export_log_user")
```

**Acceptance:** Model compiles. Relation names are unique. Reverse relations added to `tenant` and `user`.

**Do NOT:** Add `updated_at` — this table is immutable. Do not add a `deleted_at` — export logs cannot be deleted.

---

### Task 4 — Add `financial_category_account_mapping` Table

**What:** Add this model to `schema.prisma`:

```prisma
model financial_category_account_mapping {
  id                 String              @id @default(uuid()) @db.VarChar(36)
  tenant_id          String              @db.VarChar(36)
  category_id        String              @db.VarChar(36)
  platform           accounting_platform
  account_name       String              @db.VarChar(200)
  account_code       String?             @db.VarChar(50)
  created_by_user_id String              @db.VarChar(36)
  updated_by_user_id String?             @db.VarChar(36)
  created_at         DateTime            @default(now())
  updated_at         DateTime            @updatedAt

  // Relations
  tenant     tenant             @relation("category_account_mapping_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  category   financial_category @relation("category_account_mapping_category", fields: [category_id], references: [id], onDelete: Cascade)
  created_by user               @relation("category_account_mapping_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  updated_by user?              @relation("category_account_mapping_updated_by", fields: [updated_by_user_id], references: [id], onDelete: SetNull)

  // Indexes
  @@index([tenant_id, platform])
  @@unique([tenant_id, category_id, platform])
  @@map("financial_category_account_mapping")
}
```

**Where:** Add immediately after the `financial_export_log` model.

**Why:** This table maps Lead360 financial categories to QuickBooks/Xero chart of accounts names. One mapping per category per platform per tenant. If no mapping exists, the export falls back to the Lead360 category name.

**CRITICAL — Reverse relations required:**

In the `tenant` model, add:
```prisma
category_account_mappings financial_category_account_mapping[] @relation("category_account_mapping_tenant")
```

In the `financial_category` model, add:
```prisma
account_mappings financial_category_account_mapping[] @relation("category_account_mapping_category")
```

In the `user` model, add TWO reverse relations:
```prisma
category_account_mappings_created financial_category_account_mapping[] @relation("category_account_mapping_created_by")
category_account_mappings_updated financial_category_account_mapping[] @relation("category_account_mapping_updated_by")
```

**Acceptance:** Model compiles. Unique constraint on `[tenant_id, category_id, platform]` enforced. All reverse relations added.

**Do NOT:** Modify the `financial_category` model's existing fields. Only add the reverse relation array.

---

### Task 5 — Run Prisma Migration

**What:** Run the migration:

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name financial_export_readiness
```

**Why:** Creates the database tables and generates the updated Prisma client.

**After migration, verify:**
1. Migration ran without errors
2. Run `npx prisma generate` to ensure client is fresh
3. Check the generated migration SQL file exists at `api/prisma/migrations/[timestamp]_financial_export_readiness/migration.sql`
4. Verify the SQL contains:
   - `CREATE TABLE financial_export_log`
   - `CREATE TABLE financial_category_account_mapping`
   - Both enums created (MySQL: check the column type definitions)
   - Unique index on `financial_category_account_mapping(tenant_id, category_id, platform)`
   - All three indexes on `financial_export_log`

**Acceptance:** Migration clean. No errors. Tables exist in database.

**Do NOT:** Use `prisma db push` — always use `prisma migrate dev`. Do not use `--create-only` — we want the migration applied immediately.

---

### Task 6 — Start Dev Server and Verify Compilation

**What:** Start the dev server and verify it compiles without errors:

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Wait for compilation to complete. Check for any TypeScript errors related to the new models or relations.

**Verify:** `curl -s http://localhost:8000/health` returns 200.

**After verification:** Stop the server:
```bash
lsof -i :8000
kill {PID}
```

**Acceptance:** Server compiles and starts without errors. Health check returns 200. No existing functionality is broken.

---

## Patterns to Apply

### Prisma Schema Standards
```prisma
model entity_name {
  id         String    @id @default(uuid()) @db.VarChar(36)
  tenant_id  String    @db.VarChar(36)
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt

  tenant     tenant    @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id, created_at])
  @@map("entity_name")
}
```

### Migration Workflow
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name descriptive_migration_name
npx prisma generate
```

---

## Business Rules Enforced in This Sprint

- BR-01: Export logs are immutable — no `updated_at`, no update or delete operations.
- BR-02: One account mapping per category per platform per tenant — enforced by unique constraint `@@unique([tenant_id, category_id, platform])`.

---

## Integration Points

None — this sprint is schema-only. No imports from other modules required.

---

## Acceptance Criteria

- [ ] All F-01 through F-09 prerequisite schema artifacts verified present
- [ ] `export_type` enum added with 6 values: `quickbooks_expenses`, `quickbooks_invoices`, `xero_expenses`, `xero_invoices`, `pl_csv`, `entries_csv`
- [ ] `accounting_platform` enum added with 2 values: `quickbooks`, `xero`
- [ ] `financial_export_log` table created with all fields, indexes, and relations
- [ ] `financial_category_account_mapping` table created with all fields, indexes, unique constraint, and relations
- [ ] All reverse relations added to `tenant`, `user`, and `financial_category` models
- [ ] Migration runs cleanly: `npx prisma migrate dev --name financial_export_readiness`
- [ ] Prisma client generates without errors: `npx prisma generate`
- [ ] Dev server compiles and starts without errors
- [ ] Health check passes: `curl -s http://localhost:8000/health` returns 200
- [ ] No existing financial module functionality is broken
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — The migration must run cleanly, both new tables must exist in the database, and the Prisma client must generate without errors. The dev server must compile and pass the health check. Do not proceed to Sprint 10_2 until all acceptance criteria are verified.

---

## Handoff Notes

- Two new enums available for DTOs: `export_type`, `accounting_platform`
- Two new Prisma models available: `financial_export_log`, `financial_category_account_mapping`
- The `financial_category_account_mapping` has a unique constraint on `[tenant_id, category_id, platform]` — this enables upsert behavior in Sprint 10_3
- The `financial_export_log` has no `updated_at` — records are immutable
