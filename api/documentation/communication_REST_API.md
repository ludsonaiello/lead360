# Communication Module - REST API Documentation

**Version**: 1.0
**Last Updated**: January 18, 2026
**Base URL**: `https://api.lead360.app/api/v1`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Common Response Formats](#common-response-formats)
4. [Error Codes](#error-codes)
5. [Endpoints Overview](#endpoints-overview)
6. [Provider Management (Admin)](#provider-management-admin)
7. [Platform Email Config (Admin)](#platform-email-config-admin)
8. [Tenant Email Configuration](#tenant-email-configuration)
9. [Email Templates](#email-templates)
10. [Send Email](#send-email)
11. [Communication History](#communication-history)
12. [Notifications](#notifications)
13. [Notification Rules](#notification-rules)
14. [Webhooks](#webhooks)

---

## Overview

The Communication Module provides a comprehensive multi-provider communication system supporting:

- **Email** via SendGrid, Amazon SES, Brevo, SMTP
- **SMS** via Twilio
- **WhatsApp** via Twilio
- **In-App Notifications** with rule-based automation
- **Webhook Status Tracking** for delivery/bounce/open events

### Key Features

- **Provider Registry Pattern**: JSON Schema-validated provider configurations
- **Multi-Tenant Isolation**: Complete data separation per tenant
- **Template System**: Handlebars-based email templates with variables
- **Webhook Processing**: Real-time status updates from providers
- **Notification Automation**: Rule-based in-app and email notifications

---

## Authentication

All endpoints (except webhooks) require JWT authentication.

### Request Header

```http
Authorization: Bearer {jwt_token}
```

### Tenant Resolution

The tenant is automatically extracted from the JWT token. Users can only access data for their own tenant.

---

## Common Response Formats

### Success Response (200 OK)

```json
{
  "id": "resource-id",
  "...": "resource fields"
}
```

### Created Response (201 Created)

```json
{
  "id": "new-resource-id",
  "...": "resource fields",
  "created_at": "2026-01-18T10:00:00.000Z"
}
```

### No Content (204 No Content)

Empty response body for successful deletions.

---

## Error Codes

| Status Code | Meaning | When It Occurs |
|-------------|---------|----------------|
| 400 | Bad Request | Invalid input, validation failure |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Insufficient permissions (RBAC) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource (e.g., provider_key already exists) |
| 500 | Internal Server Error | Unexpected server error |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "field_name": "Error description"
  }
}
```

---

## Endpoints Overview

| # | Method | Endpoint | Description | Auth | RBAC |
|---|--------|----------|-------------|------|------|
| **PROVIDER MANAGEMENT (Admin)** |
| 1 | GET | `/admin/communication/providers` | List all providers | Admin | Platform Admin |
| 2 | GET | `/admin/communication/providers/:key` | Get provider details | Admin | Platform Admin |
| 3 | POST | `/admin/communication/providers` | Create custom provider | Admin | Platform Admin |
| 4 | PATCH | `/admin/communication/providers/:key` | Update provider | Admin | Platform Admin |
| 5 | PATCH | `/admin/communication/providers/:key/toggle` | Toggle provider status | Admin | Platform Admin |
| 6 | DELETE | `/admin/communication/providers/:key` | Delete provider | Admin | Platform Admin |
| 7 | GET | `/admin/communication/providers/:key/stats` | Get provider statistics | Admin | Platform Admin |
| **PLATFORM EMAIL CONFIG (Admin)** |
| 8 | GET | `/admin/communication/platform-email-config` | Get platform email config | Admin | Platform Admin |
| 9 | POST | `/admin/communication/platform-email-config` | Update platform config | Admin | Platform Admin |
| 10 | POST | `/admin/communication/platform-email-config/test` | Test platform email | Admin | Platform Admin |
| **TENANT EMAIL CONFIGURATION** |
| 11 | GET | `/communication/tenant-email-config/providers` | List available providers | JWT | All Roles |
| 12 | GET | `/communication/tenant-email-config` | Get tenant email config | JWT | All Roles |
| 13 | POST | `/communication/tenant-email-config` | Create/update config | JWT | Owner, Admin |
| 14 | POST | `/communication/tenant-email-config/test` | Send test email | JWT | Owner, Admin |
| **EMAIL TEMPLATES** |
| 15 | GET | `/communication/templates` | List templates | JWT | All Roles |
| 16 | GET | `/communication/templates/:key` | Get template details | JWT | All Roles |
| 17 | POST | `/communication/templates` | Create template | JWT | Owner, Admin |
| 18 | PATCH | `/communication/templates/:key` | Update template | JWT | Owner, Admin |
| 19 | DELETE | `/communication/templates/:key` | Delete template | JWT | Owner, Admin |
| 20 | POST | `/communication/templates/:key/preview` | Preview template | JWT | All Roles |
| 21 | GET | `/communication/templates/variables/registry` | Get variable registry | JWT | All Roles |
| 22 | POST | `/communication/templates/validate` | Validate template syntax | JWT | All Roles |
| **SEND EMAIL** |
| 23 | POST | `/communication/send-email/templated` | Send templated email | JWT | Owner, Admin, Manager, Sales |
| 24 | POST | `/communication/send-email/raw` | Send raw email | JWT | Owner, Admin, Manager, Sales |
| **COMMUNICATION HISTORY** |
| 25 | GET | `/communication/history` | List communications | JWT | All Roles |
| 26 | GET | `/communication/history/:id` | Get event details | JWT | All Roles |
| 27 | POST | `/communication/history/:id/resend` | Resend failed email | JWT | Owner, Admin |
| **NOTIFICATIONS** |
| 28 | GET | `/communication/notifications` | List user notifications | JWT | All Roles |
| 29 | GET | `/communication/notifications/unread-count` | Get unread count | JWT | All Roles |
| 30 | PATCH | `/communication/notifications/:id/read` | Mark as read | JWT | All Roles |
| 31 | POST | `/communication/notifications/mark-all-read` | Mark all read | JWT | All Roles |
| 32 | DELETE | `/communication/notifications/:id` | Delete notification | JWT | All Roles |
| **NOTIFICATION RULES** |
| 33 | GET | `/communication/notification-rules` | List rules | JWT | Owner, Admin |
| 34 | POST | `/communication/notification-rules` | Create rule | JWT | Owner, Admin |
| 35 | PATCH | `/communication/notification-rules/:id` | Update rule | JWT | Owner, Admin |
| 36 | DELETE | `/communication/notification-rules/:id` | Delete rule | JWT | Owner, Admin |
| **WEBHOOKS (Public)** |
| 37 | POST | `/webhooks/communication/sendgrid` | SendGrid webhook | Public | None |
| 38 | POST | `/webhooks/communication/amazon-ses` | Amazon SES webhook | Public | None |
| 39 | POST | `/webhooks/communication/brevo` | Brevo webhook | Public | None |
| 40 | POST | `/webhooks/communication/twilio-sms` | Twilio SMS webhook | Public | None |
| 41 | POST | `/webhooks/communication/twilio-whatsapp` | Twilio WhatsApp webhook | Public | None |

**Total**: 41 Endpoints

---

## Provider Management (Admin)

All provider management endpoints require **Platform Admin** access.

### 1. List All Providers

**Endpoint**: `GET /admin/communication/providers`

**Description**: Retrieve all communication providers (active and inactive)

**Authentication**: Required (Bearer token) - Platform Admin only

**Query Parameters**:

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| type | string | No | - | Filter by provider type (`email`, `sms`, `whatsapp`) | `email` |
| is_active | boolean | No | - | Filter by active status | `true` |
| include_system | boolean | No | `true` | Include system providers | `false` |

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/communication/providers?type=email&is_active=true" \
  -H "Authorization: Bearer {admin_token}"
```

**Success Response** (200 OK):

```json
[
  {
    "id": "prov-sendgrid-001",
    "provider_key": "sendgrid",
    "provider_name": "SendGrid",
    "provider_type": "email",
    "credentials_schema": {
      "type": "object",
      "properties": {
        "api_key": {
          "type": "string",
          "pattern": "^SG\\.",
          "description": "SendGrid API Key"
        }
      },
      "required": ["api_key"]
    },
    "config_schema": {
      "type": "object",
      "properties": {
        "click_tracking": { "type": "boolean", "default": false },
        "open_tracking": { "type": "boolean", "default": false }
      }
    },
    "default_config": {
      "click_tracking": false,
      "open_tracking": false
    },
    "supports_webhooks": true,
    "webhook_events": ["delivered", "bounced", "opened", "clicked"],
    "webhook_verification_method": "signature",
    "documentation_url": "https://docs.sendgrid.com",
    "logo_url": null,
    "is_active": true,
    "is_system": true,
    "created_at": "2026-01-18T00:00:00.000Z",
    "updated_at": "2026-01-18T00:00:00.000Z",
    "_count": {
      "platform_email_configs": 1,
      "tenant_email_configs": 15,
      "communication_events": 5420
    }
  }
]
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Provider unique identifier |
| provider_key | string | Unique key for API lookups (e.g., `sendgrid`) |
| provider_name | string | Display name (e.g., `SendGrid`) |
| provider_type | enum | Provider type: `email`, `sms`, `whatsapp` |
| credentials_schema | object (JSON Schema) | Validation schema for credentials |
| config_schema | object (JSON Schema) | Validation schema for configuration |
| default_config | object | Default configuration values |
| supports_webhooks | boolean | Whether provider supports webhooks |
| webhook_events | array | Supported webhook events |
| webhook_verification_method | string | Verification method: `signature`, `token`, `ip_whitelist` |
| documentation_url | string \| null | Link to provider documentation |
| logo_url | string \| null | Provider logo URL |
| is_active | boolean | Whether provider is enabled |
| is_system | boolean | Whether provider is system-managed (cannot delete) |
| created_at | string (ISO 8601) | Creation timestamp |
| updated_at | string (ISO 8601) | Last update timestamp |
| _count.platform_email_configs | number | Count of platform configs using this provider |
| _count.tenant_email_configs | number | Count of tenant configs using this provider |
| _count.communication_events | number | Total events sent via this provider |

**Error Responses**:

**401 Unauthorized**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden** (non-admin user):
```json
{
  "statusCode": 403,
  "message": "Access denied. Platform admin access required."
}
```

---

### 2. Get Provider Details

**Endpoint**: `GET /admin/communication/providers/:key`

**Description**: Get detailed information about a specific provider

**Authentication**: Required - Platform Admin only

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| key | string | Yes | Provider key | `sendgrid` |

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/communication/providers/sendgrid" \
  -H "Authorization: Bearer {admin_token}"
```

**Success Response** (200 OK):

```json
{
  "id": "prov-sendgrid-001",
  "provider_key": "sendgrid",
  "provider_name": "SendGrid",
  "provider_type": "email",
  "credentials_schema": {
    "type": "object",
    "properties": {
      "api_key": {
        "type": "string",
        "pattern": "^SG\\.",
        "description": "SendGrid API Key starting with 'SG.'"
      }
    },
    "required": ["api_key"]
  },
  "config_schema": {
    "type": "object",
    "properties": {
      "click_tracking": {
        "type": "boolean",
        "default": false,
        "description": "Enable click tracking in emails"
      },
      "open_tracking": {
        "type": "boolean",
        "default": false,
        "description": "Enable open tracking in emails"
      }
    }
  },
  "default_config": {
    "click_tracking": false,
    "open_tracking": false
  },
  "supports_webhooks": true,
  "webhook_events": ["delivered", "bounced", "opened", "clicked", "spam_report"],
  "webhook_verification_method": "signature",
  "documentation_url": "https://docs.sendgrid.com",
  "logo_url": null,
  "is_active": true,
  "is_system": true,
  "created_at": "2026-01-18T00:00:00.000Z",
  "updated_at": "2026-01-18T00:00:00.000Z"
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Provider with key 'invalid-key' not found"
}
```

---

### 3. Create Custom Provider

**Endpoint**: `POST /admin/communication/providers`

**Description**: Create a new custom communication provider

**Authentication**: Required - Platform Admin only

**Request Body**:

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| provider_key | string | Yes | Alphanumeric + underscore only, unique | Unique provider key | `"custom_smtp"` |
| provider_name | string | Yes | 3-100 chars | Display name | `"Custom SMTP Server"` |
| provider_type | enum | Yes | `email`, `sms`, `whatsapp` | Provider type | `"email"` |
| credentials_schema | object | Yes | Valid JSON Schema | Credentials validation schema | See example below |
| config_schema | object | No | Valid JSON Schema | Configuration validation schema | See example below |
| default_config | object | No | Must match config_schema | Default configuration | `{"timeout": 30}` |
| supports_webhooks | boolean | Yes | - | Whether provider supports webhooks | `false` |
| webhook_events | array | No | Required if supports_webhooks=true | Supported webhook events | `["delivered", "bounced"]` |
| webhook_verification_method | string | No | `signature`, `token`, `ip_whitelist` | Webhook verification method | `"signature"` |
| documentation_url | string | No | Valid URL | Provider documentation link | `"https://docs.example.com"` |
| logo_url | string | No | Valid URL | Provider logo | `null` |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/communication/providers" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_key": "custom_smtp",
    "provider_name": "Custom SMTP Server",
    "provider_type": "email",
    "credentials_schema": {
      "type": "object",
      "properties": {
        "smtp_host": { "type": "string", "description": "SMTP server hostname" },
        "smtp_port": { "type": "number", "minimum": 1, "maximum": 65535 },
        "smtp_username": { "type": "string" },
        "smtp_password": { "type": "string" },
        "smtp_secure": { "type": "boolean", "default": true }
      },
      "required": ["smtp_host", "smtp_port", "smtp_username", "smtp_password"]
    },
    "config_schema": {
      "type": "object",
      "properties": {
        "timeout": { "type": "number", "default": 30, "minimum": 5, "maximum": 120 }
      }
    },
    "default_config": {
      "timeout": 30
    },
    "supports_webhooks": false,
    "documentation_url": "https://docs.example.com/smtp"
  }'
```

**Success Response** (201 Created):

```json
{
  "id": "prov-custom-smtp-abc123",
  "provider_key": "custom_smtp",
  "provider_name": "Custom SMTP Server",
  "provider_type": "email",
  "credentials_schema": {
    "type": "object",
    "properties": {
      "smtp_host": { "type": "string", "description": "SMTP server hostname" },
      "smtp_port": { "type": "number", "minimum": 1, "maximum": 65535 },
      "smtp_username": { "type": "string" },
      "smtp_password": { "type": "string" },
      "smtp_secure": { "type": "boolean", "default": true }
    },
    "required": ["smtp_host", "smtp_port", "smtp_username", "smtp_password"]
  },
  "config_schema": {
    "type": "object",
    "properties": {
      "timeout": { "type": "number", "default": 30, "minimum": 5, "maximum": 120 }
    }
  },
  "default_config": {
    "timeout": 30
  },
  "supports_webhooks": false,
  "webhook_events": null,
  "webhook_verification_method": null,
  "documentation_url": "https://docs.example.com/smtp",
  "logo_url": null,
  "is_active": true,
  "is_system": false,
  "created_at": "2026-01-18T10:30:00.000Z",
  "updated_at": "2026-01-18T10:30:00.000Z"
}
```

**Error Responses**:

**400 Bad Request** (validation error):
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "provider_key": "Must contain only alphanumeric characters and underscores",
    "credentials_schema": "Must be a valid JSON Schema object"
  }
}
```

**409 Conflict** (duplicate provider_key):
```json
{
  "statusCode": 409,
  "message": "Provider with key 'custom_smtp' already exists"
}
```

---

### 4. Update Provider

**Endpoint**: `PATCH /admin/communication/providers/:key`

**Description**: Update an existing provider's configuration

**Authentication**: Required - Platform Admin only

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| key | string | Yes | Provider key | `custom_smtp` |

**Request Body** (all fields optional):

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| provider_name | string | Display name | `"Updated SMTP"` |
| credentials_schema | object | New credentials schema | See create example |
| config_schema | object | New config schema | See create example |
| default_config | object | New default config | `{"timeout": 60}` |
| supports_webhooks | boolean | Webhook support | `true` |
| webhook_events | array | Webhook events | `["delivered"]` |
| webhook_verification_method | string | Verification method | `"token"` |
| documentation_url | string | Documentation link | `"https://new-url.com"` |
| logo_url | string | Logo URL | `"https://logo.com/img.png"` |
| is_active | boolean | Active status | `false` |

**Request Example**:

```bash
curl -X PATCH "https://api.lead360.app/api/v1/admin/communication/providers/custom_smtp" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_name": "Updated Custom SMTP",
    "default_config": {
      "timeout": 60
    },
    "documentation_url": "https://updated-docs.example.com"
  }'
```

**Success Response** (200 OK):

```json
{
  "id": "prov-custom-smtp-abc123",
  "provider_key": "custom_smtp",
  "provider_name": "Updated Custom SMTP",
  "provider_type": "email",
  "credentials_schema": { "...": "unchanged" },
  "config_schema": { "...": "unchanged" },
  "default_config": {
    "timeout": 60
  },
  "supports_webhooks": false,
  "webhook_events": null,
  "webhook_verification_method": null,
  "documentation_url": "https://updated-docs.example.com",
  "logo_url": null,
  "is_active": true,
  "is_system": false,
  "created_at": "2026-01-18T10:30:00.000Z",
  "updated_at": "2026-01-18T11:00:00.000Z"
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Provider with key 'nonexistent' not found"
}
```

---

### 5. Toggle Provider Status

**Endpoint**: `PATCH /admin/communication/providers/:key/toggle`

**Description**: Toggle a provider's active/inactive status

**Authentication**: Required - Platform Admin only

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| key | string | Yes | Provider key | `custom_smtp` |

**Request Body**: None

**Request Example**:

```bash
curl -X PATCH "https://api.lead360.app/api/v1/admin/communication/providers/custom_smtp/toggle" \
  -H "Authorization: Bearer {admin_token}"
```

**Success Response** (200 OK):

```json
{
  "id": "prov-custom-smtp-abc123",
  "provider_key": "custom_smtp",
  "provider_name": "Custom SMTP Server",
  "provider_type": "email",
  "is_active": false,
  "...": "other fields"
}
```

**Error Responses**:

**400 Bad Request** (system provider):
```json
{
  "statusCode": 400,
  "message": "System providers cannot be deactivated"
}
```

---

### 6. Delete Provider

**Endpoint**: `DELETE /admin/communication/providers/:key`

**Description**: Delete a custom provider (system providers cannot be deleted)

**Authentication**: Required - Platform Admin only

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| key | string | Yes | Provider key | `custom_smtp` |

**Request Example**:

```bash
curl -X DELETE "https://api.lead360.app/api/v1/admin/communication/providers/custom_smtp" \
  -H "Authorization: Bearer {admin_token}"
```

**Success Response** (204 No Content)

No response body.

**Error Responses**:

**400 Bad Request** (system provider):
```json
{
  "statusCode": 400,
  "message": "System providers cannot be deleted"
}
```

**400 Bad Request** (provider in use):
```json
{
  "statusCode": 400,
  "message": "Cannot delete provider that is currently in use"
}
```

---

### 7. Get Provider Statistics

**Endpoint**: `GET /admin/communication/providers/:key/stats`

**Description**: Get usage statistics for a provider

**Authentication**: Required - Platform Admin only

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| key | string | Yes | Provider key | `sendgrid` |

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/communication/providers/sendgrid/stats" \
  -H "Authorization: Bearer {admin_token}"
```

**Success Response** (200 OK):

```json
{
  "provider": {
    "id": "prov-sendgrid-001",
    "provider_key": "sendgrid",
    "provider_name": "SendGrid",
    "provider_type": "email",
    "is_active": true,
    "...": "other provider fields"
  },
  "platform_configs": 1,
  "tenant_configs": 15,
  "total_events": 5420,
  "events_last_24h": 237
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| provider | object | Full provider object |
| platform_configs | number | Count of platform email configs using this provider |
| tenant_configs | number | Count of tenant email configs using this provider |
| total_events | number | Total communication events sent via this provider |
| events_last_24h | number | Events sent in last 24 hours |

---

## Platform Email Config (Admin)

Platform email configuration is used for system emails (password reset, welcome emails, etc.).

### 8. Get Platform Email Config

**Endpoint**: `GET /admin/communication/platform-email-config`

**Description**: Get the current platform-wide email configuration

**Authentication**: Required - Platform Admin only

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/communication/platform-email-config" \
  -H "Authorization: Bearer {admin_token}"
```

**Success Response** (200 OK):

```json
{
  "id": "platform-email-config-001",
  "provider_id": "prov-sendgrid-001",
  "provider": {
    "provider_key": "sendgrid",
    "provider_name": "SendGrid",
    "provider_type": "email"
  },
  "provider_config": {
    "click_tracking": false,
    "open_tracking": true
  },
  "smtp_host": null,
  "smtp_port": null,
  "smtp_encryption": null,
  "smtp_username": null,
  "from_email": "noreply@lead360.app",
  "from_name": "Lead360 Platform",
  "webhook_secret": null,
  "is_verified": true,
  "updated_at": "2026-01-18T10:00:00.000Z",
  "updated_by_user_id": "user-platform-admin-001"
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Configuration ID |
| provider_id | string (uuid) \| null | Provider being used (null if SMTP) |
| provider.provider_key | string | Provider key (e.g., `sendgrid`, `smtp`) |
| provider.provider_name | string | Provider display name |
| provider.provider_type | string | Always `"email"` |
| provider_config | object | Provider-specific configuration |
| smtp_host | string \| null | SMTP server hostname (only for SMTP provider) |
| smtp_port | integer \| null | SMTP server port (only for SMTP provider) |
| smtp_encryption | string \| null | Encryption method: `tls`, `ssl`, or `none` (SMTP only) |
| smtp_username | string \| null | SMTP username (SMTP only) |
| from_email | string | Default sender email |
| from_name | string | Default sender name |
| webhook_secret | string \| null | Webhook verification secret (hidden in response) |
| is_verified | boolean | Whether test email succeeded |
| updated_at | string (ISO 8601) | Last update timestamp |
| updated_by_user_id | string (uuid) \| null | User who last updated config |

**Note**: The `credentials` field is **never** returned in API responses (always encrypted).

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Platform email configuration not found"
}
```

---

### 9. Update Platform Email Config

**Endpoint**: `POST /admin/communication/platform-email-config`

**Description**: Create or update platform-wide email configuration

**Authentication**: Required - Platform Admin only

**Request Body**:

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| provider_id | string (uuid) | Yes | Must be active email provider | Provider to use | `"prov-sendgrid-001"` |
| credentials | object | Yes | Must match provider's credentials_schema | Provider API credentials | `{"api_key": "SG.xxx"}` |
| provider_config | object | No | Must match provider's config_schema | Provider-specific settings | `{"click_tracking": false}` |
| from_email | string | Yes | Valid email format | Sender email | `"noreply@lead360.app"` |
| from_name | string | Yes | 2-100 chars | Sender name | `"Lead360 Platform"` |
| webhook_secret | string | No | Min 16 chars (if webhooks supported) | Webhook verification secret | `"webhook_secret_xyz"` |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/communication/platform-email-config" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "prov-sendgrid-001",
    "credentials": {
      "api_key": "SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    },
    "provider_config": {
      "click_tracking": false,
      "open_tracking": true
    },
    "from_email": "noreply@lead360.app",
    "from_name": "Lead360 Platform",
    "webhook_secret": "my_webhook_secret_12345"
  }'
```

**Success Response** (201 Created or 200 OK):

```json
{
  "id": "platform-email-config-001",
  "provider_id": "prov-sendgrid-001",
  "provider": {
    "provider_key": "sendgrid",
    "provider_name": "SendGrid"
  },
  "provider_config": {
    "click_tracking": false,
    "open_tracking": true
  },
  "smtp_host": null,
  "smtp_port": null,
  "smtp_encryption": null,
  "smtp_username": null,
  "from_email": "noreply@lead360.app",
  "from_name": "Lead360 Platform",
  "is_verified": false,
  "updated_at": "2026-01-18T12:00:00.000Z",
  "updated_by_user_id": "user-platform-admin-001"
}
```

**Error Responses**:

**400 Bad Request** (provider inactive):
```json
{
  "statusCode": 400,
  "message": "Provider SendGrid is not active"
}
```

**400 Bad Request** (validation error):
```json
{
  "statusCode": 400,
  "message": "Invalid provider credentials or configuration",
  "errors": {
    "credentials.api_key": "API key must start with 'SG.'",
    "provider_config.click_tracking": "Must be a boolean"
  }
}
```

---

### 10. Test Platform Email

**Endpoint**: `POST /admin/communication/platform-email-config/test`

**Description**: Send a test email using platform configuration

**Authentication**: Required - Platform Admin only

**Request Body**:

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| to | string | Yes | Valid email format | Recipient email | `"admin@example.com"` |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/communication/platform-email-config/test" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "admin@example.com"
  }'
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Test email sent successfully",
  "provider_response": {
    "messageId": "abc123-sendgrid-message-id"
  }
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Platform email configuration not found"
}
```

**400 Bad Request** (sending failed):
```json
{
  "statusCode": 400,
  "message": "Failed to send test email",
  "error": "SMTP authentication failed",
  "provider": "SendGrid"
}
```

---

## Tenant Email Configuration

Tenant-specific email configuration allows each business to use their own email provider.

### 11. List Available Providers

**Endpoint**: `GET /communication/tenant-email-config/providers`

**Description**: Get list of available email providers that can be configured

**Authentication**: Required (JWT)

**RBAC**: All roles

**Query Parameters**:

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| type | string | No | `email` | Filter by provider type | `email` |

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/tenant-email-config/providers?type=email" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
[
  {
    "id": "prov-sendgrid-001",
    "provider_key": "sendgrid",
    "provider_name": "SendGrid",
    "provider_type": "email",
    "credentials_schema": {
      "type": "object",
      "properties": {
        "api_key": {
          "type": "string",
          "pattern": "^SG\\.",
          "description": "SendGrid API Key starting with 'SG.'"
        }
      },
      "required": ["api_key"]
    },
    "config_schema": {
      "type": "object",
      "properties": {
        "click_tracking": { "type": "boolean", "default": false },
        "open_tracking": { "type": "boolean", "default": false }
      }
    },
    "default_config": {
      "click_tracking": false,
      "open_tracking": false
    },
    "supports_webhooks": true,
    "documentation_url": "https://docs.sendgrid.com"
  },
  {
    "id": "prov-smtp-001",
    "provider_key": "smtp",
    "provider_name": "Generic SMTP",
    "provider_type": "email",
    "credentials_schema": {
      "type": "object",
      "properties": {
        "smtp_host": { "type": "string" },
        "smtp_port": { "type": "number" },
        "smtp_username": { "type": "string" },
        "smtp_password": { "type": "string" },
        "smtp_secure": { "type": "boolean", "default": true }
      },
      "required": ["smtp_host", "smtp_port", "smtp_username", "smtp_password"]
    },
    "config_schema": null,
    "default_config": null,
    "supports_webhooks": false,
    "documentation_url": null
  }
]
```

---

### 12. Get Tenant Email Config

**Endpoint**: `GET /communication/tenant-email-config`

**Description**: Get current tenant's email configuration

**Authentication**: Required (JWT)

**RBAC**: All roles

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/tenant-email-config" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
{
  "id": "tenant-email-001",
  "tenant_id": "tenant-acme-plumbing",
  "provider_id": "prov-sendgrid-001",
  "provider": {
    "id": "prov-sendgrid-001",
    "provider_key": "sendgrid",
    "provider_name": "SendGrid",
    "provider_type": "email"
  },
  "provider_config": {
    "click_tracking": false,
    "open_tracking": true
  },
  "from_email": "info@acmeplumbing.com",
  "from_name": "Acme Plumbing",
  "reply_to_email": "support@acmeplumbing.com",
  "is_verified": true,
  "is_active": true,
  "created_at": "2026-01-18T09:00:00.000Z",
  "updated_at": "2026-01-18T10:00:00.000Z"
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Configuration ID |
| tenant_id | string (uuid) | Tenant identifier (matches JWT) |
| provider_id | string (uuid) | Provider ID |
| provider.id | string (uuid) | Provider ID |
| provider.provider_key | string | Provider key |
| provider.provider_name | string | Provider display name |
| provider.provider_type | string | Always `"email"` |
| provider_config | object | Provider-specific configuration |
| from_email | string | Configured sender email |
| from_name | string | Configured sender name |
| reply_to_email | string \| null | Reply-to email if configured |
| is_verified | boolean | Whether test email succeeded |
| is_active | boolean | Whether config is enabled |
| created_at | string (ISO 8601) | Creation timestamp |
| updated_at | string (ISO 8601) | Last update timestamp |

**Note**: The `credentials` and `webhook_secret` fields are **never** returned.

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Email configuration not found for this tenant"
}
```

---

### 13. Create/Update Tenant Email Config

**Endpoint**: `POST /communication/tenant-email-config`

**Description**: Create or update tenant's email configuration

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin only

**Request Body**:

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| provider_id | string (uuid) | Yes | Valid provider UUID | Provider to use | `"prov-sendgrid-001"` |
| credentials | object | Yes | Must match provider's credentials_schema | Provider API credentials | `{"api_key": "SG.xxx"}` |
| provider_config | object | No | Must match provider's config_schema | Provider-specific settings | `{"click_tracking": false}` |
| from_email | string | Yes | Valid email format | Sender email | `"info@acmeplumbing.com"` |
| from_name | string | Yes | 2-100 chars | Sender name | `"Acme Plumbing"` |
| reply_to_email | string | No | Valid email format | Reply-to email | `"support@acmeplumbing.com"` |
| webhook_secret | string | No | Min 16 chars | Webhook verification secret | `"webhook_secret_xyz"` |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/tenant-email-config" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "prov-sendgrid-001",
    "credentials": {
      "api_key": "SG.xxxxxxxxxxxxxxxxxxx"
    },
    "provider_config": {
      "click_tracking": false,
      "open_tracking": true
    },
    "from_email": "info@acmeplumbing.com",
    "from_name": "Acme Plumbing",
    "reply_to_email": "support@acmeplumbing.com",
    "webhook_secret": "my_secret_key_12345"
  }'
```

**Success Response** (201 Created or 200 OK):

```json
{
  "id": "tenant-email-001",
  "tenant_id": "tenant-acme-plumbing",
  "provider_id": "prov-sendgrid-001",
  "provider": {
    "provider_key": "sendgrid",
    "provider_name": "SendGrid"
  },
  "provider_config": {
    "click_tracking": false,
    "open_tracking": true
  },
  "from_email": "info@acmeplumbing.com",
  "from_name": "Acme Plumbing",
  "reply_to_email": "support@acmeplumbing.com",
  "is_verified": false,
  "is_active": true,
  "created_at": "2026-01-18T10:00:00.000Z",
  "updated_at": "2026-01-18T10:00:00.000Z"
}
```

**Error Responses**:

**400 Bad Request** (validation error):
```json
{
  "statusCode": 400,
  "message": "Invalid provider credentials or configuration",
  "errors": {
    "credentials.api_key": "API key must start with 'SG.'",
    "from_email": "Invalid email format"
  }
}
```

**400 Bad Request** (provider inactive):
```json
{
  "statusCode": 400,
  "message": "Provider SendGrid is not active"
}
```

**400 Bad Request** (wrong provider type):
```json
{
  "statusCode": 400,
  "message": "Provider Twilio SMS is not an email provider"
}
```

**403 Forbidden** (insufficient permissions):
```json
{
  "statusCode": 403,
  "message": "Access denied. Required role: Owner or Admin"
}
```

---

### 14. Send Test Email

**Endpoint**: `POST /communication/tenant-email-config/test`

**Description**: Send a test email to verify tenant's email configuration

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin only

**Request Body**:

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| to | string | Yes | Valid email format | Recipient email | `"owner@acmeplumbing.com"` |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/tenant-email-config/test" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "owner@acmeplumbing.com"
  }'
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Test email sent successfully. Configuration verified.",
  "provider_response": {
    "messageId": "abc123-message-id",
    "provider": "SendGrid"
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Always `true` on success |
| message | string | Success message |
| provider_response.messageId | string | Provider's message ID |
| provider_response.provider | string | Provider name used |

**Note**: When test email succeeds, the config's `is_verified` field is automatically set to `true`.

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Email configuration not found for this tenant"
}
```

**400 Bad Request** (config inactive):
```json
{
  "statusCode": 400,
  "message": "Email configuration is not active"
}
```

**400 Bad Request** (sending failed):
```json
{
  "statusCode": 400,
  "message": "Failed to send test email",
  "error": "Invalid API key",
  "provider": "SendGrid"
}
```

**Note**: When test email fails, the config's `is_verified` field is automatically set to `false`.

---

## Email Templates

Email templates use Handlebars syntax with variable substitution.

### 15. List Email Templates

**Endpoint**: `GET /communication/templates`

**Description**: List all email templates (admin templates + tenant templates)

**Authentication**: Required (JWT)

**RBAC**: All roles

**Query Parameters**:

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| category | string | No | - | Filter by category: `system`, `transactional`, `marketing`, `notification` | `transactional` |
| is_active | boolean | No | - | Filter by active status | `true` |
| search | string | No | - | Search in template_key, subject, description | `password` |
| page | number | No | 1 | Page number | `1` |
| limit | number | No | 20 | Items per page (max 100) | `50` |

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/templates?category=transactional&is_active=true&page=1&limit=20" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
{
  "data": [
    {
      "id": "tmpl-001",
      "tenant_id": null,
      "template_key": "password-reset",
      "template_name": "Password Reset Email",
      "description": "Email sent when user requests password reset",
      "category": "system",
      "subject": "Reset your Lead360 password",
      "html_body": "<!DOCTYPE html><html><body><h1>Password Reset</h1><p>Hello {{user_name}},</p><p>Click the link below to reset your password:</p><a href=\"{{reset_link}}\">Reset Password</a></body></html>",
      "text_body": "Hello {{user_name}},\n\nClick the link below to reset your password:\n{{reset_link}}",
      "variables": {},
      "variable_schema": {
        "type": "object",
        "properties": {
          "user_name": { "type": "string", "description": "User's full name" },
          "reset_link": { "type": "string", "format": "uri", "description": "Password reset link" }
        },
        "required": ["user_name", "reset_link"]
      },
      "is_system": true,
      "is_active": true,
      "created_at": "2026-01-15T00:00:00.000Z",
      "updated_at": "2026-01-18T00:00:00.000Z"
    },
    {
      "id": "tmpl-002",
      "tenant_id": "tenant-acme-plumbing",
      "template_key": "quote-sent",
      "template_name": "Quote Sent to Customer",
      "description": "Email sent when quote is delivered to customer",
      "category": "transactional",
      "subject": "Your quote from {{company_name}}",
      "html_body": "...",
      "text_body": "...",
      "variables": {},
      "variable_schema": {
        "type": "object",
        "properties": {
          "company_name": { "type": "string" },
          "customer_name": { "type": "string" },
          "quote_number": { "type": "string" },
          "quote_total": { "type": "string" },
          "quote_link": { "type": "string", "format": "uri" }
        },
        "required": ["company_name", "customer_name", "quote_number", "quote_total", "quote_link"]
      },
      "is_system": false,
      "is_active": true,
      "created_at": "2026-01-18T08:00:00.000Z",
      "updated_at": "2026-01-18T09:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total_count": 45,
    "total_pages": 3
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| data | array | Array of template objects |
| data[].id | string (uuid) | Template ID |
| data[].tenant_id | string \| null | Tenant ID (null = admin template) |
| data[].template_key | string | Unique template key |
| data[].template_name | string | Display name |
| data[].description | string | Template description |
| data[].category | enum | Category: `system`, `transactional`, `marketing`, `notification` |
| data[].subject | string | Email subject (Handlebars template) |
| data[].html_body | string | HTML email body (Handlebars template) |
| data[].text_body | string \| null | Plain text body (Handlebars template) |
| data[].variables | object (JSON) | Sample/default variables for this template |
| data[].variable_schema | object (JSON Schema) | Variables validation schema |
| data[].is_system | boolean | Whether template is system-managed |
| data[].is_active | boolean | Whether template is enabled |
| data[].created_at | string (ISO 8601) | Creation timestamp |
| data[].updated_at | string (ISO 8601) | Last update timestamp |
| meta.page | number | Current page number |
| meta.limit | number | Items per page |
| meta.total_count | number | Total matching templates |
| meta.total_pages | number | Total pages |

---

### 16. Get Template Details

**Endpoint**: `GET /communication/templates/:key`

**Description**: Get a specific template by key

**Authentication**: Required (JWT)

**RBAC**: All roles

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| key | string | Yes | Template key | `password-reset` |

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/templates/password-reset" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
{
  "id": "tmpl-001",
  "tenant_id": null,
  "template_key": "password-reset",
  "template_name": "Password Reset Email",
  "description": "Email sent when user requests password reset",
  "category": "system",
  "subject": "Reset your Lead360 password",
  "html_body": "<!DOCTYPE html><html><body><h1>Password Reset</h1><p>Hello {{user_name}},</p><p>Click the link below to reset your password:</p><a href=\"{{reset_link}}\">Reset Password</a><p>This link expires in 1 hour.</p></body></html>",
  "text_body": "Hello {{user_name}},\n\nClick the link below to reset your password:\n{{reset_link}}\n\nThis link expires in 1 hour.",
  "variables": {},
  "variable_schema": {
    "type": "object",
    "properties": {
      "user_name": {
        "type": "string",
        "description": "User's full name"
      },
      "reset_link": {
        "type": "string",
        "format": "uri",
        "description": "Password reset link with token"
      }
    },
    "required": ["user_name", "reset_link"]
  },
  "is_system": true,
  "is_active": true,
  "created_at": "2026-01-15T00:00:00.000Z",
  "updated_at": "2026-01-18T00:00:00.000Z"
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Template with key 'nonexistent' not found"
}
```

---

### 17. Create Email Template

**Endpoint**: `POST /communication/templates`

**Description**: Create a new email template

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin only

**Request Body**:

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| template_key | string | Yes | Alphanumeric + hyphens/underscores, unique per tenant | Unique template key | `"quote-sent"` |
| template_name | string | Yes | 3-100 chars | Display name | `"Quote Sent to Customer"` |
| description | string | No | Max 500 chars | Template description | `"Email sent when quote is delivered"` |
| category | enum | Yes | `system`, `transactional`, `marketing`, `notification` | Template category | `"transactional"` |
| subject | string | Yes | 1-500 chars, Handlebars syntax | Email subject line | `"Your quote from {{company_name}}"` |
| html_body | string | Yes | Valid HTML, Handlebars syntax | HTML email body | See example below |
| text_body | string | No | Handlebars syntax | Plain text body | See example below |
| variables | object | No | JSON object | Sample/default variables for this template | `{}` |
| variable_schema | object | Yes | Valid JSON Schema | Variables validation | See example below |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/templates" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "template_key": "quote-sent",
    "template_name": "Quote Sent to Customer",
    "description": "Email sent when quote is delivered to customer",
    "category": "transactional",
    "subject": "Your quote from {{company_name}}",
    "html_body": "<!DOCTYPE html><html><body><h1>Quote from {{company_name}}</h1><p>Hello {{customer_name}},</p><p>Thank you for your request! Quote #{{quote_number}} is ready.</p><p><strong>Total: {{quote_total}}</strong></p><p><a href=\"{{quote_link}}\">View Quote</a></p></body></html>",
    "text_body": "Hello {{customer_name}},\n\nThank you for your request! Quote #{{quote_number}} is ready.\n\nTotal: {{quote_total}}\n\nView your quote here: {{quote_link}}",
    "variables": {},
    "variable_schema": {
      "type": "object",
      "properties": {
        "company_name": { "type": "string", "description": "Tenant company name" },
        "customer_name": { "type": "string", "description": "Customer full name" },
        "quote_number": { "type": "string", "description": "Quote number" },
        "quote_total": { "type": "string", "description": "Formatted quote total" },
        "quote_link": { "type": "string", "format": "uri", "description": "Link to view quote" }
      },
      "required": ["company_name", "customer_name", "quote_number", "quote_total", "quote_link"]
    }
  }'
```

**Success Response** (201 Created):

```json
{
  "id": "tmpl-new-001",
  "tenant_id": "tenant-acme-plumbing",
  "template_key": "quote-sent",
  "template_name": "Quote Sent to Customer",
  "description": "Email sent when quote is delivered to customer",
  "category": "transactional",
  "subject": "Your quote from {{company_name}}",
  "html_body": "...",
  "text_body": "...",
  "variables": {},
  "variable_schema": { "...": "as provided" },
  "is_system": false,
  "is_active": true,
  "created_at": "2026-01-18T12:00:00.000Z",
  "updated_at": "2026-01-18T12:00:00.000Z"
}
```

**Error Responses**:

**400 Bad Request** (validation error):
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "template_key": "Must contain only alphanumeric characters, hyphens, and underscores",
    "html_body": "Invalid Handlebars syntax at line 5"
  }
}
```

**409 Conflict** (duplicate key):
```json
{
  "statusCode": 409,
  "message": "Template with key 'quote-sent' already exists for this tenant"
}
```

---

### 18. Update Email Template

**Endpoint**: `PATCH /communication/templates/:key`

**Description**: Update an existing email template

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin only

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| key | string | Yes | Template key | `quote-sent` |

**Request Body** (all fields optional):

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| template_name | string | Display name | `"Updated Quote Email"` |
| description | string | Description | `"New description"` |
| category | enum | Category | `"marketing"` |
| subject | string | Email subject | `"New subject"` |
| html_body | string | HTML body | See create example |
| text_body | string | Text body | See create example |
| variables | object | Sample/default variables | `{}` |
| variable_schema | object | Variables schema | See create example |
| is_active | boolean | Active status | `false` |

**Request Example**:

```bash
curl -X PATCH "https://api.lead360.app/api/v1/communication/templates/quote-sent" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Your updated quote from {{company_name}}",
    "is_active": true
  }'
```

**Success Response** (200 OK):

```json
{
  "id": "tmpl-new-001",
  "tenant_id": "tenant-acme-plumbing",
  "template_key": "quote-sent",
  "template_name": "Quote Sent to Customer",
  "description": "Email sent when quote is delivered to customer",
  "category": "transactional",
  "subject": "Your updated quote from {{company_name}}",
  "html_body": "...",
  "text_body": "...",
  "variables": {},
  "variable_schema": { "...": "unchanged" },
  "is_system": false,
  "is_active": true,
  "created_at": "2026-01-18T12:00:00.000Z",
  "updated_at": "2026-01-18T13:00:00.000Z"
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Template with key 'nonexistent' not found"
}
```

**400 Bad Request** (cannot modify system template):
```json
{
  "statusCode": 400,
  "message": "System templates cannot be modified"
}
```

---

### 19. Delete Email Template

**Endpoint**: `DELETE /communication/templates/:key`

**Description**: Delete an email template (system templates cannot be deleted)

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin only

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| key | string | Yes | Template key | `quote-sent` |

**Request Example**:

```bash
curl -X DELETE "https://api.lead360.app/api/v1/communication/templates/quote-sent" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (204 No Content)

No response body.

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Template with key 'nonexistent' not found"
}
```

**400 Bad Request** (system template):
```json
{
  "statusCode": 400,
  "message": "System templates cannot be deleted"
}
```

---

### 20. Preview Template with Sample Data

**Endpoint**: `POST /communication/templates/:key/preview`

**Description**: Preview a template rendered with sample variables

**Authentication**: Required (JWT)

**RBAC**: All roles

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| key | string | Yes | Template key | `quote-sent` |

**Request Body**:

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| variables | object | Yes | Sample variables matching template's variable_schema | See example below |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/templates/quote-sent/preview" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "company_name": "Acme Plumbing",
      "customer_name": "John Doe",
      "quote_number": "Q-12345",
      "quote_total": "$1,250.00",
      "quote_link": "https://app.lead360.app/quotes/q-12345"
    }
  }'
```

**Success Response** (200 OK):

```json
{
  "subject": "Your quote from Acme Plumbing",
  "html_body": "<!DOCTYPE html><html><body><h1>Quote from Acme Plumbing</h1><p>Hello John Doe,</p><p>Thank you for your request! Quote #Q-12345 is ready.</p><p><strong>Total: $1,250.00</strong></p><p><a href=\"https://app.lead360.app/quotes/q-12345\">View Quote</a></p></body></html>",
  "text_body": "Hello John Doe,\n\nThank you for your request! Quote #Q-12345 is ready.\n\nTotal: $1,250.00\n\nView your quote here: https://app.lead360.app/quotes/q-12345"
}
```

**Error Responses**:

**400 Bad Request** (variable validation error):
```json
{
  "statusCode": 400,
  "message": "Variable validation failed",
  "errors": {
    "quote_link": "Must be a valid URI format"
  }
}
```

**400 Bad Request** (rendering error):
```json
{
  "statusCode": 400,
  "message": "Template rendering failed",
  "error": "Missing required variable: customer_name"
}
```

---

### 21. Get Variables Registry

**Endpoint**: `GET /communication/templates/variables/registry`

**Description**: Get available template variables grouped by context

**Authentication**: Required (JWT)

**RBAC**: All roles

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/templates/variables/registry" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
{
  "user": {
    "variables": [
      { "key": "user_name", "type": "string", "description": "User's full name" },
      { "key": "user_email", "type": "string", "description": "User's email address" },
      { "key": "user_role", "type": "string", "description": "User's role in system" }
    ]
  },
  "company": {
    "variables": [
      { "key": "company_name", "type": "string", "description": "Tenant company name" },
      { "key": "company_phone", "type": "string", "description": "Company phone number" },
      { "key": "company_email", "type": "string", "description": "Company email" },
      { "key": "company_address", "type": "string", "description": "Company address" }
    ]
  },
  "lead": {
    "variables": [
      { "key": "lead_name", "type": "string", "description": "Lead full name" },
      { "key": "lead_email", "type": "string", "description": "Lead email" },
      { "key": "lead_phone", "type": "string", "description": "Lead phone" },
      { "key": "service_requested", "type": "string", "description": "Service requested" }
    ]
  },
  "quote": {
    "variables": [
      { "key": "quote_number", "type": "string", "description": "Quote number" },
      { "key": "quote_total", "type": "string", "description": "Formatted quote total" },
      { "key": "quote_link", "type": "string", "description": "Link to view quote" },
      { "key": "quote_valid_until", "type": "string", "description": "Quote expiration date" }
    ]
  },
  "system": {
    "variables": [
      { "key": "platform_name", "type": "string", "description": "Platform name (Lead360)" },
      { "key": "support_email", "type": "string", "description": "Support email" },
      { "key": "current_year", "type": "string", "description": "Current year" }
    ]
  }
}
```

---

### 22. Validate Template Syntax

**Endpoint**: `POST /communication/templates/validate`

**Description**: Validate Handlebars template syntax without saving

**Authentication**: Required (JWT)

**RBAC**: All roles

**Request Body**:

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| subject | string | Yes | Subject line template | `"Quote from {{company_name}}"` |
| html_body | string | Yes | HTML body template | See previous examples |
| text_body | string | No | Text body template | See previous examples |
| variable_schema | object | Yes | Variables schema | See create example |
| sample_variables | object | No | Sample data for test render | `{"company_name": "Test"}` |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/templates/validate" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Quote from {{company_name}}",
    "html_body": "<h1>Hello {{customer_name}}</h1>",
    "text_body": "Hello {{customer_name}}",
    "variable_schema": {
      "type": "object",
      "properties": {
        "company_name": { "type": "string" },
        "customer_name": { "type": "string" }
      },
      "required": ["company_name", "customer_name"]
    },
    "sample_variables": {
      "company_name": "Test Co",
      "customer_name": "John"
    }
  }'
```

**Success Response** (200 OK):

```json
{
  "valid": true,
  "message": "Template syntax is valid",
  "preview": {
    "subject": "Quote from Test Co",
    "html_body": "<h1>Hello John</h1>",
    "text_body": "Hello John"
  }
}
```

**Error Responses**:

**400 Bad Request** (syntax error):
```json
{
  "statusCode": 400,
  "message": "Template validation failed",
  "errors": {
    "html_body": "Unclosed Handlebars tag at line 5",
    "subject": "Unknown variable: {{invalid_variable}}"
  }
}
```

---

## Send Email

### 23. Send Templated Email

**Endpoint**: `POST /communication/send-email/templated`

**Description**: Send an email using a template

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin, Manager, Sales

**Request Body**:

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| to | string | Yes | Valid email format | Recipient email | `"customer@example.com"` |
| cc | array | No | Array of valid emails | CC recipients | `["manager@example.com"]` |
| bcc | array | No | Array of valid emails | BCC recipients | `["admin@example.com"]` |
| template_key | string | Yes | Existing template key | Template to use | `"quote-sent"` |
| variables | object | Yes | Must match template's variable_schema | Template variables | See example below |
| related_entity_type | string | No | Entity type for tracking | `"quote"` |
| related_entity_id | string (uuid) | No | Entity ID for tracking | `"quote-12345"` |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/send-email/templated" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "customer@example.com",
    "cc": ["manager@acmeplumbing.com"],
    "template_key": "quote-sent",
    "variables": {
      "company_name": "Acme Plumbing",
      "customer_name": "John Doe",
      "quote_number": "Q-12345",
      "quote_total": "$1,250.00",
      "quote_link": "https://app.lead360.app/quotes/q-12345"
    },
    "related_entity_type": "quote",
    "related_entity_id": "quote-12345"
  }'
```

**Success Response** (202 Accepted):

```json
{
  "job_id": "job-email-001",
  "communication_event_id": "comm-event-001",
  "message": "Email queued for sending",
  "status": "pending"
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| job_id | string (uuid) | BullMQ job ID for tracking |
| communication_event_id | string (uuid) | Communication event ID for status tracking |
| message | string | Status message |
| status | string | Always `"pending"` initially |

**Note**: Email is queued via BullMQ. Use `/communication/history/:id` to check delivery status.

**Error Responses**:

**400 Bad Request** (variable validation error):
```json
{
  "statusCode": 400,
  "message": "Variable validation failed",
  "errors": {
    "quote_link": "Required field missing"
  }
}
```

**404 Not Found** (template not found):
```json
{
  "statusCode": 404,
  "message": "Template with key 'nonexistent' not found"
}
```

**404 Not Found** (no email config):
```json
{
  "statusCode": 404,
  "message": "No email configuration found for tenant. Please configure email settings first."
}
```

---

### 24. Send Raw Email

**Endpoint**: `POST /communication/send-email/raw`

**Description**: Send an email without using a template

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin, Manager, Sales

**Request Body**:

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| to | string | Yes | Valid email format | Recipient email | `"customer@example.com"` |
| cc | array | No | Array of valid emails | CC recipients | `["manager@example.com"]` |
| bcc | array | No | Array of valid emails | BCC recipients | `[]` |
| subject | string | Yes | 1-500 chars | Email subject | `"Your quote is ready"` |
| html_body | string | Yes | Valid HTML | HTML email body | See example below |
| text_body | string | No | Plain text | Text email body | See example below |
| attachments | array | No | See attachment schema | File attachments | See example below |
| related_entity_type | string | No | Entity type | `"quote"` |
| related_entity_id | string (uuid) | No | Entity ID | `"quote-12345"` |

**Attachment Schema**:

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| filename | string | Yes | File name | `"quote.pdf"` |
| content | string | Yes | Base64 encoded file content | `"JVBERi0xLjQK..."` |
| mime_type | string | Yes | MIME type | `"application/pdf"` |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/send-email/raw" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "customer@example.com",
    "subject": "Your quote is ready",
    "html_body": "<html><body><h1>Quote Ready</h1><p>Hello John,</p><p>Your quote #Q-12345 is ready for review.</p></body></html>",
    "text_body": "Quote Ready\n\nHello John,\n\nYour quote #Q-12345 is ready for review.",
    "attachments": [
      {
        "filename": "quote.pdf",
        "content": "JVBERi0xLjQKJeLjz9MK...",
        "mime_type": "application/pdf"
      }
    ],
    "related_entity_type": "quote",
    "related_entity_id": "quote-12345"
  }'
```

**Success Response** (202 Accepted):

```json
{
  "job_id": "job-email-002",
  "communication_event_id": "comm-event-002",
  "message": "Email queued for sending",
  "status": "pending"
}
```

**Error Responses**:

**400 Bad Request** (validation error):
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "html_body": "HTML body is required",
    "attachments[0].content": "Invalid base64 encoding"
  }
}
```

---

## Communication History

### 25. List Communication Events

**Endpoint**: `GET /communication/history`

**Description**: List all communication events (emails, SMS, etc.) with filtering and pagination

**Authentication**: Required (JWT)

**RBAC**: All roles

**Query Parameters**:

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| channel | string | No | - | Filter by channel: `email`, `sms`, `whatsapp` | `email` |
| status | string | No | - | Filter by status: `pending`, `sent`, `delivered`, `failed`, `bounced` | `delivered` |
| to_email | string | No | - | Filter by recipient email | `customer@example.com` |
| to_phone | string | No | - | Filter by recipient phone | `+15551234567` |
| related_entity_type | string | No | - | Filter by entity type | `quote` |
| related_entity_id | string | No | - | Filter by entity ID | `quote-12345` |
| start_date | string (ISO 8601) | No | - | Filter by created_at >= start_date | `2026-01-01T00:00:00Z` |
| end_date | string (ISO 8601) | No | - | Filter by created_at <= end_date | `2026-01-31T23:59:59Z` |
| page | number | No | 1 | Page number | `1` |
| limit | number | No | 20 | Items per page (max 100) | `50` |

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/history?channel=email&status=delivered&page=1&limit=20" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
{
  "data": [
    {
      "id": "comm-event-001",
      "tenant_id": "tenant-acme-plumbing",
      "channel": "email",
      "direction": "outbound",
      "provider_id": "prov-sendgrid-001",
      "status": "delivered",
      "to_email": "customer@example.com",
      "to_phone": null,
      "cc_emails": ["manager@acmeplumbing.com"],
      "bcc_emails": null,
      "from_email": "info@acmeplumbing.com",
      "from_name": "Acme Plumbing",
      "subject": "Your quote from Acme Plumbing",
      "template_key": "quote-sent",
      "template_variables": {
        "company_name": "Acme Plumbing",
        "customer_name": "John Doe",
        "quote_number": "Q-12345",
        "quote_total": "$1,250.00"
      },
      "provider_message_id": "sendgrid-msg-abc123",
      "related_entity_type": "quote",
      "related_entity_id": "quote-12345",
      "sent_at": "2026-01-18T10:00:00.000Z",
      "delivered_at": "2026-01-18T10:00:05.000Z",
      "opened_at": "2026-01-18T10:15:30.000Z",
      "clicked_at": null,
      "bounced_at": null,
      "bounce_type": null,
      "error_message": null,
      "created_at": "2026-01-18T10:00:00.000Z",
      "created_by_user_id": "user-123"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total_count": 342,
    "total_pages": 18
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| data | array | Array of communication event objects |
| data[].id | string (uuid) | Event ID |
| data[].tenant_id | string (uuid) | Tenant ID |
| data[].channel | enum | Communication channel: `email`, `sms`, `whatsapp` |
| data[].direction | enum | Direction: `outbound`, `inbound` |
| data[].provider_id | string (uuid) | Provider ID used |
| data[].status | enum | Status: `pending`, `sent`, `delivered`, `failed`, `bounced` |
| data[].to_email | string \| null | Recipient email (for email channel) |
| data[].to_phone | string \| null | Recipient phone (for SMS/WhatsApp) |
| data[].cc_emails | array \| null | CC recipients |
| data[].bcc_emails | array \| null | BCC recipients |
| data[].from_email | string \| null | Sender email |
| data[].from_name | string \| null | Sender name |
| data[].subject | string \| null | Email subject |
| data[].template_key | string \| null | Template key used (if templated) |
| data[].template_variables | object \| null | Variables used |
| data[].provider_message_id | string \| null | Provider's message ID |
| data[].related_entity_type | string \| null | Associated entity type |
| data[].related_entity_id | string \| null | Associated entity ID |
| data[].sent_at | string \| null | When email was sent |
| data[].delivered_at | string \| null | When email was delivered |
| data[].opened_at | string \| null | When email was opened |
| data[].clicked_at | string \| null | When link was clicked |
| data[].bounced_at | string \| null | When email bounced |
| data[].bounce_type | string \| null | Bounce type: `soft`, `hard` |
| data[].error_message | string \| null | Error message if failed |
| data[].created_at | string (ISO 8601) | Creation timestamp |
| data[].created_by_user_id | string \| null | User who initiated |

---

### 26. Get Communication Event Details

**Endpoint**: `GET /communication/history/:id`

**Description**: Get detailed information about a specific communication event

**Authentication**: Required (JWT)

**RBAC**: All roles

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Communication event ID | `comm-event-001` |

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/history/comm-event-001" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
{
  "id": "comm-event-001",
  "tenant_id": "tenant-acme-plumbing",
  "channel": "email",
  "direction": "outbound",
  "provider": {
    "id": "prov-sendgrid-001",
    "provider_key": "sendgrid",
    "provider_name": "SendGrid"
  },
  "status": "delivered",
  "to_email": "customer@example.com",
  "to_phone": null,
  "cc_emails": ["manager@acmeplumbing.com"],
  "bcc_emails": [],
  "from_email": "info@acmeplumbing.com",
  "from_name": "Acme Plumbing",
  "subject": "Your quote from Acme Plumbing",
  "html_body": "<!DOCTYPE html>...",
  "text_body": "Hello John...",
  "template_key": "quote-sent",
  "template_variables": {
    "company_name": "Acme Plumbing",
    "customer_name": "John Doe",
    "quote_number": "Q-12345",
    "quote_total": "$1,250.00",
    "quote_link": "https://app.lead360.app/quotes/q-12345"
  },
  "attachments": null,
  "provider_message_id": "sendgrid-msg-abc123",
  "provider_metadata": {
    "sendgrid_message_id": "abc123",
    "batch_id": null
  },
  "related_entity_type": "quote",
  "related_entity_id": "quote-12345",
  "sent_at": "2026-01-18T10:00:00.000Z",
  "delivered_at": "2026-01-18T10:00:05.000Z",
  "opened_at": "2026-01-18T10:15:30.000Z",
  "clicked_at": null,
  "bounced_at": null,
  "bounce_type": null,
  "error_message": null,
  "created_at": "2026-01-18T10:00:00.000Z",
  "created_by_user": {
    "id": "user-123",
    "full_name": "Jane Smith",
    "email": "jane@acmeplumbing.com"
  },
  "webhook_events": [
    {
      "id": "webhook-001",
      "event_type": "delivered",
      "created_at": "2026-01-18T10:00:05.000Z",
      "signature_verified": true
    },
    {
      "id": "webhook-002",
      "event_type": "opened",
      "created_at": "2026-01-18T10:15:30.000Z",
      "signature_verified": true
    }
  ]
}
```

**Additional Response Fields** (beyond list endpoint):

| Field | Type | Description |
|-------|------|-------------|
| provider | object | Full provider object |
| html_body | string | Full HTML body |
| text_body | string | Full text body |
| attachments | array \| null | Attachment details |
| provider_metadata | object | Provider-specific metadata |
| created_by_user | object | User who sent the email |
| webhook_events | array | Related webhook events |

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Communication event 'invalid-id' not found"
}
```

---

### 27. Resend Failed Email

**Endpoint**: `POST /communication/history/:id/resend`

**Description**: Retry sending a failed email

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin only

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Communication event ID | `comm-event-failed-001` |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/history/comm-event-failed-001/resend" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (202 Accepted):

```json
{
  "job_id": "job-email-resend-001",
  "communication_event_id": "comm-event-failed-001",
  "message": "Email queued for resending",
  "status": "pending"
}
```

**Error Responses**:

**400 Bad Request** (not failed):
```json
{
  "statusCode": 400,
  "message": "Can only resend failed emails. Current status: delivered"
}
```

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Communication event 'invalid-id' not found"
}
```

---

## Notifications

In-app notification system with real-time updates.

### 28. List User Notifications

**Endpoint**: `GET /communication/notifications`

**Description**: Get notifications for current user

**Authentication**: Required (JWT)

**RBAC**: All roles

**Query Parameters**:

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| is_read | boolean | No | - | Filter by read status | `false` |
| type | string | No | - | Filter by notification type | `lead_created` |
| start_date | string (ISO 8601) | No | - | Filter by created_at >= start_date | `2026-01-01T00:00:00Z` |
| page | number | No | 1 | Page number | `1` |
| limit | number | No | 20 | Items per page (max 100) | `50` |

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/notifications?is_read=false&page=1&limit=20" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
{
  "data": [
    {
      "id": "notif-001",
      "tenant_id": "tenant-acme-plumbing",
      "user_id": "user-123",
      "type": "lead_created",
      "title": "New Lead Created",
      "message": "John Doe submitted a service request",
      "action_url": "/leads/lead-12345",
      "related_entity_type": "lead",
      "related_entity_id": "lead-12345",
      "is_read": false,
      "read_at": null,
      "expires_at": null,
      "created_at": "2026-01-18T10:00:00.000Z"
    },
    {
      "id": "notif-002",
      "tenant_id": "tenant-acme-plumbing",
      "user_id": null,
      "type": "quote_approved",
      "title": "Quote Approved",
      "message": "Quote Q-12345 was approved",
      "action_url": "/quotes/q-12345",
      "related_entity_type": "quote",
      "related_entity_id": "q-12345",
      "is_read": false,
      "read_at": null,
      "expires_at": "2026-01-25T10:00:00.000Z",
      "created_at": "2026-01-18T11:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total_count": 12,
    "total_pages": 1
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| data | array | Array of notification objects |
| data[].id | string (uuid) | Notification ID |
| data[].tenant_id | string (uuid) | Tenant ID |
| data[].user_id | string \| null | User ID (null = tenant-wide) |
| data[].type | string | Notification type |
| data[].title | string | Notification title |
| data[].message | string | Notification message |
| data[].action_url | string \| null | Action URL (relative path) |
| data[].related_entity_type | string \| null | Related entity type |
| data[].related_entity_id | string \| null | Related entity ID |
| data[].is_read | boolean | Read status |
| data[].read_at | string \| null | When marked as read |
| data[].expires_at | string \| null | Expiration timestamp |
| data[].created_at | string (ISO 8601) | Creation timestamp |

**Note**: Notifications with `user_id = null` are tenant-wide notifications visible to all users.

---

### 29. Get Unread Notification Count

**Endpoint**: `GET /communication/notifications/unread-count`

**Description**: Get count of unread notifications for current user

**Authentication**: Required (JWT)

**RBAC**: All roles

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/notifications/unread-count" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
{
  "unread_count": 12
}
```

---

### 30. Mark Notification as Read

**Endpoint**: `PATCH /communication/notifications/:id/read`

**Description**: Mark a specific notification as read

**Authentication**: Required (JWT)

**RBAC**: All roles

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Notification ID | `notif-001` |

**Request Example**:

```bash
curl -X PATCH "https://api.lead360.app/api/v1/communication/notifications/notif-001/read" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
{
  "id": "notif-001",
  "tenant_id": "tenant-acme-plumbing",
  "user_id": "user-123",
  "type": "lead_created",
  "title": "New Lead Created",
  "message": "John Doe submitted a service request",
  "action_url": "/leads/lead-12345",
  "is_read": true,
  "read_at": "2026-01-18T12:00:00.000Z",
  "created_at": "2026-01-18T10:00:00.000Z"
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Notification 'invalid-id' not found"
}
```

---

### 31. Mark All Notifications as Read

**Endpoint**: `POST /communication/notifications/mark-all-read`

**Description**: Mark all unread notifications as read for current user

**Authentication**: Required (JWT)

**RBAC**: All roles

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/notifications/mark-all-read" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
{
  "marked_count": 12,
  "message": "All notifications marked as read"
}
```

---

### 32. Delete Notification

**Endpoint**: `DELETE /communication/notifications/:id`

**Description**: Delete a notification

**Authentication**: Required (JWT)

**RBAC**: All roles

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Notification ID | `notif-001` |

**Request Example**:

```bash
curl -X DELETE "https://api.lead360.app/api/v1/communication/notifications/notif-001" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (204 No Content)

No response body.

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Notification 'invalid-id' not found"
}
```

---

## Notification Rules

Automation rules for creating notifications based on events.

### 33. List Notification Rules

**Endpoint**: `GET /communication/notification-rules`

**Description**: List all notification rules for tenant

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin only

**Query Parameters**:

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| event_type | string | No | - | Filter by event type | `lead_created` |
| is_active | boolean | No | - | Filter by active status | `true` |

**Request Example**:

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/notification-rules?is_active=true" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (200 OK):

```json
[
  {
    "id": "rule-001",
    "tenant_id": "tenant-acme-plumbing",
    "event_type": "lead_created",
    "notify_in_app": true,
    "notify_email": false,
    "email_template_key": null,
    "recipient_type": "owner",
    "specific_user_ids": null,
    "is_active": true,
    "created_at": "2026-01-15T00:00:00.000Z",
    "updated_at": "2026-01-18T00:00:00.000Z"
  },
  {
    "id": "rule-002",
    "tenant_id": "tenant-acme-plumbing",
    "event_type": "quote_approved",
    "notify_in_app": true,
    "notify_email": true,
    "email_template_key": "quote-approved-notification",
    "recipient_type": "all_users",
    "specific_user_ids": null,
    "is_active": true,
    "created_at": "2026-01-15T00:00:00.000Z",
    "updated_at": "2026-01-18T00:00:00.000Z"
  }
]
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Rule ID |
| tenant_id | string (uuid) | Tenant ID |
| event_type | string | Event type that triggers this rule |
| notify_in_app | boolean | Whether to create in-app notification |
| notify_email | boolean | Whether to send email notification |
| email_template_key | string \| null | Template key for email (if notify_email=true) |
| recipient_type | enum | Recipient type: `owner`, `assigned_user`, `specific_users`, `all_users` |
| specific_user_ids | array \| null | User IDs if recipient_type='specific_users' |
| is_active | boolean | Whether rule is enabled |
| created_at | string (ISO 8601) | Creation timestamp |
| updated_at | string (ISO 8601) | Last update timestamp |

---

### 34. Create Notification Rule

**Endpoint**: `POST /communication/notification-rules`

**Description**: Create a new notification rule

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin only

**Request Body**:

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| event_type | string | Yes | Max 100 chars | Event type | `"lead_created"` |
| notify_in_app | boolean | No | Default: true | Create in-app notification | `true` |
| notify_email | boolean | No | Default: false | Send email notification | `false` |
| email_template_key | string | No | Required if notify_email=true | Email template key | `"lead-notification"` |
| recipient_type | enum | Yes | `owner`, `assigned_user`, `specific_users`, `all_users` | Who receives notification | `"owner"` |
| specific_user_ids | array | No | Required if recipient_type='specific_users' | User IDs | `["user-123", "user-456"]` |

**Request Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/communication/notification-rules" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "lead_created",
    "notify_in_app": true,
    "notify_email": false,
    "recipient_type": "owner"
  }'
```

**Success Response** (201 Created):

```json
{
  "id": "rule-new-001",
  "tenant_id": "tenant-acme-plumbing",
  "event_type": "lead_created",
  "notify_in_app": true,
  "notify_email": false,
  "email_template_key": null,
  "recipient_type": "owner",
  "specific_user_ids": null,
  "is_active": true,
  "created_at": "2026-01-18T12:00:00.000Z",
  "updated_at": "2026-01-18T12:00:00.000Z"
}
```

**Error Responses**:

**400 Bad Request** (validation error):
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "email_template_key": "Required when notify_email is true",
    "specific_user_ids": "Required when recipient_type is 'specific_users'"
  }
}
```

---

### 35. Update Notification Rule

**Endpoint**: `PATCH /communication/notification-rules/:id`

**Description**: Update an existing notification rule

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin only

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Rule ID | `rule-001` |

**Request Body** (all fields optional):

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| notify_in_app | boolean | Create in-app notification | `false` |
| notify_email | boolean | Send email notification | `true` |
| email_template_key | string | Email template key | `"updated-template"` |
| recipient_type | enum | Recipient type | `"all_users"` |
| specific_user_ids | array | User IDs | `["user-789"]` |
| is_active | boolean | Active status | `false` |

**Request Example**:

```bash
curl -X PATCH "https://api.lead360.app/api/v1/communication/notification-rules/rule-001" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "notify_email": true,
    "email_template_key": "lead-notification-email"
  }'
```

**Success Response** (200 OK):

```json
{
  "id": "rule-001",
  "tenant_id": "tenant-acme-plumbing",
  "event_type": "lead_created",
  "notify_in_app": true,
  "notify_email": true,
  "email_template_key": "lead-notification-email",
  "recipient_type": "owner",
  "specific_user_ids": null,
  "is_active": true,
  "created_at": "2026-01-15T00:00:00.000Z",
  "updated_at": "2026-01-18T13:00:00.000Z"
}
```

---

### 36. Delete Notification Rule

**Endpoint**: `DELETE /communication/notification-rules/:id`

**Description**: Delete a notification rule

**Authentication**: Required (JWT)

**RBAC**: Owner, Admin only

**Path Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| id | string (uuid) | Yes | Rule ID | `rule-001` |

**Request Example**:

```bash
curl -X DELETE "https://api.lead360.app/api/v1/communication/notification-rules/rule-001" \
  -H "Authorization: Bearer {token}"
```

**Success Response** (204 No Content)

No response body.

**Error Responses**:

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Notification rule 'invalid-id' not found"
}
```

---

## Webhooks

Webhook receivers are **public endpoints** (no JWT authentication required).

### 37. SendGrid Webhook

**Endpoint**: `POST /webhooks/communication/sendgrid`

**Description**: Receive delivery status updates from SendGrid

**Authentication**: None (signature verification using webhook_secret)

**Request Headers**:

| Header | Required | Description |
|--------|----------|-------------|
| X-Twilio-Email-Event-Webhook-Signature | Yes | SendGrid signature |
| X-Twilio-Email-Event-Webhook-Timestamp | Yes | Webhook timestamp |

**Request Body** (SendGrid format):

```json
[
  {
    "email": "customer@example.com",
    "timestamp": 1737198005,
    "event": "delivered",
    "sg_event_id": "sendgrid-event-123",
    "sg_message_id": "sendgrid-msg-abc123"
  },
  {
    "email": "customer@example.com",
    "timestamp": 1737198305,
    "event": "open",
    "sg_event_id": "sendgrid-event-124",
    "sg_message_id": "sendgrid-msg-abc123"
  }
]
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "processed": 2,
  "results": [
    {
      "status": "processed",
      "message_id": "sendgrid-msg-abc123",
      "event_type": "delivered"
    },
    {
      "status": "processed",
      "message_id": "sendgrid-msg-abc123",
      "event_type": "opened"
    }
  ]
}
```

**Error Responses**:

**401 Unauthorized** (signature verification failed):
```json
{
  "statusCode": 401,
  "message": "Invalid webhook signature"
}
```

**Supported SendGrid Events**:
- `delivered` - Email successfully delivered
- `bounce` - Email bounced
- `open` - Email opened
- `click` - Link clicked
- `spam_report` - Marked as spam
- `unsubscribe` - User unsubscribed

---

### 38. Amazon SES Webhook

**Endpoint**: `POST /webhooks/communication/amazon-ses`

**Description**: Receive delivery status updates from Amazon SES (SNS)

**Authentication**: None (SNS signature verification)

**Request Body** (SNS format):

```json
{
  "Type": "Notification",
  "MessageId": "sns-message-123",
  "Message": "{\"eventType\":\"Delivery\",\"mail\":{\"messageId\":\"ses-msg-abc123\"},\"delivery\":{\"timestamp\":\"2026-01-18T10:00:05.000Z\"}}"
}
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "processed": 1
}
```

**Supported SES Events**:
- `Delivery` - Email delivered
- `Bounce` - Email bounced
- `Complaint` - Spam complaint
- `Reject` - Email rejected

---

### 39. Brevo Webhook

**Endpoint**: `POST /webhooks/communication/brevo`

**Description**: Receive delivery status updates from Brevo

**Authentication**: None (token verification using webhook_secret)

**Request Headers**:

| Header | Required | Description |
|--------|----------|-------------|
| X-Brevo-Secret | Yes | Webhook secret token |

**Request Body** (Brevo format):

```json
{
  "event": "delivered",
  "email": "customer@example.com",
  "message-id": "brevo-msg-abc123",
  "date": "2026-01-18 10:00:05"
}
```

**Success Response** (200 OK):

```json
{
  "success": true
}
```

**Supported Brevo Events**:
- `delivered` - Email delivered
- `hard_bounce` - Hard bounce
- `soft_bounce` - Soft bounce
- `opened` - Email opened
- `click` - Link clicked

---

### 40. Twilio SMS Webhook

**Endpoint**: `POST /webhooks/communication/twilio-sms`

**Description**: Receive SMS delivery status updates from Twilio

**Authentication**: None (signature verification)

**Request Headers**:

| Header | Required | Description |
|--------|----------|-------------|
| X-Twilio-Signature | Yes | Twilio signature |

**Request Body** (Twilio form-urlencoded):

```
MessageSid=twilio-sms-abc123
&MessageStatus=delivered
&To=%2B15551234567
&From=%2B15559876543
```

**Success Response** (200 OK):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>
```

**Supported Twilio SMS Statuses**:
- `sent` - Message sent
- `delivered` - Message delivered
- `failed` - Message failed
- `undelivered` - Message undelivered

---

### 41. Twilio WhatsApp Webhook

**Endpoint**: `POST /webhooks/communication/twilio-whatsapp`

**Description**: Receive WhatsApp delivery status updates from Twilio

**Authentication**: None (signature verification)

**Request Headers**:

| Header | Required | Description |
|--------|----------|-------------|
| X-Twilio-Signature | Yes | Twilio signature |

**Request Body** (Twilio form-urlencoded):

```
MessageSid=twilio-whatsapp-abc123
&MessageStatus=delivered
&To=whatsapp%3A%2B15551234567
&From=whatsapp%3A%2B15559876543
```

**Success Response** (200 OK):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>
```

**Supported Twilio WhatsApp Statuses**:
- `sent` - Message sent
- `delivered` - Message delivered
- `read` - Message read
- `failed` - Message failed

---

## Pagination

All list endpoints support pagination with consistent query parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| page | number | 1 | - | Page number (1-indexed) |
| limit | number | 20 | 100 | Items per page |

**Pagination Response Format**:

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total_count": 342,
    "total_pages": 18
  }
}
```

---

## Multi-Tenant Isolation

**CRITICAL**: All endpoints (except admin and webhooks) enforce tenant isolation:

- Tenant ID is extracted from JWT token
- All database queries include `tenant_id` filter
- Users cannot access data from other tenants
- Middleware enforces this automatically

**Admin Endpoints**:
- Platform admin endpoints bypass tenant isolation
- Require special `is_platform_admin` flag in JWT
- Located under `/admin/` path prefix

---

## Rate Limiting

| Endpoint Type | Rate Limit |
|---------------|------------|
| Send Email | 100 requests/minute per tenant |
| Webhooks | 1000 requests/minute per provider |
| Other Endpoints | 300 requests/minute per user |

**Rate Limit Headers**:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1737198360
```

---

## Webhook Security

All webhook endpoints verify signatures to prevent spoofing:

| Provider | Verification Method | Header |
|----------|---------------------|--------|
| SendGrid | HMAC SHA256 signature | `X-Twilio-Email-Event-Webhook-Signature` |
| Amazon SES | SNS signature verification | Built into SNS |
| Brevo | Token comparison | `X-Brevo-Secret` |
| Twilio | HMAC SHA1 signature | `X-Twilio-Signature` |

**Webhook Configuration**:
- Each tenant/platform config has a `webhook_secret`
- Secret is used to verify incoming webhooks
- Unverified webhooks are logged but not processed

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0 | Initial documentation - 41 endpoints |

---

**END OF DOCUMENTATION**

This documentation covers ALL 41 endpoints in the Communication Module with complete details for every field, parameter, request, response, and error case.
