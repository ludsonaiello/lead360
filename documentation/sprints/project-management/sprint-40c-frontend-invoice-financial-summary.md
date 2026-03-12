# Sprint 40c — Frontend: Subcontractor Invoice UI + Financial Summary Widgets

## Sprint Goal
Build the subcontractor invoice management UI with status workflow and the financial summary widgets with charts for the project dashboard and detail pages.

## Phase
FRONTEND

## Module
Project Management + Financial

## Gate Status
NONE

## Prerequisites
- Sprint 40b must be complete (Receipt + Crew Hours UI)
- Sprint 27 backend complete (Gate 3 financial services)
- API docs: financial_gate3_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`

## Tasks

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
- [ ] Invoice CRUD with status badges
- [ ] Status change with confirmation
- [ ] Payment recording form
- [ ] Cost breakdown pie chart
- [ ] Contract vs. actual cost bar chart
- [ ] Margin indicator with color coding
- [ ] Crew and subcontractor payment summaries
- [ ] Mobile responsive

**Files Expected**: Invoice components, chart components, summary widgets, API client functions
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Invoice management with status workflow
- [ ] Financial summary charts and widgets
- [ ] Mobile responsive
- [ ] Connected to real API
- [ ] ALL 40 SPRINTS COMPLETE

## Gate Marker
STOP — ALL SPRINTS COMPLETE. Full Project Management + Financial (Project-Scoped) module delivered across 40 sprints (35 backend + 5 frontend, split into 14 sub-sprints for AI agent efficiency).

## Handoff Notes
- Financial UI within project detail page
- Charts use real financial data
- ENTIRE MODULE COMPLETE — ready for integration testing and production deployment
