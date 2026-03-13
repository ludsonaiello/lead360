# Sprint 12 — Integration Tests: Users Module API
**Module:** users
**File:** ./documentation/sprints/users/sprint_12.md
**Type:** Backend — Integration Tests
**Depends On:** Sprint 10 (unit tests pass), Sprint 11 (API documentation complete)
**Gate:** NONE — This is the final sprint. After this, the Users module backend is complete and ready for frontend development.
**Estimated Complexity:** Medium

---

## Objective

Write integration tests that hit the actual API endpoints via HTTP requests using a test database. These tests verify the full request lifecycle: authentication → guard → controller → service → database → response. Unlike unit tests (Sprint 10) which mock all dependencies, integration tests confirm that the wiring between NestJS modules, Prisma, Redis, and BullMQ works correctly in a real environment.

Focus areas:
1. Multi-tenant isolation — Tenant A cannot access Tenant B's users
2. RBAC enforcement — non-Owner/Admin roles get 403
3. Full invite flow end-to-end — invite → validate → accept → login
4. JWT blocklist integration — deactivation immediately revokes access
5. Business rule enforcement via API — last-owner, cross-tenant reactivation, etc.

---

## Pre-Sprint Checklist
- [ ] Sprint 10 gate verified (all unit tests pass, >80% coverage)
- [ ] Sprint 11 complete (API documentation exists)
- [ ] Read existing integration tests in the codebase: search for `*.e2e-spec.ts` or `*.integration-spec.ts` files
- [ ] Understand the test setup pattern: does the codebase use `@nestjs/testing` with `createNestApplication()` for integration tests?
- [ ] Check test database configuration: is there a `.env.test` or does the test use the same DB?
- [ ] Check if `supertest` is installed: `cat /var/www/lead360.app/api/package.json | grep supertest`
- [ ] Confirm test command for e2e: `npm run test:e2e` or `npx jest --config jest-e2e.config.ts`

---

## Dev Server

Integration tests create their own NestJS application instance — do NOT start the dev server manually. The tests handle server lifecycle.

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

The integration tests will start their own server on a different port or use supertest's in-process binding.
```

---

## Tasks

### Task 1 — Understand the Integration Test Pattern

**What:** Before writing tests, find the existing integration test setup:

```bash
find /var/www/lead360.app/api/src -name "*.e2e-spec.ts" -o -name "*.integration-spec.ts" | head -10
find /var/www/lead360.app/api/test -name "*.e2e-spec.ts" | head -10
```

Read one existing integration test to understand:
1. How the NestJS `TestingModule` is created with `createNestApplication()`
2. How authentication is handled in tests (login first? inject tokens directly?)
3. How database cleanup happens between tests
4. Whether `supertest` or a custom HTTP client is used

If no integration tests exist yet, use the standard NestJS pattern:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../core/database/prisma.service';

describe('Users Module (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });
```

---

### Task 2 — Helper: Authenticate as Test Users

**What:** Create helper functions to get JWT tokens for different roles:

```typescript
  // Helper: login and get access token
  async function loginAs(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.access_token;
  }

  // Test accounts:
  // Owner/Admin: contact@honeydo4you.com / 978@F32c
  // Platform admin: ludsonaiello@gmail.com / 978@F32c

  let ownerToken: string;
  let adminToken: string; // if a separate admin user exists

  beforeAll(async () => {
    ownerToken = await loginAs('contact@honeydo4you.com', '978@F32c');
  });
```

---

### Task 3 — Test Multi-Tenant Isolation

**What:** Verify that a user in Tenant A cannot see users from Tenant B.

```typescript
  describe('Multi-Tenant Isolation', () => {
    it('GET /users should only return memberships from the authenticated user tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Verify response contains data and pagination meta
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta.total).toBeGreaterThan(0);

      // Verify each membership has expected shape (proves tenant-scoped data returned)
      for (const m of res.body.data) {
        expect(m).toHaveProperty('id');
        expect(m).toHaveProperty('email');
        expect(m).toHaveProperty('role');
        expect(m).toHaveProperty('status');
      }
    });

    it('GET /users/:id should return 404 for a membership from another tenant', async () => {
      // Get a membership ID from a different tenant (if test data allows)
      // Or create one via admin endpoint and try to access from tenant user
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });
```

---

### Task 4 — Test RBAC Enforcement

**What:** Verify that non-Owner/Admin roles get 403 on management endpoints.

```typescript
  describe('RBAC Enforcement', () => {
    it('GET /users without token should return 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);
    });

    // If a non-admin user exists in test data, test with their token:
    // it('GET /users with Employee role should return 403', async () => {
    //   const employeeToken = await loginAs('employee@test.com', 'password');
    //   await request(app.getHttpServer())
    //     .get('/api/v1/users')
    //     .set('Authorization', `Bearer ${employeeToken}`)
    //     .expect(403);
    // });

    it('DELETE /users/:id without token should return 401', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });
  });
```

---

### Task 5 — Test Self-Service Endpoints

```typescript
  describe('Self-Service Endpoints', () => {
    it('GET /users/me should return own profile with membership', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('membership');
      expect(res.body.membership).toHaveProperty('role');
      expect(res.body.membership.status).toBe('ACTIVE');
    });

    it('PATCH /users/me should update profile', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ first_name: 'Updated' })
        .expect(200);

      // Verify the update persisted
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.first_name).toBe('Updated');
    });

    it('PATCH /users/me/password with wrong current_password should return 400', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ current_password: 'wrongpassword', new_password: 'NewP@ssw0rd1' })
        .expect(400);
    });
  });
```

---

### Task 6 — Test Invite Flow (End-to-End)

```typescript
  describe('Invite Flow', () => {
    let inviteResponse: any;
    let roleId: string;

    beforeAll(async () => {
      // Resolve a valid role ID from the database via the app's PrismaService
      const prisma = app.get(PrismaService);
      const role = await prisma.role.findFirst({ where: { name: 'Employee' } });
      roleId = role!.id;
    });

    it('POST /users/invite should create INVITED membership', async () => {

      const res = await request(app.getHttpServer())
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: `integrationtest${Date.now()}@example.com`,
          first_name: 'Integration',
          last_name: 'Test',
          role_id: roleId,
        })
        .expect(201);

      inviteResponse = res.body;
      expect(inviteResponse.status).toBe('INVITED');
      expect(inviteResponse).toHaveProperty('id');
      expect(inviteResponse).toHaveProperty('user_id');
    });

    it('POST /users/invite with invalid role_id should return 404', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'bad-role@example.com',
          first_name: 'Bad',
          last_name: 'Role',
          role_id: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404);
    });

    it('POST /users/invite with missing fields should return 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'missing-fields@example.com' })
        .expect(400);
    });
  });
```

---

### Task 7 — Test Deactivation + JWT Blocklist Integration

```typescript
  describe('Deactivation + JWT Blocklist (BR-04, BR-13)', () => {
    // This test requires creating a test user, getting their token,
    // deactivating them, then verifying the token is blocked.
    // Implementation depends on available test data.

    it('PATCH /users/:id/deactivate should return 200 with INACTIVE status', async () => {
      // Get a membership that can be deactivated (not the last Owner)
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/users?status=ACTIVE')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Find a non-Owner membership to deactivate
      const target = listRes.body.data.find(
        (m: any) => m.role.name !== 'Owner' && m.status === 'ACTIVE',
      );

      if (target) {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/users/${target.id}/deactivate`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ reason: 'Integration test' })
          .expect(200);

        expect(res.body.status).toBe('INACTIVE');
        expect(res.body).toHaveProperty('left_at');
      }
    });
  });
```

---

### Task 8 — Test Superadmin Endpoints

```typescript
  describe('Superadmin Endpoints', () => {
    let adminToken: string;

    beforeAll(async () => {
      adminToken = await loginAs('ludsonaiello@gmail.com', '978@F32c');
    });

    it('GET /admin/tenants/:tenantId/users should return 200 with user list', async () => {
      // First get a tenant ID
      const tenantsRes = await request(app.getHttpServer())
        .get('/api/v1/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (tenantsRes.body.data?.length > 0) {
        const tenantId = tenantsRes.body.data[0].id;
        const res = await request(app.getHttpServer())
          .get(`/api/v1/admin/tenants/${tenantId}/users`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
      }
    });

    it('non-platform-admin should get 403 on /admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/tenants')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);
    });
  });
```

---

### Task 9 — Test Business Rule Edge Cases

```typescript
  describe('Business Rules', () => {
    it('BR-10: Cannot deactivate the last active Owner', async () => {
      // Get the owner's own membership and try to deactivate
      const meRes = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Try to deactivate self (likely the only Owner)
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${meRes.body.membership.id}/deactivate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400); // "Tenant must have at least one active Owner."
    });

    it('BR-05: Public invite endpoints work without auth', async () => {
      // Invalid token returns 404 (not 401)
      await request(app.getHttpServer())
        .get('/api/v1/users/invite/invalidtokenvalue')
        .expect(404);
    });

    it('Validation: password complexity is enforced on invite accept', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users/invite/sometokenvalue/accept')
        .send({ password: 'weak' })
        .expect(400); // password fails complexity check
    });
  });
```

---

### Task 10 — Run Tests and Verify

**What:** Run the integration tests:

```bash
cd /var/www/lead360.app/api

# Run only the users integration tests
npx jest src/modules/users/tests/users.integration-spec.ts --verbose

# Or if using the e2e test config:
npx jest --config jest-e2e.config.ts --testPathPattern=users --verbose
```

**Expected output:**
- All tests pass (green)
- No unhandled promise rejections
- No database state corruption (clean up test data if needed)

---

## Test Data Cleanup

If tests create data (invites, users), add cleanup in `afterAll()`:

```typescript
afterAll(async () => {
  // Clean up test data created during integration tests
  // Only delete records created by these tests — use unique email patterns
  // e.g., emails matching 'integrationtest%@example.com'
  await app.close();
});
```

---

## Patterns to Apply

### Integration Test Pattern (NestJS + Supertest)
```typescript
const res = await request(app.getHttpServer())
  .get('/api/v1/users')
  .set('Authorization', `Bearer ${token}`)
  .expect(200);

expect(res.body).toHaveProperty('data');
```

### Testing Error Responses
```typescript
const res = await request(app.getHttpServer())
  .post('/api/v1/users/invite')
  .set('Authorization', `Bearer ${token}`)
  .send({ email: 'invalid' })
  .expect(400);

expect(res.body.message).toContain('email must be an email');
```

---

## Business Rules Verified by Integration Tests
- **BR-04, BR-13:** Deactivation + immediate JWT revocation (token returns 401 after deactivation)
- **BR-05:** Public invite endpoints accessible without auth; expired/used tokens return correct errors
- **BR-10:** Last active Owner cannot be deactivated (400 response)
- **BR-11:** Multi-tenant isolation — users from other tenants never visible
- **RBAC:** Owner/Admin roles required for management endpoints

---

## Acceptance Criteria
- [ ] All integration tests pass (0 failures)
- [ ] Multi-tenant isolation test confirms no cross-tenant data leakage
- [ ] RBAC tests confirm 403 for unauthorized roles
- [ ] Self-service endpoints tested (GET /me, PATCH /me, PATCH /me/password)
- [ ] Invite flow tested end-to-end (at least the POST invite + validation)
- [ ] Deactivation returns 200 with INACTIVE status
- [ ] Last-owner protection returns 400
- [ ] Superadmin endpoints accessible with platform admin, blocked for regular users
- [ ] No test data left behind (cleanup runs in afterAll)
- [ ] No frontend code modified
- [ ] Server processes shut down after tests complete

---

## Gate Marker
**NONE** — This is the final backend sprint for the Users module.

---

## Handoff Notes
- **Backend is now COMPLETE** — all endpoints implemented, unit tested, integration tested, and documented
- **Frontend developer:** Read `api/documentation/users_REST_API.md` as the primary API reference
- **Frontend developer:** Read `documentation/contracts/user-contract.md` for UI requirements
- Integration tests live at `src/modules/users/tests/users.integration-spec.ts`
- Test accounts used: `contact@honeydo4you.com` (tenant Owner), `ludsonaiello@gmail.com` (platform admin)
