# Sprint 7 — Users Controller + Module Registration
**Module:** users
**File:** ./documentation/sprints/users/sprint_7.md
**Type:** Backend — Controller
**Depends On:** Sprint 6 (UsersService complete)
**Gate:** STOP — All endpoints must return correct HTTP status codes with test data. Verify via curl before Sprint 8.
**Estimated Complexity:** Medium

---

## Objective

Build the `UsersController` with all tenant-scoped and self-service endpoints. Register the `UsersModule` in `app.module.ts`. Add a thin `issueTokensForMembership()` method to `AuthService` to support the invite acceptance response. After this sprint, all non-admin users endpoints are accessible.

---

## Pre-Sprint Checklist
- [ ] Sprint 6 gate verified (UsersService compiles, no TypeScript errors)
- [ ] Read `src/modules/auth/auth.service.ts` — understand the `generateTokens()` signature to write the new `issueTokensForMembership()` method
- [ ] Read an existing controller in the codebase (e.g., `src/modules/leads/controllers/leads.controller.ts`) to understand the controller pattern used
- [ ] Read `src/modules/auth/decorators/tenant-id.decorator.ts` — know the `@TenantId()` decorator usage
- [ ] Read `src/modules/auth/decorators/current-user.decorator.ts` — know the `@CurrentUser()` decorator usage
- [ ] Read `src/modules/auth/decorators/public.decorator.ts` — know the `@Public()` decorator usage
- [ ] Read `src/modules/auth/guards/roles.guard.ts` and `src/modules/rbac/decorators/roles.decorator.ts`
- [ ] Confirm the module route prefix convention (check existing modules for `@Controller('v1/...')` or just `@Controller('users')`)
- [ ] Read `src/app.module.ts` to know where to insert `UsersModule`

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

### Task 1 — Add issueTokensForMembership() to AuthService

**What:** Open `src/modules/auth/auth.service.ts`. Add this public method that the Users controller will call after invite acceptance:

```typescript
/**
 * Issue access + refresh tokens for a user based on their active membership.
 * Called after invite acceptance to return a full auth response.
 */
async issueTokensForMembership(
  userId: string,
  membershipId: string,
  tenantId: string,
  roles: string[],
  userEmail: string,
  isPlatformAdmin: boolean = false,
): Promise<{ access_token: string; refresh_token: string }> {
  const { accessToken, refreshToken } = await this.generateTokens(
    { id: userId, email: userEmail, is_platform_admin: isPlatformAdmin },
    roles,
    false, // rememberMe = false for invite acceptance
    membershipId,
    tenantId,
  );

  // CRITICAL: Store refresh token hash in DB so JwtRefreshStrategy can validate it.
  // login() does the same after generateTokens(). Without this, the returned
  // refresh_token will be rejected with 401 when the user tries to use it.
  const tokenHash = this.hashToken(refreshToken);
  await this.prisma.refresh_token.create({
    data: {
      id: randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { access_token: accessToken, refresh_token: refreshToken };
}
```

**Note:** `generateTokens()` was updated in Sprint 3 to accept `membershipId` and `tenantId`. This method wraps it cleanly for external callers. `this.hashToken()` and `this.prisma` are already available in `AuthService`. `randomUUID` is already imported (added in Sprint 1).

**Also export `AuthService` from `AuthModule`** if it isn't already (it should be, check auth.module.ts).

---

### Task 2 — Create UsersController

**What:** Create `src/modules/users/controllers/users.controller.ts`.

Read an existing controller for the exact decorator pattern (API prefix, versioning). The platform uses route prefix `api/v1` via the global API prefix in `main.ts`. Controllers should use `@Controller('users')`.

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { AuthService } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { InviteUserDto } from '../dto/invite-user.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { DeactivateUserDto } from '../dto/deactivate-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateMeDto } from '../dto/update-me.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import type { AuthenticatedUser } from '../../auth/entities/jwt-payload.entity';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}
```

**Route decorator pattern reference** — read existing controllers to confirm if `@UseGuards(JwtAuthGuard, RolesGuard)` is applied at class level or method level. Apply consistently with the rest of the codebase.

---

### Task 3 — Implement Invite Endpoints (Owner/Admin only)

**What:** Add to the controller — routes restricted to Owner and Admin roles:

```typescript
  // ── Invite flow — authenticated Owner/Admin ─────────────────────────────

  @Post('invite')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Invite a user to the tenant' })
  @ApiResponse({ status: 201, description: 'Invite created and email sent' })
  @ApiResponse({ status: 409, description: 'Email already has active membership in this tenant' })
  async inviteUser(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: InviteUserDto,
  ) {
    return this.usersService.inviteUser(tenantId, actor.id, dto);
  }

  // ── Invite flow — unauthenticated ────────────────────────────────────────

  @Public()
  @Get('invite/:token')
  @ApiOperation({ summary: 'Validate invite token and return invite info' })
  @ApiResponse({ status: 200, description: 'Invite info returned' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  @ApiResponse({ status: 410, description: 'Token expired' })
  @ApiResponse({ status: 409, description: 'Token already used' })
  async getInviteInfo(@Param('token') token: string) {
    return this.usersService.validateInviteToken(token);
  }

  @Public()
  @Post('invite/:token/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Accept invite, set password, activate membership' })
  @ApiResponse({ status: 201, description: 'Membership activated, JWT returned' })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  @ApiResponse({ status: 410, description: 'Token expired' })
  @ApiResponse({ status: 409, description: 'Token already used or user active in another org' })
  async acceptInvite(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
  ) {
    const data = await this.usersService.acceptInvite(token, dto);

    // Issue JWT for the newly activated user
    const { access_token, refresh_token } = await this.authService.issueTokensForMembership(
      data.user_id,
      data.membership_id,
      data.tenant_id,
      [data.role_name],
      data.user_email,
      false,
    );

    return {
      access_token,
      refresh_token,
      user: {
        id: data.user_id,
        first_name: data.user_first_name,
        last_name: data.user_last_name,
        email: data.user_email,
      },
      tenant: {
        id: data.tenant_id,
        company_name: data.tenant_name,
      },
      role: data.role_name,
    };
  }
```

**Note:** The `acceptInvite()` service method (Sprint 6, Task 4) must be updated to return the full data structure this controller expects. Update the service method return to include:
```typescript
return {
  membership_id: membership.id,
  user_id: membership.user_id,
  tenant_id: membership.tenant_id,
  role_name: membership.role.name,
  user_email: membership.user.email,
  user_first_name: membership.user.first_name,
  user_last_name: membership.user.last_name,
  tenant_name: membership.tenant.company_name,
};
```
Update the `user_tenant_membership.findMany()` in `acceptInvite()` to also include `tenant: true` in the include clause.

---

### Task 4 — Implement User Management Endpoints (Owner/Admin only)

```typescript
  // ── User management — Owner/Admin ────────────────────────────────────────

  @Get()
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List all users in the tenant (paginated)' })
  async listUsers(
    @TenantId() tenantId: string,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.usersService.listUsers(tenantId, query);
  }

  @Get(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get a single user membership by ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  async getUserById(
    @TenantId() tenantId: string,
    @Param('id') membershipId: string,
  ) {
    return this.usersService.getUserById(tenantId, membershipId);
  }

  @Patch(':id/role')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Change role of a user membership' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Cannot change Owner role without Owner privilege' })
  async changeRole(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') membershipId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.changeRole(tenantId, membershipId, actor, dto);
  }

  @Patch(':id/deactivate')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Deactivate user and immediately revoke their JWT' })
  @ApiResponse({ status: 200, description: 'User deactivated, JWT revoked' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate last Owner' })
  async deactivateUser(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') membershipId: string,
    @Body() dto: DeactivateUserDto,
  ) {
    return this.usersService.deactivateUser(tenantId, membershipId, actor.id, dto);
  }

  @Patch(':id/reactivate')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Reactivate an inactive user membership' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409, description: 'User is currently active in another organization' })
  async reactivateUser(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') membershipId: string,
  ) {
    return this.usersService.reactivateUser(tenantId, membershipId, actor.id);
  }

  @Delete(':id')
  @Roles('Owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user (Owner only). Soft or hard delete based on history.' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  async deleteUser(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') membershipId: string,
  ) {
    await this.usersService.deleteUser(tenantId, membershipId, actor.id);
  }
```

---

### Task 5 — Implement Self-Service Endpoints (Any Authenticated User)

```typescript
  // ── Self-service — any authenticated user ────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get own profile and current membership' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id, user.membershipId);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own profile (first_name, last_name, phone, avatar_url)' })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMeDto,
  ) {
    await this.usersService.updateMe(user.id, dto);
    return { message: 'Profile updated.' };
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password (requires current password)' })
  @ApiResponse({ status: 400, description: 'Current password incorrect' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(user.id, dto);
    return { message: 'Password updated.' };
  }
```

Close the controller class with `}`.

---

### Task 6 — Route Order Warning: /me vs /:id

**What:** In NestJS, route parameters are matched in declaration order. The `GET /users/me` route MUST be declared BEFORE `GET /users/:id`. If `/:id` is declared first, a request to `/users/me` will be matched by `/:id` with `id = 'me'`.

Verify the route order in the controller is:
1. `@Get('me')` — FIRST
2. `@Get(':id')` — SECOND

Similarly for `@Get('invite/:token')` — it must come before `@Get(':id')`:
1. `@Get('invite/:token')` — FIRST
2. `@Get(':id')` — AFTER

Arrange all GET routes in the controller in this order:
```
GET /users/invite/:token   (public)
GET /users/me              (authenticated)
GET /users                 (Owner/Admin)
GET /users/:id             (Owner/Admin)
```

---

### Task 7 — Update UsersModule to Include Controller

**What:** Update `src/modules/users/users.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { TokenBlocklistModule } from '../../core/token-blocklist/token-blocklist.module';
import { JobsModule } from '../jobs/jobs.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuditModule, TokenBlocklistModule, JobsModule, AuthModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
```

**Note:** `AuthModule` is imported so `AuthService` is available for the controller's invite acceptance endpoint. `AuthModule` must export `AuthService` — check `auth.module.ts` and add to exports if missing.

---

### Task 8 — Register UsersModule in app.module.ts

**What:** Open `src/app.module.ts`. Import and add `UsersModule` to the imports array. Place it after `RBACModule`:

```typescript
import { UsersModule } from './modules/users/users.module';
// Add to imports array: UsersModule,
```

---

### Task 9 — End-to-End Smoke Tests

**What:** With the dev server running, run these tests:

```bash
# Get a valid token first
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r .access_token)

# Test: List users (Owner/Admin)
curl -s http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test: Get own profile
curl -s http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test: Invite a new user (use a test email)
curl -s -X POST http://localhost:8000/api/v1/users/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"testinvite@example.com","first_name":"Test","last_name":"User","role_id":"<valid_role_uuid>"}' | jq .
```

For the invite test, find a valid `role_id`:
```bash
mysql -u lead360_user -p'978@F32c' -h 127.0.0.1 lead360 \
  -e "SELECT id, name FROM role LIMIT 5;"
```

**Expected responses:**
- `GET /users` → 200 with `{ data: [...], meta: { total, page, limit, total_pages } }`
- `GET /users/me` → 200 with user + membership object
- `POST /users/invite` → 201 with membership object, status = "INVITED"
- Non-admin users → 403 on Owner/Admin-only endpoints

---

## Patterns to Apply

### Decorator Usage
```typescript
@TenantId() tenantId: string
// Injects the tenant_id from the JWT payload (resolved by TenantId decorator)
// Import: import { TenantId } from '../../auth/decorators/tenant-id.decorator'

@CurrentUser() user: AuthenticatedUser
// Injects the full authenticated user object from JWT strategy
// Import: import { CurrentUser } from '../../auth/decorators/current-user.decorator'
// Fields available: user.id, user.email, user.tenant_id, user.membershipId, user.roles, user.is_platform_admin

@Roles('Owner', 'Admin')
// Restricts endpoint to users with the specified roles
// Must be used with RolesGuard applied globally or at controller level

@Public()
// Marks endpoint as unauthenticated (skips JwtAuthGuard)
// Import: import { Public } from '../../auth/decorators/public.decorator'
```

### HTTP Status Codes
| Action | Code |
|---|---|
| POST (created) | 201 |
| GET / PATCH success | 200 |
| DELETE success | 204 (no body) |
| Validation error | 400 |
| Missing/invalid token | 401 |
| Insufficient role | 403 |
| Not found | 404 |
| Conflict (409) | 409 |
| Expired (410) | 410 |

### List Response Envelope
```json
{
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 20, "total_pages": 0 }
}
```

---

## Business Rules Enforced in This Sprint
- RBAC: Owner/Admin = invite, list, view, changeRole, deactivate, reactivate; Owner only = delete; all authenticated = own profile
- `@Public()` on invite token routes (unauthenticated flows)
- GET /users/me declared before GET /users/:id (NestJS route order)

---

## Integration Points
| Module | What |
|---|---|
| AuthService | `issueTokensForMembership()` — new method added in Task 1 |
| UsersService | All business methods from Sprint 6 |
| JwtAuthGuard | Applied globally — no need to apply per-endpoint |
| RolesGuard | Must be applied for @Roles() to take effect |
| TokenBlocklistModule | Provided via UsersModule imports |

---

## Acceptance Criteria
- [ ] `GET /api/v1/users` returns 200 with paginated membership list (Owner/Admin)
- [ ] `GET /api/v1/users/me` returns 200 with own profile + membership
- [ ] `POST /api/v1/users/invite` returns 201 with membership (role = INVITED)
- [ ] `GET /api/v1/users/invite/:token` returns 200 with invite info (public, no auth)
- [ ] `POST /api/v1/users/invite/:token/accept` returns 201 with access_token (public)
- [ ] `PATCH /api/v1/users/:id/deactivate` returns 200; subsequent request with that user's token returns 401 "Token has been revoked."
- [ ] `PATCH /api/v1/users/:id/reactivate` returns 200 or 409 if user active elsewhere
- [ ] `DELETE /api/v1/users/:id` returns 204 (Owner only; non-Owner gets 403)
- [ ] Non-Owner/Admin roles get 403 on management endpoints
- [ ] Dev server compiles with zero TypeScript errors
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 8 until:
1. All listed endpoints return correct status codes verified via curl
2. Deactivation + JWT revocation tested end-to-end (401 on second request)
3. TypeScript compiles with zero errors

---

## Handoff Notes
- Users module is now fully registered at route prefix `/api/v1/users`
- Sprint 8 (Superadmin Endpoints) adds routes to the ADMIN module, not the Users controller
- All users endpoint paths are finalized; do not change them in later sprints
