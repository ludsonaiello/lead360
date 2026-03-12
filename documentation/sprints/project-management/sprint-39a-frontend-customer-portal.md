# Sprint 39a — Frontend: Customer Portal Pages

## Sprint Goal
Build the customer portal UI (public-facing project view): login page with password change flow, project list, and project detail with public logs and photos.

## Phase
FRONTEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 32 backend complete (portal API endpoints)
- API docs: portal_api_REST_API.md

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

**Acceptance Criteria**:
- [ ] Portal login with password change flow
- [ ] Portal project list
- [ ] Portal project detail with status and progress
- [ ] Public logs and photos in portal
- [ ] Customer-facing design (distinct from admin UI)
- [ ] Mobile responsive

**Files Expected**: Portal pages, API client functions
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Customer portal operational
- [ ] Login with password change flow
- [ ] Project list and detail views
- [ ] Mobile responsive
- [ ] Connected to real API

## Gate Marker
NONE

## Handoff Notes
- Portal is served at `/public/{customer_slug}/`. The Next.js route must be `app/public/[customerSlug]/page.tsx`. Do not use `/portal/` as the base path.
- Customer portal URL structure: `https://{tenant_subdomain}.lead360.app/public/{customer_slug}/`
- Sprint 39b (Completion Checklist) follows
