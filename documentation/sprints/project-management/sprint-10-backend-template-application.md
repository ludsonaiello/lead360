# Sprint 10 — Project Template Application

## Sprint Goal
Implement the ability to apply a project template to an existing project, creating project_task records from template tasks and resolving depends_on_order_index into real task_dependency records.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 08 must be complete (reason: project and basic project_task creation exist)
- Sprint 05 must be complete (reason: ProjectTemplateService exists with template CRUD)
- Note: project_task and task_dependency models will be fully built in Sprint 12-14. This sprint creates basic project_task records (the model may need to be added if not yet in schema). If project_task model doesn't exist yet from Sprint 08's quote-to-task creation, it must be added here with minimal fields. The full project_task model with all fields will be finalized in Sprint 12.

## Codebase Reference
- ProjectTemplateService: `api/src/modules/projects/services/project-template.service.ts`
- ProjectService: `api/src/modules/projects/services/project.service.ts`

## Tasks

### Task 10.1 — Ensure project_task model exists in Prisma schema
**Type**: Schema (conditional)
**Complexity**: Medium
**Description**: If the project_task model was not yet added in Sprint 08 (it may have been created minimally for quote-to-task), ensure it exists with at least these fields for template application. The full field set will be completed in Sprint 12.

**Minimum fields needed now**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| quote_item_id | String? @db.VarChar(36) | yes | null | FK → quote_item |
| title | String @db.VarChar(200) | no | — | |
| description | String? @db.Text | yes | null | |
| status | project_task_status | no | not_started | @default(not_started). Uses enum defined below. |
| estimated_duration_days | Int? | yes | null | |
| category | project_task_category? | yes | null | Reuse enum from Sprint 05 |
| order_index | Int | no | — | |
| notes | String? @db.Text | yes | null | |
| created_by_user_id | String @db.VarChar(36) | no | — | |
| deleted_at | DateTime? | yes | null | Soft delete |
| created_at | DateTime | no | @default(now()) | |
| updated_at | DateTime | no | @updatedAt | |

**Enum to create in this sprint**:
```
enum project_task_status {
  not_started
  in_progress
  blocked
  done
}
```

> **Note**: The `project_task_status` enum is defined here in Sprint 10. Sprint 12 does NOT need to create or convert this enum. Sprint 12 only adds the `task_assignee` and `task_dependency` models. Do not touch the status field type.

Also ensure task_dependency model exists (minimal):
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| task_id | String @db.VarChar(36) | no | — | FK → project_task (dependent) |
| depends_on_task_id | String @db.VarChar(36) | no | — | FK → project_task (prerequisite) |
| dependency_type | String @db.VarChar(20) | no | 'finish_to_start' | @default("finish_to_start") |
| created_by_user_id | String @db.VarChar(36) | no | — | |
| created_at | DateTime | no | @default(now()) | |

Run migration if new models added.

**Acceptance Criteria**:
- [ ] project_task model exists with minimum fields
- [ ] task_dependency model exists with minimum fields
- [ ] Migration applied if needed

**Files Expected**: api/prisma/schema.prisma (modified if needed)
**Blocker**: NONE

---

### Task 10.2 — Implement applyTemplate method in ProjectService
**Type**: Service
**Complexity**: High
**Description**: Add method to ProjectService (or create a separate ProjectTemplateApplicationService):

**applyTemplate(tenantId, projectId, templateId, userId): Promise<{ tasks_created: number, dependencies_created: number }>**

Logic:
1. Fetch template with tasks (ordered by order_index). Validate template belongs to tenant.
2. Fetch project. Validate belongs to tenant.
3. Determine starting order_index: query max order_index of existing tasks in project, start after that.
4. Create project_task records from template tasks:
   - title = templateTask.title
   - description = templateTask.description
   - estimated_duration_days = templateTask.estimated_duration_days
   - category = templateTask.category
   - order_index = startingIndex + templateTask.order_index
   - status = 'not_started'
5. Resolve dependencies: for each template task with depends_on_order_index:
   - Find the newly created project_task whose source order_index matches
   - Create task_dependency record: task_id = current task, depends_on_task_id = prerequisite task, dependency_type = 'finish_to_start' (default)
6. Return count of tasks and dependencies created.
7. Audit log.

**Business Rules**:
- Template must belong to same tenant
- Template must be active (is_active = true)
- Tasks appended after existing tasks (not replacing)
- depends_on_order_index resolved within the same template application batch
- All queries include where: { tenant_id }

**Acceptance Criteria**:
- [ ] Tasks created from template with correct fields
- [ ] Dependencies resolved from order_index references
- [ ] Tasks appended (not replacing existing)
- [ ] Tenant isolation enforced

**Files Expected**: api/src/modules/projects/services/project.service.ts (modified) or api/src/modules/projects/services/template-application.service.ts (created)
**Blocker**: Task 10.1

---

### Task 10.3 — Create endpoint + tests + docs
**Type**: Controller + Test + Documentation
**Complexity**: Medium

**Endpoint**:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/apply-template/:templateId | Owner, Admin, Manager |

Response:
```json
{
  "message": "Template applied successfully",
  "tasks_created": 8,
  "dependencies_created": 3
}
```

Unit tests for applyTemplate method. Integration test for the endpoint. Add to project REST API docs.

**Acceptance Criteria**:
- [ ] Endpoint operational
- [ ] Tests passing
- [ ] Documentation updated

**Files Expected**:
- api/src/modules/projects/controllers/project.controller.ts (modified)
- api/src/modules/projects/services/project.service.spec.ts (modified)
- api/test/project-template-apply.e2e-spec.ts (created)
- api/documentation/project_REST_API.md (modified)

**Blocker**: Task 10.2

---

## Sprint Acceptance Criteria
- [ ] Template application creates tasks from template
- [ ] Dependencies resolved from order_index
- [ ] Tasks appended after existing project tasks
- [ ] Tenant isolation enforced
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Apply template: POST /projects/:projectId/apply-template/:templateId
- project_task model now exists (minimal fields — full model in Sprint 12)
- task_dependency model now exists (minimal — full logic in Sprint 14)
