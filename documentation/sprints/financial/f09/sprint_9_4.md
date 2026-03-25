# Sprint 9_4 — DashboardController + P&L CSV Export + Module Registration

**Module:** Financial
**File:** `./documentation/sprints/financial/f09/sprint_9_4.md`
**Type:** Backend
**Depends On:** Sprint 9_3 must be complete (all DashboardService methods implemented)
**Gate:** STOP — All 7 endpoints respond correctly, Swagger docs visible, module compiles
**Estimated Complexity:** Medium

---

## Engineer Standards

You are a masterclass-level backend engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality of your code. Every line you write is precise, efficient, and production-ready.

**CRITICAL WARNINGS:**
- This platform is **85% production-ready**. Never break existing code. Not a single comma may break existing business logic.
- Never leave the dev server running in the background when you finish.
- Read the codebase thoroughly before touching anything. Implement with surgical precision.
- MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — never hardcode credentials.
- This project does **NOT** use PM2. Do not reference or run any PM2 command.
- Never use `pkill -f` — always use `lsof -i :8000` + `kill {PID}`.

---

## Objective

Create the DashboardController with all 7 HTTP endpoints, implement the `exportPL()` CSV export method in DashboardService, register the controller in the financial module, and verify all endpoints are accessible and Swagger-documented.

---

## Pre-Sprint Checklist

- [ ] Read `api/src/modules/financial/services/dashboard.service.ts` — confirm all 6 public methods exist
- [ ] Read `api/src/modules/financial/controllers/financial-entry.controller.ts` — observe the exact controller pattern: decorators, guards, imports, Swagger annotations
- [ ] Read `api/src/modules/financial/financial.module.ts` — confirm DashboardService is in providers, note all existing controllers
- [ ] Read `api/src/modules/financial/dto/pl-query.dto.ts` — confirm all 4 DTOs exist from Sprint 9_1
- [ ] Read `api/src/modules/auth/decorators/tenant-id.decorator.ts` — confirm import path
- [ ] Read `api/src/modules/auth/guards/jwt-auth.guard.ts` — confirm import path
- [ ] Read `api/src/modules/auth/guards/roles.guard.ts` — confirm import path
- [ ] Read `api/src/modules/auth/decorators/roles.decorator.ts` — confirm import path
- [ ] Check if the codebase already has a CSV generation utility or if `json2csv` / `csv-writer` is in `package.json`

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

### Task 1 — Implement exportPL() Method in DashboardService

**What:** Add the `exportPL()` method that generates a CSV buffer from P&L data.

**File:** `api/src/modules/financial/services/dashboard.service.ts`

**Method signature:**
```typescript
async exportPL(
  tenantId: string,
  year: number,
  month?: number,
): Promise<Buffer>
```

**Algorithm:**

**Step 1 — Get P&L data:**
```typescript
const plData = await this.getPL(tenantId, year, month, false);
```

**Step 2 — Build CSV content with two sections:**

**Section 1 — Monthly Summary:**
```
Month,Total Income,Total Expenses (Confirmed),COGS,Operating Expense,Gross Profit,Net Profit,Tax Collected,Tax Paid
```

For each month in `plData.months`:
```
{month_label},{income.total},{expenses.total},{expenses.by_classification.cost_of_goods_sold},{expenses.by_classification.operating_expense},{gross_profit},{net_profit},{tax.tax_collected},{tax.tax_paid}
```

**Blank row separator**

**Section 2 — Expense Detail:**
```
Month,Date,Category,Classification,Supplier/Vendor,Amount,Tax,Payment Method,Project,Notes
```

For the detail section, query individual expense entries:
```typescript
const entries = await this.prisma.financial_entry.findMany({
  where: {
    tenant_id: tenantId,
    entry_date: {
      gte: new Date(year, (month ? month - 1 : 0), 1),
      lt: new Date(year, (month ? month : 12), 1),
    },
    submission_status: 'confirmed',
  },
  include: {
    category: { select: { name: true, classification: true } },
    project: { select: { name: true } },
  },
  orderBy: { entry_date: 'asc' },
});
```

For each entry:
```
{monthLabel},{entry_date},{category.name},{category.classification},{vendor_name},{amount},{tax_amount},{payment_method},{project.name},{notes}
```

**Step 3 — Build CSV string:**

Use simple string concatenation or the `json2csv` library (already in package.json). For simplicity:
```typescript
const lines: string[] = [];

// Section 1 header
lines.push('Month,Total Income,Total Expenses (Confirmed),COGS,Operating Expense,Gross Profit,Net Profit,Tax Collected,Tax Paid');

// Section 1 data
for (const m of plData.months) {
  lines.push([
    m.month_label,
    m.income.total,
    m.expenses.total,
    m.expenses.by_classification.cost_of_goods_sold,
    m.expenses.by_classification.operating_expense,
    m.gross_profit,
    m.net_profit,
    m.tax.tax_collected,
    m.tax.tax_paid,
  ].join(','));
}

// Blank separator
lines.push('');

// Section 2 header
lines.push('Month,Date,Category,Classification,Supplier/Vendor,Amount,Tax,Payment Method,Project,Notes');

// Section 2 data
for (const entry of entries) {
  const entryDate = new Date(entry.entry_date);
  const monthLabel = `${this.monthLabels[entryDate.getMonth()]} ${entryDate.getFullYear()}`;
  lines.push([
    monthLabel,
    entry.entry_date.toISOString().split('T')[0],
    this.escapeCsvField(entry.category?.name ?? ''),
    entry.category?.classification ?? '',
    this.escapeCsvField(entry.vendor_name ?? ''),
    this.toNum(entry.amount),
    this.toNum(entry.tax_amount),
    entry.payment_method ?? '',
    this.escapeCsvField(entry.project?.name ?? ''),
    this.escapeCsvField(entry.notes ?? ''),
  ].join(','));
}

return Buffer.from(lines.join('\n'), 'utf-8');
```

**CSV escaping helper (private method):**
```typescript
private escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

**Month labels array:** Already defined as `private readonly monthLabels` on the DashboardService class in Sprint 9_1. Reuse it via `this.monthLabels`. Do NOT redefine it.

---

### Task 2 — Create DashboardController

**What:** Create the controller with all 7 endpoints.

**File:** `api/src/modules/financial/controllers/dashboard.controller.ts`

**Imports required (verify exact paths by reading existing financial controllers):**
```typescript
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
// NOTE: Do NOT import Request, Header, or StreamableFile — they are not used.
// All endpoints use @TenantId() decorator, not @Request().
// The CSV export uses @Res() + res.send(), not StreamableFile.
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { DashboardService } from '../services/dashboard.service';
import { PlQueryDto } from '../dto/pl-query.dto';
import { ArQueryDto } from '../dto/ar-query.dto';
import { ApQueryDto } from '../dto/ap-query.dto';
import { ForecastQueryDto } from '../dto/forecast-query.dto';
import { Response } from 'express';
```

**Controller class:**
```typescript
@ApiTags('Financial Dashboard')
@ApiBearerAuth()
@Controller('financial/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
}
```

**Route prefix:** `financial/dashboard`

---

**Endpoint 1 — GET /financial/dashboard/overview**

```typescript
@Get('overview')
@Roles('Owner', 'Admin', 'Bookkeeper')
@ApiOperation({ summary: 'Get combined financial dashboard overview' })
@ApiResponse({ status: 200, description: 'Dashboard overview with P&L, AR, AP, forecast, and alerts' })
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
@ApiQuery({ name: 'forecast_days', required: false, type: Number, description: 'Forecast period: 30, 60, or 90 days (default 30)' })
async getOverview(
  @TenantId() tenantId: string,
  @Query('forecast_days') forecastDays?: number,
) {
  return this.dashboardService.getOverview(tenantId, {
    forecast_days: forecastDays ? Number(forecastDays) : 30,
  });
}
```

---

**Endpoint 2 — GET /financial/dashboard/pl**

```typescript
@Get('pl')
@Roles('Owner', 'Admin', 'Bookkeeper')
@ApiOperation({ summary: 'Monthly Profit & Loss report' })
@ApiResponse({ status: 200, description: 'P&L data for the requested year/month' })
@ApiQuery({ name: 'year', required: true, type: Number })
@ApiQuery({ name: 'month', required: false, type: Number, description: '1-12. Omit for full year.' })
@ApiQuery({ name: 'include_pending', required: false, type: Boolean, description: 'Include pending_review entries in total_with_pending' })
async getPL(
  @TenantId() tenantId: string,
  @Query() query: PlQueryDto,
) {
  return this.dashboardService.getPL(
    tenantId,
    query.year,
    query.month,
    query.include_pending,
  );
}
```

---

**Endpoint 3 — GET /financial/dashboard/ar**

```typescript
@Get('ar')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@ApiOperation({ summary: 'Accounts receivable summary with aging buckets' })
@ApiResponse({ status: 200, description: 'AR summary, aging buckets, and invoice list' })
@ApiQuery({ name: 'status', required: false, description: 'Filter by invoice status' })
@ApiQuery({ name: 'overdue_only', required: false, type: Boolean })
async getAR(
  @TenantId() tenantId: string,
  @Query() query: ArQueryDto,
) {
  return this.dashboardService.getAR(tenantId, {
    status: query.status,
    overdue_only: query.overdue_only,
  });
}
```

**Note:** AR is accessible to Manager role (unlike P&L, Forecast, Alerts which are not).

---

**Endpoint 4 — GET /financial/dashboard/ap**

```typescript
@Get('ap')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
@ApiOperation({ summary: 'Accounts payable awareness — what the business owes' })
@ApiResponse({ status: 200, description: 'AP summary with subcontractor invoices, recurring upcoming, crew hours' })
@ApiQuery({ name: 'days_ahead', required: false, type: Number, description: 'Days ahead to look (default 30)' })
async getAP(
  @TenantId() tenantId: string,
  @Query() query: ApQueryDto,
) {
  return this.dashboardService.getAP(
    tenantId,
    query.days_ahead ?? 30,
  );
}
```

**Note:** AP is accessible to Manager role.

---

**Endpoint 5 — GET /financial/dashboard/forecast**

```typescript
@Get('forecast')
@Roles('Owner', 'Admin', 'Bookkeeper')
@ApiOperation({ summary: 'Cash flow forecast for next 30/60/90 days' })
@ApiResponse({ status: 200, description: 'Expected inflows, outflows, and net forecast' })
@ApiResponse({ status: 400, description: 'Invalid days parameter — must be 30, 60, or 90' })
@ApiQuery({ name: 'days', required: true, type: Number, description: 'Must be 30, 60, or 90' })
async getForecast(
  @TenantId() tenantId: string,
  @Query() query: ForecastQueryDto,
) {
  return this.dashboardService.getForecast(tenantId, query.days);
}
```

---

**Endpoint 6 — GET /financial/dashboard/alerts**

```typescript
@Get('alerts')
@Roles('Owner', 'Admin', 'Bookkeeper')
@ApiOperation({ summary: 'Financial health alerts — automated flags for conditions requiring attention' })
@ApiResponse({ status: 200, description: 'Alert list sorted by severity, max 50' })
async getAlerts(
  @TenantId() tenantId: string,
) {
  return this.dashboardService.getAlerts(tenantId);
}
```

---

**Endpoint 7 — GET /financial/dashboard/pl/export**

```typescript
@Get('pl/export')
@Roles('Owner', 'Admin', 'Bookkeeper')
@ApiOperation({ summary: 'Export P&L as CSV' })
@ApiResponse({ status: 200, description: 'CSV file download' })
@ApiQuery({ name: 'year', required: true, type: Number })
@ApiQuery({ name: 'month', required: false, type: Number })
async exportPL(
  @TenantId() tenantId: string,
  @Query() query: PlQueryDto,
  @Res() res: Response,
) {
  const csvBuffer = await this.dashboardService.exportPL(
    tenantId,
    query.year,
    query.month,
  );

  const filename = query.month
    ? `pl-${query.year}-${String(query.month).padStart(2, '0')}.csv`
    : `pl-${query.year}.csv`;

  res.set({
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });

  res.send(csvBuffer);
}
```

**IMPORTANT:** The export endpoint MUST be registered BEFORE any `/:param` routes. Since we use `'pl/export'` and `'pl'` (not `':param'`), this is not an issue — but verify route ordering after implementation.

---

### Task 3 — Register DashboardController in FinancialModule

**What:** Add DashboardController to the controllers array in `financial.module.ts`.

**File:** `api/src/modules/financial/financial.module.ts`

**Changes:**
1. Add import: `import { DashboardController } from './controllers/dashboard.controller';`
2. Add `DashboardController` to the `controllers` array

**Do NOT:** Remove or modify any existing controllers, providers, or imports.

---

### Task 4 — Verify All Endpoints

**What:** Start the dev server and test all 7 endpoints with curl.

**Test sequence (run after server is healthy):**

```bash
# Get auth token first (use test credentials)
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# 1. Overview
curl -s http://localhost:8000/financial/dashboard/overview \
  -H "Authorization: Bearer $TOKEN" | jq .

# 2. P&L (current year)
curl -s "http://localhost:8000/financial/dashboard/pl?year=2026" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3. P&L (single month)
curl -s "http://localhost:8000/financial/dashboard/pl?year=2026&month=3" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. AR
curl -s http://localhost:8000/financial/dashboard/ar \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. AP
curl -s "http://localhost:8000/financial/dashboard/ap?days_ahead=60" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 6. Forecast
curl -s "http://localhost:8000/financial/dashboard/forecast?days=30" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 7. Alerts
curl -s http://localhost:8000/financial/dashboard/alerts \
  -H "Authorization: Bearer $TOKEN" | jq .

# 8. P&L Export (should download CSV)
curl -s "http://localhost:8000/financial/dashboard/pl/export?year=2026" \
  -H "Authorization: Bearer $TOKEN" -o pl-test.csv
cat pl-test.csv

# 9. Forecast with invalid days (should return 400)
curl -s "http://localhost:8000/financial/dashboard/forecast?days=45" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 10. Verify Swagger docs include all dashboard endpoints
curl -s http://localhost:8000/api/docs-json | jq '.paths | keys | map(select(startswith("/financial/dashboard")))'
```

**Expected results:**
- Endpoints 1-7: Return 200 with correct JSON shapes (may be empty data if no test data exists)
- Endpoint 8: Downloads valid CSV file with correct headers
- Endpoint 9: Returns 400 validation error
- Endpoint 10: Shows all 7 dashboard paths in Swagger spec

**RBAC verification:**
```bash
# Test Employee access (should return 403)
# You need an Employee-role token for this test
# If no Employee account is available, document this as a deferred test
```

---

## Patterns to Apply

### Controller Pattern (from existing financial controllers)
```typescript
@ApiTags('Financial Dashboard')
@ApiBearerAuth()
@Controller('financial/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('endpoint')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: '...' })
  @ApiResponse({ status: 200, description: '...' })
  async method(@TenantId() tenantId: string, @Query() query: SomeDto) {
    return this.dashboardService.someMethod(tenantId, ...);
  }
}
```

### CSV Response Pattern
Use `@Res() res: Response` and set headers manually:
```typescript
res.set({
  'Content-Type': 'text/csv',
  'Content-Disposition': `attachment; filename="pl-${year}.csv"`,
});
res.send(csvBuffer);
```

### Role Mapping (from F-09 contract)

| Endpoint | Roles |
|----------|-------|
| Overview | Owner, Admin, Bookkeeper |
| P&L | Owner, Admin, Bookkeeper |
| AR | Owner, Admin, **Manager**, Bookkeeper |
| AP | Owner, Admin, **Manager**, Bookkeeper |
| Forecast | Owner, Admin, Bookkeeper |
| Alerts | Owner, Admin, Bookkeeper |
| P&L Export | Owner, Admin, Bookkeeper |

**Note:** Manager can access AR and AP but NOT P&L, Forecast, Alerts, or Overview. Employee has NO access to any dashboard endpoint.

---

## Business Rules Enforced in This Sprint

- **BR-R1:** All dashboard endpoints require authentication (JwtAuthGuard).
- **BR-R2:** Role restrictions enforced via RolesGuard + @Roles() decorator.
- **BR-R3:** Employee role has NO access to any dashboard endpoint.
- **BR-R4:** Manager can access ONLY AR and AP endpoints.
- **BR-R5:** P&L export uses `Content-Type: text/csv` and correct `Content-Disposition` header.
- **BR-R6:** P&L export filename format: `pl-{year}.csv` or `pl-{year}-{month}.csv`.
- **BR-R7:** CSV has two sections separated by a blank row: Monthly Summary and Expense Detail.
- **BR-R8:** Voided invoices excluded from export income data (handled by getPL() internally).

---

## Integration Points

| Dependency | Import Path | Usage |
|-----------|------------|-------|
| `DashboardService` | `'../services/dashboard.service'` | All endpoint logic |
| `JwtAuthGuard` | `'../../auth/guards/jwt-auth.guard'` | Authentication |
| `RolesGuard` | `'../../auth/guards/roles.guard'` | Role-based access |
| `Roles` decorator | `'../../auth/decorators/roles.decorator'` | Role specification |
| `TenantId` decorator | `'../../auth/decorators/tenant-id.decorator'` | Tenant extraction from JWT |
| DTOs | `'../dto/pl-query.dto'`, etc. | Query validation |

---

## Acceptance Criteria

- [ ] DashboardController created at `api/src/modules/financial/controllers/dashboard.controller.ts`
- [ ] Controller registered in `financial.module.ts` controllers array
- [ ] `exportPL()` method added to DashboardService
- [ ] All 7 endpoints respond with correct HTTP status codes
- [ ] RBAC correctly enforced: Manager can access AR/AP, NOT P&L/Forecast/Alerts/Overview
- [ ] Employee gets 403 on all dashboard endpoints
- [ ] P&L export returns valid CSV with correct Content-Type and Content-Disposition
- [ ] CSV has two sections: Monthly Summary and Expense Detail
- [ ] Forecast returns 400 for invalid `days` values (e.g., 45)
- [ ] All endpoints appear in Swagger docs
- [ ] `@ApiOperation`, `@ApiResponse`, `@ApiQuery` decorators on every endpoint
- [ ] `@TenantId()` used on every endpoint — NOT `req.user.tenant_id`
- [ ] No existing code broken
- [ ] Dev server compiles cleanly
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before starting Sprint 9_5, verify:
1. All 7 endpoints respond correctly (test with curl)
2. Swagger documentation shows all 7 dashboard endpoints
3. CSV export downloads correctly
4. RBAC restrictions are correct per the role table above

---

## Handoff Notes

**For Sprint 9_5:**
- All service methods and controller endpoints are complete
- Sprint 9_5 focuses on unit tests for DashboardService
- Test the service methods by mocking PrismaService and RecurringExpenseService
- The `toNum()` helper and `escapeCsvField()` helper are private methods — test them indirectly via public methods

**Endpoint → Service method mapping:**
| HTTP Endpoint | Service Method |
|--------------|---------------|
| `GET /financial/dashboard/overview` | `getOverview(tenantId, query)` |
| `GET /financial/dashboard/pl` | `getPL(tenantId, year, month?, includePending?)` |
| `GET /financial/dashboard/ar` | `getAR(tenantId, query)` |
| `GET /financial/dashboard/ap` | `getAP(tenantId, daysAhead)` |
| `GET /financial/dashboard/forecast` | `getForecast(tenantId, days)` |
| `GET /financial/dashboard/alerts` | `getAlerts(tenantId)` |
| `GET /financial/dashboard/pl/export` | `exportPL(tenantId, year, month?)` |
