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

### Task 24.1 — Add GET /projects/:projectId/change-orders-redirect
**Type**: Controller
**Complexity**: Low

**Sprint Goal (revised)**: Implement a redirect endpoint that takes a project context and returns the correct URL for the Change Orders tab in the Quote detail page.

**Rationale**: Change orders are managed in the Quotes module, which is already fully built. Creating a parallel change order system in the Project Management module would cause data duplication and inconsistency. The correct UX is to navigate the user from the project view to the quote's change orders tab.

**Endpoint**:
| Method | Path | Roles |
|--------|------|-------|
| GET | /api/v1/projects/:projectId/change-orders-redirect | Owner, Admin, Manager |

**Logic**: Fetch `project.quote_id` for this tenant+project. If `quote_id` is null (standalone project): return HTTP 400 with message "This project was not created from a quote. Change orders are not available for standalone projects." If `quote_id` exists: return `{ redirect_url: '/quotes/{quote_id}?tab=change-orders' }`.

This is a read-only endpoint. No mutations. No new change order entities, controllers, or services should be built under the Project Management module.

**Files Expected**:
- `api/src/modules/projects/controllers/project.controller.ts` (add one GET endpoint)
- Update `api/documentation/project_REST_API.md` with this endpoint

**Frontend note** (for handoff): The frontend must use this endpoint to obtain the redirect URL when the user clicks "Add Change Order" from any project view. The frontend then navigates to the returned URL (the Quote detail page, Change Orders tab).

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
