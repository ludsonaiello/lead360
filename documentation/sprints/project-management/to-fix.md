# Project Management — API Gaps to Fix Before Frontend

**Date**: 2026-03-16
**Source**: Documentation audit of `api/documentation/project_management_REST_API.md` vs Sprint 36–40 requirements

---

## Gap 1 — Search Fields Too Limited (Crew & Subcontractor)

**Affected Sprints**: 36a, 36b

**Current API Documentation**:
- `GET /api/v1/crew` — `search` param documented as "Search by name" only
- `GET /api/v1/subcontractors` — `search` param documented as "Search business name" only

**Sprint Requirement**:
- Sprint 36a: Crew search by name, email, phone
- Sprint 36b: Subcontractor search by business_name, trade, email

**Action Required**:
1. Verify backend code — the search may already include these fields but the doc omitted them
2. If backend only searches name/business_name, extend the search to cover email, phone (crew) and trade, email (subcontractor)
3. Update API doc §9.2 and §10.2 to reflect actual search fields

---

## Gap 2 — No Per-Project Recent Activity Endpoint

**Affected Sprint**: 37b (Project Detail Page — Overview tab)

**Current API Documentation**:
- `GET /api/v1/projects/dashboard` (§31.1) returns `recent_activity` across ALL projects
- No endpoint exists to get recent activity filtered to a single project

**Sprint Requirement**:
- Project Detail Overview tab needs a "recent activity feed" scoped to that project

**Action Required**:
1. Option A: Add query param `project_id` to the dashboard endpoint's `recent_activity` section
2. Option B: Add a dedicated endpoint `GET /api/v1/projects/:id/activity` returning recent activity for one project
3. Option C: Frontend builds activity from project logs + task status changes (no backend change, but less ideal UX)

---

## Gap 3 — No Crew Payment Summary Aggregate Endpoint

**Affected Sprint**: 40c (Financial Summary Widgets)

**Current API Documentation**:
- Subcontractors have `GET /api/v1/subcontractors/:id/payment-summary` (§29.4) returning `total_invoiced`, `total_paid`, `total_pending`, etc.
- Crew members have `GET /api/v1/crew/:crewMemberId/payment-history` (§27.3) returning a paginated list of individual payments — no aggregate totals

**Sprint Requirement**:
- Crew payment summary widget showing total paid, payment count, etc.

**Action Required**:
1. Add `GET /api/v1/crew/:crewMemberId/payment-summary` returning aggregated totals:
   ```json
   {
     "crew_member_id": "uuid",
     "total_paid": 12500.00,
     "payments_count": 8,
     "total_hours_paid": 320.00,
     "last_payment_date": "2026-04-15"
   }
   ```
2. Update API doc §27 with the new endpoint
