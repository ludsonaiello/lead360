# Sprint 24 — Change Order Redirect from Task Context

## Sprint Goal
Add a lightweight endpoint that validates change order eligibility from task context and returns the redirect URL to the existing Quote Detail → Change Order tab. No new change order logic is built — the existing ChangeOrderService in QuotesModule handles everything.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 13 must be complete (reason: ProjectTaskService exists)
- Existing ChangeOrderService must exist in quotes module

## Codebase Reference
- ChangeOrderService: `api/src/modules/quotes/services/change-order.service.ts`
- Change orders are managed via the Quote Detail page's Change Order tab
- The frontend will redirect the user to `/quotes/{quote_id}?tab=change-orders` when they click "Create Change Order" from task context

## Tasks

### Task 24.1 — Create change order eligibility check endpoint
**Type**: Controller
**Complexity**: Low

**Endpoint**:
| Method | Path | Roles |
|--------|------|-------|
| GET | /projects/:projectId/tasks/:taskId/change-order-redirect | Owner, Admin, Manager |

**Logic**:
1. Fetch project with quote_id. Validate project belongs to tenant.
2. If project.quote_id is null (standalone project): return 400 with message "Standalone projects cannot create change orders — no linked quote."
3. Verify parent quote status: must be in ['approved', 'started', 'concluded']. If not, return 400 with message "Quote status must be approved, started, or concluded to create a change order."
4. Return the redirect data:

**Response (200)**:
```json
{
  "can_create_change_order": true,
  "redirect_url": "/quotes/{quote_id}?tab=change-orders&from_task={task_id}&from_project={project_id}",
  "quote_id": "uuid",
  "quote_number": "Q-2026-0015",
  "task_id": "uuid",
  "task_title": "Install new shingles",
  "message": "Redirecting to quote change order tab"
}
```

**Response (400 — standalone project)**:
```json
{
  "can_create_change_order": false,
  "message": "Standalone projects cannot create change orders — no linked quote."
}
```

**Business Rules**:
- NO change order creation logic here — use existing QuotesModule
- This endpoint only validates eligibility and returns redirect data
- The frontend handles the actual redirect to `/quotes/{quote_id}?tab=change-orders`
- The `from_task` and `from_project` query params allow the Quote UI to pre-fill context
- All queries include where: { tenant_id }

**Acceptance Criteria**:
- [ ] Eligibility check validates quote existence and status
- [ ] Redirect URL returned with correct query params
- [ ] Standalone projects rejected with clear message
- [ ] Tests and docs complete

**Files Expected**:
- api/src/modules/projects/controllers/project-task.controller.ts (modified — add endpoint)
- api/src/modules/projects/services/project-task.service.ts (modified — add eligibility check method)
- api/documentation/project_task_REST_API.md (modified)

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Change order eligibility check working
- [ ] Redirect URL returned correctly
- [ ] Standalone projects rejected
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Change order redirect: GET /projects/:projectId/tasks/:taskId/change-order-redirect
- NO new change order logic — existing QuotesModule handles all CO creation
- Frontend redirects to: /quotes/{quote_id}?tab=change-orders&from_task={task_id}&from_project={project_id}
- The Quote Detail UI should handle the `from_task` and `from_project` query params to show context
