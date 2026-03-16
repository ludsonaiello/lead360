# Sprint 13 — Tenant-Scoped Role Listing for Users Module
**Module:** users + rbac
**File:** ./documentation/sprints/users/sprint_13.md
**Type:** Backend — Feature (small, surgical)
**Depends On:** Sprint 7 (Users controller operational), Sprint 8 (Admin RBAC endpoints exist)
**Gate:** NONE — Unblocks frontend Users module (invite modal + role change dropdown need this endpoint)
**Estimated Complexity:** Low

---

## Problem Statement

The frontend Users module requires a **list of available roles** to populate:
1. The **Invite User** modal — `POST /users/invite` requires a `role_id`
2. The **Change Role** dropdown — `PATCH /users/:id/role` requires a `role_id`

**Current state:**
- `GET /admin/rbac/roles` exists but requires `PlatformAdminGuard` — tenant Owner/Admin cannot access it
- `GET /user-roles/:userId` returns a specific user's assigned roles — not a list of all available roles
- `GET /user-roles/permissions/matrix` returns the full permission matrix — overkill for a dropdown

**Result:** There is no endpoint a tenant Owner or Admin can call to get `[{ id, name }]` for role selection. The frontend is blocked.

---

## Objective

Add a single **read-only, tenant-scoped** endpoint that returns the list of active roles for dropdown/select usage. This is a lightweight, safe addition that:

- Reuses the existing `RoleService`
- Does NOT modify any existing endpoint or service method
- Does NOT touch the schema or require a migration
- Does NOT expose permissions, templates, or any sensitive RBAC internals
- Returns only `id`, `name`, and `description` — the minimum for a `<select>` element

---

## Architecture Analysis — What Already Exists

### Prisma Schema (`role` table)
```
model role {
  id                 String    @id
  name               String    @unique     ← "Owner", "Admin", "Estimator", etc.
  description        String?
  is_system          Boolean   @default(false)
  is_active          Boolean   @default(true)
  deleted_at         DateTime?
  created_by_user_id String?
  ...
}
```

Key facts:
- Roles are **global** (not per-tenant) — the `role` table has no `tenant_id`
- 7 system roles are seeded: Owner, Admin, Estimator, Project Manager, Bookkeeper, Employee, Read-only
- Platform admins can create custom roles via `POST /admin/rbac/roles`
- Roles have `is_active` and `deleted_at` for lifecycle management

### Existing Services
- `RoleService.getAllRoles(includeDeleted)` — returns all roles with permissions and user count. Too heavy for a dropdown.
- The new endpoint needs a **lightweight query** — `id`, `name`, `description` only. No permission joins, no user counts.

### Existing Controllers
- `AdminController` at `/admin/rbac` — PlatformAdminGuard (OFF LIMITS to tenants)
- `UserRolesController` at `/user-roles` — tenant-scoped Owner/Admin, but has no "list all roles" endpoint

### Guard Chain
The `UserRolesController` already uses `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('Owner', 'Admin')`. The new endpoint will follow the same pattern.

---

## What NOT to Do

- **DO NOT** add a new controller file — use the existing `UserRolesController`
- **DO NOT** modify `RoleService.getAllRoles()` — it returns permission data the tenant should not see
- **DO NOT** add tenant_id to the role table — roles are intentionally global
- **DO NOT** expose `role_permission`, `created_by_user_id`, `deleted_at`, or any internal fields
- **DO NOT** allow tenants to create, update, or delete roles — that remains Platform Admin only
- **DO NOT** rename or restructure existing endpoints

---

## Dev Server

```
CHECK if port 8000 is free:
  lsof -i :8000

If free, start the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

After sprint completion:
  pkill -f "nest start" || pkill -f "ts-node"
  lsof -i :8000  # confirm stopped
```

---

## Tasks

### Task 1 — Add `listActiveRoles()` to RoleService

**File:** `api/src/modules/rbac/services/role.service.ts`

Add a new public method to `RoleService` that returns a lightweight role list. Do NOT modify any existing method.

**Method signature:**
```typescript
/**
 * Get all active roles for dropdown/select usage (lightweight).
 * Returns only id, name, description — no permissions, no counts.
 * Used by tenant Owner/Admin for invite and role-change flows.
 */
async listActiveRoles(): Promise<Array<{ id: string; name: string; description: string | null }>> {
```

**Implementation requirements:**
- Query: `prisma.role.findMany()` with `where: { is_active: true, deleted_at: null }`
- Select: `{ id: true, name: true, description: true }` — nothing else
- Order: `[{ is_system: 'desc' }, { name: 'asc' }]` — system roles first, then alphabetical
- Return type: Array of `{ id, name, description }` — no permission data, no user counts, no internal fields

**Why a new method instead of reusing `getAllRoles()`:**
- `getAllRoles()` includes `role_permission` joins with `permission.module` — data the tenant has no business seeing
- `getAllRoles()` includes `_count.user_role` — reveals platform-wide user counts
- The new method is a clean, minimal query optimized for UI consumption

**Verification:**
- [ ] Method exists and compiles
- [ ] Does NOT include `role_permission`, `_count`, `is_system`, `created_by_user_id`, `deleted_at` in response
- [ ] Returns only active, non-deleted roles
- [ ] Ordered system roles first, then alphabetical

---

### Task 2 — Add `GET /api/v1/rbac/roles` Endpoint

**File:** `api/src/modules/rbac/controllers/user-roles.controller.ts`

**IMPORTANT:** The `UserRolesController` is currently mounted at `@Controller('user-roles')`. The contract and frontend expect the endpoint at `/api/v1/rbac/roles`. There are two options:

**Option A (Preferred — minimal change):** Add a new controller file `api/src/modules/rbac/controllers/roles.controller.ts` that handles ONLY this one endpoint at `@Controller('rbac')`.

**Option B:** Add the endpoint to `UserRolesController` at a path that doesn't conflict with existing `:userId` param routes. This is trickier because `GET /user-roles/available` could work but breaks the path convention the contract established.

**Go with Option A.** Create a new controller:

**New file:** `api/src/modules/rbac/controllers/roles.controller.ts`

```typescript
@ApiTags('Roles')
@Controller('rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly roleService: RoleService) {}

  @Get('roles')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List all active roles (for dropdowns)' })
  @ApiResponse({ status: 200, description: 'Active roles list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Owner or Admin role required' })
  async listRoles() {
    return this.roleService.listActiveRoles();
  }
}
```

**Requirements:**
- Route: `GET /api/v1/rbac/roles`
- Guard: `JwtAuthGuard` + `RolesGuard`
- Roles: `Owner`, `Admin` (same as all user management endpoints)
- No query parameters needed (always returns all active roles)
- No path parameters
- No request body

**Response shape:**
```json
[
  { "id": "abc-123", "name": "Owner", "description": "Full access to all features..." },
  { "id": "def-456", "name": "Admin", "description": "Administrative access..." },
  { "id": "ghi-789", "name": "Estimator", "description": "Create and manage quotes..." },
  { "id": "jkl-012", "name": "Project Manager", "description": "Manage active projects..." },
  { "id": "mno-345", "name": "Bookkeeper", "description": "Manage all financial..." },
  { "id": "pqr-678", "name": "Employee", "description": "Limited access for field workers..." },
  { "id": "stu-901", "name": "Read-only", "description": "View-only access..." }
]
```

**Verification:**
- [ ] `GET /rbac/roles` returns 200 with an array of roles
- [ ] Each role has exactly 3 fields: `id`, `name`, `description`
- [ ] No `role_permission`, `_count`, `is_system`, `created_by_user_id`, `deleted_at` in response
- [ ] Returns 401 without a token
- [ ] Returns 403 for a non-Owner/Admin user (e.g., Employee)
- [ ] Returns 200 for Owner
- [ ] Returns 200 for Admin
- [ ] Does not conflict with existing `GET /admin/rbac/roles` (different path prefix)

---

### Task 3 — Register the New Controller in RBACModule

**File:** `api/src/modules/rbac/rbac.module.ts`

Add `RolesController` to the `controllers` array:

```typescript
import { RolesController } from './controllers/roles.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => AuditModule)],
  controllers: [UserRolesController, AdminController, RolesController],
  // ... providers and exports unchanged
})
```

**Verification:**
- [ ] Server starts without errors
- [ ] `GET /api/v1/rbac/roles` is registered (check Swagger or curl)
- [ ] Existing `GET /admin/rbac/roles` still works for platform admins
- [ ] Existing `GET /user-roles/*` endpoints still work

---

### Task 4 — Manual Endpoint Verification

Test the endpoint against a running server using real credentials.

**Test 1 — Owner gets roles:**
```bash
# Login as tenant Owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Fetch roles
curl -s http://localhost:8000/api/v1/rbac/roles \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Expected: 200 with array of roles, each having `id`, `name`, `description` only.

**Test 2 — No token (should 401):**
```bash
curl -s http://localhost:8000/api/v1/rbac/roles | jq .
```
Expected: 401 Unauthorized.

**Test 3 — Platform admin endpoint still works:**
```bash
# Login as platform admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# Old admin endpoint
curl -s http://localhost:8000/api/v1/admin/rbac/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[0] | keys'
```
Expected: 200 with full role objects including `role_permission`, `_count` — unchanged.

**Test 4 — Verify no route collision:**
```bash
# Existing user-roles endpoint still works
curl -s http://localhost:8000/api/v1/user-roles/permissions/matrix \
  -H "Authorization: Bearer $TOKEN" | jq 'type'
```
Expected: 200, returns object/array — not affected.

---

### Task 5 — Unit Test for `listActiveRoles()`

**File:** Add to existing `api/src/modules/rbac/services/role.service.spec.ts` (or create if not exists)

Write a focused unit test for the new method:

```typescript
describe('listActiveRoles', () => {
  it('should return only active, non-deleted roles', async () => {
    // Mock prisma.role.findMany to return test data
    // Verify: where clause includes is_active: true, deleted_at: null
    // Verify: select includes only id, name, description
    // Verify: orderBy is [{ is_system: 'desc' }, { name: 'asc' }]
  });

  it('should not include permission data', async () => {
    // Verify: no include/select of role_permission or _count
  });
});
```

---

### Task 6 — Update Users REST API Documentation

**File:** `api/documentation/users_REST_API.md`

Add a new section **"Supporting Endpoints — Role Listing"** after the RBAC Matrix section. Document:

```markdown
## Supporting Endpoints — Role Listing

The invite and role-change flows require a list of available roles. This endpoint provides it.

### GET /api/v1/rbac/roles

**Description:** List all active roles for use in dropdowns (invite user, change role).
**Auth:** Required — Owner or Admin
**HTTP:** `200 OK`
**Controller:** `api/src/modules/rbac/controllers/roles.controller.ts`

**Example Request:**
\`\`\`bash
curl https://api.lead360.app/api/v1/rbac/roles \
  -H "Authorization: Bearer <token>"
\`\`\`

**Response 200:**
\`\`\`json
[
  { "id": "uuid", "name": "Owner", "description": "Full access..." },
  { "id": "uuid", "name": "Admin", "description": "Administrative access..." },
  ...
]
\`\`\`

**Response Array Item Fields:**
| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string UUID | No | Role ID — use this as `role_id` in invite and role-change |
| `name` | string | No | Role display name |
| `description` | string \| null | Yes | Role description |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 401 | Missing or invalid JWT | `Unauthorized` |
| 403 | Role is not Owner or Admin | `Forbidden resource` |

**Notes:**
- Returns system roles first (Owner, Admin, etc.), then custom roles alphabetically
- Only active, non-deleted roles are returned
- This endpoint does NOT expose permissions, templates, or any internal RBAC data
```

---

## Files Changed (Summary)

| File | Action | Description |
|---|---|---|
| `api/src/modules/rbac/services/role.service.ts` | Modified | Add `listActiveRoles()` method |
| `api/src/modules/rbac/controllers/roles.controller.ts` | **Created** | New controller with single `GET /rbac/roles` endpoint |
| `api/src/modules/rbac/rbac.module.ts` | Modified | Register `RolesController` in controllers array |
| `api/documentation/users_REST_API.md` | Modified | Add role listing endpoint documentation |
| `api/src/modules/rbac/services/role.service.spec.ts` | Modified | Add unit test for `listActiveRoles()` |

**Files NOT changed:**
- `schema.prisma` — no migration needed
- `admin.controller.ts` — platform admin endpoints untouched
- `user-roles.controller.ts` — existing endpoints untouched
- `role.service.ts` existing methods — `getAllRoles()`, `getRole()`, etc. unchanged
- Any service, DTO, or guard outside the RBAC module

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Route collision between `/rbac/roles` and `/admin/rbac/roles` | Very Low | High | Different controller prefixes (`rbac` vs `admin/rbac`). NestJS resolves these as distinct routes. Verified by Task 4 Test 3. |
| Exposing sensitive RBAC data to tenant users | Low | High | New method returns ONLY `id, name, description`. No permission data. No `_count`. Review in Task 2 verification. |
| Breaking existing `user-roles` endpoints | Very Low | High | New controller is a separate file. Existing `UserRolesController` is not modified. Verified by Task 4 Test 4. |
| Roles are global (not per-tenant) — tenant sees all roles | Expected | None | This is by design. Roles are platform-wide. The same 7 system roles apply to every tenant. If custom roles are added by platform admin, they're also global. No tenant isolation issue. |

---

## Acceptance Criteria

- [ ] `GET /api/v1/rbac/roles` returns 200 with array of active roles for Owner
- [ ] `GET /api/v1/rbac/roles` returns 200 with array of active roles for Admin
- [ ] `GET /api/v1/rbac/roles` returns 401 without authentication
- [ ] `GET /api/v1/rbac/roles` returns 403 for Employee, Estimator, PM, Bookkeeper, Read-only
- [ ] Response contains exactly `id`, `name`, `description` — no other fields
- [ ] System roles appear first, then custom roles alphabetically
- [ ] Soft-deleted and inactive roles are excluded
- [ ] `GET /admin/rbac/roles` (platform admin) is unaffected
- [ ] All existing `user-roles/*` endpoints are unaffected
- [ ] Unit test for `listActiveRoles()` passes
- [ ] REST API documentation updated with the new endpoint
- [ ] Server starts without errors after changes
- [ ] Frontend can now populate Invite User modal and Change Role dropdown
