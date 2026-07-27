# Sprint 8 — My Shifts Page (Employee View)

**Module:** time-clock
**File:** `./documentation/sprints/clockin_frontend/sprint_8.md`
**Type:** Frontend — Page
**Depends On:** Sprint 7 (Shifts Admin)
**Gate:** NONE
**Estimated Complexity:** Low

---

## Developer Standard

You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is deliberate, precise, and production-grade.

---

## Critical Warnings

- **This platform is 85% production-ready.** Never break existing code. Never leave the server running in the background.
- **Read the codebase before touching anything.** Implement with surgical precision — not a single comma may break existing business logic.
- **MySQL credentials are in the `.env` file** at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.
- **Never use `pkill -f`.** Always use `lsof -i :7000` + `kill {PID}`.
- **Never use PM2.** This project does NOT use PM2.

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **RULE 1 — Test every endpoint LIVE before writing any component.** Authenticate with the test credentials below, hit every endpoint this sprint consumes, verify the actual response shape. If the response differs from documentation, trust the actual API response and adjust your types accordingly. Do NOT guess response shapes.
2. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`. The backend is complete and running.
3. **Backend runs on `http://localhost:8000`** (NestJS `--watch` mode via `npm run start:dev`). Do NOT restart it, do NOT run any backend commands.
4. **Frontend runs on `http://localhost:7000`** (Next.js dev server). All your work is in `/var/www/lead360.app/app/`.
5. **Use existing components, patterns, and modules.** Do NOT create new UI primitives. Use what exists in `app/src/components/ui/`.
6. **Deliver masterclass production-quality code.** Use autocomplete inputs, masked inputs, search selects, modals — no browser alerts, no `window.confirm`, no `window.prompt`.
7. **Respect patterns from other modules.** Read existing API clients and types before writing yours. Follow the same API call pattern, error handling, and loading state pattern as existing modules.

---

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Tenant Owner | `contact@honeydo4you.com` | `978@F32c` | Owner — full access to all time-clock features |
| Sys Admin | `ludsonaiello@gmail.com` | `978@F32c` | Platform admin |

---

## Environment

- **Backend URL:** `http://localhost:8000` (NestJS, port 8000)
- **Frontend URL:** `http://localhost:7000` (Next.js, port 7000)
- **API Base Path:** `/api/v1`
- **Swagger:** `http://127.0.0.1:8000/api/docs`
- **Do NOT use PM2.** The dev server runs via `npm run start:dev` in watch mode.

---

## Dev Server

```
CHECK if port 7000 is already in use:
  lsof -i :7000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :7000   <- must return nothing before proceeding

START the frontend dev server:
  cd /var/www/lead360.app/app && npm run dev

WAIT — the server takes 30 to 60 seconds to compile and become ready.

Also confirm backend is running:
  curl -s http://localhost:8000/health   <- must return 200

KEEP both servers running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep them open.

BEFORE marking the sprint COMPLETE:
  lsof -i :7000
  kill {PID}
  Confirm port is free: lsof -i :7000   <- must return nothing
```

---

## Objective

Build the **My Shifts** page — a read-only view where employees see their own upcoming and past shifts. This page complements the Shifts Admin page (Sprint 7) which is for managers. My Shifts is for the employee's personal view.

**Page:** `/workforce/my-shifts` -> `app/src/app/(dashboard)/workforce/my-shifts/page.tsx`
**Roles:** Owner, Admin, Project Manager, Employee

---

## Endpoints Consumed (1)

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/api/v1/time-clock/shifts/mine` | Get shifts assigned to the current user |

**Query parameters:**
- `page` (number, default 1)
- `limit` (number, default 20)
- `date_from` (ISO date string, optional)
- `date_to` (ISO date string, optional)
- `status` (string, optional): `scheduled`, `in_progress`, `completed`, `missed`, `cancelled`

**Response shape:**
```json
{
  "data": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "project_id": "uuid-or-null",
      "task_id": "uuid-or-null",
      "scheduled_start": "2026-04-11T08:00:00.000Z",
      "scheduled_end": "2026-04-11T16:00:00.000Z",
      "actual_start": null,
      "actual_end": null,
      "title": "Morning Shift",
      "notes": "Optional notes",
      "status": "scheduled",
      "project": { "id": "uuid", "name": "Main St Renovation" },
      "task": null,
      "created_at": "2026-04-10T12:00:00.000Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## Pre-Sprint Checklist

- [ ] Confirm Sprint 7 is complete: Shifts Admin page exists at `/workforce/shifts`
- [ ] Confirm `app/src/lib/api/time-clock.ts` has `getMyShifts()` function (from Sprint 1)
- [ ] Confirm `app/src/lib/types/time-clock.ts` has `Shift` interface (from Sprint 1)
- [ ] Read the shift status badge pattern used in Sprint 7's Shifts Admin page — reuse exact same Badge variants
- [ ] Read `app/src/components/ui/Badge.tsx` — Badge component and variants
- [ ] Read `app/src/components/ui/DateRangePicker.tsx` — DateRangePicker component
- [ ] Read `app/src/components/ui/Select.tsx` — Select component
- [ ] Read `app/src/components/ui/PaginationControls.tsx` — PaginationControls component
- [ ] Read `app/src/components/ui/Card.tsx` — Card component
- [ ] Confirm backend is running: `curl -s http://localhost:8000/health`

---

## Task 1 — Test Endpoint Live

**What:** Before writing ANY code, authenticate and hit the endpoint to verify actual response shape.

```bash
# Login as Tenant Owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 1. GET /shifts/mine — All my shifts
curl -s "http://localhost:8000/api/v1/time-clock/shifts/mine?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 2. GET /shifts/mine — Filter by date range
curl -s "http://localhost:8000/api/v1/time-clock/shifts/mine?date_from=2026-04-01&date_to=2026-04-30&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 3. GET /shifts/mine — Filter by status
curl -s "http://localhost:8000/api/v1/time-clock/shifts/mine?status=scheduled&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000
```

**Acceptance:** Endpoint returns expected response shape. Note actual field names and types.
**Do NOT:** Skip this step.

---

## Task 2 — My Shifts Page

**What:** Build the My Shifts page at `app/src/app/(dashboard)/workforce/my-shifts/page.tsx`.

**Layout — Desktop (table view):**

```
+---------------------------------------------------+
| Breadcrumb: Workforce > My Shifts                 |
+---------------------------------------------------+
| Filters:                                          |
| [Date Range: From - To]  [Status: All v]          |
+---------------------------------------------------+
| Today's Shifts (highlighted section)              |
| +-----------------------------------------------+ |
| | 8:00 AM - 4:00 PM | Main St Reno | [Scheduled]| |
| +-----------------------------------------------+ |
+---------------------------------------------------+
| Upcoming & Past Shifts                            |
| +-----------------------------------------------+ |
| | Date       | Time          | Project  | Status | |
| |------------|---------------|----------|--------| |
| | Apr 12     | 8:00 - 4:00  | Main St  | Sched. | |
| | Apr 11     | 9:00 - 5:00  | Office   | Sched. | |
| | Apr 10     | 8:00 - 4:00  | Main St  | Compl. | |
| | Apr 9      | 8:00 - 4:00  | Main St  | Compl. | |
| | Apr 8      | 8:00 - 4:00  | Missed!  | Missed | |
| +-----------------------------------------------+ |
| [< Prev] Page 1 of 3 [Next >]                    |
+---------------------------------------------------+
```

**Layout — Mobile (card view, 375px):**

```
+-----------------------------------+
| Workforce > My Shifts             |
+-----------------------------------+
| [Date Range] [Status v]          |
+-----------------------------------+
| TODAY                             |
| +-------------------------------+ |
| | Main St Renovation            | |
| | 8:00 AM - 4:00 PM            | |
| | [Scheduled]                   | |
| +-------------------------------+ |
+-----------------------------------+
| UPCOMING                          |
| +-------------------------------+ |
| | Apr 12 - Office Remodel      | |
| | 9:00 AM - 5:00 PM            | |
| | [Scheduled]                   | |
| +-------------------------------+ |
| +-------------------------------+ |
| | Apr 13 - Main St Renovation  | |
| | 8:00 AM - 4:00 PM            | |
| | [Scheduled]                   | |
| +-------------------------------+ |
+-----------------------------------+
| PAST                              |
| +-------------------------------+ |
| | Apr 10 - Main St Renovation  | |
| | 8:00 AM - 4:00 PM            | |
| | [Completed]                   | |
| +-------------------------------+ |
+-----------------------------------+
```

**Filters:**
- Date range: `DateRangePicker` (from/to)
- Status: `Select` with options: All, Scheduled, In Progress, Completed, Missed, Cancelled

**Sorting:**
- Most recent/upcoming first (upcoming shifts sorted ascending by scheduled_start, past shifts sorted descending)
- Group: Today's shifts highlighted at top, then upcoming, then past

**Each shift card/row:**
- Date (formatted: "Apr 11" or "Today")
- Scheduled start/end times (formatted: "8:00 AM - 4:00 PM")
- Project name (or "No Project Assigned")
- Task name (if available, shown below project name in smaller text)
- Title (if available, shown as card header)
- Notes (if available, shown as small text below)
- Status badge with color coding:
  - `scheduled` -> info (blue)
  - `in_progress` -> warning (amber)
  - `completed` -> success (green)
  - `missed` -> error (red)
  - `cancelled` -> neutral (gray)

**Status color coding on cards (mobile):**
- Upcoming shifts: left border blue (`border-l-4 border-blue-500`)
- Missed shifts: left border red (`border-l-4 border-red-500`)
- Completed shifts: left border green (`border-l-4 border-green-500`)
- Cancelled shifts: left border gray (`border-l-4 border-gray-400`)
- In progress shifts: left border amber (`border-l-4 border-amber-500`)

**Today's shifts highlighted:**
- If any shifts are scheduled for today, show them in a separate "Today" section at the top
- Use slightly different background: `bg-blue-50 dark:bg-blue-900/20` for today's section

**Empty state:**
- Show calendar icon (from `lucide-react`: `CalendarOff` or `Calendar`)
- Text: "No shifts scheduled"
- Subtext: "Shifts assigned to you will appear here"
- Centered vertically with padding

**Pagination:**
- Use existing `PaginationControls` component
- Default: 20 shifts per page

---

## Task 3 — Responsive Layout Toggle

**What:** Implement the desktop/mobile layout switch.

**Rules:**
- Mobile (< 768px): card-based layout using `Card` component. Each shift is a card with left color border.
- Desktop (>= 768px): table layout with columns: Date, Time, Project, Task, Title, Status, Notes.
- Use Tailwind responsive classes: `hidden md:block` for table, `md:hidden` for cards.
- Do NOT use JavaScript for responsive detection — use CSS only via Tailwind breakpoints.

---

## Task 4 — Date Grouping Logic

**What:** Group shifts into sections: Today, Upcoming, Past.

**Logic:**
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const todayShifts = shifts.filter(s => {
  const start = new Date(s.scheduled_start);
  return start >= today && start < tomorrow;
});

const upcomingShifts = shifts.filter(s => {
  const start = new Date(s.scheduled_start);
  return start >= tomorrow;
}).sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

const pastShifts = shifts.filter(s => {
  const start = new Date(s.scheduled_start);
  return start < today;
}).sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime());
```

**Display sections:**
- "Today" section header (only if today's shifts exist)
- "Upcoming" section header (only if upcoming shifts exist)
- "Past" section header (only if past shifts exist)
- If all sections are empty, show the empty state

---

## Acceptance Criteria

- [ ] Endpoint tested live before any code was written
- [ ] My Shifts page exists at `/workforce/my-shifts`
- [ ] Filters: date range picker and status filter work correctly
- [ ] Desktop: table layout with all columns (Date, Time, Project, Task, Title, Status)
- [ ] Mobile: card-based layout at 375px viewport
- [ ] Cards have left color border matching status (blue=scheduled, green=completed, red=missed, gray=cancelled, amber=in_progress)
- [ ] Today's shifts highlighted at top in separate section with blue-tinted background
- [ ] Upcoming shifts sorted ascending by scheduled_start
- [ ] Past shifts sorted descending by scheduled_start
- [ ] Status badges use correct colors matching Sprint 7 pattern
- [ ] Empty state with calendar icon and "No shifts scheduled" message
- [ ] Pagination works with PaginationControls
- [ ] Responsive layout: cards on mobile, table on desktop (CSS-only, no JS detection)
- [ ] Page loads without errors on both mobile and desktop viewports
- [ ] Loading spinner shown while fetching shifts
- [ ] No `window.alert`, `window.confirm`, or `window.prompt` used
- [ ] Uses existing UI components — no new UI primitives created
- [ ] All new components in `app/src/components/time-clock/`
- [ ] Dev server shut down before marking complete

---

## Gate Marker

**NONE** — This is the final sprint in the Clock frontend sprint series (5-8). No gate required.

---

## Handoff Notes

**Sprint 5-8 Frontend Clock Module Summary:**
- Sprint 5: Clock In/Out page at `/workforce/clock` with GPS, live timer, project selection
- Sprint 6: Break controls integrated into Clock page + My Hours page at `/workforce/my-hours` with disputes
- Sprint 7: Employee-Project Assignments + Shifts Admin at `/workforce/shifts` with bulk create
- Sprint 8: My Shifts at `/workforce/my-shifts` with card/table responsive layout

**All time-clock components are in:** `app/src/components/time-clock/`
**All time-clock pages are under:** `app/src/app/(dashboard)/workforce/`

**Components built across Sprints 5-8:**
- `ClockButton.tsx` — Clock in/out button (64px, green/red/amber)
- `SessionDurationTimer.tsx` — Live HH:MM:SS timer
- `GPSStatusIndicator.tsx` — GPS status display
- `ProjectTaskSelector.tsx` — Project + task dropdowns
- `BreakControls.tsx` — Start/end break with type selector
- `TodaysSessionsSummary.tsx` — Today's completed sessions list
- `DisputeForm.tsx` — Dispute submission modal

**Pages built across Sprints 5-8:**
- `/workforce/clock` — Clock in/out (most critical, mobile-first)
- `/workforce/my-hours` — Session history + disputes
- `/workforce/shifts` — Shifts admin (manager view)
- `/workforce/my-shifts` — My shifts (employee view)
- `/workforce/assignments` — Employee-project assignments
