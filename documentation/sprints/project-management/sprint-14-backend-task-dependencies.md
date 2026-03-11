# Sprint 14 — Task Dependencies + Circular Dependency Detection

## Sprint Goal
Implement task dependency management with add/remove endpoints, circular dependency detection using DFS traversal, and dependency validation on task status transitions.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 13 must be complete (reason: ProjectTaskService exists with CRUD)

## Codebase Reference
- task_dependency model from Sprint 10/12
- ProjectTaskService: `api/src/modules/projects/services/project-task.service.ts`

## Tasks

### Task 14.1 — Create TaskDependencyService
**Type**: Service
**Complexity**: High

**Methods**:
1. **addDependency(tenantId, projectId, taskId, dto: { depends_on_task_id, dependency_type })** — Validate: both tasks belong to same project and tenant. Run circular dependency check (DFS). Create record. Audit log.
2. **removeDependency(tenantId, projectId, taskId, dependencyId, userId)** — Delete dependency record. Audit log.
3. **getTaskDependencies(tenantId, taskId)** — Return all dependencies for a task (both "depends on" and "depended on by").
4. **validateStatusTransition(tenantId, taskId, newStatus)** — For finish_to_start: if task depends on another task, the prerequisite must be 'done' before dependent can move to 'in_progress'. Return list of blocking dependencies or empty array.

**Circular Dependency Detection (DFS)**:
```
async detectCircularDependency(tenantId, projectId, taskId, dependsOnTaskId): Promise<boolean> {
  // Build adjacency list from all existing dependencies in this project
  // Run DFS from dependsOnTaskId, following dependency chains
  // If we reach taskId, a cycle would be created → return true (circular)
  // If DFS completes without finding taskId → return false (safe)

  const dependencies = await prisma.task_dependency.findMany({
    where: { tenant_id: tenantId, task: { project_id: projectId } }
  });

  const adjacencyList = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!adjacencyList.has(dep.task_id)) adjacencyList.set(dep.task_id, []);
    adjacencyList.get(dep.task_id).push(dep.depends_on_task_id);
  }

  // Add the proposed new edge
  if (!adjacencyList.has(taskId)) adjacencyList.set(taskId, []);
  adjacencyList.get(taskId).push(dependsOnTaskId);

  // DFS from taskId following reverse direction to detect cycle
  const visited = new Set<string>();
  const stack = [dependsOnTaskId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === taskId) return true; // Circular!
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = adjacencyList.get(current) || [];
    stack.push(...neighbors);
  }
  return false;
}
```

**Constraint**: task_id and depends_on_task_id must belong to the same project_id.

**Business Rules**:
- Both tasks must be in the same project
- No circular dependencies (DFS validation before insert)
- Three types: finish_to_start (default), start_to_start, finish_to_finish
- finish_to_start: prerequisite must be 'done' before dependent can start
- All queries include where: { tenant_id }

**Files Expected**: api/src/modules/projects/services/task-dependency.service.ts (created)
**Blocker**: NONE

---

### Task 14.2 — Endpoints + Integration with TaskService + Tests + Docs
**Type**: Controller + Test + Documentation
**Complexity**: Medium

**Endpoints** (add to ProjectTaskController or create dedicated):
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/tasks/:taskId/dependencies | Owner, Admin, Manager |
| DELETE | /projects/:projectId/tasks/:taskId/dependencies/:depId | Owner, Admin, Manager |

**CreateDependencyDto**:
- depends_on_task_id: string (required, UUID)
- dependency_type: enum (required: finish_to_start, start_to_start, finish_to_finish)

**Response**:
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "depends_on_task_id": "uuid",
  "depends_on_task_title": "Remove old shingles",
  "dependency_type": "finish_to_start",
  "created_at": "2026-03-15T10:00:00.000Z"
}
```

**Integrate with ProjectTaskService.update()**: Before allowing status transition, call validateStatusTransition(). If blocking dependencies exist, return 409 Conflict with list of blocking tasks.

Unit tests: circular detection (5 cases: no cycle, direct cycle, indirect cycle, self-reference, different project tasks). Integration tests for endpoints.

**Files Expected**:
- api/src/modules/projects/dto/create-task-dependency.dto.ts (created)
- api/src/modules/projects/services/task-dependency.service.spec.ts (created)
- api/src/modules/projects/controllers/project-task.controller.ts (modified)
- api/test/task-dependency.e2e-spec.ts (created)
- api/documentation/project_task_REST_API.md (modified)
**Blocker**: Task 14.1

---

## Sprint Acceptance Criteria
- [ ] Dependency add/remove endpoints working
- [ ] Circular dependency detection prevents invalid insertions
- [ ] Status transitions blocked when prerequisites not met (FS type)
- [ ] All queries include tenant_id
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Dependencies at `/api/v1/projects/:projectId/tasks/:taskId/dependencies`
- TaskDependencyService exported from ProjectsModule
- Circular detection uses DFS — tested with multiple scenarios
- Status transitions integrate with dependency validation
