# Quote Admin Operational Tools REST API Documentation

**Version**: 1.0
**Base URL**: `https://api.lead360.app/api/v1`
**Last Updated**: February 2026

---

## Overview

This document describes the **Platform Admin Operational Tools API** for the Quote Module. These endpoints provide emergency operations, bulk actions, diagnostic tools, and maintenance capabilities exclusively for Platform Administrators.

### Key Features
- **Emergency Operations** - Hard delete quotes with full audit trail
- **Bulk Actions** - Update multiple quotes simultaneously
- **Quote Repair** - Fix broken quote data (totals, relationships)
- **System Diagnostics** - Health checks for PDF, email, storage, database, cache
- **Maintenance Tools** - Cleanup orphaned records
- **Cross-Tenant Search** - List and search quotes across all tenants

---

## Authentication

All endpoints require:
- **Bearer Token**: JWT token in Authorization header
- **Platform Admin Role**: User must have `is_platform_admin: true` flag

### Example Authorization Header
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Error Responses

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 403 Forbidden (Non-Platform Admin)
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required"
}
```

---

## Endpoints

### 1. Hard Delete Quote (Emergency)

Permanently delete a quote with full cascade and audit trail.

**⚠️ CRITICAL**: This is an irreversible operation. Use only in emergencies.

**Endpoint**: `DELETE /admin/quotes/:id/hard-delete`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Quote UUID to delete |

**Request Body**:
```json
{
  "reason": "Quote created by mistake and contains test data that should not be in production",
  "confirm": true
}
```

**Request Body Schema**:
| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `reason` | string | Yes | Min 10 chars | Mandatory reason for deletion (audit trail) |
| `confirm` | boolean | Yes | Must be `true` | Confirmation flag - prevents accidental deletion |

**Success Response** (200 OK):
```json
{
  "message": "Quote deleted permanently",
  "quote_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "660e8400-e29b-41d4-a716-446655440001",
  "deleted_at": "2024-01-15T10:30:00.000Z",
  "deleted_by": "770e8400-e29b-41d4-a716-446655440002",
  "reason": "Quote created by mistake and contains test data that should not be in production"
}
```

**Error Responses**:

**400 Bad Request** - Confirmation not provided:
```json
{
  "statusCode": 400,
  "message": "Confirmation required - set confirm flag to true",
  "error": "Bad Request"
}
```

**404 Not Found** - Quote doesn't exist:
```json
{
  "statusCode": 404,
  "message": "Quote not found: 550e8400-e29b-41d4-a716-446655440000",
  "error": "Not Found"
}
```

**409 Conflict** - Child quotes exist:
```json
{
  "statusCode": 409,
  "message": "Cannot delete quote: 2 change order(s) reference this quote. Delete child quotes first.",
  "error": "Conflict"
}
```

**Example Request**:
```bash
curl -X DELETE "https://api.lead360.app/api/v1/admin/quotes/550e8400-e29b-41d4-a716-446655440000/hard-delete" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Quote created by mistake and contains test data",
    "confirm": true
  }'
```

**What Gets Deleted**:
- Quote record
- All quote items
- All quote groups
- All quote versions
- All quote notes
- All quote attachments
- All quote approvals
- All discount rules
- All draw schedule entries
- All public access tokens
- All view/download logs
- All tag assignments

---

### 2. Bulk Update Quote Status

Update the status of multiple quotes simultaneously.

**Endpoint**: `POST /admin/quotes/bulk-update`

**Request Body**:
```json
{
  "quote_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "new_status": "approved",
  "reason": "Correcting status after system error during migration"
}
```

**Request Body Schema**:
| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `quote_ids` | string[] | Yes | Min 1 item, UUID array | Array of quote IDs to update |
| `new_status` | enum | Yes | Valid quote status | New status to apply |
| `reason` | string | Yes | Min 10 chars | Reason for bulk update (audit trail) |

**Valid Status Values**:
- `draft`
- `pending`
- `sent`
- `delivered`
- `read`
- `opened`
- `downloaded`
- `approved`
- `denied`
- `expired`
- `started`
- `concluded`
- `lost`

**Success Response** (200 OK):
```json
{
  "updated_count": 5,
  "failed_count": 2,
  "errors": [
    {
      "quote_id": "550e8400-e29b-41d4-a716-446655440003",
      "error": "Quote not found"
    },
    {
      "quote_id": "550e8400-e29b-41d4-a716-446655440004",
      "error": "Invalid status transition from expired to approved"
    }
  ]
}
```

**Example Request**:
```bash
curl -X POST "https://api.lead360.app/api/v1/admin/quotes/bulk-update" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_ids": ["quote-1", "quote-2", "quote-3"],
    "new_status": "approved",
    "reason": "Correcting status after system error"
  }'
```

---

### 3. Repair Quote

Fix broken quote data (recalculate totals, fix orphaned relationships).

**Endpoint**: `POST /admin/quotes/:id/repair`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Quote UUID to repair |

**Request Body**:
```json
{
  "issue_type": "recalculate_totals",
  "notes": "Totals were incorrect after manual item edit"
}
```

**Request Body Schema**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `issue_type` | enum | Yes | Type of repair: `recalculate_totals`, `fix_relationships`, `reset_status` |
| `notes` | string | No | Optional notes about the repair |

**Issue Types**:
- **`recalculate_totals`**: Re-run pricing calculations (subtotal, tax, discount, total)
- **`fix_relationships`**: Repair orphaned items (items with invalid group references)
- **`reset_status`**: Note that status reset available via bulk update endpoint

**Success Response** (200 OK):
```json
{
  "message": "Quote repaired successfully",
  "repairs_made": [
    "Recalculated subtotal",
    "Recalculated tax",
    "Recalculated discount",
    "Recalculated total"
  ],
  "before": {
    "subtotal": 1000.0,
    "tax": 80.0,
    "discount": 0,
    "total": 1080.0
  },
  "after": {
    "subtotal": 1000.0,
    "tax": 100.0,
    "discount": 0,
    "total": 1100.0
  }
}
```

**Example Request**:
```bash
curl -X POST "https://api.lead360.app/api/v1/admin/quotes/550e8400-e29b-41d4-a716-446655440000/repair" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "issue_type": "recalculate_totals",
    "notes": "Totals were incorrect after manual item edit"
  }'
```

---

### 4. Run System Diagnostics

Run health checks on system components.

**Endpoint**: `GET /admin/quotes/diagnostics/run-tests`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `test_type` | enum | No | `all` | Type of tests to run |

**Test Types**:
- `all` - Run all diagnostic tests (default)
- `database` - Database connectivity test
- `cache` - Redis cache test
- `storage` - File storage test
- `pdf` - PDF generation service test
- `email` - Email queue test

**Success Response** (200 OK):
```json
{
  "test_suite": "All Systems",
  "tests_run": 5,
  "passed": 4,
  "failed": 1,
  "results": [
    {
      "test_name": "Database Connectivity",
      "status": "pass",
      "duration_ms": 15
    },
    {
      "test_name": "Cache (Redis)",
      "status": "pass",
      "duration_ms": 8
    },
    {
      "test_name": "File Storage",
      "status": "pass",
      "duration_ms": 12
    },
    {
      "test_name": "PDF Generation Service",
      "status": "pass",
      "duration_ms": 5
    },
    {
      "test_name": "Email Queue",
      "status": "fail",
      "duration_ms": 3000,
      "error_message": "Connection timeout"
    }
  ]
}
```

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/diagnostics/run-tests?test_type=all" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. Cleanup Orphaned Records

Find and remove orphaned database records (items, groups, attachments without valid quote).

**Endpoint**: `POST /admin/quotes/maintenance/cleanup-orphans`

**Request Body**:
```json
{
  "dry_run": true,
  "entity_type": "all"
}
```

**Request Body Schema**:
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `dry_run` | boolean | No | `true` | If true, only count orphans without deleting |
| `entity_type` | enum | Yes | - | Type of entities to clean: `items`, `groups`, `attachments`, `all` |

**Success Response** (200 OK):
```json
{
  "dry_run": true,
  "orphans_found": 25,
  "orphans_deleted": 0,
  "details": [
    {
      "entity_type": "quote_item",
      "count": 15
    },
    {
      "entity_type": "quote_group",
      "count": 8
    },
    {
      "entity_type": "quote_attachment",
      "count": 2
    }
  ]
}
```

**Example Request (Dry Run)**:
```bash
curl -X POST "https://api.lead360.app/api/v1/admin/quotes/maintenance/cleanup-orphans" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dry_run": true,
    "entity_type": "all"
  }'
```

**Example Request (Actual Cleanup)**:
```bash
curl -X POST "https://api.lead360.app/api/v1/admin/quotes/maintenance/cleanup-orphans" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dry_run": false,
    "entity_type": "items"
  }'
```

---

### 6. List Quotes Across All Tenants

Search and list quotes from all tenants (cross-tenant query).

**Endpoint**: `GET /admin/quotes`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tenant_id` | UUID | No | - | Filter by specific tenant |
| `status` | string | No | - | Filter by quote status |
| `search` | string | No | - | Search by quote number or customer name |
| `date_from` | ISO 8601 | No | - | Filter quotes created after this date |
| `date_to` | ISO 8601 | No | - | Filter quotes created before this date |
| `page` | number | No | 1 | Page number (starts at 1) |
| `limit` | number | No | 50 | Items per page (max 100) |

**Success Response** (200 OK):
```json
{
  "quotes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "quote_number": "Q-2024-001",
      "title": "Roofing Project",
      "status": "approved",
      "total": 15000.0,
      "created_at": "2024-01-15T10:30:00.000Z",
      "tenant": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "company_name": "ABC Roofing",
        "subdomain": "abc-roofing"
      },
      "customer_name": "John Smith"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "quote_number": "Q-2024-002",
      "title": "Construction Project",
      "status": "sent",
      "total": 25000.0,
      "created_at": "2024-01-16T14:20:00.000Z",
      "tenant": {
        "id": "660e8400-e29b-41d4-a716-446655440003",
        "company_name": "XYZ Construction",
        "subdomain": "xyz-construction"
      },
      "customer_name": "Jane Doe"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 250,
    "total_pages": 5
  },
  "filters_applied": {
    "status": "approved",
    "date_from": "2024-01-01T00:00:00.000Z",
    "date_to": "2024-01-31T23:59:59.999Z"
  }
}
```

**Example Request**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes?status=approved&page=1&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Security & Audit

### Audit Logging

All operational endpoints create audit log entries with:
- **Admin User ID**: Who performed the action
- **Tenant ID**: Which tenant was affected
- **Action Type**: created, updated, deleted
- **Before/After State**: For destructive operations
- **Reason**: Mandatory for destructive operations
- **Timestamp**: When the action occurred
- **IP Address**: Source IP of the request

### Multi-Tenant Data Protection

**CRITICAL**: These endpoints intentionally bypass tenant isolation to allow Platform Admins to access data across all tenants.

**Safeguards**:
- ✅ Platform Admin role required (`is_platform_admin: true`)
- ✅ All actions logged in audit trail
- ✅ Confirmation required for destructive operations
- ✅ Dry run mode default for cleanup operations
- ✅ Defensive permission checks at controller level

---

## Error Handling

### HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success - Operation completed |
| 400 | Bad Request - Invalid parameters or missing confirmation |
| 401 | Unauthorized - Missing or invalid JWT token |
| 403 | Forbidden - User is not Platform Admin |
| 404 | Not Found - Quote or resource doesn't exist |
| 409 | Conflict - Operation blocked (e.g., child quotes exist) |
| 500 | Internal Server Error - Server-side error |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Detailed error message or array of validation errors",
  "error": "Bad Request"
}
```

---

## Rate Limiting

Operational endpoints are rate-limited to prevent abuse:

- **Hard Delete**: 10 requests per hour per admin user
- **Bulk Update**: 20 requests per hour per admin user
- **Diagnostics**: 60 requests per hour (global)
- **Other endpoints**: Standard API rate limits apply

---

## Best Practices

### Hard Delete
1. Always try soft delete first (via regular quote endpoints)
2. Document reason thoroughly for audit compliance
3. Verify no child quotes exist before deletion
4. Coordinate with affected tenant if possible

### Bulk Update
1. Start with small batches (< 50 quotes) to test
2. Monitor error responses for patterns
3. Review audit logs after large bulk operations
4. Notify affected tenants for major status changes

### Quote Repair
1. Try diagnostic queries first to understand the issue
2. Always test with `recalculate_totals` before other repairs
3. Document findings in the notes field
4. Verify repair with tenant after completion

### Diagnostics
1. Run `all` tests before investigating specific failures
2. Schedule regular diagnostic checks (daily/weekly)
3. Alert on consecutive failures
4. Monitor response times for performance degradation

### Cleanup Orphans
1. Always run with `dry_run: true` first
2. Review counts before actual cleanup
3. Schedule regular cleanup (monthly recommended)
4. Alert if orphan counts are unexpectedly high

---

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Feb 2026 | Initial operational tools API | Developer 3 |

---

## Support

For questions or issues:
- **API Issues**: Contact backend team
- **Platform Admin Access**: Contact system administrator
- **Emergency Operations**: Document incident before using emergency endpoints

---

**End of API Documentation**
