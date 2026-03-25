# Sprint 8_9 — Integration Tests + API Documentation + Final STOP Gate

**Module:** Financial
**File:** `./documentation/sprints/financial/f08/sprint_8_9.md`
**Type:** Backend — Testing + Documentation + Validation
**Depends On:** Sprint 8_7 (all endpoints live), Sprint 8_8 (revenue addendum)
**Gate:** **FINAL STOP** — All F-08 acceptance criteria verified, API documentation complete, all tests passing
**Estimated Complexity:** High

---

## Developer Standard

You are a **masterclass-level engineer** whose work makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is deliberate, precise, and production-grade.

---

## ⚠️ Critical Warnings

- **This platform is 85% production-ready.** Do NOT break any existing functionality. Not a single comma, relation, or enum may be disrupted.
- **Read the codebase BEFORE touching anything.** Understand what exists. Then implement with surgical precision.
- **Never leave the dev server running in the background** when you finish.
- **Never use `pkill -f`** — always use `lsof -i :PORT` + `kill {PID}`.
- **Never use PM2** — this project does NOT use PM2.
- **MySQL credentials** are in `/var/www/lead360.app/api/.env` — do NOT hardcode credentials anywhere.
- **API documentation MUST be based on the real codebase** — read the actual controllers, services, and DTOs. Do NOT copy from the sprint spec. Verify every field, every status code, every response shape against the actual implementation.

---

## Objective

This is the final sprint for F-08. It has three parts:
1. **Integration tests** covering the full billing cycle: milestone → invoice → send → payment → paid
2. **Complete API documentation** for all F-08 endpoints (must be based on the REAL codebase, not assumptions)
3. **Final validation** against all F-08 acceptance criteria

---

## Pre-Sprint Checklist

- [ ] Sprint 8_7 GATE passed: all endpoints live, server compiles
- [ ] Sprint 8_8 GATE passed: financial summary includes revenue data
- [ ] Server starts cleanly: `npm run start:dev` compiles without errors
- [ ] Read ALL actual service files to verify implementations match specifications:
  - `api/src/modules/financial/services/draw-milestone.service.ts`
  - `api/src/modules/financial/services/project-invoice.service.ts`
  - `api/src/modules/financial/services/invoice-number-generator.service.ts`
  - `api/src/modules/financial/services/project-financial-summary.service.ts`
- [ ] Read ALL actual controller files:
  - `api/src/modules/financial/controllers/draw-milestone.controller.ts`
  - `api/src/modules/financial/controllers/project-invoice.controller.ts`
  - `api/src/modules/financial/controllers/project-financial-summary.controller.ts`
- [ ] Read ALL actual DTOs in `api/src/modules/financial/dto/`
- [ ] Read the existing test files for patterns: `api/src/modules/financial/services/financial-entry.service.spec.ts`

---

## Dev Server

> ⚠️ This project does NOT use PM2. Do not reference or run PM2 commands.
> ⚠️ Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

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

### Task 1 — Create unit tests for DrawMilestoneService

**File:** `api/src/modules/financial/services/draw-milestone.service.spec.ts`

**Read the existing test file `api/src/modules/financial/services/financial-entry.service.spec.ts` for the testing pattern used in this codebase.** Follow the same mock setup, describe/it structure, and assertion style.

**Test cases to implement:**

```typescript
describe('DrawMilestoneService', () => {

  describe('seedFromQuote()', () => {
    it('should create milestones from draw schedule entries with percentage calculation', async () => {
      // Given: quote with draw_schedule_entries (percentage type), project with contract_value = 10000
      // When: seedFromQuote is called with a transaction mock
      // Then: milestones created with correct calculated_amount (percentage of contract_value)
      // Verify: createMany called with correct data
    });

    it('should handle fixed_amount calculation type', async () => {
      // Given: entries with calculation_type = fixed_amount, value = 5000
      // Then: calculated_amount = 5000 (raw value)
    });

    it('should handle null contract_value gracefully', async () => {
      // Given: project.contract_value is null, entries with percentage type
      // Then: calculated_amount = raw value, notes field contains warning message
    });

    it('should return silently when quote has no draw schedule entries', async () => {
      // Given: empty entries array
      // Then: no milestones created, no error thrown
    });
  });

  describe('create()', () => {
    it('should create a milestone with computed calculated_amount', async () => {
      // Given: project with contract_value, dto with percentage type
      // Then: milestone created with correct calculated_amount
    });

    it('should throw ConflictException for duplicate draw_number', async () => {
      // Given: existing milestone with draw_number = 1
      // When: create with same draw_number
      // Then: 409 ConflictException
    });

    it('should throw BadRequestException for percentage > 100', async () => {
      // Given: dto with calculation_type = percentage, value = 150
      // Then: 400 BadRequestException
    });
  });

  describe('update()', () => {
    it('should block calculated_amount change on invoiced milestone', async () => {
      // Given: milestone with status = invoiced
      // When: update with calculated_amount
      // Then: 400 BadRequestException
    });

    it('should allow description update on any status', async () => {
      // Given: milestone with status = invoiced
      // When: update with description only
      // Then: success
    });
  });

  describe('delete()', () => {
    it('should delete pending milestone', async () => {
      // Given: milestone with status = pending
      // Then: deleted successfully
    });

    it('should block deletion of invoiced milestone', async () => {
      // Given: milestone with status = invoiced
      // Then: 400 BadRequestException
    });
  });

  describe('generateInvoice()', () => {
    it('should create invoice and transition milestone to invoiced atomically', async () => {
      // Given: pending milestone
      // Then: invoice created, milestone.status = invoiced, milestone.invoice_id set
    });

    it('should throw 400 for non-pending milestone', async () => {
      // Given: milestone with status = invoiced
      // Then: 400 BadRequestException
    });
  });
});
```

**Mock setup pattern (from existing codebase):**
```typescript
const mockPrisma = {
  project_draw_milestone: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project_invoice: {
    create: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  draw_schedule_entry: {
    findMany: jest.fn(),
  },
  tenant: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
};

const mockAuditLogger = {
  logTenantChange: jest.fn(),
};

const mockInvoiceNumberGenerator = {
  generate: jest.fn().mockResolvedValue('INV-0001'),
};
```

---

### Task 2 — Create unit tests for ProjectInvoiceService

**File:** `api/src/modules/financial/services/project-invoice.service.spec.ts`

**Test cases to implement:**

```typescript
describe('ProjectInvoiceService', () => {

  describe('recordPayment()', () => {
    it('should create payment and update invoice amounts atomically', async () => {
      // Given: invoice with amount=10000, amount_due=10000, amount_paid=0
      // When: payment of 5000
      // Then: amount_paid=5000, amount_due=5000, status=partial
    });

    it('should transition invoice to paid when amount_due reaches 0', async () => {
      // Given: invoice with amount=10000, amount_due=5000, amount_paid=5000
      // When: payment of 5000
      // Then: amount_paid=10000, amount_due=0, status=paid, paid_at set
    });

    it('should transition milestone to paid when invoice is fully paid', async () => {
      // Given: invoice with milestone_id set, full payment
      // Then: milestone.status = paid, milestone.paid_at set
    });

    it('should throw 400 for overpayment', async () => {
      // Given: invoice with amount_due=5000
      // When: payment of 6000
      // Then: 400 BadRequestException
    });

    it('should throw 400 for voided invoice', async () => {
      // Given: invoice with status=voided
      // Then: 400 BadRequestException
    });
  });

  describe('voidInvoice()', () => {
    it('should void invoice and reset linked milestone to pending', async () => {
      // Given: invoice with milestone_id set, status=sent
      // When: void with reason
      // Then: invoice.status=voided, milestone.status=pending, milestone.invoice_id=null
    });

    it('should throw 400 for already voided invoice', async () => {
      // Given: invoice with status=voided
      // Then: 400 BadRequestException
    });

    it('should void invoice without milestone (manual invoice)', async () => {
      // Given: invoice with milestone_id=null
      // Then: invoice.status=voided, no milestone update attempted
    });
  });

  describe('markSent()', () => {
    it('should transition draft to sent', async () => {
      // Given: invoice with status=draft
      // Then: status=sent, sent_at set
    });

    it('should throw 400 for non-draft invoice', async () => {
      // Given: invoice with status=sent
      // Then: 400 BadRequestException
    });
  });

  describe('update()', () => {
    it('should recompute amount_due when amount changes', async () => {
      // Given: draft invoice with amount=10000, tax_amount=500
      // When: update amount to 15000
      // Then: amount_due recalculated to 15500
    });

    it('should throw 400 for non-draft invoice', async () => {
      // Given: invoice with status=sent
      // Then: 400 BadRequestException
    });
  });
});
```

---

### Task 3 — Create API documentation

**File:** `api/documentation/financial_f08_REST_API.md`

**CRITICAL:** This documentation MUST be based on the REAL codebase. Before writing a single line, READ the actual controllers, services, and DTOs that were implemented. Verify every field name, every validation rule, every response shape against the actual code.

**Structure the documentation as follows:**

```markdown
# Financial Module — F-08: Draw Schedule → Invoice Automation — REST API Documentation

## Base URL
`https://api.lead360.app` (production)
`http://localhost:8000` (development)

## Authentication
All endpoints require Bearer token authentication.
Header: `Authorization: Bearer {access_token}`

## Table of Contents
1. Draw Milestone Endpoints
2. Project Invoice Endpoints
3. Invoice Payment Endpoints
4. Financial Summary (Updated)

---

## 1. Draw Milestone Endpoints

### GET /projects/:projectId/milestones
{full documentation with request, response, status codes}

### POST /projects/:projectId/milestones
{full documentation with request body, validations, response}

### PATCH /projects/:projectId/milestones/:id
{full documentation}

### DELETE /projects/:projectId/milestones/:id
{full documentation}

### POST /projects/:projectId/milestones/:id/invoice
{full documentation — this is the core automation action}

---

## 2. Project Invoice Endpoints

### GET /projects/:projectId/invoices
{full documentation with query params, pagination, response}

### POST /projects/:projectId/invoices
{full documentation}

### GET /projects/:projectId/invoices/:id
{full documentation — includes payments in response}

### PATCH /projects/:projectId/invoices/:id
{full documentation — draft only}

### POST /projects/:projectId/invoices/:id/send
{full documentation}

### POST /projects/:projectId/invoices/:id/void
{full documentation — includes milestone reset behavior}

---

## 3. Invoice Payment Endpoints

### POST /projects/:projectId/invoices/:id/payments
{full documentation — atomic behavior described}

### GET /projects/:projectId/invoices/:id/payments
{full documentation}

---

## 4. Financial Summary (Updated)

### GET /projects/:projectId/financial-summary
{full documentation — now includes revenue and margin_analysis blocks}

---

## Business Rules Summary
1. Milestone lifecycle: pending → invoiced → paid
2. Invoice lifecycle: draft → sent → partial → paid → voided
3. [all 12 business rules from the spec]

## Deferred Items (Sprint 9)
- PDF invoice generation
- Email delivery
- Customer portal invoice view
- Credits and credit notes
- Invoice cap enforcement
- Bulk invoice operations
```

**For EACH endpoint, document:**
- HTTP Method + Path
- Description
- Authentication (Bearer required)
- RBAC Roles
- Path Parameters (with types)
- Query Parameters (if any)
- Request Body (with field descriptions, types, required/optional, validation rules)
- Response Body (with example JSON showing ALL fields)
- Error Responses (status code + condition)
- Example Request + Response

---

### Task 4 — Run ALL existing tests to verify no regressions

```bash
cd /var/www/lead360.app/api
npx jest --passWithNoTests 2>&1 | tail -30
```

If any existing tests fail, investigate and determine if the failure is caused by F-08 changes. Fix any regressions.

---

### Task 5 — Run new unit tests

```bash
cd /var/www/lead360.app/api
npx jest --testPathPattern="draw-milestone|project-invoice" --verbose 2>&1 | tail -50
```

All new tests must pass.

---

### Task 6 — Final STOP Gate Validation

Verify every acceptance criterion from the F-08 contract. Check each one methodically:

**Schema:**
- [ ] `project_draw_milestone` table exists: `npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'project_draw_milestone';"`
- [ ] `project_invoice` table exists
- [ ] `project_invoice_payment` table exists
- [ ] `invoice_status_extended` enum does not collide with `invoice_status`: both should exist separately
- [ ] Migration runs cleanly: `npx prisma migrate status`

**Draw Milestone Seeding:**
- [ ] Verify `project.service.ts` contains `drawMilestoneService.seedFromQuote()` call inside the transaction
- [ ] Verify `seedFromQuote()` handles both percentage and fixed_amount calculation types
- [ ] Verify `seedFromQuote()` handles null contract_value gracefully
- [ ] Verify `seedFromQuote()` sets `quote_draw_entry_id` on seeded milestones

**Milestone CRUD:**
- [ ] GET `/projects/:projectId/milestones` returns list ordered by draw_number
- [ ] POST `/projects/:projectId/milestones` creates milestone (409 on duplicate draw_number)
- [ ] PATCH blocks calculated_amount change on non-pending milestones
- [ ] DELETE blocks deletion of non-pending milestones

**Invoice Generation:**
- [ ] POST `/projects/:projectId/milestones/:id/invoice` creates invoice atomically
- [ ] Invoice number auto-generated (verify InvoiceNumberGeneratorService)
- [ ] Second attempt on same milestone returns 400

**Invoice Lifecycle:**
- [ ] POST send: draft → sent
- [ ] POST void: voided + milestone reset to pending
- [ ] PATCH on non-draft returns 400

**Payment Recording:**
- [ ] POST payment creates record and updates invoice amounts atomically
- [ ] Payment exceeding amount_due returns 400
- [ ] Full payment transitions invoice to paid and milestone to paid
- [ ] Partial payment transitions invoice to partial
- [ ] Payment on voided invoice returns 400

**F-07 Addendum:**
- [ ] GET financial summary includes `revenue` block
- [ ] Revenue excludes voided invoices
- [ ] `margin_analysis` block present with `gross_margin` and `billing_coverage`

**Tests:**
- [ ] Unit tests for DrawMilestoneService pass
- [ ] Unit tests for ProjectInvoiceService pass
- [ ] No existing tests broken

**Documentation:**
- [ ] `api/documentation/financial_f08_REST_API.md` created with 100% endpoint coverage
- [ ] Documentation based on actual codebase (not assumptions)

---

## Acceptance Criteria (This Sprint)

- [ ] `draw-milestone.service.spec.ts` created with tests for all business rules
- [ ] `project-invoice.service.spec.ts` created with tests for payment atomicity, void/reset, status transitions
- [ ] `financial_f08_REST_API.md` created with 100% endpoint coverage
- [ ] Documentation is based on REAL codebase — every field verified against actual implementation
- [ ] All new unit tests passing
- [ ] No existing tests broken
- [ ] All F-08 acceptance criteria verified (see Task 6)
- [ ] `npx tsc --noEmit` passes
- [ ] Server starts and health check passes
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**FINAL STOP — Sprint F-08 Complete**

This is the terminal gate for the entire F-08 sprint. The following MUST ALL be true:

1. ✅ Schema: 3 tables + 2 enums exist, migration clean
2. ✅ Services: DrawMilestoneService, ProjectInvoiceService, InvoiceNumberGeneratorService, ProjectFinancialSummaryService all exist and compile
3. ✅ Controllers: DrawMilestoneController (5 endpoints), ProjectInvoiceController (8 endpoints) all registered and responding
4. ✅ Integration: ProjectService.createFromQuote() calls seedFromQuote() inside transaction
5. ✅ Financial Summary: Revenue data included in summary response
6. ✅ Tests: All unit tests passing, no regressions
7. ✅ Documentation: 100% endpoint coverage in `financial_f08_REST_API.md`
8. ✅ Server: Compiles, starts, health check passes
9. ✅ Port 8000 released: Server shut down

**If ANY criterion fails, do NOT mark the sprint complete. Fix the issue first.**

---

## Handoff Notes

**Sprint F-08 is COMPLETE. The following is now available for downstream sprints:**

**For Sprint F-09 (Business Dashboard):**
- `project_invoice` table with aggregation queries for AR summary
- `project_invoice_payment` table for cash flow analysis
- Revenue data in financial summary endpoint

**For Future Sprint 9 (Full Invoicing Module):**
- `project_invoice` table is the foundation — Sprint 9 adds PDF, email, portal, credits, cap enforcement
- `project_invoice_payment` table handles basic payment recording — Sprint 9 can add refund/credit logic
- `InvoiceNumberGeneratorService` is ready for reuse
- Invoice lifecycle (draft → sent → partial → paid → voided) is implemented

**Files created in F-08:**
- `api/prisma/migrations/[timestamp]_draw_milestone_invoice_foundation/migration.sql`
- `api/src/modules/financial/services/draw-milestone.service.ts`
- `api/src/modules/financial/services/project-invoice.service.ts`
- `api/src/modules/financial/services/invoice-number-generator.service.ts`
- `api/src/modules/financial/services/project-financial-summary.service.ts`
- `api/src/modules/financial/controllers/draw-milestone.controller.ts`
- `api/src/modules/financial/controllers/project-invoice.controller.ts`
- `api/src/modules/financial/dto/create-draw-milestone.dto.ts`
- `api/src/modules/financial/dto/update-draw-milestone.dto.ts`
- `api/src/modules/financial/dto/generate-milestone-invoice.dto.ts`
- `api/src/modules/financial/dto/create-project-invoice.dto.ts`
- `api/src/modules/financial/dto/update-project-invoice.dto.ts`
- `api/src/modules/financial/dto/record-invoice-payment.dto.ts`
- `api/src/modules/financial/dto/void-invoice.dto.ts`
- `api/src/modules/financial/dto/list-project-invoices.dto.ts`
- `api/src/modules/financial/services/draw-milestone.service.spec.ts`
- `api/src/modules/financial/services/project-invoice.service.spec.ts`
- `api/documentation/financial_f08_REST_API.md`

**Files modified in F-08:**
- `api/prisma/schema.prisma` — 3 new tables, 2 new enums, reverse relations on project/user/tenant/draw_schedule_entry
- `api/src/modules/financial/financial.module.ts` — Gate 4 registrations + ProjectFinancialSummaryService
- `api/src/modules/financial/controllers/project-financial-summary.controller.ts` — switched to new summary service
- `api/src/modules/projects/services/project.service.ts` — added DrawMilestoneService injection + seedFromQuote() call
- `api/src/modules/projects/services/project.service.spec.ts` — added DrawMilestoneService mock to test providers
