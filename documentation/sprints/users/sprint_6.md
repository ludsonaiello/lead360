# Sprint 6 — Users Service: Business Logic
**Module:** users
**File:** ./documentation/sprints/users/sprint_6.md
**Type:** Backend — Service
**Depends On:** Sprint 4 (schema complete), Sprint 5 (DTOs created)
**Gate:** STOP — All service methods must exist and all business rules enforced. Verify service compiles with zero TypeScript errors before Sprint 7.
**Estimated Complexity:** High

---

## Objective

Implement `UsersService` — the complete business logic layer for the Users module. This service enforces all 13 business rules from the contract. Covers invite creation, invite acceptance, user listing, role changes, deactivation (with Redis blocklist), reactivation, soft/hard delete, and self-service profile management. All writes go through the audit log.

This sprint creates `src/modules/users/services/users.service.ts` and `src/modules/users/users.module.ts`. No controller yet — that is Sprint 7.

---

## Pre-Sprint Checklist
- [ ] Sprint 5 gate verified (DTOs compile, no TypeScript errors)
- [ ] Read `src/modules/audit/services/audit-logger.service.ts` — confirm `logTenantChange()` signature
- [ ] Read `src/core/token-blocklist/token-blocklist.service.ts` — from Sprint 1
- [ ] Read `src/modules/audit/jobs/audit-log-write.job.ts` — understand how this codebase dispatches BullMQ jobs (what queue name, how it injects the Queue)
- [ ] Read `src/modules/audit/audit.module.ts` — see how BullModule.registerQueue() is configured for the audit queue. Note the queue name used.
- [ ] Read an existing service (e.g., `src/modules/leads/services/leads.service.ts`) to understand the NestJS service pattern
- [ ] Confirm `bcrypt` is available: `cat /var/www/lead360.app/api/package.json | grep bcrypt`
- [ ] Verify that `Prisma` types are importable: `import { Prisma } from '@prisma/client'` should work after Sprint 4's `npx prisma generate`

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

### Task 1 — Understand the Email Infrastructure in This Codebase

**What:** Before writing any service code, read how emails are dispatched in the existing codebase:

1. Read `src/modules/jobs/services/job-queue.service.ts` FULLY — note the `queueEmail()` method signature
2. Read `src/modules/jobs/processors/send-email.processor.ts` — understand the processing pipeline
3. Read `src/modules/jobs/services/email.service.ts` — understand template rendering
4. Read `src/modules/jobs/jobs.module.ts` — confirm `JobQueueService` is exported

**Result of this analysis (already confirmed):**
- **Service**: `JobQueueService` — inject directly (no `@InjectQueue` needed in UsersService)
- **Method**: `jobQueueService.queueEmail({ to, templateKey, variables, tenantId })`
- **Pipeline**: `queueEmail()` → adds `'send-email'` job to `'email'` queue → `SendEmailProcessor` picks it up → `EmailService.sendTemplatedEmail()` renders template → `SmtpService.sendEmail()` delivers
- **Template**: Looked up by `templateKey` from the `email_template` table in the database
- **Sprint 9** will create the `'user-invite'` email template record in the database

You will inject `JobQueueService` in UsersService and call `queueEmail()` to dispatch invite emails.

---

### Task 2 — Create UsersService with Full Implementation

**What:** Create `src/modules/users/services/users.service.ts`.

**Critical imports — use only ES module imports, never `require()`:**
```typescript
import { Injectable, NotFoundException, ConflictException, ForbiddenException,
         BadRequestException, GoneException, InternalServerErrorException } from '@nestjs/common';
import { randomBytes, randomUUID, createHash } from 'crypto'; // ALL from ES module import
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { TokenBlocklistService } from '../../../core/token-blocklist/token-blocklist.service';
import { JobQueueService } from '../../jobs/services/job-queue.service';
import { ConfigService } from '@nestjs/config';
import { InviteUserDto } from '../dto/invite-user.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { DeactivateUserDto } from '../dto/deactivate-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateMeDto } from '../dto/update-me.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import {
  InviteResponseDto, MembershipResponseDto, PaginatedMembershipsDto,
  UserMeResponseDto, InviteTokenInfoDto,
} from '../dto/membership-response.dto';
```

**Note on service injection**: This codebase uses `@nestjs/bullmq` with `bullmq` v5. Email dispatch goes through `JobQueueService.queueEmail()` which queues a `'send-email'` job on the `'email'` queue. The existing `SendEmailProcessor` handles it using `EmailService.sendTemplatedEmail()`. This means invite emails use the **same proven email pipeline** as every other email in the platform — no custom processor needed.
```typescript
@Injectable()
export class UsersService {
  private readonly INVITE_TOKEN_TTL_HOURS = 72;
  private readonly BCRYPT_ROUNDS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly tokenBlocklist: TokenBlocklistService,
    private readonly jobQueueService: JobQueueService,
    private readonly configService: ConfigService,
  ) {}
```

---

### Task 3 — Implement inviteUser()

**Token hashing:** Invite tokens use SHA-256 (NOT bcrypt). SHA-256 of a cryptographically secure random token provides sufficient security and enables O(1) direct index lookup via the `@unique` constraint on `invite_token_hash`. bcrypt is for passwords, not tokens.

```typescript
async inviteUser(
  tenantId: string,
  actorUserId: string,
  dto: InviteUserDto,
): Promise<InviteResponseDto> {
  // Step 1: Validate role exists
  const role = await this.prisma.role.findUnique({ where: { id: dto.role_id } });
  if (!role) throw new NotFoundException('Role not found.');

  // Step 2: Check if this email already has an ACTIVE membership in this tenant (409)
  const existingActive = await this.prisma.user_tenant_membership.findFirst({
    where: {
      tenant_id: tenantId,
      status: 'ACTIVE',
      user: { email: dto.email },
    },
  });
  if (existingActive) {
    throw new ConflictException('This email already has an active membership in this organization.');
  }

  // Step 3: Find or create the user record — BR-12: link existing user, never duplicate
  let user = await this.prisma.user.findUnique({ where: { email: dto.email } });

  // Step 4: Generate invite token — SHA-256 for O(1) indexed lookup
  const rawToken = randomBytes(32).toString('hex'); // 64-char hex string
  const tokenHash = createHash('sha256').update(rawToken).digest('hex'); // 64-char SHA-256 hex
  const expiresAt = new Date(Date.now() + this.INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  // Step 5: Atomic — create user (if new) + membership in one transaction
  let membershipId: string;
  await this.prisma.$transaction(async (tx) => {
    if (!user) {
      user = await tx.user.create({
        data: {
          id: randomUUID(),
          email: dto.email,
          first_name: dto.first_name,
          last_name: dto.last_name,
          password_hash: '', // Set when invite is accepted
          is_active: false,
          updated_at: new Date(),
        },
      });
    }

    const membership = await tx.user_tenant_membership.create({
      data: {
        user_id: user!.id,
        tenant_id: tenantId,
        role_id: dto.role_id,
        status: 'INVITED',
        invite_token_hash: tokenHash,
        invite_token_expires_at: expiresAt,
        invited_by_user_id: actorUserId,
      },
    });
    membershipId = membership.id;
  });

  // Step 6: Resolve tenant name and inviter name, then dispatch via existing email infrastructure
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { company_name: true },
  });
  const inviter = await this.prisma.user.findUnique({
    where: { id: actorUserId },
    select: { first_name: true, last_name: true },
  });

  const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'https://app.lead360.app';
  const inviteLink = `${frontendUrl}/invite/${rawToken}`;

  await this.jobQueueService.queueEmail({
    to: dto.email,
    templateKey: 'user-invite',
    tenantId,
    variables: {
      first_name: dto.first_name,
      last_name: dto.last_name,
      invite_link: inviteLink,
      tenant_name: tenant?.company_name ?? 'Lead360',
      inviter_name: inviter ? `${inviter.first_name} ${inviter.last_name}` : 'Your administrator',
      role_name: role.name,
      expires_at: expiresAt.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }),
    },
  });

  // Step 7: Audit log
  await this.auditLogger.logTenantChange({
    action: 'created',
    entityType: 'UserMembership',
    entityId: membershipId!,
    tenantId,
    actorUserId,
    after: { email: dto.email, role: role.name, status: 'INVITED' },
    description: `Invited ${dto.email} as ${role.name}`,
  });

  return {
    id: membershipId!,
    user_id: user!.id,
    email: user!.email,
    first_name: user!.first_name,
    last_name: user!.last_name,
    role: { id: role.id, name: role.name },
    status: 'INVITED',
    created_at: new Date().toISOString(),
  };
}
```

---

### Task 4 — Implement validateInviteToken()

**Direct O(1) lookup by SHA-256 hash — no full table scan:**

```typescript
async validateInviteToken(rawToken: string): Promise<InviteTokenInfoDto> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  // Direct index lookup — invite_token_hash has @unique constraint
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { invite_token_hash: tokenHash },
    include: {
      user: true,
      tenant: true,
      role: true,
      invited_by: true,
    },
  });

  if (!membership) {
    throw new NotFoundException('Invalid invite token.');
  }

  // Check if already accepted before checking expiry — more specific error
  if (membership.invite_accepted_at !== null) {
    throw new ConflictException('This invite link has already been used.');
  }

  if (membership.invite_token_expires_at! < new Date()) {
    throw new GoneException('This invite link has expired.');
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

---

### Task 5 — Implement acceptInvite()

**Complete implementation — no placeholders:**

```typescript
async acceptInvite(
  rawToken: string,
  dto: AcceptInviteDto,
): Promise<{
  membership_id: string;
  user_id: string;
  tenant_id: string;
  role_name: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  tenant_name: string;
}> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  // Direct index lookup — O(1) via @unique constraint
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { invite_token_hash: tokenHash },
    include: { user: true, role: true, tenant: true },
  });

  if (!membership) {
    throw new NotFoundException('Invalid invite token.');
  }

  // Check already-accepted BEFORE expiry — more specific error (BR-05)
  if (membership.invite_accepted_at !== null) {
    throw new ConflictException('This invite link has already been used.');
  }

  if (membership.invite_token_expires_at! < new Date()) {
    throw new GoneException('This invite link has expired.');
  }

  // BR-02: Block acceptance if user already has an ACTIVE membership elsewhere
  const otherActiveMembership = await this.prisma.user_tenant_membership.findFirst({
    where: {
      user_id: membership.user_id,
      status: 'ACTIVE',
      id: { not: membership.id },
    },
  });
  if (otherActiveMembership) {
    throw new ConflictException('User is currently active in another organization.');
  }

  const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

  // BR-05: Single-use — mark accepted_at and activate atomically
  await this.prisma.$transaction(async (tx) => {
    await tx.user_tenant_membership.update({
      where: { id: membership.id },
      data: {
        invite_accepted_at: new Date(),
        status: 'ACTIVE',
        joined_at: new Date(),
        invite_token_hash: null, // Clear hash — token is consumed
      },
    });

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

  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'UserMembership',
    entityId: membership.id,
    tenantId: membership.tenant_id,
    actorUserId: membership.user_id,
    after: { status: 'ACTIVE', joined_at: new Date() },
    description: `Invite accepted by ${membership.user.email}`,
  });

  // Return raw membership data — the controller (Sprint 7) calls AuthService to issue tokens
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
}
```

---

### Task 6 — Implement listUsers()

```typescript
async listUsers(
  tenantId: string,
  query: ListUsersQueryDto,
): Promise<PaginatedMembershipsDto> {
  const { page, limit, status, role_id } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.user_tenant_membershipWhereInput = { tenant_id: tenantId };
  if (status) where.status = status;
  if (role_id) where.role_id = role_id;

  const [memberships, total] = await Promise.all([
    this.prisma.user_tenant_membership.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: { where: { deleted_at: null } }, // BR-07: exclude soft-deleted users
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

### Task 7 — Implement getUserById()

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

### Task 8 — Implement changeRole()

**BR-08, BR-09. Note: `is_platform_admin` is a boolean on `AuthenticatedUser` — NOT a role name string:**

```typescript
async changeRole(
  tenantId: string,
  membershipId: string,
  actorUser: { id: string; roles: string[]; is_platform_admin: boolean },
  dto: UpdateUserRoleDto,
): Promise<MembershipResponseDto> {
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { id: membershipId, tenant_id: tenantId },
    include: { role: true },
  });

  if (!membership) throw new NotFoundException('Membership not found.');

  // BR-09: Only an Owner or platform admin can change an Owner's role
  if (
    membership.role.name === 'Owner' &&
    !actorUser.roles.includes('Owner') &&
    !actorUser.is_platform_admin   // ← is_platform_admin boolean, not a role string
  ) {
    throw new ForbiddenException(
      'Only an Owner or platform administrator can change the role of an Owner.',
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

  // BR-08: Every role change is written to audit log with before/after state
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

### Task 9 — Implement deactivateUser()

**BR-04, BR-10:**

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

  const leftAt = new Date();

  // BR-10 + deactivation inside a single transaction to prevent TOCTOU race condition
  // (Contract §14: "Service uses DB-level transaction for the check-and-deactivate operation")
  await this.prisma.$transaction(async (tx) => {
    // BR-10: Cannot deactivate the last active Owner — checked inside transaction
    if (membership.role.name === 'Owner') {
      const activeOwnerCount = await tx.user_tenant_membership.count({
        where: {
          tenant_id: tenantId,
          status: 'ACTIVE',
          role: { name: 'Owner' },
        },
      });
      if (activeOwnerCount <= 1) {
        throw new BadRequestException('Tenant must have at least one active Owner.');
      }
    }

    await tx.user_tenant_membership.update({
      where: { id: membershipId },
      data: { status: 'INACTIVE', left_at: leftAt },
    });
    await tx.user.update({
      where: { id: membership.user_id },
      data: { is_active: false },
    });
  });

  // BR-04: Immediately push user's active JWT jti to Redis blocklist
  // This runs outside the DB transaction intentionally — Redis and MySQL cannot share transactions
  await this.tokenBlocklist.blockUserTokens(membership.user_id);

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

### Task 10 — Implement reactivateUser()

**BR-02, BR-03:**

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

  // BR-02, BR-03: User must have NO other ACTIVE membership anywhere
  const otherActive = await this.prisma.user_tenant_membership.findFirst({
    where: {
      user_id: membership.user_id,
      status: 'ACTIVE',
      id: { not: membershipId },
    },
  });
  if (otherActive) {
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

### Task 11 — Implement deleteUser()

**BR-06, BR-07. Check audit_log AND catch Prisma FK constraint errors from other tables:**

```typescript
async deleteUser(
  tenantId: string,
  membershipId: string,
  actorUserId: string,
): Promise<void> {
  const membership = await this.prisma.user_tenant_membership.findFirst({
    where: { id: membershipId, tenant_id: tenantId },
    include: { user: true, role: true },
  });
  if (!membership) throw new NotFoundException('Membership not found.');

  const userId = membership.user_id;

  // BR-06: Check audit_log first — fast check for the most common FK reference
  const auditLogRef = await this.prisma.audit_log.count({
    where: { actor_user_id: userId },
  });

  if (auditLogRef > 0) {
    // Soft delete — preserve FK integrity (BR-06, BR-07)
    await this.prisma.user.update({
      where: { id: userId },
      data: { deleted_at: new Date(), is_active: false },
    });
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
    return;
  }

  // Hard delete — attempt to remove all memberships then the user
  // Catch Prisma P2003 (FK constraint) from other tables (quotes, leads, projects, etc.)
  try {
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
  } catch (err: any) {
    // BR-06: If any other table has an FK reference → fall back to soft delete
    if (err?.code === 'P2003' || err?.code === 'P2014') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { deleted_at: new Date(), is_active: false },
      });
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
        description: 'User soft-deleted (FK constraints in other tables)',
      });
    } else {
      throw err; // unexpected error — re-throw
    }
  }
}
```

---

### Task 12 — Implement getMe(), updateMe(), changePassword()

```typescript
async getMe(userId: string, membershipId: string): Promise<UserMeResponseDto> {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
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
    avatar_url: null, // files module integration point — add when FilesModule is integrated
    membership: {
      id: membership.id,
      tenant_id: membership.tenant_id,
      role: { id: membership.role.id, name: membership.role.name },
      status: membership.status as string,
      joined_at: membership.joined_at?.toISOString() ?? null,
    },
  };
}

async updateMe(userId: string, dto: UpdateMeDto): Promise<void> {
  const updateData: Prisma.userUpdateInput = {};
  if (dto.first_name !== undefined) updateData.first_name = dto.first_name;
  if (dto.last_name !== undefined) updateData.last_name = dto.last_name;
  if (dto.phone !== undefined) updateData.phone = dto.phone;
  // avatar_url is handled by the files module and stored separately

  await this.prisma.user.update({ where: { id: userId }, data: updateData });
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

### Task 13 — Private formatMembership() Helper

```typescript
private formatMembership(m: {
  id: string;
  user_id: string;
  status: string;
  joined_at: Date | null;
  left_at: Date | null;
  created_at: Date;
  user: { first_name: string; last_name: string; email: string; phone: string | null };
  role: { id: string; name: string };
  invited_by: { id: string; first_name: string; last_name: string } | null;
}): MembershipResponseDto {
  return {
    id: m.id,
    user_id: m.user_id,
    first_name: m.user.first_name,
    last_name: m.user.last_name,
    email: m.user.email,
    phone: m.user.phone ?? null,
    avatar_url: null,
    role: { id: m.role.id, name: m.role.name },
    status: m.status,
    joined_at: m.joined_at?.toISOString() ?? null,
    left_at: m.left_at?.toISOString() ?? null,
    invited_by: m.invited_by
      ? { id: m.invited_by.id, first_name: m.invited_by.first_name, last_name: m.invited_by.last_name }
      : null,
    created_at: m.created_at.toISOString(),
  };
}
```

---

### Task 14 — Create UsersModule

```typescript
// src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './services/users.service';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { TokenBlocklistModule } from '../../core/token-blocklist/token-blocklist.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    TokenBlocklistModule,
    JobsModule,  // Provides JobQueueService (which manages the 'email' queue internally)
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

**Note:** `JobsModule` exports `JobQueueService`, which internally injects `@InjectQueue('email')`. The `'email'` queue is registered inside `JobsModule` via `BullModule.registerQueue({ name: 'email' })`. Do NOT register a separate queue here — `JobsModule` handles it.

---

## Patterns to Apply

### SHA-256 for Token Hashing (invite tokens)
```typescript
import { randomBytes, createHash } from 'crypto';
// Generate:
const rawToken = randomBytes(32).toString('hex'); // 64-char hex string
// Hash for DB storage:
const tokenHash = createHash('sha256').update(rawToken).digest('hex'); // 64-char SHA-256 hex
// Lookup:
prisma.user_tenant_membership.findFirst({ where: { invite_token_hash: tokenHash } })
// Why SHA-256 and not bcrypt: bcrypt is for passwords (designed to be slow).
// SHA-256 of a cryptographically random token is perfectly secure and allows
// O(1) direct lookup via the @unique index. bcrypt would require a full table scan.
```

### Prisma Typed Where Input
```typescript
import { Prisma } from '@prisma/client';
const where: Prisma.user_tenant_membershipWhereInput = { tenant_id: tenantId };
```

### Multi-Tenant Enforcement
Every method operating on tenant-scoped data MUST include `tenant_id` in the Prisma `where` clause.
`acceptInvite()`, `validateInviteToken()`, `getMe()`, `updateMe()`, `changePassword()` operate on `user_id` directly — no tenant filter needed there.

### JobQueueService (Email Dispatch)
```typescript
// Import: import { JobQueueService } from '../../jobs/services/job-queue.service';
// Module: import JobsModule (which exports JobQueueService)
await this.jobQueueService.queueEmail({
  to: 'recipient@example.com',
  templateKey: 'user-invite',    // Must match an email_template.key in the database
  tenantId: 'tenant-uuid',       // Optional — for tenant-specific SMTP config
  variables: {                   // Template variables — keys must match {{variable}} in the template
    first_name: 'Jane',
    invite_link: 'https://app.lead360.app/invite/abc123...',
    tenant_name: 'Acme Corp',
  },
});
// Returns: { jobId: string }
// The job is queued on the 'email' queue and processed by SendEmailProcessor
// which uses EmailService.sendTemplatedEmail() → SmtpService.sendEmail()
```

### AuditLoggerService
```typescript
await this.auditLogger.logTenantChange({
  action: 'created' | 'updated' | 'deleted',
  entityType: 'UserMembership' | 'User',
  entityId: string,
  tenantId: string,
  actorUserId: string,
  before?: object,
  after?: object,
  description: string,
});
```

### HTTP Status Codes
| Exception | Code |
|---|---|
| NotFoundException | 404 |
| ConflictException | 409 |
| ForbiddenException | 403 |
| BadRequestException | 400 |
| GoneException | 410 |
| InternalServerErrorException | 500 |

---

## Business Rules Enforced in This Sprint
- **BR-02:** One ACTIVE membership per user globally — `acceptInvite()`, `reactivateUser()`
- **BR-03:** Reactivation blocked if another ACTIVE membership exists — `reactivateUser()`
- **BR-04:** Deactivation sets INACTIVE + left_at + blocks JWT via `tokenBlocklist.blockUserTokens()` — `deactivateUser()`
- **BR-05:** Invite token is 72h, single-use (`invite_accepted_at` set + `invite_token_hash` cleared on first accept) — `acceptInvite()`
- **BR-06:** Hard delete blocked if audit_log or FK references exist — falls back to soft delete — `deleteUser()`
- **BR-07:** Soft-deleted users retain user_id FK references; `deleted_at` is set — `deleteUser()`
- **BR-08:** Every role change is audit-logged with before/after — `changeRole()`
- **BR-09:** Admin cannot change Owner's role; check uses `actorUser.is_platform_admin` (boolean) not a role string — `changeRole()`
- **BR-10:** Last active Owner cannot be deactivated — `deactivateUser()`
- **BR-12:** Invite to existing email reuses existing user record — `inviteUser()`

---

## Acceptance Criteria
- [ ] `npx tsc --noEmit` in `/api/` returns zero errors
- [ ] `src/modules/users/services/users.service.ts` has NO `require()` calls — only ES module `import` statements
- [ ] `src/modules/users/services/users.service.ts` has NO `as any` casts
- [ ] `src/modules/users/services/users.service.ts` has NO placeholder comments (`// ...`, `// TODO`, `// implement`)
- [ ] Invite token uses SHA-256 (`createHash('sha256')`) not bcrypt
- [ ] `changeRole()` checks `actorUser.is_platform_admin` not `actorUser.roles.includes('SuperAdmin')`
- [ ] `deleteUser()` catches Prisma `P2003`/`P2014` FK errors and falls back to soft delete
- [ ] Dev server starts with no new TypeScript errors
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 7 until:
1. `npx tsc --noEmit` returns zero errors
2. Dev server starts clean (no compilation errors in the output)

---

## Handoff Notes
- `acceptInvite()` return type is an inline type — the controller (Sprint 7) uses it to call `AuthService.issueTokensForMembership()`
- `changeRole()` accepts `actorUser: { id: string; roles: string[]; is_platform_admin: boolean }` — this matches the `AuthenticatedUser` shape from `@CurrentUser()` decorator
- Email dispatch uses `JobQueueService.queueEmail()` with `templateKey: 'user-invite'`. Sprint 9 creates the email template in the database. The existing `SendEmailProcessor` on the `'email'` queue handles delivery — no custom processor needed.
- Token hashing uses SHA-256, stored in `invite_token_hash`. The raw token (64-char hex) is sent in the email. The schema field `@db.VarChar(255)` is sufficient for the 64-char SHA-256 hex output.
- `UsersModule` is NOT yet registered in `app.module.ts` — Sprint 7 does that.
