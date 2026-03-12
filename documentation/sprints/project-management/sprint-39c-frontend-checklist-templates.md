# Sprint 39c — Frontend: Checklist Template Settings

## Sprint Goal
Build the checklist template settings page: template CRUD with sortable items, active/inactive toggle, and drag-to-reorder item management.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 39b must be complete (Completion Checklist UI)
- Sprint 25 backend complete (checklist templates)
- API docs: checklist_template_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`

## Tasks

### Task 39.3 — Checklist Template Settings
**Type**: Frontend Page
**Complexity**: Medium

**Page**: `/settings/checklist-templates`
- List of templates with active/inactive toggle
- Create template form: name, description, items (sortable list with drag-to-reorder)
- Each item: title, description, required toggle, order
- Edit template: update items (add/remove/reorder)
- Delete template with confirmation

**Acceptance Criteria**:
- [ ] Template list with active/inactive toggle
- [ ] Create template with sortable items
- [ ] Edit template (add/remove/reorder items)
- [ ] Delete template with confirmation
- [ ] Mobile responsive

**Files Expected**: Settings pages, template components, API client functions
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Template settings CRUD
- [ ] Sortable items with drag-to-reorder
- [ ] Mobile responsive
- [ ] Connected to real API

## Gate Marker
NONE

## Handoff Notes
- Settings at /settings/checklist-templates
- Sprint 39 (Portal + Checklist + Templates) is now complete after this sub-sprint
