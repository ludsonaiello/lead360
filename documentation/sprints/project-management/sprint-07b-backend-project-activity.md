# Sprint 07b — Project Activity Entity + Service

## Sprint Goal
Create the `project_activity` entity and `ProjectActivityService` to support user-facing activity feed for the project dashboard.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 07 must be complete (reason: project schema exists)

## Codebase Reference
- Module path: `api/src/modules/projects/`
- Prisma schema: `api/prisma/schema.prisma`
- ProjectService: `api/src/modules/projects/services/project.service.ts`

## Context
The existing `lead_activity` table (in `api/src/modules/leads/services/lead-activities.service.ts`) is LEAD-scoped and NOT suitable for project-level activity feeds. This sprint creates a dedicated `project_activity` entity for project-level dashboard activity tracking.

## Tasks

### Task 07b.1 — Add project_activity model to Prisma schema
**Type**: Schema
**Complexity**: Medium
**Description**: Add the `project_activity` model to `api/prisma/schema.prisma`.

**Field Table — project_activity**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant, @relation onDelete: Cascade |
| project_id | String @db.VarChar(36) | no | — | FK → project, @relation onDelete: Cascade |
| user_id | String? @db.VarChar(36) | yes | null | FK → user, @relation onDelete: SetNull |
| activity_type | String @db.VarChar(50) | no | — | See allowed types below |
| description | String @db.VarChar(500) | no | — | Human-readable description |
| metadata | Json? | yes | null | Extra context |
| created_at | DateTime | no | @default(now()) | |

**Indexes**:
- `@@index([tenant_id, project_id, created_at(sort: Desc)])`
- `@@index([tenant_id, activity_type])`
- `@@index([project_id, created_at(sort: Desc)])`

**Map**: `@@map("project_activity")`

**Relations**:
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- project: `project @relation(fields: [project_id], references: [id], onDelete: Cascade)`
- user: `user? @relation(fields: [user_id], references: [id], onDelete: SetNull)`

Add reverse relations:
- `project` model: `project_activities project_activity[]`
- `tenant` model: `project_activities project_activity[]`
- `user` model: `project_activities project_activity[]`

**Allowed activity_type values**:
- `task_created`
- `task_completed`
- `task_delayed`
- `task_assigned`
- `status_changed`
- `log_added`
- `photo_added`
- `document_added`
- `permit_updated`
- `checklist_completed`
- `sms_sent`
- `crew_assigned`

**Acceptance Criteria**:
- [ ] project_activity model added with all 8 fields
- [ ] All indexes defined
- [ ] Relations defined with reverse relations
- [ ] Migration applied

**Files Expected**:
- api/prisma/schema.prisma (modified)
- api/prisma/migrations/[timestamp]_add_project_activity/migration.sql (created)

**Blocker**: NONE

---

### Task 07b.2 — Create ProjectActivityService
**Type**: Service
**Complexity**: Medium
**Description**: Create `api/src/modules/projects/services/project-activity.service.ts`.

**Methods**:

1. **logActivity(tenantId: string, data: { project_id: string, user_id?: string, activity_type: string, description: string, metadata?: any }): Promise<project_activity>**
   - Creates a `project_activity` record. Always includes `tenant_id`.
   - Fast, non-blocking (no await needed where caller cannot wait).

2. **getProjectActivity(tenantId: string, projectId: string, limit: number = 20): Promise<project_activity[]>**
   - Returns last N activities for a project, ordered by `created_at DESC`.

3. **getTenantRecentActivity(tenantId: string, limit: number = 20): Promise<project_activity[]>**
   - Returns last N activities across all projects for the tenant.
   - Used by the dashboard (Sprint 34).
   - Joins with `project` for project_name and `user` for user name.

**Business Rules**:
- All queries include `where: { tenant_id }`
- Activity logging should not block the calling mutation (fire-and-forget pattern acceptable)

**Expected Outcome**: ProjectActivityService fully operational with all 3 methods.

**Acceptance Criteria**:
- [ ] All 3 methods implemented
- [ ] All queries include where: { tenant_id }
- [ ] Service exported from ProjectsModule

**Files Expected**:
- api/src/modules/projects/services/project-activity.service.ts (created)
- api/src/modules/projects/projects.module.ts (modified — add ProjectActivityService to providers and exports)

**Blocker**: Task 07b.1

---

### Task 07b.3 — Unit Tests
**Type**: Test
**Complexity**: Low

**Test file**: `api/src/modules/projects/services/project-activity.service.spec.ts`

**Test cases**:
1. logActivity creates record with correct tenant_id and project_id
2. getProjectActivity returns activities ordered by created_at DESC
3. getProjectActivity respects limit parameter
4. getTenantRecentActivity returns activities across multiple projects
5. All methods include tenant_id in queries

**Files Expected**:
- api/src/modules/projects/services/project-activity.service.spec.ts (created)

**Blocker**: Task 07b.2

---

## Usage Rule
Any service in the Project Management module that mutates project state must call `ProjectActivityService.logActivity()` after the mutation. Specifically required:
- Task status changes (Sprint 13)
- Project status changes (Sprint 08)
- Log creation (Sprint 17)
- Photo upload (Sprint 09)
- Permit status change (Sprint 22)

## Sprint Acceptance Criteria
- [ ] project_activity table exists with correct fields and indexes
- [ ] ProjectActivityService with logActivity, getProjectActivity, getTenantRecentActivity
- [ ] Service exported from ProjectsModule
- [ ] Unit tests passing
- [ ] Migration applied

## Gate Marker
NONE

## Handoff Notes
- This service is consumed by Sprint 34 (Dashboard). Import `ProjectActivityService` wherever project mutations occur.
- Service path: `api/src/modules/projects/services/project-activity.service.ts`
- Import: `import { ProjectActivityService } from './services/project-activity.service';`
