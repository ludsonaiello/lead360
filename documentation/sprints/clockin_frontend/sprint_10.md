# Sprint 10 — Timesheets Page + Manual Session Edit
**Module:** time-clock
**File:** ./documentation/sprints/clockin_frontend/sprint_10.md
**Type:** Frontend — Page
**Depends On:** Backend Sprint 5 (sessions endpoints operational)
**Gate:** STOP — Session list works, manual edit creates edit logs
**Estimated Complexity:** Medium

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **You MUST test every live API endpoint** listed in this sprint before writing any component. Hit each endpoint with `curl`, verify the actual response shape, and build your types from the real response. Do NOT trust documentation blindly.
2. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`. The backend is complete and running.
3. **This project does NOT use PM2.** Do not reference or run any PM2 command.
4. **Backend runs on `http://localhost:8000`** (NestJS `--watch` mode via `npm run start:dev`). Do NOT restart it, do NOT run any backend commands.
5. **Frontend runs on `http://localhost:7000`** (Next.js dev server). All your work is in `/var/www/lead360.app/app/`.
6. **Use existing components, patterns, and modules.** Do NOT create new UI primitives. Import from `app/src/components/ui/`. New time-clock components go in `app/src/components/time-clock/` only.
7. **Deliver masterclass production-quality code.** Use autocomplete inputs, masked inputs, search selects, modals, loading spinners, error toasts — no browser alerts, no `window.confirm`, no `window.prompt`.

---

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Platform Admin | `ludsonaiello@gmail.com` | `978@F32c` | Platform admin |
| Tenant Owner | `contact@honeydo4you.com` | `978@F32c` | Owner — can view timesheets, edit sessions |

---

## Environment

- **Database credentials**: from `.env` file. Never hardcode.
- **Dev server (backend)**: `npm run start:dev` (watch mode) — Port: 8000 | Prefix: api/v1 | Swagger: http://127.0.0.1:8000/api/docs
- **Dev server (frontend)**: `npm run dev` — Port: 7000
- **MySQL credentials** are in `/var/www/lead360.app/api/.env` — do not hardcode any database credentials.

---

## Dev Server

```
BACKEND — confirm running:
  curl -s http://localhost:8000/health   <- must return 200

FRONTEND:
  CHECK if port 7000 is already in use:
    lsof -i :7000

  If a process is found, kill it by PID:
    kill {PID}
    If it does not stop: kill -9 {PID}

  Wait 2 seconds, confirm port is free:
    lsof -i :7000   <- must return nothing before proceeding

  START the frontend dev server:
    cd /var/www/lead360.app/app && npm run dev

  KEEP running entire sprint.

  BEFORE marking the sprint COMPLETE:
    lsof -i :7000
    kill {PID}
    Confirm port is free: lsof -i :7000   <- must return nothing
```

---

## Objective

Build the **Timesheets Page** (`/workforce/timesheets`) with full session listing, filtering, detail view, and manual session editing with immutable audit trail display.

---

## Pre-Sprint Checklist

- [ ] Backend health check returns 200: `curl -s http://localhost:8000/health`
- [ ] Read `documentation/time-clock/clockin_REST_API.md` for sessions endpoints
- [ ] Read `app/src/components/ui/` — understand existing DatePicker, TimePicker, Select, Modal, Table, Badge, LoadingSpinner, Input components
- [ ] Read `app/src/lib/api/time-clock.ts` — understand existing API client
- [ ] Read `app/src/lib/types/time-clock.ts` — understand existing types
- [ ] Confirm API client has functions for all 3 endpoints in this sprint (or create them)

---

## Page

`/workforce/timesheets` -> `/var/www/lead360.app/app/src/app/(dashboard)/workforce/timesheets/page.tsx`

**Roles:** Owner, Admin, Project Manager, Bookkeeper

---

## Endpoints Consumed (3)

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/time-clock/sessions` | List sessions (paginated, all filters) |
| 2 | GET | `/time-clock/sessions/:id` | Full session detail with breaks, edit_logs, disputes |
| 3 | PATCH | `/time-clock/sessions/:id` | Manual edit (Owner, Admin only) |

---

## Tasks

### Task 1 — Hit All 3 Endpoints and Verify Response Shapes

**What:** Before writing ANY code, authenticate and hit all 3 endpoints. Capture actual response shapes.

```bash
# Login as Tenant Owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 1. GET /time-clock/sessions — List all sessions
curl -s "http://localhost:8000/api/v1/time-clock/sessions?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 2. GET /time-clock/sessions/:id — Session detail (use ID from above)
curl -s "http://localhost:8000/api/v1/time-clock/sessions/{SESSION_ID}" \
  -H "Authorization: Bearer $TOKEN" | head -c 5000

# 3. PATCH /time-clock/sessions/:id — Manual edit test
# NOTE: Use with caution — this creates a real edit log
curl -s -X PATCH "http://localhost:8000/api/v1/time-clock/sessions/{SESSION_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Sprint 10 test edit","reason":"Testing manual edit flow"}' | head -c 3000
```

**Acceptance:** All 3 response shapes captured. Types created or updated in `app/src/lib/types/time-clock.ts`.
**Do NOT:** Skip this step. Do NOT guess response shapes.

---

### Task 2 — Timesheets Page

**What:** Create `/var/www/lead360.app/app/src/app/(dashboard)/workforce/timesheets/page.tsx`

**UI Requirements:**

1. **Filters toolbar:**
   - Employee: search select / autocomplete dropdown
   - Project: search select / autocomplete dropdown
   - Date range: `date_from` (DatePicker) and `date_to` (DatePicker)
   - Status: select dropdown (All / active / on_break / completed)
   - Flagged: checkbox or toggle for `is_flagged` filter
   - Manual edit: checkbox or toggle for `is_manual_edit` filter
   - All filters apply on change and re-fetch the sessions list

2. **Sessions table:**
   - Columns: Employee, Date, Clock In (time), Clock Out (time), Total Hours, Regular Hours, Overtime Hours, Project, Status (badge), Flags, Actions
   - **Hours formatting:** Display as HH:MM (e.g., `8:30` not `510` minutes). Write a utility function:
     ```typescript
     function formatMinutesToHHMM(minutes: number): string {
       const h = Math.floor(minutes / 60);
       const m = minutes % 60;
       return `${h}:${String(m).padStart(2, '0')}`;
     }
     ```
   - **Flagged sessions:** Red `Badge` with flag_reason as tooltip on hover
   - **Manual edits:** Pencil icon indicator next to the session row
   - **Status badges:** active = blue, on_break = amber, completed = green
   - Click row to open session detail slide-over or modal
   - Paginated with page controls matching existing pagination pattern

3. **Empty state:** "No timesheet entries found" with appropriate icon

---

### Task 3 — Session Detail View

**What:** Build a session detail component (slide-over panel or modal) shown when clicking a session row.

**Sections:**

1. **Session Info:**
   - Clock-in time (formatted date + time)
   - Clock-out time (formatted date + time, or "In Progress" if null)
   - Total duration (HH:MM format)
   - GPS coordinates at clock-in (lat/lng)
   - Geofence status badge (inside = green, outside = red, not_enforced = gray)
   - Project name + task name (if assigned)
   - Clock-in address label (if matched)

2. **Breaks List:**
   - Table or list: Break Type (badge), Label, Start Time, End Time, Duration (HH:MM)
   - Show break type badges: `paid` = green, `unpaid` = amber

3. **Edit Log History (IMMUTABLE display — read only):**
   - Timeline or table: Field Changed, Old Value -> New Value, Reason, Editor Name, Timestamp
   - Each entry is read-only — never allow editing of edit logs
   - Display in reverse chronological order (newest first)
   - Style as an audit trail (subtle background, monospace for values)

4. **Dispute List:**
   - Show any disputes linked to this session
   - Display: Type (badge), Status (badge), Description (truncated)
   - Link to dispute detail if needed

5. **Labor Cost Info:**
   - Posted status badge: `posted` = green, `pending` = amber
   - Financial entry ID (if posted)
   - Reconciliation warning: if labor cost needs reconciliation, show amber warning banner

---

### Task 4 — Manual Edit Form (Owner, Admin Only)

**What:** Add an "Edit Session" button on the session detail view. Only visible to Owner and Admin roles.

**Form fields:**
- `clock_in_at`: DatePicker + TimePicker combined (prefilled with current value)
- `clock_out_at`: DatePicker + TimePicker combined (prefilled with current value, or empty if session is active)
- `project_id`: Select dropdown (fetch projects list — reuse existing project API)
- `task_id`: Select dropdown (fetch tasks for selected project — dependent on project_id selection)
- `notes`: Textarea (optional)
- `reason`: Textarea (REQUIRED — cannot submit if empty. Show validation error "Reason is required for manual edits")

**Warning banners:**
- Always show: amber banner — "Editing this session will create an immutable audit log entry"
- If labor cost is posted (`labor_cost_posted === true`): red banner — "Labor cost has been posted to financials. Editing will flag this session for reconciliation."

**Submit behavior:**
- Call `PATCH /time-clock/sessions/:id` with the changed fields + `reason`
- On success: close edit form, refresh session detail to show the new edit log entry, show success toast
- On error: show error toast with API error message

**Do NOT:**
- Allow submitting without a `reason` value
- Hide the warning banners
- Use `window.confirm` — use `ConfirmModal` for any dangerous action confirmations

---

### Task 5 — Sidebar Navigation Update

**What:** Ensure the sidebar has a "Timesheets" entry under the "Workforce" section.

- "Timesheets" -> `/workforce/timesheets` — visible to Owner, Admin, Project Manager, Bookkeeper

---

### Task 6 — Verify Everything Works

**What:** With both servers running:

1. Login as Owner -> navigate to `/workforce/timesheets`
   - Verify filters work (employee, project, date range, status, flags)
   - Verify table displays sessions with correct formatting (HH:MM hours)
   - Verify flagged sessions show red badge with tooltip
   - Verify manual edit indicator (pencil icon) displays correctly
   - Verify click on row opens session detail

2. Verify session detail:
   - Session info section displays all fields
   - Breaks list shows correctly
   - Edit log history displays in chronological order
   - Dispute list shows linked disputes
   - Labor cost status badge displays correctly

3. Verify manual edit (as Owner):
   - "Edit Session" button is visible
   - Edit form opens with prefilled values
   - Warning banner displays
   - Cannot submit with empty reason field
   - On submit: edit log appears in session detail
   - If labor_cost_posted: extra warning banner displays

4. No TypeScript compilation errors in terminal

---

## Acceptance Criteria

- [ ] All 3 endpoints tested live before any code was written
- [ ] TypeScript types match actual API response shapes
- [ ] Timesheets page: filters (employee, project, date range, status, is_flagged, is_manual_edit) working
- [ ] Timesheets page: table with correct columns, HH:MM hour formatting
- [ ] Timesheets page: flagged sessions show red badge with tooltip
- [ ] Timesheets page: manual edit pencil icon indicator
- [ ] Timesheets page: click row opens session detail
- [ ] Session detail: full session info (times, GPS, geofence, project, task)
- [ ] Session detail: breaks list with type badges and durations
- [ ] Session detail: edit log history (immutable, read-only, reverse chronological)
- [ ] Session detail: disputes list with type and status badges
- [ ] Session detail: labor cost posted status badge and reconciliation warning
- [ ] Manual edit: form with DatePicker+TimePicker for clock_in_at, clock_out_at
- [ ] Manual edit: project and task select dropdowns (task depends on project)
- [ ] Manual edit: reason field REQUIRED — cannot submit empty
- [ ] Manual edit: warning banner always shown ("immutable audit log entry")
- [ ] Manual edit: extra warning if labor_cost_posted ("flag for reconciliation")
- [ ] Manual edit: on success, session detail refreshes to show new edit log
- [ ] Sidebar navigation includes "Timesheets" under Workforce
- [ ] Mobile responsive (375px viewport tested)
- [ ] Loading spinners on all async operations
- [ ] Error/success toasts (no browser alerts)
- [ ] No modifications to any file under `/var/www/lead360.app/api/`
- [ ] No TypeScript compilation errors
- [ ] Frontend dev server shut down before marking sprint complete

---

## Gate Marker

**STOP** — Session list must display with all filters working. Manual edit must create an edit log that appears in the session detail view. Do not proceed to Sprint 11 until verified.

---

## Handoff Notes

- Timesheets page at `/workforce/timesheets` with full filtering and session detail
- Manual edit creates immutable `clock_session_edit_log` entries displayed in detail view
- The `formatMinutesToHHMM` utility is reused by Sprint 11 (reports)
- The session detail slide-over/modal pattern is reused for dispute review in Sprint 9
- Labor cost reconciliation warning pattern will be reused in financial module integration
