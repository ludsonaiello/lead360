# Sprint 18 — Photo Progress Timeline Enhancement

## Sprint Goal
Enhance the photo system (from Sprint 09) with timeline view ordering, batch upload support, and filtering by date/task for a complete photo progress timeline.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 09 must be complete (reason: project_photo entity and basic CRUD exist)
- Sprint 17 must be complete (reason: log-created photos should appear in timeline)

## Codebase Reference
- ProjectPhotoService from Sprint 09

## Tasks

### Task 18.1 — Enhance ProjectPhotoService for timeline
**Type**: Service
**Complexity**: Medium

**Add/update methods**:
1. **getTimeline(tenantId, projectId, query: { task_id?, date_from?, date_to?, is_public?, page?, limit? })** — Returns photos ordered by taken_at DESC (fallback to created_at). Groups by date. Include task info and log info if linked.
2. **batchUpload(tenantId, projectId, userId, files: File[], dto: { task_id?, is_public?, taken_at? })** — Upload multiple photos in one request. Call FilesService for each. Return array of photo records.

**Timeline response**:
```json
{
  "data": [
    {
      "date": "2026-04-05",
      "photos": [
        {
          "id": "uuid",
          "file_url": "/public/t-uuid/images/photo.webp",
          "thumbnail_url": "/public/t-uuid/images/photo-thumb.webp",
          "caption": "Foundation complete",
          "is_public": true,
          "task": { "id": "uuid", "title": "Foundation Pour" },
          "log": { "id": "uuid" },
          "uploaded_by": { "first_name": "Jane", "last_name": "Admin" },
          "created_at": "2026-04-05T16:00:00.000Z"
        }
      ]
    }
  ],
  "meta": { "total": 45, "page": 1, "limit": 20, "totalPages": 3 }
}
```

**Endpoint**:
| Method | Path | Roles |
|--------|------|-------|
| GET | /projects/:projectId/photos/timeline | All project members |
| POST | /projects/:projectId/photos/batch | Owner, Admin, Manager, Field |

Unit tests, integration tests, update REST docs.

**Files Expected**:
- api/src/modules/projects/services/project-photo.service.ts (modified)
- api/src/modules/projects/controllers/project-photo.controller.ts (modified)
- api/src/modules/projects/services/project-photo.service.spec.ts (modified)
- api/documentation/project_files_REST_API.md (modified)

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Timeline endpoint groups photos by date
- [ ] Batch upload working
- [ ] Log-linked photos appear in timeline
- [ ] Tests and docs updated

## Gate Marker
NONE

## Handoff Notes
- Timeline at `/api/v1/projects/:projectId/photos/timeline`
- Batch upload at `/api/v1/projects/:projectId/photos/batch`
- Photos grouped by taken_at date (fallback created_at)
