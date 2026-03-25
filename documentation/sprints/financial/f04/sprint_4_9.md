# Sprint 4_9 — Final Verification Gate (FINAL STOP)

**Module:** Financial
**File:** ./documentation/sprints/financial/f04/sprint_4_9.md
**Type:** Verification
**Depends On:** Sprint 4_8 (API documentation complete)
**Gate:** FINAL STOP — All acceptance criteria must be verified, all tests passing, all endpoints functional
**Estimated Complexity:** Medium

---

> **You are a masterclass-level engineer.** Your code makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is intentional, precise, and production-grade.

> ⚠️ **CRITICAL WARNINGS:**
> - This platform is **85% production-ready**. Never break existing code. Not a single comma.
> - Never leave the dev server running in the background when you finish.
> - Read the codebase BEFORE touching anything. Implement with surgical precision.
> - MySQL credentials are in `/var/www/lead360.app/api/.env`
> - This project does **NOT** use PM2. Do not reference or run any PM2 command.

---

## Objective

This is the final verification sprint for F-04 (General Expense Entry Engine). Your job is to:

1. Run all tests and confirm they pass
2. Start the dev server and verify every endpoint
3. Verify the schema migration is clean
4. Verify the API documentation is complete and accurate
5. Walk through every acceptance criterion from the F-04 contract
6. Fix any issues found (minor fixes only — if major issues, stop and report)

This is NOT a development sprint. This is a quality gate. Nothing new is built here — only verification and minor fixes.

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

### Task 1 — Run Full Test Suite

```bash
cd /var/www/lead360.app/api

# Run ALL financial module tests
npx jest src/modules/financial/ --verbose

# Run the entry service tests specifically
npx jest src/modules/financial/services/financial-entry.service.spec.ts --verbose
```

**Acceptance:** ALL tests pass. Zero failures. Zero skipped (unless explicitly noted as future sprint work).

**If tests fail:** Fix the test or the code. Document what was fixed and why.

---

### Task 2 — Verify Schema Migration

```bash
cd /var/www/lead360.app/api

# Verify no pending migrations
npx prisma migrate status

# Verify schema is in sync
npx prisma validate
```

**Acceptance:**
- No pending migrations
- Schema validates without errors
- The `financial_entry_rejection_fields` migration exists and is applied

---

### Task 3 — Verify Dev Server Compilation

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

**Acceptance:**
- Server starts without TypeScript compilation errors
- No warnings related to financial module
- Health check returns 200

---

### Task 4 — Verify Route Registration

```bash
# All routes must return 401 (not 404)
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/entries
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/financial/entries
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/entries/pending
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/entries/export
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/entries/00000000-0000-0000-0000-000000000001
curl -s -o /dev/null -w "%{http_code}" -X PATCH http://localhost:8000/financial/entries/00000000-0000-0000-0000-000000000001
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:8000/financial/entries/00000000-0000-0000-0000-000000000001
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/financial/entries/00000000-0000-0000-0000-000000000001/approve
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/financial/entries/00000000-0000-0000-0000-000000000001/reject
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/financial/entries/00000000-0000-0000-0000-000000000001/resubmit
```

**Acceptance:** ALL return 401 (Unauthorized). NONE return 404.

---

### Task 5 — Verify Route Ordering (Critical)

```bash
# These must NOT return 400 "Validation failed (uuid is expected)"
curl -s -w "\n%{http_code}" http://localhost:8000/financial/entries/pending
curl -s -w "\n%{http_code}" http://localhost:8000/financial/entries/export
```

**Acceptance:** Both return 401 (not 400/422). This proves the static routes are registered before the parameterized `:id` route.

---

### Task 6 — Verify Swagger Documentation

```bash
# Check Swagger JSON includes all financial entry endpoints
curl -s http://localhost:8000/api/docs-json | python3 -c "
import sys, json
d = json.load(sys.stdin)
paths = [p for p in d.get('paths', {}) if 'entries' in p]
for p in sorted(paths):
    methods = list(d['paths'][p].keys())
    print(f'{p}: {methods}')
"
```

**Expected output should include:**
```
/financial/entries: ['get', 'post']
/financial/entries/export: ['get']
/financial/entries/pending: ['get']
/financial/entries/{id}: ['get', 'patch', 'delete']
/financial/entries/{id}/approve: ['post']
/financial/entries/{id}/reject: ['post']
/financial/entries/{id}/resubmit: ['post']
```

---

### Task 7 — Verify API Documentation File Exists

```bash
ls -la /var/www/lead360.app/api/documentation/financial_f04_REST_API.md
```

**Acceptance:** File exists and is non-empty.

**Then:** Read the file and verify it contains:
- All 10 endpoints documented
- Role-based behavior matrix
- Enriched response shape
- Pending workflow description
- Business rules section

---

### Task 8 — Walk Through Contract Acceptance Criteria

Go through EVERY acceptance criterion from the F-04 contract and verify it against the live code. Read the service file and controller file to confirm.

**Role-Based Behavior:**
- [ ] Employee creates entry → `submission_status` forced to `pending_review` regardless of request body
- [ ] Owner creates entry → `submission_status` defaults to `confirmed`
- [ ] Employee `GET /financial/entries` returns only their own entries
- [ ] Bookkeeper `GET /financial/entries` returns all tenant entries
- [ ] Employee PATCH on another user's entry returns 403
- [ ] Employee PATCH on own confirmed entry returns 403
- [ ] Manager DELETE on any entry returns 403
- [ ] Owner DELETE on confirmed entry returns 200

**Pending Workflow:**
- [ ] `GET /financial/entries/pending` returns only `pending_review` entries
- [ ] Employee cannot access `GET /financial/entries/pending` — returns 403
- [ ] `POST /financial/entries/:id/approve` sets status to confirmed
- [ ] Approving already-confirmed entry returns 400
- [ ] `POST /financial/entries/:id/reject` sets `rejection_reason`, `rejected_by_user_id`, `rejected_at`
- [ ] Rejecting non-pending entry returns 400
- [ ] Rejected entry remains in `pending_review` status — not deleted
- [ ] `POST /financial/entries/:id/resubmit` clears rejection fields, entry returns to clean pending state
- [ ] Resubmitting non-rejected entry returns 400

**Field Logic:**
- [ ] `payment_method_registry_id` provided → `payment_method` enum auto-populated from registry
- [ ] Both `purchased_by_user_id` and `purchased_by_crew_member_id` provided → 400
- [ ] `tax_amount >= amount` → 400
- [ ] Creating entry with `supplier_id` → `supplier.total_spend` updated
- [ ] Deleting entry with `supplier_id` → `supplier.total_spend` decremented

**List and Filter:**
- [ ] `GET /financial/entries` with `classification=operating_expense` returns only overhead entries
- [ ] `GET /financial/entries` with `date_from` and `date_to` filters correctly
- [ ] Response includes `summary` block with correct totals for full result set (not just current page)
- [ ] `search` parameter matches against `vendor_name` and `notes`

**Export:**
- [ ] `GET /financial/entries/export` returns CSV with correct headers
- [ ] Result set > 10,000 rows returns 400
- [ ] Employee cannot access export endpoint — 403

**Routing:**
- [ ] `GET /financial/entries/pending` does not conflict with `GET /financial/entries/:id`
- [ ] `GET /financial/entries/export` does not conflict with `GET /financial/entries/:id`

---

### Task 9 — Verify Files That Must NOT Be Modified

Confirm these files were NOT modified during F-04:

```bash
cd /var/www/lead360.app/api

# These files must be UNCHANGED
git diff HEAD -- src/modules/quotes/
git diff HEAD -- src/modules/projects/
git diff HEAD -- src/modules/financial/services/crew-payment.service.ts
git diff HEAD -- src/modules/financial/services/subcontractor-payment.service.ts
git diff HEAD -- src/modules/financial/services/crew-hour-log.service.ts
git diff HEAD -- src/modules/financial/services/subcontractor-invoice.service.ts
```

**Acceptance:** No changes to any of these files.

---

### Task 10 — Verify Existing Endpoints Still Work

Verify that existing financial endpoints (categories, receipts, crew payments, etc.) were not broken:

```bash
# Financial categories endpoint should still work
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/settings/financial-categories
# Expected: 401 (route exists, needs auth)

# Project financial summary should still work
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/projects/00000000-0000-0000-0000-000000000001/financial-summary
# Expected: 401 (route exists, needs auth)

# Receipts should still work
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/receipts
# Expected: 401 (route exists, needs auth)
```

**Acceptance:** All existing routes return 401 (not 404 or 500).

---

### Task 11 — Final Report

**What:** Produce a completion report summarizing:

```markdown
## F-04 Completion Report

**Status:** ✅ Complete / ⚠️ Issues Found / ❌ Blocked

### Schema
- [ ] Migration applied: financial_entry_rejection_fields
- [ ] Schema validates: npx prisma validate passes
- [ ] All F-01/F-02/F-03 fields present

### Endpoints (10 total)
- [ ] POST /financial/entries — Working
- [ ] GET /financial/entries — Working
- [ ] GET /financial/entries/pending — Working
- [ ] GET /financial/entries/export — Working
- [ ] GET /financial/entries/:id — Working
- [ ] PATCH /financial/entries/:id — Working
- [ ] DELETE /financial/entries/:id — Working
- [ ] POST /financial/entries/:id/approve — Working
- [ ] POST /financial/entries/:id/reject — Working
- [ ] POST /financial/entries/:id/resubmit — Working

### Tests
- [ ] All unit tests passing
- [ ] All existing tests passing
- [ ] No test regressions

### Documentation
- [ ] API docs complete at /api/documentation/financial_f04_REST_API.md
- [ ] 100% endpoint coverage

### Files Modified
- api/prisma/schema.prisma (3 fields + 1 relation + 1 index)
- api/src/modules/financial/dto/create-financial-entry.dto.ts (rebuilt)
- api/src/modules/financial/dto/update-financial-entry.dto.ts (rebuilt)
- api/src/modules/financial/dto/list-financial-entries-query.dto.ts (NEW)
- api/src/modules/financial/dto/list-pending-entries-query.dto.ts (NEW)
- api/src/modules/financial/dto/approve-entry.dto.ts (NEW)
- api/src/modules/financial/dto/reject-entry.dto.ts (NEW)
- api/src/modules/financial/dto/resubmit-entry.dto.ts (NEW)
- api/src/modules/financial/services/financial-entry.service.ts (rebuilt)
- api/src/modules/financial/controllers/financial-entry.controller.ts (rebuilt)
- api/src/modules/financial/services/financial-entry.service.spec.ts (rebuilt)
- api/src/modules/financial/financial.module.ts (updated if needed)
- api/documentation/financial_f04_REST_API.md (NEW)

### Files NOT Modified (verified)
- api/src/modules/quotes/ — untouched
- api/src/modules/projects/ — untouched
- api/src/modules/financial/services/crew-payment.service.ts — untouched
- api/src/modules/financial/services/subcontractor-payment.service.ts — untouched
- api/src/modules/financial/services/crew-hour-log.service.ts — untouched
- api/src/modules/financial/services/subcontractor-invoice.service.ts — untouched

### Issues Found
- [List any issues or deviations from contract]
- [If none: "No issues found"]
```

---

## Acceptance Criteria

- [ ] ALL financial module tests pass (`npx jest src/modules/financial/ --verbose`)
- [ ] ALL 10 endpoints return 401 (route registered) when hit without auth
- [ ] Route ordering verified — `pending` and `export` not captured by `:id`
- [ ] Swagger shows all 10 endpoints
- [ ] API documentation exists and covers 100% of endpoints
- [ ] Schema migration applied and validates
- [ ] No existing code broken
- [ ] No forbidden files modified
- [ ] Completion report produced
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**FINAL STOP** — Sprint F-04 is complete. All acceptance criteria verified. The General Expense Entry Engine is ready for review.

Do NOT proceed to any other sprint until this gate is passed and the completion report is reviewed by the project owner.

---

## Handoff Notes

Sprint F-04 delivers:
- Full CRUD for financial entries with enhanced fields
- Business-level (non-project) expense recording
- Two-tier submit/post workflow (Employee → pending_review, privileged roles → confirmed)
- Pending review workflow (list pending, approve, reject, resubmit)
- CSV export with 10,000 row limit
- Role-based access control on all operations
- Supplier spend tracking hooks
- Payment method auto-copy from registry
- Enriched response shape with all joined human-readable names
- 100% API documentation

**Blocks:** F-05 (receipt OCR), F-07 (project financial summary), F-09 (business dashboard)
