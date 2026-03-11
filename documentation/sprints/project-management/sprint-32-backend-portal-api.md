# Sprint 32 — Customer Portal API Endpoints

## Sprint Goal
Deliver portal-facing API endpoints for project list, project detail, public logs, and public photos — all scoped to the authenticated customer and returning only public data.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 31 must be complete (reason: PortalAuthGuard and portal JWT exist)
- Sprint 17 must be complete (reason: project logs exist)
- Sprint 09 must be complete (reason: project photos exist)

## Codebase Reference
- PortalAuthGuard from Sprint 31
- ProjectService, ProjectLogService, ProjectPhotoService

## Tasks

### Task 32.1 — PortalProjectService + Controller + Tests + Docs
**Type**: Service + Controller + Test + Documentation
**Complexity**: High

**PortalProjectService methods** (separate service for portal — never exposes internal data):
1. **listProjects(tenantId, leadId)** — Return all projects where lead_id matches and portal_enabled=true. Return only: id, project_number, name, status, start_date, target_completion_date, progress_percent.
2. **getProjectDetail(tenantId, leadId, projectId)** — Validate project belongs to lead. Return: basic project info + task titles/statuses (no notes, no costs, no crew) + permit statuses.
3. **getPublicLogs(tenantId, projectId, leadId, query: { page?, limit? })** — WHERE: is_public=true. Return log content, date, author name. Include public attachments. NEVER return private logs.
4. **getPublicPhotos(tenantId, projectId, leadId, query: { page?, limit? })** — WHERE: is_public=true. Return photos with URLs. NEVER return private photos.

**Controller** — `@Controller('api/v1/portal')`:
All endpoints use PortalAuthGuard (not JwtAuthGuard).
| Method | Path | Auth |
|--------|------|------|
| GET | /portal/:customerSlug/projects | Portal token |
| GET | /portal/:customerSlug/projects/:id | Portal token |
| GET | /portal/:customerSlug/projects/:id/logs | Portal token |
| GET | /portal/:customerSlug/projects/:id/photos | Portal token |

**Validation**: Every request validates that customerSlug matches the portal token's customer_slug. If mismatch → 403.

**Project list response** (portal):
```json
{
  "data": [
    {
      "id": "uuid",
      "project_number": "PRJ-2026-0001",
      "name": "Kitchen Remodel",
      "status": "in_progress",
      "start_date": "2026-04-01",
      "target_completion_date": "2026-06-15",
      "progress_percent": 45.00
    }
  ],
  "meta": { "total": 2, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**Portal NEVER returns**: cost data, crew details, financial entries, internal notes, subcontractor data, margins, private logs, private photos.

**File URLs**: Return /public/{tenant_id}/... paths — Nginx serves directly.

Unit tests, integration tests, REST docs at `api/documentation/portal_api_REST_API.md`.

**Acceptance Criteria**:
- [ ] Portal project list returns only portal-enabled projects for the customer
- [ ] Portal detail returns sanitized data (no costs/crew/notes)
- [ ] Public logs only (is_public=true)
- [ ] Public photos only (is_public=true)
- [ ] Slug validation on every request
- [ ] Tests and docs complete

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Portal API endpoints operational
- [ ] Data properly sanitized (no internal data exposed)
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Portal endpoints at /api/v1/portal/:customerSlug/
- Uses PortalAuthGuard (separate from staff JWT)
- Never exposes financial, crew, or private data
