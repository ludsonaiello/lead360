# Sprint 1b — TypeScript Types (Extended: Recurring, Milestones, Invoices, Summary, Dashboard, Exports)
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_1b.md
**Type:** Frontend — Foundation (Types Part 2 of 2)
**Depends On:** Sprint 1a
**Gate:** STOP — Sprint 1c depends on ALL types being complete
**Estimated Complexity:** Medium

---

## Objective

Add the remaining TypeScript type definitions to the financial types file started in Sprint 1a. This sprint covers: Recurring Expense Rules, Draw Milestones, Project Invoices, Project Financial Summary (F-07), Financial Dashboard, and Account Mappings & Exports.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation at `/var/www/lead360.app/api/documentation/financial_REST_API.md` — Sections 12-23.
- **Follow the exact same patterns** already used in the codebase. Read existing files first.
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Pre-Sprint Checklist
- [ ] Sprint 1a COMPLETE — types file has enums + core types
- [ ] Read `/var/www/lead360.app/app/src/lib/types/financial.ts` — verify Sprint 1a output
- [ ] Read API doc sections 12-23 for response field verification

---

## Dev Server (Backend — Read Only)

```
Ensure backend running on port 8000.

TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Verify response shapes for types in this sprint:

# Recurring Rules
curl -s "http://localhost:8000/api/v1/financial/recurring-rules?limit=1" -H "Authorization: Bearer $TOKEN" | jq '.'

# Recurring Preview
curl -s "http://localhost:8000/api/v1/financial/recurring-rules/preview?days=30" -H "Authorization: Bearer $TOKEN" | jq '.'

# Dashboard overview (all-in-one)
curl -s "http://localhost:8000/api/v1/financial/dashboard/overview" -H "Authorization: Bearer $TOKEN" | jq '.'

# Dashboard P&L
curl -s "http://localhost:8000/api/v1/financial/dashboard/pl?year=2026" -H "Authorization: Bearer $TOKEN" | jq '.'

# Dashboard AR
curl -s "http://localhost:8000/api/v1/financial/dashboard/ar" -H "Authorization: Bearer $TOKEN" | jq '.'

# Dashboard AP
curl -s "http://localhost:8000/api/v1/financial/dashboard/ap" -H "Authorization: Bearer $TOKEN" | jq '.'

# Dashboard Forecast
curl -s "http://localhost:8000/api/v1/financial/dashboard/forecast?days=30" -H "Authorization: Bearer $TOKEN" | jq '.'

# Dashboard Alerts
curl -s "http://localhost:8000/api/v1/financial/dashboard/alerts" -H "Authorization: Bearer $TOKEN" | jq '.'

# Account Mappings
curl -s "http://localhost:8000/api/v1/financial/export/account-mappings" -H "Authorization: Bearer $TOKEN" | jq '.'

# Default Mappings
curl -s "http://localhost:8000/api/v1/financial/export/account-mappings/defaults?platform=quickbooks" -H "Authorization: Bearer $TOKEN" | jq '.'

# Export History
curl -s "http://localhost:8000/api/v1/financial/export/history" -H "Authorization: Bearer $TOKEN" | jq '.'

# Quality Report
curl -s "http://localhost:8000/api/v1/financial/export/quality-report" -H "Authorization: Bearer $TOKEN" | jq '.'

# Project Financial Summary (use a real project ID)
curl -s "http://localhost:8000/api/v1/projects/f87e2a4c-a745-45c8-a47d-90f7fc4e8285/financial/summary" -H "Authorization: Bearer $TOKEN" | jq '.'

# Milestones
curl -s "http://localhost:8000/api/v1/projects/f87e2a4c-a745-45c8-a47d-90f7fc4e8285/milestones" -H "Authorization: Bearer $TOKEN" | jq '.'

# Project Invoices
curl -s "http://localhost:8000/api/v1/projects/f87e2a4c-a745-45c8-a47d-90f7fc4e8285/invoices" -H "Authorization: Bearer $TOKEN" | jq '.'
```

Use the LIVE response as source of truth. Document any differences.

---

## Tasks

### Task 1 — Add Remaining Types to Financial Types File

**File:** `/var/www/lead360.app/app/src/lib/types/financial.ts`

**APPEND** (do not replace) the following sections to the end of the file created in Sprint 1a.

Add these sections in order:

**Section 9 — Recurring Expense Rules** (API Section 12):
- `RecurringRule` — 30 fields including nested `category`, `supplier`, `payment_method` objects
- `RecurringRuleDetail` — extends RecurringRule with `last_generated_entry` and `next_occurrence_preview`
- `RecurringRuleListResponse` — paginated with `summary` (total_active_rules, monthly_obligation)
- `CreateRecurringRuleDto` — 17 fields, `name`/`category_id`/`amount`/`frequency`/`start_date` required
- `UpdateRecurringRuleDto` — all optional EXCEPT `start_date` cannot be changed (omitted from DTO)
- `ListRecurringRulesParams` — status, category_id, frequency, sort_by, sort_order
- `SkipRuleDto` — optional `reason` (max 500 chars)
- `RecurringPreviewResponse` — `period_days`, `total_obligations`, `occurrences[]` with tax_amount, supplier_name, payment_method_nickname

**Key business rule for types:** The preview endpoint (`GET /recurring-rules/preview?days=30|60|90`) is a SEPARATE endpoint from the list endpoint. The `summary` in the list response contains `monthly_obligation`, NOT the preview data. These are two independent API calls.

**Section 10 — Draw Milestones** (API Section 13):
- `DrawMilestone` — includes `quote_draw_entry_id` (null if manually created), `value`/`calculated_amount` as strings
- `CreateMilestoneDto` — `draw_number`, `description`, `calculation_type`, `value` required; optional `calculated_amount` override, `notes`
- `UpdateMilestoneDto` — optional `description`, `calculated_amount` (BLOCKED if status invoiced/paid), `notes`
- `GenerateMilestoneInvoiceDto` — optional `description`, `due_date`, `tax_amount`, `notes`

**Section 11 — Project Invoices** (API Section 14):
- `ProjectInvoice` — includes `milestone` nested object, `payment_count`, amounts as strings
- `CreateProjectInvoiceDto` — `description` and `amount` required
- `UpdateProjectInvoiceDto` — all optional (only works on `draft` status)
- `VoidInvoiceDto` — `voided_reason` REQUIRED (1-500 chars)
- `InvoicePayment` — payment record with all fields
- `RecordInvoicePaymentDto` — `amount`, `payment_date`, `payment_method` required; optional `payment_method_registry_id`
- `ListProjectInvoicesParams` — page, limit, status, date_from, date_to

**CRITICAL NOTE:** Project invoices pagination uses `totalPages` (camelCase), NOT `total_pages` or `pages`. The `getPageCount()` helper from Sprint 1a handles this.

**Section 12 — Project Financial Summary** (API Section 15):
- `ProjectFinancialSummary` — massive nested object: `project`, `cost_summary`, `subcontractor_summary`, `crew_summary`, `receipt_summary`, `revenue_summary`, `margin_analysis`
- `TaskBreakdownResponse` — per-task cost breakdown with `expenses`, `subcontractor_invoices`, `crew_hours`
- `TimelineResponse` — monthly cost timeline with `cumulative_total`
- `WorkforceResponse` — crew hours by member, crew payments by member, subcontractor invoices by subcontractor

**Section 13 — Dashboard** (API Section 21):
- `DashboardOverview` — all 5 sections in one response: `pl_summary`, `ar_summary`, `ap_summary`, `forecast`, `alerts`, `generated_at`
- `PLSummary` + `PLMonth` — P&L with monthly breakdown, income by_project, expenses by_category, by_classification, top_suppliers, tax summary
- `ARSummary` — includes `aging_buckets` with EXACT field names: `current`, `days_1_30`, `days_31_60`, `days_61_90`, `days_over_90`
- `APSummary` — subcontractor_invoices with by_subcontractor, recurring_upcoming array, crew_hours_summary with `note` field
- `ForecastResponse` — `net_forecast_label` is EXACTLY `'Positive' | 'Negative' | 'Breakeven'` (capital first letter)
- `FinancialAlert` — `details` is `Record<string, unknown>` (generic object, structure varies by alert type)
- `AlertsResponse` — `alert_count` + `alerts[]`
- Param interfaces: `DashboardPLParams`, `DashboardARParams`, `DashboardAPParams`, `DashboardForecastParams`

**Section 14 — Account Mappings & Exports** (API Sections 22-23):
- `AccountMapping` — includes nested `category` object
- `DefaultMapping` — includes `has_custom_mapping` boolean
- `CreateAccountMappingDto` — this is an UPSERT (creates or updates per category+platform)
- `ExportHistoryItem` — includes `filters_applied` as `Record<string, unknown>`, nested `exported_by` user
- `QualityReportResponse` — `total_entries_checked`, `errors`, `warnings`, `infos`, `issues[]` with severity/check_type/message
- `ExportExpenseParams` — `date_from` and `date_to` REQUIRED, others optional
- `ExportInvoiceParams` — `date_from` and `date_to` REQUIRED
- `ExportHistoryParams` — optional `export_type` filter
- `QualityReportParams` — all optional

---

### Task 2 — Verify Full Compilation

```bash
cd /var/www/lead360.app/app
npx tsc --noEmit 2>&1 | head -50
```

Fix any TypeScript errors. The types file must compile cleanly. Some import errors in other files are acceptable if they reference old type names that were renamed (e.g., `PaymentMethod` → `PaymentMethodType`).

---

## Acceptance Criteria
- [ ] Recurring rule types complete (8 interfaces/types)
- [ ] Draw milestone types complete (4 interfaces)
- [ ] Project invoice types complete (7 interfaces including payment)
- [ ] Project financial summary complete (4 large interfaces)
- [ ] Dashboard types complete (all 5 views + params = 12+ interfaces)
- [ ] Account mapping & export types complete (9 interfaces)
- [ ] All types reference enums from Sprint 1a correctly
- [ ] `net_forecast_label` typed as `'Positive' | 'Negative' | 'Breakeven'`
- [ ] AR aging bucket fields named exactly: `current`, `days_1_30`, etc.
- [ ] TypeScript compiles cleanly
- [ ] No backend code modified

---

## Gate Marker
**STOP** — Sprint 1c (API client) imports from this file. ALL types must be present and compile before proceeding.

---

## Handoff Notes
- Types file now contains ALL types for 109 endpoints
- Sprint 1c will write API client functions that import from this file
- Dashboard overview returns ALL 5 sections in one API call — efficient for the overview page
- Invoice pagination uses `totalPages` (camelCase) — different from all other endpoints
- Recurring preview is a SEPARATE endpoint from recurring rules list
- Account mapping create is an UPSERT operation
