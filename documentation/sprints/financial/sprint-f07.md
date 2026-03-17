# Sprint F-07 — Project Financial Intelligence

**Module**: Financial  
**Sprint**: F-07  
**Status**: Ready for Development  
**Type**: Enhancement — Existing Controller Rebuild + New Aggregation Endpoints  
**Estimated Complexity**: Medium–High  
**Prerequisites**:
- Sprint F-01 must be complete (`financial_category.classification` field exists)
- Sprint F-04 must be complete (enriched `financial_entry` response shape available)

---

## Purpose

The current `ProjectFinancialSummaryController` has one endpoint that returns total cost grouped by category type. That is the entirety of the project financial intelligence today. It is missing:

- The contract value sitting on the `project` record itself
- The estimated cost vs. actual cost variance
- Per-task cost breakdown
- Subcontractor invoices aggregated at the project level
- Crew payment totals at the project level
- Crew hours logged at the project level
- Receipt count and list
- Date-range filtering
- Cost classification breakdown (COGS vs operating expense)

This sprint rebuilds the project financial summary into a full intelligence endpoint that gives a project manager a complete financial picture of a job in a single API call.

**Critical scope boundary established from codebase audit:**

The Invoicing Module (Sprint 9 in TODO.md) is **Not Started**. There are no `invoice`, `payment`, or `credit` tables in the schema. This means F-07 **cannot** aggregate revenue-side data (invoiced amount, collected amount, outstanding balance). Those metrics will be added to the project financial summary in a future sprint once Sprint 9 is complete.

F-07 covers the **cost side** of project financials only, plus the contract value fields that already exist on the `project` model. The revenue intelligence layer is explicitly deferred and documented as a known gap.

---

## Scope

### In Scope

- Full rebuild of `ProjectFinancialSummaryService.getProjectCostSummary()` into a comprehensive aggregation
- New endpoint: project financial summary (full — replaces the existing single endpoint)
- New endpoint: per-task financial breakdown
- New endpoint: project cost timeline (expenses over time, grouped by month)
- New endpoint: project receipts list (all receipts attached to project or its tasks)
- New endpoint: project workforce summary (crew hours + crew payments + subcontractor payments)
- Date-range filter on all cost aggregation endpoints
- Cost classification breakdown in all summaries (COGS vs operating expense using new `classification` field from F-01)
- No schema changes — all data already exists in: `project`, `financial_entry`, `project_task`, `subcontractor_task_invoice`, `crew_payment_record`, `crew_hour_log`, `receipt`
- 100% API documentation
- Full test coverage

### Out of Scope

- No revenue-side aggregation (invoices, payments, collected amount) — invoicing module not built
- No frontend implementation
- No changes to any table — pure service and endpoint work
- No budget vs. actual comparison beyond what `project.contract_value` and `project.estimated_cost` already provide
- No changes to the Projects module — this sprint lives entirely in `FinancialModule`
- No profitability forecasting

---

## Platform Architecture Patterns (Mandatory)

- **Tenant isolation**: Every query must filter by `tenant_id`. All project IDs must be validated against the requesting tenant before any aggregation runs.
- **TenantId decorator**: `@TenantId()` on all controller methods.
- **Read-only module**: This sprint creates no records. All service methods are read-only queries. No `AuditLoggerService` calls needed — reads are not audited.
- **Cross-module data access**: This sprint aggregates data from tables owned by both `FinancialModule` and `ProjectsModule`. The agent must use `PrismaService` directly to query `project`, `project_task`, `crew_payment_record`, `crew_hour_log`, and `subcontractor_task_invoice` tables — these are not exposed via ProjectsModule service exports. This is acceptable since both modules share the same Prisma instance.
- **No migrations**: No schema changes. Pure service and query implementation.

---

## Data Sources Per Endpoint

Before defining endpoints, here is a clear map of which tables each aggregation draws from:

| Data Point | Source Table | Already Confirmed |
|-----------|-------------|-------------------|
| Contract value | `project.contract_value` | ✅ |
| Estimated cost | `project.estimated_cost` | ✅ |
| Project progress | `project.progress_percent` | ✅ |
| Expense entries | `financial_entry` (project_id = this project) | ✅ |
| Expense by category | `financial_entry` + `financial_category` join | ✅ |
| Expense by classification | `financial_entry` + `financial_category.classification` | ✅ F-01 |
| Per-task expenses | `financial_entry` (task_id = task) | ✅ |
| Subcontractor invoices | `subcontractor_task_invoice` (project_id = this project) | ✅ |
| Subcontractor payments | `subcontractor_payment_record` (project_id = this project) | ✅ |
| Crew payments | `crew_payment_record` (project_id = this project) | ✅ |
| Crew hours | `crew_hour_log` (project_id = this project) | ✅ |
| Receipts | `receipt` (project_id = this project) | ✅ |
| Invoiced amount | `invoice` table — **DOES NOT EXIST YET** | ❌ Deferred |
| Collected amount | `payment` table — **DOES NOT EXIST YET** | ❌ Deferred |

---

## API Specification

All endpoints are nested under `/projects/:projectId/financial/`. The `:projectId` is validated against `tenant_id` on every request.

### Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/projects/:projectId/financial/summary` | Full financial summary | Owner, Admin, Manager, Bookkeeper |
| `GET` | `/projects/:projectId/financial/tasks` | Per-task cost breakdown | Owner, Admin, Manager, Bookkeeper |
| `GET` | `/projects/:projectId/financial/timeline` | Monthly cost timeline | Owner, Admin, Manager, Bookkeeper |
| `GET` | `/projects/:projectId/financial/receipts` | All project receipts | Owner, Admin, Manager, Bookkeeper, Employee |
| `GET` | `/projects/:projectId/financial/workforce` | Crew hours, payments, sub payments | Owner, Admin, Manager, Bookkeeper |

---

### `GET /projects/:projectId/financial/summary`

**Purpose:** The single most important endpoint in this sprint. Returns everything a project manager needs to understand the financial state of a job.

**Query parameters:**
- `date_from` — date, optional. Filter `financial_entry.entry_date >= date_from`.
- `date_to` — date, optional. Filter `financial_entry.entry_date <= date_to`.

**Response:**

```
{
  project: {
    id
    project_number
    name
    status                      enum
    progress_percent            decimal
    start_date                  date | null
    target_completion_date      date | null
    actual_completion_date      date | null
    contract_value              decimal | null   — from project.contract_value
    estimated_cost              decimal | null   — from project.estimated_cost
    assigned_pm: { id, first_name, last_name } | null
  }

  cost_summary: {
    total_expenses              decimal   — sum of all financial_entry.amount for this project (confirmed entries only)
    total_expenses_pending      decimal   — sum of pending_review entries (not yet confirmed)
    total_tax_paid              decimal   — sum of financial_entry.tax_amount
    entry_count                 integer

    by_category: [
      {
        category_id
        category_name
        category_type           enum      — labor | material | subcontractor | equipment | etc.
        classification          enum      — cost_of_goods_sold | operating_expense
        total                   decimal
        entry_count             integer
      }
    ]

    by_classification: {
      cost_of_goods_sold        decimal   — sum of entries where category.classification = cogs
      operating_expense         decimal   — sum of entries where category.classification = opex
    }
  }

  subcontractor_summary: {
    total_invoiced              decimal   — sum of subcontractor_task_invoice.amount for this project
    total_paid                  decimal   — sum of subcontractor_payment_record.amount for this project
    outstanding                 decimal   — total_invoiced - total_paid
    invoice_count               integer
    payment_count               integer
  }

  crew_summary: {
    total_regular_hours         decimal   — sum of crew_hour_log.hours_regular
    total_overtime_hours        decimal   — sum of crew_hour_log.hours_overtime
    total_hours                 decimal   — regular + overtime
    total_crew_payments         decimal   — sum of crew_payment_record.amount for this project
    crew_member_count           integer   — distinct crew members with hours or payments on this project
  }

  receipt_summary: {
    total_receipts              integer   — count of receipt records for this project
    categorized_receipts        integer   — count where is_categorized = true
    uncategorized_receipts      integer   — count where is_categorized = false
  }

  margin_analysis: {
    contract_value              decimal | null
    estimated_cost              decimal | null
    actual_cost_confirmed       decimal         — total_expenses (confirmed only)
    actual_cost_total           decimal         — confirmed + pending
    estimated_margin            decimal | null  — contract_value - estimated_cost (null if either missing)
    actual_margin               decimal | null  — contract_value - actual_cost_confirmed (null if contract_value missing)
    cost_variance               decimal | null  — actual_cost_confirmed - estimated_cost (positive = over budget)
    margin_percent              decimal | null  — (actual_margin / contract_value) * 100
  }

  revenue_note: "Revenue data (invoiced amount, collected amount) will be available after the Invoicing Module is implemented."
}
```

**Notes on `margin_analysis`:**
- All margin fields return `null` if the required source value is missing (e.g., `contract_value` not set on project).
- Never return `NaN` or divide by zero — always null-check before computing percentages.
- `actual_cost_confirmed` excludes `pending_review` entries — only counting money the bookkeeper has approved.
- `actual_cost_total` includes pending entries — gives the PM a worst-case view.

---

### `GET /projects/:projectId/financial/tasks`

**Purpose:** Per-task cost breakdown. Shows where money is being spent within the project at the task level.

**Query parameters:**
- `date_from` / `date_to` — optional date filters.
- `sort_by` — `total_cost` | `task_title`. Default: `total_cost`.
- `sort_order` — `asc` | `desc`. Default: `desc`.

**Response:**

```
{
  project_id
  total_task_cost     decimal   — sum across all tasks
  tasks: [
    {
      task_id
      task_title
      task_status         enum
      task_order_index    integer

      expenses: {
        total             decimal
        by_category: [
          { category_name, category_type, classification, total }
        ]
        entry_count       integer
      }

      subcontractor_invoices: {
        total_invoiced    decimal
        invoice_count     integer
      }

      crew_hours: {
        total_regular_hours   decimal
        total_overtime_hours  decimal
        total_hours           decimal
      }
    }
  ]
}
```

Tasks with zero financial activity across all sources are included with zero values — they should not be excluded from the response. This gives the PM a complete picture of all tasks, not just ones with costs.

---

### `GET /projects/:projectId/financial/timeline`

**Purpose:** Monthly cost trend for the project. Shows how spending has tracked over time.

**Query parameters:**
- `date_from` / `date_to` — optional. If omitted, returns all months from project `start_date` to today (or `actual_completion_date`).

**Response:**

```
{
  project_id
  months: [
    {
      year              integer
      month             integer   — 1–12
      month_label       string    — e.g. "Jan 2026"
      total_expenses    decimal
      by_category: [
        { category_name, category_type, total }
      ]
    }
  ]
  cumulative_total    decimal   — running total across all months returned
}
```

Months with zero expenses are included if they fall within the project's active date range — this preserves chart continuity on the frontend (no gaps in the timeline).

---

### `GET /projects/:projectId/financial/receipts`

**Purpose:** All receipts attached to this project or any of its tasks.

**Query parameters:**
- `is_categorized` — boolean, optional. Filter by categorization status.
- `ocr_status` — `receipt_ocr_status` enum, optional.
- `page` — integer, default 1.
- `limit` — integer, default 20, max 100.

**Roles:** All roles including Employee — field workers need to see their uploaded receipts.

**Response:** Paginated list of receipt objects:

```
data: [
  {
    id
    project_id
    task_id           — null if attached to project directly
    task_title        — joined if task_id present
    file_url
    file_name
    file_type
    vendor_name
    amount
    receipt_date
    ocr_status
    ocr_vendor
    ocr_amount
    ocr_date
    is_categorized
    financial_entry_id    — null if not yet linked to an entry
    uploaded_by: { id, first_name, last_name }
    created_at
  }
]
meta: { total, page, limit, total_pages }
```

---

### `GET /projects/:projectId/financial/workforce`

**Purpose:** Consolidated workforce financial view — crew hours, crew payments, and subcontractor activity all in one response.

**Query parameters:**
- `date_from` / `date_to` — optional date filters applied to `log_date` / `payment_date`.

**Response:**

```
{
  project_id

  crew_hours: {
    total_regular_hours     decimal
    total_overtime_hours    decimal
    total_hours             decimal
    by_crew_member: [
      {
        crew_member_id
        crew_member_name
        regular_hours       decimal
        overtime_hours      decimal
        total_hours         decimal
        log_count           integer
      }
    ]
  }

  crew_payments: {
    total_paid              decimal
    payment_count           integer
    by_crew_member: [
      {
        crew_member_id
        crew_member_name
        total_paid          decimal
        payment_count       integer
        last_payment_date   date | null
      }
    ]
  }

  subcontractor_invoices: {
    total_invoiced          decimal
    total_paid              decimal
    outstanding             decimal
    by_subcontractor: [
      {
        subcontractor_id
        subcontractor_name
        invoiced            decimal
        paid                decimal
        outstanding         decimal
        invoice_count       integer
        pending_invoices    integer   — count where status = pending
        approved_invoices   integer   — count where status = approved
        paid_invoices       integer   — count where status = paid
      }
    ]
  }
}
```

---

## Service Architecture

### Rebuild: `ProjectFinancialSummaryService`

The existing `getProjectCostSummary()` method is replaced. The service is completely rewritten with the following methods:

| Method | Signature | Notes |
|--------|-----------|-------|
| `getFullSummary` | `(tenantId, projectId, dateFilter?)` | Main summary endpoint — all aggregations |
| `getTaskBreakdown` | `(tenantId, projectId, query)` | Per-task costs |
| `getTimeline` | `(tenantId, projectId, dateFilter?)` | Monthly expense timeline |
| `getReceipts` | `(tenantId, projectId, query)` | Paginated receipt list |
| `getWorkforceSummary` | `(tenantId, projectId, dateFilter?)` | Crew and sub aggregations |
| `validateProjectAccess` | `(tenantId, projectId)` | Private — verifies project belongs to tenant |

**`validateProjectAccess()`** is called at the start of every public method. It queries `project` where `id = projectId AND tenant_id = tenantId`. If not found, throws `NotFoundException`. This single guard prevents all cross-tenant data exposure.

### Query Strategy

All aggregations use **Prisma aggregate queries** (`_sum`, `_count`, `_avg`) rather than loading full records and computing in JavaScript. For the `by_category` breakdown, use `groupBy` on `category_id` with `_sum` on `amount`. This keeps database load minimal even on large projects.

**Exception:** The `by_crew_member` breakdowns in the workforce endpoint require joining `crew_member` for names — use `findMany` with `include` and then aggregate in JavaScript since Prisma's `groupBy` does not support cross-relation joins in a single call.

---

## Business Rules

1. Only `confirmed` (`submission_status = confirmed`) financial entries count toward `actual_cost_confirmed` in margin analysis. Pending entries are counted separately as `actual_cost_total`.
2. All endpoints return zero values (not null) for aggregation fields when no data exists — e.g., `total_expenses: 0`, not `total_expenses: null`. This simplifies frontend rendering.
3. `margin_analysis` fields return `null` when the required denominator is missing or zero — never divide by zero.
4. `revenue_note` is a static string in every `summary` response reminding consumers that revenue-side data is not yet available. This prevents ambiguity.
5. The `tasks` endpoint includes all project tasks, including those with zero financial activity. Zero-value tasks are not filtered out.
6. The `timeline` endpoint includes months with zero expenses within the project's date range. Gaps in the timeline are not allowed.
7. All date filters apply only to `financial_entry.entry_date` — they do not filter `crew_payment_record.payment_date` or `crew_hour_log.log_date` unless the endpoint description specifies otherwise. The workforce endpoint applies date filters to its respective date fields.
8. Access is restricted to Owner, Admin, Manager, and Bookkeeper for all endpoints except `receipts`, which also allows Employee (field workers need to see their uploaded receipts).

---

## Acceptance Criteria

**Project Validation:**
- [ ] All endpoints return 404 if `projectId` does not belong to requesting tenant
- [ ] All endpoints return 404 if project does not exist

**Summary Endpoint:**
- [ ] Returns `contract_value` and `estimated_cost` from project record
- [ ] `cost_by_category` uses correct `classification` values from F-01
- [ ] `by_classification` correctly splits COGS vs operating expense
- [ ] `actual_cost_confirmed` excludes `pending_review` entries
- [ ] `actual_cost_total` includes `pending_review` entries
- [ ] `margin_percent` returns null when `contract_value` is null
- [ ] `margin_percent` returns null when `contract_value` is zero (no divide by zero)
- [ ] `revenue_note` field present in every summary response
- [ ] `date_from` / `date_to` filters correctly scope `financial_entry` results

**Task Breakdown:**
- [ ] All project tasks returned including those with zero costs
- [ ] Each task includes expenses, subcontractor invoices, and crew hours
- [ ] `sort_by=total_cost` orders correctly

**Timeline:**
- [ ] Months with zero expenses included within project date range
- [ ] Each month includes `by_category` breakdown
- [ ] `cumulative_total` is running sum of all months in response

**Receipts:**
- [ ] Returns receipts for project AND receipts linked to project's tasks
- [ ] Employee can access this endpoint
- [ ] `task_title` joined correctly when receipt has `task_id`
- [ ] Pagination works correctly

**Workforce:**
- [ ] `crew_hours.by_crew_member` aggregates correctly
- [ ] `subcontractor_invoices.outstanding` = invoiced − paid
- [ ] `pending_invoices` count correct for each subcontractor
- [ ] Date filters applied to correct date fields per sub-section

**Tests:**
- [ ] Unit test: `validateProjectAccess` — cross-tenant returns 404
- [ ] Unit test: margin calculation with null contract_value
- [ ] Unit test: margin calculation with zero contract_value — no divide by zero
- [ ] Unit test: confirmed vs pending entry separation in cost_summary
- [ ] Unit test: timeline includes zero-expense months in range
- [ ] Integration test: full summary with mixed data sources
- [ ] Integration test: task breakdown with zero-activity tasks included
- [ ] Tenant isolation: cannot access another tenant's project financial data

**Documentation:**
- [ ] `api/documentation/financial_REST_API.md` updated with all 5 new endpoints
- [ ] `revenue_note` field and its intent documented
- [ ] Query strategy (aggregate vs findMany) documented in service comments
- [ ] Known gap documented: revenue-side data deferred to invoicing sprint

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `getFullSummary` runs 6+ separate Prisma queries — slow on large projects | Medium — response latency | Medium | Use Prisma aggregate queries (not findMany) for all summaries. Consider Promise.all() to run independent queries in parallel. Document parallelization approach in service. |
| Prisma `groupBy` limitations with cross-relation joins | Medium — agent writes N+1 queries | Medium | Contract specifies exact strategy per section: groupBy for financial_entry aggregations, findMany+JS-aggregate for crew member breakdowns. |
| `task-financial.service.ts` in projects module may already cover some of this | Low — duplicate endpoints | Low | Agent must read `task-financial.service.ts` before implementing `getTaskBreakdown`. If overlap exists, import from projects module rather than duplicating. |
| Revenue note may confuse consumers who expect invoice data | Low — API consumer confusion | Low | Static `revenue_note` field in response body makes the gap explicit. Also documented in API docs. |

---

## Dependencies

### Requires (must be complete)
- F-01 — `financial_category.classification` field must exist for COGS vs OpEx split
- F-04 — enriched financial entry data used in task breakdown

### Blocks
- F-09 — business dashboard uses project-level summaries
- Future Invoicing Sprint — will add revenue fields to `getFullSummary` response

### Does NOT depend on
- F-02, F-03, F-05, F-06 — no dependency on supplier registry, payment methods, OCR, or recurring rules

---

## File Change Summary

### Files Modified
- `api/src/modules/financial/services/project-financial-summary.service.ts` — full rebuild (was `financial-entry.service.ts` getProjectCostSummary — now its own service)
- `api/src/modules/financial/controllers/project-financial-summary.controller.ts` — add 4 new endpoints, update existing
- `api/src/modules/financial/financial.module.ts` — confirm service registration (may already be registered)
- `api/documentation/financial_REST_API.md` — add all 5 endpoints

### Files Created
- None — this sprint modifies existing files only

### Files That Must NOT Be Modified
- Any file in `api/src/modules/projects/` — read from these tables via PrismaService, do not modify project module files
- Any file in `api/src/modules/quotes/`
- `api/prisma/schema.prisma` — no schema changes
- Any frontend file

---

## Notes for Executing Agent

1. Read `api/src/modules/projects/services/task-financial.service.ts` before implementing `getTaskBreakdown`. If it already aggregates task-level costs, understand its approach and either reuse its logic or import it — do not reimplement the same aggregation twice.

2. Read `api/src/modules/financial/services/financial-entry.service.ts` before modifying `project-financial-summary.service.ts`. The existing `getProjectCostSummary()` method will be replaced — understand what it currently does before deleting it so nothing is accidentally lost.

3. Run all summary queries with `Promise.all()` where queries are independent of each other. For `getFullSummary`, the following groups can run in parallel:
   - Group 1: project record fetch
   - Group 2: financial entry aggregations (total, by_category)
   - Group 3: subcontractor aggregations
   - Group 4: crew aggregations
   - Group 5: receipt count
   Assembling the response after all 5 resolve is the correct pattern.

4. Never return `NaN` from a division operation. Always check the denominator before dividing. Use `null` as the sentinel value for "not computable" margin fields.

5. The `revenue_note` field must be present in every `summary` response regardless of date filters or data state. It is a static string — not computed.

6. Produce 100% API documentation before marking the sprint complete. Document the known gap (no revenue data) explicitly in the API docs for each affected field.