# Testing Guide - Lead360 Tenant Module

## Overview

This guide explains how to run tests for the Tenant Module backend implementation.

**Test Coverage**:
- ✅ Service unit tests (4 files created)
- ✅ Tenant isolation E2E tests (CRITICAL security tests)
- ⏭️ Controller integration tests (can be added later)

---

## Test Files Created

### Service Unit Tests
1. `src/modules/tenant/services/tenant.service.spec.ts` - Tenant service tests
2. `src/modules/tenant/services/tenant-business-hours.service.spec.ts` - Business hours validation tests
3. `src/modules/tenant/services/tenant-address.service.spec.ts` - Address management tests
4. `src/modules/tenant/services/tenant-license.service.spec.ts` - License management tests

### E2E Tests
1. `test/tenant-isolation.e2e-spec.ts` - **CRITICAL** tenant isolation security tests

---

## Running Tests

### 1. Install Test Dependencies

First, ensure all test dependencies are installed:

```bash
cd /var/www/lead360.app/api
npm install --save-dev @types/supertest supertest
```

### 2. Run All Tests

```bash
npm test
```

### 3. Run Tests with Coverage

```bash
npm run test:cov
```

This will generate a coverage report showing which code is tested.

### 4. Run Specific Test Files

**Run only service tests:**
```bash
npm test -- tenant.service.spec
```

**Run only business hours tests:**
```bash
npm test -- tenant-business-hours.service.spec
```

**Run only address tests:**
```bash
npm test -- tenant-address.service.spec
```

**Run only license tests:**
```bash
npm test -- tenant-license.service.spec
```

### 5. Run E2E Tests (CRITICAL - Tenant Isolation)

**IMPORTANT**: E2E tests require a running database and will create/delete test data.

```bash
npm run test:e2e
```

Or run specific E2E test:
```bash
npm run test:e2e -- tenant-isolation.e2e-spec
```

### 6. Watch Mode (for development)

Run tests automatically when files change:

```bash
npm test -- --watch
```

### 7. Run Tests in Parallel

For faster execution (careful with E2E tests):

```bash
npm test -- --maxWorkers=4
```

---

## Test Environment Setup

### Environment Variables

Create `.env.test` file for test environment:

```env
DATABASE_URL="mysql://root:password@localhost:3306/lead360_test"
JWT_SECRET="test-secret-key-change-in-production"
JWT_EXPIRES_IN="1h"
REFRESH_TOKEN_EXPIRES_IN="7d"
NODE_ENV="test"
```

### Database Setup for Testing

1. Create test database:
```sql
CREATE DATABASE lead360_test;
```

2. Run migrations:
```bash
npx prisma migrate deploy
```

3. (Optional) Seed test data:
```bash
npx prisma db seed
```

---

## Understanding Test Output

### Successful Test Output

```
PASS  src/modules/tenant/services/tenant.service.spec.ts
  TenantService
    ✓ should be defined (5ms)
    findBySubdomain
      ✓ should find tenant by subdomain (3ms)
      ✓ should return null if tenant not found (2ms)
    checkSubdomainAvailability
      ✓ should return unavailable for reserved subdomains (4ms)
      ✓ should return available if subdomain is not taken (3ms)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        2.456s
```

### Failed Test Output

```
FAIL  src/modules/tenant/services/tenant.service.spec.ts
  TenantService
    checkSubdomainAvailability
      ✕ should return unavailable for reserved subdomains (12ms)

  ● TenantService › checkSubdomainAvailability › should return unavailable for reserved subdomains

    expect(received).toEqual(expected)

    Expected: {"available": false, "subdomain": "www", "reason": "Reserved subdomain"}
    Received: {"available": true, "subdomain": "www"}

      at Object.<anonymous> (src/modules/tenant/services/tenant.service.spec.ts:45:23)
```

---

## Critical Tests That MUST Pass

### 1. Tenant Isolation Tests (100% REQUIRED)

**File**: `test/tenant-isolation.e2e-spec.ts`

**What it tests**:
- Tenant A CANNOT see Tenant B's addresses
- Tenant A CANNOT update Tenant B's addresses
- Tenant A CANNOT delete Tenant B's addresses
- Tenant A CANNOT see Tenant B's business hours
- Tenant A CANNOT modify Tenant B's tenant profile
- Direct ID manipulation attempts are rejected

**Why critical**: Prevents data breaches between tenants.

**Run command**:
```bash
npm run test:e2e -- tenant-isolation.e2e-spec
```

**Expected output**: ALL tests must pass (100%)

```
PASS  test/tenant-isolation.e2e-spec.ts
  Tenant Isolation (CRITICAL SECURITY)
    Addresses - Tenant Isolation
      ✓ Tenant A should NOT see Tenant B addresses (234ms)
      ✓ Tenant B should NOT see Tenant A addresses (189ms)
      ✓ Tenant A CANNOT update Tenant B address (156ms)
      ✓ Tenant B CANNOT update Tenant A address (142ms)
      ✓ Tenant A CANNOT delete Tenant B address (128ms)
      ✓ Tenant B CANNOT delete Tenant A address (135ms)
    Business Hours - Tenant Isolation
      ✓ Tenant A should NOT see Tenant B business hours (98ms)
      ✓ Tenant B should NOT see Tenant A business hours (92ms)
      ✓ Tenant A business hours update should NOT affect Tenant B (234ms)
    Tenant Profile - Tenant Isolation
      ✓ Tenant A should NOT see Tenant B profile (87ms)
      ✓ Tenant B should NOT see Tenant A profile (91ms)
      ✓ Tenant A update should NOT affect Tenant B (198ms)
    CRITICAL: Direct ID Manipulation Attempts
      ✓ should reject attempts to pass tenant_id in request body (145ms)

Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
```

### 2. Business Hours Time Validation Tests

**File**: `src/modules/tenant/services/tenant-business-hours.service.spec.ts`

**What it tests**:
- Opening time must be before closing time
- Second shift must be after first shift (lunch break validation)
- Closed days don't require time validation
- All 7 days validated independently

**Why critical**: Prevents invalid business hours that break scheduling.

**Run command**:
```bash
npm test -- tenant-business-hours.service.spec
```

### 3. Address Management Tests

**File**: `src/modules/tenant/services/tenant-address.service.spec.ts`

**What it tests**:
- First address is automatically set as default
- Cannot delete last legal address
- Setting new default unsets previous default
- Addresses are tenant-isolated

**Why critical**: Legal address is required for business operations.

**Run command**:
```bash
npm test -- tenant-address.service.spec
```

---

## Continuous Integration (CI)

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: lead360_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd api
          npm ci

      - name: Run Prisma migrations
        run: |
          cd api
          npx prisma migrate deploy

      - name: Run unit tests
        run: |
          cd api
          npm test

      - name: Run E2E tests
        run: |
          cd api
          npm run test:e2e

      - name: Generate coverage
        run: |
          cd api
          npm run test:cov
```

---

## Debugging Failing Tests

### 1. View detailed error messages

```bash
npm test -- --verbose
```

### 2. Run single test

```bash
npm test -- --testNamePattern="should find tenant by subdomain"
```

### 3. Debug with breakpoints

Add `debugger;` statement in test:

```typescript
it('should find tenant by subdomain', async () => {
  debugger; // Execution will pause here
  const result = await service.findBySubdomain('acme-roofing');
  expect(result).toBeDefined();
});
```

Run with Node debugger:
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### 4. Check database state

If E2E tests fail, check test database:

```bash
mysql -u root -p lead360_test
```

```sql
SELECT * FROM tenant;
SELECT * FROM tenant_address;
SELECT * FROM tenant_business_hours;
```

---

## Test Coverage Goals

**Minimum Coverage Requirements**:
- Services: **>80%**
- Controllers: **>70%**
- Critical business logic: **100%**
- Tenant isolation: **100%** (NON-NEGOTIABLE)

**Check coverage**:
```bash
npm run test:cov
```

**Coverage report location**: `coverage/lcov-report/index.html`

---

## Common Issues & Solutions

### Issue 1: "Cannot find module 'supertest'"

**Solution**:
```bash
npm install --save-dev @types/supertest supertest
```

### Issue 2: "Database connection failed"

**Solution**:
- Verify MySQL is running: `sudo systemctl status mysql`
- Check `.env.test` has correct DATABASE_URL
- Create test database: `CREATE DATABASE lead360_test;`

### Issue 3: "Tests timeout"

**Solution**:
Increase Jest timeout in `package.json`:

```json
{
  "jest": {
    "testTimeout": 30000
  }
}
```

Or in specific test file:
```typescript
jest.setTimeout(30000);
```

### Issue 4: "Prisma client not generated"

**Solution**:
```bash
npx prisma generate
```

### Issue 5: "Port already in use" (E2E tests)

**Solution**:
E2E tests create a test server. Kill any running API server:
```bash
pkill -f "nest start"
```

---

## Next Steps

1. **Run all tests**: `npm test`
2. **Run E2E tests**: `npm run test:e2e`
3. **Check coverage**: `npm run test:cov`
4. **Fix any failures**: All tests must pass before production deployment
5. **Add more tests**: Controller integration tests (optional for now)

---

## Summary

**Test Execution Order**:
```bash
# 1. Install dependencies
npm install --save-dev @types/supertest supertest

# 2. Setup test database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS lead360_test;"
npx prisma migrate deploy

# 3. Run unit tests (fast)
npm test

# 4. Run E2E tests (slower, but CRITICAL)
npm run test:e2e

# 5. Check coverage
npm run test:cov
```

**Critical Tests Status**:
- ✅ Tenant isolation tests created (13 tests)
- ✅ Business hours validation tests created (12 tests)
- ✅ Address management tests created (6 tests)
- ✅ License management tests created (5 tests)

**Total Tests Created**: 36+ test cases

---

**Generated**: January 2, 2026
**Status**: Ready for testing
