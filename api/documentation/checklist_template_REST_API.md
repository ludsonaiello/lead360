# Checklist Template REST API

**Module**: Project Management — Completion Checklist Templates
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT required on all endpoints
**Tenant Isolation**: All queries scoped to tenant from JWT

---

## Overview

Completion checklist templates are tenant-defined templates that list items required for project completion. Each template has a unique name per tenant and contains ordered checklist items. Templates are managed under Settings and referenced during the project completion flow.

---

## Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/settings/checklist-templates` | Owner, Admin | Create a checklist template with items |
| GET | `/settings/checklist-templates` | Owner, Admin, Manager | List templates (paginated) |
| GET | `/settings/checklist-templates/:id` | Owner, Admin, Manager | Get template detail with items |
| PATCH | `/settings/checklist-templates/:id` | Owner, Admin | Update template (replaces items if provided) |
| DELETE | `/settings/checklist-templates/:id` | Owner, Admin | Delete template (hard delete, cascades items) |

---

## POST /settings/checklist-templates

Create a new completion checklist template with its items.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | yes | 1–200 chars | Template name (unique per tenant) |
| `description` | string | no | — | Template description |
| `items` | array | yes | min 1 item | Array of checklist items |
| `items[].title` | string | yes | 1–300 chars | Item title |
| `items[].description` | string | no | — | Item description |
| `items[].is_required` | boolean | no | — | Whether required for completion (default: `true`) |
| `items[].order_index` | integer | yes | >= 0 | Display order (0-based) |

### Example Request

```http
POST /api/v1/settings/checklist-templates HTTP/1.1
Host: api.lead360.app
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "name": "Standard Roofing Completion",
  "description": "Checklist for residential roofing projects",
  "items": [
    {
      "title": "Final inspection passed",
      "description": null,
      "is_required": true,
      "order_index": 0
    },
    {
      "title": "Customer walkthrough completed",
      "description": "Walk customer through all work",
      "is_required": true,
      "order_index": 1
    },
    {
      "title": "Debris cleanup",
      "is_required": true,
      "order_index": 2
    },
    {
      "title": "Warranty documentation provided",
      "is_required": false,
      "order_index": 3
    }
  ]
}
```

### Example Response — 201 Created

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
  "name": "Standard Roofing Completion",
  "description": "Checklist for residential roofing projects",
  "is_active": true,
  "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "created_at": "2026-01-15T10:00:00.000Z",
  "updated_at": "2026-01-15T10:00:00.000Z",
  "items": [
    {
      "id": "i1000000-0000-0000-0000-000000000001",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Final inspection passed",
      "description": null,
      "is_required": true,
      "order_index": 0,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "i1000000-0000-0000-0000-000000000002",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Customer walkthrough completed",
      "description": "Walk customer through all work",
      "is_required": true,
      "order_index": 1,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "i1000000-0000-0000-0000-000000000003",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Debris cleanup",
      "description": null,
      "is_required": true,
      "order_index": 2,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "i1000000-0000-0000-0000-000000000004",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Warranty documentation provided",
      "description": null,
      "is_required": false,
      "order_index": 3,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    }
  ]
}
```

### Error Responses

| Status | Condition | Example Message |
|--------|-----------|-----------------|
| 400 | Validation error (missing/invalid fields) | `"Validation failed"` |
| 401 | Missing or invalid JWT | `"Unauthorized"` |
| 403 | User role not Owner or Admin | `"Forbidden"` |
| 409 | Template name already exists for tenant | `"A checklist template with this name already exists"` |

---

## GET /settings/checklist-templates

List all checklist templates for the authenticated tenant, paginated.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | no | 1 | Page number (1-indexed) |
| `limit` | integer | no | 20 | Items per page (max: 100) |
| `is_active` | boolean | no | — | Filter by active/inactive status |

### Example Request

```http
GET /api/v1/settings/checklist-templates?page=1&limit=20&is_active=true HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Example Response — 200 OK

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "name": "Standard Roofing Completion",
      "description": "Checklist for residential roofing projects",
      "is_active": true,
      "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z",
      "items": [
        {
          "id": "i1000000-0000-0000-0000-000000000001",
          "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
          "title": "Final inspection passed",
          "description": null,
          "is_required": true,
          "order_index": 0,
          "created_at": "2026-01-15T10:00:00.000Z",
          "updated_at": "2026-01-15T10:00:00.000Z"
        }
      ]
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Error Responses

| Status | Condition | Example Message |
|--------|-----------|-----------------|
| 401 | Missing or invalid JWT | `"Unauthorized"` |
| 403 | User role not Owner, Admin, or Manager | `"Forbidden"` |

---

## GET /settings/checklist-templates/:id

Get a single checklist template with all its items.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | yes | Checklist template ID |

### Example Request

```http
GET /api/v1/settings/checklist-templates/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Example Response — 200 OK

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
  "name": "Standard Roofing Completion",
  "description": "Checklist for residential roofing projects",
  "is_active": true,
  "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "created_at": "2026-01-15T10:00:00.000Z",
  "updated_at": "2026-01-15T10:00:00.000Z",
  "items": [
    {
      "id": "i1000000-0000-0000-0000-000000000001",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Final inspection passed",
      "description": null,
      "is_required": true,
      "order_index": 0,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "i1000000-0000-0000-0000-000000000002",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Customer walkthrough completed",
      "description": "Walk customer through all work",
      "is_required": true,
      "order_index": 1,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "i1000000-0000-0000-0000-000000000003",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Debris cleanup",
      "description": null,
      "is_required": true,
      "order_index": 2,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "i1000000-0000-0000-0000-000000000004",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Warranty documentation provided",
      "description": null,
      "is_required": false,
      "order_index": 3,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    }
  ]
}
```

### Error Responses

| Status | Condition | Example Message |
|--------|-----------|-----------------|
| 401 | Missing or invalid JWT | `"Unauthorized"` |
| 403 | User role not Owner, Admin, or Manager | `"Forbidden"` |
| 404 | Template not found or belongs to different tenant | `"Checklist template not found"` |

---

## PATCH /settings/checklist-templates/:id

Update a checklist template. If `items` array is provided, **all existing items are replaced** with the new set (delete-then-insert in a transaction).

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | yes | Checklist template ID |

### Request Body

All fields are optional. Only provided fields are updated.

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | no | 1–200 chars | Template name (must remain unique per tenant) |
| `description` | string | no | — | Template description |
| `is_active` | boolean | no | — | Whether the template is active |
| `items` | array | no | — | If provided, replaces ALL existing items |
| `items[].title` | string | yes (if items provided) | 1–300 chars | Item title |
| `items[].description` | string | no | — | Item description |
| `items[].is_required` | boolean | no | — | Whether required (default: `true`) |
| `items[].order_index` | integer | yes (if items provided) | >= 0 | Display order |

### Example Request — Update name and description only

```http
PATCH /api/v1/settings/checklist-templates/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: api.lead360.app
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "name": "Premium Roofing Completion",
  "description": "Updated checklist for premium roofing projects"
}
```

### Example Request — Replace all items

```http
PATCH /api/v1/settings/checklist-templates/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: api.lead360.app
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "items": [
    { "title": "Final inspection passed", "is_required": true, "order_index": 0 },
    { "title": "Customer signed off", "is_required": true, "order_index": 1 },
    { "title": "Photos uploaded", "is_required": false, "order_index": 2 }
  ]
}
```

### Example Response — 200 OK

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
  "name": "Premium Roofing Completion",
  "description": "Updated checklist for premium roofing projects",
  "is_active": true,
  "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "created_at": "2026-01-15T10:00:00.000Z",
  "updated_at": "2026-01-16T14:30:00.000Z",
  "items": [
    {
      "id": "i2000000-0000-0000-0000-000000000001",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Final inspection passed",
      "description": null,
      "is_required": true,
      "order_index": 0,
      "created_at": "2026-01-16T14:30:00.000Z",
      "updated_at": "2026-01-16T14:30:00.000Z"
    },
    {
      "id": "i2000000-0000-0000-0000-000000000002",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Customer signed off",
      "description": null,
      "is_required": true,
      "order_index": 1,
      "created_at": "2026-01-16T14:30:00.000Z",
      "updated_at": "2026-01-16T14:30:00.000Z"
    },
    {
      "id": "i2000000-0000-0000-0000-000000000003",
      "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
      "title": "Photos uploaded",
      "description": null,
      "is_required": false,
      "order_index": 2,
      "created_at": "2026-01-16T14:30:00.000Z",
      "updated_at": "2026-01-16T14:30:00.000Z"
    }
  ]
}
```

### Error Responses

| Status | Condition | Example Message |
|--------|-----------|-----------------|
| 400 | Validation error | `"Validation failed"` |
| 401 | Missing or invalid JWT | `"Unauthorized"` |
| 403 | User role not Owner or Admin | `"Forbidden"` |
| 404 | Template not found or belongs to different tenant | `"Checklist template not found"` |
| 409 | New name conflicts with existing template | `"A checklist template with this name already exists"` |

---

## DELETE /settings/checklist-templates/:id

Hard delete a checklist template. All associated items are cascade-deleted.

### Authentication
- **Required**: Yes (Bearer JWT)
- **Roles**: Owner, Admin

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | yes | Checklist template ID |

### Example Request

```http
DELETE /api/v1/settings/checklist-templates/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Response — 204 No Content

No response body.

### Error Responses

| Status | Condition | Example Message |
|--------|-----------|-----------------|
| 401 | Missing or invalid JWT | `"Unauthorized"` |
| 403 | User role not Owner or Admin | `"Forbidden"` |
| 404 | Template not found or belongs to different tenant | `"Checklist template not found"` |

---

## Data Models

### completion_checklist_template

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID (VarChar 36) | no | auto-generated | Primary key |
| `tenant_id` | UUID (VarChar 36) | no | — | FK → tenant |
| `name` | VarChar(200) | no | — | Template name |
| `description` | Text | yes | null | Template description |
| `is_active` | Boolean | no | true | Whether active |
| `created_by_user_id` | UUID (VarChar 36) | no | — | FK → user |
| `created_at` | DateTime | no | now() | Creation timestamp |
| `updated_at` | DateTime | no | auto | Last update timestamp |

**Unique constraint**: `(tenant_id, name)` — no duplicate names per tenant.

### completion_checklist_template_item

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID (VarChar 36) | no | auto-generated | Primary key |
| `template_id` | UUID (VarChar 36) | no | — | FK → completion_checklist_template |
| `tenant_id` | UUID (VarChar 36) | no | — | Tenant isolation |
| `title` | VarChar(300) | no | — | Item title |
| `description` | Text | yes | null | Item description |
| `is_required` | Boolean | no | true | Required for completion |
| `order_index` | Int | no | — | Display order |
| `created_at` | DateTime | no | now() | Creation timestamp |
| `updated_at` | DateTime | no | auto | Last update timestamp |

---

## Business Rules

1. **Template names are unique per tenant** — attempting to create or rename to a duplicate name returns 409.
2. **Items are always returned ordered by `order_index` ascending**.
3. **On update with items**: existing items are fully replaced (delete all, insert new) in a transaction.
4. **On delete**: all items are cascade-deleted via FK constraint.
5. **Tenant isolation**: all operations scoped to the tenant from the JWT — no cross-tenant access possible.
6. **Audit logging**: all create, update, and delete operations generate audit log entries.

---

## Frontend Integration Notes

- **API Base URL**: `https://api.lead360.app/api/v1`
- **Authentication**: Bearer token required (from JWT login)
- **Pagination**: Standard `{ data, meta }` format with `page`, `limit`, `total`, `totalPages`
- **Error format**: Standard `{ statusCode, message, error?, errors? }` format
- **Items replacement**: When updating items, send the complete new set — partial item updates are not supported
- **`is_required` default**: If omitted in create/update items, defaults to `true`
