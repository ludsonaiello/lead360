# Sprint 8_5 — Draw Milestone Controller

**Module:** Financial
**File:** `./documentation/sprints/financial/f08/sprint_8_5.md`
**Type:** Backend — Controller
**Depends On:** Sprint 8_3 (DrawMilestoneService)
**Gate:** NONE — sprint 8_6 can proceed independently
**Estimated Complexity:** Medium

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

---

## Objective

Create the `DrawMilestoneController` — the REST controller that exposes 5 endpoints for managing project draw milestones. Each endpoint delegates to `DrawMilestoneService`. The controller handles authentication, RBAC, parameter parsing, and Swagger documentation.

---

## Pre-Sprint Checklist

- [ ] Sprint 8_3 GATE passed: DrawMilestoneService compiles with all 6 methods
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/subcontractor-invoice.controller.ts` — understand the existing controller pattern (Swagger decorators, guards, param parsing)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/project-financial-summary.controller.ts` — understand the `projects/:projectId` routing pattern already used in this module
- [ ] Confirm all DTOs from Sprint 8_2 exist

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

### Task 1 — Create `DrawMilestoneController`

**File:** `api/src/modules/financial/controllers/draw-milestone.controller.ts`

**Full implementation:**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { DrawMilestoneService } from '../services/draw-milestone.service';
import { CreateDrawMilestoneDto } from '../dto/create-draw-milestone.dto';
import { UpdateDrawMilestoneDto } from '../dto/update-draw-milestone.dto';
import { GenerateMilestoneInvoiceDto } from '../dto/generate-milestone-invoice.dto';

@ApiTags('Project Draw Milestones')
@ApiBearerAuth()
@Controller('projects/:projectId/milestones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DrawMilestoneController {
  constructor(private readonly drawMilestoneService: DrawMilestoneService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // GET /projects/:projectId/milestones
  // ───────────────────────────────────────────────────────────────────────────

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List milestones for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'List of draw milestones ordered by draw_number' })
  async findByProject(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.drawMilestoneService.findByProject(
      req.user.tenant_id,
      projectId,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/milestones
  // ───────────────────────────────────────────────────────────────────────────

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a milestone manually' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiBody({ type: CreateDrawMilestoneDto })
  @ApiResponse({ status: 201, description: 'Milestone created' })
  @ApiResponse({ status: 409, description: 'Draw number already exists for this project' })
  @ApiResponse({ status: 400, description: 'Percentage value exceeds 100' })
  async create(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateDrawMilestoneDto,
  ) {
    return this.drawMilestoneService.create(
      req.user.tenant_id,
      projectId,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /projects/:projectId/milestones/:id
  // ───────────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update a milestone' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Milestone UUID' })
  @ApiBody({ type: UpdateDrawMilestoneDto })
  @ApiResponse({ status: 200, description: 'Milestone updated' })
  @ApiResponse({ status: 400, description: 'Cannot modify calculated_amount on invoiced milestone' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async update(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDrawMilestoneDto,
  ) {
    return this.drawMilestoneService.update(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /projects/:projectId/milestones/:id
  // ───────────────────────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a pending milestone' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Milestone UUID' })
  @ApiResponse({ status: 204, description: 'Milestone deleted' })
  @ApiResponse({ status: 400, description: 'Milestone is not in pending status' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async delete(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.drawMilestoneService.delete(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/milestones/:id/invoice
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/invoice')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate invoice from milestone' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Milestone UUID' })
  @ApiBody({ type: GenerateMilestoneInvoiceDto })
  @ApiResponse({ status: 201, description: 'Invoice generated from milestone' })
  @ApiResponse({ status: 400, description: 'Milestone already invoiced' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async generateInvoice(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateMilestoneInvoiceDto,
  ) {
    return this.drawMilestoneService.generateInvoice(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }
}
```

**Key implementation details:**
- Controller path is `projects/:projectId/milestones` — this nests under the projects path
- Uses `@Request() req` to extract `req.user.tenant_id` and `req.user.id` — NEVER from request body
- Uses `ParseUUIDPipe` on all UUID path parameters
- DELETE returns 204 (No Content) — `@HttpCode(HttpStatus.NO_CONTENT)`
- POST endpoints return 201 — `@HttpCode(HttpStatus.CREATED)`
- All endpoints have Swagger decorators for automatic documentation

---

## Patterns Applied

### Controller authentication pattern (from existing codebase)
```typescript
// All controllers use this pattern:
@Controller('some-path')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SomeController {

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  async someMethod(@Request() req) {
    // req.user.tenant_id — tenant isolation
    // req.user.id — actor user ID
  }
}

// Import paths:
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
```

### Swagger documentation pattern
```typescript
// Every endpoint gets:
@ApiTags('Category Name')           // Groups in Swagger UI
@ApiBearerAuth()                    // Shows lock icon in Swagger
@ApiOperation({ summary: '...' })  // Endpoint description
@ApiParam({ name: '...', ... })    // Path param docs
@ApiBody({ type: DtoClass })       // Request body schema
@ApiResponse({ status: N, ... })   // Response docs
```

---

## Acceptance Criteria

- [ ] `draw-milestone.controller.ts` created at `api/src/modules/financial/controllers/draw-milestone.controller.ts`
- [ ] 5 endpoints defined: GET list, POST create, PATCH update, DELETE, POST invoice
- [ ] All endpoints use `JwtAuthGuard` + `RolesGuard`
- [ ] GET list: Roles `Owner, Admin, Manager, Bookkeeper`
- [ ] POST create: Roles `Owner, Admin, Manager`
- [ ] PATCH update: Roles `Owner, Admin, Manager`
- [ ] DELETE: Roles `Owner, Admin`
- [ ] POST invoice: Roles `Owner, Admin, Manager`
- [ ] All UUID params use `ParseUUIDPipe`
- [ ] `tenant_id` extracted from `req.user.tenant_id` — never from request body
- [ ] DELETE returns 204 No Content
- [ ] POST endpoints return 201 Created
- [ ] All endpoints have Swagger decorators (ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse)
- [ ] Controller route: `projects/:projectId/milestones`
- [ ] `npx tsc --noEmit` passes
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**NONE** — Sprint 8_6 (ProjectInvoiceController) does not depend on this sprint and can be developed in parallel.

---

## Handoff Notes

**Controller registered at route:** `projects/:projectId/milestones`

**Endpoints:**
| Method | Path | HTTP Status |
|--------|------|-------------|
| GET | `/projects/:projectId/milestones` | 200 |
| POST | `/projects/:projectId/milestones` | 201 |
| PATCH | `/projects/:projectId/milestones/:id` | 200 |
| DELETE | `/projects/:projectId/milestones/:id` | 204 |
| POST | `/projects/:projectId/milestones/:id/invoice` | 201 |

This controller must be registered in `financial.module.ts` during Sprint 8_7.
