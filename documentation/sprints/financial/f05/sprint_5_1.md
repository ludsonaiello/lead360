# Sprint 5_1 — OcrService Core (Google Vision API + Text Parsing Logic)

**Module:** Financial
**File:** ./documentation/sprints/financial/f05/sprint_5_1.md
**Type:** Backend — Service Layer
**Depends On:** F-04 complete (financial entry engine live), receipt table exists from Gate 2
**Gate:** STOP — `OcrService` must compile, `FinancialModule` must load without errors, dev server health check must pass
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

Create the `OcrService` — the core service that handles Google Cloud Vision API integration and receipt text parsing. This service is the brain of the OCR system. It takes a receipt image, sends it to Google Vision API for text extraction, then parses the raw text to extract vendor name, amount, and date.

This sprint creates the service only. The BullMQ processor and controller endpoints are wired in later sprints.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` — understand current module registration
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/receipt.service.ts` — understand existing receipt operations
- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` — find the `receipt` model and `receipt_ocr_status` enum
- [ ] Read `/var/www/lead360.app/api/src/modules/leads/services/google-maps.service.ts` — understand existing Google API key pattern
- [ ] Read `/var/www/lead360.app/api/src/core/file-storage/storage-provider.factory.ts` — understand how to get file buffer
- [ ] Read `/var/www/lead360.app/api/src/core/file-storage/providers/s3-storage.provider.ts` — understand `download(fileId, storagePath)` method
- [ ] Read `/var/www/lead360.app/api/src/core/file-storage/providers/local-storage.provider.ts` — understand `download(fileId, storagePath)` method
- [ ] Verify `FileStorageModule` is `@Global()` (it is — `StorageProviderFactory` is available everywhere without explicit import)

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

**What:** Read all files listed in the Pre-Sprint Checklist. Understand:
1. How `StorageProviderFactory.getProvider(tenantId)` returns a storage provider
2. How `provider.download(fileId, storagePath)` returns a `Buffer`
3. How the `file` table stores `storage_path` — used to retrieve the binary content
4. How `GoogleMapsService` handles API key from env (constructor, `ConfigService`, `ensureApiKeyConfigured()`)
5. The exact fields on the `receipt` model: `ocr_raw`, `ocr_status`, `ocr_vendor`, `ocr_amount`, `ocr_date`
6. The `receipt_ocr_status` enum values: `not_processed`, `processing`, `complete`, `failed`

**Why:** You must know the exact existing patterns before writing new code.

**Do NOT:** Skip any file. Every file matters.

---

### Task 2 — Create `OcrService`

**What:** Create the file `api/src/modules/financial/services/ocr.service.ts`

**File path:** `/var/www/lead360.app/api/src/modules/financial/services/ocr.service.ts`

**Imports required:**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { StorageProviderFactory } from '../../../core/file-storage/storage-provider.factory';
```

**Class structure:**
```typescript
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly googleVisionApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly storageProviderFactory: StorageProviderFactory,
  ) {
    this.googleVisionApiKey = this.configService.get<string>('GOOGLE_VISION_API_KEY') || '';

    if (!this.googleVisionApiKey) {
      this.logger.warn(
        '⚠️ GOOGLE_VISION_API_KEY is not configured. OCR processing will not work. ' +
        'Set GOOGLE_VISION_API_KEY in your .env file to enable receipt OCR.',
      );
    }
  }

  // ... methods below
}
```

**Method 1 — `processReceipt(receiptId: string, tenantId: string, fileId: string): Promise<void>`**

This is the main orchestrator method called by the BullMQ processor.

Steps:
1. If `this.googleVisionApiKey` is empty → update receipt `ocr_status = 'failed'`, log warning, return gracefully (do NOT throw)
2. Fetch receipt from DB: `this.prisma.receipt.findFirst({ where: { id: receiptId, tenant_id: tenantId } })`
3. If receipt not found → log error, return (do NOT throw — job should complete, not retry)
4. Verify `ocr_status === 'processing'` — if not, log warning, return
5. Retrieve the file record from DB: `this.prisma.file.findFirst({ where: { file_id: fileId } })` — need `storage_path` and `id`
6. If file record not found → set `ocr_status = 'failed'`, return
7. Get storage provider: `const provider = await this.storageProviderFactory.getProvider(tenantId);`
8. Download file buffer: `const buffer = await provider.download(fileRecord.id, fileRecord.storage_path);`
9. Convert buffer to base64: `const imageBase64 = buffer.toString('base64');`
10. Call Vision API: `const apiResponse = await this.callVisionApi(imageBase64);`
11. If API response is null or has no text → set `ocr_status = 'failed'`, store `ocr_raw = JSON.stringify(apiResponse)`, return
12. Extract full text: `const fullText = apiResponse.responses?.[0]?.fullTextAnnotation?.text || '';`
13. Parse receipt text: `const parsed = this.parseReceiptText(fullText);`
14. Update receipt via `this.updateReceiptOcrResult(receiptId, { ocr_raw: JSON.stringify(apiResponse), ...parsed })`
15. Wrap steps 7–14 in try/catch. On error → set `ocr_status = 'failed'`, log error, do NOT throw

**Method 2 — `private async callVisionApi(imageBase64: string): Promise<any>`**

Makes an HTTP POST to Google Cloud Vision API.

```typescript
private async callVisionApi(imageBase64: string): Promise<any> {
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${this.googleVisionApiKey}`;

  const requestBody = {
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    this.logger.error(`Google Vision API error (${response.status}): ${errorText}`);
    return null;
  }

  return response.json();
}
```

Use the native `fetch` API (available in Node 18+). Do NOT install axios or any HTTP client — the codebase uses Node 18+ and `fetch` is built-in.

**Method 3 — `parseReceiptText(fullText: string): { ocr_vendor: string | null; ocr_amount: number | null; ocr_date: Date | null }`**

This method is a **pure function** with no side effects. It takes the raw text returned by Google Vision API and extracts structured fields.

This method must be `public` (not private) so it can be unit-tested directly.

```typescript
parseReceiptText(fullText: string): {
  ocr_vendor: string | null;
  ocr_amount: number | null;
  ocr_date: Date | null;
} {
  if (!fullText || fullText.trim().length === 0) {
    return { ocr_vendor: null, ocr_amount: null, ocr_date: null };
  }

  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const ocr_vendor = this.extractVendor(lines);
  const ocr_amount = this.extractAmount(lines);
  const ocr_date = this.extractDate(fullText);

  return { ocr_vendor, ocr_amount, ocr_date };
}
```

**Sub-method 3a — `private extractVendor(lines: string[]): string | null`**

Rules:
- The first non-empty line of the extracted text is typically the business name
- Use the first line as the vendor candidate
- If the first line is shorter than 2 characters, try the second line
- Max 200 characters (matches `ocr_vendor` column `@db.VarChar(200)`)
- Return `null` if no usable line found

```typescript
private extractVendor(lines: string[]): string | null {
  if (lines.length === 0) return null;

  // First non-empty line is usually the business name
  let vendor = lines[0];

  // If first line is too short (e.g., just a number or symbol), try second line
  if (vendor.length < 2 && lines.length > 1) {
    vendor = lines[1];
  }

  // Trim to max 200 chars (DB column limit)
  return vendor.substring(0, 200) || null;
}
```

**Sub-method 3b — `private extractAmount(lines: string[]): number | null`**

Rules:
- Search for lines containing `TOTAL`, `AMOUNT DUE`, `BALANCE DUE`, `GRAND TOTAL` (case-insensitive)
- Extract decimal numbers matching pattern: `/\$?\d{1,6}[.,]\d{2}/`
- If multiple candidates found on TOTAL-related lines, take the LARGEST value (typically the grand total)
- If no TOTAL-related line found, search ALL lines for the largest dollar amount as a fallback
- Return `null` if no amount found

```typescript
private extractAmount(lines: string[]): number | null {
  const totalKeywords = /\b(TOTAL|AMOUNT\s*DUE|BALANCE\s*DUE|GRAND\s*TOTAL|TOTAL\s*DUE)\b/i;
  const amountPattern = /\$?\s?(\d{1,6}[.,]\d{2})\b/g;

  const candidates: number[] = [];

  // First pass: look for amounts on lines containing TOTAL keywords
  for (const line of lines) {
    if (totalKeywords.test(line)) {
      let match: RegExpExecArray | null;
      const localPattern = new RegExp(amountPattern.source, 'g');
      while ((match = localPattern.exec(line)) !== null) {
        const raw = match[1].replace(',', '.');
        const value = parseFloat(raw);
        if (!isNaN(value) && value > 0) {
          candidates.push(value);
        }
      }
    }
  }

  // If we found candidates on TOTAL lines, return the largest
  if (candidates.length > 0) {
    return Math.max(...candidates);
  }

  // Fallback: search ALL lines for the largest dollar amount
  const allAmounts: number[] = [];
  for (const line of lines) {
    let match: RegExpExecArray | null;
    const localPattern = new RegExp(amountPattern.source, 'g');
    while ((match = localPattern.exec(line)) !== null) {
      const raw = match[1].replace(',', '.');
      const value = parseFloat(raw);
      if (!isNaN(value) && value > 0) {
        allAmounts.push(value);
      }
    }
  }

  if (allAmounts.length > 0) {
    return Math.max(...allAmounts);
  }

  return null;
}
```

**Sub-method 3c — `private extractDate(text: string): Date | null`**

Rules:
- Search for date patterns:
  - `MM/DD/YYYY` — e.g., `03/15/2026`
  - `MM-DD-YYYY` — e.g., `03-15-2026`
  - `MM/DD/YY` — e.g., `03/15/26`
  - `MM-DD-YY` — e.g., `03-15-26`
  - `MONTH DD, YYYY` — e.g., `March 15, 2026` or `Mar 15, 2026`
- Take the FIRST date found — receipt dates are almost always near the top
- Return `null` if no date found
- Validate the parsed date is a real date (not NaN)

```typescript
private extractDate(text: string): Date | null {
  // Pattern 1: MM/DD/YYYY or MM-DD-YYYY
  const slashDateFull = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
  const matchFull = text.match(slashDateFull);
  if (matchFull) {
    const date = new Date(`${matchFull[3]}-${matchFull[1].padStart(2, '0')}-${matchFull[2].padStart(2, '0')}T00:00:00`);
    if (!isNaN(date.getTime())) return date;
  }

  // Pattern 2: MM/DD/YY or MM-DD-YY
  const slashDateShort = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})\b/;
  const matchShort = text.match(slashDateShort);
  if (matchShort) {
    const year = parseInt(matchShort[3], 10);
    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    const date = new Date(`${fullYear}-${matchShort[1].padStart(2, '0')}-${matchShort[2].padStart(2, '0')}T00:00:00`);
    if (!isNaN(date.getTime())) return date;
  }

  // Pattern 3: Month DD, YYYY (e.g., "March 15, 2026" or "Mar 15, 2026")
  const monthNames = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  const monthDatePattern = new RegExp(`(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i');
  const matchMonth = text.match(monthDatePattern);
  if (matchMonth) {
    const dateStr = `${matchMonth[1]} ${matchMonth[2]}, ${matchMonth[3]}`;
    const date = new Date(dateStr + ' 00:00:00');
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}
```

**Method 4 — `async updateReceiptOcrResult(receiptId: string, result: { ocr_raw: string; ocr_vendor: string | null; ocr_amount: number | null; ocr_date: Date | null }): Promise<void>`**

```typescript
async updateReceiptOcrResult(
  receiptId: string,
  result: {
    ocr_raw: string;
    ocr_vendor: string | null;
    ocr_amount: number | null;
    ocr_date: Date | null;
  },
): Promise<void> {
  const hasAnyField = result.ocr_vendor || result.ocr_amount != null || result.ocr_date;

  await this.prisma.receipt.update({
    where: { id: receiptId },
    data: {
      ocr_raw: result.ocr_raw,
      ocr_vendor: result.ocr_vendor,
      ocr_amount: result.ocr_amount,
      ocr_date: result.ocr_date,
      ocr_status: hasAnyField ? 'complete' : 'failed',
    },
  });

  this.logger.log(
    `OCR result saved for receipt ${receiptId}: status=${hasAnyField ? 'complete' : 'failed'}, ` +
    `vendor=${result.ocr_vendor || 'N/A'}, amount=${result.ocr_amount ?? 'N/A'}, ` +
    `date=${result.ocr_date ? result.ocr_date.toISOString() : 'N/A'}`,
  );
}
```

**Why:** Each method has a clear, single responsibility:
- `processReceipt` orchestrates
- `callVisionApi` handles the HTTP call
- `parseReceiptText` does pure text parsing (fully unit-testable)
- `updateReceiptOcrResult` persists results

**Do NOT:**
- Do NOT install any npm packages. Use native `fetch` for HTTP calls.
- Do NOT add error handling beyond what is specified. The processor handles retries.
- Do NOT make `parseReceiptText` private — it must be public for unit testing.
- Do NOT use `axios` or any HTTP client library.

---

### Task 3 — Register OcrService in FinancialModule

**What:** Update `api/src/modules/financial/financial.module.ts` to register `OcrService`.

**File path:** `/var/www/lead360.app/api/src/modules/financial/financial.module.ts`

**Changes:**

1. Add import at top of file:
```typescript
import { OcrService } from './services/ocr.service';
```

2. Add `OcrService` to the `providers` array (under the `// Gate 2` comment section):
```typescript
providers: [
  // Gate 1
  FinancialCategoryService,
  FinancialEntryService,
  // Gate 2
  ReceiptService,
  OcrService,       // ← ADD HERE
  // Gate 3
  ...
],
```

3. Add `OcrService` to the `exports` array:
```typescript
exports: [
  // Gate 1
  FinancialCategoryService,
  FinancialEntryService,
  // Gate 2
  ReceiptService,
  OcrService,       // ← ADD HERE
  // Gate 3
  ...
],
```

**Why:** The `OcrService` must be exported so the BullMQ processor in `JobsModule` can inject it (Sprint 5_2).

**Do NOT:**
- Do NOT add any imports to the module's `imports` array yet. `BullModule.registerQueue` is added in Sprint 5_2.
- Do NOT modify any other file in this task.
- Do NOT touch any existing service, controller, or DTO.

---

### Task 4 — Verify Compilation

**What:** Start the dev server and verify it compiles without errors.

1. Start the dev server per the Dev Server section above.
2. Wait for health check to pass: `curl -s http://localhost:8000/health`
3. Check server logs for the `OcrService` warning about missing `GOOGLE_VISION_API_KEY` (expected — the env var is not set yet).
4. Verify no compilation errors.

**Acceptance:** Server starts, health check returns 200, no TypeScript errors in console.

**Do NOT:** Skip this step. If the server doesn't compile, fix the issue before proceeding.

---

## Patterns Applied

### Google API Key Pattern (from `google-maps.service.ts`)
```typescript
// Constructor reads API key from env
this.googleVisionApiKey = this.configService.get<string>('GOOGLE_VISION_API_KEY') || '';

// Log warning if not configured (don't throw — allow service to initialize)
if (!this.googleVisionApiKey) {
  this.logger.warn('⚠️ GOOGLE_VISION_API_KEY is not configured...');
}

// Check before use
if (!this.googleVisionApiKey) {
  // Set status to failed, return gracefully
}
```

### File Buffer Retrieval Pattern (from `files.service.ts` bulk download)
```typescript
// 1. Get file record from DB
const fileRecord = await this.prisma.file.findFirst({
  where: { file_id: fileId },
  select: { id: true, storage_path: true },
});

// 2. Get storage provider for tenant
const provider = await this.storageProviderFactory.getProvider(tenantId);

// 3. Download binary buffer
const buffer = await provider.download(fileRecord.id, fileRecord.storage_path);
```

### StorageProviderFactory (Global Module)
```typescript
// FileStorageModule is @Global() — StorageProviderFactory is injectable everywhere
// Import path: '../../../core/file-storage/storage-provider.factory'
// Method: getProvider(tenantId: string) → IStorageProvider
// IStorageProvider.download(fileId: string, storagePath: string) → Buffer
```

---

## Business Rules Enforced in This Sprint

- BR-01: OCR is always async — `processReceipt` never blocks an HTTP request
- BR-05: OCR failures do not prevent manual entry creation — status set to `failed`, no exception thrown
- BR-06: `ocr_raw` stores the full JSON response from Google Vision API
- BR-07: On error (API timeout, invalid image, empty text, quota exceeded) → `ocr_status = failed`, never throws

---

## Integration Points

| Service/Module | Import Path | What It Provides |
|---|---|---|
| `PrismaService` | `../../../core/database/prisma.service` | Database access for receipt and file queries |
| `ConfigService` | `@nestjs/config` (global) | `GOOGLE_VISION_API_KEY` env var |
| `StorageProviderFactory` | `../../../core/file-storage/storage-provider.factory` | `getProvider(tenantId)` → storage provider with `download()` |

---

## Acceptance Criteria

- [ ] File created: `api/src/modules/financial/services/ocr.service.ts`
- [ ] `OcrService` is `@Injectable()` with proper constructor (PrismaService, ConfigService, StorageProviderFactory)
- [ ] `processReceipt()` orchestrates: file retrieval → base64 → Vision API → parse → save
- [ ] `callVisionApi()` sends HTTP POST to Google Vision API with `DOCUMENT_TEXT_DETECTION`
- [ ] `parseReceiptText()` is PUBLIC, extracts vendor (first line), amount (TOTAL pattern), date (MM/DD/YYYY etc.)
- [ ] `updateReceiptOcrResult()` persists OCR fields and sets status to `complete` or `failed`
- [ ] All errors in `processReceipt()` are caught — never throws (sets `ocr_status = failed` instead)
- [ ] Missing API key detected at startup with warning log, not a crash
- [ ] `OcrService` registered in `FinancialModule` providers AND exports
- [ ] No new npm packages installed
- [ ] Dev server compiles and health check passes
- [ ] No existing code modified except `financial.module.ts` (adding OcrService registration)
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before proceeding to Sprint 5_2:
1. Dev server must compile with zero errors
2. `OcrService` must be registered in `FinancialModule` providers and exports
3. Health check must return 200
4. Server logs must show warning about missing `GOOGLE_VISION_API_KEY` (expected)

---

## Handoff Notes

- `OcrService` is now available for injection in `JobsModule` (via `FinancialModule` export)
- Key method for processor: `ocrService.processReceipt(receiptId, tenantId, fileId)`
- `parseReceiptText()` is public and testable independently
- `StorageProviderFactory` is global — no additional module import needed
- Next sprint (5_2) wires the BullMQ queue and processor
