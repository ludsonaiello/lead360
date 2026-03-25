# Sprint 8_6 — Project Invoice Controller

**Module:** Financial
**File:** `./documentation/sprints/financial/f08/sprint_8_6.md`
**Type:** Backend — Controller
**Depends On:** Sprint 8_4 (ProjectInvoiceService)
**Gate:** NONE — sprint 8_7 depends on sprints 8_5 and 8_6, but no gate needed here
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

Create the `ProjectInvoiceController` — the REST controller that exposes 8 endpoints for managing project invoices and payments. Each endpoint delegates to `ProjectInvoiceService`. The controller handles authentication, RBAC, parameter parsing, query validation, and Swagger documentation.

---

## Pre-Sprint Checklist

- [ ] Sprint 8_4 GATE passed: ProjectInvoiceService compiles with all 8 methods
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/subcontractor-invoice.controller.ts` — understand the multi-controller pattern used for complex modules
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/draw-milestone.controller.ts` — if Sprint 8_5 is done, verify the pattern matches
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

### Task 1 — Create `ProjectInvoiceController`

**File:** `api/src/modules/financial/controllers/project-invoice.controller.ts`

**Full implementation:**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ProjectInvoiceService } from '../services/project-invoice.service';
import { CreateProjectInvoiceDto } from '../dto/create-project-invoice.dto';
import { UpdateProjectInvoiceDto } from '../dto/update-project-invoice.dto';
import { RecordInvoicePaymentDto } from '../dto/record-invoice-payment.dto';
import { VoidInvoiceDto } from '../dto/void-invoice.dto';
import { ListProjectInvoicesDto } from '../dto/list-project-invoices.dto';

@ApiTags('Project Invoices')
@ApiBearerAuth()
@Controller('projects/:projectId/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectInvoiceController {
  constructor(private readonly projectInvoiceService: ProjectInvoiceService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // GET /projects/:projectId/invoices
  // ───────────────────────────────────────────────────────────────────────────

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List invoices for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'sent', 'partial', 'paid', 'voided'] })
  @ApiQuery({ name: 'date_from', required: false, description: 'Filter by created_at from (ISO date)' })
  @ApiQuery({ name: 'date_to', required: false, description: 'Filter by created_at to (ISO date)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of invoices' })
  async findByProject(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListProjectInvoicesDto,
  ) {
    return this.projectInvoiceService.findByProject(
      req.user.tenant_id,
      projectId,
      query,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/invoices
  // ───────────────────────────────────────────────────────────────────────────

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an invoice manually' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiBody({ type: CreateProjectInvoiceDto })
  @ApiResponse({ status: 201, description: 'Invoice created with status draft' })
  async create(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectInvoiceDto,
  ) {
    return this.projectInvoiceService.create(
      req.user.tenant_id,
      projectId,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GET /projects/:projectId/invoices/:id
  // ───────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Get a single invoice with payments' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice with payments and milestone details' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findOne(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectInvoiceService.findOne(
      req.user.tenant_id,
      projectId,
      id,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /projects/:projectId/invoices/:id
  // ───────────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update a draft invoice' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiBody({ type: UpdateProjectInvoiceDto })
  @ApiResponse({ status: 200, description: 'Invoice updated' })
  @ApiResponse({ status: 400, description: 'Invoice is not in draft status' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async update(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectInvoiceDto,
  ) {
    return this.projectInvoiceService.update(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/invoices/:id/send
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/send')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark invoice as sent' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice marked as sent' })
  @ApiResponse({ status: 400, description: 'Invoice is not in draft status' })
  async markSent(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectInvoiceService.markSent(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/invoices/:id/void
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/void')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void an invoice' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiBody({ type: VoidInvoiceDto })
  @ApiResponse({ status: 200, description: 'Invoice voided, linked milestone reset to pending' })
  @ApiResponse({ status: 400, description: 'Invoice is already voided or reason missing' })
  async voidInvoice(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.projectInvoiceService.voidInvoice(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/invoices/:id/payments
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/payments')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiBody({ type: RecordInvoicePaymentDto })
  @ApiResponse({ status: 201, description: 'Payment recorded, invoice updated atomically' })
  @ApiResponse({ status: 400, description: 'Payment exceeds amount due or invoice is voided' })
  async recordPayment(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordInvoicePaymentDto,
  ) {
    return this.projectInvoiceService.recordPayment(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GET /projects/:projectId/invoices/:id/payments
  // ───────────────────────────────────────────────────────────────────────────

  @Get(':id/payments')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List payments for an invoice' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'List of payments ordered by payment_date' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getPayments(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectInvoiceService.getPayments(
      req.user.tenant_id,
      projectId,
      id,
    );
  }
}
```

---

## Patterns Applied

### Controller authentication pattern
```typescript
@Controller('projects/:projectId/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)

// Import paths:
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
```

### Role assignments per endpoint
| Endpoint | Roles |
|----------|-------|
| GET list | Owner, Admin, Manager, Bookkeeper |
| POST create | Owner, Admin, Manager |
| GET single | Owner, Admin, Manager, Bookkeeper |
| PATCH update | Owner, Admin, Manager |
| POST send | Owner, Admin, Manager |
| POST void | Owner, Admin |
| POST payments | Owner, Admin, Manager, Bookkeeper |
| GET payments | Owner, Admin, Manager, Bookkeeper |

---

## Acceptance Criteria

- [ ] `project-invoice.controller.ts` created at `api/src/modules/financial/controllers/project-invoice.controller.ts`
- [ ] 8 endpoints defined with correct HTTP methods and paths
- [ ] All endpoints use `JwtAuthGuard` + `RolesGuard`
- [ ] RBAC roles match the specification above
- [ ] All UUID params use `ParseUUIDPipe`
- [ ] `tenant_id` extracted from `req.user.tenant_id` — never from request body
- [ ] POST create and POST payments return 201 Created
- [ ] POST send and POST void return 200
- [ ] GET endpoints return 200
- [ ] All endpoints have Swagger decorators (ApiTags, ApiOperation, ApiParam, ApiBody/ApiQuery, ApiResponse)
- [ ] Controller route: `projects/:projectId/invoices`
- [ ] GET list uses `@Query()` with `ListProjectInvoicesDto`
- [ ] `npx tsc --noEmit` passes
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**NONE** — Sprint 8_7 (Module Registration) depends on this sprint being complete, but no formal gate is needed.

---

## Handoff Notes

**Controller registered at route:** `projects/:projectId/invoices`

**Endpoints:**
| Method | Path | HTTP Status |
|--------|------|-------------|
| GET | `/projects/:projectId/invoices` | 200 |
| POST | `/projects/:projectId/invoices` | 201 |
| GET | `/projects/:projectId/invoices/:id` | 200 |
| PATCH | `/projects/:projectId/invoices/:id` | 200 |
| POST | `/projects/:projectId/invoices/:id/send` | 200 |
| POST | `/projects/:projectId/invoices/:id/void` | 200 |
| POST | `/projects/:projectId/invoices/:id/payments` | 201 |
| GET | `/projects/:projectId/invoices/:id/payments` | 200 |

This controller must be registered in `financial.module.ts` during Sprint 8_7.
