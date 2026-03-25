# Sprint 6_1 — Schema Migration: recurring_expense_rule Table + Enums + Relation

**Module:** Financial
**File:** ./documentation/sprints/financial/f06/sprint_6_1.md
**Type:** Migration
**Depends On:** F-01, F-02, F-03 must be complete (verified in Pre-Sprint Checklist)
**Gate:** STOP — Migration must run cleanly. `npx prisma generate` must succeed. Prisma Client must reflect all new types. Verify before Sprint 6_2.
**Estimated Complexity:** Medium

---

> **You are a masterclass-level backend engineer.** Your code quality makes engineers at Google, Amazon, and Apple jealous. Every line you write is precise, intentional, and production-grade.

> **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> **MySQL credentials** are in the `.env` file at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.

---

## Objective

Add the `recurring_expense_rule` table, two new enums (`recurring_frequency` and `recurring_rule_status`), and wire the Prisma relation between `financial_entry.recurring_rule_id` and the new `recurring_expense_rule` model. This is the data foundation for the entire Recurring Expense Engine.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` in full — understand the financial section (search for `financial_entry`, `financial_category`, `supplier`, `payment_method_registry`)
- [ ] Verify `is_recurring_instance` field exists on `financial_entry` (added by F-01) — if missing, STOP and report
- [ ] Verify `recurring_rule_id` field exists on `financial_entry` as a `String? @db.VarChar(36)` (added by F-01) — if missing, STOP and report
- [ ] Verify `supplier` model exists in schema (added by F-02) — if missing, STOP and report
- [ ] Verify `payment_method_registry` model exists in schema (added by F-03) — if missing, STOP and report
- [ ] Verify `financial_category` model exists with `id` field of type `String @id @default(uuid()) @db.VarChar(36)`
- [ ] Verify `tenant` model exists with `id` field of type `String @id`

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

### Task 1 — Add New Enums to Prisma Schema

**What:** Add two new enums to `/var/www/lead360.app/api/prisma/schema.prisma`.

**Where to place:** In the enums section, near the other financial enums (`financial_category_type`, `financial_entry_type`, etc.).

**Exact enum definitions:**

```prisma
enum recurring_frequency {
  daily
  weekly
  monthly
  quarterly
  annual
}

enum recurring_rule_status {
  active
  paused
  completed
  cancelled
}
```

**Do NOT:** Modify any existing enum. Do not rename or reorder existing enums.

---

### Task 2 — Add `recurring_expense_rule` Model to Prisma Schema

**What:** Add the new model to `/var/www/lead360.app/api/prisma/schema.prisma`.

**Where to place:** After the `financial_entry` model block (or near the financial models section).

**Exact model definition:**

```prisma
model recurring_expense_rule {
  id                          String                  @id @default(uuid()) @db.VarChar(36)
  tenant_id                   String                  @db.VarChar(36)
  name                        String                  @db.VarChar(200)
  description                 String?                 @db.Text
  category_id                 String                  @db.VarChar(36)
  amount                      Decimal                 @db.Decimal(12, 2)
  tax_amount                  Decimal?                @db.Decimal(10, 2)
  supplier_id                 String?                 @db.VarChar(36)
  vendor_name                 String?                 @db.VarChar(200)
  payment_method_registry_id  String?                 @db.VarChar(36)
  frequency                   recurring_frequency
  interval                    Int                     @default(1)
  day_of_month                Int?                    @db.TinyInt
  day_of_week                 Int?                    @db.TinyInt
  start_date                  DateTime                @db.Date
  end_date                    DateTime?               @db.Date
  recurrence_count            Int?
  occurrences_generated       Int                     @default(0)
  next_due_date               DateTime                @db.Date
  auto_confirm                Boolean                 @default(true)
  notes                       String?                 @db.Text
  status                      recurring_rule_status   @default(active)
  last_generated_at           DateTime?
  last_generated_entry_id     String?                 @db.VarChar(36)
  created_by_user_id          String                  @db.VarChar(36)
  updated_by_user_id          String?                 @db.VarChar(36)
  created_at                  DateTime                @default(now())
  updated_at                  DateTime                @updatedAt

  // Relations
  tenant                      tenant                  @relation(fields: [tenant_id], references: [id])
  category                    financial_category      @relation(fields: [category_id], references: [id])
  supplier                    supplier?               @relation(fields: [supplier_id], references: [id])
  payment_method              payment_method_registry? @relation(fields: [payment_method_registry_id], references: [id])
  created_by                  user                    @relation("recurring_rule_created_by", fields: [created_by_user_id], references: [id])
  updated_by                  user?                   @relation("recurring_rule_updated_by", fields: [updated_by_user_id], references: [id])
  generated_entries           financial_entry[]

  @@index([tenant_id, status])
  @@index([tenant_id, next_due_date])
  @@index([tenant_id, status, next_due_date])
  @@index([tenant_id, category_id])
  @@index([tenant_id, created_at])
  @@map("recurring_expense_rule")
}
```

**CRITICAL NOTES on Relations:**

1. The `tenant` relation: Check if the `tenant` model already has a `recurring_expense_rule` reverse relation field. If not, add `recurring_expense_rules recurring_expense_rule[]` to the `tenant` model.

2. The `category` relation: Check if `financial_category` already has a `recurring_expense_rules` reverse relation. If not, add `recurring_expense_rules recurring_expense_rule[]` to the `financial_category` model.

3. The `supplier` relation: Check if `supplier` model already has a `recurring_expense_rules` reverse relation. If not, add `recurring_expense_rules recurring_expense_rule[]` to the `supplier` model.

4. The `payment_method` relation: Check if `payment_method_registry` model already has a `recurring_expense_rules` reverse relation. If not, add `recurring_expense_rules recurring_expense_rule[]` to the `payment_method_registry` model.

5. The `created_by` / `updated_by` relations: The `user` model likely already has many relation fields. Add named reverse relations:
   - Add `recurring_rules_created recurring_expense_rule[] @relation("recurring_rule_created_by")` to the `user` model
   - Add `recurring_rules_updated recurring_expense_rule[] @relation("recurring_rule_updated_by")` to the `user` model

6. The `generated_entries` relation uses the existing `recurring_rule_id` FK on `financial_entry`. You must check if `financial_entry` already has a Prisma relation line for `recurring_rule_id`. If it only has the plain `String?` field without a `@relation()` line, add:
   ```prisma
   recurring_rule   recurring_expense_rule?   @relation(fields: [recurring_rule_id], references: [id], onDelete: SetNull)
   ```
   to the `financial_entry` model.

**Do NOT:**
- Modify any existing field on any existing model (only ADD reverse relation arrays)
- Change the `financial_entry.recurring_rule_id` field type or name — just add the `@relation()` line if missing
- Remove or rename any existing relations on `user`, `tenant`, `supplier`, `financial_category`, or `payment_method_registry`

---

### Task 3 — Run Prisma Migration

**What:** Generate and apply the database migration.

**Commands:**

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name recurring_expense_rule
```

**Expected output:** Migration created and applied successfully. A new folder appears at `api/prisma/migrations/[timestamp]_recurring_expense_rule/migration.sql`.

**If migration fails:**
- Read the error message carefully
- Common issues: missing reverse relations, naming conflicts, FK target model not found
- Fix the schema issue and re-run
- Do NOT use `npx prisma migrate dev --create-only` and then manually edit SQL unless absolutely necessary

---

### Task 4 — Generate Prisma Client

**What:** Regenerate the Prisma Client to include the new types.

```bash
cd /var/www/lead360.app/api
npx prisma generate
```

**Verify:** After generation, the following types should exist in the generated client:
- `recurring_expense_rule` model type
- `recurring_frequency` enum type
- `recurring_rule_status` enum type
- `financial_entry` should have `recurring_rule` relation property

---

### Task 5 — Verify Migration Applied Correctly

**What:** Start the dev server and verify the schema is correct.

Start the dev server per the Dev Server section above. After health check passes:

```bash
cd /var/www/lead360.app/api
npx prisma db pull --print | grep -A 5 "recurring_expense_rule"
```

Or verify via Prisma Studio or direct MySQL (read credentials from `.env` — the `DATABASE_URL` variable contains the connection string):

```bash
cd /var/www/lead360.app/api
# Extract credentials from DATABASE_URL in .env and query MySQL
DB_URL=$(grep DATABASE_URL .env | head -1 | cut -d= -f2-)
echo "DESCRIBE recurring_expense_rule;" | npx prisma db execute --stdin --url="$DB_URL"
echo "SHOW INDEX FROM recurring_expense_rule;" | npx prisma db execute --stdin --url="$DB_URL"
```

**Expected:** All 28 columns exist with correct types. All 5 indexes exist.

---

## Acceptance Criteria

- [ ] `recurring_frequency` enum added with values: `daily`, `weekly`, `monthly`, `quarterly`, `annual`
- [ ] `recurring_rule_status` enum added with values: `active`, `paused`, `completed`, `cancelled`
- [ ] `recurring_expense_rule` model added with all 28 fields exactly as specified
- [ ] All 5 indexes on `recurring_expense_rule` created
- [ ] All 6 relations wired: tenant, category, supplier, payment_method, created_by, updated_by
- [ ] `financial_entry` has Prisma relation to `recurring_expense_rule` via `recurring_rule_id`
- [ ] Reverse relation `generated_entries financial_entry[]` exists on `recurring_expense_rule`
- [ ] All reverse relations added to `tenant`, `financial_category`, `supplier`, `payment_method_registry`, `user` models
- [ ] Migration runs cleanly with `npx prisma migrate dev`
- [ ] `npx prisma generate` succeeds
- [ ] No existing models modified (only new fields/relations added)
- [ ] No existing enum values changed
- [ ] Dev server compiles and starts without errors
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — The migration must be applied and `npx prisma generate` must succeed. Verify the table exists in the database with all columns and indexes. The Prisma Client must export `recurring_expense_rule`, `recurring_frequency`, and `recurring_rule_status` types. Do NOT proceed to Sprint 6_2 until this is confirmed.

---

## Handoff Notes

- New model: `recurring_expense_rule` — accessed via `this.prisma.recurring_expense_rule`
- New enums: `recurring_frequency` (daily/weekly/monthly/quarterly/annual), `recurring_rule_status` (active/paused/completed/cancelled)
- Financial entry relation: `financial_entry.recurring_rule` → `recurring_expense_rule` (optional, via FK `recurring_rule_id`)
- Reverse relation: `recurring_expense_rule.generated_entries` → `financial_entry[]`
- The `onDelete: SetNull` on the financial_entry side means cancelling/deleting a rule sets `recurring_rule_id` to null on entries (but we soft-delete rules by setting status=cancelled, so this shouldn't trigger)
