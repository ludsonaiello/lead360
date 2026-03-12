# Sprint 40b — Frontend: Receipt Capture UI + Crew Hour Logging UI

## Sprint Goal
Build the receipt capture UI with camera/upload support and the crew hour logging UI with autocomplete and hours table.

## Phase
FRONTEND

## Module
Project Management + Financial

## Gate Status
NONE

## Prerequisites
- Sprint 40a must be complete (Financial Cost Entry UI)
- Sprint 28-30 backend complete (financial integration endpoints)
- API docs: receipt_REST_API.md, financial_gate1_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`

## Tasks

### Task 40.2 — Receipt Capture UI
**Type**: Frontend Component
**Complexity**: Medium

**Receipt upload**:
- Drag & drop zone or camera capture (mobile)
- Preview thumbnail after upload
- Fields: vendor name, amount, date (pre-fill from OCR in Phase 2 — manual entry now)
- Link receipt to existing cost entry (dropdown selector)
- Receipt gallery within project/task context

### Task 40.3 — Crew Hour Logging UI
**Type**: Frontend Component
**Complexity**: Medium

**Within task detail or dedicated section**:
- Log hours form: crew member (autocomplete from assigned crew), date, regular hours, overtime hours, notes
- Hours table: crew member, date, regular, overtime, total
- Crew member profile page: hours summary across projects, payment history

**Acceptance Criteria**:
- [ ] Receipt upload with drag & drop
- [ ] Camera capture on mobile
- [ ] Receipt preview thumbnail
- [ ] Link receipt to cost entry
- [ ] Crew hour logging form with autocomplete
- [ ] Hours table display
- [ ] Mobile responsive

**Files Expected**: Receipt components, hour logging components, API client functions
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Receipt upload with camera support on mobile
- [ ] Crew hour logging from task context
- [ ] Mobile responsive
- [ ] Connected to real API

## Gate Marker
NONE

## Handoff Notes
- Receipts support camera capture on mobile
- Hours logged per crew member per task
- Sprint 40c (Invoice + Financial Summary) follows
