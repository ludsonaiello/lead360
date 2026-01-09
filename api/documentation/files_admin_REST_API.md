# Files Admin Module - REST API Documentation

**Version**: 1.0
**Last Updated**: 2026-01-09
**Module**: Platform Admin File Management

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [List All Files](#1-list-all-files)
4. [Get File Statistics](#2-get-file-statistics)
5. [Get Storage Stats by Tenant](#3-get-storage-stats-by-tenant)
6. [List All Share Links](#4-list-all-share-links)
7. [Get File by ID](#5-get-file-by-id)
8. [Delete File](#6-delete-file)
9. [Error Handling](#error-handling)

---

## Overview

The Files Admin module provides Platform Admin-only endpoints for managing files across all tenants. These endpoints **bypass tenant isolation** and allow Platform Admins to:

- View and manage files from any tenant
- Get platform-wide file statistics
- Monitor storage usage by tenant
- View all share links across tenants
- Delete files from any tenant (with audit logging)

**Base URL**: `https://api.lead360.app/api/v1/admin/files`

**Security**: All endpoints require Platform Admin role. Regular tenant admins cannot access these endpoints.

---

## Authentication & Authorization

### Required Headers
```
Authorization: Bearer <jwt_token>
```

### Required Role
- **Platform Admin** (`is_platform_admin: true`)

### Authorization Flow
1. JWT authentication validates user identity
2. `PlatformAdminGuard` checks if user has Platform Admin privileges
3. If not Platform Admin: `403 Forbidden` response
4. If Platform Admin: Request proceeds

**Example Error (Non-Admin)**:
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required.",
  "error": "Forbidden"
}
```

---

## Endpoints

### 1. List All Files

Retrieve all files across all tenants with optional filtering.

**Endpoint**: `GET /admin/files`
**Auth**: Platform Admin Required

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| tenant_id | UUID | No | - | Filter by specific tenant |
| page | integer | No | 1 | Page number (min: 1) |
| limit | integer | No | 50 | Items per page (min: 1, max: 100) |
| status | enum | No | - | Filter by status: `active` or `deleted` |
| mime_type | string | No | - | Filter by MIME type (e.g., `application/pdf`) |
| search | string | No | - | Search filename (partial match) |
| category | enum | No | - | Filter by category: `quote`, `invoice`, `license`, `insurance`, `logo`, `contract`, `receipt`, `photo`, `report`, `signature`, `misc` |
| entity_type | string | No | - | Filter by entity type (e.g., `invoice`, `user`, `quote`) |
| file_type | enum | No | - | Filter by file type: `image`, `document`, or `other` |

**Example Request**:
```bash
# Get all files (no tenant filter)
curl -X GET "https://api.lead360.app/api/v1/admin/files?page=1&limit=50" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"

# Filter by specific tenant
curl -X GET "https://api.lead360.app/api/v1/admin/files?tenant_id=abc-123&status=active" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"

# Search for invoices
curl -X GET "https://api.lead360.app/api/v1/admin/files?mime_type=application/pdf&search=invoice" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"

# Filter by category and file type
curl -X GET "https://api.lead360.app/api/v1/admin/files?category=invoice&file_type=image" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"

# Filter by entity type
curl -X GET "https://api.lead360.app/api/v1/admin/files?entity_type=invoice&category=receipt" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "f3b1f329-ed1d-11f0-b3f4-50e8d4ae7953",
      "file_id": "f3b1f352-ed1d-11f0-b3f4-50e8d4ae7953",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "original_filename": "test_invoice_2026.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 245680,
      "original_size_bytes": null,
      "category": "invoice",
      "storage_provider": "local",
      "storage_path": "/uploads/test_invoice_2026.pdf",
      "s3_bucket": null,
      "s3_key": null,
      "s3_region": null,
      "uploaded_by": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "entity_type": null,
      "entity_id": null,
      "is_orphan": false,
      "orphaned_at": null,
      "is_trashed": false,
      "trashed_at": null,
      "has_thumbnail": false,
      "thumbnail_path": null,
      "thumbnail_s3_key": null,
      "is_optimized": false,
      "optimization_quality": null,
      "width": null,
      "height": null,
      "page_count": null,
      "created_at": "2026-01-09T05:42:15.000Z",
      "updated_at": "2026-01-09T05:42:15.000Z",
      "tenant_file_tenant_idTotenant": {
        "id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
        "company_name": "Honeydo4You Contractor"
      },
      "user": {
        "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
        "first_name": "Ageu",
        "last_name": "Menezes",
        "email": "contact@honeydo4you.com"
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_count": 1,
    "limit": 20
  }
}
```

**Use Cases**:
- Monitor all file uploads across the platform
- Find files uploaded by specific tenants
- Search for specific file types (e.g., all PDFs)
- Audit file storage usage

---

### 2. Get File Statistics

Retrieve platform-wide file statistics.

**Endpoint**: `GET /admin/files/stats`
**Auth**: Platform Admin Required

**Query Parameters**: None

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/files/stats" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
{
  "total_files": 1543,
  "total_deleted": 87,
  "total_size_bytes": 5368709120,
  "total_size_mb": "5120.00",
  "orphan_files": 23,
  "by_category": [
    {
      "category": "invoice",
      "count": 456
    },
    {
      "category": "photo",
      "count": 389
    },
    {
      "category": "contract",
      "count": 234
    },
    {
      "category": "receipt",
      "count": 198
    },
    {
      "category": "license",
      "count": 145
    },
    {
      "category": "misc",
      "count": 121
    }
  ],
  "by_mime_type": [
    {
      "mime_type": "application/pdf",
      "count": 892
    },
    {
      "mime_type": "image/jpeg",
      "count": 456
    },
    {
      "mime_type": "image/png",
      "count": 123
    },
    {
      "mime_type": "image/webp",
      "count": 72
    }
  ]
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| total_files | integer | Total active (non-deleted) files |
| total_deleted | integer | Total soft-deleted files |
| total_size_bytes | integer | Total storage used (bytes) |
| total_size_mb | string | Total storage used (MB, formatted) |
| orphan_files | integer | Files not attached to any entity |
| by_category | array | File count breakdown by category |
| by_mime_type | array | Top 10 MIME types by file count |

**Use Cases**:
- Platform dashboard overview
- Storage capacity planning
- Identify most common file types
- Monitor orphaned files

---

### 3. Get Storage Stats by Tenant

Retrieve storage consumption per tenant, sorted by usage.

**Endpoint**: `GET /admin/files/storage-stats`
**Auth**: Platform Admin Required

**Query Parameters**: None

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/files/storage-stats" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
[
  {
    "tenant_id": "tenant-abc-123",
    "tenant_name": "Acme Services Inc",
    "file_count": 456,
    "total_bytes": 1073741824,
    "total_mb": "1024.00"
  },
  {
    "tenant_id": "tenant-xyz-789",
    "tenant_name": "Best Contractors LLC",
    "file_count": 312,
    "total_bytes": 536870912,
    "total_mb": "512.00"
  },
  {
    "tenant_id": "tenant-def-456",
    "tenant_name": "Clean Pro Services",
    "file_count": 198,
    "total_bytes": 268435456,
    "total_mb": "256.00"
  }
]
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| tenant_id | UUID | Tenant unique identifier |
| tenant_name | string | Tenant business name |
| file_count | integer | Number of active files |
| total_bytes | integer | Total storage used (bytes) |
| total_mb | string | Total storage used (MB, formatted) |

**Sorting**: Results are sorted by `total_bytes` descending (largest consumers first)

**Use Cases**:
- Identify storage hogs
- Billing/invoice generation based on storage
- Capacity planning per tenant
- Storage quota enforcement

---

### 4. List All Share Links

Retrieve all file share links across all tenants.

**Endpoint**: `GET /admin/files/shares`
**Auth**: Platform Admin Required

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| tenant_id | UUID | No | - | Filter by specific tenant |
| active_only | boolean | No | false | Show only active (non-expired) links |
| page | integer | No | 1 | Page number (min: 1) |
| limit | integer | No | 50 | Items per page (min: 1, max: 100) |

**Example Request**:
```bash
# Get all share links
curl -X GET "https://api.lead360.app/api/v1/admin/files/shares?page=1&limit=50" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"

# Get only active links for specific tenant
curl -X GET "https://api.lead360.app/api/v1/admin/files/shares?tenant_id=abc-123&active_only=true" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "share-link-id-1",
      "file_id": "file-id-123",
      "tenant_id": "tenant-abc-123",
      "share_token": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567890abcdef12",
      "password_hash": "$2b$10$...",
      "expires_at": "2026-01-16T10:30:00.000Z",
      "max_downloads": 10,
      "download_count": 3,
      "view_count": 15,
      "is_active": true,
      "created_at": "2026-01-09T10:30:00.000Z",
      "updated_at": "2026-01-09T10:30:00.000Z",
      "last_accessed_at": "2026-01-09T14:22:00.000Z",
      "file": {
        "id": "file-internal-id",
        "original_filename": "proposal_2026.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 1048576,
        "category": "quote"
      },
      "tenant": {
        "id": "tenant-abc-123",
        "company_name": "Acme Services Inc"
      },
      "creator": {
        "id": "user-id-123",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@acme.com"
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 3,
    "total_count": 142,
    "limit": 50
  }
}
```

**Use Cases**:
- Monitor public file sharing activity
- Identify expired share links
- Audit which files are publicly accessible
- Track download/view metrics

---

### 5. Get File by ID

Retrieve detailed information about a specific file from any tenant.

**Endpoint**: `GET /admin/files/:id`
**Auth**: Platform Admin Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | File internal ID (not file_id) |

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/files/file-internal-id-123" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
{
  "id": "file-internal-id-123",
  "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "tenant-abc-123",
  "original_filename": "invoice_2026_01.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 245680,
  "original_size_bytes": 245680,
  "category": "invoice",
  "storage_provider": "s3",
  "storage_path": "/tenant-abc-123/files/a1b2c3d4.pdf",
  "s3_bucket": "lead360-files",
  "s3_key": "tenant-abc-123/files/a1b2c3d4.pdf",
  "s3_region": "us-east-1",
  "uploaded_by": "user-id-123",
  "entity_type": "invoice",
  "entity_id": "invoice-id-456",
  "is_orphan": false,
  "orphaned_at": null,
  "is_trashed": false,
  "trashed_at": null,
  "has_thumbnail": false,
  "thumbnail_path": null,
  "is_optimized": false,
  "width": null,
  "height": null,
  "page_count": null,
  "created_at": "2026-01-09T10:30:00.000Z",
  "updated_at": "2026-01-09T10:30:00.000Z",
  "tenant_file_tenant_idTotenant": {
    "id": "tenant-abc-123",
    "company_name": "Acme Services Inc"
  },
  "user": {
    "id": "user-id-123",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@acme.com"
  },
  "file_share_links": [
    {
      "id": "share-link-id-1",
      "share_token": "abc123...def",
      "password_hash": "$2b$10$...",
      "expires_at": "2026-01-16T10:30:00.000Z",
      "download_count": 3,
      "view_count": 15,
      "is_active": true,
      "created_at": "2026-01-09T10:30:00.000Z"
    }
  ]
}
```

**Error Responses**:

```json
// 404 - File not found
{
  "statusCode": 404,
  "message": "File with ID file-internal-id-123 not found",
  "error": "Not Found"
}
```

**Use Cases**:
- Investigate specific file issues
- View complete file metadata
- Check associated share links
- Verify storage location

---

### 6. Delete File

Soft delete a file from any tenant and remove from storage.

**Endpoint**: `DELETE /admin/files/:id`
**Auth**: Platform Admin Required

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | File internal ID (not file_id) |

**Example Request**:
```bash
curl -X DELETE "https://api.lead360.app/api/v1/admin/files/file-internal-id-123" \
  -H "Authorization: Bearer YOUR_PLATFORM_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Error Responses**:

```json
// 404 - File not found
{
  "statusCode": 404,
  "message": "File with ID file-internal-id-123 not found",
  "error": "Not Found"
}

// 400 - Already deleted
{
  "statusCode": 400,
  "message": "File is already deleted",
  "error": "Bad Request"
}
```

**Behavior**:
1. **Storage Deletion** (best effort):
   - Main file deleted from S3/local storage
   - Thumbnail deleted if exists
   - If storage deletion fails, warning logged but continues
2. **Database Soft Delete**:
   - Sets `is_trashed: true`
   - Sets `trashed_at: <current_timestamp>`
3. **Audit Logging**:
   - Logs deletion event with admin user ID
   - Includes original file metadata
   - Marks as admin action

**Audit Log Example**:
```json
{
  "tenant_id": "tenant-abc-123",
  "actor_user_id": "admin-user-id",
  "actor_type": "user",
  "entity_type": "file",
  "entity_id": "file-internal-id-123",
  "action_type": "deleted",
  "description": "File \"invoice_2026_01.pdf\" deleted by Platform Admin",
  "before_json": {
    "id": "file-internal-id-123",
    "original_filename": "invoice_2026_01.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 245680,
    "tenant_id": "tenant-abc-123",
    "tenant_name": "Acme Services Inc"
  },
  "metadata_json": {
    "admin_action": true,
    "admin_user_id": "admin-user-id",
    "storage_provider": "s3",
    "category": "invoice"
  }
}
```

**Use Cases**:
- Remove inappropriate content
- Enforce storage policies
- Resolve tenant disputes
- Manual data cleanup

---

## Error Handling

### Common HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad Request (validation errors) |
| 403 | Forbidden (not Platform Admin) |
| 404 | Not Found (file doesn't exist) |
| 500 | Internal Server Error |

### Error Response Format

All errors follow this structure:

```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required.",
  "error": "Forbidden"
}
```

### Validation Errors

Query parameter validation errors:

```json
{
  "statusCode": 400,
  "message": [
    "page must not be less than 1",
    "limit must not be less than 1"
  ],
  "error": "Bad Request"
}
```

---

## Security Considerations

### Platform Admin Guard

All endpoints are protected by:
1. **JWT Authentication** - Validates user identity
2. **Platform Admin Guard** - Checks `is_platform_admin: true`

### Tenant Isolation Bypass

⚠️ **CRITICAL**: These endpoints **bypass tenant isolation**. This is intentional for Platform Admin management but requires:
- Strict role enforcement (Platform Admin only)
- Comprehensive audit logging (all operations logged)
- Regular access reviews
- Monitoring for abuse

### Audit Logging

Every admin operation is logged with:
- Admin user ID
- Tenant affected
- Action performed
- Original data state
- Metadata (admin_action flag)

**Audit Log Queries**:
```sql
-- Find all admin file deletions
SELECT * FROM audit_log
WHERE action_type = 'deleted'
  AND entity_type = 'file'
  AND metadata_json->>'admin_action' = 'true'
ORDER BY created_at DESC;

-- Find all actions by specific admin
SELECT * FROM audit_log
WHERE actor_user_id = 'admin-user-id'
  AND metadata_json->>'admin_action' = 'true'
ORDER BY created_at DESC;
```

---

## Rate Limiting

**Note**: These endpoints are not currently rate-limited, but future implementations may include:
- Max 100 requests per minute per admin user
- Max 1000 files returned per request (via pagination)

---

## Changelog

### Version 1.0 (2026-01-09)
- Initial release
- 6 admin endpoints implemented
- Full Swagger documentation
- Audit logging for all operations
- Platform Admin guard enforcement

---

## Support

For issues or questions:
- **Swagger UI**: `https://api.lead360.app/api/docs`
- **GitHub Issues**: `https://github.com/your-org/lead360/issues`
- **Email**: support@lead360.app

---

**End of Documentation**
