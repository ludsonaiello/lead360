# Sprint 11: Complete Admin Control Panel - CRUD Masterpiece

**Sprint Goal**: Achieve 100% admin control over all system configuration, providers, webhooks, and tenant assistance

**Priority**: HIGH - Completes admin functionality gaps
**Estimated Endpoints**: 32 new endpoints
**Current Coverage**: 38 endpoints (65%)
**After Sprint 11**: 70+ endpoints (100%)

---

## Executive Summary

Sprint 11 transforms the admin panel from a **monitoring dashboard** into a **complete system management platform**. Admins will have full CRUD control over:

- ✅ System settings (cron schedules, timezones, feature flags)
- ✅ Phone number purchasing and allocation
- ✅ Transcription provider management
- ✅ Webhook configuration and event management
- ✅ Tenant assistance (configure on behalf of tenants)
- ✅ Communication event corrections
- ✅ Alert acknowledgement workflows
- ✅ Bulk operations for efficiency
- ✅ Complete CSV export functionality

---

## Current State Analysis

### ✅ What We Have (38 endpoints)
- Cross-tenant oversight (6 endpoints)
- Usage tracking and billing (7 endpoints)
- System health monitoring (6 endpoints)
- Provider registry (8 endpoints)
- Transcription monitoring (4 endpoints)
- Phone number viewing (2 endpoints)
- Metrics and analytics (2 endpoints)
- Cron management (2 endpoints)

### ❌ What We're Missing (32 endpoints)
- System settings management (0/4 endpoints)
- Phone number operations (0/4 endpoints)
- Transcription provider CRUD (0/5 endpoints)
- Webhook management (0/5 endpoints)
- Tenant assistance (0/8 endpoints)
- Alert management (0/3 endpoints)
- Bulk operations (0/3 endpoints)

---

## Sprint 11 Feature Groups

## Phase 1: System Configuration Management (CRITICAL)

### 1.1 System Settings CRUD (4 endpoints)

**Purpose**: Allow admins to configure system-wide settings via UI instead of database edits

**Endpoints**:

#### GET `/api/v1/admin/system/settings`
- List all system settings with metadata
- Group by category (cron, features, limits, etc.)
- Show current values, defaults, and last modified

**Response**:
```json
{
  "settings": [
    {
      "key": "twilio_usage_sync_cron",
      "value": "0 2 * * *",
      "default": "0 2 * * *",
      "category": "cron",
      "description": "Cron schedule for daily Twilio usage sync",
      "type": "cron_expression",
      "last_updated": "2026-02-01T10:30:00Z",
      "updated_by": "admin@lead360.app"
    },
    {
      "key": "twilio_health_check_cron",
      "value": "*/15 * * * *",
      "default": "*/15 * * * *",
      "category": "cron",
      "description": "Cron schedule for health checks",
      "type": "cron_expression",
      "last_updated": "2026-01-15T08:00:00Z",
      "updated_by": "admin@lead360.app"
    },
    {
      "key": "cron_timezone",
      "value": "America/New_York",
      "default": "America/New_York",
      "category": "cron",
      "description": "Timezone for all cron schedules",
      "type": "timezone",
      "validation": ["America/New_York", "America/Los_Angeles", "UTC"],
      "last_updated": "2026-01-10T12:00:00Z"
    },
    {
      "key": "max_sms_per_tenant_per_day",
      "value": "1000",
      "default": "500",
      "category": "limits",
      "description": "Maximum SMS messages per tenant per day",
      "type": "number",
      "validation": { "min": 100, "max": 10000 },
      "last_updated": "2026-02-05T14:22:00Z"
    }
  ],
  "categories": ["cron", "features", "limits", "webhooks", "transcription"]
}
```

#### GET `/api/v1/admin/system/settings/:key`
- Get specific setting with validation rules
- Show change history

**Response**:
```json
{
  "key": "twilio_usage_sync_cron",
  "value": "0 2 * * *",
  "default": "0 2 * * *",
  "category": "cron",
  "description": "Cron schedule for daily Twilio usage sync",
  "type": "cron_expression",
  "validation": {
    "pattern": "^[0-9\\*\\/\\-\\,\\s]+$",
    "description": "Valid cron expression (5 fields)"
  },
  "last_updated": "2026-02-01T10:30:00Z",
  "updated_by": "admin@lead360.app",
  "change_history": [
    {
      "old_value": "0 3 * * *",
      "new_value": "0 2 * * *",
      "changed_at": "2026-02-01T10:30:00Z",
      "changed_by": "admin@lead360.app",
      "reason": "Moved sync earlier to avoid peak hours"
    }
  ]
}
```

#### PATCH `/api/v1/admin/system/settings/:key`
- Update setting value with validation
- Require confirmation for critical changes
- Log change with reason

**Request**:
```json
{
  "value": "0 3 * * *",
  "reason": "Moving sync to 3 AM to avoid conflicts"
}
```

**Response**:
```json
{
  "key": "twilio_usage_sync_cron",
  "old_value": "0 2 * * *",
  "new_value": "0 3 * * *",
  "updated_at": "2026-02-06T15:45:00Z",
  "updated_by": "admin@lead360.app",
  "requires_reload": true,
  "reload_endpoints": ["/admin/communication/cron/reload"]
}
```

#### GET `/api/v1/admin/system/settings/history`
- View all setting changes
- Filter by category, date range, admin

**Response**:
```json
{
  "changes": [
    {
      "setting_key": "twilio_usage_sync_cron",
      "old_value": "0 3 * * *",
      "new_value": "0 2 * * *",
      "changed_at": "2026-02-01T10:30:00Z",
      "changed_by": "admin@lead360.app",
      "reason": "Moved sync earlier"
    }
  ],
  "pagination": {...}
}
```

**Implementation**:
- Service: `SystemSettingsService`
- Controller: `SystemSettingsController`
- Validation: Schema-based validation for each setting type
- Audit: Log all changes to `setting_change_history` table

---

### 1.2 Webhook Management (5 endpoints)

**Purpose**: Full control over webhook configuration, event management, and troubleshooting

#### GET `/api/v1/admin/communication/webhooks/config`
- Get current webhook configuration
- Show registered webhook URLs
- Display webhook secret status

**Response**:
```json
{
  "webhook_config": {
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
      "last_rotated": "2026-01-15T10:00:00Z"
    }
  }
}
```

#### PATCH `/api/v1/admin/communication/webhooks/config`
- Update webhook URLs
- Rotate webhook secret
- Toggle signature verification

**Request**:
```json
{
  "base_url": "https://api.lead360.app",
  "rotate_secret": true,
  "signature_verification": true
}
```

#### POST `/api/v1/admin/communication/webhooks/test`
- Send test webhook to verify endpoint
- Check signature verification
- Validate webhook processing

**Request**:
```json
{
  "webhook_type": "sms",
  "test_payload": {
    "MessageSid": "SM_test_12345",
    "From": "+15551234567",
    "Body": "Test message"
  }
}
```

**Response**:
```json
{
  "status": "success",
  "webhook_url": "https://api.lead360.app/webhooks/twilio/sms",
  "response_time_ms": 145,
  "status_code": 200,
  "signature_valid": true,
  "processing_result": "Message recorded successfully"
}
```

#### GET `/api/v1/admin/communication/webhook-events`
- View webhook event history
- Filter by type, status, date range
- Show failed webhooks for retry

**Query Parameters**:
- `webhook_type`: sms, call, whatsapp, email
- `status`: pending, processed, failed
- `start_date`, `end_date`
- `page`, `limit`

**Response**:
```json
{
  "webhook_events": [
    {
      "id": "whe_12345",
      "webhook_type": "sms",
      "received_at": "2026-02-06T14:30:00Z",
      "status": "failed",
      "payload": { "MessageSid": "...", "From": "..." },
      "error_message": "Database connection timeout",
      "retry_count": 2,
      "next_retry_at": "2026-02-06T14:45:00Z"
    }
  ],
  "pagination": {...}
}
```

#### POST `/api/v1/admin/communication/webhook-events/:id/retry`
- Manually retry failed webhook
- Reset retry count
- Force immediate processing

**Response**:
```json
{
  "webhook_event_id": "whe_12345",
  "retry_status": "success",
  "processed_at": "2026-02-06T15:00:00Z",
  "result": "SMS message recorded and processed"
}
```

**Implementation**:
- Service: `WebhookManagementService`
- Controller: `WebhookManagementController`
- Table: `webhook_event` (already exists, needs endpoints)

---

## Phase 2: Phone Number Operations (CRITICAL)

### 2.1 Phone Number CRUD (4 endpoints)

**Purpose**: Complete phone number lifecycle management

#### POST `/api/v1/admin/communication/phone-numbers/purchase`
- Purchase new phone number from Twilio
- Allocate to tenant (optional)
- Configure for SMS/Voice/WhatsApp

**Request**:
```json
{
  "phone_number": "+19781234567",
  "capabilities": ["sms", "voice", "mms"],
  "allocate_to_tenant": "tenant-uuid-123",
  "purpose": "sms",
  "friendly_name": "Acme Roofing SMS Line"
}
```

**Response**:
```json
{
  "purchase_status": "success",
  "phone_number": {
    "sid": "PN_abcdef123456",
    "phone_number": "+19781234567",
    "capabilities": {
      "voice": true,
      "sms": true,
      "mms": true
    },
    "monthly_cost": "1.00",
    "allocated_to": {
      "tenant_id": "tenant-uuid-123",
      "tenant_name": "Acme Roofing",
      "purpose": "sms"
    },
    "purchased_at": "2026-02-06T15:30:00Z"
  }
}
```

**Implementation**: Uses existing `purchaseAndAllocatePhoneNumber()` service method

#### POST `/api/v1/admin/communication/phone-numbers/:sid/allocate`
- Allocate existing number to tenant
- Configure for SMS or WhatsApp
- Create tenant config automatically

**Request**:
```json
{
  "tenant_id": "tenant-uuid-456",
  "purpose": "whatsapp",
  "create_config": true
}
```

**Response**:
```json
{
  "allocation_status": "success",
  "phone_number": "+19787654321",
  "allocated_to": {
    "tenant_id": "tenant-uuid-456",
    "tenant_name": "Best Plumbing",
    "purpose": "whatsapp"
  },
  "config_created": {
    "config_id": "whatsapp_config_789",
    "status": "active",
    "verified": false
  }
}
```

**Implementation**: Uses existing `allocatePhoneNumberToTenant()` service method

#### DELETE `/api/v1/admin/communication/phone-numbers/:sid/allocate`
- Deallocate number from tenant
- Keep number in inventory
- Optionally delete tenant config

**Request**:
```json
{
  "delete_tenant_config": false,
  "reason": "Tenant no longer needs WhatsApp"
}
```

**Response**:
```json
{
  "deallocation_status": "success",
  "phone_number": "+19787654321",
  "previously_allocated_to": "Best Plumbing",
  "status": "available",
  "tenant_config_deleted": false
}
```

#### DELETE `/api/v1/admin/communication/phone-numbers/:sid`
- Release number back to Twilio
- Remove from inventory
- Ensure not allocated to any tenant

**Response**:
```json
{
  "release_status": "success",
  "phone_number": "+19781111111",
  "released_at": "2026-02-06T16:00:00Z",
  "final_cost_impact": "-1.00"
}
```

**Implementation**:
- Service: `TwilioProviderManagementService` (extend existing)
- Controller: `TwilioAdminController` (add new endpoints)

---

## Phase 3: Transcription Provider Management (HIGH)

### 3.1 Transcription Provider CRUD (5 endpoints)

**Purpose**: Manage AI transcription providers (OpenAI Whisper, Deepgram, AssemblyAI)

#### POST `/api/v1/admin/communication/transcription-providers`
- Add new transcription provider
- Configure API key and settings
- Set as system default (optional)

**Request**:
```json
{
  "provider_name": "openai_whisper",
  "api_key": "sk-...",
  "api_endpoint": "https://api.openai.com/v1/audio/transcriptions",
  "model": "whisper-1",
  "language": "en",
  "cost_per_minute": 0.0060,
  "usage_limit": 10000,
  "is_system_default": true,
  "tenant_id": null
}
```

**Response**:
```json
{
  "provider_id": "trans_prov_123",
  "provider_name": "openai_whisper",
  "status": "active",
  "is_system_default": true,
  "created_at": "2026-02-06T15:00:00Z"
}
```

#### GET `/api/v1/admin/communication/transcription-providers/:id`
- Get provider details
- Show usage statistics
- Display configuration

**Response**:
```json
{
  "provider_id": "trans_prov_123",
  "provider_name": "openai_whisper",
  "model": "whisper-1",
  "language": "en",
  "cost_per_minute": 0.0060,
  "usage_limit": 10000,
  "usage_current": 2450,
  "is_system_default": true,
  "status": "active",
  "statistics": {
    "total_transcriptions": 1225,
    "successful": 1200,
    "failed": 25,
    "success_rate": "97.96%",
    "total_cost": "73.50"
  }
}
```

#### PATCH `/api/v1/admin/communication/transcription-providers/:id`
- Update API key
- Adjust usage limits
- Change default status

**Request**:
```json
{
  "api_key": "sk-new-key-...",
  "usage_limit": 15000,
  "is_system_default": false
}
```

#### DELETE `/api/v1/admin/communication/transcription-providers/:id`
- Remove provider
- Prevent deletion if in use
- Migrate existing transcriptions

**Response**:
```json
{
  "deletion_status": "success",
  "provider_name": "openai_whisper",
  "transcriptions_migrated_to": "deepgram"
}
```

#### POST `/api/v1/admin/communication/transcription-providers/:id/test`
- Test provider connectivity
- Validate API key
- Check quota/limits

**Request**:
```json
{
  "test_audio_url": "https://example.com/sample.mp3"
}
```

**Response**:
```json
{
  "test_status": "success",
  "provider_name": "openai_whisper",
  "response_time_ms": 2340,
  "transcription_preview": "This is a test audio file for...",
  "quota_remaining": 7550,
  "api_key_valid": true
}
```

**Implementation**:
- Service: `TranscriptionProviderManagementService` (new)
- Controller: Extend `TwilioAdminController`
- Table: `transcription_provider_configuration`

---

## Phase 4: Tenant Assistance Features (HIGH)

### 4.1 Admin On-Behalf Configuration (8 endpoints)

**Purpose**: Allow admins to configure tenant settings on their behalf for support

#### POST `/api/v1/admin/tenants/:tenantId/sms-config`
- Create SMS config for tenant
- Use system provider or custom credentials
- Test configuration automatically

**Request**:
```json
{
  "provider_type": "system",
  "from_phone": "+19781234567",
  "test_connection": true
}
```

**Response**:
```json
{
  "config_id": "sms_config_456",
  "tenant_id": "tenant-uuid-123",
  "tenant_name": "Acme Roofing",
  "from_phone": "+19781234567",
  "status": "active",
  "verified": true,
  "test_result": "SMS sent successfully"
}
```

#### PATCH `/api/v1/admin/tenants/:tenantId/sms-config/:configId`
- Update tenant SMS config
- Fix broken configurations
- Rotate credentials

#### POST `/api/v1/admin/tenants/:tenantId/whatsapp-config`
- Create WhatsApp config for tenant

#### PATCH `/api/v1/admin/tenants/:tenantId/whatsapp-config/:configId`
- Update WhatsApp config

#### POST `/api/v1/admin/tenants/:tenantId/email-config`
- Create email config for tenant

#### PATCH `/api/v1/admin/tenants/:tenantId/email-config/:configId`
- Update email config

#### GET `/api/v1/admin/tenants/:tenantId/email-templates`
- View tenant's email templates

#### POST `/api/v1/admin/tenants/:tenantId/email-templates`
- Create email template for tenant

**Implementation**:
- Service: `TenantAssistanceService` (new)
- Controller: `TenantAssistanceController` (new)
- Audit: Log all admin actions on behalf of tenants

---

## Phase 5: Alert & Event Management (MEDIUM)

### 5.1 Alert Management (3 endpoints)

#### PATCH `/api/v1/admin/communication/alerts/:id/acknowledge`
- Mark alert as acknowledged
- Add admin comment
- Update alert status

**Request**:
```json
{
  "comment": "Investigating Twilio API slowness",
  "resolution_eta": "2026-02-06T18:00:00Z"
}
```

**Response**:
```json
{
  "alert_id": "alert_789",
  "status": "acknowledged",
  "acknowledged_by": "admin@lead360.app",
  "acknowledged_at": "2026-02-06T15:30:00Z",
  "comment": "Investigating Twilio API slowness"
}
```

#### PATCH `/api/v1/admin/communication/alerts/:id/resolve`
- Mark alert as resolved
- Document resolution
- Close alert

**Request**:
```json
{
  "resolution": "Twilio API performance restored. Issue was on their end.",
  "permanent_fix": false
}
```

#### POST `/api/v1/admin/communication/alerts/bulk-acknowledge`
- Acknowledge multiple alerts
- Useful for system-wide issues

**Request**:
```json
{
  "alert_ids": ["alert_789", "alert_790", "alert_791"],
  "comment": "All related to same Twilio outage"
}
```

**Implementation**:
- Service: Extend `TwilioHealthMonitorService`
- Controller: Extend `TwilioAdminController`
- Table: `admin_alert`

### 5.2 Communication Event Management (3 endpoints)

#### POST `/api/v1/admin/communication-events/:id/resend`
- Retry failed email/SMS
- Force resend with manual override

#### PATCH `/api/v1/admin/communication-events/:id/status`
- Mark message as delivered
- Fix stuck messages
- Correct erroneous status

#### DELETE `/api/v1/admin/communication-events/:id`
- Delete erroneous communication event
- Clean up test messages
- Remove duplicates

**Implementation**:
- Service: `CommunicationEventManagementService` (new)
- Controller: `CommunicationEventController` (new)

---

## Phase 6: Bulk Operations & Analytics (LOW)

### 6.1 Bulk Operations (3 endpoints)

#### POST `/api/v1/admin/communication/transcriptions/batch-retry`
- Retry all failed transcriptions
- Filter by date range or provider

**Request**:
```json
{
  "filters": {
    "status": "failed",
    "provider": "openai_whisper",
    "start_date": "2026-02-01",
    "end_date": "2026-02-06"
  },
  "limit": 100
}
```

**Response**:
```json
{
  "batch_id": "batch_retry_456",
  "queued_count": 45,
  "estimated_completion": "2026-02-06T16:00:00Z"
}
```

#### POST `/api/v1/admin/communication/communication-events/batch-resend`
- Retry multiple failed messages

#### POST `/api/v1/admin/communication/webhook-events/batch-retry`
- Retry multiple failed webhooks

**Implementation**:
- Service: `BulkOperationsService` (new)
- Controller: `BulkOperationsController` (new)
- Queue: Use BullMQ for async processing

### 6.2 Enhanced Analytics (3 endpoints)

#### GET `/api/v1/admin/communication/usage/trends`
- View usage trends over time
- Compare month-over-month
- Identify cost spikes

**Implementation**: Expose existing `getUsageTrends()` service method

#### GET `/api/v1/admin/communication/health/history`
- View health check history
- Identify patterns in failures
- Track uptime metrics

**Implementation**: Expose existing `getHealthCheckHistory()` service method

#### POST `/api/v1/admin/communication/usage/export`
- Complete CSV export implementation
- Currently returns placeholder
- Support filtered exports

**Implementation**: Complete the stub in `TwilioAdminController`

---

## Implementation Plan

### Week 1: System Configuration (Days 1-3)
- Day 1: System Settings CRUD (4 endpoints)
  - Create `SystemSettingsService`
  - Create `SystemSettingsController`
  - Implement validation schemas
  - Add change history tracking

- Day 2: Webhook Management (5 endpoints)
  - Create `WebhookManagementService`
  - Create `WebhookManagementController`
  - Implement webhook testing
  - Add event retry logic

- Day 3: Testing & Documentation
  - Write unit tests for settings + webhooks
  - Generate Swagger docs
  - Create admin REST API documentation

### Week 2: Phone & Transcription (Days 4-6)
- Day 4: Phone Number Operations (4 endpoints)
  - Expose existing service methods via controller
  - Add allocation/deallocation endpoints
  - Implement purchase workflow
  - Add release functionality

- Day 5: Transcription Provider CRUD (5 endpoints)
  - Create `TranscriptionProviderManagementService`
  - Add provider CRUD endpoints
  - Implement provider testing
  - Add usage tracking

- Day 6: Testing & Documentation
  - Write integration tests
  - Test phone allocation flow end-to-end
  - Document transcription provider setup

### Week 3: Tenant Assistance (Days 7-9)
- Day 7-8: On-Behalf Configuration (8 endpoints)
  - Create `TenantAssistanceService`
  - Create `TenantAssistanceController`
  - Implement config creation on behalf
  - Add audit logging for admin actions

- Day 9: Alert Management (3 endpoints)
  - Extend `TwilioHealthMonitorService`
  - Add alert acknowledgement
  - Implement resolution workflow
  - Add bulk acknowledgement

### Week 4: Operations & Polish (Days 10-12)
- Day 10: Communication Event Management (3 endpoints)
  - Create `CommunicationEventManagementService`
  - Add resend/status update/delete
  - Implement safety checks

- Day 11: Bulk Operations (3 endpoints)
  - Create `BulkOperationsService`
  - Implement batch retry logic
  - Add BullMQ job processing

- Day 12: Analytics & Export (3 endpoints)
  - Expose usage trends endpoint
  - Expose health history endpoint
  - Complete CSV export implementation

### Week 5: Testing & Documentation (Days 13-15)
- Day 13: Integration Testing
  - Test all new endpoints
  - End-to-end workflow testing
  - Load testing for bulk operations

- Day 14: Documentation
  - Update admin REST API docs
  - Write admin user guide
  - Create troubleshooting guides

- Day 15: Code Review & Deployment
  - Code review all changes
  - Update changelog
  - Deploy to staging
  - QA validation

---

## Acceptance Criteria

### ✅ System Configuration
- [ ] Admin can view all system settings via UI
- [ ] Admin can update cron schedules without database access
- [ ] Admin can configure webhook URLs and secrets
- [ ] Admin can test webhook endpoints
- [ ] Admin can view/retry failed webhook events

### ✅ Phone Number Management
- [ ] Admin can purchase new phone numbers from Twilio
- [ ] Admin can allocate numbers to tenants
- [ ] Admin can deallocate numbers from tenants
- [ ] Admin can release numbers back to Twilio
- [ ] Phone allocation creates tenant config automatically

### ✅ Transcription Provider Management
- [ ] Admin can add new transcription providers
- [ ] Admin can update provider API keys
- [ ] Admin can set system default provider
- [ ] Admin can test provider connectivity
- [ ] Admin can view provider usage statistics

### ✅ Tenant Assistance
- [ ] Admin can create SMS config for tenant
- [ ] Admin can create WhatsApp config for tenant
- [ ] Admin can create email config for tenant
- [ ] Admin can update tenant configs on their behalf
- [ ] Admin can view/create tenant email templates
- [ ] All admin actions are audit logged

### ✅ Alert Management
- [ ] Admin can acknowledge alerts with comments
- [ ] Admin can resolve alerts with resolution notes
- [ ] Admin can bulk acknowledge related alerts
- [ ] Alert status workflow is complete

### ✅ Communication Event Management
- [ ] Admin can resend failed messages
- [ ] Admin can update message status
- [ ] Admin can delete erroneous events
- [ ] Safety checks prevent accidental deletions

### ✅ Bulk Operations
- [ ] Admin can batch retry failed transcriptions
- [ ] Admin can batch resend failed messages
- [ ] Admin can batch retry failed webhooks
- [ ] Bulk operations use queues for async processing

### ✅ Analytics & Export
- [ ] Admin can view usage trends over time
- [ ] Admin can view health check history
- [ ] Admin can export usage data to CSV
- [ ] CSV export supports filtering and date ranges

---

## Database Changes

### New Tables

#### `setting_change_history`
```sql
CREATE TABLE setting_change_history (
  id VARCHAR(36) PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  INDEX idx_setting (setting_key),
  INDEX idx_changed_at (changed_at)
);
```

#### `webhook_config`
```sql
CREATE TABLE webhook_config (
  id VARCHAR(36) PRIMARY KEY,
  base_url VARCHAR(255) NOT NULL,
  webhook_secret TEXT NOT NULL,
  signature_verification BOOLEAN DEFAULT TRUE,
  last_rotated TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Updated Tables

#### `admin_alert` - Add acknowledgement fields
```sql
ALTER TABLE admin_alert
ADD COLUMN acknowledged BOOLEAN DEFAULT FALSE,
ADD COLUMN acknowledged_by VARCHAR(255),
ADD COLUMN acknowledged_at TIMESTAMP,
ADD COLUMN comment TEXT,
ADD COLUMN resolved BOOLEAN DEFAULT FALSE,
ADD COLUMN resolved_by VARCHAR(255),
ADD COLUMN resolved_at TIMESTAMP,
ADD COLUMN resolution TEXT;
```

#### `webhook_event` - Add retry tracking
```sql
ALTER TABLE webhook_event
ADD COLUMN retry_count INT DEFAULT 0,
ADD COLUMN next_retry_at TIMESTAMP,
ADD COLUMN error_message TEXT;
```

---

## API Documentation Updates

### Update Documentation Files
1. `communication_twillio_admin_REST_API.md`
   - Add 32 new endpoint sections
   - Update endpoint count from 38 to 70+
   - Add new categories:
     - System Settings Management (4)
     - Webhook Management (5)
     - Phone Number Operations (4)
     - Transcription Provider Management (5)
     - Tenant Assistance (8)
     - Alert Management (3)
     - Communication Event Management (3)

2. Create new documentation:
   - `admin_system_settings_guide.md`
   - `admin_tenant_assistance_guide.md`
   - `admin_bulk_operations_guide.md`

---

## Testing Strategy

### Unit Tests
- Test all service methods
- Test validation logic
- Test error handling
- Target: 90%+ coverage

### Integration Tests
- Test complete workflows end-to-end
- Test phone allocation → config creation
- Test bulk operations → queue processing
- Test webhook retry → event processing

### E2E Tests
- Admin creates system setting
- Admin purchases and allocates phone number
- Admin configures tenant on behalf
- Admin acknowledges and resolves alert

---

## Success Metrics

### Quantitative
- ✅ 70+ admin endpoints (100% coverage)
- ✅ 90%+ test coverage
- ✅ All service methods exposed
- ✅ Zero missing CRUD operations
- ✅ 100% API documentation coverage

### Qualitative
- ✅ Admins can configure everything via UI
- ✅ Zero database direct access needed
- ✅ Complete audit trail for all admin actions
- ✅ Professional admin UX
- ✅ Feature parity with competitors

---

## Risks & Mitigations

### Risk 1: Scope Creep (32 new endpoints)
**Mitigation**:
- Stick to 5-week timeline
- Prioritize critical features first
- Defer low-priority features if needed

### Risk 2: Breaking Existing Functionality
**Mitigation**:
- Comprehensive integration testing
- No changes to existing endpoints
- Only add new endpoints

### Risk 3: Performance Impact of Bulk Operations
**Mitigation**:
- Use BullMQ queues for async processing
- Implement rate limiting
- Add progress tracking

### Risk 4: Security Concerns (Admin Power)
**Mitigation**:
- Require SystemAdmin role on all endpoints
- Audit log all admin actions
- Require confirmation for destructive operations
- Implement role-based access control

---

## Post-Sprint Validation

### Admin Panel Checklist
- [ ] Can configure all system settings
- [ ] Can manage all providers
- [ ] Can purchase/allocate phone numbers
- [ ] Can configure transcription providers
- [ ] Can assist tenants with configuration
- [ ] Can acknowledge/resolve alerts
- [ ] Can retry failed operations
- [ ] Can export data to CSV
- [ ] Can view all usage trends
- [ ] Can manage webhooks

### Documentation Checklist
- [ ] All 70+ endpoints documented
- [ ] All request/response examples provided
- [ ] All error codes documented
- [ ] Admin user guide complete
- [ ] Troubleshooting guide complete

---

## Conclusion

Sprint 11 delivers a **complete, professional admin control panel** with:
- **100% CRUD coverage** - No missing operations
- **70+ endpoints** - Comprehensive API
- **Full system control** - Configure everything via UI
- **Tenant assistance** - Help tenants succeed
- **Audit trail** - Complete visibility
- **Bulk operations** - Efficient management
- **Export capabilities** - Data portability

After Sprint 11, Lead360 will have a **world-class admin system** that rivals or exceeds competitors like Salesforce, HubSpot, and Zendesk.

**Estimated completion**: 5 weeks (15 working days)
**Estimated endpoints after Sprint 11**: 70+ (100% coverage)
**Current completeness**: 65%
**Post-Sprint 11 completeness**: 100% 🎯
