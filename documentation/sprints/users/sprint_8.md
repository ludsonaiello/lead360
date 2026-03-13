# Sprint 8 — Superadmin Endpoints: Admin Module Extension
**Module:** users
**File:** ./documentation/sprints/users/sprint_8.md
**Type:** Backend — Controller Extension
**Depends On:** Sprint 7 (UsersController + module registered)
**Gate:** STOP — All superadmin endpoints return correct responses. Verify before Sprint 9.
**Estimated Complexity:** Medium

---

## Objective

Extend the existing Admin module with two new endpoints required by the contract:
- `GET /admin/tenants/:tenantId/users` — list all memberships in a specific tenant (platform-level, not tenant-scoped)
- `POST /admin/tenants/:tenantId/users` — create a user + membership directly, bypassing the invite flow

The existing admin module already has:
- `GET /admin/tenants` — list all tenants ✅ (already exists in tenant-management.controller.ts)
- `POST /admin/tenants` — create new tenant ✅ (already exists)
- `GET /admin/users/:userId` — view user ✅ (check if exists in user-management.controller.ts)
- `PATCH /admin/users/:userId/deactivate` ✅ (check — may exist as `POST /admin/users/:id/deactivate`)

This sprint focuses only on the two MISSING endpoints. Start by reading the admin module to confirm what already exists.

---

## Pre-Sprint Checklist
- [ ] Sprint 7 gate verified (all users endpoints return correct status codes)
- [ ] Read `src/modules/admin/controllers/tenant-management.controller.ts` FULLY — know which routes exist
- [ ] Read `src/modules/admin/controllers/user-management.controller.ts` FULLY — know which routes exist
- [ ] Read `src/modules/admin/services/tenant-management.service.ts` FULLY — understand service patterns
- [ ] Read `src/modules/admin/admin.module.ts` — know what is imported and exported
- [ ] Read `src/modules/admin/guards/platform-admin.guard.ts` or equivalent — know the superadmin guard
- [ ] Confirm which guard protects superadmin routes (PlatformAdminGuard, SuperAdminGuard, or is_platform_admin check)
- [ ] Verify: does `GET /admin/tenants/:tenantId/users` already exist? If yes, skip Task 2.
- [ ] Verify: does `POST /admin/tenants/:tenantId/users` already exist? If yes, skip Task 3.
- [ ] Verify: does `GET /admin/users/:userId` already exist? If yes, no work needed for that endpoint.
- [ ] Verify: does `PATCH /admin/users/:userId/deactivate` exist? If yes, update to use membership-based deactivation.

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

### Task 1 — Audit Existing Admin Endpoints Against Contract

**What:** Before writing any code, compare the contract's required admin endpoints against what already exists.

**Contract requires:**
| Method | Path | Status |
|---|---|---|
| `POST` | `/admin/tenants` | Check existing |
| `GET` | `/admin/tenants` | Check existing |
| `GET` | `/admin/tenants/:tenantId/users` | Likely missing — implement |
| `POST` | `/admin/tenants/:tenantId/users` | Likely missing — implement |
| `PATCH` | `/admin/users/:userId/deactivate` | May exist as `POST` — check |
| `GET` | `/admin/users/:userId` | Check existing |

For each endpoint that already exists and works correctly, no action is needed. Only implement the missing ones.

---

### Task 2 — Add GET /admin/tenants/:tenantId/users to TenantManagementController

**What:** If this endpoint does not exist, add it to `src/modules/admin/controllers/tenant-management.controller.ts`:

```typescript
@Get(':tenantId/users')
@ApiOperation({ summary: 'List all user memberships in a specific tenant (platform admin)' })
@ApiResponse({ status: 200, description: 'Paginated membership list' })
async getTenantUsers(
  @Param('tenantId') tenantId: string,
  @Query() query: ListUsersQueryDto,
) {
  return this.tenantManagementService.getTenantUsers(tenantId, query);
}
```

**Import** `ListUsersQueryDto` from the users module:
```typescript
import { ListUsersQueryDto } from '../../users/dto/list-users-query.dto';
```

**Add `getTenantUsers()` to TenantManagementService:**

Open `src/modules/admin/services/tenant-management.service.ts`. Add:

```typescript
async getTenantUsers(tenantId: string, query: ListUsersQueryDto) {
  // Verify tenant exists
  const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundException('Tenant not found.');

  const { page = 1, limit = 20, status, role_id } = query;
  const skip = (page - 1) * limit;

  const where: any = { tenant_id: tenantId };
  if (status) where.status = status;
  if (role_id) where.role_id = role_id;

  const [memberships, total] = await Promise.all([
    this.prisma.user_tenant_membership.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: true,
        role: true,
        invited_by: { select: { id: true, first_name: true, last_name: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    this.prisma.user_tenant_membership.count({ where }),
  ]);

  return {
    data: memberships.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      first_name: m.user.first_name,
      last_name: m.user.last_name,
      email: m.user.email,
      phone: m.user.phone ?? null,
      role: { id: m.role.id, name: m.role.name },
      status: m.status,
      joined_at: m.joined_at?.toISOString() ?? null,
      left_at: m.left_at?.toISOString() ?? null,
      invited_by: m.invited_by
        ? { id: m.invited_by.id, first_name: m.invited_by.first_name, last_name: m.invited_by.last_name }
        : null,
      created_at: m.created_at.toISOString(),
    })),
    meta: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    },
  };
}
```

**Note:** This endpoint is platform-level — NO `tenant_id` filter from JWT (the admin is querying any tenant). Tenant isolation rules do not apply here because this is a superadmin endpoint protected by `PlatformAdminGuard`.

---

### Task 3 — Add POST /admin/tenants/:tenantId/users to TenantManagementController

**What:** If this endpoint does not exist, add it to the controller:

```typescript
@Post(':tenantId/users')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Create a user + membership directly (bypasses invite flow)' })
@ApiResponse({ status: 201, description: 'User and membership created' })
@ApiResponse({ status: 409, description: 'Email already exists in this tenant' })
async createUserInTenant(
  @Param('tenantId') tenantId: string,
  @Body() dto: CreateUserAdminDto,
) {
  return this.tenantManagementService.createUserInTenant(tenantId, dto);
}
```

**Import:**
```typescript
import { CreateUserAdminDto } from '../../users/dto/create-user-admin.dto';
```

**Add `createUserInTenant()` to TenantManagementService:**

```typescript
async createUserInTenant(tenantId: string, dto: CreateUserAdminDto) {
  // Verify tenant exists
  const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundException('Tenant not found.');

  // Verify role exists
  const role = await this.prisma.role.findUnique({ where: { id: dto.role_id } });
  if (!role) throw new NotFoundException('Role not found.');

  // Check for existing active membership in this tenant
  const existing = await this.prisma.user_tenant_membership.findFirst({
    where: {
      tenant_id: tenantId,
      status: 'ACTIVE',
      user: { email: dto.email },
    },
  });
  if (existing) {
    throw new ConflictException('This email already has an active membership in this tenant.');
  }

  // Find or create user
  let user = await this.prisma.user.findUnique({ where: { email: dto.email } });

  if (!user) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    user = await this.prisma.user.create({
      data: {
        id: require('crypto').randomUUID(),
        email: dto.email,
        first_name: dto.first_name,
        last_name: dto.last_name,
        password_hash: passwordHash,
        phone: dto.phone ?? null,
        is_active: true,
        email_verified: true,
        email_verified_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  // BR-02: Verify user has no other ACTIVE membership
  const otherActive = await this.prisma.user_tenant_membership.findFirst({
    where: { user_id: user.id, status: 'ACTIVE' },
  });
  if (otherActive) {
    throw new ConflictException('User is currently active in another organization.');
  }

  // Create ACTIVE membership
  const membership = await this.prisma.user_tenant_membership.create({
    data: {
      user_id: user.id,
      tenant_id: tenantId,
      role_id: dto.role_id,
      status: 'ACTIVE',
      joined_at: new Date(),
    },
    include: { role: true },
  });

  return {
    id: membership.id,
    user_id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: { id: role.id, name: role.name },
    status: 'ACTIVE',
    joined_at: membership.joined_at?.toISOString() ?? null,
    created_at: membership.created_at.toISOString(),
  };
}
```

Add required imports to `tenant-management.service.ts`:
```typescript
import * as bcrypt from 'bcrypt';
import { ConflictException, NotFoundException } from '@nestjs/common';
```

---

### Task 4 — Verify or Update Platform-Level Deactivation

**What:** The contract requires `PATCH /admin/users/:userId/deactivate`. Check the current implementation in `user-management.controller.ts`.

If the existing endpoint uses `POST /admin/users/:id/deactivate` (not PATCH), note the discrepancy but do NOT change the existing route — preserving existing API behavior is safer than breaking it. Add the PATCH version if it's missing.

If the existing `deactivate` endpoint does NOT call `tokenBlocklist.blockUserTokens()`, update the service to add the blocklist call after setting `is_active = false`:

In `user-management.controller.ts`'s underlying service method, after deactivating:
```typescript
// After setting is_active = false for the user:
await this.tokenBlocklist.blockUserTokens(userId);
```

To inject `TokenBlocklistService` into the admin user management service:
1. Import `TokenBlocklistModule` in `admin.module.ts`
2. Inject `TokenBlocklistService` into the admin user management service constructor

---

### Task 5 — End-to-End Tests with Admin Credentials

**What:** Use the platform admin account (`ludsonaiello@gmail.com` / `978@F32c`):

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r .access_token)

# Test: List tenants
curl -s http://localhost:8000/api/v1/admin/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .meta

# Test: List users in a specific tenant
TENANT_ID=$(mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -s -N \
  -e "SELECT id FROM tenant LIMIT 1;")

curl -s "http://localhost:8000/api/v1/admin/tenants/${TENANT_ID}/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Test: Create user in tenant
ROLE_ID=$(mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 -s -N \
  -e "SELECT id FROM role WHERE name='Employee' LIMIT 1;")

curl -s -X POST "http://localhost:8000/api/v1/admin/tenants/${TENANT_ID}/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"admintest$(date +%s)@example.com\",
    \"first_name\": \"Admin\",
    \"last_name\": \"Test\",
    \"role_id\": \"${ROLE_ID}\",
    \"password\": \"TestP@ss123\"
  }" | jq .
```

---

## Patterns to Apply

### Multi-Tenant Enforcement Exception for Admin Endpoints
Admin endpoints are EXEMPT from tenant isolation — they operate across all tenants. The PlatformAdminGuard ensures only platform admins access these routes. Do NOT add `tenant_id` filtering from JWT on admin endpoints.

### List Response Envelope
```json
{
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 20, "total_pages": 0 }
}
```

---

## Business Rules Enforced in This Sprint
- **BR-02:** `createUserInTenant()` checks for existing ACTIVE membership before creating new one
- **BR-13:** Platform-level deactivation must also block the user's JWT token via `tokenBlocklist.blockUserTokens()`

---

## Integration Points
| What | Notes |
|---|---|
| `tenant-management.controller.ts` | Add two new routes |
| `tenant-management.service.ts` | Add two new service methods |
| `user-management.controller.ts` / service | Ensure deactivation calls tokenBlocklist |
| `TokenBlocklistModule` | Import in admin.module.ts for deactivation |
| `CreateUserAdminDto` | From `src/modules/users/dto/create-user-admin.dto` |
| `ListUsersQueryDto` | From `src/modules/users/dto/list-users-query.dto` |

---

## Acceptance Criteria
- [ ] `GET /api/v1/admin/tenants` returns 200 with tenant list (already existed, verify still works)
- [ ] `POST /api/v1/admin/tenants` returns 201 (already existed, verify still works)
- [ ] `GET /api/v1/admin/tenants/:tenantId/users` returns 200 with paginated membership list
- [ ] `POST /api/v1/admin/tenants/:tenantId/users` returns 201 with user + membership data
- [ ] Non-platform-admin user gets 403 on all `/admin/` routes
- [ ] Dev server compiles with zero TypeScript errors
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 9 until:
1. `GET /admin/tenants/:tenantId/users` returns 200 with valid data
2. `POST /admin/tenants/:tenantId/users` creates a user + ACTIVE membership verified in DB
3. Zero TypeScript errors

---

## Handoff Notes
- All contract-specified API endpoints are now implemented
- Sprint 9 (Email Job) handles the actual email delivery for invites — currently invites are created but no email is sent
- Sprint 10 (Unit Tests) will test all service methods
- Sprint 11 (API Documentation) generates `api/documentation/users_REST_API.md`
