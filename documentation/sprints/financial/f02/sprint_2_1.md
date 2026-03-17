# Sprint 2.1 — Schema Migration: Supplier Registry Tables + Financial Entry FK

**Module:** Financial
**File:** `./documentation/sprints/financial/f02/sprint_2_1.md`
**Type:** Migration
**Depends On:** Sprint F-01 must be complete (financial module foundation must exist)
**Gate:** STOP — Migration must run cleanly. `npx prisma generate` must succeed. All 5 new models + financial_entry FK must be confirmed in the generated Prisma client before Sprint 2.2 begins.
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

Add 5 new Prisma models to the schema for the Supplier Registry feature:
1. `supplier_category` — tenant-managed dynamic categories for classifying suppliers
2. `supplier_category_assignment` — many-to-many junction between supplier and supplier_category
3. `supplier` — the core supplier entity
4. `supplier_product` — products/services offered by a supplier with unit pricing
5. `supplier_product_price_history` — immutable price change audit log

Additionally, add the `supplier_id` field to the existing `financial_entry` model and wire the FK relation to the new `supplier` table.

**No services, controllers, or DTOs are created in this sprint.** This is purely a schema migration.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` in full — locate the `financial_entry` model, the `financial_category` model, the `vendor` model (in the quotes section), and the `tenant` model
- [ ] Verify the `financial_entry` model exists and has fields: `vendor_name`, `crew_member_id`, `subcontractor_id`
- [ ] Check if `supplier_id` already exists on `financial_entry` (it may have been added by F-01). If it exists as a plain String? field with no relation, you only need to add the relation. If it does not exist, add both the field and the relation.
- [ ] Read the `vendor` model to understand the existing geo/address pattern: `latitude Decimal? @db.Decimal(10, 8)`, `longitude Decimal? @db.Decimal(11, 8)`, `google_place_id String? @db.VarChar(255)`
- [ ] Read the `tenant` model to understand how reverse relations are named (e.g., `@relation("financial_entry_tenant")`)

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

### Task 1 — Read Existing Schema Context

**What:** Read the full Prisma schema to understand naming conventions, relation patterns, and existing models.

**Files to read:**
- `/var/www/lead360.app/api/prisma/schema.prisma` — Focus on:
  - The `tenant` model — how reverse relations are named
  - The `user` model — how `created_by` relations are named
  - The `vendor` model — the geo/address/google_place_id pattern
  - The `financial_entry` model — current fields, relations, indexes
  - The `financial_category` model — see the relation to tenant pattern
  - Any existing relation naming patterns (e.g., `@relation("financial_entry_tenant")`)

**Do NOT:** Modify any files in this task. Only read.

---

### Task 2 — Add Model: `supplier_category`

**What:** Add the `supplier_category` model to `schema.prisma`.

**Exact model definition to add:**

```prisma
model supplier_category {
  id                 String    @id @default(uuid()) @db.VarChar(36)
  tenant_id          String    @db.VarChar(36)
  name               String    @db.VarChar(100)
  description        String?   @db.Text
  color              String?   @db.VarChar(7)
  is_active          Boolean   @default(true)
  created_by_user_id String    @db.VarChar(36)
  created_at         DateTime  @default(now())
  updated_at         DateTime  @updatedAt

  // Relations
  tenant      tenant @relation("supplier_category_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  created_by  user   @relation("supplier_category_creator", fields: [created_by_user_id], references: [id], onDelete: Restrict)

  // Reverse relations
  assignments supplier_category_assignment[]

  // Indexes
  @@index([tenant_id, is_active])
  @@index([tenant_id, name])
  @@unique([tenant_id, name])
  @@map("supplier_category")
}
```

**Acceptance:** Model compiles. Unique constraint on `[tenant_id, name]` is present. Relation names do not conflict with any existing relations.

**Do NOT:** Create any seed data or default categories. Supplier categories are fully user-defined.

---

### Task 3 — Add Model: `supplier_category_assignment` (Junction)

**What:** Add the many-to-many junction table between `supplier` and `supplier_category`.

**Exact model definition:**

```prisma
model supplier_category_assignment {
  id                   String   @id @default(uuid()) @db.VarChar(36)
  supplier_id          String   @db.VarChar(36)
  supplier_category_id String   @db.VarChar(36)
  tenant_id            String   @db.VarChar(36)
  created_at           DateTime @default(now())

  // Relations
  supplier          supplier          @relation(fields: [supplier_id], references: [id], onDelete: Cascade)
  supplier_category supplier_category @relation(fields: [supplier_category_id], references: [id], onDelete: Cascade)
  tenant            tenant            @relation("supplier_category_assignment_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)

  // Indexes
  @@unique([supplier_id, supplier_category_id])
  @@index([tenant_id, supplier_id])
  @@index([tenant_id, supplier_category_id])
  @@map("supplier_category_assignment")
}
```

**Acceptance:** Unique constraint prevents duplicate supplier-category assignments. Both FK cascades on delete.

---

### Task 4 — Add Model: `supplier`

**What:** Add the core supplier entity model.

**Exact model definition:**

```prisma
model supplier {
  id                 String    @id @default(uuid()) @db.VarChar(36)
  tenant_id          String    @db.VarChar(36)
  name               String    @db.VarChar(200)
  legal_name         String?   @db.VarChar(200)
  website            String?   @db.VarChar(500)
  phone              String?   @db.VarChar(20)
  email              String?   @db.VarChar(255)
  contact_name       String?   @db.VarChar(150)
  address_line1      String?   @db.VarChar(255)
  address_line2      String?   @db.VarChar(255)
  city               String?   @db.VarChar(100)
  state              String?   @db.VarChar(2)
  zip_code           String?   @db.VarChar(10)
  country            String    @db.VarChar(2) @default("US")
  latitude           Decimal?  @db.Decimal(10, 8)
  longitude          Decimal?  @db.Decimal(11, 8)
  google_place_id    String?   @db.VarChar(255)
  notes              String?   @db.Text
  is_preferred       Boolean   @default(false)
  is_active          Boolean   @default(true)
  total_spend        Decimal   @default(0.00) @db.Decimal(14, 2)
  last_purchase_date DateTime? @db.Date
  created_by_user_id String    @db.VarChar(36)
  updated_by_user_id String?   @db.VarChar(36)
  created_at         DateTime  @default(now())
  updated_at         DateTime  @updatedAt

  // Relations
  tenant     tenant @relation("supplier_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  created_by user   @relation("supplier_creator", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  updated_by user?  @relation("supplier_updater", fields: [updated_by_user_id], references: [id], onDelete: SetNull)

  // Reverse relations
  category_assignments         supplier_category_assignment[]
  products                     supplier_product[]
  product_price_history        supplier_product_price_history[]
  financial_entries            financial_entry[] @relation("financial_entry_supplier")

  // Indexes
  @@index([tenant_id, is_active])
  @@index([tenant_id, is_preferred])
  @@index([tenant_id, name])
  @@index([tenant_id, last_purchase_date])
  @@index([tenant_id, created_at])
  @@map("supplier")
}
```

**Important notes on the supplier model:**
- `total_spend` and `last_purchase_date` are denormalized cache fields — updated by the service layer when financial_entry records are created/deleted
- Address fields are ALL optional — a supplier can be created with just a `name`
- `latitude`/`longitude` use the same Decimal precision as the existing `vendor` model
- `google_place_id` matches the vendor model pattern exactly
- The reverse relation `financial_entries` links to `financial_entry` via a named relation `"financial_entry_supplier"`

**Acceptance:** Model compiles. All fields match the types specified above exactly.

---

### Task 5 — Add Model: `supplier_product`

**What:** Add the supplier product/service catalog model.

**Exact model definition:**

```prisma
model supplier_product {
  id                            String    @id @default(uuid()) @db.VarChar(36)
  tenant_id                     String    @db.VarChar(36)
  supplier_id                   String    @db.VarChar(36)
  name                          String    @db.VarChar(200)
  description                   String?   @db.Text
  unit_of_measure               String    @db.VarChar(50)
  unit_price                    Decimal?  @db.Decimal(12, 4)
  price_last_updated_at         DateTime? @db.Date
  price_last_updated_by_user_id String?   @db.VarChar(36)
  sku                           String?   @db.VarChar(100)
  is_active                     Boolean   @default(true)
  created_by_user_id            String    @db.VarChar(36)
  created_at                    DateTime  @default(now())
  updated_at                    DateTime  @updatedAt

  // Relations
  tenant                   tenant    @relation("supplier_product_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  supplier                 supplier  @relation(fields: [supplier_id], references: [id], onDelete: Cascade)
  created_by               user      @relation("supplier_product_creator", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  price_last_updated_by    user?     @relation("supplier_product_price_updater", fields: [price_last_updated_by_user_id], references: [id], onDelete: SetNull)

  // Reverse relations
  price_history supplier_product_price_history[]

  // Indexes
  @@index([tenant_id, supplier_id])
  @@index([tenant_id, supplier_id, is_active])
  @@index([supplier_id, name])
  @@map("supplier_product")
}
```

**Acceptance:** Model compiles. Relation to supplier cascades on delete.

---

### Task 6 — Add Model: `supplier_product_price_history`

**What:** Add the immutable price change audit log model.

**Exact model definition:**

```prisma
model supplier_product_price_history {
  id                   String   @id @default(uuid()) @db.VarChar(36)
  tenant_id            String   @db.VarChar(36)
  supplier_product_id  String   @db.VarChar(36)
  supplier_id          String   @db.VarChar(36)
  previous_price       Decimal? @db.Decimal(12, 4)
  new_price            Decimal  @db.Decimal(12, 4)
  changed_by_user_id   String   @db.VarChar(36)
  changed_at           DateTime @default(now())
  notes                String?  @db.VarChar(500)

  // Relations
  tenant            tenant            @relation("supplier_price_history_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  supplier_product  supplier_product  @relation(fields: [supplier_product_id], references: [id], onDelete: Cascade)
  supplier          supplier          @relation(fields: [supplier_id], references: [id], onDelete: Cascade)
  changed_by        user              @relation("supplier_price_history_changer", fields: [changed_by_user_id], references: [id], onDelete: Restrict)

  // Indexes
  @@index([tenant_id, supplier_product_id])
  @@index([tenant_id, supplier_id])
  @@index([supplier_product_id, changed_at])
  @@map("supplier_product_price_history")
}
```

**Acceptance:** Model compiles. Records are immutable — no `updated_at` field (this is intentional).

---

### Task 7 — Add `supplier_id` FK to `financial_entry`

**What:** Add the `supplier_id` field and Prisma relation to the existing `financial_entry` model.

**Step 1:** Check if `supplier_id` already exists on the `financial_entry` model in schema.prisma.

**If `supplier_id` does NOT exist (most likely case):**
Add these two lines to the `financial_entry` model:

In the field section (add after `subcontractor_id`):
```prisma
  supplier_id        String?             @db.VarChar(36)
```

In the relations section (add after the `subcontractor` relation):
```prisma
  supplier   supplier? @relation("financial_entry_supplier", fields: [supplier_id], references: [id], onDelete: SetNull)
```

Add a new index (add in the indexes section):
```prisma
  @@index([tenant_id, supplier_id])
```

**If `supplier_id` already exists as a plain String? field (from F-01):**
Only add the relation line and the index. Do NOT duplicate the field.

**Acceptance:** The `financial_entry` model has `supplier_id String? @db.VarChar(36)` and a `supplier` relation pointing to the `supplier` table. The `onDelete: SetNull` ensures that deleting a supplier sets the FK to null on related financial entries instead of cascading.

---

### Task 8 — Add Reverse Relations to `tenant` and `user` Models

**What:** Add the reverse relation fields required by the new models to the `tenant` and `user` models in schema.prisma.

**On the `tenant` model, add these reverse relations** (add near the other reverse relation fields):
```prisma
  supplier_categories            supplier_category[]              @relation("supplier_category_tenant")
  supplier_category_assignments  supplier_category_assignment[]   @relation("supplier_category_assignment_tenant")
  suppliers                      supplier[]                       @relation("supplier_tenant")
  supplier_products              supplier_product[]               @relation("supplier_product_tenant")
  supplier_price_history         supplier_product_price_history[] @relation("supplier_price_history_tenant")
```

**On the `user` model, add these reverse relations** (add near the other reverse relation fields):
```prisma
  created_supplier_categories      supplier_category[]              @relation("supplier_category_creator")
  created_suppliers                supplier[]                       @relation("supplier_creator")
  updated_suppliers                supplier[]                       @relation("supplier_updater")
  created_supplier_products        supplier_product[]               @relation("supplier_product_creator")
  supplier_product_price_updates   supplier_product[]               @relation("supplier_product_price_updater")
  supplier_price_history_changes   supplier_product_price_history[] @relation("supplier_price_history_changer")
```

**CRITICAL:** Also check if the `financial_entry` model already has a reverse relation on `supplier`. If you added the relation in Task 7, the reverse is `financial_entries` on the `supplier` model (already included in Task 4). No additional reverse relation is needed on `financial_entry` since the forward relation is there.

**Do NOT:** Modify any other relations on `tenant` or `user`. Only add the new reverse relation fields.

**Acceptance:** `npx prisma validate` passes. All relation names are unique and do not conflict with existing relations.

---

### Task 9 — Run Migration

**What:** Generate and apply the Prisma migration.

**Steps:**
```bash
cd /var/www/lead360.app/api
npx prisma validate
npx prisma migrate dev --name supplier_registry
npx prisma generate
```

**If `npx prisma validate` fails:**
- Read the error message carefully
- Fix the schema issue (usually a missing reverse relation or duplicate relation name)
- Re-run validate until it passes
- Then run migrate

**If migration fails due to existing data:**
- This migration adds new tables and an optional FK field — it should not conflict with existing data
- If there is a conflict, read the error and resolve it before proceeding

**Acceptance:**
- `npx prisma validate` passes with no errors
- `npx prisma migrate dev --name supplier_registry` creates a new migration file at `api/prisma/migrations/[timestamp]_supplier_registry/migration.sql`
- `npx prisma generate` completes successfully
- The generated Prisma client includes all 5 new models: `supplier_category`, `supplier_category_assignment`, `supplier`, `supplier_product`, `supplier_product_price_history`

---

### Task 10 — Verify Migration

**What:** Start the dev server and verify the migration applied correctly.

**Steps:**
1. Start the dev server (see Dev Server section above)
2. Wait for health check to pass
3. Verify tables exist in the database:

```bash
cd /var/www/lead360.app/api
npx prisma db pull --print | grep -E "supplier_category|supplier_product|supplier_product_price_history|supplier_category_assignment|supplier"
```

Or use a direct MySQL query to check:
```bash
# Use credentials from .env file
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -e "SHOW TABLES LIKE 'supplier%';"
```

**Expected output:** 5 tables:
- `supplier`
- `supplier_category`
- `supplier_category_assignment`
- `supplier_product`
- `supplier_product_price_history`

4. Verify the `financial_entry` table has the `supplier_id` column:
```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -e "DESCRIBE financial_entry;" | grep supplier_id
```

5. Stop the dev server (see Dev Server section).

**Acceptance:** All 5 tables exist. `financial_entry.supplier_id` column exists as a nullable VARCHAR(36).

---

## Business Rules Enforced in This Sprint

- BR-01: `supplier_category.name` is unique per tenant — enforced by `@@unique([tenant_id, name])`
- BR-02: `supplier_category_assignment` prevents duplicate supplier-category pairs — enforced by `@@unique([supplier_id, supplier_category_id])`
- BR-03: `financial_entry.supplier_id` FK uses `onDelete: SetNull` — deleting a supplier nullifies the reference, not the entry
- BR-04: `supplier_product_price_history` has no `updated_at` — records are immutable by design

---

## Acceptance Criteria

- [ ] `supplier_category` table exists with all specified fields and indexes
- [ ] `supplier_category_assignment` junction table exists with unique constraint on `[supplier_id, supplier_category_id]`
- [ ] `supplier` table exists with all 24 fields as specified
- [ ] `supplier_product` table exists with all 14 fields as specified
- [ ] `supplier_product_price_history` table exists with all 9 fields as specified
- [ ] `financial_entry.supplier_id` field exists and FK relation to `supplier` is wired
- [ ] `npx prisma validate` passes
- [ ] `npx prisma generate` succeeds
- [ ] Migration SQL file exists at `api/prisma/migrations/[timestamp]_supplier_registry/migration.sql`
- [ ] Dev server starts without errors
- [ ] No existing tests are broken by this migration
- [ ] No existing models or relations are modified (only additions)
- [ ] Dev server is shut down before marking sprint complete

---

## Gate Marker

**STOP** — Migration must run cleanly. `npx prisma generate` must succeed. All 5 new tables must be confirmed in the database. The `financial_entry.supplier_id` column must exist. The dev server must start without errors. **Do not begin Sprint 2.2 until this gate passes.**

---

## Handoff Notes

**For Sprint 2.2 (DTOs):**
- All 5 Prisma models are now available in the generated client
- The model names for Prisma client access are: `prisma.supplier_category`, `prisma.supplier_category_assignment`, `prisma.supplier`, `prisma.supplier_product`, `prisma.supplier_product_price_history`
- `financial_entry` now has `supplier_id` field — but no service logic is wired yet (that comes in Sprint 2.7)
- The `supplier` model has `total_spend` and `last_purchase_date` as denormalized cache fields — these are managed by service logic, not by direct client updates
