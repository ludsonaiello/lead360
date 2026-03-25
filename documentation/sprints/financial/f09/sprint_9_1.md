# Sprint 9_1 — DTOs + DashboardService — P&L Method

**Module:** Financial
**File:** `./documentation/sprints/financial/f09/sprint_9_1.md`
**Type:** Backend
**Depends On:** F-01, F-04, F-06, F-08 must be fully complete and merged
**Gate:** STOP — DashboardService compiles, getPL() returns correct P&L data structure, all DTOs validate correctly
**Estimated Complexity:** High

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

Create the four query DTOs for all dashboard endpoints and implement `DashboardService` with the `getPL()` method — the most complex aggregation in F-09. The P&L method computes monthly income (cash-basis from invoice payments), monthly expenses (from confirmed financial entries), cost breakdowns by classification and category, top suppliers, tax positions, and profit calculations. All data is read-only and scoped to `tenant_id`.

---

## Pre-Sprint Checklist

- [ ] Read `api/src/modules/financial/financial.module.ts` — confirm RecurringExpenseService is registered as a provider and exported
- [ ] Read `api/src/modules/financial/services/financial-entry.service.ts` — get the exact import path for PrismaService (you will reuse the same import)
- [ ] Read `api/prisma/schema.prisma` — confirm these models exist with the fields listed below:
  - `project_invoice` with fields: `id`, `tenant_id`, `project_id`, `invoice_number`, `amount`, `tax_amount`, `amount_paid`, `amount_due`, `status`, `due_date`, `sent_at`
  - `project_invoice_payment` with fields: `id`, `tenant_id`, `invoice_id`, `project_id`, `amount`, `payment_date`
  - `financial_entry` with fields: `submission_status`, `tax_amount`, `vendor_name`, `payment_method`
  - `financial_category` with field: `classification`
  - `recurring_expense_rule` table exists
- [ ] Read `api/src/modules/financial/services/recurring-expense.service.ts` — confirm `getPreview()` method exists and note its signature
- [ ] Read `api/src/modules/financial/dto/list-financial-entries.dto.ts` — observe the DTO pattern (class-validator decorators, @ApiProperty)
- [ ] Read `api/src/modules/financial/controllers/financial-entry.controller.ts` — observe the Swagger decorator pattern

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

### Task 1 — Create PlQueryDto

**What:** Create the query DTO for the P&L endpoint.

**File:** `api/src/modules/financial/dto/pl-query.dto.ts`

**Fields:**

| Field | Type | Validation | Default | Description |
|-------|------|-----------|---------|-------------|
| `year` | number | `@IsInt()`, `@Min(2020)`, `@Max(2100)`, `@Type(() => Number)` | Required | Calendar year to report |
| `month` | number | `@IsOptional()`, `@IsInt()`, `@Min(1)`, `@Max(12)`, `@Type(() => Number)` | undefined | Specific month (1-12). Omit for full year |
| `include_pending` | boolean | `@IsOptional()`, `@Transform(({ value }) => value === 'true' || value === true)` | `false` | Include pending_review entries in `total_with_pending` |

**Imports required:**
```typescript
import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
```

**Swagger decorators:** Add `@ApiProperty()` on `year`, `@ApiPropertyOptional()` on `month` and `include_pending`.

**Do NOT:** Add any fields not listed above. No pagination — this is a summary endpoint.

---

### Task 2 — Create ArQueryDto

**What:** Create the query DTO for the Accounts Receivable endpoint.

**File:** `api/src/modules/financial/dto/ar-query.dto.ts`

**Fields:**

| Field | Type | Validation | Default | Description |
|-------|------|-----------|---------|-------------|
| `status` | string | `@IsOptional()`, `@IsString()` | undefined | Filter by invoice status (draft, sent, partial, paid) |
| `overdue_only` | boolean | `@IsOptional()`, `@Transform(({ value }) => value === 'true' || value === true)` | `false` | Return only overdue invoices |

**Imports:** Same pattern as PlQueryDto plus `@IsString()`.

---

### Task 3 — Create ApQueryDto

**What:** Create the query DTO for the Accounts Payable endpoint.

**File:** `api/src/modules/financial/dto/ap-query.dto.ts`

**Fields:**

| Field | Type | Validation | Default | Description |
|-------|------|-----------|---------|-------------|
| `days_ahead` | number | `@IsOptional()`, `@IsInt()`, `@Min(1)`, `@Max(365)`, `@Type(() => Number)` | `30` | How many days ahead to look for upcoming obligations |

---

### Task 4 — Create ForecastQueryDto

**What:** Create the query DTO for the Cash Flow Forecast endpoint.

**File:** `api/src/modules/financial/dto/forecast-query.dto.ts`

**Fields:**

| Field | Type | Validation | Default | Description |
|-------|------|-----------|---------|-------------|
| `days` | number | `@IsInt()`, `@IsIn([30, 60, 90])`, `@Type(() => Number)` | Required | Forecast period. Must be exactly 30, 60, or 90 |

**Import:** `@IsIn` from `class-validator`.

**Important:** If `days` is anything other than 30, 60, or 90, the validation pipe returns 400 automatically.

---

### Task 5 — Create DashboardService Skeleton

**What:** Create the DashboardService file with constructor and dependency injection.

**File:** `api/src/modules/financial/services/dashboard.service.ts`

**Class structure:**
```typescript
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurringExpenseService: RecurringExpenseService,
  ) {}

  // Methods will be added in this sprint and subsequent sprints
}
```

**Import paths — verify by reading existing services in the same directory:**
- `PrismaService` — use the same import path as `financial-entry.service.ts`
- `RecurringExpenseService` — `'./recurring-expense.service'` (same `services/` directory)
- `Injectable` — from `@nestjs/common`

**Do NOT:** Import AuditLoggerService — F-09 is read-only, no audit logging needed.

---

### Task 6 — Implement getPL() Method

**What:** Implement the full P&L aggregation method. This is the most complex method in F-09.

**Method signature:**
```typescript
async getPL(
  tenantId: string,
  year: number,
  month?: number,
  includePending?: boolean,
): Promise<PLResponse>
```

**Algorithm — step by step:**

**Step 1 — Determine months to process:**
```typescript
const months: number[] = month ? [month] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
```

**Step 2 — Process all months in parallel:**
```typescript
const monthlyData = await Promise.all(
  months.map(m => this.calculateMonthPL(tenantId, year, m, includePending))
);
```

**Step 3 — Compute totals across all months** (JavaScript reduce, NOT a DB query):
```typescript
const totals = {
  total_income: sum of all month income.total,
  total_expenses: sum of all month expenses.total,
  total_gross_profit: sum of all month gross_profit,
  total_operating_profit: sum of all month operating_profit,
  total_tax_collected: sum of all month tax.tax_collected,
  total_tax_paid: sum of all month tax.tax_paid,
  avg_monthly_income: total_income / months.length,
  avg_monthly_expenses: total_expenses / months.length,
  best_month: month with highest net_profit { month_label, net_profit },
  worst_month: month with lowest net_profit { month_label, net_profit },
};
```

**Step 4 — Return response:**
```typescript
return {
  year,
  period: month ? 'single_month' : 'monthly',
  currency: 'USD',
  months: monthlyData,
  totals,
};
```

---

**Private method — calculateMonthPL():**

```typescript
private async calculateMonthPL(
  tenantId: string,
  year: number,
  month: number,
  includePending?: boolean,
)
```

**Date range construction:**
```typescript
const monthStart = new Date(year, month - 1, 1);
const monthEnd = new Date(year, month, 1);
```

**Month label (uses the class constant `this.monthLabels` defined above):**
```typescript
const monthLabel = `${this.monthLabels[month - 1]} ${year}`;
```

**Run all queries for this month in parallel via Promise.all():**

**Query 1 — Total income (sum of payments received this month):**
```typescript
this.prisma.project_invoice_payment.aggregate({
  _sum: { amount: true },
  where: {
    tenant_id: tenantId,
    payment_date: { gte: monthStart, lt: monthEnd },
  },
})
```
Result: `income.total = result._sum.amount?.toNumber() ?? 0`

**Query 2 — Invoice count (unique invoices that received payment this month):**
```typescript
this.prisma.project_invoice_payment.findMany({
  where: {
    tenant_id: tenantId,
    payment_date: { gte: monthStart, lt: monthEnd },
  },
  select: { invoice_id: true },
  distinct: ['invoice_id'],
})
```
Result: `income.invoice_count = result.length`

**Query 3 — Income by project:**
```typescript
this.prisma.project_invoice_payment.groupBy({
  by: ['project_id'],
  _sum: { amount: true },
  where: {
    tenant_id: tenantId,
    payment_date: { gte: monthStart, lt: monthEnd },
  },
})
```
Then fetch project names:
```typescript
const projectIds = byProjectRaw.map(p => p.project_id);
const projects = await this.prisma.project.findMany({
  where: { id: { in: projectIds }, tenant_id: tenantId },
  select: { id: true, name: true, project_number: true },
});
```
Map to: `{ project_id, project_name, project_number, collected }`

**Query 4 — Total expenses (confirmed only):**
```typescript
this.prisma.financial_entry.aggregate({
  _sum: { amount: true },
  where: {
    tenant_id: tenantId,
    entry_date: { gte: monthStart, lt: monthEnd },
    submission_status: 'confirmed',
  },
})
```
Result: `expenses.total = result._sum.amount?.toNumber() ?? 0`

**Query 5 — Total expenses with pending (confirmed + pending_review):**
```typescript
this.prisma.financial_entry.aggregate({
  _sum: { amount: true },
  where: {
    tenant_id: tenantId,
    entry_date: { gte: monthStart, lt: monthEnd },
    submission_status: { in: ['confirmed', 'pending_review'] },
  },
})
```
Result: `expenses.total_with_pending = result._sum.amount?.toNumber() ?? 0`

**Query 6 — Tax paid on expenses:**
```typescript
this.prisma.financial_entry.aggregate({
  _sum: { tax_amount: true },
  where: {
    tenant_id: tenantId,
    entry_date: { gte: monthStart, lt: monthEnd },
    submission_status: 'confirmed',
  },
})
```
Result: `expenses.total_tax_paid = result._sum.tax_amount?.toNumber() ?? 0`

**Query 7 — COGS total (expenses where category.classification = 'cost_of_goods_sold'):**
```typescript
this.prisma.financial_entry.aggregate({
  _sum: { amount: true },
  where: {
    tenant_id: tenantId,
    entry_date: { gte: monthStart, lt: monthEnd },
    submission_status: 'confirmed',
    category: { classification: 'cost_of_goods_sold' },
  },
})
```
Result: `expenses.by_classification.cost_of_goods_sold`

**Query 8 — Operating expense total:**
```typescript
this.prisma.financial_entry.aggregate({
  _sum: { amount: true },
  where: {
    tenant_id: tenantId,
    entry_date: { gte: monthStart, lt: monthEnd },
    submission_status: 'confirmed',
    category: { classification: 'operating_expense' },
  },
})
```
Result: `expenses.by_classification.operating_expense`

**Query 9 — Expenses grouped by category:**
```typescript
this.prisma.financial_entry.groupBy({
  by: ['category_id'],
  _sum: { amount: true },
  _count: { id: true },
  where: {
    tenant_id: tenantId,
    entry_date: { gte: monthStart, lt: monthEnd },
    submission_status: 'confirmed',
  },
})
```
Then fetch category details:
```typescript
const categoryIds = byCategoryRaw.map(c => c.category_id);
const categories = await this.prisma.financial_category.findMany({
  where: { id: { in: categoryIds }, tenant_id: tenantId },
  select: { id: true, name: true, type: true, classification: true },
});
```
Map to: `{ category_id, category_name, category_type, classification, total, entry_count }`

**Query 10 — Top 5 suppliers by spend:**
```typescript
this.prisma.financial_entry.groupBy({
  by: ['vendor_name'],
  _sum: { amount: true },
  _count: { id: true },
  where: {
    tenant_id: tenantId,
    entry_date: { gte: monthStart, lt: monthEnd },
    submission_status: 'confirmed',
    vendor_name: { not: null },
  },
  orderBy: { _sum: { amount: 'desc' } },
  take: 5,
})
```
Map to: `{ supplier_id: null, supplier_name: vendor_name, total, transaction_count }`

**Note:** If the `supplier` model exists in the schema (from F-02), use `supplier_id` grouping instead and join supplier names. If `supplier` does not exist, use `vendor_name` as shown above and set `supplier_id` to `null`.

**Query 11 — Tax collected (tax from invoices that received payment this month):**

**IMPORTANT:** Do NOT make a separate findMany query here. Reuse the result from **Query 2** (`invoiceCount` variable in the Promise.all destructuring), which already contains the distinct invoice IDs that received payment this month.

After Promise.all completes, use the Query 2 result:
```typescript
// invoiceCount is the result of Query 2: [{ invoice_id: 'xxx' }, { invoice_id: 'yyy' }]
const taxCollected = invoiceCount.length > 0
  ? await this.prisma.project_invoice.aggregate({
      _sum: { tax_amount: true },
      where: {
        id: { in: invoiceCount.map(p => p.invoice_id) },
        tenant_id: tenantId,
      },
    })
  : { _sum: { tax_amount: null } };
```
Result: `tax.tax_collected = this.toNum(taxCollected._sum.tax_amount)`

If no invoices had payments (`invoiceCount.length === 0`), `tax_collected = 0`.

---

**Profit calculations (JavaScript, after all queries return):**

```
gross_profit = income.total - expenses.by_classification.cost_of_goods_sold
operating_profit = gross_profit - expenses.by_classification.operating_expense
net_profit = operating_profit  (same for now — no separate tax line deduction)
gross_margin_percent = income.total > 0
  ? round((gross_profit / income.total) * 100, 2)
  : null   ← NEVER return NaN or Infinity, use null
```

**Tax block:**
```
tax_collected = (from query 11)
tax_paid = expenses.total_tax_paid (from query 6)
net_tax_position = tax_collected - tax_paid
```

---

**Return shape for each month:**
```typescript
{
  year: number,
  month: number,
  month_label: string,
  income: {
    total: number,
    invoice_count: number,
    by_project: Array<{ project_id: string, project_name: string, project_number: string, collected: number }>,
  },
  expenses: {
    total: number,
    total_with_pending: number,
    total_tax_paid: number,
    by_classification: {
      cost_of_goods_sold: number,
      operating_expense: number,
    },
    by_category: Array<{
      category_id: string,
      category_name: string,
      category_type: string,
      classification: string,
      total: number,
      entry_count: number,
    }>,
    top_suppliers: Array<{
      supplier_id: string | null,
      supplier_name: string,
      total: number,
      transaction_count: number,
    }>,
  },
  gross_profit: number,
  operating_profit: number,
  net_profit: number,
  gross_margin_percent: number | null,
  tax: {
    tax_collected: number,
    tax_paid: number,
    net_tax_position: number,
  },
}
```

---

**Decimal handling — CRITICAL:**

All Prisma `_sum` aggregations return `Prisma.Decimal | null`. Convert to JavaScript number. Define this as a **private class method** on `DashboardService` so all methods can call `this.toNum()`:
```typescript
private toNum(val: any): number {
  if (val === null || val === undefined) return 0;
  return Number(Number(val).toFixed(2));
}
```
Use `this.toNum()` for every monetary value in every method. Never return `NaN` or `Infinity`.

**Month labels — define as class constant** (reused by `exportPL()` in Sprint 9_4):
```typescript
private readonly monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
```

---

### Task 7 — Register DashboardService in FinancialModule

**What:** Add DashboardService to the providers array in `financial.module.ts`.

**File:** `api/src/modules/financial/financial.module.ts`

**Changes:**
1. Add import: `import { DashboardService } from './services/dashboard.service';`
2. Add `DashboardService` to the `providers` array
3. Add `DashboardService` to the `exports` array (so other modules could use it if needed)

**Do NOT:**
- Add DashboardController yet — that is Sprint 9_4
- Remove or modify any existing providers, controllers, or imports
- Change any other line in this file

---

## Patterns to Apply

### Multi-Tenant Enforcement
Every Prisma query MUST include `tenant_id` in the `where` clause. No exceptions. This is non-negotiable.

```typescript
where: {
  tenant_id: tenantId,
  // ... other filters
}
```

### Query Parallelization
All independent queries within `calculateMonthPL()` MUST run in parallel via `Promise.all()`:
```typescript
const [
  incomeTotal,
  invoiceCount,
  byProject,
  expenseTotal,
  expenseWithPending,
  taxPaid,
  cogsTotal,
  opexTotal,
  byCategory,
  topSuppliers,
] = await Promise.all([
  // ... all 10 queries
]);
```

Then run the tax_collected query (depends on invoiceCount result for the invoice IDs):
```typescript
const taxCollected = invoiceCount.length > 0
  ? await this.prisma.project_invoice.aggregate({ ... })
  : { _sum: { tax_amount: null } };
```

### Prisma Aggregation Pattern
Always use `_sum`, `_count`, `groupBy` — NEVER `findMany()` followed by JavaScript `reduce()` for monetary aggregations:
```typescript
// CORRECT:
const result = await this.prisma.financial_entry.aggregate({
  _sum: { amount: true },
  where: { tenant_id: tenantId, ... },
});

// WRONG — never do this:
const entries = await this.prisma.financial_entry.findMany({ where: { ... } });
const total = entries.reduce((sum, e) => sum + Number(e.amount), 0);
```

### Null-Safe Division
Before any division, check the denominator:
```typescript
const grossMarginPercent = incomeTotal > 0
  ? Number(((grossProfit / incomeTotal) * 100).toFixed(2))
  : null;
```
NEVER return `NaN`, `Infinity`, or `-Infinity`. Use `null` to mean "not computable".

---

## Business Rules Enforced in This Sprint

- **BR-1:** Income is recognized on cash basis — when payment is received (`project_invoice_payment.payment_date`), not when invoiced.
- **BR-2:** Only `confirmed` expense entries count toward P&L `expenses.total`. `pending_review` entries are included only in `expenses.total_with_pending`.
- **BR-3:** All P&L calculations exclude voided invoices (invoices with `status = 'voided'` are never counted in income since they would not have payments).
- **BR-4:** `gross_margin_percent` returns `null` when `income.total = 0` — never `NaN`.
- **BR-5:** All 12 months are included in the year response even if a month has zero income and zero expenses. The `months` array always has exactly 12 entries for a full year.
- **BR-6:** All monetary values are returned as numbers with 2 decimal places. Never return raw floats with rounding artifacts.
- **BR-7:** The `totals` block is computed from the `months` array in JavaScript — NOT a separate DB query.

---

## Integration Points

| Dependency | Import Path | Usage |
|-----------|------------|-------|
| `PrismaService` | Same as `financial-entry.service.ts` — verify before coding | All database queries |
| `RecurringExpenseService` | `'./recurring-expense.service'` | Not used in this sprint — injected for future methods |
| `FinancialModule` | `financial.module.ts` | Register DashboardService as provider |

---

## Acceptance Criteria

- [ ] `PlQueryDto` validates: `year` required int, `month` optional int 1-12, `include_pending` optional bool
- [ ] `ArQueryDto` validates: `status` optional string, `overdue_only` optional bool
- [ ] `ApQueryDto` validates: `days_ahead` optional int default 30
- [ ] `ForecastQueryDto` validates: `days` required, must be exactly 30, 60, or 90
- [ ] `DashboardService` is created and compiles without errors
- [ ] `DashboardService` is registered in `financial.module.ts` providers and exports
- [ ] `getPL()` returns correct response shape as defined above
- [ ] Income computed from `project_invoice_payment.payment_date` (cash basis)
- [ ] Expenses split correctly by `classification` field on `financial_category`
- [ ] `gross_profit = income.total - COGS`
- [ ] `operating_profit = gross_profit - operating_expense`
- [ ] All 12 months present in year view even with zero activity
- [ ] Single month filter works when `month` parameter provided
- [ ] `include_pending` flag correctly populates `total_with_pending`
- [ ] `tax_collected` sourced from invoices, `tax_paid` from entries
- [ ] `totals` block sums correctly across all months
- [ ] `best_month` and `worst_month` correctly identified
- [ ] No `NaN`, `Infinity`, or `-Infinity` in any response field
- [ ] All Prisma queries include `tenant_id` filter
- [ ] No existing code modified (except adding to `financial.module.ts` providers)
- [ ] Dev server starts without compilation errors
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before starting Sprint 9_2, verify:
1. Dev server compiles cleanly with the new DashboardService
2. All 4 DTOs exist and have correct validation decorators
3. `getPL()` method returns the correct data shape (test manually if possible)
4. `financial.module.ts` has DashboardService in providers and exports

---

## Handoff Notes

**For Sprint 9_2:**
- DashboardService exists at `api/src/modules/financial/services/dashboard.service.ts`
- PrismaService and RecurringExpenseService are already injected
- The `toNum()` helper for Decimal conversion is defined in this file — reuse it
- The date range pattern (`monthStart`/`monthEnd`) can be extracted as a utility method
- The service is registered in `financial.module.ts` — no further module changes needed in 9_2

**Methods defined in this sprint:**
- `getPL(tenantId, year, month?, includePending?)` — public
- `calculateMonthPL(tenantId, year, month, includePending?)` — private

**Methods remaining (added in later sprints):**
- `getAR(tenantId, query)` — Sprint 9_2
- `getAP(tenantId, daysAhead)` — Sprint 9_2
- `getForecast(tenantId, days)` — Sprint 9_3
- `getAlerts(tenantId)` — Sprint 9_3
- `getOverview(tenantId, query)` — Sprint 9_3
- `exportPL(tenantId, year, month?)` — Sprint 9_4
