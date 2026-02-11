# Sprint 11 Admin CRUD Implementation Plan - READY TO IMPLEMENT

## Executive Summary

Sprint 11 aims to add **31 new admin endpoints** to achieve "100% admin control" over the Twilio communication system. After thorough codebase exploration, the documentation was found to be outdated. Several features already exist in different locations.

**Status**: ✅ APPROVED FOR IMPLEMENTATION

---

## Current State Analysis (Verified by Code Review)

### What Already Exists

#### 1. System Settings Infrastructure ✅ ALREADY EXISTS
**Location**: `/admin/settings` (NOT `/admin/communication/system/settings`)
- Controller: `/api/src/modules/admin/controllers/system-settings.controller.ts`
- Service: `/api/src/modules/admin/services/system-setting.service.ts`
- 6 endpoints already exist
- Audit logging in place
- **Conclusion**: Sprint 11's "System Settings CRUD" is REDUNDANT

#### 2. Phone Number Management (Partial) ⚠️ 50% EXISTS
- Service methods exist: `purchaseAndAllocatePhoneNumber`, `allocatePhoneNumberToTenant`, `listOwnedPhoneNumbers`
- Missing methods: `deallocatePhoneNumberFromTenant`, `releasePhoneNumber`
- Missing controller endpoints: 4 endpoints need to be added

#### 3. Twilio Admin Controller ✅ 33 ENDPOINTS EXIST
- File: `/api/src/modules/communication/controllers/admin/twilio-admin.controller.ts`
- Route Prefix: `/admin/communication`
- 1 stub endpoint (CSV export) needs completion

---

## What Needs to Be Implemented (31 Endpoints)

### Category A: Webhook Management (5 endpoints)
**Database Changes**: New table `webhook_config`, alter `webhook_event`

**Endpoints**:
1. GET `/admin/communication/webhooks/config`
2. PATCH `/admin/communication/webhooks/config`
3. POST `/admin/communication/webhooks/test`
4. GET `/admin/communication/webhook-events`
5. POST `/admin/communication/webhook-events/:id/retry`

**Service**: `WebhookManagementService` (NEW)

---

### Category B: Phone Number Operations (4 endpoints)
**Database Changes**: None (tables exist)

**Endpoints**:
1. POST `/admin/communication/phone-numbers/purchase`
2. POST `/admin/communication/phone-numbers/:sid/allocate`
3. DELETE `/admin/communication/phone-numbers/:sid/allocate`
4. DELETE `/admin/communication/phone-numbers/:sid`

**Service**: Extend `TwilioProviderManagementService` with 2 new methods

---

### Category C: Transcription Provider CRUD (5 endpoints)
**Database Changes**: None (table exists)

**Endpoints**:
1. POST `/admin/communication/transcription-providers`
2. GET `/admin/communication/transcription-providers/:id`
3. PATCH `/admin/communication/transcription-providers/:id`
4. DELETE `/admin/communication/transcription-providers/:id`
5. POST `/admin/communication/transcription-providers/:id/test`

**Service**: `TranscriptionProviderManagementService` (NEW)

---

### Category D: Tenant Assistance (6 endpoints)
**Database Changes**: None (tables exist)

**Endpoints**:
1. POST `/admin/communication/tenants/:tenantId/sms-config`
2. PATCH `/admin/communication/tenants/:tenantId/sms-config/:configId`
3. POST `/admin/communication/tenants/:tenantId/whatsapp-config`
4. PATCH `/admin/communication/tenants/:tenantId/whatsapp-config/:configId`
5. POST `/admin/communication/tenants/:tenantId/test-sms`
6. POST `/admin/communication/tenants/:tenantId/test-whatsapp`

**Service**: `TenantAssistanceService` (NEW)

---

### Category E: Alert Management (3 endpoints)
**Database Changes**: Alter `admin_alert` table (add comment/resolution fields)

**Endpoints**:
1. PATCH `/admin/communication/alerts/:id/acknowledge`
2. PATCH `/admin/communication/alerts/:id/resolve`
3. POST `/admin/communication/alerts/bulk-acknowledge`

**Service**: `AlertManagementService` (NEW) or extend `TwilioHealthMonitorService`

---

### Category F: Communication Event Management (3 endpoints)
**Database Changes**: None (table exists)

**Endpoints**:
1. POST `/admin/communication/communication-events/:id/resend`
2. PATCH `/admin/communication/communication-events/:id/status`
3. DELETE `/admin/communication/communication-events/:id`

**Service**: `CommunicationEventManagementService` (NEW)

---

### Category G: Bulk Operations (4 endpoints)
**Database Changes**: None (tables exist)

**Endpoints**:
1. POST `/admin/communication/transcriptions/batch-retry`
2. POST `/admin/communication/communication-events/batch-resend`
3. POST `/admin/communication/webhook-events/batch-retry`
4. Complete GET `/admin/communication/usage/export` (fix stub)

**Service**: `BulkOperationsService` (NEW) - Uses BullMQ

---

## Database Migrations Required (3 migrations)

### Migration 1: Webhook Infrastructure
```sql
-- Create webhook_config table
CREATE TABLE webhook_config (
  id VARCHAR(36) PRIMARY KEY,
  base_url VARCHAR(255) NOT NULL,
  webhook_secret TEXT NOT NULL,
  signature_verification BOOLEAN DEFAULT TRUE,
  last_rotated TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add retry fields to webhook_event
ALTER TABLE webhook_event
ADD COLUMN retry_count INT DEFAULT 0,
ADD COLUMN next_retry_at TIMESTAMP;
```

### Migration 2: Alert Workflow Enhancement
```sql
ALTER TABLE admin_alert
ADD COLUMN comment TEXT,
ADD COLUMN resolved BOOLEAN DEFAULT FALSE,
ADD COLUMN resolved_by VARCHAR(36),
ADD COLUMN resolved_at TIMESTAMP,
ADD COLUMN resolution TEXT;
```

### Migration 3: Setting Change History (Optional)
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

---

## New Services Required (5 services + 1 extension)

### 1. WebhookManagementService
**Location**: `/api/src/modules/communication/services/admin/webhook-management.service.ts`

**Methods**:
- `getWebhookConfig()` - Get current webhook configuration
- `updateWebhookConfig(dto)` - Update webhook URLs/secret
- `rotateWebhookSecret()` - Generate new secret
- `testWebhookEndpoint(type, payload)` - Send test webhook
- `getWebhookEvents(filters)` - List webhook events with pagination
- `retryWebhookEvent(id)` - Retry failed webhook processing

**Dependencies**: PrismaService, Logger

---

### 2. TranscriptionProviderManagementService
**Location**: `/api/src/modules/communication/services/admin/transcription-provider-management.service.ts`

**Methods**:
- `createProvider(dto)` - Create new transcription provider config
- `getProvider(id)` - Get specific provider with stats
- `updateProvider(id, dto)` - Update provider config
- `deleteProvider(id)` - Delete provider (check dependencies)
- `testProvider(id, audioUrl)` - Test provider API connectivity
- `listProviders()` - List all providers with usage stats

**Dependencies**: PrismaService, EncryptionService, Logger

---

### 3. TenantAssistanceService
**Location**: `/api/src/modules/communication/services/admin/tenant-assistance.service.ts`

**Methods**:
- `createSmsConfigForTenant(tenantId, dto, adminUserId)` - Create SMS config on behalf
- `updateSmsConfigForTenant(tenantId, configId, dto, adminUserId)` - Update SMS config
- `createWhatsAppConfigForTenant(tenantId, dto, adminUserId)` - Create WhatsApp config
- `updateWhatsAppConfigForTenant(tenantId, configId, dto, adminUserId)` - Update WhatsApp config
- `testSmsConfig(tenantId, configId)` - Send test SMS
- `testWhatsAppConfig(tenantId, configId)` - Send test WhatsApp message

**Dependencies**: PrismaService, EncryptionService, AuditLoggerService, TwilioProviderManagementService

---

### 4. AlertManagementService
**Location**: `/api/src/modules/communication/services/admin/alert-management.service.ts`

**Methods**:
- `acknowledgeAlert(id, comment, adminUserId)` - Mark alert as acknowledged
- `resolveAlert(id, resolution, adminUserId)` - Mark alert as resolved
- `bulkAcknowledgeAlerts(ids[], comment, adminUserId)` - Bulk acknowledge
- `getAlertHistory(alertId)` - Get acknowledgement/resolution history

**Dependencies**: PrismaService, AuditLoggerService

---

### 5. BulkOperationsService
**Location**: `/api/src/modules/communication/services/admin/bulk-operations.service.ts`

**Methods**:
- `batchRetryTranscriptions(filters, limit)` - Queue transcription retries
- `batchResendCommunicationEvents(filters, limit)` - Queue message retries
- `batchRetryWebhookEvents(filters, limit)` - Queue webhook retries
- `exportUsageToCSV(filters)` - Generate CSV export

**Dependencies**: PrismaService, BullMQ Queue, Logger

---

### 6. TwilioProviderManagementService (EXTEND)
**Location**: `/api/src/modules/communication/services/admin/twilio-provider-management.service.ts`

**Add New Methods**:
- `deallocatePhoneNumberFromTenant(sid, deleteConfig, reason)` - Remove tenant allocation
- `releasePhoneNumber(sid)` - Release number back to Twilio

---

## DTOs Required (17 new DTOs)

### Webhook Management DTOs (5)
- `WebhookConfigDto`
- `UpdateWebhookConfigDto`
- `TestWebhookDto`
- `WebhookEventFiltersDto`
- `RetryWebhookDto`

### Phone Number DTOs (3)
- `PurchasePhoneNumberDto`
- `AllocatePhoneNumberDto`
- `DeallocatePhoneNumberDto`

### Transcription Provider DTOs (3)
- `CreateTranscriptionProviderDto`
- `UpdateTranscriptionProviderDto`
- `TestTranscriptionProviderDto`

### Tenant Assistance DTOs (4)
- `CreateTenantSmsConfigDto`
- `UpdateTenantSmsConfigDto`
- `CreateTenantWhatsAppConfigDto`
- `UpdateTenantWhatsAppConfigDto`

### Alert Management DTOs (2)
- `AcknowledgeAlertDto`
- `ResolveAlertDto`

---

## Implementation Timeline (12 Days)

### Week 1: Database & Core Services (Days 1-3)
- **Day 1**: Create 3 database migrations, test rollback
- **Day 2**: Implement WebhookManagementService + AlertManagementService with tests
- **Day 3**: Implement TranscriptionProviderManagementService + extend TwilioProviderManagementService with tests

### Week 2: Services & DTOs (Days 4-6)
- **Day 4**: Implement TenantAssistanceService with tests
- **Day 5**: Implement BulkOperationsService with BullMQ integration and tests
- **Day 6**: Create all 17 DTOs with validation and Swagger decorators

### Week 3: Controller & Testing (Days 7-9)
- **Day 7**: Add 9 endpoints (webhook management + phone number operations)
- **Day 8**: Add 11 endpoints (transcription provider CRUD + tenant assistance)
- **Day 9**: Add 11 endpoints (alert management + communication event + bulk operations)

### Week 4: Documentation & Polish (Days 10-12)
- **Day 10**: Integration testing for all 31 endpoints
- **Day 11**: Update API documentation with all endpoints
- **Day 12**: Code review, linting, performance testing, security review

---

## Critical Files to Modify

### Database
- `/api/prisma/schema.prisma` - 3 schema updates
- 3 new migration files

### Services (5 new + 1 extended)
- `/api/src/modules/communication/services/admin/webhook-management.service.ts` (NEW)
- `/api/src/modules/communication/services/admin/transcription-provider-management.service.ts` (NEW)
- `/api/src/modules/communication/services/admin/tenant-assistance.service.ts` (NEW)
- `/api/src/modules/communication/services/admin/alert-management.service.ts` (NEW)
- `/api/src/modules/communication/services/admin/bulk-operations.service.ts` (NEW)
- `/api/src/modules/communication/services/admin/twilio-provider-management.service.ts` (EXTEND)

### DTOs (6 new files with 17 DTOs total)
- `/api/src/modules/communication/dto/admin/webhook-management.dto.ts` (NEW)
- `/api/src/modules/communication/dto/admin/phone-number-operations.dto.ts` (NEW)
- `/api/src/modules/communication/dto/admin/transcription-provider.dto.ts` (NEW)
- `/api/src/modules/communication/dto/admin/tenant-assistance.dto.ts` (NEW)
- `/api/src/modules/communication/dto/admin/alert-management.dto.ts` (NEW)
- `/api/src/modules/communication/dto/admin/bulk-operations.dto.ts` (NEW)

### Controller
- `/api/src/modules/communication/controllers/admin/twilio-admin.controller.ts` (EXTEND - add 31 endpoints)

### Module Registration
- `/api/src/modules/communication/communication.module.ts` (register 5 new services)

### Documentation
- `/api/documentation/communication_twillio_admin_REST_API.md` (UPDATE - add 31 endpoints)

---

## Acceptance Criteria

### Database Migrations ✅
- [ ] `webhook_config` table created
- [ ] `webhook_event` table updated (retry fields)
- [ ] `admin_alert` table updated (comment/resolution fields)
- [ ] All migrations tested (up and down)

### Services ✅
- [ ] WebhookManagementService - 6 methods, 90%+ test coverage
- [ ] TranscriptionProviderManagementService - 6 methods, 90%+ coverage
- [ ] TenantAssistanceService - 6 methods, 90%+ coverage
- [ ] AlertManagementService - 4 methods, 90%+ coverage
- [ ] BulkOperationsService - 4 methods, 90%+ coverage
- [ ] TwilioProviderManagementService - 2 new methods added

### DTOs ✅
- [ ] All 17 DTOs created with validation
- [ ] Swagger decorators on all fields
- [ ] Validation tests passing

### Controller Endpoints ✅
- [ ] Webhook Management - 5 endpoints
- [ ] Phone Number Operations - 4 endpoints
- [ ] Transcription Provider CRUD - 5 endpoints
- [ ] Tenant Assistance - 6 endpoints
- [ ] Alert Management - 3 endpoints
- [ ] Communication Event Management - 3 endpoints
- [ ] Bulk Operations - 4 endpoints
- [ ] CSV Export - 1 endpoint completed

### Testing ✅
- [ ] Unit tests: 90%+ coverage
- [ ] Integration tests: All endpoints
- [ ] E2E tests: Critical workflows
- [ ] Multi-tenant isolation verified
- [ ] RBAC enforcement verified

### Documentation ✅
- [ ] API docs updated (all 31 endpoints)
- [ ] Swagger docs complete
- [ ] CHANGELOG updated

---

## Security Requirements

### All Endpoints Must:
- Require `@UseGuards(JwtAuthGuard, RolesGuard)`
- Require `@Roles('SystemAdmin')`
- Audit log all admin actions
- Validate all inputs with DTOs
- Encrypt sensitive credentials
- Handle errors without leaking sensitive data

---

## Success Metrics

### Quantitative
- ✅ 64+ total admin endpoints (33 existing + 31 new)
- ✅ 90%+ test coverage on new code
- ✅ API response time <200ms (p95)
- ✅ Zero breaking changes to existing endpoints
- ✅ 100% API documentation coverage

### Qualitative
- ✅ Admins can manage all system settings via UI
- ✅ Complete CRUD for all admin resources
- ✅ Professional error handling and validation
- ✅ Comprehensive audit trail
- ✅ Production-ready code quality

---

**Status**: ✅ APPROVED - READY FOR IMPLEMENTATION
**Timeline**: 12 working days
**Deliverable**: 64+ total admin endpoints with complete CRUD capabilities
