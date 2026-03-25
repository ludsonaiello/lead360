# Sprint 6_5 — Controller + Swagger: All 11 Endpoints

**Module:** Financial
**File:** ./documentation/sprints/financial/f06/sprint_6_5.md
**Type:** Backend — Controller
**Depends On:** Sprint 6_3 (CRUD service methods), Sprint 6_4 (lifecycle service methods)
**Gate:** STOP — All 11 endpoints must be registered. Swagger must show all endpoints. `npm run build` must pass.
**Estimated Complexity:** High

---

> **You are a masterclass-level backend engineer.** Your code quality makes engineers at Google, Amazon, and Apple jealous. Every line you write is precise, intentional, and production-grade.

> **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> **MySQL credentials** are in the `.env` file at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.

---

## Objective

Create the `RecurringExpenseController` with all 11 endpoints, Swagger documentation, JWT authentication guards, RBAC role guards, and proper route ordering. Register the controller and service in `financial.module.ts`.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/financial-entry.controller.ts` — understand the controller pattern (decorators, guards, param extraction)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` — understand current module registration
- [ ] Verify all DTOs compile (Sprint 6_2 gate)
- [ ] Verify service compiles (Sprint 6_4 gate)
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/decorators/tenant-id.decorator.ts` — confirm `@TenantId()` import path
- [ ] Read `/var/www/lead360.app/api/src/modules/rbac/` — confirm `@Roles()` decorator and `RolesGuard` import paths
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/guards/` — confirm `JwtAuthGuard` import path

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

### Task 1 — Create `RecurringExpenseController`

**File:** `/var/www/lead360.app/api/src/modules/financial/controllers/recurring-expense.controller.ts`

**Imports (verify exact paths by reading the codebase):**
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { RecurringExpenseService } from '../services/recurring-expense.service';
import { CreateRecurringRuleDto } from '../dto/create-recurring-rule.dto';
import { UpdateRecurringRuleDto } from '../dto/update-recurring-rule.dto';
import { ListRecurringRulesDto } from '../dto/list-recurring-rules.dto';
import { SkipRecurringRuleDto } from '../dto/skip-recurring-rule.dto';
import { RecurringRuleHistoryDto } from '../dto/recurring-rule-history.dto';
import { PreviewRecurringRulesDto } from '../dto/preview-recurring-rules.dto';
```

**CRITICAL: Verify these import paths match the real codebase.** Read the actual files to confirm:
- `JwtAuthGuard` path — check `auth/guards/` directory
- `RolesGuard` path — check `rbac/guards/` directory
- `Roles` decorator path — check `rbac/decorators/` directory

The endpoint methods use `@Request() req` to extract `req.user.tenantId` and `req.user.userId` — this matches the pattern in the existing `financial-entry.controller.ts`. Read that controller to verify.

**Looking at the existing `financial-entry.controller.ts` pattern:**
```typescript
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialEntryController {
  @Post('entries')
  @Roles('Owner', 'Admin', 'Manager')
  async create(@Request() req, @Body() dto) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    // ...
  }
}
```

If the existing controller uses `@Request() req` and `req.user.tenantId` / `req.user.userId`, use the same pattern. If it uses `@TenantId()` and `@CurrentUser()`, use those decorators.

---

**Controller class:**

```typescript
@ApiTags('Recurring Expense Rules')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecurringExpenseController {
  constructor(private readonly recurringExpenseService: RecurringExpenseService) {}
```

---

**ROUTE ORDERING IS CRITICAL:** `GET /financial/recurring-rules/preview` MUST be registered BEFORE `GET /financial/recurring-rules/:id`. NestJS matches routes top-down — if `:id` comes first, `preview` will be treated as an ID parameter.

**Endpoint order in the controller class (top to bottom):**

1. `GET /financial/recurring-rules/preview` ← MUST BE FIRST among GET with path params
2. `GET /financial/recurring-rules`
3. `POST /financial/recurring-rules`
4. `GET /financial/recurring-rules/:id`
5. `PATCH /financial/recurring-rules/:id`
6. `DELETE /financial/recurring-rules/:id`
7. `POST /financial/recurring-rules/:id/pause`
8. `POST /financial/recurring-rules/:id/resume`
9. `POST /financial/recurring-rules/:id/trigger`
10. `POST /financial/recurring-rules/:id/skip`
11. `GET /financial/recurring-rules/:id/history`

---

**Endpoint implementations:**

#### 1. `GET /financial/recurring-rules/preview`

```typescript
@Get('recurring-rules/preview')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@ApiOperation({ summary: 'Preview upcoming expense obligations' })
@ApiResponse({ status: 200, description: 'Upcoming obligations preview' })
async getPreview(
  @Request() req,
  @Query() query: PreviewRecurringRulesDto,
) {
  return this.recurringExpenseService.getPreview(req.user.tenantId, query.days);
}
```

#### 2. `GET /financial/recurring-rules`

```typescript
@Get('recurring-rules')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@ApiOperation({ summary: 'List all recurring expense rules' })
@ApiResponse({ status: 200, description: 'Paginated list of rules with monthly obligation summary' })
async findAll(
  @Request() req,
  @Query() query: ListRecurringRulesDto,
) {
  return this.recurringExpenseService.findAll(req.user.tenantId, query);
}
```

#### 3. `POST /financial/recurring-rules`

```typescript
@Post('recurring-rules')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Create a new recurring expense rule' })
@ApiResponse({ status: 201, description: 'Rule created successfully' })
@ApiResponse({ status: 400, description: 'Validation error' })
async create(
  @Request() req,
  @Body() dto: CreateRecurringRuleDto,
) {
  return this.recurringExpenseService.create(req.user.tenantId, req.user.userId, dto);
}
```

#### 4. `GET /financial/recurring-rules/:id`

```typescript
@Get('recurring-rules/:id')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@ApiOperation({ summary: 'Get a single recurring expense rule with preview' })
@ApiParam({ name: 'id', description: 'Rule UUID' })
@ApiResponse({ status: 200, description: 'Rule details with last entry and next 3 dates' })
@ApiResponse({ status: 404, description: 'Rule not found' })
async findOne(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.recurringExpenseService.findOne(req.user.tenantId, id);
}
```

#### 5. `PATCH /financial/recurring-rules/:id`

```typescript
@Patch('recurring-rules/:id')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@ApiOperation({ summary: 'Update a recurring expense rule' })
@ApiParam({ name: 'id', description: 'Rule UUID' })
@ApiResponse({ status: 200, description: 'Rule updated successfully' })
@ApiResponse({ status: 400, description: 'Validation error or rule is cancelled/completed' })
@ApiResponse({ status: 404, description: 'Rule not found' })
async update(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdateRecurringRuleDto,
) {
  return this.recurringExpenseService.update(req.user.tenantId, id, req.user.userId, dto);
}
```

#### 6. `DELETE /financial/recurring-rules/:id`

```typescript
@Delete('recurring-rules/:id')
@Roles('Owner', 'Admin')
@ApiOperation({ summary: 'Cancel a recurring expense rule (soft delete)' })
@ApiParam({ name: 'id', description: 'Rule UUID' })
@ApiResponse({ status: 200, description: 'Rule cancelled successfully' })
@ApiResponse({ status: 404, description: 'Rule not found' })
async cancel(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.recurringExpenseService.cancel(req.user.tenantId, id, req.user.userId);
}
```

#### 7. `POST /financial/recurring-rules/:id/pause`

```typescript
@Post('recurring-rules/:id/pause')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Pause a recurring expense rule' })
@ApiParam({ name: 'id', description: 'Rule UUID' })
@ApiResponse({ status: 200, description: 'Rule paused successfully' })
@ApiResponse({ status: 400, description: 'Rule is not active' })
async pause(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.recurringExpenseService.pause(req.user.tenantId, id, req.user.userId);
}
```

#### 8. `POST /financial/recurring-rules/:id/resume`

```typescript
@Post('recurring-rules/:id/resume')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Resume a paused recurring expense rule' })
@ApiParam({ name: 'id', description: 'Rule UUID' })
@ApiResponse({ status: 200, description: 'Rule resumed successfully' })
@ApiResponse({ status: 400, description: 'Rule is not paused' })
async resume(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.recurringExpenseService.resume(req.user.tenantId, id, req.user.userId);
}
```

#### 9. `POST /financial/recurring-rules/:id/trigger`

```typescript
@Post('recurring-rules/:id/trigger')
@Roles('Owner', 'Admin')
@HttpCode(HttpStatus.ACCEPTED)
@ApiOperation({ summary: 'Manually trigger entry generation for a rule' })
@ApiParam({ name: 'id', description: 'Rule UUID' })
@ApiResponse({ status: 202, description: 'Entry generation triggered' })
@ApiResponse({ status: 400, description: 'Rule is cancelled or completed' })
async trigger(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.recurringExpenseService.triggerNow(req.user.tenantId, id, req.user.userId);
}
```

#### 10. `POST /financial/recurring-rules/:id/skip`

```typescript
@Post('recurring-rules/:id/skip')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Skip the next occurrence of a rule' })
@ApiParam({ name: 'id', description: 'Rule UUID' })
@ApiResponse({ status: 200, description: 'Occurrence skipped, next_due_date advanced' })
@ApiResponse({ status: 400, description: 'Rule is not active' })
async skip(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: SkipRecurringRuleDto,
) {
  return this.recurringExpenseService.skipNext(req.user.tenantId, id, req.user.userId, dto);
}
```

#### 11. `GET /financial/recurring-rules/:id/history`

```typescript
@Get('recurring-rules/:id/history')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@ApiOperation({ summary: 'List entries generated by this rule' })
@ApiParam({ name: 'id', description: 'Rule UUID' })
@ApiResponse({ status: 200, description: 'Paginated entry history' })
@ApiResponse({ status: 404, description: 'Rule not found' })
async getHistory(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
  @Query() query: RecurringRuleHistoryDto,
) {
  return this.recurringExpenseService.getHistory(req.user.tenantId, id, query);
}
```

---

### Task 2 — Register Controller and Service in `financial.module.ts`

**File:** `/var/www/lead360.app/api/src/modules/financial/financial.module.ts`

**Changes:**

1. Add imports at the top:
   ```typescript
   import { RecurringExpenseController } from './controllers/recurring-expense.controller';
   import { RecurringExpenseService } from './services/recurring-expense.service';
   ```

2. Add `RecurringExpenseController` to the `controllers` array.

3. Add `RecurringExpenseService` to the `providers` array.

4. Add `RecurringExpenseService` to the `exports` array (the processor in the Jobs module needs to inject it).

**Do NOT:**
- Remove any existing controllers, providers, or exports
- Change any existing imports
- Modify the module structure beyond adding the new entries

---

### Task 3 — Verify Swagger Documentation

**What:** Start the dev server and verify all 11 endpoints appear in Swagger UI.

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

After health check passes, open in browser or curl:
```bash
curl -s http://localhost:8000/api/docs-json | python3 -m json.tool | grep "recurring-rules"
```

**Expected:** All 11 endpoint paths should appear:
1. `GET /financial/recurring-rules/preview`
2. `GET /financial/recurring-rules`
3. `POST /financial/recurring-rules`
4. `GET /financial/recurring-rules/{id}`
5. `PATCH /financial/recurring-rules/{id}`
6. `DELETE /financial/recurring-rules/{id}`
7. `POST /financial/recurring-rules/{id}/pause`
8. `POST /financial/recurring-rules/{id}/resume`
9. `POST /financial/recurring-rules/{id}/trigger`
10. `POST /financial/recurring-rules/{id}/skip`
11. `GET /financial/recurring-rules/{id}/history`

All should appear under the `Recurring Expense Rules` tag.

---

### Task 4 — Test Route Ordering

**What:** Verify the preview endpoint doesn't collide with the :id endpoint.

```bash
# This should return a validation error (days is required), NOT a 404 or UUID parse error
curl -s -H "Authorization: Bearer <token>" http://localhost:8000/financial/recurring-rules/preview

# The UUID endpoint should still work
curl -s -H "Authorization: Bearer <token>" http://localhost:8000/financial/recurring-rules/some-uuid-here
```

If `preview` returns a UUID parse error, the route ordering is wrong — move the `getPreview` method ABOVE `findOne` in the controller class.

---

## Patterns Applied

**Controller pattern (from existing `financial-entry.controller.ts`):**
```typescript
@ApiTags('Tag Name')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SomeController {
  constructor(private readonly someService: SomeService) {}

  @Get('path')
  @Roles('Owner', 'Admin', 'Manager')
  async method(@Request() req, @Query() query: SomeDto) {
    return this.someService.method(req.user.tenantId, query);
  }
}
```

**Tenant ID extraction:** All endpoint methods use `@Request() req` and access `req.user.tenantId` / `req.user.userId` — matching the existing `financial-entry.controller.ts` pattern.

---

## Endpoint Summary Table

| # | Method | Path | Roles | HTTP Status |
|---|--------|------|-------|-------------|
| 1 | GET | `/financial/recurring-rules/preview` | Owner, Admin, Manager, Bookkeeper | 200 |
| 2 | GET | `/financial/recurring-rules` | Owner, Admin, Manager, Bookkeeper | 200 |
| 3 | POST | `/financial/recurring-rules` | Owner, Admin, Manager, Bookkeeper | 201 |
| 4 | GET | `/financial/recurring-rules/:id` | Owner, Admin, Manager, Bookkeeper | 200 |
| 5 | PATCH | `/financial/recurring-rules/:id` | Owner, Admin, Manager, Bookkeeper | 200 |
| 6 | DELETE | `/financial/recurring-rules/:id` | Owner, Admin | 200 |
| 7 | POST | `/financial/recurring-rules/:id/pause` | Owner, Admin, Manager, Bookkeeper | 200 |
| 8 | POST | `/financial/recurring-rules/:id/resume` | Owner, Admin, Manager, Bookkeeper | 200 |
| 9 | POST | `/financial/recurring-rules/:id/trigger` | Owner, Admin | 202 |
| 10 | POST | `/financial/recurring-rules/:id/skip` | Owner, Admin, Manager, Bookkeeper | 200 |
| 11 | GET | `/financial/recurring-rules/:id/history` | Owner, Admin, Manager, Bookkeeper | 200 |

---

## Acceptance Criteria

- [ ] `RecurringExpenseController` created at correct path
- [ ] All 11 endpoints implemented (matching the API spec)
- [ ] Route ordering: `preview` registered BEFORE `:id`
- [ ] All endpoints use `@UseGuards(JwtAuthGuard, RolesGuard)` (class-level)
- [ ] All endpoints use correct `@Roles()` per spec
- [ ] All endpoints extract `tenantId` and `userId` from JWT (same pattern as existing controllers)
- [ ] `DELETE` returns 200 (soft cancel, returns updated rule)
- [ ] `POST trigger` returns 202 Accepted
- [ ] `POST create` returns 201 Created
- [ ] All endpoints have `@ApiOperation()` Swagger summary
- [ ] All endpoints have `@ApiResponse()` for success and error cases
- [ ] `ParseUUIDPipe` used for all `:id` params
- [ ] Controller registered in `financial.module.ts` controllers array
- [ ] `RecurringExpenseService` registered in providers and exports arrays
- [ ] Swagger UI shows all endpoints under "Recurring Expense Rules" tag
- [ ] No existing controllers or services removed
- [ ] Dev server compiles without errors
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — All 11 endpoints must be visible in Swagger. The dev server must compile without errors. Route ordering must be verified (preview doesn't collide with :id). Run `npm run build` to confirm. Do NOT proceed to Sprint 6_6 until confirmed.

---

## Handoff Notes

- Controller: `/var/www/lead360.app/api/src/modules/financial/controllers/recurring-expense.controller.ts`
- Registered in: `/var/www/lead360.app/api/src/modules/financial/financial.module.ts`
- Service exported from financial module (available for injection by jobs module processor)
- All endpoints are JWT-protected and role-gated
- Sprint 6_6 will create the BullMQ scheduler, processor, and register the queue
