# Sprint 8_1 — Schema Migration: Draw Milestone + Project Invoice + Invoice Payment

**Module:** Financial
**File:** `./documentation/sprints/financial/f08/sprint_8_1.md`
**Type:** Migration
**Depends On:** NONE (first sprint in F-08)
**Gate:** STOP — Migration must run cleanly, all 3 tables must exist in MySQL, `npx prisma generate` must succeed without errors
**Estimated Complexity:** High

---

## Developer Standard

You are a **masterclass-level engineer** whose work makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is deliberate, precise, and production-grade.

---

## ⚠️ Critical Warnings

- **This platform is 85% production-ready.** Do NOT break any existing functionality. Not a single comma, relation, or enum may be disrupted.
- **Read the codebase BEFORE touching anything.** Understand what exists. Then implement with surgical precision.
- **Never leave the dev server running in the background** when you finish.
- **Never use `pkill -f`** — always use `lsof -i :PORT` + `kill {PID}`.
- **Never use PM2** — this project does NOT use PM2.
- **MySQL credentials** are in `/var/www/lead360.app/api/.env` — do NOT hardcode credentials anywhere.

---

## Objective

Add 3 new database tables and 2 new enums to the Prisma schema to support the Draw Schedule → Invoice Automation feature. These tables are: `project_draw_milestone` (project-scoped draw schedule with lifecycle), `project_invoice` (customer invoice foundation), and `project_invoice_payment` (payment records against invoices). This sprint makes NO code changes to services, controllers, or modules — schema only.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` in full — understand ALL existing models, enums, and relations
- [ ] Confirm `draw_schedule_entry` model exists (it's the source for milestone seeding — read its fields)
- [ ] Confirm `project` model exists and note ALL its existing reverse relations (you'll add 3 more)
- [ ] Confirm `user` model exists and note ALL its existing reverse relations (you'll add 4 more)
- [ ] Confirm `tenant` model exists and note ALL its existing reverse relations (you'll add 3 more)
- [ ] Confirm the existing `invoice_status` enum exists with values: `pending`, `approved`, `paid` — you must NOT modify this enum
- [ ] Confirm `draw_calculation_type` enum exists with values: `percentage`, `fixed_amount`
- [ ] Confirm `payment_method` enum exists with values: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`
- [ ] Confirm `tenant` model already has `next_invoice_number Int @default(1)` and `invoice_prefix String @default("INV") @db.VarChar(10)` fields — if so, NO tenant schema changes needed

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

### Task 1 — Add 2 new enums to schema.prisma

**What:** Add the `milestone_status` and `invoice_status_extended` enums to the Prisma schema.

**Why:** `milestone_status` tracks the lifecycle of draw milestones (pending → invoiced → paid). `invoice_status_extended` tracks the lifecycle of project invoices (draft → sent → partial → paid → voided). The new enum is named `invoice_status_extended` to avoid collision with the existing `invoice_status` enum on `subcontractor_task_invoice`.

**Where:** Add these enums in `/var/www/lead360.app/api/prisma/schema.prisma`. Place them near the existing `invoice_status` and `draw_calculation_type` enums for logical grouping. Add a comment block separating them.

**Exact schema to add:**

```prisma
// ============================================================================
// DRAW MILESTONE + PROJECT INVOICE ENUMS — Sprint F-08
// ============================================================================

enum milestone_status {
  pending
  invoiced
  paid
}

enum invoice_status_extended {
  draft
  sent
  partial
  paid
  voided
}
```

**Do NOT:**
- Modify the existing `invoice_status` enum
- Modify the existing `draw_calculation_type` enum
- Modify the existing `payment_method` enum

---

### Task 2 — Add `project_draw_milestone` model

**What:** Add the project draw milestone table to the Prisma schema.

**Why:** This table stores project-level copies of draw schedule entries with billing lifecycle tracking. It bridges the gap between quote draw schedules and project invoicing.

**Where:** Add this model in `schema.prisma` after the project-related models section. Add a comment block header.

**Exact schema to add:**

```prisma
// ============================================================================
// DRAW MILESTONES — Sprint F-08
// ============================================================================

model project_draw_milestone {
  id                     String                @id @default(uuid()) @db.VarChar(36)
  tenant_id              String                @db.VarChar(36)
  project_id             String                @db.VarChar(36)
  quote_draw_entry_id    String?               @db.VarChar(36)
  draw_number            Int
  description            String                @db.VarChar(255)
  calculation_type       draw_calculation_type
  value                  Decimal               @db.Decimal(10, 2)
  calculated_amount      Decimal               @db.Decimal(12, 2)
  status                 milestone_status      @default(pending)
  invoice_id             String?               @db.VarChar(36)
  invoiced_at            DateTime?
  paid_at                DateTime?
  notes                  String?               @db.Text
  created_by_user_id     String                @db.VarChar(36)
  created_at             DateTime              @default(now())
  updated_at             DateTime              @updatedAt

  // Relations
  tenant              tenant                 @relation("project_draw_milestone_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  project             project                @relation("project_draw_milestone_project", fields: [project_id], references: [id], onDelete: Cascade)
  quote_draw_entry    draw_schedule_entry?   @relation("project_draw_milestone_source", fields: [quote_draw_entry_id], references: [id], onDelete: SetNull)
  invoice             project_invoice?       @relation("milestone_current_invoice", fields: [invoice_id], references: [id], onDelete: SetNull)
  created_by          user                   @relation("project_draw_milestone_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)

  // Reverse: invoices that reference this milestone via milestone_id
  generated_invoices  project_invoice[]      @relation("invoice_source_milestone")

  @@index([tenant_id, project_id])
  @@index([tenant_id, project_id, status])
  @@index([tenant_id, status])
  @@unique([project_id, draw_number])
  @@map("project_draw_milestone")
}
```

**Key notes:**
- `invoice_id` is the FK to the CURRENT invoice for this milestone. Set when invoice is generated, cleared when invoice is voided.
- `quote_draw_entry_id` is nullable — null for manually created milestones on standalone projects.
- `generated_invoices` is the reverse relation for `project_invoice.milestone_id` — a milestone can have multiple invoices over its lifetime (one active + voided ones).
- The `@@unique([project_id, draw_number])` constraint ensures milestone numbers are unique per project.

---

### Task 3 — Add `project_invoice` model

**What:** Add the project invoice table to the Prisma schema.

**Why:** This is the foundation invoice record for customer billing. Represents a billing event issued to the project customer.

**Where:** Add this model in `schema.prisma` immediately after the `project_draw_milestone` model.

**Exact schema to add:**

```prisma
// ============================================================================
// PROJECT INVOICES — Sprint F-08
// ============================================================================

model project_invoice {
  id                     String                   @id @default(uuid()) @db.VarChar(36)
  tenant_id              String                   @db.VarChar(36)
  project_id             String                   @db.VarChar(36)
  invoice_number         String                   @db.VarChar(50)
  milestone_id           String?                  @db.VarChar(36)
  description            String                   @db.VarChar(500)
  amount                 Decimal                  @db.Decimal(12, 2)
  tax_amount             Decimal?                 @db.Decimal(10, 2)
  amount_paid            Decimal                  @default(0.00) @db.Decimal(12, 2)
  amount_due             Decimal                  @db.Decimal(12, 2)
  status                 invoice_status_extended  @default(draft)
  due_date               DateTime?                @db.Date
  sent_at                DateTime?
  paid_at                DateTime?
  voided_at              DateTime?
  voided_reason          String?                  @db.VarChar(500)
  notes                  String?                  @db.Text
  created_by_user_id     String                   @db.VarChar(36)
  updated_by_user_id     String?                  @db.VarChar(36)
  created_at             DateTime                 @default(now())
  updated_at             DateTime                 @updatedAt

  // Relations
  tenant              tenant                    @relation("project_invoice_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  project             project                   @relation("project_invoice_project", fields: [project_id], references: [id], onDelete: Cascade)
  milestone           project_draw_milestone?   @relation("invoice_source_milestone", fields: [milestone_id], references: [id], onDelete: SetNull)
  created_by          user                      @relation("project_invoice_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  updated_by          user?                     @relation("project_invoice_updated_by", fields: [updated_by_user_id], references: [id], onDelete: SetNull)

  // Reverse: milestone currently referencing this invoice via invoice_id
  referencing_milestones project_draw_milestone[] @relation("milestone_current_invoice")

  // Reverse: payments against this invoice
  payments            project_invoice_payment[]  @relation("project_invoice_payment_invoice")

  @@index([tenant_id, project_id])
  @@index([tenant_id, project_id, status])
  @@index([tenant_id, status])
  @@index([tenant_id, created_at])
  @@unique([tenant_id, invoice_number])
  @@map("project_invoice")
}
```

**Key notes:**
- `milestone_id` is the FK to the SOURCE milestone. Null for manually created invoices. Set at creation, never changed.
- `referencing_milestones` is the reverse of `project_draw_milestone.invoice_id` — at most one milestone will reference this invoice via its `invoice_id` field, but Prisma requires an array since `invoice_id` is not unique.
- `invoice_number` is unique per tenant (`@@unique([tenant_id, invoice_number])`).
- `amount_due` is computed: `amount + (tax_amount ?? 0) - amount_paid`.

---

### Task 4 — Add `project_invoice_payment` model

**What:** Add the project invoice payment table to the Prisma schema.

**Why:** Individual payment records against project invoices. Immutable once created — no update/delete.

**Where:** Add this model in `schema.prisma` immediately after the `project_invoice` model.

**Exact schema to add:**

```prisma
// ============================================================================
// PROJECT INVOICE PAYMENTS — Sprint F-08
// ============================================================================

model project_invoice_payment {
  id                          String         @id @default(uuid()) @db.VarChar(36)
  tenant_id                   String         @db.VarChar(36)
  invoice_id                  String         @db.VarChar(36)
  project_id                  String         @db.VarChar(36)
  amount                      Decimal        @db.Decimal(12, 2)
  payment_date                DateTime       @db.Date
  payment_method              payment_method
  payment_method_registry_id  String?        @db.VarChar(36)
  reference_number            String?        @db.VarChar(200)
  notes                       String?        @db.Text
  created_by_user_id          String         @db.VarChar(36)
  created_at                  DateTime       @default(now())

  // Relations
  tenant      tenant           @relation("project_invoice_payment_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  invoice     project_invoice  @relation("project_invoice_payment_invoice", fields: [invoice_id], references: [id], onDelete: Cascade)
  project     project          @relation("project_invoice_payment_project", fields: [project_id], references: [id], onDelete: Cascade)
  created_by  user             @relation("project_invoice_payment_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)

  @@index([tenant_id, invoice_id])
  @@index([tenant_id, project_id])
  @@index([tenant_id, payment_date])
  @@map("project_invoice_payment")
}
```

**Key notes:**
- `payment_method_registry_id` is a plain string field — NOT a FK relation. The `payment_method_registry` model does not exist in the current schema. This field stores an optional reference for future use.
- `project_id` is denormalized for query performance (avoids joining through invoice to get project).
- There is NO `updated_at` field — payments are immutable once created.
- `payment_method` reuses the existing `payment_method` enum (`cash`, `check`, `bank_transfer`, `venmo`, `zelle`).

---

### Task 5 — Add reverse relations to existing models

**What:** Add the required reverse relation fields to the `project`, `tenant`, `user`, and `draw_schedule_entry` models so Prisma can resolve the new FK relations.

**Why:** Every FK relation in Prisma requires a reverse relation on the target model. Without these, `prisma generate` will fail.

**CRITICAL:** Add these lines to the EXISTING models. Do NOT create new models. Do NOT remove or modify any existing lines. Just ADD the new reverse relation lines.

#### 5a — Add to the `project` model

Find the `project` model in schema.prisma. Locate the reverse relations section (after `// Reverse relations` comment, near lines 3560-3576). Add these 3 lines at the end of the reverse relations block, BEFORE the `@@index` lines:

```prisma
  draw_milestones              project_draw_milestone[]      @relation("project_draw_milestone_project")
  project_invoices             project_invoice[]             @relation("project_invoice_project")
  project_invoice_payments     project_invoice_payment[]     @relation("project_invoice_payment_project")
```

#### 5b — Add to the `tenant` model

Find the `tenant` model in schema.prisma. Locate its reverse relations section (there are many — look for other `@relation` arrays). Add these 3 lines at the end of the tenant's reverse relations, BEFORE any `@@index` or `@@map` lines:

```prisma
  project_draw_milestones      project_draw_milestone[]      @relation("project_draw_milestone_tenant")
  project_invoices             project_invoice[]             @relation("project_invoice_tenant")
  project_invoice_payments     project_invoice_payment[]     @relation("project_invoice_payment_tenant")
```

#### 5c — Add to the `user` model

Find the `user` model in schema.prisma. Locate its reverse relations section (it has MANY reverse relations — look for the last one). Add these 4 lines at the end of the user's reverse relations, BEFORE any `@@index` or `@@map` lines:

```prisma
  draw_milestones_created              project_draw_milestone[]   @relation("project_draw_milestone_created_by")
  project_invoices_created             project_invoice[]          @relation("project_invoice_created_by")
  project_invoices_updated             project_invoice[]          @relation("project_invoice_updated_by")
  project_invoice_payments_created     project_invoice_payment[]  @relation("project_invoice_payment_created_by")
```

#### 5d — Add to the `draw_schedule_entry` model

Find the `draw_schedule_entry` model in schema.prisma. Add this 1 line after the existing `quote` relation line, before the `@@index` line:

```prisma
  project_milestones  project_draw_milestone[]  @relation("project_draw_milestone_source")
```

---

### Task 6 — Run Prisma migration

**What:** Generate and apply the database migration.

**Steps:**

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name draw_milestone_invoice_foundation
```

If the migration prompts for confirmation about data loss (it shouldn't — these are all new tables), review the prompt and confirm only if it's about creating new tables/columns.

After migration succeeds:

```bash
npx prisma generate
```

This regenerates the Prisma client with the new types.

---

### Task 7 — Verify migration

**What:** Confirm all tables exist and Prisma client is correct.

**Steps:**

1. **Check migration file exists:**
   ```bash
   ls -la /var/www/lead360.app/api/prisma/migrations/ | tail -5
   ```
   You should see a new directory with the name containing `draw_milestone_invoice_foundation`.

2. **Verify tables in MySQL:**
   ```bash
   cd /var/www/lead360.app/api
   npx prisma db execute --stdin <<< "SHOW TABLES LIKE 'project_draw%'; SHOW TABLES LIKE 'project_invoice%';"
   ```
   Expected: `project_draw_milestone`, `project_invoice`, `project_invoice_payment`

3. **Verify enums (check columns):**
   ```bash
   cd /var/www/lead360.app/api
   npx prisma db execute --stdin <<< "DESCRIBE project_draw_milestone;"
   npx prisma db execute --stdin <<< "DESCRIBE project_invoice;"
   npx prisma db execute --stdin <<< "DESCRIBE project_invoice_payment;"
   ```

4. **Verify Prisma client compiles:**
   ```bash
   cd /var/www/lead360.app/api
   npx tsc --noEmit 2>&1 | head -20
   ```
   Should produce no errors related to the new models.

5. **Start the dev server and verify it compiles:**
   Follow the Dev Server instructions above. The server must start without errors.

6. **Health check:**
   ```bash
   curl -s http://localhost:8000/health
   ```
   Must return 200.

---

## Acceptance Criteria

- [ ] `milestone_status` enum added with values: `pending`, `invoiced`, `paid`
- [ ] `invoice_status_extended` enum added with values: `draft`, `sent`, `partial`, `paid`, `voided`
- [ ] Existing `invoice_status` enum is UNCHANGED
- [ ] `project_draw_milestone` table exists with all 17 fields as specified
- [ ] `project_invoice` table exists with all 21 fields as specified
- [ ] `project_invoice_payment` table exists with all 12 fields as specified
- [ ] `@@unique([project_id, draw_number])` constraint exists on `project_draw_milestone`
- [ ] `@@unique([tenant_id, invoice_number])` constraint exists on `project_invoice`
- [ ] All indexes created as specified
- [ ] Reverse relations added to `project` model (3 arrays)
- [ ] Reverse relations added to `tenant` model (3 arrays)
- [ ] Reverse relations added to `user` model (4 arrays)
- [ ] Reverse relation added to `draw_schedule_entry` model (1 array)
- [ ] Migration runs cleanly: `npx prisma migrate dev`
- [ ] Prisma client generates: `npx prisma generate`
- [ ] TypeScript compilation succeeds: `npx tsc --noEmit`
- [ ] Dev server starts and health check passes
- [ ] No existing tests broken
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — The migration MUST be clean and all 3 tables MUST exist in MySQL before Sprint 8_2 begins. Verify:
1. `npx prisma migrate status` shows no pending migrations
2. All 3 tables exist in the database
3. `npx prisma generate` succeeds
4. `npx tsc --noEmit` succeeds
5. Dev server starts cleanly

---

## Handoff Notes

The following Prisma models are now available for Sprint 8_2+:
- `prisma.project_draw_milestone` — CRUD operations
- `prisma.project_invoice` — CRUD operations
- `prisma.project_invoice_payment` — create/read operations (immutable)

The following enums are now available:
- `milestone_status` — values: `pending`, `invoiced`, `paid`
- `invoice_status_extended` — values: `draft`, `sent`, `partial`, `paid`, `voided`

The tenant model already has `next_invoice_number` (Int, default 1) and `invoice_prefix` (String, default "INV") — these will be used by the InvoiceNumberGeneratorService in Sprint 8_2.
