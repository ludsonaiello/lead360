# Sprint F-09 — Business Financial Dashboard

**Module**: Financial  
**Sprint**: F-09  
**Status**: Ready for Development  
**Type**: New Feature — Aggregation API + Read-Only Endpoints  
**Estimated Complexity**: High  
**Prerequisites**:
- Sprint F-01 must be complete (classification field on categories)
- Sprint F-04 must be complete (expense entries with submission_status)
- Sprint F-06 must be complete (recurring rules and `getPreview()` available)
- Sprint F-08 must be complete (invoice and payment tables exist)

---

## Purpose

F-07 gave project managers financial intelligence at the project level. F-09 gives business owners financial intelligence at the business level — across all projects, all overhead, all income, all recurring obligations.

A roofing company owner needs to answer questions like: "How much did we spend last month?" "What is my gross margin across all active jobs?" "What invoices are overdue?" "What bills are coming due in the next 30 days?" "Am I profitable this year?" Today none of these questions are answerable without a spreadsheet. F-09 makes them answerable in a single dashboard API call.

This sprint builds five interconnected aggregation endpoints:

1. **Monthly P&L** — income vs. expenses, COGS vs. operating expense, net profit by month
2. **Accounts Receivable Summary** — open invoices across all projects, aging buckets, overdue alerts
3. **Accounts Payable Awareness** — upcoming recurring expenses, unsettled subcontractor invoices, unpaid crew payroll
4. **Cash Flow Forecast** — next 30/60/90 days of expected inflows and outflows
5. **Financial Health Alerts** — automated flags for cost overruns, overdue invoices, and upcoming obligations

No new tables are created. All data already exists across: `financial_entry`, `financial_category`, `project`, `project_invoice`, `project_invoice_payment`, `subcontractor_task_invoice`, `subcontractor_payment_record`, `crew_payment_record`, `crew_hour_log`, `recurring_expense_rule`.

---

## Scope

### In Scope

- `GET /financial/dashboard/pl` — Monthly P&L report
- `GET /financial/dashboard/ar` — Accounts receivable summary
- `GET /financial/dashboard/ap` — Accounts payable awareness
- `GET /financial/dashboard/forecast` — Cash flow forecast
- `GET /financial/dashboard/alerts` — Financial health alerts
- `GET /financial/dashboard/overview` — Single combined endpoint (calls all five above internally, returns unified response)
- Tax summary within P&L: tax collected on invoices, tax paid on purchases
- Export endpoint: `GET /financial/dashboard/pl/export` — CSV of P&L data
- All endpoints are read-only — no data is created or modified
- 100% API documentation
- Full test coverage

### Out of Scope

- No chart rendering (frontend concern)
- No scheduled email reports (future sprint)
- No multi-currency support
- No budget planning or forecasting beyond what recurring rules provide
- No frontend implementation
- No changes to any existing table

---

## Platform Architecture Patterns (Mandatory)

- **Tenant isolation**: Every aggregation must be scoped to `tenant_id`. No cross-tenant data.
- **TenantId decorator**: `@TenantId()` on all controller methods.
- **Read-only**: No audit logging needed — reads are not audited.
- **Role restriction**: All dashboard endpoints are restricted to Owner, Admin, Bookkeeper. Manager can access AR and AP. Employee has no access to any dashboard endpoint.
- **Performance**: All aggregations use Prisma `_sum`, `_count`, `groupBy` — never load full record sets into memory. Use `Promise.all()` for independent queries. Document parallelization approach in service.
- **No migrations**: All tables used already exist from F-01 through F-08.

---

## Data Source Map

| Endpoint | Primary Tables |
|----------|---------------|
| P&L | `financial_entry` + `financial_category` + `project_invoice` + `project_invoice_payment` |
| AR | `project_invoice` + `project` |
| AP | `subcontractor_task_invoice` + `subcontractor_payment_record` + `crew_payment_record` + `recurring_expense_rule` |
| Forecast | `project_invoice` (expected inflows) + `recurring_expense_rule.getPreview()` (expected outflows) |
| Alerts | All of the above |

---

## API Specification

### `GET /financial/dashboard/overview`

**Purpose:** Single endpoint for the main dashboard screen. Calls all five sub-endpoints internally and returns a unified response. Frontend only needs one API call to populate the entire dashboard.

**Query parameters:** Same as individual endpoints — `date_from`, `date_to`, `forecast_days` (30/60/90, default 30).

**Response:**
```
{
  pl_summary:       { ...see P&L response below, current_month only }
  ar_summary:       { ...see AR response below }
  ap_summary:       { ...see AP response below }
  forecast:         { ...see forecast response, 30-day only }
  alerts:           [ ...see alerts response ]
  generated_at:     datetime
}
```

**Implementation:** The `DashboardService.getOverview()` method runs all five sub-service calls in parallel via `Promise.all()`. It does not call the HTTP endpoints — it calls the service methods directly.

---

### `GET /financial/dashboard/pl`

**Purpose:** Monthly Profit & Loss report for the business.

**Roles:** Owner, Admin, Bookkeeper only.

**Query parameters:**
- `year` — integer, required. The calendar year to report on (e.g., 2026).
- `month` — integer, optional (1–12). If provided, returns only that month. If omitted, returns all 12 months.
- `include_pending` — boolean, optional, default false. If true, includes `pending_review` entries in expense totals.

**Response:**

```
{
  year:               integer
  period:             "monthly" | "single_month"
  currency:           "USD"

  months: [
    {
      year:           integer
      month:          integer
      month_label:    string      — "Jan 2026"

      income: {
        total:                  decimal   — sum of project_invoice_payment.amount (payments received in this month)
        invoice_count:          integer   — invoices that received payment this month
        by_project: [
          { project_id, project_name, project_number, collected }
        ]
      }

      expenses: {
        total:                  decimal   — sum of confirmed financial_entry.amount in this month
        total_with_pending:     decimal   — includes pending_review entries
        total_tax_paid:         decimal   — sum of financial_entry.tax_amount

        by_classification: {
          cost_of_goods_sold:   decimal
          operating_expense:    decimal
        }

        by_category: [
          {
            category_id
            category_name
            category_type
            classification
            total
            entry_count
          }
        ]

        top_suppliers: [
          { supplier_id, supplier_name, total, transaction_count }
        ]   — top 5 suppliers by spend this month
      }

      gross_profit:             decimal   — income.total - expenses.by_classification.cost_of_goods_sold
      operating_profit:         decimal   — gross_profit - expenses.by_classification.operating_expense
      net_profit:               decimal   — operating_profit (same for now — no tax line yet)
      gross_margin_percent:     decimal | null   — (gross_profit / income.total) * 100

      tax: {
        tax_collected:          decimal   — sum of project_invoice.tax_amount for invoices with payment this month
        tax_paid:               decimal   — sum of financial_entry.tax_amount this month
        net_tax_position:       decimal   — tax_collected - tax_paid
      }
    }
  ]

  totals: {
    total_income:               decimal   — sum across all months
    total_expenses:             decimal
    total_gross_profit:         decimal
    total_operating_profit:     decimal
    total_tax_collected:        decimal
    total_tax_paid:             decimal
    avg_monthly_income:         decimal
    avg_monthly_expenses:       decimal
    best_month:                 { month_label, net_profit }
    worst_month:                { month_label, net_profit }
  }
}
```

**Income definition:** Income is recognized when payment is received (`project_invoice_payment.payment_date` falls in the month), not when invoiced. This is cash-basis accounting — correct for small service businesses.

**Expense definition:** Expenses are recognized by `financial_entry.entry_date`. Only `submission_status = confirmed` entries count unless `include_pending = true`.

**Months with no activity:** Include all 12 months in the year response even if a month has zero income and zero expenses. This preserves chart continuity.

---

### `GET /financial/dashboard/ar`

**Purpose:** Accounts receivable — all money owed to the business across all projects.

**Roles:** Owner, Admin, Manager, Bookkeeper.

**Query parameters:**
- `status` — `invoice_status_extended` enum, optional. Default: returns all non-voided invoices.
- `overdue_only` — boolean, optional. If true, returns only invoices past `due_date`.

**Response:**

```
{
  summary: {
    total_invoiced:             decimal   — sum of all non-voided invoice amounts
    total_collected:            decimal   — sum of all payments received
    total_outstanding:          decimal   — total_invoiced - total_collected
    total_overdue:              decimal   — outstanding on invoices past due_date
    invoice_count:              integer
    overdue_count:              integer
    avg_days_outstanding:       decimal   — average age of open invoices in days
  }

  aging_buckets: {
    current:                    decimal   — outstanding on invoices not yet due
    days_1_30:                  decimal   — overdue 1–30 days
    days_31_60:                 decimal   — overdue 31–60 days
    days_61_90:                 decimal   — overdue 61–90 days
    days_over_90:               decimal   — overdue 90+ days
  }

  invoices: [
    {
      invoice_id
      invoice_number
      project_id
      project_name
      project_number
      amount
      amount_paid
      amount_due
      status
      due_date
      days_outstanding:         integer   — days since invoice was sent (null if not sent)
      days_overdue:             integer | null   — days past due_date (null if not overdue)
      is_overdue:               boolean
    }
  ]
}
```

**Aging bucket logic:** Based on `due_date`. If `due_date` is null, the invoice is classified as `current` regardless of age.

**Invoice list:** All non-voided invoices with `amount_due > 0`. Ordered by `days_overdue DESC` (most overdue first), then `amount_due DESC`.

---

### `GET /financial/dashboard/ap`

**Purpose:** Accounts payable awareness — what the business owes and when it is due.

**Roles:** Owner, Admin, Manager, Bookkeeper.

**Query parameters:**
- `days_ahead` — integer, optional. Default 30. How many days ahead to look for upcoming obligations.

**Response:**

```
{
  summary: {
    subcontractor_outstanding:  decimal   — sum of unpaid sub invoices (invoiced - paid)
    crew_unpaid_estimate:       decimal   — sum of crew_hour_log hours * estimated rate (informational only — no rate data yet, show 0)
    recurring_upcoming:         decimal   — sum of recurring rule amounts due within days_ahead
    total_ap_estimate:          decimal   — subcontractor_outstanding + recurring_upcoming
  }

  subcontractor_invoices: {
    total_pending:              decimal   — sum where status = pending
    total_approved:             decimal   — sum where status = approved (approved but not paid)
    total_outstanding:          decimal   — pending + approved
    invoice_count:              integer

    by_subcontractor: [
      {
        subcontractor_id
        subcontractor_name
        pending_amount:         decimal
        approved_amount:        decimal
        outstanding:            decimal
        oldest_invoice_date:    date | null
      }
    ]
  }

  recurring_upcoming: [
    {
      rule_id
      rule_name
      amount
      due_date
      frequency
      supplier_name:            string | null
      category_name:            string
      days_until_due:           integer
    }
  ]   — from RecurringExpenseService.getPreview(), next `days_ahead` days only

  crew_hours_summary: {
    note: "Crew payment estimates require hourly rates to be configured. This section shows hours only."
    total_regular_hours_this_month:     decimal
    total_overtime_hours_this_month:    decimal
    crew_member_count:                  integer
  }
}
```

**Note on crew_unpaid_estimate:** The `crew_member` table does not have hourly rate fields in the confirmed schema. Set `crew_unpaid_estimate = 0` and include the note in `crew_hours_summary`. This is an honest placeholder — when rates are added in a future sprint, this field activates.

---

### `GET /financial/dashboard/forecast`

**Purpose:** Cash flow forecast — expected money in and out over the next 30/60/90 days.

**Roles:** Owner, Admin, Bookkeeper.

**Query parameters:**
- `days` — integer, required. Must be 30, 60, or 90.

**Response:**

```
{
  period_days:                  integer
  forecast_start:               date
  forecast_end:                 date

  expected_inflows: {
    total:                      decimal
    items: [
      {
        type:                   "invoice_due"
        invoice_id
        invoice_number
        project_name
        amount_due
        due_date
        days_until_due:         integer
      }
    ]
  }   — invoices with due_date within the period and amount_due > 0

  expected_outflows: {
    total:                      decimal
    items: [
      {
        type:                   "recurring_expense"
        rule_id
        rule_name
        amount
        due_date
        days_until_due:         integer
        supplier_name:          string | null
        category_name:          string
      }
    ]
  }   — from RecurringExpenseService.getPreview(tenantId, days)

  net_forecast:                 decimal   — expected_inflows.total - expected_outflows.total
  net_forecast_label:           "Positive" | "Negative" | "Breakeven"
}
```

**Inflow logic:** Query `project_invoice` where `due_date BETWEEN forecast_start AND forecast_end` and `amount_due > 0` and `status != voided`. These are invoices the business expects to collect.

**Outflow logic:** Call `RecurringExpenseService.getPreview(tenantId, days)` — already built in F-06. Returns all recurring rule occurrences within the period.

**`net_forecast_label`:**
- `net_forecast > 100`: "Positive"
- `net_forecast < -100`: "Negative"
- `-100 <= net_forecast <= 100`: "Breakeven"

---

### `GET /financial/dashboard/alerts`

**Purpose:** Automated financial health alerts. Flags conditions that require the business owner's attention.

**Roles:** Owner, Admin, Bookkeeper.

**No query parameters.**

**Response:**

```
{
  alert_count:                  integer
  alerts: [
    {
      id:                       string    — deterministic ID: "{type}_{entity_id}"
      type:                     alert_type enum
      severity:                 "critical" | "warning" | "info"
      title:                    string
      message:                  string
      entity_type:              "project" | "invoice" | "recurring_rule" | "subcontractor_invoice"
      entity_id:                string
      entity_name:              string
      amount:                   decimal | null
      action_url:               string | null   — relative path for frontend navigation
      created_at:               datetime    — when the condition was first detectable (not stored — computed)
    }
  ]
}
```

**Alert types enum (`alert_type`):**

| Type | Severity | Condition | Title Template |
|------|----------|-----------|----------------|
| `invoice_overdue` | critical | Invoice `due_date < TODAY` and `amount_due > 0` | "Invoice {invoice_number} is overdue" |
| `invoice_overdue_30` | warning | Invoice overdue 30+ days | "Invoice {invoice_number} is 30+ days overdue" |
| `invoice_overdue_60` | critical | Invoice overdue 60+ days | "Invoice {invoice_number} is 60+ days overdue" |
| `sub_invoice_pending` | warning | `subcontractor_task_invoice` with `status = pending` older than 7 days | "Subcontractor invoice from {sub_name} awaiting approval" |
| `recurring_due_soon` | info | Recurring rule with `next_due_date <= TODAY + 3` | "{rule_name} is due in {n} days" |
| `recurring_overdue` | critical | Recurring rule with `next_due_date < TODAY` and `status = active` | "{rule_name} recurring expense is overdue" |
| `expense_pending_review` | info | More than 5 `financial_entry` records with `submission_status = pending_review` | "{count} expenses awaiting your review" |
| `project_no_invoice` | warning | Project with `status = in_progress` and `progress_percent >= 50` and zero non-voided invoices | "Project {name} is 50%+ complete with no invoice sent" |

**Alert generation rules:**
- Alerts are computed fresh on every request — they are not stored in the database.
- Each alert has a deterministic `id` constructed from its type and entity: `invoice_overdue_INV-0042`. This allows the frontend to deduplicate and track dismissed alerts client-side if needed.
- Alerts are ordered: `critical` first, then `warning`, then `info`. Within each severity, ordered by `amount DESC`.
- Maximum 50 alerts returned. If more than 50 conditions exist, the most critical/largest-amount ones are returned and a meta field `total_alerts_truncated: true` is included.
- An invoice that is both `invoice_overdue` and `invoice_overdue_30` generates only the more severe alert (`invoice_overdue_30`), not both.

---

### `GET /financial/dashboard/pl/export`

**Purpose:** Export the P&L data as CSV for the accountant.

**Roles:** Owner, Admin, Bookkeeper.

**Query parameters:** Same as `GET /financial/dashboard/pl`.

**Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="pl-{year}.csv"`.

**CSV structure — two sections separated by a blank row:**

Section 1 — Monthly Summary:
```
Month, Total Income, Total Expenses (Confirmed), COGS, Operating Expense, Gross Profit, Net Profit, Tax Collected, Tax Paid
```

Section 2 — Expense Detail:
```
Month, Date, Category, Classification, Supplier/Vendor, Amount, Tax, Payment Method, Project, Notes
```

---

## Service Architecture

### `DashboardService`

Location: `api/src/modules/financial/services/dashboard.service.ts`

| Method | Signature | Notes |
|--------|-----------|-------|
| `getOverview` | `(tenantId, query)` | Parallel calls to all 5 sub-methods |
| `getPL` | `(tenantId, year, month?, includePending?)` | Monthly P&L aggregation |
| `getAR` | `(tenantId, query)` | AR summary with aging |
| `getAP` | `(tenantId, daysAhead)` | AP awareness |
| `getForecast` | `(tenantId, days)` | Cash flow forecast |
| `getAlerts` | `(tenantId)` | Alert generation |
| `exportPL` | `(tenantId, year, month?)` | Returns CSV buffer |

**`getOverview()` parallelization:**
```
const [pl, ar, ap, forecast, alerts] = await Promise.all([
  this.getPL(tenantId, currentYear, currentMonth),
  this.getAR(tenantId, {}),
  this.getAP(tenantId, 30),
  this.getForecast(tenantId, 30),
  this.getAlerts(tenantId),
]);
```

`DashboardService` injects `RecurringExpenseService` (from F-06) to call `getPreview()`. This requires `FinancialModule` to have `RecurringExpenseService` already registered (it is, from F-06).

---

## Business Rules

1. Income is recognized on cash basis: when payment is received, not when invoiced.
2. Only `confirmed` expense entries count toward P&L expenses by default. `pending_review` entries are shown separately when `include_pending = true`.
3. All P&L calculations exclude voided invoices.
4. Aging buckets are based on `due_date`, not invoice creation date. Invoices without a `due_date` are classified as `current`.
5. Alerts are recomputed on every request — they are never stored. The `id` field is deterministic so the frontend can track them without server storage.
6. Maximum 50 alerts per response — critical and warning take priority over info.
7. The `crew_unpaid_estimate` is always `0` until hourly rates exist on crew member records. This is explicitly documented as a known limitation.
8. Cash flow forecast inflows use invoice `due_date` as the expected collection date — this is optimistic but acceptable for small business cash flow planning.
9. Recurring rule outflows in the forecast use `next_due_date` from the rule — sourced directly from `getPreview()`.
10. All monetary values are returned as decimals with 2 decimal places. Never return raw floats that could produce rounding artifacts.
11. Months with zero activity are included in the P&L year view — no gaps in the monthly array.

---

## Acceptance Criteria

**Overview:**
- [ ] `GET /financial/dashboard/overview` returns all 5 sections in one response
- [ ] All 5 sub-calls run in parallel (verify with timing test)
- [ ] Employee access returns 403

**P&L:**
- [ ] Income computed from `project_invoice_payment.payment_date` (cash basis)
- [ ] Expenses split correctly by `classification` (F-01 field)
- [ ] `gross_profit = income - COGS`
- [ ] `operating_profit = gross_profit - operating_expense`
- [ ] All 12 months present in year view even if zero activity
- [ ] `include_pending = true` adds pending entries to `total_with_pending` (not `total`)
- [ ] `tax_collected` sourced from invoice tax, `tax_paid` from entry tax
- [ ] `totals` block sums correctly across all months

**AR:**
- [ ] Aging buckets correct based on `due_date`
- [ ] Invoice without `due_date` classified as `current`
- [ ] `days_overdue` null for non-overdue invoices
- [ ] Voided invoices excluded
- [ ] List ordered by `days_overdue DESC`, then `amount_due DESC`

**AP:**
- [ ] Subcontractor outstanding = sum of (invoiced - paid) per sub
- [ ] `recurring_upcoming` sourced from `RecurringExpenseService.getPreview()`
- [ ] `crew_unpaid_estimate = 0` with correct note
- [ ] `days_ahead` param filters recurring correctly

**Forecast:**
- [ ] Inflows = invoices with `due_date` in period and `amount_due > 0`
- [ ] Outflows sourced from `RecurringExpenseService.getPreview()`
- [ ] `net_forecast_label` correct for positive/negative/breakeven
- [ ] Only 30/60/90 accepted for `days` param — 400 for other values

**Alerts:**
- [ ] `invoice_overdue` fires for invoices past `due_date`
- [ ] `invoice_overdue_30` fires only for 30+ day overdue (not both overdue alerts)
- [ ] `recurring_overdue` fires for active rules with `next_due_date < TODAY`
- [ ] `project_no_invoice` fires for in-progress projects 50%+ complete with no invoice
- [ ] Alert IDs are deterministic and consistent across calls
- [ ] Max 50 alerts, critical/warning before info
- [ ] Alerts are computed fresh — not cached or stored

**Export:**
- [ ] CSV has both sections (monthly summary + expense detail)
- [ ] Correct `Content-Disposition` header
- [ ] Voided invoices excluded from income

**Tests:**
- [ ] Unit test: P&L cash basis — payment in different month than invoice
- [ ] Unit test: aging bucket assignment — all 5 buckets
- [ ] Unit test: alert deduplication — `invoice_overdue_30` suppresses `invoice_overdue`
- [ ] Unit test: `net_forecast_label` thresholds
- [ ] Unit test: P&L zero months included
- [ ] Integration test: `getOverview()` parallel execution
- [ ] Tenant isolation: all aggregations scoped to tenant

**Documentation:**
- [ ] `api/documentation/financial_REST_API.md` updated with all endpoints
- [ ] Cash basis accounting approach documented
- [ ] Alert type table documented with all conditions
- [ ] `crew_unpaid_estimate = 0` limitation documented
- [ ] Known deferred items: scheduled reports, budget planning

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `getOverview()` slow if any sub-query is slow | High — dashboard load time degraded | Medium | All 5 sub-calls run in parallel via `Promise.all()`. Add response time logging. Document acceptable threshold: < 500ms total. |
| Alert computation scans multiple tables on every request | Medium — performance at scale | Low for MVP tenant sizes | Max 50 alerts hard cap. All queries use indexed fields. Document that caching may be needed at > 1000 projects/invoices per tenant. |
| `crew_unpaid_estimate` returns 0 — business owner confused | Low — UI confusion | Medium | Explicit `note` field in response explains the limitation. Frontend must display the note. |
| P&L gross_margin_percent divide by zero when income = 0 | Medium — NaN returned | Medium | Explicit null-check before division — return `null` not `NaN` when income is zero. |
| Tax calculation mixes invoice tax and entry tax — different concepts | Low — accountant confusion | Low | Document clearly: `tax_collected` = tax charged to customers (from invoices), `tax_paid` = tax paid to suppliers (from entries). Two different flows. |

---

## Dependencies

### Requires (must be complete)
- F-01 — `classification` field on `financial_category`
- F-04 — `submission_status` on `financial_entry`
- F-06 — `RecurringExpenseService.getPreview()` for AP and forecast outflows
- F-08 — `project_invoice` and `project_invoice_payment` tables for income, AR, and forecast

### Blocks
- F-10 — Export readiness uses P&L data structures

### Runs in parallel with
- Nothing — F-09 is the last aggregation sprint before F-10

---

## File Change Summary

### Files Created
- `api/src/modules/financial/services/dashboard.service.ts`
- `api/src/modules/financial/controllers/dashboard.controller.ts`
- `api/src/modules/financial/dto/pl-query.dto.ts`
- `api/src/modules/financial/dto/ar-query.dto.ts`
- `api/src/modules/financial/dto/ap-query.dto.ts`
- `api/src/modules/financial/dto/forecast-query.dto.ts`

### Files Modified
- `api/src/modules/financial/financial.module.ts` — register `DashboardService` and `DashboardController`
- `api/documentation/financial_REST_API.md` — add all dashboard endpoints

### Files That Must NOT Be Modified
- Any file in `api/src/modules/projects/`
- Any file in `api/src/modules/quotes/`
- `api/prisma/schema.prisma` — no schema changes in this sprint
- Any existing financial service files
- Any frontend file

---

## Notes for Executing Agent

1. `DashboardService` injects `RecurringExpenseService` for `getPreview()`. Verify `RecurringExpenseService` is exported from `FinancialModule` (it should be from F-06). If not, add the export before implementing dashboard.

2. All monetary aggregations must use Prisma's `_sum` aggregate — never `findMany()` followed by JavaScript `reduce()`. The difference between correct and incorrect performance at scale is this single decision.

3. The `getAlerts()` method runs multiple targeted queries — one per alert type. These can run in parallel via `Promise.all()`. Each alert type query should be a separate private method for testability.

4. Alert deduplication rule: if `invoice_overdue_30` fires for an invoice, do NOT also include `invoice_overdue` for the same invoice. Implement by first computing the more-specific alert and excluding that invoice from the more-general alert query. Pattern: query overdue-30+ invoices first, collect their IDs, then query overdue invoices excluding those IDs.

5. The P&L `totals` block is computed from the `months` array in JavaScript after all DB queries complete — it is a reduce/sum operation over the month objects, not a separate DB query.

6. Never return `NaN` from any calculation. Null-check every denominator before division. Use `null` to mean "not computable", never `NaN` or `Infinity`.

7. The `overview` endpoint's response shape wraps the five sub-responses — the controller calls `DashboardService.getOverview()` which handles the parallel execution internally. The controller does not orchestrate parallelism directly.

8. Produce 100% API documentation before marking the sprint complete.