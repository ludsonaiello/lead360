# Multi-Provider Email Support Implementation

**Status**: ✅ COMPLETE  
**Date**: 2026-01-21  
**Version**: 1.0

## Overview

This document describes the multi-provider email support feature that allows tenants to configure, store, and switch between multiple email providers (SendGrid, Brevo, Amazon SES, SMTP) without losing configuration data.

## Problem Solved

**Before**: Tenants could only have ONE email provider configuration. Switching providers meant losing the previous configuration.

**After**: Tenants can configure multiple providers and easily switch between them with one-click activation.

## Database Changes

### Migration: `20260121_multi_provider_support`

**Changes**:
1. Removed UNIQUE constraint on `tenant_id` 
2. Added composite UNIQUE constraint on `(tenant_id, provider_id)` - prevents duplicate provider configs
3. Changed `is_active` default from `true` to `false`
4. Added indexes for `(tenant_id, is_active)` and `(tenant_id, provider_id)`

**Schema**:
```sql
CREATE TABLE `tenant_email_config` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `provider_id` varchar(36) NOT NULL,
  `credentials` longtext NOT NULL COMMENT 'Encrypted',
  `provider_config` longtext DEFAULT NULL,
  `from_email` varchar(255) NOT NULL,
  `from_name` varchar(100) NOT NULL,
  `reply_to_email` varchar(255) DEFAULT NULL,
  `webhook_secret` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_email_config_tenant_id_provider_id_key` (`tenant_id`,`provider_id`),
  KEY `idx_tenant_active` (`tenant_id`,`is_active`)
);
```

## API Endpoints

### New RESTful Endpoints

| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/communication/tenant-email-config/configurations` | List all provider configs | All Roles |
| GET | `/communication/tenant-email-config/configurations/active` | Get active provider | All Roles |
| GET | `/communication/tenant-email-config/configurations/:id` | Get config with credentials | Owner, Admin |
| POST | `/communication/tenant-email-config/configurations` | Create new provider config | Owner, Admin |
| PATCH | `/communication/tenant-email-config/configurations/:id` | Update provider config | Owner, Admin |
| PATCH | `/communication/tenant-email-config/configurations/:id/activate` | Set as active provider | Owner, Admin |
| DELETE | `/communication/tenant-email-config/configurations/:id` | Delete provider config | Owner, Admin |

### Deprecated Endpoints (backward compatible)

| Method | Endpoint | Replacement |
|--------|----------|-------------|
| GET | `/communication/tenant-email-config` | GET `/configurations/active` |
| POST | `/communication/tenant-email-config` | POST `/configurations` |

## Service Methods

### TenantEmailConfigService

**New Methods**:

```typescript
// List all provider configurations (active first)
async listProviderConfigs(tenantId: string)

// Get active provider configuration
async getActiveProvider(tenantId: string)

// Get specific config with decrypted credentials
async getProviderConfig(tenantId: string, configId: string)

// Create new provider configuration
async createProviderConfig(tenantId: string, dto: CreateTenantEmailConfigDto, userId: string)

// Update existing provider configuration
async updateProviderConfig(tenantId: string, configId: string, dto: UpdateTenantEmailConfigDto, userId: string)

// Set provider as active (deactivates others atomically)
async setActiveProvider(tenantId: string, configId: string, userId: string)

// Delete provider configuration
async deleteProviderConfig(tenantId: string, configId: string, userId: string)

// Helper: Deactivate all providers for tenant
private async deactivateAllProviders(tenantId: string)
```

**Deprecated Methods** (still functional):
- `get(tenantId)` → Use `getActiveProvider()`
- `createOrUpdate(tenantId, dto, userId)` → Use `createProviderConfig()` or `updateProviderConfig()`

## Email Sending Logic

**Updated**: `SendCommunicationEmailProcessor`

```typescript
// OLD (before multi-provider):
const config = await prisma.tenant_email_config.findUnique({
  where: { tenant_id: event.tenant_id },
});

// NEW (multi-provider):
const config = await prisma.tenant_email_config.findFirst({
  where: {
    tenant_id: event.tenant_id,
    is_active: true, // ✅ Only use active provider
  },
  include: { provider: true },
});

if (!config) {
  throw new Error(
    'No active email provider configured. Please add and activate a provider in Communication Settings.'
  );
}
```

## DTOs

### CreateTenantEmailConfigDto

```typescript
{
  provider_id: string;        // Required
  credentials: object;        // Required (will be encrypted)
  provider_config?: object;   // Optional
  from_email: string;         // Required
  from_name: string;          // Required
  reply_to_email?: string;    // Optional
  webhook_secret?: string;    // Optional
  is_active?: boolean;        // Optional (default: false)
}
```

### UpdateTenantEmailConfigDto

```typescript
{
  provider_id?: string;       // Optional
  credentials?: object;       // Optional
  provider_config?: object;   // Optional
  from_email?: string;        // Optional
  from_name?: string;         // Optional
  reply_to_email?: string;    // Optional
  webhook_secret?: string;    // Optional
  is_active?: boolean;        // Optional
}
```

## Usage Examples

### 1. Create SendGrid Configuration

```bash
POST /api/v1/communication/tenant-email-config/configurations
Authorization: Bearer <token>

{
  "provider_id": "sendgrid-uuid",
  "credentials": {
    "api_key": "SG.xxxxxxxxxxxxxxxx"
  },
  "from_email": "contact@acme.com",
  "from_name": "Acme Plumbing",
  "is_active": true
}
```

### 2. Add Brevo as Backup

```bash
POST /api/v1/communication/tenant-email-config/configurations

{
  "provider_id": "brevo-uuid",
  "credentials": {
    "api_key": "xkeysib-xxxxxxxx"
  },
  "from_email": "contact@acme.com",
  "from_name": "Acme Plumbing",
  "is_active": false  // Not active yet
}
```

### 3. Switch to Brevo

```bash
PATCH /api/v1/communication/tenant-email-config/configurations/{brevo-config-id}/activate
```

This will:
- Deactivate SendGrid
- Activate Brevo
- All future emails will use Brevo

### 4. List All Configurations

```bash
GET /api/v1/communication/tenant-email-config/configurations
```

Response:
```json
[
  {
    "id": "config-001",
    "provider": {
      "provider_key": "brevo",
      "provider_name": "Brevo"
    },
    "from_email": "contact@acme.com",
    "is_active": true,
    "is_verified": true
  },
  {
    "id": "config-002",
    "provider": {
      "provider_key": "sendgrid",
      "provider_name": "SendGrid"
    },
    "from_email": "contact@acme.com",
    "is_active": false,
    "is_verified": true
  }
]
```

## Business Rules

### Active Provider Enforcement

1. **Only ONE active provider per tenant**
   - Enforced by service layer (not database)
   - `setActiveProvider()` atomically deactivates all others
   - No partial unique index needed (MySQL compatibility)

2. **Zero providers allowed**
   - Tenants might not use email system
   - Email sending throws clear error when no active provider

3. **No duplicate provider configs**
   - Database enforces UNIQUE(tenant_id, provider_id)
   - Prevents: "SendGrid configured twice for same tenant"

### Data Integrity

1. **Credentials always encrypted**
   - AES-256-GCM encryption
   - Decryption only when needed (sending emails, editing config)

2. **Verification reset on credential change**
   - `is_verified` set to `false` when credentials updated
   - Admin must re-verify (send test email)

3. **Cascade delete on tenant deletion**
   - All provider configs deleted when tenant deleted
   - Foreign key: `ON DELETE CASCADE`

## Security Considerations

### Webhook Signature Verification

Each provider config can have a `webhook_secret` for verifying incoming webhooks:

- **SendGrid**: Uses ECDSA public key verification
- **Amazon SES**: SNS signature verification with certificate validation
- **Brevo**: Simple token-based authentication
- **Twilio**: HMAC-SHA1 with auth token

See: `webhook-verification.service.ts`

### Audit Logging

All provider changes are logged:
- Provider creation
- Provider updates (including credential changes)
- Provider activation/deactivation
- Provider deletion

## Frontend Integration

### UI Requirements

1. **Provider List Page**
   - Show all configured providers
   - Active provider badge
   - Quick actions: Edit, Activate, Delete

2. **Add Provider Modal**
   - Provider selection dropdown
   - Dynamic credential fields (based on provider schema)
   - Optional: Set as active immediately

3. **Empty State**
   - When no providers configured
   - Clear call-to-action: "Add Email Provider"

4. **Activation Confirmation**
   - "Switch to Brevo? This will deactivate SendGrid."
   - One-click activation

### Sample UI Flow

```
┌─────────────────────────────────────────────┐
│ Email Provider Configurations              │
├─────────────────────────────────────────────┤
│ ✅ ACTIVE: SendGrid                         │
│    contact@acme.com                         │
│    [Edit] [Deactivate] [Delete]             │
├─────────────────────────────────────────────┤
│    Brevo (Inactive)                         │
│    contact@acme.com                         │
│    [Edit] [Activate] [Delete]               │
├─────────────────────────────────────────────┤
│ [+ Add Email Provider]                      │
└─────────────────────────────────────────────┘
```

## Testing

### Test Scenarios

1. **Create first provider** → Automatically active
2. **Create second provider (inactive)** → Active provider unchanged
3. **Activate second provider** → First provider deactivated
4. **Delete active provider** → Allowed (tenant can have zero providers)
5. **Send email with no active provider** → Clear error message
6. **Create duplicate provider** → Error (UNIQUE constraint)
7. **Switch providers mid-flight** → Emails in queue use provider at queue time

### Manual Testing

```bash
# 1. Create SendGrid config
curl -X POST https://api.lead360.app/api/v1/communication/tenant-email-config/configurations \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "sendgrid-uuid",
    "credentials": {"api_key": "SG.xxx"},
    "from_email": "test@tenant.com",
    "from_name": "Test",
    "is_active": true
  }'

# 2. Create Brevo config (inactive)
curl -X POST ... (same structure, different provider)

# 3. List all
curl -X GET https://api.lead360.app/api/v1/communication/tenant-email-config/configurations \
  -H "Authorization: Bearer TOKEN"

# 4. Activate Brevo
curl -X PATCH https://api.lead360.app/api/v1/communication/tenant-email-config/configurations/BREVO_ID/activate \
  -H "Authorization: Bearer TOKEN"

# 5. Verify only Brevo is active
curl -X GET .../configurations
```

## Migration Guide

### For Existing Tenants

**Automatic Migration**: No action needed. Existing configs work as-is.

1. Existing `tenant_email_config` records remain valid
2. Single provider configs are marked `is_active: true` (if not already)
3. Old API endpoints still work (deprecated but functional)

### For Frontend Developers

1. **Immediate**: Continue using old endpoints (no breakage)
2. **Within 1 month**: Migrate to new endpoints
3. **Within 3 months**: Old endpoints will be removed

**Migration Path**:
```typescript
// OLD
GET /communication/tenant-email-config

// NEW
GET /communication/tenant-email-config/configurations/active
```

## Performance Considerations

### Database Queries

**Before** (unique tenant_id):
```sql
SELECT * FROM tenant_email_config WHERE tenant_id = ?
-- Index: PRIMARY on tenant_id (unique)
```

**After** (multi-provider):
```sql
SELECT * FROM tenant_email_config 
WHERE tenant_id = ? AND is_active = true
-- Index: idx_tenant_active (tenant_id, is_active)
```

**Performance Impact**: Negligible (indexed query, 1-5 rows per tenant)

### Email Sending

**No performance impact**: Email processor queries active provider once per email batch.

## Future Enhancements

### Planned Features

1. **Failover Support**
   - Auto-switch to backup provider on failure
   - Retry logic with fallback providers

2. **Load Balancing**
   - Round-robin across multiple active providers
   - Volume-based distribution

3. **Provider Analytics**
   - Delivery rates per provider
   - Cost tracking
   - Performance metrics

4. **A/B Testing**
   - Split traffic between providers
   - Compare deliverability

### Not Planned

- Multiple active providers simultaneously (use failover instead)
- Scheduled provider switching
- Geographic routing (use failover with regional providers)

## Support

**Documentation**: `/api/documentation/MULTI_PROVIDER_IMPLEMENTATION.md`  
**API Docs**: https://api.lead360.app/api/docs  
**Issues**: Contact development team

---

**Implementation Status**: ✅ Production Ready  
**Last Updated**: 2026-01-21
