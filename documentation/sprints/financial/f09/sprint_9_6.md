# Sprint 9_6 — API Documentation + Final Verification (STOP Gate)

**Module:** Financial
**File:** `./documentation/sprints/financial/f09/sprint_9_6.md`
**Type:** Documentation + Verification
**Depends On:** Sprint 9_5 must be complete (all tests passing)
**Gate:** FINAL STOP — All F-09 acceptance criteria verified, API documentation complete, migration clean, no regressions
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

This is the FINAL sprint for F-09. Produce complete API documentation for all dashboard endpoints based on the REAL codebase (not assumptions). Then run a comprehensive verification checklist to confirm every acceptance criterion from the F-09 contract is met. No code changes unless defects are found during verification.

---

## Pre-Sprint Checklist

- [ ] Read `api/src/modules/financial/services/dashboard.service.ts` — the REAL implementation
- [ ] Read `api/src/modules/financial/controllers/dashboard.controller.ts` — the REAL controller
- [ ] Read `api/src/modules/financial/dto/pl-query.dto.ts` — all 4 DTOs
- [ ] Read `api/src/modules/financial/dto/ar-query.dto.ts`
- [ ] Read `api/src/modules/financial/dto/ap-query.dto.ts`
- [ ] Read `api/src/modules/financial/dto/forecast-query.dto.ts`
- [ ] Read `api/src/modules/financial/financial.module.ts` — confirm DashboardService and DashboardController are registered
- [ ] Read existing `api/documentation/financial_gate1_REST_API.md` or `api/documentation/financial_REST_API.md` — understand the existing documentation format and style
- [ ] Read `api/src/modules/financial/services/dashboard.service.spec.ts` — confirm all tests pass

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

### Task 1 — Update API Documentation

**What:** Add complete dashboard endpoint documentation to the financial REST API documentation file.

**File:** `api/documentation/financial_REST_API.md`

If this file already exists, ADD a new section. If it does not exist or is named differently (e.g., `financial_gate1_REST_API.md`), create or update the appropriate file. Check the `api/documentation/` directory first.

**CRITICAL:** Document from the REAL codebase. Read each controller method, each DTO, each service method. Do NOT copy from the sprint contract — document what was actually implemented.

**Documentation structure for each endpoint:**

```markdown
### `GET /financial/dashboard/{endpoint}`

**Purpose:** {one sentence}

**Authentication:** Bearer token required

**Roles:** {list actual roles from @Roles() decorator}

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| {name} | {type} | {yes/no} | {value} | {description} |

**Success Response (200):**
```json
{
  // Actual response shape from the service method
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Validation error (invalid parameters) |
| 401 | Missing or invalid token |
| 403 | Insufficient permissions (role not authorized) |

**Example Request:**
```bash
curl -X GET "http://localhost:8000/financial/dashboard/{endpoint}?param=value" \
  -H "Authorization: Bearer {token}"
```
```

**Document ALL 7 endpoints:**
1. `GET /financial/dashboard/overview`
2. `GET /financial/dashboard/pl`
3. `GET /financial/dashboard/ar`
4. `GET /financial/dashboard/ap`
5. `GET /financial/dashboard/forecast`
6. `GET /financial/dashboard/alerts`
7. `GET /financial/dashboard/pl/export`

**Additional documentation sections required:**

**Cash Basis Accounting:**
```markdown
## Cash Basis Accounting Approach

Income is recognized when payment is received (`project_invoice_payment.payment_date`),
not when invoiced. This is cash-basis accounting — the standard approach for small
service businesses. Income appears in the P&L month when the customer's payment was
recorded, regardless of when the invoice was created or sent.

Expenses are recognized by `financial_entry.entry_date`.
```

**Alert Types:**
Document all 8 alert types with their conditions, severity, and title templates. Document the deduplication rules.

**Known Limitations:**
```markdown
## Known Limitations

1. **Crew unpaid estimate**: Always returns 0. Hourly rates are not yet configured
   on crew member records. When rates are added in a future sprint, this field activates.

2. **Cash flow forecast inflows**: Uses invoice `due_date` as expected collection date.
   This is optimistic — actual collection may be delayed. Acceptable for small business
   cash flow planning.

3. **No scheduled reports**: Automated email reports will be added in a future sprint.

4. **No budget planning**: Forecasting beyond recurring rule projections is deferred.

5. **Single currency**: All amounts are in USD. Multi-currency is not supported.
```

---

### Task 2 — Comprehensive Verification Checklist

**What:** Run through EVERY acceptance criterion from the F-09 contract and verify it against the real implementation. This is NOT optional — every item must be checked.

**Start the dev server, get an auth token, and verify each item:**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')
```

---

**OVERVIEW VERIFICATION:**

- [ ] `GET /financial/dashboard/overview` returns all 5 sections (pl_summary, ar_summary, ap_summary, forecast, alerts)
```bash
curl -s http://localhost:8000/financial/dashboard/overview \
  -H "Authorization: Bearer $TOKEN" | jq 'keys'
# Expected: ["alerts","ap_summary","ar_summary","forecast","generated_at","pl_summary"]
```

- [ ] All 5 sub-calls are invoked (verify by checking response has all sections)
- [ ] `generated_at` is present and is a recent datetime

---

**P&L VERIFICATION:**

- [ ] Year request returns 12 months:
```bash
curl -s "http://localhost:8000/financial/dashboard/pl?year=2026" \
  -H "Authorization: Bearer $TOKEN" | jq '.months | length'
# Expected: 12
```

- [ ] Single month request returns 1 month:
```bash
curl -s "http://localhost:8000/financial/dashboard/pl?year=2026&month=3" \
  -H "Authorization: Bearer $TOKEN" | jq '.months | length'
# Expected: 1
```

- [ ] Response includes: `year`, `period`, `currency`, `months`, `totals`
- [ ] Each month includes: `income`, `expenses`, `gross_profit`, `operating_profit`, `net_profit`, `gross_margin_percent`, `tax`
- [ ] `income` includes: `total`, `invoice_count`, `by_project`
- [ ] `expenses` includes: `total`, `total_with_pending`, `total_tax_paid`, `by_classification`, `by_category`, `top_suppliers`
- [ ] `totals` includes: `total_income`, `total_expenses`, `total_gross_profit`, `total_operating_profit`, `total_tax_collected`, `total_tax_paid`, `avg_monthly_income`, `avg_monthly_expenses`, `best_month`, `worst_month`

---

**AR VERIFICATION:**

- [ ] Response includes: `summary`, `aging_buckets`, `invoices`
```bash
curl -s http://localhost:8000/financial/dashboard/ar \
  -H "Authorization: Bearer $TOKEN" | jq 'keys'
```

- [ ] `aging_buckets` has all 5 fields: `current`, `days_1_30`, `days_31_60`, `days_61_90`, `days_over_90`
- [ ] `overdue_only=true` filter works:
```bash
curl -s "http://localhost:8000/financial/dashboard/ar?overdue_only=true" \
  -H "Authorization: Bearer $TOKEN" | jq '.invoices | length'
```

---

**AP VERIFICATION:**

- [ ] Response includes: `summary`, `subcontractor_invoices`, `recurring_upcoming`, `crew_hours_summary`
```bash
curl -s http://localhost:8000/financial/dashboard/ap \
  -H "Authorization: Bearer $TOKEN" | jq 'keys'
```

- [ ] `crew_hours_summary.note` is present
- [ ] `crew_unpaid_estimate` is 0
- [ ] `days_ahead` parameter works:
```bash
curl -s "http://localhost:8000/financial/dashboard/ap?days_ahead=60" \
  -H "Authorization: Bearer $TOKEN" | jq '.summary'
```

---

**FORECAST VERIFICATION:**

- [ ] Returns correct structure with valid days:
```bash
curl -s "http://localhost:8000/financial/dashboard/forecast?days=30" \
  -H "Authorization: Bearer $TOKEN" | jq 'keys'
# Expected: ["expected_inflows","expected_outflows","forecast_end","forecast_start","net_forecast","net_forecast_label","period_days"]
```

- [ ] Returns 400 for invalid days:
```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/financial/dashboard/forecast?days=45" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 400
```

- [ ] `net_forecast_label` is one of: "Positive", "Negative", "Breakeven"

---

**ALERTS VERIFICATION:**

- [ ] Returns correct structure:
```bash
curl -s http://localhost:8000/financial/dashboard/alerts \
  -H "Authorization: Bearer $TOKEN" | jq '{alert_count: .alert_count, types: [.alerts[].type] | unique}'
```

- [ ] Alert IDs are deterministic (call twice, compare):
```bash
ID1=$(curl -s http://localhost:8000/financial/dashboard/alerts -H "Authorization: Bearer $TOKEN" | jq '[.alerts[].id]')
ID2=$(curl -s http://localhost:8000/financial/dashboard/alerts -H "Authorization: Bearer $TOKEN" | jq '[.alerts[].id]')
echo "IDs match: $([ "$ID1" = "$ID2" ] && echo YES || echo NO)"
```

- [ ] Alerts are ordered: critical first, then warning, then info:
```bash
curl -s http://localhost:8000/financial/dashboard/alerts \
  -H "Authorization: Bearer $TOKEN" | jq '[.alerts[].severity]'
# Expected: all "critical" before all "warning" before all "info"
```

---

**EXPORT VERIFICATION:**

- [ ] CSV downloads with correct headers:
```bash
curl -s "http://localhost:8000/financial/dashboard/pl/export?year=2026" \
  -H "Authorization: Bearer $TOKEN" -D - -o /tmp/pl-test.csv 2>&1 | head -5
# Check Content-Type: text/csv
# Check Content-Disposition: attachment; filename="pl-2026.csv"
```

- [ ] CSV has two sections separated by blank row:
```bash
cat /tmp/pl-test.csv | head -20
# First row should be: Month,Total Income,...
# After monthly data, blank row
# Then: Month,Date,Category,...
```

---

**RBAC VERIFICATION:**

- [ ] Employee access returns 403 on all endpoints (test if Employee account available)
- [ ] Manager can access AR and AP but NOT P&L, Forecast, Alerts, Overview

---

**UNIT TESTS VERIFICATION:**

- [ ] All DashboardService tests pass:
```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern=dashboard.service.spec --verbose
```

- [ ] All existing financial tests still pass:
```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern=financial --verbose
```

---

**SWAGGER VERIFICATION:**

- [ ] All 7 dashboard endpoints appear in Swagger:
```bash
curl -s http://localhost:8000/api/docs-json | jq '.paths | keys | map(select(contains("dashboard")))'
```

---

**CODE QUALITY VERIFICATION:**

- [ ] No `NaN`, `Infinity`, or `-Infinity` can be returned (check service code for division operations)
- [ ] All Prisma queries include `tenant_id` (grep service code)
- [ ] No `findMany()` + `reduce()` for monetary aggregations (should use `_sum`, `groupBy`)
- [ ] `Promise.all()` used for independent queries in getPL, getAP, getAlerts, getOverview
- [ ] No modifications to any existing financial service files (only new files created + financial.module.ts updated)
- [ ] No modifications to any file in `api/src/modules/projects/` or `api/src/modules/quotes/`
- [ ] No Prisma schema changes (`schema.prisma` unchanged)
- [ ] No frontend files modified

---

### Task 3 — Fix Any Defects Found

**What:** If any verification step fails, fix the defect in the appropriate file.

**Rules:**
- Fix ONLY the defect — no refactoring, no "improvements"
- Re-run the specific verification after fixing
- Re-run unit tests after any code change
- Document what was fixed

---

### Task 4 — Final Cleanup

- [ ] Remove any temporary test files (e.g., `pl-test.csv`)
- [ ] Verify no console.log statements left in service or controller code
- [ ] Verify no commented-out code left behind
- [ ] Confirm `financial.module.ts` is clean (no duplicate entries)

---

## Acceptance Criteria (FINAL — ALL MUST PASS)

### From F-09 Contract:

**Overview:**
- [ ] `GET /financial/dashboard/overview` returns all 5 sections in one response
- [ ] All 5 sub-calls run in parallel (verified in code — `Promise.all()`)
- [ ] Employee access returns 403

**P&L:**
- [ ] Income computed from `project_invoice_payment.payment_date` (cash basis)
- [ ] Expenses split correctly by `classification` (cost_of_goods_sold vs operating_expense)
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
- [ ] Known deferred items documented: scheduled reports, budget planning

### Files Created in F-09:
- [ ] `api/src/modules/financial/services/dashboard.service.ts`
- [ ] `api/src/modules/financial/services/dashboard.service.spec.ts`
- [ ] `api/src/modules/financial/controllers/dashboard.controller.ts`
- [ ] `api/src/modules/financial/dto/pl-query.dto.ts`
- [ ] `api/src/modules/financial/dto/ar-query.dto.ts`
- [ ] `api/src/modules/financial/dto/ap-query.dto.ts`
- [ ] `api/src/modules/financial/dto/forecast-query.dto.ts`

### Files Modified in F-09:
- [ ] `api/src/modules/financial/financial.module.ts` — DashboardService + DashboardController added

### Files NOT Modified (verify):
- [ ] `api/prisma/schema.prisma` — NO changes
- [ ] No files in `api/src/modules/projects/`
- [ ] No files in `api/src/modules/quotes/`
- [ ] No existing financial service files
- [ ] No frontend files

---

## Gate Marker

**FINAL STOP** — F-09 is complete ONLY when:
1. All acceptance criteria above are checked and passing
2. API documentation is complete and based on real code
3. All unit tests pass
4. No existing tests broken
5. No compilation errors
6. Dev server shut down
7. Port 8000 is free

---

## Sprint F-09 Completion Report

After all verification passes, produce this summary:

```markdown
## F-09 Completion Report — Business Financial Dashboard

**Status:** ✅ Complete

### Files Created
- api/src/modules/financial/services/dashboard.service.ts
- api/src/modules/financial/services/dashboard.service.spec.ts
- api/src/modules/financial/controllers/dashboard.controller.ts
- api/src/modules/financial/dto/pl-query.dto.ts
- api/src/modules/financial/dto/ar-query.dto.ts
- api/src/modules/financial/dto/ap-query.dto.ts
- api/src/modules/financial/dto/forecast-query.dto.ts

### Files Modified
- api/src/modules/financial/financial.module.ts (added DashboardService, DashboardController)

### Endpoints
| Method | Path | Roles |
|--------|------|-------|
| GET | /financial/dashboard/overview | Owner, Admin, Bookkeeper |
| GET | /financial/dashboard/pl | Owner, Admin, Bookkeeper |
| GET | /financial/dashboard/ar | Owner, Admin, Manager, Bookkeeper |
| GET | /financial/dashboard/ap | Owner, Admin, Manager, Bookkeeper |
| GET | /financial/dashboard/forecast | Owner, Admin, Bookkeeper |
| GET | /financial/dashboard/alerts | Owner, Admin, Bookkeeper |
| GET | /financial/dashboard/pl/export | Owner, Admin, Bookkeeper |

### Tests
- Dashboard unit tests: [count] tests passing
- Existing financial tests: All passing, no regressions

### Known Limitations
- crew_unpaid_estimate = 0 (hourly rates not yet on crew_member)
- Cash flow forecast uses optimistic invoice due_date for inflows
- No scheduled email reports (deferred)
- No budget planning (deferred)
- Single currency (USD only)

### Schema Changes
- NONE — no migrations in F-09

### Blocks
- F-10 (Export readiness) can now proceed
```
