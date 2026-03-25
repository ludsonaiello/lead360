# Sprint 8_7 — Module Registration + Project Service Integration

**Module:** Financial + Projects (cross-module)
**File:** `./documentation/sprints/financial/f08/sprint_8_7.md`
**Type:** Backend — Integration
**Depends On:** Sprint 8_3 (DrawMilestoneService), Sprint 8_4 (ProjectInvoiceService), Sprint 8_5 (DrawMilestoneController), Sprint 8_6 (ProjectInvoiceController)
**Gate:** STOP — Server must compile and start, all endpoints must respond, health check must pass
**Estimated Complexity:** High (cross-module modification — requires extreme care)

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
- **EXTREME CAUTION:** This sprint modifies `project.service.ts` and `financial.module.ts` — both are critical production files. One wrong import or missing comma will break the entire platform. Read every file completely before making changes.

---

## Objective

Wire everything together: register the 3 new services and 2 new controllers in `financial.module.ts`, then inject `DrawMilestoneService` into `ProjectService` and add the `seedFromQuote()` call inside the `createFromQuote()` transaction. After this sprint, all F-08 endpoints are live and the draw schedule → milestone seeding works automatically on project creation.

---

## Pre-Sprint Checklist

- [ ] Sprint 8_3 GATE passed: DrawMilestoneService compiles
- [ ] Sprint 8_4 GATE passed: ProjectInvoiceService compiles
- [ ] Sprint 8_5 complete: DrawMilestoneController exists
- [ ] Sprint 8_6 complete: ProjectInvoiceController exists
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` IN FULL — understand all existing imports, providers, controllers, and exports
- [ ] Read `/var/www/lead360.app/api/src/modules/projects/services/project.service.ts` IN FULL — especially `createFromQuote()` method (lines 73-237), understand the complete flow including the `$transaction` block
- [ ] Read `/var/www/lead360.app/api/src/modules/projects/projects.module.ts` IN FULL — confirm it already imports `FinancialModule`
- [ ] Verify that `FinancialModule` is already imported in `ProjectsModule` (it is — line 11 and line 66 of projects.module.ts)

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

### Task 1 — Update `financial.module.ts` — Add Gate 4 services and controllers

**File:** `api/src/modules/financial/financial.module.ts`

**What:** Add the 3 new services and 2 new controllers created in Sprints 8_2–8_6.

**CRITICAL:** Do NOT remove or reorder any existing imports, providers, controllers, or exports. ADD to the existing lists.

**Step 1 — Add imports at the top of the file (after the Gate 3 imports block):**

```typescript
// Gate 4 (Sprint F-08) — Draw Milestones, Project Invoices, Invoice Payments
import { InvoiceNumberGeneratorService } from './services/invoice-number-generator.service';
import { DrawMilestoneService } from './services/draw-milestone.service';
import { ProjectInvoiceService } from './services/project-invoice.service';
import { DrawMilestoneController } from './controllers/draw-milestone.controller';
import { ProjectInvoiceController } from './controllers/project-invoice.controller';
```

**Step 2 — Add to the `controllers` array (after `SubcontractorInvoiceListController`):**

```typescript
    // Gate 4
    DrawMilestoneController,
    ProjectInvoiceController,
```

**Step 3 — Add to the `providers` array (after `SubcontractorInvoiceService`):**

```typescript
    // Gate 4
    InvoiceNumberGeneratorService,
    DrawMilestoneService,
    ProjectInvoiceService,
```

**Step 4 — Add to the `exports` array (after `SubcontractorInvoiceService`):**

```typescript
    // Gate 4
    InvoiceNumberGeneratorService,
    DrawMilestoneService,
    ProjectInvoiceService,
```

**IMPORTANT:** `DrawMilestoneService` MUST be exported because `ProjectService` in the Projects module needs to inject it. Since `ProjectsModule` already imports `FinancialModule`, exporting `DrawMilestoneService` from `FinancialModule` makes it available for injection in `ProjectService`.

---

### Task 2 — Modify `project.service.ts` — Inject DrawMilestoneService and add `seedFromQuote()` call

**File:** `api/src/modules/projects/services/project.service.ts`

**⚠️ This is the ONLY permitted modification to the Projects module in Sprint F-08.**

**Step 1 — Add import at the top of the file (after existing service imports):**

```typescript
import { DrawMilestoneService } from '../../financial/services/draw-milestone.service';
```

**Step 2 — Add to constructor (after the last existing parameter):**

Find the constructor:
```typescript
constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly financialEntryService: FinancialEntryService,
    private readonly projectNumberGenerator: ProjectNumberGeneratorService,
    private readonly projectTemplateService: ProjectTemplateService,
    private readonly projectActivityService: ProjectActivityService,
    private readonly portalAuthService: PortalAuthService,
  ) {}
```

Add after `portalAuthService`:
```typescript
    private readonly drawMilestoneService: DrawMilestoneService,
```

So the constructor becomes:
```typescript
constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly financialEntryService: FinancialEntryService,
    private readonly projectNumberGenerator: ProjectNumberGeneratorService,
    private readonly projectTemplateService: ProjectTemplateService,
    private readonly projectActivityService: ProjectActivityService,
    private readonly portalAuthService: PortalAuthService,
    private readonly drawMilestoneService: DrawMilestoneService,
  ) {}
```

**Step 3 — Add `seedFromQuote()` call INSIDE the `$transaction` block of `createFromQuote()`:**

Find the `createFromQuote()` method. Inside the `this.prisma.$transaction(async (tx) => { ... })` block, locate the line `return newProject;` (approximately line 208). BEFORE that `return` statement, add the following:

```typescript
      // g. Seed draw milestones from quote draw schedule (Sprint F-08)
      await this.drawMilestoneService.seedFromQuote(
        tenantId,
        newProject.id,
        quoteId,
        userId,
        tx,
      );
```

The transaction block should end like this:
```typescript
      // ... existing template tasks code ...

      // g. Seed draw milestones from quote draw schedule (Sprint F-08)
      await this.drawMilestoneService.seedFromQuote(
        tenantId,
        newProject.id,
        quoteId,
        userId,
        tx,
      );

      return newProject;
    });
```

**CRITICAL PLACEMENT:** The call MUST be:
1. **Inside** the `$transaction` block — to ensure atomicity with project creation
2. **After** the project is created (`newProject` must exist)
3. **Before** the `return newProject;` statement
4. The `tx` parameter is passed as the 5th argument — this ensures all milestone creation uses the same transaction

**Do NOT modify anything else in this method.** Do not change the audit log. Do not change the portal account creation. Do not touch any other code in `project.service.ts`.

---

### Task 3 — Update `project.service.spec.ts` mock to include DrawMilestoneService

**File:** `api/src/modules/projects/services/project.service.spec.ts`

**Why:** Adding `DrawMilestoneService` to the `ProjectService` constructor WILL break the existing unit test because the test module's providers don't include the new dependency. NestJS dependency injection will throw an error when trying to instantiate `ProjectService` in the test.

**Step 1 — Add the mock object (after the existing `mockFinancialEntryService` mock, around line 184):**

```typescript
const mockDrawMilestoneService = {
  seedFromQuote: jest.fn().mockResolvedValue(undefined),
  findByProject: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  generateInvoice: jest.fn(),
};
```

**Step 2 — Add to the test module providers (after the `PortalAuthService` provider, around line 233):**

```typescript
        {
          provide: DrawMilestoneService,
          useValue: mockDrawMilestoneService,
        },
```

**Step 3 — Add the import at the top of the test file:**

```typescript
import { DrawMilestoneService } from '../../financial/services/draw-milestone.service';
```

**Step 4 — Verify existing tests still pass:**

```bash
cd /var/www/lead360.app/api
npx jest --testPathPattern="projects/services/project.service.spec" --verbose 2>&1 | tail -30
```

All existing tests in `project.service.spec.ts` must still pass after adding the mock.

**Do NOT modify any test assertions.** Only add the mock provider for the new dependency.

---

### Task 4 — Verify NO changes needed to `projects.module.ts`

**File:** `api/src/modules/projects/projects.module.ts`

**Read this file and confirm:**
1. `FinancialModule` is already imported (line 11: `import { FinancialModule } from '../financial/financial.module';` and line 66: `FinancialModule` in the imports array)
2. Since `DrawMilestoneService` is exported from `FinancialModule` (Task 1), it is automatically available for injection in `ProjectService`
3. **No changes are needed to `projects.module.ts`**

If for any reason `FinancialModule` is NOT imported in `ProjectsModule`, add it. But based on the current codebase, it already is.

---

### Task 5 — Verify server compiles and starts

**Steps:**

1. Start the dev server (see Dev Server section above).
2. Wait for health check to pass.
3. Verify all new endpoints are accessible:

```bash
# Get auth token (use test account)
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Test milestone endpoint responds (404 is OK — means controller is registered, just no matching project)
curl -s -w "\n%{http_code}" http://localhost:8000/projects/00000000-0000-0000-0000-000000000000/milestones \
  -H "Authorization: Bearer $TOKEN"

# Test invoice endpoint responds
curl -s -w "\n%{http_code}" http://localhost:8000/projects/00000000-0000-0000-0000-000000000000/invoices \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Both should return either 200 (empty list), 403, or 404 — NOT 500 or connection error. A 404 response from NestJS means the controller is registered and handling the route.

4. Verify Swagger docs include the new endpoints:
```bash
curl -s http://localhost:8000/api/docs-json | grep -c "milestones"
curl -s http://localhost:8000/api/docs-json | grep -c "invoices"
```
Both should return positive counts (meaning the endpoints are documented in Swagger).

---

### Task 6 — Verify existing project creation still works

**CRITICAL:** The modification to `createFromQuote()` must not break existing project creation.

If you have a test quote available, try creating a project from it. If no test data is available, at minimum:
1. Verify `npx tsc --noEmit` passes
2. Verify the server starts without errors
3. Verify no TypeScript errors related to `ProjectService` constructor

---

## Acceptance Criteria

- [ ] `financial.module.ts` updated: 3 new services in providers + exports, 2 new controllers in controllers
- [ ] `DrawMilestoneService` is exported from `FinancialModule`
- [ ] `project.service.ts` updated: `DrawMilestoneService` injected in constructor
- [ ] `project.service.ts` updated: `seedFromQuote()` call added INSIDE the `$transaction` block
- [ ] `seedFromQuote()` call passes `tx` as the 5th parameter (transaction client)
- [ ] `seedFromQuote()` call is positioned AFTER project creation, BEFORE `return newProject`
- [ ] NO other changes made to `project.service.ts` beyond import + constructor + seedFromQuote call
- [ ] `project.service.spec.ts` updated: `DrawMilestoneService` mock added to test module providers
- [ ] `project.service.spec.ts`: all existing tests still pass after mock addition
- [ ] NO changes needed to `projects.module.ts` (FinancialModule already imported)
- [ ] Server compiles without errors
- [ ] Health check passes: `curl -s http://localhost:8000/health` returns 200
- [ ] Milestone endpoints respond (GET /projects/:id/milestones)
- [ ] Invoice endpoints respond (GET /projects/:id/invoices)
- [ ] Swagger docs include new endpoints
- [ ] `npx tsc --noEmit` passes
- [ ] No existing tests broken by the changes
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — The server MUST compile and start cleanly with all new endpoints responding before Sprint 8_8 begins. This is the integration point where everything comes together.

Verify:
1. `npm run start:dev` compiles without errors
2. `curl -s http://localhost:8000/health` returns 200
3. Milestone and invoice endpoints respond (not 500)
4. Swagger docs show new endpoints
5. `npx tsc --noEmit` passes

---

## Handoff Notes

**All F-08 endpoints are now live:**

| Method | Path | Source |
|--------|------|--------|
| GET | `/projects/:projectId/milestones` | DrawMilestoneController |
| POST | `/projects/:projectId/milestones` | DrawMilestoneController |
| PATCH | `/projects/:projectId/milestones/:id` | DrawMilestoneController |
| DELETE | `/projects/:projectId/milestones/:id` | DrawMilestoneController |
| POST | `/projects/:projectId/milestones/:id/invoice` | DrawMilestoneController |
| GET | `/projects/:projectId/invoices` | ProjectInvoiceController |
| POST | `/projects/:projectId/invoices` | ProjectInvoiceController |
| GET | `/projects/:projectId/invoices/:id` | ProjectInvoiceController |
| PATCH | `/projects/:projectId/invoices/:id` | ProjectInvoiceController |
| POST | `/projects/:projectId/invoices/:id/send` | ProjectInvoiceController |
| POST | `/projects/:projectId/invoices/:id/void` | ProjectInvoiceController |
| POST | `/projects/:projectId/invoices/:id/payments` | ProjectInvoiceController |
| GET | `/projects/:projectId/invoices/:id/payments` | ProjectInvoiceController |

**Draw schedule seeding is active:** When `ProjectService.createFromQuote()` runs, it now calls `DrawMilestoneService.seedFromQuote()` inside the same transaction.

**Files modified in this sprint:**
1. `api/src/modules/financial/financial.module.ts` — added Gate 4 registrations
2. `api/src/modules/projects/services/project.service.ts` — added import, constructor param, and seedFromQuote() call
3. `api/src/modules/projects/services/project.service.spec.ts` — added DrawMilestoneService mock to test providers
