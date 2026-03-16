# Permit REST API Documentation

**Module**: Project Management — Permit Tracking
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT token required on all endpoints
**Sprint**: 22

---

## Overview

Permits track regulatory approvals required for a project (Building, Electrical, Plumbing, etc.). Each project can have multiple permits. Permits follow a lifecycle: `pending_application → submitted → approved → active → closed` (or `failed` at any point).

---

## Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/projects/:projectId/permits` | Create a permit | Owner, Admin, Manager |
| GET | `/projects/:projectId/permits` | List permits for a project | Owner, Admin, Manager |
| GET | `/projects/:projectId/permits/:id` | Get a single permit | Owner, Admin, Manager |
| PATCH | `/projects/:projectId/permits/:id` | Update a permit | Owner, Admin, Manager |
| DELETE | `/projects/:projectId/permits/:id` | Hard delete a permit | Owner, Admin |
| PATCH | `/projects/:projectId/permits/:id/deactivate` | Soft delete (deactivate) a permit | Owner, Admin |

---

## Permit Status Values

| Status | Description |
|--------|-------------|
| `not_required` | Permit is not required for this project |
| `pending_application` | Application has not been submitted yet (default) |
| `submitted` | Application submitted to issuing authority |
| `approved` | Permit has been approved |
| `active` | Permit is active and work can proceed |
| `failed` | Application was denied or failed |
| `closed` | Permit has been closed / work completed |

**Status Transition Flow**: `pending_application → submitted → approved → active → closed`
**Failed**: Can occur at any point in the flow.

---

## Response Shape

All permit endpoints return this shape (or an array of it):

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "permit_number": "BP-2026-0001",
  "permit_type": "Building",
  "status": "approved",
  "submitted_date": "2026-03-01",
  "approved_date": "2026-03-15",
  "expiry_date": "2027-03-15",
  "issuing_authority": "City of Boston",
  "notes": null,
  "inspections": [],
  "created_at": "2026-03-01T10:00:00.000Z",
  "updated_at": "2026-03-15T14:00:00.000Z"
}
```

**Notes**:
- `inspections` is always an empty array `[]` until Sprint 23 adds the inspection entity.
- Dates (`submitted_date`, `approved_date`, `expiry_date`) are returned as `YYYY-MM-DD` strings or `null`.
- `created_at` and `updated_at` are ISO 8601 timestamps.

---

## POST /projects/:projectId/permits

Create a new permit for a project.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| permit_type | string | Yes | max 200 chars | e.g. Building, Electrical, Plumbing |
| permit_number | string | No | max 100 chars | Number assigned by issuing authority |
| status | string | No | enum (see above) | Default: `pending_application` |
| submitted_date | string | No | ISO date (YYYY-MM-DD) | Date application was submitted |
| approved_date | string | No | ISO date (YYYY-MM-DD) | Date permit was approved |
| expiry_date | string | No | ISO date (YYYY-MM-DD) | Permit expiry date |
| issuing_authority | string | No | max 200 chars | Authority that issues the permit |
| notes | string | No | max 65535 chars | Free-text notes |

### Business Rules

- If `status` is set to `approved` and `approved_date` is not provided, `approved_date` is auto-set to today.

### Request Example

```http
POST /api/v1/projects/550e8400-e29b-41d4-a716-446655440000/permits
Authorization: Bearer {token}
Content-Type: application/json

{
  "permit_type": "Building",
  "permit_number": "BP-2026-0001",
  "issuing_authority": "City of Boston",
  "notes": "Requires structural engineer sign-off"
}
```

### Response — 201 Created

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "permit_number": "BP-2026-0001",
  "permit_type": "Building",
  "status": "pending_application",
  "submitted_date": null,
  "approved_date": null,
  "expiry_date": null,
  "issuing_authority": "City of Boston",
  "notes": "Requires structural engineer sign-off",
  "inspections": [],
  "created_at": "2026-03-15T10:00:00.000Z",
  "updated_at": "2026-03-15T10:00:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validation error (missing required fields, invalid enum) |
| 401 | Missing or invalid JWT token |
| 403 | User role is not Owner, Admin, or Manager |
| 404 | Project not found (or not in this tenant) |

---

## GET /projects/:projectId/permits

List all permits for a project. Excludes soft-deleted (deactivated) permits.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| status | string | No | — | Filter by permit status (e.g. `approved`, `active`) |

### Request Example

```http
GET /api/v1/projects/550e8400-e29b-41d4-a716-446655440000/permits?status=approved
Authorization: Bearer {token}
```

### Response — 200 OK

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "permit_number": "BP-2026-0001",
    "permit_type": "Building",
    "status": "approved",
    "submitted_date": "2026-03-01",
    "approved_date": "2026-03-15",
    "expiry_date": "2027-03-15",
    "issuing_authority": "City of Boston",
    "notes": null,
    "inspections": [],
    "created_at": "2026-03-01T10:00:00.000Z",
    "updated_at": "2026-03-15T14:00:00.000Z"
  }
]
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | User role is not Owner, Admin, or Manager |
| 404 | Project not found (or not in this tenant) |

---

## GET /projects/:projectId/permits/:id

Get a single permit by ID.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| id | UUID | Yes | Permit UUID |

### Request Example

```http
GET /api/v1/projects/550e8400-e29b-41d4-a716-446655440000/permits/a1b2c3d4-e5f6-7890-abcd-ef1234567890
Authorization: Bearer {token}
```

### Response — 200 OK

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "permit_number": "BP-2026-0001",
  "permit_type": "Building",
  "status": "approved",
  "submitted_date": "2026-03-01",
  "approved_date": "2026-03-15",
  "expiry_date": "2027-03-15",
  "issuing_authority": "City of Boston",
  "notes": null,
  "inspections": [],
  "created_at": "2026-03-01T10:00:00.000Z",
  "updated_at": "2026-03-15T14:00:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | User role is not Owner, Admin, or Manager |
| 404 | Permit not found (or not in this tenant/project) |

---

## PATCH /projects/:projectId/permits/:id

Update an existing permit. Supports partial updates (only send fields you want to change).

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| id | UUID | Yes | Permit UUID |

### Request Body

All fields are optional — only include fields to update.

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| permit_number | string | No | max 100 chars | Permit number |
| permit_type | string | No | max 200 chars | Permit type |
| status | string | No | enum (see above) | Permit status |
| submitted_date | string | No | ISO date or null | Submitted date |
| approved_date | string | No | ISO date or null | Approved date |
| expiry_date | string | No | ISO date or null | Expiry date |
| issuing_authority | string | No | max 200 chars | Issuing authority |
| notes | string | No | max 65535 chars | Notes |

### Business Rules

- When `status` is changed to `approved` and `approved_date` is not set (neither in the request nor already on the record), `approved_date` is auto-set to today.
- Status transitions are recorded in the project activity log.

### Request Example

```http
PATCH /api/v1/projects/550e8400-e29b-41d4-a716-446655440000/permits/a1b2c3d4-e5f6-7890-abcd-ef1234567890
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "approved",
  "issuing_authority": "City of Boston Building Department"
}
```

### Response — 200 OK

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "permit_number": "BP-2026-0001",
  "permit_type": "Building",
  "status": "approved",
  "submitted_date": "2026-03-01",
  "approved_date": "2026-03-15",
  "expiry_date": "2027-03-15",
  "issuing_authority": "City of Boston Building Department",
  "notes": null,
  "inspections": [],
  "created_at": "2026-03-01T10:00:00.000Z",
  "updated_at": "2026-03-15T16:30:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validation error (invalid enum, field too long) |
| 401 | Missing or invalid JWT token |
| 403 | User role is not Owner, Admin, or Manager |
| 404 | Permit not found (or not in this tenant/project) |

---

## DELETE /projects/:projectId/permits/:id

Hard delete a permit. Physically removes the record from the database.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| id | UUID | Yes | Permit UUID |

### Business Rules

- Returns HTTP 409 if the permit has linked inspections (Sprint 23). Currently no inspections exist, so hard delete always succeeds.
- Only Owner and Admin roles can hard-delete.

### Request Example

```http
DELETE /api/v1/projects/550e8400-e29b-41d4-a716-446655440000/permits/a1b2c3d4-e5f6-7890-abcd-ef1234567890
Authorization: Bearer {token}
```

### Response — 204 No Content

No response body.

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | User role is not Owner or Admin |
| 404 | Permit not found (or not in this tenant/project) |
| 409 | Permit has linked inspections — use deactivate instead (Sprint 23+) |

---

## PATCH /projects/:projectId/permits/:id/deactivate

Soft delete (deactivate) a permit. Sets `deleted_at` timestamp. The permit will no longer appear in list queries.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| id | UUID | Yes | Permit UUID |

### Request Example

```http
PATCH /api/v1/projects/550e8400-e29b-41d4-a716-446655440000/permits/a1b2c3d4-e5f6-7890-abcd-ef1234567890/deactivate
Authorization: Bearer {token}
```

### Response — 200 OK

Returns the deactivated permit (with `deleted_at` reflected in the `updated_at` field).

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "permit_number": "BP-2026-0001",
  "permit_type": "Building",
  "status": "approved",
  "submitted_date": "2026-03-01",
  "approved_date": "2026-03-15",
  "expiry_date": "2027-03-15",
  "issuing_authority": "City of Boston",
  "notes": null,
  "inspections": [],
  "created_at": "2026-03-01T10:00:00.000Z",
  "updated_at": "2026-03-16T09:00:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | User role is not Owner or Admin |
| 404 | Permit not found, already deactivated, or not in this tenant/project |

---

## Authentication & Authorization

All endpoints require:
1. Valid JWT token in `Authorization: Bearer {token}` header
2. User must belong to the same tenant as the project
3. User must have one of the allowed roles (see endpoint table above)

`tenant_id` is extracted from the JWT token — never sent by the client.

---

## Audit Logging

All write operations (create, update, hard delete, deactivate) produce audit log entries with:
- `entity_type`: `permit`
- `before_json` / `after_json`: Full state snapshots
- `actor_user_id`: The user who performed the action

---

## Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "permit_type",
      "message": "Permit type is required"
    }
  ]
}
```

---

## Notes for Frontend

- **Inspections**: The `inspections` array is always `[]` until Sprint 23 adds the inspection entity. Do not attempt to access `/inspections` sub-resource.
- **Dates**: `submitted_date`, `approved_date`, `expiry_date` are `YYYY-MM-DD` strings or `null`. Send dates in the same format.
- **Soft delete vs hard delete**: Use `PATCH .../deactivate` for normal removal. Use `DELETE` only when you need physical removal (will fail in Sprint 23+ if inspections are linked).
