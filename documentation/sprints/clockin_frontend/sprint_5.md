# Sprint 5 — Clock In/Out Page (Mobile-First)

**Module:** time-clock
**File:** `./documentation/sprints/clockin_frontend/sprint_5.md`
**Type:** Frontend — Page
**Depends On:** Sprints 1–4 (Foundation, Types, API Client, Settings), Backend Sprint 9
**Gate:** STOP — Clock-in/out cycle works end-to-end on mobile viewport
**Estimated Complexity:** High

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

Build the **Clock In/Out Page** — the single most important page in the time-clock module. This page is used daily by every employee on their phone. It MUST be mobile-first (375px viewport) and production-quality.

**Page:** `/workforce/clock` -> `app/src/app/(dashboard)/workforce/clock/page.tsx`
**Roles:** Owner, Admin, Project Manager, Employee

---

## Endpoints Consumed (5)

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | POST | `/api/v1/time-clock/sessions/clock-in` | Clock in to start a session |
| 2 | POST | `/api/v1/time-clock/sessions/clock-out` | Clock out the active session |
| 3 | GET | `/api/v1/time-clock/sessions/me/active` | Get currently active session (if any) |
| 4 | GET | `/api/v1/time-clock/sessions/me/available-projects` | Get projects employee can clock into |
| 5 | GET | `/api/v1/time-clock/sessions/mine?date_from=TODAY&date_to=TODAY` | Get today's sessions |

---

## Pre-Sprint Checklist

- [ ] Confirm `app/src/lib/api/time-clock.ts` exists with API client functions (from Sprint 1)
- [ ] Confirm `app/src/lib/types/time-clock.ts` exists with TypeScript interfaces (from Sprint 1)
- [ ] Read `app/src/components/ui/Button.tsx` — Button component props
- [ ] Read `app/src/components/ui/Select.tsx` — Select component props
- [ ] Read `app/src/components/ui/LoadingSpinner.tsx` — LoadingSpinner component
- [ ] Read `app/src/components/ui/ConfirmModal.tsx` — ConfirmModal component
- [ ] Read `app/src/components/ui/Badge.tsx` — Badge component and variants
- [ ] Read `app/src/components/ui/Textarea.tsx` — Textarea component
- [ ] Confirm backend is running: `curl -s http://localhost:8000/health`

---

## Task 1 — Test All 5 Endpoints Live

**What:** Before writing ANY code, authenticate and hit every endpoint this sprint consumes. Capture the actual response shapes.

```bash
# Login as Tenant Owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 1. GET /time-clock/sessions/me/active — Check for active session
curl -s http://localhost:8000/api/v1/time-clock/sessions/me/active \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 2. GET /time-clock/sessions/me/available-projects — Available projects
curl -s http://localhost:8000/api/v1/time-clock/sessions/me/available-projects \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 3. GET /time-clock/sessions/mine — Today's sessions
curl -s "http://localhost:8000/api/v1/time-clock/sessions/mine?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 4. POST /time-clock/sessions/clock-in — Clock in (test with GPS coords)
curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":26.1224,"longitude":-80.1373,"location_source":"browser_gps"}' | head -c 3000

# 5. POST /time-clock/sessions/clock-out — Clock out
curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":26.1224,"longitude":-80.1373,"location_source":"browser_gps"}' | head -c 3000
```

**IMPORTANT:** Compare each actual response with the documented shapes. If there are mismatches, **trust the actual API response** and adjust your types accordingly.

**Acceptance:** All 5 endpoints return expected responses. Clock-in/clock-out full cycle works.
**Do NOT:** Skip this step. Do NOT guess response shapes.

---

## Task 2 — GPS Handling

**What:** Build GPS acquisition logic that requests permission on component mount (NOT on button click).

**File:** `app/src/components/time-clock/GPSStatusIndicator.tsx`

**GPS acquisition on mount:**
```typescript
navigator.geolocation.getCurrentPosition(success, error, {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000
});
```

**GPS States:** `idle` -> `acquiring` -> `confirmed` | `denied` | `unavailable`

**GPSStatusIndicator component:**
- `idle`: Hidden or minimal display
- `acquiring`: Show `Loader2` spinner (from `lucide-react`) with text "Acquiring GPS..." in blue
- `confirmed`: Green `Check` icon with text "GPS Confirmed" and optional accuracy display ("+/- 15m")
- `denied`: Red `X` icon with text "GPS Denied — Location access is required" with help message
- `unavailable`: Amber `AlertTriangle` icon with text "GPS Unavailable"
- Compact horizontal layout, fits in a single row
- Icons from `lucide-react`: `Loader2`, `Check`, `X`, `AlertTriangle`, `MapPin`

**Custom hook `useGPSPosition`:**
```typescript
// Returns: { latitude, longitude, accuracy, status, error }
// status: 'idle' | 'acquiring' | 'confirmed' | 'denied' | 'unavailable'
// Requests position on mount automatically
```

---

## Task 3 — Build Components

**What:** Build the following components in `app/src/components/time-clock/`:

### 3a. ClockButton.tsx

**Props:**
```typescript
interface ClockButtonProps {
  status: 'clocked_out' | 'clocked_in' | 'on_break';
  loading: boolean;
  disabled?: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
}
```

**Behavior:**
- When `status === 'clocked_out'`: Green background (`bg-green-600 hover:bg-green-700`), label "Clock In", calls `onClockIn`
- When `status === 'clocked_in'`: Red background (`bg-red-600 hover:bg-red-700`), label "Clock Out", calls `onClockOut`
- When `status === 'on_break'`: Amber background (`bg-amber-600 hover:bg-amber-700`), label "Clock Out", calls `onClockOut`
- When `loading === true`: Show `Loader2` spinner with `animate-spin`, disable click
- Minimum height: **64px** (critical for mobile tap targets)
- Full width on mobile (`w-full`), `max-w-[320px]` on desktop
- Border radius: `rounded-xl`
- Font size: `text-xl font-bold`
- Icons from `lucide-react`: `Play` for clock in, `Square` for clock out

### 3b. SessionDurationTimer.tsx

**Props:**
```typescript
interface SessionDurationTimerProps {
  clockInAt: string; // ISO 8601 timestamp
  isPaused?: boolean; // True when on break
  className?: string;
}
```

**Behavior:**
- On mount, compute elapsed seconds from `clockInAt` to `Date.now()`
- Use `setInterval(1000)` to increment every second
- Display format: `HH:MM:SS` (e.g., `02:34:17`)
- When `isPaused === true`: Stop incrementing, show text in amber color, append "(Break)" label
- Clean up interval on unmount
- Font: `text-4xl font-mono font-bold` for the timer digits

**Implementation:**
```typescript
import { differenceInSeconds } from 'date-fns';

useEffect(() => {
  const start = new Date(clockInAt);
  const interval = setInterval(() => {
    if (!isPaused) {
      const diff = differenceInSeconds(new Date(), start);
      setElapsed(diff);
    }
  }, 1000);
  return () => clearInterval(interval);
}, [clockInAt, isPaused]);

const hours = Math.floor(elapsed / 3600);
const minutes = Math.floor((elapsed % 3600) / 60);
const seconds = elapsed % 60;
const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
```

### 3c. ProjectTaskSelector.tsx

**Props:**
```typescript
interface ProjectTaskSelectorProps {
  projectId: string | null;
  taskId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onTaskChange: (taskId: string | null) => void;
  required?: boolean;
  taskRequired?: boolean;
  mode?: 'anywhere' | 'specific_addresses' | 'active_job_sites';
  error?: string;
}
```

**Behavior:**
- First dropdown: Project selection. Call `getMyAvailableProjects()` from `@/lib/api/time-clock`. Backend handles filtering based on `clock_in_mode`.
- Second dropdown: Task selection (visible when a project is selected and `taskRequired` is true). Loads tasks for selected project.
- When `required === true`, show required indicator (*) and validate on submit
- Use existing `Select` component from `@/components/ui/Select`
- If no projects available, show: "No projects assigned. Contact your admin."

### 3d. TodaysSessionsSummary.tsx

**Props:**
```typescript
interface TodaysSessionsSummaryProps {
  sessions: ClockSession[];
  className?: string;
}
```

**Behavior:**
- Vertical list of session cards
- Each card: project name (or "No Project"), clock-in time, clock-out time (or "Active"), duration (HH:MM), status badge
- Status badge uses existing `Badge` component: `active` -> info, `on_break` -> warning, `completed` -> success
- If `is_flagged === true`, show amber warning badge with `flag_reason`
- Total hours today at bottom: sum of `total_worked_minutes`
- Empty state: "No sessions today"
- Compact cards

---

## Task 4 — Clock Page Layout

**What:** Build the clock page at `app/src/app/(dashboard)/workforce/clock/page.tsx`.

**Layout (mobile-first, 375px viewport):**

```
+-----------------------------------+
| GPS Status Indicator              |  <- Top bar, always visible
+-----------------------------------+
|                                   |
|  Active Session Card              |  <- Only when clocked in
|  [Project Name]                   |
|  Clock In: 8:30 AM               |
|  Duration: 02:34:17  (live)       |
|  Status: Active / On Break        |
|                                   |
+-----------------------------------+
|                                   |
|  [Break Controls]                 |  <- Only when clocked in
|  Start Break | End Break          |
|                                   |
+-----------------------------------+
|                                   |
|  [===  CLOCK OUT  ===]            |  <- 64px, red, full-width
|                                   |
+-----------------------------------+

--- OR when NOT clocked in ---

+-----------------------------------+
| GPS Status Indicator              |
+-----------------------------------+
|                                   |
|  [Project Selector v]             |  <- Dropdown
|  [Task Selector v]    (optional)  |
|  [Notes: ________]   (optional)   |
|                                   |
+-----------------------------------+
|                                   |
|  [===  CLOCK IN  ===]             |  <- 64px, green, full-width
|                                   |
+-----------------------------------+
|                                   |
|  Today's Sessions                 |
|  - Session 1: 8:00-12:00 (4h)    |
|  - Session 2: 1:00-5:00  (4h)    |
|  Total: 8h 00m                    |
|                                   |
+-----------------------------------+
```

**Page flow:**
1. On mount: request GPS (via `useGPSPosition` hook)
2. On mount: call `GET /time-clock/sessions/me/active` to check for active session
3. On mount: call `GET /time-clock/sessions/mine` with today's date to get today's sessions
4. If active session exists: show active session card with live timer, break controls, clock-out button
5. If no active session: show project selector, notes field, clock-in button, today's sessions summary

---

## Task 5 — Clock-In Flow

**What:** Implement the complete clock-in flow.

**Steps:**
1. User selects project (if required by settings)
2. User optionally selects task, enters notes
3. User taps "Clock In" button
4. Send POST `/time-clock/sessions/clock-in`:
   ```json
   {
     "project_id": "uuid-or-null",
     "task_id": "uuid-or-null",
     "latitude": 26.1224,
     "longitude": -80.1373,
     "location_source": "browser_gps",
     "notes": "optional notes"
   }
   ```
5. Handle errors:
   - **409 Conflict**: "You already have an active clock session." -> Show `ErrorModal` with message
   - **403 Forbidden**: GPS/geofence blocked -> Show `ErrorModal` with reason from response
   - **400 Bad Request**: Missing required fields -> Show field-level validation errors
6. On success: transition to active session view with live timer

---

## Task 6 — Clock-Out Flow

**What:** Implement the complete clock-out flow.

**Steps:**
1. User taps "Clock Out" button
2. Show `ConfirmModal`: "Are you sure you want to clock out?"
3. On confirm, send POST `/time-clock/sessions/clock-out`:
   ```json
   {
     "latitude": 26.1224,
     "longitude": -80.1373,
     "location_source": "browser_gps",
     "notes": "optional notes"
   }
   ```
4. Handle errors:
   - **404 Not Found**: No active session -> Show `ErrorModal`
5. On success:
   - Show `SuccessModal` with session summary (duration, project)
   - Transition to clocked-out view
   - Refresh today's sessions list

---

## Task 7 — Flagged Session Handling

**What:** Handle flagged sessions with appropriate visual indicators.

**Rules:**
- If `session.is_flagged === true`: show amber warning badge with `flag_reason` text
- Geofence warn: amber warning banner "You are outside configured locations" on the active session card
- GPS unavailable: amber warning "GPS location unavailable — session flagged" on the active session card
- Use existing `Badge` component with `warning` variant for flag indicators

---

## Acceptance Criteria

- [ ] All 5 endpoints tested live before any code was written
- [ ] GPS permission requested on component mount (NOT on button click)
- [ ] GPSStatusIndicator shows all states correctly (idle, acquiring, confirmed, denied, unavailable)
- [ ] ClockButton renders at 64px height, full-width, correct colors (green/red/amber)
- [ ] SessionDurationTimer counts HH:MM:SS in real-time, pauses on break
- [ ] ProjectTaskSelector loads available projects from API
- [ ] TodaysSessionsSummary lists today's completed sessions
- [ ] Clock-in flow: select project -> tap Clock In -> session starts -> live timer appears
- [ ] Clock-out flow: tap Clock Out -> ConfirmModal -> session ends -> today's sessions refresh
- [ ] 409 error (duplicate session) shown in ErrorModal
- [ ] 403 error (geofence/GPS blocked) shown in ErrorModal
- [ ] Flagged sessions show amber warning badges with flag_reason
- [ ] Page works at 375px mobile viewport
- [ ] All tap targets minimum 48px (clock button 64px)
- [ ] Loading spinners on all async operations
- [ ] No `window.alert`, `window.confirm`, or `window.prompt` used anywhere
- [ ] Uses existing UI components from `app/src/components/ui/` — no new UI primitives created
- [ ] All new components in `app/src/components/time-clock/`
- [ ] Dev server shut down before marking complete

---

## Gate Marker

**STOP** — Clock-in/out cycle must work end-to-end on mobile viewport before Sprint 6 begins. Confirm:
1. GPS acquired on page load
2. Clock-in creates a session with GPS coordinates
3. Live timer counts up
4. Clock-out ends session with confirmation modal
5. Today's sessions list updates after clock-out
6. Page is fully functional at 375px viewport width

---

## Handoff Notes

**For Sprint 6 (Break Controls + My Hours):**
- The `ClockButton`, `SessionDurationTimer`, `GPSStatusIndicator`, and `ProjectTaskSelector` components are built and tested
- The clock page at `/workforce/clock` is functional
- Sprint 6 will add break controls to the active session card and build the My Hours page
- The `TodaysSessionsSummary` component can be reused on the My Hours page
