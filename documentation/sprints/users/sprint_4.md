# Sprint 4 — Schema Migration B: Remove user.tenant_id + Update Prisma Middleware
**Module:** users
**File:** ./documentation/sprints/users/sprint_4.md
**Type:** Backend — Migration
**Depends On:** Sprint 3 (auth service no longer reads user.tenant_id for login)
**Gate:** STOP — user.tenant_id column must be removed from DB and schema; Prisma middleware must exempt user model; login must still return 200 with correct JWT. Verify before Sprint 5.
**Estimated Complexity:** Medium

---

## Objective

Remove `tenant_id` from the `user` model and database table. This column is no longer needed because: (a) auth login resolves tenant from `user_tenant_membership`, (b) all other business data tables carry their own `tenant_id`. After this sprint, the `user` table becomes a global identity table with no tenant relationship.

Also update the Prisma tenant isolation middleware to exempt `user` from the `tenant_id` enforcement check, since `user` is now a global table.

This sprint only modifies: `schema.prisma` and `src/core/database/prisma.service.ts`. No service or controller changes.

---

## Pre-Sprint Checklist
- [ ] Sprint 3 gate verified (login uses membership, JWT has membershipId)
- [ ] Read the full `src/core/database/prisma.service.ts` — understand the tenant enforcement middleware and the list of scoped/exempt models
- [ ] Read `schema.prisma` user model — confirm `tenant_id` and `tenant` relation still present
- [ ] Verify no other module reads `user.tenant_id` directly (search codebase for `user.tenant_id` and `user?.tenant_id`)
- [ ] Confirm auth service login no longer references `user.tenant_id` (Sprint 3 completed this)
- [ ] Backup check: `mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -e "SELECT COUNT(*) FROM user WHERE tenant_id IS NOT NULL;"`

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

### Task 1 — Search for Any Remaining Reads of user.tenant_id

**What:** Before changing the schema, verify no service still reads `user.tenant_id`:

```bash
grep -rn "user\.tenant_id\|user?\.tenant_id\|\.tenant_id" \
  /var/www/lead360.app/api/src/modules/auth/ \
  /var/www/lead360.app/api/src/modules/tenant/ \
  /var/www/lead360.app/api/src/modules/admin/ \
  --include="*.ts" | grep -v "// \|spec\."
```

**Expected:** The only remaining references should be in files that write `tenant_id` to the user record during registration (which will fail after this migration — find and fix those).

**If auth.service.ts register() still writes `tenant_id` to the user:**
```typescript
// REMOVE this from the user create call:
tenant_id: tenant.id,  // DELETE

// REMOVE this from the user model include (if it was included):
tenant: true,  // DELETE
```

**Do NOT** change any reference to `tenant_id` in tables OTHER than `user`. All other tables (leads, quotes, projects, etc.) retain their own `tenant_id` fields — those are untouched.

---

### Task 2 — Remove tenant_id from user Model in schema.prisma

**What:** Open `schema.prisma`. In the `user` model block, remove the following three lines:

```prisma
// REMOVE these three lines from the user model:
  tenant_id   String?  @db.VarChar(36)
  tenant      tenant?  @relation(fields: [tenant_id], references: [id])
```

Also remove the index on tenant_id if it exists in the user model:
```prisma
// REMOVE if present:
  @@index([tenant_id, is_active])
```

Replace the removed tenant_id index with a standalone is_active index if it doesn't already exist:
```prisma
  @@index([is_active])
```

**In the `tenant` model**, find the reverse relation that points to `user`:
```prisma
// REMOVE from tenant model:
  user   user[]
```
(This is the `user[]` relation field pointing to users that belong to this tenant.)

**Expected output:** `user` model has no `tenant_id` field, no `tenant` relation, no tenant index. `tenant` model has no `user[]` relation to `user`.

**Do NOT** touch any other models.

---

### Task 3 — Run the Migration

**What:**
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name remove_user_tenant_id
npx prisma generate
```

If the migration fails because of existing FK constraints (MySQL may block column removal if a FK exists), the migration will include `DROP FOREIGN KEY` before `DROP COLUMN`. Prisma handles this automatically.

**Verify column is removed:**
```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 \
  -e "DESCRIBE user;" | grep tenant_id
```
Must return nothing (no tenant_id column in user table).

**Verify login still works after migration:**
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq .access_token
```
Must return a non-null JWT string.

---

### Task 4 — Update Prisma Middleware in prisma.service.ts

**What:** Open `src/core/database/prisma.service.ts`. Find the tenant isolation middleware.

The middleware maintains a list of models that require `tenant_id` enforcement (or alternatively, a list of models that are EXEMPT from enforcement). The `user` model must be added to the EXEMPT list (or removed from the SCOPED list).

**Find the model list in the middleware.** It will look something like one of these patterns:

**Pattern A — Exempt list (models that skip tenant enforcement):**
```typescript
const EXEMPT_MODELS = ['tenant', 'SubscriptionPlan', 'LicenseType', ...];
// ADD 'user' to this list:
const EXEMPT_MODELS = ['tenant', 'SubscriptionPlan', 'LicenseType', 'user', ...];
```

**Pattern B — Scoped list (models that require tenant_id):**
```typescript
const TENANT_SCOPED_MODELS = ['lead', 'quote', 'project', ..., 'user', ...];
// REMOVE 'user' from this list
```

Whichever pattern exists in the file, make the appropriate change so that the middleware no longer enforces `tenant_id` on the `user` model.

**Why:** After removing `tenant_id` from `user`, any Prisma mutation to `user` would fail the middleware's tenant_id check (since the field no longer exists). The `user` table is now a global identity table — not tenant-scoped.

**Expected output:** Updated `prisma.service.ts` where `user` is excluded from tenant enforcement.

**Do NOT** change the enforcement logic for any other model. All other 70+ tenant-scoped models remain unchanged.

---

### Task 5 — Update JwtStrategy User Lookup

**What:** In `src/modules/auth/strategies/jwt.strategy.ts`, find the `prisma.user.findFirst()` call that checks if the user is active. It currently may include `tenant_id`-related fields or conditions. After this migration, the query becomes simpler:

Confirm the query does NOT reference `tenant_id`:
```typescript
const user = await this.prisma.user.findFirst({
  where: {
    id: payload.sub,
    is_active: true,
    deleted_at: null,
    // No tenant_id here — user is now global
  },
});
```

If the existing query includes `tenant_id` in the where clause, remove it.

**Do NOT** change anything else in jwt.strategy.ts.

---

### Task 6 — Verify Full Auth Flow Works

**What:** With the dev server running after migration:

```bash
# Login test
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq .

# Auth/me test (get your own profile)
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r .access_token)

curl -s http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Both must return 200. The `/auth/me` response must not error on missing `tenant_id`.

---

## Patterns to Apply

### Prisma Migration Workflow
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name remove_user_tenant_id
npx prisma generate
```

### Prisma Middleware Exempt Pattern (reference)
The middleware in prisma.service.ts uses a list to determine which models need tenant_id enforcement. The model name in this list matches the Prisma model name (PascalCase or camelCase depending on implementation). The `user` model is referenced as either `'user'` or `'User'` — check the existing list format to match the casing exactly.

---

## Business Rules Enforced in This Sprint
- **BR-11 (schema prerequisite):** User history is isolated per tenant by virtue of each data table carrying its own `tenant_id`. Removing `tenant_id` from `user` ensures there is no accidental cross-tenant user identification.
- **BR-01:** `user.email` global uniqueness is now cleanly enforced — the user table is a true global identity table.

---

## Integration Points
| What | Notes |
|---|---|
| schema.prisma | Remove `tenant_id` from `user` model, remove `user[]` from `tenant` model |
| prisma.service.ts | Update middleware exempt list to include `user` |
| jwt.strategy.ts | Remove any `tenant_id` from the user lookup query |
| MySQL DB | Migration drops the `tenant_id` column from `user` table |

---

## Acceptance Criteria
- [ ] `DESCRIBE user;` shows NO `tenant_id` column
- [ ] `npx prisma generate` succeeds with no errors
- [ ] Dev server starts and compiles with no TypeScript errors
- [ ] `POST /api/v1/auth/login` returns 200 with valid JWT (membershipId present)
- [ ] `GET /api/v1/auth/me` returns 200
- [ ] No TypeScript error about `tenant_id` on the `user` Prisma type
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 5 until:
1. `DESCRIBE user` shows no `tenant_id` column
2. Login returns 200 with JWT containing `membershipId`
3. Dev server compiles with zero TypeScript errors

---

## Handoff Notes
- After this sprint, `user` is a global identity table: fields are `id`, `email`, `password_hash`, `first_name`, `last_name`, `phone`, `is_active`, `is_platform_admin`, `email_verified`, `email_verified_at`, activation token fields, password reset token fields, `last_login_at`, MFA fields, OAuth fields, `created_at`, `updated_at`, `deleted_at`
- Tenant context is now ALWAYS derived from `user_tenant_membership`, never from `user` directly
- All Sprint 5+ work (Users Service, Controller) queries `user_tenant_membership` for tenant context — never `user.tenant_id`
- The `tenant` model no longer has a direct `user[]` relation — tenant-user links go through `user_tenant_membership`
