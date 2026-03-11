# Sprint 22 — Permit Tracking

## Sprint Goal
Deliver the `permit` entity with full lifecycle management (applied → approved → active → closed), status transitions, and document upload support.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 08 must be complete (reason: project exists)

## Codebase Reference
- Module path: `api/src/modules/projects/`

## Tasks

### Task 22.1 — Add permit model to Prisma schema + migration
**Type**: Schema + Migration
**Complexity**: Medium

**Enum**:
```
enum permit_status {
  not_required
  pending_application
  submitted
  approved
  active
  failed
  closed
}
```

**Field Table — permit**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| permit_number | String? @db.VarChar(100) | yes | null | |
| permit_type | String @db.VarChar(200) | no | — | e.g. Building, Electrical, Plumbing |
| status | permit_status | no | pending_application | @default(pending_application) |
| submitted_date | DateTime? @db.Date | yes | null | |
| approved_date | DateTime? @db.Date | yes | null | |
| expiry_date | DateTime? @db.Date | yes | null | |
| issuing_authority | String? @db.VarChar(200) | yes | null | |
| notes | String? @db.Text | yes | null | |
| created_at | DateTime | no | @default(now()) | |
| updated_at | DateTime | no | @updatedAt | |

**Indexes**: @@index([tenant_id, project_id]), @@index([tenant_id, status])
**Map**: @@map("permit")

Run migration.

**Acceptance Criteria**: Model added, migration applied
**Files Expected**: api/prisma/schema.prisma (modified), migration
**Blocker**: NONE

---

### Task 22.2 — PermitService + Controller + Tests + Docs
**Type**: Service + Controller + Test + Documentation
**Complexity**: Medium

**PermitService methods**:
1. **create(tenantId, projectId, userId, dto)** — Create permit. Audit log.
2. **findAll(tenantId, projectId, query: { status? })** — List permits for project.
3. **update(tenantId, projectId, permitId, userId, dto)** — Update permit. Auto-set approved_date when status → approved. Audit log.

**Controller**:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/permits | Owner, Admin, Manager |
| GET | /projects/:projectId/permits | Owner, Admin, Manager |
| PATCH | /projects/:projectId/permits/:id | Owner, Admin, Manager |

**Permit response**:
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "permit_number": "BP-2026-0001",
  "permit_type": "Building",
  "status": "approved",
  "submitted_date": "2026-03-01",
  "approved_date": "2026-03-15",
  "expiry_date": "2027-03-15",
  "issuing_authority": "City of Boston",
  "notes": null,
  "inspections": [],
  "created_at": "2026-03-01T10:00:00.000Z"
}
```

**Business Rules**:
- One project can have multiple permits
- Status transitions: pending_application → submitted → approved → active → closed (or failed at any point)
- Auto-set approved_date when moving to 'approved'
- All queries include where: { tenant_id, project_id }

Unit tests, integration tests, REST docs at `api/documentation/permit_REST_API.md`.

**Files Expected**: DTOs, service, controller, tests, docs
**Blocker**: Task 22.1

---

## Sprint Acceptance Criteria
- [ ] Permit CRUD operational
- [ ] Status transitions enforced
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Permits at /api/v1/projects/:projectId/permits
- Inspections will be added in Sprint 23 (linked via permit_id)
