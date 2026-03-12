# Sprint 40a — Frontend: Financial Cost Entry UI

## Sprint Goal
Build the financial cost entry UI within the project detail page: cost entry table with CRUD, category dropdown, currency masked input, and project cost summary card.

## Phase
FRONTEND

## Module
Project Management + Financial

## Gate Status
NONE

## Prerequisites
- Sprint 28-30 backend complete (financial integration endpoints)
- Sprint 27 backend complete (Gate 3 financial services)
- Sprint 37b must be complete (Project Detail page with Financial tab)
- API docs: financial_gate1_REST_API.md

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

**Acceptance Criteria**:
- [ ] Cost entry table with CRUD
- [ ] Category dropdown from financial categories
- [ ] Currency masked input for amounts
- [ ] Filter by category, date range, has receipt
- [ ] Project cost summary card with totals by category
- [ ] Mobile responsive
- [ ] Connected to real API

**Files Expected**: Financial components, API client functions
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Cost entry CRUD working
- [ ] Currency formatting and masked inputs
- [ ] Cost summary card
- [ ] Mobile responsive
- [ ] Connected to real API

## Gate Marker
NONE

## Handoff Notes
- Financial UI within project detail page (Financial tab)
- Sprint 40b (Receipt + Crew Hours) follows
