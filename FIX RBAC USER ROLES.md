# FIX: RBAC Desync + User Management CRUD

**Priority**: CRITICAL  
**Created**: 2026-04-17  
**Affects**: All invited users (employees, admins, owners invited to tenants)  
**Status**: Unfixed

---

## TABLE OF CONTENTS

1. [Problem Summary](#1-problem-summary)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Full Failure Chain](#3-full-failure-chain)
4. [What's Broken — File by File](#4-whats-broken--file-by-file)
5. [Fix Instructions — Phase 1: RBAC Migration](#5-fix-instructions--phase-1-rbac-migration)
6. [Fix Instructions — Phase 2: Missing User CRUD](#6-fix-instructions--phase-2-missing-user-crud)
7. [Fix Instructions — Phase 3: Frontend Updates](#7-fix-instructions--phase-3-frontend-updates)
8. [Verification Checklist](#8-verification-checklist)

---

## 1. Problem Summary

**Two critical issues:**

### A) RBAC is completely broken for all invited users

Any user added to a tenant via the invite flow (`POST /users/invite`) has **zero permissions** at runtime. They can log in (JWT is valid), but:
- Every backend permission guard denies access
- The frontend RBAC context fails to load their roles
- The settings/users page redirects them to /forbidden
- The admin panel shows "no role associated" for these users

**Only users created via self-registration** (the original tenant owner) have working RBAC.

### B) User management CRUD is incomplete

After inviting a user, there is no way to:
- **Edit** their name, email, or phone (what if you type a wrong email?)
- **Resend** an expired invitation (tokens expire after 72 hours)

---

## 2. Root Cause Analysis

### The Dual-Table Problem

The platform has TWO tables that store user-role associations:

| Table | Purpose | Status |
|---|---|---|
| `user_tenant_membership` | Stores user's role per tenant (has `role_id`, `status`, `tenant_id`) | **CANONICAL** — used by auth/login to populate JWT |
| `user_role` | Legacy role assignment table | **DEPRECATED** — schema comment says "Do NOT write new FK references to user_role" |

### Who Writes to Which Table

| Code Path | Writes `user_tenant_membership`? | Writes `user_role`? |
|---|---|---|
| `auth.service.ts register()` (self-registration) | YES | YES |
| `tenant-management.service.ts createTenant()` (platform admin creates tenant) | YES | YES |
| `users.service.ts inviteUser()` (invite flow) | YES | **NO** |
| `users.service.ts acceptInvite()` (accept invite) | YES (updates to ACTIVE) | **NO** |
| `users.service.ts changeRole()` (change role) | YES (updates role_id) | **NO** |
| `tenant-management.service.ts createUserInTenant()` (admin bypass) | YES | **NO** |

### Who Reads from Which Table

| Code Path | Reads from | Problem |
|---|---|---|
| `auth.service.ts login()` — JWT population | `user_tenant_membership` | Works correctly |
| `rbacService.checkPermission()` — runtime permission check | `user_role` | **BROKEN for invited users** |
| `rbacService.hasAnyRole()` — runtime role check | `user_role` | **BROKEN for invited users** |
| `rbacService.getUserPermissions()` — load user permissions | `user_role` | **BROKEN for invited users** |
| `userRoleService.getUserRoles()` — frontend RBAC context data | `user_role` | **BROKEN for invited users** |
| `GET /admin/users` — admin user listing | `user_role` (via include) | **Shows empty roles** |
| `GET /admin/users/:id` — admin user detail | `user_role` (via include) | **Shows empty roles** |
| `auth.service.ts getProfile()` — user profile | `user_role` (via include) | **Shows empty roles** |
| Various jobs (license-expiry, insurance, missed-shift) | `user_role` (via include) | **Can't find admins to notify** |
| `approval-workflow.service.ts` — find approver | `user_role` | **Can't find approvers** |

**Result**: Login works (reads correct table), but everything else fails (reads wrong table).

---

## 3. Full Failure Chain

Here's exactly what happens when an invited employee logs in:

```
Step 1: Owner invites employee via POST /users/invite
        → Creates user_tenant_membership record (role_id = Employee, status = INVITED)
        → Does NOT create user_role record
        
Step 2: Employee accepts invite via POST /users/invite/:token/accept
        → Updates user_tenant_membership to status = ACTIVE
        → Still NO user_role record

Step 3: Employee logs in via POST /auth/login
        → auth.service.ts queries user_tenant_membership (line 291-309)
        → Finds ACTIVE membership with role "Employee"
        → JWT payload: { roles: ['Employee'], tenant_id: '...', membershipId: '...' }
        → Login succeeds ✅

Step 4: Frontend RBACContext loads
        → Calls GET /api/v1/user-roles/{userId} (rbac.ts line 53)
        → Backend endpoint has @Roles('Owner', 'Admin') guard
        → Guard calls rbacService.hasAnyRole() → queries user_role table → EMPTY → 403 Forbidden
        → RBACContext catches error → sets roles to empty Set
        → hasRole('anything') returns false
        → hasPermission('anything') returns false

Step 5: Any ProtectedRoute on any page
        → Checks hasRole() or hasPermission() → all return false
        → Redirects to /forbidden
        → User sees blank/forbidden page

Step 6: Even if frontend somehow made an API call
        → Backend RolesGuard calls rbacService.hasAnyRole() → queries user_role → EMPTY → 403
        → Backend PermissionGuard calls rbacService.checkPermission() → queries user_role → EMPTY → 403
        → Every single protected endpoint returns 403
```

**The employee is effectively locked out of the entire application despite having a valid JWT with correct roles.**

---

## 4. What's Broken — File by File

### RBAC Core (queries `user_role` — must migrate to `user_tenant_membership`)

| # | File | Line(s) | What it does | Why it's broken |
|---|---|---|---|---|
| 1 | `api/src/modules/rbac/services/rbac.service.ts` | 57 | `checkPermission()` — `prisma.user_role.findMany({where: {user_id, tenant_id}})` | Returns empty for invited users → all permission checks fail |
| 2 | `api/src/modules/rbac/services/rbac.service.ts` | 134 | `getUserPermissions()` — `prisma.user_role.findMany({...})` | Returns empty → user has no permissions |
| 3 | `api/src/modules/rbac/services/rbac.service.ts` | 324 | `hasAnyRole()` — `prisma.user_role.count({where: {user_id, tenant_id, role: {name: {in: roleNames}}}})` | Returns 0 → all role guards fail |
| 4 | `api/src/modules/rbac/services/user-role.service.ts` | 35 | `getUserRoles()` — `prisma.user_role.findMany({where: {user_id, tenant_id}})` | Returns empty → frontend RBAC context has no roles |

### Admin Endpoints (queries `user_role` via Prisma include)

| # | File | Line(s) | What it does | Why it's broken |
|---|---|---|---|---|
| 5 | `api/src/modules/admin/controllers/user-management.controller.ts` | 203, 228 | `listUsers()` includes `user_role_user_role_user_idTouser`, maps to `roles[]` | Invited users show `roles: []` in admin panel |
| 6 | `api/src/modules/admin/controllers/user-management.controller.ts` | 296, 327 | `getUserDetails()` same include and mapping | Same — detail page shows empty roles |

### Auth Profile

| # | File | Line(s) | What it does | Why it's broken |
|---|---|---|---|---|
| 7 | `api/src/modules/auth/auth.service.ts` | 739, 751 | `getProfile()` includes `user_role_user_role_user_idTouser`, maps to roles array | Profile returns empty roles for invited users |

### Secondary Consumers (all use `user_role_user_role_user_idTouser` Prisma relation)

| # | File | Line(s) | What it does |
|---|---|---|---|
| 8 | `api/src/modules/admin/services/export.service.ts` | 558, 575 | User export — role column empty |
| 9 | `api/src/modules/admin/services/dashboard.service.ts` | 521 | `user_role.groupBy` for role distribution chart — undercounts |
| 10 | `api/src/modules/tenant/jobs/license-expiry-check.job.ts` | 116, 130 | Finds Owner/Admin for license expiry notifications — misses invited admins |
| 11 | `api/src/modules/tenant/jobs/insurance-expiry-check.job.ts` | 129, 143 | Same — misses invited admins for insurance alerts |
| 12 | `api/src/modules/time-clock/services/missed-shift.service.ts` | 205 | Finds admins for missed shift alerts — misses invited admins |
| 13 | `api/src/modules/projects/processors/insurance-expiry-check.processor.ts` | 303 | Same pattern |
| 14 | `api/src/modules/quotes/services/approval-workflow.service.ts` | 989 | `user_role.findFirst` to find approver by role — can't find invited approvers |

### Missing CRUD (not a bug — features never built)

| # | What's missing | Impact |
|---|---|---|
| 15 | No `PATCH /users/:id` endpoint (edit user details) | Can't fix wrong email/name/phone after invite |
| 16 | No `POST /users/:id/resend-invite` endpoint | If 72hr token expires, must delete + re-invite |
| 17 | No Edit User button on settings/users page | Owner/Admin can't manage user details |
| 18 | No Resend Invite button on settings/users page | No recovery for expired invites |

---

## 5. Fix Instructions — Phase 1: RBAC Migration

**Strategy**: Change all READ operations from `user_role` to `user_tenant_membership`. Do NOT dual-write — the schema explicitly deprecates `user_role`, and `user_tenant_membership` is the canonical source.

### Fix #1: `rbac.service.ts` — `checkPermission()` (line 57)

**File**: `api/src/modules/rbac/services/rbac.service.ts`

Replace:
```typescript
const userRoles = await this.prisma.user_role.findMany({
  where: {
    user_id: userId,
    tenant_id: tenantId,
  },
  include: {
    role: {
      include: {
        role_permission: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
        },
      },
    },
  },
});
```

With:
```typescript
const memberships = await this.prisma.user_tenant_membership.findMany({
  where: {
    user_id: userId,
    tenant_id: tenantId,
    status: 'ACTIVE',
  },
  include: {
    role: {
      include: {
        role_permission: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
        },
      },
    },
  },
});
```

Then update variable references: `userRoles` → `memberships` throughout the method. The `membership.role` structure is identical to `userRole.role` so the permission-checking loop logic stays the same. Also update the `if (userRoles.length === 0)` check to `if (memberships.length === 0)`.

### Fix #2: `rbac.service.ts` — `getUserPermissions()` (line 134)

Same pattern as Fix #1. Replace `user_role.findMany` with `user_tenant_membership.findMany` + `status: 'ACTIVE'` filter. The role IDs extraction changes from:
```typescript
const roleIds = userRoles.map((ur) => ur.role_id);
```
to:
```typescript
const roleIds = memberships.map((m) => m.role_id);
```

### Fix #3: `rbac.service.ts` — `hasAnyRole()` (line 324)

Replace:
```typescript
const count = await this.prisma.user_role.count({
  where: {
    user_id: userId,
    tenant_id: tenantId,
    role: {
      name: { in: roleNames },
      is_active: true,
    },
  },
});
```

With:
```typescript
const count = await this.prisma.user_tenant_membership.count({
  where: {
    user_id: userId,
    tenant_id: tenantId,
    status: 'ACTIVE',
    role: {
      name: { in: roleNames },
      is_active: true,
    },
  },
});
```

### Fix #4: `user-role.service.ts` — `getUserRoles()` (line 34)

**File**: `api/src/modules/rbac/services/user-role.service.ts`

This is what the frontend RBACContext calls via `GET /user-roles/{userId}`.

Replace:
```typescript
async getUserRoles(userId: string, tenantId: string) {
  return this.prisma.user_role.findMany({
    where: {
      user_id: userId,
      tenant_id: tenantId,
    },
    include: {
      role: {
        select: {
          id: true,
          name: true,
          description: true,
          is_system: true,
        },
      },
    },
    orderBy: {
      assigned_at: 'desc',
    },
  });
}
```

With:
```typescript
async getUserRoles(userId: string, tenantId: string) {
  const memberships = await this.prisma.user_tenant_membership.findMany({
    where: {
      user_id: userId,
      tenant_id: tenantId,
      status: 'ACTIVE',
    },
    include: {
      role: {
        select: {
          id: true,
          name: true,
          description: true,
          is_system: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  // Map to match the shape the frontend expects: { role: {...}, assigned_at, ... }
  return memberships.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role_id: m.role_id,
    tenant_id: m.tenant_id,
    role: m.role,
    assigned_at: m.joined_at || m.created_at,
    created_at: m.created_at,
  }));
}
```

**Important**: The frontend `RBACContext` (at `app/src/contexts/RBACContext.tsx` line 95-97) maps the response as:
```typescript
const userRoles = Array.isArray(rolesResponse) ? rolesResponse.map((ur) => ur.role) : [];
```
So the returned objects MUST have a `.role` property with `{id, name, description}` — the mapping above preserves this.

### Fix #5: `user-management.controller.ts` — `listUsers()` (lines 193-241)

**File**: `api/src/modules/admin/controllers/user-management.controller.ts`

In the `prisma.user.findMany` include block, replace:
```typescript
memberships: {
  where: { status: 'ACTIVE' },
  take: 1,
  include: {
    tenant: {
      select: { id: true, subdomain: true, company_name: true },
    },
  },
},
user_role_user_role_user_idTouser: {
  include: {
    role: {
      select: { name: true },
    },
  },
},
```

With:
```typescript
memberships: {
  where: { status: 'ACTIVE' },
  include: {
    tenant: {
      select: { id: true, subdomain: true, company_name: true },
    },
    role: {
      select: { name: true },
    },
  },
},
```

And update the mapping (line 216-233):
```typescript
return {
  // ... other fields stay the same ...
  tenant_id: user.memberships[0]?.tenant?.id ?? undefined,
  tenant_subdomain: user.memberships[0]?.tenant?.subdomain,
  tenant_company_name: user.memberships[0]?.tenant?.company_name,
  roles: user.memberships.map((m) => m.role.name),  // <-- changed from user_role
  // ...
};
```

### Fix #6: `user-management.controller.ts` — `getUserDetails()` (lines 283-337)

Same file, same pattern. Replace `user_role_user_role_user_idTouser` include (line 296) with membership-based include. Update role mapping (line 327):

```typescript
// FROM:
roles: user.user_role_user_role_user_idTouser.map((ur) => ({
  id: ur.role.id,
  name: ur.role.name,
  description: ur.role.description,
  assigned_at: ur.created_at,
})),

// TO:
roles: user.memberships.map((m) => ({
  id: m.role.id,
  name: m.role.name,
  description: m.role.description,
  assigned_at: m.joined_at || m.created_at,
})),
```

### Fix #7: `auth.service.ts` — `getProfile()` (lines 732-771)

**File**: `api/src/modules/auth/auth.service.ts`

Replace include (line 739):
```typescript
// FROM:
include: {
  user_role_user_role_user_idTouser: {
    include: {
      role: true,
    },
  },
},

// TO:
include: {
  memberships: {
    where: { status: 'ACTIVE' },
    include: {
      role: true,
    },
  },
},
```

Replace mapping (line 751):
```typescript
// FROM:
const roles = user.user_role_user_role_user_idTouser.map((ur) => ur.role.name);

// TO:
const roles = user.memberships.map((m) => m.role.name);
```

### Fixes #8-14: Secondary Consumers

All follow the same pattern. For each file listed in section 4 (items 8-14):

**For files using `user_role_user_role_user_idTouser` include** (items 8, 10, 11, 12, 13):
- Replace the include with `memberships: { where: { status: 'ACTIVE' }, include: { role: { select: { name: true } } } }`
- Replace `.user_role_user_role_user_idTouser.some((ur) => ...)` with `.memberships.some((m) => ...)`
- Replace `ur.role.name` with `m.role.name`

**For `dashboard.service.ts` (item 9, line 521):**
```typescript
// FROM:
const userRoles = await this.prisma.user_role.groupBy({
  by: ['role_id'],
  _count: { role_id: true },
});

// TO:
const userRoles = await this.prisma.user_tenant_membership.groupBy({
  by: ['role_id'],
  where: { status: 'ACTIVE' },
  _count: { role_id: true },
});
```

**For `approval-workflow.service.ts` (item 14, line 989):**
```typescript
// FROM:
const userRole = await tx.user_role.findFirst({
  where: { tenant_id: tenantId, role: { name: roleName } },
  include: { user: { select: { id: true, email: true, first_name: true, last_name: true } } },
});

// TO:
const membership = await tx.user_tenant_membership.findFirst({
  where: { tenant_id: tenantId, status: 'ACTIVE', role: { name: roleName }, user: { is_active: true } },
  include: { user: { select: { id: true, email: true, first_name: true, last_name: true } } },
});
```

---

## 6. Fix Instructions — Phase 2: Missing User CRUD

### Fix #15: Add Edit User Endpoint

#### A) Create DTO

**New file**: `api/src/modules/users/dto/edit-user.dto.ts`

```typescript
import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EditUserDto {
  @ApiPropertyOptional({ description: 'First name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

  @ApiPropertyOptional({ description: 'Last name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
```

#### B) Add service method

**File**: `api/src/modules/users/services/users.service.ts` — add after `changeRole()` method (~line 445):

```typescript
async editUser(
  tenantId: string,
  membershipId: string,
  actorUserId: string,
  dto: EditUserDto,
): Promise<MembershipResponseDto> {
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { id: membershipId, tenant_id: tenantId },
    include: { user: true, role: true },
  });

  if (!membership) throw new NotFoundException('Membership not found.');

  // If email is changing, check uniqueness
  if (dto.email && dto.email !== membership.user.email) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email address is already in use.');
    }
  }

  // Build update payload from non-null DTO fields
  const updateData: any = { updated_at: new Date() };
  if (dto.first_name !== undefined) updateData.first_name = dto.first_name;
  if (dto.last_name !== undefined) updateData.last_name = dto.last_name;
  if (dto.email !== undefined) updateData.email = dto.email;
  if (dto.phone !== undefined) updateData.phone = dto.phone;

  const beforeState = {
    first_name: membership.user.first_name,
    last_name: membership.user.last_name,
    email: membership.user.email,
    phone: membership.user.phone,
  };

  const updatedUser = await this.prisma.user.update({
    where: { id: membership.user_id },
    data: updateData,
  });

  // Re-fetch membership with full includes for response
  const updated = await this.prisma.user_tenant_membership.findFirst({
    where: { id: membershipId },
    include: {
      user: true,
      role: true,
      invited_by: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'User',
    entityId: membership.user_id,
    tenantId,
    actorUserId,
    before: beforeState,
    after: {
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      email: updatedUser.email,
      phone: updatedUser.phone,
    },
    description: `User profile updated by admin`,
  });

  return this.formatMembership(updated!);
}
```

#### C) Add controller route

**File**: `api/src/modules/users/controllers/users.controller.ts` — add after the `GET :id` route:

```typescript
@Patch(':id')
@Roles('Owner', 'Admin')
@ApiOperation({ summary: 'Edit user details (admin)', description: 'Update user name, email, or phone. Owner or Admin required.' })
@ApiParam({ name: 'id', description: 'Membership ID (UUID)' })
@ApiResponse({ status: 200, description: 'User updated successfully' })
@ApiResponse({ status: 404, description: 'Membership not found' })
@ApiResponse({ status: 409, description: 'Email already in use' })
async editUser(
  @TenantId() tenantId: string,
  @CurrentUser() actor: AuthenticatedUser,
  @Param('id', ParseUUIDPipe) membershipId: string,
  @Body() dto: EditUserDto,
) {
  return this.usersService.editUser(tenantId, membershipId, actor.id, dto);
}
```

**Import**: Add `EditUserDto` to the imports at the top.

**Route ordering note**: This `PATCH :id` must come AFTER `PATCH me` and `PATCH me/password` routes to avoid capturing those paths. NestJS processes routes top-to-bottom within a controller, and `me` is a literal that won't match `:id` as long as `me` routes are declared first.

### Fix #16: Add Resend Invite Endpoint

#### A) Add service method

**File**: `api/src/modules/users/services/users.service.ts` — add after `editUser()`:

```typescript
async resendInvite(
  tenantId: string,
  membershipId: string,
  actorUserId: string,
): Promise<{ message: string; expires_at: string }> {
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { id: membershipId, tenant_id: tenantId },
    include: { user: true, role: true },
  });

  if (!membership) throw new NotFoundException('Membership not found.');

  if (membership.status !== 'INVITED') {
    throw new BadRequestException(
      'Can only resend invites for users with INVITED status.',
    );
  }

  // Generate new token (invalidates old one)
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(
    Date.now() + this.INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000,
  );

  // Update membership with new token
  await this.prisma.user_tenant_membership.update({
    where: { id: membershipId },
    data: {
      invite_token_hash: tokenHash,
      invite_token_expires_at: expiresAt,
    },
  });

  // Send invite email (reuse same template as original invite)
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { company_name: true },
  });
  const inviter = await this.prisma.user.findUnique({
    where: { id: actorUserId },
    select: { first_name: true, last_name: true },
  });

  const frontendUrl =
    this.configService.get<string>('FRONTEND_URL') ??
    'https://app.lead360.app';
  const inviteLink = `${frontendUrl}/invite/${rawToken}`;

  await this.sendEmailService.sendTemplated(
    tenantId,
    {
      to: membership.user.email,
      template_key: 'user-invite',
      variables: {
        first_name: membership.user.first_name,
        last_name: membership.user.last_name,
        invite_link: inviteLink,
        tenant_name: tenant?.company_name ?? 'Lead360',
        inviter_name: inviter
          ? `${inviter.first_name} ${inviter.last_name}`
          : 'Your administrator',
        role_name: membership.role.name,
        expires_at: expiresAt.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
      related_entity_type: 'user_tenant_membership',
      related_entity_id: membershipId,
    },
    actorUserId,
  );

  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'UserMembership',
    entityId: membershipId,
    tenantId,
    actorUserId,
    after: { action: 'invite_resent', email: membership.user.email },
    description: `Invite resent to ${membership.user.email}`,
  });

  return {
    message: 'Invitation resent successfully.',
    expires_at: expiresAt.toISOString(),
  };
}
```

#### B) Add controller route

**File**: `api/src/modules/users/controllers/users.controller.ts`:

```typescript
@Post(':id/resend-invite')
@Roles('Owner', 'Admin')
@ApiOperation({ summary: 'Resend invite email', description: 'Generates a new invite token and resends the invitation email. Only for INVITED memberships.' })
@ApiParam({ name: 'id', description: 'Membership ID (UUID)' })
@ApiResponse({ status: 200, description: 'Invite resent successfully' })
@ApiResponse({ status: 400, description: 'Membership is not in INVITED status' })
@ApiResponse({ status: 404, description: 'Membership not found' })
async resendInvite(
  @TenantId() tenantId: string,
  @CurrentUser() actor: AuthenticatedUser,
  @Param('id', ParseUUIDPipe) membershipId: string,
) {
  return this.usersService.resendInvite(tenantId, membershipId, actor.id);
}
```

---

## 7. Fix Instructions — Phase 3: Frontend Updates

### Fix #17: Add Types and API Functions

#### A) Types

**File**: `app/src/lib/types/users.ts` — add at the end of the "Request DTOs" section:

```typescript
export interface EditUserDto {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

export interface ResendInviteResponse {
  message: string;
  expires_at: string;
}
```

#### B) API Functions

**File**: `app/src/lib/api/users.ts` — add in the "Tenant-Scoped User Management" section:

```typescript
/** Edit user details (admin) */
export async function editUser(membershipId: string, dto: EditUserDto): Promise<MembershipItem> {
  const response = await apiClient.patch<MembershipItem>(`/users/${membershipId}`, dto);
  return response.data;
}

/** Resend invite email (generates new token) */
export async function resendInvite(membershipId: string): Promise<ResendInviteResponse> {
  const response = await apiClient.post<ResendInviteResponse>(`/users/${membershipId}/resend-invite`);
  return response.data;
}
```

Add `EditUserDto` and `ResendInviteResponse` to the imports from `../types/users`.

Add `editUser` and `resendInvite` to the `usersApi` export object at the bottom.

### Fix #18: Create EditUserModal Component

**New file**: `app/src/components/users/EditUserModal.tsx`

Follow the exact pattern of `ChangeRoleModal.tsx`:
- Props: `{ isOpen: boolean; onClose: () => void; onSuccess: () => void; member: MembershipItem | null }`
- Form fields: first_name, last_name, email, phone (pre-populated from `member`)
- Validation: required first/last name, email regex, max lengths
- Submit calls `editUser(member.id, dto)`
- Handle 409 Conflict (email taken)
- Reset form state when modal opens (useEffect on isOpen)

### Fix #19: Update Settings/Users Page

**File**: `app/src/app/(dashboard)/settings/users/page.tsx`

**Changes:**

1. Add imports:
```typescript
import EditUserModal from '@/components/users/EditUserModal';
import { editUser, resendInvite } from '@/lib/api/users';
```

2. Add state (after existing modal states):
```typescript
const [showEditModal, setShowEditModal] = useState(false);
```

3. Add Resend Invite handler:
```typescript
const handleResendInvite = async (member: MembershipItem) => {
  try {
    await resendInvite(member.id);
    toast.success(`Invite resent to ${member.email}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resend invite';
    toast.error(message);
  }
};
```

4. Add action buttons in the desktop table Actions column (around line 299-336):
```tsx
{/* Edit button - for non-INACTIVE members */}
{member.status !== 'INACTIVE' && (
  <button
    type="button"
    onClick={() => { setSelectedMember(member); setShowEditModal(true); }}
    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
  >
    Edit
  </button>
)}

{/* Resend Invite button - for INVITED members only */}
{member.status === 'INVITED' && (
  <button
    type="button"
    onClick={() => handleResendInvite(member)}
    className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium"
  >
    Resend Invite
  </button>
)}
```

5. Add same buttons to mobile cards section (around line 390-426)

6. Add EditUserModal render (alongside other modals, before `</ProtectedRoute>`):
```tsx
<EditUserModal
  isOpen={showEditModal}
  onClose={() => { setShowEditModal(false); setSelectedMember(null); }}
  onSuccess={() => fetchUsers()}
  member={selectedMember}
/>
```

---

## 8. Verification Checklist

### After Phase 1 (RBAC Fix):

- [ ] Invite a new user as Employee on any tenant
- [ ] Accept the invite
- [ ] Log in as the invited Employee
- [ ] Verify the Employee can access their permitted pages (e.g., dashboard, time clock)
- [ ] Verify the Employee CANNOT access pages they shouldn't (e.g., settings, financial)
- [ ] Log in as Platform Admin → go to `/admin/users` → verify the invited Employee shows correct role
- [ ] Log in as Platform Admin → go to `/admin/users/{id}` → verify role shown correctly
- [ ] Invite a new Owner to a tenant → accept → verify they can access Owner-level pages
- [ ] Run `npm run build` in `/api` — no compilation errors

### After Phase 2 (Backend CRUD):

- [ ] `PATCH /users/{membershipId}` with `{ "first_name": "NewName" }` → returns updated membership
- [ ] `PATCH /users/{membershipId}` with `{ "email": "existing@email.com" }` → returns 409 Conflict
- [ ] `POST /users/{membershipId}/resend-invite` for INVITED user → returns 200, email sent
- [ ] `POST /users/{membershipId}/resend-invite` for ACTIVE user → returns 400
- [ ] Old invite link stops working after resend (token hash overwritten)
- [ ] New invite link works and can be accepted
- [ ] Run `npm run build` in `/api` — no compilation errors

### After Phase 3 (Frontend):

- [ ] Settings/users page shows "Edit" button for active and invited members
- [ ] Settings/users page shows "Resend Invite" button for invited members
- [ ] Click "Edit" → modal opens with pre-populated fields → save → list refreshes
- [ ] Try changing email to existing email → error toast shows
- [ ] Click "Resend Invite" → success toast → new email arrives
- [ ] All existing actions still work: Invite, Change Role, Deactivate, Reactivate, Delete
- [ ] Mobile responsive: all new buttons show on mobile cards too
- [ ] Run `npm run build` in `/app` — no compilation errors

### Database Sanity Check:

```sql
-- Check if any active memberships have no corresponding user_role (these are the broken ones)
SELECT utm.id, u.email, r.name as role_name, utm.status, utm.tenant_id
FROM user_tenant_membership utm
JOIN user u ON u.id = utm.user_id
JOIN role r ON r.id = utm.role_id
WHERE utm.status = 'ACTIVE'
AND NOT EXISTS (
  SELECT 1 FROM user_role ur
  WHERE ur.user_id = utm.user_id
  AND ur.tenant_id = utm.tenant_id
);
```

After the fix, these users should have working RBAC even without `user_role` records.

---

## Notes for Developer

1. **Do NOT add dual-writes** (creating `user_role` records alongside `user_tenant_membership`). The `user_role` table is deprecated. The fix is to stop reading from it, not to keep it in sync.

2. **The `user_role` table and `user-role.service.ts`** can remain as-is for now. The admin RBAC management UI uses them for explicit role management. They can be fully deprecated in a future sprint.

3. **Test with the honeydo4you tenant** specifically — that's where the issue was first reported with Employee users showing no roles.

4. **After deploying**: Existing invited users will immediately gain proper RBAC access without any data migration needed. The fix is purely in the read path.

---

**End of Fix Document**
