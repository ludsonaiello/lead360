# Subscription Plans Management - REST API Documentation

**Version**: 1.0
**Last Updated**: January 15, 2026
**Base URL**: `https://api.lead360.app/api/v1/admin`
**Authentication**: Required - Platform Admin only
**Module**: Platform Admin - Subscription Management

---

## Overview

The Subscription Plans API allows platform administrators to create, manage, and assign subscription plans to tenants. Each subscription plan defines pricing tiers, feature access, and user limits for tenants on the Lead360 platform.

### Key Concepts

- **Subscription Plan**: A pricing tier that defines what features and limits a tenant has
- **Feature Flags**: JSON object controlling which modules/features are enabled for the plan
- **Default Plan**: The plan automatically assigned to new tenants (only one can be default)
- **Plan Assignment**: Tenants can be migrated between plans via admin endpoints

### Security

**All endpoints require**:
- Valid JWT token with Platform Admin role
- `Authorization: Bearer {token}` header
- Platform Admin flag (`is_platform_admin: true`) in user account

**Regular tenant users cannot access these endpoints.**

---

## Table of Contents

1. [List All Subscription Plans](#1-list-all-subscription-plans)
2. [Get Specific Subscription Plan](#2-get-specific-subscription-plan)
3. [Create Subscription Plan](#3-create-subscription-plan)
4. [Update Subscription Plan](#4-update-subscription-plan)
5. [Delete Subscription Plan](#5-delete-subscription-plan)
6. [Get Tenants Using a Plan](#6-get-tenants-using-a-plan)
7. [Assign Plan to Tenant](#7-assign-plan-to-tenant)
8. [Data Models](#8-data-models)
9. [Error Responses](#9-error-responses)
10. [Business Rules](#10-business-rules)

---

## 1. List All Subscription Plans

Retrieve all subscription plans with optional filtering for inactive plans.

### Endpoint

```
GET /api/v1/admin/subscription-plans
```

### Headers

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `include_inactive` | boolean | No | `false` | Include inactive/disabled plans in results |

### Request Example

```bash
# Get only active plans (default)
curl -X GET "https://api.lead360.app/api/v1/admin/subscription-plans" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get all plans including inactive
curl -X GET "https://api.lead360.app/api/v1/admin/subscription-plans?include_inactive=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response (200 OK)

```json
[
  {
    "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "name": "Starter",
    "description": "Perfect for small businesses getting started",
    "monthly_price": 49.99,
    "annual_price": 499.99,
    "max_users": 5,
    "max_storage_gb": 10,
    "feature_flags": {
      "leads_module": true,
      "quotes_module": true,
      "invoices_module": true,
      "scheduling_module": false,
      "time_tracking_module": false,
      "inventory_module": false,
      "advanced_reporting": false
    },
    "is_active": true,
    "is_default": false,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7",
    "name": "Professional",
    "description": "Full-featured plan for growing businesses",
    "monthly_price": 99.99,
    "annual_price": 999.99,
    "max_users": 15,
    "max_storage_gb": 50,
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
    "is_default": true,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-10T12:30:00.000Z"
  },
  {
    "id": "c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8",
    "name": "Enterprise",
    "description": "Unlimited features for large organizations",
    "monthly_price": 299.99,
    "annual_price": 2999.99,
    "max_users": 100,
    "max_storage_gb": null,
    "feature_flags": {
      "leads_module": true,
      "quotes_module": true,
      "invoices_module": true,
      "scheduling_module": true,
      "time_tracking_module": true,
      "inventory_module": true,
      "advanced_reporting": true,
      "api_access": true,
      "white_label": true,
      "priority_support": true
    },
    "is_active": true,
    "is_default": false,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z"
  }
]
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique plan identifier (32-char hex string) |
| `name` | string | Plan name (unique, max 100 chars) |
| `description` | string | Plan description (optional) |
| `monthly_price` | number | Monthly price in USD |
| `annual_price` | number | Annual price in USD (typically discounted) |
| `max_users` | number | Maximum number of users allowed on this plan |
| `max_storage_gb` | number\|null | Maximum storage in GB (null = unlimited) |
| `offers_trial` | boolean | Whether this plan offers a free trial period |
| `trial_days` | number\|null | Trial duration in days (only if offers_trial is true) |
| `feature_flags` | object | JSON object with feature availability (see Feature Flags section) |
| `is_active` | boolean | Whether plan is active and available for assignment |
| `is_default` | boolean | Whether this is the default plan for new tenants |
| `created_at` | string | ISO 8601 timestamp of creation |
| `updated_at` | string | ISO 8601 timestamp of last update |

---

## 2. Get Specific Subscription Plan

Retrieve details for a single subscription plan by ID.

### Endpoint

```
GET /api/v1/admin/subscription-plans/{id}
```

### Headers

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Subscription plan ID (UUID) |

### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/subscription-plans/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response (200 OK)

```json
{
  "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
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
  "is_default": true,
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-10T12:30:00.000Z"
}
```

### Error Response (404 Not Found)

```json
{
  "statusCode": 404,
  "message": "Subscription plan not found",
  "error": "Not Found"
}
```

---

## 3. Create Subscription Plan

Create a new subscription plan with pricing, features, and limits.

### Endpoint

```
POST /api/v1/admin/subscription-plans
```

### Headers

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | string | ✅ Yes | 1-100 chars, unique | Plan name |
| `description` | string | ❌ No | - | Plan description |
| `monthly_price` | number | ✅ Yes | >= 0 | Monthly price in USD |
| `annual_price` | number | ✅ Yes | >= 0 | Annual price in USD |
| `max_users` | number | ✅ Yes | >= 1, integer | Maximum users allowed |
| `max_storage_gb` | number | ❌ No | >= 0 | Maximum storage in GB (omit or null for unlimited) |
| `offers_trial` | boolean | ❌ No | Default: `false` | Does this plan offer a free trial? |
| `trial_days` | number | ❌ No | >= 1, integer | Trial duration in days (required if offers_trial is true) |
| `feature_flags` | object | ✅ Yes | Valid JSON object | Feature availability object |
| `is_active` | boolean | ❌ No | Default: `true` | Is plan active? |
| `is_default` | boolean | ❌ No | Default: `false` | Is this the default plan? |

### Request Example

```bash
curl -X POST "https://api.lead360.app/api/v1/admin/subscription-plans" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Growth",
    "description": "Ideal for mid-sized businesses",
    "monthly_price": 149.99,
    "annual_price": 1499.99,
    "max_users": 25,
    "max_storage_gb": 100,
    "feature_flags": {
      "leads_module": true,
      "quotes_module": true,
      "invoices_module": true,
      "scheduling_module": true,
      "time_tracking_module": true,
      "inventory_module": true,
      "advanced_reporting": true,
      "api_access": false
    },
    "is_active": true,
    "is_default": false
  }'
```

### Response (201 Created)

```json
{
  "id": "d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9",
  "name": "Growth",
  "description": "Ideal for mid-sized businesses",
  "monthly_price": 149.99,
  "annual_price": 1499.99,
  "max_users": 25,
  "max_storage_gb": 100,
  "feature_flags": {
    "leads_module": true,
    "quotes_module": true,
    "invoices_module": true,
    "scheduling_module": true,
    "time_tracking_module": true,
    "inventory_module": true,
    "advanced_reporting": true,
    "api_access": false
  },
  "is_active": true,
  "is_default": false,
  "created_at": "2026-01-15T20:45:00.000Z",
  "updated_at": "2026-01-15T20:45:00.000Z"
}
```

### Error Response (409 Conflict)

```json
{
  "statusCode": 409,
  "message": "Subscription plan with name 'Growth' already exists",
  "error": "Conflict"
}
```

### Business Rules

- Plan names must be unique across all plans
- If `is_default: true`, the system will automatically set all other plans to `is_default: false`
- Feature flags object can contain any key-value pairs (boolean values recommended)
- Created plan is immediately available for assignment unless `is_active: false`

---

## 4. Update Subscription Plan

Update an existing subscription plan's pricing, features, or settings.

### Endpoint

```
PATCH /api/v1/admin/subscription-plans/{id}
```

### Headers

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Subscription plan ID (UUID) |

### Request Body

All fields are **optional**. Only include fields you want to update.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | 1-100 chars, unique | Plan name |
| `description` | string | - | Plan description |
| `monthly_price` | number | >= 0 | Monthly price in USD |
| `annual_price` | number | >= 0 | Annual price in USD |
| `max_users` | number | >= 1, integer | Maximum users allowed |
| `feature_flags` | object | Valid JSON object | Feature availability object |
| `is_active` | boolean | - | Is plan active? |
| `is_default` | boolean | - | Is this the default plan? |

### Request Example

```bash
# Update pricing and max users
curl -X PATCH "https://api.lead360.app/api/v1/admin/subscription-plans/d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "monthly_price": 159.99,
    "annual_price": 1599.99,
    "max_users": 30
  }'

# Enable a new feature
curl -X PATCH "https://api.lead360.app/api/v1/admin/subscription-plans/d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "feature_flags": {
      "leads_module": true,
      "quotes_module": true,
      "invoices_module": true,
      "scheduling_module": true,
      "time_tracking_module": true,
      "inventory_module": true,
      "advanced_reporting": true,
      "api_access": true
    }
  }'

# Make this the default plan
curl -X PATCH "https://api.lead360.app/api/v1/admin/subscription-plans/d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "is_default": true
  }'
```

### Response (200 OK)

```json
{
  "id": "d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9",
  "name": "Growth",
  "description": "Ideal for mid-sized businesses",
  "monthly_price": 159.99,
  "annual_price": 1599.99,
  "max_users": 30,
  "feature_flags": {
    "leads_module": true,
    "quotes_module": true,
    "invoices_module": true,
    "scheduling_module": true,
    "time_tracking_module": true,
    "inventory_module": true,
    "advanced_reporting": true,
    "api_access": true
  },
  "is_active": true,
  "is_default": true,
  "created_at": "2026-01-15T20:45:00.000Z",
  "updated_at": "2026-01-15T21:00:00.000Z"
}
```

### Error Responses

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Subscription plan not found",
  "error": "Not Found"
}
```

**409 Conflict** (if changing name to an existing plan name):
```json
{
  "statusCode": 409,
  "message": "Subscription plan with name 'Growth' already exists",
  "error": "Conflict"
}
```

### Business Rules

- If updating `is_default: true`, all other plans automatically become `is_default: false`
- Changing pricing does NOT affect existing tenant subscriptions (they keep their current rate)
- Changing feature flags affects all tenants using this plan immediately
- Updating `feature_flags` replaces the entire object (not merged)

---

## 5. Delete Subscription Plan

Permanently delete a subscription plan. Cannot delete if any tenants are currently using it.

### Endpoint

```
DELETE /api/v1/admin/subscription-plans/{id}
```

### Headers

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Subscription plan ID (UUID) |

### Request Example

```bash
curl -X DELETE "https://api.lead360.app/api/v1/admin/subscription-plans/d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response (200 OK)

```json
{
  "message": "Subscription plan deleted successfully"
}
```

### Error Responses

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Subscription plan not found",
  "error": "Not Found"
}
```

**400 Bad Request** (if tenants are using this plan):
```json
{
  "statusCode": 400,
  "message": "Cannot delete subscription plan because 15 tenant(s) are using it. Please migrate tenants to another plan first.",
  "error": "Bad Request"
}
```

### Business Rules

- ❌ **CANNOT** delete a plan if any tenants are using it
- ✅ **CAN** delete inactive plans
- ✅ **CAN** delete the default plan (if no tenants use it, but you'll need to set a new default)
- Before deleting, use "Get Tenants Using Plan" endpoint to see which tenants need migration
- Deletion is permanent and cannot be undone

### Recommended Workflow

1. Check which tenants use this plan: `GET /api/v1/admin/subscription-plans/{id}/tenants`
2. Migrate all tenants to another plan: `PATCH /api/v1/admin/tenants/{tenant_id}/subscription`
3. Delete the plan: `DELETE /api/v1/admin/subscription-plans/{id}`

---

## 6. Get Tenants Using a Plan

Retrieve all tenants currently using a specific subscription plan.

### Endpoint

```
GET /api/v1/admin/subscription-plans/{id}/tenants
```

### Headers

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Subscription plan ID (UUID) |

### Request Example

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/subscription-plans/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/tenants" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response (200 OK)

```json
{
  "plan": {
    "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
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
  "tenant_count": 23,
  "tenants": [
    {
      "id": "t1e2n3a4n5t6i7d8h9e0x1s2t3r4i5n6",
      "subdomain": "acme-roofing",
      "company_name": "Acme Roofing LLC",
      "subscription_status": "active",
      "trial_end_date": null,
      "is_active": true,
      "created_at": "2026-01-05T10:30:00.000Z"
    },
    {
      "id": "t2e3n4a5n6t7i8d9h0e1x2s3t4r5i6n7",
      "subdomain": "precision-hvac",
      "company_name": "Precision HVAC Services",
      "subscription_status": "trial",
      "trial_end_date": "2026-02-15T00:00:00.000Z",
      "is_active": true,
      "created_at": "2026-01-15T14:20:00.000Z"
    },
    {
      "id": "t3e4n5a6n7t8i9d0h1e2x3s4t5r6i7n8",
      "subdomain": "elite-plumbing",
      "company_name": "Elite Plumbing Co",
      "subscription_status": "past_due",
      "trial_end_date": null,
      "is_active": false,
      "created_at": "2025-12-10T08:15:00.000Z"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `plan` | object | Full subscription plan details |
| `tenant_count` | number | Total number of tenants using this plan |
| `tenants` | array | Array of tenant objects (see below) |

**Tenant Object Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Tenant ID (32-char hex string) |
| `subdomain` | string | Tenant subdomain |
| `company_name` | string | Company name |
| `subscription_status` | string | Current status: `trial`, `active`, `past_due`, `canceled` |
| `trial_end_date` | string/null | Trial end date (ISO 8601) or null if not on trial |
| `is_active` | boolean | Whether tenant is active |
| `created_at` | string | Tenant creation date (ISO 8601) |

### Use Cases

- **Before deleting a plan**: Check if any tenants need to be migrated
- **Migration planning**: Identify which tenants are on trial vs active
- **Analytics**: See adoption rate of specific plans
- **Support**: Quickly find tenants affected by plan changes

---

## 7. Assign Plan to Tenant

Update a tenant's subscription plan (admin-only operation).

### Endpoint

```
PATCH /api/v1/admin/tenants/{id}/subscription
```

### Headers

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Tenant ID (UUID or hex string) |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subscription_plan_id` | string | ✅ Yes | New subscription plan ID (UUID) |

### Request Example

```bash
curl -X PATCH "https://api.lead360.app/api/v1/admin/tenants/t1e2n3a4n5t6i7d8h9e0x1s2t3r4i5n6/subscription" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_plan_id": "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7"
  }'
```

### Response (200 OK)

```json
{
  "id": "t1e2n3a4n5t6i7d8h9e0x1s2t3r4i5n6",
  "subdomain": "acme-roofing",
  "company_name": "Acme Roofing LLC",
  "subscription_plan_id": "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7",
  "subscription_status": "active",
  "subscription_plan": {
    "id": "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7",
    "name": "Enterprise",
    "description": "Unlimited features for large organizations",
    "monthly_price": 299.99,
    "annual_price": 2999.99,
    "max_users": 100,
    "feature_flags": {
      "leads_module": true,
      "quotes_module": true,
      "invoices_module": true,
      "scheduling_module": true,
      "time_tracking_module": true,
      "inventory_module": true,
      "advanced_reporting": true,
      "api_access": true,
      "white_label": true,
      "priority_support": true
    },
    "is_active": true,
    "is_default": false
  },
  "is_active": true,
  "updated_at": "2026-01-15T21:15:00.000Z"
}
```

### Error Responses

**404 Not Found** (tenant not found):
```json
{
  "statusCode": 404,
  "message": "Tenant not found",
  "error": "Not Found"
}
```

**404 Not Found** (plan not found):
```json
{
  "statusCode": 404,
  "message": "Subscription plan not found",
  "error": "Not Found"
}
```

**400 Bad Request** (inactive plan):
```json
{
  "statusCode": 400,
  "message": "Cannot assign inactive subscription plan",
  "error": "Bad Request"
}
```

### Business Rules

- New plan takes effect immediately
- Tenant's feature access updates immediately based on new plan's feature flags
- User limit changes are enforced on next login
- Plan change is logged in audit log
- Cannot assign inactive plans

---

## 8. Data Models

### Subscription Plan Object

Complete field reference for subscription plan entities.

```typescript
{
  id: string;                    // 32-char hex string (UUID v1)
  name: string;                  // Unique plan name (1-100 chars)
  description?: string;          // Optional plan description
  monthly_price: number;         // Monthly price in USD (>= 0)
  annual_price: number;          // Annual price in USD (>= 0)
  max_users: number;             // Maximum users allowed (>= 1)
  feature_flags: {               // Feature availability object
    [key: string]: boolean;      // Any boolean flags
  };
  is_active: boolean;            // Is plan active? (default: true)
  is_default: boolean;           // Is default plan? (default: false)
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}
```

### Feature Flags Object

Common feature flags used in the Lead360 platform:

```typescript
{
  // Core Modules
  leads_module: boolean;              // Lead management
  quotes_module: boolean;             // Quote generation
  invoices_module: boolean;           // Invoice management
  scheduling_module: boolean;         // Appointment scheduling
  time_tracking_module: boolean;      // Time clock & tracking
  inventory_module: boolean;          // Inventory management

  // Advanced Features
  advanced_reporting: boolean;        // Analytics & reports
  api_access: boolean;                // REST API access
  white_label: boolean;               // Custom branding
  priority_support: boolean;          // Priority customer support
  custom_integrations: boolean;       // Custom third-party integrations
  multi_location: boolean;            // Multi-location support

  // Future Features (examples)
  mobile_app_access: boolean;         // Mobile app access
  sms_notifications: boolean;         // SMS notifications
  email_campaigns: boolean;           // Email marketing
}
```

**Note**: Feature flags are flexible - you can add any custom flags as needed. The system doesn't enforce a specific schema.

### Tenant Subscription Fields

Relevant tenant fields related to subscriptions:

```typescript
{
  id: string;                         // Tenant ID
  subdomain: string;                  // Unique subdomain
  company_name: string;               // Company name

  // Subscription fields
  subscription_plan_id?: string;      // Current plan ID (nullable)
  subscription_status: string;        // Status: trial, active, past_due, canceled
  trial_end_date?: string;            // Trial end date (ISO 8601, nullable)
  billing_cycle?: string;             // Billing cycle: monthly, annual
  next_billing_date?: string;         // Next billing date (ISO 8601, nullable)

  is_active: boolean;                 // Is tenant active?
  created_at: string;                 // Creation timestamp
  updated_at: string;                 // Last update timestamp
}
```

---

## 9. Error Responses

### Standard Error Format

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message describing what went wrong",
  "error": "Bad Request"
}
```

### Common HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data or business rule violation |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | User is not a platform admin |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists (duplicate name) |
| 500 | Internal Server Error | Server error (logged for debugging) |

### Common Error Scenarios

**Missing Authentication**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**Not Platform Admin**:
```json
{
  "statusCode": 403,
  "message": "Access denied. Required roles: Platform Admin. Your roles: Owner",
  "error": "Forbidden"
}
```

**Validation Error**:
```json
{
  "statusCode": 400,
  "message": [
    "monthly_price must be a positive number",
    "max_users must be an integer number"
  ],
  "error": "Bad Request"
}
```

**Duplicate Plan Name**:
```json
{
  "statusCode": 409,
  "message": "Subscription plan with name 'Professional' already exists",
  "error": "Conflict"
}
```

**Plan In Use (Cannot Delete)**:
```json
{
  "statusCode": 400,
  "message": "Cannot delete subscription plan because 15 tenant(s) are using it. Please migrate tenants to another plan first.",
  "error": "Bad Request"
}
```

---

## 10. Business Rules

### Plan Creation & Updates

1. **Unique Names**: Plan names must be unique across all plans (active and inactive)
2. **Default Plan Enforcement**: Only ONE plan can be default at a time
   - Setting `is_default: true` automatically sets all other plans to `is_default: false`
3. **Price Changes**: Changing plan pricing does NOT retroactively affect existing tenant subscriptions
4. **Feature Flag Changes**: Changing feature flags affects ALL tenants using the plan immediately
5. **Active Status**: Inactive plans cannot be assigned to new tenants, but existing tenants keep access

### Plan Deletion

1. **Cannot Delete Plans In Use**: Plans with active tenant subscriptions cannot be deleted
2. **Migration Required**: Before deletion, all tenants must be migrated to another plan
3. **Permanent Action**: Deletion is permanent and cannot be undone
4. **Audit Logged**: All deletions are logged with admin user ID and plan details

### Plan Assignment

1. **Active Plans Only**: Can only assign active plans to tenants
2. **Immediate Effect**: Plan changes take effect immediately
3. **Feature Access Updates**: Tenant feature access updates based on new plan's feature flags
4. **User Limit Enforcement**: New user limits enforced on next user login/creation
5. **Audit Trail**: All plan changes logged with before/after state

### Trial & Subscription Status

1. **Trial Status**: New tenants default to `subscription_status: "trial"`
2. **Trial End Date**: Typically set to 30 days from tenant creation (configurable)
3. **Status Transitions**: `trial` → `active` → `past_due` → `canceled`
4. **Feature Access**: Trial tenants have full feature access based on their plan

### Feature Flags

1. **Flexible Schema**: No enforced feature flag schema - any boolean flags allowed
2. **Immediate Effect**: Feature flag changes affect all tenants on the plan immediately
3. **Module Dependencies**: Some modules may depend on others (e.g., advanced_reporting requires quotes_module)
4. **Frontend Enforcement**: Frontend checks feature flags to show/hide modules

---

## Usage Examples

### Complete Workflow: Creating a New Plan

```bash
# Step 1: Create the plan
curl -X POST "https://api.lead360.app/api/v1/admin/subscription-plans" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium",
    "description": "Advanced features for power users",
    "monthly_price": 199.99,
    "annual_price": 1999.99,
    "max_users": 50,
    "feature_flags": {
      "leads_module": true,
      "quotes_module": true,
      "invoices_module": true,
      "scheduling_module": true,
      "time_tracking_module": true,
      "inventory_module": true,
      "advanced_reporting": true,
      "api_access": true,
      "white_label": true
    },
    "is_active": true,
    "is_default": false
  }'

# Response: {"id": "new-plan-id", ...}

# Step 2: Assign to a tenant
curl -X PATCH "https://api.lead360.app/api/v1/admin/tenants/tenant-id/subscription" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_plan_id": "new-plan-id"
  }'

# Step 3: Verify assignment
curl -X GET "https://api.lead360.app/api/v1/admin/subscription-plans/new-plan-id/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Complete Workflow: Deleting a Plan

```bash
# Step 1: Check which tenants use this plan
curl -X GET "https://api.lead360.app/api/v1/admin/subscription-plans/old-plan-id/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response shows 5 tenants using this plan

# Step 2: Migrate all 5 tenants to a new plan
for tenant_id in tenant1 tenant2 tenant3 tenant4 tenant5; do
  curl -X PATCH "https://api.lead360.app/api/v1/admin/tenants/$tenant_id/subscription" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"subscription_plan_id": "new-plan-id"}'
done

# Step 3: Verify no tenants remain
curl -X GET "https://api.lead360.app/api/v1/admin/subscription-plans/old-plan-id/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response: {"tenant_count": 0, "tenants": []}

# Step 4: Delete the plan
curl -X DELETE "https://api.lead360.app/api/v1/admin/subscription-plans/old-plan-id" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response: {"message": "Subscription plan deleted successfully"}
```

### Enable a Feature for All Tenants on a Plan

```bash
# Update the plan's feature flags
curl -X PATCH "https://api.lead360.app/api/v1/admin/subscription-plans/plan-id" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "feature_flags": {
      "leads_module": true,
      "quotes_module": true,
      "invoices_module": true,
      "scheduling_module": true,
      "time_tracking_module": true,
      "inventory_module": true,
      "advanced_reporting": true,
      "api_access": true,
      "new_feature": true
    }
  }'

# All tenants on this plan now have access to "new_feature"
```

---

## Audit Logging

All subscription plan management operations are logged in the audit log:

### Logged Events

| Action | Entity Type | Description |
|--------|-------------|-------------|
| `created` | `SubscriptionPlan` | New plan created |
| `updated` | `SubscriptionPlan` | Plan modified (pricing, features, settings) |
| `deleted` | `SubscriptionPlan` | Plan permanently deleted |
| `updated` | `Tenant` | Tenant plan changed (in tenant audit log) |

### Audit Log Fields

```json
{
  "id": "audit-log-id",
  "tenant_id": null,
  "actor_user_id": "admin-user-id",
  "actor_type": "platform_admin",
  "entity_type": "SubscriptionPlan",
  "entity_id": "plan-id",
  "action_type": "updated",
  "description": "Updated subscription plan",
  "before_json": {
    "monthly_price": 99.99,
    "annual_price": 999.99
  },
  "after_json": {
    "monthly_price": 149.99,
    "annual_price": 1499.99
  },
  "metadata_json": {
    "created": {...},
    "updated": {...}
  },
  "status": "success",
  "created_at": "2026-01-15T21:30:00.000Z"
}
```

---

## Testing & Development

### Swagger Documentation

Interactive API documentation available at:
```
https://api.lead360.app/api/docs
```

Search for "Admin - Platform Management" tag to find subscription plan endpoints.

### Sample Data

For testing, you may want to create plans like:

1. **Free Trial** (0-30 days, limited features)
2. **Starter** (Small businesses, basic features)
3. **Professional** (Mid-sized, full features)
4. **Enterprise** (Large organizations, unlimited)

### Environment Variables

No additional environment variables needed for subscription plan management.

---

## Support & Contact

**Documentation Version**: 1.0
**Last Updated**: January 15, 2026
**Maintained By**: Platform Admin Team

For issues or questions:
- Check Swagger docs: `https://api.lead360.app/api/docs`
- Review audit logs for operation history
- Contact platform support team

---

**End of Subscription Plans API Documentation**
