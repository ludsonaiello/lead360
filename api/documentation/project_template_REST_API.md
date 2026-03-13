# Project Templates REST API

**Module**: Project Management
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT token required on all endpoints
**Multi-Tenant**: All data scoped by `tenant_id` derived from JWT — never sent by client

---

## Endpoints Overview

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/project-templates` | Owner, Admin | Create template (with optional tasks) |
| GET | `/project-templates` | Owner, Admin, Manager | List templates (paginated) |
| GET | `/project-templates/:id` | Owner, Admin, Manager | Get template detail |
| PATCH | `/project-templates/:id` | Owner, Admin | Update template |
| DELETE | `/project-templates/:id` | Owner, Admin | Delete template (hard delete) |

---

## 1. POST /project-templates

**Description**: Create a new project template, optionally with tasks in a single transaction.

**Roles**: `Owner`, `Admin`

**Authentication**: Bearer token required

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | **Yes** | min 1, max 200 chars | Template name |
| `description` | string | No | — | Template description |
| `industry_type` | string | No | max 100 chars | e.g. Roofing, Painting, Remodeling |
| `tasks` | array | No | ValidateNested | Array of task objects (see below) |

**Task object fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `title` | string | **Yes** | min 1, max 200 chars | Task title |
| `description` | string | No | — | Task description |
| `estimated_duration_days` | integer | No | >= 1 | Estimated duration in days |
| `category` | enum | No | `labor`, `material`, `subcontractor`, `equipment`, `other` | Task category |
| `order_index` | integer | **Yes** | >= 0, unique within template | Task sequence position |
| `depends_on_order_index` | integer | No | >= 0, must reference valid order_index in same template | Prerequisite task |

### Business Rules
- `order_index` values must be unique within the tasks array
- `depends_on_order_index` must reference an existing `order_index` in the same task list
- A task cannot depend on itself
- Tasks are always returned ordered by `order_index` ASC

### Request Example

```json
{
  "name": "Standard Roofing Project",
  "description": "Complete roof replacement template",
  "industry_type": "Roofing",
  "tasks": [
    {
      "title": "Remove existing shingles",
      "description": "Strip old roofing material",
      "estimated_duration_days": 2,
      "category": "labor",
      "order_index": 0
    },
    {
      "title": "Install underlayment",
      "description": null,
      "estimated_duration_days": 1,
      "category": "material",
      "order_index": 1,
      "depends_on_order_index": 0
    }
  ]
}
```

### Response (201 Created)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
  "name": "Standard Roofing Project",
  "description": "Complete roof replacement template",
  "industry_type": "Roofing",
  "is_active": true,
  "created_by_user_id": "u1u2u3u4-u5u6-7890-abcd-ef1234567890",
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T10:30:00.000Z",
  "tasks": [
    {
      "id": "task-uuid-001",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
      "title": "Remove existing shingles",
      "description": "Strip old roofing material",
      "estimated_duration_days": 2,
      "category": "labor",
      "order_index": 0,
      "depends_on_order_index": null,
      "created_at": "2026-01-15T10:30:00.000Z",
      "updated_at": "2026-01-15T10:30:00.000Z"
    },
    {
      "id": "task-uuid-002",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
      "title": "Install underlayment",
      "description": null,
      "estimated_duration_days": 1,
      "category": "material",
      "order_index": 1,
      "depends_on_order_index": 0,
      "created_at": "2026-01-15T10:30:00.000Z",
      "updated_at": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error (missing name, invalid task fields, invalid dependency) |
| 401 | Unauthorized — no/invalid token |
| 403 | Forbidden — role not Owner or Admin |

**400 Example — Invalid dependency**:
```json
{
  "statusCode": 400,
  "message": "Task at order_index 1 references depends_on_order_index 5 which does not exist in the task list"
}
```

---

## 2. GET /project-templates

**Description**: List project templates with pagination and optional filters.

**Roles**: `Owner`, `Admin`, `Manager`

**Authentication**: Bearer token required

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `limit` | integer | 20 | Items per page (max 100) |
| `is_active` | boolean | — | Filter by active status |
| `industry_type` | string | — | Filter by industry type (exact match) |

### Request Example

```
GET /api/v1/project-templates?page=1&limit=20&is_active=true&industry_type=Roofing
```

### Response (200 OK)

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
      "name": "Standard Roofing Project",
      "description": "Complete roof replacement template",
      "industry_type": "Roofing",
      "is_active": true,
      "created_by_user_id": "u1u2u3u4-u5u6-7890-abcd-ef1234567890",
      "created_at": "2026-01-15T10:30:00.000Z",
      "updated_at": "2026-01-15T10:30:00.000Z",
      "tasks": [
        {
          "id": "task-uuid-001",
          "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
          "title": "Remove existing shingles",
          "description": "Strip old roofing material",
          "estimated_duration_days": 2,
          "category": "labor",
          "order_index": 0,
          "depends_on_order_index": null,
          "created_at": "2026-01-15T10:30:00.000Z",
          "updated_at": "2026-01-15T10:30:00.000Z"
        }
      ]
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden — role not Owner, Admin, or Manager |

---

## 3. GET /project-templates/:id

**Description**: Get a single project template with its tasks.

**Roles**: `Owner`, `Admin`, `Manager`

**Authentication**: Bearer token required

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Project template ID |

### Response (200 OK)

Same shape as a single object from the list response — template object with nested `tasks` array ordered by `order_index`.

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Project template not found (or belongs to another tenant) |

**404 Example**:
```json
{
  "statusCode": 404,
  "message": "Project template not found"
}
```

---

## 4. PATCH /project-templates/:id

**Description**: Update a project template. If `tasks` array is provided, all existing tasks are deleted and replaced with the new set.

**Roles**: `Owner`, `Admin`

**Authentication**: Bearer token required

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Project template ID |

### Request Body

All fields are optional. Only provided fields are updated.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Template name (max 200) |
| `description` | string | Template description |
| `industry_type` | string | Industry type (max 100) |
| `is_active` | boolean | Active status |
| `tasks` | array | **Replaces all tasks** — same structure as create |

### Important Behavior
- If `tasks` is **not provided**: existing tasks are untouched
- If `tasks` is **provided** (even empty array): all existing tasks are deleted and replaced
- Task dependency validation is applied to the new task set

### Request Example — Update name only

```json
{
  "name": "Updated Roofing Template"
}
```

### Request Example — Replace tasks

```json
{
  "tasks": [
    { "title": "New Task 1", "order_index": 0, "category": "labor" },
    { "title": "New Task 2", "order_index": 1, "depends_on_order_index": 0 }
  ]
}
```

### Response (200 OK)

Full template object with tasks (same shape as create response).

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error or invalid task dependencies |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Project template not found |

---

## 5. DELETE /project-templates/:id

**Description**: Hard delete a project template and all its tasks (cascaded).

**Roles**: `Owner`, `Admin`

**Authentication**: Bearer token required

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Project template ID |

### Response (204 No Content)

Empty response body.

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Project template not found |

---

## Data Types Reference

### project_task_category enum

| Value | Description |
|-------|-------------|
| `labor` | Labor costs |
| `material` | Material costs |
| `subcontractor` | Subcontractor costs |
| `equipment` | Equipment costs |
| `other` | Other costs |

---

## Audit Logging

All write operations (create, update, delete) produce audit log entries with:
- `entity_type`: `project_template`
- `action`: `created` | `updated` | `deleted`
- `actor_user_id`: The user who performed the action
- `tenant_id`: The tenant context
- Before/after state snapshots

---

## Notes for Frontend Integration

- **API Base URL**: `https://api.lead360.app/api/v1`
- **Authentication**: Send `Authorization: Bearer {token}` header
- **tenant_id**: Never send from client — derived from JWT server-side
- Tasks are always returned ordered by `order_index` ASC
- When updating tasks, send the complete task list — partial task updates are not supported
- The `project_task_category` enum values are lowercase strings
