# Sprint BAS26 — Unit Tests

**Module**: Voice AI
**Sprint**: BAS26
**Depends on**: BAS25 (all services and controllers complete)
**Estimated size**: 5–8 test files, ~400 lines total

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before writing ANY test you:
- Read the actual service/class being tested — understand EVERY method
- Read how other tests in the project are structured (`api/src/modules/leads/` or `api/src/modules/communication/`)
- Use Jest (already configured) — check `api/jest.config.js` or `api/package.json` for test config
- DO NOT test NestJS framework internals — test BUSINESS LOGIC
- Mock external dependencies (Prisma, EncryptionService) — never hit real DB in unit tests
- Run `npm run test` and fix all failures before marking complete

---

## Objective

Write unit tests for the critical Voice AI services. Focus on business logic, quota enforcement, multi-tenant isolation, and the context builder. Skip testing boilerplate CRUD that just calls Prisma.

---

## Pre-Coding Checklist

- [ ] BAS25 complete (all services verified)
- [ ] Read `api/jest.config.js` or `api/package.json` jest config — understand test setup
- [ ] Read any existing test file in the project (e.g., `api/src/modules/leads/services/leads.service.spec.ts`) — understand mocking patterns
- [ ] Run `cd /var/www/lead360.app/api && npm run test` — confirm existing tests pass first

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` — do NOT use in unit tests |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — **do NOT use in unit tests, mock Prisma instead** |

**Unit tests use mocked Prisma — no real DB connections.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| Any existing `.spec.ts` in `api/src/modules/` | Understand Jest mocking patterns used in this project |
| `api/jest.config.js` or `api/package.json` jest section | Test configuration |
| `api/src/modules/voice-ai/services/voice-usage.service.ts` | Main target for quota tests |
| `api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts` | Context merge logic |
| `api/src/modules/voice-ai/services/voice-call-log.service.ts` | Call lifecycle |

---

## Task 1: Test — VoiceUsageService (Quota Logic)

This is the MOST critical test. File: `api/src/modules/voice-ai/services/voice-usage.service.spec.ts`

**Test cases:**
```typescript
describe('VoiceUsageService', () => {
  describe('checkAndReserveMinute', () => {
    it('allows call when minutes_used < minutes_included', async () => {
      // Setup: plan has 60 minutes, tenant used 30
      // Expected: { allowed: true, is_overage: false }
    });

    it('allows call with is_overage=true when over limit with overage_rate set', async () => {
      // Setup: plan has 60 minutes, tenant used 60, overage_rate = 0.05
      // Expected: { allowed: true, is_overage: true }
    });

    it('blocks call when over limit and overage_rate is null', async () => {
      // Setup: plan has 60 minutes, tenant used 60, overage_rate = null
      // Expected: { allowed: false, reason: 'quota_exceeded' }
    });

    it('increments minutes_used on allowed call', async () => {
      // Verify prisma.voice_monthly_usage.update called with increment
    });
  });
});
```

---

## Task 2: Test — VoiceAiContextBuilderService (Merge Logic)

File: `api/src/modules/voice-ai/services/voice-ai-context-builder.service.spec.ts`

**Test cases:**
```typescript
describe('VoiceAiContextBuilderService', () => {
  describe('buildContext', () => {
    it('uses tenant custom greeting when set', async () => {
      // Setup: global has template, tenant has custom_greeting
      // Expected: result.greeting === tenant.custom_greeting
    });

    it('uses global template when no tenant custom greeting', async () => {
      // Setup: global has template {business_name}, tenant has no custom_greeting
      // Expected: result.greeting has business name substituted
    });

    it('appends tenant instructions to global system prompt', async () => {
      // Setup: global has system_prompt, tenant has custom_instructions
      // Expected: result.system_prompt contains both
    });

    it('uses tenant max_call_duration when set', async () => {
      // Setup: global = 300s, tenant = 120s
      // Expected: result.max_call_seconds === 120
    });

    it('falls back to global max_call_duration when tenant not set', async () => {
      // Setup: global = 300s, tenant has null max_call_duration_seconds
      // Expected: result.max_call_seconds === 300
    });
  });
});
```

---

## Task 3: Test — VoiceTransferNumbersService (Tenant Isolation + Max 10)

File: `api/src/modules/voice-ai/services/voice-transfer-numbers.service.spec.ts`

**Test cases:**
```typescript
describe('VoiceTransferNumbersService', () => {
  it('throws BadRequestException when tenant already has 10 active numbers', async () => {
    // Mock prisma.tenant_voice_transfer_number.count to return 10
    // Expected: throws BadRequestException
  });

  it('clears other defaults when setting is_default: true', async () => {
    // Mock: existing numbers, one marked as default
    // Action: create new number with is_default: true
    // Expected: updateMany called to clear other defaults
  });

  it('throws NotFoundException when accessing another tenant\'s number', async () => {
    // Setup: number belongs to tenant A
    // Action: findById called with tenant B
    // Expected: throws NotFoundException (tenant isolation enforced)
  });
});
```

---

## Task 4: Test — VoiceAiCredentialsService (Encryption)

File: `api/src/modules/voice-ai/services/voice-ai-credentials.service.spec.ts`

**Test cases:**
```typescript
describe('VoiceAiCredentialsService', () => {
  it('encrypts API key before storing', async () => {
    // Mock EncryptionService.encrypt to return 'encrypted_value'
    // Action: upsert with api_key = 'sk-real-key'
    // Expected: prisma called with encrypted_api_key = 'encrypted_value'
  });

  it('never returns encrypted_api_key in findAll response', async () => {
    // Mock prisma to return full credential object
    // Expected: returned object does NOT have encrypted_api_key
  });

  it('creates masked key correctly', async () => {
    // api_key = 'sk-1234567890abcdef'
    // Expected: masked_api_key = 'sk-1...cdef'
  });
});
```

---

## Task 5: Run All Tests

```bash
cd /var/www/lead360.app/api

# Run only voice-ai tests
npm run test -- --testPathPattern=voice-ai

# Run all tests
npm run test

# With coverage
npm run test -- --coverage --testPathPattern=voice-ai
```

**Fix ALL failures** before marking complete. If a test requires you to read the implementation more carefully, do it.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/services/voice-usage.service.spec.ts` | CREATE | Quota enforcement tests |
| `api/src/modules/voice-ai/services/voice-ai-context-builder.service.spec.ts` | CREATE | Context merge logic tests |
| `api/src/modules/voice-ai/services/voice-transfer-numbers.service.spec.ts` | CREATE | Tenant isolation + max 10 tests |
| `api/src/modules/voice-ai/services/voice-ai-credentials.service.spec.ts` | CREATE | Encryption tests |

---

## Acceptance Criteria

- [ ] All new test files pass: `npm run test -- --testPathPattern=voice-ai`
- [ ] `VoiceUsageService` quota logic: 3+ test cases passing
- [ ] `VoiceAiContextBuilderService` merge logic: 5+ test cases passing
- [ ] `VoiceTransferNumbersService` tenant isolation: 3+ test cases passing
- [ ] `VoiceAiCredentialsService` encryption: 3+ test cases passing
- [ ] No existing tests broken: `npm run test` passes overall
- [ ] `npm run build` passes with 0 errors
