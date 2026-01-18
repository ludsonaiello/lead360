# Communication/Notifications Module - Feature Contract

**Module**: Communication & Notifications  
**Sprint**: 2  
**Priority**: High (Foundation for all customer communication)  
**Architecture**: Provider Registry Pattern  
**Version**: 2.0  
**Status**: Ready for Development  
**Date**: January 2026

---

## Purpose

**What problem does this solve?**

Service businesses need to send branded emails to customers using their own email providers (not the platform's). Different tenants prefer different email services (SendGrid, Amazon SES, Gmail SMTP, Brevo). The system must support unlimited email providers without requiring database migrations for each new provider. Additionally, the system must track email delivery status in real-time via provider webhooks.

**Who is this for?**

- **Platform Admins**: Configure platform-wide email service for system emails (password resets, notifications)
- **Tenant Admins**: Configure their own email provider for customer communications
- **All Users**: Receive in-app notifications for important events
- **Developers**: Add new email providers without code deployments or migrations

**Use Cases**:
- Platform sends password reset email via SendGrid
- Tenant sends quote email via their Gmail SMTP account
- Tenant receives notification when lead is created via webhook
- Admin adds Mailgun provider without database migration
- System tracks email delivery status via SendGrid webhooks

---

## Scope

### **In Scope**

✅ **Provider Registry Architecture**: Master table defines all available email providers  
✅ **Multi-Provider Support**: SMTP, SendGrid, Amazon SES, Brevo (4 providers seeded)  
✅ **JSON-Based Configuration**: Provider configs stored in JSON fields validated by JSON Schema  
✅ **Webhook Support**: Receive delivery status updates from providers (delivered, bounced, opened, clicked)  
✅ **Two-Tier Email System**: Platform-level (admin) + Tenant-level configurations  
✅ **Email Templates**: Admin and tenant templates with Handlebars variables  
✅ **In-App Notifications**: Notification bell with real-time updates  
✅ **Communication History**: Complete audit trail of all emails sent  
✅ **Notification Rules**: Auto-create notifications based on events (lead_created, quote_approved)  
✅ **Email Attachments**: Support file attachments on emails  
✅ **Dynamic UI Generation**: Frontend forms generated from provider JSON Schemas  
✅ **Migration from Existing**: Migrate auth module emails (password reset, activation) to new system  

### **Out of Scope**

❌ **SMS/Calls via Twilio**: Deferred to future sprint (architecture supports it)  
❌ **Email Marketing Campaigns**: Not a marketing automation tool  
❌ **Email Analytics Dashboard**: Basic tracking only (opens, clicks), no detailed analytics  
❌ **A/B Testing**: Not included  
❌ **Email Scheduling**: Send immediately only (no scheduled sends)  
❌ **Conversation Threading**: No email thread management  

---

## Dependencies

### **Requires (must be complete first)**

- [x] Jobs Module (BullMQ, email templates, SMTP service)
- [x] Auth Module (password reset, activation emails)
- [x] File Storage Module (for email attachments)
- [x] Audit Module (for logging)
- [x] Encryption Service (AES-256-GCM for credentials)

### **Blocks (must complete before)**

- Quotes Module (needs email sending for quotes)
- Invoices Module (needs email sending for invoices)
- Appointments Module (needs notifications)

---

## Data Model

### **Provider Registry Architecture**

**Core Concept**: Instead of adding database columns for each provider (column explosion), store provider configurations in JSON fields validated by JSON Schema. This enables adding unlimited providers without schema migrations.

**Pattern**:
```
communication_provider (master registry)
  ↓
  └─ defines: credentials_schema, config_schema, webhook support
       ↓
       └─ platform_email_config / tenant_email_config
            ↓
            └─ stores: credentials (JSON), provider_config (JSON)
```

**Benefit**: Add Mailgun = INSERT into `communication_provider` (no ALTER TABLE migration!)

---

### **Database Tables**

#### **Table: communication_provider** (Master Registry)

**Purpose**: Defines all available email/SMS/call providers. Platform admins can enable/disable providers or add new ones without code changes.

**Columns**:

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | UUID | Yes | Provider ID | - | uuid() |
| provider_key | VARCHAR(50) | Yes | Unique key | lowercase, alphanumeric + underscore | - |
| provider_name | VARCHAR(100) | Yes | Display name | 2-100 chars | - |
| provider_type | ENUM | Yes | Channel type | email, sms, call, push, whatsapp | - |
| credentials_schema | JSON | Yes | JSON Schema for credentials | Valid JSON Schema | - |
| config_schema | JSON | No | JSON Schema for configuration | Valid JSON Schema | null |
| default_config | JSON | No | Default configuration values | Valid JSON | null |
| supports_webhooks | BOOLEAN | Yes | Provider sends webhooks | - | false |
| webhook_events | JSON | No | Supported webhook events | Array of strings | null |
| webhook_verification_method | VARCHAR(50) | No | Verification method | signature, token, ip_whitelist | null |
| documentation_url | VARCHAR(500) | No | Integration docs URL | Valid URL | null |
| logo_url | VARCHAR(500) | No | Provider logo URL | Valid URL | null |
| is_active | BOOLEAN | Yes | Provider available | - | true |
| is_system | BOOLEAN | Yes | System provider (protected) | - | false |
| created_at | TIMESTAMP | Yes | Creation time | - | now() |
| updated_at | TIMESTAMP | Yes | Last update | - | now() |

**Indexes**:
- Primary: `id`
- Unique: `provider_key`
- Composite: `(provider_type, is_active)` - Filter active providers by type
- Index: `(is_active)` - List all active providers

**Relationships**:
- Has many: `platform_email_config`, `tenant_email_config`, `communication_event`

**Business Rules**:
- `provider_key` must be unique (enforced by database)
- `provider_key` must be lowercase alphanumeric + underscore only
- System providers (`is_system = true`) cannot be deleted
- Only platform admins can create/update providers
- Deactivating provider (`is_active = false`) prevents new configs from using it

**Seeded Providers** (4 initially):
1. SMTP (provider_key: `smtp`)
2. SendGrid (provider_key: `sendgrid`)
3. Amazon SES (provider_key: `amazon_ses`)
4. Brevo (provider_key: `brevo`)

---

#### **Table: platform_email_config** (Platform/Admin Email)

**Purpose**: Platform-wide email configuration for sending system emails (password resets, notifications to tenants). Only ONE config exists (singleton).

**Columns**:

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | UUID | Yes | Config ID | Fixed: 'platform-email-config' | - |
| provider_id | UUID | Yes | FK to communication_provider | Must be active provider | - |
| credentials | JSON | Yes | Provider credentials (encrypted) | Must match provider's credentials_schema | - |
| provider_config | JSON | No | Provider-specific config | Must match provider's config_schema | null |
| from_email | VARCHAR(255) | Yes | Default from email | Valid email format | - |
| from_name | VARCHAR(100) | Yes | Default from name | 2-100 chars | - |
| webhook_secret | VARCHAR(255) | No | Webhook signature secret | - | null |
| is_verified | BOOLEAN | Yes | Config tested successfully | - | false |
| created_at | TIMESTAMP | Yes | Creation time | - | now() |
| updated_at | TIMESTAMP | Yes | Last update | - | now() |

**Indexes**:
- Primary: `id`
- Foreign Key: `provider_id` → `communication_provider(id)`

**Relationships**:
- Belongs to: `communication_provider`

**Business Rules**:
- Only ONE row allowed (enforced by fixed id: 'platform-email-config')
- `credentials` must be encrypted with AES-256-GCM before storage
- `credentials` must validate against provider's `credentials_schema`
- `provider_config` must validate against provider's `config_schema`
- `is_verified` flag only set true after successful test email
- Updating config resets `is_verified` to false
- Only platform admins can modify this config

**Example Data**:
```json
{
  "id": "platform-email-config",
  "provider_id": "prov-sendgrid-001",
  "credentials": {
    "api_key": "encrypted_SG.xxxxxxxxxxxxxxxxxxx"
  },
  "provider_config": {
    "click_tracking": false,
    "open_tracking": false
  },
  "from_email": "noreply@lead360.app",
  "from_name": "Lead360 Platform",
  "is_verified": true
}
```

---

#### **Table: tenant_email_config** (Tenant Email)

**Purpose**: Tenant-specific email configuration. Each tenant configures their own email provider for sending customer emails (quotes, invoices). Tenant credentials never mix with platform credentials.

**Columns**:

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | UUID | Yes | Config ID | - | uuid() |
| tenant_id | UUID | Yes | Tenant ownership | Must exist in tenant table | - |
| provider_id | UUID | Yes | FK to communication_provider | Must be active provider | - |
| credentials | JSON | Yes | Provider credentials (encrypted) | Must match provider's credentials_schema | - |
| provider_config | JSON | No | Provider-specific config | Must match provider's config_schema | null |
| from_email | VARCHAR(255) | Yes | Tenant's from email | Valid email format | - |
| from_name | VARCHAR(100) | Yes | Tenant's from name | 2-100 chars | - |
| reply_to_email | VARCHAR(255) | No | Reply-to email | Valid email format | null |
| webhook_secret | VARCHAR(255) | No | Tenant's webhook secret | - | null |
| is_active | BOOLEAN | Yes | Config enabled | - | true |
| is_verified | BOOLEAN | Yes | Config tested successfully | - | false |
| created_at | TIMESTAMP | Yes | Creation time | - | now() |
| updated_at | TIMESTAMP | Yes | Last update | - | now() |

**Indexes**:
- Primary: `id`
- Unique: `tenant_id` - ONE config per tenant
- Foreign Key: `tenant_id` → `tenant(id)` ON DELETE CASCADE
- Foreign Key: `provider_id` → `communication_provider(id)`
- Composite: `(tenant_id, provider_id)` - Tenant + provider lookup
- Composite: `(tenant_id, is_active)` - Active tenant configs

**Relationships**:
- Belongs to: `tenant`, `communication_provider`

**Business Rules**:
- ONE config per tenant (enforced by UNIQUE constraint on tenant_id)
- Cascade delete when tenant is deleted
- `credentials` encrypted with AES-256-GCM
- `credentials` must validate against provider's `credentials_schema`
- `provider_config` must validate against provider's `config_schema`
- `is_verified` only true after successful test email
- Updating config resets `is_verified` to false
- Only tenant admins (Owner, Admin roles) can modify config

**Example Data**:
```json
{
  "id": "tenant-email-001",
  "tenant_id": "tenant-acme-plumbing",
  "provider_id": "prov-smtp-001",
  "credentials": {
    "smtp_username": "info@acmeplumbing.com",
    "smtp_password": "encrypted_app_password"
  },
  "provider_config": {
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "smtp_encryption": "tls"
  },
  "from_email": "info@acmeplumbing.com",
  "from_name": "Acme Plumbing",
  "reply_to_email": "support@acmeplumbing.com",
  "is_verified": true
}
```

---

#### **Table: email_template** (Enhanced from Existing)

**Purpose**: Email templates using Handlebars for variable substitution. Supports both admin templates (tenant_id = NULL) and tenant-specific templates.

**New Columns Added**:

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| tenant_id | UUID | No | NULL = admin template, UUID = tenant template |
| variable_schema | JSON | No | Variable metadata (type, description, example) |
| category | ENUM | Yes | system, transactional, marketing, notification |
| is_active | BOOLEAN | Yes | Template enabled (default: true) |

**Existing Columns** (unchanged):
- id, template_key, subject, html_body, text_body, variables, description, is_system, created_at, updated_at

**Indexes** (enhanced):
- Unique: `(template_key)` → Changed to: `(tenant_id, template_key)` - Allow same key across tenants
- New: `(tenant_id, is_active)` - Active tenant templates
- New: `(tenant_id, category)` - Category filtering

**Business Rules**:
- Admin templates: `tenant_id = NULL`, `is_system = true`
- Tenant templates: `tenant_id = UUID`, `is_system = false`
- System templates (`is_system = true`) cannot be deleted
- Tenants can access admin templates (read-only) + their own templates
- Cascade delete tenant templates when tenant deleted

---

#### **Table: communication_event** (Replaces email_queue)

**Purpose**: Complete audit trail of all communications (emails, future SMS/calls). Tracks delivery status via webhooks.

**Columns**:

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | UUID | Yes | Event ID | - | uuid() |
| tenant_id | UUID | No | Tenant (NULL for platform emails) | - | null |
| channel | ENUM | Yes | Communication channel | email, sms, call | - |
| direction | ENUM | Yes | Message direction | outbound, inbound | outbound |
| provider_id | UUID | Yes | FK to communication_provider | - | - |
| status | ENUM | Yes | Delivery status | pending, sent, delivered, failed, bounced | pending |
| to_email | VARCHAR(255) | Conditional | Recipient email | Required if channel=email | null |
| to_phone | VARCHAR(20) | Conditional | Recipient phone | Required if channel=sms/call | null |
| cc_emails | JSON | No | CC recipients | Array of emails | null |
| bcc_emails | JSON | No | BCC recipients | Array of emails | null |
| from_email | VARCHAR(255) | Conditional | Sender email | Required if channel=email | null |
| from_name | VARCHAR(100) | No | Sender name | - | null |
| subject | VARCHAR(500) | Conditional | Email subject | Required if channel=email | null |
| html_body | LONGTEXT | No | HTML content | - | null |
| text_body | LONGTEXT | No | Plain text content | - | null |
| template_key | VARCHAR(100) | No | Template used | - | null |
| template_variables | JSON | No | Variables passed to template | - | null |
| attachments | JSON | No | Array of attachment metadata | - | null |
| provider_message_id | VARCHAR(255) | No | Provider's message ID | UNIQUE for webhook matching | null |
| provider_metadata | JSON | No | Provider-specific response | - | null |
| webhook_signature | VARCHAR(255) | No | Webhook signature | - | null |
| error_message | TEXT | No | Error if failed | - | null |
| sent_at | TIMESTAMP | No | When sent | - | null |
| delivered_at | TIMESTAMP | No | When delivered (from webhook) | - | null |
| opened_at | TIMESTAMP | No | When opened (from webhook) | - | null |
| clicked_at | TIMESTAMP | No | When clicked (from webhook) | - | null |
| bounced_at | TIMESTAMP | No | When bounced (from webhook) | - | null |
| bounce_type | VARCHAR(50) | No | Bounce category | hard, soft, complaint | null |
| related_entity_type | VARCHAR(50) | No | Entity type | lead, quote, invoice | null |
| related_entity_id | UUID | No | Entity ID | - | null |
| created_at | TIMESTAMP | Yes | Created timestamp | - | now() |
| created_by_user_id | UUID | No | User who triggered | - | null |

**Indexes**:
- Primary: `id`
- Unique: `provider_message_id` - CRITICAL for webhook matching
- Composite: `(tenant_id, created_at DESC)` - Recent communications
- Composite: `(tenant_id, status)` - Filter by status
- Composite: `(tenant_id, channel, created_at DESC)` - Channel filtering
- Composite: `(related_entity_type, related_entity_id)` - Entity communications
- Index: `(to_email)` - Recipient history
- Index: `(provider_id, status)` - Provider performance tracking

**Relationships**:
- Belongs to: `tenant`, `communication_provider`, `user` (created_by)
- Has many: `webhook_event` (webhook deliveries for this event)

**Business Rules**:
- If `channel='email'`: `to_email`, `from_email`, `subject` required
- If `channel='sms'` or `channel='call'`: `to_phone` required
- Platform emails have `tenant_id = NULL`
- `provider_message_id` critical for matching webhooks
- Webhooks update: `status`, `delivered_at`, `opened_at`, `clicked_at`, `bounced_at`
- Cascade delete when tenant deleted
- Cascade set NULL when user deleted

---

#### **Table: webhook_event** (Webhook Audit Log)

**Purpose**: Complete audit log of all webhook deliveries from providers. Used for debugging, replay, and monitoring.

**Columns**:

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | UUID | Yes | Webhook event ID | - | uuid() |
| provider_id | UUID | Yes | FK to communication_provider | - | - |
| communication_event_id | UUID | No | FK to communication_event | - | null |
| event_type | VARCHAR(50) | Yes | Webhook event type | delivered, bounced, opened, clicked, failed | - |
| provider_message_id | VARCHAR(255) | No | Provider's message ID | - | null |
| payload | JSON | Yes | Full webhook payload | - | - |
| signature | VARCHAR(500) | No | Webhook signature | - | null |
| signature_verified | BOOLEAN | Yes | Signature valid | - | false |
| ip_address | VARCHAR(45) | No | Webhook sender IP | - | null |
| processed | BOOLEAN | Yes | Event processed | - | false |
| processed_at | TIMESTAMP | No | When processed | - | null |
| error_message | TEXT | No | Processing error | - | null |
| created_at | TIMESTAMP | Yes | Received timestamp | - | now() |

**Indexes**:
- Primary: `id`
- Foreign Key: `provider_id` → `communication_provider(id)`
- Foreign Key: `communication_event_id` → `communication_event(id)`
- Composite: `(provider_id, created_at DESC)` - Provider webhook history
- Index: `(provider_message_id)` - Match to communication_event
- Composite: `(processed, created_at)` - Unprocessed webhooks

**Relationships**:
- Belongs to: `communication_provider`, `communication_event`

**Business Rules**:
- ALL webhook deliveries logged (success or failure)
- `signature_verified` only true after signature/token verification
- `processed` only true after successfully updating communication_event
- Failed processing logged in `error_message`
- Duplicate webhooks (same `provider_message_id` + `event_type`) ignored (idempotency)

---

#### **Table: notification** (In-App Notifications)

**Purpose**: In-app notifications shown in notification bell. Auto-created by notification rules or manually.

**Columns**:

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | UUID | Yes | Notification ID | - | uuid() |
| tenant_id | UUID | Yes | Tenant ownership | - | - |
| user_id | UUID | No | Specific user (NULL = all users) | - | null |
| type | VARCHAR(50) | Yes | Notification type | info, success, warning, error, lead_created, etc. | - |
| title | VARCHAR(255) | Yes | Notification title | 3-255 chars | - |
| message | TEXT | Yes | Notification message | 10+ chars | - |
| action_url | VARCHAR(500) | No | Click action URL | Valid URL format | null |
| related_entity_type | VARCHAR(50) | No | Entity type | lead, quote, invoice | null |
| related_entity_id | UUID | No | Entity ID | - | null |
| is_read | BOOLEAN | Yes | Read status | - | false |
| read_at | TIMESTAMP | No | When read | - | null |
| expires_at | TIMESTAMP | No | Auto-delete after | - | null |
| created_at | TIMESTAMP | Yes | Created timestamp | - | now() |

**Indexes**:
- Primary: `id`
- Foreign Key: `tenant_id` → `tenant(id)` ON DELETE CASCADE
- Foreign Key: `user_id` → `user(id)` ON DELETE CASCADE
- Composite: `(tenant_id, user_id, is_read, created_at DESC)` - User notifications
- Composite: `(tenant_id, is_read, created_at DESC)` - Tenant notifications
- Index: `(expires_at)` - Cleanup job

**Relationships**:
- Belongs to: `tenant`, `user`

**Business Rules**:
- If `user_id = NULL`: notification visible to ALL users in tenant
- If `user_id = UUID`: notification only visible to that user
- `is_read` tracked per user
- Notifications auto-deleted after `expires_at`
- Cascade delete when tenant/user deleted

---

#### **Table: notification_rule** (Auto-Notification Rules)

**Purpose**: Auto-create notifications based on events (lead created, quote approved, etc.). Rules are tenant-specific.

**Columns**:

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | UUID | Yes | Rule ID | - | uuid() |
| tenant_id | UUID | Yes | Tenant ownership | - | - |
| event_type | VARCHAR(100) | Yes | Event trigger | lead_created, quote_approved, invoice_paid | - |
| notify_in_app | BOOLEAN | Yes | Create in-app notification | - | true |
| notify_email | BOOLEAN | Yes | Send email notification | - | false |
| email_template_key | VARCHAR(100) | No | Template for email | Required if notify_email=true | null |
| recipient_type | ENUM | Yes | Who receives | owner, assigned_user, specific_users, all_users | owner |
| specific_user_ids | JSON | No | User IDs array | Required if recipient_type=specific_users | null |
| is_active | BOOLEAN | Yes | Rule enabled | - | true |
| created_at | TIMESTAMP | Yes | Created timestamp | - | now() |
| updated_at | TIMESTAMP | Yes | Last update | - | now() |

**Indexes**:
- Primary: `id`
- Foreign Key: `tenant_id` → `tenant(id)` ON DELETE CASCADE
- Composite: `(tenant_id, event_type, is_active)` - Active rules for event
- Composite: `(tenant_id, is_active)` - All active rules

**Relationships**:
- Belongs to: `tenant`

**Business Rules**:
- If `notify_email = true`: `email_template_key` required
- If `recipient_type = 'specific_users'`: `specific_user_ids` required
- Rules evaluated when events fired (lead created, quote approved, etc.)
- Cascade delete when tenant deleted

---

### **Enums**

#### **provider_type**
```typescript
enum ProviderType {
  EMAIL = 'email',
  SMS = 'sms',
  CALL = 'call',
  PUSH = 'push',
  WHATSAPP = 'whatsapp',
}
```

#### **channel**
```typescript
enum Channel {
  EMAIL = 'email',
  SMS = 'sms',
  CALL = 'call',
}
```

#### **direction**
```typescript
enum Direction {
  OUTBOUND = 'outbound',
  INBOUND = 'inbound',
}
```

#### **communication_status**
```typescript
enum CommunicationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
}
```

#### **template_category**
```typescript
enum TemplateCategory {
  SYSTEM = 'system',
  TRANSACTIONAL = 'transactional',
  MARKETING = 'marketing',
  NOTIFICATION = 'notification',
}
```

#### **recipient_type**
```typescript
enum RecipientType {
  OWNER = 'owner',
  ASSIGNED_USER = 'assigned_user',
  SPECIFIC_USERS = 'specific_users',
  ALL_USERS = 'all_users',
}
```

---

## JSON Schema Examples

### **SMTP Provider**

```json
{
  "provider_key": "smtp",
  "provider_name": "SMTP",
  "provider_type": "email",
  "credentials_schema": {
    "type": "object",
    "required": ["smtp_username", "smtp_password"],
    "properties": {
      "smtp_username": {
        "type": "string",
        "minLength": 3,
        "maxLength": 255,
        "description": "SMTP username (usually email address)",
        "example": "noreply@lead360.app"
      },
      "smtp_password": {
        "type": "string",
        "minLength": 8,
        "maxLength": 255,
        "description": "SMTP password or app-specific password",
        "format": "password"
      }
    }
  },
  "config_schema": {
    "type": "object",
    "required": ["smtp_host", "smtp_port", "smtp_encryption"],
    "properties": {
      "smtp_host": {
        "type": "string",
        "minLength": 3,
        "maxLength": 255,
        "description": "SMTP server hostname",
        "example": "smtp.gmail.com"
      },
      "smtp_port": {
        "type": "integer",
        "minimum": 1,
        "maximum": 65535,
        "description": "SMTP port (587 for TLS, 465 for SSL)",
        "example": 587
      },
      "smtp_encryption": {
        "type": "string",
        "enum": ["none", "tls", "ssl"],
        "description": "Encryption method",
        "default": "tls"
      }
    }
  },
  "supports_webhooks": false
}
```

### **SendGrid Provider**

```json
{
  "provider_key": "sendgrid",
  "provider_name": "SendGrid",
  "provider_type": "email",
  "credentials_schema": {
    "type": "object",
    "required": ["api_key"],
    "properties": {
      "api_key": {
        "type": "string",
        "minLength": 20,
        "pattern": "^SG\\..+",
        "description": "SendGrid API key (starts with SG.)",
        "format": "password"
      }
    }
  },
  "config_schema": {
    "type": "object",
    "properties": {
      "ip_pool_name": {
        "type": "string",
        "description": "SendGrid IP pool name (optional)"
      },
      "click_tracking": {
        "type": "boolean",
        "description": "Enable click tracking",
        "default": false
      },
      "open_tracking": {
        "type": "boolean",
        "description": "Enable open tracking",
        "default": false
      }
    }
  },
  "supports_webhooks": true,
  "webhook_events": ["delivered", "bounce", "dropped", "spam_report", "open", "click"],
  "webhook_verification_method": "signature"
}
```

### **Amazon SES Provider**

```json
{
  "provider_key": "amazon_ses",
  "provider_name": "Amazon SES",
  "provider_type": "email",
  "credentials_schema": {
    "type": "object",
    "required": ["access_key_id", "secret_access_key", "region"],
    "properties": {
      "access_key_id": {
        "type": "string",
        "minLength": 16,
        "maxLength": 128,
        "description": "AWS access key ID",
        "example": "AKIAIOSFODNN7EXAMPLE"
      },
      "secret_access_key": {
        "type": "string",
        "minLength": 40,
        "description": "AWS secret access key",
        "format": "password"
      },
      "region": {
        "type": "string",
        "enum": ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"],
        "description": "AWS region",
        "default": "us-east-1"
      }
    }
  },
  "config_schema": {
    "type": "object",
    "properties": {
      "configuration_set": {
        "type": "string",
        "description": "SES configuration set name",
        "example": "lead360-emails"
      }
    }
  },
  "supports_webhooks": true,
  "webhook_events": ["send", "delivery", "bounce", "complaint", "open", "click"],
  "webhook_verification_method": "signature"
}
```

### **Brevo Provider**

```json
{
  "provider_key": "brevo",
  "provider_name": "Brevo",
  "provider_type": "email",
  "credentials_schema": {
    "type": "object",
    "required": ["api_key"],
    "properties": {
      "api_key": {
        "type": "string",
        "minLength": 20,
        "description": "Brevo API key (formerly Sendinblue)",
        "format": "password"
      }
    }
  },
  "config_schema": {
    "type": "object",
    "properties": {
      "template_id": {
        "type": "integer",
        "description": "Default Brevo template ID (optional)"
      }
    }
  },
  "supports_webhooks": true,
  "webhook_events": ["request", "delivered", "hard_bounce", "soft_bounce", "blocked", "spam", "opened", "click"],
  "webhook_verification_method": "token"
}
```

---

## API Specification

### **Endpoints Overview**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| **Provider Registry (Admin)** |
| GET | /admin/communication/providers | List providers | Yes | Platform Admin |
| GET | /admin/communication/providers/:key | Get provider details | Yes | Platform Admin |
| POST | /admin/communication/providers | Create provider | Yes | Platform Admin |
| PATCH | /admin/communication/providers/:key | Update provider | Yes | Platform Admin |
| PATCH | /admin/communication/providers/:key/toggle | Toggle active status | Yes | Platform Admin |
| **Platform Email Config (Admin)** |
| GET | /admin/communication/email-config | Get platform config | Yes | Platform Admin |
| POST | /admin/communication/email-config | Update platform config | Yes | Platform Admin |
| POST | /admin/communication/email-config/test | Test platform email | Yes | Platform Admin |
| **Tenant Email Config** |
| GET | /communication/providers | List available providers | Yes | All |
| GET | /communication/tenant-email-config | Get tenant config | Yes | All |
| POST | /communication/tenant-email-config | Create/update config | Yes | Tenant Admin |
| POST | /communication/tenant-email-config/test | Test tenant email | Yes | Tenant Admin |
| **Webhooks** |
| POST | /webhooks/communication/sendgrid | SendGrid webhook receiver | No | - |
| POST | /webhooks/communication/amazon-ses | Amazon SES webhook receiver | No | - |
| POST | /webhooks/communication/brevo | Brevo webhook receiver | No | - |
| POST | /webhooks/communication/:providerKey | Generic webhook receiver | No | - |
| **Email Templates** |
| GET | /communication/templates | List templates | Yes | All |
| GET | /communication/templates/:key | Get template | Yes | All |
| POST | /communication/templates | Create template | Yes | Tenant Admin |
| PATCH | /communication/templates/:key | Update template | Yes | Tenant Admin |
| DELETE | /communication/templates/:key | Delete template | Yes | Tenant Admin |
| POST | /communication/templates/:key/preview | Preview template | Yes | All |
| GET | /communication/templates/variables/registry | Available variables | Yes | All |
| GET | /communication/templates/variables/sample | Sample variable data | Yes | All |
| POST | /communication/templates/validate | Validate template | Yes | All |
| **Send Email** |
| POST | /communication/send-email | Send templated email | Yes | All (with permission) |
| POST | /communication/send-raw-email | Send raw email | Yes | All (with permission) |
| **Communication History** |
| GET | /communication/history | List communications | Yes | All |
| GET | /communication/history/:id | Get details | Yes | All |
| POST | /communication/history/:id/resend | Resend email | Yes | Tenant Admin |
| **Notifications** |
| GET | /communication/notifications | List notifications | Yes | All |
| GET | /communication/notifications/unread-count | Unread count | Yes | All |
| PATCH | /communication/notifications/:id/read | Mark as read | Yes | All |
| POST | /communication/notifications/mark-all-read | Mark all read | Yes | All |
| DELETE | /communication/notifications/:id | Delete notification | Yes | All |
| GET | /communication/notification-rules | List rules | Yes | Tenant Admin |
| POST | /communication/notification-rules | Create rule | Yes | Tenant Admin |

**Total**: 37 endpoints

---

## Webhook Specifications

### **Webhook Processing Flow**

```
1. Provider sends webhook → POST /api/v1/webhooks/communication/:providerKey
2. Extract provider from :providerKey (e.g., 'sendgrid')
3. Lookup provider's webhook_verification_method
4. Verify signature/token based on method
5. If verification FAILS → Log to webhook_event (signature_verified=false) → Return 401
6. If verification SUCCESS:
   a. Log to webhook_event table (full payload)
   b. Extract provider_message_id and event_type
   c. Find communication_event by provider_message_id
   d. Update communication_event status based on event_type:
      - 'delivered' → status='delivered', delivered_at=now
      - 'bounced' → status='bounced', bounced_at=now, bounce_type extracted
      - 'opened' → opened_at=now (status unchanged)
      - 'clicked' → clicked_at=now (status unchanged)
      - 'failed' → status='failed', error_message extracted
   e. Mark webhook_event as processed=true
7. Return 200 OK
```

### **Webhook Verification Methods**

#### **SendGrid (Signature-Based)**

**Verification**:
```
1. Extract headers:
   - X-Twilio-Email-Event-Webhook-Signature
   - X-Twilio-Email-Event-Webhook-Timestamp
2. Get webhook_secret from platform_email_config or tenant_email_config
3. Create verification string: timestamp + raw_body
4. Compute HMAC-SHA256(webhook_secret, verification_string)
5. Encode result as Base64
6. Compare with signature from header
7. Check timestamp is within 5 minutes (prevent replay attacks)
```

**Required Headers**:
- `X-Twilio-Email-Event-Webhook-Signature`: Signature to verify
- `X-Twilio-Email-Event-Webhook-Timestamp`: Unix timestamp

**Webhook Events**:
- `delivered`: Email successfully delivered
- `bounce`: Email bounced (hard or soft)
- `dropped`: Email dropped by SendGrid
- `spam_report`: Marked as spam
- `open`: Email opened (if tracking enabled)
- `click`: Link clicked (if tracking enabled)

---

#### **Amazon SES (SNS Signature)**

**Verification**:
```
1. AWS SNS sends signed messages
2. Extract SigningCertURL, Signature, SignatureVersion from payload
3. Download certificate from SigningCertURL (cache it)
4. Verify signature using certificate public key
5. If valid, parse message and process
```

**Required Fields**:
- `SigningCertURL`: Certificate URL
- `Signature`: Message signature
- `SignatureVersion`: Version (should be '1')

**Webhook Events**:
- `send`: Email sent
- `delivery`: Email delivered
- `bounce`: Email bounced
- `complaint`: Spam complaint
- `open`: Email opened
- `click`: Link clicked

---

#### **Brevo (Token-Based)**

**Verification**:
```
1. Extract token from:
   - Header: X-Sib-Token
   - OR Query parameter: ?token=xxx
2. Get webhook_secret from config
3. Compare token === webhook_secret
4. If match, process webhook
```

**Required Header**:
- `X-Sib-Token`: Verification token

**Webhook Events**:
- `request`: Email requested
- `delivered`: Email delivered
- `hard_bounce`: Hard bounce
- `soft_bounce`: Soft bounce
- `blocked`: Email blocked
- `spam`: Marked as spam
- `opened`: Email opened
- `click`: Link clicked

---

### **Webhook Idempotency**

**Rule**: Duplicate webhooks (same `provider_message_id` + `event_type`) must be ignored.

**Implementation**:
```
Before processing webhook:
1. Check if webhook_event exists with:
   - provider_message_id = extracted_message_id
   - event_type = extracted_event_type
   - processed = true
2. If exists → Return 200 OK (already processed, idempotent)
3. If not exists → Process webhook
```

---

## Business Rules

### **Validation Rules**

1. **Provider Configuration**
   - ALL credentials MUST be encrypted with AES-256-GCM before storage
   - ALL credentials MUST validate against provider's `credentials_schema` (JSON Schema)
   - ALL provider_config MUST validate against provider's `config_schema` (JSON Schema)
   - Validation happens in service layer (not controller) for consistency
   - is_verified flag only set to true after successful test email

2. **Webhook Processing**
   - ALL webhooks MUST verify signature/token before processing
   - Invalid signatures logged to webhook_event with signature_verified=false
   - Duplicate webhooks (same provider_message_id + event_type) ignored (idempotency)
   - Webhooks processed asynchronously via BullMQ queue
   - Failed webhook processing retried up to 3 times
   - Replay attacks prevented (timestamp check for signature-based verification)

3. **Email Sending**
   - Attachments MUST be fetched from File Storage module (tenant-scoped)
   - Template variables validated before rendering
   - ALL emails logged to communication_event (success or failure)
   - Failed emails can be manually retried (creates new event)
   - Email queue processed via BullMQ

4. **Multi-Tenant Isolation**
   - ALL database queries MUST include tenant_id filter (except platform config)
   - tenant_id extracted from JWT, NEVER from request body
   - Platform emails have tenant_id = NULL
   - Tenants cannot access other tenant's configurations
   - Tenants cannot access other tenant's communications
   - Tenants can view admin templates (read-only) but not other tenant's templates

5. **Notification Rules**
   - Rules evaluated when events fired
   - If notify_email = true, email_template_key required
   - If recipient_type = specific_users, specific_user_ids required
   - Notifications created asynchronously

---

## Security & Permissions

### **Authentication**

- ✅ All endpoints require JWT authentication (except webhooks)
- ✅ Webhooks authenticated via signature/token verification

### **RBAC Matrix**

| Action | Platform Admin | Owner | Admin | Other Roles |
|--------|---------------|-------|-------|-------------|
| **Provider Registry** |
| Manage providers | ✅ | ❌ | ❌ | ❌ |
| **Platform Email Config** |
| View/edit platform config | ✅ | ❌ | ❌ | ❌ |
| **Tenant Email Config** |
| View tenant config | ✅ | ✅ | ✅ | ✅ |
| Edit tenant config | ✅ | ✅ | ✅ | ❌ |
| **Email Templates** |
| View admin templates | ✅ | ✅ | ✅ | ✅ |
| Edit admin templates | ✅ | ❌ | ❌ | ❌ |
| View tenant templates | ✅ | ✅ | ✅ | ✅ |
| Create/edit tenant templates | ✅ | ✅ | ✅ | ❌ |
| **Send Email** |
| Send emails | ✅ | ✅ | ✅ | With permission |
| **Notifications** |
| View notifications | ✅ | ✅ | ✅ | ✅ |
| Manage notification rules | ✅ | ✅ | ✅ | ❌ |

### **Multi-Tenant Isolation**

- ✅ All queries MUST filter by `tenant_id`
- ✅ `tenant_id` extracted from JWT (never from client)
- ✅ Platform emails have `tenant_id = NULL`
- ✅ Tenant isolation tests required

### **Audit Logging**

**Log These Actions**:
- Create/update/delete provider
- Update platform email config
- Update tenant email config
- Send email
- Create/update/delete template
- Create/update/delete notification rule

---

## Acceptance Criteria

**Feature is complete when**:

### **Backend**
- [ ] All 7 database migrations applied successfully
- [ ] 4 providers seeded (SMTP, SendGrid, SES, Brevo) with complete JSON schemas
- [ ] JSON Schema validation working (using Ajv library)
- [ ] All 4 email providers can send emails
- [ ] All 3 webhook handlers implemented + signature verification working
- [ ] communication_event status updated from webhooks (delivered, bounced, opened, clicked)
- [ ] All 37 API endpoints implemented
- [ ] 100% API documentation (Swagger)
- [ ] Auth module migrated to use CommunicationService (password reset, activation)
- [ ] Unit tests >80% coverage
- [ ] Integration tests for all endpoints
- [ ] Tenant isolation tests passing
- [ ] Webhook replay attack protection working
- [ ] Idempotency working (duplicate webhooks ignored)

### **Frontend**
- [ ] Dynamic form generation from JSON Schema working
- [ ] Provider management UI (admin) - enable/disable providers
- [ ] Platform email config page (admin) - all 4 providers configurable
- [ ] Tenant email config page - all 4 providers configurable
- [ ] Template management UI (admin + tenant)
- [ ] Notification bell component (real-time unread count)
- [ ] Communication history page with filters
- [ ] Mobile responsive (all pages)
- [ ] Dark mode support (all pages)
- [ ] All forms validate using same JSON Schemas as backend

### **Integration**
- [ ] End-to-end flow: Config provider → Send email → Receive webhook → Status updated
- [ ] Password reset email working via new system
- [ ] Account activation email working via new system
- [ ] Lead created notification working (in-app + optional email)
- [ ] Quote sent email with attachment working
- [ ] Webhook delivery from SendGrid tested in staging
- [ ] Webhook delivery from Amazon SES tested in staging
- [ ] Webhook delivery from Brevo tested in staging

---

## Open Questions

None - all requirements clarified.

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| JSON Schema validation adds latency | Medium | Low | Cache compiled schemas, validate async |
| Webhook replay attacks | High | Medium | Timestamp validation + signature verification |
| Provider API changes break integration | High | Low | Version provider schemas, test in staging |
| Webhook delivery failures | Medium | Medium | Retry mechanism + manual replay from webhook_event log |
| Tenant configures invalid SMTP credentials | Low | High | Require test email before is_verified=true |

---

## Timeline Estimate

**Backend Development**: 3 weeks  
**Frontend Development**: 3 weeks  
**Integration & Testing**: 1 week  
**Total**: 7 weeks (can parallelize backend + frontend after week 2)

---

## Notes

**Migration from Existing System**:
- Current `email_queue` table replaced by `communication_event`
- Existing `platform_email_config` enhanced with provider_id + JSON fields
- Existing `email_template` enhanced with tenant_id + category
- Auth module email sending migrated to use CommunicationService

**Future Enhancements** (out of scope):
- SMS via Twilio (architecture supports it)
- Call logging via Twilio Voice
- WhatsApp messaging
- Push notifications

---

**End of Feature Contract**

This contract must be approved before development begins.