# Sprint F-05 — Receipt OCR

**Module**: Financial  
**Sprint**: F-05  
**Status**: Ready for Development  
**Type**: New Feature — External API Integration + BullMQ Async Job  
**Estimated Complexity**: Medium  
**Prerequisite**: Sprint F-04 must be complete (expense entry engine must be live before OCR hooks into it).

---

## Purpose

Field workers take photos of receipts every day — gas stations, hardware stores, lumber yards, supply houses. Today those photos are uploaded manually and linked to expense entries by hand. The worker must remember the vendor, the amount, and the date and type them all in.

Receipt OCR eliminates that manual step. The worker uploads a photo of the receipt. The system sends it to Google Cloud Vision API in a background job. Within seconds, the expense form is pre-populated with vendor name, amount, date, and any line items the OCR can detect. The worker reviews, corrects if needed, and confirms in one tap.

This sprint activates the OCR infrastructure that already exists in the schema. The `receipt` table has `ocr_status`, `ocr_raw`, `ocr_vendor`, `ocr_amount`, `ocr_date`, and `ocr_status` fields — they were built in Sprint 11 (Gate 2) but never wired to a real OCR provider. This sprint wires them to Google Cloud Vision API via a BullMQ async processor, following the exact same job pattern as the existing `send-email.processor.ts` and `scheduled-jobs.processor.ts` in `api/src/modules/jobs/processors/`.

---

## Scope

### In Scope

- New BullMQ queue: `ocr-processing`
- New BullMQ processor: `ocr-processing.processor.ts` in `api/src/modules/jobs/processors/`
- New `OcrService` in `api/src/modules/financial/services/` — handles Google Vision API call and result parsing
- Upload endpoint enhancement: after receipt upload, enqueue OCR job automatically (non-blocking)
- OCR result endpoint: poll or retrieve parsed OCR fields for a given receipt
- Receipt-to-entry link endpoint: after OCR, allow user to create a financial entry pre-populated from OCR data
- `ReceiptService` updates: status management, result storage, confirmed-field updates
- Google Cloud Vision API integration using `DOCUMENT_TEXT_DETECTION` feature type
- Error handling: OCR failures set `ocr_status = failed`, entry creation still works manually
- Retry logic: failed OCR jobs retry up to 3 times with exponential backoff
- New environment variable: `GOOGLE_VISION_API_KEY`
- 100% API documentation
- Full test coverage with mocked Google Vision API

### Out of Scope

- No frontend implementation
- No line-item extraction beyond vendor, amount, date — line item parsing is complex and deferred
- No multi-page PDF receipt OCR — single image only in this sprint
- No receipt deduplication (detecting if same receipt uploaded twice) — deferred
- No automatic expense entry creation without user confirmation — OCR only pre-populates, never auto-posts
- No changes to the `receipt` table schema — all required fields already exist from Gate 2

---

## Platform Architecture Patterns (Mandatory)

- **Tenant isolation**: Every receipt query must include `tenant_id`. OCR jobs carry `tenant_id` in their payload to ensure correct scoping.
- **TenantId decorator**: All controller methods use `@TenantId()`.
- **AuditLoggerService**: Receipt uploads, OCR completions, and entry links must be audit logged.
- **FilesService**: Already imported in `FinancialModule`. Receipt image retrieval for OCR uses the existing `FilesService` to get the file buffer from local storage. Read the `FilesService` implementation before writing `OcrService` — understand how file buffers are retrieved.
- **BullMQ pattern**: Follow the exact same pattern as `send-email.processor.ts`. Read that file before writing the OCR processor. Use the same queue registration approach as the email queue in `jobs.module.ts`.
- **EncryptionService**: Not applicable.
- **No new migrations**: The `receipt` table already has all required fields. This sprint is purely service + job implementation.

---

## Existing `receipt` Table — Confirmed Fields

All fields below already exist in the schema (confirmed from project knowledge). No schema changes required.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id` | — |
| `tenant_id` | `String` | — |
| `financial_entry_id` | `String?` | Link to expense entry — nullable until user creates entry |
| `project_id` | `String?` | Optional project context |
| `task_id` | `String?` | Optional task context |
| `file_id` | `String` | FK to file record — used to retrieve image buffer |
| `file_url` | `String` | Public/internal URL |
| `file_name` | `String` | Original filename |
| `file_type` | `receipt_file_type` enum | `photo` or `pdf` |
| `file_size_bytes` | `Int?` | — |
| `vendor_name` | `String?` | Manually confirmed vendor |
| `amount` | `Decimal?` | Manually confirmed amount |
| `receipt_date` | `DateTime?` | Manually confirmed date |
| `ocr_raw` | `String? @db.Text` | Raw JSON response from Google Vision API |
| `ocr_status` | `receipt_ocr_status` enum | `not_processed` / `processing` / `complete` / `failed` |
| `ocr_vendor` | `String?` | OCR-detected vendor name |
| `ocr_amount` | `Decimal?` | OCR-detected total amount |
| `ocr_date` | `DateTime?` | OCR-detected receipt date |
| `is_categorized` | `Boolean` | Whether user has linked to an entry |
| `uploaded_by_user_id` | `String` | — |
| `created_at` | `DateTime` | — |
| `updated_at` | `DateTime` | — |

---

## Google Cloud Vision API Integration

### API Mode

Use `DOCUMENT_TEXT_DETECTION` — not basic `TEXT_DETECTION`. This mode returns full structured document output with paragraph-level bounding boxes, which produces better results on printed receipts than the scene-text detector.

### API Call Structure

The `OcrService` sends a single HTTP POST request to the Google Cloud Vision API with the image encoded as base64. The request uses the `DOCUMENT_TEXT_DETECTION` feature type. No training, no model configuration — this is a direct call to a hosted pre-trained model.

**Environment variable required:** `GOOGLE_VISION_API_KEY`

**API endpoint:** `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`

**Input:** Base64-encoded image content from the receipt file buffer, retrieved via `FilesService`.

**Response structure used:**
- `fullTextAnnotation.text` — the complete extracted text block (stored in `ocr_raw` as JSON)
- Parsed fields extracted from the text: vendor name, total amount, date

### OCR Parsing Logic

The Google Vision API returns raw text — it does not return structured fields like "vendor" or "total". The `OcrService` must parse the raw text to extract:

**Vendor name:** The first non-empty line of the extracted text is typically the business name on the receipt. Use the first 1–2 lines as the vendor candidate. Store the raw text as `ocr_raw`, store the first line as `ocr_vendor`.

**Total amount:** Search the text for patterns matching:
- Lines containing `TOTAL`, `AMOUNT DUE`, `BALANCE DUE`, `GRAND TOTAL` (case-insensitive)
- Extract the decimal number on or immediately after that line
- Pattern: `/\$?\d{1,6}[.,]\d{2}/`
- If multiple candidates found, take the largest value (typically the grand total)
- Store as `ocr_amount`

**Date:** Search for date patterns:
- `MM/DD/YYYY`, `MM-DD-YYYY`, `MM/DD/YY`, `MONTH DD, YYYY`
- Take the first date found — receipt dates are almost always near the top
- Store as `ocr_date`

**Accuracy expectation:** These parsing rules will correctly extract data from clean thermal-printed receipts (hardware stores, gas stations, supply houses) approximately 85–90% of the time. The user always reviews and confirms before the data is used in an entry. The OCR result is a suggestion, not a final value.

**Failure condition:** If the API call fails, the image returns no text, or the parsing produces no usable fields, set `ocr_status = failed`. Do not throw — the receipt remains uploadable and the user creates the entry manually.

---

## BullMQ Job Architecture

### Queue Name
`ocr-processing`

### Queue Registration
Register the `ocr-processing` queue in `jobs.module.ts` following the exact same pattern used for the existing email queue. Read `api/src/modules/jobs/jobs.module.ts` before implementing to replicate the registration pattern exactly.

### Job Payload
```typescript
interface OcrJobPayload {
  receiptId: string;
  tenantId: string;
  fileId: string;
}
```

### Processor File
Location: `api/src/modules/jobs/processors/ocr-processing.processor.ts`

Follow the same class structure, decorator pattern, and error handling as `send-email.processor.ts`.

**Processor behavior:**
1. Receive job with `OcrJobPayload`.
2. Fetch receipt record from DB — verify it exists and `ocr_status = processing`.
3. Retrieve file buffer from `FilesService` using `fileId`.
4. Encode file buffer as base64.
5. Call Google Cloud Vision API with base64 image and `DOCUMENT_TEXT_DETECTION` feature.
6. Parse API response for vendor, amount, date using `OcrService.parseReceiptText()`.
7. Update receipt record:
   - `ocr_raw = JSON.stringify(fullApiResponse)`
   - `ocr_vendor = parsedVendor`
   - `ocr_amount = parsedAmount`
   - `ocr_date = parsedDate`
   - `ocr_status = 'complete'` (or `'failed'` on error)
8. If entry was pre-linked (`financial_entry_id` not null), do not auto-update the entry — the user must confirm.

**Retry configuration:**
- Max attempts: 3
- Backoff: exponential, starting at 5 seconds
- On final failure: set `ocr_status = failed`, log error, do not throw to the queue (mark job as completed to prevent infinite retry loop on permanent failures like corrupt images)

### Job Enqueue Trigger
When a receipt is uploaded (existing `POST /financial/receipts` endpoint in `ReceiptService`), after the record is created:
1. Set `ocr_status = 'processing'` on the receipt.
2. Enqueue an `ocr-processing` job with the receipt's `id`, `tenant_id`, and `file_id`.
3. Return the receipt record to the client immediately — do not wait for OCR completion.

The upload response returns `ocr_status = 'processing'` so the frontend knows to poll or check back.

---

## API Changes

### Existing Endpoints — Updated Behavior

#### `POST /financial/receipts` (upload)

**Behavior change:** After creating the receipt record, immediately enqueue the OCR job and set `ocr_status = 'processing'`. The endpoint response is unchanged in shape but `ocr_status` will now return `processing` instead of `not_processed`.

**No request body change.**

**Response change:** `ocr_status` field now returns `processing` on upload success (was previously always `not_processed`).

---

### New Endpoints

#### `GET /financial/receipts/:id/ocr-status`

**Purpose:** Poll endpoint for checking OCR job completion. Frontend polls this after upload until status is `complete` or `failed`.

**Roles:** All roles (own receipts for Employee, all tenant receipts for other roles).

**Response:**
```
receipt_id      string
ocr_status      enum      not_processed | processing | complete | failed
ocr_vendor      string | null   — populated when complete
ocr_amount      decimal | null  — populated when complete
ocr_date        date | null     — populated when complete
has_suggestions boolean         — true if at least one OCR field was successfully parsed
```

**Polling guidance (document in API docs):** Frontend should poll at 2-second intervals, up to 30 seconds (15 attempts). If still `processing` after 30 seconds, display manual entry form as fallback. If `failed`, display manual entry form.

---

#### `POST /financial/receipts/:id/create-entry`

**Purpose:** Create a financial entry pre-populated from OCR-parsed receipt data. This is the action the user takes after reviewing the OCR suggestions.

**Roles:** Same as `POST /financial/entries` — all roles except Employee submits as `pending_review`.

**Request body:** Same as `POST /financial/entries` (F-04) — all fields. The frontend pre-populates this form with OCR suggestions; the user overrides as needed and submits.

**Additional behavior beyond standard entry creation:**
1. Create the financial entry via `FinancialEntryService.createEntry()` with all standard validation.
2. After entry is created, link the receipt to the entry: set `receipt.financial_entry_id = new_entry.id`.
3. Set `receipt.is_categorized = true`.
4. If `receipt.ocr_vendor` is populated and `vendor_name` was not explicitly provided in the request body, copy `ocr_vendor` into the entry's `vendor_name` as a fallback.
5. If `receipt.ocr_amount` is populated and `amount` was not provided in the request body, use `ocr_amount` as the entry amount.
6. If `receipt.ocr_date` is populated and `entry_date` was not provided, use `ocr_date` as the entry date.

**Response:** 201 Created — the created financial entry (full enriched shape from F-04), plus a `receipt` object showing the linked receipt.

**Errors:**
- 404 — receipt not found or not in tenant
- 400 — receipt is already linked to an entry (`is_categorized = true` and `financial_entry_id` not null)
- Any validation errors from `FinancialEntryService.createEntry()`

---

#### `POST /financial/receipts/:id/retry-ocr`

**Purpose:** Manually re-trigger OCR processing for a receipt that failed or was not processed.

**Roles:** Owner, Admin, Manager, Bookkeeper only.

**No request body.**

**Behavior:**
1. Verify receipt belongs to tenant.
2. Verify `ocr_status` is `failed` or `not_processed`. Throw 400 if `processing` or `complete`.
3. Set `ocr_status = 'processing'`.
4. Clear existing OCR fields: `ocr_vendor`, `ocr_amount`, `ocr_date`, `ocr_raw`.
5. Enqueue a new `ocr-processing` job.

**Response:** 200 OK — receipt object with `ocr_status = 'processing'`.

**Errors:**
- 404 — not found
- 400 — receipt is already processing or already complete

---

## Service Architecture

### New: `OcrService`

Location: `api/src/modules/financial/services/ocr.service.ts`

| Method | Signature | Notes |
|--------|-----------|-------|
| `processReceipt` | `(receiptId, tenantId, fileId)` | Orchestrates the full OCR flow — called by processor |
| `callVisionApi` | `(imageBase64: string)` | HTTP call to Google Vision API — private |
| `parseReceiptText` | `(fullText: string)` | Extracts vendor, amount, date from raw text — private, but unit-testable |
| `updateReceiptOcrResult` | `(receiptId, result)` | Persists parsed fields to receipt record |

`OcrService` is registered in `FinancialModule` and injected into the OCR processor via module export.

### Updated: `ReceiptService`

Add to existing service:

| Method | Signature | Notes |
|--------|-----------|-------|
| `getOcrStatus` | `(tenantId, receiptId, userId, userRole)` | Returns OCR status + parsed fields |
| `createEntryFromReceipt` | `(tenantId, receiptId, userId, userRole, dto)` | Delegates to FinancialEntryService then links receipt |
| `retryOcr` | `(tenantId, receiptId, userId)` | Resets OCR state and enqueues new job |
| `enqueueOcrJob` | `(receiptId, tenantId, fileId)` | Private — called on upload and retry |

---

## Environment Configuration

Add to `.env` and document in infrastructure docs:

```
GOOGLE_VISION_API_KEY=your_api_key_here
```

**Note for executing agent:** Verify with the existing Google integration (already used by vendor/supplier geo module) whether Google credentials are already configured using a service account JSON key file or an API key. Use whichever method is already in place — do not introduce a second authentication pattern for Google services. Read the vendor service's Google integration before implementing.

---

## Business Rules

1. OCR is always async — no endpoint blocks waiting for Vision API response.
2. OCR result is always a suggestion — the user must review and confirm before an expense entry is created.
3. An expense entry is never auto-created from OCR output without explicit user action (`POST /receipts/:id/create-entry`).
4. A receipt can only be linked to one financial entry. Once `is_categorized = true`, the create-entry endpoint rejects further calls.
5. OCR failures do not prevent manual entry creation — the receipt remains usable.
6. `ocr_raw` stores the full JSON response from Google Vision API for debugging and future re-parsing without making another API call.
7. The OCR processor sets `ocr_status = failed` on all error conditions including: API timeout, invalid image format, empty text response, API quota exceeded. It never lets a job fail silently without updating the receipt status.
8. After 3 failed retry attempts, the job is marked complete (not failed) in the BullMQ queue to prevent dead letter queue buildup. The receipt `ocr_status` remains `failed` for the user to see.
9. Employee can view OCR status for their own receipts. Other roles view all tenant receipts.
10. `retry-ocr` is not available to Employees — only Owner/Admin/Manager/Bookkeeper.

---

## Acceptance Criteria

**Upload Flow:**
- [ ] `POST /financial/receipts` sets `ocr_status = processing` and enqueues job
- [ ] Upload response returns immediately without waiting for OCR
- [ ] BullMQ job is enqueued with correct `receiptId`, `tenantId`, `fileId`

**OCR Processing:**
- [ ] Processor retrieves file buffer via `FilesService`
- [ ] Processor calls Google Vision API with base64 image
- [ ] Processor parses vendor name from first text line
- [ ] Processor parses amount using TOTAL/AMOUNT DUE pattern
- [ ] Processor parses date using MM/DD/YYYY and related patterns
- [ ] Successful OCR sets `ocr_status = complete`, populates `ocr_vendor`, `ocr_amount`, `ocr_date`, `ocr_raw`
- [ ] Failed API call sets `ocr_status = failed`
- [ ] Retry logic: 3 attempts with exponential backoff
- [ ] After 3 failures: receipt `ocr_status = failed`, job marked complete in queue

**Status Endpoint:**
- [ ] `GET /financial/receipts/:id/ocr-status` returns current status and parsed fields
- [ ] Employee can only access their own receipt status
- [ ] `has_suggestions = true` when at least one OCR field parsed

**Entry Creation:**
- [ ] `POST /financial/receipts/:id/create-entry` creates entry and links receipt
- [ ] OCR fields used as fallback when request body fields not provided
- [ ] `receipt.is_categorized = true` after entry created
- [ ] Second create-entry call on same receipt returns 400

**Retry:**
- [ ] `POST /financial/receipts/:id/retry-ocr` resets fields and re-enqueues
- [ ] Retry on `processing` receipt returns 400
- [ ] Retry on `complete` receipt returns 400

**Error Handling:**
- [ ] Invalid image (corrupt file) → `ocr_status = failed`, no exception propagated
- [ ] `GOOGLE_VISION_API_KEY` not configured → application startup warning logged, OCR endpoints return 503 with message "OCR service not configured"
- [ ] API quota exceeded → `ocr_status = failed`, error logged

**Tests:**
- [ ] Unit test: `OcrService.parseReceiptText()` with sample receipt texts (gas station, hardware store, lumber yard)
- [ ] Unit test: amount extraction handles `$`, commas, and multiple total candidates
- [ ] Unit test: date extraction handles all supported formats
- [ ] Unit test: complete failure path → `ocr_status = failed`
- [ ] Integration test: upload → job enqueued → processor runs → status = complete (Google API mocked)
- [ ] Integration test: retry flow
- [ ] Integration test: create-entry from OCR result
- [ ] Tenant isolation: OCR job always scoped to correct tenant

**Documentation:**
- [ ] `api/documentation/financial_REST_API.md` updated with all new endpoints
- [ ] Polling strategy documented for frontend
- [ ] `GOOGLE_VISION_API_KEY` env var documented in infrastructure docs
- [ ] OCR parsing limitations documented (what it can and cannot reliably extract)

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Google Vision API key auth method differs from existing geo integration | Medium — two auth patterns in codebase | Low | Agent must read existing Google integration before implementing. Use same method. |
| Thermal receipt image quality varies — low contrast, faded text | Medium — lower OCR accuracy | High — field photos are often imperfect | Documented accuracy expectation: ~85–90% on clean receipts, lower on poor photos. User review step is mandatory. |
| BullMQ queue registration pattern mismatch with existing jobs module | Medium — processor not picked up | Medium | Agent must read `jobs.module.ts` before implementing queue registration. |
| Receipt image stored locally (Nginx) not accessible as buffer | Medium — OcrService cannot read file | Low | Read `FilesService` implementation — it already handles local file retrieval. Use its existing method. |
| OCR job enqueued but `FinancialModule` cannot inject `JobsModule` queue | Medium — circular/missing dependency | Medium | Agent must check if `JobsModule` is already imported in `FinancialModule`. If not, add import. Document the dependency chain. |

---

## Dependencies

### Requires (must be complete)
- Sprint F-04 — `FinancialEntryService.createEntry()` must be the live implementation (create-entry endpoint delegates to it)
- `receipt` table from Gate 2 — confirmed exists
- `FilesService` — confirmed exists and imported in `FinancialModule`
- BullMQ infrastructure — confirmed exists in `jobs.module.ts`
- Google API key — must be provisioned and added to `.env`

### Blocks
- Nothing in the F-series is blocked by OCR — it is an enhancement to the entry workflow, not a dependency for other sprints

### Runs in parallel with
- F-06 (Recurring Expense Engine) — no dependency between the two

---

## File Change Summary

### Files Created
- `api/src/modules/financial/services/ocr.service.ts`
- `api/src/modules/jobs/processors/ocr-processing.processor.ts`

### Files Modified
- `api/src/modules/financial/services/receipt.service.ts` — add 4 new methods, update upload trigger
- `api/src/modules/financial/controllers/receipt.controller.ts` — add 3 new endpoints
- `api/src/modules/financial/financial.module.ts` — register `OcrService`, import `JobsModule` if not already imported
- `api/src/modules/jobs/jobs.module.ts` — register `ocr-processing` queue
- `api/documentation/financial_REST_API.md` — add all new endpoints
- `.env.example` — add `GOOGLE_VISION_API_KEY`

### Files That Must NOT Be Modified
- Any file in `api/src/modules/quotes/`
- Any file in `api/src/modules/projects/`
- `api/prisma/schema.prisma` — no schema changes in this sprint
- Any frontend file

---

## Notes for Executing Agent

1. Read `api/src/modules/jobs/processors/send-email.processor.ts` in full before writing the OCR processor. Replicate its class structure, `@Processor()` decorator, `@Process()` method pattern, and error handling approach exactly.
2. Read `api/src/modules/jobs/jobs.module.ts` in full before adding the `ocr-processing` queue. Register it the same way the email queue is registered.
3. Read `api/src/modules/files/` to understand how `FilesService` retrieves file buffers from local Nginx storage. The OCR processor needs the raw binary buffer — not the URL.
4. Read the existing Google Places integration in `vendor.service.ts` to understand which Google auth method is in use (API key string vs. service account JSON). Use the same method — do not introduce a second approach.
5. The `parseReceiptText()` method is the most complex piece of this sprint. Write it as a pure function with no side effects so it is fully unit-testable. Test it with at least 5 sample receipt texts before considering the sprint complete.
6. The `POST /financial/receipts/:id/create-entry` endpoint is a composite action — it creates an entry AND links the receipt. Both must succeed or neither must persist (use a Prisma transaction).
7. If `GOOGLE_VISION_API_KEY` is not set in the environment, the `OcrService` must detect this at startup and log a warning. Calls to `processReceipt` must return gracefully with `ocr_status = failed` rather than crashing the processor.
8. Produce 100% API documentation before marking the sprint complete.