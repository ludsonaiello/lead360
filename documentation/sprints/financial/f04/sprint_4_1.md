# Sprint 4_1 — Schema Migration: Rejection Fields

**Module:** Financial
**File:** ./documentation/sprints/financial/f04/sprint_4_1.md
**Type:** Migration
**Depends On:** F-01 complete, F-02 complete, F-03 complete
**Gate:** STOP — Migration must pass, `npx prisma generate` must succeed, schema must contain all 3 new fields with correct types
**Estimated Complexity:** Low

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

Add three new fields to the `financial_entry` table to support the reject/resubmit workflow introduced in Sprint F-04. These fields were not included in F-01 because the full rejection flow design was finalized in this sprint.

The three fields are:
1. `rejection_reason` — Text reason explaining why an expense was rejected
2. `rejected_by_user_id` — FK to the user who rejected it
3. `rejected_at` — Timestamp of when the rejection occurred

This sprint also verifies that all F-01, F-02, and F-03 schema changes are in place before proceeding.

---

## Pre-Sprint Checklist

- [ ] Read the full Prisma schema: `/var/www/lead360.app/api/prisma/schema.prisma`
- [ ] Verify the `financial_entry` model exists and contains ALL F-01 fields:
  - `project_id` must be `String?` (nullable — F-01 made it optional for business-level expenses)
  - `tax_amount` field must exist (`Decimal? @db.Decimal(12, 2)`)
  - `entry_time` field must exist (`String? @db.VarChar(8)`)
  - `supplier_id` field must exist (`String? @db.VarChar(36)`)
  - `payment_method` field must exist (`payment_method?`)
  - `payment_method_registry_id` field must exist (`String? @db.VarChar(36)`)
  - `purchased_by_user_id` field must exist (`String? @db.VarChar(36)`)
  - `purchased_by_crew_member_id` field must exist (`String? @db.VarChar(36)`)
  - `submission_status` field must exist (enum: `pending_review | confirmed`)
  - `is_recurring_instance` field must exist (`Boolean @default(false)`)
  - `recurring_rule_id` field must exist (`String? @db.VarChar(36)`)
- [ ] Verify the `supplier` model exists (F-02)
- [ ] Verify the `payment_method_registry` model exists (F-03)
- [ ] Verify the `financial_category` model has `classification` field (F-01: `financial_category_classification` enum — `cost_of_goods_sold | operating_expense`)
- [ ] Verify the `financial_entry_submission_status` enum exists (F-01: `pending_review | confirmed`)
- [ ] Verify the `payment_method` enum has been expanded to 8 values (F-03: `cash | check | bank_transfer | venmo | zelle | credit_card | debit_card | ACH`)

**IF ANY OF THE ABOVE ARE MISSING — STOP. Do not proceed. Report back which prerequisites are not met.**

---

## Dev Server

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

### Task 1 — Read Existing Schema

**What:** Read the full `financial_entry` model in `/var/www/lead360.app/api/prisma/schema.prisma`. Understand every field, relation, and index.

**Why:** You must know the exact current state before adding fields. The F-01 sprint added many new fields and relations. You must not duplicate or conflict with them.

**Do NOT:** Skip this step. Do NOT assume the schema matches any documentation — read the live file.

---

### Task 2 — Add Rejection Fields to `financial_entry` Model

**What:** Add these three fields to the `financial_entry` model in the Prisma schema:

```prisma
// Rejection workflow fields (F-04)
rejection_reason       String?   @db.VarChar(500)
rejected_by_user_id    String?   @db.VarChar(36)
rejected_at            DateTime?
```

**Where to place:** After the `submission_status` field and before the relations section.

**Why:** The reject/resubmit workflow requires tracking who rejected, when, and why. These fields are populated on rejection and cleared on resubmit.

**Acceptance:**
- `rejection_reason` is nullable VarChar(500)
- `rejected_by_user_id` is nullable VarChar(36)
- `rejected_at` is nullable DateTime (no @db decorator needed — default DateTime precision is fine)

---

### Task 3 — Add `rejected_by` Relation

**What:** Add this relation to the `financial_entry` model's relations section:

```prisma
rejected_by   user?   @relation("financial_entry_rejected_by", fields: [rejected_by_user_id], references: [id], onDelete: SetNull)
```

**Why:** Links the `rejected_by_user_id` FK to the `user` model. On user deletion, the FK is set to null (the rejection history is preserved but the user link is cleared).

**CRITICAL:** You must also add the reverse relation on the `user` model. Find the `user` model in `schema.prisma` and add:

```prisma
financial_entry_rejected  financial_entry[]  @relation("financial_entry_rejected_by")
```

Place it near the other `financial_entry` reverse relations on the `user` model.

**Acceptance:** Both sides of the relation are defined. No Prisma validation errors.

---

### Task 4 — Add Index for Rejection Fields

**What:** Add this index to the `financial_entry` model's indexes section:

```prisma
@@index([tenant_id, rejected_at])
```

**Why:** The pending review list will filter by rejection status. Entries with `rejected_at` populated are "rejected and awaiting correction." This index supports efficient filtering.

---

### Task 5 — Run Migration

**What:** Run the Prisma migration:

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name financial_entry_rejection_fields
```

**Why:** Creates the SQL migration and applies it to the database.

**Acceptance:**
- Migration runs without errors
- No data loss warnings
- Migration file created in `api/prisma/migrations/[timestamp]_financial_entry_rejection_fields/`

---

### Task 6 — Regenerate Prisma Client

**What:** Run:

```bash
cd /var/www/lead360.app/api
npx prisma generate
```

**Why:** Updates the TypeScript types to include the new fields.

**Acceptance:** `npx prisma generate` completes without errors.

---

### Task 7 — Verify Schema Integrity

**What:** Run:

```bash
cd /var/www/lead360.app/api
npx prisma validate
```

**Why:** Confirms the entire schema is valid — all relations are bilateral, all FKs resolve, all enums exist.

**Acceptance:** `npx prisma validate` returns no errors.

---

### Task 8 — Start Dev Server and Verify

**What:** Start the dev server and verify it compiles without errors:

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Wait for compilation. Then:

```bash
curl -s http://localhost:8000/health
```

**Acceptance:** Health check returns 200. No TypeScript compilation errors related to `financial_entry`.

---

## Acceptance Criteria

- [ ] `rejection_reason` field added to `financial_entry` as `String? @db.VarChar(500)`
- [ ] `rejected_by_user_id` field added to `financial_entry` as `String? @db.VarChar(36)`
- [ ] `rejected_at` field added to `financial_entry` as `DateTime?`
- [ ] `rejected_by` relation added with `onDelete: SetNull`
- [ ] Reverse relation `financial_entry_rejected` added to `user` model
- [ ] Index `@@index([tenant_id, rejected_at])` added
- [ ] Migration runs successfully without data loss
- [ ] `npx prisma generate` succeeds
- [ ] `npx prisma validate` succeeds
- [ ] Dev server compiles and starts without errors
- [ ] Health check returns 200
- [ ] No existing fields, relations, or indexes were modified or removed
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — The following must be true before Sprint 4_2 begins:

1. Migration `financial_entry_rejection_fields` exists and has been applied
2. `npx prisma validate` passes
3. Dev server starts without compilation errors
4. ALL F-01/F-02/F-03 prerequisites verified (see Pre-Sprint Checklist)

If any prerequisite from F-01/F-02/F-03 is not met, this sprint CANNOT proceed. Report back which prerequisites are missing.

---

## Handoff Notes

After this sprint, the `financial_entry` model has these rejection-related fields available for the service layer:

- `rejection_reason: string | null`
- `rejected_by_user_id: string | null`
- `rejected_at: Date | null`
- `rejected_by: user | null` (relation)

These will be used by `rejectEntry()` and `resubmitEntry()` methods in Sprint 4_5.
