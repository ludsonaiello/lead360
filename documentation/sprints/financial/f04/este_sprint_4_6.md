# Sprint 4_6 — Controller + Module Registration + Swagger Documentation

**Module:** Financial
**File:** ./documentation/sprints/financial/f04/sprint_4_6.md
**Type:** Backend — Controller Layer
**Depends On:** Sprint 4_5 (all service methods complete)
**Gate:** STOP — All endpoints respond correctly, Swagger docs accessible, routing order verified
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

Rebuild the `FinancialEntryController` to expose all F-04 endpoints with proper RBAC decorators, Swagger documentation, and critical route ordering. Also update the `FinancialModule` if any new services or imports are needed.

> ⚠️ **THIS IS THE FIRST FULL COMPILATION CHECKPOINT.** Sprints 4_2 through 4_5 changed DTOs and service method signatures without updating the controller. The dev server has NOT been compilable since Sprint 4_2. This sprint wires everything together and the dev server must compile and start successfully.

**CRITICAL ROUTING RULE:** The routes `GET /financial/entries/pending` and `GET /financial/entries/export` MUST be declared BEFORE `GET /financial/entries/:id` in the controller. NestJS route matching is order-dependent — parameterized routes capture static paths if registered first. This is a known NestJS trap and the #1 risk in this sprint.

---

## Pre-Sprint Checklist

- [ ] Read the current `financial-entry.controller.ts`: `/var/www/lead360.app/api/src/modules/financial/controllers/financial-entry.controller.ts`
- [ ] Read the current `financial.module.ts`: `/var/www/lead360.app/api/src/modules/financial/financial.module.ts`
- [ ] Read the `financial-entry.service.ts` to verify all method signatures match what the controller will call
- [ ] Read all DTOs created in Sprint 4_2
- [ ] Read the auth decorators and guards:
  - `/var/www/lead360.app/api/src/modules/auth/decorators/roles.decorator.ts`
  - `/var/www/lead360.app/api/src/modules/auth/guards/jwt-auth.guard.ts`
  - `/var/www/lead360.app/api/src/modules/auth/guards/roles.guard.ts`

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

### Task 1 — Rebuild `FinancialEntryController`

**File:** `/var/www/lead360.app/api/src/modules/financial/controllers/financial-entry.controller.ts`

**What:** Replace the ENTIRE file with the new controller. The route registration ORDER matters — static routes MUST come before parameterized routes.

**EXACT structure (routes in correct order):**

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
  Res,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { FinancialEntryService } from '../services/financial-entry.service';
import { CreateFinancialEntryDto } from '../dto/create-financial-entry.dto';
import { UpdateFinancialEntryDto } from '../dto/update-financial-entry.dto';
import { ListFinancialEntriesQueryDto } from '../dto/list-financial-entries-query.dto';
import { ListPendingEntriesQueryDto } from '../dto/list-pending-entries-query.dto';
import { ApproveEntryDto } from '../dto/approve-entry.dto';
import { RejectEntryDto } from '../dto/reject-entry.dto';
import { ResubmitEntryDto } from '../dto/resubmit-entry.dto';

@ApiTags('Financial Entries')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialEntryController {
  constructor(
    private readonly financialEntryService: FinancialEntryService,
  ) {}
```

**ROUTE ORDER (critical — do NOT rearrange):**

```
1. POST   /financial/entries                    — Create entry
2. GET    /financial/entries                     — List entries (paginated, filtered)
3. GET    /financial/entries/pending             — List pending entries (BEFORE :id!)
4. GET    /financial/entries/export              — Export CSV (BEFORE :id!)
5. GET    /financial/entries/:id                 — Get single entry
6. PATCH  /financial/entries/:id                 — Update entry
7. DELETE /financial/entries/:id                 — Delete entry
8. POST   /financial/entries/:id/approve         — Approve pending entry
9. POST   /financial/entries/:id/reject          — Reject pending entry
10. POST  /financial/entries/:id/resubmit        — Resubmit rejected entry
```

---

### Task 2 — Route 1: `POST /financial/entries` (Create)

```typescript
  @Post('entries')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Create a financial entry' })
  @ApiResponse({ status: 201, description: 'Entry created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Referenced entity not found' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateFinancialEntryDto) {
    return this.financialEntryService.createEntry(
      req.user.tenant_id,
      req.user.id,
      req.user.roles,
      dto,
    );
  }
```

**Key:** Employee is now allowed to create entries (their submission_status is forced to `pending_review` by the service).

---

### Task 3 — Route 2: `GET /financial/entries` (List)

```typescript
  @Get('entries')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'List financial entries (paginated, filtered)' })
  @ApiResponse({ status: 200, description: 'Paginated list with summary' })
  async findAll(@Request() req, @Query() query: ListFinancialEntriesQueryDto) {
    return this.financialEntryService.getEntries(
      req.user.tenant_id,
      req.user.id,
      req.user.roles,
      query,
    );
  }
```

**Key:** Employee is allowed — the service silently filters to their own entries.

---

### Task 4 — Route 3: `GET /financial/entries/pending` (Pending List)

**CRITICAL: This route MUST appear BEFORE `GET /financial/entries/:id` in the file.**

```typescript
  @Get('entries/pending')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List pending review entries' })
  @ApiResponse({ status: 200, description: 'Paginated list of pending entries' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findPending(@Request() req, @Query() query: ListPendingEntriesQueryDto) {
    return this.financialEntryService.getPendingEntries(
      req.user.tenant_id,
      query,
    );
  }
```

**Key:** Employee CANNOT access this endpoint (not in `@Roles`). The guard returns 403.

---

### Task 5 — Route 4: `GET /financial/entries/export` (CSV Export)

**CRITICAL: This route MUST appear BEFORE `GET /financial/entries/:id` in the file.**

```typescript
  @Get('entries/export')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export financial entries as CSV' })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Export limit exceeded' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async exportCsv(
    @Request() req,
    @Query() query: ListFinancialEntriesQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.financialEntryService.exportEntries(
      req.user.tenant_id,
      req.user.id,
      req.user.roles,
      query,
    );

    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses-${today}.csv"`);
    res.send(csv);
  }
```

**Key:** Only Owner, Admin, Bookkeeper can export. Manager and Employee cannot.

---

### Task 6 — Route 5: `GET /financial/entries/:id` (Get Single)

```typescript
  @Get('entries/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Get a single financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry details (enriched)' })
  @ApiResponse({ status: 403, description: 'Access denied (Employee accessing other user entry)' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financialEntryService.getEntryById(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.roles,
    );
  }
```

---

### Task 7 — Route 6: `PATCH /financial/entries/:id` (Update)

```typescript
  @Patch('entries/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Update a financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry updated (enriched)' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialEntryDto,
  ) {
    return this.financialEntryService.updateEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.roles,
      dto,
    );
  }
```

---

### Task 8 — Route 7: `DELETE /financial/entries/:id` (Delete)

```typescript
  @Delete('entries/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Delete a financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry deleted' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financialEntryService.deleteEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.roles,
    );
  }
```

**Note:** All roles are in `@Roles` because the service handles the fine-grained role logic (Manager/Bookkeeper get 403 from the service, not the guard).

---

### Task 9 — Route 8: `POST /financial/entries/:id/approve` (Approve)

```typescript
  @Post('entries/:id/approve')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Approve a pending financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry approved (enriched)' })
  @ApiResponse({ status: 400, description: 'Entry is not in pending status' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  @HttpCode(HttpStatus.OK)
  async approve(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveEntryDto,
  ) {
    return this.financialEntryService.approveEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }
```

---

### Task 10 — Route 9: `POST /financial/entries/:id/reject` (Reject)

```typescript
  @Post('entries/:id/reject')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Reject a pending financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry rejected (enriched)' })
  @ApiResponse({ status: 400, description: 'Entry is not in pending status or reason missing' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  @HttpCode(HttpStatus.OK)
  async reject(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectEntryDto,
  ) {
    return this.financialEntryService.rejectEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }
```

---

### Task 11 — Route 10: `POST /financial/entries/:id/resubmit` (Resubmit)

```typescript
  @Post('entries/:id/resubmit')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Resubmit a rejected financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry resubmitted (enriched)' })
  @ApiResponse({ status: 400, description: 'Entry was not rejected' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  @HttpCode(HttpStatus.OK)
  async resubmit(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResubmitEntryDto,
  ) {
    return this.financialEntryService.resubmitEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.roles,
      dto,
    );
  }
```

---

### Task 12 — Update Module Registration (if needed)

**What:** Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` and verify:
1. `FinancialEntryController` is still registered in `controllers` array
2. `FinancialEntryService` is still registered in `providers` and `exports` arrays
3. If `SupplierService` was injected in Sprint 4_4 and is NOT already in the module, add it

**Do NOT:** Add controllers or services that don't exist. Only modify the module if Sprint 4_4 introduced new dependencies.

---

### Task 13 — Start Server and Test Routes

**What:** Start the dev server and verify:

1. Server compiles without errors
2. Health check returns 200
3. Verify route registration by hitting each endpoint (expect 401 without auth, but route should be recognized):

```bash
# These should return 401 (not 404) — proving the route exists
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/entries
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/entries/pending
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/entries/export
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/entries/00000000-0000-0000-0000-000000000001
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/financial/entries/00000000-0000-0000-0000-000000000001/approve
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/financial/entries/00000000-0000-0000-0000-000000000001/reject
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/financial/entries/00000000-0000-0000-0000-000000000001/resubmit
```

**Expected:** All return 401 (Unauthorized), NOT 404. If any return 404, the route is not registered correctly.

4. Verify Swagger documentation is accessible:
```bash
curl -s http://localhost:8000/api/docs-json | python3 -c "import sys,json; d=json.load(sys.stdin); print([p for p in d.get('paths',{}) if 'entries' in p])"
```

---

### Task 14 — Verify Route Ordering

**What:** Specifically test that `GET /financial/entries/pending` and `GET /financial/entries/export` are NOT captured by `GET /financial/entries/:id`:

```bash
# This must NOT return "Invalid UUID" or parse "pending" as a UUID
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/entries/pending
# Expected: 401 (not 400 or 422)

curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/entries/export
# Expected: 401 (not 400 or 422)
```

If you get a 400 with "Validation failed (uuid is expected)" — the route ordering is WRONG. The `:id` route is capturing `pending`/`export` as UUID params.

---

## RBAC Summary (Controller Level)

| Route | Owner | Admin | Manager | Bookkeeper | Employee |
|-------|-------|-------|---------|------------|----------|
| POST entries | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET entries | ✓ | ✓ | ✓ | ✓ | ✓ (own only) |
| GET entries/pending | ✓ | ✓ | ✓ | ✓ | ✗ (403) |
| GET entries/export | ✓ | ✓ | ✗ (403) | ✓ | ✗ (403) |
| GET entries/:id | ✓ | ✓ | ✓ | ✓ | ✓ (own only) |
| PATCH entries/:id | ✓ | ✓ | ✓ | ✓ | ✓ (own pending only) |
| DELETE entries/:id | ✓ | ✓ | ✓* | ✓* | ✓ (own pending only) |
| POST entries/:id/approve | ✓ | ✓ | ✓ | ✓ | ✗ (403) |
| POST entries/:id/reject | ✓ | ✓ | ✓ | ✓ | ✗ (403) |
| POST entries/:id/resubmit | ✓ | ✓ | ✓ | ✓ | ✓ (own only) |

*Note: DELETE for Manager/Bookkeeper is allowed at guard level but blocked in service (returns 403 from service).

---

## Acceptance Criteria

- [ ] All 10 routes are registered and respond (401, not 404)
- [ ] `GET /financial/entries/pending` resolves correctly (not captured by `:id`)
- [ ] `GET /financial/entries/export` resolves correctly (not captured by `:id`)
- [ ] `POST /financial/entries` allows Employee role
- [ ] `GET /financial/entries/pending` blocks Employee role
- [ ] `GET /financial/entries/export` blocks Employee and Manager roles
- [ ] Approve/reject endpoints block Employee role
- [ ] Resubmit endpoint allows Employee role
- [ ] Export endpoint sets `Content-Type: text/csv` and `Content-Disposition` header
- [ ] All endpoints pass `req.user.roles` to service methods where required
- [ ] All endpoints have Swagger decorators (`@ApiOperation`, `@ApiResponse`, `@ApiParam`)
- [ ] Swagger docs accessible at `/api/docs`
- [ ] Module imports and providers are correct
- [ ] Dev server compiles without errors
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — All endpoints must respond (401 without auth proves route exists). Route ordering must be verified. Swagger must show all endpoints. This is the last sprint before tests — the API surface is now complete.

---

## Handoff Notes

The full F-04 API is now wired:

| Method | Path | Roles |
|--------|------|-------|
| POST | `/financial/entries` | All |
| GET | `/financial/entries` | All |
| GET | `/financial/entries/pending` | Owner, Admin, Manager, Bookkeeper |
| GET | `/financial/entries/export` | Owner, Admin, Bookkeeper |
| GET | `/financial/entries/:id` | All |
| PATCH | `/financial/entries/:id` | All (service enforces) |
| DELETE | `/financial/entries/:id` | All (service enforces) |
| POST | `/financial/entries/:id/approve` | Owner, Admin, Manager, Bookkeeper |
| POST | `/financial/entries/:id/reject` | Owner, Admin, Manager, Bookkeeper |
| POST | `/financial/entries/:id/resubmit` | All |

Sprint 4_7 writes unit tests. Sprint 4_8 writes API documentation.
