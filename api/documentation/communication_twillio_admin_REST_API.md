# Twilio Admin REST API Documentation

**Version**: 1.1 (Sprint 11 Complete)
**Last Updated**: February 6, 2026
**Base URL**: `https://api.lead360.app/api/v1/admin/communication`
**Authentication**: Required (Bearer JWT token)
**Required Role**: SystemAdmin (Platform Administrator)

---

## Overview

This API provides system administrators with comprehensive cross-tenant management and monitoring capabilities for the Twilio communication integration within the Lead360 platform.

**Sprint 11 Completion**: This documentation covers all 68 admin endpoints across 14 categories, providing complete CRUD operations for all admin resources.

### Admin Capabilities

The Twilio Admin API enables platform administrators to:

- **Provider Management** (5 endpoints): Register and manage system-level Twilio provider (Model B)
- **Cross-Tenant Oversight** (6 endpoints): View all communication activity across tenants
- **Usage Tracking & Billing** (7 endpoints): Track Twilio usage and costs, sync from Twilio API
- **Transcription Monitoring** (4 endpoints): Monitor transcription health and retry failures
- **System Health** (6 endpoints): Run health checks, test connectivity, monitor performance
- **Metrics & Analytics** (2 endpoints): View system-wide metrics and top tenants
- **Cron Management** (2 endpoints): Manage scheduled job configurations
- **Webhook Management** (5 endpoints): Configure webhooks, track events, retry failures
- **Phone Number Operations** (4 endpoints): Purchase, allocate, deallocate phone numbers
- **Transcription Provider CRUD** (5 endpoints): Manage transcription providers (OpenAI, Deepgram, AssemblyAI)
- **Tenant Assistance** (6 endpoints): Create/update tenant communication configs
- **Alert Management** (3 endpoints): Acknowledge and resolve system alerts
- **Communication Event Management** (3 endpoints): Resend, update status, delete events
- **Bulk Operations** (4 endpoints): Batch retry and CSV export

### Key Features

- **Multi-Tenant Visibility**: Aggregated view of all tenant activity (no tenant isolation for admin)
- **Real-Time Monitoring**: System health checks, performance metrics, and alerting
- **Usage Sync**: Nightly automated usage sync from Twilio API (AC-18 fulfillment)
- **Secure Credential Storage**: All Twilio credentials encrypted at rest
- **Comprehensive Audit Logging**: All admin actions logged for compliance
- **Complete CRUD Operations**: Full create, read, update, delete for all admin resources

### Security

- All endpoints require JWT Bearer token authentication
- All endpoints require `SystemAdmin` role
- Cross-tenant data access is monitored and logged
- Sensitive credentials (auth tokens) are excluded from API responses
- All admin actions are recorded in audit logs

---

## Authentication

All admin endpoints require:

1. **Bearer Token**: Valid JWT token in `Authorization` header
2. **SystemAdmin Role**: User must have `role = 'SystemAdmin'`

### Example Request Headers

```http
GET /api/v1/admin/communication/health HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Authentication Errors

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

#### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. SystemAdmin role required.",
  "error": "Forbidden"
}
```

---

## Error Responses

All endpoints follow standard HTTP status codes and return consistent error formats.

### Standard Error Response Format

```json
{
  "statusCode": 400,
  "message": "Detailed error message",
  "error": "Bad Request"
}
```

### Common HTTP Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request parameters or body
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Insufficient permissions (non-admin user)
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists or conflict with current state
- **500 Internal Server Error**: Server error (logged automatically)

---

## Endpoint Categories

### 1. Provider Management (5 endpoints)
- POST /twilio/provider - Register system provider
- GET /twilio/provider - Get system provider status
- PATCH /twilio/provider - Update system provider
- POST /twilio/provider/test - Test system provider connectivity
- GET /twilio/available-numbers - Get available phone numbers
- GET /twilio/phone-numbers - List owned phone numbers

### 2. Cross-Tenant Oversight (6 endpoints)
- GET /calls - Get all calls across all tenants
- GET /sms - Get all SMS across all tenants
- GET /whatsapp - Get all WhatsApp messages across all tenants
- GET /tenant-configs - Get all tenant configurations
- GET /tenants/:id/configs - Get specific tenant's configurations
- GET /tenants/:id/metrics - Get tenant communication metrics

### 3. Usage Tracking & Billing (7 endpoints)
- POST /usage/sync - Trigger immediate usage sync for all tenants
- POST /usage/sync/:tenantId - Sync usage for specific tenant
- GET /usage/tenants - Get usage summary for all tenants
- GET /usage/tenants/:id - Get detailed usage for specific tenant
- GET /usage/system - Get system-wide usage aggregation
- GET /usage/export - Export usage report (CSV)
- GET /costs/tenants/:id - Get estimated costs for tenant

### 4. Transcription Monitoring (4 endpoints)
- GET /transcriptions/failed - Get all failed transcriptions
- GET /transcriptions/:id - Get transcription details
- POST /transcriptions/:id/retry - Retry failed transcription
- GET /transcription-providers - List transcription providers with stats

### 5. System Health (6 endpoints)
- GET /health - Get overall system health status
- POST /health/twilio-test - Test Twilio API connectivity
- POST /health/webhooks-test - Test webhook delivery
- POST /health/transcription-test - Test transcription provider
- GET /health/provider-response-times - Get provider performance metrics
- GET /alerts - Get recent system alerts

### 6. Metrics & Analytics (2 endpoints)
- GET /metrics/system-wide - Get comprehensive system-wide metrics
- GET /metrics/top-tenants - Get top tenants by communication volume

### 7. Cron Management (2 endpoints)
- GET /cron/status - Get cron job status
- POST /cron/reload - Reload cron schedules from system settings

### 8. Webhook Management (5 endpoints)
- GET /webhooks/config - Get webhook configuration
- PATCH /webhooks/config - Update webhook configuration
- POST /webhooks/test - Test webhook endpoint
- GET /webhook-events - List webhook events
- POST /webhook-events/:id/retry - Retry failed webhook event

### 9. Phone Number Operations (4 endpoints)
- POST /phone-numbers/purchase - Purchase new Twilio phone number
- POST /phone-numbers/:sid/allocate - Allocate phone number to tenant
- DELETE /phone-numbers/:sid/allocate - Deallocate phone number from tenant
- DELETE /phone-numbers/:sid - Release phone number to Twilio

### 10. Transcription Provider CRUD (5 endpoints)
- POST /transcription-providers - Create transcription provider
- GET /transcription-providers/:id - Get transcription provider
- PATCH /transcription-providers/:id - Update transcription provider
- DELETE /transcription-providers/:id - Delete transcription provider
- POST /transcription-providers/:id/test - Test transcription provider

### 11. Tenant Assistance (6 endpoints)
- POST /tenants/:tenantId/sms-config - Create SMS config for tenant
- PATCH /tenants/:tenantId/sms-config/:configId - Update SMS config for tenant
- POST /tenants/:tenantId/whatsapp-config - Create WhatsApp config for tenant
- PATCH /tenants/:tenantId/whatsapp-config/:configId - Update WhatsApp config for tenant
- POST /tenants/:tenantId/test-sms - Test tenant SMS configuration
- POST /tenants/:tenantId/test-whatsapp - Test tenant WhatsApp configuration

### 12. Alert Management (3 endpoints)
- PATCH /alerts/:id/acknowledge - Acknowledge alert
- PATCH /alerts/:id/resolve - Resolve alert
- POST /alerts/bulk-acknowledge - Bulk acknowledge alerts

### 13. Communication Event Management (3 endpoints)
- POST /communication-events/:id/resend - Resend failed communication event
- PATCH /communication-events/:id/status - Update communication event status
- DELETE /communication-events/:id - Delete communication event

### 14. Bulk Operations (4 endpoints)
- POST /transcriptions/batch-retry - Batch retry failed transcriptions
- POST /communication-events/batch-resend - Batch resend failed communication events
- POST /webhook-events/batch-retry - Batch retry failed webhook events
- GET /usage/export - Export usage data to CSV

---

## API Endpoints

## 1. PROVIDER MANAGEMENT

### POST /twilio/provider

**Description:** Register system-level Twilio provider (Model B)

Registers master Twilio account for platform-wide usage. Enables Model B where platform provides Twilio service to tenants. Credentials are encrypted at rest.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "account_sid": "AC1234567890abcdef1234567890abcd",
  "auth_token": "your_twilio_auth_token_here"
}
```

**Field Details:**
- `account_sid` (string, required): Twilio Account SID (starts with AC, followed by 32 alphanumeric characters). Pattern: `^AC[a-z0-9]{32}$`
- `auth_token` (string, required): Twilio Auth Token. Will be encrypted before storage.

**Response 201 Created:**
```json
{
  "success": true,
  "message": "System provider registered successfully",
  "provider": {
    "account_sid": "AC1234567890abcdef1234567890abcd",
    "is_active": true,
    "created_at": "2026-02-06T10:00:00.000Z"
  }
}
```

**Response 400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": "Invalid credentials or provider already exists",
  "error": "Bad Request"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /twilio/provider

**Description:** Get system provider status

Returns current system provider configuration (without sensitive credentials). Shows whether system provider is configured and active.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "configured": true,
  "account_sid": "AC1234567890abcdef1234567890abcd",
  "is_active": true,
  "created_at": "2026-02-06T10:00:00.000Z",
  "updated_at": "2026-02-06T10:00:00.000Z",
  "phone_numbers_count": 15
}
```

**Response 200 OK (Not Configured):**
```json
{
  "configured": false,
  "message": "No system provider configured"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### PATCH /twilio/provider

**Description:** Update system provider configuration

Updates master Twilio account credentials. Use with caution - affects all Model B tenants.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "account_sid": "AC1234567890abcdef1234567890abcd",
  "auth_token": "new_twilio_auth_token_here"
}
```

**Field Details:**
- `account_sid` (string, required): New Twilio Account SID. Pattern: `^AC[a-z0-9]{32}$`
- `auth_token` (string, required): New Twilio Auth Token. Will be encrypted before storage.

**Response 200 OK:**
```json
{
  "message": "System provider updated successfully"
}
```

**Response 400 Bad Request:** Invalid credentials
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** System provider not configured

---

### POST /twilio/provider/test

**Description:** Test system provider connectivity

Validates system Twilio credentials by making test API call. Returns connection status and response time.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK (Success):**
```json
{
  "status": "SUCCESS",
  "message": "System provider is healthy",
  "response_time_ms": 145,
  "account_status": "active"
}
```

**Response 200 OK (Failed):**
```json
{
  "status": "FAILED",
  "error_message": "Invalid credentials",
  "response_time_ms": 89
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** System provider not configured

---

### GET /twilio/available-numbers

**Description:** Get available phone numbers from Twilio

Fetches available phone numbers from master Twilio account. Used for allocating numbers to tenants (Model B).

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters:
  - `area_code` (string, optional): Filter by area code (e.g., 415 for San Francisco)
  - `limit` (integer, optional): Maximum number of results (default: 20, max: 50)

**Response 200 OK:**
```json
{
  "available_numbers": [
    {
      "phone_number": "+14155551234",
      "friendly_name": "(415) 555-1234",
      "locality": "San Francisco",
      "region": "CA",
      "postal_code": "94105",
      "iso_country": "US",
      "capabilities": {
        "voice": true,
        "SMS": true,
        "MMS": true
      },
      "monthly_cost": "$1.00"
    }
  ],
  "count": 20
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** System provider not configured

---

### GET /twilio/phone-numbers

**Description:** List all owned phone numbers from Twilio account

Retrieves all phone numbers owned in the Twilio account. Shows allocation status (allocated to tenant or available). Matches Twilio numbers with tenant SMS/WhatsApp configurations.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
[
  {
    "sid": "PN1234567890abcdef1234567890abcd",
    "phone_number": "+14155551234",
    "friendly_name": "(415) 555-1234",
    "capabilities": {
      "voice": true,
      "sms": true,
      "mms": true
    },
    "status": "allocated",
    "allocated_to_tenant": {
      "id": "tenant-uuid-here",
      "company_name": "Acme Corp",
      "subdomain": "acme"
    },
    "allocated_for": ["SMS"],
    "date_created": "2026-01-15T10:00:00.000Z",
    "date_updated": "2026-01-15T10:00:00.000Z"
  },
  {
    "sid": "PN0987654321fedcba0987654321fedc",
    "phone_number": "+14155559876",
    "friendly_name": "(415) 555-9876",
    "capabilities": {
      "voice": true,
      "sms": true,
      "mms": false
    },
    "status": "available",
    "allocated_to_tenant": null,
    "allocated_for": null,
    "date_created": "2026-02-01T12:30:00.000Z",
    "date_updated": "2026-02-01T12:30:00.000Z"
  }
]
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** System provider not configured

---

## 2. CROSS-TENANT OVERSIGHT

### GET /calls

**Description:** Get all calls across all tenants (AC-16)

Returns paginated list of all voice calls across the platform. Supports filtering by tenant, status, direction, and date range.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters:
  - `tenant_id` (string, optional): Filter by tenant ID
  - `status` (string, optional): Filter by call status. Enum: `initiated`, `ringing`, `in_progress`, `completed`, `failed`, `no_answer`, `busy`, `canceled`
  - `direction` (string, optional): Filter by call direction. Enum: `inbound`, `outbound`
  - `start_date` (string, optional): Filter by start date (ISO 8601 format). Example: `2026-01-01T00:00:00.000Z`
  - `end_date` (string, optional): Filter by end date (ISO 8601 format). Example: `2026-01-31T23:59:59.999Z`
  - `page` (integer, optional): Page number (1-indexed, default: 1)
  - `limit` (integer, optional): Results per page (default: 20)

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "call-uuid-1",
      "tenant": {
        "id": "tenant-uuid-1",
        "company_name": "Acme Corp",
        "subdomain": "acme"
      },
      "twilio_call_sid": "CA1234567890abcdef1234567890abcd",
      "direction": "inbound",
      "from_phone": "+14155551234",
      "to_phone": "+14155559876",
      "status": "completed",
      "duration_seconds": 180,
      "recording_url": "https://api.twilio.com/recordings/RE123...",
      "recording_duration_seconds": 175,
      "transcription_status": "completed",
      "lead": {
        "id": "lead-uuid-1",
        "first_name": "John",
        "last_name": "Doe"
      },
      "created_at": "2026-02-06T08:30:00.000Z",
      "completed_at": "2026-02-06T08:33:00.000Z"
    }
  ],
  "pagination": {
    "total": 1523,
    "page": 1,
    "limit": 20,
    "pages": 77,
    "has_next": true,
    "has_prev": false
  }
}
```

**Response 400 Bad Request:** Invalid query parameters
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /sms

**Description:** Get all SMS across all tenants (AC-16)

Returns paginated list of all SMS messages across the platform. Includes message content, delivery status, and tenant information.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters:
  - `tenant_id` (string, optional): Filter by tenant ID
  - `status` (string, optional): Filter by message status. Enum: `pending`, `sent`, `delivered`, `failed`, `bounced`
  - `direction` (string, optional): Filter by direction. Enum: `inbound`, `outbound`
  - `channel` (string, optional): Filter by communication channel. Enum: `sms`, `whatsapp`
  - `start_date` (string, optional): Filter by start date (ISO 8601)
  - `end_date` (string, optional): Filter by end date (ISO 8601)
  - `page` (integer, optional): Page number (default: 1)
  - `limit` (integer, optional): Results per page (default: 20)

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "event-uuid-1",
      "tenant": {
        "id": "tenant-uuid-1",
        "company_name": "Acme Corp",
        "subdomain": "acme"
      },
      "channel": "sms",
      "direction": "outbound",
      "from_phone": "+14155551234",
      "to_phone": "+14155559876",
      "message_body": "Your appointment is confirmed for tomorrow at 2 PM.",
      "status": "delivered",
      "twilio_message_sid": "SM1234567890abcdef1234567890abcd",
      "lead": {
        "id": "lead-uuid-1",
        "first_name": "John",
        "last_name": "Doe"
      },
      "sent_at": "2026-02-06T10:15:00.000Z",
      "delivered_at": "2026-02-06T10:15:03.000Z",
      "created_at": "2026-02-06T10:15:00.000Z"
    }
  ],
  "pagination": {
    "total": 5432,
    "page": 1,
    "limit": 20,
    "pages": 272,
    "has_next": true,
    "has_prev": false
  }
}
```

**Response 400 Bad Request:** Invalid query parameters
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /whatsapp

**Description:** Get all WhatsApp messages across all tenants (AC-16)

Returns paginated list of all WhatsApp messages across the platform.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters: Same as GET /sms (tenant_id, status, direction, start_date, end_date, page, limit)

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "event-uuid-1",
      "tenant": {
        "id": "tenant-uuid-1",
        "company_name": "Acme Corp",
        "subdomain": "acme"
      },
      "channel": "whatsapp",
      "direction": "outbound",
      "from_phone": "whatsapp:+14155551234",
      "to_phone": "whatsapp:+14155559876",
      "message_body": "Hello! Your service is scheduled for tomorrow.",
      "status": "delivered",
      "twilio_message_sid": "SM1234567890abcdef1234567890abcd",
      "lead": {
        "id": "lead-uuid-1",
        "first_name": "Jane",
        "last_name": "Smith"
      },
      "sent_at": "2026-02-06T11:20:00.000Z",
      "delivered_at": "2026-02-06T11:20:02.000Z",
      "created_at": "2026-02-06T11:20:00.000Z"
    }
  ],
  "pagination": {
    "total": 892,
    "page": 1,
    "limit": 20,
    "pages": 45,
    "has_next": true,
    "has_prev": false
  }
}
```

**Response 400 Bad Request:** Invalid query parameters
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /tenant-configs

**Description:** Get all tenant configurations (SMS/WhatsApp/IVR) (AC-16)

Returns comprehensive view of all active tenant communication configurations. Excludes sensitive credentials for security.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "sms_configs": [
    {
      "id": "config-uuid-1",
      "tenant": {
        "id": "tenant-uuid-1",
        "company_name": "Acme Corp",
        "subdomain": "acme"
      },
      "from_phone": "+14155551234",
      "provider_type": "system",
      "is_primary": true,
      "is_active": true,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    }
  ],
  "whatsapp_configs": [
    {
      "id": "config-uuid-2",
      "tenant": {
        "id": "tenant-uuid-1",
        "company_name": "Acme Corp",
        "subdomain": "acme"
      },
      "from_phone": "whatsapp:+14155551234",
      "provider_type": "system",
      "is_primary": true,
      "is_active": true,
      "created_at": "2026-01-20T12:00:00.000Z",
      "updated_at": "2026-01-20T12:00:00.000Z"
    }
  ],
  "ivr_configs": [],
  "total_tenants": 25,
  "total_configs": 48
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /tenants/:id/configs

**Description:** Get specific tenant's communication configurations

Returns all communication configurations for a specific tenant. Includes SMS, WhatsApp, and IVR settings.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Tenant UUID

**Response 200 OK:**
```json
{
  "sms_configs": [
    {
      "id": "config-uuid-1",
      "tenant": {
        "id": "tenant-uuid-1",
        "company_name": "Acme Corp",
        "subdomain": "acme"
      },
      "from_phone": "+14155551234",
      "provider_type": "system",
      "is_primary": true,
      "is_active": true,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    }
  ],
  "whatsapp_configs": [
    {
      "id": "config-uuid-2",
      "tenant": {
        "id": "tenant-uuid-1",
        "company_name": "Acme Corp",
        "subdomain": "acme"
      },
      "from_phone": "whatsapp:+14155551234",
      "provider_type": "system",
      "is_primary": true,
      "is_active": true,
      "created_at": "2026-01-20T12:00:00.000Z",
      "updated_at": "2026-01-20T12:00:00.000Z"
    }
  ],
  "ivr_configs": []
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant not found

---

### GET /tenants/:id/metrics

**Description:** Get tenant communication metrics

Returns comprehensive metrics for a specific tenant: call counts, SMS counts, average call duration, transcription stats, etc.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Tenant UUID

**Response 200 OK:**
```json
{
  "tenant": {
    "id": "tenant-uuid-1",
    "company_name": "Acme Corp",
    "subdomain": "acme"
  },
  "period": "all_time",
  "calls": {
    "total": 1523,
    "inbound": 892,
    "outbound": 631,
    "completed": 1402,
    "failed": 121,
    "average_duration_seconds": 245,
    "total_duration_minutes": 6204
  },
  "sms": {
    "total": 4521,
    "inbound": 1234,
    "outbound": 3287,
    "delivered": 4389,
    "failed": 132
  },
  "whatsapp": {
    "total": 892,
    "inbound": 234,
    "outbound": 658,
    "delivered": 870,
    "failed": 22
  },
  "transcriptions": {
    "total": 1402,
    "completed": 1365,
    "failed": 37,
    "success_rate": "97.36%",
    "average_processing_time_seconds": 12.5
  },
  "costs": {
    "estimated_monthly": "$324.50",
    "breakdown": {
      "calls": "$145.20",
      "sms": "$89.30",
      "whatsapp": "$65.00",
      "transcriptions": "$25.00"
    }
  }
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant not found

---

## 3. USAGE TRACKING & BILLING

### POST /usage/sync

**Description:** Trigger immediate usage sync for all tenants (AC-18)

Manually triggers usage sync from Twilio API for all active tenants. Typically runs automatically nightly at 2:00 AM. Use this for immediate cost updates or troubleshooting.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "message": "Usage sync initiated for all tenants"
}
```

**Note:** Sync runs asynchronously. Check logs or usage endpoints to verify completion.

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### POST /usage/sync/:tenantId

**Description:** Sync usage for specific tenant (AC-18)

Syncs usage data from Twilio API for a specific tenant. Fetches data for the last 30 days by default.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `tenantId` (string, required): Tenant UUID

**Response 200 OK:**
```json
{
  "message": "Usage synced for tenant tenant-uuid-1"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant not found

---

### GET /usage/tenants

**Description:** Get usage summary for all tenants

Returns aggregated usage statistics across all tenants. Useful for platform-wide billing and capacity planning.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters:
  - `month` (string, optional): Month in YYYY-MM format. Example: `2026-01`. Pattern: `^\d{4}-\d{2}$`
  - `start_date` (string, optional): Start date for custom date range (ISO 8601). Example: `2026-01-01T00:00:00.000Z`
  - `end_date` (string, optional): End date for custom date range (ISO 8601). Example: `2026-01-31T23:59:59.999Z`

**Response 200 OK:**
```json
{
  "period": {
    "start": "2026-02-01T00:00:00.000Z",
    "end": "2026-02-06T23:59:59.999Z"
  },
  "tenants": [
    {
      "tenant_id": "tenant-uuid-1",
      "tenant_name": "Acme Corp",
      "usage": {
        "calls_inbound": 125,
        "calls_outbound": 89,
        "sms_outbound": 432,
        "sms_inbound": 123,
        "recordings": 214,
        "transcriptions": 198
      },
      "estimated_cost": "$89.50"
    }
  ],
  "totals": {
    "calls_inbound": 2345,
    "calls_outbound": 1890,
    "sms_outbound": 8765,
    "sms_inbound": 3456,
    "recordings": 4235,
    "transcriptions": 3987
  },
  "total_estimated_cost": "$2,345.60"
}
```

**Response 400 Bad Request:** Invalid query parameters
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /usage/tenants/:id

**Description:** Get detailed usage for specific tenant

Returns detailed usage breakdown by category for a specific tenant. Includes call, SMS, recording, and transcription usage.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Tenant UUID
- Query Parameters:
  - `month` (string, optional): Month in YYYY-MM format (defaults to current month)

**Response 200 OK:**
```json
{
  "tenant": {
    "id": "tenant-uuid-1",
    "company_name": "Acme Corp",
    "subdomain": "acme"
  },
  "month": "2026-02",
  "usage": {
    "calls": {
      "inbound_count": 125,
      "outbound_count": 89,
      "inbound_minutes": 320.5,
      "outbound_minutes": 245.2,
      "total_minutes": 565.7
    },
    "sms": {
      "inbound_count": 123,
      "outbound_count": 432,
      "total_count": 555
    },
    "whatsapp": {
      "inbound_count": 45,
      "outbound_count": 128,
      "total_count": 173
    },
    "recordings": {
      "count": 214,
      "total_duration_minutes": 545.3
    },
    "transcriptions": {
      "count": 198,
      "total_duration_minutes": 485.2,
      "successful": 192,
      "failed": 6
    }
  },
  "costs": {
    "calls_inbound": "$32.05",
    "calls_outbound": "$24.52",
    "sms_outbound": "$21.60",
    "recordings": "$10.90",
    "transcriptions": "$2.91",
    "total": "$91.98"
  }
}
```

**Response 400 Bad Request:** Invalid month format
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant not found

---

### GET /usage/system

**Description:** Get system-wide usage aggregation

Returns platform-level usage statistics across all tenants. Aggregates all usage categories for specified date range.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters:
  - `start_date` (string, optional): Start date (ISO 8601, defaults to first day of current month)
  - `end_date` (string, optional): End date (ISO 8601, defaults to today)

**Response 200 OK:**
```json
{
  "period": {
    "start": "2026-02-01T00:00:00.000Z",
    "end": "2026-02-06T23:59:59.999Z"
  },
  "totals": {
    "calls": {
      "total": 4235,
      "inbound": 2345,
      "outbound": 1890,
      "completed": 3987,
      "failed": 248,
      "total_minutes": 10234.5
    },
    "sms": {
      "total": 12221,
      "inbound": 3456,
      "outbound": 8765,
      "delivered": 11987,
      "failed": 234
    },
    "whatsapp": {
      "total": 2134,
      "inbound": 789,
      "outbound": 1345,
      "delivered": 2098,
      "failed": 36
    },
    "recordings": {
      "total": 4235,
      "total_minutes": 9876.3
    },
    "transcriptions": {
      "total": 3987,
      "completed": 3892,
      "failed": 95,
      "success_rate": "97.62%"
    }
  },
  "costs": {
    "total_estimated": "$6,789.45",
    "breakdown": {
      "calls": "$3,234.50",
      "sms": "$2,456.30",
      "whatsapp": "$892.15",
      "recordings": "$123.50",
      "transcriptions": "$83.00"
    }
  },
  "active_tenants": 47
}
```

**Response 400 Bad Request:** Invalid date parameters
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /usage/export

**Description:** Export usage report (CSV)

Exports usage data as CSV file for offline analysis. Includes all usage categories and cost breakdowns. FUTURE ENHANCEMENT: This endpoint is reserved for CSV export functionality.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters: Same as GET /usage/system

**Response 200 OK (Future Enhancement Notice):**
```json
{
  "message": "CSV export is a planned future enhancement. Please use GET /usage/system or /usage/tenants/:id endpoints and export the JSON response client-side for now.",
  "alternative_endpoints": [
    "/admin/communication/usage/system",
    "/admin/communication/usage/tenants/:id",
    "/admin/communication/usage/tenants"
  ],
  "status": "planned_future_enhancement"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /costs/tenants/:id

**Description:** Get estimated costs for tenant

Returns month-to-date cost estimation with category breakdown. Used for budget alerts and billing previews.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Tenant UUID
- Query Parameters:
  - `month` (string, required): Month in YYYY-MM format. Example: `2026-02`. Pattern: `^\d{4}-\d{2}$`

**Response 200 OK:**
```json
{
  "tenant": {
    "id": "tenant-uuid-1",
    "company_name": "Acme Corp",
    "subdomain": "acme"
  },
  "month": "2026-02",
  "period": {
    "start": "2026-02-01T00:00:00.000Z",
    "end": "2026-02-29T23:59:59.999Z",
    "days_elapsed": 6,
    "days_remaining": 23
  },
  "costs": {
    "calls_inbound": {
      "count": 125,
      "minutes": 320.5,
      "cost": "$32.05",
      "rate_per_minute": "$0.10"
    },
    "calls_outbound": {
      "count": 89,
      "minutes": 245.2,
      "cost": "$24.52",
      "rate_per_minute": "$0.10"
    },
    "sms_outbound": {
      "count": 432,
      "cost": "$21.60",
      "rate_per_message": "$0.05"
    },
    "recordings": {
      "count": 214,
      "minutes": 545.3,
      "cost": "$10.90",
      "rate_per_minute": "$0.02"
    },
    "transcriptions": {
      "count": 198,
      "minutes": 485.2,
      "cost": "$2.91",
      "rate_per_minute": "$0.006"
    },
    "subtotal": "$91.98",
    "tax": "$0.00",
    "total": "$91.98"
  },
  "projected_month_end": "$334.93"
}
```

**Response 400 Bad Request:** Invalid month format
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant not found

---

## 4. TRANSCRIPTION MONITORING

### GET /transcriptions/failed

**Description:** Get all failed transcriptions across all tenants

Returns list of all failed transcriptions for troubleshooting. Includes error messages and call details. Limited to most recent 100 failures.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "failed_transcriptions": [
    {
      "id": "transcription-uuid-1",
      "tenant": {
        "id": "tenant-uuid-1",
        "company_name": "Acme Corp",
        "subdomain": "acme"
      },
      "call": {
        "id": "call-uuid-1",
        "twilio_call_sid": "CA1234567890abcdef",
        "duration_seconds": 180
      },
      "provider": "openai_whisper",
      "status": "failed",
      "error_message": "API rate limit exceeded",
      "created_at": "2026-02-06T08:30:00.000Z",
      "failed_at": "2026-02-06T08:30:15.000Z"
    }
  ],
  "total_count": 37,
  "limit": 100
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /transcriptions/:id

**Description:** Get transcription details

Returns full details for a specific transcription, including status, provider, and error info.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Transcription UUID

**Response 200 OK:**
```json
{
  "id": "transcription-uuid-1",
  "tenant": {
    "id": "tenant-uuid-1",
    "company_name": "Acme Corp",
    "subdomain": "acme"
  },
  "call": {
    "id": "call-uuid-1",
    "twilio_call_sid": "CA1234567890abcdef",
    "direction": "inbound",
    "status": "completed",
    "recording_url": "https://api.twilio.com/recordings/RE123...",
    "duration_seconds": 180
  },
  "lead": {
    "id": "lead-uuid-1",
    "first_name": "John",
    "last_name": "Doe"
  },
  "transcription_provider": "openai_whisper",
  "status": "completed",
  "transcription_text": "Hello, I'd like to schedule an appointment for next Tuesday...",
  "language_detected": "en",
  "confidence_score": 0.95,
  "processing_duration_seconds": 12.5,
  "cost": 0.018,
  "error_message": null,
  "created_at": "2026-02-06T08:30:00.000Z",
  "completed_at": "2026-02-06T08:30:12.000Z"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Transcription not found

---

### POST /transcriptions/:id/retry

**Description:** Retry failed transcription

Requeues a failed transcription for processing. Resets status to PENDING and queues job.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Transcription UUID

**Response 200 OK:**
```json
{
  "message": "Transcription retry queued"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Transcription not found

---

### GET /transcription-providers

**Description:** List transcription providers with usage stats

Returns list of configured transcription providers with usage and cost statistics.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
[
  {
    "id": "provider-uuid-1",
    "provider_name": "openai_whisper",
    "tenant": {
      "id": "tenant-uuid-1",
      "company_name": "Acme Corp",
      "subdomain": "acme"
    },
    "is_system_default": true,
    "status": "active",
    "usage_limit": 10000,
    "usage_current": 3456,
    "cost_per_minute": 0.006,
    "statistics": {
      "total_transcriptions": 3456,
      "successful": 3378,
      "failed": 78,
      "success_rate": "97.74"
    },
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-02-06T08:00:00.000Z"
  }
]
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

## 5. SYSTEM HEALTH

### GET /health

**Description:** Get overall system health status

Runs comprehensive health check across all systems: Twilio API, webhooks, transcription providers. Returns detailed status for each component.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-06T10:00:00.000Z",
  "components": {
    "twilio_api": {
      "status": "healthy",
      "response_time_ms": 145,
      "last_checked": "2026-02-06T10:00:00.000Z"
    },
    "webhooks": {
      "status": "healthy",
      "endpoint": "https://api.lead360.app/webhooks/twilio",
      "last_successful_delivery": "2026-02-06T09:45:23.000Z"
    },
    "transcription_providers": {
      "status": "healthy",
      "active_providers": 2,
      "providers": [
        {
          "name": "openai_whisper",
          "status": "healthy",
          "last_success": "2026-02-06T09:58:12.000Z"
        }
      ]
    },
    "database": {
      "status": "healthy",
      "response_time_ms": 12
    },
    "queue": {
      "status": "healthy",
      "pending_jobs": 23,
      "failed_jobs": 2
    }
  }
}
```

**Response 200 OK (Degraded):**
```json
{
  "status": "degraded",
  "timestamp": "2026-02-06T10:00:00.000Z",
  "issues": [
    "Transcription provider 'deepgram' is experiencing errors"
  ],
  "components": {
    "twilio_api": {
      "status": "healthy",
      "response_time_ms": 145
    },
    "transcription_providers": {
      "status": "degraded",
      "active_providers": 2,
      "providers": [
        {
          "name": "deepgram",
          "status": "unhealthy",
          "error": "API rate limit exceeded"
        }
      ]
    }
  }
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### POST /health/twilio-test

**Description:** Test Twilio API connectivity

Tests Twilio API connectivity for a specific tenant. Measures response time and validates credentials.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "tenant_id": "tenant-uuid-1"
}
```

**Field Details:**
- `tenant_id` (string, required): Tenant ID to test connectivity for (use "system" for system-level check)

**Response 200 OK:**
```json
{
  "success": true,
  "tenant_id": "tenant-uuid-1",
  "message": "Twilio API connectivity successful",
  "account_sid": "AC1234567890abcdef",
  "response_time_ms": 123,
  "tested_at": "2026-02-06T10:15:00.000Z"
}
```

**Response 200 OK (Failed):**
```json
{
  "success": false,
  "tenant_id": "tenant-uuid-1",
  "message": "Twilio API connectivity failed",
  "error": "Invalid credentials",
  "response_time_ms": 89,
  "tested_at": "2026-02-06T10:15:00.000Z"
}
```

**Response 400 Bad Request:** Missing tenant_id
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant not found

---

### POST /health/webhooks-test

**Description:** Test webhook delivery

Tests that webhook endpoint is accessible and responding correctly.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Webhook endpoint is accessible",
  "endpoint": "https://api.lead360.app/webhooks/twilio",
  "response_time_ms": 67,
  "tested_at": "2026-02-06T10:20:00.000Z"
}
```

**Response 200 OK (Failed):**
```json
{
  "success": false,
  "message": "Webhook endpoint is not accessible",
  "endpoint": "https://api.lead360.app/webhooks/twilio",
  "error": "Connection timeout",
  "tested_at": "2026-02-06T10:20:00.000Z"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### POST /health/transcription-test

**Description:** Test transcription provider

Tests transcription provider API connectivity and configuration.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Transcription provider connectivity successful",
  "providers_tested": [
    {
      "name": "openai_whisper",
      "status": "healthy",
      "response_time_ms": 234,
      "api_version": "v1"
    }
  ],
  "tested_at": "2026-02-06T10:25:00.000Z"
}
```

**Response 200 OK (Failed):**
```json
{
  "success": false,
  "message": "Some transcription providers failed",
  "providers_tested": [
    {
      "name": "openai_whisper",
      "status": "failed",
      "error": "API key invalid"
    }
  ],
  "tested_at": "2026-02-06T10:25:00.000Z"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /health/provider-response-times

**Description:** Get provider performance metrics (last 24h)

Returns API response time statistics for all providers: avg, max, min response times. Used for performance monitoring and capacity planning.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "period": {
    "start": "2026-02-05T10:30:00.000Z",
    "end": "2026-02-06T10:30:00.000Z",
    "hours": 24
  },
  "providers": {
    "twilio_api": {
      "avg_response_time_ms": 145,
      "max_response_time_ms": 523,
      "min_response_time_ms": 89,
      "p95_response_time_ms": 234,
      "total_requests": 4523,
      "failed_requests": 12,
      "success_rate": "99.73%"
    },
    "openai_whisper": {
      "avg_response_time_ms": 2345,
      "max_response_time_ms": 8901,
      "min_response_time_ms": 1234,
      "p95_response_time_ms": 5678,
      "total_requests": 892,
      "failed_requests": 23,
      "success_rate": "97.42%"
    }
  }
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /alerts

**Description:** Get recent system alerts

Returns paginated list of system alerts: health failures, failed transcriptions, quota exceeded, etc.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters:
  - `acknowledged` (string, optional): Filter by acknowledged status (true/false)
  - `severity` (string, optional): Filter by severity. Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
  - `page` (integer, optional): Page number (default: 1)
  - `limit` (integer, optional): Results per page (default: 20)

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "alert-uuid-1",
      "type": "health_check_failed",
      "severity": "HIGH",
      "message": "Transcription provider 'deepgram' API connectivity failed",
      "details": {
        "provider": "deepgram",
        "error": "API rate limit exceeded",
        "timestamp": "2026-02-06T09:45:00.000Z"
      },
      "acknowledged": true,
      "acknowledged_by": {
        "id": "user-uuid-1",
        "name": "Admin User",
        "email": "admin@lead360.app"
      },
      "acknowledged_at": "2026-02-06T10:00:00.000Z",
      "created_at": "2026-02-06T09:45:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

**Response 400 Bad Request:** Invalid query parameters
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

## 6. METRICS & ANALYTICS

### GET /metrics/system-wide

**Description:** Get comprehensive system-wide metrics

Returns platform-level metrics across all tenants: total calls, SMS, transcriptions, success rates, etc.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "timestamp": "2026-02-06T10:00:00.000Z",
  "period": "all_time",
  "totals": {
    "tenants": {
      "total": 47,
      "active": 42,
      "inactive": 5
    },
    "calls": {
      "total": 125432,
      "inbound": 67234,
      "outbound": 58198,
      "completed": 118765,
      "failed": 6667,
      "success_rate": "94.69%",
      "total_minutes": 345678
    },
    "sms": {
      "total": 456789,
      "inbound": 123456,
      "outbound": 333333,
      "delivered": 448901,
      "failed": 7888,
      "delivery_rate": "98.27%"
    },
    "whatsapp": {
      "total": 78901,
      "inbound": 23456,
      "outbound": 55445,
      "delivered": 77234,
      "failed": 1667,
      "delivery_rate": "97.89%"
    },
    "transcriptions": {
      "total": 118765,
      "completed": 115892,
      "failed": 2873,
      "success_rate": "97.58%"
    }
  },
  "costs": {
    "total_all_time": "$234,567.89",
    "current_month": "$12,345.67"
  }
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /metrics/top-tenants

**Description:** Get top tenants by communication volume

Returns list of tenants with highest communication activity. Useful for identifying power users and capacity planning.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters:
  - `limit` (integer, optional): Number of top tenants to return (default: 10)

**Response 200 OK:**
```json
{
  "period": "last_30_days",
  "top_tenants": [
    {
      "rank": 1,
      "tenant": {
        "id": "tenant-uuid-1",
        "company_name": "Acme Corp",
        "subdomain": "acme"
      },
      "activity": {
        "total_communications": 12456,
        "calls": 3456,
        "sms": 7890,
        "whatsapp": 1110
      },
      "costs": {
        "estimated": "$1,234.56"
      }
    },
    {
      "rank": 2,
      "tenant": {
        "id": "tenant-uuid-2",
        "company_name": "Globex Corporation",
        "subdomain": "globex"
      },
      "activity": {
        "total_communications": 9876,
        "calls": 2345,
        "sms": 6543,
        "whatsapp": 988
      },
      "costs": {
        "estimated": "$987.65"
      }
    }
  ],
  "limit": 10
}
```

**Response 400 Bad Request:** Invalid limit
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

## 7. CRON MANAGEMENT

### GET /cron/status

**Description:** Get cron job status

Returns current status of all scheduled jobs including their schedules, timezone, and running status. Shows configuration loaded from system_settings table.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "cron_jobs": [
    {
      "name": "usage_sync",
      "schedule": "0 2 * * *",
      "timezone": "America/New_York",
      "description": "Sync Twilio usage data from API for all tenants",
      "last_run": "2026-02-06T07:00:00.000Z",
      "next_run": "2026-02-07T07:00:00.000Z",
      "status": "active",
      "success_count": 5,
      "failure_count": 0
    },
    {
      "name": "health_check",
      "schedule": "*/15 * * * *",
      "timezone": "America/New_York",
      "description": "Run system health checks",
      "last_run": "2026-02-06T10:15:00.000Z",
      "next_run": "2026-02-06T10:30:00.000Z",
      "status": "active",
      "success_count": 96,
      "failure_count": 4
    }
  ],
  "system_timezone": "America/New_York"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### POST /cron/reload

**Description:** Reload cron schedules from system settings

Reloads cron job schedules from system_settings table and restarts jobs with new configuration. Use this after updating cron settings (twilio_usage_sync_cron, twilio_health_check_cron, cron_timezone). Jobs will be stopped and restarted with the new schedule immediately.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "message": "Cron schedules reloaded successfully",
  "status": {
    "cron_jobs": [
      {
        "name": "usage_sync",
        "schedule": "0 2 * * *",
        "timezone": "America/New_York",
        "status": "active",
        "reloaded": true
      },
      {
        "name": "health_check",
        "schedule": "*/15 * * * *",
        "timezone": "America/New_York",
        "status": "active",
        "reloaded": true
      }
    ]
  }
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

## 8. WEBHOOK MANAGEMENT

### GET /webhooks/config

**Description:** Get webhook configuration

Returns current webhook configuration including base URL, endpoints, and security settings.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`

**Response 200 OK:**
```json
{
  "id": "config-uuid-1234",
  "base_url": "https://api.lead360.app",
  "endpoints": {
    "calls": "/webhooks/twilio/calls",
    "sms": "/webhooks/twilio/sms",
    "whatsapp": "/webhooks/twilio/whatsapp",
    "email": "/webhooks/email/status"
  },
  "security": {
    "signature_verification": true,
    "secret_configured": true,
    "last_rotated": "2026-01-15T10:00:00.000Z"
  }
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### PATCH /webhooks/config

**Description:** Update webhook configuration

Updates webhook base URL, signature verification, or rotates webhook secret.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "base_url": "https://api.lead360.app",
  "signature_verification": true,
  "rotate_secret": false
}
```

**Field Details:**
- `base_url` (string, optional): Base URL for webhook endpoints
- `signature_verification` (boolean, optional): Enable/disable webhook signature verification
- `rotate_secret` (boolean, optional): Generate new webhook secret (default: false)

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Webhook configuration updated successfully",
  "config": {
    "base_url": "https://api.lead360.app",
    "signature_verification": true,
    "secret_rotated": false
  }
}
```

**Response 400 Bad Request:** Invalid configuration
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### POST /webhooks/test

**Description:** Test webhook endpoint

Sends a test webhook payload to verify endpoint configuration and processing.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "type": "sms",
  "payload": {
    "from": "+15555555555",
    "to": "+15555555556",
    "body": "Test message"
  }
}
```

**Field Details:**
- `type` (string, required): Type of webhook to test. Enum: `sms`, `call`, `whatsapp`, `email`
- `payload` (object, optional): Test payload to send (if not provided, uses default test payload)

**Response 200 OK (Success):**
```json
{
  "status": "success",
  "webhook_url": "https://api.lead360.app/webhooks/twilio/sms",
  "response_time_ms": 67,
  "status_code": 200,
  "signature_valid": true,
  "processing_result": "Test webhook for sms processed successfully"
}
```

**Response 200 OK (Failed):**
```json
{
  "status": "failed",
  "webhook_url": "https://api.lead360.app/webhooks/twilio/sms",
  "response_time_ms": 143,
  "status_code": 500,
  "signature_valid": false,
  "processing_result": "Webhook returned error status 500: Internal Server Error"
}
```

**Response 400 Bad Request:** Invalid webhook type or payload
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /webhook-events

**Description:** List webhook events

Returns paginated list of webhook events with filtering by type, status, and date range.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters:
  - `webhook_type` (string, optional): Filter by webhook type. Enum: `sms`, `call`, `whatsapp`, `email`
  - `status` (string, optional): Filter by processing status. Enum: `pending`, `processed`, `failed`
  - `start_date` (string, optional): Start date for filtering (ISO 8601)
  - `end_date` (string, optional): End date for filtering (ISO 8601)
  - `page` (integer, optional): Page number for pagination (default: 1, min: 1)
  - `limit` (integer, optional): Number of items per page (default: 20, min: 1, max: 100)

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "webhook-event-uuid-1",
      "webhook_type": "sms",
      "status": "processed",
      "payload": {
        "MessageSid": "SM1234567890abcdef",
        "From": "+15555555555",
        "To": "+15555555556",
        "Body": "Hello world",
        "MessageStatus": "delivered"
      },
      "processing_attempts": 1,
      "last_error": null,
      "processed_at": "2026-02-06T10:15:03.000Z",
      "created_at": "2026-02-06T10:15:00.000Z"
    },
    {
      "id": "webhook-event-uuid-2",
      "webhook_type": "call",
      "status": "failed",
      "payload": {
        "CallSid": "CA1234567890abcdef",
        "CallStatus": "completed"
      },
      "processing_attempts": 3,
      "last_error": "Database connection timeout",
      "processed_at": null,
      "created_at": "2026-02-06T09:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 4523,
    "page": 1,
    "limit": 20,
    "pages": 227,
    "has_next": true,
    "has_prev": false
  }
}
```

**Response 400 Bad Request:** Invalid query parameters
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### POST /webhook-events/:id/retry

**Description:** Retry failed webhook event

Marks a failed webhook event for reprocessing by resetting its status.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Webhook event ID

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Webhook event queued for retry",
  "event_id": "webhook-event-uuid-2",
  "new_status": "pending"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Webhook event not found

---

## 9. PHONE NUMBER OPERATIONS

### POST /phone-numbers/purchase

**Description:** Purchase new Twilio phone number

Purchases a new phone number from Twilio and optionally allocates it to a tenant immediately.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "phone_number": "+15555555555",
  "capabilities": {
    "voice": true,
    "sms": true,
    "mms": true
  },
  "tenant_id": "tenant-uuid-here",
  "purpose": "SMS + Calls"
}
```

**Field Details:**
- `phone_number` (string, required): Phone number to purchase (E.164 format). Example: `+15555555555`
- `capabilities` (object, optional): Capabilities for the phone number
  - `voice` (boolean, optional): Enable voice capabilities
  - `sms` (boolean, optional): Enable SMS capabilities
  - `mms` (boolean, optional): Enable MMS capabilities
- `tenant_id` (string, required): Tenant ID to allocate the phone number to
- `purpose` (string, optional): Purpose of the phone number allocation. Enum: `SMS Only`, `Calls Only`, `SMS + Calls`, `WhatsApp`

**Response 201 Created:**
```json
{
  "success": true,
  "message": "Phone number purchased and allocated successfully",
  "phone_number": {
    "sid": "PN1234567890abcdef1234567890abcd",
    "phone_number": "+15555555555",
    "friendly_name": "(555) 555-5555",
    "capabilities": {
      "voice": true,
      "sms": true,
      "mms": true
    },
    "monthly_cost": "$1.00"
  },
  "allocation": {
    "tenant_id": "tenant-uuid-here",
    "purpose": "SMS + Calls",
    "allocated_at": "2026-02-06T11:00:00.000Z"
  }
}
```

**Response 400 Bad Request:** Invalid phone number or capabilities
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 409 Conflict:** Phone number already owned

---

### POST /phone-numbers/:sid/allocate

**Description:** Allocate phone number to tenant

Allocates an existing owned phone number to a specific tenant for their use.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `sid` (string, required): Twilio phone number SID
- Body:
```json
{
  "tenant_id": "tenant-uuid-here",
  "purpose": "SMS + Calls"
}
```

**Field Details:**
- `tenant_id` (string, required): Tenant ID to allocate the phone number to
- `purpose` (string, optional): Purpose of the phone number allocation. Enum: `SMS Only`, `Calls Only`, `SMS + Calls`, `WhatsApp`

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Phone number allocated successfully",
  "phone_number": {
    "sid": "PN1234567890abcdef1234567890abcd",
    "phone_number": "+15555555555",
    "friendly_name": "(555) 555-5555"
  },
  "allocation": {
    "tenant_id": "tenant-uuid-here",
    "tenant_name": "Acme Corp",
    "purpose": "SMS + Calls",
    "allocated_at": "2026-02-06T11:05:00.000Z"
  }
}
```

**Response 400 Bad Request:** Invalid tenant_id
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Phone number not found
**Response 409 Conflict:** Phone number already allocated

---

### DELETE /phone-numbers/:sid/allocate

**Description:** Deallocate phone number from tenant

Removes tenant allocation from a phone number, making it available for reassignment. Optionally deletes tenant SMS/WhatsApp configuration using this number.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `sid` (string, required): Twilio phone number SID
- Body:
```json
{
  "delete_config": false,
  "reason": "Tenant requested removal"
}
```

**Field Details:**
- `delete_config` (boolean, optional): Also delete tenant SMS/WhatsApp configuration using this number (default: false)
- `reason` (string, optional): Reason for deallocation (for audit log)

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Phone number deallocated successfully",
  "phone_number": {
    "sid": "PN1234567890abcdef1234567890abcd",
    "phone_number": "+15555555555",
    "status": "available"
  },
  "previous_allocation": {
    "tenant_id": "tenant-uuid-here",
    "tenant_name": "Acme Corp",
    "deallocated_at": "2026-02-06T11:10:00.000Z"
  },
  "config_deleted": false
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Phone number not found or not allocated

---

### DELETE /phone-numbers/:sid

**Description:** Release phone number to Twilio

Releases a phone number back to Twilio (deletes from account). Number must be deallocated from all tenants first.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `sid` (string, required): Twilio phone number SID

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Phone number released successfully",
  "phone_number": {
    "sid": "PN1234567890abcdef1234567890abcd",
    "phone_number": "+15555555555",
    "released_at": "2026-02-06T11:15:00.000Z"
  }
}
```

**Response 400 Bad Request:** Phone number is still allocated to a tenant
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Phone number not found

---

## 10. TRANSCRIPTION PROVIDER CRUD

### POST /transcription-providers

**Description:** Create transcription provider

Creates a new transcription provider configuration (OpenAI, Deepgram, or AssemblyAI). API keys are encrypted before storage.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "tenant_id": "tenant-uuid-here",
  "provider_name": "openai_whisper",
  "api_key": "sk-proj-...",
  "api_endpoint": "https://api.openai.com/v1/audio/transcriptions",
  "model": "whisper-1",
  "language": "en",
  "additional_settings": {
    "temperature": 0,
    "response_format": "json"
  },
  "is_system_default": false,
  "usage_limit": 10000,
  "cost_per_minute": 0.006
}
```

**Field Details:**
- `tenant_id` (string, optional): Tenant ID (optional, for creating tenant-specific provider)
- `provider_name` (string, required): Provider name/type. Enum: `openai_whisper`, `assemblyai`, `deepgram`
- `api_key` (string, required): API key for the provider (will be encrypted)
- `api_endpoint` (string, optional): API endpoint URL (if different from default)
- `model` (string, optional): Model to use for transcription. Example: `whisper-1`
- `language` (string, optional): Language code for transcription. Example: `en`
- `additional_settings` (object, optional): Additional provider-specific settings
- `is_system_default` (boolean, optional): Set as system default provider (default: false)
- `usage_limit` (integer, optional): Monthly usage limit (transcription requests). Min: 1
- `cost_per_minute` (number, optional): Cost per minute of transcription (USD). Min: 0

**Response 201 Created:**
```json
{
  "id": "provider-uuid-new",
  "tenant_id": "tenant-uuid-here",
  "provider_name": "openai_whisper",
  "api_endpoint": "https://api.openai.com/v1/audio/transcriptions",
  "model": "whisper-1",
  "language": "en",
  "additional_settings": {
    "temperature": 0,
    "response_format": "json"
  },
  "is_system_default": false,
  "status": "active",
  "usage_limit": 10000,
  "usage_current": 0,
  "cost_per_minute": 0.006,
  "created_at": "2026-02-06T11:20:00.000Z",
  "updated_at": "2026-02-06T11:20:00.000Z"
}
```

**Response 400 Bad Request:** Invalid provider configuration
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /transcription-providers/:id

**Description:** Get transcription provider

Returns a specific transcription provider configuration with usage statistics.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Provider ID

**Response 200 OK:**
```json
{
  "id": "provider-uuid-1",
  "tenant": {
    "id": "tenant-uuid-1",
    "company_name": "Acme Corp",
    "subdomain": "acme"
  },
  "provider_name": "openai_whisper",
  "api_endpoint": "https://api.openai.com/v1/audio/transcriptions",
  "model": "whisper-1",
  "language": "en",
  "additional_settings": {
    "temperature": 0,
    "response_format": "json"
  },
  "is_system_default": true,
  "status": "active",
  "usage_limit": 10000,
  "usage_current": 3456,
  "cost_per_minute": 0.006,
  "statistics": {
    "total_transcriptions": 3456,
    "successful": 3378,
    "failed": 78,
    "success_rate": "97.74%",
    "total_cost": "$20.74"
  },
  "created_at": "2026-01-15T10:00:00.000Z",
  "updated_at": "2026-02-06T08:00:00.000Z"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Provider not found

---

### PATCH /transcription-providers/:id

**Description:** Update transcription provider

Updates transcription provider configuration. Can update API key, endpoint, config, or enabled status.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Provider ID
- Body:
```json
{
  "api_key": "sk-proj-new-key...",
  "api_endpoint": "https://api.openai.com/v1/audio/transcriptions",
  "model": "whisper-1",
  "language": "en",
  "additional_settings": {
    "temperature": 0,
    "response_format": "json"
  },
  "status": "active",
  "usage_limit": 15000,
  "cost_per_minute": 0.006,
  "is_system_default": false
}
```

**Field Details:** All fields optional
- `api_key` (string): New API key for the provider (will be encrypted)
- `api_endpoint` (string): API endpoint URL
- `model` (string): Model to use for transcription
- `language` (string): Language code for transcription
- `additional_settings` (object): Additional provider-specific settings
- `status` (string): Provider status. Enum: `active`, `inactive`
- `usage_limit` (integer): Monthly usage limit (transcription requests). Min: 1
- `cost_per_minute` (number): Cost per minute of transcription (USD). Min: 0
- `is_system_default` (boolean): Set/unset as system default provider

**Response 200 OK:**
```json
{
  "id": "provider-uuid-1",
  "provider_name": "openai_whisper",
  "status": "active",
  "usage_limit": 15000,
  "cost_per_minute": 0.006,
  "is_system_default": false,
  "updated_at": "2026-02-06T11:25:00.000Z"
}
```

**Response 400 Bad Request:** Invalid update data
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Provider not found

---

### DELETE /transcription-providers/:id

**Description:** Delete transcription provider

Deletes a transcription provider. Cannot delete if provider is set as system default or has active transcriptions in progress.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Provider ID

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Transcription provider deleted successfully",
  "provider_id": "provider-uuid-1",
  "deleted_at": "2026-02-06T11:30:00.000Z"
}
```

**Response 400 Bad Request:** Cannot delete system default provider or provider with active transcriptions
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Provider not found

---

### POST /transcription-providers/:id/test

**Description:** Test transcription provider

Tests transcription provider API connectivity by attempting a test transcription. Uses provided audio URL or default test file.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Provider ID
- Body:
```json
{
  "audio_url": "https://storage.example.com/test-audio.mp3"
}
```

**Field Details:**
- `audio_url` (string, optional): URL of audio file to test transcription (if not provided, uses default test file)

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Transcription provider test successful",
  "provider_id": "provider-uuid-1",
  "provider_name": "openai_whisper",
  "test_transcription": {
    "text": "This is a test audio file for transcription testing.",
    "language": "en",
    "confidence": 0.98,
    "duration_seconds": 3.5,
    "processing_time_seconds": 2.1
  },
  "api_response_time_ms": 2134,
  "tested_at": "2026-02-06T11:35:00.000Z"
}
```

**Response 200 OK (Failed):**
```json
{
  "success": false,
  "message": "Transcription provider test failed",
  "provider_id": "provider-uuid-1",
  "provider_name": "openai_whisper",
  "error": "API key invalid",
  "tested_at": "2026-02-06T11:35:00.000Z"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Provider not found

---

## 11. TENANT ASSISTANCE

### POST /tenants/:tenantId/sms-config

**Description:** Create SMS config for tenant

Admin creates SMS configuration on behalf of a tenant. Supports both system provider (Model B) and custom credentials (Model A).

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `tenantId` (string, required): Tenant ID
- Body:
```json
{
  "provider_type": "system",
  "from_phone": "+15555555555",
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "your_auth_token_here"
}
```

**Field Details:**
- `provider_type` (string, optional): Provider type. Enum: `system` (Model B), `custom` (Model A). Default: `system`
- `from_phone` (string, required): Phone number for sending SMS (E.164 format). Example: `+15555555555`
- `account_sid` (string, optional): Twilio Account SID (required for custom provider)
- `auth_token` (string, optional): Twilio Auth Token (required for custom provider, will be encrypted)

**Response 201 Created:**
```json
{
  "id": "config-uuid-new",
  "tenant_id": "tenant-uuid-here",
  "provider_type": "system",
  "from_phone": "+15555555555",
  "is_primary": true,
  "is_active": true,
  "created_by": "system-admin",
  "created_at": "2026-02-06T11:40:00.000Z",
  "updated_at": "2026-02-06T11:40:00.000Z"
}
```

**Response 400 Bad Request:** Invalid configuration (missing required fields for custom provider)
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant not found

---

### PATCH /tenants/:tenantId/sms-config/:configId

**Description:** Update SMS config for tenant

Admin updates SMS configuration on behalf of a tenant. Can switch between system provider and custom credentials.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `tenantId` (string, required): Tenant ID
  - `configId` (string, required): SMS Config ID
- Body:
```json
{
  "from_phone": "+15555559999",
  "is_active": true,
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "new_auth_token_here"
}
```

**Field Details:** All fields optional
- `from_phone` (string): Phone number for sending SMS (E.164 format)
- `is_active` (boolean): Enable/disable this configuration
- `account_sid` (string): Twilio Account SID (for updating custom provider credentials)
- `auth_token` (string): Twilio Auth Token (for updating custom provider credentials)

**Response 200 OK:**
```json
{
  "id": "config-uuid-1",
  "tenant_id": "tenant-uuid-here",
  "provider_type": "system",
  "from_phone": "+15555559999",
  "is_primary": true,
  "is_active": true,
  "updated_by": "system-admin",
  "updated_at": "2026-02-06T11:45:00.000Z"
}
```

**Response 400 Bad Request:** Invalid update data
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant or config not found

---

### POST /tenants/:tenantId/whatsapp-config

**Description:** Create WhatsApp config for tenant

Admin creates WhatsApp configuration on behalf of a tenant. Supports both system provider (Model B) and custom credentials (Model A).

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `tenantId` (string, required): Tenant ID
- Body:
```json
{
  "provider_type": "system",
  "from_phone": "+15555555555",
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "your_auth_token_here"
}
```

**Field Details:**
- `provider_type` (string, optional): Provider type. Enum: `system`, `custom`. Default: `system`
- `from_phone` (string, required): WhatsApp phone number (E.164 format). Example: `+15555555555`
- `account_sid` (string, optional): Twilio Account SID (required for custom provider)
- `auth_token` (string, optional): Twilio Auth Token (required for custom provider, will be encrypted)

**Response 201 Created:**
```json
{
  "id": "config-uuid-new",
  "tenant_id": "tenant-uuid-here",
  "provider_type": "system",
  "from_phone": "+15555555555",
  "is_primary": true,
  "is_active": true,
  "created_by": "system-admin",
  "created_at": "2026-02-06T11:50:00.000Z",
  "updated_at": "2026-02-06T11:50:00.000Z"
}
```

**Response 400 Bad Request:** Invalid configuration
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant not found

---

### PATCH /tenants/:tenantId/whatsapp-config/:configId

**Description:** Update WhatsApp config for tenant

Admin updates WhatsApp configuration on behalf of a tenant. Can switch between system provider and custom credentials.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `tenantId` (string, required): Tenant ID
  - `configId` (string, required): WhatsApp Config ID
- Body:
```json
{
  "from_phone": "+15555559999",
  "is_active": true,
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "new_auth_token_here"
}
```

**Field Details:** All fields optional
- `from_phone` (string): WhatsApp phone number (E.164 format)
- `is_active` (boolean): Enable/disable this configuration
- `account_sid` (string): Twilio Account SID (for updating custom provider credentials)
- `auth_token` (string): Twilio Auth Token (for updating custom provider credentials)

**Response 200 OK:**
```json
{
  "id": "config-uuid-2",
  "tenant_id": "tenant-uuid-here",
  "provider_type": "system",
  "from_phone": "+15555559999",
  "is_primary": true,
  "is_active": true,
  "updated_by": "system-admin",
  "updated_at": "2026-02-06T11:55:00.000Z"
}
```

**Response 400 Bad Request:** Invalid update data
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant or config not found

---

### POST /tenants/:tenantId/test-sms

**Description:** Test tenant SMS configuration

Sends a test SMS using the tenant's configuration to verify it works correctly.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `tenantId` (string, required): Tenant ID
- Query Parameters:
  - `configId` (string, optional): SMS Config ID (uses primary if not provided)

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Test SMS sent successfully",
  "config_id": "config-uuid-1",
  "from_phone": "+15555555555",
  "test_message_sid": "SM1234567890abcdef1234567890abcd",
  "sent_at": "2026-02-06T12:00:00.000Z"
}
```

**Response 200 OK (Failed):**
```json
{
  "success": false,
  "message": "Test SMS failed",
  "config_id": "config-uuid-1",
  "error": "Invalid credentials",
  "tested_at": "2026-02-06T12:00:00.000Z"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant or config not found

---

### POST /tenants/:tenantId/test-whatsapp

**Description:** Test tenant WhatsApp configuration

Sends a test WhatsApp message using the tenant's configuration to verify it works correctly.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `tenantId` (string, required): Tenant ID
- Query Parameters:
  - `configId` (string, optional): WhatsApp Config ID (uses primary if not provided)

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Test WhatsApp message sent successfully",
  "config_id": "config-uuid-2",
  "from_phone": "+15555555555",
  "test_message_sid": "SM1234567890abcdef1234567890abcd",
  "sent_at": "2026-02-06T12:05:00.000Z"
}
```

**Response 200 OK (Failed):**
```json
{
  "success": false,
  "message": "Test WhatsApp message failed",
  "config_id": "config-uuid-2",
  "error": "Number not approved for WhatsApp",
  "tested_at": "2026-02-06T12:05:00.000Z"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Tenant or config not found

---

## 12. ALERT MANAGEMENT

### PATCH /alerts/:id/acknowledge

**Description:** Acknowledge alert

Marks an alert as acknowledged with optional admin comment. All actions are audit logged.

**Authentication:** Bearer JWT + SystemAdmin role

**Authentication Note:** Admin user ID is automatically extracted from the JWT token in the Authorization header. No need to include it in the request body.

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Alert ID
- Body:
```json
{
  "comment": "Investigating this issue with development team"
}
```

**Field Details:**
- `comment` (string, optional): Admin comment about the alert

**Response 200 OK:**
```json
{
  "id": "alert-uuid-1",
  "type": "health_check_failed",
  "severity": "HIGH",
  "message": "Transcription provider 'deepgram' API connectivity failed",
  "acknowledged": true,
  "acknowledged_by": {
    "id": "user-uuid-1",
    "name": "Admin User",
    "email": "admin@lead360.app"
  },
  "acknowledged_at": "2026-02-06T12:10:00.000Z",
  "comment": "Investigating this issue with development team"
}
```

**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Alert not found

---

### PATCH /alerts/:id/resolve

**Description:** Resolve alert

Marks an alert as resolved with resolution notes. Automatically acknowledges the alert if not already acknowledged. All actions are audit logged.

**Authentication:** Bearer JWT + SystemAdmin role

**Authentication Note:** Admin user ID is automatically extracted from the JWT token in the Authorization header. No need to include it in the request body.

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Alert ID
- Body:
```json
{
  "resolution": "Issue resolved by restarting Twilio webhook processor service"
}
```

**Field Details:**
- `resolution` (string, required): Resolution notes describing how the issue was fixed

**Response 200 OK:**
```json
{
  "id": "alert-uuid-1",
  "type": "health_check_failed",
  "severity": "HIGH",
  "message": "Transcription provider 'deepgram' API connectivity failed",
  "acknowledged": true,
  "resolved": true,
  "resolution": "Issue resolved by restarting Twilio webhook processor service",
  "resolved_by": {
    "id": "user-uuid-1",
    "name": "Admin User",
    "email": "admin@lead360.app"
  },
  "resolved_at": "2026-02-06T12:15:00.000Z"
}
```

**Response 400 Bad Request:** Missing resolution
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Alert not found

---

### POST /alerts/bulk-acknowledge

**Description:** Bulk acknowledge alerts (Best-Effort)

Acknowledges multiple alerts at once with the same comment. Uses a **best-effort approach** - acknowledges all valid alerts and skips invalid IDs, returning detailed status for transparency. Useful for acknowledging related alerts from the same incident.

**Behavior:**
- ✅ Acknowledges all valid alert IDs
- ⚠️ Skips invalid/not-found IDs (doesn't fail entire operation)
- 📊 Returns detailed breakdown of what succeeded and what failed
- 🔒 Only fails if ALL IDs are invalid or empty array provided

**Authentication:** Bearer JWT + SystemAdmin role

**Authentication Note:** Admin user ID is automatically extracted from the JWT token in the Authorization header. No need to include it in the request body.

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "alert_ids": ["alert-uuid-1", "alert-uuid-2", "invalid-id"],
  "comment": "Bulk acknowledged - investigating related issues"
}
```

**Field Details:**
- `alert_ids` (array of strings, required): Array of alert IDs to acknowledge (minimum: 1)
- `comment` (string, optional): Comment to apply to all alerts

**Response 200 OK - All Valid:**
```json
{
  "success": true,
  "acknowledged_count": 3,
  "acknowledged_ids": ["alert-uuid-1", "alert-uuid-2", "alert-uuid-3"],
  "not_found_ids": [],
  "total_requested": 3,
  "message": "Successfully acknowledged 3 alert(s)"
}
```

**Response 200 OK - Partial Success:**
```json
{
  "success": true,
  "acknowledged_count": 2,
  "acknowledged_ids": ["alert-uuid-1", "alert-uuid-2"],
  "not_found_ids": ["invalid-id"],
  "total_requested": 3,
  "message": "Successfully acknowledged 2 alert(s). 1 alert(s) not found."
}
```

**Response 200 OK - All Invalid:**
```json
{
  "success": false,
  "acknowledged_count": 0,
  "acknowledged_ids": [],
  "not_found_ids": ["invalid-id-1", "invalid-id-2"],
  "total_requested": 2,
  "message": "No valid alerts found - all IDs were invalid"
}
```

**Response 400 Bad Request:** Empty alert_ids array
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

## 13. COMMUNICATION EVENT MANAGEMENT

### POST /communication-events/:id/resend

**Description:** Resend failed communication event

Manually retry a single failed message (SMS, email, WhatsApp). Useful for individual customer escalations, testing fixes after provider outage, or recovering specific important messages. Event must be in failed or bounced status.

**Authentication:** Bearer JWT + SystemAdmin role

**Authentication Note:** Admin user ID is automatically extracted from the JWT token in the Authorization header. No need to include it in the request body.

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Communication event ID
- Body:

No request body required - admin user ID is automatically extracted from JWT token.

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Message queued for resend",
  "event_id": "event-uuid-1",
  "channel": "sms",
  "status": "pending",
  "queued_at": "2026-02-06T12:25:00.000Z"
}
```

**Response 400 Bad Request:** Event not in failed/bounced status
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Event not found

---

### PATCH /communication-events/:id/status

**Description:** Update communication event status

Manually correct stuck or erroneous message statuses. Use cases: mark message as delivered when webhook was missed, fix status discrepancies, correct erroneous bounces. Includes complete audit trail with reason.

**Authentication:** Bearer JWT + SystemAdmin role

**Authentication Note:** Admin user ID is automatically extracted from the JWT token in the Authorization header. No need to include it in the request body.

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Communication event ID
- Body:
```json
{
  "status": "delivered",
  "reason": "Webhook was missed, manually confirmed delivery with customer"
}
```

**Field Details:**
- `status` (string, required): New status for the communication event. Enum: `pending`, `sent`, `delivered`, `failed`, `bounced`, `opened`, `clicked`
- `reason` (string, required): Reason for manual status change (for audit log)

**Response 200 OK:**
```json
{
  "id": "event-uuid-1",
  "channel": "sms",
  "old_status": "failed",
  "new_status": "delivered",
  "reason": "Webhook was missed, manually confirmed delivery with customer",
  "updated_by": {
    "id": "user-uuid-1",
    "name": "Admin User"
  },
  "updated_at": "2026-02-06T12:30:00.000Z"
}
```

**Response 400 Bad Request:** Invalid status or missing reason
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Event not found

---

### DELETE /communication-events/:id

**Description:** Delete communication event

Permanently delete erroneous or duplicate communication events. Use cases: remove test messages sent to production, clean up duplicates from bugs, remove erroneous events. Safety checks: cannot delete successfully delivered messages or recent messages without force flag. Complete audit trail required.

**Authentication:** Bearer JWT + SystemAdmin role

**Authentication Note:** Admin user ID is automatically extracted from the JWT token in the Authorization header. No need to include it in the request body.

**Request:**
- Headers: `Authorization: Bearer <token>`
- Path Parameters:
  - `id` (string, required): Communication event ID
- Body:
```json
{
  "reason": "Test message sent to production environment",
  "force": false
}
```

**Field Details:**
- `reason` (string, required): Reason for deletion (required for audit log)
- `force` (boolean, optional): Force delete even if message was delivered or recent (bypasses safety checks). Default: false

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Event deleted permanently",
  "event_id": "event-uuid-1",
  "channel": "sms",
  "reason": "Test message sent to production environment",
  "deleted_by": {
    "id": "user-uuid-1",
    "name": "Admin User"
  },
  "deleted_at": "2026-02-06T12:35:00.000Z"
}
```

**Response 400 Bad Request:** Cannot delete delivered message without force flag, or missing reason
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin
**Response 404 Not Found:** Event not found

---

## 14. BULK OPERATIONS

### POST /transcriptions/batch-retry

**Description:** Batch retry failed transcriptions

Queues multiple failed transcriptions for retry using BullMQ. Supports filtering by tenant, provider, and date range. Maximum 1000 transcriptions per batch.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "tenant_id": "tenant-uuid-here",
  "provider_id": "provider-uuid-here",
  "start_date": "2026-01-01T00:00:00.000Z",
  "end_date": "2026-01-31T23:59:59.999Z",
  "limit": 100
}
```

**Field Details:** All fields optional
- `tenant_id` (string): Filter by tenant ID
- `provider_id` (string): Filter by transcription provider ID
- `start_date` (string): Start date for filtering (ISO 8601)
- `end_date` (string): End date for filtering (ISO 8601)
- `limit` (integer): Maximum number of transcriptions to queue (min: 1, max: 1000)

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Transcriptions queued for retry",
  "queued_count": 78,
  "filters_applied": {
    "tenant_id": "tenant-uuid-here",
    "provider_id": "provider-uuid-here",
    "date_range": {
      "start": "2026-01-01T00:00:00.000Z",
      "end": "2026-01-31T23:59:59.999Z"
    }
  },
  "queued_at": "2026-02-06T12:40:00.000Z"
}
```

**Response 400 Bad Request:** Invalid filters or limit exceeds 1000
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### POST /communication-events/batch-resend

**Description:** Batch resend failed communication events

Queues multiple failed communication events (SMS, email, WhatsApp) for retry. Supports filtering by tenant, channel, and date range. Maximum 1000 events per batch.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "tenant_id": "tenant-uuid-here",
  "channel": "sms",
  "start_date": "2026-01-01T00:00:00.000Z",
  "end_date": "2026-01-31T23:59:59.999Z",
  "limit": 100
}
```

**Field Details:** All fields optional
- `tenant_id` (string): Filter by tenant ID
- `channel` (string): Filter by communication channel. Enum: `email`, `sms`, `whatsapp`
- `start_date` (string): Start date for filtering (ISO 8601)
- `end_date` (string): End date for filtering (ISO 8601)
- `limit` (integer): Maximum number of events to queue (min: 1, max: 1000)

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Communication events queued for retry",
  "queued_count": 132,
  "filters_applied": {
    "tenant_id": "tenant-uuid-here",
    "channel": "sms",
    "date_range": {
      "start": "2026-01-01T00:00:00.000Z",
      "end": "2026-01-31T23:59:59.999Z"
    }
  },
  "queued_at": "2026-02-06T12:45:00.000Z"
}
```

**Response 400 Bad Request:** Invalid filters or limit exceeds 1000
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### POST /webhook-events/batch-retry

**Description:** Batch retry failed webhook events

Queues multiple failed webhook events for reprocessing. Supports filtering by tenant, event type, and date range. Maximum 1000 events per batch.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "tenant_id": "tenant-uuid-here",
  "event_type": "sms",
  "start_date": "2026-01-01T00:00:00.000Z",
  "end_date": "2026-01-31T23:59:59.999Z",
  "limit": 100
}
```

**Field Details:** All fields optional
- `tenant_id` (string): Filter by tenant ID
- `event_type` (string): Filter by webhook event type
- `start_date` (string): Start date for filtering (ISO 8601)
- `end_date` (string): End date for filtering (ISO 8601)
- `limit` (integer): Maximum number of webhook events to queue (min: 1, max: 1000)

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Webhook events queued for retry",
  "queued_count": 23,
  "filters_applied": {
    "tenant_id": "tenant-uuid-here",
    "event_type": "sms",
    "date_range": {
      "start": "2026-01-01T00:00:00.000Z",
      "end": "2026-01-31T23:59:59.999Z"
    }
  },
  "queued_at": "2026-02-06T12:50:00.000Z"
}
```

**Response 400 Bad Request:** Invalid filters or limit exceeds 1000
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

### GET /usage/export

**Description:** Export usage data to CSV

Generates a CSV export of Twilio usage data with flexible filtering. Supports filtering by tenant, date range, and usage category. Defaults to last 30 days if no date range provided.

**Authentication:** Bearer JWT + SystemAdmin role

**Request:**
- Headers: `Authorization: Bearer <token>`
- Query Parameters:
  - `tenant_id` (string, optional): Filter by tenant ID (omit for all tenants)
  - `start_date` (string, optional): Start date for export (ISO 8601, defaults to 30 days ago)
  - `end_date` (string, optional): End date for export (ISO 8601, defaults to today)
  - `category` (string, optional): Filter by usage category

**Response 200 OK:**
```json
{
  "success": true,
  "filename": "twilio-usage-export-2026-02-06.csv",
  "content": "tenant_id,tenant_name,category,date,count,duration_minutes,cost\ntenant-uuid-1,Acme Corp,calls-inbound,2026-02-01,125,320.5,32.05\ntenant-uuid-1,Acme Corp,calls-outbound,2026-02-01,89,245.2,24.52\n...",
  "record_count": 1523,
  "date_range": {
    "start": "2026-01-07T00:00:00.000Z",
    "end": "2026-02-06T23:59:59.999Z"
  }
}
```

**Response 400 Bad Request:** Invalid query parameters
**Response 401 Unauthorized:** Missing or invalid token
**Response 403 Forbidden:** User not SystemAdmin

---

## Appendix

### Data Models

#### Call Record
```typescript
{
  id: string;
  tenant_id: string;
  twilio_call_sid: string;
  direction: 'inbound' | 'outbound';
  from_phone: string;
  to_phone: string;
  status: 'initiated' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'no_answer' | 'busy' | 'canceled';
  duration_seconds: number;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  lead_id: string | null;
  created_at: Date;
  completed_at: Date | null;
}
```

#### SMS/WhatsApp Event
```typescript
{
  id: string;
  tenant_id: string;
  channel: 'sms' | 'whatsapp';
  direction: 'inbound' | 'outbound';
  from_phone: string;
  to_phone: string;
  message_body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  twilio_message_sid: string;
  lead_id: string | null;
  sent_at: Date | null;
  delivered_at: Date | null;
  created_at: Date;
}
```

#### Transcription
```typescript
{
  id: string;
  call_id: string;
  tenant_id: string;
  transcription_provider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transcription_text: string | null;
  language_detected: string | null;
  confidence_score: number | null;
  processing_duration_seconds: number | null;
  cost: number | null;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
}
```

### Rate Limits

Admin endpoints have higher rate limits than tenant endpoints:

- **Standard Admin Endpoints**: 1000 requests per minute
- **Bulk Operations**: 100 requests per minute
- **Export Endpoints**: 10 requests per minute

### Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-02-06 | Sprint 11 Complete - Added 28 new endpoints (Webhook Management, Phone Number Operations, Transcription Provider CRUD, Tenant Assistance, Alert Management, Communication Event Management, Bulk Operations) |
| 1.0 | 2026-01-25 | Sprint 8-10 - Initial 40 endpoints (Provider Management, Cross-Tenant Oversight, Usage Tracking, Transcription Monitoring, System Health, Metrics, Cron Management) |

---

**End of Documentation**

*For questions or issues, contact the Lead360 platform team.*
