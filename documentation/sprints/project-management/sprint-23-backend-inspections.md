# Sprint 23 — Inspection Lifecycle

## Sprint Goal
Deliver the `inspection` entity linked to permits, with result tracking, reinspection support, and complete CRUD API.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 22 must be complete (reason: permit table must exist)

## Codebase Reference
- permit model from Sprint 22
- Module path: `api/src/modules/projects/`

## Tasks

### Task 23.1 — Add inspection model to Prisma schema + migration
**Type**: Schema + Migration
**Complexity**: Medium

**Enum**:
```
enum inspection_result {
  pass
  fail
  conditional
  pending
}
```

**Field Table — inspection**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| permit_id | String @db.VarChar(36) | no | — | FK → permit |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| inspection_type | String @db.VarChar(200) | no | — | e.g. Framing, Electrical Rough-In, Final |
| scheduled_date | DateTime? @db.Date | yes | null | |
| inspector_name | String? @db.VarChar(200) | yes | null | |
| result | inspection_result? | yes | null | pass, fail, conditional, pending |
| reinspection_required | Boolean | no | false | @default(false) |
| reinspection_date | DateTime? @db.Date | yes | null | |
| notes | String? @db.Text | yes | null | |
| created_at | DateTime | no | @default(now()) | |
| updated_at | DateTime | no | @updatedAt | |

**Indexes**: @@index([tenant_id, permit_id]), @@index([tenant_id, project_id])
**Map**: @@map("inspection")

**Relations**:
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- permit: `permit @relation(fields: [permit_id], references: [id], onDelete: Cascade)`
- project: `project @relation(fields: [project_id], references: [id], onDelete: Cascade)`
- Add reverse relations: `inspections inspection[]` to permit and project models

**Soft Delete**: Add field `deleted_at DateTime?` (yes, null) for soft-delete support.

Run migration.

**Acceptance Criteria**: Model added, migration applied
**Blocker**: NONE

---

### Task 23.2 — InspectionService + Controller + Tests + Docs
**Type**: Service + Controller + Test + Documentation
**Complexity**: Medium

**InspectionService methods**:
1. **create(tenantId, projectId, permitId, userId, dto)** — Create inspection. Validate permit belongs to project and tenant. Audit log.
2. **update(tenantId, projectId, permitId, inspectionId, userId, dto)** — Update inspection result, reinspection fields. If result = 'fail', auto-set reinspection_required = true. Audit log.
3. **findByPermit(tenantId, permitId)** — List inspections for permit.
4. **delete(tenantId, projectId, permitId, inspectionId, userId)** — Hard delete inspection. Audit log.

**Controller** (nested under permits):
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /projects/:projectId/permits/:permitId/inspections | Owner, Admin, Manager | Create inspection |
| GET | /projects/:projectId/permits/:permitId/inspections | Owner, Admin, Manager | List inspections |
| PATCH | /projects/:projectId/permits/:permitId/inspections/:id | Owner, Admin, Manager | Update inspection |
| DELETE | /projects/:projectId/permits/:permitId/inspections/:id | Owner, Admin | Soft delete (set deleted_at) |
| DELETE | /projects/:projectId/permits/:permitId/inspections/:id/permanent | Owner | Hard delete inspection |

**Inspection response**:
```json
{
  "id": "uuid",
  "permit_id": "uuid",
  "project_id": "uuid",
  "inspection_type": "Framing",
  "scheduled_date": "2026-04-10",
  "inspector_name": "John Inspector",
  "result": "pass",
  "reinspection_required": false,
  "reinspection_date": null,
  "notes": "All structural elements approved",
  "created_at": "2026-04-01T10:00:00.000Z"
}
```

**Business Rules**:
- Inspection linked to permit (FK)
- result = 'fail' auto-sets reinspection_required = true
- Multiple inspections per permit allowed
- All queries include where: { tenant_id }

Unit tests, integration tests, REST docs at `api/documentation/inspection_REST_API.md`.

**Acceptance Criteria**:
- [ ] Inspection CRUD operational
- [ ] Linked to permits correctly
- [ ] Reinspection flag auto-set on failure
- [ ] Tests and docs complete

**Blocker**: Task 23.1

---

## Sprint Acceptance Criteria
- [ ] Inspection lifecycle complete
- [ ] Permit-inspection relationship working
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Inspections at /api/v1/projects/:projectId/permits/:permitId/inspections
- Included in permit detail response
