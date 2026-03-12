# Sprint 38a — Frontend: Task Management UI

## Sprint Goal
Build the task management UI within the project detail page: task CRUD with status transitions, drag-to-reorder, assignment management with autocomplete, and dependency visualization.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 13-15 backend complete (task CRUD, dependencies, assignments)
- Sprint 37b must be complete (Project Detail page with tab structure)
- API docs: project_task_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`

## Tasks

### Task 38.1 — Task Management UI
**Type**: Frontend Component
**Complexity**: High

**Within project detail page** (tab or section):
- Task list ordered by order_index with drag-to-reorder
- Task cards showing: title, status badge, assignees (avatars), dates, is_delayed flag (red indicator)
- Status change: dropdown or kanban-style columns (not_started, in_progress, blocked, done)
- Status transition validation (show warning if dependencies block)
- Create task form: title, description, dates, category, order
- Task detail panel/modal: full info, assignees, dependencies, calendar events, costs, receipts
- Assignment management: add/remove crew/subcontractor/user with autocomplete
- Dependency management: add dependency with type selector, visual dependency indicators
- SMS from task button: opens SMS compose with pre-filled context
- Calendar event creation from task

**Acceptance Criteria**:
- [ ] Task CRUD with status transitions
- [ ] Drag-to-reorder tasks
- [ ] Assignment management with autocomplete
- [ ] Dependency add/remove with validation
- [ ] Task detail panel/modal
- [ ] SMS from task button
- [ ] Calendar event creation
- [ ] Mobile responsive

**Files Expected**: Task components, API client functions
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Task management fully operational
- [ ] Status transitions with dependency validation
- [ ] Mobile responsive
- [ ] Connected to real API

## Gate Marker
NONE

## Handoff Notes
- Tasks displayed within project detail page (Tasks tab)
- Sprint 38b (Logs + Photos) follows
