# Sprint 37b — Frontend: Project Detail Page

## Sprint Goal
Build the project detail page with tabbed navigation showing overview, key dates, financial summary, and status management within the project context.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 37a must be complete (Dashboard + List pages establish project page structure)
- Sprint 35 must be complete (Backend: all project endpoints exist)
- API docs: project_REST_API.md, project_dashboard_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`

## Tasks

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

**Acceptance Criteria**:
- [ ] Project detail page with header and status badge
- [ ] Tabbed navigation (Overview, Tasks, Documents, Photos, Logs, Permits, Financial, Completion)
- [ ] Overview tab with key dates and financial summary
- [ ] Status change with confirmation modal
- [ ] Edit project details
- [ ] Mobile responsive
- [ ] Connected to real API

**Files Expected**: Pages, components, API client
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Project detail with tabs
- [ ] Status management working
- [ ] Mobile responsive
- [ ] Connected to real API

## Gate Marker
NONE

## Handoff Notes
- Detail at /projects/[id]
- Tab content (Tasks, Documents, Photos, Logs, etc.) will be populated by subsequent sprints (38, 39, 40)
- Sprint 37c (Gantt View) follows
