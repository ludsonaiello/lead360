# Sprint 10_7 — Controllers + Module Registration

**Module:** Financial
**File:** ./documentation/sprints/financial/f10/sprint_10_7.md
**Type:** Backend — Controller + Guards + Module
**Depends On:** Sprint 10_3 (AccountMappingService), Sprint 10_6 (complete ExportService)
**Gate:** STOP — All 10 endpoints must respond correctly via curl. Swagger must document every endpoint.
**Estimated Complexity:** High

> **You are a masterclass-level engineer who makes Google, Amazon, and Apple engineers jealous of the quality of your work.**

> ⚠️ **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> ⚠️ **MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — do NOT hardcode database credentials anywhere.**

---

## Objective

Create the two controllers (`AccountMappingController` and `ExportController`), register both services and controllers in the `FinancialModule`, and verify all 10 endpoints are live with Swagger documentation.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/account-mapping.service.ts` — confirm all 5 methods exist
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/export.service.ts` — confirm all 6 methods exist
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` — understand current imports, controllers, providers, exports
- [ ] Read an existing controller for pattern reference: `/var/www/lead360.app/api/src/modules/financial/controllers/financial-entry.controller.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/receipt.controller.ts` — to see how the `Bookkeeper` role is used
- [ ] Verify the user model field names — read the `user` model in schema.prisma to confirm fields like `first_name`, `last_name`, `id` (or whatever naming is used)

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

### Task 1 — Create `AccountMappingController`

**What:** Create the file:
`/var/www/lead360.app/api/src/modules/financial/controllers/account-mapping.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccountMappingService } from '../services/account-mapping.service';
import { CreateAccountMappingDto } from '../dto/create-account-mapping.dto';
import { AccountMappingQueryDto, AccountMappingDefaultsQueryDto } from '../dto/account-mapping-query.dto';

@ApiTags('Financial Export — Account Mappings')
@ApiBearerAuth()
@Controller('financial/export/account-mappings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountMappingController {
  constructor(
    private readonly accountMappingService: AccountMappingService,
  ) {}

  // IMPORTANT: Static routes (defaults) MUST be registered BEFORE parameterized routes (:id)
  // NestJS matches routes in registration order — if :id comes first, "defaults" is treated as an ID

  @Get('defaults')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Preview default account mappings for all categories' })
  @ApiResponse({ status: 200, description: 'List of categories with resolved account names' })
  @ApiQuery({ name: 'platform', required: true, enum: ['quickbooks', 'xero'] })
  async getDefaults(
    @Request() req,
    @Query() query: AccountMappingDefaultsQueryDto,
  ) {
    return this.accountMappingService.getDefaults(
      req.user.tenant_id,
      query.platform,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'List all account mappings' })
  @ApiResponse({ status: 200, description: 'List of account mappings' })
  @ApiQuery({ name: 'platform', required: false, enum: ['quickbooks', 'xero'] })
  async findAll(
    @Request() req,
    @Query() query: AccountMappingQueryDto,
  ) {
    return this.accountMappingService.findAll(
      req.user.tenant_id,
      query.platform,
    );
  }

  @Post()
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Create or update an account mapping (upsert)' })
  @ApiResponse({ status: 200, description: 'Mapping updated' })
  @ApiResponse({ status: 201, description: 'Mapping created' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async upsert(
    @Request() req,
    @Body() dto: CreateAccountMappingDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.accountMappingService.upsert(
      req.user.tenant_id,
      req.user.id,
      dto,
    );

    // Set correct HTTP status based on upsert result
    const statusCode = result.statusCode;
    res.status(statusCode);

    // Remove statusCode from response payload
    const { statusCode: _, ...responseData } = result;
    return responseData;
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an account mapping' })
  @ApiParam({ name: 'id', description: 'Mapping UUID' })
  @ApiResponse({ status: 204, description: 'Mapping deleted' })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.accountMappingService.delete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
```

**CRITICAL — Route order:** The `@Get('defaults')` method MUST be defined BEFORE any `@Delete(':id')` route. NestJS evaluates routes in registration order within a controller. If `:id` comes first, a request to `/account-mappings/defaults` would match `:id` with value `"defaults"` and attempt to parse it as a UUID — resulting in a 400 error. By putting `defaults` first, it matches before the parameterized route.

**Roles:**
- `GET /account-mappings` — Owner, Admin, Bookkeeper
- `POST /account-mappings` — Owner, Admin, Bookkeeper
- `DELETE /account-mappings/:id` — Owner, Admin (NOT Bookkeeper — bookkeepers cannot delete mappings)
- `GET /account-mappings/defaults` — Owner, Admin, Bookkeeper

**Acceptance:** 4 endpoints at `/financial/export/account-mappings`. `defaults` route matches before `:id`. Swagger decorators on all endpoints. Correct roles per contract.

---

### Task 2 — Create `ExportController`

**What:** Create the file:
`/var/www/lead360.app/api/src/modules/financial/controllers/export.controller.ts`

```typescript
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ExportService } from '../services/export.service';
import { ExportExpenseQueryDto } from '../dto/export-expense-query.dto';
import { ExportInvoiceQueryDto } from '../dto/export-invoice-query.dto';
import { QualityReportQueryDto } from '../dto/quality-report-query.dto';
import { ExportHistoryQueryDto } from '../dto/export-history-query.dto';

@ApiTags('Financial Export')
@ApiBearerAuth()
@Controller('financial/export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
  ) {}

  // ============================
  // QuickBooks Exports
  // ============================

  @Get('quickbooks/expenses')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export expenses as QuickBooks CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Validation error or no matching records' })
  async exportQBExpenses(
    @Request() req,
    @Query() query: ExportExpenseQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportQBExpenses(
      req.user.tenant_id,
      req.user.id,
      query,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.csv);
  }

  @Get('quickbooks/invoices')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export invoices as QuickBooks CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Validation error or no matching records' })
  async exportQBInvoices(
    @Request() req,
    @Query() query: ExportInvoiceQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportQBInvoices(
      req.user.tenant_id,
      req.user.id,
      query,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.csv);
  }

  // ============================
  // Xero Exports
  // ============================

  @Get('xero/expenses')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export expenses as Xero CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Validation error or no matching records' })
  async exportXeroExpenses(
    @Request() req,
    @Query() query: ExportExpenseQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportXeroExpenses(
      req.user.tenant_id,
      req.user.id,
      query,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.csv);
  }

  @Get('xero/invoices')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export invoices as Xero CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Validation error or no matching records' })
  async exportXeroInvoices(
    @Request() req,
    @Query() query: ExportInvoiceQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportXeroInvoices(
      req.user.tenant_id,
      req.user.id,
      query,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.csv);
  }

  // ============================
  // Quality Report
  // ============================

  @Get('quality-report')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Data quality report for export readiness' })
  @ApiResponse({ status: 200, description: 'Quality report with issues and readiness scores' })
  async getQualityReport(
    @Request() req,
    @Query() query: QualityReportQueryDto,
  ) {
    return this.exportService.getQualityReport(
      req.user.tenant_id,
      query,
    );
  }

  // ============================
  // Export History
  // ============================

  @Get('history')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export history log (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of export records' })
  async getExportHistory(
    @Request() req,
    @Query() query: ExportHistoryQueryDto,
  ) {
    return this.exportService.getExportHistory(
      req.user.tenant_id,
      query,
    );
  }
}
```

**CRITICAL NOTES:**

1. **CSV Response pattern:** For CSV endpoints, use `@Res() res: Response` (NOT `@Res({ passthrough: true })`) and manually call `res.send()`. This bypasses NestJS's JSON serializer and sends raw CSV. The `Content-Type` and `Content-Disposition` headers must be set explicitly.

2. **Quality Report and Export History** use standard NestJS return (no `@Res()`) — NestJS automatically serializes the returned object to JSON.

3. **All endpoints** have the same role requirements: Owner, Admin, Bookkeeper.

4. **Route structure:** All routes are under `/financial/export/*`:
   - `GET /financial/export/quickbooks/expenses`
   - `GET /financial/export/quickbooks/invoices`
   - `GET /financial/export/xero/expenses`
   - `GET /financial/export/xero/invoices`
   - `GET /financial/export/quality-report`
   - `GET /financial/export/history`

**Acceptance:** 6 endpoints at `/financial/export/*`. CSV endpoints stream raw text/csv. JSON endpoints return standard NestJS responses.

---

### Task 3 — Register in FinancialModule

**What:** Update the existing file:
`/var/www/lead360.app/api/src/modules/financial/financial.module.ts`

Add these imports:
```typescript
import { AccountMappingService } from './services/account-mapping.service';
import { ExportService } from './services/export.service';
import { AccountMappingController } from './controllers/account-mapping.controller';
import { ExportController } from './controllers/export.controller';
```

Add to the `controllers` array:
```typescript
AccountMappingController,
ExportController,
```

Add to the `providers` array:
```typescript
AccountMappingService,
ExportService,
```

Add to the `exports` array:
```typescript
AccountMappingService,
ExportService,
```

**IMPORTANT:** Do NOT remove or modify any existing imports, controllers, providers, or exports. Only ADD the new ones.

**Verify the current module imports include `AuditModule`** — both new services depend on `AuditLoggerService`. The current module already imports `AuditModule` (confirmed in codebase exploration), so no change needed there.

**Acceptance:** Module compiles. Both new services registered as providers and exports. Both new controllers registered.

---

### Task 4 — Start Server and Verify Endpoints

**What:** Start the dev server and verify all 10 new endpoints are registered and responding.

**Verification commands (after server is running and health check passes):**

You need a valid JWT token to test. Use the existing test account to get one:

```bash
# 1. Get JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

echo "Token: $TOKEN"
```

If `jq` is not installed, parse the token manually from the JSON response.

```bash
# 2. Test Account Mapping endpoints
# List mappings (should return empty array or existing mappings)
curl -s http://localhost:8000/financial/export/account-mappings \
  -H "Authorization: Bearer $TOKEN" | head -c 200

# Get defaults (requires platform param)
curl -s "http://localhost:8000/financial/export/account-mappings/defaults?platform=quickbooks" \
  -H "Authorization: Bearer $TOKEN" | head -c 200

# 3. Test Export endpoints (expect 400 — no date params)
curl -s http://localhost:8000/financial/export/quickbooks/expenses \
  -H "Authorization: Bearer $TOKEN" | head -c 200

curl -s http://localhost:8000/financial/export/xero/expenses \
  -H "Authorization: Bearer $TOKEN" | head -c 200

# 4. Test Quality Report (should return report or empty)
curl -s http://localhost:8000/financial/export/quality-report \
  -H "Authorization: Bearer $TOKEN" | head -c 200

# 5. Test Export History (should return paginated list)
curl -s http://localhost:8000/financial/export/history \
  -H "Authorization: Bearer $TOKEN" | head -c 200
```

**Expected results:**
- Account mappings: 200 with array (possibly empty)
- Defaults: 200 with array of categories
- Export endpoints without dates: 400 with validation error
- Quality report: 200 with report object
- Export history: 200 with paginated response

**Also verify Swagger:**
```bash
curl -s http://localhost:8000/api/docs-json | jq '.paths | keys[]' | grep export
```

Should show all 10 endpoint paths in the Swagger spec.

**Acceptance:** All 10 endpoints respond correctly. Swagger documents all endpoints.

---

### Task 5 — Verify No Existing Endpoints Broken

**What:** Test a few existing financial endpoints to confirm nothing is broken:

```bash
# Test existing categories endpoint
curl -s http://localhost:8000/settings/financial-categories \
  -H "Authorization: Bearer $TOKEN" | head -c 200

# Test existing entries endpoint
curl -s "http://localhost:8000/financial/entries?project_id=00000000-0000-0000-0000-000000000000&page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -c 200
```

Both should return 200 (possibly with empty data, but not errors).

Then stop the server:
```bash
lsof -i :8000
kill {PID}
```

**Acceptance:** Existing financial endpoints still work. No regressions.

---

## Patterns to Apply

### Controller Pattern (from existing codebase)
```typescript
@ApiTags('Tag Name')
@ApiBearerAuth()
@Controller('route/path')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SomeController {
  constructor(private readonly someService: SomeService) {}

  @Get()
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Description' })
  @ApiResponse({ status: 200, description: 'Success' })
  async method(@Request() req, @Query() query: SomeDto) {
    return this.someService.method(req.user.tenant_id, query);
  }
}
```

### CSV Streaming Pattern
```typescript
@Get('csv-endpoint')
async exportCsv(@Request() req, @Query() query: SomeDto, @Res() res: Response) {
  const result = await this.service.export(req.user.tenant_id, req.user.id, query);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
  res.send(result.csv);
}
```

### Import Paths
```typescript
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
```

---

## Business Rules Enforced in This Sprint

- BR-14: Static routes (`defaults`) registered before parameterized routes (`:id`) to prevent NestJS treating path segments as UUIDs.
- BR-15: Delete mapping restricted to Owner, Admin roles only (NOT Bookkeeper).
- BR-16: All export endpoints require Owner, Admin, or Bookkeeper role.
- BR-17: CSV exports set `Content-Type: text/csv` and `Content-Disposition: attachment`.

---

## Integration Points

| Module | Import Path | What It Provides |
|--------|-------------|------------------|
| `auth` | `../../auth/guards/jwt-auth.guard` | `JwtAuthGuard` |
| `auth` | `../../auth/guards/roles.guard` | `RolesGuard` |
| `auth` | `../../auth/decorators/roles.decorator` | `@Roles()` decorator |

---

## Endpoint Summary

### AccountMappingController — `/financial/export/account-mappings`

| Method | Path | Roles | Service Method |
|--------|------|-------|----------------|
| `GET` | `/defaults` | Owner, Admin, Bookkeeper | `getDefaults(tenantId, platform)` |
| `GET` | `/` | Owner, Admin, Bookkeeper | `findAll(tenantId, platform?)` |
| `POST` | `/` | Owner, Admin, Bookkeeper | `upsert(tenantId, userId, dto)` |
| `DELETE` | `/:id` | Owner, Admin | `delete(tenantId, mappingId, userId)` |

### ExportController — `/financial/export`

| Method | Path | Roles | Service Method | Response Type |
|--------|------|-------|----------------|---------------|
| `GET` | `/quickbooks/expenses` | Owner, Admin, Bookkeeper | `exportQBExpenses(tenantId, userId, query)` | CSV |
| `GET` | `/quickbooks/invoices` | Owner, Admin, Bookkeeper | `exportQBInvoices(tenantId, userId, query)` | CSV |
| `GET` | `/xero/expenses` | Owner, Admin, Bookkeeper | `exportXeroExpenses(tenantId, userId, query)` | CSV |
| `GET` | `/xero/invoices` | Owner, Admin, Bookkeeper | `exportXeroInvoices(tenantId, userId, query)` | CSV |
| `GET` | `/quality-report` | Owner, Admin, Bookkeeper | `getQualityReport(tenantId, query)` | JSON |
| `GET` | `/history` | Owner, Admin, Bookkeeper | `getExportHistory(tenantId, query)` | JSON |

---

## Acceptance Criteria

- [ ] `account-mapping.controller.ts` created with 4 endpoints
- [ ] `export.controller.ts` created with 6 endpoints
- [ ] `defaults` route defined BEFORE `:id` route in AccountMappingController
- [ ] `financial.module.ts` updated with new controllers, providers, and exports
- [ ] No existing controllers, providers, or exports removed
- [ ] All 10 endpoints respond correctly (verified via curl)
- [ ] CSV endpoints return `Content-Type: text/csv`
- [ ] JSON endpoints return standard NestJS JSON responses
- [ ] Swagger documents all 10 new endpoints (verified via /api/docs-json)
- [ ] Existing financial endpoints still work (no regressions)
- [ ] Correct RBAC roles on every endpoint per contract
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — All 10 endpoints must be verified live with curl. Swagger must list all endpoints. No existing endpoints may be broken. Sprint 10_8 (unit tests) requires all endpoints to be functional.

---

## Handoff Notes

- All 10 endpoints are live and Swagger-documented
- AccountMappingController: `financial/export/account-mappings` (4 endpoints)
- ExportController: `financial/export/*` (6 endpoints)
- CSV endpoints use `@Res()` for raw streaming — they bypass NestJS JSON serialization
- The `upsert` endpoint returns 200 or 201 based on whether the mapping was updated or created
