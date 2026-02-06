# Twilio Admin REST API Documentation

**Version**: 1.0
**Last Updated**: February 6, 2026
**Base URL**: `https://api.lead360.app/api/admin/communication`
**Authentication**: Required (Bearer JWT token)
**Required Role**: SystemAdmin (Platform Administrator)

---

## Overview

This API provides system administrators with comprehensive cross-tenant management and monitoring capabilities for the Twilio communication integration within the Lead360 platform.

### Admin Capabilities

The Twilio Admin API enables platform administrators to:

- **Provider Management**: Register and manage system-level Twilio provider (Model B configuration)
- **Cross-Tenant Oversight**: View all communication activity across all tenants (calls, SMS, WhatsApp)
- **Usage Tracking & Billing**: Track Twilio usage and costs across tenants, sync usage data from Twilio API
- **Transcription Monitoring**: Monitor transcription health, retry failures, view provider statistics
- **System Health**: Run health checks, test connectivity, monitor performance metrics
- **Metrics & Analytics**: View system-wide communication metrics and top tenant analytics
- **Cron Management**: View and reload scheduled job configurations

### Key Features

- **Multi-Tenant Visibility**: Aggregated view of all tenant activity (no tenant isolation for admin)
- **Real-Time Monitoring**: System health checks, performance metrics, and alerting
- **Usage Sync**: Nightly automated usage sync from Twilio API (AC-18 fulfillment)
- **Secure Credential Storage**: All Twilio credentials encrypted at rest
- **Comprehensive Audit Logging**: All admin actions logged for compliance

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
GET /api/admin/communication/health HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Obtaining Admin Token

Admin users authenticate via the standard authentication flow:

1. **Login**: `POST /api/v1/auth/login` with admin credentials
2. **Receive Token**: Response includes JWT token with `SystemAdmin` role
3. **Use Token**: Include token in `Authorization: Bearer {token}` header
4. **Token Expiry**: Tokens expire after configured duration (check system settings)
5. **Refresh**: Use `POST /api/v1/auth/refresh` to obtain new token

### Authentication Errors

#### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**Cause**: Missing or invalid Bearer token

#### 403 Forbidden

```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. SystemAdmin role required.",
  "error": "Forbidden"
}
```

**Cause**: User does not have SystemAdmin role

---

## Error Responses

All endpoints follow consistent error response formats:

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "tenant_id",
      "constraints": {
        "isUuid": "tenant_id must be a valid UUID"
      }
    }
  ]
}
```

**Cause**: Invalid request parameters, query strings, or body

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found"
}
```

**Cause**: Requested resource (tenant, call, transcription) does not exist

### 409 Conflict

```json
{
  "statusCode": 409,
  "message": "Resource already exists",
  "error": "Conflict"
}
```

**Cause**: Attempted to create duplicate resource (e.g., system provider already registered)

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

**Cause**: Unexpected server error (check server logs)

---

## Pagination

Endpoints that return lists support pagination with the following query parameters:

| Parameter | Type    | Required | Default | Description                                  |
|-----------|---------|----------|---------|----------------------------------------------|
| page      | integer | No       | 1       | Page number (1-indexed)                      |
| limit     | integer | No       | 20      | Items per page (max: 100)                    |

### Response Format

All paginated endpoints return responses in this format:

```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

### Pagination Fields

| Field     | Type    | Description                                  |
|-----------|---------|----------------------------------------------|
| total     | integer | Total number of records across all pages     |
| page      | integer | Current page number                          |
| limit     | integer | Number of items per page                     |
| pages     | integer | Total number of pages                        |
| has_next  | boolean | Whether there is a next page                 |
| has_prev  | boolean | Whether there is a previous page             |

---

# Endpoint Reference

## 1. Provider Management (5 endpoints)

System-level Twilio provider configuration for Model B (platform-managed Twilio service).

### 1.1 Register System-Level Twilio Provider

**POST** `/api/admin/communication/twilio/provider`

Registers a system-level Twilio provider for Model B configuration. This allows the platform to use a single master Twilio account to serve multiple tenants.

**Use Case**: System admin sets up the platform's primary Twilio account once. Phone numbers from this account can then be allocated to individual tenants without each tenant needing their own Twilio account.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body** (Content-Type: `application/json`):

```json
{
  "account_sid": "AC1234567890abcdef1234567890abcd",
  "auth_token": "your_auth_token_here"
}
```

**Request Body Fields**:

| Field       | Type   | Required | Validation                          | Description                                      | Example                                  |
|-------------|--------|----------|-------------------------------------|--------------------------------------------------|------------------------------------------|
| account_sid | string | Yes      | Pattern: `^AC[a-z0-9]{32}$`         | Twilio Account SID from master Twilio account   | `"AC1234567890abcdef1234567890abcd"`     |
| auth_token  | string | Yes      | Non-empty string                    | Twilio Auth Token for authentication            | `"your_auth_token_here"`                 |

#### Response

**Success Response (201 Created)**:

```json
{
  "provider_key": "twilio_system",
  "provider_name": "Twilio System Provider",
  "provider_type": "sms",
  "is_active": true,
  "created_at": "2026-02-06T10:30:00.000Z",
  "updated_at": "2026-02-06T10:30:00.000Z"
}
```

**Response Fields**:

| Field         | Type              | Nullable | Description                                            |
|---------------|-------------------|----------|--------------------------------------------------------|
| provider_key  | string            | No       | Unique provider identifier (always "twilio_system")    |
| provider_name | string            | No       | Provider display name                                  |
| provider_type | string            | No       | Provider type (always "sms" for Twilio)                |
| is_active     | boolean           | No       | Whether provider is active                             |
| created_at    | string (ISO 8601) | No       | Provider registration timestamp                        |
| updated_at    | string (ISO 8601) | No       | Last update timestamp                                  |

**Error Responses**:

**400 Bad Request - Invalid Account SID**:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "account_sid",
      "constraints": {
        "matches": "account_sid must be a valid Twilio Account SID (starts with AC, followed by 32 alphanumeric characters)"
      }
    }
  ]
}
```

**400 Bad Request - Invalid Credentials**:
```json
{
  "statusCode": 400,
  "message": "Invalid Twilio credentials - could not authenticate with Twilio API",
  "error": "Bad Request"
}
```

**409 Conflict - Provider Already Exists**:
```json
{
  "statusCode": 409,
  "message": "System provider already registered. Use PATCH to update.",
  "error": "Conflict"
}
```

#### Examples

**cURL**:
```bash
curl -X POST "https://api.lead360.app/api/admin/communication/twilio/provider" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "account_sid": "AC1234567890abcdef1234567890abcd",
    "auth_token": "your_auth_token_here"
  }'
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/twilio/provider', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    account_sid: 'AC1234567890abcdef1234567890abcd',
    auth_token: 'your_auth_token_here',
  }),
});

const data = await response.json();
console.log('Provider registered:', data);
```

#### Notes

- **Security**: Auth token is encrypted before storage and never returned in subsequent GET requests
- **Singleton**: Only one system provider can exist. To change credentials, use PATCH endpoint
- **Validation**: Credentials are validated by making a test API call to Twilio during registration
- **Model B Only**: This endpoint is for system-managed configuration. Tenants using Model A configure their own Twilio accounts via tenant endpoints
- **Audit Logging**: Provider registration is logged to audit trail with admin user ID

---

### 1.2 Get System Provider Status

**GET** `/api/admin/communication/twilio/provider`

Returns current system provider configuration (without sensitive credentials). Shows whether system provider is configured and active.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "provider_key": "twilio_system",
  "provider_name": "Twilio System Provider",
  "provider_type": "sms",
  "is_active": true,
  "created_at": "2026-02-06T10:30:00.000Z",
  "updated_at": "2026-02-06T10:30:00.000Z"
}
```

**Response Fields**: Same as registration endpoint (see 1.1)

**Error Responses**:

**404 Not Found - Provider Not Configured**:
```json
{
  "statusCode": 404,
  "message": "System provider not configured",
  "error": "Not Found"
}
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/twilio/provider" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/twilio/provider', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const provider = await response.json();
console.log('System provider status:', provider);
```

#### Notes

- **Credentials Excluded**: Sensitive credentials (account_sid, auth_token) are NOT included in response for security
- **Quick Status Check**: Use this endpoint to verify system provider is configured before performing other admin operations
- **Read-Only**: This endpoint does not modify any data

---

### 1.3 Update System Provider Configuration

**PATCH** `/api/admin/communication/twilio/provider`

Updates master Twilio account credentials. Use with caution - affects all Model B tenants.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body** (Content-Type: `application/json`):

```json
{
  "account_sid": "AC9876543210fedcba9876543210fedc",
  "auth_token": "new_auth_token_here"
}
```

**Request Body Fields**: Same as registration (see 1.1)

#### Response

**Success Response (200 OK)**:

```json
{
  "message": "System provider updated successfully"
}
```

**Error Responses**: Same as registration endpoint (400, 404, 500)

#### Examples

**cURL**:
```bash
curl -X PATCH "https://api.lead360.app/api/admin/communication/twilio/provider" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "account_sid": "AC9876543210fedcba9876543210fedc",
    "auth_token": "new_auth_token_here"
  }'
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/twilio/provider', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    account_sid: 'AC9876543210fedcba9876543210fedc',
    auth_token: 'new_auth_token_here',
  }),
});

const result = await response.json();
console.log(result.message);
```

#### Notes

- **High Impact**: Changing system provider credentials affects ALL tenants using Model B
- **Validation**: New credentials are validated before update
- **Rollback**: Keep old credentials handy in case rollback is needed
- **Audit Logging**: Credential updates are audit logged
- **Downtime**: Brief service interruption possible during credential rotation

---

### 1.4 Test System Provider Connectivity

**POST** `/api/admin/communication/twilio/provider/test`

Validates system Twilio credentials by making test API call. Returns connection status and response time.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "status": "HEALTHY",
  "response_time_ms": 245,
  "message": "System provider connectivity test successful",
  "account_sid": "AC1234567890abcdef1234567890abcd",
  "tested_at": "2026-02-06T14:22:15.000Z"
}
```

**Response Fields**:

| Field            | Type              | Nullable | Description                              |
|------------------|-------------------|----------|------------------------------------------|
| status           | string            | No       | Health status: HEALTHY, DEGRADED, DOWN   |
| response_time_ms | integer           | No       | API response time in milliseconds        |
| message          | string            | No       | Human-readable test result               |
| account_sid      | string            | No       | Account SID tested (for verification)    |
| tested_at        | string (ISO 8601) | No       | Timestamp of test                        |

**Error Responses**:

**404 Not Found - Provider Not Configured**:
```json
{
  "statusCode": 404,
  "message": "System provider not configured",
  "error": "Not Found"
}
```

**500 Internal Server Error - Test Failed**:
```json
{
  "status": "DOWN",
  "response_time_ms": null,
  "message": "System provider connectivity test failed",
  "error_message": "Invalid credentials or Twilio API unreachable",
  "tested_at": "2026-02-06T14:22:15.000Z"
}
```

#### Examples

**cURL**:
```bash
curl -X POST "https://api.lead360.app/api/admin/communication/twilio/provider/test" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/twilio/provider/test', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const testResult = await response.json();
console.log(`Connectivity: ${testResult.status} (${testResult.response_time_ms}ms)`);
```

#### Notes

- **Non-Destructive**: Test does not send actual SMS or make calls
- **Performance Baseline**: Use response_time_ms for performance monitoring
- **Troubleshooting**: Run this test if experiencing Twilio API issues
- **Rate Limit**: Test can be run frequently (no rate limiting)

---

### 1.5 Get Available Phone Numbers

**GET** `/api/admin/communication/twilio/available-numbers`

Fetches available phone numbers from master Twilio account. Used for allocating numbers to tenants (Model B).

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**:

| Parameter | Type    | Required | Default | Description                                 |
|-----------|---------|----------|---------|---------------------------------------------|
| area_code | string  | No       | None    | Filter by area code (e.g., "415")           |
| limit     | integer | No       | 20      | Maximum number of results (max: 50)         |

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "available_numbers": [
    {
      "phone_number": "+14155551234",
      "friendly_name": "(415) 555-1234",
      "capabilities": {
        "voice": true,
        "SMS": true,
        "MMS": true
      },
      "address_requirements": "none",
      "beta": false,
      "iso_country": "US",
      "region": "CA",
      "locality": "San Francisco"
    }
  ],
  "count": 20
}
```

**Response Fields**:

| Field                | Type    | Nullable | Description                                    |
|----------------------|---------|----------|------------------------------------------------|
| phone_number         | string  | No       | Phone number in E.164 format                   |
| friendly_name        | string  | No       | Human-readable phone number                    |
| capabilities         | object  | No       | Supported features (voice, SMS, MMS)           |
| address_requirements | string  | No       | Address verification required ("none", "any")  |
| beta                 | boolean | No       | Whether number is in beta                      |
| iso_country          | string  | No       | ISO country code                               |
| region               | string  | Yes      | State/province code                            |
| locality             | string  | Yes      | City name                                      |

**Error Responses**:

**404 Not Found - Provider Not Configured**:
```json
{
  "statusCode": 404,
  "message": "System provider not configured",
  "error": "Not Found"
}
```

#### Examples

**cURL (with area code filter)**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/twilio/available-numbers?area_code=415&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/twilio/available-numbers?area_code=415&limit=10', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const { available_numbers, count } = await response.json();
console.log(`Found ${count} available numbers`);
```

#### Notes

- **Real-Time Data**: Numbers fetched live from Twilio API
- **Availability Not Guaranteed**: Numbers may be purchased by others between query and allocation
- **Filtering**: Use area_code to find numbers in specific regions
- **Allocation**: Use tenant SMS/WhatsApp configuration endpoints to allocate numbers

---

## 2. Cross-Tenant Oversight (6 endpoints)

View all communication activity across the platform (AC-16: "System Admin can view all tenant activity").

### 2.1 Get All Calls Across All Tenants

**GET** `/api/admin/communication/calls`

Returns paginated list of all voice calls across the platform. Supports filtering by tenant, status, direction, and date range.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**:

| Parameter  | Type              | Required | Default | Description                                          |
|------------|-------------------|----------|---------|------------------------------------------------------|
| tenant_id  | string (UUID)     | No       | None    | Filter by specific tenant ID                         |
| status     | string (enum)     | No       | None    | Filter by call status (see enum values below)        |
| direction  | string (enum)     | No       | None    | Filter by direction: "inbound" or "outbound"         |
| start_date | string (ISO 8601) | No       | None    | Filter calls created after this date                 |
| end_date   | string (ISO 8601) | No       | None    | Filter calls created before this date                |
| page       | integer           | No       | 1       | Page number (1-indexed)                              |
| limit      | integer           | No       | 20      | Results per page (max: 100)                          |

**Status Enum Values**: `initiated`, `ringing`, `in_progress`, `completed`, `failed`, `no_answer`, `busy`, `canceled`

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "data": [
    {
      "id": "call-uuid-123",
      "tenant_id": "tenant-uuid-456",
      "tenant": {
        "id": "tenant-uuid-456",
        "company_name": "Acme Roofing",
        "subdomain": "acme"
      },
      "lead_id": "lead-uuid-789",
      "lead": {
        "id": "lead-uuid-789",
        "first_name": "John",
        "last_name": "Doe",
        "phones": [
          {
            "phone_number": "+14155551234",
            "is_primary": true
          }
        ]
      },
      "twilio_call_sid": "CA1234567890abcdef1234567890abcd",
      "direction": "inbound",
      "from_number": "+14155551234",
      "to_number": "+14155559999",
      "status": "completed",
      "call_type": "customer_call",
      "initiated_by": null,
      "initiated_by_user": null,
      "recording_url": "https://api.twilio.com/recording/RE123",
      "recording_duration_seconds": 120,
      "recording_status": "transcribed",
      "transcription": {
        "id": "trans-uuid-111",
        "status": "completed",
        "transcription_provider": "openai_whisper"
      },
      "cost": "0.0250",
      "started_at": "2026-02-06T10:00:00.000Z",
      "ended_at": "2026-02-06T10:02:00.000Z",
      "created_at": "2026-02-06T10:00:00.000Z",
      "updated_at": "2026-02-06T10:02:30.000Z"
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

**Call Record Fields**:

| Field                      | Type              | Nullable | Description                                      |
|----------------------------|-------------------|----------|--------------------------------------------------|
| id                         | string (UUID)     | No       | Unique call record ID                            |
| tenant_id                  | string (UUID)     | Yes      | Tenant who owns this call                        |
| tenant                     | object            | Yes      | Tenant info (id, company_name, subdomain)        |
| lead_id                    | string (UUID)     | Yes      | Associated lead ID                               |
| lead                       | object            | Yes      | Lead info with primary phone                     |
| twilio_call_sid            | string            | No       | Twilio Call SID (unique identifier)              |
| direction                  | string            | No       | Call direction: "inbound" or "outbound"          |
| from_number                | string (E.164)    | No       | Caller phone number                              |
| to_number                  | string (E.164)    | No       | Recipient phone number                           |
| status                     | string            | No       | Call status (see enum above)                     |
| call_type                  | string            | No       | Type: customer_call, office_bypass_call, etc.    |
| initiated_by               | string (UUID)     | Yes      | User ID if outbound call                         |
| initiated_by_user          | object            | Yes      | User who initiated call (if outbound)            |
| recording_url              | string (URL)      | Yes      | Twilio recording URL                             |
| recording_duration_seconds | integer           | Yes      | Recording length in seconds                      |
| recording_status           | string            | No       | Status: pending, available, transcribed, failed  |
| transcription              | object            | Yes      | Transcription info if available                  |
| cost                       | string (decimal)  | Yes      | Call cost in USD                                 |
| started_at                 | string (ISO 8601) | Yes      | Call start time                                  |
| ended_at                   | string (ISO 8601) | Yes      | Call end time                                    |
| created_at                 | string (ISO 8601) | No       | Record creation time                             |
| updated_at                 | string (ISO 8601) | No       | Record last update time                          |

#### Examples

**cURL (all calls)**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/calls?page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**cURL (filtered by tenant and status)**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/calls?tenant_id=tenant-uuid-456&status=failed&page=1&limit=50" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch with date range)**:
```javascript
const params = new URLSearchParams({
  start_date: '2026-02-01T00:00:00.000Z',
  end_date: '2026-02-06T23:59:59.999Z',
  status: 'completed',
  page: '1',
  limit: '50'
});

const response = await fetch(`https://api.lead360.app/api/admin/communication/calls?${params}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const { data, pagination } = await response.json();
console.log(`Showing ${data.length} of ${pagination.total} calls`);
```

#### Notes

- **Cross-Tenant View**: Returns calls from ALL tenants (no tenant isolation)
- **Performance**: Large result sets may be slow - use date filters to improve performance
- **Tenant Info**: Each call includes nested tenant info for easy identification
- **Lead Matching**: Lead info included if call has been matched to a lead
- **Recording Access**: recording_url points to Twilio's servers (may require authentication)

---

### 2.2 Get All SMS Across All Tenants

**GET** `/api/admin/communication/sms`

Returns paginated list of all SMS messages across the platform. Includes message content, delivery status, and tenant information.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**:

| Parameter  | Type              | Required | Default | Description                                          |
|------------|-------------------|----------|---------|------------------------------------------------------|
| tenant_id  | string (UUID)     | No       | None    | Filter by specific tenant ID                         |
| status     | string (enum)     | No       | None    | Filter by message status (see enum below)            |
| direction  | string (enum)     | No       | None    | Filter by direction: "inbound" or "outbound"         |
| start_date | string (ISO 8601) | No       | None    | Filter messages created after this date              |
| end_date   | string (ISO 8601) | No       | None    | Filter messages created before this date             |
| page       | integer           | No       | 1       | Page number (1-indexed)                              |
| limit      | integer           | No       | 20      | Results per page (max: 100)                          |

**Status Enum Values**: `pending`, `sent`, `delivered`, `failed`, `bounced`

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "data": [
    {
      "id": "event-uuid-123",
      "tenant_id": "tenant-uuid-456",
      "tenant": {
        "id": "tenant-uuid-456",
        "company_name": "Acme Roofing",
        "subdomain": "acme"
      },
      "channel": "sms",
      "direction": "outbound",
      "provider_id": "provider-uuid-789",
      "provider": {
        "id": "provider-uuid-789",
        "provider_name": "Twilio",
        "provider_type": "sms"
      },
      "status": "delivered",
      "to_phone": "+14155551234",
      "from_phone": "+14155559999",
      "text_body": "Your appointment is scheduled for tomorrow at 10am.",
      "provider_message_id": "SM1234567890abcdef1234567890abcd",
      "sent_at": "2026-02-06T09:00:00.000Z",
      "delivered_at": "2026-02-06T09:00:02.000Z",
      "created_at": "2026-02-06T09:00:00.000Z",
      "created_by_user": {
        "id": "user-uuid-111",
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane@acmeroofing.com"
      }
    }
  ],
  "pagination": {
    "total": 8432,
    "page": 1,
    "limit": 20,
    "pages": 422,
    "has_next": true,
    "has_prev": false
  }
}
```

**SMS Message Fields**:

| Field               | Type              | Nullable | Description                                        |
|---------------------|-------------------|----------|----------------------------------------------------|
| id                  | string (UUID)     | No       | Unique message ID                                  |
| tenant_id           | string (UUID)     | Yes      | Tenant who owns this message                       |
| tenant              | object            | Yes      | Tenant info (id, company_name, subdomain)          |
| channel             | string            | No       | Communication channel (always "sms" for this API)  |
| direction           | string            | No       | Message direction: "inbound" or "outbound"         |
| provider_id         | string (UUID)     | No       | Communication provider ID                          |
| provider            | object            | No       | Provider info                                      |
| status              | string            | No       | Delivery status (see enum above)                   |
| to_phone            | string (E.164)    | Yes      | Recipient phone number                             |
| from_phone          | string (E.164)    | Yes      | Sender phone number (derived from provider)        |
| text_body           | string            | Yes      | Message content (plain text)                       |
| provider_message_id | string            | Yes      | Provider's message ID (e.g., Twilio SID)           |
| sent_at             | string (ISO 8601) | Yes      | Message sent timestamp                             |
| delivered_at        | string (ISO 8601) | Yes      | Message delivered timestamp                        |
| created_at          | string (ISO 8601) | No       | Record creation time                               |
| created_by_user     | object            | Yes      | User who sent the message (if outbound)            |

#### Examples

**cURL (all SMS)**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/sms?page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch - failed messages only)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/sms?status=failed&page=1&limit=100', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const { data, pagination } = await response.json();
console.log(`Found ${pagination.total} failed SMS messages`);
```

#### Notes

- **Message Content**: text_body contains full message content for troubleshooting
- **Direction**: "inbound" SMS are messages received by the platform, "outbound" are sent by users
- **Provider Info**: Each message includes provider details for multi-provider setups

---

### 2.3 Get All WhatsApp Messages Across All Tenants

**GET** `/api/admin/communication/whatsapp`

Returns paginated list of all WhatsApp messages across the platform.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: Same as SMS endpoint (see 2.2)

**Request Body**: None

#### Response

**Success Response (200 OK)**: Same format as SMS endpoint, with `channel: "whatsapp"`

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/whatsapp?page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/whatsapp?tenant_id=tenant-uuid-456', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const { data, pagination } = await response.json();
```

#### Notes

- **WhatsApp-Specific**: Returns only WhatsApp messages (channel filter applied automatically)
- **Same Structure**: Response format identical to SMS endpoint
- **Phone Format**: WhatsApp phone numbers may include "whatsapp:" prefix

---

### 2.4 Get All Tenant Configurations

**GET** `/api/admin/communication/tenant-configs`

Returns comprehensive view of all active tenant communication configurations. Excludes sensitive credentials for security.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "sms_configs": [
    {
      "id": "config-uuid-123",
      "tenant_id": "tenant-uuid-456",
      "tenant": {
        "id": "tenant-uuid-456",
        "company_name": "Acme Roofing",
        "subdomain": "acme"
      },
      "provider_id": "provider-uuid-789",
      "from_phone": "+14155559999",
      "is_active": true,
      "is_verified": true,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    }
  ],
  "whatsapp_configs": [
    {
      "id": "config-uuid-456",
      "tenant_id": "tenant-uuid-789",
      "tenant": {
        "id": "tenant-uuid-789",
        "company_name": "Beta Construction",
        "subdomain": "beta"
      },
      "provider_id": "provider-uuid-789",
      "from_phone": "whatsapp:+14155558888",
      "is_active": true,
      "is_verified": true,
      "created_at": "2026-01-20T11:00:00.000Z",
      "updated_at": "2026-01-20T11:00:00.000Z"
    }
  ],
  "ivr_configs": [
    {
      "id": "ivr-uuid-111",
      "tenant_id": "tenant-uuid-456",
      "tenant": {
        "id": "tenant-uuid-456",
        "company_name": "Acme Roofing",
        "subdomain": "acme"
      },
      "ivr_enabled": true,
      "greeting_message": "Thank you for calling Acme Roofing. Press 1 for sales...",
      "status": "active",
      "created_at": "2026-01-15T12:00:00.000Z",
      "updated_at": "2026-02-01T09:00:00.000Z"
    }
  ]
}
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/tenant-configs" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/tenant-configs', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const { sms_configs, whatsapp_configs, ivr_configs } = await response.json();
console.log(`Total configs: ${sms_configs.length} SMS, ${whatsapp_configs.length} WhatsApp, ${ivr_configs.length} IVR`);
```

#### Notes

- **Security**: Credentials are excluded from response (encrypted fields not returned)
- **All Active Configs**: Returns only active configurations
- **Tenant Context**: Each config includes tenant info for easy identification
- **Use Cases**: Tenant provisioning audit, configuration verification, troubleshooting

---

### 2.5 Get Specific Tenant's Communication Configurations

**GET** `/api/admin/communication/tenants/:id/configs`

Returns all communication configurations for a specific tenant. Includes SMS, WhatsApp, and IVR settings.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**:

| Parameter | Type         | Required | Description       |
|-----------|--------------|----------|-------------------|
| id        | string (UUID) | Yes      | Tenant UUID       |

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**: Same format as "Get All Tenant Configurations" but filtered by tenant

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/tenants/tenant-uuid-456/configs" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const tenantId = 'tenant-uuid-456';
const response = await fetch(`https://api.lead360.app/api/admin/communication/tenants/${tenantId}/configs`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const configs = await response.json();
```

#### Notes

- **Tenant-Specific**: Returns only configurations for the specified tenant
- **Empty Arrays**: Returns empty arrays if tenant has no configurations

---

### 2.6 Get Tenant Communication Metrics

**GET** `/api/admin/communication/tenants/:id/metrics`

Returns comprehensive metrics for a specific tenant: call counts, SMS counts, average call duration, transcription stats, etc.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**:

| Parameter | Type         | Required | Description       |
|-----------|--------------|----------|-------------------|
| id        | string (UUID) | Yes      | Tenant UUID       |

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "tenant_id": "tenant-uuid-456",
  "tenant_name": "Acme Roofing",
  "metrics": {
    "calls": {
      "total": 1250,
      "inbound": 850,
      "outbound": 400,
      "completed": 1100,
      "failed": 50,
      "no_answer": 100,
      "avg_duration_seconds": 180,
      "total_duration_minutes": 3750
    },
    "sms": {
      "total": 3500,
      "inbound": 1200,
      "outbound": 2300,
      "delivered": 3400,
      "failed": 100
    },
    "whatsapp": {
      "total": 850,
      "inbound": 300,
      "outbound": 550,
      "delivered": 820,
      "failed": 30
    },
    "transcriptions": {
      "total": 950,
      "completed": 920,
      "failed": 30,
      "success_rate": "96.84%"
    }
  },
  "generated_at": "2026-02-06T15:00:00.000Z"
}
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/tenants/tenant-uuid-456/metrics" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const tenantId = 'tenant-uuid-456';
const response = await fetch(`https://api.lead360.app/api/admin/communication/tenants/${tenantId}/metrics`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const metrics = await response.json();
console.log(`Tenant ${metrics.tenant_name}: ${metrics.metrics.calls.total} calls, ${metrics.metrics.sms.total} SMS`);
```

#### Notes

- **Real-Time**: Metrics computed in real-time from database
- **Comprehensive**: Includes all communication channels
- **Performance**: May be slow for high-volume tenants (consider caching)

---

## 3. Usage Tracking & Billing (7 endpoints)

Track Twilio usage and costs across tenants. Fulfills AC-18: "Usage tracking pulls data from Twilio API and syncs nightly".

### 3.1 Trigger Immediate Usage Sync for All Tenants

**POST** `/api/admin/communication/usage/sync`

Manually triggers usage sync from Twilio API for all active tenants. Typically runs automatically nightly at 2:00 AM. Use this for immediate cost updates or troubleshooting.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "message": "Usage sync initiated for all tenants"
}
```

#### Examples

**cURL**:
```bash
curl -X POST "https://api.lead360.app/api/admin/communication/usage/sync" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/usage/sync', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const result = await response.json();
console.log(result.message);
```

#### Notes

- **Asynchronous**: Sync runs in background (does not block response)
- **All Tenants**: Syncs usage for ALL active tenants
- **Duration**: May take several minutes for large tenant base
- **Rate Limits**: Twilio API rate limits apply
- **Cron Schedule**: Normally runs automatically at 2:00 AM daily (configurable via system settings)

---

### 3.2 Sync Usage for Specific Tenant

**POST** `/api/admin/communication/usage/sync/:tenantId`

Syncs usage data from Twilio API for a specific tenant. Fetches data for the last 30 days by default.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**:

| Parameter | Type         | Required | Description       |
|-----------|--------------|----------|-------------------|
| tenantId  | string (UUID) | Yes      | Tenant UUID       |

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "message": "Usage synced for tenant tenant-uuid-456"
}
```

#### Examples

**cURL**:
```bash
curl -X POST "https://api.lead360.app/api/admin/communication/usage/sync/tenant-uuid-456" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const tenantId = 'tenant-uuid-456';
const response = await fetch(`https://api.lead360.app/api/admin/communication/usage/sync/${tenantId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const result = await response.json();
```

#### Notes

- **Tenant-Specific**: Only syncs usage for specified tenant
- **Date Range**: Defaults to last 30 days
- **Faster**: Completes faster than full platform sync
- **Troubleshooting**: Use for investigating specific tenant usage issues

---

### 3.3 Get Usage Summary for All Tenants

**GET** `/api/admin/communication/usage/tenants`

Returns aggregated usage statistics across all tenants. Useful for platform-wide billing and capacity planning.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**:

| Parameter  | Type              | Required | Default                      | Description                    |
|------------|-------------------|----------|------------------------------|--------------------------------|
| start_date | string (ISO 8601) | No       | First day of current month   | Usage period start date        |
| end_date   | string (ISO 8601) | No       | Current date                 | Usage period end date          |

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "period": {
    "start_date": "2026-02-01T00:00:00.000Z",
    "end_date": "2026-02-06T23:59:59.999Z"
  },
  "platform_totals": {
    "total_tenants": 45,
    "calls": {
      "count": 15230,
      "minutes": 45690,
      "cost": "1827.60"
    },
    "sms": {
      "count": 32500,
      "cost": "2437.50"
    },
    "recordings": {
      "count": 12100,
      "storage_mb": 3025,
      "cost": "121.00"
    },
    "transcriptions": {
      "count": 9800,
      "cost": "980.00"
    }
  },
  "total_cost": "5366.10"
}
```

#### Examples

**cURL (current month)**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/usage/tenants" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**cURL (specific date range)**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/usage/tenants?start_date=2026-01-01T00:00:00.000Z&end_date=2026-01-31T23:59:59.999Z" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const params = new URLSearchParams({
  start_date: '2026-02-01T00:00:00.000Z',
  end_date: '2026-02-06T23:59:59.999Z'
});

const response = await fetch(`https://api.lead360.app/api/admin/communication/usage/tenants?${params}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const usage = await response.json();
console.log(`Total platform cost: $${usage.total_cost}`);
```

#### Notes

- **Aggregated**: Sums usage across ALL tenants
- **Cost Tracking**: All costs in USD
- **Capacity Planning**: Use for forecasting infrastructure needs

---

### 3.4 Get Detailed Usage for Specific Tenant

**GET** `/api/admin/communication/usage/tenants/:id`

Returns detailed usage breakdown by category for a specific tenant. Includes call, SMS, recording, and transcription usage.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**:

| Parameter | Type         | Required | Description       |
|-----------|--------------|----------|-------------------|
| id        | string (UUID) | Yes      | Tenant UUID       |

**Query Parameters**:

| Parameter | Type   | Required | Default            | Description                            |
|-----------|--------|----------|--------------------|----------------------------------------|
| month     | string | No       | Current month      | Month in YYYY-MM format (e.g., 2026-02) |

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "tenant_id": "tenant-uuid-456",
  "tenant_name": "Acme Roofing",
  "month": "2026-02",
  "usage_breakdown": {
    "calls": {
      "count": 850,
      "minutes": 2550,
      "cost": "102.00"
    },
    "sms": {
      "count": 1200,
      "cost": "90.00"
    },
    "recordings": {
      "count": 720,
      "storage_mb": 180,
      "cost": "7.20"
    },
    "transcriptions": {
      "count": 650,
      "cost": "65.00"
    }
  },
  "total_cost": "264.20",
  "synced_at": "2026-02-06T02:00:15.000Z"
}
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/usage/tenants/tenant-uuid-456?month=2026-02" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const tenantId = 'tenant-uuid-456';
const month = '2026-02';
const response = await fetch(`https://api.lead360.app/api/admin/communication/usage/tenants/${tenantId}?month=${month}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const usage = await response.json();
console.log(`${usage.tenant_name} usage for ${usage.month}: $${usage.total_cost}`);
```

#### Notes

- **Month Filter**: Defaults to current month if not specified
- **Detailed Breakdown**: Category-level usage and cost details
- **Billing**: Use this data for tenant billing and invoicing

---

### 3.5 Get System-Wide Usage Aggregation

**GET** `/api/admin/communication/usage/system`

Returns platform-level usage statistics across all tenants. Aggregates all usage categories for specified date range.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: Same as "Get Usage Summary for All Tenants" (see 3.3)

**Request Body**: None

#### Response

**Success Response (200 OK)**: Same format as endpoint 3.3

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/usage/system?start_date=2026-02-01T00:00:00.000Z" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Notes

- **Duplicate of 3.3**: This endpoint returns the same data as "Get Usage Summary for All Tenants"
- **Legacy Compatibility**: Kept for backward compatibility with frontend code

---

### 3.6 Export Usage Report (Future Enhancement)

**GET** `/api/admin/communication/usage/export`

Exports usage data as CSV file for offline analysis. **FUTURE ENHANCEMENT**: This endpoint is reserved for CSV export functionality.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: Same as "Get Usage Summary for All Tenants" (see 3.3)

**Request Body**: None

#### Response

**Current Response (200 OK)**:

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

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/usage/export" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Notes

- **Not Implemented**: CSV export functionality not yet available
- **Workaround**: Use alternative endpoints and export JSON client-side
- **Future Sprint**: Will be implemented in future enhancement sprint

---

### 3.7 Get Estimated Costs for Tenant

**GET** `/api/admin/communication/costs/tenants/:id`

Returns month-to-date cost estimation with category breakdown. Used for budget alerts and billing previews.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**:

| Parameter | Type         | Required | Description       |
|-----------|--------------|----------|-------------------|
| id        | string (UUID) | Yes      | Tenant UUID       |

**Query Parameters**:

| Parameter | Type   | Required | Default        | Description                            |
|-----------|--------|----------|----------------|----------------------------------------|
| month     | string | Yes      | N/A            | Month in YYYY-MM format (e.g., 2026-02) |

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "tenant_id": "tenant-uuid-456",
  "tenant_name": "Acme Roofing",
  "month": "2026-02",
  "cost_estimate": {
    "calls": "102.00",
    "sms": "90.00",
    "recordings": "7.20",
    "transcriptions": "65.00",
    "total": "264.20"
  },
  "estimated_at": "2026-02-06T15:00:00.000Z"
}
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/costs/tenants/tenant-uuid-456?month=2026-02" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const tenantId = 'tenant-uuid-456';
const month = '2026-02';
const response = await fetch(`https://api.lead360.app/api/admin/communication/costs/tenants/${tenantId}?month=${month}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const costs = await response.json();
console.log(`Estimated cost: $${costs.cost_estimate.total}`);
```

#### Notes

- **Estimation**: Costs are estimates based on synced usage data
- **Budget Alerts**: Use for proactive budget monitoring
- **Required Month**: Month parameter is required (not optional)

---

## 4. Transcription Monitoring (4 endpoints)

Monitor transcription health, retry failures, view provider statistics.

### 4.1 Get All Failed Transcriptions

**GET** `/api/admin/communication/transcriptions/failed`

Returns list of all failed transcriptions for troubleshooting. Includes error messages and call details. Limited to most recent 100 failures.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "failed_transcriptions": [
    {
      "id": "trans-uuid-123",
      "tenant_id": "tenant-uuid-456",
      "call_record_id": "call-uuid-789",
      "transcription_provider": "openai_whisper",
      "status": "failed",
      "error_message": "Audio file too short (minimum 0.1 seconds required)",
      "created_at": "2026-02-06T10:00:00.000Z",
      "call_details": {
        "twilio_call_sid": "CA1234567890abcdef",
        "recording_url": "https://api.twilio.com/recording/RE123",
        "recording_duration_seconds": 2
      }
    }
  ],
  "count": 15
}
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/transcriptions/failed" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/transcriptions/failed', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const { failed_transcriptions, count } = await response.json();
console.log(`Found ${count} failed transcriptions`);
```

#### Notes

- **Recent Failures**: Limited to 100 most recent failures
- **Error Context**: Includes error messages for troubleshooting
- **Retry Option**: Use transcription retry endpoint to reprocess failures

---

### 4.2 Get Transcription Details

**GET** `/api/admin/communication/transcriptions/:id`

Returns full details for a specific transcription, including status, provider, and error info.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**:

| Parameter | Type         | Required | Description         |
|-----------|--------------|----------|---------------------|
| id        | string (UUID) | Yes      | Transcription UUID  |

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "id": "trans-uuid-123",
  "tenant": {
    "id": "tenant-uuid-456",
    "company_name": "Acme Roofing",
    "subdomain": "acme"
  },
  "call": {
    "id": "call-uuid-789",
    "twilio_call_sid": "CA1234567890abcdef",
    "direction": "inbound",
    "status": "completed",
    "recording_url": "https://api.twilio.com/recording/RE123",
    "duration_seconds": 120
  },
  "lead": {
    "id": "lead-uuid-111",
    "first_name": "John",
    "last_name": "Doe"
  },
  "transcription_provider": "openai_whisper",
  "status": "completed",
  "transcription_text": "Thank you for calling Acme Roofing. How can I help you today?",
  "language_detected": "en",
  "confidence_score": "0.98",
  "processing_duration_seconds": 8,
  "cost": "0.12",
  "error_message": null,
  "created_at": "2026-02-06T10:00:00.000Z",
  "completed_at": "2026-02-06T10:00:08.000Z"
}
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/transcriptions/trans-uuid-123" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const transcriptionId = 'trans-uuid-123';
const response = await fetch(`https://api.lead360.app/api/admin/communication/transcriptions/${transcriptionId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const transcription = await response.json();
console.log(`Transcription status: ${transcription.status}`);
```

#### Notes

- **Full Context**: Includes call, tenant, and lead details
- **Transcription Text**: Full transcription content returned
- **Performance Metrics**: Includes processing duration and cost

---

### 4.3 Retry Failed Transcription

**POST** `/api/admin/communication/transcriptions/:id/retry`

Requeues a failed transcription for processing. Resets status to PENDING and queues job.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**:

| Parameter | Type         | Required | Description         |
|-----------|--------------|----------|---------------------|
| id        | string (UUID) | Yes      | Transcription UUID  |

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "message": "Transcription retry queued"
}
```

#### Examples

**cURL**:
```bash
curl -X POST "https://api.lead360.app/api/admin/communication/transcriptions/trans-uuid-123/retry" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const transcriptionId = 'trans-uuid-123';
const response = await fetch(`https://api.lead360.app/api/admin/communication/transcriptions/${transcriptionId}/retry`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const result = await response.json();
console.log(result.message);
```

#### Notes

- **Automatic Reprocessing**: Transcription will be reprocessed automatically
- **Status Reset**: Transcription status changes from "failed" to "queued"
- **Error Clearing**: Previous error message is cleared

---

### 4.4 List Transcription Providers with Usage Stats

**GET** `/api/admin/communication/transcription-providers`

Returns list of configured transcription providers with usage and cost statistics.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
[
  {
    "id": "provider-uuid-123",
    "provider_name": "openai_whisper",
    "tenant": {
      "id": "tenant-uuid-456",
      "company_name": "Acme Roofing",
      "subdomain": "acme"
    },
    "is_system_default": true,
    "status": "active",
    "usage_limit": 10000,
    "usage_current": 3250,
    "cost_per_minute": "0.006",
    "statistics": {
      "total_transcriptions": 3250,
      "successful": 3180,
      "failed": 70,
      "success_rate": "97.85"
    },
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-02-06T10:00:00.000Z"
  }
]
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/transcription-providers" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/transcription-providers', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const providers = await response.json();
providers.forEach(p => {
  console.log(`${p.provider_name}: ${p.statistics.success_rate}% success rate`);
});
```

#### Notes

- **Usage Tracking**: Shows current usage vs limit
- **Success Rates**: Calculate success rate for each provider
- **Cost Analysis**: Compare cost per minute across providers

---

## 5. System Health (6 endpoints)

Health monitoring, performance metrics, and alerting.

### 5.1 Get Overall System Health Status

**GET** `/api/admin/communication/health`

Runs comprehensive health check across all systems: Twilio API, webhooks, transcription providers. Returns detailed status for each component.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "overall_status": "HEALTHY",
  "checked_at": "2026-02-06T15:30:00.000Z",
  "components": {
    "twilio_api": {
      "status": "HEALTHY",
      "response_time_ms": 156,
      "message": "Twilio API connectivity is healthy"
    },
    "webhooks": {
      "status": "HEALTHY",
      "response_time_ms": 45,
      "message": "Webhook endpoint is accessible"
    },
    "transcription_providers": {
      "status": "HEALTHY",
      "providers": {
        "openai_whisper": {
          "status": "HEALTHY",
          "response_time_ms": 230
        }
      }
    }
  }
}
```

**Health Status Values**: `HEALTHY`, `DEGRADED`, `DOWN`

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/health" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/health', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const health = await response.json();
console.log(`System health: ${health.overall_status}`);
```

#### Notes

- **Comprehensive Check**: Tests all critical system components
- **Real-Time**: Executes live health checks (not cached)
- **Performance Baseline**: Use for establishing performance baselines

---

### 5.2 Test Twilio API Connectivity

**POST** `/api/admin/communication/health/twilio-test`

Tests Twilio API connectivity for a specific tenant. Measures response time and validates credentials.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body** (Content-Type: `application/json`):

```json
{
  "tenant_id": "tenant-uuid-456"
}
```

**Request Body Fields**:

| Field     | Type         | Required | Description                                       |
|-----------|--------------|----------|---------------------------------------------------|
| tenant_id | string (UUID) | Yes      | Tenant UUID (use "system" for system-level check) |

#### Response

**Success Response (200 OK)**:

```json
{
  "status": "HEALTHY",
  "tenant_id": "tenant-uuid-456",
  "response_time_ms": 178,
  "message": "Twilio API connectivity test successful",
  "tested_at": "2026-02-06T15:45:00.000Z"
}
```

#### Examples

**cURL**:
```bash
curl -X POST "https://api.lead360.app/api/admin/communication/health/twilio-test" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "tenant-uuid-456"}'
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/health/twilio-test', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    tenant_id: 'tenant-uuid-456'
  }),
});

const result = await response.json();
console.log(`Twilio test: ${result.status} (${result.response_time_ms}ms)`);
```

#### Notes

- **Tenant-Specific**: Tests connectivity for specific tenant's Twilio configuration
- **System Check**: Use tenant_id "system" to test system-level provider
- **Non-Destructive**: Does not send actual SMS or make calls

---

### 5.3 Test Webhook Delivery

**POST** `/api/admin/communication/health/webhooks-test`

Tests that webhook endpoint is accessible and responding correctly.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "status": "HEALTHY",
  "message": "Webhook endpoint is accessible and responding correctly",
  "response_time_ms": 52,
  "tested_at": "2026-02-06T16:00:00.000Z"
}
```

#### Examples

**cURL**:
```bash
curl -X POST "https://api.lead360.app/api/admin/communication/health/webhooks-test" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/health/webhooks-test', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const result = await response.json();
console.log(`Webhook test: ${result.status}`);
```

#### Notes

- **Internal Test**: Tests webhook endpoint accessibility
- **No External Calls**: Does not trigger actual Twilio webhooks

---

### 5.4 Test Transcription Provider

**POST** `/api/admin/communication/health/transcription-test`

Tests transcription provider API connectivity and configuration.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "status": "HEALTHY",
  "message": "Transcription provider connectivity test successful",
  "providers_tested": ["openai_whisper"],
  "response_time_ms": 245,
  "tested_at": "2026-02-06T16:15:00.000Z"
}
```

#### Examples

**cURL**:
```bash
curl -X POST "https://api.lead360.app/api/admin/communication/health/transcription-test" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/health/transcription-test', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const result = await response.json();
```

#### Notes

- **Provider Check**: Tests all configured transcription providers
- **API Validation**: Validates API keys and connectivity

---

### 5.5 Get Provider Performance Metrics

**GET** `/api/admin/communication/health/provider-response-times`

Returns API response time statistics for all providers (last 24 hours): avg, max, min response times. Used for performance monitoring and capacity planning.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "period": {
    "start": "2026-02-05T16:30:00.000Z",
    "end": "2026-02-06T16:30:00.000Z"
  },
  "twilio_api": {
    "avg_response_time_ms": 178,
    "max_response_time_ms": 456,
    "min_response_time_ms": 89,
    "total_requests": 15230
  },
  "transcription_providers": {
    "openai_whisper": {
      "avg_response_time_ms": 2340,
      "max_response_time_ms": 5680,
      "min_response_time_ms": 1120,
      "total_requests": 950
    }
  }
}
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/health/provider-response-times" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/health/provider-response-times', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const metrics = await response.json();
console.log(`Twilio avg response: ${metrics.twilio_api.avg_response_time_ms}ms`);
```

#### Notes

- **24-Hour Window**: Metrics cover last 24 hours
- **Performance Trends**: Use for identifying performance degradation
- **Capacity Planning**: High response times may indicate need for scaling

---

### 5.6 Get Recent System Alerts

**GET** `/api/admin/communication/alerts`

Returns paginated list of system alerts: health failures, failed transcriptions, quota exceeded, etc.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**:

| Parameter     | Type              | Required | Default | Description                                    |
|---------------|-------------------|----------|---------|------------------------------------------------|
| acknowledged  | string (boolean)  | No       | None    | Filter by acknowledged status (true/false)     |
| severity      | string (enum)     | No       | None    | Filter by severity (LOW/MEDIUM/HIGH/CRITICAL)  |
| page          | integer           | No       | 1       | Page number                                    |
| limit         | integer           | No       | 20      | Results per page                               |

**Severity Enum Values**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "data": [
    {
      "id": "alert-uuid-123",
      "type": "FAILED_TRANSCRIPTION",
      "severity": "MEDIUM",
      "message": "15 transcriptions failed in the last hour",
      "details": {
        "failed_count": 15,
        "provider": "openai_whisper",
        "error_summary": "Audio file too short"
      },
      "acknowledged": false,
      "acknowledged_by": null,
      "acknowledged_at": null,
      "created_at": "2026-02-06T14:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 43,
    "page": 1,
    "limit": 20,
    "pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

**Alert Fields**:

| Field            | Type              | Nullable | Description                                    |
|------------------|-------------------|----------|------------------------------------------------|
| id               | string (UUID)     | No       | Unique alert ID                                |
| type             | string            | No       | Alert type (see types below)                   |
| severity         | string            | No       | Alert severity (LOW/MEDIUM/HIGH/CRITICAL)      |
| message          | string            | No       | Human-readable alert message                   |
| details          | object (JSON)     | Yes      | Additional context data                        |
| acknowledged     | boolean           | No       | Whether admin has addressed the alert          |
| acknowledged_by  | object            | Yes      | Admin user who acknowledged (if acknowledged)  |
| acknowledged_at  | string (ISO 8601) | Yes      | Acknowledgement timestamp                      |
| created_at       | string (ISO 8601) | No       | Alert creation timestamp                       |

**Alert Types**: `SYSTEM_HEALTH`, `FAILED_TRANSCRIPTION`, `QUOTA_EXCEEDED`, `HIGH_USAGE`

#### Examples

**cURL (all alerts)**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/alerts?page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**cURL (unacknowledged critical alerts)**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/alerts?acknowledged=false&severity=CRITICAL" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const params = new URLSearchParams({
  acknowledged: 'false',
  severity: 'HIGH',
  page: '1',
  limit: '50'
});

const response = await fetch(`https://api.lead360.app/api/admin/communication/alerts?${params}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const { data, pagination } = await response.json();
console.log(`Found ${pagination.total} unacknowledged HIGH severity alerts`);
```

#### Notes

- **Actionable Alerts**: Each alert requires admin action or acknowledgement
- **Details Context**: `details` field provides troubleshooting context
- **Acknowledgement**: Alerts can be acknowledged via separate endpoint (not documented here)

---

## 6. Metrics & Analytics (2 endpoints)

System-wide communication metrics and analytics.

### 6.1 Get Comprehensive System-Wide Metrics

**GET** `/api/admin/communication/metrics/system-wide`

Returns platform-level metrics across all tenants: total calls, SMS, transcriptions, success rates, etc.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "platform_overview": {
    "total_tenants": 45,
    "active_tenants": 42
  },
  "calls": {
    "total": 15230,
    "completed": 13500,
    "failed": 850,
    "no_answer": 880,
    "completion_rate": "88.64%"
  },
  "sms": {
    "total": 32500,
    "delivered": 31800,
    "failed": 700,
    "delivery_rate": "97.85%"
  },
  "transcriptions": {
    "total": 9800,
    "completed": 9550,
    "failed": 250,
    "success_rate": "97.45%"
  },
  "generated_at": "2026-02-06T17:00:00.000Z"
}
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/metrics/system-wide" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/metrics/system-wide', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const metrics = await response.json();
console.log(`Platform: ${metrics.calls.total} calls, ${metrics.calls.completion_rate} completion rate`);
```

#### Notes

- **Real-Time**: Computed from current database state
- **Platform-Level**: Aggregated across all tenants
- **Success Rates**: Includes calculated success/completion rates

---

### 6.2 Get Top Tenants by Communication Volume

**GET** `/api/admin/communication/metrics/top-tenants`

Returns list of tenants with highest communication activity. Useful for identifying power users and capacity planning.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**:

| Parameter | Type    | Required | Default | Description                       |
|-----------|---------|----------|---------|-----------------------------------|
| limit     | integer | No       | 10      | Number of top tenants to return   |

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "top_tenants": [
    {
      "tenant_id": "tenant-uuid-123",
      "tenant_name": "Acme Roofing",
      "subdomain": "acme",
      "total_communications": 5250,
      "calls": 850,
      "sms": 3200,
      "whatsapp": 1200,
      "rank": 1
    },
    {
      "tenant_id": "tenant-uuid-456",
      "tenant_name": "Beta Construction",
      "subdomain": "beta",
      "total_communications": 4180,
      "calls": 720,
      "sms": 2800,
      "whatsapp": 660,
      "rank": 2
    }
  ],
  "generated_at": "2026-02-06T17:15:00.000Z"
}
```

#### Examples

**cURL (top 10 tenants)**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/metrics/top-tenants?limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch - top 20)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/metrics/top-tenants?limit=20', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const { top_tenants } = await response.json();
top_tenants.forEach(tenant => {
  console.log(`#${tenant.rank}: ${tenant.tenant_name} - ${tenant.total_communications} communications`);
});
```

#### Notes

- **Volume-Based**: Sorted by total communication count
- **Capacity Planning**: Use to identify high-usage tenants
- **Resource Allocation**: Helps plan infrastructure scaling

---

## 7. Cron Schedule Management (2 endpoints)

Dynamic cron schedule configuration from system settings.

### 7.1 Get Cron Job Status

**GET** `/api/admin/communication/cron/status`

Returns current status of all scheduled jobs including their schedules, timezone, and running status. Shows configuration loaded from system_settings table.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "jobs": [
    {
      "name": "twilio_usage_sync",
      "schedule": "0 2 * * *",
      "timezone": "America/New_York",
      "is_running": true,
      "next_run": "2026-02-07T02:00:00.000Z",
      "last_run": "2026-02-06T02:00:00.000Z"
    },
    {
      "name": "twilio_health_check",
      "schedule": "*/15 * * * *",
      "timezone": "America/New_York",
      "is_running": true,
      "next_run": "2026-02-06T17:30:00.000Z",
      "last_run": "2026-02-06T17:15:00.000Z"
    }
  ],
  "loaded_from": "system_settings",
  "retrieved_at": "2026-02-06T17:20:00.000Z"
}
```

#### Examples

**cURL**:
```bash
curl -X GET "https://api.lead360.app/api/admin/communication/cron/status" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/cron/status', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const { jobs } = await response.json();
jobs.forEach(job => {
  console.log(`${job.name}: ${job.schedule} (${job.is_running ? 'running' : 'stopped'})`);
});
```

#### Notes

- **System Settings**: Cron schedules loaded from `system_settings` table
- **Timezone Support**: All schedules respect configured timezone
- **Next Run**: Shows when each job will execute next

---

### 7.2 Reload Cron Schedules from System Settings

**POST** `/api/admin/communication/cron/reload`

Reloads cron job schedules from system_settings table and restarts jobs with new configuration. Use this after updating cron settings (twilio_usage_sync_cron, twilio_health_check_cron, cron_timezone). Jobs will be stopped and restarted with the new schedule immediately.

#### Authentication
- **Required**: Yes
- **Role**: SystemAdmin

#### Request

**Path Parameters**: None

**Query Parameters**: None

**Request Body**: None

#### Response

**Success Response (200 OK)**:

```json
{
  "message": "Cron schedules reloaded successfully",
  "status": {
    "jobs": [
      {
        "name": "twilio_usage_sync",
        "schedule": "0 3 * * *",
        "timezone": "America/Los_Angeles",
        "is_running": true,
        "next_run": "2026-02-07T03:00:00.000Z"
      }
    ]
  }
}
```

#### Examples

**cURL**:
```bash
curl -X POST "https://api.lead360.app/api/admin/communication/cron/reload" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JavaScript (Fetch)**:
```javascript
const response = await fetch('https://api.lead360.app/api/admin/communication/cron/reload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const result = await response.json();
console.log(result.message);
console.log('Updated jobs:', result.status.jobs);
```

#### Notes

- **Immediate Effect**: Jobs restart immediately with new schedules
- **No Downtime**: Jobs gracefully stopped and restarted
- **Timezone Changes**: Respects updated timezone settings
- **Use Case**: Apply cron schedule changes without server restart

---

## Appendix A: Data Models

### Request DTOs

#### AdminCallFiltersDto

Query parameters for filtering calls across all tenants.

| Field      | Type              | Required | Validation                                         | Description                             |
|------------|-------------------|----------|----------------------------------------------------|-----------------------------------------|
| tenant_id  | string (UUID)     | No       | Valid UUID                                         | Filter by tenant ID                     |
| status     | string (enum)     | No       | One of call status values (see below)              | Filter by call status                   |
| direction  | string (enum)     | No       | "inbound" or "outbound"                            | Filter by call direction                |
| start_date | string (ISO 8601) | No       | Valid ISO 8601 date string                         | Filter calls after this date            |
| end_date   | string (ISO 8601) | No       | Valid ISO 8601 date string                         | Filter calls before this date           |
| page       | integer           | No       | Min: 1                                             | Page number (1-indexed)                 |
| limit      | integer           | No       | Min: 1                                             | Results per page                        |

**Call Status Enum**: `initiated`, `ringing`, `in_progress`, `completed`, `failed`, `no_answer`, `busy`, `canceled`

---

#### AdminSmsFiltersDto

Query parameters for filtering SMS/WhatsApp messages across all tenants.

| Field      | Type              | Required | Validation                                         | Description                             |
|------------|-------------------|----------|----------------------------------------------------|-----------------------------------------|
| tenant_id  | string (UUID)     | No       | Valid UUID                                         | Filter by tenant ID                     |
| status     | string (enum)     | No       | One of SMS status values (see below)               | Filter by message status                |
| direction  | string (enum)     | No       | "inbound" or "outbound"                            | Filter by message direction             |
| channel    | string (enum)     | No       | "sms" or "whatsapp"                                | Filter by communication channel         |
| start_date | string (ISO 8601) | No       | Valid ISO 8601 date string                         | Filter messages after this date         |
| end_date   | string (ISO 8601) | No       | Valid ISO 8601 date string                         | Filter messages before this date        |
| page       | integer           | No       | Min: 1                                             | Page number (1-indexed)                 |
| limit      | integer           | No       | Min: 1                                             | Results per page                        |

**SMS Status Enum**: `pending`, `sent`, `delivered`, `failed`, `bounced`

---

#### UsageQueryDto

Query parameters for retrieving usage statistics and reports.

| Field      | Type              | Required | Validation                                         | Description                             |
|------------|-------------------|----------|----------------------------------------------------|-----------------------------------------|
| month      | string            | No       | Pattern: `^\d{4}-\d{2}$` (YYYY-MM)                 | Month in YYYY-MM format                 |
| start_date | string (ISO 8601) | No       | Valid ISO 8601 date string                         | Start date for custom date range        |
| end_date   | string (ISO 8601) | No       | Valid ISO 8601 date string                         | End date for custom date range          |

---

#### CostQueryDto

Query parameters for cost estimation endpoints.

| Field | Type   | Required | Validation                             | Description               |
|-------|--------|----------|----------------------------------------|---------------------------|
| month | string | Yes      | Pattern: `^\d{4}-\d{2}$` (YYYY-MM)     | Month in YYYY-MM format   |

---

#### RegisterSystemProviderDto

Data required to register the system-level Twilio provider (Model B).

| Field       | Type   | Required | Validation                                              | Description                                      |
|-------------|--------|----------|---------------------------------------------------------|--------------------------------------------------|
| account_sid | string | Yes      | Pattern: `^AC[a-z0-9]{32}$`                             | Twilio Account SID (starts with AC)              |
| auth_token  | string | Yes      | Non-empty string                                        | Twilio Auth Token                                |

---

#### UpdateSystemProviderDto

Data required to update system-level Twilio credentials. Same fields as `RegisterSystemProviderDto`.

---

#### TestConnectivityDto

Data required to test Twilio connectivity for a specific tenant.

| Field     | Type   | Required | Validation        | Description                                          |
|-----------|--------|----------|-------------------|------------------------------------------------------|
| tenant_id | string | Yes      | Non-empty string  | Tenant UUID (use "system" for system-level check)    |

---

### Response Models

#### Paginated Response Format

All paginated endpoints return this structure:

```typescript
{
  data: T[],  // Array of result objects
  pagination: {
    total: number,      // Total records across all pages
    page: number,       // Current page number
    limit: number,      // Items per page
    pages: number,      // Total number of pages
    has_next: boolean,  // Whether next page exists
    has_prev: boolean   // Whether previous page exists
  }
}
```

---

### Database Models (Prisma Schema)

#### call_record

Voice call records.

| Field                      | Type    | Nullable | Description                                      |
|----------------------------|---------|----------|--------------------------------------------------|
| id                         | UUID    | No       | Unique call record ID                            |
| tenant_id                  | UUID    | Yes      | Tenant who owns this call                        |
| lead_id                    | UUID    | Yes      | Associated lead ID                               |
| twilio_call_sid            | string  | No       | Twilio Call SID (unique identifier)              |
| direction                  | string  | No       | "inbound" or "outbound"                          |
| from_number                | string  | No       | Caller phone number (E.164)                      |
| to_number                  | string  | No       | Recipient phone number (E.164)                   |
| status                     | string  | No       | Call status                                      |
| recording_url              | string  | Yes      | Twilio recording URL                             |
| recording_duration_seconds | integer | Yes      | Recording length in seconds                      |
| cost                       | decimal | Yes      | Call cost in USD                                 |
| created_at                 | DateTime| No       | Record creation time                             |

---

#### communication_event

SMS, Email, and WhatsApp messages.

| Field               | Type     | Nullable | Description                               |
|---------------------|----------|----------|-------------------------------------------|
| id                  | UUID     | No       | Unique message ID                         |
| tenant_id           | UUID     | Yes      | Tenant who owns this message              |
| channel             | string   | No       | "sms", "whatsapp", or "email"             |
| direction           | string   | No       | "inbound" or "outbound"                   |
| status              | string   | No       | Delivery status                           |
| to_phone            | string   | Yes      | Recipient phone number (E.164)            |
| text_body           | string   | Yes      | Message content                           |
| provider_message_id | string   | Yes      | Provider's message ID                     |
| sent_at             | DateTime | Yes      | Message sent timestamp                    |
| delivered_at        | DateTime | Yes      | Message delivered timestamp               |
| created_at          | DateTime | No       | Record creation time                      |

---

#### call_transcription

Call transcription records.

| Field                       | Type    | Nullable | Description                                |
|-----------------------------|---------|----------|--------------------------------------------|
| id                          | UUID    | No       | Unique transcription ID                    |
| tenant_id                   | UUID    | Yes      | Tenant who owns this transcription         |
| call_record_id              | UUID    | No       | Associated call record ID                  |
| transcription_provider      | string  | No       | Provider name (e.g., "openai_whisper")     |
| status                      | string  | No       | "queued", "processing", "completed", "failed" |
| transcription_text          | string  | Yes      | Full transcription text                    |
| language_detected           | string  | Yes      | ISO language code                          |
| confidence_score            | decimal | Yes      | Transcription confidence (0-1)             |
| processing_duration_seconds | integer | Yes      | Processing time in seconds                 |
| cost                        | decimal | Yes      | Transcription cost in USD                  |
| error_message               | string  | Yes      | Error message if failed                    |
| created_at                  | DateTime| No       | Record creation time                       |
| completed_at                | DateTime| Yes      | Transcription completion time              |

---

#### twilio_usage_record

Twilio usage tracking records (synced from Twilio API).

| Field      | Type     | Nullable | Description                                |
|------------|----------|----------|--------------------------------------------|
| id         | UUID     | No       | Unique usage record ID                     |
| tenant_id  | UUID     | Yes      | Tenant ID (null for system-level usage)    |
| category   | string   | No       | Usage category: "calls", "sms", etc.       |
| count      | integer  | No       | Number of units consumed                   |
| usage_unit | string   | No       | Unit of measurement                        |
| price      | decimal  | No       | Cost in USD                                |
| price_unit | string   | No       | Currency unit (typically "USD")            |
| start_date | DateTime | No       | Usage period start                         |
| end_date   | DateTime | No       | Usage period end                           |
| synced_at  | DateTime | No       | Timestamp when synced from Twilio API      |
| created_at | DateTime | No       | Record creation time                       |

---

#### admin_alert

System alerts for admin notification.

| Field            | Type     | Nullable | Description                                |
|------------------|----------|----------|--------------------------------------------|
| id               | UUID     | No       | Unique alert ID                            |
| type             | string   | No       | Alert type (see enum below)                |
| severity         | string   | No       | Alert severity (LOW/MEDIUM/HIGH/CRITICAL)  |
| message          | string   | No       | Human-readable alert message               |
| details          | JSON     | Yes      | Additional context data                    |
| acknowledged     | boolean  | No       | Whether admin addressed the alert          |
| acknowledged_by  | UUID     | Yes      | Admin user ID who acknowledged             |
| acknowledged_at  | DateTime | Yes      | Acknowledgement timestamp                  |
| created_at       | DateTime | No       | Alert creation time                        |

**Alert Type Enum**: `SYSTEM_HEALTH`, `FAILED_TRANSCRIPTION`, `QUOTA_EXCEEDED`, `HIGH_USAGE`

---

## Appendix B: Enums and Constants

### Call Status

| Value       | Description                              |
|-------------|------------------------------------------|
| initiated   | Call initiated, connecting               |
| ringing     | Call ringing, not yet answered           |
| in_progress | Call active and ongoing                  |
| completed   | Call ended successfully                  |
| failed      | Call failed to connect (technical error) |
| no_answer   | Call not answered by recipient           |
| busy        | Recipient line busy                      |
| canceled    | Call canceled by caller                  |

---

### SMS/Communication Status

| Value     | Description                                 |
|-----------|---------------------------------------------|
| pending   | Message queued, not yet sent                |
| sent      | Message sent to provider                    |
| delivered | Message delivered to recipient              |
| failed    | Message delivery failed                     |
| bounced   | Message bounced (invalid number)            |

---

### Transcription Status

| Value      | Description                               |
|------------|-------------------------------------------|
| queued     | Transcription queued for processing       |
| processing | Transcription in progress                 |
| completed  | Transcription completed successfully      |
| failed     | Transcription failed (see error_message)  |

---

### Alert Severity

| Value    | Description                                      | Use Case                                   |
|----------|--------------------------------------------------|--------------------------------------------|
| LOW      | Minor issue, no immediate action required        | Informational alerts                       |
| MEDIUM   | Issue requires attention within 24 hours         | Failed transcriptions (low volume)         |
| HIGH     | Issue requires attention within 4 hours          | High failure rates, quota warnings         |
| CRITICAL | Urgent issue requiring immediate action          | System down, provider connectivity failed  |

---

### Health Status

| Value    | Description                                      |
|----------|--------------------------------------------------|
| HEALTHY  | Component operating normally                     |
| DEGRADED | Component experiencing issues but still working  |
| DOWN     | Component completely unavailable                 |

---

## Appendix C: Usage Notes

### Twilio Model A vs Model B

**Model A (Tenant-Managed)**:
- Each tenant brings their own Twilio account (BYOT - Bring Your Own Twilio)
- Tenant configures their own Twilio credentials via tenant endpoints
- Tenant pays Twilio directly
- Platform does not manage Twilio resources

**Model B (Platform-Managed)**:
- Platform provides Twilio service from master account
- Admin configures system-level Twilio provider once
- Phone numbers allocated to tenants from system pool
- Platform manages billing and costs
- Admin endpoints (documented here) enable Model B management

---

### Cron Job Configuration

Cron job schedules are stored in the `system_settings` table:

| Setting Key              | Description                          | Example Value          |
|--------------------------|--------------------------------------|------------------------|
| twilio_usage_sync_cron   | Usage sync schedule (cron format)    | `0 2 * * *` (2:00 AM)  |
| twilio_health_check_cron | Health check schedule (cron format)  | `*/15 * * * *` (15min) |
| cron_timezone            | Timezone for all cron jobs           | `America/New_York`     |

**Updating Cron Schedules**:
1. Update setting values in `system_settings` table
2. Call `POST /admin/communication/cron/reload` to apply changes
3. Jobs will restart with new schedules immediately

---

### Rate Limiting

**Twilio API Rate Limits**:
- Twilio enforces API rate limits per account
- Usage sync operations respect rate limits
- Large tenant bases may require staggered syncing

**Admin API Rate Limits**:
- No explicit rate limiting on admin endpoints (trusted users only)
- Use pagination to avoid overwhelming database queries
- Health checks can be called frequently (no rate limit)

---

### Best Practices

**Usage Tracking**:
- Run usage sync nightly during low-traffic hours (default: 2:00 AM)
- Monitor sync job completion in cron status endpoint
- Trigger manual sync only when necessary (troubleshooting)

**Health Monitoring**:
- Check system health regularly (every 15 minutes recommended)
- Set up alerts for CRITICAL severity issues
- Monitor provider response times for performance trends

**Cost Management**:
- Review tenant usage monthly for billing accuracy
- Set up budget alerts using cost estimation endpoint
- Identify high-usage tenants for capacity planning

**Transcription Monitoring**:
- Monitor failed transcription rate (target: <5%)
- Retry failed transcriptions promptly
- Review provider success rates to choose optimal provider

---

## Appendix D: Changelog

### Version 1.0 (February 6, 2026)

**Initial Release**:
- 32 admin endpoints documented
- Provider Management (5 endpoints)
- Cross-Tenant Oversight (6 endpoints)
- Usage Tracking & Billing (7 endpoints)
- Transcription Monitoring (4 endpoints)
- System Health (6 endpoints)
- Metrics & Analytics (2 endpoints)
- Cron Schedule Management (2 endpoints)

**Key Features**:
- System-level Twilio provider registration (Model B support)
- Cross-tenant communication visibility (AC-16 fulfillment)
- Nightly usage sync from Twilio API (AC-18 fulfillment)
- Comprehensive health monitoring
- Dynamic cron schedule management

**Future Enhancements Planned**:
- CSV export functionality (endpoint reserved: `/usage/export`)
- Alert acknowledgement endpoint
- Bulk tenant provisioning
- Advanced analytics dashboards

---

## Support

For questions, issues, or feature requests:

- **Platform Documentation**: See `/documentation/backend/module-twillio.md`
- **Sprint Documentation**: See `/documentation/backend/twillio_sprints/`
- **Issue Tracking**: Contact platform administrator

---

**End of Twilio Admin REST API Documentation**

*Generated from actual codebase - February 6, 2026*
