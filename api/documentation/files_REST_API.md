# Files Module - REST API Documentation

**Version**: 2.0  
**Last Updated**: 2026-01-06  
**Module**: Enhanced File Storage System

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [File Upload](#1-upload-file)
4. [File Retrieval](#2-get-all-files)
5. [File Management](#4-delete-file)
6. [Share Links](#8-create-share-link)
7. [Public Access](#11-access-shared-file-public)
8. [Bulk Operations](#bulk-operations)
9. [Error Handling](#error-handling)

---

## Overview

The Files module provides:
- Upload with automatic image optimization (WebP, thumbnails, HEIC support)
- Multi-tenant storage (local filesystem or S3-compatible)
- Temporary public sharing with password protection
- Bulk operations
- 11 file categories with validation

**Base URL**: `https://api.lead360.app/api/v1/files`

---

## Authentication

All endpoints require JWT authentication except public share endpoints.

**Header**:
```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### 1. Upload File

Upload a file with automatic optimization.

**Endpoint**: `POST /files/upload`  
**Auth**: Required  
**Content-Type**: `multipart/form-data`

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | binary | Yes | File to upload |
| category | enum | Yes | One of: quote, invoice, license, insurance, logo, contract, receipt, photo, report, signature, misc |
| entity_type | string | No | Entity type (e.g., "invoice") |
| entity_id | UUID | No | Entity ID |

**File Categories & Limits**:

| Category | Max Size | Allowed Types |
|----------|----------|---------------|
| quote | 10MB | PDF, PNG, JPG, JPEG, WebP, HEIC, HEIF, DOC, DOCX |
| invoice | 10MB | PDF, PNG, JPG, JPEG, WebP |
| license | 10MB | PDF, PNG, JPG, JPEG, WebP |
| insurance | 10MB | PDF, PNG, JPG, JPEG, WebP |
| logo | 5MB | PNG, JPG, JPEG, SVG, WebP |
| contract | 15MB | PDF, DOC, DOCX |
| receipt | 5MB | PDF, PNG, JPG, JPEG, WebP |
| photo | 20MB | PNG, JPG, JPEG, WebP, HEIC, HEIF |
| report | 25MB | PDF, DOC, DOCX, XLS, XLSX |
| signature | 2MB | PNG, JPG, JPEG, WebP |
| misc | 20MB | PDF, PNG, JPG, JPEG, WebP, DOC, DOCX, XLS, XLSX, TXT, CSV |

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@invoice.pdf" \
  -F "category=invoice" \
  -F "entity_type=invoice" \
  -F "entity_id=550e8400-e29b-41d4-a716-446655440000"
```

**Response** (200 OK):
```json
{
  "message": "File uploaded successfully",
  "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "/public/tenant-id/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
  "file": {
    "id": "internal-uuid",
    "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "original_filename": "invoice-123.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 45678,
    "original_size_bytes": 50000,
    "category": "invoice",
    "url": "/public/tenant-id/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
    "has_thumbnail": false,
    "is_optimized": false,
    "width": null,
    "height": null,
    "created_at": "2026-01-06T12:00:00Z"
  }
}
```

**Image Optimization** (automatic):
- WebP conversion (85% quality, 25-35% size reduction)
- Thumbnail generation (200x200px)
- EXIF stripping
- Original size preserved in `original_size_bytes`

**Errors**:
- `400` - Invalid file type or size limit exceeded
- `401` - Unauthorized

---

### 2. Get All Files

Retrieve files with filters and pagination.

**Endpoint**: `GET /files`  
**Auth**: Required

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| category | enum | No | - | Filter by category |
| entity_type | string | No | - | Filter by entity type |
| entity_id | UUID | No | - | Filter by entity ID |
| page | integer | No | 1 | Page number |
| limit | integer | No | 20 | Items per page |

**Example**:
```bash
curl "https://api.lead360.app/api/v1/files?category=invoice&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "internal-uuid",
      "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "original_filename": "invoice-123.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 45678,
      "category": "invoice",
      "entity_type": "invoice",
      "entity_id": "550e8400-e29b-41d4-a716-446655440000",
      "is_orphan": false,
      "url": "/public/tenant-id/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
      "uploaded_by": "user-uuid",
      "created_at": "2026-01-06T12:00:00Z",
      "updated_at": "2026-01-06T12:00:00Z"
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

**Endpoint**: `GET /files/:id`  
**Auth**: Required

**Path Parameters**:
- `id` (string): File ID

**Example**:
```bash
curl "https://api.lead360.app/api/v1/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (200 OK): Same structure as file object above

**Errors**:
- `404` - File not found

---

### 4. Delete File

Permanently delete a file.

**Endpoint**: `DELETE /files/:id`  
**Auth**: Required  
**RBAC**: Owner or Admin only

**Example**:
```bash
curl -X DELETE "https://api.lead360.app/api/v1/files/FILE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (200 OK):
```json
{
  "message": "File deleted successfully"
}
```

**Behavior**:
- Deletes from storage (local or S3)
- Deletes thumbnail if exists
- Removes database record
- Creates audit log

**Errors**:
- `403` - Forbidden (insufficient permissions)
- `404` - File not found

---

### 5. Get Orphan Files

**Endpoint**: `GET /files/orphans`  
**Auth**: Required  
**RBAC**: Owner or Admin only

Files not attached to any entity, older than 30 days.

**Response** (200 OK):
```json
{
  "orphans": [
    {
      "id": "uuid",
      "file_id": "file-uuid",
      "original_filename": "temp.jpg",
      "days_orphaned": 36,
      "url": "/public/..."
    }
  ],
  "total": 5,
  "marked_as_orphan": 2
}
```

---

### 6. Move Orphans to Trash

**Endpoint**: `POST /files/orphans/trash`  
**Auth**: Required  
**RBAC**: Owner or Admin only

**Response** (200 OK):
```json
{
  "message": "5 orphan files moved to trash",
  "count": 5
}
```

---

### 7. Cleanup Trashed Files

Permanently delete files in trash >30 days.

**Endpoint**: `DELETE /files/trash/cleanup`  
**Auth**: Required  
**RBAC**: Owner or Admin only

**Response** (200 OK):
```json
{
  "message": "3 trashed files permanently deleted",
  "count": 3
}
```

---

## Share Link Endpoints

### 8. Create Share Link

Create temporary public share link.

**Endpoint**: `POST /files/share`  
**Auth**: Required

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file_id | UUID | Yes | File ID to share |
| password | string | No | Password protection (bcrypt hashed) |
| expires_at | string (ISO 8601) | No | Expiration date |
| max_downloads | integer | No | Max download limit |

**Example**:
```bash
curl -X POST https://api.lead360.app/api/v1/files/share \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "password": "SecurePass123",
    "expires_at": "2026-12-31T23:59:59Z",
    "max_downloads": 10
  }'
```

**Response** (201 Created):
```json
{
  "message": "Share link created successfully",
  "share_link": {
    "id": "share-link-uuid",
    "share_token": "64-char-hex-token-256-bit-security",
    "share_url": "/public/share/64-char-hex-token",
    "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "expires_at": "2026-12-31T23:59:59Z",
    "max_downloads": 10,
    "download_count": 0,
    "has_password": true,
    "created_at": "2026-01-06T12:00:00Z"
  }
}
```

**Security**:
- Token: 64-char hex (256-bit, cryptographically secure)
- Password: bcrypt hashed (10 salt rounds)

**Errors**:
- `404` - File not found

---

### 9. List Share Links

**Endpoint**: `GET /files/share/list`  
**Auth**: Required

**Query Parameters**:
- `file_id` (UUID, optional): Filter by file

**Example**:
```bash
curl "https://api.lead360.app/api/v1/files/share/list?file_id=FILE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (200 OK):
```json
{
  "share_links": [
    {
      "id": "uuid",
      "share_token": "64-char-hex",
      "share_url": "/public/share/64-char-hex",
      "file_id": "file-uuid",
      "file_name": "invoice.pdf",
      "has_password": true,
      "expires_at": "2026-12-31T23:59:59Z",
      "max_downloads": 10,
      "download_count": 3,
      "is_active": true,
      "created_at": "2026-01-06T12:00:00Z",
      "last_accessed_at": "2026-01-06T14:30:00Z"
    }
  ],
  "total": 1
}
```

---

### 10. Revoke Share Link

**Endpoint**: `DELETE /files/share/:id`  
**Auth**: Required  
**RBAC**: Owner or Admin only

**Example**:
```bash
curl -X DELETE "https://api.lead360.app/api/v1/files/share/SHARE_LINK_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (200 OK):
```json
{
  "message": "Share link revoked successfully"
}
```

---

## Public Share Endpoints

### 11. Access Shared File [PUBLIC]

**Endpoint**: `GET /public/share/:token`  
**Auth**: None (public)

**Path Parameters**:
- `token` (string): 64-char share token

**Request Body** (optional):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| password | string | Conditional | Required if password-protected |

**Example (no password)**:
```bash
curl "https://api.lead360.app/api/v1/public/share/64-char-token"
```

**Example (with password)**:
```bash
curl "https://api.lead360.app/api/v1/public/share/64-char-token" \
  -H "Content-Type: application/json" \
  -d '{"password": "SecurePass123"}'
```

**Response** (200 OK):
```json
{
  "message": "Access granted",
  "file": {
    "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "original_filename": "invoice-123.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 45678,
    "url": "/public/tenant-id/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
    "has_thumbnail": false,
    "width": null,
    "height": null
  },
  "share_info": {
    "download_count": 4,
    "max_downloads": 10,
    "expires_at": "2026-12-31T23:59:59Z"
  }
}
```

**Errors**:
- `404` - Share link not found
- `401` - Password required
- `401` - Invalid password
- `400` - Link expired
- `400` - Max downloads reached
- `400` - Link revoked

---

### 12. Download Shared File [PUBLIC]

**Endpoint**: `POST /public/share/:token/download`  
**Auth**: None (public)

Same as access endpoint, but POST method. Increments download count.

---

## Bulk Operations

### 13. Bulk Delete Files

**Endpoint**: `POST /files/bulk/delete`  
**Auth**: Required  
**RBAC**: Owner or Admin only

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file_ids | array of UUIDs | Yes | File IDs to delete (min 1) |

**Example**:
```bash
curl -X POST https://api.lead360.app/api/v1/files/bulk/delete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": [
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "b2c3d4e5-f6g7-8901-bcde-fg2345678901"
    ]
  }'
```

**Response** (200 OK):
```json
{
  "message": "2 files deleted successfully",
  "count": 2
}
```

**Behavior**:
- Validates all files exist and belong to tenant
- Deletes from storage
- Deletes thumbnails
- Removes database records
- Creates audit log

**Errors**:
- `400` - Some files not found or don't belong to tenant
- `403` - Forbidden

---

### 14. Bulk Download Files (ZIP)

**Endpoint**: `POST /files/bulk/download`
**Auth**: Required
**RBAC**: All authenticated users (files:view permission)

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file_ids | array of UUIDs | Yes | File IDs to download (min 1, max 50) |
| zip_name | string | No | Name of ZIP file (default: "files.zip") |

**Example**:
```bash
curl -X POST https://api.lead360.app/api/v1/files/bulk/download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": [
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "b2c3d4e5-f6g7-8901-bcde-fg2345678901"
    ],
    "zip_name": "my_files.zip"
  }' \
  --output my_files.zip
```

**Response** (200 OK):
- Content-Type: `application/zip`
- Content-Disposition: `attachment; filename="my_files.zip"`
- Body: Binary ZIP file data

**Behavior**:
- Validates all files exist and belong to tenant
- Downloads files from storage (local or S3)
- Creates ZIP archive with original filenames
- Returns ZIP as binary response
- Creates audit log
- Max 50 files per request to prevent memory issues

**Errors**:
- `400` - No files provided, or more than 50 files
- `404` - No files found
- `403` - Forbidden

---

## Error Handling

### Standard Error Format

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Error Type"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Complete Endpoint Summary

### Authenticated Endpoints (14)

| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| POST | `/files/upload` | Upload file | All |
| GET | `/files` | List files | All |
| GET | `/files/:id` | Get file | All |
| DELETE | `/files/:id` | Delete file | Owner/Admin |
| GET | `/files/orphans` | Get orphans | Owner/Admin |
| POST | `/files/orphans/trash` | Trash orphans | Owner/Admin |
| DELETE | `/files/trash/cleanup` | Cleanup trash | Owner/Admin |
| POST | `/files/share` | Create share link | All |
| GET | `/files/share/list` | List share links | All |
| DELETE | `/files/share/:id` | Revoke share link | Owner/Admin |
| POST | `/files/bulk/delete` | Bulk delete | Owner/Admin |
| POST | `/files/bulk/download` | Bulk download (ZIP) | All |

### Public Endpoints (2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/public/share/:token` | Access shared file |
| POST | `/public/share/:token/download` | Download shared file |

**Total**: 15 endpoints

---

## Storage Configuration

### Local Storage (Default)

Files stored in `/uploads/public/{tenant_id}/{folder}/`  
URLs served by nginx: `/public/{tenant_id}/{folder}/{filename}`

### S3-Compatible Storage

Per-tenant configuration in `storage_config` table:
- AWS S3, MinIO, DigitalOcean Spaces supported
- Pre-signed URLs (1-hour expiration)
- Automatic provider selection per tenant

---

## Audit Logging

All operations logged to `audit_log` table:
- File uploads
- File deletions
- Bulk operations
- Share link creation/revocation
- Includes: user_id, tenant_id, before/after state, metadata

---

## Swagger Documentation

Interactive API docs:
```
https://api.lead360.app/api/docs
```

---

**End of API Documentation**
