# Sprint 37 — Frontend: Project List + Dashboard + Detail + Gantt View

## Sprint Goal
Build the project management hub: dashboard with status overview, project list with filters, project detail page with tabs, and Gantt chart visualization.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 35 must be complete (Backend: all project and Gantt endpoints exist)
- API docs: project_REST_API.md, project_dashboard_REST_API.md, gantt_data_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`

## Tasks

### Task 37.1 — Project Dashboard Page
**Type**: Frontend Page
**Complexity**: High

**Page**: `/projects` or `/projects/dashboard`
- Status cards: Total, Active, Planned, On Hold, Completed, Canceled (with counts)
- Delayed tasks alert banner (count of delayed tasks across all projects)
- Upcoming deadlines widget (next 7 days)
- Recent activity feed
- Quick filters: by status, by PM
- Link to Gantt view

### Task 37.2 — Project List Page
**Type**: Frontend Page
**Complexity**: Medium

**Page**: `/projects` (toggle between dashboard and list views)
- Table view with columns: Project #, Name, Status (badge), PM, Start Date, Target Date, Progress (bar), Tasks
- Search (name, project number)
- Filter: status, PM, date range
- Pagination
- "New Project" button → create modal/page

### Task 37.3 — Project Detail Page
**Type**: Frontend Page
**Complexity**: High

**Page**: `/projects/[id]`
- Header: Project name, number, status badge, progress bar, contract value
- Tabs: Overview, Tasks, Documents, Photos, Logs, Permits, Financial, Completion
- Overview tab: key dates, PM assignment, financial summary widget, recent activity
- Financial summary card: contract_value, total_actual_cost, margin
- Status change dropdown (with confirmation)
- Edit project details (modal/inline)

### Task 37.4 — Gantt Chart View
**Type**: Frontend Component
**Complexity**: High

**Pages**: `/projects/[id]/gantt` and `/projects/dashboard/gantt`

Use a React Gantt chart library (e.g., frappe-gantt, dhtmlx-gantt, or custom SVG):
- Tasks as horizontal bars with estimated and actual date ranges
- Dependency arrows between tasks
- Color coding: green (done), blue (in_progress), yellow (blocked), red (delayed), gray (not_started)
- Assignee avatars/names on bars
- Click task bar → navigate to task detail
- Zoom: day/week/month views
- Multi-project view: one row per project with progress bar

**Acceptance Criteria**:
- [ ] Dashboard with status cards and counts
- [ ] Project list with filters and pagination
- [ ] Project detail with tabs
- [ ] Gantt chart with dependencies and color coding
- [ ] Mobile responsive

**Files Expected**: Pages, components, Gantt component, API client
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Project dashboard operational
- [ ] Project list with search/filter
- [ ] Project detail with tabs
- [ ] Gantt visualization working
- [ ] Mobile responsive
- [ ] Connected to real API

## Gate Marker
NONE

## Handoff Notes
- Dashboard at /projects
- Detail at /projects/[id]
- Gantt at /projects/[id]/gantt and /projects/dashboard/gantt
