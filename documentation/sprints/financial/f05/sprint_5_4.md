# Sprint 5_4 — Controller Endpoints + Swagger (OCR Status, Create-Entry, Retry-OCR)

**Module:** Financial
**File:** ./documentation/sprints/financial/f05/sprint_5_4.md
**Type:** Backend — Controller + Swagger Documentation
**Depends On:** Sprint 5_3 complete (ReceiptService has all 4 new methods, DTO exists)
**Gate:** STOP — All 3 new endpoints must respond to curl with correct status codes, Swagger docs must render at /api/docs
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

Add 3 new endpoints to the existing `ReceiptController`:
1. `GET /financial/receipts/:id/ocr-status` — Poll OCR processing status
2. `POST /financial/receipts/:id/create-entry` — Create financial entry from OCR data
3. `POST /financial/receipts/:id/retry-ocr` — Retry failed OCR processing

All endpoints must have full Swagger/OpenAPI decorators. Route ordering is critical — specific sub-routes (`:id/ocr-status`, `:id/create-entry`, `:id/retry-ocr`) must be defined BEFORE the generic `:id` route to prevent NestJS from matching the wrong handler.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/receipt.controller.ts` — understand ALL existing endpoints, decorators, imports, route ordering
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/receipt.service.ts` — verify all 4 new methods exist from Sprint 5_3
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-entry-from-receipt.dto.ts` — verify DTO exists from Sprint 5_3
- [ ] Verify Sprint 5_3 gate passed: server compiles, all methods available

**IF any new service methods or DTO do not exist — STOP. Sprint 5_3 must be complete first.**

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

### Task 1 — Read Existing Controller

**What:** Read `/var/www/lead360.app/api/src/modules/financial/controllers/receipt.controller.ts` carefully.

Pay attention to:
1. Existing imports — you must add to them, not replace
2. Current endpoint order — the generic `@Get(':id')` is at line ~133 and `@Patch(':id')` is at line ~180
3. Route ordering rule: NestJS matches routes top-to-bottom. Specific sub-routes like `:id/ocr-status` MUST be defined BEFORE `:id` or they will never match.
4. How `req.user` is accessed — `req.user.tenant_id`, `req.user.id`, `req.user.roles`
5. The `@Roles()` decorator pattern
6. The `@ApiTags('Financial Receipts')` is already applied at class level

**Current endpoint order in the controller:**
```
POST   /financial/receipts          — uploadReceipt       (line ~56)
GET    /financial/receipts          — listReceipts        (line ~110)
GET    /financial/receipts/:id      — getReceipt          (line ~133)
PATCH  /financial/receipts/:id/link — linkReceipt         (line ~150)
PATCH  /financial/receipts/:id      — updateReceipt       (line ~180)
```

---

### Task 2 — Add Import for DTO

**What:** Add the `CreateEntryFromReceiptDto` import to the controller.

Add at top of file with other DTO imports:
```typescript
import { CreateEntryFromReceiptDto } from '../dto/create-entry-from-receipt.dto';
```

Also add `HttpCode` and `HttpStatus` if not already imported from `@nestjs/common`:
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  ParseUUIDPipe,
  BadRequestException,
  HttpCode,         // ← ADD if not present
  HttpStatus,       // ← ADD if not present
} from '@nestjs/common';
```

---

### Task 3 — Add Endpoint: `GET /financial/receipts/:id/ocr-status`

**What:** Add this endpoint to the controller. It MUST be placed BEFORE the existing `@Get(':id')` endpoint.

**Route ordering:** Insert this endpoint AFTER `@Get()` (list receipts) but BEFORE `@Get(':id')` (get single receipt).

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// GET /financial/receipts/:id/ocr-status
// ─────────────────────────────────────────────────────────────────────────────

@Get(':id/ocr-status')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Field')
@ApiOperation({
  summary: 'Get OCR processing status for a receipt',
  description:
    'Poll this endpoint after upload to check OCR completion. ' +
    'Frontend should poll at 2-second intervals, up to 30 seconds (15 attempts). ' +
    'If still processing after 30 seconds, display manual entry form as fallback. ' +
    'Employee (Field) role can only access their own receipts.',
})
@ApiParam({ name: 'id', description: 'Receipt UUID' })
@ApiResponse({
  status: 200,
  description: 'OCR status and parsed fields',
  schema: {
    type: 'object',
    properties: {
      receipt_id: { type: 'string', format: 'uuid' },
      ocr_status: {
        type: 'string',
        enum: ['not_processed', 'processing', 'complete', 'failed'],
      },
      ocr_vendor: { type: 'string', nullable: true },
      ocr_amount: { type: 'number', nullable: true },
      ocr_date: { type: 'string', format: 'date', nullable: true },
      has_suggestions: {
        type: 'boolean',
        description: 'True if at least one OCR field was successfully parsed',
      },
    },
  },
})
@ApiResponse({ status: 404, description: 'Receipt not found' })
async getOcrStatus(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.receiptService.getOcrStatus(
    req.user.tenant_id,
    id,
    req.user.id,
    req.user.roles,
  );
}
```

---

### Task 4 — Add Endpoint: `POST /financial/receipts/:id/create-entry`

**What:** Add this endpoint. Place it AFTER the ocr-status endpoint but BEFORE the `@Get(':id')` endpoint.

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// POST /financial/receipts/:id/create-entry
// ─────────────────────────────────────────────────────────────────────────────

@Post(':id/create-entry')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Field')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({
  summary: 'Create a financial entry from OCR-parsed receipt data',
  description:
    'Creates a financial entry pre-populated from OCR suggestions. ' +
    'The frontend pre-fills the form with OCR data; the user reviews, edits, and submits. ' +
    'OCR fields are used as fallback when request body fields are not provided. ' +
    'The receipt is automatically linked to the created entry (1:1). ' +
    'Returns 400 if the receipt is already linked to an entry.',
})
@ApiParam({ name: 'id', description: 'Receipt UUID' })
@ApiResponse({
  status: 201,
  description: 'Financial entry created and receipt linked',
  schema: {
    type: 'object',
    properties: {
      entry: {
        type: 'object',
        description: 'The created financial entry (full enriched shape)',
      },
      receipt: {
        type: 'object',
        description: 'The linked receipt with updated status',
      },
    },
  },
})
@ApiResponse({ status: 400, description: 'Receipt already linked or validation error' })
@ApiResponse({ status: 404, description: 'Receipt or category not found' })
async createEntryFromReceipt(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: CreateEntryFromReceiptDto,
) {
  return this.receiptService.createEntryFromReceipt(
    req.user.tenant_id,
    id,
    req.user.id,
    dto,
  );
}
```

---

### Task 5 — Add Endpoint: `POST /financial/receipts/:id/retry-ocr`

**What:** Add this endpoint. Place it AFTER create-entry but BEFORE `@Get(':id')`.

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// POST /financial/receipts/:id/retry-ocr
// ─────────────────────────────────────────────────────────────────────────────

@Post(':id/retry-ocr')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@HttpCode(HttpStatus.OK)
@ApiOperation({
  summary: 'Retry OCR processing for a receipt',
  description:
    'Re-triggers OCR processing for a receipt that failed or was not processed. ' +
    'Resets all OCR fields and enqueues a new processing job. ' +
    'Only available for receipts with ocr_status = failed or not_processed. ' +
    'Returns 400 if receipt is currently processing or already complete. ' +
    'Not available to Employee (Field) role.',
})
@ApiParam({ name: 'id', description: 'Receipt UUID' })
@ApiResponse({
  status: 200,
  description: 'OCR retry triggered — receipt returned with ocr_status = processing',
})
@ApiResponse({ status: 400, description: 'Receipt is currently processing or already complete' })
@ApiResponse({ status: 404, description: 'Receipt not found' })
async retryOcr(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.receiptService.retryOcr(
    req.user.tenant_id,
    id,
    req.user.id,
  );
}
```

**RBAC note:** Employee/Field role is NOT included — only Owner, Admin, Manager, Bookkeeper can retry OCR. This matches business rule BR-10.

---

### Task 6 — Verify Route Ordering

**What:** After adding all 3 endpoints, verify the final route order in the controller file.

The correct order must be:
```
POST   /financial/receipts              — uploadReceipt
GET    /financial/receipts              — listReceipts
GET    /financial/receipts/:id/ocr-status    — getOcrStatus       ← NEW (before :id)
POST   /financial/receipts/:id/create-entry  — createEntryFromReceipt  ← NEW (before :id)
POST   /financial/receipts/:id/retry-ocr     — retryOcr            ← NEW (before :id)
GET    /financial/receipts/:id              — getReceipt
PATCH  /financial/receipts/:id/link        — linkReceipt
PATCH  /financial/receipts/:id              — updateReceipt
```

**CRITICAL:** All three new `:id/xxx` routes MUST appear before `@Get(':id')`. If `:id` comes first, NestJS will match `GET /receipts/some-uuid/ocr-status` to `@Get(':id')` with `id = 'some-uuid'` and the `/ocr-status` part gets lost.

**Also verify:** The comment block at the top of the controller class should be updated to include the new routes:
```typescript
/**
 * Receipt endpoints (all under /api/v1/financial/receipts)
 *
 * POST   /financial/receipts              — Upload a receipt file
 * GET    /financial/receipts              — List receipts (project or task scoped)
 * GET    /financial/receipts/:id/ocr-status    — Get OCR processing status
 * POST   /financial/receipts/:id/create-entry  — Create entry from OCR data
 * POST   /financial/receipts/:id/retry-ocr     — Retry failed OCR processing
 * GET    /financial/receipts/:id              — Get single receipt
 * PATCH  /financial/receipts/:id/link         — Link receipt to financial entry
 * PATCH  /financial/receipts/:id              — Update receipt metadata
 */
```

---

### Task 7 — Update Upload Endpoint Description

**What:** Update the `@ApiOperation` description on the existing `POST /financial/receipts` upload endpoint.

Change the description from:
```
'OCR is reserved for Phase 2 — ocr_status is always not_processed.'
```
To:
```
'After upload, OCR processing is automatically enqueued. ' +
'The response returns ocr_status = processing. ' +
'Poll GET /financial/receipts/:id/ocr-status to check completion.'
```

**Do NOT:** Change anything else about the upload endpoint. Only update the description text.

---

### Task 8 — Verify Endpoints via curl

**What:** Start the dev server and test all 3 new endpoints with curl.

You need a valid JWT token. Get one by logging in:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' \
  | jq -r '.access_token')
```

**Test 1 — OCR Status (expect 404 with a fake UUID):**
```bash
curl -s -w "\n%{http_code}" http://localhost:8000/financial/receipts/00000000-0000-0000-0000-000000000000/ocr-status \
  -H "Authorization: Bearer $TOKEN"
```
Expected: 404 with `"Receipt not found"`

**Test 2 — Create Entry (expect 404 with a fake UUID):**
```bash
curl -s -w "\n%{http_code}" -X POST http://localhost:8000/financial/receipts/00000000-0000-0000-0000-000000000000/create-entry \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"00000000-0000-0000-0000-000000000001","category_id":"00000000-0000-0000-0000-000000000002"}'
```
Expected: 404 with `"Receipt not found"`

**Test 3 — Retry OCR (expect 404 with a fake UUID):**
```bash
curl -s -w "\n%{http_code}" -X POST http://localhost:8000/financial/receipts/00000000-0000-0000-0000-000000000000/retry-ocr \
  -H "Authorization: Bearer $TOKEN"
```
Expected: 404 with `"Receipt not found"`

**Test 4 — Swagger docs render:**
```bash
curl -s http://localhost:8000/api/docs-json | jq '.paths | keys[]' | grep -i receipt
```
Expected: Should list all receipt endpoints including the 3 new ones.

**Acceptance:** All 4 tests pass with expected responses.

---

### Task 9 — Verify Existing Endpoints Still Work

**What:** Confirm the existing receipt endpoints are not broken.

```bash
# List receipts (should work — requires project_id or task_id)
curl -s -w "\n%{http_code}" "http://localhost:8000/financial/receipts?project_id=00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: 200 with `{ data: [], meta: {...} }` (empty but valid response)

**Acceptance:** Existing endpoints return expected responses.

---

## Patterns Applied

### Route Ordering (NestJS Convention)
```typescript
// SPECIFIC routes first:
@Get(':id/ocr-status')    // Matches /receipts/uuid/ocr-status
@Post(':id/create-entry') // Matches /receipts/uuid/create-entry
@Post(':id/retry-ocr')    // Matches /receipts/uuid/retry-ocr

// GENERIC routes after:
@Get(':id')               // Matches /receipts/uuid
@Patch(':id')             // Matches /receipts/uuid
```

### Swagger Decorators (Platform Standard)
```typescript
@ApiOperation({ summary: '...', description: '...' })
@ApiParam({ name: 'id', description: 'Receipt UUID' })
@ApiResponse({ status: 200, description: '...' })
@ApiResponse({ status: 400, description: '...' })
@ApiResponse({ status: 404, description: '...' })
```

### RBAC via `@Roles()` Decorator
```typescript
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')      // No Employee
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Field')  // All roles
```

---

## Business Rules Enforced in This Sprint

- BR-09: Employee can view OCR status for their own receipts only (enforced in service, exposed via controller)
- BR-10: `retry-ocr` not available to Employee/Field (enforced via `@Roles()` on controller)
- BR-02: OCR result is a suggestion — `create-entry` endpoint lets user review and confirm

---

## Acceptance Criteria

- [ ] `GET /financial/receipts/:id/ocr-status` endpoint added with Swagger docs
- [ ] `POST /financial/receipts/:id/create-entry` endpoint added with Swagger docs
- [ ] `POST /financial/receipts/:id/retry-ocr` endpoint added with Swagger docs
- [ ] All 3 new routes placed BEFORE `@Get(':id')` in the controller
- [ ] `ocr-status` allows `Field` role; `retry-ocr` does NOT allow `Field` role
- [ ] Upload endpoint description updated to mention OCR processing
- [ ] All endpoints respond correctly to curl (404 with fake UUIDs)
- [ ] Swagger docs render at `/api/docs` with all new endpoints visible
- [ ] Existing endpoints still work (list, get, link, update)
- [ ] No existing code broken
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before proceeding to Sprint 5_5:
1. All 3 new endpoints respond to curl with correct error codes (404 for non-existent receipts)
2. Swagger docs show all 8 receipt endpoints (5 existing + 3 new)
3. Existing endpoints work as before
4. No route ordering issues (test by using a UUID that looks like a sub-route)

---

## Handoff Notes

- All 8 receipt endpoints are now live and Swagger-documented
- Controller passes through to `ReceiptService` methods — all business logic is in the service
- Route ordering is correct: sub-routes before generic `:id`
- Next sprint (5_5) adds unit tests for OcrService parsing logic
- Final sprint (5_6) adds API documentation and verification gate
