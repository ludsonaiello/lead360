# Sprint 15 — Task Assignment (Crew + Subcontractor + User)

## Sprint Goal
Implement task assignment endpoints for crew members, subcontractors, and system users, with polymorphic assignment via the task_assignee table.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 13 must be complete (reason: ProjectTaskService exists)
- Sprint 02 must be complete (reason: CrewMemberService exists)
- Sprint 04 must be complete (reason: SubcontractorService exists)
- Sprint 12 must be complete (reason: task_assignee table exists)

## Codebase Reference
- task_assignee model from Sprint 12
- CrewMemberService, SubcontractorService from ProjectsModule

## Tasks

### Task 15.1 — Create TaskAssignmentService + Controller + Tests + Docs
**Type**: Service + Controller + Test + Documentation
**Complexity**: High

**TaskAssignmentService methods**:
1. **assignToTask(tenantId, projectId, taskId, userId, dto: { assignee_type, crew_member_id?, subcontractor_id?, user_id? })** — Validate: exactly one of crew_member_id/subcontractor_id/user_id must be set matching assignee_type. Validate assignee exists and belongs to tenant. Prevent duplicate assignment (same assignee to same task). Create task_assignee record.
2. **removeAssignment(tenantId, projectId, taskId, assigneeId, userId)** — Delete task_assignee record.
3. **getTaskAssignees(tenantId, taskId)** — Return all assignees for a task with their details (name, type).
4. **getCrewMemberTasks(tenantId, crewMemberId)** — All tasks assigned to a crew member across projects.
5. **getSubcontractorTasks(tenantId, subcontractorId)** — All tasks assigned to a subcontractor.

**AssignTaskDto**:
- assignee_type: enum (required: crew_member, subcontractor, user)
- crew_member_id: string (optional, UUID — required when type=crew_member)
- subcontractor_id: string (optional, UUID — required when type=subcontractor)
- user_id: string (optional, UUID — required when type=user)

**Endpoints**:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/tasks/:taskId/assignees | Owner, Admin, Manager |
| DELETE | /projects/:projectId/tasks/:taskId/assignees/:assigneeId | Owner, Admin, Manager |

**Assignment response**:
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "assignee_type": "crew_member",
  "crew_member": { "id": "uuid", "first_name": "Mike", "last_name": "Johnson" },
  "subcontractor": null,
  "user": null,
  "assigned_at": "2026-04-01T10:00:00.000Z",
  "assigned_by_user_id": "uuid"
}
```

**Business Rules**:
- Exactly one of crew_member_id/subcontractor_id/user_id must be provided
- No duplicate assignments (same entity to same task)
- Assignee must belong to tenant
- All queries include where: { tenant_id }

Unit tests: assign crew, assign sub, assign user, prevent duplicate, validate type mismatch. Integration tests. Update task REST API docs.

**Files Expected**:
- api/src/modules/projects/dto/assign-task.dto.ts (created)
- api/src/modules/projects/services/task-assignment.service.ts (created)
- api/src/modules/projects/services/task-assignment.service.spec.ts (created)
- api/src/modules/projects/controllers/project-task.controller.ts (modified)
- api/src/modules/projects/projects.module.ts (modified)
- api/test/task-assignment.e2e-spec.ts (created)
- api/documentation/project_task_REST_API.md (modified)
**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Assign/remove crew, subcontractor, user to tasks
- [ ] Duplicate prevention
- [ ] Polymorphic assignment working
- [ ] All queries include tenant_id
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Assign at `/api/v1/projects/:projectId/tasks/:taskId/assignees`
- TaskAssignmentService exported
- Assignees included in task detail responses (Sprint 13)
