YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B09 — Quota Enforcement

**Module**: Voice AI
**Sprint**: B09
**Depends on**: B01, B07

---

## Objective

Add a quota guard that enforces per-tenant minute limits before the Python agent can start serving calls. The Python agent reads `quota_exceeded` and `overage_rate` from the context response and decides whether to accept the call — this sprint makes sure those values are accurate and that overage tracking is wired into `completeCall`.

---

## Pre-Coding Checklist

- [ ] B07 is complete — `VoiceUsageService.getQuota()` exists and aggregates STT seconds from `voice_usage_record`
- [ ] B06 is complete — internal context endpoint includes `quota` object
- [ ] Review `voice_call_log` model from B01 — has `is_overage Boolean @default(false)`
- [ ] Understand that B07's `completeCall` uses a Prisma transaction to update call log + create usage records — B09 adds `is_overage` to that flow

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: checkAndReserveMinute Method

Add to `VoiceUsageService`:

```typescript
async checkAndReserveMinute(tenantId: string): Promise<{
  allowed: boolean;
  is_overage: boolean;
  reason?: string;
}> {
  const quota = await this.getQuota(tenantId);

  if (quota.minutes_used < quota.minutes_included) {
    return { allowed: true, is_overage: false };
  }

  if (quota.overage_rate === null) {
    return { allowed: false, is_overage: false, reason: 'quota_exceeded' };
  }

  // Quota exceeded but overage is allowed
  return { allowed: true, is_overage: true };
}
```

**Note**: This method is informational — the Python agent makes the final decision via the `quota_exceeded` + `overage_rate` fields in the context response. `checkAndReserveMinute` is available for server-side enforcement if needed (e.g., as a pre-flight check in the access endpoint API-026).

---

## Task 2: Verify Context Builder Quota Object

In `VoiceAiContextBuilderService.buildContext()` (from B04), confirm the returned `quota` object includes all fields the Python agent needs:

```typescript
quota: {
  minutes_included: number;
  minutes_used: number;
  minutes_remaining: number;
  overage_rate: number | null;
  quota_exceeded: boolean;   // true if minutes_used >= minutes_included
}
```

The `quota_exceeded` flag must be accurate — it is derived from `VoiceUsageService.getQuota()` which aggregates STT seconds from `voice_usage_record` for the current month.

---

## Task 3: Wire is_overage into completeCall

The `CompleteCallDto` (from B06) should include an optional `is_overage` flag. Update `VoiceAiInternalService.completeCall()` (from B06/B07) to persist this flag:

```typescript
// In the Prisma transaction inside completeCall():
const callLog = await tx.voice_call_log.update({
  where: { call_sid: dto.call_sid },
  data: {
    status: 'completed',
    duration_seconds: dto.duration_seconds,
    outcome: dto.outcome,
    transcript_summary: dto.transcript_summary ?? null,
    full_transcript: dto.full_transcript ?? null,
    actions_taken: JSON.stringify(dto.actions_taken ?? []),
    lead_id: dto.lead_id ?? null,
    is_overage: dto.is_overage ?? false,   // <-- set overage flag
    ended_at: new Date(),
  },
});
```

The Python agent (A09) sets `is_overage` based on the quota check it performed at call start. The flag is stored for billing reconciliation — overage calls have `is_overage = true` in `voice_call_log`.

---

## Task 4: Verify CompleteCallDto (verification only — field was added in B06b)

`is_overage` was already added to `CompleteCallDto` in sprint B06b. No code change needed here — this task is a sanity check. Confirm the field exists in `complete-call.dto.ts`:

```typescript
export class CompleteCallDto {
  @IsString()
  call_sid: string;

  @IsInt()
  @Min(0)
  duration_seconds: number;

  @IsString()
  @IsIn(['completed', 'transferred', 'voicemail', 'abandoned', 'error'])
  outcome: string;

  @IsOptional()
  @IsString()
  transcript_summary?: string;

  @IsOptional()
  @IsString()
  full_transcript?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actions_taken?: string[];

  @IsOptional()
  @IsString()
  lead_id?: string;

  @IsOptional()
  @IsBoolean()
  is_overage?: boolean;   // true if call consumed overage minutes

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UsageRecordDto)
  usage_records?: UsageRecordDto[];
}
```

---

## Acceptance Criteria

- [ ] `VoiceUsageService.checkAndReserveMinute()` returns `allowed: false` when quota exceeded with no overage rate
- [ ] `VoiceUsageService.checkAndReserveMinute()` returns `allowed: true, is_overage: true` when quota exceeded but overage rate set
- [ ] `buildContext()` includes accurate `quota_exceeded` boolean (aggregated from `voice_usage_record` STT seconds)
- [ ] `CompleteCallDto` has optional `is_overage: boolean` field
- [ ] `completeCall()` persists `is_overage` to `voice_call_log.is_overage`
- [ ] No references to `overage_minutes_used` — that field does not exist (usage tracked via per-call `voice_usage_record` rows)
- [ ] No references to `recordUsage(tenantId, durationSeconds)` — B07 handles usage via `createUsageRecords(tx, tenantId, callLogId, records[])`
- [ ] `npm run build` passes
