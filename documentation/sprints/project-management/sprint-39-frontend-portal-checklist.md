# Sprint 39 — Frontend: Customer Portal + Completion Checklist + Settings

## Sprint Goal
Build the customer portal UI (public-facing project view), completion checklist management within projects, and checklist template settings page.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 32 backend complete (portal API endpoints)
- Sprint 26 backend complete (completion checklist)
- Sprint 25 backend complete (checklist templates)
- API docs: portal_api_REST_API.md, project_completion_REST_API.md, checklist_template_REST_API.md

## Codebase Reference
- Portal pages: may be at a different route or subdomain
- Frontend app: `/var/www/lead360.app/app/`

## Tasks

### Task 39.1 — Customer Portal Pages
**Type**: Frontend Page
**Complexity**: High

**Portal Login Page** (public):
- Email + password form
- Forgot password link → reset flow
- Branded with tenant logo and colors
- Force password change on first login

**Portal Project List**:
- Simple card layout: project name, status, progress bar
- Clean, customer-friendly design

**Portal Project Detail**:
- Project status and progress
- Task list (titles and statuses only — no internal notes)
- Permit status badges
- Schedule dates (start, target completion)
- Public logs section (content and photos only)
- Public photo gallery

**Design**: Clean, professional, customer-facing. Distinct from the admin UI. Mobile-first.

### Task 39.2 — Completion Checklist UI
**Type**: Frontend Component
**Complexity**: Medium

**Within project detail page** (Completion tab):
- Start completion button → select template from dropdown → creates checklist
- Checklist items with checkboxes
- Required items marked with asterisk
- Item completion: check → records timestamp and user
- Notes field per item
- Add manual item button
- Punch list section: add/resolve punch items, status badges
- "Complete Project" button → validates all required items + punch list → confirms

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
- [ ] Portal login with password change flow
- [ ] Portal project list and detail
- [ ] Public logs and photos in portal
- [ ] Completion checklist with item tracking
- [ ] Punch list management
- [ ] Template settings CRUD
- [ ] Mobile responsive

**Files Expected**: Portal pages, checklist components, settings pages
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Customer portal operational
- [ ] Completion flow working end-to-end
- [ ] Settings page for templates
- [ ] Mobile responsive

## Gate Marker
NONE

## Handoff Notes
- Portal at /portal/ route (or subdomain)
- Checklist within project detail
- Settings at /settings/checklist-templates
