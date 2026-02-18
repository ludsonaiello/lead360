YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B13 — Unit + Integration Tests

**Module**: Voice AI  
**Sprint**: B13  
**Depends on**: B02–B11 all complete  
**Estimated scope**: ~2.5 hours

---

## Objective

Write comprehensive tests covering the critical business logic: context builder fallback merge, quota enforcement, agent key validation, and multi-tenant isolation.

---

## Pre-Coding Checklist

- [ ] All sprints B02–B11 are complete
- [ ] Read `/api/src/modules/leads/leads.service.spec.ts` — NestJS test pattern with Prisma mock
- [ ] Read `/api/src/modules/communication/services/sms-keyword-detection.service.spec.ts` — unit test style
- [ ] Understand Prisma mock pattern: `jest.mock` or `PrismaService` mock in test module

**DO NOT USE PM2** — run tests with: `cd /var/www/lead360.app/api && npm run test`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: Context Builder Unit Tests

`/api/src/modules/voice-ai/services/voice-ai-context-builder.service.spec.ts`

Test cases:
1. **Tenant with no settings uses global defaults** — `custom_greeting` null → uses `default_greeting_template`
2. **Greeting template substitution** — `{business_name}` replaced with actual company name
3. **Tenant language override** — tenant `enabled_languages` used over global default
4. **Provider fallback chain** — tenant has no STT override → uses global `default_stt_provider_id`
5. **Quota calculation** — `minutes_used=450`, `minutes_included=500` → `minutes_remaining=50`, `quota_exceeded=false`
6. **Quota exceeded** — `minutes_used=500`, `minutes_included=500` → `quota_exceeded=true`
7. **Monthly minutes override** — `monthly_minutes_override=1000` overrides plan's `voice_ai_minutes_included=500`

---

## Task 2: VoiceAgentKeyGuard Unit Tests

`/api/src/modules/voice-ai/guards/voice-agent-key.guard.spec.ts`

Test cases:
1. **Missing header** → throws UnauthorizedException
2. **Invalid key** → throws UnauthorizedException
3. **Correct key** → returns true
4. **Timing-safe comparison** — correct key with different capitalization → fails (SHA-256 is case-sensitive)
5. **No key configured in DB** → throws UnauthorizedException

---

## Task 3: Quota Service Unit Tests

`/api/src/modules/voice-ai/services/voice-usage.service.spec.ts`

Test cases:
1. **checkAndReserveMinute: minutes available** → `{ allowed: true, is_overage: false }`
2. **checkAndReserveMinute: quota exceeded, no overage rate** → `{ allowed: false, reason: 'quota_exceeded' }`
3. **checkAndReserveMinute: quota exceeded, overage rate set** → `{ allowed: true, is_overage: true }`
4. **createUsageRecords: creates one row per provider entry** (STT, LLM, TTS each get their own record)
5. **createUsageRecords: sets correct year/month** on each record
6. **getQuota: aggregates STT seconds from per-call records** for current month correctly

---

## Task 4: Multi-Tenant Isolation Integration Test

`/api/src/modules/voice-ai/voice-ai-isolation.spec.ts`

Test:
1. **Tenant A cannot get Tenant B's settings** — `GET /voice-ai/settings` with Tenant A's JWT returns only Tenant A's data
2. **Tenant A cannot get Tenant B's call logs** — `GET /voice-ai/call-logs` scoped to requesting tenant
3. **Internal context endpoint scoped to tenantId param** — agent can only get context for the tenantId in URL, verified by testing with known Tenant A data while Tenant B exists

Use test database with two test tenants. Follow existing integration test patterns.

---

## Task 5: Transfer Numbers Service Tests

`/api/src/modules/voice-ai/services/voice-transfer-numbers.service.spec.ts`

Test cases:
1. **Max 10 limit enforced** — 11th create throws BadRequestException
2. **Single default enforced** — setting new default unsets previous
3. **Tenant isolation** — cannot update/delete another tenant's number

---

## Running Tests

```bash
# All voice-ai tests
cd /var/www/lead360.app/api
npm run test -- --testPathPattern=voice-ai

# With coverage
npm run test:cov -- --testPathPattern=voice-ai
```

---

## Acceptance Criteria

- [ ] Context builder: all 7 test cases pass
- [ ] Agent key guard: all 5 test cases pass
- [ ] Quota service: all 6 test cases pass
- [ ] Multi-tenant isolation: all 3 test cases pass
- [ ] Transfer numbers: all 3 test cases pass
- [ ] Test coverage for voice-ai services >80%
- [ ] No test failures in the full suite: `npm run test`
