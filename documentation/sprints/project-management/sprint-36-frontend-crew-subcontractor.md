# Sprint 36 — Frontend: Crew Register + Subcontractor Register UI

## Sprint Goal
Build production-ready crew member and subcontractor management pages with modern UI: list views with search/filter, detail views with masked sensitive fields, profile photo upload, document management, and compliance status indicators.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 02 must be complete (Backend: crew member API operational)
- Sprint 04 must be complete (Backend: subcontractor API operational)
- All backend API documentation files must exist:
  - api/documentation/crew_member_REST_API.md
  - api/documentation/subcontractor_REST_API.md

## Codebase Reference
- Frontend app: `/var/www/lead360.app/app/`
- API base: use environment variable (never hardcode)
- Follow existing page patterns in the app

## Tasks

### Task 36.1 — Crew Member Pages
**Type**: Frontend Page + Component
**Complexity**: High

**Pages to create**:
1. `/crew` — Crew member list page
   - Search bar (first_name, last_name, email, phone)
   - Filter: is_active (Active/Inactive/All)
   - Table/card view with columns: Name, Phone, Email, Hourly Rate, Status (active/inactive badge)
   - Profile photo thumbnail
   - Pagination
   - "Add Crew Member" button → opens create form

2. `/crew/[id]` — Crew member detail page
   - Profile header with photo, name, contact info
   - Masked sensitive fields: SSN (***-**-1234), bank info (****1234), DL (****5678)
   - "Reveal" buttons next to masked fields → calls reveal endpoint, shows value for 10 seconds then re-masks
   - Reveal requires confirmation modal: "This action is logged. Continue?"
   - Tabs: Profile, Payment Info, Hours (future), Payments (future)
   - Edit button → opens edit form/modal

3. Create/Edit form (modal or separate page):
   - Multi-section: Personal Info, Address, Sensitive Data (SSN/ITIN/DL), Payment Info, Employment
   - Masked inputs for SSN (XXX-XX-XXXX format), phone
   - Address with state dropdown (US states)
   - Payment method selector with conditional fields (bank fields for bank_transfer, venmo handle for venmo, etc.)
   - Profile photo upload (drag & drop or click)
   - Form validation matching backend rules

**UI Requirements**:
- Mobile responsive (multi-step form on mobile)
- Loading spinners on all async operations
- Success/error toast notifications
- Confirmation modal for sensitive field reveal
- Confirmation modal for deactivation (soft delete)

**Acceptance Criteria**:
- [ ] List page with search, filter, pagination
- [ ] Detail page with masked sensitive fields
- [ ] Reveal functionality with audit confirmation
- [ ] Create/edit form with validation
- [ ] Profile photo upload
- [ ] Mobile responsive

**Files Expected**: Pages, components, API client functions
**Blocker**: NONE

---

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
- [ ] Crew member UI: list, detail, create, edit, reveal, photo upload
- [ ] Subcontractor UI: list, detail, contacts, documents, compliance
- [ ] All pages mobile responsive
- [ ] Loading/error states handled
- [ ] Connected to real API endpoints

## Gate Marker
NONE

## Handoff Notes
- Crew pages at /crew and /crew/[id]
- Subcontractor pages at /subcontractors and /subcontractors/[id]
