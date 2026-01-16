# Admin Panel REST API Documentation

**Version**: 1.0
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer Token (JWT)
**Authorization**: Platform Admin Only (`is_platform_admin = true`)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Dashboard APIs (3 endpoints)](#dashboard-apis)
3. [Tenant Management APIs (7 endpoints)](#tenant-management-apis)
4. [Impersonation APIs (2 endpoints)](#impersonation-apis)
5. [User Management APIs (6 endpoints)](#user-management-apis)
6. [System Settings APIs (6 endpoints)](#system-settings-apis)
7. [Alerts & Notifications APIs (4 endpoints)](#alerts--notifications-apis)
8. [Data Export APIs (5 endpoints)](#data-export-apis)
9. [Error Responses](#error-responses)
10. [Rate Limiting](#rate-limiting)

---

## Authentication

All admin panel endpoints require:

1. **JWT Authentication**: Include `Authorization: Bearer {token}` header
2. **Platform Admin Role**: User must have `is_platform_admin = true`

### Example Authentication Header

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Obtaining JWT Token

Use the standard authentication endpoint:

```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@lead360.com",
  "password": "your-password"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "admin@lead360.com",
    "first_name": "Admin",
    "last_name": "User",
    "is_platform_admin": true,
    "tenant_id": null
  }
}
```

---

## Dashboard APIs

### 1. Get Dashboard Metrics

Retrieve comprehensive dashboard metrics including tenants, users, jobs, storage, and system health.

**Endpoint**: `GET /admin/dashboard/metrics`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Query Parameters**: None

**Response** (`200 OK`):
```json
{
  "activeTenants": {
    "count": 150,
    "growth": {
      "count": 12,
      "percentage": 8.7,
      "trend": "up"
    },
    "sparkline": [1, 2, 3, 5, 4, 6, 8, 7, 9, 10, 11, 12, 13, 15, 14, 16, 18, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
  },
  "totalUsers": {
    "count": 2450,
    "growth": {
      "count": 87,
      "percentage": 3.7,
      "trend": "up"
    },
    "sparkline": [10, 12, 15, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50, 52, 55, 58, 60, 62, 65, 68, 70, 72, 75, 78, 80, 87]
  },
  "jobSuccessRate": {
    "percentage": 98.5,
    "totalJobs": 1247,
    "failedJobs": 19,
    "status": "healthy"
  },
  "storageUsed": {
    "current": 45.67,
    "limit": 75000,
    "percentage": 0.06
  },
  "systemHealth": {
    "status": "healthy",
    "checks": {
      "database": true,
      "redis": true
    }
  }
}
```

**Response Fields**:
- `activeTenants.count` (number): Total active tenants
- `activeTenants.growth.count` (number): New tenants this month
- `activeTenants.growth.percentage` (number): Month-over-month growth %
- `activeTenants.growth.trend` (string): "up", "down", or "stable"
- `activeTenants.sparkline` (number[]): Daily tenant creation counts (last 30 days)
- `totalUsers.count` (number): Total active users across all tenants
- `totalUsers.growth.count` (number): New users this month
- `totalUsers.growth.percentage` (number): Month-over-month growth %
- `totalUsers.growth.trend` (string): "up", "down", or "stable"
- `totalUsers.sparkline` (number[]): Daily user creation counts (last 30 days)
- `jobSuccessRate.percentage` (number): Success rate (0-100)
- `jobSuccessRate.totalJobs` (number): Total jobs in last 24 hours
- `jobSuccessRate.failedJobs` (number): Failed jobs in last 24 hours
- `jobSuccessRate.status` (string): "healthy" (>95%), "warning" (90-95%), "critical" (<90%)
- `storageUsed.current` (number): Storage used in GB
- `storageUsed.limit` (number): Total storage limit in GB
- `storageUsed.percentage` (number): Percentage of limit used
- `systemHealth.status` (string): "healthy" or "unhealthy"
- `systemHealth.checks.database` (boolean): Database connectivity
- `systemHealth.checks.redis` (boolean): Redis connectivity

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 2. Get Chart Data

Retrieve time-series or distribution data for dashboard charts.

**Endpoint**: `GET /admin/dashboard/charts/:chartType`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `chartType` (string, required): One of:
  - `tenant-growth` - 90-day tenant growth time-series
  - `user-signups` - 90-day user signups time-series
  - `job-trends` - 7-day job success/failure trends
  - `tenants-by-industry` - Industry distribution
  - `tenants-by-size` - Size distribution
  - `users-by-role` - Role distribution

**Query Parameters**: None

**Response for Time-Series Charts** (`tenant-growth`, `user-signups`):
```json
[
  {
    "date": "2026-01-09",
    "count": 5,
    "cumulative": 150
  },
  {
    "date": "2026-01-08",
    "count": 3,
    "cumulative": 145
  }
  // ... 90 days total
]
```

**Response for Job Trends Chart** (`job-trends`):
```json
[
  {
    "date": "2026-01-09",
    "success": 120,
    "failed": 3,
    "successRate": 97.6
  },
  {
    "date": "2026-01-08",
    "success": 115,
    "failed": 5,
    "successRate": 95.8
  }
  // ... 7 days total
]
```

**Response for Distribution Charts** (`tenants-by-industry`, `tenants-by-size`, `users-by-role`):
```json
[
  {
    "category": "Small (1-5 users)",
    "count": 45,
    "percentage": 30.0
  },
  {
    "category": "Medium (6-20 users)",
    "count": 80,
    "percentage": 53.3
  },
  {
    "category": "Large (21+ users)",
    "count": 25,
    "percentage": 16.7
  }
]
```

**Error Responses**:
- `400 Bad Request`: Invalid chart type
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 3. Get Recent Activity

Retrieve recent activity feed from audit log.

**Endpoint**: `GET /admin/dashboard/activity`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Query Parameters**:
- `limit` (number, optional): Number of items to return (default: 10, max: 50)

**Example Request**:
```http
GET /admin/dashboard/activity?limit=10
```

**Response** (`200 OK`):
```json
[
  {
    "id": "activity-uuid-1",
    "action": "created",
    "entity": "tenant",
    "entityId": "tenant-uuid-123",
    "description": "Tenant manually created by Platform Admin",
    "actor": {
      "id": "user-uuid-456",
      "name": "Admin User",
      "email": "admin@lead360.com"
    },
    "timestamp": "2026-01-09T12:34:56Z",
    "status": "success"
  },
  {
    "id": "activity-uuid-2",
    "action": "updated",
    "entity": "user",
    "entityId": "user-uuid-789",
    "description": "User deactivated by Platform Admin",
    "actor": {
      "id": "user-uuid-456",
      "name": "Admin User",
      "email": "admin@lead360.com"
    },
    "timestamp": "2026-01-09T11:20:30Z",
    "status": "success"
  }
]
```

**Response Fields**:
- `id` (string): Activity ID (UUID)
- `action` (string): "created", "updated", "deleted", or "failed"
- `entity` (string): Entity type (e.g., "tenant", "user", "job")
- `entityId` (string): Entity ID
- `description` (string): Human-readable description
- `actor` (object|null): User who performed the action
  - `id` (string): User ID
  - `name` (string): Full name
  - `email` (string): Email address
- `timestamp` (string): ISO 8601 timestamp
- `status` (string): "success" or "failure"

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

## Tenant Management APIs

### 4. List All Tenants

Retrieve paginated list of tenants with optional filters.

**Endpoint**: `GET /admin/tenants`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `status` (string, optional): Filter by status ("active", "suspended", "deleted")
- `created_from` (string, optional): Filter by creation date (ISO 8601)
- `created_to` (string, optional): Filter by creation date (ISO 8601)
- `search` (string, optional): Search subdomain, company name, or email

**Example Request**:
```http
GET /admin/tenants?page=1&limit=20&status=active&search=acme
```

**Response** (`200 OK`):
```json
{
  "data": [
    {
      "id": "tenant-uuid-123",
      "subdomain": "acme-roofing",
      "company_name": "Acme Roofing LLC",
      "is_active": true,
      "deleted_at": null,
      "primary_contact_email": "owner@acme-roofing.com",
      "user_count": 5,
      "created_at": "2026-01-05T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

**Response Fields**:
- `data` (array): Array of tenant objects
  - `id` (string): Tenant ID (UUID)
  - `subdomain` (string): Tenant subdomain
  - `company_name` (string): Company name
  - `is_active` (boolean): Active status
  - `deleted_at` (string|null): Deletion timestamp (ISO 8601) or null
  - `primary_contact_email` (string): Primary contact email
  - `user_count` (number): Number of users in tenant
  - `created_at` (string): Creation timestamp (ISO 8601)
- `pagination` (object):
  - `page` (number): Current page
  - `limit` (number): Items per page
  - `total` (number): Total number of tenants
  - `total_pages` (number): Total pages

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 5. Get Tenant Details

Retrieve full tenant details including users, stats, storage, and jobs.

**Endpoint**: `GET /admin/tenants/:id`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Example Request**:
```http
GET /admin/tenants/tenant-uuid-123
```

**Response** (`200 OK`):
```json
{
  "id": "tenant-uuid-123",
  "subdomain": "acme-roofing",
  "company_name": "Acme Roofing LLC",
  "legal_business_name": "Acme Roofing Limited Liability Company",
  "business_entity_type": "LLC",
  "state_of_registration": "NY",
  "ein": "12-3456789",
  "primary_contact_phone": "5551234567",
  "primary_contact_email": "owner@acme-roofing.com",
  "is_active": true,
  "deleted_at": null,
  "created_at": "2026-01-05T10:00:00Z",
  "updated_at": "2026-01-09T12:00:00Z",
  "subscription_plan": {
    "id": "plan-uuid",
    "name": "Professional",
    "monthly_price": 99.00
  },
  "file_tenant_logo_file_idTofile": {
    "file_id": "file-uuid",
    "original_filename": "logo.png",
    "mime_type": "image/png",
    "storage_path": "/uploads/tenant-uuid-123/logo.png"
  },
  "users": [
    {
      "id": "user-uuid-456",
      "email": "owner@acme-roofing.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_active": true,
      "last_login_at": "2026-01-09T11:00:00Z",
      "created_at": "2026-01-05T10:05:00Z",
      "roles": ["Owner"]
    }
  ],
  "stats": {
    "user_count": 5,
    "file_count": 42,
    "storage_used_bytes": 1048576000,
    "storage_used_gb": "1.00",
    "jobs": {
      "pending": 2,
      "processing": 1,
      "completed": 150,
      "failed": 3
    }
  },
  "_count": {
    "user": 5,
    "file_file_tenant_idTotenant": 42
  }
}
```

**Response Fields**:
- `id` (string): Tenant ID (UUID)
- `subdomain` (string): Subdomain (3-63 chars, lowercase alphanumeric + hyphens)
- `company_name` (string): Company name
- `legal_business_name` (string): Legal business name
- `business_entity_type` (string): "LLC", "Corporation", "Sole Proprietorship", "Partnership"
- `state_of_registration` (string): 2-letter state code
- `ein` (string): Employer Identification Number (format: XX-XXXXXXX)
- `primary_contact_phone` (string): Primary phone number (10 digits)
- `primary_contact_email` (string): Primary contact email
- `is_active` (boolean): Active status
- `deleted_at` (string|null): Deletion timestamp or null
- `created_at` (string): Creation timestamp (ISO 8601)
- `updated_at` (string): Last update timestamp (ISO 8601)
- `subscription_plan` (object|null): Subscription plan details
- `file_tenant_logo_file_idTofile` (object|null): Logo file details
- `users` (array): Array of user objects with roles
- `stats` (object): Usage statistics
  - `user_count` (number): Total users
  - `file_count` (number): Total files (not trashed)
  - `storage_used_bytes` (number): Storage in bytes
  - `storage_used_gb` (string): Storage in GB (2 decimal places)
  - `jobs` (object): Job counts by status

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 6. Create Tenant Manually

Create a new tenant with owner user (Platform Admin only).

**Endpoint**: `POST /admin/tenants`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Request Body**:
```json
{
  "subdomain": "acme-roofing",
  "business_name": "Acme Roofing LLC",
  "business_entity_type": "LLC",
  "state_of_registration": "NY",
  "ein": "12-3456789",
  "owner_email": "owner@acme-roofing.com",
  "owner_password": "SecurePass123!",
  "owner_first_name": "John",
  "owner_last_name": "Doe",
  "owner_phone": "5551234567",
  "skip_email_verification": false
}
```

**Request Body Fields**:
- `subdomain` (string, required): Subdomain (3-63 chars, lowercase, alphanumeric + hyphens)
- `business_name` (string, required): Business name (2-255 chars)
- `business_entity_type` (string, optional): "LLC", "Corporation", "Sole Proprietorship", "Partnership"
- `state_of_registration` (string, optional): 2-letter state code
- `ein` (string, optional): EIN (format: XX-XXXXXXX), auto-generated if omitted
- `owner_email` (string, required): Owner email (must be unique)
- `owner_password` (string, required): Owner password (min 8 chars)
- `owner_first_name` (string, required): Owner first name (1-100 chars)
- `owner_last_name` (string, required): Owner last name (1-100 chars)
- `owner_phone` (string, optional): Owner phone (10 digits)
- `skip_email_verification` (boolean, optional): If true, activates account immediately (default: false)

**Response** (`201 Created`):
```json
{
  "tenant": {
    "id": "tenant-uuid-123",
    "subdomain": "acme-roofing",
    "company_name": "Acme Roofing LLC",
    "legal_business_name": "Acme Roofing LLC",
    "business_entity_type": "LLC",
    "state_of_registration": "NY",
    "ein": "12-3456789",
    "primary_contact_phone": "5551234567",
    "primary_contact_email": "owner@acme-roofing.com",
    "is_active": true,
    "created_at": "2026-01-09T12:00:00Z",
    "updated_at": "2026-01-09T12:00:00Z"
  },
  "owner": {
    "id": "user-uuid-456",
    "email": "owner@acme-roofing.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true
  }
}
```

**Error Responses**:
- `400 Bad Request`: Validation failed (invalid subdomain, email, etc.)
- `409 Conflict`: Subdomain or email already exists
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin
- `500 Internal Server Error`: Transaction failed

---

### 7. Update Tenant

Update tenant information.

**Endpoint**: `PATCH /admin/tenants/:id`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Request Body** (all fields optional):
```json
{
  "company_name": "Acme Roofing LLC",
  "legal_business_name": "Acme Roofing Limited Liability Company",
  "business_entity_type": "LLC",
  "state_of_registration": "NY",
  "ein": "12-3456789",
  "primary_contact_phone": "5551234567",
  "primary_contact_email": "contact@acme-roofing.com"
}
```

**Response** (`200 OK`):
```json
{
  "message": "Update endpoint - to be implemented"
}
```

*Note: This endpoint is currently a stub. Full implementation can be added as needed.*

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 8. Suspend Tenant

Suspend a tenant and invalidate all user sessions.

**Endpoint**: `PATCH /admin/tenants/:id/suspend`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Request Body**:
```json
{
  "reason": "Payment overdue"
}
```

**Request Body Fields**:
- `reason` (string, optional): Reason for suspension (max 500 chars)

**Response** (`200 OK`):
```json
{
  "id": "tenant-uuid-123",
  "subdomain": "acme-roofing",
  "company_name": "Acme Roofing LLC",
  "is_active": false,
  "updated_at": "2026-01-09T12:30:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `409 Conflict`: Tenant is already suspended
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 9. Activate Tenant

Reactivate a suspended tenant.

**Endpoint**: `PATCH /admin/tenants/:id/activate`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Request Body**: None

**Response** (`200 OK`):
```json
{
  "id": "tenant-uuid-123",
  "subdomain": "acme-roofing",
  "company_name": "Acme Roofing LLC",
  "is_active": true,
  "updated_at": "2026-01-09T13:00:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `409 Conflict`: Tenant is already active
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 10. Delete Tenant

Soft delete a tenant (90-day retention period).

**Endpoint**: `DELETE /admin/tenants/:id`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Request Body**: None

**Response** (`200 OK`):
```json
{
  "message": "Tenant deleted successfully (90-day retention period)"
}
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `409 Conflict`: Tenant is already deleted
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 11. Get Tenant Assigned Services (Admin View)

Get services assigned to a specific tenant.

**Endpoint**: `GET /admin/tenants/:id/assigned-services`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Response** (`200 OK`):
```json
[
  {
    "id": "service-uuid-123",
    "service_name": "Residential Roofing",
    "service_category": "Roofing",
    "base_price": 5000.00,
    "is_active": true,
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 12. Get Tenant Business Hours (Admin View)

Get regular business hours for a specific tenant.

**Endpoint**: `GET /admin/tenants/:id/business-hours`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Response** (`200 OK`):
```json
{
  "id": "hours-uuid-123",
  "tenant_id": "tenant-uuid-123",
  "monday_closed": false,
  "monday_open1": "09:00",
  "monday_close1": "17:00",
  "tuesday_closed": false,
  "tuesday_open1": "09:00",
  "tuesday_close1": "17:00",
  "updated_at": "2026-01-09T00:00:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 13. Get Tenant Custom Hours (Admin View)

Get custom business hours (holidays/special dates) for a specific tenant.

**Endpoint**: `GET /admin/tenants/:id/custom-hours`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Response** (`200 OK`):
```json
[
  {
    "id": "custom-hours-uuid-123",
    "tenant_id": "tenant-uuid-123",
    "date": "2026-12-25",
    "closed": true,
    "open_time1": null,
    "close_time1": null,
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 14. Get Tenant Addresses (Admin View)

Get all addresses for a specific tenant.

**Endpoint**: `GET /admin/tenants/:id/addresses`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Response** (`200 OK`):
```json
[
  {
    "id": "address-uuid-123",
    "tenant_id": "tenant-uuid-123",
    "address_type": "legal",
    "street_address1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip_code": "10001",
    "is_default": true,
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 15. Get Tenant Licenses (Admin View)

Get all licenses for a specific tenant.

**Endpoint**: `GET /admin/tenants/:id/licenses`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Response** (`200 OK`):
```json
[
  {
    "id": "license-uuid-123",
    "tenant_id": "tenant-uuid-123",
    "license_type_id": "type-uuid-456",
    "license_number": "ABC123456",
    "issue_date": "2025-01-01",
    "expiry_date": "2027-01-01",
    "license_type": {
      "id": "type-uuid-456",
      "type_name": "Contractors License"
    }
  }
]
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 16. Get Tenant Insurance (Admin View)

Get insurance information for a specific tenant.

**Endpoint**: `GET /admin/tenants/:id/insurance`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Response** (`200 OK`):
```json
{
  "id": "insurance-uuid-123",
  "tenant_id": "tenant-uuid-123",
  "company_name": "State Farm",
  "policy_number": "POL123456",
  "gl_expiry_date": "2027-01-01",
  "wc_expiry_date": "2027-01-01",
  "gl_document_file_id": "file-uuid-789",
  "wc_document_file_id": "file-uuid-790"
}
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 17. Get Tenant Service Areas (Admin View)

Get all service areas for a specific tenant.

**Endpoint**: `GET /admin/tenants/:id/service-areas`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Response** (`200 OK`):
```json
[
  {
    "id": "area-uuid-123",
    "tenant_id": "tenant-uuid-123",
    "area_type": "STATE",
    "state_code": "NY",
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 18. Get Tenant Payment Terms (Admin View)

Get payment terms for a specific tenant.

**Endpoint**: `GET /admin/tenants/:id/payment-terms`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Response** (`200 OK`):
```json
{
  "id": "terms-uuid-123",
  "tenant_id": "tenant-uuid-123",
  "terms_json": [
    {
      "sequence": 1,
      "type": "PERCENTAGE",
      "amount": 50,
      "description": "50% deposit upfront"
    },
    {
      "sequence": 2,
      "type": "PERCENTAGE",
      "amount": 50,
      "description": "50% upon completion"
    }
  ],
  "updated_at": "2026-01-01T00:00:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 19. Get Tenant Statistics (Admin View)

Get statistics for a specific tenant (user count, active resources, etc.).

**Endpoint**: `GET /admin/tenants/:id/statistics`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Tenant ID (UUID)

**Response** (`200 OK`):
```json
{
  "user_count": 5,
  "active_user_count": 4,
  "address_count": 3,
  "license_count": 2,
  "expiring_licenses": 1,
  "expiring_insurance": false
}
```

**Error Responses**:
- `404 Not Found`: Tenant not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

## Impersonation APIs

### 11. Start Impersonation

Create impersonation session to view platform as a specific user.

**Endpoint**: `POST /admin/tenants/:tenantId/impersonate`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Path Parameters**:
- `tenantId` (string, required): Tenant ID (UUID)

**Request Body**:
```json
{
  "user_id": "user-uuid-456"
}
```

**Request Body Fields**:
- `user_id` (string, required): ID of user to impersonate (UUID)

**Response** (`201 Created`):
```json
{
  "session_token": "64charhextoken1234567890abcdef1234567890abcdef1234567890abcdef12",
  "expires_at": "2026-01-09T14:00:00Z",
  "impersonated_user": {
    "id": "user-uuid-456",
    "email": "john.doe@acme-roofing.com",
    "first_name": "John",
    "last_name": "Doe",
    "tenant_id": "tenant-uuid-123",
    "tenant": {
      "id": "tenant-uuid-123",
      "subdomain": "acme-roofing",
      "company_name": "Acme Roofing LLC"
    }
  }
}
```

**Response Fields**:
- `session_token` (string): 64-char hex token (use in `X-Impersonation-Token` header)
- `expires_at` (string): Session expiry timestamp (1 hour from creation)
- `impersonated_user` (object): User being impersonated
  - `id` (string): User ID
  - `email` (string): User email
  - `first_name` (string): First name
  - `last_name` (string): Last name
  - `tenant_id` (string): Tenant ID
  - `tenant` (object): Tenant details

**Usage**:
```http
GET /api/v1/dashboard
Authorization: Bearer {admin_jwt_token}
X-Impersonation-Token: 64charhextoken1234567890abcdef1234567890abcdef1234567890abcdef12
```

**Error Responses**:
- `403 Forbidden`: Only Platform Admins can impersonate
- `404 Not Found`: User not found or has no tenant
- `401 Unauthorized`: Missing or invalid JWT token

---

### 12. Exit Impersonation

End impersonation session.

**Endpoint**: `POST /admin/impersonation/exit`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Request Body**:
```json
{
  "session_token": "64charhextoken1234567890abcdef1234567890abcdef1234567890abcdef12"
}
```

**Request Body Fields**:
- `session_token` (string, required): Session token to end (64 chars)

**Response** (`200 OK`):
```json
{
  "message": "Impersonation session ended successfully"
}
```

**Error Responses**:
- `404 Not Found`: Session not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

## User Management APIs

### 13. List All Users

Retrieve paginated list of users across all tenants with filters.

**Endpoint**: `GET /admin/users`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `tenant_id` (string, optional): Filter by tenant ID (UUID)
- `role` (string, optional): Filter by role name
- `status` (string, optional): Filter by status ("active", "inactive", "deleted")
- `last_login_from` (string, optional): Filter by last login date (ISO 8601)
- `last_login_to` (string, optional): Filter by last login date (ISO 8601)
- `search` (string, optional): Search email or name

**Example Request**:
```http
GET /admin/users?page=1&limit=20&tenant_id=tenant-uuid-123&status=active
```

**Response** (`200 OK`):
```json
{
  "data": [
    {
      "id": "user-uuid-456",
      "email": "john.doe@acme-roofing.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_active": true,
      "is_platform_admin": false,
      "tenant_id": "tenant-uuid-123",
      "tenant_subdomain": "acme-roofing",
      "tenant_company_name": "Acme Roofing LLC",
      "roles": ["Owner"],
      "last_login_at": "2026-01-09T11:00:00Z",
      "created_at": "2026-01-05T10:05:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2450,
    "total_pages": 123
  }
}
```

**Response Fields**:
- `data` (array): Array of user objects
  - `id` (string): User ID (UUID)
  - `email` (string): Email address
  - `first_name` (string): First name
  - `last_name` (string): Last name
  - `is_active` (boolean): Active status
  - `is_platform_admin` (boolean): Platform admin flag
  - `tenant_id` (string|null): Tenant ID
  - `tenant_subdomain` (string|null): Tenant subdomain
  - `tenant_company_name` (string|null): Tenant company name
  - `roles` (string[]): Array of role names
  - `last_login_at` (string|null): Last login timestamp
  - `created_at` (string): Creation timestamp
- `pagination` (object): Pagination metadata

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 14. Get User Details

Retrieve full user details including roles and activity.

**Endpoint**: `GET /admin/users/:id`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): User ID (UUID)

**Example Request**:
```http
GET /admin/users/user-uuid-456
```

**Response** (`200 OK`):
```json
{
  "id": "user-uuid-456",
  "email": "john.doe@acme-roofing.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "5551234567",
  "is_active": true,
  "is_platform_admin": false,
  "email_verified": true,
  "tenant_id": "tenant-uuid-123",
  "tenant": {
    "id": "tenant-uuid-123",
    "subdomain": "acme-roofing",
    "company_name": "Acme Roofing LLC"
  },
  "roles": [
    {
      "id": "role-uuid-789",
      "name": "Owner",
      "description": "Full access to all features",
      "assigned_at": "2026-01-05T10:05:00Z"
    }
  ],
  "last_login_at": "2026-01-09T11:00:00Z",
  "created_at": "2026-01-05T10:05:00Z",
  "updated_at": "2026-01-09T11:00:00Z"
}
```

**Response Fields**:
- `id` (string): User ID (UUID)
- `email` (string): Email address
- `first_name` (string): First name
- `last_name` (string): Last name
- `phone` (string|null): Phone number
- `is_active` (boolean): Active status
- `is_platform_admin` (boolean): Platform admin flag
- `email_verified` (boolean): Email verification status
- `tenant_id` (string|null): Tenant ID
- `tenant` (object|null): Tenant details
- `roles` (array): Array of role objects
  - `id` (string): Role ID
  - `name` (string): Role name
  - `description` (string): Role description
  - `assigned_at` (string): Assignment timestamp
- `last_login_at` (string|null): Last login timestamp
- `created_at` (string): Creation timestamp
- `updated_at` (string): Last update timestamp

**Error Responses**:
- `404 Not Found`: User not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 15. Force Password Reset

Send password reset email to user (admin-initiated).

**Endpoint**: `POST /admin/users/:id/reset-password`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): User ID (UUID)

**Request Body**: None

**Response** (`200 OK`):
```json
{
  "message": "Password reset email sent successfully",
  "email": "john.doe@acme-roofing.com"
}
```

**Error Responses**:
- `404 Not Found`: User not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 16. Deactivate User

Set user account to inactive and invalidate sessions.

**Endpoint**: `POST /admin/users/:id/deactivate`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): User ID (UUID)

**Request Body**: None

**Response** (`200 OK`):
```json
{
  "message": "User deactivated successfully",
  "user": {
    "id": "user-uuid-456",
    "email": "john.doe@acme-roofing.com",
    "is_active": false
  }
}
```

**Error Responses**:
- `404 Not Found`: User not found
- `409 Conflict`: User is already inactive
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 17. Activate User

Set user account to active.

**Endpoint**: `POST /admin/users/:id/activate`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): User ID (UUID)

**Request Body**: None

**Response** (`200 OK`):
```json
{
  "message": "User activated successfully",
  "user": {
    "id": "user-uuid-456",
    "email": "john.doe@acme-roofing.com",
    "is_active": true
  }
}
```

**Error Responses**:
- `404 Not Found`: User not found
- `409 Conflict`: User is already active
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 18. Delete User

Soft delete user (sets deleted_at timestamp).

**Endpoint**: `DELETE /admin/users/:id`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): User ID (UUID)

**Request Body**: None

**Response** (`200 OK`):
```json
{
  "message": "User deleted successfully",
  "user": {
    "id": "user-uuid-456",
    "email": "john.doe@acme-roofing.com",
    "deleted_at": "2026-01-09T14:00:00Z"
  }
}
```

**Error Responses**:
- `404 Not Found`: User not found
- `409 Conflict`: User is already deleted
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

## System Settings APIs

### 19. Get All Feature Flags

Retrieve all feature flags with metadata.

**Endpoint**: `GET /admin/settings/feature-flags`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Query Parameters**: None

**Response** (`200 OK`):
```json
[
  {
    "id": "flag-uuid-1",
    "flag_key": "file_storage",
    "name": "File Storage",
    "description": "Allow tenants to upload files",
    "is_enabled": true,
    "updated_at": "2026-01-09T12:00:00Z",
    "updated_by": {
      "id": "user-uuid-456",
      "email": "admin@lead360.com",
      "name": "Admin User"
    }
  },
  {
    "id": "flag-uuid-2",
    "flag_key": "user_registration",
    "name": "User Registration",
    "description": "Allow new tenant signups",
    "is_enabled": true,
    "updated_at": "2026-01-09T12:00:00Z",
    "updated_by": null
  }
]
```

**Response Fields** (each flag):
- `id` (string): Flag ID (UUID)
- `flag_key` (string): Unique flag key
- `name` (string): Display name
- `description` (string|null): Description
- `is_enabled` (boolean): Enabled status
- `updated_at` (string): Last update timestamp
- `updated_by` (object|null): User who last updated
  - `id` (string): User ID
  - `email` (string): Email
  - `name` (string): Full name

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 20. Update Feature Flag

Update feature flag settings (name, description, enabled status).

**Endpoint**: `PATCH /admin/settings/feature-flags/:key`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Path Parameters**:
- `key` (string, required): Feature flag key (e.g., "file_storage")

**Request Body** (all fields optional):
```json
{
  "is_enabled": false,
  "name": "File Storage System",
  "description": "Allow tenants to upload and manage files"
}
```

**Request Body Fields**:
- `is_enabled` (boolean, optional): Enable/disable flag
- `name` (string, optional): Display name (max 255 chars)
- `description` (string, optional): Description

**Response** (`200 OK`):
```json
{
  "id": "flag-uuid-1",
  "flag_key": "file_storage",
  "name": "File Storage System",
  "description": "Allow tenants to upload and manage files",
  "is_enabled": false,
  "updated_at": "2026-01-09T14:00:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Feature flag not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 21. Get Maintenance Mode Config

Retrieve current maintenance mode configuration.

**Endpoint**: `GET /admin/settings/maintenance`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Query Parameters**: None

**Response** (`200 OK`):
```json
{
  "id": "maintenance-uuid-1",
  "is_enabled": false,
  "mode": "immediate",
  "start_time": null,
  "end_time": null,
  "message": "Lead360 is undergoing maintenance. We'll be back shortly.",
  "allowed_ips": null,
  "updated_at": "2026-01-09T12:00:00Z",
  "updated_by_user": null
}
```

**Response Fields**:
- `id` (string): Config ID (UUID)
- `is_enabled` (boolean): Maintenance mode status
- `mode` (string): "immediate" or "scheduled"
- `start_time` (string|null): Scheduled start time (ISO 8601)
- `end_time` (string|null): Scheduled end time (ISO 8601)
- `message` (string|null): Maintenance message shown to users
- `allowed_ips` (string|null): Comma-separated whitelist IPs
- `updated_at` (string): Last update timestamp
- `updated_by_user` (object|null): User who last updated

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 22. Update Maintenance Mode

Update maintenance mode configuration.

**Endpoint**: `PATCH /admin/settings/maintenance`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Request Body** (all fields optional):
```json
{
  "is_enabled": true,
  "mode": "scheduled",
  "start_time": "2026-01-10T02:00:00Z",
  "end_time": "2026-01-10T04:00:00Z",
  "message": "Scheduled maintenance from 2:00 AM to 4:00 AM EST",
  "allowed_ips": "192.168.1.100,10.0.0.50"
}
```

**Request Body Fields**:
- `is_enabled` (boolean, optional): Enable/disable maintenance mode
- `mode` (string, optional): "immediate" or "scheduled"
- `start_time` (string, optional): Start time (ISO 8601)
- `end_time` (string, optional): End time (ISO 8601)
- `message` (string, optional): Message to display (max 1000 chars)
- `allowed_ips` (string, optional): Comma-separated IP addresses

**Response** (`200 OK`):
```json
{
  "id": "maintenance-uuid-1",
  "is_enabled": true,
  "mode": "scheduled",
  "start_time": "2026-01-10T02:00:00Z",
  "end_time": "2026-01-10T04:00:00Z",
  "message": "Scheduled maintenance from 2:00 AM to 4:00 AM EST",
  "allowed_ips": "192.168.1.100,10.0.0.50",
  "updated_at": "2026-01-09T14:30:00Z"
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 23. Get All Global Settings

Retrieve all global system settings grouped by category.

**Endpoint**: `GET /admin/settings/global`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Query Parameters**: None

**Response** (`200 OK`):
```json
{
  "file_storage": [
    {
      "id": "setting-uuid-1",
      "setting_key": "max_file_upload_size_mb",
      "setting_value": 10,
      "data_type": "integer",
      "description": "Max file upload size in MB",
      "updated_at": "2026-01-09T12:00:00Z",
      "updated_by": null
    },
    {
      "id": "setting-uuid-2",
      "setting_key": "max_storage_per_tenant_gb",
      "setting_value": 500,
      "data_type": "integer",
      "description": "Max storage per tenant in GB",
      "updated_at": "2026-01-09T12:00:00Z",
      "updated_by": null
    }
  ],
  "session": [
    {
      "id": "setting-uuid-3",
      "setting_key": "session_timeout_minutes",
      "setting_value": 30,
      "data_type": "integer",
      "description": "Session timeout in minutes",
      "updated_at": "2026-01-09T12:00:00Z",
      "updated_by": null
    }
  ],
  "password": [
    {
      "id": "setting-uuid-4",
      "setting_key": "password_reset_token_expiry_hours",
      "setting_value": 24,
      "data_type": "integer",
      "description": "Password reset token expiry",
      "updated_at": "2026-01-09T12:00:00Z",
      "updated_by": null
    }
  ],
  "account_security": [
    {
      "id": "setting-uuid-5",
      "setting_key": "max_failed_login_attempts",
      "setting_value": 5,
      "data_type": "integer",
      "description": "Max failed login attempts before lockout",
      "updated_at": "2026-01-09T12:00:00Z",
      "updated_by": null
    },
    {
      "id": "setting-uuid-6",
      "setting_key": "account_lockout_duration_minutes",
      "setting_value": 15,
      "data_type": "integer",
      "description": "Account lockout duration",
      "updated_at": "2026-01-09T12:00:00Z",
      "updated_by": null
    }
  ],
  "job_management": [
    {
      "id": "setting-uuid-7",
      "setting_key": "job_retention_days",
      "setting_value": 30,
      "data_type": "integer",
      "description": "Job record retention in days",
      "updated_at": "2026-01-09T12:00:00Z",
      "updated_by": null
    }
  ],
  "audit": [
    {
      "id": "setting-uuid-8",
      "setting_key": "audit_log_retention_days",
      "setting_value": 90,
      "data_type": "integer",
      "description": "Audit log retention in days",
      "updated_at": "2026-01-09T12:00:00Z",
      "updated_by": null
    }
  ],
  "other": []
}
```

**Response Fields**:
- Object with category keys, each containing array of settings
- Each setting object:
  - `id` (string): Setting ID (UUID)
  - `setting_key` (string): Unique setting key
  - `setting_value` (any): Parsed value (integer, boolean, string, or JSON object)
  - `data_type` (string): "integer", "boolean", "string", or "json"
  - `description` (string|null): Description
  - `updated_at` (string): Last update timestamp
  - `updated_by` (object|null): User who last updated

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 24. Bulk Update Global Settings

Update multiple global settings at once.

**Endpoint**: `PATCH /admin/settings/global`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Request Body**:
```json
[
  {
    "key": "max_file_upload_size_mb",
    "value": 15
  },
  {
    "key": "session_timeout_minutes",
    "value": 60
  },
  {
    "key": "max_failed_login_attempts",
    "value": 3
  }
]
```

**Request Body**: Array of setting objects
- `key` (string, required): Setting key
- `value` (any, required): New value (type must match data_type)

**Response** (`200 OK`):
```json
{
  "total": 3,
  "succeeded": 3,
  "failed": 0,
  "results": [
    {
      "key": "max_file_upload_size_mb",
      "success": true,
      "result": {
        "id": "setting-uuid-1",
        "setting_key": "max_file_upload_size_mb",
        "setting_value": 15,
        "data_type": "integer",
        "description": "Max file upload size in MB",
        "updated_at": "2026-01-09T15:00:00Z"
      }
    },
    {
      "key": "session_timeout_minutes",
      "success": true,
      "result": {
        "id": "setting-uuid-3",
        "setting_key": "session_timeout_minutes",
        "setting_value": 60,
        "data_type": "integer",
        "description": "Session timeout in minutes",
        "updated_at": "2026-01-09T15:00:00Z"
      }
    },
    {
      "key": "max_failed_login_attempts",
      "success": true,
      "result": {
        "id": "setting-uuid-5",
        "setting_key": "max_failed_login_attempts",
        "setting_value": 3,
        "data_type": "integer",
        "description": "Max failed login attempts before lockout",
        "updated_at": "2026-01-09T15:00:00Z"
      }
    }
  ]
}
```

**Response Fields**:
- `total` (number): Total settings in request
- `succeeded` (number): Number of successful updates
- `failed` (number): Number of failed updates
- `results` (array): Array of result objects
  - `key` (string): Setting key
  - `success` (boolean): Success status
  - `result` (object): Updated setting (if successful)
  - `error` (string): Error message (if failed)

**Error Responses**:
- `400 Bad Request`: Invalid value type for setting
- `404 Not Found`: Setting key not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

## Alerts & Notifications APIs

### 25. Get In-App Notifications

Retrieve paginated list of admin notifications (unread first).

**Endpoint**: `GET /admin/alerts`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 50)
- `unread_only` (boolean, optional): Show only unread (default: false)

**Example Request**:
```http
GET /admin/alerts?page=1&limit=20&unread_only=false
```

**Response** (`200 OK`):
```json
{
  "data": [
    {
      "id": "notification-uuid-1",
      "type": "new_tenant",
      "title": "New Tenant Registered",
      "message": "Acme Roofing LLC has registered and is awaiting verification.",
      "link": "/admin/tenants/tenant-uuid-123",
      "is_read": false,
      "created_at": "2026-01-09T14:00:00Z",
      "expires_at": null
    },
    {
      "id": "notification-uuid-2",
      "type": "storage_limit",
      "title": "Storage Limit Warning",
      "message": "Tenant 'acme-roofing' has used 90% of storage quota.",
      "link": "/admin/tenants/tenant-uuid-123",
      "is_read": true,
      "created_at": "2026-01-09T12:00:00Z",
      "expires_at": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  },
  "unread_count": 12
}
```

**Response Fields**:
- `data` (array): Array of notification objects
  - `id` (string): Notification ID (UUID)
  - `type` (string): "new_tenant", "storage_limit", "job_spike", "system_down", "suspicious_activity"
  - `title` (string): Notification title
  - `message` (string): Notification message
  - `link` (string|null): Link to related resource
  - `is_read` (boolean): Read status
  - `created_at` (string): Creation timestamp
  - `expires_at` (string|null): Expiry timestamp
- `pagination` (object): Pagination metadata
- `unread_count` (number): Total unread notifications

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 26. Mark Notification as Read

Mark a single notification as read.

**Endpoint**: `PATCH /admin/alerts/:id/read`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Notification ID (UUID)

**Request Body**: None

**Response** (`200 OK`):
```json
{
  "id": "notification-uuid-1",
  "type": "new_tenant",
  "title": "New Tenant Registered",
  "message": "Acme Roofing LLC has registered and is awaiting verification.",
  "link": "/admin/tenants/tenant-uuid-123",
  "is_read": true,
  "created_at": "2026-01-09T14:00:00Z",
  "expires_at": null
}
```

**Error Responses**:
- `404 Not Found`: Notification not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 27. Mark All Notifications as Read

Mark all notifications as read.

**Endpoint**: `POST /admin/alerts/mark-all-read`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Request Body**: None

**Response** (`200 OK`):
```json
{
  "marked_read": 12
}
```

**Response Fields**:
- `marked_read` (number): Number of notifications marked as read

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 28. Delete Notification

Delete a single notification.

**Endpoint**: `DELETE /admin/alerts/:id`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Notification ID (UUID)

**Request Body**: None

**Response** (`200 OK`):
```json
{
  "message": "Notification deleted successfully"
}
```

**Error Responses**:
- `404 Not Found`: Notification not found
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

## Data Export APIs

### 29. Export Tenants

Queue export job for tenants data.

**Endpoint**: `POST /admin/exports/tenants`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Request Body**:
```json
{
  "format": "csv",
  "filters": {
    "status": "active",
    "created_from": "2026-01-01T00:00:00Z",
    "created_to": "2026-01-31T23:59:59Z"
  }
}
```

**Request Body Fields**:
- `format` (string, required): "csv" or "pdf"
- `filters` (object, optional):
  - `status` (string, optional): "active", "suspended", or "deleted"
  - `created_from` (string, optional): Start date (ISO 8601)
  - `created_to` (string, optional): End date (ISO 8601)

**Response** (`201 Created`):
```json
{
  "export_job_id": "export-uuid-123",
  "status": "pending"
}
```

**Response Fields**:
- `export_job_id` (string): Export job ID (use to check status and download)
- `status` (string): "pending" (job queued for processing)

**Error Responses**:
- `400 Bad Request`: Invalid format
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 30. Export Users

Queue export job for users data.

**Endpoint**: `POST /admin/exports/users`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Request Body**:
```json
{
  "format": "csv",
  "filters": {
    "tenant_id": "tenant-uuid-123",
    "is_active": true
  }
}
```

**Request Body Fields**:
- `format` (string, required): "csv" or "pdf"
- `filters` (object, optional):
  - `tenant_id` (string, optional): Filter by tenant ID (UUID)
  - `is_active` (boolean, optional): Filter by active status

**Response** (`201 Created`):
```json
{
  "export_job_id": "export-uuid-456",
  "status": "pending"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid format
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 31. Export Audit Logs

Queue export job for audit logs (max 1000 rows).

**Endpoint**: `POST /admin/exports/audit-logs`

**Headers**:
- `Authorization`: Bearer {token} *(required)*
- `Content-Type`: application/json

**Request Body**:
```json
{
  "format": "csv",
  "filters": {
    "tenant_id": "tenant-uuid-123",
    "entity_type": "user",
    "action_type": "created",
    "created_from": "2026-01-01T00:00:00Z",
    "created_to": "2026-01-31T23:59:59Z",
    "limit": 500
  }
}
```

**Request Body Fields**:
- `format` (string, required): "csv" or "pdf"
- `filters` (object, optional):
  - `tenant_id` (string, optional): Filter by tenant ID (UUID)
  - `entity_type` (string, optional): Filter by entity type
  - `action_type` (string, optional): Filter by action type
  - `created_from` (string, optional): Start date (ISO 8601)
  - `created_to` (string, optional): End date (ISO 8601)
  - `limit` (number, optional): Max rows (default: 1000, max: 1000)

**Response** (`201 Created`):
```json
{
  "export_job_id": "export-uuid-789",
  "status": "pending"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid format or limit > 1000
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 32. Get Export History

Retrieve list of export jobs created by current admin.

**Endpoint**: `GET /admin/exports/history`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Query Parameters**:
- `limit` (number, optional): Number of items (default: 10, max: 50)

**Example Request**:
```http
GET /admin/exports/history?limit=10
```

**Response** (`200 OK`):
```json
[
  {
    "id": "export-uuid-123",
    "export_type": "tenants",
    "format": "csv",
    "status": "completed",
    "row_count": 150,
    "file_path": "/var/www/lead360.app/api/exports/tenants_export-uuid-123_1704801234567.csv",
    "error_message": null,
    "created_at": "2026-01-09T14:00:00Z",
    "completed_at": "2026-01-09T14:01:23Z"
  },
  {
    "id": "export-uuid-456",
    "export_type": "users",
    "format": "pdf",
    "status": "processing",
    "row_count": null,
    "file_path": null,
    "error_message": null,
    "created_at": "2026-01-09T14:30:00Z",
    "completed_at": null
  },
  {
    "id": "export-uuid-789",
    "export_type": "audit_logs",
    "format": "csv",
    "status": "failed",
    "row_count": null,
    "file_path": null,
    "error_message": "Database connection timeout",
    "created_at": "2026-01-09T13:00:00Z",
    "completed_at": "2026-01-09T13:00:45Z"
  }
]
```

**Response Fields** (each export):
- `id` (string): Export job ID (UUID)
- `export_type` (string): "tenants", "users", or "audit_logs"
- `format` (string): "csv" or "pdf"
- `status` (string): "pending", "processing", "completed", or "failed"
- `row_count` (number|null): Number of rows exported (null if not completed)
- `file_path` (string|null): File path on server (null if not completed)
- `error_message` (string|null): Error message (null if successful)
- `created_at` (string): Job creation timestamp
- `completed_at` (string|null): Job completion timestamp

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

---

### 33. Download Export File

Download completed export file (CSV or PDF).

**Endpoint**: `GET /admin/exports/:id/download`

**Headers**:
- `Authorization`: Bearer {token} *(required)*

**Path Parameters**:
- `id` (string, required): Export job ID (UUID)

**Query Parameters**: None

**Response** (`200 OK`):
- **Content-Type**: `text/csv` or `application/pdf`
- **Content-Disposition**: `attachment; filename="tenants_export-uuid-123.csv"`
- **Body**: File binary content

**Error Responses**:
- `404 Not Found`: Export job not found, file not ready, or file not found on disk
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a Platform Admin

**Example Usage**:
```http
GET /admin/exports/export-uuid-123/download
Authorization: Bearer {token}
```

**Note**: Poll the export job status using the history endpoint until status is "completed" before attempting download.

---

## Error Responses

All error responses follow a consistent format:

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

**Fields**:
- `statusCode` (number): HTTP status code
- `message` (string): Error message
- `error` (string): Error type

### Common HTTP Status Codes

- **400 Bad Request**: Invalid request data (validation failed, malformed JSON, etc.)
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: User is not a Platform Admin or lacks required permissions
- **404 Not Found**: Resource not found (tenant, user, notification, etc.)
- **409 Conflict**: Resource already exists or invalid state transition
- **500 Internal Server Error**: Server error (database failure, unexpected exception)
- **503 Service Unavailable**: Service temporarily unavailable (maintenance mode, feature disabled)

### Example Error Responses

**401 Unauthorized**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**403 Forbidden (Not Platform Admin)**:
```json
{
  "statusCode": 403,
  "message": "Platform Admin access required. This endpoint is restricted to platform administrators.",
  "error": "Forbidden"
}
```

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Tenant not found",
  "error": "Not Found"
}
```

**409 Conflict**:
```json
{
  "statusCode": 409,
  "message": "Subdomain already exists",
  "error": "Conflict"
}
```

**503 Service Unavailable (Maintenance Mode)**:
```json
{
  "statusCode": 503,
  "message": "Lead360 is undergoing maintenance. We'll be back shortly.",
  "maintenance": true,
  "estimatedEnd": "2026-01-10T04:00:00Z"
}
```

**503 Service Unavailable (Feature Disabled)**:
```json
{
  "statusCode": 503,
  "message": "File storage is currently disabled. Please contact support.",
  "error": "Service Unavailable"
}
```

---

## Rate Limiting

**Not Currently Implemented**

Rate limiting is not currently enforced on admin panel endpoints. However, best practices recommend implementing rate limiting before production deployment:

**Recommended Limits**:
- General endpoints: 100 requests/minute per IP
- Export endpoints: 10 requests/minute per user
- Authentication endpoints: 5 requests/minute per IP

**Implementation**: Use `@nestjs/throttler` package when rate limiting is added.

---

## Additional Notes

### Background Jobs

The following background jobs run automatically:

1. **Daily Stats Email** - Cron: `0 8 * * *` (8:00 AM daily)
   - Sends dashboard metrics to all Platform Admins
   - Includes: metrics, growth trends, recent activity

2. **Notification Cleanup** - Cron: `0 2 * * *` (2:00 AM daily)
   - Deletes notifications older than 30 days
   - Deletes expired notifications (expires_at < now)
   - Enforces max 1000 notifications

3. **Maintenance Mode Check** - Cron: `* * * * *` (every minute)
   - Auto-disables scheduled maintenance after end_time

4. **Export Processor** - BullMQ worker (queue: `export`)
   - Processes export jobs asynchronously
   - Generates CSV/PDF files
   - Updates job status

### Middleware

The following middleware is applied globally:

1. **Feature Flag Middleware**
   - Checks feature flags before processing requests
   - Blocks requests if feature is disabled
   - Skips admin routes (admins bypass feature flags)

2. **Maintenance Mode Middleware**
   - Returns 503 during maintenance mode
   - Supports IP whitelisting
   - Skips admin routes (admins always have access)

3. **Impersonation Middleware**
   - Checks for `X-Impersonation-Token` header
   - Overrides current user if valid session
   - Injects impersonation context for audit logging

### Audit Logging

All admin actions are automatically logged to the `audit_log` table:

**Logged Actions**:
- Tenant created/suspended/activated/deleted
- Impersonation started/ended
- Feature flags toggled
- Maintenance mode updated
- System settings updated
- User activated/deactivated/deleted
- Password resets initiated

**Audit Log Fields**:
- `tenant_id`: Tenant ID (null for platform-level actions)
- `actor_user_id`: Admin user ID
- `actor_type`: "platform_admin"
- `entity_type`: Entity affected (e.g., "tenant", "user")
- `entity_id`: Entity ID
- `action_type`: "created", "updated", "deleted"
- `description`: Human-readable description
- `before_json`: State before change (JSON)
- `after_json`: State after change (JSON)
- `status`: "success" or "failure"
- `created_at`: Timestamp

### Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: All endpoints require `is_platform_admin = true`
3. **Audit Logging**: All actions are logged with full context
4. **Session Expiry**: Impersonation sessions expire after 1 hour
5. **Password Hashing**: Bcrypt with 10 rounds for tenant owner passwords
6. **Session Invalidation**: Suspending/deleting tenant invalidates all user sessions
7. **IP Whitelisting**: Maintenance mode supports IP bypass for admins

---

**End of API Documentation**

**Total Endpoints**: 33 (excluding background jobs)
**Version**: 1.0
**Last Updated**: January 9, 2026
