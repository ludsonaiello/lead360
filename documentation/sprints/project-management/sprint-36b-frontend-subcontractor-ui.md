# Sprint 36b — Frontend: Subcontractor Register UI

## Sprint Goal
Build production-ready subcontractor management pages with modern UI: list view with compliance filtering, detail view with contacts and documents management, payment info with masked fields, and create/edit forms.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 36a must be complete (Crew Member UI — establishes entity management page patterns)
- Sprint 04 must be complete (Backend: subcontractor API operational)
- All backend API documentation files must exist:
  - api/documentation/subcontractor_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`
- API base: use environment variable (never hardcode)
- Follow existing page patterns in the app

## Tasks

### Task 36.2 — Subcontractor Pages
**Type**: Frontend Page + Component
**Complexity**: High

**Pages to create**:
1. `/subcontractors` — Subcontractor list page
   - Search (business_name, trade_specialty, email)
   - Filter: compliance_status (Valid/Expiring/Expired/Unknown), is_active
   - Compliance status badges: green (valid), yellow (expiring_soon), red (expired), gray (unknown)
   - Pagination

2. `/subcontractors/[id]` — Subcontractor detail page
   - Business info header with compliance badge
   - Contacts section (add/remove contacts, primary flag)
   - Documents section (upload with type selector, list with download links)
   - Payment info with masked bank fields and reveal buttons
   - Tabs: Profile, Contacts, Documents, Compliance, Invoices (future), Payments (future)

3. Create/Edit form:
   - Business info, insurance info, payment info
   - Compliance computed from insurance expiry (read-only display)
   - Document upload with type dropdown

**UI Requirements**:
- Compliance status prominently displayed with color coding
- Insurance expiry date with visual countdown if <30 days
- Document type icons (PDF, image, etc.)
- Mobile responsive

**Acceptance Criteria**:
- [ ] List with compliance filtering
- [ ] Detail with contacts and documents
- [ ] Document upload with type selection
- [ ] Compliance badges with color coding
- [ ] Mobile responsive

**Files Expected**: Pages, components, API client functions
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Subcontractor UI: list, detail, contacts, documents, compliance
- [ ] All pages mobile responsive
- [ ] Loading/error states handled
- [ ] Connected to real API endpoints

## Gate Marker
NONE

## Handoff Notes
- Subcontractor pages at /subcontractors and /subcontractors/[id]
- Sprint 36 (Crew + Subcontractor UI) is now complete after this sub-sprint
