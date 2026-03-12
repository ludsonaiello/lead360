# Sprint 37a — Frontend: Project Dashboard + Project List Page

## Sprint Goal
Build the project management hub entry points: dashboard with status overview cards and alerts, and project list with filters and pagination.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 35 must be complete (Backend: all project and Gantt endpoints exist)
- API docs: project_REST_API.md, project_dashboard_REST_API.md

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

**Acceptance Criteria**:
- [ ] Dashboard with status cards and counts
- [ ] Delayed tasks alert banner
- [ ] Upcoming deadlines widget
- [ ] Project list with filters and pagination
- [ ] Dashboard/list view toggle
- [ ] Mobile responsive
- [ ] Connected to real API

**Files Expected**: Pages, components, API client
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Project dashboard operational
- [ ] Project list with search/filter
- [ ] Mobile responsive
- [ ] Connected to real API

## Gate Marker
NONE

## Handoff Notes
- Dashboard at /projects
- Sprint 37b (Project Detail) follows and builds on the project page structure
