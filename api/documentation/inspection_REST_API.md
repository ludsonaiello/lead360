# Inspection REST API Documentation

**Module**: Project Management — Inspection Lifecycle
**Sprint**: 23
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT required on all endpoints
**Tenant Isolation**: All queries scoped by `tenant_id` from JWT

---

## Overview

Inspections are linked to permits and track the inspection lifecycle for construction projects. Multiple inspections can exist per permit. When an inspection result is set to `fail`, the system automatically sets `reinspection_required` to `true`.

---

## Endpoints Summary

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/projects/:projectId/permits/:permitId/inspections` | Create inspection | Owner, Admin, Manager |
| GET | `/projects/:projectId/permits/:permitId/inspections` | List inspections for permit | Owner, Admin, Manager |
| PATCH | `/projects/:projectId/permits/:permitId/inspections/:id` | Update inspection | Owner, Admin, Manager |
| DELETE | `/projects/:projectId/permits/:permitId/inspections/:id` | Hard delete inspection | Owner, Admin |

---

## Data Types

### Inspection Result Enum

```
pass | fail | conditional | pending
```

### Inspection Response Object

```json
{
  "id": "uuid",
  "permit_id": "uuid",
  "project_id": "uuid",
  "inspection_type": "string (max 200)",
  "scheduled_date": "YYYY-MM-DD | null",
  "inspector_name": "string | null",
  "result": "pass | fail | conditional | pending | null",
  "reinspection_required": "boolean",
  "reinspection_date": "YYYY-MM-DD | null",
  "notes": "string | null",
  "inspected_by_user_id": "uuid | null",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

---

## 1. Create Inspection

**POST** `/projects/:projectId/permits/:permitId/inspections`

### Description

Creates a new inspection record linked to a permit. Validates that the permit exists and belongs to the specified project and tenant. If `result` is set to `fail`, `reinspection_required` is automatically set to `true`.

### Authentication

Required. Bearer JWT.

### Authorization

Roles: **Owner**, **Admin**, **Manager**

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| permitId | UUID | Yes | Permit UUID |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| inspection_type | string | **Yes** | Max 200 chars, non-empty | Type of inspection (e.g. Framing, Electrical Rough-In, Final) |
| scheduled_date | string | No | ISO date (YYYY-MM-DD) | Scheduled date for the inspection |
| inspector_name | string | No | Max 200 chars | Name of the inspector |
| result | enum | No | pass, fail, conditional, pending | Inspection result |
| reinspection_required | boolean | No | — | Whether reinspection is required (auto-set to true if result = fail) |
| reinspection_date | string | No | ISO date (YYYY-MM-DD) | Scheduled reinspection date |
| notes | string | No | Max 65535 chars | Additional notes |
| inspected_by_user_id | UUID | No | Valid UUID v4 | Internal user who performed the inspection |

### Request Example

```http
POST /api/v1/projects/a1b2c3d4-0001-0000-0000-000000000001/permits/b2c3d4e5-0002-0000-0000-000000000002/inspections HTTP/1.1
Host: api.lead360.app
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "inspection_type": "Framing",
  "scheduled_date": "2026-04-10",
  "inspector_name": "John Inspector",
  "result": "pending",
  "notes": "Pre-scheduled framing inspection"
}
```

### Response — 201 Created

```json
{
  "id": "c3d4e5f6-0003-0000-0000-000000000003",
  "permit_id": "b2c3d4e5-0002-0000-0000-000000000002",
  "project_id": "a1b2c3d4-0001-0000-0000-000000000001",
  "inspection_type": "Framing",
  "scheduled_date": "2026-04-10",
  "inspector_name": "John Inspector",
  "result": "pending",
  "reinspection_required": false,
  "reinspection_date": null,
  "notes": "Pre-scheduled framing inspection",
  "inspected_by_user_id": null,
  "created_at": "2026-04-01T10:00:00.000Z",
  "updated_at": "2026-04-01T10:00:00.000Z"
}
```

### Response — 201 Created (with result = fail)

When `result` is `fail`, `reinspection_required` is auto-set to `true`:

```json
{
  "id": "c3d4e5f6-0003-0000-0000-000000000003",
  "permit_id": "b2c3d4e5-0002-0000-0000-000000000002",
  "project_id": "a1b2c3d4-0001-0000-0000-000000000001",
  "inspection_type": "Electrical Rough-In",
  "scheduled_date": "2026-04-12",
  "inspector_name": "Jane Inspector",
  "result": "fail",
  "reinspection_required": true,
  "reinspection_date": null,
  "notes": "Missing GFCI outlets in bathroom",
  "inspected_by_user_id": null,
  "created_at": "2026-04-12T14:30:00.000Z",
  "updated_at": "2026-04-12T14:30:00.000Z"
}
```

### Error Responses

| Status | Description | Example |
|--------|-------------|---------|
| 400 | Validation error | `{ "statusCode": 400, "message": "Validation failed", "errors": [{ "field": "inspection_type", "message": "Inspection type is required" }] }` |
| 401 | Missing or invalid JWT | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 403 | Insufficient role | `{ "statusCode": 403, "message": "Forbidden" }` |
| 404 | Permit not found (or wrong tenant/project) | `{ "statusCode": 404, "message": "Permit not found" }` |

---

## 2. List Inspections for Permit

**GET** `/projects/:projectId/permits/:permitId/inspections`

### Description

Returns all active (non-soft-deleted) inspections for a specific permit, ordered by `created_at` descending.

### Authentication

Required. Bearer JWT.

### Authorization

Roles: **Owner**, **Admin**, **Manager**

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| permitId | UUID | Yes | Permit UUID |

### Request Example

```http
GET /api/v1/projects/a1b2c3d4-0001-0000-0000-000000000001/permits/b2c3d4e5-0002-0000-0000-000000000002/inspections HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response — 200 OK

```json
[
  {
    "id": "c3d4e5f6-0003-0000-0000-000000000003",
    "permit_id": "b2c3d4e5-0002-0000-0000-000000000002",
    "project_id": "a1b2c3d4-0001-0000-0000-000000000001",
    "inspection_type": "Framing",
    "scheduled_date": "2026-04-10",
    "inspector_name": "John Inspector",
    "result": "pass",
    "reinspection_required": false,
    "reinspection_date": null,
    "notes": "All structural elements approved",
    "inspected_by_user_id": null,
    "created_at": "2026-04-01T10:00:00.000Z",
    "updated_at": "2026-04-10T15:30:00.000Z"
  },
  {
    "id": "d4e5f6a7-0004-0000-0000-000000000004",
    "permit_id": "b2c3d4e5-0002-0000-0000-000000000002",
    "project_id": "a1b2c3d4-0001-0000-0000-000000000001",
    "inspection_type": "Foundation",
    "scheduled_date": "2026-03-20",
    "inspector_name": "John Inspector",
    "result": "conditional",
    "reinspection_required": false,
    "reinspection_date": null,
    "notes": "Minor footing adjustment needed",
    "inspected_by_user_id": "e5f6a7b8-0005-0000-0000-000000000005",
    "created_at": "2026-03-15T09:00:00.000Z",
    "updated_at": "2026-03-20T16:00:00.000Z"
  }
]
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |
| 404 | Permit not found (or wrong tenant/project) |

---

## 3. Update Inspection

**PATCH** `/projects/:projectId/permits/:permitId/inspections/:id`

### Description

Partially updates an inspection record. Only provided fields are updated. Setting `result` to `fail` automatically sets `reinspection_required` to `true`. All fields are optional.

### Authentication

Required. Bearer JWT.

### Authorization

Roles: **Owner**, **Admin**, **Manager**

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| permitId | UUID | Yes | Permit UUID |
| id | UUID | Yes | Inspection UUID |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| inspection_type | string | No | Max 200 chars | Type of inspection |
| scheduled_date | string | No | ISO date (YYYY-MM-DD) | Scheduled date |
| inspector_name | string | No | Max 200 chars | Inspector name |
| result | enum | No | pass, fail, conditional, pending | Inspection result. `fail` auto-sets `reinspection_required = true` |
| reinspection_required | boolean | No | — | Whether reinspection is required |
| reinspection_date | string | No | ISO date (YYYY-MM-DD) | Reinspection date |
| notes | string | No | Max 65535 chars | Notes |
| inspected_by_user_id | UUID | No | Valid UUID v4 | Internal user who performed the inspection |

### Request Example — Update result to pass

```http
PATCH /api/v1/projects/a1b2c3d4-0001-0000-0000-000000000001/permits/b2c3d4e5-0002-0000-0000-000000000002/inspections/c3d4e5f6-0003-0000-0000-000000000003 HTTP/1.1
Host: api.lead360.app
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "result": "pass",
  "notes": "All structural elements approved"
}
```

### Response — 200 OK

```json
{
  "id": "c3d4e5f6-0003-0000-0000-000000000003",
  "permit_id": "b2c3d4e5-0002-0000-0000-000000000002",
  "project_id": "a1b2c3d4-0001-0000-0000-000000000001",
  "inspection_type": "Framing",
  "scheduled_date": "2026-04-10",
  "inspector_name": "John Inspector",
  "result": "pass",
  "reinspection_required": false,
  "reinspection_date": null,
  "notes": "All structural elements approved",
  "inspected_by_user_id": null,
  "created_at": "2026-04-01T10:00:00.000Z",
  "updated_at": "2026-04-10T15:30:00.000Z"
}
```

### Request Example — Update result to fail (auto-sets reinspection)

```http
PATCH /api/v1/projects/a1b2c3d4-0001-0000-0000-000000000001/permits/b2c3d4e5-0002-0000-0000-000000000002/inspections/c3d4e5f6-0003-0000-0000-000000000003 HTTP/1.1
Host: api.lead360.app
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "result": "fail",
  "notes": "Cross braces missing on south wall",
  "reinspection_date": "2026-04-17"
}
```

### Response — 200 OK

```json
{
  "id": "c3d4e5f6-0003-0000-0000-000000000003",
  "permit_id": "b2c3d4e5-0002-0000-0000-000000000002",
  "project_id": "a1b2c3d4-0001-0000-0000-000000000001",
  "inspection_type": "Framing",
  "scheduled_date": "2026-04-10",
  "inspector_name": "John Inspector",
  "result": "fail",
  "reinspection_required": true,
  "reinspection_date": "2026-04-17",
  "notes": "Cross braces missing on south wall",
  "inspected_by_user_id": null,
  "created_at": "2026-04-01T10:00:00.000Z",
  "updated_at": "2026-04-10T16:00:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |
| 404 | Inspection not found (or wrong tenant/project/permit) |

---

## 4. Delete Inspection

**DELETE** `/projects/:projectId/permits/:permitId/inspections/:id`

### Description

Permanently removes an inspection record from the database (hard delete). No cascading constraints block inspection deletion.

### Authentication

Required. Bearer JWT.

### Authorization

Roles: **Owner**, **Admin**

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| permitId | UUID | Yes | Permit UUID |
| id | UUID | Yes | Inspection UUID |

### Request Example

```http
DELETE /api/v1/projects/a1b2c3d4-0001-0000-0000-000000000001/permits/b2c3d4e5-0002-0000-0000-000000000002/inspections/c3d4e5f6-0003-0000-0000-000000000003 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response — 204 No Content

Empty response body.

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |
| 404 | Inspection not found (or wrong tenant/project/permit) |

---

## Business Rules

1. **Fail auto-triggers reinspection flag**: When `result` is set to `fail` (on create or update), `reinspection_required` is automatically set to `true`.

2. **Multiple inspections per permit**: A permit can have any number of inspections. There is no limit.

3. **Tenant isolation**: All queries are scoped by `tenant_id` extracted from the JWT. A user in Tenant A cannot see, create, update, or delete inspections belonging to Tenant B.

4. **Permit ownership validation**: On create and list operations, the system verifies the permit exists and belongs to the specified project and tenant. On update and delete, the inspection itself is validated against tenant, project, and permit.

5. **Soft-deleted records excluded**: `findByPermit` and `update` exclude records where `deleted_at` is not null. Hard delete includes all records regardless of `deleted_at`.

6. **Permit hard-delete blocked by inspections**: A permit cannot be hard-deleted while it has linked inspections (returns 409 Conflict). Use permit deactivation (soft delete) instead.

---

## Audit Logging

All write operations (create, update, delete) generate audit log entries with:

- **action**: `created`, `updated`, or `deleted`
- **entityType**: `inspection`
- **entityId**: Inspection UUID
- **tenantId**: Tenant UUID
- **actorUserId**: User who performed the action
- **before**: Previous state (for updates and deletes)
- **after**: New state (for creates and updates)

---

## Inspection in Permit Response

Inspections are automatically included in permit responses (GET single permit, GET permit list). Each permit response includes an `inspections` array:

```json
{
  "id": "permit-uuid",
  "project_id": "project-uuid",
  "permit_type": "Building",
  "status": "approved",
  "inspections": [
    {
      "id": "inspection-uuid",
      "inspection_type": "Framing",
      "result": "pass",
      ...
    }
  ],
  ...
}
```

---

## Database Schema

### Table: `inspection`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | VARCHAR(36) | NO | uuid() | Primary key |
| tenant_id | VARCHAR(36) | NO | — | FK → tenant |
| permit_id | VARCHAR(36) | NO | — | FK → permit |
| project_id | VARCHAR(36) | NO | — | FK → project |
| inspection_type | VARCHAR(200) | NO | — | e.g. Framing, Electrical Rough-In, Final |
| scheduled_date | DATE | YES | null | |
| inspector_name | VARCHAR(200) | YES | null | |
| result | ENUM('pass','fail','conditional','pending') | YES | null | |
| reinspection_required | BOOLEAN | NO | false | |
| reinspection_date | DATE | YES | null | |
| notes | TEXT | YES | null | |
| inspected_by_user_id | VARCHAR(36) | YES | null | FK → user (SetNull on delete) |
| deleted_at | DATETIME | YES | null | Soft delete flag |
| created_at | DATETIME | NO | now() | |
| updated_at | DATETIME | NO | auto | |

### Indexes

- `(tenant_id, permit_id)` — Primary query path
- `(tenant_id, project_id)` — Cross-permit project queries

### Foreign Keys

- `tenant_id` → `tenant.id` (CASCADE)
- `permit_id` → `permit.id` (CASCADE)
- `project_id` → `project.id` (CASCADE)
- `inspected_by_user_id` → `user.id` (SET NULL)
