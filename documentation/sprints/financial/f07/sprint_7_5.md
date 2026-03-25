# Sprint 7_5 — Controller Rebuild + Module Registration + Swagger

**Module:** Financial
**File:** ./documentation/sprints/financial/f07/sprint_7_5.md
**Type:** Backend — Controller + Module
**Depends On:** Sprint 7_4 (all service methods implemented)
**Gate:** STOP — All 5 endpoints must respond with correct HTTP status codes. Swagger must show all 5 endpoints.
**Estimated Complexity:** Medium

---

## Developer Standard

You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is deliberate, precise, and production-grade.

---

## Critical Warnings

- **This platform is 85% production-ready.** Never break existing code. Never leave the server running in the background.
- **Read the codebase before touching anything.** Implement with surgical precision — not a single comma may break existing business logic.
- **MySQL credentials are in the `.env` file** at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.
- **Never use `pkill -f`.** Always use `lsof -i :8000` + `kill {PID}`.
- **Never use PM2.** This project does NOT use PM2.

---

## Objective

Rebuild the `ProjectFinancialSummaryController` to:

1. Replace the single old endpoint with 5 new comprehensive endpoints
2. Wire the controller to the new `ProjectFinancialSummaryService`
3. Register the service in `FinancialModule`
4. Add full Swagger/OpenAPI documentation on every endpoint

**Current state** (will be completely replaced):
```typescript
// OLD — single endpoint, delegates to FinancialEntryService
@Get(':projectId/financial-summary')
@Roles('Owner', 'Admin', 'Manager')
async getProjectFinancialSummary(@Request() req, @Param('projectId') projectId) {
  return this.financialEntryService.getProjectCostSummary(req.user.tenant_id, projectId);
}
```

**New state:** 5 endpoints, all delegating to `ProjectFinancialSummaryService`.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/project-financial-summary.controller.ts` — understand current imports and structure (44 lines)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` — understand current registration (73 lines)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.ts` — confirm all 5 public methods exist
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/financial-entry.controller.ts` — reference for Swagger patterns
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/receipt.controller.ts` — reference for role patterns including 'Field'
- [ ] Confirm Sprint 7_4 gate is met (all service methods exist and compile)

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   <- must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   <- must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   <- must return nothing
```

---

## Tasks

### Task 1 — Rewrite `project-financial-summary.controller.ts`

**What:** Completely replace the contents of `/var/www/lead360.app/api/src/modules/financial/controllers/project-financial-summary.controller.ts` with the new controller.

**Existing import pattern** (from other financial controllers):
```typescript
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
```

**Complete new controller:**

```typescript
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ProjectFinancialSummaryService } from '../services/project-financial-summary.service';
import {
  ProjectDateFilterDto,
  ProjectTaskBreakdownQueryDto,
  ProjectReceiptsQueryDto,
} from '../dto/project-financial-query.dto';

@ApiTags('Project Financial Intelligence')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectFinancialSummaryController {
  constructor(
    private readonly summaryService: ProjectFinancialSummaryService,
  ) {}

  // ─── 1. Full Financial Summary ───────────────────────────────────────

  @Get(':projectId/financial/summary')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get full project financial summary',
    description:
      'Returns a complete financial picture of a project: cost breakdown by category and classification, ' +
      'subcontractor invoices and payments, crew hours and payments, receipt counts, and margin analysis. ' +
      'Revenue data is not yet available (deferred to Invoicing Module).',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiQuery({ name: 'date_from', required: false, type: String, description: 'Filter entry_date >= this date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'date_to', required: false, type: String, description: 'Filter entry_date <= this date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Full project financial summary' })
  @ApiResponse({ status: 404, description: 'Project not found or does not belong to tenant' })
  async getFullSummary(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ProjectDateFilterDto,
  ) {
    return this.summaryService.getFullSummary(
      req.user.tenant_id,
      projectId,
      query,
    );
  }

  // ─── 2. Per-Task Cost Breakdown ──────────────────────────────────────

  @Get(':projectId/financial/tasks')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get per-task cost breakdown',
    description:
      'Returns cost breakdown at the task level. Includes expenses, subcontractor invoices, ' +
      'and crew hours per task. Tasks with zero financial activity are included with zero values.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiQuery({ name: 'date_from', required: false, type: String, description: 'Filter entry_date >= this date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'date_to', required: false, type: String, description: 'Filter entry_date <= this date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'sort_by', required: false, enum: ['total_cost', 'task_title'], description: 'Sort field (default: total_cost)' })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['asc', 'desc'], description: 'Sort direction (default: desc)' })
  @ApiResponse({ status: 200, description: 'Per-task cost breakdown' })
  @ApiResponse({ status: 404, description: 'Project not found or does not belong to tenant' })
  async getTaskBreakdown(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ProjectTaskBreakdownQueryDto,
  ) {
    return this.summaryService.getTaskBreakdown(
      req.user.tenant_id,
      projectId,
      query,
    );
  }

  // ─── 3. Monthly Cost Timeline ────────────────────────────────────────

  @Get(':projectId/financial/timeline')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get monthly cost timeline',
    description:
      'Returns expenses grouped by month with category breakdown. Months with zero expenses ' +
      'within the project date range are included for chart continuity.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiQuery({ name: 'date_from', required: false, type: String, description: 'Filter start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'date_to', required: false, type: String, description: 'Filter end date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Monthly cost timeline' })
  @ApiResponse({ status: 404, description: 'Project not found or does not belong to tenant' })
  async getTimeline(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ProjectDateFilterDto,
  ) {
    return this.summaryService.getTimeline(
      req.user.tenant_id,
      projectId,
      query,
    );
  }

  // ─── 4. Project Receipts ─────────────────────────────────────────────

  @Get(':projectId/financial/receipts')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Field')
  @ApiOperation({
    summary: 'Get all project receipts',
    description:
      'Returns paginated list of all receipts attached to this project or any of its tasks. ' +
      'Field workers (role: Field) can access this endpoint to see their uploaded receipts.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiQuery({ name: 'is_categorized', required: false, type: Boolean, description: 'Filter by categorization status' })
  @ApiQuery({ name: 'ocr_status', required: false, enum: ['not_processed', 'processing', 'complete', 'failed'], description: 'Filter by OCR status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Paginated receipt list' })
  @ApiResponse({ status: 404, description: 'Project not found or does not belong to tenant' })
  async getReceipts(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ProjectReceiptsQueryDto,
  ) {
    return this.summaryService.getReceipts(
      req.user.tenant_id,
      projectId,
      query,
    );
  }

  // ─── 5. Workforce Summary ───────────────────────────────────────────

  @Get(':projectId/financial/workforce')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get project workforce summary',
    description:
      'Returns consolidated workforce financial view: crew hours by member, crew payments by member, ' +
      'and subcontractor invoice/payment activity by subcontractor.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiQuery({ name: 'date_from', required: false, type: String, description: 'Filter start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'date_to', required: false, type: String, description: 'Filter end date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Workforce summary with crew and subcontractor details' })
  @ApiResponse({ status: 404, description: 'Project not found or does not belong to tenant' })
  async getWorkforceSummary(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ProjectDateFilterDto,
  ) {
    return this.summaryService.getWorkforceSummary(
      req.user.tenant_id,
      projectId,
      query,
    );
  }
}
```

**Key decisions:**
- **Base path:** `@Controller('projects')` — same as before, matching existing pattern
- **Endpoint paths:** `':projectId/financial/summary'`, `':projectId/financial/tasks'`, etc.
- **Old endpoint removed:** `':projectId/financial-summary'` is gone — replaced by `':projectId/financial/summary'`
- **Roles:** `'Owner', 'Admin', 'Manager', 'Bookkeeper'` for all endpoints EXCEPT receipts which also includes `'Field'`
- **Tenant ID:** Accessed via `req.user.tenant_id` (consistent with ALL existing financial controllers)
- **Constructor:** Injects `ProjectFinancialSummaryService` (NOT `FinancialEntryService` as before)

**Do NOT:**
- Keep the old endpoint — it is fully replaced
- Import `FinancialEntryService` in the controller — the controller no longer uses it
- Use `@TenantId()` decorator — use `@Request() req` + `req.user.tenant_id` to match existing financial module controllers
- Add any POST/PATCH/DELETE endpoints — this sprint is read-only
- **CRITICAL: Do NOT delete `getProjectCostSummary()` from `FinancialEntryService`** — `ProjectService` (in the projects module) still calls `this.financialEntryService.getProjectCostSummary()` at line ~652 of `project.service.ts`. Removing the method would break the project summary endpoint. The old method stays in `FinancialEntryService` as-is — only the controller stops calling it.

---

### Task 2 — Register `ProjectFinancialSummaryService` in `FinancialModule`

**What:** Add the new service to `/var/www/lead360.app/api/src/modules/financial/financial.module.ts`.

**Current file (73 lines):**
```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';

// Gate 1 (Sprint 06)
import { FinancialCategoryService } from './services/financial-category.service';
import { FinancialEntryService } from './services/financial-entry.service';
import { FinancialCategoryController } from './controllers/financial-category.controller';
import { FinancialEntryController } from './controllers/financial-entry.controller';
import { ProjectFinancialSummaryController } from './controllers/project-financial-summary.controller';

// Gate 2 (Sprint 11)
import { ReceiptService } from './services/receipt.service';
import { ReceiptController } from './controllers/receipt.controller';

// Gate 3 (Sprint 27) — Crew Payments, Hour Logs, Subcontractor Payments, Invoices
import { CrewPaymentService } from './services/crew-payment.service';
// ... more imports ...

@Module({
  imports: [PrismaModule, AuditModule, FilesModule],
  controllers: [
    // Gate 1
    FinancialCategoryController,
    FinancialEntryController,
    ProjectFinancialSummaryController,
    // Gate 2
    ReceiptController,
    // Gate 3
    // ... more controllers ...
  ],
  providers: [
    // Gate 1
    FinancialCategoryService,
    FinancialEntryService,
    // Gate 2
    ReceiptService,
    // Gate 3
    // ... more services ...
  ],
  exports: [
    // Gate 1
    FinancialCategoryService,
    FinancialEntryService,
    // ...
  ],
})
export class FinancialModule {}
```

**Changes needed:**

**Step 1:** Add import statement after the Gate 1 imports:
```typescript
import { ProjectFinancialSummaryService } from './services/project-financial-summary.service';
```

**Step 2:** Add to `providers` array (after `FinancialEntryService`):
```typescript
ProjectFinancialSummaryService,
```

**Step 3 (optional):** Add to `exports` array if other modules need it:
```typescript
ProjectFinancialSummaryService,
```
This is optional — currently no other module imports this service. But exporting it makes it available for future use (e.g., F-09 business dashboard).

**Do NOT:**
- Remove any existing imports, controllers, providers, or exports
- Reorder existing entries
- Change the module structure

---

### Task 3 — Verify All 5 Endpoints via curl

**What:** Start the dev server and test each endpoint responds correctly.

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Wait for health check: `curl -s http://localhost:8000/health`

**Get a valid JWT token** (login as tenant user):
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
```

**If python3 is not available, use node:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | \
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))")
```

**Get a valid project ID** (list projects first):
```bash
curl -s http://localhost:8000/projects \
  -H "Authorization: Bearer $TOKEN" | head -c 500
```

**Pick a project ID from the response and test all 5 endpoints:**

```bash
PROJECT_ID="<paste-a-valid-project-id-here>"

# 1. Full Summary
curl -s http://localhost:8000/projects/$PROJECT_ID/financial/summary \
  -H "Authorization: Bearer $TOKEN" | head -c 500

# 2. Task Breakdown
curl -s http://localhost:8000/projects/$PROJECT_ID/financial/tasks \
  -H "Authorization: Bearer $TOKEN" | head -c 500

# 3. Timeline
curl -s http://localhost:8000/projects/$PROJECT_ID/financial/timeline \
  -H "Authorization: Bearer $TOKEN" | head -c 500

# 4. Receipts
curl -s http://localhost:8000/projects/$PROJECT_ID/financial/receipts \
  -H "Authorization: Bearer $TOKEN" | head -c 500

# 5. Workforce
curl -s http://localhost:8000/projects/$PROJECT_ID/financial/workforce \
  -H "Authorization: Bearer $TOKEN" | head -c 500
```

**Expected results:**
- All 5 return HTTP 200 with JSON response bodies
- Each response matches the shape defined in the contract
- Invalid project ID returns 404
- Missing auth token returns 401

**Also verify Swagger:**
```bash
curl -s http://localhost:8000/api/docs-json | grep -c "financial/summary"
# Should return at least 1 (endpoint is documented in Swagger)
```

Or open in browser: `http://localhost:8000/api/docs` — look for "Project Financial Intelligence" tag with 5 endpoints.

---

### Task 4 — Test Tenant Isolation

**What:** Verify that a user from one tenant cannot access another tenant's project financial data.

```bash
# Get a project ID that belongs to the authenticated tenant
# Then use a DIFFERENT project ID (from another tenant, or a non-existent UUID)

FAKE_PROJECT_ID="00000000-0000-0000-0000-000000000000"

curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:8000/projects/$FAKE_PROJECT_ID/financial/summary \
  -H "Authorization: Bearer $TOKEN"
# Must return 404
```

---

### Task 5 — Shut Down Dev Server

```bash
lsof -i :8000
kill {PID}
lsof -i :8000   # Must return nothing
```

---

## Patterns Applied

**Controller Pattern (from existing financial module):**
```typescript
@ApiTags('[Tag Name]')
@ApiBearerAuth()
@Controller('[base-path]')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SomeController {
  constructor(private readonly service: SomeService) {}

  @Get('[path]')
  @Roles('Owner', 'Admin', ...)
  @ApiOperation({ summary: '...' })
  @ApiParam({ name: '...', description: '...' })
  @ApiResponse({ status: 200, description: '...' })
  async methodName(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.method(req.user.tenant_id, id);
  }
}
```

**RBAC Roles (from existing codebase):**
- `'Owner'` — business owner
- `'Admin'` — administrator
- `'Manager'` — project manager
- `'Bookkeeper'` — financial role
- `'Field'` — field worker (only for receipts endpoint)

---

## Acceptance Criteria

- [ ] Controller file completely rewritten with 5 new endpoints
- [ ] Old endpoint `GET :projectId/financial-summary` removed
- [ ] New endpoints: `financial/summary`, `financial/tasks`, `financial/timeline`, `financial/receipts`, `financial/workforce`
- [ ] `ProjectFinancialSummaryService` injected (not `FinancialEntryService`)
- [ ] `ProjectFinancialSummaryService` registered in `FinancialModule` providers
- [ ] Roles: `Owner, Admin, Manager, Bookkeeper` on summary/tasks/timeline/workforce
- [ ] Roles: `Owner, Admin, Manager, Bookkeeper, Field` on receipts only
- [ ] All endpoints have `@ApiOperation`, `@ApiParam`, `@ApiQuery`, `@ApiResponse` decorators
- [ ] All endpoints validate projectId with `ParseUUIDPipe`
- [ ] All 5 endpoints return 200 with valid data when tested via curl
- [ ] Invalid/cross-tenant projectId returns 404
- [ ] Missing auth returns 401
- [ ] Swagger shows all 5 endpoints under "Project Financial Intelligence" tag
- [ ] Application compiles without errors
- [ ] Dev server shut down

---

## Gate Marker

**STOP** — All 5 endpoints must be accessible and return correct responses:
1. `GET /projects/:projectId/financial/summary` → 200
2. `GET /projects/:projectId/financial/tasks` → 200
3. `GET /projects/:projectId/financial/timeline` → 200
4. `GET /projects/:projectId/financial/receipts` → 200
5. `GET /projects/:projectId/financial/workforce` → 200
6. Invalid project → 404
7. Swagger documentation visible

---

## Handoff Notes

**For Sprint 7_6 (Unit Tests):**
- All 5 endpoints are live and testable
- The service methods to mock: `getFullSummary`, `getTaskBreakdown`, `getTimeline`, `getReceipts`, `getWorkforceSummary`
- The private method `validateProjectAccess` needs unit testing for tenant isolation
- Margin calculation edge cases: null contract_value, zero contract_value, null estimated_cost
- Date filters need testing on financial entry queries
