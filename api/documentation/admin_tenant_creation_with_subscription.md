# Admin Tenant Creation with Subscription Configuration

**Version**: 1.0
**Last Updated**: January 15, 2026
**Endpoint**: `POST /api/v1/admin/tenants`
**Authentication**: Platform Admin only
**Module**: Platform Admin - Tenant Management

---

## Overview

Platform administrators can create new tenants with complete subscription configuration in a **single API call**. This includes assigning subscription plans, setting trial periods, configuring billing cycles, and establishing payment schedules upfront.

### Key Benefits

- **One-Step Onboarding**: Create fully-configured tenants without post-creation updates
- **Enterprise Flexibility**: Support pre-negotiated plans and custom trial periods
- **Billing Control**: Set billing cycles and payment dates during creation
- **Trial Management**: Configure trial periods or skip trials entirely

---

## Endpoint

```
POST /api/v1/admin/tenants
```

### Authentication

**Required**:
- Valid JWT token with Platform Admin role
- `Authorization: Bearer {token}` header
- Platform Admin flag (`is_platform_admin: true`)

---

## Request Body Fields

### Core Tenant Information (Required)

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `subdomain` | string | ✅ Yes | 3-63 chars, lowercase, alphanumeric + hyphens | Unique tenant subdomain |
| `business_name` | string | ✅ Yes | 2-255 chars | Company/business name |
| `owner_email` | string | ✅ Yes | Valid email format | Owner's email (must be unique) |
| `owner_password` | string | ✅ Yes | Min 8 chars | Owner account password |
| `owner_first_name` | string | ✅ Yes | 1-100 chars | Owner's first name |
| `owner_last_name` | string | ✅ Yes | 1-100 chars | Owner's last name |

### Business Details (Optional)

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `business_entity_type` | string | ❌ No | - | Entity type: LLC, Corporation, Sole Proprietorship, Partnership |
| `state_of_registration` | string | ❌ No | 2 chars (US state code) | State where business is registered |
| `ein` | string | ❌ No | - | Employer Identification Number |
| `owner_phone` | string | ❌ No | - | Owner's phone number |
| `skip_email_verification` | boolean | ❌ No | Default: `false` | Skip email verification for owner account |

### Industry & Business Size (Optional)

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `industry_ids` | string[] | ❌ No | Array of UUIDs | Array of industry IDs (tenant can have multiple) |
| `business_size` | string | ❌ No | Enum | Business size: '1-5', '6-10', '11-25', '26-50', '51-100', '101-250', '251+' |

### **Subscription Configuration (Optional - NEW)** ⭐

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `subscription_plan_id` | string | ❌ No | Valid UUID | Subscription plan to assign (defaults to platform default plan) |
| `subscription_status` | string | ❌ No | Enum: trial, active, past_due, canceled | Subscription status (defaults to "trial") |
| `trial_end_date` | string | ❌ No | ISO 8601 date | Trial end date (only use if status is "trial") |
| `billing_cycle` | string | ❌ No | Enum: monthly, annual | Billing frequency (only use if status is "active") |
| `next_billing_date` | string | ❌ No | ISO 8601 date | Next billing date (only use if status is "active") |

---

## Request Examples

### Example 1: Create Tenant with Trial (Default Behavior)

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subdomain": "acme-roofing",
    "business_name": "Acme Roofing LLC",
    "owner_email": "owner@acmeroofing.com",
    "owner_password": "SecurePass123!",
    "owner_first_name": "John",
    "owner_last_name": "Smith",
    "owner_phone": "5551234567",
    "industry_ids": ["roofing-industry-uuid"],
    "business_size": "11-25"
  }'
```

**Result**: Tenant created with:
- Default subscription plan
- Status: `trial`
- Trial end: 30 days from now (default)
- No billing cycle set

---

### Example 2: Create Tenant with Custom Trial Period

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subdomain": "startup-hvac",
    "business_name": "Startup HVAC Services",
    "owner_email": "owner@startuphvac.com",
    "owner_password": "SecurePass123!",
    "owner_first_name": "Jane",
    "owner_last_name": "Doe",
    "subscription_plan_id": "professional-plan-uuid",
    "subscription_status": "trial",
    "trial_end_date": "2026-03-15T23:59:59Z",
    "industry_ids": ["hvac-industry-uuid"],
    "business_size": "6-10"
  }'
```

**Result**: Tenant created with:
- Professional subscription plan
- Status: `trial`
- Trial end: March 15, 2026 (custom 60-day trial)
- No billing cycle (trial period)

---

### Example 3: Create Enterprise Tenant with Active Subscription (Skip Trial)

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subdomain": "bigcorp-construction",
    "business_name": "BigCorp Construction LLC",
    "business_entity_type": "LLC",
    "state_of_registration": "TX",
    "ein": "12-3456789",
    "owner_email": "admin@bigcorp.com",
    "owner_password": "SecurePass123!",
    "owner_first_name": "Robert",
    "owner_last_name": "Johnson",
    "owner_phone": "5559876543",
    "skip_email_verification": true,
    "subscription_plan_id": "enterprise-plan-uuid",
    "subscription_status": "active",
    "billing_cycle": "annual",
    "next_billing_date": "2027-01-15T00:00:00Z",
    "industry_ids": ["construction-uuid", "roofing-uuid"],
    "business_size": "51-100"
  }'
```

**Result**: Tenant created with:
- Enterprise subscription plan
- Status: `active` (no trial)
- Billing: Annual cycle
- Next billing: January 15, 2027
- Email verification skipped (immediate access)

---

### Example 4: Create Tenant with Monthly Billing

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subdomain": "fasttrack-plumbing",
    "business_name": "FastTrack Plumbing",
    "owner_email": "owner@fasttrackplumbing.com",
    "owner_password": "SecurePass123!",
    "owner_first_name": "Maria",
    "owner_last_name": "Garcia",
    "subscription_plan_id": "professional-plan-uuid",
    "subscription_status": "active",
    "billing_cycle": "monthly",
    "next_billing_date": "2026-02-15T00:00:00Z",
    "industry_ids": ["plumbing-uuid"],
    "business_size": "1-5"
  }'
```

**Result**: Tenant created with:
- Professional plan
- Status: `active` (billing starts immediately)
- Billing: Monthly cycle
- First payment: February 15, 2026

---

## Response (201 Created)

```json
{
  "id": "1f29ec9194696a251d8255e3290b2fe5",
  "subdomain": "acme-roofing",
  "company_name": "Acme Roofing LLC",
  "legal_business_name": "Acme Roofing LLC",
  "business_entity_type": "LLC",
  "state_of_registration": "CA",
  "ein": "12-3456789",
  "primary_contact_email": "owner@acmeroofing.com",
  "primary_contact_phone": "5551234567",
  "is_active": true,
  "subscription_plan_id": "professional-plan-uuid",
  "subscription_status": "trial",
  "trial_end_date": "2026-02-15T00:00:00.000Z",
  "billing_cycle": null,
  "next_billing_date": null,
  "subscription_plan": {
    "id": "professional-plan-uuid",
    "name": "Professional",
    "description": "Full-featured plan for growing businesses",
    "monthly_price": 99.99,
    "annual_price": 999.99,
    "max_users": 15,
    "feature_flags": {
      "leads_module": true,
      "quotes_module": true,
      "invoices_module": true,
      "scheduling_module": true,
      "time_tracking_module": true,
      "inventory_module": true,
      "advanced_reporting": true
    },
    "is_active": true,
    "is_default": true
  },
  "industries": [
    {
      "id": "roofing-industry-uuid",
      "name": "Roofing",
      "description": "Roofing installation and repair services",
      "is_active": true
    }
  ],
  "business_size": "11-25",
  "created_at": "2026-01-15T22:00:00.000Z",
  "updated_at": "2026-01-15T22:00:00.000Z",
  "owner": {
    "id": "owner-user-uuid",
    "email": "owner@acmeroofing.com",
    "first_name": "John",
    "last_name": "Smith",
    "phone": "5551234567",
    "is_active": true,
    "email_verified": false
  }
}
```

---

## Response Fields

### Tenant Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Tenant ID (32-char hex string) |
| `subdomain` | string | Unique subdomain |
| `company_name` | string | Business name |
| `subscription_plan_id` | string/null | Assigned subscription plan ID |
| `subscription_status` | string | Current status: trial, active, past_due, canceled |
| `trial_end_date` | string/null | Trial end date (ISO 8601) or null |
| `billing_cycle` | string/null | Billing frequency: monthly, annual, or null |
| `next_billing_date` | string/null | Next billing date (ISO 8601) or null |
| `subscription_plan` | object | Full subscription plan details (if assigned) |
| `industries` | array | Array of assigned industry objects |
| `business_size` | string/null | Business size category |
| `is_active` | boolean | Whether tenant is active |
| `created_at` | string | Creation timestamp |
| `owner` | object | Owner user account details |

---

## Business Rules & Logic

### Subscription Status Logic

#### **Status: trial**
- ✅ **Can set**: `trial_end_date` (required for custom trials)
- ❌ **Cannot set**: `billing_cycle`, `next_billing_date`
- **Default behavior**: Trial ends 30 days from creation if not specified
- **Feature access**: Full access to all features in assigned plan
- **Billing**: No charges during trial

#### **Status: active**
- ❌ **Cannot set**: `trial_end_date` (not on trial)
- ✅ **Can set**: `billing_cycle`, `next_billing_date`
- **Required for billing**: Both `billing_cycle` AND `next_billing_date` should be set
- **Feature access**: Full access to all features in assigned plan
- **Billing**: Charges apply based on billing cycle

#### **Status: past_due**
- Used when payment failed
- Typically set by billing system, not during creation
- **Recommendation**: Don't use during tenant creation

#### **Status: canceled**
- Subscription canceled
- **Recommendation**: Don't use during tenant creation

### Default Behaviors

| Field | Default Behavior |
|-------|------------------|
| `subscription_plan_id` | Platform default plan (where `is_default: true`) |
| `subscription_status` | `"trial"` |
| `trial_end_date` | 30 days from creation (if status is trial) |
| `billing_cycle` | `null` (not set) |
| `next_billing_date` | `null` (not set) |

### Validation Rules

1. **Subdomain Uniqueness**: Must be unique across all tenants (active and deleted)
2. **Email Uniqueness**: Owner email must be unique (cannot reuse email from existing users)
3. **Subscription Plan Must Exist**: If `subscription_plan_id` provided, plan must exist and be active
4. **Trial Fields**: If `subscription_status` is NOT "trial", `trial_end_date` should be null
5. **Billing Fields**: If `subscription_status` is "active", should set both `billing_cycle` AND `next_billing_date`

---

## Error Responses

### 400 Bad Request - Validation Error

```json
{
  "statusCode": 400,
  "message": [
    "subdomain must match /^[a-z0-9-]+$/ regular expression",
    "owner_email must be an email",
    "owner_password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request"
}
```

### 400 Bad Request - Invalid Subscription Status

```json
{
  "statusCode": 400,
  "message": "property subscription_status should not exist",
  "error": "Bad Request"
}
```

**Cause**: Sent invalid value for `subscription_status` (not in enum)

### 409 Conflict - Subdomain Exists

```json
{
  "statusCode": 409,
  "message": "Subdomain 'acme-roofing' already exists",
  "error": "Conflict"
}
```

### 409 Conflict - Email Already Registered

```json
{
  "statusCode": 409,
  "message": "Owner email is already registered",
  "error": "Conflict"
}
```

### 404 Not Found - Invalid Subscription Plan

```json
{
  "statusCode": 404,
  "message": "Subscription plan not found",
  "error": "Not Found"
}
```

**Cause**: Provided `subscription_plan_id` doesn't exist

### 400 Bad Request - Inactive Plan

```json
{
  "statusCode": 400,
  "message": "Cannot assign inactive subscription plan",
  "error": "Bad Request"
}
```

---

## Common Use Cases

### Use Case 1: Standard Trial Setup

**Scenario**: New tenant with 30-day trial on default plan

```json
{
  "subdomain": "newclient",
  "business_name": "New Client LLC",
  "owner_email": "owner@newclient.com",
  "owner_password": "pass123",
  "owner_first_name": "John",
  "owner_last_name": "Doe"
}
```

**Result**: Trial ends 30 days from creation, default plan assigned

---

### Use Case 2: Extended Trial for Sales Prospect

**Scenario**: Give prospect 60-day trial on Professional plan

```json
{
  "subdomain": "prospect-company",
  "business_name": "Prospect Company",
  "owner_email": "owner@prospect.com",
  "owner_password": "pass123",
  "owner_first_name": "Jane",
  "owner_last_name": "Smith",
  "subscription_plan_id": "professional-plan-uuid",
  "subscription_status": "trial",
  "trial_end_date": "2026-03-15T23:59:59Z"
}
```

**Result**: 60-day trial on Professional plan

---

### Use Case 3: Pre-Paid Annual Enterprise Customer

**Scenario**: Enterprise customer paid upfront for annual subscription

```json
{
  "subdomain": "enterprise-corp",
  "business_name": "Enterprise Corp",
  "owner_email": "admin@enterprise.com",
  "owner_password": "SecurePass123!",
  "owner_first_name": "Robert",
  "owner_last_name": "Johnson",
  "skip_email_verification": true,
  "subscription_plan_id": "enterprise-plan-uuid",
  "subscription_status": "active",
  "billing_cycle": "annual",
  "next_billing_date": "2027-01-15T00:00:00Z"
}
```

**Result**: Active subscription, annual billing, no trial

---

### Use Case 4: Monthly Subscription Starting Immediately

**Scenario**: Customer wants to start paying monthly right away

```json
{
  "subdomain": "monthly-client",
  "business_name": "Monthly Client LLC",
  "owner_email": "owner@monthly.com",
  "owner_password": "pass123",
  "owner_first_name": "Maria",
  "owner_last_name": "Garcia",
  "subscription_plan_id": "starter-plan-uuid",
  "subscription_status": "active",
  "billing_cycle": "monthly",
  "next_billing_date": "2026-02-15T00:00:00Z"
}
```

**Result**: Monthly billing starts February 15

---

## Field Combinations Guide

### ✅ Valid Combinations

| subscription_status | trial_end_date | billing_cycle | next_billing_date | Notes |
|---------------------|----------------|---------------|-------------------|-------|
| `trial` | ✅ Set | ❌ Null | ❌ Null | Custom trial period |
| `trial` | ❌ Null | ❌ Null | ❌ Null | Default 30-day trial |
| `active` | ❌ Null | ✅ `monthly` | ✅ Set | Monthly billing |
| `active` | ❌ Null | ✅ `annual` | ✅ Set | Annual billing |
| Not set | Not set | Not set | Not set | All defaults (trial, 30 days) |

### ❌ Invalid Combinations

| subscription_status | trial_end_date | billing_cycle | next_billing_date | Why Invalid |
|---------------------|----------------|---------------|-------------------|-------------|
| `trial` | ✅ Set | ✅ Set | ✅ Set | Cannot bill during trial |
| `active` | ✅ Set | ❌ Null | ❌ Null | Active requires billing setup |
| `active` | ❌ Null | ✅ Set | ❌ Null | Missing next_billing_date |
| `active` | ❌ Null | ❌ Null | ✅ Set | Missing billing_cycle |

---

## Testing Checklist

### ✅ Test Scenarios

- [ ] Create tenant with no subscription fields (defaults apply)
- [ ] Create tenant with custom trial end date
- [ ] Create tenant with active status + monthly billing
- [ ] Create tenant with active status + annual billing
- [ ] Create tenant with specific subscription plan
- [ ] Create tenant with skip_email_verification
- [ ] Create tenant with multiple industries
- [ ] Verify duplicate subdomain is rejected
- [ ] Verify duplicate email is rejected
- [ ] Verify invalid subscription_plan_id is rejected
- [ ] Verify inactive plan cannot be assigned

---

## Summary: What Changed

### Before (Original Behavior)

❌ **Subscription fields NOT accepted during creation**:
- `subscription_plan_id` - Rejected with validation error
- `subscription_status` - Rejected with validation error
- `trial_end_date` - Rejected with validation error
- `billing_cycle` - Not available
- `next_billing_date` - Not available

**Required workflow**: Create tenant → Update subscription separately (2 API calls)

---

### After (New Behavior)

✅ **All subscription fields accepted during creation**:
- ✅ `subscription_plan_id` - Assign plan immediately
- ✅ `subscription_status` - Set initial status (trial/active)
- ✅ `trial_end_date` - Custom trial periods
- ✅ `billing_cycle` - Set billing frequency (monthly/annual)
- ✅ `next_billing_date` - Schedule first payment

**New workflow**: Create fully-configured tenant in **one API call**

---

## Related Documentation

- **Subscription Plans API**: `/api/documentation/subscription_plans_REST_API.md`
- **Tenant Management API**: `/api/documentation/tenant_REST_API.md`
- **Admin Module Documentation**: `/api/documentation/admin_panel_REST_API.md`

---

**Last Updated**: January 15, 2026
**Version**: 1.0
**Maintained By**: Platform Admin Team
