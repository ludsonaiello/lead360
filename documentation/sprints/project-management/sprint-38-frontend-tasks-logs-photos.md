# Sprint 38 — Frontend: Task Management + Log System + Photo Timeline

## Sprint Goal
Build task management UI with status transitions, dependency visualization, assignment management, plus project log creation and photo progress timeline.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 13-15 backend complete (task CRUD, dependencies, assignments)
- Sprint 17-19 backend complete (logs, photos)
- API docs: project_task_REST_API.md, project_log_REST_API.md, project_files_REST_API.md

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

### Task 38.2 — Project Log UI
**Type**: Frontend Component
**Complexity**: Medium

**Within project detail page** (Logs tab):
- Log feed sorted by date (newest first)
- Create log form: content (rich text editor), date picker, public/private toggle, weather delay checkbox, file attachments (multiple)
- Log card: date, author, content, public badge, attachments (thumbnails for images, icons for PDFs)
- Filter: public/private, date range, has attachments
- Delete button (Owner/Admin only) with confirmation

### Task 38.3 — Photo Timeline UI
**Type**: Frontend Component
**Complexity**: Medium

**Within project detail page** (Photos tab):
- Timeline view grouped by date
- Photo grid/masonry layout with thumbnails
- Click photo → lightbox/fullscreen view
- Upload: single or batch (drag & drop zone)
- Filters: by task, by date, public/private
- Caption editing
- Public/private toggle per photo

**Acceptance Criteria**:
- [ ] Task CRUD with status transitions
- [ ] Drag-to-reorder tasks
- [ ] Assignment management with autocomplete
- [ ] Dependency add/remove with validation
- [ ] Log creation with file attachments
- [ ] Photo timeline with batch upload
- [ ] All mobile responsive

**Files Expected**: Task components, log components, photo components
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Task management fully operational
- [ ] Log system with attachments
- [ ] Photo timeline with filters
- [ ] Mobile responsive

## Gate Marker
NONE

## Handoff Notes
- Tasks displayed within project detail page
- Logs in dedicated tab
- Photos with timeline grouping by date
