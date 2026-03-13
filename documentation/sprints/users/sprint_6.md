# Sprint 6 — Users Service: Business Logic
**Module:** users
**File:** ./documentation/sprints/users/sprint_6.md
**Type:** Backend — Service
**Depends On:** Sprint 4 (schema complete), Sprint 5 (DTOs created)
**Gate:** STOP — All service methods must exist and all business rules enforced. Unit tests in Sprint 10 will verify coverage. Verify service file compiles before Sprint 7.
**Estimated Complexity:** High

---

## Objective

Implement `UsersService` — the complete business logic layer for the Users module. This service enforces all 13 business rules from the contract. It handles invite creation, invite acceptance, user listing, role changes, deactivation (with Redis blocklist), reactivation, soft/hard delete, and self-service profile management. All methods are tenant-scoped; all mutations write to the audit log.

This sprint creates `src/modules/users/services/users.service.ts` and `src/modules/users/users.module.ts`. No controller yet — that is Sprint 7.

---

## Pre-Sprint Checklist
- [ ] Sprint 5 gate verified (DTOs compile, no TypeScript errors)
- [ ] Read `src/modules/audit/services/audit-logger.service.ts` — confirm method signature for `logTenantChange()`
- [ ] Read `src/core/token-blocklist/token-blocklist.service.ts` — from Sprint 1
- [ ] Confirm `user_tenant_membership` is queryable: `npx prisma studio` or a direct DB query
- [ ] Read an existing service (e.g., `src/modules/leads/services/leads.service.ts`) to understand the NestJS service pattern used in this codebase
- [ ] Confirm `bcrypt` is available: `cat /var/www/lead360.app/api/package.json | grep bcrypt`
- [ ] Confirm `crypto` is available (Node built-in — always yes)

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

### Task 1 — Create UsersService Skeleton

**What:** Create `src/modules/users/services/users.service.ts` with all method stubs first, then implement each method:

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { TokenBlocklistService } from '../../../core/token-blocklist/token-blocklist.service';
import { JobsService } from '../../jobs/jobs.service';
import { InviteUserDto } from '../dto/invite-user.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { DeactivateUserDto } from '../dto/deactivate-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateMeDto } from '../dto/update-me.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { CreateUserAdminDto } from '../dto/create-user-admin.dto';

@Injectable()
export class UsersService {
  private readonly INVITE_TOKEN_TTL_HOURS = 72;
  private readonly BCRYPT_ROUNDS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly tokenBlocklist: TokenBlocklistService,
    private readonly jobsService: JobsService,
  ) {}
  // ... methods below
}
```

**Note on JobsService:** The `JobsService` (or equivalent BullMQ queue service) is used to dispatch the invite email job. Read the existing `src/modules/jobs/jobs.service.ts` to understand how to dispatch a job. If the pattern uses a `QueueService` or direct Bull `Queue` injection, use that pattern.

---

### Task 2 — Implement inviteUser()

**What:** This method:
1. Validates the role_id exists
2. Checks if user with email already has ACTIVE membership in THIS tenant (409 conflict)
3. Checks if a user record with the email already exists (BR-12: link existing user, don't create new)
4. If no user exists: creates a new `user` record with `is_active = false`
5. If user exists: uses the existing user record
6. Generates invite token: raw = `randomBytes(32).toString('hex')`, hash = `bcrypt.hash(rawToken, 10)`
7. Creates `user_tenant_membership` with `status = INVITED`, `invite_token_hash`, `invite_token_expires_at = now() + 72 hours`, `invited_by_user_id`
8. Dispatches invite email job with the RAW token (not hash)
9. Writes audit log entry
10. Returns the membership response shape

```typescript
async inviteUser(
  tenantId: string,
  actorUserId: string,
  dto: InviteUserDto,
): Promise<InviteResponseDto> {
  // Step 1: Validate role exists
  const role = await this.prisma.role.findUnique({
    where: { id: dto.role_id },
  });
  if (!role) {
    throw new NotFoundException('Role not found.');
  }

  // Step 2: Check if email already has ACTIVE membership in this tenant
  const existingActiveMembership = await this.prisma.user_tenant_membership.findFirst({
    where: {
      tenant_id: tenantId,
      status: 'ACTIVE',
      user: { email: dto.email },
    },
    include: { user: true },
  });
  if (existingActiveMembership) {
    throw new ConflictException(
      'This email already has an active membership in this organization.',
    );
  }

  // Step 3: Find or create user record (BR-12)
  let user = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });

  if (!user) {
    user = await this.prisma.user.create({
      data: {
        id: require('crypto').randomUUID(),
        email: dto.email,
        first_name: dto.first_name,
        last_name: dto.last_name,
        password_hash: '', // Will be set when invite is accepted
        is_active: false,
        updated_at: new Date(),
      },
    });
  }

  // Step 4: Generate invite token
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, this.BCRYPT_ROUNDS);
  const expiresAt = new Date(
    Date.now() + this.INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000,
  );

  // Step 5: Create membership
  const membership = await this.prisma.user_tenant_membership.create({
    data: {
      user_id: user.id,
      tenant_id: tenantId,
      role_id: dto.role_id,
      status: 'INVITED',
      invite_token_hash: tokenHash,
      invite_token_expires_at: expiresAt,
      invited_by_user_id: actorUserId,
    },
    include: { role: true, user: true, invited_by: true },
  });

  // Step 6: Dispatch invite email job (Sprint 9 implements the job handler)
  await this.jobsService.dispatch('user-invite', {
    email: dto.email,
    first_name: dto.first_name,
    last_name: dto.last_name,
    raw_token: rawToken,
    tenant_id: tenantId,
    invited_by_user_id: actorUserId,
    role_name: role.name,
    expires_at: expiresAt.toISOString(),
  });

  // Step 7: Audit log
  await this.auditLogger.logTenantChange({
    action: 'created',
    entityType: 'UserMembership',
    entityId: membership.id,
    tenantId,
    actorUserId,
    after: { email: dto.email, role: role.name, status: 'INVITED' },
    description: `Invited ${dto.email} as ${role.name}`,
  });

  return {
    id: membership.id,
    user_id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: { id: role.id, name: role.name },
    status: 'INVITED',
    created_at: membership.created_at.toISOString(),
  };
}
```

**Note on JobsService.dispatch():** Read the existing `JobsService` to find the correct method for dispatching a background job. If it's `addJob()`, `add()`, or `dispatch()`, use that exact method. Pass the job name `'user-invite'` and the payload.

---

### Task 3 — Implement validateInviteToken()

**What:** Called by `GET /users/invite/:token` (unauthenticated). Returns invite metadata or throws.

```typescript
async validateInviteToken(rawToken: string): Promise<InviteTokenInfoDto> {
  // Find memberships with unexpired invite tokens (we must check all and compare hash)
  // Strategy: find candidate memberships where token is not yet expired and status = INVITED
  const candidates = await this.prisma.user_tenant_membership.findMany({
    where: {
      status: 'INVITED',
      invite_token_expires_at: { gt: new Date() },
      invite_token_hash: { not: null },
    },
    include: {
      user: true,
      tenant: true,
      role: true,
      invited_by: true,
    },
  });

  // Compare hash of provided raw token against stored hashes
  let membership: typeof candidates[0] | null = null;
  for (const candidate of candidates) {
    if (
      candidate.invite_token_hash &&
      (await bcrypt.compare(rawToken, candidate.invite_token_hash))
    ) {
      membership = candidate;
      break;
    }
  }

  if (!membership) {
    // Check if token exists but is expired
    const expiredCandidates = await this.prisma.user_tenant_membership.findMany({
      where: {
        status: 'INVITED',
        invite_token_expires_at: { lte: new Date() },
        invite_token_hash: { not: null },
      },
    });
    for (const c of expiredCandidates) {
      if (c.invite_token_hash && (await bcrypt.compare(rawToken, c.invite_token_hash))) {
        throw new GoneException('This invite link has expired.');
      }
    }
    throw new NotFoundException('Invalid invite token.');
  }

  return {
    tenant_name: membership.tenant.company_name,
    role_name: membership.role.name,
    invited_by_name: membership.invited_by
      ? `${membership.invited_by.first_name} ${membership.invited_by.last_name}`
      : 'Unknown',
    email: membership.user.email,
    expires_at: membership.invite_token_expires_at!.toISOString(),
  };
}
```

**Performance Note:** The bcrypt comparison loop is acceptable for invite validation (low frequency operation). For large datasets, consider adding a lookup index strategy in the future.

---

### Task 4 — Implement acceptInvite()

**What:** Called by `POST /users/invite/:token/accept`. Sets password, activates membership, issues JWT.

```typescript
async acceptInvite(
  rawToken: string,
  dto: AcceptInviteDto,
): Promise<AcceptInviteResponseDto> {
  // Step 1: Find and validate token (same bcrypt search as validateInviteToken)
  // Check for expired first, then not found, then found+valid
  // BR-05: Mark token as USED immediately (update invite_accepted_at) regardless of outcome after this point

  // Find the matching membership (reuse logic from validateInviteToken)
  // ...

  if (!membership) {
    // check if already accepted (invite_accepted_at is set but still INVITED)
    throw new NotFoundException('Invalid invite token.');
  }
  if (membership.invite_token_expires_at! < new Date()) {
    throw new GoneException('This invite link has expired.');
  }
  if (membership.invite_accepted_at) {
    throw new ConflictException('This invite link has already been used.');
  }

  // BR-02: Enforce one ACTIVE membership per user at a time
  const existingActiveMembership = await this.prisma.user_tenant_membership.findFirst({
    where: {
      user_id: membership.user_id,
      status: 'ACTIVE',
      id: { not: membership.id },
    },
  });
  if (existingActiveMembership) {
    throw new ConflictException('User is currently active in another organization.');
  }

  // Step 2: Hash password
  const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

  // Step 3: Atomic transaction — update user + activate membership
  await this.prisma.$transaction(async (tx) => {
    // Mark token as used immediately (BR-05)
    await tx.user_tenant_membership.update({
      where: { id: membership.id },
      data: {
        invite_accepted_at: new Date(),
        status: 'ACTIVE',
        joined_at: new Date(),
        invite_token_hash: null, // Clear the token hash — it's single-use
      },
    });

    // Update user: set password, activate
    await tx.user.update({
      where: { id: membership.user_id },
      data: {
        password_hash: passwordHash,
        is_active: true,
        email_verified: true,
        email_verified_at: new Date(),
      },
    });
  });

  // Step 4: Audit log
  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'UserMembership',
    entityId: membership.id,
    tenantId: membership.tenant_id,
    actorUserId: membership.user_id,
    after: { status: 'ACTIVE', joined_at: new Date() },
    description: `Invite accepted by ${membership.user.email}`,
  });

  // Step 5: Issue JWT — import JwtService or call AuthService
  // NOTE: The service cannot directly import JwtService without circular dependency issues.
  // Instead, return the membership data and let the controller call auth service for token issuance,
  // OR inject JwtService directly here.
  // PREFERRED: Inject JwtService directly (it's exported from AuthModule).
  // Return enough data for the controller to issue tokens:
  return {
    membership_id: membership.id,
    user_id: membership.user_id,
    tenant_id: membership.tenant_id,
    role_name: membership.role.name,
    // Controller will use this data to issue JWT via AuthService
  } as any; // Type will be refined in Sprint 7 when controller handles token issuance
}
```

**Important architecture note:** JWT issuance requires `AuthService`. To avoid circular dependencies:
- Option A: Have the controller call `AuthService.generateTokensForMembership()` after `UsersService.acceptInvite()` returns the membership data
- Option B: Inject `JwtService` directly into `UsersService`

**Use Option A.** The controller calls `acceptInvite()` to get membership data, then calls a new `AuthService` method `issueTokensForMembership(userId, membershipId, tenantId, roleNames)` to get tokens. The response is assembled in the controller.

This means Sprint 7 (controller) will also add a thin method to `AuthService`:
```typescript
// Add to auth.service.ts in Sprint 7:
async issueTokensForMembership(
  userId: string,
  membershipId: string,
  tenantId: string,
  roles: string[],
  userEmail: string,
  isAdmin: boolean,
): Promise<{ access_token: string; refresh_token: string }>
```

---

### Task 5 — Implement listUsers()

```typescript
async listUsers(
  tenantId: string,
  query: ListUsersQueryDto,
): Promise<PaginatedMembershipsDto> {
  const { page, limit, status, role_id } = query;
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
    data: memberships.map((m) => this.formatMembership(m)),
    meta: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    },
  };
}
```

---

### Task 6 — Implement getUserById()

```typescript
async getUserById(
  tenantId: string,
  membershipId: string,
): Promise<MembershipResponseDto> {
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { id: membershipId, tenant_id: tenantId },
    include: {
      user: true,
      role: true,
      invited_by: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  if (!membership) {
    throw new NotFoundException('User membership not found in this organization.');
  }

  return this.formatMembership(membership);
}
```

---

### Task 7 — Implement changeRole()

**Business rules: BR-08, BR-09**

```typescript
async changeRole(
  tenantId: string,
  membershipId: string,
  actorUser: { id: string; roles: string[] },
  dto: UpdateUserRoleDto,
): Promise<MembershipResponseDto> {
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { id: membershipId, tenant_id: tenantId },
    include: { role: true },
  });

  if (!membership) throw new NotFoundException('Membership not found.');

  // BR-09: Admin cannot change Owner's role
  if (
    membership.role.name === 'Owner' &&
    !actorUser.roles.includes('Owner') &&
    !actorUser.roles.includes('SuperAdmin')
  ) {
    throw new ForbiddenException(
      'Only an Owner or SuperAdmin can change the role of an Owner.',
    );
  }

  const newRole = await this.prisma.role.findUnique({ where: { id: dto.role_id } });
  if (!newRole) throw new NotFoundException('Role not found.');

  const beforeRole = membership.role.name;

  const updated = await this.prisma.user_tenant_membership.update({
    where: { id: membershipId },
    data: { role_id: dto.role_id },
    include: {
      role: true,
      user: true,
      invited_by: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  // BR-08: Audit every role change
  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'UserMembership',
    entityId: membershipId,
    tenantId,
    actorUserId: actorUser.id,
    before: { role: beforeRole },
    after: { role: newRole.name },
    description: `Role changed from ${beforeRole} to ${newRole.name}`,
  });

  return this.formatMembership(updated);
}
```

---

### Task 8 — Implement deactivateUser()

**Business rules: BR-04, BR-10**

```typescript
async deactivateUser(
  tenantId: string,
  membershipId: string,
  actorUserId: string,
  dto: DeactivateUserDto,
): Promise<{ id: string; status: string; left_at: string }> {
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { id: membershipId, tenant_id: tenantId, status: 'ACTIVE' },
    include: { role: true },
  });

  if (!membership) throw new NotFoundException('Active membership not found.');

  // BR-10: Last active Owner check
  if (membership.role.name === 'Owner') {
    const activeOwnerCount = await this.prisma.user_tenant_membership.count({
      where: {
        tenant_id: tenantId,
        status: 'ACTIVE',
        role: { name: 'Owner' },
      },
    });
    if (activeOwnerCount <= 1) {
      throw new BadRequestException(
        'Tenant must have at least one active Owner.',
      );
    }
  }

  const leftAt = new Date();

  // BR-04: Deactivation is atomic — DB update + Redis blocklist in same operation
  await this.prisma.$transaction(async (tx) => {
    await tx.user_tenant_membership.update({
      where: { id: membershipId },
      data: { status: 'INACTIVE', left_at: leftAt },
    });
    await tx.user.update({
      where: { id: membership.user_id },
      data: { is_active: false },
    });
  });

  // BR-04: Immediately push user's JWT jti to Redis blocklist
  await this.tokenBlocklist.blockUserTokens(membership.user_id);

  // Audit log
  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'UserMembership',
    entityId: membershipId,
    tenantId,
    actorUserId,
    before: { status: 'ACTIVE' },
    after: { status: 'INACTIVE', left_at: leftAt },
    description: `User deactivated${dto.reason ? ': ' + dto.reason : ''}`,
  });

  return { id: membershipId, status: 'INACTIVE', left_at: leftAt.toISOString() };
}
```

---

### Task 9 — Implement reactivateUser()

**Business rules: BR-02, BR-03**

```typescript
async reactivateUser(
  tenantId: string,
  membershipId: string,
  actorUserId: string,
): Promise<{ id: string; status: string; joined_at: string }> {
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { id: membershipId, tenant_id: tenantId, status: 'INACTIVE' },
  });
  if (!membership) throw new NotFoundException('Inactive membership not found.');

  // BR-02, BR-03: Block if user has ANY other ACTIVE membership
  const otherActiveMembership = await this.prisma.user_tenant_membership.findFirst({
    where: {
      user_id: membership.user_id,
      status: 'ACTIVE',
      id: { not: membershipId },
    },
    include: { tenant: true },
  });
  if (otherActiveMembership) {
    throw new ConflictException('User is currently active in another organization.');
  }

  const now = new Date();

  await this.prisma.$transaction(async (tx) => {
    await tx.user_tenant_membership.update({
      where: { id: membershipId },
      data: { status: 'ACTIVE', joined_at: now, left_at: null },
    });
    await tx.user.update({
      where: { id: membership.user_id },
      data: { is_active: true },
    });
  });

  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'UserMembership',
    entityId: membershipId,
    tenantId,
    actorUserId,
    before: { status: 'INACTIVE' },
    after: { status: 'ACTIVE', joined_at: now },
    description: 'User reactivated',
  });

  return { id: membershipId, status: 'ACTIVE', joined_at: now.toISOString() };
}
```

---

### Task 10 — Implement deleteUser()

**Business rules: BR-06, BR-07**

```typescript
async deleteUser(
  tenantId: string,
  membershipId: string,
  actorUserId: string,
): Promise<void> {
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { id: membershipId, tenant_id: tenantId },
    include: { user: true },
  });
  if (!membership) throw new NotFoundException('Membership not found.');

  const userId = membership.user_id;

  // BR-06: Check if user has any audit_log references (FK check before hard delete)
  const auditLogRef = await this.prisma.audit_log.count({
    where: { actor_user_id: userId },
  });

  if (auditLogRef > 0) {
    // Soft delete only — preserve FK integrity (BR-06, BR-07)
    await this.prisma.user.update({
      where: { id: userId },
      data: { deleted_at: new Date(), is_active: false },
    });
    // Also deactivate the membership
    await this.prisma.user_tenant_membership.update({
      where: { id: membershipId },
      data: { status: 'INACTIVE', left_at: new Date() },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'User',
      entityId: userId,
      tenantId,
      actorUserId,
      before: { email: membership.user.email },
      description: 'User soft-deleted (has audit log history)',
    });
  } else {
    // Hard delete — no FK references
    await this.prisma.$transaction(async (tx) => {
      await tx.user_tenant_membership.deleteMany({ where: { user_id: userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'User',
      entityId: userId,
      tenantId,
      actorUserId,
      before: { email: membership.user.email },
      description: 'User hard-deleted',
    });
  }
}
```

**IMPORTANT:** The audit log check (`count where actor_user_id = userId`) is the primary FK check per the contract. If the Prisma delete fails due to other FK constraints, catch the Prisma constraint error and fall back to soft delete.

---

### Task 11 — Implement getMe(), updateMe(), changePassword()

```typescript
async getMe(userId: string, membershipId: string): Promise<UserMeResponseDto> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) throw new NotFoundException('User not found.');

  const membership = await this.prisma.user_tenant_membership.findUnique({
    where: { id: membershipId },
    include: { role: true },
  });
  if (!membership) throw new NotFoundException('Membership not found.');

  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone ?? null,
    avatar_url: null, // Handled by files module if integrated
    membership: {
      id: membership.id,
      tenant_id: membership.tenant_id,
      role: { id: membership.role.id, name: membership.role.name },
      status: membership.status,
      joined_at: membership.joined_at?.toISOString() ?? null,
    },
  };
}

async updateMe(userId: string, dto: UpdateMeDto): Promise<void> {
  await this.prisma.user.update({
    where: { id: userId },
    data: {
      ...(dto.first_name && { first_name: dto.first_name }),
      ...(dto.last_name && { last_name: dto.last_name }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
    },
  });
}

async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException('User not found.');

  const valid = await bcrypt.compare(dto.current_password, user.password_hash);
  if (!valid) throw new BadRequestException('Current password is incorrect.');

  const newHash = await bcrypt.hash(dto.new_password, this.BCRYPT_ROUNDS);
  await this.prisma.user.update({
    where: { id: userId },
    data: { password_hash: newHash },
  });
}
```

---

### Task 12 — Add Private formatMembership() Helper

```typescript
private formatMembership(m: any): MembershipResponseDto {
  return {
    id: m.id,
    user_id: m.user_id,
    first_name: m.user.first_name,
    last_name: m.user.last_name,
    email: m.user.email,
    phone: m.user.phone ?? null,
    avatar_url: null, // files module integration point
    role: { id: m.role.id, name: m.role.name },
    status: m.status,
    joined_at: m.joined_at?.toISOString() ?? null,
    left_at: m.left_at?.toISOString() ?? null,
    invited_by: m.invited_by
      ? {
          id: m.invited_by.id,
          first_name: m.invited_by.first_name,
          last_name: m.invited_by.last_name,
        }
      : null,
    created_at: m.created_at.toISOString(),
  };
}
```

---

### Task 13 — Create UsersModule

**What:** Create `src/modules/users/users.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { UsersService } from './services/users.service';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { TokenBlocklistModule } from '../../core/token-blocklist/token-blocklist.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [PrismaModule, AuditModule, TokenBlocklistModule, JobsModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

---

## Patterns to Apply

### Multi-Tenant Enforcement
Every Prisma query on `user_tenant_membership` must include `tenant_id` in the `where` clause when it is a tenant-scoped operation. Only `getMe()`, `changePassword()`, and the invite acceptance flow operate without `tenant_id` (they use `user_id` directly).

### AuditLoggerService
```typescript
await this.auditLogger.logTenantChange({
  action: 'created' | 'updated' | 'deleted' | 'accessed',
  entityType: 'UserMembership' | 'User',
  entityId: string,
  tenantId: string,
  actorUserId: string,
  before?: object,
  after?: object,
  description: string,
});
```

### TokenBlocklistService (from Sprint 1)
```typescript
// Block a user's active token on deactivation:
await this.tokenBlocklist.blockUserTokens(userId);
// This reads user_active_token:{userId} from Redis, calculates remaining TTL,
// writes blocked_token:{jti}, and cleans up the tracking key.
```

### HTTP Status Codes Used
| Exception Class | HTTP Code |
|---|---|
| NotFoundException | 404 |
| ConflictException | 409 |
| ForbiddenException | 403 |
| BadRequestException | 400 |
| GoneException | 410 |

---

## Business Rules Enforced in This Sprint
- **BR-02:** One ACTIVE membership per user — checked in reactivateUser() and acceptInvite()
- **BR-03:** Reactivation blocked if another ACTIVE membership exists — checked in reactivateUser()
- **BR-04:** Deactivation sets status=INACTIVE, left_at=now(), and blocks JWT via tokenBlocklist.blockUserTokens()
- **BR-05:** Invite token expires 72 hours after creation; single-use (invite_accepted_at set immediately)
- **BR-06:** Hard delete blocked if audit_log references exist — falls back to soft delete
- **BR-07:** Soft-deleted users retain their user_id FK references
- **BR-08:** Every role change writes audit log with before/after
- **BR-09:** Admin cannot change Owner's role
- **BR-10:** Last active Owner cannot be deactivated
- **BR-12:** Invite to existing email links existing user record, no new user created

---

## Acceptance Criteria
- [ ] `src/modules/users/services/users.service.ts` compiles with zero TypeScript errors
- [ ] `src/modules/users/users.module.ts` compiles
- [ ] Dev server starts with no new errors (module not yet registered in app.module.ts — that's Sprint 7)
- [ ] `npx tsc --noEmit` returns zero errors
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 7 until:
1. `npx tsc --noEmit` returns zero errors
2. Dev server compiles (even though users endpoints are not yet accessible)

---

## Handoff Notes
- `UsersModule` is NOT yet registered in `app.module.ts` — Sprint 7 does that
- The `acceptInvite()` method returns raw data, not a full `AcceptInviteResponseDto` — Sprint 7 controller assembles the final response by calling `AuthService.issueTokensForMembership()`
- Sprint 7 must add a thin `issueTokensForMembership()` method to `auth.service.ts`
- The `jobsService.dispatch('user-invite', payload)` call — Sprint 9 implements the job handler; Sprint 7 ensures the job is dispatched correctly from the service
