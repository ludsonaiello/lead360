# Sprint 38b — Frontend: Project Log UI + Photo Timeline UI

## Sprint Goal
Build the project log creation system with file attachments and the photo progress timeline with batch upload, both within the project detail page.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 38a must be complete (Task Management UI)
- Sprint 17-19 backend complete (logs, photos)
- API docs: project_log_REST_API.md, project_files_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`

## Tasks

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
- [ ] Log creation with file attachments
- [ ] Log feed with filtering
- [ ] Delete with confirmation (Owner/Admin)
- [ ] Photo timeline with batch upload
- [ ] Photo lightbox/fullscreen view
- [ ] Photo filters and caption editing
- [ ] All mobile responsive

**Files Expected**: Log components, photo components, API client functions
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Log system with attachments
- [ ] Photo timeline with filters
- [ ] Mobile responsive
- [ ] Connected to real API

## Gate Marker
NONE

## Handoff Notes
- Logs in dedicated tab within project detail
- Photos with timeline grouping by date
- Sprint 38 (Tasks + Logs + Photos) is now complete after this sub-sprint
