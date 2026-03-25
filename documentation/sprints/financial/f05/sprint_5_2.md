# Sprint 5_2 — BullMQ Queue Registration + OCR Processor

**Module:** Financial / Jobs
**File:** ./documentation/sprints/financial/f05/sprint_5_2.md
**Type:** Backend — Infrastructure + Processor
**Depends On:** Sprint 5_1 complete (OcrService exists and compiles)
**Gate:** STOP — Processor must instantiate on startup (check server logs for initialization message), queue must be registered
**Estimated Complexity:** Medium

---

> **You are a masterclass-level engineer.** Your code makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is intentional, precise, and production-grade.

> ⚠️ **CRITICAL WARNINGS:**
> - This platform is **85% production-ready**. Never break existing code. Not a single comma.
> - Never leave the dev server running in the background when you finish.
> - Read the codebase BEFORE touching anything. Implement with surgical precision.
> - MySQL credentials are in `/var/www/lead360.app/api/.env`
> - This project does **NOT** use PM2. Do not reference or run any PM2 command.

---

## Objective

Wire the BullMQ infrastructure for OCR processing:
1. Register the `ocr-processing` queue in `jobs.module.ts`
2. Create the OCR processor that listens to the queue and delegates to `OcrService`
3. Also register the queue in `financial.module.ts` so `ReceiptService` can enqueue jobs (Sprint 5_3)

This follows the exact same pattern as the existing `send-email.processor.ts` and the `email` queue registration.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/jobs/jobs.module.ts` — understand queue registration, processor injection, `onModuleInit` pattern
- [ ] Read `/var/www/lead360.app/api/src/modules/jobs/processors/send-email.processor.ts` — understand processor class structure exactly
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/ocr.service.ts` — verify OcrService exists from Sprint 5_1
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` — verify OcrService is in providers and exports
- [ ] Verify Sprint 5_1 gate passed: dev server compiles, OcrService registered

**IF `OcrService` does not exist or is not registered — STOP. Sprint 5_1 must be complete first.**

---

## Dev Server

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

### Task 1 — Read Existing Codebase

**What:** Read all files listed in the Pre-Sprint Checklist.

Pay close attention to:
1. The exact `BullModule.registerQueue()` call in `jobs.module.ts` — you must add `{ name: 'ocr-processing' }` in the same call
2. The exact `constructor()` pattern in `jobs.module.ts` — you must inject the new processor there to force instantiation
3. The `onModuleInit()` pattern — you must add the new processor to the verification array
4. The `@Processor('email')` decorator on `SendEmailProcessor` — you will use `@Processor('ocr-processing')`
5. The `extends WorkerHost` base class — the processor MUST extend this
6. The `async process(job: Job): Promise<any>` method signature — exact match required
7. The error handling pattern in `send-email.processor.ts` — try/catch with status updates

**Do NOT:** Skip reading any file. The patterns must be replicated exactly.

---

### Task 2 — Create OCR Processor

**What:** Create the file `api/src/modules/jobs/processors/ocr-processing.processor.ts`

**File path:** `/var/www/lead360.app/api/src/modules/jobs/processors/ocr-processing.processor.ts`

**Complete file content structure:**

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { OcrService } from '../../financial/services/ocr.service';

/**
 * OCR Processing Job Payload
 */
interface OcrJobPayload {
  receiptId: string;
  tenantId: string;
  fileId: string;
}

@Processor('ocr-processing')
export class OcrProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocrService: OcrService,
  ) {
    super();
    this.logger.log('🚀 OcrProcessingProcessor worker initialized and ready');
  }

  async process(job: Job<OcrJobPayload>): Promise<any> {
    const { receiptId, tenantId, fileId } = job.data;
    const jobId = job.id as string;
    const attemptNumber = job.attemptsMade + 1;

    this.logger.log(
      `🔄 PROCESSING: OCR job ${jobId} for receipt ${receiptId} (tenant: ${tenantId}, attempt: ${attemptNumber}/3)`,
    );

    try {
      // Verify receipt exists and is in 'processing' state
      const receipt = await this.prisma.receipt.findFirst({
        where: { id: receiptId, tenant_id: tenantId },
        select: { id: true, ocr_status: true },
      });

      if (!receipt) {
        this.logger.warn(`OCR job ${jobId}: Receipt ${receiptId} not found. Marking job as complete.`);
        return { success: false, reason: 'receipt_not_found' };
      }

      if (receipt.ocr_status !== 'processing') {
        this.logger.warn(
          `OCR job ${jobId}: Receipt ${receiptId} status is '${receipt.ocr_status}', expected 'processing'. Skipping.`,
        );
        return { success: false, reason: 'invalid_status' };
      }

      // Delegate to OcrService — it handles all Vision API calls, parsing, and DB updates
      await this.ocrService.processReceipt(receiptId, tenantId, fileId);

      this.logger.log(`✅ OCR job ${jobId} completed for receipt ${receiptId}`);
      return { success: true, receiptId };

    } catch (error) {
      this.logger.error(
        `❌ OCR job ${jobId} failed (attempt ${attemptNumber}/3): ${error.message}`,
        error.stack,
      );

      // On final attempt (attempt 3), set receipt status to failed and DON'T throw
      // This prevents the job from going to the dead letter queue
      if (attemptNumber >= 3) {
        this.logger.warn(
          `OCR job ${jobId}: Final attempt failed. Setting receipt ${receiptId} to 'failed' and completing job.`,
        );
        try {
          await this.prisma.receipt.update({
            where: { id: receiptId },
            data: { ocr_status: 'failed' },
          });
        } catch (updateError) {
          this.logger.error(`Failed to update receipt status: ${updateError.message}`);
        }
        // Return instead of throw — job completes, no more retries
        return { success: false, error: error.message, finalAttempt: true };
      }

      // On non-final attempts, throw so BullMQ retries
      throw error;
    }
  }
}
```

**Key design decisions:**
- On final retry (attempt 3): catch error, set `ocr_status = failed`, return (don't throw) → job marked complete
- On earlier retries: throw → BullMQ retries with exponential backoff
- The processor verifies receipt status before processing — prevents double-processing
- All heavy lifting delegated to `OcrService.processReceipt()` — processor is thin

**Do NOT:**
- Do NOT inject `JobQueueService` — the OCR processor doesn't use the job tracking system used by email
- Do NOT inject `FilesService` — `OcrService` handles file retrieval internally
- Do NOT add custom retry logic — BullMQ handles retries via queue configuration

---

### Task 3 — Register Queue and Processor in `jobs.module.ts`

**What:** Update `/var/www/lead360.app/api/src/modules/jobs/jobs.module.ts`

**Changes (4 total):**

**Change 1 — Import the processor and FinancialModule:**

Add to the import section at the top of the file:
```typescript
// Add among the Processor imports:
import { OcrProcessingProcessor } from './processors/ocr-processing.processor';

// Add among the Module imports at the top (after existing imports):
import { FinancialModule } from '../financial/financial.module';
```

**Change 2 — Register queue:**

In the `BullModule.registerQueue()` call, add `{ name: 'ocr-processing' }`:
```typescript
BullModule.registerQueue(
  { name: 'email' },
  { name: 'scheduled' },
  { name: 'export' },
  { name: 'scheduled-reports' },
  { name: 'ocr-processing' },  // ← ADD THIS
),
```

**Change 3 — Add `FinancialModule` to imports array (for OcrService injection):**
```typescript
imports: [
  BullModule.registerQueue(...),
  PrismaModule,
  EncryptionModule,
  AuditModule,
  FinancialModule,  // ← ADD THIS — provides OcrService for OcrProcessingProcessor
],
```

**CRITICAL: Check for circular dependency.** `FinancialModule` imports `[PrismaModule, AuditModule, FilesModule]`. None of these import `JobsModule`. So adding `FinancialModule` to `JobsModule.imports` does NOT create a circular dependency. This is safe.

**Change 4 — Add processor to providers and constructor:**

Add `OcrProcessingProcessor` to the `providers` array:
```typescript
providers: [
  // ... existing services and handlers ...

  // Processors
  SendEmailProcessor,
  ScheduledJobsProcessor,
  OcrProcessingProcessor,  // ← ADD THIS

  // ... existing schedulers ...
],
```

Add `OcrProcessingProcessor` to the constructor to force instantiation:
```typescript
constructor(
  private moduleRef: ModuleRef,
  private sendEmailProcessor: SendEmailProcessor,
  private scheduledJobsProcessor: ScheduledJobsProcessor,
  private ocrProcessingProcessor: OcrProcessingProcessor,  // ← ADD THIS
) {}
```

Add to the `onModuleInit()` verification array:
```typescript
const processors = [
  { name: 'SendEmailProcessor', instance: this.sendEmailProcessor },
  { name: 'ScheduledJobsProcessor', instance: this.scheduledJobsProcessor },
  { name: 'OcrProcessingProcessor', instance: this.ocrProcessingProcessor },  // ← ADD THIS
];
```

**Why:** NestJS lazy-loads providers. Without constructor injection, the processor is never instantiated, and the BullMQ worker never starts. This is the exact pattern used for the email processor.

**Do NOT:**
- Do NOT remove any existing imports, providers, or exports
- Do NOT modify any existing processor
- Do NOT modify the `exports` array — the processor is not exported

---

### Task 4 — Register Queue in `financial.module.ts`

**What:** Update `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` to add `BullModule.registerQueue` for the `ocr-processing` queue.

**Why:** `ReceiptService` (Sprint 5_3) will use `@InjectQueue('ocr-processing')` to enqueue OCR jobs. The queue injection token must be registered in the module where the injecting service lives.

**Changes:**

1. Add import at top:
```typescript
import { BullModule } from '@nestjs/bullmq';
```

2. Add to the `imports` array:
```typescript
imports: [
  PrismaModule,
  AuditModule,
  FilesModule,
  BullModule.registerQueue({ name: 'ocr-processing' }),  // ← ADD THIS
],
```

**Note:** Registering the same queue name in multiple modules is safe. `BullModule.registerQueue` creates a NestJS injection token — it does NOT create a second Redis queue. Both modules share the same underlying Redis queue.

**Do NOT:**
- Do NOT modify providers, controllers, or exports in this task

---

### Task 5 — Verify Compilation and Processor Instantiation

**What:** Start the dev server and verify:

1. Server compiles without errors
2. Health check passes: `curl -s http://localhost:8000/health`
3. Look for this log line in console: `🚀 OcrProcessingProcessor worker initialized and ready`
4. Look for this log line in console: `✓ OcrProcessingProcessor instantiated and worker started`
5. Existing processors still work: `✓ SendEmailProcessor instantiated and worker started` and `✓ ScheduledJobsProcessor instantiated and worker started`

**Acceptance:** All 3 processors initialize successfully. No compilation errors.

**Do NOT:** Skip this verification. If the processor doesn't initialize, the OCR queue will silently drop all jobs.

---

## Patterns Applied

### BullMQ Queue Registration (from `jobs.module.ts`)
```typescript
// Register queue in the imports array
BullModule.registerQueue(
  { name: 'email' },
  { name: 'scheduled' },
  { name: 'ocr-processing' },  // new
),
```

### BullMQ Processor Class (from `send-email.processor.ts`)
```typescript
@Processor('queue-name')
export class NameProcessor extends WorkerHost {
  constructor(/* inject services */) { super(); }
  async process(job: Job): Promise<any> {
    // 1. Validate
    // 2. Do work
    // 3. Return result or throw for retry
  }
}
```

### Forced Processor Instantiation (from `jobs.module.ts` constructor)
```typescript
// NestJS lazy-loads providers — inject in constructor to force instantiation
constructor(
  private moduleRef: ModuleRef,
  private sendEmailProcessor: SendEmailProcessor,
  private ocrProcessingProcessor: OcrProcessingProcessor,
) {}
```

### Retry Configuration
BullMQ default retry settings are configured when the job is ENQUEUED (Sprint 5_3), not in the processor. The processor decides what to do on the final attempt (catch + return instead of throw).

---

## Business Rules Enforced in This Sprint

- BR-07: On final failure (3 attempts), job is marked complete in BullMQ queue. Receipt `ocr_status` = `failed`.
- BR-08: After 3 failed attempts, no more retries. No dead letter queue buildup.
- BR-01: OCR is always async — processor runs in background via BullMQ

---

## Integration Points

| Service/Module | Import Path | What It Provides |
|---|---|---|
| `OcrService` | `../../financial/services/ocr.service` | `processReceipt(receiptId, tenantId, fileId)` |
| `PrismaService` | `../../../core/database/prisma.service` | Receipt status verification and updates |
| `FinancialModule` | `../financial/financial.module` | Provides `OcrService` to `JobsModule` |

---

## Acceptance Criteria

- [ ] File created: `api/src/modules/jobs/processors/ocr-processing.processor.ts`
- [ ] Processor class: `@Processor('ocr-processing')`, extends `WorkerHost`, injects `PrismaService` + `OcrService`
- [ ] `process(job)` method: validates receipt, delegates to `OcrService.processReceipt()`, handles retries
- [ ] Final attempt (attempt 3): catches error, sets `ocr_status = failed`, returns (doesn't throw)
- [ ] `{ name: 'ocr-processing' }` added to `BullModule.registerQueue()` in `jobs.module.ts`
- [ ] `FinancialModule` added to `JobsModule.imports`
- [ ] `OcrProcessingProcessor` added to `jobs.module.ts` providers + constructor + `onModuleInit` verification
- [ ] `BullModule.registerQueue({ name: 'ocr-processing' })` added to `financial.module.ts` imports
- [ ] Server compiles, health check passes
- [ ] All 3 processors log initialization messages
- [ ] No existing processors broken
- [ ] No circular dependency errors
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before proceeding to Sprint 5_3:
1. Server must compile with zero errors
2. All 3 processors must log initialization messages on startup
3. No circular dependency errors
4. `ocr-processing` queue registered in both `jobs.module.ts` and `financial.module.ts`

---

## Handoff Notes

- Queue name: `'ocr-processing'`
- Processor listens and delegates to `OcrService.processReceipt()`
- Queue is registered in `financial.module.ts` — `ReceiptService` can use `@InjectQueue('ocr-processing')` in Sprint 5_3
- Job payload interface: `{ receiptId: string; tenantId: string; fileId: string; }`
- Retry config is set when enqueuing (Sprint 5_3): `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }`
