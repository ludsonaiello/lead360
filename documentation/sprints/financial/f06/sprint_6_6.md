# Sprint 6_6 — BullMQ Scheduler + Processor + Module Wiring

**Module:** Financial / Jobs
**File:** ./documentation/sprints/financial/f06/sprint_6_6.md
**Type:** Backend — Infrastructure (BullMQ)
**Depends On:** Sprint 6_4 (processRule method), Sprint 6_5 (service registered and exported)
**Gate:** STOP — Scheduler must be registered with cron. Processor must be instantiated. Queue must be registered. Dev server must compile and show processor initialization log.
**Estimated Complexity:** High

---

> **You are a masterclass-level backend engineer.** Your code quality makes engineers at Google, Amazon, and Apple jealous. Every line you write is precise, intentional, and production-grade.

> **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> **MySQL credentials** are in the `.env` file at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.

---

## Objective

Create the BullMQ scheduler (cron job) and processor for the recurring expense engine. Register the new queue in the Jobs module. Wire all module dependencies so the scheduler runs nightly and the processor generates entries.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/jobs/jobs.module.ts` — understand queue registration, processor injection, and module initialization pattern
- [ ] Read `/var/www/lead360.app/api/src/modules/jobs/schedulers/scheduled-job-executor.scheduler.ts` — understand the cron scheduler pattern
- [ ] Read `/var/www/lead360.app/api/src/modules/jobs/processors/send-email.processor.ts` — understand the processor pattern (extends WorkerHost)
- [ ] Read `/var/www/lead360.app/api/src/modules/jobs/processors/scheduled-jobs.processor.ts` — understand the processor routing pattern
- [ ] Read `/var/www/lead360.app/api/src/modules/jobs/services/job-queue.service.ts` — understand queue health checks and job enqueuing
- [ ] Verify `RecurringExpenseService` is exported from `financial.module.ts` (Sprint 6_5)
- [ ] Verify `@nestjs/schedule` is installed (it is: version ^6.1.0)
- [ ] Verify `@nestjs/bullmq` is installed (check package.json)

---

## Dev Server

> This project does NOT use PM2. Do not reference or run PM2 commands.
> Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   ← must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   ← must return nothing
```

---

## Tasks

### Task 1 — Create the Recurring Expense Scheduler

**File:** `/var/www/lead360.app/api/src/modules/jobs/schedulers/recurring-expense.scheduler.ts`

**Pattern:** Follow `scheduled-job-executor.scheduler.ts` exactly. Use `@Cron()` from `@nestjs/schedule`.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class RecurringExpenseScheduler {
  private readonly logger = new Logger(RecurringExpenseScheduler.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('recurring-expense-generation') private readonly recurringExpenseQueue: Queue,
  ) {}

  /**
   * Runs nightly at 02:00 AM server time.
   * Queries all active recurring rules that are due (next_due_date <= today).
   * Enqueues a job for each due rule.
   * Does NOT generate entries directly — only enqueues jobs.
   */
  @Cron('0 2 * * *')  // Every day at 02:00 AM
  async processRecurringExpenses() {
    if (this.isRunning) {
      this.logger.warn('Recurring expense scheduler already running — skipping');
      return;
    }

    this.isRunning = true;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Add one day to make the comparison inclusive of today
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find all active rules with next_due_date <= today
      const dueRules = await this.prisma.recurring_expense_rule.findMany({
        where: {
          status: 'active',
          next_due_date: {
            lt: tomorrow,  // next_due_date < tomorrow (i.e., <= today for DATE fields)
          },
        },
        select: {
          id: true,
          tenant_id: true,
          name: true,
        },
      });

      this.logger.log(`Found ${dueRules.length} recurring expense rules due for processing`);

      let enqueued = 0;
      let failed = 0;

      for (const rule of dueRules) {
        try {
          await this.recurringExpenseQueue.add(
            'recurring-expense-generate',
            {
              ruleId: rule.id,
              tenantId: rule.tenant_id,
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 10000,  // Start at 10 seconds
              },
              removeOnComplete: {
                age: 86400,    // Keep completed jobs for 24 hours
                count: 500,
              },
              removeOnFail: false,  // Keep failed for inspection
            },
          );

          enqueued++;
          this.logger.debug(`Enqueued recurring expense job for rule: ${rule.name} (${rule.id})`);
        } catch (error) {
          failed++;
          this.logger.error(`Failed to enqueue job for rule ${rule.name} (${rule.id}): ${error.message}`);
        }
      }

      this.logger.log(`Recurring expense scheduler complete: ${enqueued} enqueued, ${failed} failed`);
    } catch (error) {
      this.logger.error(`Recurring expense scheduler failed: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }
}
```

**Key patterns from the existing scheduler:**
- Mutual exclusion guard (`isRunning`) prevents overlapping execution
- `@Cron('0 2 * * *')` — runs at 02:00 AM server time
- Only enqueues jobs — does NOT process them
- Each job gets the `ruleId` and `tenantId` as payload
- Retry: 3 attempts, exponential backoff starting at 10 seconds

---

### Task 2 — Create the Recurring Expense Processor

**File:** `/var/www/lead360.app/api/src/modules/jobs/processors/recurring-expense.processor.ts`

**Pattern:** Follow `send-email.processor.ts` exactly. Extend `WorkerHost`.

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RecurringExpenseService } from '../../financial/services/recurring-expense.service';

interface RecurringExpenseJobPayload {
  ruleId: string;
  tenantId: string;
}

@Processor('recurring-expense-generation')
export class RecurringExpenseProcessor extends WorkerHost {
  private readonly logger = new Logger(RecurringExpenseProcessor.name);

  constructor(
    private readonly recurringExpenseService: RecurringExpenseService,
  ) {
    super();
    this.logger.log('RecurringExpenseProcessor worker initialized and ready');
  }

  async process(job: Job<RecurringExpenseJobPayload>): Promise<any> {
    const { ruleId, tenantId } = job.data;

    this.logger.log(`Processing recurring expense job: rule ${ruleId}, tenant ${tenantId}`);

    try {
      const entry = await this.recurringExpenseService.processRule(ruleId, tenantId);

      if (entry) {
        this.logger.log(`Successfully generated entry ${entry.id} for rule ${ruleId}`);
        return { success: true, entryId: entry.id };
      } else {
        this.logger.log(`Rule ${ruleId} skipped (not due, paused, or duplicate)`);
        return { success: true, skipped: true };
      }
    } catch (error) {
      this.logger.error(`Failed to process recurring expense rule ${ruleId}: ${error.message}`, error.stack);

      // On final attempt, log but don't poison the queue
      if (job.attemptsMade >= (job.opts?.attempts ?? 3) - 1) {
        this.logger.error(`Final attempt failed for rule ${ruleId} — marking complete to prevent queue poisoning`);
        return { success: false, error: error.message, finalAttempt: true };
      }

      throw error;  // Throw to trigger retry
    }
  }
}
```

**Key patterns from existing processors:**
- `@Processor('queue-name')` decorator binds to the queue
- `extends WorkerHost` from `@nestjs/bullmq`
- `process(job: Job)` is called for each job
- Return value on success, throw error to trigger retry
- On final attempt, return (don't throw) to prevent queue poisoning
- Log initialization in constructor

---

### Task 3 — Register Queue in Jobs Module

**File:** `/var/www/lead360.app/api/src/modules/jobs/jobs.module.ts`

**Changes:**

1. Add `{ name: 'recurring-expense-generation' }` to the `BullModule.registerQueue()` call:

   Before:
   ```typescript
   BullModule.registerQueue(
     { name: 'email' },
     { name: 'scheduled' },
     { name: 'export' },
     { name: 'scheduled-reports' },
   ),
   ```

   After:
   ```typescript
   BullModule.registerQueue(
     { name: 'email' },
     { name: 'scheduled' },
     { name: 'export' },
     { name: 'scheduled-reports' },
     { name: 'recurring-expense-generation' },
   ),
   ```

2. Add imports:
   ```typescript
   import { RecurringExpenseProcessor } from './processors/recurring-expense.processor';
   import { RecurringExpenseScheduler } from './schedulers/recurring-expense.scheduler';
   ```

3. Add `RecurringExpenseProcessor` and `RecurringExpenseScheduler` to the `providers` array.

4. **CRITICAL: Inject the processor in the module constructor** to force instantiation (following existing pattern):

   Read the existing constructor carefully. It already injects `SendEmailProcessor` and `ScheduledJobsProcessor`. Add `RecurringExpenseProcessor`:

   ```typescript
   constructor(
     private moduleRef: ModuleRef,
     private sendEmailProcessor: SendEmailProcessor,
     private scheduledJobsProcessor: ScheduledJobsProcessor,
     private recurringExpenseProcessor: RecurringExpenseProcessor,  // ADD THIS
   ) {}
   ```

5. Add the processor verification in `onModuleInit()`:

   ```typescript
   const processors = [
     { name: 'SendEmailProcessor', instance: this.sendEmailProcessor },
     { name: 'ScheduledJobsProcessor', instance: this.scheduledJobsProcessor },
     { name: 'RecurringExpenseProcessor', instance: this.recurringExpenseProcessor },  // ADD THIS
   ];
   ```

6. **Import FinancialModule** in the Jobs module imports array:

   The `RecurringExpenseProcessor` injects `RecurringExpenseService`, which is provided by `FinancialModule`. Add:

   ```typescript
   import { FinancialModule } from '../financial/financial.module';
   ```

   And add `FinancialModule` to the `imports` array.

   **IMPORTANT:** Check for circular dependency! If `FinancialModule` already imports `JobsModule`, this will create a circular import. In that case, use `forwardRef`:

   ```typescript
   imports: [
     forwardRef(() => FinancialModule),
     // ... existing imports
   ]
   ```

   And in `FinancialModule`:
   ```typescript
   imports: [
     forwardRef(() => JobsModule),
     // ... existing imports
   ]
   ```

   Read both module files to determine if circular dependency exists.

---

### Task 4 — Update RecurringExpenseService for Queue Injection

**File:** `/var/www/lead360.app/api/src/modules/financial/services/recurring-expense.service.ts`

**Changes:**

1. Add queue import:
   ```typescript
   import { InjectQueue } from '@nestjs/bullmq';
   import { Queue } from 'bullmq';
   ```

2. Update constructor:
   ```typescript
   constructor(
     private readonly prisma: PrismaService,
     private readonly auditLogger: AuditLoggerService,
     private readonly financialEntryService: FinancialEntryService,
     @InjectQueue('recurring-expense-generation') private readonly recurringExpenseQueue: Queue,
   ) {}
   ```

3. Update `triggerNow()` method — replace the direct `processRule()` call with queue enqueue:

   ```typescript
   async triggerNow(tenantId: string, ruleId: string, userId: string) {
     const rule = await this.prisma.recurring_expense_rule.findFirst({
       where: { id: ruleId, tenant_id: tenantId },
     });
     if (!rule) throw new NotFoundException('Recurring rule not found');

     if (rule.status === 'cancelled' || rule.status === 'completed') {
       throw new BadRequestException(`Cannot trigger a ${rule.status} rule`);
     }

     await this.recurringExpenseQueue.add(
       'recurring-expense-generate',
       {
         ruleId,
         tenantId,
       },
       {
         priority: 1,  // High priority — manual trigger should process quickly
         attempts: 3,
         backoff: { type: 'exponential', delay: 10000 },
         removeOnComplete: { age: 86400, count: 100 },
         removeOnFail: false,
       },
     );

     await this.auditLogger.logTenantChange({
       action: 'updated',
       entityType: 'recurring_expense_rule',
       entityId: ruleId,
       tenantId,
       actorUserId: userId,
       description: `Manually triggered entry generation for rule: ${rule.name}`,
     });

     return { message: 'Entry generation triggered', rule_id: ruleId };
   }
   ```

4. **Update `financial.module.ts`** — add BullModule import for the queue:

   ```typescript
   import { BullModule } from '@nestjs/bullmq';
   ```

   Add to imports array:
   ```typescript
   BullModule.registerQueue({ name: 'recurring-expense-generation' }),
   ```

   **Note:** The queue needs to be registered in BOTH modules — in `JobsModule` (where the processor listens) and in `FinancialModule` (where the service enqueues). This is the standard BullMQ pattern.

---

### Task 5 — Verify Processor Initialization

**What:** Start the dev server and check the console logs for processor initialization.

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

**Expected in console output:**
```
RecurringExpenseProcessor worker initialized and ready
✓ RecurringExpenseProcessor instantiated and worker started
```

If you see this, the processor is correctly instantiated and listening on the `recurring-expense-generation` queue.

**Also verify:**
- No circular dependency errors
- No missing provider errors
- The scheduler's `@Cron('0 2 * * *')` decorator is recognized (check for ScheduleModule import in app.module.ts)

---

### Task 6 — Verify ScheduleModule is Imported

**What:** Check if `ScheduleModule` from `@nestjs/schedule` is imported in the app module. If not, the `@Cron()` decorator won't work.

Read `/var/www/lead360.app/api/src/app.module.ts` and check for:
```typescript
import { ScheduleModule } from '@nestjs/schedule';
```

And in the imports array:
```typescript
ScheduleModule.forRoot(),
```

If this is missing, add it. The `@Cron()` decorator requires `ScheduleModule.forRoot()` to be imported at the app level.

---

## Integration Points

| Module | What It Provides | How It's Used |
|--------|-----------------|---------------|
| `@nestjs/bullmq` | `@Processor`, `WorkerHost`, `@InjectQueue`, `BullModule.registerQueue` | Queue and processor infrastructure |
| `@nestjs/schedule` | `@Cron`, `ScheduleModule` | Cron-based scheduler |
| `FinancialModule` | `RecurringExpenseService` | Processor calls `processRule()` |
| `PrismaService` | Database access | Scheduler queries due rules |
| Redis | Queue backend | BullMQ message broker |

---

## Business Rules Enforced

- BR-11: Duplicate prevention is in `processRule()` (Sprint 6_4), not in the scheduler or processor
- Scheduler only enqueues — does not generate entries
- Processor calls service's `processRule()` which handles all business logic
- Retry: 3 attempts with exponential backoff (10s, 20s, 40s)
- On final failure: log error, don't poison queue

---

## Acceptance Criteria

- [ ] `recurring-expense.scheduler.ts` created with `@Cron('0 2 * * *')`
- [ ] Scheduler queries `recurring_expense_rule` where `status = 'active'` and `next_due_date <= TODAY`
- [ ] Scheduler enqueues jobs to `recurring-expense-generation` queue
- [ ] Scheduler has mutual exclusion guard (`isRunning` flag)
- [ ] `recurring-expense.processor.ts` created extending `WorkerHost`
- [ ] Processor calls `RecurringExpenseService.processRule()`
- [ ] Processor handles final-attempt failure gracefully (no queue poisoning)
- [ ] Queue `recurring-expense-generation` registered in `jobs.module.ts`
- [ ] Queue `recurring-expense-generation` also registered in `financial.module.ts` (for service injection)
- [ ] Processor injected in `JobsModule` constructor to force instantiation
- [ ] `FinancialModule` imported in `JobsModule` (or via forwardRef if circular)
- [ ] `RecurringExpenseService.triggerNow()` updated to use queue enqueue
- [ ] `ScheduleModule.forRoot()` imported in app module (if not already)
- [ ] Dev server compiles without errors
- [ ] Console shows "RecurringExpenseProcessor worker initialized and ready"
- [ ] No circular dependency errors
- [ ] No existing processors, schedulers, or queues removed
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — The dev server must compile cleanly. Console must show processor initialization. Queue must be registered. `@Cron('0 2 * * *')` must be set. Verify all of these before proceeding to Sprint 6_7.

---

## Handoff Notes

- Scheduler: `/var/www/lead360.app/api/src/modules/jobs/schedulers/recurring-expense.scheduler.ts`
- Processor: `/var/www/lead360.app/api/src/modules/jobs/processors/recurring-expense.processor.ts`
- Queue name: `recurring-expense-generation`
- Job name: `recurring-expense-generate`
- Job payload: `{ ruleId: string, tenantId: string }`
- Scheduler runs at `0 2 * * *` (02:00 AM daily)
- Retry: 3 attempts, exponential backoff starting at 10s
- The processor uses `RecurringExpenseService.processRule()` — the service handles ALL business logic
