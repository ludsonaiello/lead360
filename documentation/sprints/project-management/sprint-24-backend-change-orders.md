# Sprint 24 — Change Orders from Task Context

## Sprint Goal
Integrate with the existing Change Order module (in QuotesModule) to allow creating change orders from task context, linking the change order back to the project and task.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 13 must be complete (reason: ProjectTaskService exists)
- Existing ChangeOrderService must exist in quotes module (verified: api/src/modules/quotes/services/change-order.service.ts)

## Codebase Reference
- ChangeOrderService: `api/src/modules/quotes/services/change-order.service.ts`
- Change orders use the quote table with parent_quote_id FK
- Existing change order number format: CO-{year}-{0001}

## Tasks

### Task 24.1 — Create task-context change order endpoint
**Type**: Service + Controller
**Complexity**: Medium

**Add method** to ProjectTaskService or create TaskChangeOrderService:

**initiateChangeOrder(tenantId, projectId, taskId, userId, dto: { description, items? })**:
1. Fetch project with quote_id. Validate project has a linked quote.
2. Verify parent quote status: approved | started | concluded
3. Call ChangeOrderService.create() with: parent_quote_id = project.quote_id, private_notes = `Created from task: ${task.title} (Task ID: ${taskId})`
4. If dto.items provided, add them to the change order
5. Audit log
6. Return change order data

**Endpoint**:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/tasks/:taskId/change-order | Owner, Admin, Manager |

**Request**:
```json
{
  "description": "Additional electrical work needed for kitchen island"
}
```

**Response**:
```json
{
  "message": "Change order created",
  "change_order_id": "uuid",
  "change_order_number": "CO-2026-0003",
  "parent_quote_id": "uuid",
  "task_id": "uuid"
}
```

**Business Rules**:
- Project must have a linked quote (standalone projects cannot create COs)
- Parent quote must be approved/started/concluded
- Change order metadata includes task_id reference
- Uses existing ChangeOrderService — do NOT duplicate CO logic

Import QuotesModule into ProjectsModule if not already done.

Unit tests, integration tests, update task REST docs.

**Files Expected**:
- api/src/modules/projects/dto/create-task-change-order.dto.ts (created)
- api/src/modules/projects/services/project-task.service.ts (modified)
- api/src/modules/projects/controllers/project-task.controller.ts (modified)
- api/src/modules/projects/projects.module.ts (modified if needed)
- api/documentation/project_task_REST_API.md (modified)

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Change order created from task context
- [ ] Linked to parent quote correctly
- [ ] Standalone projects rejected (no quote)
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Change order from task: POST /projects/:projectId/tasks/:taskId/change-order
- Uses existing ChangeOrderService — no new CO tables
- Task reference stored in change order's private_notes field
