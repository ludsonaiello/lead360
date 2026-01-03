# Files API Documentation

**Base URL**: `/api/v1/files`

**Authentication**: All endpoints require JWT Bearer token (except where noted)

**Multi-tenant**: All endpoints automatically filter by tenant_id from authenticated user

---

## Overview

The Files API provides a flexible file management system with:
- General file uploads for quotes, invoices, and miscellaneous documents
- Automatic orphan file detection and cleanup
- Hard delete by default for explicit deletions
- Three-stage orphan lifecycle: Orphan → Trash → Permanent Delete

---

## Orphan File Management Workflow

Files uploaded without an `entity_id` are considered **potentially orphan**.

**Lifecycle:**
1. **Day 0**: File uploaded without `entity_id` → marked `is_orphan = true`
2. **Day 30**: Orphan files (30+ days old) can be moved to trash
3. **Day 60**: Trashed files (30+ days in trash) can be permanently deleted

**Manual Triggers** (Admin only):
- `GET /files/orphans` - View orphan files
- `POST /files/orphans/trash` - Move orphans to trash
- `DELETE /files/trash/cleanup` - Permanently delete trashed files

**Automatic Cleanup**: Background job runs daily at midnight (handled by BullMQ processor)

---

## File Categories

Files are categorized for validation rules:

| Category | Allowed Types | Max Size |
|----------|--------------|----------|
| `quote` | PDF, PNG, JPG, JPEG, DOC, DOCX | 10MB |
| `invoice` | PDF, PNG, JPG, JPEG | 10MB |
| `license` | PDF, PNG, JPG, JPEG | 10MB |
| `insurance` | PDF, PNG, JPG, JPEG | 10MB |
| `misc` | PDF, PNG, JPG, JPEG, DOC, DOCX, XLS, XLSX, TXT | 20MB |

---

## Endpoints

### 1. Upload File

Upload a file with optional entity attachment.

**Endpoint**: `POST /files/upload`

**Content-Type**: `multipart/form-data`

**Request Body**:
```
file: <binary> (required)
category: string (required) - One of: quote, invoice, license, insurance, misc
entity_type: string (optional) - Entity type this file is attached to
entity_id: string (optional) - UUID of entity
```

**Example Request** (cURL):
```bash
curl -X POST https://api.lead360.app/api/v1/files/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "category=quote" \
  -F "entity_type=quote" \
  -F "entity_id=uuid-of-quote"
```

**Success Response** (200 OK):
```json
{
  "message": "File uploaded successfully",
  "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "/public/tenant-uuid/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
  "file": {
    "id": "internal-db-id",
    "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "original_filename": "document.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 524288,
    "category": "quote",
    "url": "/public/tenant-uuid/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
    "created_at": "2026-01-03T12:00:00.000Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` - Invalid file type or size
  ```json
  {
    "statusCode": 400,
    "message": "File size exceeds 10.00MB limit.",
    "error": "Bad Request",
    "errorCode": "FILE_TOO_LARGE"
  }
  ```
- `400 Bad Request` - Invalid category
  ```json
  {
    "statusCode": 400,
    "message": ["category must be one of the following values: quote, invoice, license, insurance, misc"],
    "error": "Bad Request",
    "errorCode": "VALIDATION_FAILED"
  }
  ```

---

### 2. Get All Files (with filters)

Retrieve files with optional filters and pagination.

**Endpoint**: `GET /files`

**Query Parameters**:
- `category` (optional) - Filter by category: quote, invoice, license, insurance, misc
- `entity_type` (optional) - Filter by entity type
- `entity_id` (optional) - Filter by entity ID
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20, max: 100) - Items per page

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/files?category=quote&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "data": [
    {
      "id": "internal-db-id",
      "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "original_filename": "quote-2024.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 524288,
      "category": "quote",
      "entity_type": "quote",
      "entity_id": "quote-uuid",
      "is_orphan": false,
      "uploaded_by": "user-uuid",
      "url": "/public/tenant-uuid/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
      "created_at": "2026-01-03T12:00:00.000Z",
      "updated_at": "2026-01-03T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### 3. Get Single File

Retrieve a single file by file_id.

**Endpoint**: `GET /files/:id`

**URL Parameters**:
- `id` (required) - File ID (file_id, not database id)

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "id": "internal-db-id",
  "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "original_filename": "quote-2024.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 524288,
  "category": "quote",
  "entity_type": "quote",
  "entity_id": "quote-uuid",
  "is_orphan": false,
  "url": "/public/tenant-uuid/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
  "uploaded_by": "user-uuid",
  "created_at": "2026-01-03T12:00:00.000Z",
  "updated_at": "2026-01-03T12:00:00.000Z"
}
```

**Error Responses**:
- `404 Not Found` - File not found or belongs to different tenant
  ```json
  {
    "statusCode": 404,
    "message": "File not found",
    "error": "Not Found",
    "errorCode": "FILE_NOT_FOUND"
  }
  ```

---

### 4. Delete File

**Hard delete** a file immediately (both filesystem and database).

**Endpoint**: `DELETE /files/:id`

**Authorization**: Requires `Owner` or `Admin` role

**URL Parameters**:
- `id` (required) - File ID (file_id)

**Example Request**:
```bash
curl -X DELETE "https://api.lead360.app/api/v1/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "message": "File deleted successfully"
}
```

**Error Responses**:
- `404 Not Found` - File not found
- `403 Forbidden` - Insufficient permissions

---

### 5. Get Orphan Files

Retrieve all orphan files (files not attached to any entity and older than 30 days).

**Endpoint**: `GET /files/orphans`

**Authorization**: Requires `Owner` or `Admin` role

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/files/orphans" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "orphans": [
    {
      "id": "internal-db-id",
      "file_id": "orphan-file-uuid",
      "original_filename": "unattached.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 102400,
      "category": "misc",
      "is_orphan": true,
      "orphaned_at": "2025-12-01T12:00:00.000Z",
      "url": "/public/tenant-uuid/files/orphan-file-uuid.pdf",
      "created_at": "2025-11-01T12:00:00.000Z",
      "days_orphaned": 33
    }
  ],
  "total": 5,
  "marked_as_orphan": 2
}
```

**Response Fields**:
- `orphans` - Array of orphan files with metadata
- `total` - Total number of orphan files found
- `marked_as_orphan` - Number of files newly marked as orphan during this request
- `days_orphaned` - Days since file was marked as orphan (or created if not yet marked)

---

### 6. Move Orphans to Trash

Move orphan files (orphaned for 30+ days) to trash.

**Endpoint**: `POST /files/orphans/trash`

**Authorization**: Requires `Owner` or `Admin` role

**Example Request**:
```bash
curl -X POST "https://api.lead360.app/api/v1/files/orphans/trash" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "message": "3 orphan files moved to trash",
  "count": 3
}
```

**No Files Ready** (200 OK):
```json
{
  "message": "No orphan files ready to move to trash",
  "count": 0
}
```

---

### 7. Cleanup Trashed Files

Permanently delete trashed files (in trash for 30+ days).

**Endpoint**: `DELETE /files/trash/cleanup`

**Authorization**: Requires `Owner` or `Admin` role

**Example Request**:
```bash
curl -X DELETE "https://api.lead360.app/api/v1/files/trash/cleanup" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "message": "5 trashed files permanently deleted",
  "count": 5
}
```

**No Files Ready** (200 OK):
```json
{
  "message": "No trashed files ready for permanent deletion",
  "count": 0
}
```

---

## Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `FILE_INVALID_TYPE` | 400 | Invalid file type for category |
| `FILE_TOO_LARGE` | 400 | File size exceeds limit |
| `FILE_NOT_FOUND` | 404 | File not found or wrong tenant |
| `FILE_UPLOAD_FAILED` | 500 | File upload operation failed |
| `VALIDATION_FAILED` | 400 | Validation error (category, entity_id, etc.) |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role |

---

## Multi-Tenant Isolation

- All file operations are automatically scoped to the authenticated user's tenant
- Files are stored in tenant-specific directories: `/uploads/public/{tenant_id}/files/`
- Database queries always include `tenant_id` filter
- Attempting to access another tenant's files returns 404

---

## Audit Logging

All file operations are logged in the audit_log table:

**Actions**:
- `file_uploaded` - File uploaded
- `file_deleted` - File deleted
- `orphan_files_trashed` - Orphan files moved to trash
- `trashed_files_deleted` - Trashed files permanently deleted

**Metadata includes**:
- `file_id` - File identifier
- `original_filename` - Original filename
- `category` - File category
- `size_bytes` - File size
- `entity_type` / `entity_id` - Attached entity (if any)

---

## Best Practices

1. **Always attach files to entities** when possible to avoid orphan cleanup
2. **Use appropriate categories** for correct validation rules
3. **Check file size limits** before upload (varies by category)
4. **Handle orphan cleanup regularly** via admin endpoints or background job
5. **Monitor trashed files** before permanent deletion (30-day grace period)

---

## Examples

### Upload a Quote File
```javascript
const formData = new FormData();
formData.append('file', fileBlob, 'quote-estimate.pdf');
formData.append('category', 'quote');
formData.append('entity_type', 'quote');
formData.append('entity_id', quoteId);

const response = await fetch('https://api.lead360.app/api/v1/files/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
console.log('File uploaded:', result.file_id);
```

### List All Invoice Files
```javascript
const response = await fetch(
  'https://api.lead360.app/api/v1/files?category=invoice&page=1&limit=50',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const { data, pagination } = await response.json();
console.log(`Found ${pagination.total} invoices`);
```

### Delete a File
```javascript
const response = await fetch(
  `https://api.lead360.app/api/v1/files/${fileId}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

if (response.ok) {
  console.log('File deleted successfully');
}
```

---

## Swagger/OpenAPI

Interactive API documentation available at:
**https://api.lead360.app/api/docs**

Filter by tag "Files" to see all file endpoints with try-it-now functionality.
