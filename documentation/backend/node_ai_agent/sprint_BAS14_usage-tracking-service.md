# Sprint BAS14 — Usage Tracking Service

**Module**: Voice AI
**Sprint**: BAS14
**Depends on**: BAS13 (context builder complete)
**Estimated size**: 1–2 files, ~150 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-usage.service.ts` completely
- Read `api/prisma/schema.prisma` — `voice_monthly_usage` model (UNIQUE constraint on tenant_id + year + month)
- Read `api/prisma/schema.prisma` — `subscription_plan` model (voice_ai_minutes_included, voice_ai_overage_rate)
- Understand the quota check: minutes_used + 1 <= plan.voice_ai_minutes_included OR overage allowed
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) `VoiceUsageService` — tracks monthly voice AI usage per tenant and enforces quota. The agent calls `checkAndReserveMinute()` before each call minute. A BullMQ scheduler resets usage monthly.

---

## Pre-Coding Checklist

- [ ] BAS13 complete (context builder verified)
- [ ] Read `api/src/modules/voice-ai/services/voice-usage.service.ts` completely
- [ ] Read `api/prisma/schema.prisma` — `voice_monthly_usage` model
- [ ] Read `api/prisma/schema.prisma` — `subscription_plan` model with voice columns
- [ ] Read `api/prisma/schema.prisma` — `tenant` model — how to get `subscription_plan_id`

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/services/voice-usage.service.ts` | Existing service |
| `api/prisma/schema.prisma` | `voice_monthly_usage` unique constraint + fields |
| `api/prisma/schema.prisma` | `subscription_plan` voice columns |
| `api/prisma/schema.prisma` | `tenant` — how tenant links to plan |

---

## Task 1: Verify Service Methods

```typescript
@Injectable()
export class VoiceUsageService {
  constructor(private readonly prisma: PrismaService) {}

  // Get or create usage record for current month
  // Uses upsert with UNIQUE(tenant_id, year, month)
  async getOrCreateMonthlyUsage(tenantId: string, year?: number, month?: number): Promise<voice_monthly_usage>

  // Check quota and reserve 1 minute if allowed
  // Returns { allowed: boolean, is_overage: boolean, reason?: string }
  // Increments minutes_used atomically using Prisma transaction
  async checkAndReserveMinute(tenantId: string): Promise<QuotaCheckResult>

  // Called at call end — add actual duration to usage
  async recordCallDuration(tenantId: string, durationSeconds: number, isOverage: boolean): Promise<void>

  // Get usage summary for tenant (current month + comparison)
  async getUsageSummary(tenantId: string): Promise<UsageSummaryDto>

  // Admin: reset monthly usage (called by BullMQ scheduler on 1st of month)
  async resetMonthlyUsage(): Promise<void>

  // Get monthly usage for admin reporting
  async getUsageForAdmin(filters: AdminUsageFiltersDto): Promise<voice_monthly_usage[]>
}
```

**Key rules**:
- `checkAndReserveMinute()` logic:
  1. Get tenant's subscription plan (`voice_ai_minutes_included`, `voice_ai_overage_rate`)
  2. Get current month usage via `getOrCreateMonthlyUsage()`
  3. If `minutes_used < voice_ai_minutes_included`: increment, return `{ allowed: true, is_overage: false }`
  4. Else if `voice_ai_overage_rate IS NOT NULL`: increment `overage_minutes`, return `{ allowed: true, is_overage: true }`
  5. Else: return `{ allowed: false, reason: 'quota_exceeded' }`
- `recordCallDuration()` converts seconds to minutes (ceiling) — one minute increments
- Monthly reset runs on the 1st of each month (BullMQ job, see scheduler)

---

## Task 2: QuotaCheckResult interface

```typescript
export interface QuotaCheckResult {
  allowed: boolean;
  is_overage: boolean;
  reason?: 'quota_exceeded' | 'plan_not_included' | 'tenant_disabled';
  minutes_used: number;
  minutes_included: number;
  overage_rate: number | null;
}
```

---

## Task 3: UsageSummaryDto

```typescript
export class UsageSummaryDto {
  tenant_id: string;
  year: number;
  month: number;
  minutes_used: number;
  minutes_included: number;
  overage_minutes: number;
  estimated_overage_cost: number | null;
  total_calls: number;
  percentage_used: number;   // minutes_used / minutes_included * 100
}
```

---

## Task 4: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/services/voice-usage.service.ts` | VERIFY/MODIFY | All 6 methods |
| `api/src/modules/voice-ai/dto/usage-summary.dto.ts` | VERIFY/CREATE | Usage summary response |
| `api/src/modules/voice-ai/interfaces/quota-check-result.interface.ts` | VERIFY/CREATE | Quota check result |

---

## Acceptance Criteria

- [ ] `checkAndReserveMinute()` respects plan quota and overage settings
- [ ] Returns `{ allowed: false, reason: 'quota_exceeded' }` when over limit with no overage rate
- [ ] Returns `{ allowed: true, is_overage: true }` when over limit but overage rate is set
- [ ] `getOrCreateMonthlyUsage()` uses upsert to avoid duplicate rows
- [ ] `npm run build` passes with 0 errors
