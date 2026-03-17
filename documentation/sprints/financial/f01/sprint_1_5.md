# Sprint 1.5 — Verification Gate + API Documentation

**Module:** Financial
**File:** `./documentation/sprints/financial/f01/sprint_1_5.md`
**Type:** Verification + Documentation
**Depends On:** Sprint 1.1, 1.2, 1.3, 1.4 (ALL must be complete)
**Gate:** **STOP — FINAL GATE** — This is the last sprint of F-01. ALL acceptance criteria from the F-01 contract must be verified before any downstream financial sprint (F-02 through F-10) can begin.
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

This sprint has two purposes:

1. **Verify** that ALL acceptance criteria from the F-01 Feature Contract are met. Every single item must be confirmed true.
2. **Produce** updated API documentation at `/var/www/lead360.app/api/documentation/financial_REST_API.md` that reflects the real state of the codebase. The documentation must be based on what the code ACTUALLY does, not on assumptions or contract text.

---

## Pre-Sprint Checklist

- [ ] Confirm Sprint 1.1 is complete: migration applied, Prisma client generated
- [ ] Confirm Sprint 1.2 is complete: DTOs compile cleanly
- [ ] Confirm Sprint 1.3 is complete: services updated and compile
- [ ] Confirm Sprint 1.4 is complete: all unit tests pass

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

### Task 1 — Run Full Test Suite

```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern="src/modules/financial/services" --verbose
```

**Expected:** ALL tests pass. Zero failures. Zero skips.

If any tests fail, fix them before proceeding. Do not skip or disable tests.

---

### Task 2 — Verify Schema in Database

Start the dev server, then run database verification queries.

**Get a valid auth token:**
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "contact@honeydo4you.com", "password": "978@F32c"}'
```
Extract `access_token` from the response. Use it as `{TOKEN}` in all subsequent requests.

**Verify database state via MySQL CLI:**
```bash
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_entry LIKE 'project_id';"
```
**Expected:** `project_id` column `Null` = `YES`

```bash
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_entry LIKE 'submission_status';"
```
**Expected:** Column exists with enum type including `pending_review,confirmed`

```bash
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_entry LIKE 'payment_method';"
```
**Expected:** Column exists with enum including `credit_card,debit_card,ACH`

```bash
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW COLUMNS FROM financial_category LIKE 'classification';"
```
**Expected:** Column exists with enum `cost_of_goods_sold,operating_expense`

```bash
mysql -u lead360_user -p'978@F32c' lead360 -e "SELECT COUNT(*) as overhead_count FROM financial_category WHERE is_system_default = 1 AND classification = 'operating_expense';"
```
**Expected:** Count equals 7 x (number of tenants)

```bash
mysql -u lead360_user -p'978@F32c' lead360 -e "SELECT COUNT(*) as cogs_count FROM financial_category WHERE is_system_default = 1 AND classification = 'cost_of_goods_sold';"
```
**Expected:** Count equals 9 x (number of tenants)

```bash
mysql -u lead360_user -p'978@F32c' lead360 -e "SELECT DISTINCT type, classification FROM financial_category WHERE is_system_default = 1 ORDER BY type;"
```
**Expected:** 12 rows showing correct classification per type:
- `labor` → `cost_of_goods_sold`
- `material` → `cost_of_goods_sold`
- `subcontractor` → `cost_of_goods_sold`
- `equipment` → `cost_of_goods_sold`
- `other` → `cost_of_goods_sold`
- `insurance` → `operating_expense`
- `fuel` → `operating_expense`
- `utilities` → `operating_expense`
- `office` → `operating_expense`
- `marketing` → `operating_expense`
- `taxes` → `operating_expense`
- `tools` → `operating_expense`

---

### Task 3 — Verify API Endpoints (Live)

**Test 3a: Create entry WITHOUT project_id**
```bash
curl -s -X POST http://localhost:8000/api/v1/financial/entries \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"category_id": "{VALID_CATEGORY_ID}", "amount": 150.00, "entry_date": "2026-03-15", "vendor_name": "State Farm Insurance", "notes": "Monthly business insurance"}'
```
**Expected:** 201 Created. Response has `project_id: null`.

To get a valid category_id:
```bash
curl -s http://localhost:8000/api/v1/settings/financial-categories \
  -H "Authorization: Bearer {TOKEN}"
```

**Test 3b: Create entry WITH valid project_id**
```bash
curl -s -X POST http://localhost:8000/api/v1/financial/entries \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "{VALID_PROJECT_ID}", "category_id": "{VALID_CATEGORY_ID}", "amount": 450.00, "entry_date": "2026-03-15", "vendor_name": "Home Depot"}'
```
**Expected:** 201 Created. Response has `project_id: {VALID_PROJECT_ID}`.

To get a valid project_id:
```bash
curl -s http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer {TOKEN}"
```

**Test 3c: Create entry with INVALID project_id UUID format**
```bash
curl -s -X POST http://localhost:8000/api/v1/financial/entries \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "not-a-valid-uuid", "category_id": "{VALID_CATEGORY_ID}", "amount": 100.00, "entry_date": "2026-03-15"}'
```
**Expected:** 400 Bad Request (UUID validation from DTO)

**Test 3d: Create entry with project_id not belonging to tenant**
```bash
curl -s -X POST http://localhost:8000/api/v1/financial/entries \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "00000000-0000-0000-0000-000000000000", "category_id": "{VALID_CATEGORY_ID}", "amount": 100.00, "entry_date": "2026-03-15"}'
```
**Expected:** 404 Not Found (project not found for this tenant)

**Test 3e: Create entry with tax_amount >= amount**
```bash
curl -s -X POST http://localhost:8000/api/v1/financial/entries \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"category_id": "{VALID_CATEGORY_ID}", "amount": 100.00, "tax_amount": 100.00, "entry_date": "2026-03-15"}'
```
**Expected:** 400 Bad Request — "Tax amount must be less than the entry amount"

**Test 3f: List entries WITHOUT project_id (all tenant entries)**
```bash
curl -s "http://localhost:8000/api/v1/financial/entries?page=1&limit=10" \
  -H "Authorization: Bearer {TOKEN}"
```
**Expected:** 200 OK. Returns entries from all projects AND business-level entries.

**Test 3g: List entries WITH project_id (filtered)**
```bash
curl -s "http://localhost:8000/api/v1/financial/entries?project_id={VALID_PROJECT_ID}&page=1&limit=10" \
  -H "Authorization: Bearer {TOKEN}"
```
**Expected:** 200 OK. Returns only entries for that project.

**Test 3h: Create entry with new payment method value**
```bash
curl -s -X POST http://localhost:8000/api/v1/financial/entries \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"category_id": "{VALID_CATEGORY_ID}", "amount": 50.00, "entry_date": "2026-03-15", "payment_method": "credit_card"}'
```
**Expected:** 201 Created. Response shows `payment_method: "credit_card"`.

**Test 3i: Verify Swagger docs include new fields**
```bash
curl -s http://localhost:8000/api/docs-json | python3 -m json.tool | head -100
```
Or open `http://localhost:8000/api/docs` in a browser. Verify:
- `POST /financial/entries` shows `project_id` as optional
- New fields (`payment_method`, `supplier_id`, `tax_amount`, etc.) appear in the schema
- `GET /financial/entries` shows `project_id` query param as optional

---

### Task 4 — Clean Up Test Data

Delete any test entries created during verification:
```bash
# Delete entries created in tests 3a, 3b, 3h (if they succeeded)
curl -s -X DELETE "http://localhost:8000/api/v1/financial/entries/{ENTRY_ID}" \
  -H "Authorization: Bearer {TOKEN}"
```

---

### Task 5 — Produce API Documentation

**File to create/update:** `/var/www/lead360.app/api/documentation/financial_REST_API.md`

**CRITICAL:** This documentation must be based on what the code ACTUALLY does. Read the following files before writing ANY documentation:

1. `/var/www/lead360.app/api/src/modules/financial/controllers/financial-entry.controller.ts`
2. `/var/www/lead360.app/api/src/modules/financial/controllers/financial-category.controller.ts`
3. `/var/www/lead360.app/api/src/modules/financial/controllers/project-financial-summary.controller.ts`
4. `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts`
5. `/var/www/lead360.app/api/src/modules/financial/dto/update-financial-entry.dto.ts`
6. `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries.dto.ts`
7. `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-category.dto.ts`
8. `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts`
9. `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.ts`

**The documentation must cover:**

#### Section 1: Financial Categories

| Endpoint | Method | Description | Roles |
|----------|--------|-------------|-------|
| `/api/v1/settings/financial-categories` | POST | Create category | Owner, Admin, Manager |
| `/api/v1/settings/financial-categories` | GET | List all active categories | Owner, Admin, Manager |
| `/api/v1/settings/financial-categories/:id` | PATCH | Update category | Owner, Admin, Manager |
| `/api/v1/settings/financial-categories/:id` | DELETE | Deactivate category | Owner, Admin, Manager |

For each endpoint, document:
- Request body (all fields, types, required/optional, validation rules)
- Response body (all fields with types)
- Error responses (status codes and messages)
- Business rules (e.g., system defaults cannot be deleted, classification cannot be changed on system defaults)

#### Section 2: Financial Entries

| Endpoint | Method | Description | Roles |
|----------|--------|-------------|-------|
| `/api/v1/financial/entries` | POST | Create entry | Owner, Admin, Manager |
| `/api/v1/financial/entries` | GET | List entries (paginated) | Owner, Admin, Manager |
| `/api/v1/financial/entries/:id` | GET | Get single entry | Owner, Admin, Manager |
| `/api/v1/financial/entries/:id` | PATCH | Update entry | Owner, Admin, Manager |
| `/api/v1/financial/entries/:id` | DELETE | Delete entry | Owner, Admin, Manager |

For each endpoint, document:
- All request fields with types, required/optional status, and validation rules
- **Highlight** that `project_id` is now OPTIONAL on POST and GET
- Document all new fields: `payment_method`, `supplier_id`, `purchased_by_user_id`, `purchased_by_crew_member_id`, `entry_time`, `tax_amount`, `submission_status`
- Document the `payment_method` enum values: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH`
- Document `tax_amount` validation: must be less than `amount`
- Document `submission_status` values: `pending_review`, `confirmed` (defaults to `confirmed`)

#### Section 3: Project Financial Summary

| Endpoint | Method | Description | Roles |
|----------|--------|-------------|-------|
| `/api/v1/projects/:projectId/financial-summary` | GET | Project cost summary | Owner, Admin, Manager |

Document the response shape including all 12 category types in `cost_by_category`.

#### Section 4: Enums Reference

Document all financial enums with their values:
- `payment_method` (8 values)
- `financial_category_type` (12 values)
- `financial_category_classification` (2 values)
- `expense_submission_status` (2 values)
- `financial_entry_type` (2 values)

#### Section 5: Business Rules

- Entry without `project_id` is a business-level expense
- Entry with `project_id` is a project expense — project must belong to same tenant
- `project_id` is immutable once set
- `tax_amount` must be less than `amount`
- System-default categories cannot be deactivated or have classification changed
- `submission_status` defaults to `confirmed` (role-based logic deferred to F-04)

#### Section 6: Error Codes

| Status | Condition |
|--------|-----------|
| 201 | Created successfully |
| 200 | GET / PATCH success |
| 400 | Validation error (invalid UUID, amount <= 0, future date, tax >= amount, etc.) |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Resource not found / project not in tenant |

**Documentation format:** Use Markdown. Follow the format of existing API docs at `/var/www/lead360.app/api/documentation/financial_gate1_REST_API.md` for style reference.

---

### Task 6 — Final Shutdown

```bash
lsof -i :8000
kill {PID}
lsof -i :8000   # Must return nothing
```

---

## F-01 Contract Acceptance Criteria Verification Checklist

**Every item below must be confirmed TRUE before F-01 is marked complete.**

### Schema
- [ ] `financial_entry.project_id` is nullable in schema and verified in database
- [ ] `payment_method` enum contains all 8 values: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH`
- [ ] `financial_category_classification` enum exists with `cost_of_goods_sold` and `operating_expense`
- [ ] `financial_category.classification` field exists and is required
- [ ] `financial_category_type` enum contains all 12 values
- [ ] All new optional fields on `financial_entry` exist in schema
- [ ] `expense_submission_status` enum exists
- [ ] Migration runs cleanly (verified by presence of migration file)

### Data
- [ ] All existing `financial_category` records have `classification` set correctly based on their `type`
- [ ] All tenants have the 7 system-default overhead categories seeded
- [ ] Seed is idempotent — `seedDefaultCategories()` does not create duplicates

### Service
- [ ] `POST /financial/entries` without `project_id` returns 201 Created
- [ ] `POST /financial/entries` with valid `project_id` returns 201 Created
- [ ] `POST /financial/entries` with invalid `project_id` UUID format returns 400
- [ ] `POST /financial/entries` with `project_id` not belonging to tenant returns 404
- [ ] `POST /financial/entries` with `tax_amount >= amount` returns 400
- [ ] `GET /financial/entries` without `project_id` query param returns all tenant entries
- [ ] `GET /financial/entries` with `project_id` returns only that project's entries

### Tests
- [ ] Unit test: create entry without `project_id` — success
- [ ] Unit test: create entry with `project_id` from different tenant — 404
- [ ] Unit test: create entry with `tax_amount` exceeding `amount` — 400
- [ ] Unit test: `payment_method` accepts `credit_card`, `debit_card`, `ACH`
- [ ] Unit test: overhead category seed runs correctly (16 categories)
- [ ] All existing financial entry tests pass without being deleted
- [ ] Tenant isolation test: entry without `project_id` is scoped to correct tenant

### Documentation
- [ ] `api/documentation/financial_REST_API.md` exists and covers:
  - `project_id` as optional on POST endpoint
  - New `payment_method` values documented
  - New optional fields documented with types and descriptions
  - Updated error codes table
  - All 12 category types documented
  - Category classification documented

---

## Gate Marker

**STOP — FINAL GATE FOR F-01**

This is the blocking gate for the entire Financial Module. The following sprints CANNOT begin until every item in the checklist above is confirmed TRUE:

- Sprint F-02 — Supplier Registry
- Sprint F-03 — Payment Method Registry
- Sprint F-04 — General Expense Entry Engine
- Sprint F-05 — Receipt OCR
- Sprint F-06 — Recurring Expense Engine
- Sprint F-07 — Project Financial Intelligence
- Sprint F-08 — Draw Schedule → Invoice Automation
- Sprint F-09 — Business Financial Dashboard
- Sprint F-10 — QuickBooks/Xero Export Readiness

**If any acceptance criterion is not met, DO NOT proceed. Fix the issue in the appropriate sprint file (1.1–1.4) and re-verify.**

---

## Handoff Notes

**For downstream sprints (F-02 through F-10):**
- `financial_entry.project_id` is nullable — all queries must handle NULL project_id
- `financial_entry.supplier_id` is a plain String? field — no FK relation until F-02 adds the supplier table
- `financial_entry.recurring_rule_id` is a plain String? field — no FK relation until F-06 adds the recurring_expense_rule table
- `payment_method` enum has 8 values — F-03 (Payment Method Registry) may add a registry table but the enum stays
- `financial_category.classification` distinguishes COGS from OpEx — F-09 (Business Financial Dashboard) uses this for P&L
- `expense_submission_status` has 2 values — F-04 wires role-based defaulting
- The 7 overhead categories are seeded per tenant — F-04 and F-09 use these
- API documentation is at `api/documentation/financial_REST_API.md`
