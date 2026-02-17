YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B09 — Quota Enforcement

**Module**: Voice AI  
**Sprint**: B09  
**Depends on**: B01, B07  
**Estimated scope**: ~1.5 hours

---

## Objective

Add a quota guard that enforces per-tenant minute limits before the Python agent can start serving calls. Also add migration to track overage per call.

---

## Pre-Coding Checklist

- [ ] B07 is complete — `VoiceUsageService.getQuota()` exists
- [ ] B06 is complete — internal context endpoint exists
- [ ] Review `voice_call_log` model — needs `is_overage` field (already in B01 schema)
- [ ] Review `voice_usage_record` model — needs `overage_minutes_used` field (already in B01 schema)

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: Enhanced checkAndReserve Method

Update `VoiceUsageService` with an atomic quota check:

```typescript
async checkAndReserveMinute(tenantId: string): Promise<{
  allowed: boolean;
  is_overage: boolean;
  reason?: string;
}>
// Logic:
// 1. Get quota: minutes_included, minutes_used, overage_rate
// 2. If minutes_used < minutes_included: return { allowed: true, is_overage: false }
// 3. If minutes_used >= minutes_included AND overage_rate is null: return { allowed: false, reason: 'quota_exceeded' }
// 4. If minutes_used >= minutes_included AND overage_rate is NOT null: return { allowed: true, is_overage: true }
```

---

## Task 2: Update Context Builder

In `VoiceAiContextBuilderService.buildContext()`, ensure the quota object includes:
```typescript
quota: {
  minutes_included: number;
  minutes_used: number;
  minutes_remaining: number;
  overage_rate: number | null;
  quota_exceeded: boolean;   // true if minutes_used >= minutes_included
}
```

The Python agent is responsible for checking `quota_exceeded` and `overage_rate` to decide whether to accept the call.

---

## Task 3: Update recordUsage for Overage Tracking

Update `VoiceUsageService.recordUsage()` to accept `isOverage` flag:

```typescript
async recordUsage(tenantId: string, durationSeconds: number, isOverage: boolean = false): Promise<void>
// If isOverage: increment overage_minutes_used, NOT minutes_used
// If NOT isOverage: increment minutes_used
// Always increment total_calls
// Calculate estimated_overage_cost if is_overage and overage_rate exists:
//   estimated_overage_cost += (billableMinutes * overage_rate)
```

Update `VoiceCallLogService.endCall()` to pass the `isOverage` flag from the call log to `recordUsage`.

---

## Task 4: Update endCall to Pass isOverage

The `EndCallDto` already has (or should have) the `is_overage` flag. In `VoiceCallLogService.endCall()`:

```typescript
// After updating call log, record usage:
await this.usageService.recordUsage(
  callLog.tenant_id,
  dto.durationSeconds,
  dto.isOverage ?? false,
);
```

---

## Acceptance Criteria

- [ ] `VoiceUsageService.checkAndReserveMinute()` returns `allowed: false` when quota exceeded with no overage rate
- [ ] `VoiceUsageService.checkAndReserveMinute()` returns `allowed: true, is_overage: true` when quota exceeded but overage rate set
- [ ] `buildContext()` includes accurate `quota_exceeded` boolean
- [ ] `recordUsage()` tracks overage minutes separately from regular minutes
- [ ] `estimated_overage_cost` calculated when applicable
- [ ] `npm run build` passes
