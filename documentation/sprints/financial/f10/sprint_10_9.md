# Sprint 10_9 — API Documentation + Final Verification (STOP Gate)

**Module:** Financial
**File:** ./documentation/sprints/financial/f10/sprint_10_9.md
**Type:** Backend — Documentation + Verification
**Depends On:** Sprint 10_8 (all tests must pass)
**Gate:** STOP — FINAL — All F-10 acceptance criteria must be verified. Migration must be clean. All endpoints must be live. All tests must pass.
**Estimated Complexity:** Medium

> **You are a masterclass-level engineer who makes Google, Amazon, and Apple engineers jealous of the quality of your work.**

> ⚠️ **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> ⚠️ **MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — do NOT hardcode database credentials anywhere.**

---

## Objective

Produce the complete, 100% coverage API documentation for the F-10 Export module based on the **real codebase** (not assumptions). Then perform the final verification of ALL acceptance criteria from the F-10 contract. This is the FINAL sprint — nothing proceeds until every item passes.

---

## Pre-Sprint Checklist

- [ ] Read the REAL implementation files — do not write docs from memory:
  - `/var/www/lead360.app/api/src/modules/financial/controllers/account-mapping.controller.ts`
  - `/var/www/lead360.app/api/src/modules/financial/controllers/export.controller.ts`
  - `/var/www/lead360.app/api/src/modules/financial/services/account-mapping.service.ts`
  - `/var/www/lead360.app/api/src/modules/financial/services/export.service.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/create-account-mapping.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/export-expense-query.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/export-invoice-query.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/quality-report-query.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/export-history-query.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/account-mapping-query.dto.ts`
  - `/var/www/lead360.app/api/prisma/schema.prisma` (the export-related models)
- [ ] Read existing API docs for style reference: `/var/www/lead360.app/api/documentation/financial_gate1_REST_API.md`

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

### Task 1 — Write Complete API Documentation

**What:** Create the file:
`/var/www/lead360.app/api/documentation/financial_export_REST_API.md`

**CRITICAL:** Read the ACTUAL implementation files before writing. Document what IS built, not what was planned. If any implementation deviates from the contract, document the actual behavior.

**Documentation must include ALL of the following sections:**

#### 1. Module Overview
- Purpose of the export module
- Two new database tables
- Two new enums

#### 2. Authentication & Authorization
- All endpoints require JWT Bearer token
- Roles: Owner, Admin, Bookkeeper
- Exception: DELETE mapping requires Owner or Admin only

#### 3. Account Mapping Endpoints (4 endpoints)
For EACH endpoint, document:
- Method + Path
- Description
- Required roles
- Query parameters (name, type, required/optional, example)
- Request body (if POST — all fields, types, validation rules, examples)
- Response body (full JSON shape with all fields)
- Error responses (status codes + messages)
- Example curl command

#### 4. Export Endpoints (6 endpoints)
For EACH endpoint, document:
- Method + Path
- Description
- Required roles
- Query parameters (all fields with types, required/optional, defaults)
- Response: Content-Type, Content-Disposition header, CSV format
- Error responses
- Example curl command

#### 5. QuickBooks CSV Column Mapping Table
Full table: QB Column → Lead360 Source Field → Notes

#### 6. Xero CSV Column Mapping Table
Full table: Xero Column → Lead360 Source Field → Notes

#### 7. QuickBooks Invoice CSV Column Mapping Table
Full table: QB Column → Source → Notes

#### 8. Xero Invoice CSV Column Mapping Table
Full table: Xero Column → Source → Notes

#### 9. Date Format Reference
**PROMINENT section — this is the #1 failure cause:**
- QuickBooks: `MM/DD/YYYY` (US format)
- Xero: `DD/MM/YYYY` (International format)
- Example: March 5, 2026 → QB: `03/05/2026` → Xero: `05/03/2026`

#### 10. Amount Sign Convention
- QuickBooks expenses: POSITIVE
- Xero expenses: NEGATIVE
- All invoice amounts: POSITIVE (revenue)

#### 11. Payment Method Translation Table
Lead360 enum → QuickBooks display name

#### 12. Invoice Status Translation Tables
Lead360 → QB status mapping
Lead360 → Xero status mapping

#### 13. Data Quality Report
- All 7 check types with severity and message format
- Response JSON shape (full)
- `export_readiness` logic

#### 14. Export History
- Response shape
- Pagination meta

#### 15. Business Rules
- Confirmed-only default
- Recurring instance exclusion
- Voided invoice exclusion
- 366-day date range limit
- 50,000 row limit
- Account mapping fallback

#### 16. Export Limits
- Maximum date range: 366 days
- Maximum rows per export: 50,000
- Export log records are immutable

#### 17. How to Import into QuickBooks Online
Step-by-step instructions:
1. Log into QuickBooks Online
2. Navigate to Banking → Import bank transactions (for expenses) or Sales → Import invoices (for invoices)
3. Click "Browse" and select the downloaded CSV file
4. QuickBooks will preview the data — verify dates, amounts, and account names
5. Map any unrecognized columns if prompted
6. Click "Import"
7. Verify the imported transactions appear in the correct accounts

#### 18. How to Import into Xero
Step-by-step instructions:
1. Log into Xero
2. Navigate to Accounting → Bank accounts → Import a statement (for expenses) or Business → Invoices → Import (for invoices)
3. Click "Browse" and select the downloaded CSV file
4. Select the correct bank account for the import
5. Xero will preview the data — verify dates are DD/MM/YYYY and amounts are negative for expenses
6. Click "Import"
7. Reconcile the imported transactions

**Acceptance:** Documentation file exists at the correct path with 100% endpoint coverage. No endpoint, field, or behavior is undocumented.

---

### Task 2 — Final Verification: Schema

Run these checks:

```bash
# Verify tables exist
cd /var/www/lead360.app/api

# Check migration exists
ls -la prisma/migrations/ | grep export

# Verify enums in schema
grep -n "enum export_type" prisma/schema.prisma
grep -n "enum accounting_platform" prisma/schema.prisma

# Verify tables in schema
grep -n "model financial_export_log" prisma/schema.prisma
grep -n "model financial_category_account_mapping" prisma/schema.prisma
```

**Acceptance:**
- [ ] `financial_export_log` table exists with all fields
- [ ] `financial_category_account_mapping` table exists with unique constraint
- [ ] `export_type` enum exists with 6 values
- [ ] `accounting_platform` enum exists with 2 values
- [ ] Migration file exists and is clean

---

### Task 3 — Final Verification: Endpoints

Get a JWT token and test every endpoint:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Account Mappings
echo "=== 1. List mappings ==="
curl -s http://localhost:8000/financial/export/account-mappings \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo

echo "=== 2. Get defaults ==="
curl -s "http://localhost:8000/financial/export/account-mappings/defaults?platform=quickbooks" \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo

echo "=== 3. Quality report ==="
curl -s http://localhost:8000/financial/export/quality-report \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo

echo "=== 4. Export history ==="
curl -s http://localhost:8000/financial/export/history \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo

echo "=== 5. QB expenses (no dates — should 400) ==="
curl -s http://localhost:8000/financial/export/quickbooks/expenses \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo

echo "=== 6. Xero expenses (no dates — should 400) ==="
curl -s http://localhost:8000/financial/export/xero/expenses \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo

echo "=== 7. QB invoices (no dates — should 400) ==="
curl -s http://localhost:8000/financial/export/quickbooks/invoices \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo

echo "=== 8. Xero invoices (no dates — should 400) ==="
curl -s http://localhost:8000/financial/export/xero/invoices \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo

# Test with dates (may return 400 "No records match" if no data — that's OK)
echo "=== 9. QB expenses with dates ==="
curl -s "http://localhost:8000/financial/export/quickbooks/expenses?date_from=2026-01-01&date_to=2026-12-31" \
  -H "Authorization: Bearer $TOKEN" | head -c 500
echo

echo "=== 10. Swagger check ==="
curl -s http://localhost:8000/api/docs-json | jq '.paths | keys[]' | grep -c "export"
echo " export endpoints in Swagger"
```

**Acceptance:**
- [ ] All 10 endpoints respond (200, 400, or appropriate status)
- [ ] Account mappings returns array
- [ ] Defaults returns categories with resolved names
- [ ] Quality report returns structured report
- [ ] Export history returns paginated list
- [ ] CSV endpoints without dates return 400 validation error
- [ ] CSV endpoints with valid dates return CSV or 400 "no records"
- [ ] Swagger lists all export endpoints

---

### Task 4 — Final Verification: Tests

```bash
cd /var/www/lead360.app/api

# Run export tests
npx jest src/modules/financial/services/export.service.spec.ts --verbose

# Run ALL financial tests
npx jest src/modules/financial/ --verbose
```

**Acceptance:**
- [ ] All export tests pass
- [ ] All existing financial tests still pass
- [ ] No test regressions

---

### Task 5 — Final Verification: No Regressions

```bash
# Test a few existing endpoints to confirm nothing is broken
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Existing financial categories
curl -s http://localhost:8000/settings/financial-categories \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo

# Health check
curl -s http://localhost:8000/health
echo
```

**Acceptance:**
- [ ] Existing financial endpoints still work
- [ ] Health check passes
- [ ] No TypeScript compilation errors

---

### Task 6 — Stop Server

```bash
lsof -i :8000
kill {PID}
# Confirm:
lsof -i :8000   # ← must return nothing
```

---

## Complete F-10 Acceptance Criteria Checklist

**From the F-10 contract — every item must be verified:**

### Schema
- [ ] `financial_export_log` table exists with all fields
- [ ] `financial_category_account_mapping` table exists
- [ ] `export_type` and `accounting_platform` enums exist
- [ ] Migration runs cleanly

### Account Mappings
- [ ] `POST /financial/export/account-mappings` upserts correctly
- [ ] `GET /financial/export/account-mappings/defaults` returns all categories with resolved names
- [ ] Category with no mapping uses category name as fallback

### QuickBooks Export
- [ ] CSV header row exactly matches QB column names
- [ ] Dates formatted as `MM/DD/YYYY`
- [ ] Amounts are positive
- [ ] `Name` (payee) field uses supplier name when available, vendor_name as fallback
- [ ] `Class` field populated from project name when entry has project_id
- [ ] Payment method translated to QB display name
- [ ] Only confirmed entries included by default
- [ ] Export logged to `financial_export_log`

### Xero Export
- [ ] CSV header row exactly matches Xero column names
- [ ] Dates formatted as `DD/MM/YYYY`
- [ ] Expense amounts are negative
- [ ] `Tracking Name 1` populated from project name
- [ ] Export logged to `financial_export_log`

### Invoice Export
- [ ] QB invoice CSV uses correct QB columns
- [ ] Xero invoice CSV uses correct Xero columns
- [ ] Voided invoices excluded
- [ ] Invoice status mapped correctly to platform status values

### Quality Report
- [ ] All 7 check types implemented
- [ ] Duplicate entry risk detection works
- [ ] `export_readiness` correctly set to `errors_present` when any Error severity issues found
- [ ] Issues ordered: error → warning → info

### Export History
- [ ] Every successful export creates a `financial_export_log` record
- [ ] History endpoint returns correct paginated results
- [ ] Records are immutable — no delete endpoint exists

### Errors
- [ ] Missing date_from or date_to returns 400
- [ ] Date range > 366 days returns 400
- [ ] Zero records match returns 400
- [ ] Export > 50,000 rows returns 400

### Tests
- [ ] Unit test: `formatDateQB()` — correct MM/DD/YYYY output
- [ ] Unit test: `formatDateXero()` — correct DD/MM/YYYY output
- [ ] Unit test: Xero amount negation for expenses
- [ ] Unit test: account name resolution — custom mapping vs. fallback
- [ ] Unit test: QB expense row — all fields mapped correctly
- [ ] Unit test: Xero expense row — all fields mapped correctly
- [ ] Unit test: quality report — duplicate detection logic
- [ ] Unit test: quality report — missing vendor detection
- [ ] Integration test: full QB expense export with real data (mocked)
- [ ] Integration test: export log created after successful export
- [ ] Tenant isolation: tenant queries always include tenant_id

### Documentation
- [ ] `api/documentation/financial_export_REST_API.md` created with all endpoints
- [ ] QB and Xero column mappings documented as tables
- [ ] Date format difference documented prominently
- [ ] Amount sign convention documented
- [ ] Export limits (366 days, 50,000 rows) documented
- [ ] Instructions for how to import CSV into QuickBooks Online documented
- [ ] Instructions for how to import CSV into Xero documented

---

## Gate Marker

**STOP — FINAL** — This is the last sprint in F-10. ALL acceptance criteria from the F-10 contract must be verified before marking the sprint complete. If any item fails, fix it before closing.

**Sprint F-10 is complete when:**
1. All schema changes are applied and clean
2. All 10 endpoints are live and Swagger-documented
3. All unit tests pass
4. All existing tests still pass
5. Complete API documentation exists at `api/documentation/financial_export_REST_API.md`
6. No existing code is broken
7. Dev server is shut down
8. Every item in the acceptance checklist above is checked

---

## Handoff Notes

**F-10 is the FINAL sprint in the Financial Module series.** When complete, the financial module provides:

- Financial categories with classification (F-01)
- Supplier registry (F-02)
- Payment method registry (F-03)
- General expense entry engine (F-04)
- Receipt management (F-05)
- Crew payments and hour logging (F-06/F-07)
- Draw schedule → invoice automation (F-08)
- Financial dashboard with P&L (F-09)
- **QuickBooks/Xero export readiness (F-10)** ← this sprint

The business owner can now:
1. Record all expenses (project and overhead)
2. Track crew and subcontractor payments
3. View financial dashboards
4. **Export everything to QuickBooks or Xero for their accountant**

Future work (not in scope):
- Live QuickBooks Online API integration (OAuth + real-time sync)
- Live Xero API integration
- Automated scheduled export emails to accountant
