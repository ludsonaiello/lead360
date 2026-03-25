# Sprint 6_8 — API Documentation + Final Gate Verification

**Module:** Financial
**File:** ./documentation/sprints/financial/f06/sprint_6_8.md
**Type:** Backend — Documentation + Verification
**Depends On:** Sprint 6_5 (controller), Sprint 6_6 (BullMQ), Sprint 6_7 (tests)
**Gate:** STOP — FINAL GATE. All acceptance criteria from the F-06 contract must be met. Migration must be clean. All tests must pass. Full API documentation must be produced from the REAL codebase.
**Estimated Complexity:** Medium

---

> **You are a masterclass-level backend engineer.** Your code quality makes engineers at Google, Amazon, and Apple jealous. Every line you write is precise, intentional, and production-grade.

> **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> **MySQL credentials** are in the `.env` file at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.

---

## Objective

Produce comprehensive API documentation for the Recurring Expense Rules endpoints, based on the REAL implemented codebase — not assumptions. Then verify every acceptance criterion from the F-06 contract. This is the final gate before the sprint is considered complete.

---

## Pre-Sprint Checklist

- [ ] Read the ENTIRE implemented `RecurringExpenseService` — `/var/www/lead360.app/api/src/modules/financial/services/recurring-expense.service.ts`
- [ ] Read the ENTIRE `RecurringExpenseController` — `/var/www/lead360.app/api/src/modules/financial/controllers/recurring-expense.controller.ts`
- [ ] Read ALL 6 DTOs in `/var/www/lead360.app/api/src/modules/financial/dto/`
- [ ] Read the scheduler — `/var/www/lead360.app/api/src/modules/jobs/schedulers/recurring-expense.scheduler.ts`
- [ ] Read the processor — `/var/www/lead360.app/api/src/modules/jobs/processors/recurring-expense.processor.ts`
- [ ] Read `financial.module.ts` and `jobs.module.ts` to verify registration
- [ ] Read the Prisma schema for `recurring_expense_rule` model

---

## Dev Server

> This project does NOT use PM2. Do not reference or run PM2 commands.
> Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

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

### Task 1 — Produce Full API Documentation

**File:** `/var/www/lead360.app/api/documentation/recurring_expense_rules_REST_API.md`

**IMPORTANT:** This documentation must be based on the REAL codebase. Read every controller method, every DTO field, every service method BEFORE writing documentation. Do NOT copy from the sprint contract — document what was ACTUALLY built.

**Documentation must include for EVERY endpoint:**

1. **Method + Path** (e.g., `POST /financial/recurring-rules`)
2. **Description** — one sentence
3. **Authentication** — Bearer token required
4. **Roles** — which roles can access
5. **Request body** (if POST/PATCH) — every field, type, required/optional, validation rules, min/max, defaults
6. **Query parameters** (if GET) — every param, type, required/optional, defaults
7. **Path parameters** (if :id) — type, validation
8. **Success response** — status code, full response body shape (every field)
9. **Error responses** — every possible error status code with description
10. **Example request** — curl command
11. **Example response** — JSON body

**Endpoint documentation order:**

```markdown
# Recurring Expense Rules — REST API Documentation

## Overview
Brief description of the recurring expense engine.

## Base URL
`https://api.lead360.app` or `http://localhost:8000`

## Authentication
All endpoints require `Authorization: Bearer <token>` header.

## Endpoints

### 1. GET /financial/recurring-rules/preview
### 2. GET /financial/recurring-rules
### 3. POST /financial/recurring-rules
### 4. GET /financial/recurring-rules/:id
### 5. PATCH /financial/recurring-rules/:id
### 6. DELETE /financial/recurring-rules/:id
### 7. POST /financial/recurring-rules/:id/pause
### 8. POST /financial/recurring-rules/:id/resume
### 9. POST /financial/recurring-rules/:id/trigger
### 10. POST /financial/recurring-rules/:id/skip
### 11. GET /financial/recurring-rules/:id/history

## Enums
### recurring_frequency
### recurring_rule_status

## Data Model
### recurring_expense_rule
Full field reference with types and descriptions.

## Schedule Calculation Logic
Document `calculateNextDueDate()` behavior for each frequency.

## Monthly Obligation Normalization
Document the formula for each frequency.

## Business Rules
1-12 numbered list of all business rules.

## Scheduler
Cron schedule, behavior, job payload shape.
```

**Per-endpoint documentation template:**

```markdown
### POST /financial/recurring-rules

**Description:** Create a new recurring expense rule.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Default | Description |
|-------|------|----------|------------|---------|-------------|
| name | string | Yes | max 200 chars | — | Rule name |
| ... | ... | ... | ... | ... | ... |

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "name": "Monthly Insurance",
  ...
}
```

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Validation error (start_date in past, day_of_month > 28, etc.) |
| 401 | Missing or invalid token |
| 403 | Insufficient role |

**Example:**

```bash
curl -X POST http://localhost:8000/financial/recurring-rules \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Monthly Insurance Premium",
    "category_id": "<uuid>",
    "amount": 1850.00,
    "frequency": "monthly",
    "start_date": "2026-04-01",
    "auto_confirm": true
  }'
```
```

---

### Task 2 — Update Existing Financial API Documentation (If Exists)

**Check:** Does `/var/www/lead360.app/api/documentation/financial_REST_API.md` exist?

If it exists, add a section for recurring expense rules or add a reference to the new standalone doc file.

If it doesn't exist, the standalone doc created in Task 1 is sufficient.

---

### Task 3 — End-to-End Verification Checklist

**Start the dev server and verify each item systematically.**

**Schema Verification:**
```bash
# Use credentials from .env — do NOT hardcode them
cd /var/www/lead360.app/api && npx prisma db execute --stdin <<< "DESCRIBE recurring_expense_rule;"
cd /var/www/lead360.app/api && npx prisma db execute --stdin <<< "SHOW INDEX FROM recurring_expense_rule;"
```

- [ ] `recurring_expense_rule` table exists with all 28 columns
- [ ] All 5 indexes exist: `(tenant_id, status)`, `(tenant_id, next_due_date)`, `(tenant_id, status, next_due_date)`, `(tenant_id, category_id)`, `(tenant_id, created_at)`
- [ ] `recurring_frequency` enum has: daily, weekly, monthly, quarterly, annual
- [ ] `recurring_rule_status` enum has: active, paused, completed, cancelled

**Swagger Verification:**
```bash
curl -s http://localhost:8000/api/docs-json | python3 -c "
import sys, json
data = json.load(sys.stdin)
paths = [p for p in data.get('paths', {}).keys() if 'recurring' in p]
for p in sorted(paths): print(p)
"
```

- [ ] All 11 endpoint paths visible in Swagger (11 unique endpoints total)
- [ ] `preview` route doesn't collide with `:id` route

**Compilation Verification:**
```bash
cd /var/www/lead360.app/api && npx tsc --noEmit
```

- [ ] Zero TypeScript errors

**Test Verification:**
```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern="recurring-expense" --verbose
```

- [ ] All unit tests pass

**Module Registration Verification:**
Read `financial.module.ts` and verify:
- [ ] `RecurringExpenseController` in controllers array
- [ ] `RecurringExpenseService` in providers array
- [ ] `RecurringExpenseService` in exports array
- [ ] `BullModule.registerQueue({ name: 'recurring-expense-generation' })` in imports

Read `jobs.module.ts` and verify:
- [ ] `{ name: 'recurring-expense-generation' }` in BullModule.registerQueue
- [ ] `RecurringExpenseProcessor` in providers
- [ ] `RecurringExpenseScheduler` in providers
- [ ] Processor injected in constructor for forced instantiation

**Console Log Verification:**
Start the dev server and check for:
- [ ] `RecurringExpenseProcessor worker initialized and ready` in console output
- [ ] No circular dependency warnings
- [ ] No missing provider errors

---

### Task 4 — Contract Acceptance Criteria Review

**Go through EVERY acceptance criterion from the F-06 contract and verify:**

**Schema:**
- [ ] `recurring_expense_rule` table exists in schema and database
- [ ] `recurring_frequency` and `recurring_rule_status` enums exist
- [ ] `financial_entry.recurring_rule_id` Prisma relation wired
- [ ] Migration runs cleanly (already applied)

**CRUD:**
- [ ] `POST /financial/recurring-rules` creates rule with correct `next_due_date = start_date`
- [ ] `start_date` in the past returns 400
- [ ] `day_of_month > 28` returns 400
- [ ] 101st active rule returns 400
- [ ] `PATCH` on cancelled rule returns 400
- [ ] `DELETE` sets status = cancelled, does not hard-delete
- [ ] Generated entries are not deleted when rule is cancelled

**Lifecycle:**
- [ ] Pause sets status = paused, rule is skipped by scheduler
- [ ] Resume advances `next_due_date` to future if it was in the past
- [ ] Skip advances `next_due_date` by one occurrence and increments `occurrences_generated`
- [ ] Rule auto-completes when `recurrence_count` reached
- [ ] Rule auto-completes when `end_date` passed

**Scheduler:**
- [ ] Nightly job cron expression is `0 2 * * *`
- [ ] Only processes rules with `status = active` and `next_due_date <= TODAY`
- [ ] Paused rules are skipped
- [ ] Generated entry has `is_recurring_instance = true` and `recurring_rule_id = rule.id`
- [ ] `auto_confirm = true` → entry `submission_status = confirmed`
- [ ] `auto_confirm = false` → entry `submission_status = pending_review`
- [ ] Entry creation failure rolls back rule update (transaction)
- [ ] Scheduler does not generate duplicate entries on same-day re-run

**Schedule Calculation:**
- [ ] Monthly rule on Jan 31 generates Feb 28 for next month (not Mar 2)
- [ ] Weekly rule with `interval=2` generates every 14 days
- [ ] Annual rule generates same date next year
- [ ] `calculateNextDueDate()` is a pure function with no DB calls

**Preview:**
- [ ] `GET /preview?days=30` returns all occurrences within 30 days
- [ ] Monthly rule appears once in 30-day preview, ~3 times in 90-day preview
- [ ] Preview never creates any entries

**History:**
- [ ] `GET /:id/history` returns only entries with `recurring_rule_id = rule.id`
- [ ] Entries ordered by `entry_date DESC`

**Tests:**
- [ ] Unit test: `calculateNextDueDate()` for all frequencies including edge cases
- [ ] Unit test: monthly rule on day 31 — end-of-month snapping
- [ ] Unit test: `getPreview()` — correct occurrence count
- [ ] Unit test: `processRule()` — entry created with correct fields
- [ ] Unit test: termination condition — `recurrence_count` reached
- [ ] Unit test: resume after pause — `next_due_date` recalculated to future
- [ ] Tenant isolation: all queries include `tenant_id` WHERE clause

**Documentation:**
- [ ] `api/documentation/recurring_expense_rules_REST_API.md` complete with all endpoints
- [ ] Schedule calculation logic documented
- [ ] `monthly_obligation` normalization formula documented
- [ ] Business rules around pause/resume/skip documented

---

### Task 5 — Fix Any Issues Found

If any acceptance criterion fails during verification:

1. Identify the specific issue
2. Fix it in the correct file
3. Re-verify that criterion
4. Re-run tests to ensure no regression

**Do NOT mark this sprint complete with failing criteria.**

---

### Task 6 — Final Cleanup

- [ ] No TODO comments left in production code (except documented future work markers)
- [ ] No console.log statements (use Logger instead)
- [ ] No commented-out code
- [ ] All imports are used (no unused imports)

```bash
cd /var/www/lead360.app/api && npx tsc --noEmit && echo "CLEAN BUILD"
```

---

## Files Created/Modified in Entire F-06 Sprint

**Files Created:**
| File | Sprint |
|------|--------|
| `api/prisma/migrations/[timestamp]_recurring_expense_rule/migration.sql` | 6_1 |
| `api/src/modules/financial/dto/create-recurring-rule.dto.ts` | 6_2 |
| `api/src/modules/financial/dto/update-recurring-rule.dto.ts` | 6_2 |
| `api/src/modules/financial/dto/list-recurring-rules.dto.ts` | 6_2 |
| `api/src/modules/financial/dto/skip-recurring-rule.dto.ts` | 6_2 |
| `api/src/modules/financial/dto/recurring-rule-history.dto.ts` | 6_2 |
| `api/src/modules/financial/dto/preview-recurring-rules.dto.ts` | 6_2 |
| `api/src/modules/financial/services/recurring-expense.service.ts` | 6_3, 6_4 |
| `api/src/modules/financial/controllers/recurring-expense.controller.ts` | 6_5 |
| `api/src/modules/jobs/schedulers/recurring-expense.scheduler.ts` | 6_6 |
| `api/src/modules/jobs/processors/recurring-expense.processor.ts` | 6_6 |
| `api/src/modules/financial/services/recurring-expense.service.spec.ts` | 6_7 |
| `api/documentation/recurring_expense_rules_REST_API.md` | 6_8 |

**Files Modified:**
| File | Sprint | Changes |
|------|--------|---------|
| `api/prisma/schema.prisma` | 6_1 | New enums, new model, reverse relations |
| `api/src/modules/financial/financial.module.ts` | 6_5, 6_6 | Register controller, service, BullModule queue |
| `api/src/modules/jobs/jobs.module.ts` | 6_6 | Register queue, processor, scheduler, import FinancialModule |

**Files That Must NOT Be Modified:**
- Any file in `api/src/modules/quotes/`
- Any file in `api/src/modules/projects/`
- `api/src/modules/financial/services/financial-entry.service.ts` — F-06 calls it, does not modify it
- Any frontend file in `/var/www/lead360.app/app/`

---

## Acceptance Criteria (Sprint 6_8 Specific)

- [ ] API documentation produced at `api/documentation/recurring_expense_rules_REST_API.md`
- [ ] Documentation covers all 11 endpoints with full request/response shapes
- [ ] Documentation based on REAL codebase, not contract assumptions
- [ ] All F-06 contract acceptance criteria verified and passing
- [ ] All unit tests passing
- [ ] TypeScript compilation clean (zero errors)
- [ ] Swagger shows all endpoints
- [ ] No issues remaining in the checklist
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP — FINAL GATE.**

Before marking F-06 as complete, ALL of the following must be true:

1. `recurring_expense_rule` table exists in the database with all columns and indexes
2. All 11 API endpoints are functional and Swagger-documented (GET list, POST create, GET one, PATCH, DELETE, pause, resume, trigger, skip, history, preview)
3. BullMQ scheduler is registered with `@Cron('0 2 * * *')`
4. BullMQ processor is instantiated and listening on `recurring-expense-generation` queue
5. `calculateNextDueDate()` is a pure function handling all 5 frequencies with end-of-month snapping
6. `processRule()` wraps entry creation and rule update in a Prisma transaction
7. All unit tests pass
8. API documentation is complete and based on real code
9. TypeScript compiles cleanly
10. Dev server is shut down
11. No existing code was broken

**If ANY of these criteria fail, fix the issue before declaring the sprint complete.**

---

## Handoff Notes

- F-06 is complete when this gate passes
- The Recurring Expense Engine is a backend-only feature — no frontend in this sprint
- F-09 (Business Dashboard) will use `getPreview()` for cash flow forecasting
- F-07 (Project Financial Intelligence) runs in parallel and has no dependency on F-06
- The scheduler runs nightly at 02:00 AM — monitor logs for the first few days after deployment
