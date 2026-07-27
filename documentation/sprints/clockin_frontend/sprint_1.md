# Sprint 1 — API Client + TypeScript Types + Sidebar Navigation
**Module:** time-clock | **Type:** Frontend — Foundation | **Depends On:** Backend Sprints 1-8
**Gate:** STOP — API client works, types compile, sidebar shows Workforce section
**Complexity:** Medium

---

## Code Quality Standard
> You are a **Google / Amazon / Apple senior-level frontend engineer**. Every file you produce must be production-grade: clean, accessible, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Mobile-first. Review your own output as if submitting a PR to a FAANG codebase.

## Mandatory Rules (Apply to EVERY sprint)

### RULE 1 — Test Live API First (NON-NEGOTIABLE)
Before implementing ANY page or component:
1. Read `api/documentation/time-clock_REST_API.md` for the endpoints you will consume
2. Login and get a JWT:
   ```bash
   curl -s -X POST http://localhost:8000/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq .access_token
   ```
3. Hit EVERY endpoint you will use with real credentials. Verify response shapes.
4. **If the live API returns different field names or data than the REST_API doc → USE THE LIVE API DATA.**
5. **If an endpoint is missing, broken, or returns unexpected data → STOP. Tell the human: "Endpoint X is not working. Issue: [describe]. Cannot proceed until backend is fixed."**

### RULE 2 — Sidebar Links
Every page MUST have a sidebar navigation entry. Update `DashboardSidebar.tsx` if needed.

### RULE 3 — Mobile-First
- Design for 375px first, enhance at md: (768px) and lg: (1024px)
- Inputs: 16px+ font (prevents iOS zoom). Touch targets: 48px min height.
- No horizontal scrolling. Use flex-col default, md:flex-row for desktop.

### RULE 4 — Production UI
- Use existing components from `/app/src/components/ui/` (Button, Input, Select, Modal, Badge, etc.)
- Masked inputs for money (CurrencyInput), hours (HoursInput)
- Icons from lucide-react on every action/status
- LoadingSpinner for all async. Toast for user feedback. Empty states with icon+message.
- Form validation with inline error messages (React Hook Form + Zod)

### RULE 5 — Full CRUD
Never implement endpoints halfway. If a resource has list/create/read/update/delete, build ALL with full UI. 100% endpoint coverage.

### RULE 6 — Existing Patterns
- Forms: React Hook Form + Zod. HTTP: Axios from `/app/src/lib/api/axios.ts`. Toasts: react-hot-toast. Icons: lucide-react. Dates: date-fns.
- DO NOT install new libraries without human approval.

### RULE 7 — Stop on Problems
If anything is missing, broken, or ambiguous → STOP and tell the human. Do not guess.

## Test Credentials
- **Admin**: `ludsonaiello@gmail.com` / `978@F32c`
- **Tenant User**: `contact@honeydo4you.com` / `978@F32c`

## Environment
- **This project does NOT use PM2.**
- Frontend port: **7000** | Dev server: `cd /var/www/lead360.app/app && npm run dev`
- Backend API: `http://127.0.0.1:8000/api/v1`
- Swagger: `http://127.0.0.1:8000/api/docs`
- Working directory: `/var/www/lead360.app/app/`
- **NEVER touch backend code** (`/api/` folder is off-limits)

## Dev Server
CHECK port 7000: lsof -i :7000
KILL if found: kill {PID}
START: cd /var/www/lead360.app/app && npm run dev
VERIFY: open http://localhost:7000 in browser
KEEP running entire sprint. SHUTDOWN before marking complete.

---

## Objective

Create the foundation layer for the entire time-clock frontend: all API client functions, all TypeScript interfaces, and sidebar navigation entries. No pages are built in this sprint — only the plumbing that every subsequent sprint depends on.

---

## Task 1 — Verify Live API Endpoints

Before writing any code, login as admin and test these endpoints to verify they exist and respond:

```bash
# 1. Get JWT
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r .access_token)

# 2. Test Settings
curl -s -X GET http://localhost:8000/api/v1/time-clock/settings \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3. Test Employee Profiles
curl -s -X GET http://localhost:8000/api/v1/time-clock/employees \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. Test Addresses
curl -s -X GET http://localhost:8000/api/v1/time-clock/addresses \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. Test Sessions list
curl -s -X GET http://localhost:8000/api/v1/time-clock/sessions \
  -H "Authorization: Bearer $TOKEN" | jq .

# 6. Test Shifts list
curl -s -X GET http://localhost:8000/api/v1/time-clock/shifts \
  -H "Authorization: Bearer $TOKEN" | jq .

# 7. Test Disputes list
curl -s -X GET http://localhost:8000/api/v1/time-clock/disputes \
  -H "Authorization: Bearer $TOKEN" | jq .

# 8. Test Dashboard
curl -s -X GET http://localhost:8000/api/v1/time-clock/dashboard/whos-in \
  -H "Authorization: Bearer $TOKEN" | jq .

# 9. Test My Active Session
curl -s -X GET http://localhost:8000/api/v1/time-clock/sessions/me/active \
  -H "Authorization: Bearer $TOKEN"

# 10. Test Available Projects
curl -s -X GET http://localhost:8000/api/v1/time-clock/sessions/me/available-projects \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Record the actual response shapes. If any endpoint is missing or returns 500, STOP and report.

---

## Task 2 — Create TypeScript Types

**File:** `app/src/lib/types/time-clock.ts`

Create ALL TypeScript interfaces matching the live API responses verified in Task 1. Use the contract as a starting point, but the live API response is the source of truth.

### Enums (as union types)

```typescript
export type ClockInMode = 'anywhere' | 'specific_addresses' | 'active_job_sites';
export type GeofenceViolationAction = 'block' | 'warn_only';
export type GpsUnavailableAction = 'block' | 'allow_flagged';
export type PayPeriodType = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type ClockSessionStatus = 'active' | 'on_break' | 'completed';
export type LocationSource = 'browser_gps' | 'native_gps' | 'kiosk' | 'manual';
export type GeofenceStatus = 'inside' | 'outside' | 'unavailable' | 'not_enforced';
export type WorkShiftStatus = 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'cancelled';
export type BreakType = 'paid' | 'unpaid';
export type DisputeType = 'flag_only' | 'correction_request';
export type DisputeStatus = 'pending' | 'approved' | 'rejected' | 'resolved';
export type AddressSource = 'manual' | 'imported_from_quote' | 'imported_from_lead';
```

### Response Interfaces

Define ALL of these (field names MUST match the live API):

| Interface | Key Fields |
|-----------|-----------|
| `TimeClockSettings` | id, tenant_id, clock_in_mode, geofence_violation_action, gps_required, gps_unavailable_action, require_job_tag, require_task_tag, overtime_enabled, overtime_daily_threshold_hours, overtime_weekly_threshold_hours, overtime_multiplier, pay_period_type, pay_period_start_day, pay_period_anchor_date, kiosk_mode_enabled, shift_reminder_minutes, missed_shift_threshold_minutes, native_app_features_enabled, created_at, updated_at |
| `EmployeeProfile` | id, tenant_id, user_id, crew_member_id, hourly_rate, overtime_rule_override, overtime_daily_threshold_hours, overtime_weekly_threshold_hours, is_active, has_pin, is_locked, created_at, updated_at, user?, crew_member? |
| `ClockinAddress` | id, tenant_id, project_id, label, address_line1, address_line2, city, state, zip_code, latitude, longitude, radius_meters, is_active, source, source_address_id, created_by_user_id, created_at, updated_at, project? |
| `EmployeeProjectAssignment` | id, tenant_id, employee_profile_id, project_id, assigned_by_user_id, created_at, employee_profile?, project? |
| `WorkShift` | id, tenant_id, employee_profile_id, project_id, task_id, scheduled_start, scheduled_end, title, notes, status, reminder_sent_at, published_at, created_by_user_id, created_at, updated_at, employee_profile?, project?, task? |
| `ClockSession` | id, tenant_id, employee_profile_id, work_shift_id, project_id, task_id, clockin_address_id, status, clock_in_at, clock_out_at, clock_in_latitude, clock_in_longitude, clock_in_location_source, clock_in_geofence_status, clock_out_latitude, clock_out_longitude, clock_out_location_source, clock_out_geofence_status, total_worked_minutes, regular_minutes, overtime_minutes, is_manual_edit, is_flagged, flag_reason, labor_cost_posted, labor_cost_entry_id, labor_cost_reconciliation_needed, notes, created_at, updated_at, employee_profile?, project?, task?, clockin_address?, breaks?, edit_logs? |
| `BreakEntry` | id, tenant_id, clock_session_id, break_type, break_label, started_at, ended_at, duration_minutes, created_at, updated_at |
| `ClockSessionEditLog` | id, tenant_id, clock_session_id, edited_by_user_id, field_changed, original_value, new_value, reason, edited_at, edited_by_user? |
| `TimeDispute` | id, tenant_id, clock_session_id, submitted_by_user_id, dispute_type, description, proposed_clock_in_at, proposed_clock_out_at, proposed_project_id, proposed_task_id, proposed_notes, status, reviewed_by_user_id, review_notes, reviewed_at, created_at, updated_at, clock_session?, submitted_by_user?, reviewed_by_user? |
| `WhosInEmployee` | employee_profile_id, user_id, first_name, last_name, email, status, session_id, clock_in_at, project_name, task_title, current_break_started_at, is_flagged, flag_reason |
| `KioskEmployee` | id, first_name, last_name, is_clocked_in, has_pin |

### Report Interfaces

| Interface | Key Fields |
|-----------|-----------|
| `TimesheetReportEntry` | employee_name, employee_profile_id, date, regular_hours, overtime_hours, total_hours, project_name, session_count |
| `PayrollReportEntry` | employee_name, employee_profile_id, regular_hours, overtime_hours, total_hours, hourly_rate, regular_pay, overtime_pay, total_pay |
| `ShiftVarianceEntry` | employee_name, employee_profile_id, shift_id, scheduled_start, scheduled_end, actual_start, actual_end, scheduled_hours, actual_hours, variance_minutes, shift_status |
| `GeoViolationEntry` | employee_name, employee_profile_id, session_id, clock_in_at, flag_reason, geofence_status, latitude, longitude |
| `ActivityFeedEntry` | id, timestamp, employee_name, employee_profile_id, event_type, description, session_id, metadata |

### Request DTOs

| Interface | Key Fields |
|-----------|-----------|
| `ClockInRequest` | latitude?, longitude?, location_source, project_id?, task_id?, notes? |
| `ClockOutRequest` | latitude?, longitude?, location_source?, notes? |
| `EditSessionRequest` | clock_in_at?, clock_out_at?, project_id?, task_id?, notes?, reason (required) |
| `CreateShiftRequest` | employee_profile_id, scheduled_start, scheduled_end, project_id?, task_id?, title?, notes? |
| `BulkCreateShiftsFormData` | employee_profile_ids[], date_from, date_to, start_time, end_time, project_id?, task_id?, title?, exclude_weekends? |
| `BulkCreateShiftsRequest` | shifts: CreateShiftRequest[] |
| `SubmitDisputeRequest` | dispute_type, description, proposed_clock_in_at?, proposed_clock_out_at?, proposed_project_id?, proposed_task_id?, proposed_notes? |
| `CreateEmployeeProfileRequest` | user_id, crew_member_id?, hourly_rate?, overtime_rule_override?, overtime_daily_threshold_hours?, overtime_weekly_threshold_hours? |
| `CreateClockinAddressRequest` | label, address_line1, address_line2?, city, state, zip_code, latitude?, longitude?, radius_meters?, project_id? |

### Pagination / Filters

| Interface | Key Fields |
|-----------|-----------|
| `PaginationMeta` | total, page, limit, totalPages |
| `PaginatedResponse<T>` | data: T[], meta: PaginationMeta |
| `SessionFilterParams` | page?, limit?, employee_profile_id?, project_id?, status?, date_from?, date_to?, is_flagged?, search? |
| `ShiftFilterParams` | page?, limit?, employee_profile_id?, project_id?, status?, date_from?, date_to? |
| `DisputeFilterParams` | page?, limit?, status?, date_from?, date_to? |
| `PayrollFilterParams` | date_from, date_to, employee_profile_ids?, project_ids? |
| `ReportFilterParams` | date_from, date_to, employee_profile_id?, project_id? |

---

## Task 3 — Create API Client

**File:** `app/src/lib/api/time-clock.ts`

Import `apiClient` from `./axios` (existing Axios instance with JWT interceptor).

Create ALL 57 API functions grouped by resource. Each function must be fully typed with the interfaces from Task 2. Use the exact paths verified in Task 1.

### Settings (3 functions)

| Function | Method | Path |
|----------|--------|------|
| `getTimeClockSettings()` | GET | `/time-clock/settings` |
| `updateTimeClockSettings(data)` | PATCH | `/time-clock/settings` |
| `regenerateKioskToken()` | POST | `/time-clock/settings/kiosk-token/regenerate` |

### Employee Profiles (7 functions)

| Function | Method | Path |
|----------|--------|------|
| `listEmployeeProfiles(params?)` | GET | `/time-clock/employees` |
| `createEmployeeProfile(data)` | POST | `/time-clock/employees` |
| `getEmployeeProfile(id)` | GET | `/time-clock/employees/{id}` |
| `updateEmployeeProfile(id, data)` | PATCH | `/time-clock/employees/{id}` |
| `setEmployeePin(id, data)` | POST | `/time-clock/employees/{id}/pin` |
| `removeEmployeePin(id)` | DELETE | `/time-clock/employees/{id}/pin` |
| `savePushSubscription(data)` | POST | `/time-clock/employees/me/push-subscription` |

### Clock-In Addresses (7 functions)

| Function | Method | Path |
|----------|--------|------|
| `listClockinAddresses(params?)` | GET | `/time-clock/addresses` |
| `createClockinAddress(data)` | POST | `/time-clock/addresses` |
| `getClockinAddress(id)` | GET | `/time-clock/addresses/{id}` |
| `updateClockinAddress(id, data)` | PATCH | `/time-clock/addresses/{id}` |
| `deleteClockinAddress(id)` | DELETE | `/time-clock/addresses/{id}` |
| `importAddressFromQuote(data)` | POST | `/time-clock/addresses/import-from-quote` |
| `importAddressFromLead(data)` | POST | `/time-clock/addresses/import-from-lead` |

### Employee Project Assignments (3 functions)

| Function | Method | Path |
|----------|--------|------|
| `listEmployeeProjects(params?)` | GET | `/time-clock/employee-projects` |
| `createEmployeeProject(data)` | POST | `/time-clock/employee-projects` |
| `deleteEmployeeProject(id)` | DELETE | `/time-clock/employee-projects/{id}` |

### Work Shifts (7 functions)

| Function | Method | Path |
|----------|--------|------|
| `listShifts(params?)` | GET | `/time-clock/shifts` |
| `createShift(data)` | POST | `/time-clock/shifts` |
| `bulkCreateShifts(data)` | POST | `/time-clock/shifts/bulk` |
| `getShift(id)` | GET | `/time-clock/shifts/{id}` |
| `updateShift(id, data)` | PATCH | `/time-clock/shifts/{id}` |
| `deleteShift(id)` | DELETE | `/time-clock/shifts/{id}` |
| `getMyShifts(params?)` | GET | `/time-clock/shifts/mine` |

### Clock Sessions (9 functions)

| Function | Method | Path |
|----------|--------|------|
| `clockIn(data)` | POST | `/time-clock/sessions/clock-in` |
| `clockOut(data)` | POST | `/time-clock/sessions/clock-out` |
| `listSessions(params?)` | GET | `/time-clock/sessions` |
| `getMyActiveSession()` | GET | `/time-clock/sessions/me/active` |
| `getMyAvailableProjects()` | GET | `/time-clock/sessions/me/available-projects` |
| `getMySessionHistory(params?)` | GET | `/time-clock/sessions/mine` |
| `getAllActiveSessions()` | GET | `/time-clock/sessions/active/all` |
| `getSession(id)` | GET | `/time-clock/sessions/{id}` |
| `editSession(id, data)` | PATCH | `/time-clock/sessions/{id}` |

### Breaks (3 functions)

| Function | Method | Path |
|----------|--------|------|
| `startBreak(sessionId, data)` | POST | `/time-clock/sessions/{sessionId}/breaks/start` |
| `endBreak(sessionId)` | POST | `/time-clock/sessions/{sessionId}/breaks/end` |
| `listBreaks(sessionId)` | GET | `/time-clock/sessions/{sessionId}/breaks` |

### Disputes (7 functions)

| Function | Method | Path |
|----------|--------|------|
| `submitDispute(sessionId, data)` | POST | `/time-clock/sessions/{sessionId}/disputes` |
| `listDisputes(params?)` | GET | `/time-clock/disputes` |
| `listMyDisputes(params?)` | GET | `/time-clock/disputes/mine` |
| `getDispute(id)` | GET | `/time-clock/disputes/{id}` |
| `approveDispute(id, data?)` | PATCH | `/time-clock/disputes/{id}/approve` |
| `rejectDispute(id, data)` | PATCH | `/time-clock/disputes/{id}/reject` |
| `cancelDispute(id)` | DELETE | `/time-clock/disputes/{id}` |

### Kiosk (3 functions — use X-Kiosk-Token header, NOT JWT)

| Function | Method | Path | Auth |
|----------|--------|------|------|
| `kioskListEmployees(token)` | GET | `/time-clock/kiosk/employees` | X-Kiosk-Token |
| `kioskClockIn(token, data)` | POST | `/time-clock/kiosk/clock-in` | X-Kiosk-Token |
| `kioskClockOut(token, data)` | POST | `/time-clock/kiosk/clock-out` | X-Kiosk-Token |

**Important for kiosk functions**: Pass `{ headers: { 'X-Kiosk-Token': token } }` in the Axios config. Consider creating a separate `kioskClient` Axios instance without the JWT refresh interceptor to prevent redirect-to-login on 401 errors from kiosk endpoints.

### Dashboard (1 function)

| Function | Method | Path |
|----------|--------|------|
| `getWhosIn(params?)` | GET | `/time-clock/dashboard/whos-in` |

### Reports (6 functions)

| Function | Method | Path |
|----------|--------|------|
| `getTimesheetReport(params)` | GET | `/time-clock/reports/timesheet` |
| `getPayrollReport(params)` | GET | `/time-clock/reports/payroll` |
| `exportPayroll(params)` | GET | `/time-clock/reports/payroll/export` (responseType: 'blob') |
| `getShiftVarianceReport(params)` | GET | `/time-clock/reports/shift-variance` |
| `getGeoViolationsReport(params)` | GET | `/time-clock/reports/geo-violations` |
| `getActivityFeed(params)` | GET | `/time-clock/reports/activity-feed` |

---

## Task 4 — Update Sidebar Navigation

**File:** Find and update the existing `DashboardSidebar.tsx` (likely at `app/src/components/dashboard/DashboardSidebar.tsx`).

Add a **Workforce** navigation section with the following entries. Use `lucide-react` icons for each item. Add permission checks using the existing sidebar pattern (check how other modules like Projects, Financial, etc. gate their sidebar items).

| Label | Route | Icon (lucide-react) | Permission |
|-------|-------|---------------------|------------|
| **Workforce** (section header) | — | `Users` | — |
| Clock In/Out | `/workforce/clock` | `Clock` | `timeclock:clock_in` |
| My Hours | `/workforce/my-hours` | `Timer` | `timeclock:view_own` |
| My Shifts | `/workforce/my-shifts` | `CalendarCheck` | `timeclock:view_own` |
| Dashboard | `/workforce/dashboard` | `LayoutDashboard` | `timeclock:view_all` |
| Timesheets | `/workforce/timesheets` | `FileText` | `timeclock:view_all` |
| Shifts | `/workforce/shifts` | `Calendar` | `timeclock:manage_shifts` |
| Disputes | `/workforce/disputes` | `AlertTriangle` | `timeclock:review_disputes` |
| Reports | `/workforce/reports` | `BarChart3` | `timeclock:view_reports` |

Also add a **Settings** entry (under the existing Settings section if one exists):

| Label | Route | Icon | Permission |
|-------|-------|------|------------|
| Time Clock | `/settings/time-clock` | `Clock` | `timeclock:manage_settings` |

**Implementation Notes:**
- Read the existing sidebar to understand the navigation structure, permission pattern, and icon import pattern
- Match the existing section grouping pattern (other modules like "Projects", "Financial" likely have their own sections)
- Ensure sidebar items are conditionally rendered based on the user's RBAC permissions using the existing permission check mechanism (e.g., `canPerform('timeclock', 'clock_in')` or role-based checks)
- If the sidebar uses a data-driven config array, add your items to that array following the same schema

---

## Task 5 — Create Component Directory

```bash
mkdir -p /var/www/lead360.app/app/src/components/time-clock
```

This directory will hold all time-clock-specific components built in future sprints. Create it now so imports resolve correctly.

---

## Acceptance Criteria

- [ ] All 10 endpoint test calls in Task 1 return valid responses (no 500s, no 404s on existing endpoints)
- [ ] `app/src/lib/types/time-clock.ts` exists with all 12 enum types, all 10 response interfaces, all 8 report/dashboard/kiosk interfaces, all 9 request DTOs, and all 7 filter/pagination interfaces
- [ ] `app/src/lib/api/time-clock.ts` exists with all 57 functions grouped by resource
- [ ] Types compile with no TypeScript errors: `cd /var/www/lead360.app/app && npx tsc --noEmit` passes (or only pre-existing errors)
- [ ] Sidebar shows "Workforce" section with all 8 navigation entries + 1 settings entry
- [ ] Sidebar items are gated by correct permissions
- [ ] Sidebar icons render from lucide-react
- [ ] `/app/src/components/time-clock/` directory exists
- [ ] No new npm packages installed
- [ ] No TODO comments in any new file
- [ ] Dev server starts and loads without errors on port 7000
