YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B10 — BullMQ Background Jobs

**Module**: Voice AI  
**Sprint**: B10  
**Depends on**: B07, B09  
**Estimated scope**: ~1.5 hours

---

## Objective

Add two background jobs: monthly quota reset (1st of each month) and daily usage reconciliation (recalculate minutes from call logs to fix any drift).

---

## Pre-Coding Checklist

- [ ] B07, B09 are complete
- [ ] Read `/api/src/modules/communication/processors/send-sms.processor.ts` — BullMQ processor pattern
- [ ] Read `/api/src/modules/communication/schedulers/` — cron scheduler pattern
- [ ] Check how queues are registered in `communication.module.ts` — replicate same pattern

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: Register Queues

In `voice-ai.module.ts`, add queue registration:

```typescript
BullModule.registerQueue(
  { name: 'voice-ai-quota-reset' },
  { name: 'voice-ai-usage-sync' },
)
```

---

## Task 2: Quota Reset Processor

`/api/src/modules/voice-ai/processors/voice-ai-quota-reset.processor.ts`:

```typescript
@Processor('voice-ai-quota-reset')
export class VoiceAiQuotaResetProcessor {
  constructor(private readonly prisma: PrismaService) {}

  @Process()
  async process(job: Job): Promise<void> {
    // Called on 1st of each month
    // Gets previous month's year/month
    const now = new Date();
    // Correct previous month calculation: new Date(y, m-1, 1) handles January→December rollover
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevDate.getMonth() + 1;  // getMonth() is 0-indexed
    const prevYear = prevDate.getFullYear();

    // Reset all tenant usage records for the month being reset
    // NOTE: We do NOT delete records — we keep them for billing history
    // Instead, we create new records for the new month (they auto-create on first call)
    // This job just logs the reset and sends any billing summary needed
    
    // Aggregate STT usage for the previous month (STT seconds = call duration proxy)
    // voice_usage_record is per-call per-provider — aggregate via _sum, not monthly counter
    const sttAgg = await this.prisma.voice_usage_record.aggregate({
      where: { year: prevYear, month: prevMonth, provider_type: 'STT' },
      _sum: { usage_quantity: true },
      _count: { id: true },
    });
    const totalMinutes = Math.ceil(Number(sttAgg._sum.usage_quantity ?? 0) / 60);
    // Records are immutable per-call rows — new month starts fresh automatically on first call
    console.log(`Voice AI monthly reset: ${sttAgg._count.id} STT usage records, ~${totalMinutes} minutes used in ${prevMonth}/${prevYear}`);
  }
}
```

---

## Task 3: Usage Sync Processor

`/api/src/modules/voice-ai/processors/voice-ai-usage-sync.processor.ts`:

```typescript
@Processor('voice-ai-usage-sync')
export class VoiceAiUsageSyncProcessor {
  constructor(private readonly prisma: PrismaService) {}

  @Process()
  async process(job: Job): Promise<void> {
    // Audit: verify usage records are consistent with call logs for the current month.
    // voice_usage_record is per-call per-provider — there is no monthly aggregate to upsert.
    // This job logs any discrepancies for ops visibility.
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    // Count completed calls this month
    const callCount = await this.prisma.voice_call_log.count({
      where: {
        started_at: { gte: monthStart, lt: monthEnd },
        status: 'completed',
      },
    });

    // Count usage records this month
    const usageCount = await this.prisma.voice_usage_record.count({
      where: { year, month },
    });

    // Aggregate STT seconds → convert to minutes for reporting
    const sttAgg = await this.prisma.voice_usage_record.aggregate({
      where: { year, month, provider_type: 'STT' },
      _sum: { usage_quantity: true },
    });
    const totalMinutes = Math.ceil(Number(sttAgg._sum.usage_quantity ?? 0) / 60);

    console.log(
      `Voice AI usage sync ${month}/${year}: ` +
      `${callCount} completed calls, ${usageCount} usage records, ~${totalMinutes} total STT minutes`
    );

    // Warn if calls exist without usage records (indicates missing billing data)
    if (callCount > 0 && usageCount < callCount) {
      console.warn(
        `WARNING: ${callCount} completed calls but only ${usageCount} usage records — ` +
        `some calls may be missing usage tracking`
      );
    }
  }
}
```

---

## Task 4: Scheduler

`/api/src/modules/voice-ai/schedulers/voice-ai-jobs.scheduler.ts`:

```typescript
@Injectable()
export class VoiceAiJobsScheduler {
  constructor(
    @InjectQueue('voice-ai-quota-reset') private quotaResetQueue: Queue,
    @InjectQueue('voice-ai-usage-sync') private usageSyncQueue: Queue,
  ) {}

  @Cron('0 0 1 * *')  // 1st of every month at midnight
  async scheduleMonthlyReset(): Promise<void> {
    await this.quotaResetQueue.add('monthly-reset', {}, { jobId: 'monthly-reset' });
  }

  @Cron('0 2 * * *')  // Every day at 2 AM
  async scheduleDailySync(): Promise<void> {
    await this.usageSyncQueue.add('daily-sync', {}, { jobId: `daily-sync-${Date.now()}` });
  }
}
```

---

## Task 5: Update Module

Add to `voice-ai.module.ts`:
- **IMPORTANT**: Check `/api/src/app.module.ts` first — `ScheduleModule.forRoot()` must exist there. DO NOT add it to `voice-ai.module.ts` (duplicating ScheduleModule causes double-firing of cron jobs). Only add the scheduler as a provider.
- Import `BullModule.registerQueue(...)` for both queues
- Add processors and scheduler to providers

---

## Acceptance Criteria

- [ ] Both queues registered without errors on startup
- [ ] Processors compile and can be triggered manually (test via Bull board if available)
- [ ] Scheduler registered with correct cron expressions
- [ ] `npm run build` passes
- [ ] No errors in server startup logs related to voice-ai queues
