# Sprint 7_3 — Service Part 1: validateProjectAccess + getFullSummary

**Module:** Financial
**File:** ./documentation/sprints/financial/f07/sprint_7_3.md
**Type:** Backend — Service Layer
**Depends On:** Sprint 7_1 (migration), Sprint 7_2 (DTOs)
**Gate:** STOP — Service must compile. `getFullSummary()` must be callable (tested in Sprint 7_6). The file must export `ProjectFinancialSummaryService` as an injectable NestJS service.
**Estimated Complexity:** High

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

Create the `ProjectFinancialSummaryService` — the core service for Sprint F-07. This sprint implements:

1. `validateProjectAccess()` — private guard method that verifies a project belongs to the requesting tenant
2. `getFullSummary()` — the single most important method in F-07, returning a complete financial picture of a project

The remaining 4 methods (`getTaskBreakdown`, `getTimeline`, `getReceipts`, `getWorkforceSummary`) are implemented in Sprint 7_4.

**This service is read-only. It creates no records. No `AuditLoggerService` calls are needed.**

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — understand the existing `getProjectCostSummary()` method at line ~258. This is what's being replaced with a far richer aggregation.
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/project-financial-query.dto.ts` — the DTOs created in Sprint 7_2
- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` — confirm `financial_category.classification`, `financial_entry.submission_status`, and `financial_entry.tax_amount` fields exist
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/subcontractor-invoice.service.ts` — understand existing aggregation patterns (uses `_sum`, `_count`)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/crew-hour-log.service.ts` — understand hour log query patterns
- [ ] Confirm Sprint 7_2 gate is met (DTO file exists and compiles)

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

### Task 1 — Create `project-financial-summary.service.ts`

**What:** Create the service file with the class skeleton, imports, and constructor.

**File:** `/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.ts`

**Structure:**
```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { ProjectDateFilterDto } from '../dto/project-financial-query.dto';

@Injectable()
export class ProjectFinancialSummaryService {
  private readonly logger = new Logger(ProjectFinancialSummaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Methods will be added below
}
```

**Why only `PrismaService`?** This service is read-only. No audit logging needed. It queries across multiple tables (financial_entry, project, receipt, crew_hour_log, crew_payment_record, subcontractor_task_invoice, subcontractor_payment_record) using Prisma directly.

**Do NOT:** Import or inject `FinancialEntryService`, `ReceiptService`, `CrewHourLogService`, `SubcontractorInvoiceService`, or any other service. Query Prisma directly for maximum query optimization (aggregate queries, groupBy). Do NOT delegate to other services.

**CRITICAL: Do NOT modify or delete `getProjectCostSummary()` from `FinancialEntryService`.** The `ProjectService` in the projects module calls `this.financialEntryService.getProjectCostSummary()` at line ~652 of `project.service.ts`. Deleting or renaming that method would break the project summary endpoint. The old method stays untouched — this sprint creates a NEW, separate service file.

---

### Task 2 — Implement `validateProjectAccess()`

**What:** Private method that verifies a project exists AND belongs to the requesting tenant.

```typescript
/**
 * Validates that a project exists and belongs to the given tenant.
 * Throws NotFoundException if not found — prevents cross-tenant data exposure.
 */
private async validateProjectAccess(tenantId: string, projectId: string) {
  const project = await this.prisma.project.findFirst({
    where: {
      id: projectId,
      tenant_id: tenantId,
    },
    select: { id: true },
  });

  if (!project) {
    throw new NotFoundException('Project not found');
  }
}
```

**Why `findFirst` instead of `findUnique`?** Because the `where` clause includes `tenant_id` (not just `id`). Prisma's `findUnique` only works on `@id` or `@unique` fields. `findFirst` with `id + tenant_id` is the multi-tenant safe pattern.

**This method is called at the start of every public method.** It prevents all cross-tenant data exposure with a single guard.

---

### Task 3 — Implement `getFullSummary()`

**What:** The main aggregation method. Returns a complete financial picture of a project.

**Signature:**
```typescript
async getFullSummary(tenantId: string, projectId: string, dateFilter?: ProjectDateFilterDto)
```

**This method runs 5 INDEPENDENT query groups in parallel using `Promise.all()`.** Each group can execute independently — they share no data dependencies. Running them in parallel reduces response time from ~500ms (sequential) to ~150ms (parallel).

#### Step 1: Build date filter condition

```typescript
// Build date filter for financial_entry queries
const entryDateFilter: any = {};
if (dateFilter?.date_from) {
  entryDateFilter.gte = new Date(dateFilter.date_from);
}
if (dateFilter?.date_to) {
  entryDateFilter.lte = new Date(dateFilter.date_to);
}
const hasDateFilter = Object.keys(entryDateFilter).length > 0;
```

#### Step 2: Run 5 parallel query groups

```typescript
await this.validateProjectAccess(tenantId, projectId);

const [
  projectData,
  costData,
  subcontractorData,
  crewData,
  receiptData,
] = await Promise.all([
  // GROUP 1: Project record
  this.fetchProjectData(tenantId, projectId),
  // GROUP 2: Financial entry aggregations
  this.fetchCostData(tenantId, projectId, entryDateFilter, hasDateFilter),
  // GROUP 3: Subcontractor aggregations
  this.fetchSubcontractorData(tenantId, projectId),
  // GROUP 4: Crew aggregations
  this.fetchCrewData(tenantId, projectId),
  // GROUP 5: Receipt counts
  this.fetchReceiptData(tenantId, projectId),
]);
```

#### Step 3: Assemble and return response

After all 5 groups resolve, assemble the final response object (see full response shape below).

---

### Task 4 — Implement Private Helper: `fetchProjectData()`

**What:** Fetches the project record with assigned PM.

```typescript
private async fetchProjectData(tenantId: string, projectId: string) {
  return this.prisma.project.findFirst({
    where: { id: projectId, tenant_id: tenantId },
    select: {
      id: true,
      project_number: true,
      name: true,
      status: true,
      progress_percent: true,
      start_date: true,
      target_completion_date: true,
      actual_completion_date: true,
      contract_value: true,
      estimated_cost: true,
      assigned_pm_user: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
        },
      },
    },
  });
}
```

**Response mapping for `project` section:**
- All fields map directly except `assigned_pm_user` → rename to `assigned_pm` in the response
- Decimal fields (`progress_percent`, `contract_value`, `estimated_cost`) must be converted to `Number()` since Prisma returns them as `Decimal` objects

---

### Task 5 — Implement Private Helper: `fetchCostData()`

**What:** Aggregates all financial entry data for the project — totals, by_category, by_classification.

```typescript
private async fetchCostData(
  tenantId: string,
  projectId: string,
  entryDateFilter: any,
  hasDateFilter: boolean,
) {
  const baseWhere: any = {
    tenant_id: tenantId,
    project_id: projectId,
  };

  if (hasDateFilter) {
    baseWhere.entry_date = entryDateFilter;
  }

  // Run sub-queries in parallel
  const [confirmedAgg, pendingAgg, taxAgg, entryCount, categoryBreakdown, categories] =
    await Promise.all([
      // Total confirmed expenses
      this.prisma.financial_entry.aggregate({
        where: { ...baseWhere, submission_status: 'confirmed' },
        _sum: { amount: true },
      }),
      // Total pending expenses
      this.prisma.financial_entry.aggregate({
        where: { ...baseWhere, submission_status: 'pending_review' },
        _sum: { amount: true },
      }),
      // Total tax paid (all statuses)
      this.prisma.financial_entry.aggregate({
        where: baseWhere,
        _sum: { tax_amount: true },
      }),
      // Total entry count
      this.prisma.financial_entry.count({ where: baseWhere }),
      // Group by category_id
      this.prisma.financial_entry.groupBy({
        by: ['category_id'],
        where: baseWhere,
        _sum: { amount: true },
        _count: true,
      }),
      // Fetch all categories referenced by this project's entries
      this.prisma.financial_category.findMany({
        where: { tenant_id: tenantId },
        select: {
          id: true,
          name: true,
          type: true,
          classification: true,
        },
      }),
    ]);

  // Build category map for O(1) lookups
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Merge category details with aggregation results
  const by_category = categoryBreakdown.map((group) => {
    const cat = categoryMap.get(group.category_id);
    return {
      category_id: group.category_id,
      category_name: cat?.name ?? 'Unknown',
      category_type: cat?.type ?? 'other',
      classification: cat?.classification ?? 'cost_of_goods_sold',
      total: Number(group._sum.amount ?? 0),
      entry_count: group._count,
    };
  });

  // Compute by_classification from by_category data
  const by_classification = {
    cost_of_goods_sold: 0,
    operating_expense: 0,
  };
  for (const cat of by_category) {
    if (cat.classification === 'operating_expense') {
      by_classification.operating_expense += cat.total;
    } else {
      by_classification.cost_of_goods_sold += cat.total;
    }
  }

  return {
    total_expenses: Number(confirmedAgg._sum.amount ?? 0),
    total_expenses_pending: Number(pendingAgg._sum.amount ?? 0),
    total_tax_paid: Number(taxAgg._sum.tax_amount ?? 0),
    entry_count: entryCount,
    by_category,
    by_classification: {
      cost_of_goods_sold: Math.round(by_classification.cost_of_goods_sold * 100) / 100,
      operating_expense: Math.round(by_classification.operating_expense * 100) / 100,
    },
  };
}
```

**Critical:** `total_expenses` uses ONLY `submission_status = 'confirmed'` entries. `total_expenses_pending` uses ONLY `submission_status = 'pending_review'` entries. This is the core business rule for margin analysis.

---

### Task 6 — Implement Private Helper: `fetchSubcontractorData()`

**What:** Aggregates subcontractor invoice amounts and payment amounts for the project.

```typescript
private async fetchSubcontractorData(tenantId: string, projectId: string) {
  const [invoiceAgg, paymentAgg] = await Promise.all([
    // Subcontractor invoices for this project
    this.prisma.subcontractor_task_invoice.aggregate({
      where: { tenant_id: tenantId, project_id: projectId },
      _sum: { amount: true },
      _count: true,
    }),
    // Subcontractor payments for this project
    this.prisma.subcontractor_payment_record.aggregate({
      where: { tenant_id: tenantId, project_id: projectId },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const totalInvoiced = Number(invoiceAgg._sum.amount ?? 0);
  const totalPaid = Number(paymentAgg._sum.amount ?? 0);

  return {
    total_invoiced: totalInvoiced,
    total_paid: totalPaid,
    outstanding: Math.round((totalInvoiced - totalPaid) * 100) / 100,
    invoice_count: invoiceAgg._count,
    payment_count: paymentAgg._count,
  };
}
```

**Note:** `subcontractor_payment_record.project_id` is nullable. The `where: { project_id: projectId }` filter correctly handles this — records without a project_id will not be included.

---

### Task 7 — Implement Private Helper: `fetchCrewData()`

**What:** Aggregates crew hours and crew payments for the project. Also counts distinct crew members.

```typescript
private async fetchCrewData(tenantId: string, projectId: string) {
  const [hoursAgg, paymentsAgg, distinctHourMembers, distinctPaymentMembers] =
    await Promise.all([
      // Crew hour totals
      this.prisma.crew_hour_log.aggregate({
        where: { tenant_id: tenantId, project_id: projectId },
        _sum: { hours_regular: true, hours_overtime: true },
      }),
      // Crew payment totals
      this.prisma.crew_payment_record.aggregate({
        where: { tenant_id: tenantId, project_id: projectId },
        _sum: { amount: true },
      }),
      // Distinct crew members with hours on this project
      this.prisma.crew_hour_log.findMany({
        where: { tenant_id: tenantId, project_id: projectId },
        select: { crew_member_id: true },
        distinct: ['crew_member_id'],
      }),
      // Distinct crew members with payments on this project
      this.prisma.crew_payment_record.findMany({
        where: { tenant_id: tenantId, project_id: projectId },
        select: { crew_member_id: true },
        distinct: ['crew_member_id'],
      }),
    ]);

  // Merge distinct crew members from both sources
  const allCrewMemberIds = new Set([
    ...distinctHourMembers.map((m) => m.crew_member_id),
    ...distinctPaymentMembers.map((m) => m.crew_member_id),
  ]);

  const totalRegular = Number(hoursAgg._sum.hours_regular ?? 0);
  const totalOvertime = Number(hoursAgg._sum.hours_overtime ?? 0);

  return {
    total_regular_hours: totalRegular,
    total_overtime_hours: totalOvertime,
    total_hours: Math.round((totalRegular + totalOvertime) * 100) / 100,
    total_crew_payments: Number(paymentsAgg._sum.amount ?? 0),
    crew_member_count: allCrewMemberIds.size,
  };
}
```

---

### Task 8 — Implement Private Helper: `fetchReceiptData()`

**What:** Counts receipts for the project — total, categorized, and uncategorized. Receipts can be linked to the project directly OR to any of its tasks.

```typescript
private async fetchReceiptData(tenantId: string, projectId: string) {
  // Get all task IDs for this project (receipts can be linked to tasks)
  const projectTasks = await this.prisma.project_task.findMany({
    where: { tenant_id: tenantId, project_id: projectId, deleted_at: null },
    select: { id: true },
  });
  const taskIds = projectTasks.map((t) => t.id);

  // Build OR condition: receipt belongs to project directly OR to one of its tasks
  const receiptWhere: any = {
    tenant_id: tenantId,
    OR: [
      { project_id: projectId },
      ...(taskIds.length > 0 ? [{ task_id: { in: taskIds } }] : []),
    ],
  };

  const [total, categorized] = await Promise.all([
    this.prisma.receipt.count({ where: receiptWhere }),
    this.prisma.receipt.count({
      where: { ...receiptWhere, is_categorized: true },
    }),
  ]);

  return {
    total_receipts: total,
    categorized_receipts: categorized,
    uncategorized_receipts: total - categorized,
  };
}
```

**Why query task IDs first?** Because `receipt.task_id` points to a task that belongs to the project. We can't do a nested relation filter in `count()` efficiently, so we resolve task IDs first then use `{ in: taskIds }`.

**Note:** `deleted_at: null` on project_task ensures we don't count receipts for soft-deleted tasks.

---

### Task 9 — Implement Private Helper: `computeMarginAnalysis()`

**What:** Pure computation method (no database queries). Takes project data and cost data, returns margin analysis with full null safety.

```typescript
private computeMarginAnalysis(
  contractValue: number | null,
  estimatedCost: number | null,
  actualCostConfirmed: number,
  actualCostTotal: number,
) {
  const estimated_margin =
    contractValue !== null && estimatedCost !== null
      ? Math.round((contractValue - estimatedCost) * 100) / 100
      : null;

  const actual_margin =
    contractValue !== null
      ? Math.round((contractValue - actualCostConfirmed) * 100) / 100
      : null;

  const cost_variance =
    estimatedCost !== null
      ? Math.round((actualCostConfirmed - estimatedCost) * 100) / 100
      : null;

  // margin_percent: null if contract_value is null or zero (no divide by zero)
  let margin_percent: number | null = null;
  if (contractValue !== null && contractValue !== 0 && actual_margin !== null) {
    margin_percent = Math.round((actual_margin / contractValue) * 10000) / 100;
  }

  return {
    contract_value: contractValue,
    estimated_cost: estimatedCost,
    actual_cost_confirmed: actualCostConfirmed,
    actual_cost_total: actualCostTotal,
    estimated_margin,
    actual_margin,
    cost_variance,
    margin_percent,
  };
}
```

**Critical rules:**
- **Never return NaN.** All division operations are guarded.
- **Never divide by zero.** Check `contractValue !== 0` before computing `margin_percent`.
- **Return null** when the required denominator or source value is missing.
- `actual_cost_confirmed` = confirmed entries only
- `actual_cost_total` = confirmed + pending entries
- `cost_variance` positive = over budget, negative = under budget

---

### Task 10 — Assemble the `getFullSummary()` Response

**What:** After all 5 parallel groups resolve, assemble the final response.

```typescript
async getFullSummary(
  tenantId: string,
  projectId: string,
  dateFilter?: ProjectDateFilterDto,
) {
  // [Step 1: Build date filter — see Task 3]
  // [Step 2: Validate + run 5 parallel groups — see Task 3]

  // Step 3: Assemble response
  const contractValue = projectData.contract_value !== null
    ? Number(projectData.contract_value)
    : null;
  const estimatedCost = projectData.estimated_cost !== null
    ? Number(projectData.estimated_cost)
    : null;

  const actualCostConfirmed = costData.total_expenses;
  const actualCostTotal = costData.total_expenses + costData.total_expenses_pending;

  return {
    project: {
      id: projectData.id,
      project_number: projectData.project_number,
      name: projectData.name,
      status: projectData.status,
      progress_percent: Number(projectData.progress_percent),
      start_date: projectData.start_date,
      target_completion_date: projectData.target_completion_date,
      actual_completion_date: projectData.actual_completion_date,
      contract_value: contractValue,
      estimated_cost: estimatedCost,
      assigned_pm: projectData.assigned_pm_user
        ? {
            id: projectData.assigned_pm_user.id,
            first_name: projectData.assigned_pm_user.first_name,
            last_name: projectData.assigned_pm_user.last_name,
          }
        : null,
    },
    cost_summary: {
      total_expenses: costData.total_expenses,
      total_expenses_pending: costData.total_expenses_pending,
      total_tax_paid: costData.total_tax_paid,
      entry_count: costData.entry_count,
      by_category: costData.by_category,
      by_classification: costData.by_classification,
    },
    subcontractor_summary: subcontractorData,
    crew_summary: crewData,
    receipt_summary: receiptData,
    margin_analysis: this.computeMarginAnalysis(
      contractValue,
      estimatedCost,
      actualCostConfirmed,
      actualCostTotal,
    ),
    revenue_note:
      'Revenue data (invoiced amount, collected amount) will be available after the Invoicing Module is implemented.',
  };
}
```

**Rules:**
- `revenue_note` is a static string. It appears in EVERY summary response regardless of date filters or data state. It is NOT computed.
- All Prisma `Decimal` objects must be converted to `Number()` before returning.
- Aggregation fields return `0` (not `null`) when no data exists. Only `margin_analysis` fields return `null`.
- The response shape matches the contract exactly — do not rename fields, do not add extra fields, do not omit fields.

---

### Task 11 — Verify Compilation

**What:** Start the dev server and verify the service file compiles.

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Wait for compilation. Check for TypeScript errors.

```bash
curl -s http://localhost:8000/health
```

**After confirming, shut down:**
```bash
lsof -i :8000
kill {PID}
lsof -i :8000
```

---

## Integration Points

| Module | Table | Query Type | Why |
|--------|-------|-----------|-----|
| Financial | `financial_entry` | aggregate, groupBy, count | Cost aggregations |
| Financial | `financial_category` | findMany | Category details + classification |
| Financial | `receipt` | count | Receipt summary |
| Financial | `subcontractor_task_invoice` | aggregate | Invoice totals |
| Financial | `subcontractor_payment_record` | aggregate | Payment totals |
| Financial | `crew_hour_log` | aggregate, findMany(distinct) | Hour totals, distinct members |
| Financial | `crew_payment_record` | aggregate, findMany(distinct) | Payment totals, distinct members |
| Projects | `project` | findFirst | Project details + PM info |
| Projects | `project_task` | findMany | Task IDs for receipt query |

All accessed via `PrismaService` — no cross-module service imports needed.

---

## Acceptance Criteria

- [ ] File created: `/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.ts`
- [ ] Class `ProjectFinancialSummaryService` is `@Injectable()` and exported
- [ ] Constructor injects only `PrismaService`
- [ ] `validateProjectAccess()` throws `NotFoundException` for missing/wrong-tenant projects
- [ ] `getFullSummary()` runs 5 independent query groups in parallel via `Promise.all()`
- [ ] `total_expenses` counts ONLY `submission_status = 'confirmed'` entries
- [ ] `total_expenses_pending` counts ONLY `submission_status = 'pending_review'` entries
- [ ] `by_category` returns per-category totals with `category_name`, `category_type`, `classification`
- [ ] `by_classification` correctly splits COGS vs operating expense
- [ ] `margin_percent` returns null when `contract_value` is null
- [ ] `margin_percent` returns null when `contract_value` is 0 (no divide by zero)
- [ ] `revenue_note` field present as a static string in every response
- [ ] `date_from`/`date_to` filters correctly scope `financial_entry` queries only
- [ ] All Prisma Decimal values converted to `Number()` before returning
- [ ] Zero values returned for empty aggregations (not null)
- [ ] Application compiles without errors
- [ ] No existing files modified (except the new service file)
- [ ] Dev server shut down

---

## Gate Marker

**STOP** — The service file must compile and export `ProjectFinancialSummaryService`. Confirm:
1. File exists at the correct path
2. Class is injectable (`@Injectable()`)
3. `getFullSummary()` method exists with correct signature
4. Dev server compiles without TypeScript errors

---

## Handoff Notes

**For Sprint 7_4 (Service Part 2):**
- The service file is `/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.ts`
- `validateProjectAccess()` is already implemented — call it at the start of every public method
- The `fetchProjectData()`, `fetchCostData()`, `fetchSubcontractorData()`, `fetchCrewData()`, `fetchReceiptData()` private helpers are available for reference
- Sprint 7_4 must add 4 more public methods to this SAME file: `getTaskBreakdown()`, `getTimeline()`, `getReceipts()`, `getWorkforceSummary()`
- Do NOT create a new file — add methods to the existing service class
