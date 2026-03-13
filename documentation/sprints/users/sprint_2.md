# Sprint 2 — Schema Migration: user_tenant_membership + Email Unique + Backfill
**Module:** users
**File:** ./documentation/sprints/users/sprint_2.md
**Type:** Backend — Migration
**Depends On:** Sprint 1 (complete and verified)
**Gate:** STOP — Migration must be applied, Prisma client regenerated, backfill verified, and dev server confirmed running before Sprint 3 starts.
**Estimated Complexity:** High

---

## Objective

Create the `user_tenant_membership` table that is the foundation of the entire Users module. Also add a globally-unique constraint to `user.email` (removing the current composite unique), and mark the `user_role` table as deprecated. A backfill SQL script is included in the migration to seed `user_tenant_membership` from existing `user_role` data. The `user.tenant_id` column is NOT removed in this sprint — that happens in Sprint 4, after the auth service is updated to use the new membership table.

Do NOT modify any service, controller, or guard in this sprint. This sprint is schema-only + backfill.

---

## Pre-Sprint Checklist
- [ ] Sprint 1 gate verified (JWT contains `jti`, blocklist check works)
- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` (full file)
- [ ] Confirm database is accessible: `mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -e "SHOW TABLES;"` returns table list
- [ ] Confirm Redis is running: `redis-cli ping` returns `PONG`
- [ ] Check `user` model current unique constraint: it currently has `@@unique([email, tenant_id])` (composite) and NO standalone `@unique` on email. This composite must be removed and replaced with standalone `@unique`.

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

### Task 1 — Add MembershipStatus Enum to Prisma Schema

**What:** Open `/var/www/lead360.app/api/prisma/schema.prisma`. Add the following enum. Place it near the other enums at the bottom of the file (alongside `audit_log_actor_type`, `audit_log_status`, etc.):

```prisma
enum MembershipStatus {
  INVITED
  ACTIVE
  INACTIVE
}
```

**Do NOT** modify any existing enum.

---

### Task 2 — Create user_tenant_membership Model in Schema

**What:** Add the following model to `schema.prisma`. Place it directly after the `user_role` model block:

```prisma
/// @deprecated user_role is superseded by user_tenant_membership.
/// Do NOT write new FK references to user_role. It is retained for historical data only.
model user_role {
  // ... (existing fields — do NOT change, just add the @deprecated comment above)
}

// ─── NEW TABLE ────────────────────────────────────────────────────────────────

model user_tenant_membership {
  id                      String           @id @default(uuid()) @db.VarChar(36)
  user_id                 String           @db.VarChar(36)
  tenant_id               String           @db.VarChar(36)
  role_id                 String           @db.VarChar(36)
  status                  MembershipStatus @default(INVITED)
  invite_token_hash       String?          @unique @db.VarChar(255)
  invite_token_expires_at DateTime?
  invite_accepted_at      DateTime?
  invited_by_user_id      String?          @db.VarChar(36)
  joined_at               DateTime?
  left_at                 DateTime?
  created_at              DateTime         @default(now())
  updated_at              DateTime         @updatedAt

  user       user   @relation("user_memberships", fields: [user_id], references: [id], onDelete: Cascade)
  tenant     tenant @relation("tenant_memberships", fields: [tenant_id], references: [id], onDelete: Cascade)
  role       role   @relation("role_memberships", fields: [role_id], references: [id])
  invited_by user?  @relation("membership_inviter", fields: [invited_by_user_id], references: [id])

  @@index([user_id, status])
  @@index([tenant_id, status])
  @@index([tenant_id, role_id])
  @@map("user_tenant_membership")
}
```

**Important — also add the reverse relations** to the referenced models:

In the `user` model, add these two relation fields (inside the `model user { }` block):
```prisma
  memberships              user_tenant_membership[] @relation("user_memberships")
  sent_invitations         user_tenant_membership[] @relation("membership_inviter")
```

In the `tenant` model, add:
```prisma
  memberships              user_tenant_membership[] @relation("tenant_memberships")
```

In the `role` model, add:
```prisma
  memberships              user_tenant_membership[] @relation("role_memberships")
```

**Why:** The contract specifies this exact table structure. All FK relations must be declared in both directions for Prisma to generate correct client types.

**Do NOT** remove or modify any other field in the `user`, `tenant`, or `role` models at this stage.

---

### Task 3 — Replace user.email Composite Unique with Global Unique

**What:** In the `user` model block, make these two changes:

**Remove** the existing composite unique constraint:
```prisma
// DELETE this line:
@@unique([email, tenant_id])
```

**Change** the `email` field declaration from:
```prisma
  email   String   @db.VarChar(255)
```
to:
```prisma
  email   String   @unique @db.VarChar(255)
```

**Why:** Business rule BR-01 — `user.email` is globally unique across the entire platform. One `user` record per email, forever. The current composite `@@unique([email, tenant_id])` allows the same email in multiple tenants, which violates BR-01.

**Risk:** If existing data has duplicate emails across tenants, the migration will fail. Before running the migration, check:
```sql
SELECT email, COUNT(*) as cnt FROM `user` GROUP BY email HAVING cnt > 1;
```
If duplicates exist, resolve them before proceeding (keep the oldest record, update the FK reference in user_role).

**Do NOT** touch any other field constraint on the `user` model.

---

### Task 4 — Run Prisma Migration

**What:** Run the migration. From `api/` directory:

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_user_tenant_membership
npx prisma generate
```

If the migration fails due to duplicate emails (from Task 3 risk above), resolve the data conflict first (see Task 3 risk note), then re-run.

**Verify migration applied:**
```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -e "DESCRIBE user_tenant_membership;"
```
This must return the table columns.

```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -e "SHOW INDEX FROM user WHERE Key_name LIKE 'user_email%';"
```
Must show a UNIQUE index on `email`.

**Expected output:** Migration file created in `prisma/migrations/`, Prisma client regenerated.

---

### Task 5 — Backfill user_tenant_membership from user_role

**What:** Run the following SQL to seed `user_tenant_membership` from existing `user_role` records. This is idempotent — it skips records that already exist:

```sql
-- Run from mysql shell or via: mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360
INSERT INTO user_tenant_membership (
  id,
  user_id,
  tenant_id,
  role_id,
  status,
  joined_at,
  created_at,
  updated_at
)
SELECT
  UUID(),
  ur.user_id,
  ur.tenant_id,
  ur.role_id,
  'ACTIVE',
  ur.assigned_at,
  NOW(),
  NOW()
FROM user_role ur
WHERE NOT EXISTS (
  SELECT 1
  FROM user_tenant_membership utm
  WHERE utm.user_id = ur.user_id
    AND utm.tenant_id = ur.tenant_id
);
```

Run via:
```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -e "
INSERT INTO user_tenant_membership (id, user_id, tenant_id, role_id, status, joined_at, created_at, updated_at)
SELECT UUID(), ur.user_id, ur.tenant_id, ur.role_id, 'ACTIVE', ur.assigned_at, NOW(), NOW()
FROM user_role ur
WHERE NOT EXISTS (
  SELECT 1 FROM user_tenant_membership utm
  WHERE utm.user_id = ur.user_id AND utm.tenant_id = ur.tenant_id
);
"
```

**Verify backfill:**
```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -e "
SELECT
  (SELECT COUNT(*) FROM user_role) AS user_role_count,
  (SELECT COUNT(*) FROM user_tenant_membership) AS membership_count;
"
```
`membership_count` must be ≥ `user_role_count`. A difference is expected if there were duplicate `(user_id, tenant_id)` pairs in `user_role` — one membership per pair is correct.

**Why:** The contract states: "Migrated: data backfilled into user_tenant_membership where applicable". All current user-role-tenant relationships must be reflected in the new table before the old system is deprecated.

---

### Task 6 — Start Dev Server and Verify Schema Compiles

**What:** Start the dev server and verify it starts without TypeScript or Prisma errors:

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Watch the output for any errors related to:
- Unknown fields in Prisma models
- Relation mismatch errors
- Missing relation decorators

If there are Prisma relation errors, fix them in schema.prisma and re-run `npx prisma generate`.

**Verify:**
```bash
curl -s http://localhost:8000/health
```
Must return 200 before this sprint is marked complete.

---

## Patterns to Apply

### Prisma Schema Standard
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

### Enum in Prisma
```prisma
enum MyEnum {
  VALUE_ONE
  VALUE_TWO
  VALUE_THREE
}
// Use as field type: status  MyEnum  @default(VALUE_ONE)
```

---

## Business Rules Enforced in This Sprint
- **BR-01:** `user.email` is globally unique — enforced by adding `@unique` to `user.email` and removing the composite `@@unique([email, tenant_id])`
- **BR-12 (schema prerequisite):** The `user_tenant_membership` table structure supports linking an existing `user` record to a new membership without creating a new `user` record
- **BR-05 (schema prerequisite):** `invite_token_hash` and `invite_token_expires_at` fields are present for invite token management
- **BR-04 (schema prerequisite):** `status`, `joined_at`, `left_at` fields support deactivation tracking

---

## Integration Points
| What | Notes |
|---|---|
| Prisma schema | `/var/www/lead360.app/api/prisma/schema.prisma` — the only file modified in this sprint |
| Database | MySQL at `mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360` |
| Prisma client | Regenerated via `npx prisma generate` — all other modules get updated types automatically |

---

## Acceptance Criteria
- [ ] `DESCRIBE user_tenant_membership;` returns all columns including `id`, `user_id`, `tenant_id`, `role_id`, `status`, `invite_token_hash`, `invite_token_expires_at`, `invite_accepted_at`, `invited_by_user_id`, `joined_at`, `left_at`, `created_at`, `updated_at`
- [ ] `SHOW INDEX FROM user_tenant_membership;` shows indexes on `(user_id, status)`, `(tenant_id, status)`, `(tenant_id, role_id)`, and UNIQUE on `invite_token_hash`
- [ ] `SHOW INDEX FROM user WHERE Key_name LIKE '%email%';` shows a UNIQUE index on `email` (not composite)
- [ ] No `@@unique([email, tenant_id])` exists in schema.prisma
- [ ] `user_tenant_membership` row count ≥ `user_role` row count (backfill verified)
- [ ] Dev server starts cleanly (`/health` returns 200)
- [ ] Login still works: `POST /api/v1/auth/login` returns 200 with JWT
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 3 until:
1. `user_tenant_membership` table exists in DB with all columns verified
2. Email unique constraint verified on `user.email`
3. Backfill verified (membership count ≥ user_role count)
4. Dev server compiles and health check passes
5. Login endpoint still returns 200

---

## Handoff Notes
- The `user.tenant_id` column is still present after this sprint. It is removed in Sprint 4.
- The `user_role` table is still present and functional. It is marked deprecated via Prisma comment only.
- `user_tenant_membership.status` is a Prisma enum `MembershipStatus` with values: `INVITED`, `ACTIVE`, `INACTIVE`
- The `invite_token_hash` field stores a SHA-256 hash of the raw invite token (not the raw token itself). SHA-256 is used instead of bcrypt because it enables O(1) direct lookup via the `@unique` index — bcrypt would require a full table scan.
- Sprint 3 (auth service) will query `user_tenant_membership` WHERE `user_id = ? AND status = 'ACTIVE'`
- Sprint 6 (users service) will create `user_tenant_membership` rows for new invites and activations
- All backfilled memberships have `status = 'ACTIVE'`, `joined_at = user_role.assigned_at`
