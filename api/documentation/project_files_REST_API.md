# Project Files REST API — Documents & Photos

**Module**: Project Management (Sprint 09, Sprint 18)
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT token required on all endpoints
**Tenant Isolation**: All queries scoped to tenant extracted from JWT

---

## Table of Contents

1. [Project Documents](#1-project-documents)
   - [POST /projects/:projectId/documents](#11-upload-document)
   - [GET /projects/:projectId/documents](#12-list-documents)
   - [DELETE /projects/:projectId/documents/:id](#13-delete-document)
2. [Project Photos](#2-project-photos)
   - [POST /projects/:projectId/photos](#21-upload-photo)
   - [GET /projects/:projectId/photos](#22-list-photos)
   - [PATCH /projects/:projectId/photos/:id](#23-update-photo)
   - [DELETE /projects/:projectId/photos/:id](#24-delete-photo)
3. [Photo Timeline (Sprint 18)](#3-photo-timeline-sprint-18)
   - [GET /projects/:projectId/photos/timeline](#31-get-photo-timeline)
   - [POST /projects/:projectId/photos/batch](#32-batch-upload-photos)

---

## 1. Project Documents

### 1.1 Upload Document

**`POST /projects/:projectId/documents`**

Upload a document to a project. Uses multipart/form-data.

**Roles**: `Owner`, `Admin`, `Manager`

**Path Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |

**Request Body** (multipart/form-data):

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| file | File | Yes | Max 10-20MB depending on category | File to upload |
| document_type | string | Yes | Enum: `contract`, `permit`, `blueprint`, `agreement`, `photo`, `other` | Type of document |
| description | string | No | Max 500 chars | Description of the document |
| is_public | boolean | No | Default: `false` | Whether visible on customer portal |

**FileCategory Mapping** (internal — determines allowed MIME types and max size):

| document_type | FileCategory | Allowed MIME Types |
|---------------|-------------|-------------------|
| contract | contract | PDF, PNG, JPEG, WEBP, DOCX, DOC |
| permit | misc | PDF, PNG, JPEG, WEBP |
| blueprint | misc | PDF, PNG, JPEG, WEBP |
| agreement | contract | PDF, PNG, JPEG, WEBP, DOCX, DOC |
| photo | photo | PNG, JPEG, WEBP, HEIC, HEIF, BMP |
| other | misc | PDF, PNG, JPEG, WEBP |

**Success Response** (`201 Created`):

```json
{
  "id": "e1419473-0f07-4396-907f-c6082c735a38",
  "project_id": "749138e1-87e6-4e18-8921-e3fc5890dd7a",
  "file_id": "9d65cfd0-9556-4f4f-95ab-07a6bd87ced5",
  "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/files/9d65cfd0-9556-4f4f-95ab-07a6bd87ced5.pdf",
  "file_name": "contract-signed.pdf",
  "document_type": "contract",
  "description": "Signed contract for roofing project",
  "is_public": false,
  "uploaded_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-03-13T02:59:35.164Z"
}
```

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 400 | Missing file, invalid document_type, file too large, invalid MIME type |
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role (not Owner/Admin/Manager) or storage quota exceeded |
| 404 | Project not found or does not belong to tenant |

**Example Request**:

```bash
curl -X POST "https://api.lead360.app/api/v1/projects/749138e1.../documents" \
  -H "Authorization: Bearer <token>" \
  -F "file=@contract-signed.pdf;type=application/pdf" \
  -F "document_type=contract" \
  -F "description=Signed contract for roofing project" \
  -F "is_public=false"
```

---

### 1.2 List Documents

**`GET /projects/:projectId/documents`**

List all documents for a project, optionally filtered by type.

**Roles**: `Owner`, `Admin`, `Manager`

**Path Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |

**Query Parameters**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| document_type | string | No | — | Filter by type: `contract`, `permit`, `blueprint`, `agreement`, `photo`, `other` |

**Success Response** (`200 OK`):

```json
[
  {
    "id": "e1419473-0f07-4396-907f-c6082c735a38",
    "project_id": "749138e1-87e6-4e18-8921-e3fc5890dd7a",
    "file_id": "9d65cfd0-9556-4f4f-95ab-07a6bd87ced5",
    "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/files/9d65cfd0-9556-4f4f-95ab-07a6bd87ced5.pdf",
    "file_name": "contract-signed.pdf",
    "document_type": "contract",
    "description": "Signed contract for roofing project",
    "is_public": false,
    "uploaded_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "created_at": "2026-03-13T02:59:35.164Z"
  }
]
```

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role |
| 404 | Project not found or does not belong to tenant |

**Example Request**:

```bash
curl "https://api.lead360.app/api/v1/projects/749138e1.../documents?document_type=contract" \
  -H "Authorization: Bearer <token>"
```

---

### 1.3 Delete Document

**`DELETE /projects/:projectId/documents/:id`**

Delete a document from a project. Removes the record and the file from storage.

**Roles**: `Owner`, `Admin`

**Path Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| id | UUID | Yes | Document UUID |

**Success Response** (`200 OK`):

```json
{
  "message": "Document deleted"
}
```

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role (not Owner/Admin) |
| 404 | Document not found or does not belong to tenant/project |

**Example Request**:

```bash
curl -X DELETE "https://api.lead360.app/api/v1/projects/749138e1.../documents/e1419473..." \
  -H "Authorization: Bearer <token>"
```

---

## 2. Project Photos

### 2.1 Upload Photo

**`POST /projects/:projectId/photos`**

Upload a photo to a project. Supports optional task association, caption, portal visibility, and date taken.

**Roles**: `Owner`, `Admin`, `Manager`, `Field`

**Path Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |

**Request Body** (multipart/form-data):

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| file | File | Yes | Max 20MB. Allowed: PNG, JPEG, WEBP, HEIC, HEIF, BMP | Photo file |
| task_id | UUID | No | Must be a valid task belonging to this project | Link photo to a task |
| caption | string | No | Max 500 chars | Photo caption |
| is_public | boolean | No | Default: `false` | Whether visible on customer portal |
| taken_at | string | No | ISO date: `YYYY-MM-DD` | When the photo was taken |

**Success Response** (`201 Created`):

```json
{
  "id": "5fadb3dd-7849-4eec-bcff-fb8a117c2a06",
  "project_id": "749138e1-87e6-4e18-8921-e3fc5890dd7a",
  "task_id": null,
  "file_id": "39f3a79c-5b0a-4f35-bb61-e091cf6bd3f7",
  "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/39f3a79c-5b0a-4f35-bb61-e091cf6bd3f7.webp",
  "thumbnail_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/fb1ae07f-7c2f-4cc9-9cfe-988a053a2216_thumb.webp",
  "caption": "Foundation pour complete",
  "is_public": true,
  "taken_at": "2026-03-10",
  "uploaded_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-03-13T03:00:36.527Z"
}
```

**Notes**:
- Images are automatically optimized (compressed, converted to WebP when applicable)
- Thumbnails are auto-generated by FilesService for image files
- `thumbnail_url` will be `null` if no thumbnail was generated (e.g., very small images)
- `file_url` and `thumbnail_url` are Nginx-served static paths — no backend proxy needed

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 400 | Missing file, invalid file type, file too large |
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role or storage quota exceeded |
| 404 | Project not found, or task_id not found / not belonging to project |

**Example Request**:

```bash
curl -X POST "https://api.lead360.app/api/v1/projects/749138e1.../photos" \
  -H "Authorization: Bearer <token>" \
  -F "file=@foundation-photo.jpg;type=image/jpeg" \
  -F "caption=Foundation pour complete" \
  -F "is_public=true" \
  -F "taken_at=2026-03-10"
```

---

### 2.2 List Photos

**`GET /projects/:projectId/photos`**

List all photos for a project with optional filters. Ordered by `created_at DESC` (most recent first).

**Roles**: `Owner`, `Admin`, `Manager`, `Field`

**Path Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |

**Query Parameters**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| task_id | UUID | No | — | Filter photos by task |
| is_public | boolean | No | — | Filter by portal visibility (`true` / `false`) |
| date_from | string | No | — | Filter photos created on or after this date (ISO: `YYYY-MM-DD`) |
| date_to | string | No | — | Filter photos created on or before this date (ISO: `YYYY-MM-DD`) |

**Success Response** (`200 OK`):

```json
[
  {
    "id": "5fadb3dd-7849-4eec-bcff-fb8a117c2a06",
    "project_id": "749138e1-87e6-4e18-8921-e3fc5890dd7a",
    "task_id": null,
    "file_id": "39f3a79c-5b0a-4f35-bb61-e091cf6bd3f7",
    "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/39f3a79c.webp",
    "thumbnail_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/fb1ae07f_thumb.webp",
    "caption": "Foundation pour complete",
    "is_public": true,
    "taken_at": "2026-03-10",
    "uploaded_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "created_at": "2026-03-13T03:00:36.527Z"
  }
]
```

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role |
| 404 | Project not found or does not belong to tenant |

**Example Request**:

```bash
curl "https://api.lead360.app/api/v1/projects/749138e1.../photos?is_public=true&date_from=2026-03-01" \
  -H "Authorization: Bearer <token>"
```

---

### 2.3 Update Photo

**`PATCH /projects/:projectId/photos/:id`**

Update photo metadata (caption and/or portal visibility). Does NOT replace the image file.

**Roles**: `Owner`, `Admin`, `Manager`

**Path Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| id | UUID | Yes | Photo UUID |

**Request Body** (JSON):

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| caption | string | No | Max 500 chars | Updated caption |
| is_public | boolean | No | — | Updated portal visibility |

**Success Response** (`200 OK`):

```json
{
  "id": "5fadb3dd-7849-4eec-bcff-fb8a117c2a06",
  "project_id": "749138e1-87e6-4e18-8921-e3fc5890dd7a",
  "task_id": null,
  "file_id": "39f3a79c-5b0a-4f35-bb61-e091cf6bd3f7",
  "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/39f3a79c.webp",
  "thumbnail_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/fb1ae07f_thumb.webp",
  "caption": "Updated: Foundation pour complete — east wing",
  "is_public": false,
  "taken_at": "2026-03-10",
  "uploaded_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-03-13T03:00:36.527Z"
}
```

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role (not Owner/Admin/Manager) |
| 404 | Photo not found or does not belong to tenant/project |

**Example Request**:

```bash
curl -X PATCH "https://api.lead360.app/api/v1/projects/749138e1.../photos/5fadb3dd..." \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"caption":"Updated: Foundation pour complete — east wing","is_public":false}'
```

---

### 2.4 Delete Photo

**`DELETE /projects/:projectId/photos/:id`**

Delete a photo from a project. Removes the record, the image file, and the thumbnail from storage.

**Roles**: `Owner`, `Admin`, `Manager`

**Path Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| id | UUID | Yes | Photo UUID |

**Success Response** (`200 OK`):

```json
{
  "message": "Photo deleted"
}
```

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role (not Owner/Admin/Manager) |
| 404 | Photo not found or does not belong to tenant/project |

**Example Request**:

```bash
curl -X DELETE "https://api.lead360.app/api/v1/projects/749138e1.../photos/5fadb3dd..." \
  -H "Authorization: Bearer <token>"
```

---

## Response Field Reference

### Document Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Document record UUID |
| project_id | UUID | Parent project UUID |
| file_id | UUID | File record UUID (from FilesService) |
| file_url | string | Nginx-served URL path (e.g., `/public/{tenant}/files/{uuid}.pdf`) |
| file_name | string | Original filename as uploaded |
| document_type | enum | `contract`, `permit`, `blueprint`, `agreement`, `photo`, `other` |
| description | string \| null | Optional description |
| is_public | boolean | Whether visible on customer portal |
| uploaded_by_user_id | UUID | User who uploaded the document |
| created_at | ISO datetime | When the document was uploaded |

### Photo Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Photo record UUID |
| project_id | UUID | Parent project UUID |
| task_id | UUID \| null | Associated task UUID (if linked) |
| file_id | UUID | File record UUID (from FilesService) |
| file_url | string | Nginx-served URL path (e.g., `/public/{tenant}/images/{uuid}.webp`) |
| thumbnail_url | string \| null | Nginx-served thumbnail URL (auto-generated) |
| caption | string \| null | Photo caption |
| is_public | boolean | Whether visible on customer portal |
| taken_at | string \| null | Date photo was taken (`YYYY-MM-DD` format) |
| uploaded_by_user_id | UUID | User who uploaded the photo |
| created_at | ISO datetime | When the photo was uploaded |

---

---

## 3. Photo Timeline (Sprint 18)

### 3.1 Get Photo Timeline

**`GET /projects/:projectId/photos/timeline`**

Returns photos ordered by effective date (taken_at DESC, fallback to created_at), grouped by date. Includes linked task info, log info, and uploader details. Supports pagination and filtering.

**Roles**: `Owner`, `Admin`, `Manager`, `Field`

**Path Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |

**Query Parameters**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| task_id | UUID | No | — | Filter photos by task |
| is_public | boolean | No | — | Filter by portal visibility (`true` / `false`) |
| date_from | string | No | — | Filter from date (ISO: `YYYY-MM-DD`). Applies to effective date (taken_at or created_at) |
| date_to | string | No | — | Filter to date (ISO: `YYYY-MM-DD`). Applies to effective date (taken_at or created_at) |
| page | number | No | `1` | Page number |
| limit | number | No | `20` | Items per page (max: `100`) |

**Date Range Filtering Logic**:

The date range filter uses an "effective date" concept: if a photo has `taken_at`, the filter applies to `taken_at`; if `taken_at` is null, it applies to `created_at`. This ensures all photos are filterable by their most meaningful date.

**Success Response** (`200 OK`):

```json
{
  "data": [
    {
      "date": "2026-04-05",
      "photos": [
        {
          "id": "5fadb3dd-7849-4eec-bcff-fb8a117c2a06",
          "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/39f3a79c.webp",
          "thumbnail_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/fb1ae07f_thumb.webp",
          "caption": "Foundation complete",
          "is_public": true,
          "task": {
            "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "title": "Foundation Pour"
          },
          "log": {
            "id": "f0e1d2c3-b4a5-9687-cdef-0123456789ab"
          },
          "uploaded_by": {
            "first_name": "Jane",
            "last_name": "Admin"
          },
          "created_at": "2026-04-05T16:00:00.000Z"
        }
      ]
    },
    {
      "date": "2026-04-03",
      "photos": [
        {
          "id": "e2d3c4b5-a6f7-8901-bcde-f23456789012",
          "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/abc12345.webp",
          "thumbnail_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/abc12345_thumb.webp",
          "caption": "Framing progress",
          "is_public": false,
          "task": null,
          "log": null,
          "uploaded_by": {
            "first_name": "John",
            "last_name": "Worker"
          },
          "created_at": "2026-04-03T09:30:00.000Z"
        }
      ]
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Timeline Photo Fields**:

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Photo record UUID |
| file_url | string | Nginx-served URL path |
| thumbnail_url | string \| null | Nginx-served thumbnail URL |
| caption | string \| null | Photo caption |
| is_public | boolean | Whether visible on customer portal |
| task | object \| null | Linked task: `{ id: UUID, title: string }` |
| log | object \| null | Linked log: `{ id: UUID }` |
| uploaded_by | object \| null | Uploader: `{ first_name: string, last_name: string }` |
| created_at | ISO datetime | When the photo was uploaded |

**Notes**:
- Photos are grouped by effective date (taken_at if set, otherwise created_at)
- Groups are ordered by date DESC (most recent first)
- Within a group, photos are also ordered by effective date DESC
- Pagination applies to the flat photo count (not group count)
- `task` is included when the photo is linked to a project task
- `log` is included when the photo was uploaded as part of a project log entry

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role |
| 404 | Project not found or does not belong to tenant |

**Example Request**:

```bash
curl "https://api.lead360.app/api/v1/projects/749138e1.../photos/timeline?page=1&limit=20&is_public=true" \
  -H "Authorization: Bearer <token>"
```

**Example with date range filter**:

```bash
curl "https://api.lead360.app/api/v1/projects/749138e1.../photos/timeline?date_from=2026-03-01&date_to=2026-03-31&task_id=a1b2c3d4..." \
  -H "Authorization: Bearer <token>"
```

---

### 3.2 Batch Upload Photos

**`POST /projects/:projectId/photos/batch`**

Upload multiple photos in one request. All photos share the same metadata (task_id, is_public, taken_at, caption). Maximum 20 files per request.

**Roles**: `Owner`, `Admin`, `Manager`, `Field`

**Path Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |

**Request Body** (multipart/form-data):

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| files | File[] | Yes | Max 20 files. Each max 20MB. Allowed: PNG, JPEG, WEBP, HEIC, HEIF, BMP | Photo files (field name: `files`) |
| task_id | UUID | No | Must be a valid task belonging to this project | Link all photos to a task |
| caption | string | No | Max 500 chars | Shared caption for all photos |
| is_public | boolean | No | Default: `false` | Whether all photos are visible on customer portal |
| taken_at | string | No | ISO date: `YYYY-MM-DD` | When the photos were taken |

**Success Response** (`201 Created`):

```json
[
  {
    "id": "5fadb3dd-7849-4eec-bcff-fb8a117c2a06",
    "project_id": "749138e1-87e6-4e18-8921-e3fc5890dd7a",
    "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "file_id": "39f3a79c-5b0a-4f35-bb61-e091cf6bd3f7",
    "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/39f3a79c.webp",
    "thumbnail_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/fb1ae07f_thumb.webp",
    "caption": "Site progress photos",
    "is_public": true,
    "taken_at": "2026-03-10",
    "uploaded_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "created_at": "2026-03-13T03:00:36.527Z"
  },
  {
    "id": "e2d3c4b5-a6f7-8901-bcde-f23456789012",
    "project_id": "749138e1-87e6-4e18-8921-e3fc5890dd7a",
    "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "file_id": "c4d5e6f7-a8b9-0123-cdef-456789abcdef",
    "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/c4d5e6f7.webp",
    "thumbnail_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/images/d6e7f8a9_thumb.webp",
    "caption": "Site progress photos",
    "is_public": true,
    "taken_at": "2026-03-10",
    "uploaded_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "created_at": "2026-03-13T03:00:37.142Z"
  }
]
```

**Notes**:
- All photos receive the same metadata (caption, task_id, is_public, taken_at)
- Each file is uploaded individually through FilesService (validation, optimization, thumbnail generation)
- Audit log entries are created for each photo
- A single `photos_batch_added` activity log entry is created for the batch
- If upload fails midway, successfully uploaded photos remain — the client should retry only the failed files
- Response array order matches the upload order

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 400 | No files provided, invalid file type, file too large |
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role or storage quota exceeded |
| 404 | Project not found, or task_id not found / not belonging to project |

**Example Request**:

```bash
curl -X POST "https://api.lead360.app/api/v1/projects/749138e1.../photos/batch" \
  -H "Authorization: Bearer <token>" \
  -F "files=@photo1.jpg;type=image/jpeg" \
  -F "files=@photo2.jpg;type=image/jpeg" \
  -F "files=@photo3.jpg;type=image/jpeg" \
  -F "caption=Site progress photos" \
  -F "is_public=true" \
  -F "taken_at=2026-03-10" \
  -F "task_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

---

## Response Field Reference

### Document Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Document record UUID |
| project_id | UUID | Parent project UUID |
| file_id | UUID | File record UUID (from FilesService) |
| file_url | string | Nginx-served URL path (e.g., `/public/{tenant}/files/{uuid}.pdf`) |
| file_name | string | Original filename as uploaded |
| document_type | enum | `contract`, `permit`, `blueprint`, `agreement`, `photo`, `other` |
| description | string \| null | Optional description |
| is_public | boolean | Whether visible on customer portal |
| uploaded_by_user_id | UUID | User who uploaded the document |
| created_at | ISO datetime | When the document was uploaded |

### Photo Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Photo record UUID |
| project_id | UUID | Parent project UUID |
| task_id | UUID \| null | Associated task UUID (if linked) |
| file_id | UUID | File record UUID (from FilesService) |
| file_url | string | Nginx-served URL path (e.g., `/public/{tenant}/images/{uuid}.webp`) |
| thumbnail_url | string \| null | Nginx-served thumbnail URL (auto-generated) |
| caption | string \| null | Photo caption |
| is_public | boolean | Whether visible on customer portal |
| taken_at | string \| null | Date photo was taken (`YYYY-MM-DD` format) |
| uploaded_by_user_id | UUID | User who uploaded the photo |
| created_at | ISO datetime | When the photo was uploaded |

---

## Business Rules

1. **Tenant Isolation**: All queries include `tenant_id` filter. Users cannot access files from other tenants.
2. **File Uploads**: All uploads go through FilesService — no custom upload logic. FilesService handles validation, optimization, thumbnails, and storage quota checks.
3. **Portal Visibility**: `is_public` flag controls whether the document/photo is visible on the customer portal (Sprint 32).
4. **Photo Ordering**: Photos are returned in `created_at DESC` order (most recent first) for flat list. Timeline view orders by effective date (taken_at with fallback to created_at).
5. **Task Association**: Photos can optionally be linked to a project task via `task_id`. The task must belong to the same project.
6. **Audit Logging**: All write operations (upload, update, delete, batch upload) are audit logged.
7. **Activity Feed**: Document uploads log `document_added`, photo uploads log `photo_added`, and batch uploads log `photos_batch_added` to the project activity feed.
8. **File Deletion**: When a document/photo record is deleted, the underlying file is also deleted from storage via FilesService.
9. **Log Association**: Photos can be linked to a project log via `log_id`. When a log is deleted, the photo's `log_id` is set to NULL (the photo record and file persist).
10. **Timeline Grouping**: The timeline endpoint groups photos by their effective date and paginates by flat photo count (not group count).
11. **Batch Upload**: Batch uploads apply shared metadata (caption, task_id, is_public, taken_at) to all photos. Maximum 20 files per batch.
