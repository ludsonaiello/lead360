# Sprint 19 — Log File Attachments Enhancement

## Sprint Goal
Ensure log attachments are fully integrated: log creation with file upload, attachment listing, and proper cross-linking with project_photo for image attachments. This sprint polishes the integration between Sprint 17 (logs) and Sprint 18 (photos).

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 17 must be complete (reason: project_log and project_log_attachment exist)
- Sprint 18 must be complete (reason: photo timeline enhancements exist)

## Codebase Reference
- ProjectLogService from Sprint 17
- ProjectPhotoService from Sprint 18

## Tasks

### Task 19.1 — Polish log-photo integration
**Type**: Service
**Complexity**: Medium

**Ensure**:
1. When a photo is uploaded via log creation, both project_log_attachment AND project_photo records are created (with log_id link).
2. When a log with photo attachments is deleted, the project_photo records with matching log_id are also cleaned up.
3. Non-photo attachments (PDFs, documents) only create project_log_attachment records.
4. Add endpoint to get log attachments separately if not yet available.

**FileCategory mapping for log attachments**:
- Images (jpg, png, webp) → category 'photo', create project_photo record
- PDFs → category 'misc', no project_photo record
- Other documents → category 'misc', no project_photo record

Unit tests for the integration logic. Integration tests. Update log REST docs.

**Files Expected**:
- api/src/modules/projects/services/project-log.service.ts (modified)
- api/src/modules/projects/services/project-log.service.spec.ts (modified)
- api/documentation/project_log_REST_API.md (modified)

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Photo log attachments create project_photo records
- [ ] Non-photo attachments only create log_attachment records
- [ ] Log deletion cascades correctly to photo records
- [ ] Tests and docs updated

## Gate Marker
NONE

## Handoff Notes
- Log-photo integration complete
- Next blocks: Sprint 20 (SMS from task), Sprint 21 (Calendar events)
