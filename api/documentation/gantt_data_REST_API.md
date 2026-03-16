# Gantt Data REST API

**Module**: Project Management
**Base URL**: `/api/v1/projects`
**Authentication**: Bearer JWT required on all endpoints
**Sprint**: 35

---

## Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/projects/:id/gantt` | Single project Gantt data | Owner, Admin, Manager |
| GET | `/projects/dashboard/gantt` | Multi-project Gantt summary | Owner, Admin, Manager |

---

## GET /projects/:id/gantt

Returns all tasks for a single project structured for Gantt chart rendering. Each task includes estimated/actual dates, computed delay status, assignees (flattened to type + name), upstream dependencies, and downstream dependents for arrow rendering.

### Authentication

- **Required**: Yes (Bearer JWT)
- **Roles**: `Owner`, `Admin`, `Manager`
- **Tenant isolation**: Automatic via JWT — only returns data for the authenticated user's tenant

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Project UUID |

### Response (200 OK)

```json
{
  "project": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Kitchen Remodel",
    "start_date": "2026-04-01",
    "target_completion_date": "2026-06-15",
    "progress_percent": 45.00
  },
  "tasks": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Demo existing kitchen",
      "status": "done",
      "estimated_start_date": "2026-04-01",
      "estimated_end_date": "2026-04-03",
      "actual_start_date": "2026-04-01",
      "actual_end_date": "2026-04-03",
      "is_delayed": false,
      "order_index": 0,
      "assignees": [
        { "type": "crew_member", "name": "Mike Johnson" }
      ],
      "dependencies": [],
      "dependents": [
        { "task_id": "770e8400-e29b-41d4-a716-446655440002", "type": "finish_to_start" }
      ]
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "title": "Rough plumbing",
      "status": "in_progress",
      "estimated_start_date": "2026-04-04",
      "estimated_end_date": "2026-04-06",
      "actual_start_date": "2026-04-05",
      "actual_end_date": null,
      "is_delayed": true,
      "order_index": 1,
      "assignees": [
        { "type": "subcontractor", "name": "ABC Plumbing" }
      ],
      "dependencies": [
        { "depends_on_task_id": "660e8400-e29b-41d4-a716-446655440001", "type": "finish_to_start" }
      ],
      "dependents": []
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "title": "Install cabinets",
      "status": "not_started",
      "estimated_start_date": "2026-04-10",
      "estimated_end_date": "2026-04-14",
      "actual_start_date": null,
      "actual_end_date": null,
      "is_delayed": false,
      "order_index": 2,
      "assignees": [
        { "type": "crew_member", "name": "Mike Johnson" },
        { "type": "user", "name": "Jane Doe" }
      ],
      "dependencies": [
        { "depends_on_task_id": "770e8400-e29b-41d4-a716-446655440002", "type": "finish_to_start" }
      ],
      "dependents": []
    }
  ]
}
```

### Response Fields

#### `project` object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | No | Project unique identifier |
| `name` | string | No | Project display name |
| `start_date` | string (ISO date) | Yes | Project start date |
| `target_completion_date` | string (ISO date) | Yes | Expected completion date |
| `progress_percent` | number | No | Overall progress (0.00–100.00), defaults to 0 |

#### `tasks[]` array

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | No | Task unique identifier |
| `title` | string | No | Task display name |
| `status` | enum | No | `not_started`, `in_progress`, `blocked`, `done` |
| `estimated_start_date` | string (ISO date) | Yes | Planned start date |
| `estimated_end_date` | string (ISO date) | Yes | Planned end date |
| `actual_start_date` | string (ISO date) | Yes | Actual start date (set automatically or manually) |
| `actual_end_date` | string (ISO date) | Yes | Actual completion date |
| `is_delayed` | boolean | No | Computed: true if past estimated_end_date and not done |
| `order_index` | integer | No | Task ordering position (ascending) |
| `assignees` | array | No | Flattened list of assigned resources |
| `dependencies` | array | No | Upstream: tasks this task depends on |
| `dependents` | array | No | Downstream: tasks that depend on this task |

#### `assignees[]` items

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | `crew_member`, `subcontractor`, `user` |
| `name` | string | Display name — full name for crew/user, business name for subcontractor |

#### `dependencies[]` items (upstream)

| Field | Type | Description |
|-------|------|-------------|
| `depends_on_task_id` | string (UUID) | The prerequisite task ID |
| `type` | enum | `finish_to_start`, `start_to_start`, `finish_to_finish` |

#### `dependents[]` items (downstream)

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | string (UUID) | The dependent task ID (task that waits on this one) |
| `type` | enum | `finish_to_start`, `start_to_start`, `finish_to_finish` |

### `is_delayed` Computation Rules

| Condition | Result |
|-----------|--------|
| `status == 'done'` | `false` (completed tasks are never delayed) |
| `actual_end_date > estimated_end_date` (and status != done) | `true` |
| `estimated_end_date < today` and no `actual_end_date` (and status != done) | `true` |
| Otherwise | `false` |

### Error Responses

| Status | Description | Body |
|--------|-------------|------|
| 401 | Unauthorized — missing or invalid JWT | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 403 | Forbidden — insufficient role | `{ "statusCode": 403, "message": "Forbidden resource" }` |
| 404 | Project not found or belongs to another tenant | `{ "statusCode": 404, "message": "Project not found" }` |

### Business Rules

- All queries scoped to `tenant_id` (derived from JWT, never from client)
- Only non-deleted tasks are returned (`deleted_at IS NULL`)
- Tasks ordered by `order_index` ascending
- `is_delayed` is computed live on each request
- Dependencies include both upstream (I depend on) and downstream (depends on me)
- Assignee names are flattened for Gantt display (no nested relation objects)

### Frontend Usage Notes

- Use `dependencies` + `dependents` to draw arrows between Gantt bars
- Use `estimated_start_date` / `estimated_end_date` for planned bar
- Use `actual_start_date` / `actual_end_date` for actual progress overlay
- Use `is_delayed` to apply visual delay indicator (red highlight)
- Use `order_index` for vertical task ordering
- Tasks with `null` dates should render as un-scheduled items

---

## GET /projects/dashboard/gantt

Returns a paginated list of projects with task summary data for a multi-project Gantt / timeline view.

### Authentication

- **Required**: Yes (Bearer JWT)
- **Roles**: `Owner`, `Admin`, `Manager`
- **Tenant isolation**: Automatic via JWT

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | — | Filter by project status: `planned`, `in_progress`, `on_hold`, `completed`, `canceled` |
| `assigned_pm_user_id` | UUID | No | — | Filter by assigned project manager |
| `search` | string | No | — | Search by project name or project number (contains match) |
| `page` | integer | No | 1 | Page number (1-indexed) |
| `limit` | integer | No | 20 | Items per page (max: 100) |

### Response (200 OK)

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "project_number": "PRJ-0042",
      "name": "Kitchen Remodel",
      "status": "in_progress",
      "start_date": "2026-04-01",
      "target_completion_date": "2026-06-15",
      "actual_completion_date": null,
      "contract_value": 25000.00,
      "progress_percent": 45.00,
      "assigned_pm": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "first_name": "Jane",
        "last_name": "Doe"
      },
      "customer": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "first_name": "John",
        "last_name": "Smith"
      },
      "task_count": 12,
      "completed_task_count": 5,
      "delayed_task_count": 2
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

### Response Fields

#### `data[]` items

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | No | Project unique identifier |
| `project_number` | string | No | Auto-generated project number (e.g., PRJ-0042) |
| `name` | string | No | Project display name |
| `status` | enum | No | `planned`, `in_progress`, `on_hold`, `completed`, `canceled` |
| `start_date` | string (ISO date) | Yes | Project start date |
| `target_completion_date` | string (ISO date) | Yes | Expected completion date |
| `actual_completion_date` | string (ISO date) | Yes | Actual completion date |
| `contract_value` | number | Yes | Total contract value |
| `progress_percent` | number | No | Completion percentage (0.00–100.00) |
| `assigned_pm` | object | Yes | Assigned project manager |
| `assigned_pm.id` | string (UUID) | — | PM user ID |
| `assigned_pm.first_name` | string | — | PM first name |
| `assigned_pm.last_name` | string | — | PM last name |
| `customer` | object | Yes | Customer (from linked lead) |
| `customer.id` | string (UUID) | — | Lead ID |
| `customer.first_name` | string | — | Customer first name |
| `customer.last_name` | string | — | Customer last name |
| `task_count` | integer | No | Total active (non-deleted) tasks |
| `completed_task_count` | integer | No | Tasks with status `done` |
| `delayed_task_count` | integer | No | Tasks flagged as delayed |

#### `meta` object

| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total matching projects |
| `page` | integer | Current page number |
| `limit` | integer | Items per page |
| `totalPages` | integer | Total pages |

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient role |

### Business Rules

- All queries scoped to `tenant_id`
- Pagination defaults: page 1, limit 20, max limit 100
- Projects ordered by `created_at` descending (newest first)
- Task counts computed from non-deleted tasks only
- `delayed_task_count` uses the `is_delayed` flag set by the scheduled delay check job

---

## cURL Examples

### Single Project Gantt

```bash
curl -X GET "https://api.lead360.app/api/v1/projects/550e8400-e29b-41d4-a716-446655440000/gantt" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json"
```

### Multi-Project Gantt with Filters

```bash
curl -X GET "https://api.lead360.app/api/v1/projects/dashboard/gantt?status=in_progress&page=1&limit=10" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json"
```
