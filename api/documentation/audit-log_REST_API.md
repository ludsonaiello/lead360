# Audit Log REST API Documentation

**Version**: 1.0
**Last Updated**: January 6, 2026
**Base URL**: `https://api.lead360.app/api/v1`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
   - [GET /audit-logs](#1-get-audit-logs)
   - [GET /audit-logs/export](#2-get-audit-logsexport)
   - [GET /audit-logs/:id](#3-get-audit-logsid)
   - [GET /users/:userId/audit-logs](#4-get-usersuseridaudit-logs)
   - [GET /tenants/:tenantId/audit-logs](#5-get-tenantstenantidaudit-logs)
5. [Error Responses](#error-responses)
6. [Examples](#examples)

---

## Overview

The Audit Log API provides read-only access to system audit logs for tracking all actions performed within the Lead360 platform. Audit logs are immutable and automatically generated for authentication events, tenant changes, RBAC modifications, and all CRUD operations.

### Key Features

- **Immutable Logs**: No POST, PATCH, or DELETE operations allowed
- **Async Logging**: Non-blocking log writes via BullMQ queue
- **Tenant Isolation**: Strict enforcement - tenants can only view their own logs
- **Platform Admin Access**: Platform admins can view logs across all tenants
- **Comprehensive Filtering**: Filter by date range, actor, action type, entity, status, and search
- **Export Functionality**: Export up to 10,000 logs to CSV or JSON format
- **Before/After Snapshots**: Track data changes with JSON snapshots
- **Sensitive Data Sanitization**: Passwords and tokens automatically redacted

---

## Authentication & Authorization

### Authentication

All endpoints require JWT authentication via Bearer token:

```http
Authorization: Bearer <jwt_access_token>
```

### Authorization Roles

| Role | Access Level |
|------|-------------|
| **Owner** | View and export logs for their tenant only |
| **Admin** | View and export logs for their tenant only |
| **Platform Admin** | View and export logs across ALL tenants |
| **Regular User** | No access to audit logs |

### Permissions Required

- `audit_log.view` - Required for viewing audit logs
- `audit_log.export` - Required for exporting audit logs
- `platform_admin.view_all_tenants` - Required for cross-tenant access (Platform Admin only)

---

## Data Models

### AuditLog Entity

Complete structure of an audit log entry:

```typescript
{
  // Identity Fields
  id: string;                      // UUID - Unique log identifier
  tenant_id: string | null;        // UUID - Tenant identifier (null for platform-level logs)

  // Actor Information
  actor_user_id: string | null;    // UUID - User who performed the action
  actor_type: ActorType;           // Enum - Type of actor who performed the action

  // Action Details
  entity_type: string;             // String (max 50) - Type of entity affected (e.g., "lead", "tenant", "user")
  entity_id: string;               // String (max 36) - Identifier of affected entity
  description: string;             // Text - Human-readable description of the action
  action_type: ActionType;         // Enum - Type of action performed

  // Change Tracking
  before_json: object | null;      // JSON - State before change (null for creates/deletes)
  after_json: object | null;       // JSON - State after change (null for deletes)
  metadata_json: object | null;    // JSON - Additional metadata about the action

  // Request Context
  ip_address: string | null;       // String (max 45) - IPv4 or IPv6 address
  user_agent: string | null;       // String (max 500) - Browser/client user agent

  // Status & Errors
  status: Status;                  // Enum - Success or failure status
  error_message: string | null;    // Text - Error message if status is failure

  // Timestamps
  created_at: DateTime;            // ISO-8601 timestamp - When the log was created

  // Relationships (populated in responses)
  actor?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;

  tenant?: {
    id: string;
    legal_name: string;
    subdomain: string;
  } | null;
}
```

### Enums

#### ActorType

Defines who performed the action:

```typescript
enum ActorType {
  USER = 'user',                   // Regular user action
  SYSTEM = 'system',               // System-generated action (automated)
  PLATFORM_ADMIN = 'platform_admin', // Platform administrator action
  CRON_JOB = 'cron_job'            // Scheduled background job action
}
```

#### ActionType

Defines what action was performed:

```typescript
enum ActionType {
  CREATED = 'created',             // New entity created
  UPDATED = 'updated',             // Existing entity modified
  DELETED = 'deleted',             // Entity removed
  ACCESSED = 'accessed',           // Entity accessed/viewed (e.g., login)
  FAILED = 'failed'                // Action attempted but failed
}
```

#### Status

Defines the outcome of the action:

```typescript
enum Status {
  SUCCESS = 'success',             // Action completed successfully
  FAILURE = 'failure'              // Action failed (error_message will be populated)
}
```

### Pagination Response

Standard pagination wrapper for list endpoints:

```typescript
{
  data: AuditLog[];                // Array of audit log entries
  pagination: {
    total: number;                 // Total number of logs matching filters
    page: number;                  // Current page number (1-indexed)
    limit: number;                 // Items per page
    totalPages: number;            // Total number of pages available
  }
}
```

---

## API Endpoints

### 1. GET /audit-logs

Retrieve a paginated list of audit logs with optional filters.

#### Endpoint

```
GET https://api.lead360.app/api/v1/audit-logs
```

#### Authentication

- **Required**: Yes (Bearer token)
- **Permissions**: `audit_log.view`

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | `1` | Page number (min: 1) |
| `limit` | integer | No | `50` | Items per page (min: 1, max: 200) |
| `start_date` | string (ISO-8601) | No | - | Filter logs created on or after this date (e.g., `2026-01-01T00:00:00Z`) |
| `end_date` | string (ISO-8601) | No | - | Filter logs created on or before this date (e.g., `2026-01-31T23:59:59Z`) |
| `actor_user_id` | string (UUID) | No | - | Filter by specific user who performed actions |
| `actor_type` | enum | No | - | Filter by actor type: `user`, `system`, `platform_admin`, `cron_job` |
| `action_type` | enum | No | - | Filter by action type: `created`, `updated`, `deleted`, `accessed`, `failed` |
| `entity_type` | string | No | - | Filter by entity type (e.g., `lead`, `tenant`, `user`, `role`) |
| `entity_id` | string | No | - | Filter by specific entity identifier |
| `status` | enum | No | - | Filter by status: `success`, `failure` |
| `search` | string | No | - | Search in description field (case-sensitive substring match) |

#### Request Headers

```http
GET /api/v1/audit-logs?page=1&limit=50&action_type=created HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440100",
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440200",
      "actor_type": "user",
      "entity_type": "lead",
      "entity_id": "550e8400-e29b-41d4-a716-446655440300",
      "description": "Lead created for John Smith",
      "action_type": "created",
      "before_json": null,
      "after_json": {
        "id": "550e8400-e29b-41d4-a716-446655440300",
        "first_name": "John",
        "last_name": "Smith",
        "email": "john.smith@example.com",
        "phone": "+1-555-0123",
        "status": "new"
      },
      "metadata_json": {
        "source": "web_form",
        "campaign_id": "summer-2026"
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "status": "success",
      "error_message": null,
      "created_at": "2026-01-06T10:30:45.123Z",
      "actor": {
        "id": "550e8400-e29b-41d4-a716-446655440200",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane.doe@example.com"
      },
      "tenant": {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "legal_name": "Acme Services LLC",
        "subdomain": "acme"
      }
    }
  ],
  "pagination": {
    "total": 1523,
    "page": 1,
    "limit": 50,
    "totalPages": 31
  }
}
```

#### Error Responses

**401 Unauthorized** - Missing or invalid JWT token

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden** - User lacks required permission

```json
{
  "statusCode": 403,
  "message": "Forbidden - insufficient permissions",
  "error": "Forbidden"
}
```

**400 Bad Request** - Invalid query parameters

```json
{
  "statusCode": 400,
  "message": [
    "limit must not be greater than 200",
    "start_date must be a valid ISO 8601 date string"
  ],
  "error": "Bad Request"
}
```

#### Tenant Isolation

- **Regular Users/Admins**: Automatically filtered to their tenant only
- **Platform Admins**: Can view logs across all tenants

---

### 2. GET /audit-logs/export

Export audit logs to CSV or JSON format with a maximum of 10,000 rows.

#### Endpoint

```
GET https://api.lead360.app/api/v1/audit-logs/export
```

#### Authentication

- **Required**: Yes (Bearer token)
- **Permissions**: `audit_log.export`

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | enum | No | `csv` | Export format: `csv` or `json` |
| `start_date` | string (ISO-8601) | No | - | Filter logs created on or after this date |
| `end_date` | string (ISO-8601) | No | - | Filter logs created on or before this date |
| `actor_user_id` | string (UUID) | No | - | Filter by specific user who performed actions |
| `actor_type` | enum | No | - | Filter by actor type |
| `action_type` | enum | No | - | Filter by action type |
| `entity_type` | string | No | - | Filter by entity type |
| `entity_id` | string | No | - | Filter by specific entity identifier |
| `status` | enum | No | - | Filter by status |
| `search` | string | No | - | Search in description field |

#### Request Headers

```http
GET /api/v1/audit-logs/export?format=csv&start_date=2026-01-01&end_date=2026-01-31 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: text/csv, application/json
```

#### Success Response (200 OK) - CSV Format

**Response Headers:**
```http
HTTP/1.1 200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="audit-log-acme-2026-01-01-2026-01-31.csv"
```

**Response Body:**
```csv
Timestamp,Actor,Actor Type,Tenant,Action,Entity Type,Entity ID,Description,Status,IP Address,Error Message
2026-01-06T10:30:45.123Z,Jane Doe (jane.doe@example.com),user,Acme Services LLC,created,lead,550e8400-e29b-41d4-a716-446655440300,Lead created for John Smith,success,192.168.1.100,N/A
2026-01-06T11:15:22.456Z,Jane Doe (jane.doe@example.com),user,Acme Services LLC,updated,lead,550e8400-e29b-41d4-a716-446655440300,Lead status updated to contacted,success,192.168.1.100,N/A
```

#### Success Response (200 OK) - JSON Format

**Response Headers:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Disposition: attachment; filename="audit-log-acme-2026-01-01-2026-01-31.json"
```

**Response Body:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "timestamp": "2026-01-06T10:30:45.123Z",
    "actor": {
      "id": "550e8400-e29b-41d4-a716-446655440200",
      "name": "Jane Doe",
      "email": "jane.doe@example.com",
      "type": "user"
    },
    "tenant": {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "name": "Acme Services LLC",
      "subdomain": "acme"
    },
    "action": {
      "type": "created",
      "description": "Lead created for John Smith",
      "status": "success",
      "error_message": null
    },
    "entity": {
      "type": "lead",
      "id": "550e8400-e29b-41d4-a716-446655440300"
    },
    "changes": {
      "before": null,
      "after": {
        "id": "550e8400-e29b-41d4-a716-446655440300",
        "first_name": "John",
        "last_name": "Smith",
        "email": "john.smith@example.com"
      }
    },
    "metadata": {
      "source": "web_form",
      "campaign_id": "summer-2026"
    },
    "request": {
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  }
]
```

#### Error Responses

**400 Bad Request** - Too many results

```json
{
  "statusCode": 400,
  "message": "Too many results (15432 rows). Maximum 10000 rows allowed. Please narrow your date range or filters.",
  "error": "Bad Request"
}
```

**400 Bad Request** - No results found

```json
{
  "statusCode": 400,
  "message": "No audit logs found matching your filters.",
  "error": "Bad Request"
}
```

**401 Unauthorized** - Missing or invalid JWT token

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden** - User lacks export permission

```json
{
  "statusCode": 403,
  "message": "Forbidden - insufficient permissions",
  "error": "Forbidden"
}
```

#### Export Limits

- **Maximum Rows**: 10,000 logs per export
- **Enforcement**: Count check performed before fetching data
- **Recommendation**: Use date range filters to narrow results

#### Filename Format

- **CSV**: `audit-log-{subdomain}-{start_date}-{end_date}.csv`
- **JSON**: `audit-log-{subdomain}-{start_date}-{end_date}.json`
- **No Dates**: `audit-log-{subdomain}-all-all.{format}`

---

### 3. GET /audit-logs/:id

Retrieve a single audit log entry by its unique identifier.

#### Endpoint

```
GET https://api.lead360.app/api/v1/audit-logs/:id
```

#### Authentication

- **Required**: Yes (Bearer token)
- **Permissions**: `audit_log.view`

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Unique identifier of the audit log entry |

#### Request Headers

```http
GET /api/v1/audit-logs/550e8400-e29b-41d4-a716-446655440001 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

#### Success Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440100",
  "actor_user_id": "550e8400-e29b-41d4-a716-446655440200",
  "actor_type": "user",
  "entity_type": "lead",
  "entity_id": "550e8400-e29b-41d4-a716-446655440300",
  "description": "Lead status updated from 'new' to 'contacted'",
  "action_type": "updated",
  "before_json": {
    "status": "new",
    "last_contact_date": null
  },
  "after_json": {
    "status": "contacted",
    "last_contact_date": "2026-01-06T10:30:45.123Z"
  },
  "metadata_json": {
    "updated_fields": ["status", "last_contact_date"],
    "reason": "Initial contact via phone call"
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "status": "success",
  "error_message": null,
  "created_at": "2026-01-06T10:30:45.123Z",
  "actor": {
    "id": "550e8400-e29b-41d4-a716-446655440200",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane.doe@example.com"
  },
  "tenant": {
    "id": "550e8400-e29b-41d4-a716-446655440100",
    "legal_name": "Acme Services LLC",
    "subdomain": "acme"
  }
}
```

#### Error Responses

**404 Not Found** - Log does not exist or belongs to different tenant

```json
{
  "statusCode": 404,
  "message": "Audit log entry not found",
  "error": "Not Found"
}
```

**401 Unauthorized** - Missing or invalid JWT token

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden** - User lacks required permission

```json
{
  "statusCode": 403,
  "message": "Forbidden - insufficient permissions",
  "error": "Forbidden"
}
```

**400 Bad Request** - Invalid UUID format

```json
{
  "statusCode": 400,
  "message": "Validation failed (uuid is expected)",
  "error": "Bad Request"
}
```

#### Tenant Isolation

- **Regular Users/Admins**: Can only view logs from their tenant
- **Platform Admins**: Can view logs from any tenant

---

### 4. GET /users/:userId/audit-logs

Retrieve audit logs for a specific user's activity history.

#### Endpoint

```
GET https://api.lead360.app/api/v1/users/:userId/audit-logs
```

#### Authentication

- **Required**: Yes (Bearer token)
- **Permissions**: `audit_log.view`

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string (UUID) | Yes | Unique identifier of the user |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | `1` | Page number (min: 1) |
| `limit` | integer | No | `50` | Items per page (min: 1, max: 200) |
| `start_date` | string (ISO-8601) | No | - | Filter logs created on or after this date |
| `end_date` | string (ISO-8601) | No | - | Filter logs created on or before this date |

#### Request Headers

```http
GET /api/v1/users/550e8400-e29b-41d4-a716-446655440200/audit-logs?page=1&limit=50 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

#### Success Response (200 OK)

Same structure as [GET /audit-logs](#1-get-audit-logs) but filtered to the specified user.

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440100",
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440200",
      "actor_type": "user",
      "entity_type": "lead",
      "entity_id": "550e8400-e29b-41d4-a716-446655440300",
      "description": "Lead created for John Smith",
      "action_type": "created",
      "status": "success",
      "created_at": "2026-01-06T10:30:45.123Z",
      "actor": {
        "id": "550e8400-e29b-41d4-a716-446655440200",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane.doe@example.com"
      },
      "tenant": {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "legal_name": "Acme Services LLC",
        "subdomain": "acme"
      }
    }
  ],
  "pagination": {
    "total": 127,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

#### Error Responses

**404 Not Found** - User not found in tenant

```json
{
  "statusCode": 404,
  "message": "User not found in your tenant",
  "error": "Not Found"
}
```

**401 Unauthorized** - Missing or invalid JWT token

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden** - User lacks required permission

```json
{
  "statusCode": 403,
  "message": "Forbidden - insufficient permissions",
  "error": "Forbidden"
}
```

#### Tenant Isolation

- **Regular Users/Admins**: Can only view activity for users in their tenant
- **Platform Admins**: Can view activity for users across all tenants

---

### 5. GET /tenants/:tenantId/audit-logs

Retrieve audit logs for a specific tenant (Platform Admin only).

#### Endpoint

```
GET https://api.lead360.app/api/v1/tenants/:tenantId/audit-logs
```

#### Authentication

- **Required**: Yes (Bearer token)
- **Permissions**: `platform_admin.view_all_tenants` (Platform Admin only)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | string (UUID) | Yes | Unique identifier of the tenant |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | `1` | Page number (min: 1) |
| `limit` | integer | No | `50` | Items per page (min: 1, max: 200) |
| `start_date` | string (ISO-8601) | No | - | Filter logs created on or after this date |
| `end_date` | string (ISO-8601) | No | - | Filter logs created on or before this date |

#### Request Headers

```http
GET /api/v1/tenants/550e8400-e29b-41d4-a716-446655440100/audit-logs?page=1&limit=50 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

#### Success Response (200 OK)

Same structure as [GET /audit-logs](#1-get-audit-logs) but filtered to the specified tenant.

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440100",
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440200",
      "actor_type": "user",
      "entity_type": "tenant",
      "entity_id": "550e8400-e29b-41d4-a716-446655440100",
      "description": "Tenant settings updated",
      "action_type": "updated",
      "status": "success",
      "created_at": "2026-01-06T10:30:45.123Z",
      "actor": {
        "id": "550e8400-e29b-41d4-a716-446655440200",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane.doe@example.com"
      },
      "tenant": {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "legal_name": "Acme Services LLC",
        "subdomain": "acme"
      }
    }
  ],
  "pagination": {
    "total": 523,
    "page": 1,
    "limit": 50,
    "totalPages": 11
  }
}
```

#### Error Responses

**401 Unauthorized** - Missing or invalid JWT token

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden** - User is not a Platform Admin

```json
{
  "statusCode": 403,
  "message": "Forbidden - Platform Admin only",
  "error": "Forbidden"
}
```

#### Access Control

This endpoint is **Platform Admin only**. Regular users and tenant admins cannot access it.

---

## Error Responses

### Standard Error Format

All errors follow this structure:

```json
{
  "statusCode": number,
  "message": string | string[],
  "error": string
}
```

### HTTP Status Codes

| Status Code | Meaning | When It Occurs |
|-------------|---------|----------------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid query parameters, validation errors, export limits exceeded |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | User lacks required permissions |
| 404 | Not Found | Audit log not found, user not found in tenant |
| 500 | Internal Server Error | Unexpected server error |

### Common Error Scenarios

#### Invalid Date Format

```json
{
  "statusCode": 400,
  "message": [
    "start_date must be a valid ISO 8601 date string"
  ],
  "error": "Bad Request"
}
```

#### Invalid UUID

```json
{
  "statusCode": 400,
  "message": "Validation failed (uuid is expected)",
  "error": "Bad Request"
}
```

#### Pagination Limit Exceeded

```json
{
  "statusCode": 400,
  "message": [
    "limit must not be greater than 200"
  ],
  "error": "Bad Request"
}
```

#### Export Too Large

```json
{
  "statusCode": 400,
  "message": "Too many results (15432 rows). Maximum 10000 rows allowed. Please narrow your date range or filters.",
  "error": "Bad Request"
}
```

---

## Examples

### Example 1: Get Recent Failed Actions

**Request:**
```http
GET /api/v1/audit-logs?action_type=failed&status=failure&limit=10 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440999",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440100",
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440200",
      "actor_type": "user",
      "entity_type": "lead",
      "entity_id": "N/A",
      "description": "Failed to delete lead",
      "action_type": "failed",
      "before_json": null,
      "after_json": null,
      "metadata_json": {
        "endpoint": "/api/v1/leads/550e8400-e29b-41d4-a716-446655440300",
        "method": "DELETE"
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "status": "failure",
      "error_message": "Permission denied: leads.delete",
      "created_at": "2026-01-06T14:25:33.789Z",
      "actor": {
        "id": "550e8400-e29b-41d4-a716-446655440200",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane.doe@example.com"
      },
      "tenant": {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "legal_name": "Acme Services LLC",
        "subdomain": "acme"
      }
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### Example 2: Export Last Month's Logs to CSV

**Request:**
```http
GET /api/v1/audit-logs/export?format=csv&start_date=2025-12-01T00:00:00Z&end_date=2025-12-31T23:59:59Z HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response Headers:**
```http
HTTP/1.1 200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="audit-log-acme-2025-12-01-2025-12-31.csv"
```

**Response Body:**
```csv
Timestamp,Actor,Actor Type,Tenant,Action,Entity Type,Entity ID,Description,Status,IP Address,Error Message
2025-12-15T10:30:45.123Z,Jane Doe (jane.doe@example.com),user,Acme Services LLC,created,lead,550e8400-e29b-41d4-a716-446655440300,Lead created for John Smith,success,192.168.1.100,N/A
2025-12-15T11:15:22.456Z,Jane Doe (jane.doe@example.com),user,Acme Services LLC,updated,lead,550e8400-e29b-41d4-a716-446655440300,Lead status updated to contacted,success,192.168.1.100,N/A
```

### Example 3: Get User Activity for Last 7 Days

**Request:**
```http
GET /api/v1/users/550e8400-e29b-41d4-a716-446655440200/audit-logs?start_date=2025-12-30T00:00:00Z&end_date=2026-01-06T23:59:59Z&limit=100 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440100",
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440200",
      "actor_type": "user",
      "entity_type": "lead",
      "entity_id": "550e8400-e29b-41d4-a716-446655440300",
      "description": "Lead created for John Smith",
      "action_type": "created",
      "status": "success",
      "created_at": "2026-01-05T10:30:45.123Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440100",
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440200",
      "actor_type": "user",
      "entity_type": "lead",
      "entity_id": "550e8400-e29b-41d4-a716-446655440301",
      "description": "Lead updated",
      "action_type": "updated",
      "status": "success",
      "created_at": "2026-01-04T14:22:10.555Z"
    }
  ],
  "pagination": {
    "total": 23,
    "page": 1,
    "limit": 100,
    "totalPages": 1
  }
}
```

### Example 4: Search for Specific Actions

**Request:**
```http
GET /api/v1/audit-logs?search=password&entity_type=user&action_type=updated HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440888",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440100",
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440200",
      "actor_type": "user",
      "entity_type": "user",
      "entity_id": "550e8400-e29b-41d4-a716-446655440200",
      "description": "User password changed",
      "action_type": "updated",
      "before_json": {
        "password_hash": "[REDACTED]"
      },
      "after_json": {
        "password_hash": "[REDACTED]"
      },
      "metadata_json": {
        "password_strength": "strong",
        "requires_mfa": true
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "status": "success",
      "error_message": null,
      "created_at": "2026-01-03T09:45:12.333Z",
      "actor": {
        "id": "550e8400-e29b-41d4-a716-446655440200",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane.doe@example.com"
      },
      "tenant": {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "legal_name": "Acme Services LLC",
        "subdomain": "acme"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

### Example 5: Platform Admin Views Specific Tenant's Logs

**Request:**
```http
GET /api/v1/tenants/550e8400-e29b-41d4-a716-446655440100/audit-logs?page=1&limit=25 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Platform Admin token)
```

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440100",
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440200",
      "actor_type": "user",
      "entity_type": "tenant",
      "entity_id": "550e8400-e29b-41d4-a716-446655440100",
      "description": "Tenant branding updated",
      "action_type": "updated",
      "before_json": {
        "logo_url": "https://storage.lead360.app/tenants/acme/old-logo.png"
      },
      "after_json": {
        "logo_url": "https://storage.lead360.app/tenants/acme/new-logo.png"
      },
      "status": "success",
      "created_at": "2026-01-06T10:30:45.123Z",
      "actor": {
        "id": "550e8400-e29b-41d4-a716-446655440200",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane.doe@example.com"
      },
      "tenant": {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "legal_name": "Acme Services LLC",
        "subdomain": "acme"
      }
    }
  ],
  "pagination": {
    "total": 523,
    "page": 1,
    "limit": 25,
    "totalPages": 21
  }
}
```

---

## Rate Limiting

Currently, there are no rate limits enforced on audit log endpoints. However, the 10,000 row export limit helps prevent resource exhaustion.

**Recommendations:**
- Use pagination for large result sets
- Apply date range filters to narrow results
- Export in batches if needed (e.g., monthly exports)

---

## Data Retention

- **Default Retention**: 7 years (2557 days)
- **Automatic Cleanup**: Old logs are archived and dropped via cron job (1st of each month at 2 AM)
- **Partitioning**: Monthly partitions for performance (future feature)

---

## Sensitive Data Handling

Sensitive fields are automatically sanitized before logging:

### Redacted Fields

The following fields are replaced with `[REDACTED]` in before_json and after_json:

- `password`
- `password_hash`
- `activation_token`
- `password_reset_token`
- `mfa_secret`
- `api_key`
- `access_token`
- `refresh_token`

**Example:**
```json
{
  "before_json": {
    "email": "user@example.com",
    "password": "[REDACTED]",
    "first_name": "John"
  }
}
```

---

## Best Practices

### For Developers

1. **Always filter by date range** when possible to improve query performance
2. **Use pagination** for large result sets instead of high limit values
3. **Monitor export sizes** - if exports frequently exceed 10k rows, implement date-based batching
4. **Cache frequently accessed logs** if needed (e.g., recent activity dashboards)

### For Administrators

1. **Regular exports** - Export monthly logs for long-term archival
2. **Audit failed actions** - Regularly review logs with `status=failure` to identify security issues
3. **Monitor user activity** - Use `/users/:userId/audit-logs` to track specific users if suspicious activity is detected
4. **Leverage search** - Use the search parameter to find specific actions (e.g., "password reset", "permission denied")

---

## Future Enhancements (Phase 2)

- **S3 Archiving**: Automatic archival of old partitions to S3 before deletion
- **Real-time Log Streaming**: WebSocket endpoint for live log updates
- **Advanced Filtering**: Full-text search, regex support
- **Analytics Dashboard**: Pre-built queries for common audit scenarios
- **Retention Policies**: Per-tenant customizable retention periods

---

## Support & Feedback

For questions, issues, or feature requests related to the Audit Log API:

- **API Documentation**: https://api.lead360.app/api/docs
- **Technical Support**: support@lead360.app
- **Bug Reports**: https://github.com/lead360/platform/issues

---

**Last Updated**: January 6, 2026
**API Version**: 1.0
**Documentation Version**: 1.0
