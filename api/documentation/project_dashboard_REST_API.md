# Project Dashboard REST API Documentation

**Module**: Project Management — Dashboard
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT token required on all endpoints
**Sprint**: 34

---

## Endpoints Overview

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/projects/dashboard` | Get aggregated dashboard data | Owner, Admin, Manager |
| GET | `/projects/dashboard/gantt` | Get projects with summary for gantt/list view | Owner, Admin, Manager |

---

## 1. GET /projects/dashboard

### Description

Returns aggregated dashboard data for the project management dashboard. Includes status distribution, active project counts, delayed and overdue task counts, upcoming deadlines, and a recent activity feed. All data is scoped to the authenticated user's tenant.

### Authentication

- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | — | Filter projects by status. Values: `planned`, `in_progress`, `on_hold`, `completed`, `canceled` |
| `assigned_pm_user_id` | string (UUID) | No | — | Filter projects by assigned project manager |
| `date_from` | string (ISO 8601) | No | — | Filter projects created on or after this date |
| `date_to` | string (ISO 8601) | No | — | Filter projects created on or before this date |

### Response — 200 OK

```json
{
  "total_projects": 25,
  "status_distribution": {
    "planned": 5,
    "in_progress": 12,
    "on_hold": 3,
    "completed": 4,
    "canceled": 1
  },
  "active_projects": 17,
  "delayed_tasks_count": 8,
  "projects_with_delays": 4,
  "overdue_tasks_count": 3,
  "upcoming_deadlines": [
    {
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "project_name": "Kitchen Remodel",
      "target_completion_date": "2026-04-15T00:00:00.000Z",
      "days_remaining": 5
    },
    {
      "project_id": "660e8400-e29b-41d4-a716-446655440001",
      "project_name": "Bathroom Renovation",
      "target_completion_date": "2026-04-20T00:00:00.000Z",
      "days_remaining": 10
    }
  ],
  "recent_activity": [
    {
      "activity_type": "task_completed",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "project_name": "Kitchen Remodel",
      "description": "Completed task: Install countertops",
      "user_id": "770e8400-e29b-41d4-a716-446655440002",
      "user_name": "John Smith",
      "created_at": "2026-03-16T10:30:00.000Z"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `total_projects` | number | Total count of projects matching filters (or all if no filters) |
| `status_distribution` | object | Count of projects per status. Always includes all 5 statuses (zero if none). Status distribution is always tenant-wide regardless of filters. |
| `status_distribution.planned` | number | Projects in `planned` status |
| `status_distribution.in_progress` | number | Projects in `in_progress` status |
| `status_distribution.on_hold` | number | Projects in `on_hold` status |
| `status_distribution.completed` | number | Projects in `completed` status |
| `status_distribution.canceled` | number | Projects in `canceled` status |
| `active_projects` | number | Count of `planned` + `in_progress` projects |
| `delayed_tasks_count` | number | Count of tasks with `is_delayed = true` and status not `done` |
| `projects_with_delays` | number | Count of distinct projects that have at least one delayed task |
| `overdue_tasks_count` | number | Live count of tasks where `estimated_end_date < now` and status not `done` |
| `upcoming_deadlines` | array | Up to 10 active projects with `target_completion_date` within next 30 days, sorted by soonest first |
| `upcoming_deadlines[].project_id` | string (UUID) | Project ID |
| `upcoming_deadlines[].project_name` | string | Project name |
| `upcoming_deadlines[].target_completion_date` | string (ISO 8601) | Target completion date |
| `upcoming_deadlines[].days_remaining` | number | Days until target completion date |
| `recent_activity` | array | Last 10 activity entries across all projects for the tenant |
| `recent_activity[].activity_type` | string | Type of activity (e.g., `task_completed`, `task_created`, `status_changed`, `log_added`, `photo_added`, `document_added`, `permit_updated`, `checklist_completed`, `sms_sent`, `crew_assigned`, `task_delayed`, `task_assigned`) |
| `recent_activity[].project_id` | string (UUID) | Associated project ID |
| `recent_activity[].project_name` | string \| null | Project name |
| `recent_activity[].description` | string | Human-readable description |
| `recent_activity[].user_id` | string (UUID) \| null | User who performed the action (null for system actions) |
| `recent_activity[].user_name` | string \| null | Full name of the user (null for system actions) |
| `recent_activity[].created_at` | string (ISO 8601) | When the activity occurred |

### Business Rules

- **Tenant isolation**: All queries are scoped to the authenticated user's `tenant_id` (extracted from JWT).
- **Status distribution**: Always returns tenant-wide counts for all 5 statuses, regardless of query filters. This ensures the donut chart always shows the full picture.
- **Delayed vs overdue**: `delayed_tasks_count` uses the `is_delayed` flag (set by the daily delay check job). `overdue_tasks_count` is a live computation using `estimated_end_date < now`. Both exclude tasks with status `done` and soft-deleted tasks.
- **Upcoming deadlines**: Only shows projects in `planned` or `in_progress` status with a `target_completion_date` within the next 30 days.
- **Recent activity**: Returns the 10 most recent activity entries with joined project name and user name.

### Error Responses

| Status | Description | Body |
|--------|-------------|------|
| 401 | Unauthorized — missing or invalid token | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 403 | Forbidden — insufficient role | `{ "statusCode": 403, "message": "Forbidden resource" }` |

### Example Request

```http
GET /api/v1/projects/dashboard?status=in_progress&assigned_pm_user_id=770e8400-e29b-41d4-a716-446655440002 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 2. GET /projects/dashboard/gantt

### Description

Returns a paginated list of projects with summary data suitable for a gantt chart or detailed project list view. Each project includes task counts (total, completed, delayed), date ranges, contract value, and progress percentage.

### Authentication

- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | — | Filter by project status. Values: `planned`, `in_progress`, `on_hold`, `completed`, `canceled` |
| `assigned_pm_user_id` | string (UUID) | No | — | Filter by assigned project manager |
| `search` | string | No | — | Search by project name or project number (partial match) |
| `page` | number | No | 1 | Page number (1-indexed) |
| `limit` | number | No | 20 | Items per page (max: 100) |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "project_number": "PRJ-0042",
      "name": "Kitchen Remodel",
      "status": "in_progress",
      "start_date": "2026-03-01",
      "target_completion_date": "2026-04-15",
      "actual_completion_date": null,
      "contract_value": 25000.00,
      "progress_percent": 45.00,
      "assigned_pm": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "first_name": "Jane",
        "last_name": "Doe"
      },
      "customer": {
        "id": "880e8400-e29b-41d4-a716-446655440003",
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

### Response Fields — Data Array

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Project ID |
| `project_number` | string | Auto-generated project number (e.g., `PRJ-0042`) |
| `name` | string | Project name |
| `status` | string | Project status: `planned`, `in_progress`, `on_hold`, `completed`, `canceled` |
| `start_date` | string (ISO 8601) \| null | Project start date |
| `target_completion_date` | string (ISO 8601) \| null | Expected completion date |
| `actual_completion_date` | string (ISO 8601) \| null | Actual completion date (set when status becomes `completed`) |
| `contract_value` | number \| null | Contract value from linked quote (null for standalone projects without a value) |
| `progress_percent` | number | Task completion percentage (0.00 – 100.00) |
| `assigned_pm` | object \| null | Assigned project manager |
| `assigned_pm.id` | string (UUID) | PM user ID |
| `assigned_pm.first_name` | string | PM first name |
| `assigned_pm.last_name` | string | PM last name |
| `customer` | object \| null | Customer (lead) linked to the project (null for standalone projects) |
| `customer.id` | string (UUID) | Customer/lead ID |
| `customer.first_name` | string | Customer first name |
| `customer.last_name` | string | Customer last name |
| `task_count` | number | Total number of non-deleted tasks in the project |
| `completed_task_count` | number | Number of tasks with status `done` |
| `delayed_task_count` | number | Number of tasks with `is_delayed = true` and status not `done` |

### Response Fields — Meta

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total number of projects matching the filters |
| `page` | number | Current page number |
| `limit` | number | Items per page |
| `totalPages` | number | Total number of pages |

### Business Rules

- **Tenant isolation**: All queries are scoped to the authenticated user's `tenant_id`.
- **Pagination**: Default page is 1, default limit is 20, maximum limit is 100.
- **Search**: Partial match on `name` and `project_number` fields.
- **Sort order**: Projects are sorted by `created_at` descending (newest first).
- **Task counts**: Only non-deleted tasks are counted. `delayed_task_count` uses the `is_delayed` flag for tasks not yet `done`.
- **Decimal handling**: `contract_value` and `progress_percent` are returned as numbers (not strings).

### Error Responses

| Status | Description | Body |
|--------|-------------|------|
| 401 | Unauthorized — missing or invalid token | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 403 | Forbidden — insufficient role | `{ "statusCode": 403, "message": "Forbidden resource" }` |

### Example Request

```http
GET /api/v1/projects/dashboard/gantt?status=in_progress&search=kitchen&page=1&limit=10 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Shared Information

### Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

The JWT token contains `tenantId`, `userId`, and `roles`. The backend extracts `tenantId` from the JWT — it is never accepted from the client.

### Roles

Both endpoints require one of: **Owner**, **Admin**, or **Manager**.

Other roles (Field, Sales, Bookkeeper) will receive a `403 Forbidden` response.

### Tenant Isolation

Every database query includes `tenant_id` filtering. Users from Tenant A cannot see or access data from Tenant B. This is enforced at the service layer and verified by unit tests.

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-16 | 1.0 | Initial documentation — Sprint 34 |
