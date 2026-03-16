# Portal Project API — REST Documentation

**Module**: Portal (Customer-Facing)
**Sprint**: 32
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Portal JWT (Bearer token from `/portal/auth/login`)
**Controller**: `PortalProjectController` at `/portal`

---

## Overview

These endpoints expose project data to authenticated portal customers. They return **only public, sanitized data** — never exposing costs, crew details, financial entries, internal notes, subcontractor data, margins, private logs, or private photos.

**Security model**:
- All endpoints require a valid portal JWT token (issued via `POST /portal/auth/login`)
- Every request validates that the `:customerSlug` URL parameter matches the token's `customer_slug` claim
- Projects are scoped to `tenant_id` + `lead_id` from the token, filtered by `portal_enabled=true`

---

## Authentication

All endpoints use the **PortalAuthGuard** (not JwtAuthGuard). The portal JWT is completely separate from the staff JWT:

- **Header**: `Authorization: Bearer <portal_token>`
- **Token source**: `POST /api/v1/portal/auth/login`
- **Token lifetime**: 30 days
- **JWT secret**: `PORTAL_JWT_SECRET` (different from staff `JWT_SECRET`)

**Portal JWT payload**:
```json
{
  "sub": "portal-account-uuid",
  "tenant_id": "tenant-uuid",
  "lead_id": "lead-uuid",
  "customer_slug": "john-smith",
  "iat": 1742000000,
  "exp": 1744592000
}
```

---

## Slug Validation

Every endpoint includes a `:customerSlug` path parameter. The controller validates this matches the `customer_slug` from the portal JWT. If mismatched → **403 Forbidden**.

This prevents URL manipulation to access another customer's data.

---

## Endpoints

### 1. List Projects

**`GET /api/v1/portal/:customerSlug/projects`**

Returns all portal-enabled projects belonging to the authenticated customer.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerSlug` | string | Yes | Customer slug (must match token) |

#### Query Parameters

| Parameter | Type | Required | Default | Max | Description |
|-----------|------|----------|---------|-----|-------------|
| `page` | integer | No | 1 | — | Page number (1-indexed) |
| `limit` | integer | No | 20 | 100 | Items per page |

#### Authentication

- **Guard**: PortalAuthGuard
- **Token**: Portal JWT (Bearer)

#### Success Response — `200 OK`

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "project_number": "PRJ-2026-0001",
      "name": "Kitchen Remodel",
      "status": "in_progress",
      "start_date": "2026-04-01",
      "target_completion_date": "2026-06-15",
      "progress_percent": 45.00
    },
    {
      "id": "660f9500-f3ac-52e5-b827-557766551111",
      "project_number": "PRJ-2026-0002",
      "name": "Bathroom Renovation",
      "status": "planned",
      "start_date": "2026-07-01",
      "target_completion_date": "2026-08-15",
      "progress_percent": 0.00
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

#### Response Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Project identifier |
| `project_number` | string | Human-readable project number (e.g., PRJ-2026-0001) |
| `name` | string | Project name |
| `status` | string | One of: `planned`, `in_progress`, `on_hold`, `completed` |
| `start_date` | string (date) or null | Project start date (YYYY-MM-DD) |
| `target_completion_date` | string (date) or null | Target completion date (YYYY-MM-DD) |
| `progress_percent` | number | Completion percentage (0.00–100.00) |

#### Fields NEVER Returned

- `contract_value` — Financial data
- `estimated_cost` — Financial data
- `notes` — Internal notes
- `assigned_pm_user_id` — Internal staff info
- `created_by_user_id` — Internal staff info
- `tenant_id` — Internal system field

#### Error Responses

| Status | Description | Body |
|--------|-------------|------|
| 401 | Invalid or missing portal token | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 403 | customerSlug does not match token | `{ "statusCode": 403, "message": "Access denied: customer slug does not match your account" }` |

#### Example Request

```http
GET /api/v1/portal/john-smith/projects?page=1&limit=20 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 2. Get Project Detail

**`GET /api/v1/portal/:customerSlug/projects/:id`**

Returns project detail with sanitized task titles/statuses and permit statuses. No costs, crew, financial entries, or internal notes are included.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerSlug` | string | Yes | Customer slug (must match token) |
| `id` | string (UUID) | Yes | Project ID |

#### Authentication

- **Guard**: PortalAuthGuard
- **Token**: Portal JWT (Bearer)

#### Success Response — `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "project_number": "PRJ-2026-0001",
  "name": "Kitchen Remodel",
  "description": "Full kitchen renovation including cabinets, countertops, and appliances",
  "status": "in_progress",
  "start_date": "2026-04-01",
  "target_completion_date": "2026-06-15",
  "actual_completion_date": null,
  "progress_percent": 45.00,
  "permit_required": true,
  "tasks": [
    {
      "id": "task-uuid-001",
      "title": "Demolition",
      "status": "done",
      "order_index": 1,
      "estimated_start_date": "2026-04-01",
      "estimated_end_date": "2026-04-05"
    },
    {
      "id": "task-uuid-002",
      "title": "Plumbing Rough-In",
      "status": "in_progress",
      "order_index": 2,
      "estimated_start_date": "2026-04-06",
      "estimated_end_date": "2026-04-15"
    },
    {
      "id": "task-uuid-003",
      "title": "Electrical",
      "status": "not_started",
      "order_index": 3,
      "estimated_start_date": "2026-04-16",
      "estimated_end_date": "2026-04-25"
    }
  ],
  "permits": [
    {
      "id": "permit-uuid-001",
      "permit_type": "Building Permit",
      "status": "approved",
      "submitted_date": "2026-03-15",
      "approved_date": "2026-03-28"
    },
    {
      "id": "permit-uuid-002",
      "permit_type": "Plumbing Permit",
      "status": "submitted",
      "submitted_date": "2026-04-01",
      "approved_date": null
    }
  ]
}
```

#### Response Field Reference — Project

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Project identifier |
| `project_number` | string | Human-readable project number |
| `name` | string | Project name |
| `description` | string or null | Project description |
| `status` | string | One of: `planned`, `in_progress`, `on_hold`, `completed` |
| `start_date` | string (date) or null | YYYY-MM-DD |
| `target_completion_date` | string (date) or null | YYYY-MM-DD |
| `actual_completion_date` | string (date) or null | YYYY-MM-DD (set when completed) |
| `progress_percent` | number | 0.00–100.00 |
| `permit_required` | boolean | Whether permits are required |

#### Response Field Reference — Tasks

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Task identifier |
| `title` | string | Task title |
| `status` | string | One of: `not_started`, `in_progress`, `blocked`, `done` |
| `order_index` | integer | Display order |
| `estimated_start_date` | string (date) or null | YYYY-MM-DD |
| `estimated_end_date` | string (date) or null | YYYY-MM-DD |

**Task fields NEVER returned**: `description`, `notes`, `category`, `actual_start_date`, `actual_end_date`, `is_delayed`, `created_by_user_id`, `quote_item_id`, costs, crew assignments.

#### Response Field Reference — Permits

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Permit identifier |
| `permit_type` | string | Type of permit (e.g., "Building Permit") |
| `status` | string | One of: `pending_application`, `submitted`, `approved`, `active`, `failed`, `closed` |
| `submitted_date` | string (date) or null | YYYY-MM-DD |
| `approved_date` | string (date) or null | YYYY-MM-DD |

**Permit fields NEVER returned**: `permit_number`, `notes`, `issuing_authority`, `expiry_date`, `created_by_user_id`.

#### Error Responses

| Status | Description | Body |
|--------|-------------|------|
| 401 | Invalid or missing portal token | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 403 | customerSlug does not match token | `{ "statusCode": 403, "message": "Access denied: customer slug does not match your account" }` |
| 404 | Project not found or not portal-enabled | `{ "statusCode": 404, "message": "Project not found" }` |

#### Example Request

```http
GET /api/v1/portal/john-smith/projects/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 3. Get Public Project Logs

**`GET /api/v1/portal/:customerSlug/projects/:id/logs`**

Returns ONLY public logs (`is_public=true`). Private logs are NEVER returned. Includes log content, date, author name, and public attachments.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerSlug` | string | Yes | Customer slug (must match token) |
| `id` | string (UUID) | Yes | Project ID |

#### Query Parameters

| Parameter | Type | Required | Default | Max | Description |
|-----------|------|----------|---------|-----|-------------|
| `page` | integer | No | 1 | — | Page number (1-indexed) |
| `limit` | integer | No | 20 | 100 | Items per page |

#### Authentication

- **Guard**: PortalAuthGuard
- **Token**: Portal JWT (Bearer)

#### Success Response — `200 OK`

```json
{
  "data": [
    {
      "id": "log-uuid-001",
      "log_date": "2026-04-10",
      "content": "Demolition work completed ahead of schedule. All debris removed from site.",
      "weather_delay": false,
      "author": "Mike Johnson",
      "attachments": [
        {
          "id": "att-uuid-001",
          "file_url": "/public/tenant-uuid/images/demolition-complete.jpg",
          "file_name": "demolition-complete.jpg",
          "file_type": "photo"
        }
      ],
      "created_at": "2026-04-10T14:30:00.000Z"
    },
    {
      "id": "log-uuid-002",
      "log_date": "2026-04-08",
      "content": "Work suspended due to severe weather conditions.",
      "weather_delay": true,
      "author": "Mike Johnson",
      "attachments": [],
      "created_at": "2026-04-08T09:00:00.000Z"
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

#### Response Field Reference — Log

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Log entry identifier |
| `log_date` | string (date) | Date of the log entry (YYYY-MM-DD) |
| `content` | string | Log content text |
| `weather_delay` | boolean | Whether this log records a weather delay |
| `author` | string or null | Author's full name (first + last) |
| `attachments` | array | Public attachments (see below) |
| `created_at` | string (ISO 8601) | Timestamp when log was created |

#### Response Field Reference — Attachment

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Attachment identifier |
| `file_url` | string | Nginx-served URL path (e.g., `/public/{tenant_id}/images/file.jpg`) |
| `file_name` | string | Original file name |
| `file_type` | string | One of: `photo`, `pdf`, `document` |

**Log fields NEVER returned**: `task_id`, `author_user_id`, internal attachment metadata.

#### Error Responses

| Status | Description | Body |
|--------|-------------|------|
| 401 | Invalid or missing portal token | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 403 | customerSlug does not match token | `{ "statusCode": 403, "message": "Access denied: customer slug does not match your account" }` |
| 404 | Project not found or not portal-enabled | `{ "statusCode": 404, "message": "Project not found" }` |

#### Example Request

```http
GET /api/v1/portal/john-smith/projects/550e8400-e29b-41d4-a716-446655440000/logs?page=1&limit=20 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 4. Get Public Project Photos

**`GET /api/v1/portal/:customerSlug/projects/:id/photos`**

Returns ONLY public photos (`is_public=true`). Private photos are NEVER returned. Returns photo URLs served by Nginx.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerSlug` | string | Yes | Customer slug (must match token) |
| `id` | string (UUID) | Yes | Project ID |

#### Query Parameters

| Parameter | Type | Required | Default | Max | Description |
|-----------|------|----------|---------|-----|-------------|
| `page` | integer | No | 1 | — | Page number (1-indexed) |
| `limit` | integer | No | 20 | 100 | Items per page |

#### Authentication

- **Guard**: PortalAuthGuard
- **Token**: Portal JWT (Bearer)

#### Success Response — `200 OK`

```json
{
  "data": [
    {
      "id": "photo-uuid-001",
      "file_url": "/public/tenant-uuid/images/kitchen-progress.jpg",
      "thumbnail_url": "/public/tenant-uuid/images/kitchen-progress_thumb.webp",
      "caption": "Kitchen cabinets installed",
      "taken_at": "2026-05-01",
      "created_at": "2026-05-01T12:30:00.000Z"
    },
    {
      "id": "photo-uuid-002",
      "file_url": "/public/tenant-uuid/images/countertops.jpg",
      "thumbnail_url": "/public/tenant-uuid/images/countertops_thumb.webp",
      "caption": "Granite countertops delivered",
      "taken_at": "2026-05-10",
      "created_at": "2026-05-10T09:15:00.000Z"
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### Response Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Photo identifier |
| `file_url` | string | Full-size image URL (Nginx-served, e.g., `/public/{tenant_id}/images/file.jpg`) |
| `thumbnail_url` | string or null | Thumbnail URL (Nginx-served) |
| `caption` | string or null | Photo caption |
| `taken_at` | string (date) or null | Date photo was taken (YYYY-MM-DD) |
| `created_at` | string (ISO 8601) | Timestamp when photo was uploaded |

**Photo fields NEVER returned**: `file_id`, `task_id`, `log_id`, `uploaded_by_user_id`, `tenant_id`, `project_id`.

#### Error Responses

| Status | Description | Body |
|--------|-------------|------|
| 401 | Invalid or missing portal token | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 403 | customerSlug does not match token | `{ "statusCode": 403, "message": "Access denied: customer slug does not match your account" }` |
| 404 | Project not found or not portal-enabled | `{ "statusCode": 404, "message": "Project not found" }` |

#### Example Request

```http
GET /api/v1/portal/john-smith/projects/550e8400-e29b-41d4-a716-446655440000/photos?page=1&limit=20 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Security Design

### Data Isolation Layers

1. **Portal JWT**: Contains `tenant_id` and `lead_id` — cannot be forged or tampered with
2. **Slug Validation**: URL `customerSlug` must match token's `customer_slug` — prevents URL manipulation
3. **Query Filtering**: All queries filter by `tenant_id` + `lead_id` + `portal_enabled=true`
4. **SELECT Whitelisting**: Only safe fields are selected from the database — even a Prisma bug cannot leak sensitive columns
5. **Response Mapping**: Data is explicitly mapped to response objects — extra fields are stripped

### What is NEVER Exposed

| Category | Fields |
|----------|--------|
| Financial | `contract_value`, `estimated_cost`, margins, cost entries, crew payments |
| Internal | `notes` (project/task/permit), `description` (task), `category` (task) |
| Staff | `assigned_pm_user_id`, `created_by_user_id`, `uploaded_by_user_id` |
| Private Data | Private logs (`is_public=false`), private photos (`is_public=false`) |
| Crew | Crew member data, subcontractor data, assignments |
| System | `tenant_id`, `file_id`, `quote_id`, `quote_item_id` |

### Ownership Verification

For logs and photos endpoints, project ownership is verified before querying child records. This prevents:
- Information leakage about project existence via different error responses
- Access to logs/photos of projects not belonging to the authenticated lead

---

## File URL Pattern

Photo and attachment URLs follow the Nginx-served pattern:

```
/public/{tenant_id}/images/{uuid}.{ext}        — Full-size images
/public/{tenant_id}/images/{uuid}_thumb.webp    — Thumbnails
/public/{tenant_id}/files/{uuid}.{ext}          — Documents
```

These paths are served directly by Nginx — no backend proxy involved. The frontend constructs the full URL by prepending the tenant subdomain:

```
https://{tenant_subdomain}.lead360.app/public/{tenant_id}/images/{uuid}.jpg
```

---

## Database Schema Reference

### portal_account (authentication)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant reference |
| `lead_id` | UUID | Lead reference |
| `email` | VARCHAR(255) | Customer email |
| `customer_slug` | VARCHAR(200) | URL-safe slug (unique per tenant) |
| `is_active` | BOOLEAN | Account active status |

### project (filtered by portal)

| Column | Portal Exposed | Description |
|--------|---------------|-------------|
| `id` | Yes | Project ID |
| `project_number` | Yes | Human-readable number |
| `name` | Yes | Project name |
| `description` | Yes (detail only) | Project description |
| `status` | Yes | Project status |
| `start_date` | Yes | Start date |
| `target_completion_date` | Yes | Target date |
| `actual_completion_date` | Yes (detail only) | Actual completion |
| `progress_percent` | Yes | Progress % |
| `permit_required` | Yes (detail only) | Permits needed |
| `portal_enabled` | Filter only | Must be true |
| `lead_id` | Filter only | Must match token |
| `contract_value` | **NEVER** | Financial |
| `estimated_cost` | **NEVER** | Financial |
| `notes` | **NEVER** | Internal |

---

## Integration Notes

- **Portal JWT**: Issued by `POST /api/v1/portal/auth/login` (Sprint 31)
- **Portal account**: Auto-created when project is created from quote (`ProjectService.createFromQuote`)
- **API base URL**: `https://api.lead360.app/api/v1`
- **Pagination**: Standard format with `data` array and `meta` object
- **Dates**: Returned as `YYYY-MM-DD` strings (not ISO 8601 timestamps) for date fields; `created_at` uses full ISO 8601
