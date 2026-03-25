# Sprint 5_3 — Receipt Service Updates + DTO (OCR Enqueue, Status, Retry, Create-Entry)

**Module:** Financial
**File:** ./documentation/sprints/financial/f05/sprint_5_3.md
**Type:** Backend — Service Layer + DTO
**Depends On:** Sprint 5_2 complete (queue registered in financial.module.ts, processor instantiated)
**Gate:** STOP — `ReceiptService` must compile with all 4 new methods, `@InjectQueue` injection must succeed, dev server health check must pass
**Estimated Complexity:** High

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

Update the existing `ReceiptService` to:
1. Automatically enqueue an OCR job when a receipt is uploaded
2. Provide OCR status polling for the frontend
3. Allow creating a financial entry pre-populated from OCR data
4. Allow retrying failed OCR processing

Also create the `CreateEntryFromReceiptDto` for the create-entry endpoint.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/receipt.service.ts` — understand ALL existing methods, imports, constructor
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — understand `createEntry()` logic (validation, fields, includes) — you will replicate this logic inside a Prisma transaction, NOT inject this service
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts` — understand all fields for entry creation
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` — verify `BullModule.registerQueue({ name: 'ocr-processing' })` is in imports (from Sprint 5_2)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/upload-receipt.dto.ts` — understand upload DTO
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/link-receipt.dto.ts` — understand existing link DTO pattern
- [ ] Verify Sprint 5_2 gate passed: all processors initialized, queue registered

**IF `BullModule.registerQueue({ name: 'ocr-processing' })` is not in `financial.module.ts` imports — STOP. Sprint 5_2 must be complete first.**

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

**What:** Read all files in the Pre-Sprint Checklist. Pay close attention to:

1. `ReceiptService` constructor — currently injects `PrismaService`, `AuditLoggerService`, `FilesService`
2. `uploadReceipt()` method — currently sets `ocr_status: 'not_processed'`. This must change to `'processing'` and enqueue a job.
3. `formatReceiptResponse()` — currently hardcodes `ocr_vendor: null, ocr_amount: null, ocr_date: null`. This must return real values.
4. `FinancialEntryService.createEntry()` — takes `(tenantId, userId, dto)`, validates category belongs to tenant, validates date not future, creates entry. You will replicate this validation inline inside a Prisma `$transaction` — do NOT inject this service (it uses its own `this.prisma` which would bypass the transaction)
5. `CreateFinancialEntryDto` — required fields: `project_id`, `category_id`, `amount`, `entry_date`. Optional: `task_id`, `vendor_name`, `crew_member_id`, `subcontractor_id`, `notes`

**Do NOT:** Skip reading any file.

---

### Task 2 — Create `CreateEntryFromReceiptDto`

**What:** Create the file `api/src/modules/financial/dto/create-entry-from-receipt.dto.ts`

**File path:** `/var/www/lead360.app/api/src/modules/financial/dto/create-entry-from-receipt.dto.ts`

This DTO has the same fields as `CreateFinancialEntryDto` — the frontend pre-populates with OCR suggestions, the user edits and submits.

```typescript
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEntryFromReceiptDto {
  @ApiProperty({
    description: 'Project ID for the expense entry',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  project_id: string;

  @ApiPropertyOptional({
    description: 'Task ID (optional)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiProperty({
    description: 'Financial category ID (must belong to same tenant)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsString()
  @IsUUID()
  category_id: string;

  @ApiPropertyOptional({
    description: 'Entry amount. If not provided, OCR-detected amount is used as fallback.',
    example: 450.00,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({
    description: 'Entry date in ISO format. If not provided, OCR-detected date is used as fallback.',
    example: '2026-03-10',
  })
  @IsOptional()
  @IsDateString()
  entry_date?: string;

  @ApiPropertyOptional({
    description: 'Vendor name. If not provided, OCR-detected vendor is used as fallback.',
    example: 'Home Depot',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({
    description: 'Crew member ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  crew_member_id?: string;

  @ApiPropertyOptional({
    description: 'Subcontractor ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  subcontractor_id?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Purchased lumber for deck project',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

**Key difference from `CreateFinancialEntryDto`:** `amount` and `entry_date` are OPTIONAL here. When not provided, OCR-detected values are used as fallback. In `CreateFinancialEntryDto`, they are required.

**Do NOT:**
- Do NOT modify `CreateFinancialEntryDto` — it is used by the existing entry creation endpoint
- Do NOT add fields that don't exist in `CreateFinancialEntryDto`

---

### Task 3 — Update `ReceiptService` — Add Queue Injection

**What:** Update `/var/www/lead360.app/api/src/modules/financial/services/receipt.service.ts`

**Add imports at top of file:**
```typescript
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateEntryFromReceiptDto } from '../dto/create-entry-from-receipt.dto';
```

**Update constructor — add `@InjectQueue`:**

Current constructor:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLogger: AuditLoggerService,
  private readonly filesService: FilesService,
) {}
```

Updated constructor:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLogger: AuditLoggerService,
  private readonly filesService: FilesService,
  @InjectQueue('ocr-processing') private readonly ocrQueue: Queue,
) {}
```

**Do NOT:**
- Do NOT inject `FinancialEntryService` — `createEntryFromReceipt` uses a Prisma interactive transaction (`$transaction(async (tx) => {...})`) that creates the entry directly via `tx.financial_entry.create()`. Injecting `FinancialEntryService` would be dead code since its `createEntry()` method uses its own `this.prisma` instance which would NOT be part of the transaction. All validation (category ownership, date-not-future) is handled inline within the transaction method.
- Do NOT remove or reorder existing constructor parameters
- Do NOT change the visibility of existing injections

---

### Task 4 — Add Private Method: `enqueueOcrJob`

**What:** Add this private method to `ReceiptService`:

```typescript
// ---------------------------------------------------------------------------
// Private: enqueueOcrJob
// ---------------------------------------------------------------------------

/**
 * Enqueue an OCR processing job for a receipt.
 * Called after receipt upload and on retry.
 */
private async enqueueOcrJob(
  receiptId: string,
  tenantId: string,
  fileId: string,
): Promise<void> {
  try {
    await this.ocrQueue.add(
      'process-receipt',
      { receiptId, tenantId, fileId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
    this.logger.log(
      `OCR job enqueued for receipt ${receiptId} (tenant: ${tenantId}, fileId: ${fileId})`,
    );
  } catch (error) {
    this.logger.error(
      `Failed to enqueue OCR job for receipt ${receiptId}: ${error.message}`,
    );
    // Don't throw — receipt is still created, just won't get OCR
    // Update status to indicate the enqueue failed
    await this.prisma.receipt.update({
      where: { id: receiptId },
      data: { ocr_status: 'failed' },
    });
  }
}
```

**Job configuration explained:**
- `attempts: 3` — retry up to 3 times
- `backoff: { type: 'exponential', delay: 5000 }` — 5s, 10s, 20s between retries
- `removeOnComplete: 100` — keep last 100 completed jobs (prevents Redis bloat)
- `removeOnFail: 50` — keep last 50 failed jobs for debugging

---

### Task 5 — Update `uploadReceipt` Method

**What:** Modify the existing `uploadReceipt` method to:
1. Set `ocr_status: 'processing'` instead of `'not_processed'`
2. After creating the receipt record, enqueue the OCR job

**Current code (line ~143–144 in receipt.service.ts):**
```typescript
ocr_status: 'not_processed',
```

**Change to:**
```typescript
ocr_status: 'processing',
```

**After the `receipt` record is created (after the audit log, before the return statement), add:**
```typescript
// Enqueue OCR job (non-blocking — receipt is returned immediately)
this.enqueueOcrJob(receipt.id, tenantId, receipt.file_id).catch((err) => {
  this.logger.error(`Failed to enqueue OCR for receipt ${receipt.id}: ${err.message}`);
});
```

**IMPORTANT:** Use `.catch()` to avoid unhandled promise rejection. The upload must NOT fail because of an OCR enqueue error. The receipt is already saved — OCR is best-effort.

**Do NOT:**
- Do NOT wait for the OCR job to complete before returning
- Do NOT change any other part of the `uploadReceipt` method
- Do NOT modify the receipt creation `data` object beyond `ocr_status`

---

### Task 6 — Update `formatReceiptResponse` Method

**What:** Update the private `formatReceiptResponse` method to return REAL OCR values instead of hardcoded nulls.

**Current code:**
```typescript
ocr_vendor: null,
ocr_amount: null,
ocr_date: null,
```

**Change to:**
```typescript
ocr_vendor: receipt.ocr_vendor ?? null,
ocr_amount: receipt.ocr_amount != null ? Number(receipt.ocr_amount) : null,
ocr_date: receipt.ocr_date ?? null,
```

**Why:** `ocr_amount` is a Prisma `Decimal` type — must be converted to `number` for JSON serialization (same pattern as the `amount` field).

**Do NOT:** Change any other field in `formatReceiptResponse`.

---

### Task 7 — Add Method: `getOcrStatus`

**What:** Add this new public method to `ReceiptService`:

```typescript
// ---------------------------------------------------------------------------
// getOcrStatus
// ---------------------------------------------------------------------------

/**
 * Get OCR processing status for a receipt.
 * Used by the frontend to poll for OCR completion.
 *
 * Roles: All roles can access. Employee can only access their own receipts.
 */
async getOcrStatus(
  tenantId: string,
  receiptId: string,
  userId: string,
  userRoles: string[],
) {
  // Build where clause — Employee can only see their own receipts
  const where: Record<string, unknown> = {
    id: receiptId,
    tenant_id: tenantId,
  };

  const isEmployee = userRoles.length === 1 && userRoles[0] === 'Field';
  if (isEmployee) {
    where.uploaded_by_user_id = userId;
  }

  const receipt = await this.prisma.receipt.findFirst({
    where,
    select: {
      id: true,
      ocr_status: true,
      ocr_vendor: true,
      ocr_amount: true,
      ocr_date: true,
    },
  });

  if (!receipt) {
    throw new NotFoundException('Receipt not found');
  }

  const hasSuggestions =
    receipt.ocr_vendor != null ||
    receipt.ocr_amount != null ||
    receipt.ocr_date != null;

  return {
    receipt_id: receipt.id,
    ocr_status: receipt.ocr_status,
    ocr_vendor: receipt.ocr_vendor ?? null,
    ocr_amount: receipt.ocr_amount != null ? Number(receipt.ocr_amount) : null,
    ocr_date: receipt.ocr_date ?? null,
    has_suggestions: hasSuggestions,
  };
}
```

**RBAC note:** The `Field` role is the employee role in Lead360. Check if the user has ONLY the `Field` role — if so, restrict to their own receipts. All other roles see all tenant receipts.

---

### Task 8 — Add Method: `createEntryFromReceipt`

**What:** Add this new public method to `ReceiptService`:

```typescript
// ---------------------------------------------------------------------------
// createEntryFromReceipt
// ---------------------------------------------------------------------------

/**
 * Create a financial entry from OCR-parsed receipt data.
 * OCR fields are used as fallback when request body fields are not provided.
 * Links the receipt to the newly created entry.
 *
 * Uses a Prisma interactive transaction to ensure atomicity:
 * entry creation + receipt link must both succeed or neither persists.
 */
async createEntryFromReceipt(
  tenantId: string,
  receiptId: string,
  userId: string,
  dto: CreateEntryFromReceiptDto,
) {
  this.logger.log(
    `Creating entry from receipt ${receiptId} (tenant: ${tenantId}, user: ${userId})`,
  );

  // 1. Fetch receipt
  const receipt = await this.findReceiptOrThrow(tenantId, receiptId);

  // 2. Guard: receipt already linked to an entry
  // Check financial_entry_id alone (authoritative FK) — matches existing linkReceiptToEntry pattern.
  // Do NOT use `is_categorized &&` — if state is inconsistent, the FK is the source of truth.
  if (receipt.financial_entry_id) {
    throw new BadRequestException(
      'This receipt is already linked to a financial entry. Cannot create another entry from it.',
    );
  }

  // 3. Resolve fields with OCR fallbacks
  const resolvedAmount = dto.amount ?? (receipt.ocr_amount != null ? Number(receipt.ocr_amount) : null);
  const resolvedVendor = dto.vendor_name ?? receipt.ocr_vendor ?? null;
  const resolvedDate = dto.entry_date ?? (receipt.ocr_date ? receipt.ocr_date.toISOString().split('T')[0] : null);

  // 4. Validate required fields (after OCR fallback resolution)
  if (resolvedAmount == null || resolvedAmount <= 0) {
    throw new BadRequestException(
      'Amount is required. Provide it in the request body or ensure OCR detected an amount.',
    );
  }
  if (!resolvedDate) {
    throw new BadRequestException(
      'Entry date is required. Provide it in the request body or ensure OCR detected a date.',
    );
  }

  // 5. Validate category belongs to tenant
  const category = await this.prisma.financial_category.findFirst({
    where: { id: dto.category_id, tenant_id: tenantId },
    select: { id: true, name: true, type: true },
  });
  if (!category) {
    throw new NotFoundException('Financial category not found or does not belong to this tenant');
  }

  // 6. Validate entry_date is not in the future
  const entryDate = new Date(resolvedDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (entryDate > today) {
    throw new BadRequestException('Entry date cannot be in the future');
  }

  // 7. Execute in transaction: create entry + link receipt
  const result = await this.prisma.$transaction(async (tx) => {
    // Create the financial entry
    const entry = await tx.financial_entry.create({
      data: {
        tenant_id: tenantId,
        project_id: dto.project_id,
        task_id: dto.task_id ?? receipt.task_id ?? null,
        category_id: dto.category_id,
        entry_type: 'expense',
        amount: resolvedAmount,
        entry_date: entryDate,
        vendor_name: resolvedVendor,
        crew_member_id: dto.crew_member_id ?? null,
        subcontractor_id: dto.subcontractor_id ?? null,
        notes: dto.notes ?? null,
        has_receipt: true,
        created_by_user_id: userId,
      },
      include: {
        category: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // Link receipt to entry
    const updatedReceipt = await tx.receipt.update({
      where: { id: receiptId },
      data: {
        financial_entry_id: entry.id,
        is_categorized: true,
      },
    });

    return { entry, receipt: updatedReceipt };
  });

  // 8. Audit log (outside transaction — audit log failure should not roll back the entry)
  await this.auditLogger.logTenantChange({
    action: 'created',
    entityType: 'financial_entry',
    entityId: result.entry.id,
    tenantId,
    actorUserId: userId,
    after: result.entry,
    metadata: { created_from_receipt: receiptId, ocr_used: true },
    description: `Financial entry created from receipt OCR: $${resolvedAmount} at ${resolvedVendor || 'unknown vendor'}`,
  });

  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'receipt',
    entityId: receiptId,
    tenantId,
    actorUserId: userId,
    before: { financial_entry_id: null, is_categorized: false },
    after: { financial_entry_id: result.entry.id, is_categorized: true },
    description: `Receipt ${receiptId} linked to entry ${result.entry.id} via OCR create-entry`,
  });

  return {
    entry: result.entry,
    receipt: this.formatReceiptResponse(result.receipt),
  };
}
```

**Key design decisions:**
- Uses `$transaction(async (tx) => {...})` (interactive transaction) — entry creation and receipt link are atomic
- OCR fields are fallbacks only — if the DTO provides a value, it takes precedence
- Validates amount and date AFTER fallback resolution — ensures at least one source provides the required data
- `entry.has_receipt = true` set at creation time (not updated after)
- `receipt.task_id` is used as task_id fallback if not provided in DTO and receipt has one

---

### Task 9 — Add Method: `retryOcr`

**What:** Add this new public method to `ReceiptService`:

```typescript
// ---------------------------------------------------------------------------
// retryOcr
// ---------------------------------------------------------------------------

/**
 * Retry OCR processing for a failed or not-processed receipt.
 * Resets OCR fields and enqueues a new processing job.
 *
 * Roles: Owner, Admin, Manager, Bookkeeper only (no Employee/Field).
 */
async retryOcr(
  tenantId: string,
  receiptId: string,
  userId: string,
) {
  this.logger.log(
    `Retrying OCR for receipt ${receiptId} (tenant: ${tenantId}, user: ${userId})`,
  );

  const receipt = await this.findReceiptOrThrow(tenantId, receiptId);

  // Guard: can only retry if status is 'failed' or 'not_processed'
  if (receipt.ocr_status === 'processing') {
    throw new BadRequestException(
      'This receipt is currently being processed. Wait for processing to complete before retrying.',
    );
  }
  if (receipt.ocr_status === 'complete') {
    throw new BadRequestException(
      'OCR processing is already complete for this receipt. No retry needed.',
    );
  }

  // Reset OCR fields and set status to processing
  const updated = await this.prisma.receipt.update({
    where: { id: receiptId },
    data: {
      ocr_status: 'processing',
      ocr_vendor: null,
      ocr_amount: null,
      ocr_date: null,
      ocr_raw: null,
    },
  });

  // Enqueue new OCR job
  await this.enqueueOcrJob(receiptId, tenantId, receipt.file_id);

  await this.auditLogger.logTenantChange({
    action: 'updated',
    entityType: 'receipt',
    entityId: receiptId,
    tenantId,
    actorUserId: userId,
    before: { ocr_status: receipt.ocr_status },
    after: { ocr_status: 'processing' },
    description: `OCR retry triggered for receipt ${receiptId}`,
  });

  return this.formatReceiptResponse(updated);
}
```

---

### Task 10 — Verify Compilation

**What:** Start the dev server and verify:

1. Server compiles without errors
2. Health check passes: `curl -s http://localhost:8000/health`
3. No TypeScript errors related to `@InjectQueue` or the new DTO
4. All 3 processors still initialize

**Acceptance:** Server starts successfully with all new code.

**Do NOT:** Skip verification. The `@InjectQueue` injection is a common failure point — if the queue token is not registered, the server will crash on startup.

---

## Business Rules Enforced in This Sprint

- BR-01: OCR is always async — `enqueueOcrJob` returns immediately
- BR-02: OCR result is always a suggestion — `createEntryFromReceipt` pre-populates but user controls final values
- BR-03: Entry is never auto-created — requires explicit `createEntryFromReceipt` call
- BR-04: Receipt can only be linked to one entry — `createEntryFromReceipt` rejects if already linked
- BR-05: OCR failures don't prevent manual entry — `enqueueOcrJob` catches errors and sets `failed` status
- BR-09: Employee can only view their own receipt OCR status
- BR-10: Retry-ocr not available to employees (enforced at controller level in Sprint 5_4)

---

## Integration Points

| Service/Module | Import Path | What It Provides |
|---|---|---|
| `@InjectQueue('ocr-processing')` | `@nestjs/bullmq` | Queue for enqueuing OCR jobs |
| `Queue` | `bullmq` | TypeScript type for queue |
| `financial_entry` (Prisma model) | via `tx.financial_entry.create()` | Entry created directly in Prisma transaction — `FinancialEntryService` is NOT injected |
| `CreateEntryFromReceiptDto` | `../dto/create-entry-from-receipt.dto` | Validation for create-entry endpoint |

---

## Acceptance Criteria

- [ ] File created: `api/src/modules/financial/dto/create-entry-from-receipt.dto.ts`
- [ ] `ReceiptService` constructor updated with `@InjectQueue('ocr-processing')` (NO `FinancialEntryService` injection — entry creation uses Prisma tx directly)
- [ ] `uploadReceipt()` now sets `ocr_status: 'processing'` and enqueues OCR job after creation
- [ ] `formatReceiptResponse()` returns real OCR values from receipt record
- [ ] `getOcrStatus()` returns status + parsed fields + `has_suggestions` boolean
- [ ] `getOcrStatus()` restricts Employee/Field role to their own receipts
- [ ] `createEntryFromReceipt()` creates entry + links receipt in a Prisma transaction
- [ ] `createEntryFromReceipt()` uses OCR fields as fallback when DTO fields not provided
- [ ] `createEntryFromReceipt()` rejects already-linked receipts with 400
- [ ] `retryOcr()` resets OCR fields, sets `processing`, enqueues new job
- [ ] `retryOcr()` rejects receipts with `processing` or `complete` status with 400
- [ ] `enqueueOcrJob()` sets retry config: 3 attempts, exponential backoff starting at 5s
- [ ] All new methods include audit logging
- [ ] Dev server compiles and health check passes
- [ ] No existing methods broken
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before proceeding to Sprint 5_4:
1. Server must compile with zero errors
2. All new `ReceiptService` methods must exist and be injectable
3. `@InjectQueue('ocr-processing')` must not cause startup errors
4. `CreateEntryFromReceiptDto` must exist with proper validation decorators

---

## Handoff Notes

- `ReceiptService` now has 4 new methods available for the controller: `getOcrStatus()`, `createEntryFromReceipt()`, `retryOcr()`, plus private `enqueueOcrJob()`
- `uploadReceipt()` now returns `ocr_status: 'processing'` instead of `'not_processed'`
- `formatReceiptResponse()` now returns real OCR values
- `CreateEntryFromReceiptDto` has `amount` and `entry_date` as optional (OCR fallback)
- Next sprint (5_4) adds controller endpoints to expose these methods via HTTP
