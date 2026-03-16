# Project Task REST API Documentation

**Module**: Project Management — Tasks
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT token required on all endpoints
**Tenant Isolation**: All queries scoped to the authenticated user's tenant

---

## Endpoints Overview

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/projects/:projectId/tasks` | Create a task | Owner, Admin, Manager |
| GET | `/projects/:projectId/tasks` | List tasks (paginated) | Owner, Admin, Manager, Field |
| GET | `/projects/:projectId/tasks/:id` | Get task detail | Owner, Admin, Manager, Field |
| PATCH | `/projects/:projectId/tasks/:id` | Update task / transition status | Owner, Admin, Manager |
| DELETE | `/projects/:projectId/tasks/:id` | Soft delete task | Owner, Admin, Manager |
| POST | `/projects/:projectId/tasks/:taskId/dependencies` | Add a dependency | Owner, Admin, Manager |
| DELETE | `/projects/:projectId/tasks/:taskId/dependencies/:depId` | Remove a dependency | Owner, Admin, Manager |
| POST | `/projects/:projectId/tasks/:taskId/assignees` | Assign to task | Owner, Admin, Manager |
| DELETE | `/projects/:projectId/tasks/:taskId/assignees/:assigneeId` | Remove assignment | Owner, Admin, Manager |
| POST | `/projects/:projectId/tasks/:taskId/sms` | Send SMS from task context | Owner, Admin, Manager |
| POST | `/projects/:projectId/tasks/:taskId/calendar-events` | Create calendar event | Owner, Admin, Manager |
| GET | `/projects/:projectId/tasks/:taskId/calendar-events` | List calendar events | Owner, Admin, Manager |
| PATCH | `/projects/:projectId/tasks/:taskId/calendar-events/:eventId` | Update calendar event | Owner, Admin, Manager |
| DELETE | `/projects/:projectId/tasks/:taskId/calendar-events/:eventId` | Delete calendar event | Owner, Admin, Manager |
| GET | `/projects/dashboard/delays` | Delay dashboard counts | Owner, Admin, Manager |

---

## Common Response Fields

Every task response includes these computed/enriched fields:
- **`is_delayed`** — Computed on every read (not stored). See [is_delayed Logic](#is_delayed-computation-logic).
- **`assignees`** — Array of task assignees with crew_member/subcontractor/user details.
- **`dependencies`** — Array of task dependencies with depends_on task title.

---

## Status Transition Rules

| Current Status | Allowed Transitions |
|---------------|-------------------|
| `not_started` | `in_progress`, `blocked` |
| `in_progress` | `blocked`, `done` |
| `blocked` | `in_progress` |
| `done` | *(none — no transitions back in Phase 1)* |

**Automatic date behavior:**
- Moving to `in_progress` for the first time auto-sets `actual_start_date` to now (only if not already set AND not explicitly provided in the request).
- Moving to `done` auto-sets `actual_end_date` to now (only if not explicitly provided in the request).
- Project `progress_percent` is recomputed after every status change.

---

## is_delayed Computation Logic

Computed on every read — never stored in the database.

```
if (status === 'done') → false
if (actual_end_date > estimated_end_date) → true
if (!actual_end_date && estimated_end_date < now && status !== 'done') → true
else → false
```

---

## 1. POST `/projects/:projectId/tasks`

**Create a new task for a project.**

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | The project to add the task to |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `title` | string | **Yes** | max 200 chars | Task title |
| `description` | string | No | — | Task description |
| `estimated_duration_days` | integer | No | > 0 | Estimated duration in days |
| `estimated_start_date` | string | No | ISO 8601 date | Estimated start date |
| `estimated_end_date` | string | No | ISO 8601 date | Estimated end date |
| `category` | enum | No | `labor`, `material`, `subcontractor`, `equipment`, `other` | Task category |
| `order_index` | integer | **Yes** | >= 0 | Display order position |
| `notes` | string | No | — | Internal notes |

### Request Example

```json
POST /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "Install new shingles",
  "description": "Premium architectural shingles",
  "estimated_duration_days": 3,
  "estimated_start_date": "2026-04-05",
  "estimated_end_date": "2026-04-07",
  "category": "labor",
  "order_index": 2,
  "notes": null
}
```

### Response — 201 Created

```json
{
  "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "tenant_id": "t1e2n3a4-n5t6-7890-abcd-ef1234567890",
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "quote_item_id": null,
  "title": "Install new shingles",
  "description": "Premium architectural shingles",
  "status": "not_started",
  "estimated_duration_days": 3,
  "estimated_start_date": "2026-04-05T00:00:00.000Z",
  "estimated_end_date": "2026-04-07T00:00:00.000Z",
  "actual_start_date": null,
  "actual_end_date": null,
  "is_delayed": false,
  "order_index": 2,
  "category": "labor",
  "notes": null,
  "assignees": [],
  "dependencies": [],
  "created_by_user_id": "u1s2e3r4-i5d6-7890-abcd-ef1234567890",
  "deleted_at": null,
  "created_at": "2026-03-15T10:00:00.000Z",
  "updated_at": "2026-03-15T10:00:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error (missing required fields, invalid types) |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — user role is not Owner, Admin, or Manager |
| 404 | Project not found (or belongs to another tenant) |

---

## 2. GET `/projects/:projectId/tasks`

**List tasks for a project, paginated and ordered by `order_index`.**

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager, Field

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | The project whose tasks to list |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `limit` | integer | 20 | Items per page (max: 100) |
| `status` | string | — | Filter by status: `not_started`, `in_progress`, `blocked`, `done` |

### Request Example

```
GET /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks?page=1&limit=20&status=in_progress
Authorization: Bearer <jwt_token>
```

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "tenant_id": "t1e2n3a4-n5t6-7890-abcd-ef1234567890",
      "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "quote_item_id": null,
      "title": "Remove old shingles",
      "description": "Strip all existing roofing material",
      "status": "in_progress",
      "estimated_duration_days": 2,
      "estimated_start_date": "2026-04-03T00:00:00.000Z",
      "estimated_end_date": "2026-04-04T00:00:00.000Z",
      "actual_start_date": "2026-04-03T00:00:00.000Z",
      "actual_end_date": null,
      "is_delayed": true,
      "order_index": 0,
      "category": "labor",
      "notes": null,
      "assignees": [
        {
          "id": "a1s2s3i4-g5n6-7890-abcd-ef1234567890",
          "assignee_type": "crew_member",
          "crew_member": {
            "id": "c1r2e3w4-m5e6-7890-abcd-ef1234567890",
            "first_name": "Mike",
            "last_name": "Johnson"
          },
          "subcontractor": null,
          "user": null,
          "assigned_at": "2026-04-01T10:00:00.000Z"
        }
      ],
      "dependencies": [],
      "created_by_user_id": "u1s2e3r4-i5d6-7890-abcd-ef1234567890",
      "deleted_at": null,
      "created_at": "2026-03-15T10:00:00.000Z",
      "updated_at": "2026-04-03T08:00:00.000Z"
    },
    {
      "id": "g2h3i4j5-k6l7-8901-bcde-fg2345678901",
      "tenant_id": "t1e2n3a4-n5t6-7890-abcd-ef1234567890",
      "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "quote_item_id": null,
      "title": "Install new shingles",
      "description": "Premium architectural shingles",
      "status": "in_progress",
      "estimated_duration_days": 3,
      "estimated_start_date": "2026-04-05T00:00:00.000Z",
      "estimated_end_date": "2026-04-07T00:00:00.000Z",
      "actual_start_date": "2026-04-06T00:00:00.000Z",
      "actual_end_date": null,
      "is_delayed": true,
      "order_index": 2,
      "category": "labor",
      "notes": null,
      "assignees": [],
      "dependencies": [
        {
          "id": "d1e2p3s4-i5d6-7890-abcd-ef1234567890",
          "depends_on_task_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
          "depends_on_task_title": "Remove old shingles",
          "dependency_type": "finish_to_start"
        }
      ],
      "created_by_user_id": "u1s2e3r4-i5d6-7890-abcd-ef1234567890",
      "deleted_at": null,
      "created_at": "2026-03-15T10:00:00.000Z",
      "updated_at": "2026-04-06T08:00:00.000Z"
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — user role not allowed |

### Notes
- Soft-deleted tasks (non-null `deleted_at`) are **always excluded**.
- `is_delayed` is computed fresh on every response.
- Tasks are always ordered by `order_index ASC`.

---

## 3. GET `/projects/:projectId/tasks/:id`

**Get full detail for a single task including assignees and dependencies.**

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager, Field

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | Project UUID |
| `id` | UUID | Yes | Task UUID |

### Request Example

```
GET /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks/f1e2d3c4-b5a6-7890-abcd-ef1234567890
Authorization: Bearer <jwt_token>
```

### Response — 200 OK

```json
{
  "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "tenant_id": "t1e2n3a4-n5t6-7890-abcd-ef1234567890",
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "quote_item_id": null,
  "title": "Install new shingles",
  "description": "Premium architectural shingles",
  "status": "in_progress",
  "estimated_duration_days": 3,
  "estimated_start_date": "2026-04-05T00:00:00.000Z",
  "estimated_end_date": "2026-04-07T00:00:00.000Z",
  "actual_start_date": "2026-04-06T00:00:00.000Z",
  "actual_end_date": null,
  "is_delayed": true,
  "order_index": 2,
  "category": "labor",
  "notes": null,
  "assignees": [
    {
      "id": "a1s2s3i4-g5n6-7890-abcd-ef1234567890",
      "assignee_type": "crew_member",
      "crew_member": {
        "id": "c1r2e3w4-m5e6-7890-abcd-ef1234567890",
        "first_name": "Mike",
        "last_name": "Johnson"
      },
      "subcontractor": null,
      "user": null,
      "assigned_at": "2026-04-01T10:00:00.000Z"
    }
  ],
  "dependencies": [
    {
      "id": "d1e2p3s4-i5d6-7890-abcd-ef1234567890",
      "depends_on_task_id": "p1r2e3v4-t5a6-7890-abcd-ef1234567890",
      "depends_on_task_title": "Remove old shingles",
      "dependency_type": "finish_to_start"
    }
  ],
  "created_by_user_id": "u1s2e3r4-i5d6-7890-abcd-ef1234567890",
  "deleted_at": null,
  "created_at": "2026-03-15T10:00:00.000Z",
  "updated_at": "2026-04-06T08:00:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 404 | Task not found (or belongs to another tenant/project, or is soft-deleted) |

---

## 4. PATCH `/projects/:projectId/tasks/:id`

**Update task fields and/or transition task status.**

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | Project UUID |
| `id` | UUID | Yes | Task UUID |

### Request Body

All fields are optional. Include only the fields you want to change.

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `title` | string | max 200 chars | Task title |
| `description` | string | — | Task description |
| `estimated_duration_days` | integer | > 0 | Estimated duration in days |
| `estimated_start_date` | string | ISO 8601 date | Estimated start date |
| `estimated_end_date` | string | ISO 8601 date | Estimated end date |
| `status` | enum | `not_started`, `in_progress`, `blocked`, `done` | Task status (must follow transition rules) |
| `actual_start_date` | string | ISO 8601 date | Actual start date |
| `actual_end_date` | string | ISO 8601 date | Actual end date |
| `category` | enum | `labor`, `material`, `subcontractor`, `equipment`, `other` | Task category |
| `order_index` | integer | >= 0 | Display order position |
| `notes` | string | — | Internal notes |

### Request Example — Status Transition

```json
PATCH /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks/f1e2d3c4-b5a6-7890-abcd-ef1234567890
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "status": "in_progress"
}
```

### Request Example — Field Update

```json
PATCH /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks/f1e2d3c4-b5a6-7890-abcd-ef1234567890
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "Install premium shingles",
  "estimated_duration_days": 4,
  "notes": "Use GAF Timberline HDZ"
}
```

### Response — 200 OK

Returns the full updated task object (same shape as GET detail response).

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error OR invalid status transition |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — user role not allowed |
| 404 | Task not found (or belongs to another tenant/project, or is soft-deleted) |
| 409 | Conflict — prerequisite tasks not complete (finish_to_start dependency) |

### Error Example — Invalid Status Transition

```json
{
  "statusCode": 400,
  "message": "Invalid status transition: 'not_started' → 'done'. Allowed transitions from 'not_started': [in_progress, blocked]",
  "error": "Bad Request"
}
```

### Error Example — Blocking Dependencies (409 Conflict)

```json
{
  "statusCode": 409,
  "message": "Cannot transition status: prerequisite tasks are not complete",
  "error": "Conflict",
  "blocking_dependencies": [
    {
      "dependency_id": "d1e2p3s4-i5d6-7890-abcd-ef1234567890",
      "depends_on_task_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "depends_on_task_title": "Remove old shingles",
      "depends_on_task_status": "in_progress",
      "dependency_type": "finish_to_start"
    }
  ]
}
```

---

## 5. DELETE `/projects/:projectId/tasks/:id`

**Soft delete a task** (sets `deleted_at` timestamp). Recomputes project progress.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | Project UUID |
| `id` | UUID | Yes | Task UUID |

### Request Example

```
DELETE /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks/f1e2d3c4-b5a6-7890-abcd-ef1234567890
Authorization: Bearer <jwt_token>
```

### Response — 204 No Content

Empty response body.

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — user role not allowed |
| 404 | Task not found (or belongs to another tenant/project, or already soft-deleted) |

---

## 6. POST `/projects/:projectId/tasks/:taskId/dependencies`

**Add a dependency to a task.** The task (`taskId`) will depend on the task specified in `depends_on_task_id`. Both tasks must belong to the same project and tenant.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | Project UUID |
| `taskId` | UUID | Yes | The dependent task (the task that needs the other to finish first) |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `depends_on_task_id` | string | **Yes** | Valid UUID, must be in same project | UUID of the prerequisite task |
| `dependency_type` | enum | **Yes** | `finish_to_start`, `start_to_start`, `finish_to_finish` | Type of dependency relationship |

### Business Rules

- A task cannot depend on itself (400 Bad Request)
- Both tasks must belong to the same project and tenant (404 Not Found)
- Duplicate dependencies are rejected (409 Conflict)
- Circular dependencies are detected via DFS traversal and rejected (409 Conflict)
- **finish_to_start**: Prerequisite must have status `done` before dependent can move to `in_progress`
- **start_to_start**: Both tasks can start concurrently (no blocking validation in Phase 1)
- **finish_to_finish**: Both tasks can finish concurrently (no blocking validation in Phase 1)

### Request Example

```json
POST /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks/g2h3i4j5-k6l7-8901-bcde-fg2345678901/dependencies
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "depends_on_task_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "dependency_type": "finish_to_start"
}
```

### Response — 201 Created

```json
{
  "id": "d1e2p3s4-i5d6-7890-abcd-ef1234567890",
  "task_id": "g2h3i4j5-k6l7-8901-bcde-fg2345678901",
  "depends_on_task_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "depends_on_task_title": "Remove old shingles",
  "dependency_type": "finish_to_start",
  "created_at": "2026-03-15T10:00:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error (missing fields, invalid UUID, self-reference) |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — user role not allowed |
| 404 | Task or dependency target not found (or in different project/tenant) |
| 409 | Conflict — duplicate dependency or circular dependency detected |

### Error Example — Self-Reference

```json
{
  "statusCode": 400,
  "message": "A task cannot depend on itself",
  "error": "Bad Request"
}
```

### Error Example — Circular Dependency

```json
{
  "statusCode": 409,
  "message": "Adding this dependency would create a circular dependency chain",
  "error": "Conflict"
}
```

### Error Example — Duplicate

```json
{
  "statusCode": 409,
  "message": "This dependency already exists",
  "error": "Conflict"
}
```

---

## 7. DELETE `/projects/:projectId/tasks/:taskId/dependencies/:depId`

**Remove a dependency from a task.**

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | Project UUID |
| `taskId` | UUID | Yes | Task UUID |
| `depId` | UUID | Yes | Dependency UUID |

### Request Example

```
DELETE /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks/g2h3i4j5-k6l7-8901-bcde-fg2345678901/dependencies/d1e2p3s4-i5d6-7890-abcd-ef1234567890
Authorization: Bearer <jwt_token>
```

### Response — 204 No Content

Empty response body.

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — user role not allowed |
| 404 | Dependency not found (or belongs to another tenant/task) |

---

## Data Types Reference

### Task Status Enum

| Value | Description |
|-------|-------------|
| `not_started` | Default. Task has not begun. |
| `in_progress` | Task is actively being worked on. |
| `blocked` | Task is blocked by an external issue or dependency. |
| `done` | Task is complete. Terminal state in Phase 1. |

### Task Category Enum

| Value | Description |
|-------|-------------|
| `labor` | Labor/workforce task |
| `material` | Material procurement/handling |
| `subcontractor` | Subcontractor work |
| `equipment` | Equipment-related task |
| `other` | Uncategorized |

### Assignee Object (within task responses)

Format used in task detail and task list `assignees` arrays:

```json
{
  "id": "uuid",
  "assignee_type": "crew_member | subcontractor | user",
  "crew_member": { "id": "uuid", "first_name": "string", "last_name": "string" } | null,
  "subcontractor": { "id": "uuid", "business_name": "string" } | null,
  "user": { "id": "uuid", "first_name": "string", "last_name": "string" } | null,
  "assigned_at": "ISO 8601 datetime"
}
```

> The POST `/assignees` endpoint returns an extended format with `task_id` and `assigned_by_user_id` — see [section 8](#8-post-projectsprojectidtaskstaskidassignees).

### Dependency Object

```json
{
  "id": "uuid",
  "depends_on_task_id": "uuid",
  "depends_on_task_title": "string",
  "dependency_type": "finish_to_start | start_to_start | finish_to_finish"
}
```

---

## Pagination Response Format

All list endpoints return:

```json
{
  "data": [ ... ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

## Side Effects

| Action | Side Effect |
|--------|-------------|
| Create task | Project `progress_percent` recomputed |
| Update task status | Project `progress_percent` recomputed |
| Move to `in_progress` (first time) | `actual_start_date` auto-set to now (unless user-provided) |
| Move to `in_progress` | Dependency validation: all finish_to_start prereqs must be `done` (409 if not) |
| Move to `done` | `actual_end_date` auto-set to now (unless user-provided) |
| Soft delete task | Project `progress_percent` recomputed |
| Add dependency | Circular dependency check (DFS) before insert |
| All mutations | Audit log entry created |
| Status changes | Project activity log entry created |

---

## Frontend Integration Notes

- **Base URL**: `https://api.lead360.app/api/v1`
- **Authentication**: Bearer token required on all endpoints
- **Tenant ID**: Derived server-side from JWT — never send from client
- **`is_delayed`**: Computed on every read — do NOT cache or store client-side
- **Pagination**: Default 20 items/page, max 100
- **Status transitions**: Validate client-side for UX, but backend enforces
- **Soft delete**: Returns 204 No Content — no response body
- **Dependencies**: Managed via `POST/DELETE .../tasks/:taskId/dependencies` endpoints (Sprint 14)
- **Dependency validation**: When transitioning to `in_progress`, backend checks all `finish_to_start` prerequisites are `done`. Returns 409 with `blocking_dependencies` array if not.
- **Circular dependency detection**: Backend runs DFS before adding any dependency. Client does not need to validate cycles.

---

### Dependency Type Enum

| Value | Description | Phase 1 Enforcement |
|-------|-------------|-------------------|
| `finish_to_start` | Prerequisite must finish before dependent can start | **Yes** — blocks `in_progress` transition |
| `start_to_start` | Both tasks can start at the same time | No blocking validation |
| `finish_to_finish` | Both tasks can finish at the same time | No blocking validation |

---

## 8. POST `/projects/:projectId/tasks/:taskId/assignees`

**Assign a crew member, subcontractor, or system user to a task.** Polymorphic assignment via the `task_assignee` table.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | Project UUID |
| `taskId` | UUID | Yes | Task UUID |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `assignee_type` | enum | **Yes** | `crew_member`, `subcontractor`, `user` | Type of entity being assigned |
| `crew_member_id` | string | Conditional | Valid UUID, must belong to tenant | Required when `assignee_type = crew_member` |
| `subcontractor_id` | string | Conditional | Valid UUID, must belong to tenant | Required when `assignee_type = subcontractor` |
| `user_id` | string | Conditional | Valid UUID, must belong to tenant | Required when `assignee_type = user` |

### Business Rules

- **Exactly one** of `crew_member_id` / `subcontractor_id` / `user_id` must be provided, matching the `assignee_type`
- Providing extra IDs (e.g., both `crew_member_id` and `subcontractor_id`) results in 400 Bad Request
- The assignee entity must exist and belong to the same tenant
- **No duplicate assignments**: the same entity cannot be assigned to the same task twice (409 Conflict)
- All queries enforce `tenant_id` isolation from JWT

### Request Example — Assign Crew Member

```json
POST /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks/f1e2d3c4-b5a6-7890-abcd-ef1234567890/assignees
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "assignee_type": "crew_member",
  "crew_member_id": "c1r2e3w4-m5e6-7890-abcd-ef1234567890"
}
```

### Request Example — Assign Subcontractor

```json
{
  "assignee_type": "subcontractor",
  "subcontractor_id": "s1u2b3c4-o5n6-7890-abcd-ef1234567890"
}
```

### Request Example — Assign User

```json
{
  "assignee_type": "user",
  "user_id": "u1s2e3r4-i5d6-7890-abcd-ef1234567890"
}
```

### Response — 201 Created

```json
{
  "id": "a1s2s3i4-g5n6-7890-abcd-ef1234567890",
  "task_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "assignee_type": "crew_member",
  "crew_member": {
    "id": "c1r2e3w4-m5e6-7890-abcd-ef1234567890",
    "first_name": "Mike",
    "last_name": "Johnson"
  },
  "subcontractor": null,
  "user": null,
  "assigned_at": "2026-04-01T10:00:00.000Z",
  "assigned_by_user_id": "u1s2e3r4-i5d6-7890-abcd-ef1234567890"
}
```

### Response Example — Subcontractor Assignment

```json
{
  "id": "b2s3s4i5-g6n7-8901-bcde-fg2345678901",
  "task_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "assignee_type": "subcontractor",
  "crew_member": null,
  "subcontractor": {
    "id": "s1u2b3c4-o5n6-7890-abcd-ef1234567890",
    "business_name": "ABC Plumbing LLC"
  },
  "user": null,
  "assigned_at": "2026-04-01T11:00:00.000Z",
  "assigned_by_user_id": "u1s2e3r4-i5d6-7890-abcd-ef1234567890"
}
```

### Response Example — User Assignment

```json
{
  "id": "c3s4s5i6-g7n8-9012-cdef-gh3456789012",
  "task_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "assignee_type": "user",
  "crew_member": null,
  "subcontractor": null,
  "user": {
    "id": "u1s2e3r4-i5d6-7890-abcd-ef1234567890",
    "first_name": "Sarah",
    "last_name": "Williams"
  },
  "assigned_at": "2026-04-01T12:00:00.000Z",
  "assigned_by_user_id": "u1s2e3r4-i5d6-7890-abcd-ef1234567890"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error — missing required ID, type mismatch, or extra IDs provided |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — user role is not Owner, Admin, or Manager |
| 404 | Task, project, or assignee not found (or belongs to another tenant) |
| 409 | Conflict — assignee is already assigned to this task |

### Error Example — Type Mismatch (400)

```json
{
  "statusCode": 400,
  "message": "crew_member_id is required when assignee_type is crew_member",
  "error": "Bad Request"
}
```

### Error Example — Extra IDs (400)

```json
{
  "statusCode": 400,
  "message": "Only crew_member_id should be provided when assignee_type is crew_member",
  "error": "Bad Request"
}
```

### Error Example — Duplicate (409)

```json
{
  "statusCode": 409,
  "message": "This assignee is already assigned to this task",
  "error": "Conflict"
}
```

### Error Example — Assignee Not Found (404)

```json
{
  "statusCode": 404,
  "message": "Crew member not found or does not belong to this tenant",
  "error": "Not Found"
}
```

---

## 9. DELETE `/projects/:projectId/tasks/:taskId/assignees/:assigneeId`

**Remove an assignee from a task.**

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | Project UUID |
| `taskId` | UUID | Yes | Task UUID |
| `assigneeId` | UUID | Yes | Assignment UUID (the `id` from the assignment response) |

### Request Example

```
DELETE /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks/f1e2d3c4-b5a6-7890-abcd-ef1234567890/assignees/a1s2s3i4-g5n6-7890-abcd-ef1234567890
Authorization: Bearer <jwt_token>
```

### Response — 204 No Content

Empty response body.

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — user role is not Owner, Admin, or Manager |
| 404 | Assignment not found (or belongs to another tenant/task/project) |

---

## Assignment Response Object (POST /assignees endpoint)

```json
{
  "id": "uuid",
  "task_id": "uuid",
  "assignee_type": "crew_member | subcontractor | user",
  "crew_member": { "id": "uuid", "first_name": "string", "last_name": "string" } | null,
  "subcontractor": { "id": "uuid", "business_name": "string" } | null,
  "user": { "id": "uuid", "first_name": "string", "last_name": "string" } | null,
  "assigned_at": "ISO 8601 datetime",
  "assigned_by_user_id": "uuid"
}
```

### Assignee Type Enum

| Value | Description |
|-------|-------------|
| `crew_member` | A crew member (field worker) |
| `subcontractor` | An external subcontractor |
| `user` | A system user (admin, manager, etc.) |

---

## Assignment Side Effects

| Action | Side Effect |
|--------|-------------|
| Assign to task | Audit log entry created |
| Remove assignment | Audit log entry created |

---

## GET /projects/dashboard/delays — Delay Dashboard (Sprint 16)

Returns the count of delayed tasks grouped by project for the authenticated tenant.

**Roles**: Owner, Admin, Manager

### Request

```
GET /api/v1/projects/dashboard/delays
Authorization: Bearer {jwt_token}
```

No query parameters required.

### Response — 200 OK

```json
{
  "total_delayed_tasks": 12,
  "projects_with_delays": [
    {
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "project_name": "Kitchen Remodel",
      "delayed_task_count": 3
    },
    {
      "project_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "project_name": "Roof Repair",
      "delayed_task_count": 2
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `total_delayed_tasks` | number | Sum of all delayed tasks across all projects |
| `projects_with_delays` | array | Array of projects that have at least one delayed task |
| `projects_with_delays[].project_id` | string (UUID) | Project ID |
| `projects_with_delays[].project_name` | string | Human-readable project name |
| `projects_with_delays[].delayed_task_count` | number | Number of delayed tasks in this project |

### Delay Computation

A task is considered **delayed** when ALL of these are true:
- `estimated_end_date` is in the past (before current timestamp)
- `status` is NOT `done`
- `deleted_at` is NULL (not soft-deleted)

This is a **live computation** — the dashboard always shows the current state, not a cached value.

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT token |
| 403 | Forbidden — user role is not Owner, Admin, or Manager |

### Example Request

```bash
curl -X GET https://api.lead360.app/api/v1/projects/dashboard/delays \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### Example Response (No Delays)

```json
{
  "total_delayed_tasks": 0,
  "projects_with_delays": []
}
```

---

## Scheduled Job: Project Task Delay Check (Sprint 16)

A BullMQ background job runs daily at **06:00 UTC** on the `project-management` queue.

### Purpose

- Persist `is_delayed = true` on overdue tasks (supplementary to on-read computation)
- Create in-app notifications for project managers when tasks become delayed

### Job Configuration

| Property | Value |
|----------|-------|
| Queue | `project-management` |
| Job Name | `project-task-delay-check` |
| Schedule | `0 6 * * *` (daily at 6 AM UTC) |
| Max Retries | 3 |
| Backoff | Exponential, 5000ms initial delay |
| Timeout | 300 seconds |

### Processing Logic

1. Query all active tenants (excluding soft-deleted)
2. For each tenant:
   a. **Clear stale flags** — set `is_delayed = false` for tasks that were previously flagged but are no longer overdue (status changed to `done`, `estimated_end_date` extended, or `estimated_end_date` removed)
   b. Find projects with status `in_progress`
3. For each project, find tasks where:
   - `estimated_end_date < now`
   - `status != done`
   - `is_delayed = false` (not yet flagged)
   - `deleted_at IS NULL`
4. Batch update `is_delayed = true`
5. Create notification for assigned PM (or broadcast if no PM assigned)

### Notification Created

| Field | Value |
|-------|-------|
| `type` | `task_delayed` |
| `title` | `Task Delayed` |
| `message` | `Task '{title}' in project '{name}' is past its estimated end date.` |
| `action_url` | `/projects/{projectId}/tasks/{taskId}` |
| `related_entity_type` | `project_task` |
| `related_entity_id` | Task UUID |
| `user_id` | PM user ID, or `null` for broadcast |

### Fault Isolation

- If processing fails for one tenant, the job continues to the next tenant
- If notification creation fails, the task update is still persisted
- Job failure for one tenant never stops processing for other tenants

---

## 10. POST `/projects/:projectId/tasks/:taskId/sms` — Sprint 20

**Send SMS from task context.** The message is linked to both the task (via `related_entity_type: 'project_task'`) and the lead (via `lead_id`), so it appears on both the task activity timeline and the lead communication timeline.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | Project UUID |
| `taskId` | UUID | Yes | Task UUID |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `to_phone` | string | Conditional | E.164 format (e.g., `+19781234567`) | Recipient phone. **Required** for standalone projects (no `lead_id`). If omitted, resolved from lead's primary phone. |
| `text_body` | string | **Yes** | Max 1600 chars, non-empty | SMS message body |
| `lead_id` | string | No | Valid UUID v4 | Override lead UUID. If omitted, auto-resolved from `project.lead_id`. |

### Phone Resolution Logic

1. If `dto.to_phone` is provided → use it directly
2. If `dto.to_phone` is omitted:
   - Resolve `lead_id` from `dto.lead_id` or `project.lead_id`
   - If no `lead_id` (standalone project) → **400 Bad Request**: `"Standalone projects require an explicit to_phone"`
   - Fetch `lead_phone` where `is_primary = true` for the resolved lead
   - If no primary phone → **400 Bad Request**: `"No phone number available for this lead"`
   - Normalize phone to E.164 format (handles 10-digit, 11-digit, and formatted numbers)

### Request Example — With Explicit Phone

```json
POST /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks/f1e2d3c4-b5a6-7890-abcd-ef1234567890/sms
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "to_phone": "+19781234567",
  "text_body": "Hi John, your roof installation starts tomorrow at 8 AM."
}
```

### Request Example — Phone Resolved From Lead

```json
POST /api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks/f1e2d3c4-b5a6-7890-abcd-ef1234567890/sms
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "text_body": "Hi John, your roof installation starts tomorrow at 8 AM."
}
```

### Response — 200 OK

```json
{
  "message": "SMS queued for delivery",
  "communication_event_id": "c1o2m3m4-e5v6-7890-abcd-ef1234567890",
  "to_phone": "+19781234567",
  "status": "queued"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Success message from SMS service |
| `communication_event_id` | string (UUID) | Tracking ID in `communication_event` table. Use to track delivery status. |
| `to_phone` | string | Recipient phone (E.164 format) |
| `status` | string | `"queued"` — SMS is queued for delivery via BullMQ |

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error: `to_phone` invalid E.164, `text_body` missing/empty/over 1600 chars, standalone project without `to_phone`, lead has no primary phone |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — user role is not Owner, Admin, or Manager |
| 404 | Task not found, project not found, or lead not found |

### Error Example — Standalone Project Without Phone (400)

```json
{
  "statusCode": 400,
  "message": "Standalone projects require an explicit to_phone",
  "error": "Bad Request"
}
```

### Error Example — No Primary Phone (400)

```json
{
  "statusCode": 400,
  "message": "No phone number available for this lead",
  "error": "Bad Request"
}
```

### Error Example — Invalid E.164 (400)

```json
{
  "statusCode": 400,
  "message": ["Phone number must be in E.164 format (e.g., +19781234567)"],
  "error": "Bad Request"
}
```

### Side Effects

| Action | Side Effect |
|--------|-------------|
| SMS sent | `communication_event` record created by CommunicationsModule |
| SMS sent | SMS appears on task activity via `related_entity_type: 'project_task'` |
| SMS sent | SMS appears on lead timeline via `lead_id` |
| SMS sent | Audit log entry created (`entityType: 'task_sms'`) |
| SMS sent | Project activity log entry created (`activity_type: 'sms_sent'`) |

### CommunicationsModule Integration

This endpoint uses the existing `SmsSendingService` from the CommunicationsModule. The SMS is queued via BullMQ and delivered asynchronously. The `communication_event_id` can be used to track delivery status via the communications history endpoint.

---

## Task Calendar Events — Sprint 21

Calendar events can be created per task with optional Google Calendar sync. When the tenant has an active Google Calendar connection, events are automatically synced. If the connection is absent or sync fails, the event is still created locally.

### Business Rules

- **Multiple events per task** are allowed
- **Events are NOT auto-deleted when a task is deleted** (Prisma onDelete: Cascade handles this at the DB level, but the sprint spec says events are NOT auto-deleted; the cascade is a safety net only)
- **Google Calendar sync is best-effort** — sync failure never blocks event creation
- **sync_status values**: `pending`, `synced`, `failed`, `local_only`
- All queries include `tenant_id` filter

---

### POST `/projects/:projectId/tasks/:taskId/calendar-events`

Create a calendar event for a task. Attempts Google Calendar sync if the tenant has an active calendar connection.

**Roles**: Owner, Admin, Manager
**Authentication**: Bearer JWT

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | yes | Project ID |
| taskId | UUID | yes | Task ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| title | string | yes | max 300 chars | Event title |
| description | string | no | — | Event description |
| start_datetime | string (ISO 8601) | yes | Valid date | Event start datetime |
| end_datetime | string (ISO 8601) | yes | Must be after start_datetime | Event end datetime |

#### Example Request

```json
POST /api/v1/projects/abc-123/tasks/def-456/calendar-events
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Roof Installation - Day 1",
  "description": "Start roof tear-off and prep underlayment",
  "start_datetime": "2026-04-05T08:00:00.000Z",
  "end_datetime": "2026-04-05T17:00:00.000Z"
}
```

#### Success Response (201 Created)

```json
{
  "id": "evt-uuid-001",
  "task_id": "def-456",
  "project_id": "abc-123",
  "title": "Roof Installation - Day 1",
  "description": "Start roof tear-off and prep underlayment",
  "start_datetime": "2026-04-05T08:00:00.000Z",
  "end_datetime": "2026-04-05T17:00:00.000Z",
  "google_event_id": "google-cal-id-or-null",
  "sync_status": "synced",
  "created_by_user_id": "user-uuid-001",
  "created_at": "2026-03-15T10:00:00.000Z"
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error — `end_datetime must be after start_datetime` |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient role |
| 404 | Task not found (or does not belong to tenant/project) |

#### sync_status Behavior

| Scenario | sync_status | google_event_id |
|----------|-------------|-----------------|
| No Google Calendar connection | `local_only` | `null` |
| Google sync succeeded | `synced` | Google event ID |
| Google sync failed | `failed` | `null` |

---

### GET `/projects/:projectId/tasks/:taskId/calendar-events`

List all calendar events for a task, ordered by `start_datetime` ascending.

**Roles**: Owner, Admin, Manager
**Authentication**: Bearer JWT

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | yes | Project ID |
| taskId | UUID | yes | Task ID |

#### Example Request

```
GET /api/v1/projects/abc-123/tasks/def-456/calendar-events
Authorization: Bearer <token>
```

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "evt-uuid-001",
      "task_id": "def-456",
      "project_id": "abc-123",
      "title": "Roof Installation - Day 1",
      "description": "Start roof tear-off",
      "start_datetime": "2026-04-05T08:00:00.000Z",
      "end_datetime": "2026-04-05T17:00:00.000Z",
      "google_event_id": "google-cal-id-or-null",
      "sync_status": "synced",
      "created_by_user_id": "user-uuid-001",
      "created_at": "2026-03-15T10:00:00.000Z"
    },
    {
      "id": "evt-uuid-002",
      "task_id": "def-456",
      "project_id": "abc-123",
      "title": "Roof Installation - Day 2",
      "description": "Continue shingle installation",
      "start_datetime": "2026-04-06T08:00:00.000Z",
      "end_datetime": "2026-04-06T17:00:00.000Z",
      "google_event_id": null,
      "sync_status": "local_only",
      "created_by_user_id": "user-uuid-001",
      "created_at": "2026-03-15T10:05:00.000Z"
    }
  ]
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient role |
| 404 | Task not found (or does not belong to tenant/project) |

---

### PATCH `/projects/:projectId/tasks/:taskId/calendar-events/:eventId`

Update an existing calendar event. All fields are optional. If the event has a `google_event_id`, the update is also pushed to Google Calendar (best-effort — failure does not block local update).

**Roles**: Owner, Admin, Manager
**Authentication**: Bearer JWT

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | yes | Project ID |
| taskId | UUID | yes | Task ID |
| eventId | UUID | yes | Calendar event ID |

#### Request Body (all fields optional)

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| title | string | no | max 300 chars | Updated title |
| description | string | no | — | Updated description |
| start_datetime | string (ISO 8601) | no | Valid date | Updated start |
| end_datetime | string (ISO 8601) | no | Must be after start (combined validation) | Updated end |

#### Example Request

```json
PATCH /api/v1/projects/abc-123/tasks/def-456/calendar-events/evt-uuid-001
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Roof Installation - Day 1 (Updated)",
  "end_datetime": "2026-04-05T18:00:00.000Z"
}
```

#### Success Response (200 OK)

```json
{
  "id": "evt-uuid-001",
  "task_id": "def-456",
  "project_id": "abc-123",
  "title": "Roof Installation - Day 1 (Updated)",
  "description": "Start roof tear-off and prep underlayment",
  "start_datetime": "2026-04-05T08:00:00.000Z",
  "end_datetime": "2026-04-05T18:00:00.000Z",
  "google_event_id": "google-cal-id-or-null",
  "sync_status": "synced",
  "created_by_user_id": "user-uuid-001",
  "created_at": "2026-03-15T10:00:00.000Z"
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error — `end_datetime must be after start_datetime` (combined validation) |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient role |
| 404 | Calendar event not found |

#### Combined Date Validation

When only one date field is updated, the service validates the combination of the updated field with the existing field. For example:
- Existing: `start = 08:00, end = 17:00`
- Update: `{ start_datetime: "18:00" }` → **rejected** because `18:00 > 17:00`

---

### DELETE `/projects/:projectId/tasks/:taskId/calendar-events/:eventId`

Delete a calendar event. If the event has a `google_event_id`, deletion is also attempted on Google Calendar (best-effort).

**Roles**: Owner, Admin, Manager
**Authentication**: Bearer JWT

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | yes | Project ID |
| taskId | UUID | yes | Task ID |
| eventId | UUID | yes | Calendar event ID |

#### Example Request

```
DELETE /api/v1/projects/abc-123/tasks/def-456/calendar-events/evt-uuid-001
Authorization: Bearer <token>
```

#### Success Response (204 No Content)

No body.

#### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient role |
| 404 | Calendar event not found |

---

### Calendar Event Response Shape

All calendar event endpoints return the same shape:

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Calendar event ID |
| task_id | string (UUID) | Task this event belongs to |
| project_id | string (UUID) | Project this event belongs to |
| title | string | Event title (max 300 chars) |
| description | string \| null | Event description |
| start_datetime | string (ISO 8601) | Event start datetime |
| end_datetime | string (ISO 8601) | Event end datetime |
| google_event_id | string \| null | Google Calendar event ID (null if not synced) |
| sync_status | string | One of: `pending`, `synced`, `failed`, `local_only` |
| created_by_user_id | string (UUID) | User who created the event |
| created_at | string (ISO 8601) | Creation timestamp |

### Side Effects

| Trigger | Side Effect |
|---------|-------------|
| Event created | Audit log entry (`entityType: 'task_calendar_event'`, `action: 'created'`) |
| Event created (with Google connection) | Google Calendar event created |
| Event updated | Audit log entry (`action: 'updated'`) |
| Event updated (with google_event_id) | Google Calendar event updated |
| Event deleted | Audit log entry (`action: 'deleted'`) |
| Event deleted (with google_event_id) | Google Calendar event deleted |

### Google Calendar Integration

The service uses the existing `CalendarIntegrationModule`:
- `CalendarProviderConnectionService.getActiveConnection(tenantId)` — checks for active Google Calendar connection
- `GoogleCalendarService.createEvent()` — creates event in Google Calendar
- `GoogleCalendarService.updateEvent()` — updates event in Google Calendar
- `GoogleCalendarService.deleteEvent()` — deletes event from Google Calendar

All Google Calendar operations are **best-effort**: failures are logged but never block the local operation.

---

**End of Project Task REST API Documentation**
