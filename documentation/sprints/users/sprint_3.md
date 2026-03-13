# Sprint 3 — Auth Service Update: Login + Register from user_tenant_membership
**Module:** users
**File:** ./documentation/sprints/users/sprint_3.md
**Type:** Backend — Service Update
**Depends On:** Sprint 1 (jti infrastructure), Sprint 2 (user_tenant_membership table exists)
**Gate:** STOP — Login must resolve tenant from user_tenant_membership (not user.tenant_id); JWT must carry membershipId; register must create a membership record; existing login/register still return 200. Verify before Sprint 4.
**Estimated Complexity:** High

---

## Objective

Update the auth service login flow to resolve tenant context from `user_tenant_membership` instead of reading `user.tenant_id` directly. Update registration to create a `user_tenant_membership` record with `ACTIVE` status for the new owner. Add `membershipId` to the JWT payload. After this sprint, the JWT payload will match the shape required by the contract, and the system no longer depends on `user.tenant_id` for auth resolution — making it safe to remove that column in Sprint 4.

This sprint modifies three files: `auth.service.ts`, `jwt-payload.entity.ts`, and `jwt.strategy.ts`. No new files are created.

---

## Pre-Sprint Checklist
- [ ] Sprint 1 gate verified (jti in JWT, blocklist works)
- [ ] Sprint 2 gate verified (user_tenant_membership table exists, backfill done)
- [ ] Read the full `auth.service.ts` (all ~1037 lines)
- [ ] Read `jwt-payload.entity.ts` — know the current fields: `sub`, `email`, `tenant_id`, `roles`, `is_platform_admin`
- [ ] Read `jwt.strategy.ts` — know the current `validate()` return shape
- [ ] Run and confirm current login works: `POST http://localhost:8000/api/v1/auth/login` returns 200
- [ ] Find the login method in auth.service.ts (where user is queried by email and password is checked)
- [ ] Find `generateTokens()` private method — know its current signature and payload

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

### Task 1 — Update JwtPayload Entity

**What:** Open `src/modules/auth/entities/jwt-payload.entity.ts`.

Update the `JwtPayload` interface to match the new shape:

```typescript
export interface JwtPayload {
  sub: string;           // user.id
  email: string;
  tenant_id: string | null; // still present during transition (Sprint 4 removes it from user)
  membershipId: string;  // user_tenant_membership.id — NEW
  roles: string[];
  is_platform_admin: boolean;
  jti: string;           // UUID — required from Sprint 1
}
```

Update the `AuthenticatedUser` interface (if present in the same file or in a separate entity file) to include:
```typescript
export interface AuthenticatedUser {
  id: string;
  email: string;
  tenant_id: string | null;
  membershipId: string;  // NEW
  roles: string[];
  is_platform_admin: boolean;
  jti?: string;
}
```

**Do NOT** make `membershipId` optional in `JwtPayload` — it is required after this sprint.

---

### Task 2 — Update generateTokens() Signature and Payload

**What:** In `auth.service.ts`, find the private `generateTokens()` method. Currently it accepts:
```typescript
private async generateTokens(
  user: { id: string; email: string; tenant_id: string | null; is_platform_admin: boolean },
  roles: string[],
  rememberMe: boolean,
)
```

Update the signature to also accept `membershipId` and `tenantId` as explicit parameters (so the login method can pass the resolved values):
```typescript
private async generateTokens(
  user: { id: string; email: string; is_platform_admin: boolean },
  roles: string[],
  rememberMe: boolean,
  membershipId: string,
  tenantId: string,
)
```

Update the payload construction inside `generateTokens()`:
```typescript
const jti = randomUUID();
const payload: JwtPayload = {
  sub: user.id,
  email: user.email,
  tenant_id: tenantId,        // now passed explicitly from membership
  membershipId: membershipId, // NEW — from active membership
  roles,
  is_platform_admin: user.is_platform_admin,
  jti,
};
```

The `trackToken` call remains the same:
```typescript
const expTimestamp = Math.floor(Date.now() / 1000) + 86400;
await this.tokenBlocklist.trackToken(user.id, jti, expTimestamp);
```

**Expected output:** Updated `generateTokens()` signature.

**Do NOT** update the callers of `generateTokens()` in this task — that is done in Task 3 and Task 4.

---

### Task 3 — Update Login Flow to Resolve Tenant from Membership

**What:** In `auth.service.ts`, find the `login()` method (or equivalent — the method that handles `POST /auth/login`). It currently:
1. Queries user by email
2. Validates password with bcrypt
3. Reads `user.tenant_id` directly
4. Calls `generateTokens(user, roles, rememberMe)`

Update the login method to:

**Step 1** — After password validation, query the active membership:
```typescript
// After password is verified:
const membership = await this.prisma.user_tenant_membership.findFirst({
  where: {
    user_id: user.id,
    status: 'ACTIVE',
  },
  include: {
    role: true, // to get role.name
  },
});

if (!membership) {
  throw new ForbiddenException('No active tenant membership found for this user.');
}
```

**Step 2** — Extract role name from the membership's role relation:
```typescript
const roles = [membership.role.name];
```

**Note:** The existing login code reads roles from `user_role`. Replace that with the single role from the active membership. If the existing code queries `user_role` for roles, remove that query and replace with the membership role.

**Step 3** — Update the `generateTokens()` call to pass membership data:
```typescript
const { accessToken, refreshToken, expiresIn } = await this.generateTokens(
  { id: user.id, email: user.email, is_platform_admin: user.is_platform_admin },
  roles,
  rememberMe,
  membership.id,      // membershipId — NEW
  membership.tenant_id, // tenantId from membership — replaces user.tenant_id
);
```

**Imports needed:**
```typescript
import { ForbiddenException } from '@nestjs/common';
```
(add to existing NestJS imports if not already there)

**Why:** Contract Section 5 — "New behavior at login: Query user by email → validate password → Query user_tenant_membership where user_id = user.id AND status = ACTIVE → If no ACTIVE membership → return 403. Embed tenantId, roleId (resolved to role name), membershipId into JWT."

**Do NOT** remove the `user.is_active` check or any existing security validations.

---

### Task 4 — Update Token Refresh Flow

**What:** In `auth.service.ts`, find the token refresh method (handles `POST /auth/refresh`). It currently re-queries the user and signs a new access token. The payload at approximately line 378 sets `tenant_id: user.tenant_id`.

Update the refresh flow similarly — resolve the active membership before signing:

```typescript
// After validating the refresh token and loading the user:
const membership = await this.prisma.user_tenant_membership.findFirst({
  where: {
    user_id: user.id,
    status: 'ACTIVE',
  },
  include: { role: true },
});

if (!membership) {
  throw new UnauthorizedException('No active tenant membership.');
}

const roles = [membership.role.name];

// Then update the payload construction to use membership data:
const payload: JwtPayload = {
  sub: user.id,
  email: user.email,
  tenant_id: membership.tenant_id,
  membershipId: membership.id,
  roles,
  is_platform_admin: user.is_platform_admin,
  jti: randomUUID(),
};

// Call trackToken after signing:
const expTimestamp = Math.floor(Date.now() / 1000) + 86400;
await this.tokenBlocklist.trackToken(user.id, payload.jti, expTimestamp);
```

**Note:** The refresh flow may sign the token inline (not via `generateTokens()`). Update whatever pattern exists in the refresh method to include `membershipId` and resolve roles from membership.

---

### Task 5 — Update Registration to Create user_tenant_membership

**What:** In `auth.service.ts`, find the `register()` method. Currently it creates a `user` with `tenant_id` set, then creates a `tenant`, then creates a `user_role` record.

After this sprint, registration must also create a `user_tenant_membership` with `ACTIVE` status. Add this inside the existing transaction or immediately after user+tenant creation:

```typescript
// After creating the user and tenant (inside the Prisma transaction if one exists):

// Find the Owner role ID
const ownerRole = await this.prisma.role.findFirst({
  where: { name: 'Owner', is_system: true },
});

if (!ownerRole) {
  throw new Error('Owner role not found. Ensure system roles are seeded.');
}

// Create the membership
await this.prisma.user_tenant_membership.create({
  data: {
    user_id: user.id,           // the newly created user
    tenant_id: tenant.id,       // the newly created tenant
    role_id: ownerRole.id,
    status: 'ACTIVE',
    joined_at: new Date(),
  },
});
```

**Important:** If the existing `register()` method uses a `prisma.$transaction()` block, put the membership creation inside that same transaction.

**Why:** After Sprint 4 removes `user.tenant_id`, the registration flow must rely on the membership to establish the tenant relationship. Creating the membership here ensures the owner can log in immediately after registering.

**Do NOT** remove the `user_role` creation from registration yet — it can coexist during this transition period. Sprint 4 will handle cleanup.

---

### Task 6 — Update jwt.strategy.ts Return Value

**What:** In `src/modules/auth/strategies/jwt.strategy.ts`, update the `validate()` return to include `membershipId`:

```typescript
return {
  id: payload.sub,
  email: payload.email,
  tenant_id: tenant_id,
  membershipId: payload.membershipId, // NEW
  roles: payload.roles,
  is_platform_admin: payload.is_platform_admin,
  jti: payload.jti,
};
```

This makes `membershipId` available via `@CurrentUser()` in controllers.

---

### Task 7 — Smoke Test Login and Register End-to-End

**What:** With the dev server running:

**Test login:**
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq .
```
Expected: 200 with `access_token`. Decode the JWT — verify it contains `membershipId` and `jti` fields.

**Test register (only if test data allows — do not create duplicate tenants):**
If testing register, use a unique email. Verify the membership was created:
```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 \
  -e "SELECT status, joined_at FROM user_tenant_membership WHERE user_id = '{new_user_id}';"
```
Must return a row with `status = ACTIVE`.

**Test refresh:**
```bash
# Get refresh_token from login response first, then:
curl -s -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Authorization: Bearer {refresh_token}" | jq .
```
The new access_token must also contain `membershipId` and `jti`.

---

## Patterns to Apply

### Prisma Membership Query Pattern
```typescript
const membership = await this.prisma.user_tenant_membership.findFirst({
  where: {
    user_id: userId,
    status: 'ACTIVE',
  },
  include: {
    role: true,
  },
});

if (!membership) {
  throw new ForbiddenException('No active tenant membership found for this user.');
}

// membership.id              → membershipId for JWT
// membership.tenant_id       → tenantId for JWT
// membership.role.name       → role name for JWT roles array
```

### JWT Payload Shape After This Sprint
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "tenant_id": "tenant-uuid",
  "membershipId": "membership-uuid",
  "roles": ["Owner"],
  "is_platform_admin": false,
  "jti": "uuid-v4",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### AuditLoggerService (if login audit log exists, update it to include membershipId)
```typescript
// Import: import { AuditLoggerService } from '../../audit/services/audit-logger.service'
await this.auditLogger.logAuth({
  // ... existing fields unchanged
  // If there's a metadata field, optionally add: membershipId
});
```

---

## Business Rules Enforced in This Sprint
- **Contract Section 5 — Auth Module Update:**
  - If no ACTIVE membership → `403 No active tenant membership`
  - JWT payload includes `tenantId`, `membershipId`, `roles` (from membership.role.name)
  - `jti` included in every token (from Sprint 1)

---

## Integration Points
| What | Path |
|---|---|
| auth.service.ts | `src/modules/auth/auth.service.ts` |
| jwt-payload.entity.ts | `src/modules/auth/entities/jwt-payload.entity.ts` |
| jwt.strategy.ts | `src/modules/auth/strategies/jwt.strategy.ts` |
| user_tenant_membership (Prisma) | `prisma.user_tenant_membership` — created in Sprint 2 |
| TokenBlocklistService | `src/core/token-blocklist/token-blocklist.service.ts` — from Sprint 1 |

---

## Acceptance Criteria
- [ ] `POST /api/v1/auth/login` with valid credentials returns 200; decoded JWT contains `membershipId` (non-null UUID) and `jti` (UUID)
- [ ] `POST /api/v1/auth/login` with a user that has no ACTIVE membership returns 403
- [ ] `POST /api/v1/auth/refresh` returns new access token with `membershipId` and `jti`
- [ ] `POST /api/v1/auth/register` still works; newly created user has a row in `user_tenant_membership` with `status = ACTIVE`
- [ ] JWT `tenant_id` matches `user_tenant_membership.tenant_id` for the authenticated user (not `user.tenant_id` which may differ)
- [ ] Server compiles with zero TypeScript errors
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 4 until:
1. Login returns JWT with `membershipId` confirmed by decoding the token
2. Login with no-membership user returns 403
3. Register creates a `user_tenant_membership` row (verified in DB)
4. Refresh returns new token with `membershipId`

---

## Handoff Notes
- After this sprint, `user.tenant_id` is still in the DB and schema but is no longer used by the auth service. Sprint 4 will remove it.
- The `roles` array in the JWT now always contains exactly one role (the role from the active membership). Previously it may have contained multiple roles from `user_role`. This is intentional per the contract (one role per membership).
- `@CurrentUser()` in controllers now provides `{ id, email, tenant_id, membershipId, roles, is_platform_admin, jti }` — Sprint 7 (controller) will use `membershipId`.
- The `user_role` table continues to be written to during registration as a compatibility measure. After all sprints are complete, `user_role` writes can be removed in a cleanup sprint.
