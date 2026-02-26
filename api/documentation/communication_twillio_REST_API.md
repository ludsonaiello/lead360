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
7. [SMS Sending Endpoints (1)](#sms-sending-endpoints) - **NEW: Sprint 2**
8. [SMS Opt-Out Management Endpoints (2)](#sms-opt-out-management-endpoints) - **NEW: TCPA Compliance**
9. [Webhook Endpoints Reference (5)](#webhook-endpoints-reference)
10. [Common Error Responses](#common-error-responses)
11. [Data Models](#data-models)
12. [Testing Guide](#testing-guide)

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

## Multi-Level IVR Support

Lead360 supports multi-level (nested) IVR menus with up to 5 levels of depth. This allows for complex phone tree navigation similar to enterprise phone systems.

### Key Features

- **Nested Submenus**: Each menu option can either execute a terminal action or open a submenu with its own greeting and options
- **Configurable Depth**: Tenants can set max_depth (1-5 levels) to control menu complexity
- **Path-Based Navigation**: Twilio navigates through menu levels using path notation (e.g., "1.2.1")
- **Recursive Structure**: Submenus can contain submenus up to the configured depth limit
- **Validation**: Automatic detection of circular references, depth violations, and node count limits

### Action Types

| Action | Description | Config Required | Can be in Submenu? |
|--------|-------------|-----------------|-------------------| | `route_to_number` | Forward call to specific phone number | `phone_number` (E.164) | ✅ Yes |
| `route_to_default` | Forward to default company number | None | ✅ Yes |
| `trigger_webhook` | Send webhook notification | `webhook_url` (HTTPS) | ✅ Yes |
| `voicemail` | Record voicemail message | `max_duration_seconds` (60-300) | ✅ Yes |
| `voice_ai` | Connect to AI voice assistant | None (uses tenant Voice AI config) | ✅ Yes |
| `submenu` | Navigate to nested submenu | `submenu` object with greeting and options | ✅ Yes (up to max_depth) |
| `return_to_parent` | Navigate back one level | None | ✅ Yes |
| `return_to_root` | Return to main menu | None | ✅ Yes |

### Data Model

#### IVR Menu Option (Recursive)

```typescript
interface IVRMenuOption {
  id: string;                        // UUID (required for circular reference detection)
  digit: string;                     // "0"-"9"
  action: IVRActionType;
  label: string;                     // 1-100 characters
  config: {
    phone_number?: string;           // E.164 format (e.g., "+19781234567")
    webhook_url?: string;            // HTTPS only
    max_duration_seconds?: number;   // 60-300 seconds
  };
  submenu?: {                        // Only present if action === "submenu"
    greeting_message: string;        // 5-500 characters
    options: IVRMenuOption[];       // Recursive array (1-10 options)
    timeout_seconds?: number;        // Optional override (5-60 seconds)
  };
}
```

### Constraints

- **Max Depth**: 1-5 levels (default: 4)
- **Max Options Per Level**: 10 (digits 0-9)
- **Max Total Nodes**: 100 across entire tree
- **Greeting Length**: 5-500 characters (root and submenu)
- **Digit Uniqueness**: Must be unique within each level (not globally)
- **Circular References**: Not allowed (validated by checking duplicate UUIDs)
- **Submenu Action**: Cannot be used at max_depth (terminal actions only)

### Example: Multi-Level IVR Configuration

```json
{
  "ivr_enabled": true,
  "greeting_message": "Thank you for calling ABC Company.",
  "menu_options": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "digit": "1",
      "action": "submenu",
      "label": "Sales Department",
      "config": {},
      "submenu": {
        "greeting_message": "Sales Department. Press 1 for new customers or 2 for existing customers.",
        "options": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "digit": "1",
            "action": "route_to_number",
            "label": "New Customers",
            "config": {
              "phone_number": "+19781234567"
            }
          },
          {
            "id": "550e8400-e29b-41d4-a716-446655440003",
            "digit": "2",
            "action": "submenu",
            "label": "Existing Customers",
            "config": {},
            "submenu": {
              "greeting_message": "Press 1 for account support or 2 for technical support.",
              "options": [
                {
                  "id": "550e8400-e29b-41d4-a716-446655440004",
                  "digit": "1",
                  "action": "voice_ai",
                  "label": "Account Support",
                  "config": {}
                },
                {
                  "id": "550e8400-e29b-41d4-a716-446655440005",
                  "digit": "2",
                  "action": "route_to_number",
                  "label": "Technical Support",
                  "config": {
                    "phone_number": "+19781234568"
                  }
                }
              ],
              "timeout_seconds": 15
            }
          }
        ],
        "timeout_seconds": 10
      }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440006",
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
  "max_depth": 4
}
```

**Call Flow for Above Example**:

1. Caller hears: "Thank you for calling ABC Company. Press 1 for Sales Department or 2 to leave a message."
2. Caller presses 1
3. Caller hears: "Sales Department. Press 1 for new customers or 2 for existing customers."
4. Caller presses 2
5. Caller hears: "Press 1 for account support or 2 for technical support."
6. Caller presses 1
7. Call connects to Voice AI assistant

### TwiML Navigation

Multi-level IVR uses path-based navigation:

- **Root Level**: `/api/v1/twilio/ivr/menu`
- **First Submenu**: `/api/v1/twilio/ivr/menu?path=1` (after pressing 1)
- **Second Level**: `/api/v1/twilio/ivr/menu?path=1.2` (pressed 1, then 2)
- **Third Level**: `/api/v1/twilio/ivr/menu?path=1.2.1` (pressed 1, then 2, then 1)

Path accumulates as user navigates deeper. Each level generates TwiML with current menu's greeting and options.

**Note**: These are Twilio webhook endpoints (public, no JWT auth). For authenticated REST API endpoints to manage IVR configurations, use `/api/v1/communication/twilio/ivr/*`.

### Validation Errors

| Error | Cause | HTTP Status |
|-------|-------|-------------|
| `Menu depth exceeds maximum of {N} levels` | Nested submenus exceed max_depth | 400 |
| `Circular reference detected: Option ID "{id}" appears multiple times` | Duplicate UUID in tree | 400 |
| `Total menu options ({N}) exceeds maximum of 100` | Too many nodes across tree | 400 |
| `Digits must be unique within each submenu level` | Duplicate digit at same level | 400 |
| `Option has submenu action but no submenu configuration` | Missing submenu object | 400 |
| `Option has submenu configuration but action is not submenu` | Action/config mismatch | 400 |
| `Invalid menu path: digit "{digit}" not found` | Invalid path during call | 404 |

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

## SMS Sending Endpoints

**Sprint 2 - Direct SMS Sending + Sprint 4 - SMS Scheduling**

### Purpose

Lead360 provides REST endpoints for sending SMS messages directly from the frontend UI. Users can send SMS immediately OR schedule them for future delivery.

**Key Features:**
- Send SMS to Lead (auto-fills phone from Lead's primary phone)
- Send SMS to custom phone number
- **Schedule SMS for future delivery** (NEW: Sprint 4)
- **View and manage scheduled SMS** (NEW: Sprint 4)
- Link SMS to related entities (quote, invoice, etc.)
- TCPA compliance (automatic opt-out check)
- Multi-tenant isolation (Lead ownership verification)
- Message queuing via BullMQ for reliable delivery
- Delivery tracking via communication_event

**TCPA Compliance:**
- Automatically checks if Lead has opted out (replied STOP)
- Blocks SMS to opted-out recipients
- Returns 403 Forbidden if opt-out detected

**Multi-Tenant Security:**
- Lead ownership verified automatically
- Cannot send to Leads from other tenants
- All queries filtered by tenant_id from JWT

---

### 1. POST /communication/sms/send

**Send SMS to a recipient**

Sends an SMS message to a phone number or Lead. Message is queued for delivery via Twilio. Use `communication_event_id` to track delivery status via `/communication/history/:id` endpoint.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager, Sales

**Multi-Tenant Isolation**: Automatically filtered by `req.user.tenant_id` from JWT

#### Request Body

```json
{
  "to_phone": "+12025551234",
  "text_body": "Hi John, your quote is ready! View it here: https://...",
  "related_entity_type": "quote",
  "related_entity_id": "uuid",
  "lead_id": "uuid",
  "scheduled_at": "2026-02-14T09:00:00Z"
}
```

#### Request Body Fields

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `to_phone` | string | Conditional | E.164 format (`^\+[1-9]\d{1,14}$`) | Recipient phone number. Required if `lead_id` not provided or Lead has no phone. |
| `text_body` | string | Yes | Max 1600 chars | SMS message body. Twilio will segment if longer than 160 chars. |
| `related_entity_type` | string | No | - | Entity type (lead, quote, invoice, etc.) for tracking purposes. |
| `related_entity_id` | string (UUID) | No | Valid UUID v4 | Related entity UUID for linking SMS to business record. |
| `lead_id` | string (UUID) | No | Valid UUID v4 | Lead UUID. If provided, system will auto-fill `to_phone` from Lead's primary phone. |
| `scheduled_at` | string | No | ISO 8601 format, future date, max 90 days ahead | **NEW (Sprint 4):** Schedule SMS for future delivery. If omitted, SMS sends immediately. Must be in the future and within 90 days. |

**Usage Notes:**
- **Phone Number**: Provide either `to_phone` directly OR `lead_id` (which auto-fills from Lead's primary phone). If both provided, `to_phone` takes precedence.
- **Lead Lookup**: If `lead_id` is provided, system verifies Lead belongs to your tenant (multi-tenant isolation).
- **Opt-Out Check**: If sending to a Lead, system automatically checks if Lead opted out (replied STOP). If opted out, returns 403 Forbidden.
- **Message Segmentation**: Messages up to 160 characters = 1 segment. Longer messages are segmented (up to 1600 chars supported).
- **Scheduling (Sprint 4)**: Include `scheduled_at` to schedule SMS for future delivery. Omit for immediate delivery. Scheduled SMS can be cancelled before sending (see below).

#### Success Response (201 Created)

**Immediate Sending:**
```json
{
  "communication_event_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "job_id": "sms-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "queued",
  "message": "SMS queued for delivery",
  "to_phone": "+12025551234",
  "from_phone": "+19781234567"
}
```

**Scheduled Sending (Sprint 4):**
```json
{
  "communication_event_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "job_id": "sms-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "scheduled",
  "message": "SMS scheduled for delivery at 2026-02-14T09:00:00.000Z",
  "to_phone": "+12025551234",
  "from_phone": "+19781234567",
  "scheduled_at": "2026-02-14T09:00:00.000Z"
}
```

**Response Fields:**
- `communication_event_id`: UUID for tracking delivery status via `/communication/history/:id`
- `job_id`: BullMQ job ID for internal tracking (format: `sms-{communicationEventId}`)
- `status`: Either `"queued"` (immediate) or `"scheduled"` (future delivery)
- `message`: Confirmation message (includes scheduled time if applicable)
- `to_phone`: Recipient phone number (E.164 format)
- `from_phone`: Sender phone number from tenant's SMS config
- `scheduled_at`: **(Optional)** Scheduled delivery time (ISO 8601). Only present if SMS is scheduled.

**Delivery Tracking:**
After receiving response, track delivery status via:
```bash
GET /communication/history/{communication_event_id}
```

**Status Progression (Immediate):**
1. `pending` → SMS queued
2. `sent` → Sent to Twilio
3. `delivered` → Delivered to recipient (webhook confirmation)
4. `failed` → Delivery failed (error_message contains details)

**Status Progression (Scheduled - Sprint 4):**
1. `scheduled` → SMS queued for future delivery
2. `sent` → Sent to Twilio (at scheduled time)
3. `delivered` → Delivered to recipient (webhook confirmation)
4. `cancelled` → Scheduled SMS was cancelled before sending
5. `failed` → Delivery failed (error_message contains details)

#### Error Responses

**400 Bad Request** - Validation error, missing phone, or unverified config

```json
{
  "statusCode": 400,
  "message": "Phone number must be in E.164 format (e.g., +12025551234)",
  "error": "Bad Request"
}
```

**Common 400 errors:**
- Phone number not in E.164 format
- SMS message exceeds 1600 characters
- No phone number provided (neither `to_phone` nor `lead_id` with phone)
- SMS configuration not verified
- **Scheduling errors (Sprint 4):**
  - `scheduled_at` is in the past
  - `scheduled_at` is more than 90 days in the future
  - `scheduled_at` is not a valid ISO 8601 date string

**403 Forbidden** - Recipient opted out or insufficient permissions

```json
{
  "statusCode": 403,
  "message": "Cannot send SMS: recipient has opted out (replied STOP)",
  "error": "Forbidden"
}
```

**Common 403 errors:**
- Lead has opted out of SMS (replied STOP)
- User role not authorized (e.g., Employee role)

**404 Not Found** - No SMS config or Lead not found

```json
{
  "statusCode": 404,
  "message": "No active SMS configuration found. Please configure Twilio settings first.",
  "error": "Not Found"
}
```

**Common 404 errors:**
- No active SMS configuration for tenant
- Lead not found or doesn't belong to tenant

#### Example Requests

**Example 1: Send SMS to Lead (auto-fill phone)**

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/sms/send" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "text_body": "Hi! Your quote is ready. View it here: https://app.lead360.app/quotes/123"
  }'
```

**Example 2: Send SMS to custom phone number**

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/sms/send" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "to_phone": "+12025551234",
    "text_body": "Test message from Lead360"
  }'
```

**Example 3: Send SMS linked to Quote**

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/sms/send" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "text_body": "Your quote #123 is approved! We'll start work next Monday.",
    "related_entity_type": "quote",
    "related_entity_id": "quote-uuid-here"
  }'
```

**Example 4: Schedule SMS for future delivery (Sprint 4)**

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/sms/send" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..." \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "text_body": "Reminder: Your appointment is tomorrow at 9 AM!",
    "scheduled_at": "2026-02-14T09:00:00Z"
  }'
```

**Response (scheduled):**
```json
{
  "communication_event_id": "uuid",
  "job_id": "sms-uuid",
  "status": "scheduled",
  "message": "SMS scheduled for delivery at 2026-02-14T09:00:00.000Z",
  "to_phone": "+12025551234",
  "from_phone": "+19781234567",
  "scheduled_at": "2026-02-14T09:00:00.000Z"
}
```

#### Frontend Integration Example

```typescript
// TypeScript example for frontend
async function sendSmsToLead(leadId: string, message: string) {
  const response = await fetch('https://api.lead360.app/api/v1/communication/sms/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lead_id: leadId,
      text_body: message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const result = await response.json();

  // Track delivery status
  console.log(`SMS queued: ${result.communication_event_id}`);

  // Poll for delivery status
  setTimeout(() => checkDeliveryStatus(result.communication_event_id), 5000);

  return result;
}
```

#### Security Considerations

**Multi-Tenant Isolation:**
- System automatically validates Lead belongs to authenticated user's tenant
- Cannot send SMS to Leads from other tenants
- Tenant ID derived from JWT token, never from client input

**TCPA Compliance:**
- Automatically checks opt-out status before sending
- Blocks SMS to recipients who replied STOP
- Maintains opt-out audit trail

**Rate Limiting:**
- API rate limits apply (see [Common Error Responses](#common-error-responses))
- Consider implementing client-side throttling for bulk operations

**Phone Number Validation:**
- All phone numbers must be in E.164 format
- Invalid formats rejected with 400 Bad Request
- Twilio validates numbers before sending

---

### 2. DELETE /communication/sms/scheduled/:id/cancel

**Cancel a scheduled SMS** (Sprint 4)

Cancel a scheduled SMS before it's sent. Only works for SMS with `status='scheduled'`. Once cancelled, the SMS will NOT be sent.

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager, Sales

**Multi-Tenant Isolation**: Automatically filtered by `req.user.tenant_id` from JWT

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Communication event ID of the scheduled SMS |

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Scheduled SMS cancelled"
}
```

#### Error Responses

**404 Not Found** - Scheduled SMS not found or already sent

```json
{
  "statusCode": 404,
  "message": "Scheduled SMS not found or already sent",
  "error": "Not Found"
}
```

**Common 404 scenarios:**
- SMS ID doesn't exist
- SMS doesn't belong to your tenant (multi-tenant isolation)
- SMS status is not `scheduled` (already sent, failed, or cancelled)

#### Example Request

```bash
curl -X DELETE "https://api.lead360.app/api/v1/communication/sms/scheduled/a1b2c3d4-e5f6-7890-abcd-ef1234567890/cancel" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

#### Use Cases

- User scheduled a follow-up SMS but deal closed early
- User made a mistake in message content
- User wants to reschedule (cancel + create new)

#### Security Notes

**Multi-Tenant Isolation:**
- Cannot cancel SMS from other tenants
- System validates SMS belongs to authenticated user's tenant
- Tenant ID derived from JWT token automatically

**Job Removal:**
- Job is removed from BullMQ queue immediately
- If job is already processing, status check prevents sending
- Operation is atomic (status update + job removal)

---

### 3. GET /communication/sms/scheduled

**List scheduled SMS messages** (Sprint 4)

Retrieve a paginated list of all scheduled SMS for your organization. Returns SMS with `status='scheduled'` only, sorted by scheduled delivery time (soonest first).

**Authentication**: Required (Bearer token)

**RBAC**: Owner, Admin, Manager, Sales, Employee

**Multi-Tenant Isolation**: Automatically filtered by `req.user.tenant_id` from JWT

#### Query Parameters

| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `page` | number | No | 1 | >= 1 | Page number for pagination |
| `limit` | number | No | 20 | 1-100 | Number of items per page (max 100) |

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "to_phone": "+12025551234",
      "text_body": "Reminder: Your appointment is tomorrow at 9 AM!",
      "scheduled_at": "2026-02-14T09:00:00.000Z",
      "scheduled_by": "user-uuid",
      "created_at": "2026-02-13T10:00:00.000Z",
      "related_entity_type": "lead",
      "related_entity_id": "lead-uuid"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "to_phone": "+13105559876",
      "text_body": "Your quote is ready for review.",
      "scheduled_at": "2026-02-15T14:30:00.000Z",
      "scheduled_by": "user-uuid",
      "created_at": "2026-02-13T11:00:00.000Z",
      "related_entity_type": "quote",
      "related_entity_id": "quote-uuid"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

#### Response Fields

**data** (array of scheduled SMS):
- `id`: Communication event UUID
- `to_phone`: Recipient phone number (E.164 format)
- `text_body`: SMS message body
- `scheduled_at`: Scheduled delivery time (ISO 8601)
- `scheduled_by`: User UUID who scheduled the SMS
- `created_at`: When SMS was created (ISO 8601)
- `related_entity_type`: Related entity type (lead, quote, etc.)
- `related_entity_id`: Related entity UUID

**meta** (pagination info):
- `total`: Total number of scheduled SMS for tenant
- `page`: Current page number
- `limit`: Items per page

#### Example Requests

**Example 1: Get first page (default limit)**

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/sms/scheduled" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

**Example 2: Get second page with 50 items**

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/sms/scheduled?page=2&limit=50" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

#### Frontend Integration Example

```typescript
// TypeScript example for frontend "Scheduled SMS" dashboard
async function fetchScheduledSms(page: number = 1, limit: number = 20) {
  const response = await fetch(
    `https://api.lead360.app/api/v1/communication/sms/scheduled?page=${page}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch scheduled SMS');
  }

  const result = await response.json();
  return result; // { data: [...], meta: {...} }
}

// Display in UI with cancel button
function renderScheduledSms(sms) {
  return `
    <div class="scheduled-sms">
      <p>To: ${sms.to_phone}</p>
      <p>Message: ${sms.text_body}</p>
      <p>Scheduled: ${new Date(sms.scheduled_at).toLocaleString()}</p>
      <button onclick="cancelSms('${sms.id}')">Cancel</button>
    </div>
  `;
}
```

#### Use Cases

- Display "Upcoming SMS" dashboard for users
- Show scheduled messages on Lead detail page
- Allow users to review and cancel scheduled messages
- Audit trail for scheduled communications

#### Security Notes

**Multi-Tenant Isolation:**
- Only returns SMS for authenticated user's tenant
- Cannot see scheduled SMS from other tenants
- Tenant ID derived from JWT token automatically

**Sorting:**
- Results sorted by `scheduled_at ASC` (soonest first)
- Helps users see most urgent scheduled messages first

**Pagination:**
- Default: 20 items per page
- Maximum: 100 items per page
- Use pagination for large lists to maintain performance

---

## SMS Opt-Out Management Endpoints

**NEW: Sprint 1 - TCPA Compliance**

### Purpose

Lead360 implements TCPA-compliant SMS opt-out management to:
- Honor opt-out requests (STOP keyword) within 24 hours
- Provide clear opt-out mechanism (STOP/UNSUBSCRIBE/CANCEL)
- Block SMS to opted-out Leads
- Support re-subscription (START keyword)
- Maintain opt-out audit trail

**Legal Requirement**: Under TCPA (Telephone Consumer Protection Act), businesses **MUST** honor opt-out requests. Failure to comply can result in fines up to **$1,500 per violation**.

**Supported Keywords**:
- **Opt-Out**: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT
- **Opt-In**: START, UNSTOP, YES
- **Help**: HELP, INFO

### Automatic Processing

**Inbound SMS keywords are automatically detected and processed:**
1. Lead sends "STOP" → Lead marked as `sms_opt_out = true`
2. Auto-reply sent: "You've been unsubscribed from SMS messages. Reply START to resume."
3. Future SMS to this Lead are blocked
4. Lead sends "START" → Lead marked as `sms_opt_out = false`
5. Auto-reply sent: "You've been re-subscribed to SMS messages. Reply STOP to unsubscribe."

---

### 1. GET /communication/sms/opt-outs

**List opted-out Leads for current tenant**

Returns all Leads within your tenant who have opted out of SMS communications.

**RBAC**: Owner, Admin, Manager, Sales, Employee

**Multi-Tenant Isolation**: Automatically filtered by `req.user.tenant_id` from JWT

#### Request

```bash
GET /communication/sms/opt-outs?page=1&limit=20
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Results per page (max: 100) |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "first_name": "John",
      "last_name": "Doe",
      "phone": "+12025551234",
      "phone_type": "mobile",
      "sms_opt_out": true,
      "sms_opt_out_at": "2026-02-13T10:30:00.000Z",
      "sms_opt_out_reason": "User sent: STOP",
      "sms_opt_in_at": null,
      "created_at": "2025-01-15T08:00:00.000Z",
      "updated_at": "2026-02-13T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### Error Responses

**401 Unauthorized** - Invalid or missing JWT token

**403 Forbidden** - Insufficient permissions

#### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/sms/opt-outs?page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

### 2. GET /admin/communication/sms/opt-outs

**List all opted-out Leads (cross-tenant) - Admin Only**

System Admin endpoint to view opted-out Leads across **all tenants** for compliance monitoring.

**RBAC**: SystemAdmin only

**Cross-Tenant Visibility**: Can view opt-outs from all tenants

#### Request

```bash
GET /admin/communication/sms/opt-outs?tenant_id=xyz&page=1&limit=20
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tenant_id` | string | No | - | Filter by specific tenant |
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Results per page (max: 100) |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "tenant123",
      "tenant": {
        "id": "tenant123",
        "company_name": "Acme Services",
        "subdomain": "acme"
      },
      "first_name": "John",
      "last_name": "Doe",
      "phone": "+12025551234",
      "phone_type": "mobile",
      "sms_opt_out": true,
      "sms_opt_out_at": "2026-02-13T10:30:00.000Z",
      "sms_opt_out_reason": "User sent: STOP",
      "sms_opt_in_at": null,
      "created_at": "2025-01-15T08:00:00.000Z",
      "updated_at": "2026-02-13T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 152,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### Error Responses

**401 Unauthorized** - Invalid or missing JWT token

**403 Forbidden** - Requires SystemAdmin role

#### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/communication/sms/opt-outs?tenant_id=tenant123&page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

---

### 3. PATCH /admin/communication/sms/opt-outs/:leadId/opt-in

**Manually opt-in a Lead (override opt-out) - Admin Only**

System Admin can manually re-enable SMS for a Lead who has opted out.

**Use Case**: Customer service resolved complaint, customer agrees to resume SMS.

**IMPORTANT**: This bypasses user's opt-out preference - use **only when customer explicitly requests re-enrollment**.

**RBAC**: SystemAdmin only

#### Request

```bash
PATCH /admin/communication/sms/opt-outs/{leadId}/opt-in?tenant_id={tenantId}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `leadId` | string | Yes | Lead UUID |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_id` | string | Yes | Tenant ID (for multi-tenant isolation) |

#### Response

**200 OK**

```json
{
  "success": true,
  "message": "Lead successfully opted back in to SMS",
  "lead": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "first_name": "John",
    "last_name": "Doe",
    "sms_opt_out": false
  }
}
```

#### Error Responses

**400 Bad Request** - Missing `tenant_id` query parameter

**404 Not Found** - Lead not found for specified tenant

**401 Unauthorized** - Invalid or missing JWT token

**403 Forbidden** - Requires SystemAdmin role

#### Example Request

```bash
curl -X PATCH "https://api.lead360.app/api/v1/admin/communication/sms/opt-outs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/opt-in?tenant_id=tenant123" \
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

### Lead SMS Opt-Out Fields (NEW - TCPA Compliance)

**Added in Sprint 1: SMS Opt-Out Management**

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `sms_opt_out` | boolean | No | false | Whether Lead has opted out of SMS |
| `sms_opt_out_at` | datetime | Yes | null | Timestamp when Lead opted out |
| `sms_opt_in_at` | datetime | Yes | null | Timestamp when Lead opted back in |
| `sms_opt_out_reason` | string(255) | Yes | null | Reason for opt-out (e.g., "User sent: STOP") |

**Usage**:
- When Lead sends "STOP" → `sms_opt_out = true`, `sms_opt_out_at = now()`, `sms_opt_out_reason = "User sent: STOP"`
- When Lead sends "START" → `sms_opt_out = false`, `sms_opt_in_at = now()`, `sms_opt_out_reason = null`
- SMS sending is automatically blocked for Leads where `sms_opt_out = true`

**Index**: `idx_lead_sms_opt_out` on `(tenant_id, sms_opt_out)` for efficient opt-out queries

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
