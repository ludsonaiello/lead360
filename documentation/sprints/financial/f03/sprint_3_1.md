# Sprint 3_1 — Schema Migration: payment_method_registry Table + financial_entry FK Relation

**Module:** Financial
**File:** ./documentation/sprints/financial/f03/sprint_3_1.md
**Type:** Migration
**Depends On:** Sprint F-01 must be complete and merged (expanded `payment_method` enum + `payment_method_registry_id` stub on `financial_entry`)
**Gate:** STOP — Migration must run cleanly, `npx prisma generate` must succeed, and all existing tests must still pass before proceeding to Sprint 3_2.
**Estimated Complexity:** Low

> **You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality.** Every line you write must reflect that standard.

> **WARNING:** This platform is 85% production-ready. Never leave the dev server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

---

## Objective

Create the `payment_method_registry` table in the Prisma schema and wire the FK relation from `financial_entry.payment_method_registry_id` to the new table. The `payment_method_registry_id` field already exists on `financial_entry` as a plain `String?` field (added by Sprint F-01). This sprint converts it into a proper Prisma relation. Run the migration and verify everything compiles.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` — confirm the `payment_method` enum includes all 8 values: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH`
- [ ] Confirm `financial_entry` model already has `payment_method_registry_id String? @db.VarChar(36)` field (added by F-01)
- [ ] Confirm `financial_entry` model already has `payment_method payment_method?` field (added by F-01)
- [ ] If any of these are missing, **STOP** — Sprint F-01 has not been completed. Do not proceed.
- [ ] Verify no existing `payment_method_registry` model exists in the schema

**If F-01 is NOT complete:** Do not proceed. Report that F-01 prerequisites are missing and list exactly which fields/enum values are absent.

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

### Task 1 — Read the Existing Schema

**What:** Read the full Prisma schema file at `/var/www/lead360.app/api/prisma/schema.prisma`. Understand the current `financial_entry` model, the `payment_method` enum, and the `tenant` model's relations.

**Why:** You must understand the exact current state before making any changes. The schema file is large — read it carefully.

**Expected output:** Confirmation that F-01 prerequisites exist.

**Do NOT:** Skip this step. Do NOT assume anything about the schema.

---

### Task 2 — Add the `payment_method_registry` Model

**What:** Add the following model to the Prisma schema file. Place it immediately after the `financial_entry` model for logical grouping.

```prisma
model payment_method_registry {
  id                 String          @id @default(uuid()) @db.VarChar(36)
  tenant_id          String          @db.VarChar(36)
  nickname           String          @db.VarChar(100)
  type               payment_method
  bank_name          String?         @db.VarChar(100)
  last_four          String?         @db.VarChar(4)
  notes              String?         @db.Text
  is_default         Boolean         @default(false)
  is_active          Boolean         @default(true)
  created_by_user_id String          @db.VarChar(36)
  updated_by_user_id String?         @db.VarChar(36)
  created_at         DateTime        @default(now())
  updated_at         DateTime        @updatedAt

  // Relations
  tenant             tenant          @relation("payment_method_registry_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  created_by         user            @relation("payment_method_registry_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  updated_by         user?           @relation("payment_method_registry_updated_by", fields: [updated_by_user_id], references: [id], onDelete: SetNull)
  financial_entries  financial_entry[] @relation("financial_entry_payment_method_registry")

  @@index([tenant_id, is_active])
  @@index([tenant_id, type])
  @@index([tenant_id, is_default])
  @@index([tenant_id, created_at])
  @@map("payment_method_registry")
}
```

**Why:** This is the core registry table. Each record represents a named payment instrument (e.g., "Chase Business Visa — Vehicle 1") that belongs to a tenant.

**Acceptance:** The model is in the schema with all fields, relations, and indexes exactly as shown.

**Do NOT:**
- Change any field names, types, or defaults
- Omit any index
- Use `onDelete: Cascade` on user relations (use Restrict/SetNull as shown)
- Add any fields not listed here

---

### Task 3 — Add Reverse Relations on `tenant` and `user` Models

**What:** Add the reverse relation fields on the `tenant` and `user` models:

On the `tenant` model, add:
```prisma
payment_method_registries payment_method_registry[] @relation("payment_method_registry_tenant")
```

On the `user` model, add:
```prisma
payment_method_registries_created payment_method_registry[] @relation("payment_method_registry_created_by")
payment_method_registries_updated payment_method_registry[] @relation("payment_method_registry_updated_by")
```

**Why:** Prisma requires both sides of a relation to be defined.

**Acceptance:** `npx prisma validate` passes without errors.

**Do NOT:** Remove or modify any existing relations on `tenant` or `user`.

---

### Task 4 — Wire the FK Relation on `financial_entry`

**What:** The `financial_entry` model already has a field `payment_method_registry_id String? @db.VarChar(36)` (added by F-01 as a plain field with no relation). Add the relation definition to connect it to `payment_method_registry`:

Add this line to the `financial_entry` model's relations section:
```prisma
payment_method_registry_rel payment_method_registry? @relation("financial_entry_payment_method_registry", fields: [payment_method_registry_id], references: [id], onDelete: SetNull)
```

**Why:** This creates the actual FK relationship. `onDelete: SetNull` ensures that if a payment method is hard-deleted (which should not happen per business rules, but as a safety guard), the entry's reference becomes null rather than the entry being deleted.

**Important:** The relation field name is `payment_method_registry_rel` (not `payment_method_registry`) to avoid naming conflict with the `payment_method_registry_id` scalar field. This is a Prisma convention when the scalar field name doesn't match the relation name pattern.

**Acceptance:** The `financial_entry` model now has both the scalar field `payment_method_registry_id` and the relation field `payment_method_registry_rel`.

**Do NOT:**
- Remove the existing `payment_method_registry_id` scalar field
- Change `onDelete` to anything other than `SetNull`
- Remove or modify any existing fields or relations on `financial_entry`

---

### Task 5 — Run Prisma Validate

**What:** Run validation before attempting migration:

```bash
cd /var/www/lead360.app/api
npx prisma validate
```

**Why:** Catches schema errors before migration attempt.

**Acceptance:** Command exits with 0 and no errors.

**Do NOT:** Proceed to migration if validate fails. Fix errors first.

---

### Task 6 — Run the Migration

**What:** Create and apply the database migration:

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name payment_method_registry
```

**Why:** Creates the `payment_method_registry` table in the database and adds the FK constraint on `financial_entry.payment_method_registry_id`.

**Acceptance:**
- Migration file created at `api/prisma/migrations/[timestamp]_payment_method_registry/migration.sql`
- Migration applies successfully
- The SQL file should contain:
  - `CREATE TABLE payment_method_registry` with all columns
  - `ALTER TABLE financial_entry ADD CONSTRAINT ... FOREIGN KEY (payment_method_registry_id) REFERENCES payment_method_registry(id)` (or equivalent)
  - Index creation statements

**Do NOT:**
- Run `migrate reset` — this destroys all data
- Run `db push` — this bypasses migration history
- Skip reading the generated SQL to verify correctness

---

### Task 7 — Generate Prisma Client

**What:** Regenerate the Prisma client:

```bash
cd /var/www/lead360.app/api
npx prisma generate
```

**Why:** Updates the TypeScript types so the new model is available in code.

**Acceptance:** Command succeeds. `payment_method_registry` is now available as `prisma.payment_method_registry.*` in TypeScript.

---

### Task 8 — Verify Compilation

**What:** Start the dev server and confirm it compiles without errors:

Follow the Dev Server instructions above.

**Why:** The new schema additions must not break any existing code.

**Acceptance:**
- Server starts without compilation errors
- `curl -s http://localhost:8000/health` returns 200
- No TypeScript errors in console output

**Do NOT:** Ignore warnings or errors. Every compilation issue must be resolved.

---

### Task 9 — Verify the Migration SQL

**What:** Read the generated migration SQL file and verify it contains:

1. `CREATE TABLE payment_method_registry` with all 13 columns
2. All 4 indexes on `payment_method_registry`
3. FK constraint from `payment_method_registry.tenant_id` to `tenant.id`
4. FK constraint from `payment_method_registry.created_by_user_id` to `user.id`
5. FK constraint from `financial_entry.payment_method_registry_id` to `payment_method_registry.id` (if not already present from F-01 stub)

**Acceptance:** All expected SQL statements are present and correct.

---

## Business Rules Enforced in This Sprint

- BR-01: `payment_method_registry` is tenant-scoped (enforced by `tenant_id` FK)
- BR-02: The `type` field uses the existing `payment_method` enum — no new enum needed
- BR-03: `onDelete: SetNull` on the FK from `financial_entry` ensures entries survive registry record deletion

---

## Integration Points

None — this sprint only modifies the Prisma schema. No service or controller code is touched.

---

## Acceptance Criteria

- [ ] `payment_method_registry` model exists in `schema.prisma` with all 13 fields exactly as specified
- [ ] All 4 indexes are defined: `[tenant_id, is_active]`, `[tenant_id, type]`, `[tenant_id, is_default]`, `[tenant_id, created_at]`
- [ ] Reverse relations exist on `tenant` and `user` models
- [ ] `financial_entry.payment_method_registry_id` has a Prisma relation to `payment_method_registry`
- [ ] `npx prisma validate` passes
- [ ] `npx prisma migrate dev` creates a clean migration
- [ ] `npx prisma generate` succeeds
- [ ] Dev server compiles and starts without errors
- [ ] Health check returns 200
- [ ] No existing code is broken
- [ ] No frontend code was modified
- [ ] Dev server is shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Do not proceed to Sprint 3_2 until:
1. Migration has run cleanly
2. `npx prisma generate` succeeds
3. Dev server compiles without errors
4. Health check returns 200
5. The generated migration SQL has been reviewed and confirmed correct

---

## Handoff Notes

**For Sprint 3_2 (DTOs):**
- The `payment_method` enum values available are: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH`
- The `payment_method_registry` Prisma model is now available for type references
- The relation field on `financial_entry` is named `payment_method_registry_rel` (relation) and `payment_method_registry_id` (scalar FK)
