# Sprint 09 — Project File Attachments (Documents + Photos)

## Sprint Goal
Deliver project document and photo management: `project_document` and `project_photo` entities with CRUD endpoints using FilesService for all file uploads.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 08 must be complete (reason: project table and ProjectService must exist)

## Codebase Reference
- Module path: `api/src/modules/projects/`
- FilesService: `import { FilesService } from '../../files/files.service';`
- FilesModule: `import { FilesModule } from '../files/files.module';`
- FileCategory for documents: `contract`, `report`, or `misc`
- FileCategory for photos: `photo`

## Tasks

### Task 9.1 — Add project_document and project_photo to Prisma schema
**Type**: Schema
**Complexity**: Medium

**Enum to create**:
```
enum project_document_type {
  contract
  permit
  blueprint
  agreement
  photo
  other
}
```

**Field Table — project_document**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| file_id | String @db.VarChar(36) | no | — | FK → file table |
| file_url | String @db.VarChar(500) | no | — | Nginx-served URL from FilesService |
| file_name | String @db.VarChar(255) | no | — | Original filename |
| document_type | project_document_type | no | — | contract, permit, blueprint, agreement, photo, other |
| description | String? @db.VarChar(500) | yes | null | |
| is_public | Boolean | no | false | @default(false). Portal visibility flag. |
| uploaded_by_user_id | String @db.VarChar(36) | no | — | FK → user |
| created_at | DateTime | no | @default(now()) | Auto |

**Indexes**: @@index([tenant_id, project_id, document_type]), @@map("project_document")

**Field Table — project_photo**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| task_id | String? @db.VarChar(36) | yes | null | FK → project_task |
| log_id | String? @db.VarChar(36) | yes | null | FK → project_log (when uploaded via log) |
| file_id | String @db.VarChar(36) | no | — | FK → file table |
| file_url | String @db.VarChar(500) | no | — | Nginx-served URL. FileCategory: photo |
| thumbnail_url | String? @db.VarChar(500) | yes | null | Auto-generated from FilesService |
| caption | String? @db.VarChar(500) | yes | null | |
| is_public | Boolean | no | false | @default(false). Portal visibility. |
| taken_at | DateTime? @db.Date | yes | null | When photo was taken |
| uploaded_by_user_id | String @db.VarChar(36) | no | — | FK → user |
| created_at | DateTime | no | @default(now()) | Auto |

**Indexes**: @@index([tenant_id, project_id, is_public]), @@index([tenant_id, project_id, task_id]), @@map("project_photo")

**Relations**: Both → project (Restrict), tenant (Cascade), uploaded_by_user (Restrict), file (via file_id). Add reverse relations to project model.

**Acceptance Criteria**:
- [ ] Both models added with all fields
- [ ] Enums created
- [ ] All indexes defined

**Files Expected**: api/prisma/schema.prisma (modified)
**Blocker**: NONE

---

### Task 9.2 — Run migration
**Type**: Migration
**Complexity**: Low

**Acceptance Criteria**:
- [ ] Migration applied, both tables exist

**Files Expected**: api/prisma/migrations/[timestamp]_add_project_files/migration.sql
**Blocker**: Task 9.1

---

### Task 9.3 — DTOs + Services + Controllers + Module Update
**Type**: DTO + Service + Controller
**Complexity**: High

**Create ProjectDocumentService** with methods:
1. upload(tenantId, projectId, userId, file, dto: { document_type, description?, is_public? }) — FilesService.uploadFile with category mapped from document_type
2. findAll(tenantId, projectId, query: { document_type? }) — list documents
3. delete(tenantId, projectId, documentId, userId) — delete record, audit log

**Create ProjectPhotoService** with methods:
1. upload(tenantId, projectId, userId, file, dto: { task_id?, caption?, is_public?, taken_at? }) — FilesService.uploadFile with category 'photo'
2. findAll(tenantId, projectId, query: { task_id?, is_public?, date_from?, date_to? }) — list photos ordered by created_at DESC
3. update(tenantId, projectId, photoId, userId, dto: { caption?, is_public? }) — update metadata
4. delete(tenantId, projectId, photoId, userId) — delete record, audit log

**Controllers**:

ProjectDocumentController — nested under projects:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/documents | Owner, Admin, Manager |
| GET | /projects/:projectId/documents | Owner, Admin, Manager |
| DELETE | /projects/:projectId/documents/:id | Owner, Admin |

ProjectPhotoController — nested under projects:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/photos | Owner, Admin, Manager, Field |
| GET | /projects/:projectId/photos | All project members |
| PATCH | /projects/:projectId/photos/:id | Owner, Admin, Manager |
| DELETE | /projects/:projectId/photos/:id | Owner, Admin, Manager |

**Document FileCategory mapping**: contract→'contract', permit→'misc', blueprint→'misc', agreement→'contract', photo→'photo', other→'misc'

**Photo response shape**:
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "task_id": null,
  "file_url": "/public/tenant-uuid/images/photo-uuid.webp",
  "thumbnail_url": "/public/tenant-uuid/images/photo-uuid-thumb.webp",
  "caption": "Foundation pour complete",
  "is_public": true,
  "taken_at": "2026-03-10",
  "uploaded_by_user_id": "uuid",
  "created_at": "2026-03-10T14:30:00.000Z"
}
```

Update ProjectsModule with new services and controllers.

**Business Rules**:
- All queries include where: { tenant_id, project_id }
- File uploads use FilesService — never custom upload logic
- is_public controls portal visibility
- Photos ordered by created_at DESC for timeline display

**Acceptance Criteria**:
- [ ] Document upload/list/delete working
- [ ] Photo upload/list/update/delete working
- [ ] FilesService used for all uploads
- [ ] All queries include tenant_id and project_id filters

**Files Expected**:
- api/src/modules/projects/dto/upload-project-document.dto.ts (created)
- api/src/modules/projects/dto/upload-project-photo.dto.ts (created)
- api/src/modules/projects/services/project-document.service.ts (created)
- api/src/modules/projects/services/project-photo.service.ts (created)
- api/src/modules/projects/controllers/project-document.controller.ts (created)
- api/src/modules/projects/controllers/project-photo.controller.ts (created)
- api/src/modules/projects/projects.module.ts (modified)

**Blocker**: Task 9.2

---

### Task 9.4 — Tests + Documentation
**Type**: Test + Documentation
**Complexity**: Medium

Unit tests for both services. Integration tests at `api/test/project-files.e2e-spec.ts`. REST docs at `api/documentation/project_files_REST_API.md`.

**Acceptance Criteria**:
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] API documentation complete

**Files Expected**:
- api/src/modules/projects/services/project-document.service.spec.ts (created)
- api/src/modules/projects/services/project-photo.service.spec.ts (created)
- api/test/project-files.e2e-spec.ts (created)
- api/documentation/project_files_REST_API.md (created)

**Blocker**: Task 9.3

---

## Sprint Acceptance Criteria
- [ ] Project documents: upload, list, delete — all working
- [ ] Project photos: upload, list, update, delete — all working
- [ ] FilesService used for all uploads
- [ ] is_public flag controls portal visibility
- [ ] All queries include tenant_id + project_id filters
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Documents at `/api/v1/projects/:projectId/documents`
- Photos at `/api/v1/projects/:projectId/photos`
- Photos with is_public=true will be visible in customer portal (Sprint 32)
- project_photo.log_id will be used in Sprint 17 (project logs)
