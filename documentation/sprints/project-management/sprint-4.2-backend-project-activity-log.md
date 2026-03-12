# Sprint 4.2 — Project Activity Log System

## Sprint Goal
Implement a reusable project activity log system (modeled after lead_activity) for tracking project-level events like task status changes, log entries, photo uploads, document uploads, assignment changes, etc.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 04 should be ideally complete (reason: subcontractor module exists for reference patterns)
- This sprint must run BEFORE Sprint 05 (project templates) so activity logging is available

## Codebase Reference
- Module path: `api/src/modules/projects/`
- Existing pattern: `lead_activity` model in Prisma schema (same shape adapted for projects)
- TenantId: `import { TenantId } from '../../auth/decorators/tenant-id.decorator';`
- Guards: JwtAuthGuard, RolesGuard, @Roles
- Sprint 34 (Dashboard) depends on `getRecentActivities()` for the recent_activity feed

## Tasks

### Task 4.2.1 — Create project_activity Prisma model
**Type**: Schema
**Complexity**: Medium
**Description**: Add `project_activity` model to Prisma schema, modeled after the existing `lead_activity` model.

**Field Table — project_activity**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| user_id | String? @db.VarChar(36) | yes | null | FK → user (who performed action, null for system) |
| activity_type | String @db.VarChar(50) | no | — | e.g. task_created, task_completed, task_status_changed, photo_uploaded, document_uploaded, log_created, assignment_added, assignment_removed, dependency_added, template_applied, permit_created, inspection_scheduled |
| description | String @db.VarChar(500) | no | — | Human-readable description |
| metadata | Json? | yes | null | Additional structured data (task_id, old_status, new_status, etc.) |
| created_at | DateTime | no | @default(now()) | |

**Relations**:
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- project: `project @relation(fields: [project_id], references: [id], onDelete: Cascade)`
- user: `user? @relation("project_activity_user", fields: [user_id], references: [id], onDelete: SetNull)`

**Reverse relations**:
- Add `project_activities project_activity[]` to project model
- Add appropriate reverse relation to user model (using relation name "project_activity_user")

**Indexes**: @@index([tenant_id, project_id, created_at(sort: Desc)]), @@index([tenant_id, activity_type])
**Map**: @@map("project_activity")

Run migration.

**Acceptance Criteria**:
- [ ] project_activity model added to schema
- [ ] All relations defined with explicit onDelete behavior
- [ ] Reverse relations added to project and user models
- [ ] Indexes created for efficient querying
- [ ] Migration applied successfully

**Files Expected**:
- api/prisma/schema.prisma (modified)
- migration file (created)

**Blocker**: NONE

---

### Task 4.2.2 — Create ProjectActivityService
**Type**: Service
**Complexity**: Medium
**Description**: Create a reusable service that other services can inject to log project activities.

**Dependencies**: PrismaService

**Methods**:

1. **logActivity(tenantId: string, projectId: string, userId: string | null, activityType: string, description: string, metadata?: Record<string, any>)** — Create a project_activity record. This is the main method other services will call. MUST wrap in try/catch and log errors — activity logging should NEVER throw errors that break the parent operation.
2. **getProjectActivities(tenantId: string, projectId: string, query: { activity_type?: string, page?: number, limit?: number })** — Return paginated activities for a project, ordered by created_at DESC. Include user relation (id, first_name, last_name). Return standard paginated response with meta.
3. **getRecentActivities(tenantId: string, query: { limit?: number, project_ids?: string[] })** — Return recent activities across projects (for dashboard use in Sprint 34). Include project relation (id, project_name). Ordered by created_at DESC. Default limit: 20.

**Business Rules**:
- All queries include where: { tenant_id } — non-negotiable
- Service is injectable by other modules (exported from ProjectsModule)
- logActivity() wraps in try/catch — never breaks the parent operation
- getProjectActivities() defaults: page=1, limit=20
- getRecentActivities() returns data shape compatible with Sprint 34 dashboard:
  ```json
  { "type": "task_completed", "project_name": "Roof Repair", "task_title": "Shingle install", "timestamp": "2026-03-10T14:00:00Z" }
  ```

**Expected Outcome**: ProjectActivityService fully implements all 3 methods.

**Acceptance Criteria**:
- [ ] All 3 methods implemented
- [ ] All queries include where: { tenant_id } filter
- [ ] logActivity() wrapped in try/catch (never throws)
- [ ] Pagination implemented with meta response
- [ ] getRecentActivities() includes project name for dashboard use

**Files Expected**:
- api/src/modules/projects/services/project-activity.service.ts (created)

**Blocker**: Task 4.2.1 must be complete

---

### Task 4.2.3 — Controller Endpoint + Register in Module
**Type**: Controller + Module
**Complexity**: Low
**Description**: Add GET endpoint for project activities to the existing project controller. Register ProjectActivityService in ProjectsModule and export it.

**Endpoint**:
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /projects/:projectId/activities | Owner, Admin, Manager | List project activities (paginated) |

**Query params**: activity_type (string, optional), page (number, optional), limit (number, optional)

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "activity_type": "task_completed",
      "description": "Task 'Install shingles' marked as done",
      "metadata": { "task_id": "uuid", "old_status": "in_progress", "new_status": "done" },
      "user": { "id": "uuid", "first_name": "John", "last_name": "Admin" },
      "created_at": "2026-03-10T14:00:00.000Z"
    }
  ],
  "meta": { "total": 45, "page": 1, "limit": 20, "totalPages": 3 }
}
```

**Module registration**:
- Add ProjectActivityService to providers and exports arrays in ProjectsModule
- Exporting ensures other modules can inject ProjectActivityService

**Acceptance Criteria**:
- [ ] GET endpoint created with proper guards and roles
- [ ] ProjectActivityService added to ProjectsModule providers and exports
- [ ] Application starts without errors

**Files Expected**:
- api/src/modules/projects/controllers/project.controller.ts (modified)
- api/src/modules/projects/projects.module.ts (modified)

**Blocker**: Task 4.2.2 must be complete

---

### Task 4.2.4 — Unit Tests
**Type**: Test
**Complexity**: Medium
**Description**: Write unit tests for ProjectActivityService.

**Test file**: `api/src/modules/projects/services/project-activity.service.spec.ts`

**Test cases**:
1. logActivity() — creates activity record with all fields
2. logActivity() — handles null userId (system activity)
3. logActivity() — does NOT throw when Prisma errors (try/catch)
4. logActivity() — stores metadata as JSON
5. getProjectActivities() — returns paginated activities with user relation
6. getProjectActivities() — filters by activity_type
7. getProjectActivities() — includes tenant_id in query filter
8. getProjectActivities() — orders by created_at DESC
9. getRecentActivities() — returns activities across projects with project name
10. getRecentActivities() — filters by project_ids when provided
11. getRecentActivities() — defaults limit to 20
12. getRecentActivities() — includes tenant_id in query filter

**Coverage target**: >80%

**Expected Outcome**: All 12 test cases pass.

**Acceptance Criteria**:
- [ ] 12 unit tests written and passing
- [ ] Tenant isolation verified in all query tests
- [ ] Error handling tested (logActivity try/catch)

**Files Expected**:
- api/src/modules/projects/services/project-activity.service.spec.ts (created)

**Blocker**: Task 4.2.2 must be complete

---

### Task 4.2.5 — Integration Tests
**Type**: Test
**Complexity**: Medium
**Description**: Write integration tests for the project activities endpoint.

**Test file**: `api/test/project-activity.e2e-spec.ts`

**Test cases**:
1. GET /projects/:projectId/activities — returns paginated activities (200)
2. GET /projects/:projectId/activities?activity_type=task_completed — filters by type
3. GET /projects/:projectId/activities — returns empty array for project with no activities
4. GET /projects/:projectId/activities — unauthorized role receives 403
5. GET /projects/:projectId/activities — unauthenticated request receives 401

**Expected Outcome**: All 5 integration tests pass.

**Acceptance Criteria**:
- [ ] All integration tests pass
- [ ] Pagination verified end-to-end
- [ ] RBAC verified

**Files Expected**:
- api/test/project-activity.e2e-spec.ts (created)

**Blocker**: Task 4.2.3 must be complete

---

### Task 4.2.6 — REST API Documentation
**Type**: Documentation
**Complexity**: Low
**Description**: Write comprehensive REST API documentation for the project activities endpoint and the ProjectActivityService public API.

**Output file**: `api/documentation/project_activity_REST_API.md`

**Must document**:
- GET /projects/:projectId/activities endpoint with request/response examples
- Query parameters (activity_type, page, limit)
- RBAC requirements (Owner, Admin, Manager)
- Response shape with concrete JSON examples
- All supported activity_type values
- ProjectActivityService.logActivity() usage guide for other modules
- ProjectActivityService.getRecentActivities() usage guide for dashboard

**Expected Outcome**: Frontend agent and other backend agents can use this document to integrate with the activity log system.

**Acceptance Criteria**:
- [ ] Endpoint fully documented with examples
- [ ] All activity_type values listed
- [ ] Service usage guide for other modules included
- [ ] Response shapes with concrete JSON examples

**Files Expected**:
- api/documentation/project_activity_REST_API.md (created)

**Blocker**: Task 4.2.3 must be complete

---

## Sprint Acceptance Criteria
- [ ] project_activity model exists with proper relations and indexes
- [ ] ProjectActivityService injectable and working (3 methods)
- [ ] logActivity() never throws errors that break parent operations
- [ ] GET endpoint returns paginated activities with user relation
- [ ] All queries include tenant_id filter
- [ ] ProjectActivityService exported from ProjectsModule
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] REST API documentation complete

## Gate Marker
NONE

## Handoff Notes
- ProjectActivityService exported from ProjectsModule for use by other services
- Other sprints should call `projectActivityService.logActivity()` when creating/updating/deleting project-related records
- Sprint 34 dashboard uses `getRecentActivities()` for the recent_activity feed
- Activity types follow pattern: entity_action (e.g. task_created, task_completed, photo_uploaded, log_created, assignment_added, assignment_removed, dependency_added, template_applied, permit_created, inspection_scheduled)
- Activities endpoint at `/api/v1/projects/:projectId/activities`
- logActivity() is fire-and-forget safe — errors are caught and logged, never propagated
