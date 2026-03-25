# Sprint 7_7 — API Documentation + Final Verification (STOP GATE)

**Module:** Financial
**File:** ./documentation/sprints/financial/f07/sprint_7_7.md
**Type:** Documentation + Integration Verification
**Depends On:** Sprint 7_6 (all tests passing)
**Gate:** FINAL STOP — This is the last sprint. ALL acceptance criteria from the F-07 contract must be verified.
**Estimated Complexity:** Medium

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

This is the FINAL sprint of F-07. Two deliverables:

1. **Complete API documentation** for all 5 new project financial endpoints — based on the REAL codebase (not assumptions)
2. **Final verification** of ALL acceptance criteria from the F-07 contract

The API documentation must be 100% accurate. Read the actual service methods and controller before writing any documentation. Do NOT copy from the contract — verify against the real implementation.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.ts` — read the ACTUAL implementation, every method
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/project-financial-summary.controller.ts` — read the ACTUAL endpoints
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/project-financial-query.dto.ts` — read the ACTUAL DTOs
- [ ] Run all unit tests: `cd /var/www/lead360.app/api && npx jest src/modules/financial/services/project-financial-summary.service.spec.ts --verbose` — all must pass
- [ ] Review existing API doc files for format reference:
  - `/var/www/lead360.app/api/documentation/financial_gate1_REST_API.md`
  - `/var/www/lead360.app/api/documentation/financial_gate3_REST_API.md`

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

### Task 1 — Write Complete API Documentation

**What:** Create a comprehensive API documentation file based on the REAL codebase.

**File:** `/var/www/lead360.app/api/documentation/financial_f07_REST_API.md`

**IMPORTANT:** Read the actual service and controller code BEFORE writing this document. Document what the code ACTUALLY does, not what the contract says it should do. If there are discrepancies between the contract and the implementation, document the ACTUAL behavior and note the discrepancy.

**Document structure:**

```markdown
# Financial Module — Project Financial Intelligence (F-07) REST API

**Base URL:** `https://api.lead360.app` (local: `http://localhost:8000`)
**Authentication:** Bearer token required on all endpoints
**Content-Type:** `application/json`

---

## Overview

Sprint F-07 provides 5 read-only endpoints for comprehensive project financial intelligence.
All endpoints are nested under `/projects/:projectId/financial/`.

**Important: Revenue Gap**
Revenue data (invoiced amount, collected amount, outstanding balance) is NOT available.
The Invoicing Module (Sprint 9) has not been built yet. All summary responses include a
`revenue_note` field documenting this known gap. Revenue intelligence will be added in a
future sprint once the invoicing system is complete.

---

## Endpoints Summary

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | /projects/:projectId/financial/summary | Full financial summary | Owner, Admin, Manager, Bookkeeper |
| GET | /projects/:projectId/financial/tasks | Per-task cost breakdown | Owner, Admin, Manager, Bookkeeper |
| GET | /projects/:projectId/financial/timeline | Monthly cost timeline | Owner, Admin, Manager, Bookkeeper |
| GET | /projects/:projectId/financial/receipts | Project receipts list | Owner, Admin, Manager, Bookkeeper, Field |
| GET | /projects/:projectId/financial/workforce | Workforce summary | Owner, Admin, Manager, Bookkeeper |

---

## Common Behaviors

### Tenant Isolation
All endpoints validate that `:projectId` belongs to the requesting tenant before returning data.
Returns 404 if the project does not exist or belongs to a different tenant.

### Error Responses
| Status | Description |
|--------|-------------|
| 401 | Missing or invalid authentication token |
| 403 | Valid token but insufficient role permissions |
| 404 | Project not found or does not belong to tenant |

---
```

**For EACH of the 5 endpoints, document:**

1. **Endpoint** — method, path, description
2. **Authentication** — required, roles
3. **Path Parameters** — name, type, description
4. **Query Parameters** — name, type, required/optional, default, description
5. **Response Body** — complete JSON shape with types and descriptions for EVERY field
6. **Example Request** — curl command
7. **Example Response** — complete JSON example with realistic data
8. **Business Rules** — key behaviors (e.g., zero values for empty data, null for missing margins)

**Critical fields to document in the summary endpoint:**
- `margin_analysis.margin_percent` — null when contract_value is null OR zero
- `margin_analysis.actual_cost_confirmed` — excludes pending_review entries
- `margin_analysis.actual_cost_total` — includes pending_review entries
- `revenue_note` — static string, always present
- `by_classification.cost_of_goods_sold` vs `by_classification.operating_expense`

**Critical fields to document in the tasks endpoint:**
- Zero-activity tasks ARE included with zero values
- `sort_by` options: `total_cost` (default), `task_title`

**Critical fields to document in the timeline endpoint:**
- Zero-expense months within range ARE included
- `cumulative_total` — running sum across all returned months

**Critical fields to document in the receipts endpoint:**
- Includes receipts linked to project AND receipts linked to project's tasks
- `task_title` — joined from task when `task_id` is present
- Pagination: `meta.total_pages` (not `pages`)

**Critical fields to document in the workforce endpoint:**
- `crew_member_name` — `first_name + ' ' + last_name`
- `subcontractor_name` — `business_name`
- `outstanding` = invoiced − paid
- Date filters apply to `log_date` (hours), `payment_date` (payments)

**Known gap to document:**
- Revenue data not available — invoicing module not built
- `revenue_note` field explains this in every summary response

---

### Task 2 — Verify All F-07 Contract Acceptance Criteria

**What:** Go through EVERY acceptance criterion from the F-07 contract and verify it against the live system.

Start the dev server and get a valid JWT token:
```bash
cd /var/www/lead360.app/api && npm run start:dev
# Wait for health check...

TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | \
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))")

# Get a valid project ID
curl -s http://localhost:8000/projects \
  -H "Authorization: Bearer $TOKEN" | head -c 300
```

**Verification checklist (verify each one):**

**Project Validation:**
- [ ] All endpoints return 404 if `projectId` does not belong to requesting tenant
- [ ] All endpoints return 404 if project does not exist

```bash
# Test with non-existent UUID
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:8000/projects/00000000-0000-0000-0000-000000000000/financial/summary \
  -H "Authorization: Bearer $TOKEN"
# Expected: 404
```

**Summary Endpoint:**
- [ ] Returns `contract_value` and `estimated_cost` from project record
- [ ] `by_category` uses correct `classification` values
- [ ] `by_classification` correctly splits COGS vs operating expense
- [ ] `actual_cost_confirmed` excludes `pending_review` entries
- [ ] `actual_cost_total` includes `pending_review` entries
- [ ] `margin_percent` returns null when `contract_value` is null
- [ ] `revenue_note` field present in every summary response
- [ ] `date_from` / `date_to` filters scope results correctly

```bash
PROJECT_ID="<valid-project-id>"

# Full summary
curl -s http://localhost:8000/projects/$PROJECT_ID/financial/summary \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# With date filter
curl -s "http://localhost:8000/projects/$PROJECT_ID/financial/summary?date_from=2025-01-01&date_to=2025-12-31" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Task Breakdown:**
- [ ] All project tasks returned including those with zero costs
- [ ] Each task includes expenses, subcontractor invoices, and crew hours
- [ ] `sort_by=total_cost` orders correctly

```bash
curl -s "http://localhost:8000/projects/$PROJECT_ID/financial/tasks?sort_by=total_cost&sort_order=desc" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Timeline:**
- [ ] Months with zero expenses included within project date range
- [ ] Each month includes `by_category` breakdown
- [ ] `cumulative_total` is running sum of all months in response

```bash
curl -s http://localhost:8000/projects/$PROJECT_ID/financial/timeline \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Receipts:**
- [ ] Returns receipts for project AND receipts linked to project's tasks
- [ ] Field role can access this endpoint (test with a Field user if available)
- [ ] `task_title` joined correctly when receipt has `task_id`
- [ ] Pagination works correctly

```bash
curl -s "http://localhost:8000/projects/$PROJECT_ID/financial/receipts?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Workforce:**
- [ ] `crew_hours.by_crew_member` aggregates correctly
- [ ] `subcontractor_invoices.outstanding` = invoiced − paid
- [ ] Date filters applied to correct date fields

```bash
curl -s http://localhost:8000/projects/$PROJECT_ID/financial/workforce \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Tests:**
- [ ] All unit tests pass

```bash
cd /var/www/lead360.app/api
npx jest src/modules/financial/services/project-financial-summary.service.spec.ts --verbose
```

**Swagger:**
- [ ] All 5 endpoints visible in Swagger docs

```bash
curl -s http://localhost:8000/api/docs-json | python3 -c "
import sys, json
data = json.load(sys.stdin)
paths = [p for p in data.get('paths', {}) if 'financial/summary' in p or 'financial/tasks' in p or 'financial/timeline' in p or 'financial/receipts' in p or 'financial/workforce' in p]
print(f'Found {len(paths)} F-07 endpoints in Swagger:')
for p in paths:
  print(f'  {p}')
"
```

---

### Task 3 — Verify Files Created/Modified

**What:** Confirm the correct files were created/modified during F-07.

**Files CREATED (must exist):**
- [ ] `/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.ts`
- [ ] `/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.spec.ts`
- [ ] `/var/www/lead360.app/api/src/modules/financial/dto/project-financial-query.dto.ts`
- [ ] `/var/www/lead360.app/api/documentation/financial_f07_REST_API.md`

**Files MODIFIED (should have been updated):**
- [ ] `/var/www/lead360.app/api/src/modules/financial/controllers/project-financial-summary.controller.ts` — rebuilt with 5 endpoints
- [ ] `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` — new service registered
- [ ] `/var/www/lead360.app/api/prisma/schema.prisma` — prerequisite fields added (Sprint 7_1)

**Files that MUST NOT be modified:**
- [ ] NO files in `api/src/modules/projects/` were modified
- [ ] NO files in `api/src/modules/quotes/` were modified
- [ ] NO frontend files in `app/` were modified

```bash
# Quick check — list recently modified files
find /var/www/lead360.app/api/src/modules/projects -name "*.ts" -newer /var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.ts 2>/dev/null
# Expected: nothing — no project module files should have been modified after the service was created
```

---

### Task 4 — Final Summary Report

**What:** After all verifications, produce a completion report.

```markdown
## F-07 Completion Report — Project Financial Intelligence

**Status:** ✅ COMPLETE

### Files Created
- `services/project-financial-summary.service.ts` — 6 methods (validateProjectAccess, getFullSummary, getTaskBreakdown, getTimeline, getReceipts, getWorkforceSummary)
- `services/project-financial-summary.service.spec.ts` — Unit tests
- `dto/project-financial-query.dto.ts` — 3 DTOs (ProjectDateFilterDto, ProjectTaskBreakdownQueryDto, ProjectReceiptsQueryDto)
- `documentation/financial_f07_REST_API.md` — 100% endpoint coverage

### Files Modified
- `controllers/project-financial-summary.controller.ts` — Rebuilt: 1 endpoint → 5 endpoints
- `financial.module.ts` — ProjectFinancialSummaryService registered
- `prisma/schema.prisma` — Prerequisite fields added (classification, submission_status, tax_amount)

### Endpoints Delivered
1. GET /projects/:projectId/financial/summary ✅
2. GET /projects/:projectId/financial/tasks ✅
3. GET /projects/:projectId/financial/timeline ✅
4. GET /projects/:projectId/financial/receipts ✅
5. GET /projects/:projectId/financial/workforce ✅

### Known Gaps (Documented)
- Revenue data not available — Invoicing Module not built
- `revenue_note` field documents this gap in every summary response

### Quality Checks
- Tenant isolation: verified ✅
- Margin calculations: null-safe, no NaN, no divide-by-zero ✅
- Zero values for empty aggregations: verified ✅
- Swagger documentation: all 5 endpoints visible ✅
- Unit tests: all passing ✅
- No N+1 queries: Promise.all() used for parallel execution ✅
```

---

### Task 5 — Shut Down Dev Server

```bash
lsof -i :8000
kill {PID}
lsof -i :8000   # Must return nothing
```

---

## Acceptance Criteria (FINAL — ALL MUST BE MET)

**Project Validation:**
- [ ] All endpoints return 404 if `projectId` does not belong to requesting tenant
- [ ] All endpoints return 404 if project does not exist

**Summary Endpoint:**
- [ ] Returns `contract_value` and `estimated_cost` from project record
- [ ] `by_classification` correctly splits COGS vs operating expense
- [ ] `actual_cost_confirmed` excludes `pending_review` entries
- [ ] `margin_percent` returns null when `contract_value` is null or zero
- [ ] `revenue_note` field present in every summary response
- [ ] `date_from` / `date_to` filters correctly scope results

**Task Breakdown:**
- [ ] All project tasks returned including zero-cost tasks
- [ ] Each task includes expenses, subcontractor invoices, and crew hours
- [ ] Sorting works correctly

**Timeline:**
- [ ] Zero-expense months included within project date range
- [ ] Each month has `by_category` breakdown
- [ ] `cumulative_total` is running sum

**Receipts:**
- [ ] Returns receipts for project AND project's tasks
- [ ] Field role has access
- [ ] `task_title` joined correctly
- [ ] Pagination works

**Workforce:**
- [ ] `crew_hours.by_crew_member` aggregates correctly
- [ ] `subcontractor_invoices.outstanding` = invoiced − paid

**Tests:**
- [ ] All unit tests pass

**Documentation:**
- [ ] `financial_f07_REST_API.md` created with 100% endpoint coverage
- [ ] `revenue_note` and its intent documented
- [ ] Known gap documented: revenue data deferred

**Files:**
- [ ] No files in `api/src/modules/projects/` modified
- [ ] No frontend files modified
- [ ] No schema changes beyond prerequisite fields

**Infrastructure:**
- [ ] Dev server shut down
- [ ] Port 8000 is free

---

## Gate Marker

**FINAL STOP** — Sprint F-07 is complete. All acceptance criteria verified. All endpoints documented and tested.

This gate blocks:
- F-09 (business dashboard) — can now proceed
- Future Invoicing Sprint — will add revenue fields to summary response
