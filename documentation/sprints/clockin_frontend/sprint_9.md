# Sprint 9 — Disputes Management + Dashboard (Who's In)
**Module:** time-clock
**File:** ./documentation/sprints/clockin_frontend/sprint_9.md
**Type:** Frontend — Pages
**Depends On:** Backend Sprints 5, 6 (disputes + dashboard endpoints operational)
**Gate:** STOP — Dispute lifecycle works (approve/reject), Dashboard shows live data
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
| Tenant Owner | `contact@honeydo4you.com` | `978@F32c` | Owner — can manage disputes, view dashboard |

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

Build two pages:
1. **Disputes Management** (`/workforce/disputes`) — Admin view for reviewing, approving, and rejecting employee time disputes
2. **Dashboard — Who's In** (`/workforce/dashboard`) — Real-time view of currently clocked-in employees

---

## Pre-Sprint Checklist

- [ ] Backend health check returns 200: `curl -s http://localhost:8000/health`
- [ ] Read `documentation/time-clock/clockin_REST_API.md` for all dispute and dashboard endpoints
- [ ] Read `app/src/components/ui/` — understand existing Badge, Button, ConfirmModal, Modal, Table, LoadingSpinner, Tabs, Input components
- [ ] Read `app/src/lib/api/time-clock.ts` — understand existing API client (if created in prior sprints)
- [ ] Read `app/src/lib/types/time-clock.ts` — understand existing types (if created in prior sprints)
- [ ] Confirm API client has functions for all 7 endpoints in this sprint (or create them)

---

## Endpoints Consumed (7)

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/time-clock/disputes` | List all disputes (admin) |
| 2 | GET | `/time-clock/disputes/mine` | List own disputes |
| 3 | GET | `/time-clock/disputes/:id` | Get dispute detail |
| 4 | PATCH | `/time-clock/disputes/:id/approve` | Approve dispute |
| 5 | PATCH | `/time-clock/disputes/:id/reject` | Reject dispute |
| 6 | DELETE | `/time-clock/disputes/:id` | Cancel dispute |
| 7 | GET | `/time-clock/dashboard/whos-in` | Dashboard — who is clocked in |

---

## Tasks

### Task 1 — Hit Every Endpoint and Verify Response Shapes

**What:** Before writing ANY code, authenticate and hit all 7 endpoints. Save the response shapes and build/update TypeScript types from real responses.

```bash
# Login as Tenant Owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 1. GET /time-clock/disputes — List all disputes
curl -s "http://localhost:8000/api/v1/time-clock/disputes?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 2. GET /time-clock/disputes/mine — Own disputes
curl -s "http://localhost:8000/api/v1/time-clock/disputes/mine" \
  -H "Authorization: Bearer $TOKEN" | head -c 2000

# 3. GET /time-clock/disputes/:id — Dispute detail (use ID from above)
curl -s "http://localhost:8000/api/v1/time-clock/disputes/{DISPUTE_ID}" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 4. GET /time-clock/dashboard/whos-in — Dashboard
curl -s "http://localhost:8000/api/v1/time-clock/dashboard/whos-in" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000
```

**Acceptance:** All endpoint response shapes captured. Types created or updated in `app/src/lib/types/time-clock.ts`.
**Do NOT:** Skip this step. Do NOT guess response shapes.

---

### Task 2 — Disputes Page (`/workforce/disputes`)

**What:** Create `/var/www/lead360.app/app/src/app/(dashboard)/workforce/disputes/page.tsx`

**Roles:** Owner, Admin

**UI Requirements:**

1. **Tab navigation:** All | Pending | Approved | Rejected
   - Each tab filters the dispute list by status
   - Use existing `Tabs` component from `app/src/components/ui/`
   - Default tab: "Pending" (show actionable disputes first)

2. **Filters:**
   - Employee dropdown (search select / autocomplete)
   - Status select (All / pending / approved / rejected)
   - Filters apply immediately on change

3. **Disputes table:**
   - Columns: Employee, Session Date, Type (badge: `flag_only` or `correction_request`), Status (badge with color: pending=amber, approved=green, rejected=red), Submitted Date, Actions
   - Use `Badge` component for type and status columns
   - Click row to navigate to dispute detail
   - Paginated with page controls

4. **Dispute detail view** (slide-over panel or separate page):
   - Session information: clock-in time, clock-out time, duration, project, task
   - Employee information: name, email
   - Dispute description (full text)
   - Proposed corrections (if `correction_request` type): show proposed clock_in_at, clock_out_at, notes
   - Review section (for pending disputes):
     - **Approve button:** Opens `ConfirmModal` with optional `review_notes` textarea. On confirm, calls `PATCH /disputes/:id/approve` with `{ review_notes }`.
     - **Reject button:** Opens modal with REQUIRED `review_notes` textarea. Textarea cannot be empty — disable submit button until notes are entered. On confirm, calls `PATCH /disputes/:id/reject` with `{ review_notes }`.
   - For already-reviewed disputes: show reviewer name, review date, review notes (read-only)
   - Show edit logs created by approval (if any)

5. **Loading & Error States:**
   - `LoadingSpinner` while fetching disputes
   - Error toast on API failure
   - Success toast on approve/reject
   - Refresh list after approve/reject

**Do NOT:** Use `window.confirm` or `window.alert`. Use `ConfirmModal` and toast notifications.

---

### Task 3 — Dashboard Page (`/workforce/dashboard`)

**What:** Create `/var/www/lead360.app/app/src/app/(dashboard)/workforce/dashboard/page.tsx`

**Roles:** Owner, Admin, Project Manager

**UI Requirements:**

1. **Summary cards** (top row):
   - Card 1: "Total Clocked In" — count of employees with `status === 'active'`
   - Card 2: "Total On Break" — count of employees with `status === 'on_break'`
   - Use `Card` component with large number display

2. **Employee list:**
   - Each employee row shows:
     - Name (first + last)
     - Status badge: `active` = green "Working" badge, `on_break` = amber "Break" badge
     - Clock-in time (formatted as HH:MM AM/PM)
     - Elapsed time (live-updating, recalculated every second via `setInterval` or `requestAnimationFrame`)
     - Project name (if assigned)
     - Task name (if assigned)
     - Location label (clock-in address label)
     - Flagged indicator: red warning icon if session is flagged, with `flag_reason` tooltip on hover
   - If employee is on break: show "Break" badge alongside status, show break duration

3. **Auto-refresh:**
   - Poll the `/dashboard/whos-in` endpoint every 30 seconds
   - Use `setInterval` or `useEffect` with cleanup
   - Show a subtle "Last updated: X seconds ago" indicator

4. **Empty state:**
   - When no employees are clocked in, show centered message: "No one is currently clocked in"
   - Use a clock icon with muted text

5. **Responsive:**
   - On mobile (< 768px): stack employee cards vertically
   - On desktop: table or grid layout

**Do NOT:** Use WebSockets (polling is sufficient for this version). Do NOT create a custom timer component if one exists in the UI library.

---

### Task 4 — Sidebar Navigation Update

**What:** Ensure the sidebar has entries for "Disputes" and "Dashboard" under a "Workforce" section.

- "Dashboard" → `/workforce/dashboard` — visible to Owner, Admin, Project Manager
- "Disputes" → `/workforce/disputes` — visible to Owner, Admin

**Pattern:** Follow the same sidebar modification pattern used in the Users module (Admin Sprint 1).

---

### Task 5 — Verify Everything Works

**What:** With both servers running:

1. Login as Owner → navigate to `/workforce/disputes`
   - Verify tab navigation works
   - Verify dispute list loads with correct data
   - Verify approve flow: click Approve → modal → confirm → API call → success toast → list refreshes
   - Verify reject flow: click Reject → modal with required notes → submit → API call → success toast → list refreshes
   - Verify reject cannot submit with empty review_notes

2. Login as Owner → navigate to `/workforce/dashboard`
   - Verify summary cards show correct counts
   - Verify employee list loads
   - Verify elapsed time updates in real-time
   - Verify auto-refresh fires every 30 seconds
   - Verify empty state displays when no one is clocked in

3. No TypeScript compilation errors in terminal

---

## Acceptance Criteria

- [ ] All 7 endpoints tested live before any code was written
- [ ] TypeScript types match actual API response shapes
- [ ] Disputes page: tab navigation (All/Pending/Approved/Rejected) working
- [ ] Disputes page: filter by employee and status working
- [ ] Disputes page: table with correct columns and badges
- [ ] Disputes page: detail view shows session info, employee info, dispute description, proposed corrections
- [ ] Disputes page: approve flow with optional review_notes via ConfirmModal
- [ ] Disputes page: reject flow with REQUIRED review_notes (cannot submit empty)
- [ ] Disputes page: edit logs display after approval
- [ ] Dashboard page: summary cards (Total Clocked In, Total On Break)
- [ ] Dashboard page: employee list with status badges, elapsed time, project, location, flags
- [ ] Dashboard page: live-updating elapsed time (recalculated every second)
- [ ] Dashboard page: auto-refresh every 30 seconds
- [ ] Dashboard page: empty state when no one is clocked in
- [ ] Sidebar navigation updated with Workforce section
- [ ] Mobile responsive (375px viewport tested)
- [ ] Loading spinners on all async operations
- [ ] Error/success toasts (no browser alerts)
- [ ] No modifications to any file under `/var/www/lead360.app/api/`
- [ ] No TypeScript compilation errors
- [ ] Frontend dev server shut down before marking sprint complete

---

## Gate Marker

**STOP** — Dispute approve/reject lifecycle must work end-to-end (API calls succeed, list refreshes, edit logs display). Dashboard must show live data with auto-refresh. Do not proceed to Sprint 10 until verified.

---

## Handoff Notes

- Disputes page at `/workforce/disputes` with full admin lifecycle
- Dashboard page at `/workforce/dashboard` with live polling
- The dispute detail view pattern (session info + review actions) will be reused for session detail in Sprint 10
- The elapsed time calculation pattern will be reused for the kiosk clock-in screen
