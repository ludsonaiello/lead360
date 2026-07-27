# Sprint 16 — API Documentation Generation
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_16.md
**Type:** Documentation
**Depends On:** ALL previous sprints (1-15)
**Gate:** NONE (final sprint)
**Estimated Complexity:** Medium

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

---

## Objective

Review the entire implemented Time Clock codebase and produce comprehensive REST API documentation at `api/documentation/time-clock_REST_API.md`. This sprint writes NO implementation code — only documentation. The resulting file is the authoritative reference for the frontend agent and must have 100% endpoint coverage.

---

## Pre-Sprint Checklist
- [ ] Verify ALL previous sprints (1-15) are complete
- [ ] Verify the dev server compiles without errors
- [ ] Verify Swagger is accessible at `http://localhost:8000/api/docs`
- [ ] All 57 endpoints respond without 500 errors
- [ ] Both background jobs execute without errors in server logs

---

## Environment

- **This project does NOT use PM2. Do not reference or run any PM2 command.**
- **Database credentials**: Read from `.env` file (`DATABASE_URL`). Never hardcode credentials.
- **Dev server runs in watch mode**: `npm run start:dev` (NestJS hot-reload)
- Port: **8000**, Global prefix: **api/v1**, Base URL: `http://127.0.0.1:8000/api/v1`
- Swagger: `http://127.0.0.1:8000/api/docs`
- Validation pipe: `whitelist: true, forbidNonWhitelisted: true`
- Tenant ID: ALWAYS from JWT (`req.user.tenant_id`), NEVER from request body
- User ID: ALWAYS from JWT (`req.user.id`), NEVER from request body
- Every DB query MUST include `tenant_id` filter — no exceptions

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

WAIT -- the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   <- must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests -- keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   <- must return nothing
```

---

## Tasks

### Task 1 — Read ALL Implemented Files

Before writing any documentation, read and understand every file in the time-clock module:

**Controllers** (read all):
- `api/src/modules/time-clock/controllers/time-clock-settings.controller.ts`
- `api/src/modules/time-clock/controllers/employee-profile.controller.ts`
- `api/src/modules/time-clock/controllers/clockin-address.controller.ts`
- `api/src/modules/time-clock/controllers/employee-project-assignment.controller.ts`
- `api/src/modules/time-clock/controllers/work-shift.controller.ts`
- `api/src/modules/time-clock/controllers/clock-session.controller.ts`
- `api/src/modules/time-clock/controllers/break.controller.ts`
- `api/src/modules/time-clock/controllers/clock-session-edit.controller.ts`
- `api/src/modules/time-clock/controllers/time-dispute.controller.ts`
- `api/src/modules/time-clock/controllers/kiosk.controller.ts`
- `api/src/modules/time-clock/controllers/time-clock-dashboard.controller.ts`
- `api/src/modules/time-clock/controllers/time-clock-reports.controller.ts`

**Services** (read all):
- `api/src/modules/time-clock/services/time-clock-settings.service.ts`
- `api/src/modules/time-clock/services/employee-profile.service.ts`
- `api/src/modules/time-clock/services/clockin-address.service.ts`
- `api/src/modules/time-clock/services/employee-project-assignment.service.ts`
- `api/src/modules/time-clock/services/work-shift.service.ts`
- `api/src/modules/time-clock/services/clock-session.service.ts`
- `api/src/modules/time-clock/services/break.service.ts`
- `api/src/modules/time-clock/services/clock-session-edit.service.ts`
- `api/src/modules/time-clock/services/time-dispute.service.ts`
- `api/src/modules/time-clock/services/kiosk.service.ts`
- `api/src/modules/time-clock/services/overtime.service.ts`
- `api/src/modules/time-clock/services/labor-cost-attribution.service.ts`
- `api/src/modules/time-clock/services/geofence.service.ts`
- `api/src/modules/time-clock/services/time-clock-dashboard.service.ts`
- `api/src/modules/time-clock/services/time-clock-reports.service.ts`
- `api/src/modules/time-clock/services/missed-shift.service.ts`
- `api/src/modules/time-clock/services/shift-reminder.service.ts`

**DTOs** (read all):
- `api/src/modules/time-clock/dto/` — all files

**Guards:**
- `api/src/modules/time-clock/guards/kiosk-token.guard.ts`

**Processors / Schedulers:**
- `api/src/modules/time-clock/processors/time-clock.processor.ts`
- `api/src/modules/time-clock/schedulers/time-clock.scheduler.ts`

**Prisma schema:**
- `api/prisma/schema.prisma` — all time-clock models and enums

---

### Task 2 — Produce `api/documentation/time-clock_REST_API.md`

Create the file at `api/documentation/time-clock_REST_API.md` with 100% endpoint coverage (57 endpoints + 2 background jobs).

**Required sections:**

#### 2a. Header and Overview
- Module name, base URL, authentication method (JWT Bearer + Kiosk Token)
- Total endpoint count (57 + 2 background jobs)

#### 2b. Authentication Section
- JWT Bearer token: how to obtain, header format, token expiry
- Kiosk Token: `X-Kiosk-Token` header, how tokens are validated
- Which endpoints use which auth method

#### 2c. RBAC Permission Matrix
Table showing every endpoint and which roles can access it:
| Endpoint | Owner | Admin | PM | Bookkeeper | Field Worker |
|---|---|---|---|---|---|

#### 2d. Enum Reference
Document all 12 time-clock enums with their values:
- `clock_in_mode`, `geofence_violation_action`, `gps_unavailable_action`, `pay_period_type`
- `clock_session_status`, `location_source`, `geofence_status`, `break_type`
- `shift_status`, `dispute_type`, `dispute_status`, `edit_field_type`

#### 2e. Pagination Format Reference
Standard pagination response format used across all paginated endpoints:
```json
{
  "data": [...],
  "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
}
```

#### 2f. Error Response Format
Standard error response shape for all endpoints:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```
List all standard HTTP status codes used: 200, 201, 400, 401, 403, 404, 409, 422, 423, 429, 500.

#### 2g. ALL Endpoints (57 total)

For EVERY endpoint, document:
1. **HTTP method and full path** (e.g., `POST /api/v1/time-clock/sessions/clock-in`)
2. **Description** (1-2 sentences)
3. **Required roles** (e.g., Owner, Admin, PM)
4. **Request body / query parameter schema** — all fields, types, validation rules, required vs optional
5. **Response body schema** — all fields, types, with a complete JSON example
6. **All possible HTTP status codes** and when they occur
7. **Business rules** that apply to this endpoint
8. **Audit log requirements** (if any)

**Endpoint groups (organize by controller):**

**Settings (3 endpoints):**
- GET /api/v1/time-clock/settings
- PATCH /api/v1/time-clock/settings
- POST /api/v1/time-clock/settings/generate-kiosk-token

**Employee Profiles (7 endpoints):**
- GET /api/v1/time-clock/employees
- GET /api/v1/time-clock/employees/:id
- POST /api/v1/time-clock/employees
- PATCH /api/v1/time-clock/employees/:id
- PATCH /api/v1/time-clock/employees/:id/pin
- PATCH /api/v1/time-clock/employees/:id/deactivate
- PATCH /api/v1/time-clock/employees/:id/reactivate

**Clock-In Addresses (7 endpoints):**
- GET /api/v1/time-clock/addresses
- GET /api/v1/time-clock/addresses/:id
- POST /api/v1/time-clock/addresses
- PATCH /api/v1/time-clock/addresses/:id
- DELETE /api/v1/time-clock/addresses/:id
- POST /api/v1/time-clock/addresses/import/quote
- POST /api/v1/time-clock/addresses/import/lead

**Employee-Project Assignments (3 endpoints):**
- GET /api/v1/time-clock/employees/:employeeId/projects
- POST /api/v1/time-clock/employees/:employeeId/projects
- DELETE /api/v1/time-clock/employees/:employeeId/projects/:projectId

**Work Shifts (7 endpoints):**
- GET /api/v1/time-clock/shifts
- GET /api/v1/time-clock/shifts/:id
- POST /api/v1/time-clock/shifts
- PATCH /api/v1/time-clock/shifts/:id
- DELETE /api/v1/time-clock/shifts/:id
- POST /api/v1/time-clock/shifts/bulk
- GET /api/v1/time-clock/shifts/mine

**Clock Sessions (8 endpoints):**
- POST /api/v1/time-clock/sessions/clock-in
- POST /api/v1/time-clock/sessions/clock-out
- GET /api/v1/time-clock/sessions
- GET /api/v1/time-clock/sessions/:id
- GET /api/v1/time-clock/sessions/active
- GET /api/v1/time-clock/sessions/mine
- GET /api/v1/time-clock/sessions/mine/active
- GET /api/v1/time-clock/sessions/mine/history

**Breaks (3 endpoints):**
- POST /api/v1/time-clock/sessions/:sessionId/breaks/start
- POST /api/v1/time-clock/sessions/:sessionId/breaks/end
- GET /api/v1/time-clock/sessions/:sessionId/breaks

**Manual Edit (1 endpoint):**
- PATCH /api/v1/time-clock/sessions/:id/edit

**Disputes (7 endpoints):**
- POST /api/v1/time-clock/disputes
- GET /api/v1/time-clock/disputes
- GET /api/v1/time-clock/disputes/:id
- GET /api/v1/time-clock/disputes/mine
- PATCH /api/v1/time-clock/disputes/:id/approve
- PATCH /api/v1/time-clock/disputes/:id/reject
- DELETE /api/v1/time-clock/disputes/:id

**Kiosk (3 endpoints):**
- GET /api/v1/time-clock/kiosk/employees
- POST /api/v1/time-clock/kiosk/clock-in
- POST /api/v1/time-clock/kiosk/clock-out

**Dashboard (1 endpoint):**
- GET /api/v1/time-clock/dashboard/whos-in

**Reports (6 endpoints):**
- GET /api/v1/time-clock/reports/timesheet
- GET /api/v1/time-clock/reports/payroll
- GET /api/v1/time-clock/reports/payroll/export
- GET /api/v1/time-clock/reports/shift-variance
- GET /api/v1/time-clock/reports/geo-violations
- GET /api/v1/time-clock/reports/activity-feed

#### 2h. Background Jobs Section
Document the 2 background jobs with:
- Job name
- Cron schedule
- Logic summary
- Notifications triggered
- Error handling behavior

**Missed Shift Detector:**
- Cron: `*/15 * * * *` (every 15 minutes)
- Logic: per-tenant, checks `work_shift` with `status='scheduled'` past threshold, marks as `missed`
- Notifications: admin (timeclock_missed_shift), employee (timeclock_missed_shift)
- Error isolation: per-tenant try/catch

**Shift Reminder:**
- Cron: `* * * * *` (every minute)
- Logic: per-tenant, finds published shifts within reminder window, sets `reminder_sent_at` before send
- Notifications: employee only (timeclock_shift_reminder)
- Error isolation: per-tenant try/catch

#### 2i. Notification Events Table

| Event Type | Recipients | Title | Message Template | Trigger |
|---|---|---|---|---|
| `timeclock_kiosk_lockout` | Tenant Admins + Owners | Kiosk Account Locked | {name} has been locked out... | 5 failed PIN attempts |
| `timeclock_missed_shift` | Admins + Employee | Missed Shift | {name} has not clocked in... | Shift past threshold |
| `timeclock_shift_reminder` | Employee only | Upcoming Shift | Your shift starts in {min}... | Shift within reminder window |

---

### Task 3 — Cross-Check Documentation Against Implementation

After producing the documentation file:

1. **Verify every endpoint listed in the documentation actually exists** — run `curl` against each one and confirm it responds (not 404).
2. **Verify request/response shapes match** — compare the documented shapes against actual API responses.
3. **Report any discrepancies** — if the implementation differs from the documentation, update the documentation to match the implementation (the implementation is the source of truth).
4. **Check for undocumented endpoints** — review all controllers to ensure no endpoints were missed.

---

### Task 4 — Verify Swagger Accessibility

1. Start the dev server
2. Open `http://localhost:8000/api/docs` (curl or verify it returns HTML)
3. Confirm all time-clock endpoints are visible in the Swagger UI
4. Verify the Swagger groups match: Settings, Employee Profiles, Addresses, Assignments, Shifts, Sessions, Breaks, Edit, Disputes, Kiosk, Dashboard, Reports

```bash
# Verify Swagger is accessible
curl -s http://localhost:8000/api/docs -o /dev/null -w "%{http_code}"
# Expected: 200 (or 301 redirect to /api/docs/)

# Optionally fetch the JSON spec
curl -s http://localhost:8000/api/docs-json | jq '.paths | keys | length'
# Expected: should list all endpoint paths
```

---

## Files Created in This Sprint

| File | Purpose |
|---|---|
| `api/documentation/time-clock_REST_API.md` | Complete REST API documentation for the time-clock module (57 endpoints + 2 background jobs) |

---

## Acceptance Criteria
- [ ] `api/documentation/time-clock_REST_API.md` exists and is non-empty
- [ ] Documentation covers ALL 57 endpoints (zero omissions)
- [ ] Documentation covers 2 background jobs
- [ ] Every endpoint has: method, path, roles, request schema, response schema, status codes, business rules
- [ ] Enum reference section lists all 12 enums with values
- [ ] RBAC permission matrix is complete
- [ ] Pagination format documented
- [ ] Error response format documented
- [ ] Authentication section covers both JWT and Kiosk Token
- [ ] Notification events table is complete
- [ ] Cross-check: every documented endpoint responds (not 404) when tested
- [ ] Cross-check: response shapes match documentation
- [ ] Swagger is accessible at `http://localhost:8000/api/docs`
- [ ] No implementation code modified in this sprint
- [ ] No frontend code modified
- [ ] Dev server shut down before sprint is marked complete

---

## Handoff Notes
- This is the FINAL backend sprint for the time-clock module
- After this sprint is complete, the full API documentation file (`api/documentation/time-clock_REST_API.md`) is the authoritative reference for the frontend agent
- The frontend agent will use this documentation as the sole source of truth for all API integration
- Ensure every response shape, every field name, every status code is accurate in the documentation
- The frontend sprints cannot begin until this documentation is complete and verified
- If any endpoint behavior differs from the sprint specifications (1-15), the IMPLEMENTATION is the source of truth — document what the code actually does, not what the sprint spec said
