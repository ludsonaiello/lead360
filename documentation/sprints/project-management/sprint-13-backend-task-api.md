# Sprint 13 — Task Service + Controller + API (CRUD + Status Transitions)

## Sprint Goal
Deliver complete project task CRUD API with status transitions, computed is_delayed flag, pagination, and project progress recomputation on status changes.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 12 must be complete (reason: project_task model finalized with all fields)
- Sprint 08 must be complete (reason: ProjectService.recomputeProgress method exists)

## Codebase Reference
- Module path: `api/src/modules/projects/`
- ProjectService.recomputeProgress: called after task status changes

## Tasks

### Task 13.1 — Create Task DTOs
**Type**: DTO
**Complexity**: Medium

**CreateProjectTaskDto**:
- title: string (required, max 200)
- description: string (optional)
- estimated_duration_days: number (optional, integer, > 0)
- estimated_start_date: string (optional, ISO date)
- estimated_end_date: string (optional, ISO date)
- category: enum (optional: labor, material, subcontractor, equipment, other)
- order_index: number (required, integer, >= 0)
- notes: string (optional)

**UpdateProjectTaskDto**:
- All above fields optional (PartialType)
- status: enum (optional: not_started, in_progress, blocked, done)
- actual_start_date: string (optional, ISO date)
- actual_end_date: string (optional, ISO date)

**Task response**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "project_id": "uuid",
  "quote_item_id": null,
  "title": "Install new shingles",
  "description": "Premium architectural shingles",
  "status": "in_progress",
  "estimated_duration_days": 3,
  "estimated_start_date": "2026-04-05",
  "estimated_end_date": "2026-04-07",
  "actual_start_date": "2026-04-06",
  "actual_end_date": null,
  "is_delayed": true,
  "order_index": 2,
  "category": "labor",
  "notes": null,
  "assignees": [
    { "id": "uuid", "assignee_type": "crew_member", "crew_member": { "id": "uuid", "first_name": "Mike", "last_name": "Johnson" }, "assigned_at": "2026-04-01T10:00:00.000Z" }
  ],
  "dependencies": [
    { "id": "uuid", "depends_on_task_id": "uuid", "depends_on_task_title": "Remove old shingles", "dependency_type": "finish_to_start" }
  ],
  "created_by_user_id": "uuid",
  "created_at": "2026-03-15T10:00:00.000Z",
  "updated_at": "2026-04-06T08:00:00.000Z"
}
```

**Files Expected**:
- api/src/modules/projects/dto/create-project-task.dto.ts (created)
- api/src/modules/projects/dto/update-project-task.dto.ts (created)
**Blocker**: NONE

---

### Task 13.2 — Create ProjectTaskService
**Type**: Service
**Complexity**: High

**Methods**:
1. **create(tenantId, projectId, userId, dto)** — Create task. Validate project belongs to tenant. Audit log. Recompute project progress.
2. **findAll(tenantId, projectId, query: { status?, page?, limit? })** — Paginated, ordered by order_index. Include assignees and dependencies. Compute is_delayed for each task on read.
3. **findOne(tenantId, projectId, taskId)** — Full detail with assignees, dependencies. Compute is_delayed.
4. **update(tenantId, projectId, taskId, userId, dto)** — Update fields. If status changes: set actual_start_date on first move to 'in_progress', set actual_end_date when moving to 'done'. Recompute project progress. Audit log.
5. **softDelete(tenantId, projectId, taskId, userId)** — Set deleted_at. Recompute project progress. Audit log.

**is_delayed computation** (applied on every read):
```
computeIsDelayed(task): boolean {
  if (task.status === 'done') return false;
  if (task.actual_end_date && task.estimated_end_date && task.actual_end_date > task.estimated_end_date) return true;
  if (!task.actual_end_date && task.estimated_end_date && new Date() > task.estimated_end_date && task.status !== 'done') return true;
  return false;
}
```

**Status transition rules**:
- not_started → in_progress, blocked
- in_progress → blocked, done
- blocked → in_progress
- done → (no transitions back in Phase 1)
- Validate transitions in update method

**Business Rules**:
- All queries include where: { tenant_id, project_id, deleted_at: null }
- is_delayed computed on every read
- Project progress recomputed after task status changes
- actual_start_date auto-set on first in_progress
- actual_end_date auto-set on done

**Files Expected**:
- api/src/modules/projects/services/project-task.service.ts (created)
**Blocker**: Task 13.1

---

### Task 13.3 — Create ProjectTaskController
**Type**: Controller
**Complexity**: Medium

| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/tasks | Owner, Admin, Manager |
| GET | /projects/:projectId/tasks | Owner, Admin, Manager, Field |
| GET | /projects/:projectId/tasks/:id | All with project access |
| PATCH | /projects/:projectId/tasks/:id | Owner, Admin, Manager |
| DELETE | /projects/:projectId/tasks/:id | Owner, Admin, Manager |

**Files Expected**: api/src/modules/projects/controllers/project-task.controller.ts (created)
**Blocker**: Task 13.2

---

### Task 13.4 — Module Update + Tests + Docs
**Type**: Module + Test + Documentation
**Complexity**: High

Register in ProjectsModule. Unit tests at `api/src/modules/projects/services/project-task.service.spec.ts`. Integration tests. REST docs at `api/documentation/project_task_REST_API.md`.

**Unit test cases**: create, findAll with pagination, findOne with is_delayed, update with status transitions, invalid transitions throw, softDelete, is_delayed computation (4 edge cases).

**Files Expected**:
- api/src/modules/projects/projects.module.ts (modified)
- api/src/modules/projects/services/project-task.service.spec.ts (created)
- api/test/project-task.e2e-spec.ts (created)
- api/documentation/project_task_REST_API.md (created)
**Blocker**: Task 13.3

---

## Sprint Acceptance Criteria
- [ ] Task CRUD operational with status transitions
- [ ] is_delayed computed on every read
- [ ] Project progress recomputed on status changes
- [ ] Soft delete working
- [ ] All queries include tenant_id + project_id + deleted_at:null
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Tasks at `/api/v1/projects/:projectId/tasks`
- ProjectTaskService exported for cross-module use
- is_delayed is computed, not stored
- Status transitions validated
- Next: Sprint 14 adds dependency management, Sprint 15 adds assignment management
