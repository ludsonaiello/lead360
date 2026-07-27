# Sprint 7 — Employee-Project Assignments + Shift Scheduling

**Module:** time-clock
**File:** `./documentation/sprints/clockin_frontend/sprint_7.md`
**Type:** Frontend — Pages
**Depends On:** Sprint 1 (Foundation, Types, API Client)
**Gate:** STOP — Assignment CRUD works, Shift CRUD works including bulk
**Estimated Complexity:** Medium

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

Build the **Employee-Project Assignments** management section and the **Shifts Admin** page with full CRUD including bulk shift creation.

---

## Endpoints Consumed (10)

### Employee-Project Assignments (3)

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/api/v1/time-clock/employee-projects` | List assignments (filter by employee_id or project_id) |
| 2 | POST | `/api/v1/time-clock/employee-projects` | Create a new assignment |
| 3 | DELETE | `/api/v1/time-clock/employee-projects/:id` | Remove an assignment |

### Shifts (7)

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 4 | GET | `/api/v1/time-clock/shifts` | List shifts (filter by employee, project, date range, status) |
| 5 | POST | `/api/v1/time-clock/shifts` | Create a single shift |
| 6 | POST | `/api/v1/time-clock/shifts/bulk` | Create multiple shifts at once (up to 50) |
| 7 | GET | `/api/v1/time-clock/shifts/:id` | Get shift detail |
| 8 | PATCH | `/api/v1/time-clock/shifts/:id` | Update a shift |
| 9 | DELETE | `/api/v1/time-clock/shifts/:id` | Delete a shift |
| 10 | GET | `/api/v1/time-clock/shifts/mine` | Get my shifts (employee view — used in Sprint 8) |

---

## Pre-Sprint Checklist

- [ ] Confirm `app/src/lib/api/time-clock.ts` has assignment and shift API functions (from Sprint 1)
- [ ] Confirm `app/src/lib/types/time-clock.ts` has assignment and shift TypeScript interfaces (from Sprint 1)
- [ ] Read `app/src/components/ui/Select.tsx` — Select component
- [ ] Read `app/src/components/ui/DatePicker.tsx` — DatePicker component
- [ ] Read `app/src/components/ui/TimePicker.tsx` — TimePicker component
- [ ] Read `app/src/components/ui/Modal.tsx` — Modal, ModalContent, ModalActions
- [ ] Read `app/src/components/ui/ConfirmModal.tsx` — ConfirmModal component
- [ ] Read `app/src/components/ui/DeleteConfirmationModal.tsx` — DeleteConfirmationModal component
- [ ] Read `app/src/components/ui/PaginationControls.tsx` — PaginationControls component
- [ ] Read `app/src/components/ui/Badge.tsx` — Badge component and variants
- [ ] Read `app/src/components/ui/DateRangePicker.tsx` — DateRangePicker component
- [ ] Confirm backend is running: `curl -s http://localhost:8000/health`

---

## Task 1 — Test All 10 Endpoints Live

**What:** Before writing ANY code, authenticate and hit every endpoint this sprint consumes.

```bash
# Login as Tenant Owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# === Employee-Project Assignments ===

# 1. GET /employee-projects — List all assignments
curl -s "http://localhost:8000/api/v1/time-clock/employee-projects?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 2. POST /employee-projects — Create assignment (use real employee_id and project_id from your tenant)
curl -s -X POST http://localhost:8000/api/v1/time-clock/employee-projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"EMPLOYEE_UUID","project_id":"PROJECT_UUID"}' | head -c 3000

# 3. DELETE /employee-projects/:id — Remove assignment
curl -s -X DELETE http://localhost:8000/api/v1/time-clock/employee-projects/{ASSIGNMENT_ID} \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# === Shifts ===

# 4. GET /shifts — List shifts
curl -s "http://localhost:8000/api/v1/time-clock/shifts?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 5. POST /shifts — Create single shift
curl -s -X POST http://localhost:8000/api/v1/time-clock/shifts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id":"EMPLOYEE_UUID",
    "scheduled_start":"2026-04-11T08:00:00Z",
    "scheduled_end":"2026-04-11T16:00:00Z",
    "title":"Morning Shift"
  }' | head -c 3000

# 6. POST /shifts/bulk — Bulk create shifts
curl -s -X POST http://localhost:8000/api/v1/time-clock/shifts/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shifts": [
      {"employee_id":"EMPLOYEE_UUID","scheduled_start":"2026-04-12T08:00:00Z","scheduled_end":"2026-04-12T16:00:00Z","title":"Saturday AM"},
      {"employee_id":"EMPLOYEE_UUID","scheduled_start":"2026-04-13T08:00:00Z","scheduled_end":"2026-04-13T16:00:00Z","title":"Sunday AM"}
    ]
  }' | head -c 3000

# 7. GET /shifts/:id — Shift detail
curl -s http://localhost:8000/api/v1/time-clock/shifts/{SHIFT_ID} \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 8. PATCH /shifts/:id — Update shift
curl -s -X PATCH http://localhost:8000/api/v1/time-clock/shifts/{SHIFT_ID} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Shift Title","notes":"Updated notes"}' | head -c 3000

# 9. DELETE /shifts/:id — Delete shift
curl -s -X DELETE http://localhost:8000/api/v1/time-clock/shifts/{SHIFT_ID} \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# 10. GET /shifts/mine — My shifts (employee view)
curl -s "http://localhost:8000/api/v1/time-clock/shifts/mine?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000
```

**Acceptance:** All 10 endpoints return expected responses. Assignment and shift CRUD verified.
**Do NOT:** Skip this step.

---

## Task 2 — Employee-Project Assignments

**What:** Build the Employee-Project Assignments management UI. This can be a sub-page under workforce settings or a section within employee detail.

**Page/Section:** `/workforce/assignments` or section within `/workforce/employees/:id`

**Layout:**

```
+-------------------------------------------+
| Breadcrumb: Workforce > Assignments       |
+-------------------------------------------+
| Filters:                                  |
| [Employee v]  [Project v]                 |
+-------------------------------------------+
| [+ Assign Employee]                       |
+-------------------------------------------+
| Assignments Table                         |
| +---------------------------------------+ |
| | Employee     | Project    | Assigned  | |
| | Name         | Name       | By   Date | |
| |              |            | [Remove]  | |
| +---------------------------------------+ |
| | John Smith   | Main St    | Admin     | |
| |              | Renovation | 04/01     | |
| |              |            | [Remove]  | |
| +---------------------------------------+ |
+-------------------------------------------+
```

**"Assign Employee" button -> Modal:**
- Employee selector: `Select` dropdown populated from employees/users list
- Project selector: `Select` dropdown populated from projects list
- Submit: POST `/time-clock/employee-projects` with `{ employee_id, project_id }`
- Handle errors:
  - **409 Conflict**: "This employee is already assigned to this project" -> `ErrorModal`
  - **400 Bad Request**: Validation errors
- On success: `SuccessModal`, refresh assignments list

**Remove assignment:**
- Click "Remove" button on a row
- Show `ConfirmModal`: "Remove this employee from this project?"
- On confirm: DELETE `/time-clock/employee-projects/{id}`
- On success: refresh list

**Table columns:**
- Employee Name
- Project Name
- Assigned By (user who created the assignment)
- Date Assigned
- Actions (Remove button)

**Filters:**
- Employee dropdown: filter assignments by employee
- Project dropdown: filter assignments by project

---

## Task 3 — Shifts Admin Page

**What:** Build the Shifts Admin page at `app/src/app/(dashboard)/workforce/shifts/page.tsx`.

**Page:** `/workforce/shifts`
**Roles:** Owner, Admin, Project Manager

**Layout:**

```
+-------------------------------------------+
| Breadcrumb: Workforce > Shifts            |
+-------------------------------------------+
| [+ Create Shift]  [+ Bulk Create]         |
+-------------------------------------------+
| Filters:                                  |
| [Employee v] [Project v] [Date Range]     |
| [Status v: all/scheduled/completed/missed]|
+-------------------------------------------+
| Shifts List                               |
| +---------------------------------------+ |
| | Apr 11 | John Smith                   | |
| | 8:00 AM - 4:00 PM | Main St Reno     | |
| | Status: [Scheduled]                   | |
| | [Edit] [Delete]                       | |
| +---------------------------------------+ |
| | Apr 11 | Jane Doe                     | |
| | 9:00 AM - 5:00 PM | Office Remodel   | |
| | Status: [Completed]                   | |
| | [Edit]                                | |
| +---------------------------------------+ |
| [< Prev] Page 1 of 3 [Next >]            |
+-------------------------------------------+
```

**Filters:**
- Employee: `Select` dropdown
- Project: `Select` dropdown (optional filter)
- Date range: `DateRangePicker`
- Status: `Select` with options: all, scheduled, in_progress, completed, missed, cancelled

**Each shift row:**
- Date
- Employee name
- Scheduled start/end times (formatted HH:MM AM/PM)
- Project name (or "No Project")
- Task name (or empty)
- Status badge:
  - `scheduled` -> info (blue)
  - `in_progress` -> warning (amber)
  - `completed` -> success (green)
  - `missed` -> error (red)
  - `cancelled` -> neutral (gray)
- Actions: Edit button, Delete button (only if status is `scheduled` or `cancelled`)

**Pagination:** Use existing `PaginationControls` component.

---

## Task 4 — Create Shift Modal

**What:** Build the Create Shift modal.

**Fields:**
- **Employee** (required): `Select` dropdown with employee list
- **Project** (optional): `Select` dropdown with project list
- **Task** (optional): `Select` dropdown with task list (loads when project selected)
- **Scheduled Start** (required): `DatePicker` + `TimePicker` combined
- **Scheduled End** (required): `DatePicker` + `TimePicker` combined
- **Title** (optional): `Input` with placeholder "Shift title"
- **Notes** (optional): `Textarea` with placeholder "Shift notes"

**Validation:**
- Employee is required
- Scheduled start is required
- Scheduled end is required
- Scheduled end must be after scheduled start — show error "End time must be after start time"

**Submit:** POST `/time-clock/shifts`
```json
{
  "employee_id": "uuid",
  "project_id": "uuid-or-null",
  "task_id": "uuid-or-null",
  "scheduled_start": "2026-04-11T08:00:00Z",
  "scheduled_end": "2026-04-11T16:00:00Z",
  "title": "Morning Shift",
  "notes": "Optional notes"
}
```

**Handle errors:**
- **400 Bad Request**: Validation errors -> show field-level errors
- **409 Conflict**: Overlapping shift -> `ErrorModal`

**On success:** `SuccessModal`, close modal, refresh shifts list.

---

## Task 5 — Bulk Create Shifts Modal

**What:** Build the Bulk Create Shifts modal for creating multiple shifts at once (up to 50).

**Layout:**

```
+-------------------------------------------+
| Bulk Create Shifts                        |
+-------------------------------------------+
| Shift 1:                                  |
| [Employee v] [Date] [Start] [End] [Title] |
| [x Remove]                                |
+-------------------------------------------+
| Shift 2:                                  |
| [Employee v] [Date] [Start] [End] [Title] |
| [x Remove]                                |
+-------------------------------------------+
| [+ Add Another Shift]                     |
+-------------------------------------------+
| Recurring Pattern (optional):             |
| [x] Same time for all                     |
|   Start: [08:00] End: [16:00]             |
| Dates: [Apr 11] [Apr 12] [Apr 13]        |
| Employees: [John] [Jane] [Bob]            |
| -> Generates: 9 shifts (3 dates x 3 emps)|
+-------------------------------------------+
| [Cancel]              [Create X Shifts]   |
+-------------------------------------------+
```

**Two modes:**

**Mode 1 — Manual entry:**
- List of shift rows, each with: employee, date, start time, end time, title
- "Add Another Shift" button to add rows (up to 50)
- "Remove" button on each row
- Submit all at once

**Mode 2 — Recurring pattern:**
- Toggle: "Same time for all shifts"
- When enabled: single start time and end time fields
- Date picker: multi-date selection (select multiple dates)
- Employee selector: multi-select (select multiple employees)
- Preview count: "Will create X shifts" (dates x employees)
- Generates the shift array from the combination

**Submit:** POST `/time-clock/shifts/bulk`
```json
{
  "shifts": [
    { "employee_id": "uuid1", "scheduled_start": "2026-04-11T08:00:00Z", "scheduled_end": "2026-04-11T16:00:00Z", "title": "AM Shift" },
    { "employee_id": "uuid2", "scheduled_start": "2026-04-11T08:00:00Z", "scheduled_end": "2026-04-11T16:00:00Z", "title": "AM Shift" }
  ]
}
```

**Validation:**
- At least 1 shift required
- Maximum 50 shifts per bulk request
- Each shift must have employee, start, and end
- End must be after start for each shift

**Handle errors:**
- **400 Bad Request**: Validation errors -> show which shifts failed
- **409 Conflict**: Overlapping shifts -> show which shifts conflict

**On success:** `SuccessModal` with count "X shifts created successfully", close modal, refresh list.

---

## Task 6 — Edit Shift Modal

**What:** Build the Edit Shift modal. Same fields as Create, pre-populated with existing values. Also includes status field.

**Fields:** Same as Create Shift, plus:
- **Status**: `Select` with options: scheduled, in_progress, completed, missed, cancelled

**Submit:** PATCH `/time-clock/shifts/{id}`

**Delete from Edit modal:**
- "Delete Shift" button (danger) at bottom of modal
- Only visible if status is `scheduled` or `cancelled`
- Show `DeleteConfirmationModal` on click
- On confirm: DELETE `/time-clock/shifts/{id}`
- Handle errors: **400** if shift cannot be deleted (wrong status) -> `ErrorModal`

---

## Acceptance Criteria

- [ ] All 10 endpoints tested live before any code was written
- [ ] Employee-Project Assignments: list assignments filtered by employee or project
- [ ] Employee-Project Assignments: "Assign Employee" modal with employee + project selectors
- [ ] Employee-Project Assignments: remove assignment with ConfirmModal
- [ ] Employee-Project Assignments: handles 409 duplicate assignment
- [ ] Shifts Admin: paginated list with filters (employee, project, date range, status)
- [ ] Shifts Admin: status badges with correct colors (scheduled=blue, completed=green, missed=red, cancelled=gray)
- [ ] Create Shift: modal with all fields, validates end > start
- [ ] Bulk Create: manual entry mode with add/remove rows (up to 50)
- [ ] Bulk Create: recurring pattern mode generates shifts from dates x employees
- [ ] Bulk Create: preview count shows before submission
- [ ] Edit Shift: pre-populated modal, updates via PATCH
- [ ] Delete Shift: only allowed on scheduled/cancelled, uses DeleteConfirmationModal
- [ ] Mobile responsive (375px viewport)
- [ ] Loading spinners on all async operations
- [ ] No `window.alert`, `window.confirm`, or `window.prompt` used
- [ ] Uses existing UI components — no new UI primitives created
- [ ] All new components in `app/src/components/time-clock/`
- [ ] Dev server shut down before marking complete

---

## Gate Marker

**STOP** — Assignment CRUD and Shift CRUD (including bulk create) must work before Sprint 8 begins. Confirm:
1. Assignments can be listed, created, and removed
2. Shifts can be listed with all filters working
3. Single shift create works with all fields
4. Bulk shift create works in both modes (manual + recurring)
5. Shift edit and delete work with correct status restrictions

---

## Handoff Notes

**For Sprint 8 (My Shifts — Employee View):**
- The Shifts Admin page is built at `/workforce/shifts`
- Shift status badge styling is established (use same Badge variants)
- The shift card layout pattern can be reused for the My Shifts page
- `GET /time-clock/shifts/mine` endpoint was tested in this sprint
