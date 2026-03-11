# Sprint 17 — Project Log System

## Sprint Goal
Deliver the project log system with `project_log` and `project_log_attachment` entities, supporting daily and random log types, public/private visibility, and file attachments via FilesService.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 09 must be complete (reason: project_photo model exists — log photos also create project_photo records)
- Sprint 08 must be complete (reason: project exists)

## Codebase Reference
- Module path: `api/src/modules/projects/`
- FilesService for attachments
- project_photo model from Sprint 09 (log photos also appear in photo timeline)

## Tasks

### Task 17.1 — Add project_log and project_log_attachment to schema
**Type**: Schema
**Complexity**: Medium

**Field Table — project_log**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| task_id | String? @db.VarChar(36) | yes | null | FK → project_task (optional context) |
| author_user_id | String @db.VarChar(36) | no | — | FK → user |
| log_date | DateTime @db.Date | no | — | Default today. PM can backfill. |
| content | String @db.Text | no | — | Rich text or plain text |
| is_public | Boolean | no | false | @default(false). Portal visible when true. |
| weather_delay | Boolean | no | false | @default(false) |
| created_at | DateTime | no | @default(now()) | |
| updated_at | DateTime | no | @updatedAt | |

**Indexes**: @@index([tenant_id, project_id, created_at]), @@index([tenant_id, project_id, is_public])
**Map**: @@map("project_log")

**Enum**:
```
enum log_attachment_file_type {
  photo
  pdf
  document
}
```

**Field Table — project_log_attachment**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| log_id | String @db.VarChar(36) | no | — | FK → project_log |
| file_id | String @db.VarChar(36) | no | — | FK → file |
| file_url | String @db.VarChar(500) | no | — | |
| file_name | String @db.VarChar(255) | no | — | |
| file_type | log_attachment_file_type | no | — | |
| file_size_bytes | Int? | yes | null | |
| created_at | DateTime | no | @default(now()) | |

**Map**: @@map("project_log_attachment")

Run migration.

**Acceptance Criteria**:
- [ ] Both models added, migration applied

**Files Expected**: api/prisma/schema.prisma (modified), migration file
**Blocker**: NONE

---

### Task 17.2 — ProjectLogService + Controller + Tests + Docs
**Type**: Service + Controller + Test + Documentation
**Complexity**: High

**ProjectLogService methods**:
1. **create(tenantId, projectId, userId, dto: { task_id?, log_date, content, is_public?, weather_delay?, attachments?: File[] })** — Create log. If photos in attachments: also create project_photo records with log_id set. Use FilesService for each attachment. Log content is IMMUTABLE after creation.
2. **findAll(tenantId, projectId, query: { is_public?, has_attachments?, date_from?, date_to?, page?, limit? })** — Paginated, ordered by log_date DESC then created_at DESC. Include attachments.
3. **delete(tenantId, projectId, logId, userId)** — Owner/Admin only. Hard delete log and cascade attachments. Audit log.

**Controller** — nested under projects:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/logs | Owner, Admin, Manager, Field (assigned) |
| GET | /projects/:projectId/logs | Owner, Admin, Manager, Field |
| DELETE | /projects/:projectId/logs/:id | Owner, Admin |

Log creation accepts multipart with multiple files (attachments).

**Log response**:
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "task_id": null,
  "author": { "id": "uuid", "first_name": "Jane", "last_name": "Admin" },
  "log_date": "2026-04-05",
  "content": "Foundation pour completed today. Weather was clear.",
  "is_public": true,
  "weather_delay": false,
  "attachments": [
    { "id": "uuid", "file_url": "/public/t-uuid/images/photo.webp", "file_name": "foundation.jpg", "file_type": "photo" }
  ],
  "created_at": "2026-04-05T16:00:00.000Z"
}
```

**Business Rules**:
- Log content immutable after creation (no edit endpoint)
- is_public controls portal visibility
- Photos uploaded via log also create project_photo records (linked via log_id)
- PM can backfill past dates
- All queries include where: { tenant_id, project_id }

Unit tests, integration tests, REST docs at `api/documentation/project_log_REST_API.md`.

**Files Expected**:
- api/src/modules/projects/dto/create-project-log.dto.ts (created)
- api/src/modules/projects/services/project-log.service.ts (created)
- api/src/modules/projects/controllers/project-log.controller.ts (created)
- api/src/modules/projects/services/project-log.service.spec.ts (created)
- api/test/project-log.e2e-spec.ts (created)
- api/documentation/project_log_REST_API.md (created)
- api/src/modules/projects/projects.module.ts (modified)

**Blocker**: Task 17.1

---

## Sprint Acceptance Criteria
- [ ] Log creation with attachments working
- [ ] Log photos create project_photo records
- [ ] Content immutable (no edit endpoint)
- [ ] is_public flag for portal visibility
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Logs at `/api/v1/projects/:projectId/logs`
- Public logs visible in portal (Sprint 32)
- Log photos linked to project_photo via log_id
