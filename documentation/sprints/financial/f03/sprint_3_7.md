# Sprint 3_7 — API Documentation + Final Verification (STOP Gate)

**Module:** Financial
**File:** ./documentation/sprints/financial/f03/sprint_3_7.md
**Type:** Documentation + Verification
**Depends On:** Sprint 3_6 (Unit Tests must pass)
**Gate:** FINAL STOP — All acceptance criteria from the F-03 Feature Contract must be met. Sprint F-03 is complete only when this gate passes.
**Estimated Complexity:** Medium

> **You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality.** Every line you write must reflect that standard.

> **WARNING:** This platform is 85% production-ready. Never leave the dev server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

---

## Objective

Produce complete REST API documentation for the Payment Method Registry endpoints. This documentation is based on the REAL implemented codebase — not assumptions. Read every service method, every controller endpoint, every DTO field, and document exactly what exists. Then verify all acceptance criteria from the Sprint F-03 Feature Contract.

---

## Pre-Sprint Checklist

- [ ] Sprint 3_6 complete — all unit tests passing
- [ ] Read the actual implemented code (not the sprint files — the REAL code):
  - `/var/www/lead360.app/api/src/modules/financial/controllers/payment-method-registry.controller.ts`
  - `/var/www/lead360.app/api/src/modules/financial/services/payment-method-registry.service.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/create-payment-method-registry.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/update-payment-method-registry.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/list-payment-methods.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` (for auto-copy documentation)
  - `/var/www/lead360.app/api/src/modules/financial/financial.module.ts`
- [ ] Read the existing API documentation for format reference:
  - `/var/www/lead360.app/api/documentation/financial_gate3_REST_API.md`

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

**MySQL credentials** are in `/var/www/lead360.app/api/.env` — do not hardcode any database credentials.

---

## Tasks

### Task 1 — Read All Implemented Code

**What:** Read every file listed in the Pre-Sprint Checklist above. Do NOT skip any file. Document what you find — field names, types, validation rules, error codes — exactly as implemented.

**Why:** The API documentation must reflect the REAL code, not assumptions or the original contract. If there are any deviations from the contract, document them.

**Do NOT:** Copy from the sprint files. Read the actual source code.

---

### Task 2 — Write Payment Method Registry REST API Documentation

**What:** Create/update the file at:
```
/var/www/lead360.app/api/documentation/financial_payment_methods_REST_API.md
```

**Documentation must include ALL of the following sections:**

1. **Header** — Module name, base URL, authentication, tenant isolation
2. **Table of Contents** — one entry per endpoint
3. **Each endpoint** must document:
   - HTTP method and full path
   - Description
   - Roles allowed
   - Request body (field name, type, required/optional, validation rules, examples)
   - Query parameters (for list endpoint)
   - Path parameters
   - Response (status code, full JSON example with all fields)
   - Error responses (every status code with description)
4. **Payment Method Auto-Copy Behavior** — how `financial_entry` creation works with `payment_method_registry_id`
5. **Default Management Behavior** — how defaults work, auto-reassignment on delete
6. **Technical Debt Note** — document that `crew_payment_record` and `subcontractor_payment_record` still use raw `payment_method` enum
7. **Common Error Response Format**
8. **Authentication**
9. **Audit Logging**

**Documentation format must match** the existing `financial_gate3_REST_API.md` format exactly — same markdown structure, same table formats, same JSON example style.

**The 6 endpoints to document:**

| # | Method | Path | Description |
|---|---|---|---|
| 1 | `GET` | `/financial/payment-methods` | List payment methods for tenant |
| 2 | `POST` | `/financial/payment-methods` | Create a payment method |
| 3 | `GET` | `/financial/payment-methods/:id` | Get single payment method |
| 4 | `PATCH` | `/financial/payment-methods/:id` | Update a payment method |
| 5 | `DELETE` | `/financial/payment-methods/:id` | Soft-delete (deactivate) |
| 6 | `POST` | `/financial/payment-methods/:id/set-default` | Set as tenant default |

**For each endpoint, include a JSON response example like this:**

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "nickname": "Chase Business Visa - Vehicle 1",
  "type": "credit_card",
  "bank_name": "Chase",
  "last_four": "4521",
  "notes": null,
  "is_default": true,
  "is_active": true,
  "usage_count": 12,
  "last_used_date": "2026-03-15T00:00:00.000Z",
  "created_by_user_id": "uuid",
  "updated_by_user_id": null,
  "created_at": "2026-03-01T10:00:00.000Z",
  "updated_at": "2026-03-01T10:00:00.000Z"
}
```

**Do NOT:**
- Guess response shapes — read the actual service code to determine the exact response shape
- Omit any field from the response examples
- Skip the technical debt note
- Copy documentation from the sprint files verbatim — base it on the real code

---

### Task 3 — Document the Financial Entry Integration

**What:** Add a section to the documentation explaining:

1. **Auto-Copy Behavior:**
   - When a `financial_entry` is created with `payment_method_registry_id`, the service looks up the registry record and copies its `type` into `financial_entry.payment_method`
   - The client does NOT need to provide both fields — only `payment_method_registry_id` is needed
   - The auto-copy ensures backward compatibility: queries filtering by `payment_method` enum still work without joining the registry table

2. **Quick Entry Flow:**
   - A `financial_entry` can still be created with just a raw `payment_method` enum value (no `payment_method_registry_id`)
   - Both fields are optional — entries can have neither, one, or both

3. **Field Relationship:**
   - `financial_entry.payment_method` (enum) — the raw type, always present when either field is set
   - `financial_entry.payment_method_registry_id` (FK) — points to the named account record, optional

---

### Task 4 — Document Technical Debt

**What:** Add a clearly visible section titled "Technical Debt" to the documentation with this note:

> **Note:** `crew_payment_record.payment_method` and `subcontractor_payment_record.payment_method` currently use a raw `payment_method` enum value. Migration to reference `payment_method_registry` is deferred to a future sprint. These tables continue to accept enum values directly and do not participate in the registry system.

---

### Task 5 — Verify All Endpoints Live

**What:** With the dev server running, test every endpoint via curl to confirm they work correctly. Use the test credentials.

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

# 1. GET /financial/payment-methods (should return array)
curl -s -X GET http://localhost:8000/financial/payment-methods \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 2. POST /financial/payment-methods (create)
curl -s -X POST http://localhost:8000/financial/payment-methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Final Test Visa","type":"credit_card","bank_name":"Chase","last_four":"1234","is_default":true}' | python3 -m json.tool

# 3. GET /financial/payment-methods/:id (get one — use ID from step 2)
# Replace PM_ID with the actual ID returned in step 2
curl -s -X GET http://localhost:8000/financial/payment-methods/PM_ID \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 4. PATCH /financial/payment-methods/:id (update)
curl -s -X PATCH http://localhost:8000/financial/payment-methods/PM_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Final Test Visa - Updated","bank_name":"Chase Bank"}' | python3 -m json.tool

# 5. POST /financial/payment-methods/:id/set-default
curl -s -X POST http://localhost:8000/financial/payment-methods/PM_ID/set-default \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 6. DELETE /financial/payment-methods/:id (soft delete)
curl -s -X DELETE http://localhost:8000/financial/payment-methods/PM_ID \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 7. Verify deleted record shows is_active=false
curl -s -X GET "http://localhost:8000/financial/payment-methods?is_active=false" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 8. Test error cases
# Duplicate nickname
curl -s -X POST http://localhost:8000/financial/payment-methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Final Test Visa - Updated","type":"cash"}' | python3 -m json.tool
# Should return 409 Conflict

# Invalid last_four
curl -s -X POST http://localhost:8000/financial/payment-methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Bad Card","type":"credit_card","last_four":"ABC"}' | python3 -m json.tool
# Should return 400 Bad Request
```

**Acceptance:** All 6 endpoints return expected responses. Error cases return correct status codes.

---

### Task 6 — Verify Swagger Documentation

**What:** Confirm all 6 endpoints appear in Swagger:

```bash
curl -s http://localhost:8000/api/docs-json | python3 -c "
import sys, json
spec = json.load(sys.stdin)
paths = spec.get('paths', {})
pm_paths = {k: list(v.keys()) for k, v in paths.items() if 'payment-method' in k}
for path, methods in sorted(pm_paths.items()):
    for m in methods:
        print(f'{m.upper()} {path}')
"
```

**Expected output (6 entries):**
```
GET /financial/payment-methods
POST /financial/payment-methods
GET /financial/payment-methods/{id}
PATCH /financial/payment-methods/{id}
DELETE /financial/payment-methods/{id}
POST /financial/payment-methods/{id}/set-default
```

---

### Task 7 — Run Full Test Suite

**What:** Ensure all tests pass:

```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern="payment-method-registry" --verbose
```

**Acceptance:** All tests pass. Zero failures.

---

### Task 8 — Verify Prisma Schema Integrity

**What:** Run Prisma validation and verify the schema is clean:

```bash
cd /var/www/lead360.app/api && npx prisma validate
```

**Acceptance:** No errors.

---

### Task 9 — Final Acceptance Criteria Checklist

Go through EVERY item below. Each must be verified as true. If any item fails, fix it before marking the sprint complete.

**Schema:**
- [ ] `payment_method_registry` table exists in Prisma schema with all 13 fields
- [ ] `financial_entry.payment_method_registry_id` has a Prisma relation to `payment_method_registry`
- [ ] `npx prisma validate` passes
- [ ] `npx prisma generate` runs without errors

**CRUD:**
- [ ] `POST /financial/payment-methods` creates a payment method — returns 201
- [ ] Duplicate nickname returns 409
- [ ] Invalid `last_four` format (not 4 digits) returns 400
- [ ] `GET /financial/payment-methods` returns ordered array with `usage_count` and `last_used_date`
- [ ] `GET /financial/payment-methods/:id` returns single record with usage data
- [ ] `PATCH /financial/payment-methods/:id` updates correctly — returns 200
- [ ] `DELETE /financial/payment-methods/:id` soft-deletes (is_active = false) — returns 200 with record

**Default Logic:**
- [ ] Creating with `is_default = true` unsets all other defaults atomically (transaction)
- [ ] `POST /:id/set-default` is atomic — no state with two defaults
- [ ] Deleting the default method auto-assigns default to most recent active method
- [ ] Setting inactive method as default returns 400

**Integration:**
- [ ] `FinancialEntryService.createEntry()` accepts `payment_method_registry_id`
- [ ] When `payment_method_registry_id` is provided, the registry record's `type` is auto-copied to `financial_entry.payment_method`
- [ ] `financial_entry` without `payment_method_registry_id` still accepts raw `payment_method` enum value

**Tests:**
- [ ] Unit tests for all service methods exist and pass
- [ ] Unit test: default atomicity verified
- [ ] Tenant isolation test: queries always include `tenant_id`

**Documentation:**
- [ ] `api/documentation/financial_payment_methods_REST_API.md` exists with 100% endpoint coverage
- [ ] Default auto-copy behavior documented
- [ ] Technical debt note documented: `crew_payment_record` and `subcontractor_payment_record` still use raw enum

**Module Registration:**
- [ ] `PaymentMethodRegistryService` is registered in `FinancialModule` providers
- [ ] `PaymentMethodRegistryService` is exported from `FinancialModule`
- [ ] `PaymentMethodRegistryController` is registered in `FinancialModule` controllers

**Safety:**
- [ ] No existing code was broken
- [ ] No frontend code was modified
- [ ] All existing tests still pass
- [ ] `crew-payment.service.ts` was NOT modified
- [ ] `subcontractor-payment.service.ts` was NOT modified
- [ ] Dev server is shut down before sprint is marked complete

---

## Gate Marker

**FINAL STOP** — Sprint F-03 (Payment Method Registry) is COMPLETE when:

1. All acceptance criteria above are checked and verified
2. API documentation file exists with 100% endpoint coverage
3. All 6 endpoints respond correctly via curl
4. All unit tests pass
5. Prisma schema validates cleanly
6. No existing functionality is broken
7. Dev server is shut down

**After this gate:** Sprint F-04 (General Expense Entry Engine) can begin. It will use `PaymentMethodRegistryService.findDefault()` for pre-populating new expense entries.

---

## Handoff Notes

**For Sprint F-04 (General Expense Entry Engine):**
- `PaymentMethodRegistryService` is exported from `FinancialModule`
- Call `findDefault(tenantId)` to get the default payment method for form pre-population
- Call `findAll(tenantId, { is_active: true })` to populate payment method dropdown
- The `financial_entry` model now accepts `payment_method_registry_id` — pass it when creating entries
- The auto-copy behavior is already implemented — when `payment_method_registry_id` is provided, `payment_method` is populated automatically
- API documentation: `api/documentation/financial_payment_methods_REST_API.md`
