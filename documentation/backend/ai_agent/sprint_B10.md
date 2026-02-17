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
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    // Reset all tenant usage records for the month being reset
    // NOTE: We do NOT delete records — we keep them for billing history
    // Instead, we create new records for the new month (they auto-create on first call)
    // This job just logs the reset and sends any billing summary needed
    
    const previousMonthRecords = await this.prisma.voice_usage_record.findMany({
      where: { year: prevYear, month: prevMonth },
    });
    
    // Log: X tenants used Voice AI in previous month, total Y minutes
    console.log(`Voice AI monthly reset: ${previousMonthRecords.length} tenants, ${previousMonthRecords.reduce((sum, r) => sum + r.minutes_used, 0)} minutes used`);
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
    // Reconcile usage records against actual call logs
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Get all tenants with call logs this month
    const callSummaries = await this.prisma.voice_call_log.groupBy({
      by: ['tenant_id'],
      where: {
        started_at: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
        status: 'completed',
        is_overage: false,
      },
      _sum: { duration_seconds: true },
      _count: { id: true },
    });

    // Update usage records to match actual call data
    for (const summary of callSummaries) {
      const actualMinutes = Math.ceil((summary._sum.duration_seconds ?? 0) / 60);
      await this.prisma.voice_usage_record.upsert({
        where: {
          tenant_id_year_month: {
            tenant_id: summary.tenant_id,
            year,
            month,
          },
        },
        update: {
          minutes_used: actualMinutes,
          total_calls: summary._count.id,
        },
        create: {
          tenant_id: summary.tenant_id,
          year,
          month,
          minutes_used: actualMinutes,
          total_calls: summary._count.id,
        },
      });
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
- Import `ScheduleModule.forRoot()` (or check if already imported in AppModule)
- Import `BullModule.registerQueue(...)` for both queues
- Add processors and scheduler to providers

---

## Acceptance Criteria

- [ ] Both queues registered without errors on startup
- [ ] Processors compile and can be triggered manually (test via Bull board if available)
- [ ] Scheduler registered with correct cron expressions
- [ ] `npm run build` passes
- [ ] No errors in server startup logs related to voice-ai queues
