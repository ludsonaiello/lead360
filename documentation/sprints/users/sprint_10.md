# Sprint 10 — Unit Tests: UsersService
**Module:** users
**File:** ./documentation/sprints/users/sprint_10.md
**Type:** Backend — Tests
**Depends On:** Sprint 7 (UsersService complete and registered)
**Gate:** STOP — All tests must pass, coverage >80% for UsersService. Verify before Sprint 11.
**Estimated Complexity:** Medium

---

## Objective

Write comprehensive unit tests for `UsersService`. Tests must cover all business rules (BR-01 through BR-13 as applicable to the service layer), all happy paths, and all error cases. The goal is >80% coverage on `users.service.ts`. Prisma, AuditLoggerService, TokenBlocklistService, and JobQueueService are all mocked.

---

## Pre-Sprint Checklist
- [ ] Sprint 9 gate verified (invite job works, TypeScript compiles)
- [ ] Read `src/modules/users/services/users.service.ts` (full file from Sprint 6)
- [ ] Check if Jest is configured: `cat /var/www/lead360.app/api/package.json | grep jest`
- [ ] Check jest config: look for `jest.config.js` or `jest` key in `package.json`
- [ ] Read one existing unit test file in the codebase to understand the mock setup pattern (e.g., any `*.spec.ts` file in `src/modules/`)
- [ ] Confirm test command: `npm run test` or `npm run test:unit`

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

### Task 1 — Create Test File with Mock Setup

**What:** Create `src/modules/users/services/users.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException, ForbiddenException, BadRequestException, GoneException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { TokenBlocklistService } from '../../../core/token-blocklist/token-blocklist.service';
import { JobQueueService } from '../../jobs/services/job-queue.service';

// Mock bcrypt to avoid slow hashing in tests
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_value'),
  compare: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;
  let auditLogger: jest.Mocked<AuditLoggerService>;
  let tokenBlocklist: jest.Mocked<TokenBlocklistService>;
  let jobQueueService: jest.Mocked<JobQueueService>;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user_tenant_membership: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    audit_log: {
      count: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockAuditLogger = {
    logTenantChange: jest.fn().mockResolvedValue(undefined),
  };

  const mockTokenBlocklist = {
    trackToken: jest.fn().mockResolvedValue(undefined),
    blockUserTokens: jest.fn().mockResolvedValue(undefined),
    isBlocked: jest.fn().mockResolvedValue(false),
  };

  const mockJobQueueService = {
    queueEmail: jest.fn().mockResolvedValue({ jobId: 'test-job-id' }),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('https://app.lead360.app'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
        { provide: TokenBlocklistService, useValue: mockTokenBlocklist },
        { provide: JobQueueService, useValue: mockJobQueueService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
    auditLogger = module.get(AuditLoggerService);
    tokenBlocklist = module.get(TokenBlocklistService);
    jobQueueService = module.get(JobQueueService);

    jest.clearAllMocks();
  });
```

---

### Task 2 — Test inviteUser()

```typescript
  describe('inviteUser()', () => {
    const tenantId = 'tenant-1';
    const actorUserId = 'actor-1';
    const dto = {
      email: 'new@example.com',
      first_name: 'New',
      last_name: 'User',
      role_id: 'role-1',
    };

    const mockRole = { id: 'role-1', name: 'Employee' };
    const mockUser = { id: 'user-1', email: dto.email, first_name: dto.first_name, last_name: dto.last_name };
    const mockTenant = { company_name: 'Acme Corp' };
    const mockInviter = { first_name: 'Admin', last_name: 'User' };
    const mockMembership = {
      id: 'membership-1',
      user_id: 'user-1',
      tenant_id: tenantId,
      role_id: 'role-1',
      status: 'INVITED',
      created_at: new Date(),
      role: mockRole,
      user: mockUser,
      invited_by: null,
    };

    // Common setup for tenant and inviter lookups (resolved by inviteUser before dispatching email)
    const setupTenantAndInviter = () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)  // first call: user lookup by email
        .mockResolvedValueOnce(mockInviter); // second call: inviter lookup by ID
    };

    it('should create an invite membership for a new user', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce(null); // no existing active
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // new user (email lookup)
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.user_tenant_membership.create.mockResolvedValue(mockMembership);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      // After transaction: inviter lookup
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockInviter);

      const result = await service.inviteUser(tenantId, actorUserId, dto);

      expect(result.status).toBe('INVITED');
      expect(result.email).toBe(dto.email);
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'created', entityType: 'UserMembership' }),
      );
      expect(mockJobQueueService.queueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: dto.email,
          templateKey: 'user-invite',
          tenantId,
        }),
      );
    });

    it('should link existing user when email already has a user record (BR-12)', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser)   // existing user (email lookup)
        .mockResolvedValueOnce(mockInviter); // inviter lookup
      mockPrisma.user_tenant_membership.create.mockResolvedValue(mockMembership);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await service.inviteUser(tenantId, actorUserId, dto);

      expect(mockPrisma.user.create).not.toHaveBeenCalled(); // BR-12: no new user created
      expect(mockPrisma.user_tenant_membership.create).toHaveBeenCalled();
    });

    it('should throw 409 if email already has ACTIVE membership in this tenant', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        id: 'existing-membership',
        status: 'ACTIVE',
      });

      await expect(service.inviteUser(tenantId, actorUserId, dto)).rejects.toThrow(ConflictException);
    });

    it('should throw 404 if role_id does not exist', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(service.inviteUser(tenantId, actorUserId, dto)).rejects.toThrow(NotFoundException);
    });
  });
```

---

### Task 3 — Test deactivateUser()

```typescript
  describe('deactivateUser()', () => {
    const tenantId = 'tenant-1';
    const actorUserId = 'actor-1';
    const membershipId = 'membership-1';
    const dto = { reason: 'Left the company' };

    it('should deactivate a user and block their JWT token (BR-04)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: membershipId,
        user_id: 'user-1',
        tenant_id: tenantId,
        status: 'ACTIVE',
        role: { name: 'Employee' },
      });
      mockPrisma.user_tenant_membership.count.mockResolvedValue(0); // not an owner
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.deactivateUser(tenantId, membershipId, actorUserId, dto);

      expect(result.status).toBe('INACTIVE');
      expect(mockTokenBlocklist.blockUserTokens).toHaveBeenCalledWith('user-1'); // BR-04
    });

    it('should throw 400 when trying to deactivate the last active Owner (BR-10)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: membershipId,
        user_id: 'user-1',
        tenant_id: tenantId,
        status: 'ACTIVE',
        role: { name: 'Owner' },
      });
      mockPrisma.user_tenant_membership.count.mockResolvedValue(1); // only 1 active owner

      await expect(
        service.deactivateUser(tenantId, membershipId, actorUserId, dto),
      ).rejects.toThrow(BadRequestException);

      expect(mockTokenBlocklist.blockUserTokens).not.toHaveBeenCalled();
    });

    it('should throw 404 if membership is not found in tenant', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivateUser(tenantId, membershipId, actorUserId, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });
```

---

### Task 4 — Test reactivateUser()

```typescript
  describe('reactivateUser()', () => {
    it('should throw 409 if user has an ACTIVE membership in another tenant (BR-02, BR-03)', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce({ id: 'membership-1', user_id: 'user-1', tenant_id: 'tenant-1', status: 'INACTIVE' })
        .mockResolvedValueOnce({ id: 'other-membership', user_id: 'user-1', tenant_id: 'tenant-2', status: 'ACTIVE' });

      await expect(
        service.reactivateUser('tenant-1', 'membership-1', 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should reactivate a user when they have no other active memberships', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce({ id: 'membership-1', user_id: 'user-1', tenant_id: 'tenant-1', status: 'INACTIVE' })
        .mockResolvedValueOnce(null); // no other active memberships
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.reactivateUser('tenant-1', 'membership-1', 'actor-1');

      expect(result.status).toBe('ACTIVE');
    });
  });
```

---

### Task 5 — Test changeRole()

```typescript
  describe('changeRole()', () => {
    it('should throw 403 when Admin tries to change an Owner role (BR-09)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: 'membership-1',
        role: { name: 'Owner' }, // target is Owner
      });

      const adminActor = { id: 'admin-user', roles: ['Admin'], is_platform_admin: false }; // actor is Admin, not platform admin
      const dto = { role_id: 'new-role-id' };

      await expect(
        service.changeRole('tenant-1', 'membership-1', adminActor, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Owner to change another Owner role (BR-09 exception)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: 'membership-1',
        role: { name: 'Owner' },
      });
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'new-role-id', name: 'Admin' });
      mockPrisma.user_tenant_membership.update.mockResolvedValue({
        id: 'membership-1',
        role: { id: 'new-role-id', name: 'Admin' },
        user: { id: 'user-1', first_name: 'A', last_name: 'B', email: 'a@b.com', phone: null },
        invited_by: null,
        status: 'ACTIVE',
        joined_at: null,
        left_at: null,
        created_at: new Date(),
        user_id: 'user-1',
      });

      const ownerActor = { id: 'owner-user', roles: ['Owner'], is_platform_admin: false };
      const dto = { role_id: 'new-role-id' };

      const result = await service.changeRole('tenant-1', 'membership-1', ownerActor, dto);

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'UserMembership',
          before: { role: 'Owner' },
          after: { role: 'Admin' },
        }),
      );
    });
  });
```

---

### Task 6 — Test deleteUser()

```typescript
  describe('deleteUser()', () => {
    it('should soft-delete when user has audit log references (BR-06, BR-07)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: 'membership-1',
        user_id: 'user-1',
        user: { email: 'user@example.com' },
      });
      mockPrisma.audit_log.count.mockResolvedValue(5); // has audit history
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});

      await service.deleteUser('tenant-1', 'membership-1', 'actor-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
      expect(mockPrisma.user.delete).not.toHaveBeenCalled(); // soft delete only (BR-06)
    });

    it('should hard-delete when user has no audit log references (BR-06)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: 'membership-1',
        user_id: 'user-1',
        user: { email: 'user@example.com' },
      });
      mockPrisma.audit_log.count.mockResolvedValue(0); // no audit history
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.delete.mockResolvedValue({});

      await service.deleteUser('tenant-1', 'membership-1', 'actor-1');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });
```

---

### Task 7 — Test validateInviteToken()

```typescript
  describe('validateInviteToken()', () => {
    // Token validation uses SHA-256 direct lookup (NOT bcrypt scanning)
    // The service hashes the raw token with SHA-256 and does a findFirst by invite_token_hash

    it('should return token info for a valid token', async () => {
      // findFirst returns the matching membership directly via SHA-256 hash lookup
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        id: 'membership-1',
        invite_token_hash: 'sha256-hash-value',
        invite_accepted_at: null,  // not yet accepted
        invite_token_expires_at: new Date(Date.now() + 3600 * 1000), // still valid
        user: { email: 'test@example.com' },
        tenant: { company_name: 'Acme Corp' },
        role: { name: 'Employee' },
        invited_by: { first_name: 'John', last_name: 'Doe' },
      });

      const result = await service.validateInviteToken('raw-token-here');

      expect(result.tenant_name).toBe('Acme Corp');
      expect(result.role_name).toBe('Employee');
      expect(result.invited_by_name).toBe('John Doe');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw 409 ConflictException for already-used token (BR-05)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        id: 'membership-1',
        invite_token_hash: 'sha256-hash-value',
        invite_accepted_at: new Date(), // already accepted
        invite_token_expires_at: new Date(Date.now() + 3600 * 1000),
        user: { email: 'test@example.com' },
        tenant: { company_name: 'Acme Corp' },
        role: { name: 'Employee' },
        invited_by: null,
      });

      await expect(service.validateInviteToken('used-token')).rejects.toThrow(ConflictException);
    });

    it('should throw 410 GoneException for expired token (BR-05)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        id: 'membership-1',
        invite_token_hash: 'sha256-hash-value',
        invite_accepted_at: null,
        invite_token_expires_at: new Date(Date.now() - 3600 * 1000), // expired 1 hour ago
        user: { email: 'test@example.com' },
        tenant: { company_name: 'Acme Corp' },
        role: { name: 'Employee' },
        invited_by: null,
      });

      await expect(service.validateInviteToken('expired-token')).rejects.toThrow(GoneException);
    });

    it('should throw 404 NotFoundException for invalid token', async () => {
      // SHA-256 hash lookup returns null — no matching invite_token_hash
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce(null);

      await expect(service.validateInviteToken('bad-token')).rejects.toThrow(NotFoundException);
    });
  });
```

---

### Task 8 — Test changePassword()

```typescript
  describe('changePassword()', () => {
    const bcrypt = require('bcrypt');

    it('should throw 400 if current password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', password_hash: 'old-hash' });
      bcrypt.compare.mockResolvedValue(false); // wrong password

      await expect(
        service.changePassword('user-1', { current_password: 'wrong', new_password: 'NewP@ss123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update password when current password is correct', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', password_hash: 'old-hash' });
      bcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});

      await service.changePassword('user-1', { current_password: 'OldP@ss123', new_password: 'NewP@ss123' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ password_hash: 'hashed_value' }),
        }),
      );
    });
  });
```

---

### Task 9 — Run Tests and Check Coverage

**What:** Run the tests and check coverage:

```bash
cd /var/www/lead360.app/api
npm run test -- --testPathPattern=users.service.spec --coverage --coverageDirectory=coverage/users
```

Or if the test script is different:
```bash
npx jest src/modules/users/services/users.service.spec.ts --coverage
```

**Expected output:**
- All tests pass (green)
- Coverage for `users.service.ts` > 80% (statements and branches)

If coverage is below 80%, add tests for the uncovered branches. Focus on error paths and edge cases.

---

## Business Rules Verified by Tests
- **BR-02:** reactivateUser → 409 if other ACTIVE membership exists
- **BR-03:** reactivateUser → same check
- **BR-04:** deactivateUser → tokenBlocklist.blockUserTokens() called
- **BR-05:** validateInviteToken → 410 for expired, 404 for invalid
- **BR-06:** deleteUser → soft delete when audit_log refs exist
- **BR-07:** deleteUser soft → deleted_at is set, user not hard-deleted
- **BR-08:** changeRole → auditLogger called with before/after role
- **BR-09:** changeRole → 403 when Admin tries to change Owner role
- **BR-10:** deactivateUser → 400 when deactivating last active Owner
- **BR-12:** inviteUser → existing user record reused, no new user.create() called

---

## Acceptance Criteria
- [ ] All test cases pass (0 failures)
- [ ] Coverage for `users.service.ts` > 80% statements and branches
- [ ] No test mocks actual Prisma DB — all Prisma calls are mocked
- [ ] No test makes actual Redis calls — tokenBlocklist is mocked
- [ ] No test sends actual emails — JobQueueService is mocked
- [ ] `npx tsc --noEmit` still returns zero errors after adding tests
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 11 until:
1. All tests pass with 0 failures
2. Coverage > 80% for users.service.ts
3. Zero TypeScript compilation errors

---

## Handoff Notes
- Test file is at `src/modules/users/services/users.service.spec.ts`
- Sprint 11 (API Documentation) does not depend on test results — it can be done in parallel with this sprint if needed
- `JobQueueService` is mocked with `{ queueEmail: jest.fn().mockResolvedValue({ jobId: 'test-job-id' }) }` — no actual email queue interaction in tests
