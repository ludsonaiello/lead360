# Sprint 37c — Frontend: Gantt Chart View

## Sprint Goal
Build the Gantt chart visualization for project tasks with dependency arrows, color coding, and zoom controls using the frappe-gantt library.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 37b must be complete (Project Detail page with tab structure)
- Sprint 35 must be complete (Backend: Gantt data endpoints exist)
- API docs: gantt_data_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`

## Tasks

### Task 37.4 — Gantt Chart View
**Type**: Frontend Component
**Complexity**: High

**Pages**: `/projects/[id]/gantt` and `/projects/dashboard/gantt`

Use `frappe-gantt`. This is the selected library. MIT license, lightweight, no commercial restrictions. Install: `npm install frappe-gantt`. Import: `import Gantt from 'frappe-gantt'`. Do not evaluate other libraries — this decision is final.
- Tasks as horizontal bars with estimated and actual date ranges
- Dependency arrows between tasks
- Color coding: green (done), blue (in_progress), yellow (blocked), red (delayed), gray (not_started)
- Assignee avatars/names on bars
- Click task bar → navigate to task detail
- Zoom: day/week/month views
- Multi-project view: one row per project with progress bar

**Acceptance Criteria**:
- [ ] Gantt chart rendering with task bars
- [ ] Dependency arrows between tasks
- [ ] Color coding by status
- [ ] Zoom controls (day/week/month)
- [ ] Click task → navigate to detail
- [ ] Multi-project Gantt view
- [ ] Mobile responsive
- [ ] Connected to real API

**Files Expected**: Gantt component, API client
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Gantt visualization working
- [ ] Dependencies and color coding
- [ ] Mobile responsive
- [ ] Connected to real API

## Gate Marker
NONE

## Handoff Notes
- Gantt at /projects/[id]/gantt and /projects/dashboard/gantt
- Sprint 37 (Project Views) is now complete after this sub-sprint
