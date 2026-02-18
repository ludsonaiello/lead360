YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B07 — Call Logging + Usage Tracking

**Module**: Voice AI
**Sprint**: B07
**Depends on**: B01, B06a, B06b

---

## Objective

Build dedicated call log and usage tracking services. `voice_usage_record` stores **per-call, per-provider** granular records (NOT monthly aggregates). This enables accurate cost attribution, provider-level billing, and historical reconciliation. Admin endpoints provide cross-tenant visibility.

---

## Pre-Coding Checklist

- [ ] B06 is complete — internal API exists with `CompleteCallDto.usage_records`
- [ ] Read `/api/src/modules/communication/services/call-management.service.ts` — call record pattern
- [ ] Understand `voice_usage_record` schema from B01: `call_log_id`, `provider_id`, `provider_type`, `usage_quantity`, `usage_unit`, `estimated_cost`, `year`, `month`
- [ ] Understand `voice_call_log` schema: `stt_provider_id`, `llm_provider_id`, `tts_provider_id` fields

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: Call Log Service

Create `voice-call-log.service.ts`:

```typescript
@Injectable()
export class VoiceCallLogService {
  constructor(private readonly prisma: PrismaService) {}

  async startCall(data: {
    tenantId: string;
    callSid: string;
    fromNumber: string;
    toNumber: string;
    direction?: string;
    sttProviderId?: string;
    llmProviderId?: string;
    ttsProviderId?: string;
  }): Promise<{ call_log_id: string }> {
    const log = await this.prisma.voice_call_log.create({
      data: {
        tenant_id: data.tenantId,
        call_sid: data.callSid,
        from_number: data.fromNumber,
        to_number: data.toNumber,
        direction: data.direction ?? 'inbound',
        status: 'in_progress',
        stt_provider_id: data.sttProviderId,
        llm_provider_id: data.llmProviderId,
        tts_provider_id: data.ttsProviderId,
      },
    });
    return { call_log_id: log.id };
  }

  async completeCall(data: {
    callSid: string;
    durationSeconds: number;
    outcome: string;
    transcriptSummary?: string;
    fullTranscript?: string;
    actionsTaken?: string[];
    leadId?: string;
    isOverage?: boolean;
    usageRecords?: UsageRecordData[];
  }): Promise<void>
  // 1. Find call_log by call_sid
  // 2. Update: status='completed', duration_seconds, outcome, transcript_summary, full_transcript,
  //            actions_taken (JSON.stringify), lead_id, is_overage, ended_at=now()
  // 3. Create voice_usage_record rows for each entry in usageRecords (see Task 2)
  // ALL in a single transaction

  async findByTenantId(
    tenantId: string,
    filters: { from?: Date; to?: Date; outcome?: string; page?: number; limit?: number },
  ): Promise<{ data: VoiceCallLogDto[]; meta: PaginationMeta }>

  async findById(tenantId: string, id: string): Promise<VoiceCallLogDto>

  async findAllAdmin(filters: {
    tenantId?: string;
    from?: Date;
    to?: Date;
    outcome?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: VoiceCallLogDto[]; meta: PaginationMeta }>
  // Admin only — NO tenant_id filter applied
}
```

---

## Task 2: Usage Service

**CRITICAL ARCHITECTURE**: `voice_usage_record` is per-call per-provider granular. Do NOT use upsert on tenant+year+month. Each call creates 1–3 new rows (one per provider: STT, LLM, TTS).

```typescript
@Injectable()
export class VoiceUsageService {
  constructor(private readonly prisma: PrismaService) {}

  // Called from VoiceCallLogService.completeCall() inside the same transaction
  async createUsageRecords(
    prismaTransaction: Prisma.TransactionClient,
    tenantId: string,
    callLogId: string,
    records: UsageRecordData[],
  ): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    await prismaTransaction.voice_usage_record.createMany({
      data: records.map(r => ({
        tenant_id: tenantId,
        call_log_id: callLogId,
        provider_id: r.provider_id,
        provider_type: r.provider_type,
        usage_quantity: r.usage_quantity,
        usage_unit: r.usage_unit,
        estimated_cost: r.estimated_cost ?? null,
        year,
        month,
      })),
    });
  }

  // Compute quota by aggregating from per-call records
  async getQuota(tenantId: string): Promise<{
    minutes_included: number;
    minutes_used: number;     // current month STT seconds → converted to minutes
    minutes_remaining: number;
    overage_rate: number | null;
    quota_exceeded: boolean;
  }> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Get plan limits from tenant's subscription
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription_plan: true },
    });
    const settings = await this.prisma.tenant_voice_ai_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const minutesIncluded =
      settings?.monthly_minutes_override ??
      tenant?.subscription_plan?.voice_ai_minutes_included ??
      0;
    const overageRate = tenant?.subscription_plan?.voice_ai_overage_rate
      ? Number(tenant.subscription_plan.voice_ai_overage_rate)
      : null;

    // Aggregate STT seconds for the month (STT usage = call duration proxy)
    const sttUsage = await this.prisma.voice_usage_record.aggregate({
      where: {
        tenant_id: tenantId,
        provider_type: 'STT',
        year,
        month,
      },
      _sum: { usage_quantity: true },
    });

    const totalSeconds = Number(sttUsage._sum.usage_quantity ?? 0);
    const minutesUsed = Math.ceil(totalSeconds / 60);
    const minutesRemaining = Math.max(0, minutesIncluded - minutesUsed);
    const quotaExceeded = minutesUsed >= minutesIncluded && overageRate === null;

    return {
      minutes_included: minutesIncluded,
      minutes_used: minutesUsed,
      minutes_remaining: minutesRemaining,
      overage_rate: overageRate,
      quota_exceeded: quotaExceeded,
    };
  }

  async getUsageSummary(tenantId: string, year: number, month: number): Promise<{
    year: number;
    month: number;
    total_calls: number;
    total_stt_seconds: number;
    total_llm_tokens: number;
    total_tts_characters: number;
    estimated_cost: number;
    by_provider: ProviderUsageSummary[];
  }> {
    // Aggregate from voice_usage_record grouped by provider_type and provider_id
    const records = await this.prisma.voice_usage_record.groupBy({
      by: ['provider_id', 'provider_type', 'usage_unit'],
      where: { tenant_id: tenantId, year, month },
      _sum: { usage_quantity: true, estimated_cost: true },
      _count: { call_log_id: true },
    });

    const totalCalls = await this.prisma.voice_call_log.count({
      where: {
        tenant_id: tenantId,
        started_at: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
    });

    // Build structured response
    // ...aggregate totals and per-provider breakdown
  }

  async getAdminUsageReport(year: number, month: number): Promise<AdminUsageReport> {
    // Cross-tenant aggregate: total calls, total STT seconds, estimated cost, per-tenant breakdown
    // Group by tenant_id, aggregate all usage records for year+month
  }
}
```

---

## Task 3: Types

```typescript
export interface UsageRecordData {
  provider_id: string;
  provider_type: 'STT' | 'LLM' | 'TTS';
  usage_quantity: number;
  usage_unit: 'seconds' | 'tokens' | 'characters';
  estimated_cost?: number;
}

export interface ProviderUsageSummary {
  provider_id: string;
  provider_type: string;
  provider_name: string;
  total_quantity: number;
  unit: string;
  estimated_cost: number;
}

export interface AdminUsageReport {
  year: number;
  month: number;
  total_calls: number;
  total_stt_seconds: number;
  total_estimated_cost: number;
  by_tenant: {
    tenant_id: string;
    tenant_name: string;
    total_calls: number;
    total_stt_seconds: number;
    estimated_cost: number;
  }[];
}
```

---

## Task 4: Tenant Endpoints

Add to `voice-ai-call-logs.controller.ts` or the tenant controller:

```
GET /api/v1/voice-ai/call-logs              → findByTenantId(tenant_id, filters)
GET /api/v1/voice-ai/call-logs/:id          → findById(tenant_id, id)
GET /api/v1/voice-ai/usage                  → getUsageSummary(tenant_id, year, month)
```

Query params for list: `from`, `to`, `outcome`, `page` (default 1), `limit` (default 20).
Query params for usage: `year` (default current year), `month` (default current month).

---

## Task 5: Admin Endpoints

Add to admin controller:

```
GET /api/v1/system/voice-ai/call-logs       → findAllAdmin(filters)
GET /api/v1/system/voice-ai/usage-report    → getAdminUsageReport(year, month)
```

Admin endpoints — `is_platform_admin` required.

---

## Task 6: Wire completeCall Transaction

Update `VoiceAiInternalService.completeCall()` (from B06) to use a Prisma transaction:

```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Update call log
  const callLog = await tx.voice_call_log.update({
    where: { call_sid: dto.call_sid },
    data: {
      status: 'completed',
      duration_seconds: dto.duration_seconds,
      outcome: dto.outcome,
      transcript_summary: dto.transcript_summary,
      full_transcript: dto.full_transcript,
      actions_taken: JSON.stringify(dto.actions_taken ?? []),
      lead_id: dto.lead_id,
      is_overage: dto.is_overage ?? false,
      ended_at: new Date(),
    },
  });

  // 2. Create usage records (per-provider)
  if (dto.usage_records?.length) {
    await this.usageService.createUsageRecords(tx, callLog.tenant_id, callLog.id, dto.usage_records);
  }
});
```

---

## Task 7: Update Module

Add to `voice-ai.module.ts`:
- `VoiceCallLogService`
- `VoiceUsageService`
- `VoiceAiCallLogsController` (tenant)
- Export both services (needed by B09 quota guard)

---

## Acceptance Criteria

- [ ] `GET /api/v1/voice-ai/call-logs` returns tenant's paginated call logs
- [ ] `GET /api/v1/voice-ai/call-logs/:id` returns single call with full detail
- [ ] `GET /api/v1/voice-ai/usage?year=2026&month=2` returns month usage summary with per-provider breakdown
- [ ] `GET /api/v1/system/voice-ai/call-logs` returns cross-tenant logs (admin only)
- [ ] `GET /api/v1/system/voice-ai/usage-report` returns aggregate + per-tenant breakdown (admin only)
- [ ] `POST .../calls/:callSid/complete` with `usage_records` creates one `voice_usage_record` row per provider entry
- [ ] `voice_usage_record` has per-call granularity (NOT a monthly counter)
- [ ] Quota calculation aggregates STT seconds from `voice_usage_record` for current month
- [ ] All writes to call_log + usage_records done in a single transaction
- [ ] `npm run build` passes
