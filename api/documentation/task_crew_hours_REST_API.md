# Task Crew Hours REST API Documentation

**Module**: Project Management — Task Crew Hours (Sprint 29)
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT token required on all endpoints
**Multi-Tenant**: All endpoints enforce tenant_id from JWT — never from client

---

## Endpoints Summary

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/projects/:projectId/tasks/:taskId/crew-hours` | Log crew hours for a task | Owner, Admin, Manager |
| GET | `/projects/:projectId/tasks/:taskId/crew-hours` | List crew hours for a task | Owner, Admin, Manager |
| GET | `/crew/:crewMemberId/hours` | Crew member hour summary | Owner, Admin, Manager, Bookkeeper |

---

## 1. POST /projects/:projectId/tasks/:taskId/crew-hours

### Description
Log crew hours for a specific task. The `project_id` and `task_id` are extracted from the URL — the client does not send them in the body. Delegates to `CrewHourLogService.logHours()` with `source='manual'`.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| taskId | UUID | Yes | Task UUID (must belong to the project) |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| crew_member_id | string (UUID) | Yes | Valid UUID, must exist in tenant | Crew member to log hours for |
| log_date | string (ISO date) | Yes | ISO 8601 date format | Date the hours were worked |
| hours_regular | number | Yes | > 0, max 2 decimal places | Regular hours worked |
| hours_overtime | number | No | >= 0, max 2 decimal places | Overtime hours (defaults to 0) |
| notes | string | No | — | Additional notes |

### Request Example

```http
POST /api/v1/projects/550e8400-e29b-41d4-a716-446655440001/tasks/550e8400-e29b-41d4-a716-446655440002/crew-hours
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "crew_member_id": "550e8400-e29b-41d4-a716-446655440000",
  "log_date": "2026-03-15",
  "hours_regular": 8.0,
  "hours_overtime": 2.0,
  "notes": "Framing work on unit 3B"
}
```

### Response — 201 Created

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "tenant-uuid-here",
  "crew_member_id": "550e8400-e29b-41d4-a716-446655440000",
  "project_id": "550e8400-e29b-41d4-a716-446655440001",
  "task_id": "550e8400-e29b-41d4-a716-446655440002",
  "log_date": "2026-03-15T00:00:00.000Z",
  "hours_regular": "8.00",
  "hours_overtime": "2.00",
  "source": "manual",
  "clockin_event_id": null,
  "notes": "Framing work on unit 3B",
  "created_by_user_id": "user-uuid-here",
  "created_at": "2026-03-15T14:22:00.000Z",
  "updated_at": "2026-03-15T14:22:00.000Z",
  "crew_member": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "first_name": "John",
    "last_name": "Doe"
  },
  "project": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Kitchen Remodel",
    "project_number": "P-001"
  },
  "task": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "title": "Install drywall"
  }
}
```

### Error Responses

| Status | Description | Body |
|--------|-------------|------|
| 400 | Validation error (e.g. hours_regular <= 0, invalid UUID) | `{ "statusCode": 400, "message": [...], "error": "Bad Request" }` |
| 401 | Missing or invalid JWT token | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 403 | User role not in [Owner, Admin, Manager] | `{ "statusCode": 403, "message": "Forbidden resource" }` |
| 404 | Project not found, task not in project, or crew member not in tenant | `{ "statusCode": 404, "message": "Project not found" }` or `"Task not found in this project"` or `"Crew member not found or does not belong to this tenant"` |

---

## 2. GET /projects/:projectId/tasks/:taskId/crew-hours

### Description
List all crew hour logs for a specific task within a project. Returns results ordered by `log_date` descending.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| taskId | UUID | Yes | Task UUID (must belong to the project) |

### Request Example

```http
GET /api/v1/projects/550e8400-e29b-41d4-a716-446655440001/tasks/550e8400-e29b-41d4-a716-446655440002/crew-hours
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Response — 200 OK

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tenant_id": "tenant-uuid-here",
    "crew_member_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_id": "550e8400-e29b-41d4-a716-446655440001",
    "task_id": "550e8400-e29b-41d4-a716-446655440002",
    "log_date": "2026-03-15T00:00:00.000Z",
    "hours_regular": "8.00",
    "hours_overtime": "2.00",
    "source": "manual",
    "clockin_event_id": null,
    "notes": "Framing work on unit 3B",
    "created_by_user_id": "user-uuid-here",
    "created_at": "2026-03-15T14:22:00.000Z",
    "updated_at": "2026-03-15T14:22:00.000Z",
    "crew_member": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "first_name": "John",
      "last_name": "Doe"
    },
    "project": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Kitchen Remodel",
      "project_number": "P-001"
    },
    "task": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "title": "Install drywall"
    }
  }
]
```

Returns an empty array `[]` if no hours are logged for this task.

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid JWT token |
| 403 | User role not in [Owner, Admin, Manager] |
| 404 | Project not found or task not in project |

---

## 3. GET /crew/:crewMemberId/hours

### Description
Returns an aggregated hour summary for a crew member across all projects. Includes total regular hours, total overtime hours, total combined hours, and a per-project breakdown.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager, Bookkeeper

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| crewMemberId | UUID | Yes | Crew member UUID |

### Request Example

```http
GET /api/v1/crew/550e8400-e29b-41d4-a716-446655440000/hours
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Response — 200 OK

```json
{
  "crew_member_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_regular_hours": 160.00,
  "total_overtime_hours": 12.50,
  "total_hours": 172.50,
  "logs_by_project": [
    {
      "project_id": "proj-uuid-001",
      "project_name": "Kitchen Remodel",
      "regular_hours": 80.00,
      "overtime_hours": 5.00,
      "total_hours": 85.00
    },
    {
      "project_id": "proj-uuid-002",
      "project_name": "Bathroom Addition",
      "regular_hours": 80.00,
      "overtime_hours": 7.50,
      "total_hours": 87.50
    }
  ]
}
```

When a crew member has no logged hours:

```json
{
  "crew_member_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_regular_hours": 0,
  "total_overtime_hours": 0,
  "total_hours": 0,
  "logs_by_project": []
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| crew_member_id | string (UUID) | The crew member's ID |
| total_regular_hours | number | Sum of all regular hours across all projects |
| total_overtime_hours | number | Sum of all overtime hours across all projects |
| total_hours | number | total_regular_hours + total_overtime_hours |
| logs_by_project | array | Per-project hour breakdown |
| logs_by_project[].project_id | string (UUID) | Project ID |
| logs_by_project[].project_name | string | Project name |
| logs_by_project[].regular_hours | number | Regular hours for this project |
| logs_by_project[].overtime_hours | number | Overtime hours for this project |
| logs_by_project[].total_hours | number | Combined hours for this project |

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid JWT token |
| 403 | User role not in [Owner, Admin, Manager, Bookkeeper] |
| 404 | Crew member not found (or does not belong to this tenant) |

---

## Business Rules

1. **Phase 1**: `source` is always `'manual'` — automated time clock integration is future scope
2. **hours_regular** must be > 0 (minimum 0.01)
3. **hours_overtime** is logged separately and defaults to 0
4. **All queries** enforce `tenant_id` from the JWT — cross-tenant data is never exposed
5. **Audit logging**: Every hour log creation is recorded in the audit log via `AuditLoggerService`
6. The crew member **must exist** and **belong to the same tenant** — otherwise 404

---

## Swagger

All endpoints are documented with Swagger decorators. Access the interactive API docs at:

```
https://api.lead360.app/api/docs
```

Tags: `Task Crew Hours`, `Crew Hours`
