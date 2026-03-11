# Sprint 40 — Frontend: Financial Cost Entry + Receipt Capture + Crew Hours

## Sprint Goal
Build the financial management UI within project context: cost entry forms, receipt capture with camera/upload, crew hour logging, subcontractor invoice management, and financial summary displays.

## Phase
FRONTEND

## Module
Project Management + Financial

## Gate Status
NONE

## Prerequisites
- Sprint 28-30 backend complete (financial integration endpoints)
- Sprint 27 backend complete (Gate 3 financial services)
- API docs: financial_gate1_REST_API.md, receipt_REST_API.md, financial_gate3_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`

## Tasks

### Task 40.1 — Financial Cost Entry UI
**Type**: Frontend Component
**Complexity**: High

**Within project detail page** (Financial tab):
- Cost entry table: date, category, amount, vendor, notes, receipt indicator
- Add cost entry form: category dropdown (from financial categories), amount (currency masked input), date, vendor name, notes, optional task selection
- Edit/delete cost entries
- Filter: by category, date range, has receipt
- Project cost summary card: total by category (labor, material, subcontractor, equipment, other), total actual cost, contract value, margin

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

### Task 40.4 — Subcontractor Invoice UI
**Type**: Frontend Component
**Complexity**: Medium

**Within task detail or subcontractor profile**:
- Create invoice: amount, invoice number, date, notes, file upload (PDF)
- Invoice list with status badges (pending: yellow, approved: blue, paid: green)
- Status change buttons with confirmation
- Payment recording form
- Subcontractor profile: payment summary, invoice history

### Task 40.5 — Financial Summary Widgets
**Type**: Frontend Component
**Complexity**: Medium

**Dashboard and project detail**:
- Cost breakdown pie chart (by category)
- Contract value vs. actual cost bar chart
- Margin indicator (green if positive, red if negative)
- Crew payment summary widget
- Subcontractor payment summary widget

**Acceptance Criteria**:
- [ ] Cost entry CRUD working
- [ ] Receipt upload with camera support on mobile
- [ ] Crew hour logging from task context
- [ ] Invoice management with status workflow
- [ ] Financial summary charts and widgets
- [ ] Currency formatting and masked inputs
- [ ] Mobile responsive

**Files Expected**: Financial components, receipt components, hour logging components, invoice components, chart components
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] All financial UI components operational
- [ ] Connected to real API endpoints
- [ ] Mobile responsive with camera receipt capture
- [ ] Charts and summary widgets rendering
- [ ] ALL 40 SPRINTS COMPLETE

## Gate Marker
STOP — ALL SPRINTS COMPLETE. Full Project Management + Financial (Project-Scoped) module delivered across 40 sprints (35 backend + 5 frontend).

## Handoff Notes
- Financial UI within project detail page
- Receipts support camera capture on mobile
- Charts use real financial data
- ENTIRE MODULE COMPLETE — ready for integration testing and production deployment
