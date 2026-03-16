# Project Log REST API

**Module**: Project Management
**Sprint**: 17, 19
**Base URL**: `/api/v1/projects/:projectId/logs`
**Authentication**: Bearer JWT required on all endpoints
**Tenant Isolation**: All queries scoped by `tenant_id` derived from JWT

---

## Overview

Project logs are immutable daily/random log entries attached to a project. They support optional file attachments (photos, PDFs, documents) and public/private visibility for portal access.

**Key Business Rules:**
- Log content is **immutable** after creation (no edit endpoint)
- `is_public` controls customer portal visibility
- Photos uploaded via logs also create `project_photo` records (linked via `log_id`)
- Deleting a log fully cleans up linked `project_photo` records and all attachment files
- PMs can backfill past dates via `log_date`
- All queries enforce `tenant_id` + `project_id` isolation

---

## Endpoints

### 1. Create Project Log

**POST** `/api/v1/projects/:projectId/logs`

Creates a log entry with optional file attachments. Accepts multipart/form-data.

**Roles**: Owner, Admin, Manager, Field (assigned)

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| projectId | UUID | Project to attach the log to |

**Request Body (multipart/form-data):**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| content | string | yes | — | Log content (rich text or plain text, max 65535 chars). Immutable after creation. |
| log_date | string (ISO date) | no | today | Date of the log entry (YYYY-MM-DD). PM can backfill past dates. |
| task_id | UUID | no | null | Optional task context for this log entry |
| is_public | boolean | no | false | Whether this log is visible on the customer portal |
| weather_delay | boolean | no | false | Whether this log records a weather delay |
| attachments | File[] | no | [] | Up to 10 files (photos, PDFs, documents) |

**Example Request:**
```bash
curl -X POST /api/v1/projects/550e8400-e29b-41d4-a716-446655440000/logs \
  -H "Authorization: Bearer <token>" \
  -F "content=Foundation pour completed today. Weather was clear." \
  -F "log_date=2026-04-05" \
  -F "is_public=true" \
  -F "weather_delay=false" \
  -F "attachments=@foundation.jpg" \
  -F "attachments=@report.pdf"
```

**Success Response — 201 Created:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "task_id": null,
  "author": {
    "id": "user-uuid",
    "first_name": "Jane",
    "last_name": "Admin"
  },
  "log_date": "2026-04-05",
  "content": "Foundation pour completed today. Weather was clear.",
  "is_public": true,
  "weather_delay": false,
  "attachments": [
    {
      "id": "att-uuid-1",
      "file_url": "/public/tenant-uuid/images/file-uuid.webp",
      "file_name": "foundation.jpg",
      "file_type": "photo"
    },
    {
      "id": "att-uuid-2",
      "file_url": "/public/tenant-uuid/misc/file-uuid.pdf",
      "file_name": "report.pdf",
      "file_type": "pdf"
    }
  ],
  "created_at": "2026-04-05T16:00:00.000Z"
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Validation error or empty content |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient role |
| 404 | Project not found or task not found |

---

### 2. List Project Logs

**GET** `/api/v1/projects/:projectId/logs`

Returns paginated logs ordered by `log_date DESC`, `created_at DESC`. Includes author and attachments.

**Roles**: Owner, Admin, Manager, Field

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| projectId | UUID | Project to list logs for |

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| is_public | boolean | no | — | Filter by portal visibility (`true` or `false`) |
| has_attachments | boolean | no | — | Filter by presence of attachments (`true` or `false`) |
| date_from | string (ISO date) | no | — | Filter logs with `log_date >= date_from` |
| date_to | string (ISO date) | no | — | Filter logs with `log_date <= date_to` (inclusive) |
| page | number | no | 1 | Page number |
| limit | number | no | 20 | Items per page (max: 100) |

**Example Request:**
```bash
curl /api/v1/projects/550e8400-.../logs?is_public=true&date_from=2026-04-01&date_to=2026-04-30&page=1&limit=10 \
  -H "Authorization: Bearer <token>"
```

**Success Response — 200 OK:**
```json
{
  "data": [
    {
      "id": "log-uuid",
      "project_id": "project-uuid",
      "task_id": null,
      "author": {
        "id": "user-uuid",
        "first_name": "Jane",
        "last_name": "Admin"
      },
      "log_date": "2026-04-05",
      "content": "Foundation pour completed today. Weather was clear.",
      "is_public": true,
      "weather_delay": false,
      "attachments": [
        {
          "id": "att-uuid",
          "file_url": "/public/tenant-uuid/images/file-uuid.webp",
          "file_name": "foundation.jpg",
          "file_type": "photo"
        }
      ],
      "created_at": "2026-04-05T16:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 404 | Project not found |

---

### 3. Get Log Attachments

**GET** `/api/v1/projects/:projectId/logs/:logId/attachments`

Returns the list of attachments for a specific log entry. Includes `file_size_bytes` and `created_at` for each attachment.

**Roles**: Owner, Admin, Manager, Field

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| projectId | UUID | Project the log belongs to |
| logId | UUID | Log entry UUID |

**Example Request:**
```bash
curl /api/v1/projects/550e8400-.../logs/a1b2c3d4-.../attachments \
  -H "Authorization: Bearer <token>"
```

**Success Response — 200 OK:**
```json
{
  "data": [
    {
      "id": "att-uuid-1",
      "file_url": "/public/tenant-uuid/images/file-uuid.webp",
      "file_name": "foundation.jpg",
      "file_type": "photo",
      "file_size_bytes": 2048,
      "created_at": "2026-04-05T16:00:00.000Z"
    },
    {
      "id": "att-uuid-2",
      "file_url": "/public/tenant-uuid/files/file-uuid.pdf",
      "file_name": "report.pdf",
      "file_type": "pdf",
      "file_size_bytes": 10240,
      "created_at": "2026-04-05T16:05:00.000Z"
    }
  ]
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 404 | Project or log not found |

---

### 4. Delete Project Log

**DELETE** `/api/v1/projects/:projectId/logs/:id`

Hard deletes a log entry. Cascade-deletes its `project_log_attachment` records AND linked `project_photo` records. All attachment files (both photo and non-photo) are deleted from storage.

**Roles**: Owner, Admin

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| projectId | UUID | Project the log belongs to |
| id | UUID | Log entry UUID |

**Example Request:**
```bash
curl -X DELETE /api/v1/projects/550e8400-.../logs/a1b2c3d4-... \
  -H "Authorization: Bearer <token>"
```

**Success Response — 200 OK:**
```json
{
  "message": "Log deleted"
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient role (only Owner/Admin) |
| 404 | Log not found |

---

## Data Model

### project_log

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID (VarChar 36) | no | auto-generated | Primary key |
| tenant_id | UUID (VarChar 36) | no | — | Tenant isolation |
| project_id | UUID (VarChar 36) | no | — | FK to project |
| task_id | UUID (VarChar 36) | yes | null | FK to project_task (optional context) |
| author_user_id | UUID (VarChar 36) | no | — | FK to user |
| log_date | Date | no | — | Date of log (defaults to today in API) |
| content | Text | no | — | Log content (immutable) |
| is_public | Boolean | no | false | Portal visibility |
| weather_delay | Boolean | no | false | Weather delay flag |
| created_at | DateTime | no | auto-generated | |
| updated_at | DateTime | no | auto-updated | |

### project_log_attachment

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID (VarChar 36) | no | auto-generated | Primary key |
| tenant_id | UUID (VarChar 36) | no | — | Tenant isolation |
| log_id | UUID (VarChar 36) | no | — | FK to project_log (cascade delete) |
| file_id | UUID (VarChar 36) | no | — | FK to file (via file_id unique key) |
| file_url | VarChar 500 | no | — | Public URL of the file |
| file_name | VarChar 255 | no | — | Original filename |
| file_type | Enum | no | — | `photo`, `pdf`, or `document` |
| file_size_bytes | Int | yes | null | File size in bytes |
| created_at | DateTime | no | auto-generated | |

---

## Attachment File Type Detection

The `file_type` is automatically determined from the uploaded file's MIME type:

| MIME Pattern | file_type |
|-------------|-----------|
| `image/*` | `photo` |
| `application/pdf` | `pdf` |
| Everything else | `document` |

Photo attachments also create a `project_photo` record linked via `log_id`, ensuring they appear in the project's photo timeline.

---

## Notes for Frontend Integration

- **API Base URL**: `https://api.lead360.app/api/v1`
- **Authentication**: Bearer token in `Authorization` header
- **Content Type**: `multipart/form-data` for POST (supports file uploads)
- **Pagination**: Response uses `{ data, meta: { total, page, limit, totalPages } }` format
- **No Edit**: Content is immutable — there is no PATCH/PUT endpoint
- **Boolean Query Params**: Pass as strings `"true"` or `"false"`
- **Date Format**: `YYYY-MM-DD` for `log_date`, `date_from`, `date_to`
- **Max Attachments**: 10 files per log entry
