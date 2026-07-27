# Sprint 12 — Reports: Shift Variance + Geo Violations + Activity Feed
**Module:** time-clock
**File:** ./documentation/sprints/clockin_frontend/sprint_12.md
**Type:** Frontend — Page (continued)
**Depends On:** Sprint 11 (Reports hub page with tab structure must exist)
**Gate:** NONE
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
| Tenant Owner | `contact@honeydo4you.com` | `978@F32c` | Owner — can view all reports |

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

Complete the **Reports Hub Page** (`/workforce/reports`) by implementing the remaining 3 tabs: Shift Variance, Geo Violations, and Activity Feed. These tabs replace the placeholders created in Sprint 11.

---

## Pre-Sprint Checklist

- [ ] Backend health check returns 200: `curl -s http://localhost:8000/health`
- [ ] Read `documentation/time-clock/clockin_REST_API.md` for shift-variance, geo-violations, and activity-feed endpoints
- [ ] Verify Sprint 11 is complete: `/workforce/reports` page exists with 5 tabs (first 2 functional, last 3 placeholder)
- [ ] Read `app/src/components/ui/` — understand existing DatePicker, Select, Table, Badge, Button, LoadingSpinner components
- [ ] Read `app/src/lib/api/time-clock.ts` — understand existing API client
- [ ] Read `app/src/lib/types/time-clock.ts` — understand existing types
- [ ] Confirm API client has functions for all 3 endpoints in this sprint (or create them)

---

## Endpoints Consumed (3)

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/time-clock/reports/shift-variance` | Shift variance (late arrivals, early departures, missed shifts) |
| 2 | GET | `/time-clock/reports/geo-violations` | Geofence violations (outside, unavailable) |
| 3 | GET | `/time-clock/reports/activity-feed` | Activity timeline (clock events, disputes, edits) |

---

## Tasks

### Task 1 — Hit All 3 Endpoints and Verify Response Shapes

**What:** Before writing ANY code, authenticate and hit all 3 endpoints. Capture actual response shapes.

```bash
# Login as Tenant Owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 1. GET /time-clock/reports/shift-variance
curl -s "http://localhost:8000/api/v1/time-clock/reports/shift-variance?date_from=2026-01-01&date_to=2026-04-10" \
  -H "Authorization: Bearer $TOKEN" | head -c 5000

# 2. GET /time-clock/reports/geo-violations
curl -s "http://localhost:8000/api/v1/time-clock/reports/geo-violations?date_from=2026-01-01&date_to=2026-04-10" \
  -H "Authorization: Bearer $TOKEN" | head -c 5000

# 3. GET /time-clock/reports/activity-feed
curl -s "http://localhost:8000/api/v1/time-clock/reports/activity-feed?limit=50" \
  -H "Authorization: Bearer $TOKEN" | head -c 5000
```

**Acceptance:** All 3 response shapes captured. Types created or updated in `app/src/lib/types/time-clock.ts`.
**Do NOT:** Skip this step. Do NOT guess response shapes.

---

### Task 2 — Shift Variance Tab

**What:** Replace the "Shift Variance" placeholder tab (tab index 3) on the Reports page with the full implementation.

**Filters:**
- `date_from` (DatePicker — optional but recommended)
- `date_to` (DatePicker — optional but recommended)
- Employee (search select — optional)
- Project (search select — optional)
- "Generate Report" button

**Table columns:**
- Employee (name)
- Project (name)
- Scheduled Start (time, formatted HH:MM AM/PM)
- Scheduled End (time, formatted HH:MM AM/PM)
- Actual Clock In (time, formatted HH:MM AM/PM — or "N/A" if missed)
- Actual Clock Out (time, formatted HH:MM AM/PM — or "N/A" if missed)
- Start Variance (minutes — positive = late, negative = early)
- Total Variance (minutes)
- Status (badge)

**Color coding and indicators:**
- **Late arrivals:** Start variance > 0 → display in red text (e.g., "+15 min late")
- **Early arrivals:** Start variance < 0 → display in green text (e.g., "-5 min early")
- **On time:** Start variance === 0 → display in default text ("On time")
- **Missed shifts:** Show red `Badge` with "MISSED" label. Actual times display as "N/A". Entire row has a subtle red background tint.
- Use `Badge` component: `variant="error"` for missed/late, `variant="success"` for early/on-time

**Empty state:** "No shift variance data for the selected period"

---

### Task 3 — Geo Violations Tab

**What:** Replace the "Geo Violations" placeholder tab (tab index 4) with the full implementation.

**Roles:** Owner, Admin only (if the tab should be hidden for non-admin roles, conditionally render it)

**Filters:**
- `date_from` (DatePicker — optional)
- `date_to` (DatePicker — optional)
- Employee (search select — optional)
- "Generate Report" button

**Table columns:**
- Employee (name)
- Date (formatted as Mon, Jan 1, 2026)
- Clock-In Location (lat/lng — formatted to 6 decimal places)
- Geofence Status (`Badge`: `outside` = red "Outside" badge, `unavailable` = amber "Unavailable" badge)
- Flag Reason (text — from the session's flag_reason field)
- Nearest Address (label + distance in meters, e.g., "Main Office — 342m")
- Project (name)
- Session Status (`Badge`: active = blue, completed = green)

**Pagination:**
- Standard page controls matching existing pagination pattern
- Use query params `page` and `limit`

**Row click behavior:**
- Click a row to navigate to the session detail view (link to `/workforce/timesheets` with the session ID, or open the session detail slide-over if the same component from Sprint 10 is available)

**Empty state:** "No geofence violations found for the selected period"

---

### Task 4 — Activity Feed Tab

**What:** Replace the "Activity Feed" placeholder tab (tab index 5) with the full implementation.

**Filters:**
- Employee (search select — optional)
- Limit (select dropdown: 50, 100, 200 — default 50)

**Display:** Timeline-style list (newest first). Each event is a card or row in a vertical timeline.

**Event types with icons:**

| Event Type | Icon | Color | Label |
|---|---|---|---|
| `clock_in` | Play circle | Green | "Clocked In" |
| `clock_out` | Stop circle | Red | "Clocked Out" |
| `break_start` | Pause circle | Amber | "Break Started" |
| `break_end` | Play circle (outline) | Blue | "Break Ended" |
| `dispute_submitted` | Alert triangle | Orange | "Dispute Submitted" |
| `dispute_approved` | Check circle | Green | "Dispute Approved" |
| `dispute_rejected` | X circle | Red | "Dispute Rejected" |
| `manual_edit` | Pencil | Gray | "Session Edited" |
| `shift_missed` | Clock alert | Red | "Shift Missed" |

Use Lucide icons (already available in the project) or the icon library used by existing components. Match the icon import pattern from the sidebar or other existing components.

**Each event card:**
- Left: colored icon (matching event type)
- Center: 
  - Timestamp (formatted: "Apr 10, 2026 at 8:30 AM")
  - Employee name (bold)
  - Event type label
  - Project name (if applicable, in muted text)
  - Details text (if available — e.g., break label, dispute description snippet, edit reason)
- Right: relative time ("2 hours ago", "Yesterday", etc.)

**"Load More" button:**
- Displayed at the bottom of the timeline when there are more events
- Uses cursor-based pagination via the `after` query parameter
- On click: fetch next page of events and append to the existing list (do NOT replace)
- Hide the button when the API returns fewer results than the limit (no more pages)

**Do NOT:** Use infinite scroll — use explicit "Load More" button. Do NOT replace the list on load more — append to it.

**Empty state:** "No activity recorded yet"

---

### Task 5 — Verify Everything Works

**What:** With both servers running:

1. Login as Owner -> navigate to `/workforce/reports`
   - Verify all 5 tabs are now functional (no more placeholders)

2. Shift Variance tab:
   - Select date range -> click "Generate Report"
   - Verify table displays with correct columns
   - Verify late arrivals in red text
   - Verify early arrivals in green text
   - Verify missed shifts with red "MISSED" badge and "N/A" for actual times
   - Verify empty state when no data

3. Geo Violations tab:
   - Select date range -> click "Generate Report"
   - Verify table displays with geofence status badges
   - Verify lat/lng formatted to 6 decimal places
   - Verify nearest address shows label + distance
   - Verify row click navigates to session detail
   - Verify pagination works
   - Verify empty state when no data

4. Activity Feed tab:
   - Verify timeline loads with correct event icons and colors
   - Verify each event shows timestamp, employee, event type, project, details
   - Verify "Load More" button appears when more events exist
   - Click "Load More" -> verify new events are appended (not replaced)
   - Verify employee filter works
   - Verify limit filter changes the number of events loaded
   - Verify empty state when no activity

5. No TypeScript compilation errors in terminal

---

## Acceptance Criteria

- [ ] All 3 endpoints tested live before any code was written
- [ ] TypeScript types match actual API response shapes
- [ ] All 5 report tabs are functional (no placeholders remain)
- [ ] Shift Variance tab: table with correct columns
- [ ] Shift Variance tab: late arrivals in red, early in green
- [ ] Shift Variance tab: missed shifts with "MISSED" badge, "N/A" actual times, red row tint
- [ ] Shift Variance tab: filters (date range, employee, project) working
- [ ] Geo Violations tab: table with geofence status badges (outside=red, unavailable=amber)
- [ ] Geo Violations tab: lat/lng formatted to 6 decimal places
- [ ] Geo Violations tab: nearest address with label + distance in meters
- [ ] Geo Violations tab: row click navigates to session detail
- [ ] Geo Violations tab: pagination working
- [ ] Geo Violations tab: filters (date range, employee) working
- [ ] Activity Feed tab: timeline-style list with colored event icons
- [ ] Activity Feed tab: 9 event types each with correct icon, color, and label
- [ ] Activity Feed tab: each event shows timestamp, employee, type, project, details
- [ ] Activity Feed tab: "Load More" button with cursor pagination (appends, does not replace)
- [ ] Activity Feed tab: employee and limit filters working
- [ ] Activity Feed tab: empty state when no activity
- [ ] Mobile responsive (375px viewport tested)
- [ ] Loading spinners on all async operations
- [ ] Error/success toasts (no browser alerts)
- [ ] No modifications to any file under `/var/www/lead360.app/api/`
- [ ] No TypeScript compilation errors
- [ ] Frontend dev server shut down before marking sprint complete

---

## Gate Marker

**NONE** — This is the final frontend sprint for the Time Clock reports section. After this sprint, the entire Reports hub is complete with all 5 tabs functional.

---

## Handoff Notes

- All 5 report tabs are now complete on `/workforce/reports`
- The Activity Feed timeline component can be reused in other modules (e.g., project activity feed)
- The Shift Variance color coding pattern (red for late, green for early) can be reused for scheduling modules
- The Geo Violations tab establishes the geofence status badge pattern used across the time-clock module
- The "Load More" cursor pagination pattern can be extracted as a reusable hook if needed by other modules
- The complete Time Clock frontend module includes:
  - Sprint 9: Disputes + Dashboard (Who's In)
  - Sprint 10: Timesheets + Manual Session Edit
  - Sprint 11: Reports (Timesheet + Payroll + CSV Export)
  - Sprint 12: Reports (Shift Variance + Geo Violations + Activity Feed)
