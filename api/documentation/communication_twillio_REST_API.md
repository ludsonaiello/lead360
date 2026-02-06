# Twilio Integration REST API Documentation

**Version**: 1.0
**Last Updated**: February 5, 2026
**Module**: Communication (Twilio)
**Base URL**: `https://api.lead360.app/api/v1`

---

## Table of Contents

1. [Overview & Authentication](#overview--authentication)
2. [SMS Configuration Endpoints (5)](#sms-configuration-endpoints)
3. [WhatsApp Configuration Endpoints (5)](#whatsapp-configuration-endpoints)
4. [Call Management Endpoints (4)](#call-management-endpoints)
5. [IVR Configuration Endpoints (3)](#ivr-configuration-endpoints)
6. [Office Bypass Endpoints (4)](#office-bypass-endpoints)
7. [Webhook Endpoints Reference (5)](#webhook-endpoints-reference)
8. [Common Error Responses](#common-error-responses)
9. [Data Models](#data-models)
10. [Testing Guide](#testing-guide)

---

## Overview & Authentication

### Purpose

Lead360's Twilio integration enables:
- **SMS messaging** (inbound and outbound)
- **WhatsApp messaging** (inbound and outbound)
- **Voice calls** (inbound and outbound with recording)
- **IVR (Interactive Voice Response)** menus
- **Call transcription** (automatic speech-to-text)
- **Office bypass** for authorized staff

### Multi-Tenant Architecture

Each tenant configures their own Twilio credentials:
- **Model A**: Tenant provides their own Twilio Account SID and Auth Token
- **Model B**: System-managed Twilio account (for tenants without their own)

All API endpoints enforce **tenant isolation** - users can only access their own tenant's data.

### Authentication

**All endpoints require JWT authentication** except webhooks (which use Twilio signature verification).

**Authorization Header**:
```
Authorization: Bearer <your_jwt_token>
```

**JWT Token** contains:
- `user.id` - User UUID
- `user.tenant_id` - Tenant UUID (used for isolation)
- `user.role` - Role name for RBAC

### RBAC (Role-Based Access Control)

| Role | View Config | Edit Config | Make Calls | Admin |
|------|-------------|-------------|------------|-------|
| Owner | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ❌ | ✅ | ❌ |
| Sales | ✅ | ❌ | ✅ | ❌ |
| Employee | ✅ | ❌ | ❌ | ❌ |

### API Versioning

All endpoints use `/api/v1` prefix for version 1.

### API Endpoint Structure (Namespace Pattern)

All Twilio-related endpoints are namespaced under `/api/v1/communication/twilio/` for clear provider separation. This enables future support for additional communication providers (Vonage, Bandwidth, etc.) without endpoint conflicts.

**Namespace Pattern:**
```
/api/v1/communication/twilio/sms-config        (Twilio SMS configuration)
/api/v1/communication/twilio/whatsapp-config   (Twilio WhatsApp configuration)
/api/v1/communication/twilio/calls             (Twilio call management)
/api/v1/communication/twilio/call-history      (Twilio call history)
/api/v1/communication/twilio/ivr               (Twilio IVR configuration)
/api/v1/communication/twilio/office-whitelist  (Twilio office bypass)
```

**Future Provider Support:**
When adding new providers (e.g., Vonage, Bandwidth), follow the same pattern:
```
/api/v1/communication/vonage/sms-config
/api/v1/communication/bandwidth/calls
```

**Public Webhooks (Different Pattern):**
Public webhook handlers called BY Twilio use a different pattern without authentication:
```
/api/twilio/sms/inbound        (Called by Twilio)
/api/twilio/call/inbound       (Called by Twilio)
```

### Security Notes

1. **Credentials Encryption**: Twilio Account SID and Auth Token are encrypted at rest using AES-256.
2. **Credentials Never Returned**: API responses NEVER include `account_sid` or `auth_token` values.
3. **Webhook Signature Verification**: All Twilio webhooks verify cryptographic signatures.
4. **Tenant Isolation**: Every query includes `tenant_id` filter enforced by middleware.

---

## SMS Configuration Endpoints

### 1. Create SMS Configuration

**`POST /api/v1/communication/twilio/sms-config`**

Creates a new SMS configuration with Twilio credentials. Only one active configuration allowed per tenant. Credentials are validated against Twilio API before storage.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Request Body

```json
{
  "provider_id": "550e8400-e29b-41d4-a716-446655440000",
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "your_auth_token_here_32_characters",
  "from_phone": "+19781234567",
  "webhook_secret": "optional_webhook_secret_here"
}
```

#### Request Body Fields

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| provider_id | string (uuid) | Yes | Valid UUID | Communication provider ID (must be twilio_sms provider) | "550e8400-e29b-41d4-a716-446655440000" |
| account_sid | string | Yes | Pattern: `^AC[a-z0-9]{32}$`, Length: 34 | Twilio Account SID (starts with AC + 32 chars) | "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" |
| auth_token | string | Yes | Min length: 32 | Twilio Auth Token | "your_auth_token_here_32_characters" |
| from_phone | string | Yes | E.164 format: `^\+[1-9]\d{1,14}$` | Twilio phone number with country code | "+19781234567" |
| webhook_secret | string | No | - | Optional webhook secret for signature verification | "your_webhook_secret_here" |

#### Success Response (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
  "provider_id": "550e8400-e29b-41d4-a716-446655440002",
  "from_phone": "+19781234567",
  "is_active": true,
  "is_verified": true,
  "created_at": "2026-02-05T10:00:00.000Z",
  "updated_at": "2026-02-05T10:00:00.000Z"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Configuration UUID |
| tenant_id | string (uuid) | Tenant UUID (from JWT token) |
| provider_id | string (uuid) | Communication provider UUID |
| from_phone | string | Phone number in E.164 format |
| is_active | boolean | Whether configuration is active |
| is_verified | boolean | Whether credentials were verified with Twilio |
| created_at | string (ISO 8601) | Creation timestamp |
| updated_at | string (ISO 8601) | Last update timestamp |

#### Error Responses

**400 Bad Request** - Invalid Twilio credentials or validation error
```json
{
  "statusCode": 400,
  "message": "Invalid Twilio credentials. Please check Account SID and Auth Token.",
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

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Your role does not allow this action"
}
```

**409 Conflict** - Active SMS configuration already exists
```json
{
  "statusCode": 409,
  "message": "Active SMS configuration already exists. Deactivate existing config first.",
  "error": "Conflict"
}
```

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/sms-config" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "550e8400-e29b-41d4-a716-446655440000",
    "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "auth_token": "your_auth_token_here_32_characters",
    "from_phone": "+19781234567"
  }'
```

#### Notes

- Credentials (account_sid, auth_token) are encrypted before storage
- Credentials are NEVER returned in API responses
- Only one active configuration allowed per tenant
- Phone numbers must be in E.164 format (starting with +)
- System validates credentials against Twilio API before saving

---

### 2. Get Active SMS Configuration

**`GET /api/v1/communication/twilio/sms-config`**

Retrieves the active SMS configuration for the tenant. Credentials are NOT included in the response for security.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager, Sales, Employee

#### Success Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
  "provider_id": "550e8400-e29b-41d4-a716-446655440002",
  "from_phone": "+19781234567",
  "is_active": true,
  "is_verified": true,
  "created_at": "2026-02-05T10:00:00.000Z",
  "updated_at": "2026-02-05T10:00:00.000Z"
}
```

#### Error Responses

**404 Not Found** - No active SMS configuration found
```json
{
  "statusCode": 404,
  "message": "No active SMS configuration found for this tenant",
  "error": "Not Found"
}
```

**401 Unauthorized** - Invalid or missing JWT token

**403 Forbidden** - Insufficient permissions

#### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/twilio/sms-config" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

### 3. Update SMS Configuration

**`PATCH /api/v1/communication/twilio/sms-config/:id`**

Updates an existing SMS configuration. If credentials are updated, they will be re-validated against Twilio API.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | SMS configuration UUID | "550e8400-e29b-41d4-a716-446655440000" |

#### Request Body (All fields optional)

```json
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "new_auth_token_here",
  "from_phone": "+19781234568",
  "webhook_secret": "new_webhook_secret",
  "is_active": true
}
```

#### Request Body Fields

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| account_sid | string | No | Pattern: `^AC[a-z0-9]{32}$` | Twilio Account SID |
| auth_token | string | No | - | Twilio Auth Token |
| from_phone | string | No | E.164 format | Phone number |
| webhook_secret | string | No | - | Webhook secret |
| is_active | boolean | No | - | Active status |

#### Success Response (200 OK)

Same structure as Create response.

#### Error Responses

**400 Bad Request** - Invalid credentials if updated

**404 Not Found** - SMS configuration not found

**401 Unauthorized** - Invalid or missing JWT token

**403 Forbidden** - Insufficient permissions

#### Example Request

```bash
curl -X PATCH "https://api.lead360.app/api/v1/communication/twilio/sms-config/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "from_phone": "+19781234568"
  }'
```

---

### 4. Deactivate SMS Configuration

**`DELETE /api/v1/communication/twilio/sms-config/:id`**

Soft delete (deactivate) an SMS configuration. Configuration is not permanently deleted, only marked as inactive.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | SMS configuration UUID | "550e8400-e29b-41d4-a716-446655440000" |

#### Success Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
  "provider_id": "550e8400-e29b-41d4-a716-446655440002",
  "from_phone": "+19781234567",
  "is_active": false,
  "is_verified": true,
  "created_at": "2026-02-05T10:00:00.000Z",
  "updated_at": "2026-02-05T11:00:00.000Z"
}
```

#### Error Responses

**404 Not Found** - SMS configuration not found

**401 Unauthorized** - Invalid or missing JWT token

**403 Forbidden** - Insufficient permissions

#### Example Request

```bash
curl -X DELETE "https://api.lead360.app/api/v1/communication/twilio/sms-config/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

### 5. Test SMS Configuration

**`POST /api/v1/communication/twilio/sms-config/:id/test`**

Sends a test SMS message to verify configuration. Message is sent to the configured phone number (self-test). Marks configuration as verified on success.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | SMS configuration UUID | "550e8400-e29b-41d4-a716-446655440000" |

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Test SMS sent successfully",
  "twilio_message_sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "from": "+19781234567",
  "to": "+19781234567"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether test was successful |
| message | string | Success message |
| twilio_message_sid | string | Twilio Message SID |
| from | string | Sender phone number |
| to | string | Recipient phone number (same as from for self-test) |

#### Error Responses

**400 Bad Request** - SMS test failed (invalid credentials or Twilio error)
```json
{
  "statusCode": 400,
  "message": "SMS test failed: Unable to create record",
  "error": "TWILIO_ERROR"
}
```

**404 Not Found** - SMS configuration not found

**401 Unauthorized** - Invalid or missing JWT token

**403 Forbidden** - Insufficient permissions

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/sms-config/550e8400-e29b-41d4-a716-446655440000/test" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

## WhatsApp Configuration Endpoints

### 1. Create WhatsApp Configuration

**`POST /api/v1/communication/twilio/whatsapp-config`**

Creates a new WhatsApp configuration with Twilio credentials. Requires approved WhatsApp Business Account with Twilio. Only one active configuration allowed per tenant.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Request Body

```json
{
  "provider_id": "550e8400-e29b-41d4-a716-446655440000",
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "your_auth_token_here_32_characters",
  "from_phone": "+19781234567",
  "webhook_secret": "optional_webhook_secret_here"
}
```

#### Request Body Fields

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| provider_id | string (uuid) | Yes | Valid UUID | Communication provider ID (must be twilio_whatsapp provider) | "550e8400-e29b-41d4-a716-446655440000" |
| account_sid | string | Yes | Pattern: `^AC[a-z0-9]{32}$`, Length: 34 | Twilio Account SID | "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" |
| auth_token | string | Yes | Min length: 32 | Twilio Auth Token | "your_auth_token_here_32_characters" |
| from_phone | string | Yes | E.164 format (with or without `whatsapp:` prefix) | WhatsApp-enabled phone number | "+19781234567" or "whatsapp:+19781234567" |
| webhook_secret | string | No | - | Optional webhook secret | "your_webhook_secret_here" |

#### Success Response (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
  "provider_id": "550e8400-e29b-41d4-a716-446655440002",
  "from_phone": "whatsapp:+19781234567",
  "is_active": true,
  "is_verified": true,
  "created_at": "2026-02-05T10:00:00.000Z",
  "updated_at": "2026-02-05T10:00:00.000Z"
}
```

#### Error Responses

**400 Bad Request** - Invalid Twilio credentials or phone number format

**401 Unauthorized** - Missing or invalid JWT token

**403 Forbidden** - Insufficient permissions

**409 Conflict** - Active WhatsApp configuration already exists
```json
{
  "statusCode": 409,
  "message": "Active WhatsApp configuration already exists. Deactivate existing config first.",
  "error": "Conflict"
}
```

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/whatsapp-config" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "550e8400-e29b-41d4-a716-446655440000",
    "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "auth_token": "your_auth_token_here_32_characters",
    "from_phone": "+19781234567"
  }'
```

#### Notes

- Phone numbers automatically prefixed with `whatsapp:` if not present
- Requires approved WhatsApp Business Account
- First messages to new contacts may require template approval
- Credentials encrypted at rest and never returned in responses

---

### 2. Get Active WhatsApp Configuration

**`GET /api/v1/communication/twilio/whatsapp-config`**

Retrieves the active WhatsApp configuration for the tenant. Credentials are NOT included in the response.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager, Sales, Employee

#### Success Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
  "provider_id": "550e8400-e29b-41d4-a716-446655440002",
  "from_phone": "whatsapp:+19781234567",
  "is_active": true,
  "is_verified": true,
  "created_at": "2026-02-05T10:00:00.000Z",
  "updated_at": "2026-02-05T10:00:00.000Z"
}
```

#### Error Responses

**404 Not Found** - No active WhatsApp configuration found
```json
{
  "statusCode": 404,
  "message": "No active WhatsApp configuration found for this tenant",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/twilio/whatsapp-config" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

### 3. Update WhatsApp Configuration

**`PATCH /api/v1/communication/twilio/whatsapp-config/:id`**

Updates an existing WhatsApp configuration. If credentials are updated, they will be re-validated.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | WhatsApp configuration UUID | "550e8400-e29b-41d4-a716-446655440000" |

#### Request Body (All fields optional)

```json
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "auth_token": "new_auth_token_here",
  "from_phone": "+19781234568",
  "webhook_secret": "new_webhook_secret",
  "is_active": true
}
```

#### Success Response (200 OK)

Same structure as Create response.

#### Error Responses

**400 Bad Request** - Invalid credentials if updated

**404 Not Found** - WhatsApp configuration not found

#### Example Request

```bash
curl -X PATCH "https://api.lead360.app/api/v1/communication/twilio/whatsapp-config/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "from_phone": "+19781234568"
  }'
```

---

### 4. Deactivate WhatsApp Configuration

**`DELETE /api/v1/communication/twilio/whatsapp-config/:id`**

Soft delete (deactivate) a WhatsApp configuration.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | WhatsApp configuration UUID | "550e8400-e29b-41d4-a716-446655440000" |

#### Success Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
  "provider_id": "550e8400-e29b-41d4-a716-446655440002",
  "from_phone": "whatsapp:+19781234567",
  "is_active": false,
  "is_verified": true,
  "created_at": "2026-02-05T10:00:00.000Z",
  "updated_at": "2026-02-05T11:00:00.000Z"
}
```

#### Example Request

```bash
curl -X DELETE "https://api.lead360.app/api/v1/communication/twilio/whatsapp-config/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

### 5. Test WhatsApp Configuration

**`POST /api/v1/communication/twilio/whatsapp-config/:id/test`**

Sends a test WhatsApp message to verify configuration. Message is sent to the configured phone number (self-test).

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | WhatsApp configuration UUID | "550e8400-e29b-41d4-a716-446655440000" |

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Test WhatsApp message sent successfully",
  "twilio_message_sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "from": "whatsapp:+19781234567",
  "to": "whatsapp:+19781234567"
}
```

#### Error Responses

**400 Bad Request** - WhatsApp test failed
```json
{
  "statusCode": 400,
  "message": "WhatsApp test failed: Unable to create record",
  "error": "TWILIO_ERROR",
  "hint": "Ensure your Twilio WhatsApp Business Account is approved and the phone number is configured correctly."
}
```

**404 Not Found** - WhatsApp configuration not found

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/whatsapp-config/550e8400-e29b-41d4-a716-446655440000/test" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

## Call Management Endpoints

### 1. Initiate Outbound Call

**`POST /api/v1/communication/twilio/calls/initiate`**

Initiates an outbound call to a Lead. System calls user's phone first, then bridges to Lead when user answers.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager, Sales

#### Call Flow

1. User clicks "Call Lead" in frontend
2. API request initiated
3. System calls **user's phone first**
4. User answers → system bridges to Lead
5. Call begins with automatic recording

#### Request Body

```json
{
  "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_phone_number": "+12025551234",
  "call_reason": "Following up on quote request"
}
```

#### Request Body Fields

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| lead_id | string (uuid) | Yes | Valid UUID v4 | Lead UUID to call | "a1b2c3d4-e5f6-7890-abcd-ef1234567890" |
| user_phone_number | string | Yes | E.164 format: `^\+[1-9]\d{1,14}$` | User's phone number (called first) | "+12025551234" |
| call_reason | string | No | - | Optional reason for call (saved to call record) | "Following up on quote request" |

#### Success Response (201 Created)

```json
{
  "success": true,
  "call_record_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "twilio_call_sid": "CA1234567890abcdef1234567890abcdef",
  "message": "Calling your phone. Please answer to connect to the Lead."
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether call initiation was successful |
| call_record_id | string (uuid) | CallRecord UUID for tracking |
| twilio_call_sid | string | Twilio Call SID |
| message | string | Instruction message |

#### Error Responses

**400 Bad Request** - Invalid data or Lead has no phone number
```json
{
  "statusCode": 400,
  "message": "Lead does not have a phone number",
  "error": "Bad Request"
}
```

**404 Not Found** - Lead not found
```json
{
  "statusCode": 404,
  "message": "Lead not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/calls/initiate" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_phone_number": "+12025551234",
    "call_reason": "Following up on quote request"
  }'
```

---

### 2. Get Paginated Call History

**`GET /api/v1/communication/twilio/call-history`**

Retrieves call history for the tenant with pagination. Results sorted by creation date (newest first).

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager, Sales

#### Query Parameters

| Parameter | Type | Required | Default | Validation | Description | Example |
|-----------|------|----------|---------|------------|-------------|---------|
| page | integer | No | 1 | Min: 1 | Page number (1-indexed) | `?page=2` |
| limit | integer | No | 20 | Min: 1, Max: 100 | Items per page | `?limit=50` |

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "lead_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "twilio_call_sid": "CA1234567890abcdef1234567890abcdef",
      "direction": "outbound",
      "from_number": "+19781234567",
      "to_number": "+12025551234",
      "status": "completed",
      "call_type": "customer_call",
      "call_reason": "Following up on quote request",
      "recording_url": "/public/tenant-id/communication/recordings/2026/02/call-id.mp3",
      "recording_duration_seconds": 127,
      "recording_status": "available",
      "started_at": "2026-02-05T14:30:00.000Z",
      "ended_at": "2026-02-05T14:32:07.000Z",
      "created_at": "2026-02-05T14:29:45.000Z",
      "lead": {
        "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+12025551234"
      },
      "initiated_by_user": {
        "id": "d4e5f6a7-b890-1234-def1-23456789abcd",
        "first_name": "Jane",
        "last_name": "Smith"
      }
    }
  ],
  "meta": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### Response Fields

**CallRecord Fields:**

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Call record UUID |
| tenant_id | string (uuid) | Tenant UUID |
| lead_id | string (uuid) \| null | Lead UUID (if matched) |
| twilio_call_sid | string | Twilio Call SID |
| direction | string | "inbound" or "outbound" |
| from_number | string | Caller phone number |
| to_number | string | Recipient phone number |
| status | string | "initiated", "ringing", "in_progress", "completed", "failed", "no_answer", "busy", "canceled" |
| call_type | string | "customer_call", "office_bypass_call", "ivr_routed_call" |
| call_reason | string \| null | Optional reason for call |
| recording_url | string \| null | Recording file URL |
| recording_duration_seconds | integer \| null | Recording duration |
| recording_status | string | "pending", "available", "processing_transcription", "transcribed", "failed" |
| started_at | string (ISO 8601) \| null | When call was answered |
| ended_at | string (ISO 8601) \| null | When call ended |
| created_at | string (ISO 8601) | When call record was created |
| lead | object \| null | Associated Lead information |
| initiated_by_user | object \| null | User who initiated call (outbound only) |

**Pagination Metadata:**

| Field | Type | Description |
|-------|------|-------------|
| total | integer | Total number of call records |
| page | integer | Current page number |
| limit | integer | Items per page |
| totalPages | integer | Total number of pages |

#### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/twilio/call-history?page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

### 3. Get Call Details by ID

**`GET /api/v1/communication/twilio/calls/:id`**

Retrieves detailed information about a specific call record.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager, Sales

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | CallRecord UUID | "a1b2c3d4-e5f6-7890-abcd-ef1234567890" |

#### Success Response (200 OK)

Same structure as individual call record in call history (see above).

#### Error Responses

**404 Not Found** - Call record not found
```json
{
  "statusCode": 404,
  "message": "Call record not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/twilio/calls/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

### 4. Get Recording URL

**`GET /api/v1/communication/twilio/calls/:id/recording`**

Retrieves the recording URL for a specific call. URL currently points to a public file (future: time-limited signed URLs).

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager, Sales

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | CallRecord UUID | "a1b2c3d4-e5f6-7890-abcd-ef1234567890" |

#### Success Response (200 OK)

```json
{
  "url": "/public/tenant-id/communication/recordings/2026/01/call-id.mp3",
  "duration_seconds": 127,
  "transcription_available": false
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| url | string | Recording file URL (relative path) |
| duration_seconds | integer | Recording duration in seconds |
| transcription_available | boolean | Whether transcription is available for this call |

#### Error Responses

**404 Not Found** - Call record not found or recording not available
```json
{
  "statusCode": 404,
  "message": "Recording not available for this call",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/twilio/calls/a1b2c3d4-e5f6-7890-abcd-ef1234567890/recording" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

#### Notes

- Recording URLs currently public (no expiration)
- Future enhancement: signed URLs with 1-hour expiration
- Recordings automatically deleted after retention period (configurable)

---

## IVR Configuration Endpoints

### 1. Create or Update IVR Configuration

**`POST /api/v1/communication/twilio/ivr`**

Creates or updates IVR (Interactive Voice Response) configuration for the tenant. Uses upsert pattern - if configuration exists, it will be updated.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Request Body

```json
{
  "ivr_enabled": true,
  "greeting_message": "Thank you for calling ABC Company.",
  "menu_options": [
    {
      "digit": "1",
      "action": "route_to_number",
      "label": "Sales Department",
      "config": {
        "phone_number": "+19781234567"
      }
    },
    {
      "digit": "2",
      "action": "voicemail",
      "label": "Leave a message",
      "config": {
        "max_duration_seconds": 180
      }
    }
  ],
  "default_action": {
    "action": "voicemail",
    "config": {
      "max_duration_seconds": 180
    }
  },
  "timeout_seconds": 10,
  "max_retries": 3
}
```

#### Request Body Fields

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| ivr_enabled | boolean | Yes | - | Whether IVR is enabled | true |
| greeting_message | string | Yes | Min: 5, Max: 500 chars | IVR greeting message (spoken before menu) | "Thank you for calling ABC Company." |
| menu_options | array | Yes | Min: 1, Max: 10 items | Array of menu options | See MenuOption structure below |
| default_action | object | Yes | - | Action if no input or timeout | See DefaultAction structure below |
| timeout_seconds | integer | Yes | Min: 5, Max: 60 | Seconds to wait for input | 10 |
| max_retries | integer | Yes | Min: 1, Max: 5 | Max retry attempts for invalid input | 3 |

**MenuOption Structure:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| digit | string | Yes | Enum: "0"-"9" | DTMF digit (must be unique) |
| action | string | Yes | Enum: "route_to_number", "route_to_default", "trigger_webhook", "voicemail" | Action type |
| label | string | Yes | Min: 1, Max: 100 chars | Human-readable label |
| config | object | Yes | Varies by action | Action-specific configuration |

**Action Types and Config:**

- `route_to_number`: `{ "phone_number": "+19781234567" }` (E.164 format)
- `trigger_webhook`: `{ "webhook_url": "https://example.com/webhook" }` (HTTPS only)
- `voicemail`: `{ "max_duration_seconds": 180 }` (60-300 seconds)
- `route_to_default`: `{}` (no config needed)

**DefaultAction Structure:**

Same as MenuOption action + config (without digit and label).

#### Success Response (201 Created)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "twilio_config_id": null,
  "ivr_enabled": true,
  "greeting_message": "Thank you for calling ABC Company.",
  "menu_options": [
    {
      "digit": "1",
      "action": "route_to_number",
      "label": "Sales Department",
      "config": {
        "phone_number": "+19781234567"
      }
    },
    {
      "digit": "2",
      "action": "voicemail",
      "label": "Leave a message",
      "config": {
        "max_duration_seconds": 180
      }
    }
  ],
  "default_action": {
    "action": "voicemail",
    "config": {
      "max_duration_seconds": 180
    }
  },
  "timeout_seconds": 10,
  "max_retries": 3,
  "status": "active",
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T10:30:00.000Z"
}
```

#### Error Responses

**400 Bad Request** - Validation failed
```json
{
  "statusCode": 400,
  "message": "Duplicate digits found: 1. Each digit must be unique.",
  "error": "Bad Request"
}
```

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/ivr" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "ivr_enabled": true,
    "greeting_message": "Thank you for calling ABC Company.",
    "menu_options": [
      {
        "digit": "1",
        "action": "route_to_number",
        "label": "Sales Department",
        "config": {"phone_number": "+19781234567"}
      }
    ],
    "default_action": {
      "action": "voicemail",
      "config": {"max_duration_seconds": 180}
    },
    "timeout_seconds": 10,
    "max_retries": 3
  }'
```

#### Notes

- Each digit must be unique (0-9)
- Max 10 menu options
- Greeting message should be concise (< 30 seconds when spoken)
- Phone numbers must be E.164 format
- Webhook URLs must use HTTPS
- Uses upsert pattern (idempotent)

---

### 2. Get IVR Configuration

**`GET /api/v1/communication/twilio/ivr`**

Retrieves the current IVR configuration for the tenant.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager

#### Success Response (200 OK)

Same structure as Create response (see above).

#### Error Responses

**404 Not Found** - IVR configuration not found
```json
{
  "statusCode": 404,
  "message": "IVR configuration not found for this tenant",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/twilio/ivr" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

### 3. Disable IVR Configuration

**`DELETE /api/v1/communication/twilio/ivr`**

Disables the IVR configuration (soft delete). Sets `ivr_enabled` to false and `status` to inactive. Data is retained for audit purposes.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Success Response (200 OK)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "twilio_config_id": null,
  "ivr_enabled": false,
  "greeting_message": "Thank you for calling ABC Company.",
  "menu_options": [],
  "default_action": {},
  "timeout_seconds": 10,
  "max_retries": 3,
  "status": "inactive",
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T11:00:00.000Z"
}
```

#### Error Responses

**404 Not Found** - IVR configuration not found

#### Example Request

```bash
curl -X DELETE "https://api.lead360.app/api/v1/communication/twilio/ivr" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

## Office Bypass Endpoints

### 1. Add Phone Number to Whitelist

**`POST /api/v1/communication/twilio/office-whitelist`**

Adds a phone number to the office bypass whitelist. Whitelisted numbers bypass IVR and can make outbound calls using the company's phone number.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Request Body

```json
{
  "phone_number": "+19781234567",
  "label": "John Doe - Sales Manager's Mobile"
}
```

#### Request Body Fields

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| phone_number | string | Yes | E.164 format: `^\+[1-9]\d{1,14}$` | Phone number (no spaces or formatting) | "+19781234567" |
| label | string | Yes | Min: 1, Max: 100 chars | Human-readable identifier | "John Doe - Sales Manager's Mobile" |

#### Success Response (201 Created)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "phone_number": "+19781234567",
  "label": "John Doe - Sales Manager's Mobile",
  "status": "active",
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T10:30:00.000Z"
}
```

#### Error Responses

**400 Bad Request** - Invalid phone number format
```json
{
  "statusCode": 400,
  "message": "Phone number must be in E.164 format (e.g., +12025551234). Start with + followed by country code and number, no spaces or formatting.",
  "error": "Bad Request"
}
```

**409 Conflict** - Phone number already whitelisted
```json
{
  "statusCode": 409,
  "message": "This phone number is already whitelisted",
  "error": "Conflict"
}
```

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/office-whitelist" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+19781234567",
    "label": "John Doe - Sales Manager'"'"'s Mobile"
  }'
```

#### Notes

- Verify phone number ownership before whitelisting
- Use descriptive labels (e.g., "John Doe - Sales Manager")
- Regularly audit whitelist entries
- Duplicate handling: returns 409 if active, reactivates if inactive

---

### 2. List All Whitelisted Numbers

**`GET /api/v1/communication/twilio/office-whitelist`**

Retrieves all office whitelist entries for the tenant (both active and inactive). Sorted by most recent first.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager

#### Success Response (200 OK)

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tenant_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "phone_number": "+19781234567",
    "label": "John Doe - Sales Manager's Mobile",
    "status": "active",
    "created_at": "2026-01-15T10:30:00.000Z",
    "updated_at": "2026-01-15T10:30:00.000Z"
  },
  {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678902",
    "tenant_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "phone_number": "+19781234568",
    "label": "Jane Smith - Operations Manager",
    "status": "inactive",
    "created_at": "2026-01-14T09:00:00.000Z",
    "updated_at": "2026-01-15T09:30:00.000Z"
  }
]
```

#### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/twilio/office-whitelist" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

### 3. Update Whitelist Entry Label

**`PATCH /api/v1/communication/twilio/office-whitelist/:id`**

Updates the label for a whitelist entry. Phone number itself cannot be changed (delete and re-add to change number).

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Whitelist entry UUID | "a1b2c3d4-e5f6-7890-abcd-ef1234567890" |

#### Request Body

```json
{
  "label": "John Doe - VP of Sales"
}
```

#### Request Body Fields

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| label | string | Yes | Min: 1, Max: 100 chars | Updated label |

#### Success Response (200 OK)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "phone_number": "+19781234567",
  "label": "John Doe - VP of Sales",
  "status": "active",
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T11:00:00.000Z"
}
```

#### Error Responses

**404 Not Found** - Whitelist entry not found or does not belong to this tenant

#### Example Request

```bash
curl -X PATCH "https://api.lead360.app/api/v1/communication/twilio/office-whitelist/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "label": "John Doe - VP of Sales"
  }'
```

---

### 4. Remove Phone Number from Whitelist

**`DELETE /api/v1/communication/twilio/office-whitelist/:id`**

Removes a phone number from the office whitelist (soft delete). Sets status to inactive. Data is retained for audit purposes.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin

#### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Whitelist entry UUID | "a1b2c3d4-e5f6-7890-abcd-ef1234567890" |

#### Success Response (200 OK)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "phone_number": "+19781234567",
  "label": "John Doe - Sales Manager's Mobile",
  "status": "inactive",
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T11:00:00.000Z"
}
```

#### Error Responses

**404 Not Found** - Whitelist entry not found or does not belong to this tenant

#### Example Request

```bash
curl -X DELETE "https://api.lead360.app/api/v1/communication/twilio/office-whitelist/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

## Webhook Endpoints Reference

**Important**: These endpoints are called **by Twilio**, not by the frontend. They use **Twilio signature verification** instead of JWT authentication.

### Webhook Configuration

**URL Format**: `https://{subdomain}.lead360.app/api/twilio/{endpoint}`

**Example**: `https://tenant123.lead360.app/api/twilio/sms/inbound`

### Webhook Security

1. **Signature Verification**: All webhooks verify Twilio's cryptographic signature
2. **Tenant Resolution**: Tenant extracted from subdomain
3. **2-Second Response Requirement**: Webhooks must respond within 2 seconds

---

### 1. Inbound SMS Webhook

**`POST /api/twilio/sms/inbound`**

Receives inbound SMS messages from Twilio. Creates communication event and attempts to match/create Lead.

**Authentication**: Twilio signature verification (no JWT)

#### Twilio Payload

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| MessageSid | string | Unique message identifier | "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" |
| From | string | Sender phone number (E.164) | "+12025551234" |
| To | string | Recipient phone (tenant's Twilio number) | "+19781234567" |
| Body | string | SMS text content | "I'm interested in a quote" |
| NumMedia | integer | Number of media attachments | 0 |

#### Success Response (200 OK)

```json
{}
```

#### Notes

- Empty response expected (Twilio just needs 200 OK)
- Lead matching/creation happens automatically
- Communication event created for tracking

---

### 2. Inbound Call Webhook

**`POST /api/twilio/call/inbound`**

Receives inbound call notifications from Twilio. Creates CallRecord and returns TwiML response based on IVR/bypass configuration.

**Authentication**: Twilio signature verification

#### Twilio Payload

| Field | Type | Description |
|-------|------|-------------|
| CallSid | string | Unique call identifier |
| From | string | Caller phone number |
| To | string | Recipient phone (tenant's Twilio number) |
| CallStatus | string | Call status (ringing) |

#### Success Response (200 OK)

Returns TwiML XML response (generated by system based on configuration).

---

### 3. Call Status Webhook

**`POST /api/twilio/call/status`**

Receives call status updates throughout call lifecycle: ringing, in-progress, completed, failed, busy, no-answer, canceled.

**Authentication**: Twilio signature verification

#### Twilio Payload

| Field | Type | Description |
|-------|------|-------------|
| CallSid | string | Call identifier |
| CallStatus | string | Current status |
| CallDuration | integer | Call duration in seconds (for completed calls) |

#### Success Response (200 OK)

```json
{}
```

---

### 4. Recording Ready Webhook

**`POST /api/twilio/recording/ready`**

Receives notification when call recording is available. Downloads recording URL and queues transcription job.

**Authentication**: Twilio signature verification

#### Twilio Payload

| Field | Type | Description |
|-------|------|-------------|
| CallSid | string | Call identifier |
| RecordingSid | string | Recording identifier |
| RecordingUrl | string | URL to download recording |
| RecordingDuration | integer | Recording duration in seconds |
| RecordingStatus | string | Recording status (completed) |

#### Success Response (200 OK)

```json
{}
```

---

### 5. IVR Input Webhook

**`POST /api/twilio/ivr/input`**

Receives DTMF input from caller during IVR menu interaction. Executes configured action based on digit pressed.

**Authentication**: Twilio signature verification

#### Twilio Payload

| Field | Type | Description |
|-------|------|-------------|
| CallSid | string | Call identifier |
| Digits | string | DTMF digits pressed by caller |
| From | string | Caller phone number |
| To | string | Recipient phone number |

#### Success Response (200 OK)

Returns TwiML XML response (action-specific).

---

## Common Error Responses

### 400 Bad Request

Validation error or invalid input.

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "account_sid",
      "message": "Invalid Twilio Account SID format"
    }
  ]
}
```

### 401 Unauthorized

Missing or invalid JWT token.

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden

Insufficient permissions (RBAC).

```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Your role does not allow this action"
}
```

### 404 Not Found

Resource not found.

```json
{
  "statusCode": 404,
  "message": "Configuration not found"
}
```

### 409 Conflict

Business rule violation.

```json
{
  "statusCode": 409,
  "message": "Active SMS configuration already exists"
}
```

### 500 Internal Server Error

Unexpected error.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## Data Models

### CallRecord Status Enum

- `initiated` - Call initiated
- `ringing` - Phone is ringing
- `in_progress` - Call answered and in progress
- `completed` - Call ended normally
- `failed` - Call failed
- `no_answer` - No answer
- `busy` - Line busy
- `canceled` - Call canceled

### Call Type Enum

- `customer_call` - Regular customer call
- `office_bypass_call` - Office staff bypass call
- `ivr_routed_call` - Call routed through IVR

### Recording Status Enum

- `pending` - Recording not yet available
- `available` - Recording available for playback
- `processing_transcription` - Transcription in progress
- `transcribed` - Transcription completed
- `failed` - Recording or transcription failed

### IVR Action Types

- `route_to_number` - Forward call to phone number
- `route_to_default` - Use default routing
- `trigger_webhook` - Call external webhook
- `voicemail` - Take voicemail

---

## Testing Guide

### 1. Test SMS Configuration

```bash
# Create SMS config
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/sms-config" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "YOUR_PROVIDER_ID",
    "account_sid": "YOUR_TWILIO_ACCOUNT_SID",
    "auth_token": "YOUR_TWILIO_AUTH_TOKEN",
    "from_phone": "+19781234567"
  }'

# Test SMS config
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/sms-config/CONFIG_ID/test" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Test Outbound Call

```bash
# Initiate call to Lead
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/calls/initiate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "LEAD_UUID",
    "user_phone_number": "+12025551234",
    "call_reason": "Test call"
  }'
```

### 3. Test IVR Configuration

```bash
# Create IVR config
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/ivr" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ivr_enabled": true,
    "greeting_message": "Thank you for calling.",
    "menu_options": [
      {
        "digit": "1",
        "action": "route_to_number",
        "label": "Sales",
        "config": {"phone_number": "+19781234567"}
      }
    ],
    "default_action": {
      "action": "voicemail",
      "config": {"max_duration_seconds": 180}
    },
    "timeout_seconds": 10,
    "max_retries": 3
  }'

# Test by calling Twilio number and pressing digits
```

### 4. Test Office Bypass

```bash
# Add to whitelist
curl -X POST "https://api.lead360.app/api/v1/communication/twilio/office-whitelist" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+19781234567",
    "label": "Test Phone"
  }'

# Call from whitelisted number to verify bypass
```

---

## Troubleshooting

### Common Issues

**Issue**: "Invalid Twilio credentials"
**Solution**: Verify Account SID format (AC + 32 chars), ensure Auth Token is correct

**Issue**: "Recording not available"
**Solution**: Wait for recording ready webhook, recordings take 10-60 seconds after call ends

**Issue**: "Active SMS configuration already exists"
**Solution**: Deactivate existing config first, or update existing config instead

**Issue**: "Phone number must be in E.164 format"
**Solution**: Ensure phone starts with +, followed by country code (e.g., +19781234567)

**Issue**: "Webhook signature verification failed"
**Solution**: Ensure webhook URL in Twilio matches exactly (protocol, host, path)

---

## API Status & Roadmap

### Currently Implemented ✅

- SMS Configuration (5 endpoints)
- WhatsApp Configuration (5 endpoints)
- Call Management (5 endpoints)
- IVR Configuration (3 endpoints)
- Office Bypass (4 endpoints)
- Twilio Webhooks (5 endpoints)

**Total**: 27 production-ready endpoints

### Planned (Not Yet Implemented) 🚧

- **Transcription Endpoints** (2 endpoints planned):
  - `GET /api/v1/communication/twilio/calls/:id/transcription` - Get call transcription
  - `GET /api/v1/communication/transcriptions/search` - Full-text search transcriptions

- **Admin Endpoints** (2 endpoints planned):
  - `GET /api/admin/communication/twilio/usage` - Get usage across all tenants
  - `GET /api/admin/communication/transcriptions/failed` - Get failed transcriptions

**Note**: DTOs and services for transcription exist, but controllers are not yet implemented.

---

## Security Best Practices

1. **HTTPS Only**: All API requests and webhooks must use HTTPS
2. **Rotate Credentials**: Regularly rotate Twilio Auth Tokens
3. **Validate Signatures**: Always verify Twilio webhook signatures
4. **Encrypt at Rest**: Credentials encrypted using AES-256
5. **Audit Whitelist**: Regularly review office bypass whitelist
6. **Signed URLs**: Use time-limited signed URLs for recording playback (planned)
7. **Rate Limiting**: API rate limits enforced (configurable per tenant)

---

**End of API Documentation**

For questions or issues, contact the development team or file an issue in the repository.
