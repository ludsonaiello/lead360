# Payment Method Registry REST API Documentation

**STATUS: VERIFIED BY DOCUMENTATION AGENT — 2026-03-20**
**Verified against**: Live endpoints on localhost:8000, source code in `/api/src/modules/financial/`

**Module**: Financial (Sprint F-03 — Payment Method Registry)
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT token required on all endpoints
**Tenant Isolation**: All queries scoped to `tenant_id` derived from JWT — never from client input
**Controller Path Prefix**: `/api/v1/financial`

---

## Table of Contents

1. [List Payment Methods](#1-list-payment-methods)
2. [Create Payment Method](#2-create-payment-method)
3. [Get Single Payment Method](#3-get-single-payment-method)
4. [Update Payment Method](#4-update-payment-method)
5. [Soft-Delete Payment Method](#5-soft-delete-payment-method)
6. [Set Default Payment Method](#6-set-default-payment-method)
7. [Financial Entry Integration (Auto-Copy)](#7-financial-entry-integration-auto-copy)
8. [Default Management Behavior](#8-default-management-behavior)
9. [Technical Debt](#9-technical-debt)
10. [Common Error Response Format](#10-common-error-response-format)
11. [Authentication](#11-authentication)
12. [Audit Logging](#12-audit-logging)
13. [Service-Only Methods (Not Exposed via REST)](#13-service-only-methods-not-exposed-via-rest)
14. [Gotchas & Edge Cases](#14-gotchas--edge-cases)

---

## Response Shape — All Endpoints

Every payment method response includes the stored fields plus two **computed fields** that are never persisted — they are calculated from `financial_entry` at query time:

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Primary key |
| tenant_id | string (UUID) | Tenant scope |
| nickname | string | Human-readable name (unique per tenant, case-insensitive) |
| type | enum | `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH` |
| bank_name | string \| null | Bank or institution name |
| last_four | string \| null | Last 4 digits (display label, exactly 4 numeric digits) |
| notes | string \| null | Internal notes |
| is_default | boolean | Whether this is the tenant's default payment method |
| is_active | boolean | `true` = active, `false` = soft-deleted |
| created_by_user_id | string (UUID) | User who created this record |
| updated_by_user_id | string (UUID) \| null | User who last updated this record |
| created_at | string (ISO 8601) | Creation timestamp |
| updated_at | string (ISO 8601) | Last update timestamp |
| **usage_count** | number | **Computed.** Count of `financial_entry` records linked to this payment method |
| **last_used_date** | string (ISO 8601) \| null | **Computed.** Most recent `entry_date` from linked `financial_entry` records |

---

## 1. List Payment Methods

### GET /api/v1/financial/payment-methods

**Description**: List all payment methods for the authenticated tenant. Returns a flat array (NOT paginated) — max 50 records per tenant. Ordered by `is_default DESC`, then `nickname ASC` (default method always appears first).

**Roles**: Owner, Admin, Manager, Bookkeeper, Sales, Employee

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| is_active | boolean | `true` | Filter by active status. Pass `false` to show ALL methods (active + inactive). |
| type | enum | — | Filter by payment type: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH` |

**Response** (200):
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
    "nickname": "Chase Business Visa - Vehicle 1",
    "type": "credit_card",
    "bank_name": "Chase",
    "last_four": "4521",
    "notes": "Assigned to field crew for supply runs",
    "is_default": true,
    "is_active": true,
    "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
    "updated_by_user_id": null,
    "created_at": "2026-03-01T10:00:00.000Z",
    "updated_at": "2026-03-01T10:00:00.000Z",
    "usage_count": 12,
    "last_used_date": "2026-03-15T00:00:00.000Z"
  },
  {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
    "nickname": "Petty Cash",
    "type": "cash",
    "bank_name": null,
    "last_four": null,
    "notes": null,
    "is_default": false,
    "is_active": true,
    "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
    "updated_by_user_id": null,
    "created_at": "2026-03-05T14:30:00.000Z",
    "updated_at": "2026-03-05T14:30:00.000Z",
    "usage_count": 0,
    "last_used_date": null
  }
]
```

**Error Responses**:
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient role)

---

## 2. Create Payment Method

### POST /api/v1/financial/payment-methods

**Description**: Create a new payment method. Enforces: 50-active-method limit per tenant, case-insensitive nickname uniqueness, and atomic default management.

**Roles**: Owner, Admin, Bookkeeper

**Request Body**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| nickname | string | **yes** | Max 100 chars, unique per tenant (case-insensitive) | Human-readable name |
| type | enum | **yes** | `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH` | Payment method type |
| bank_name | string | no | Max 100 chars | Bank or institution name |
| last_four | string | no | Exactly 4 numeric digits (`/^\d{4}$/`) | Last 4 digits of card/account |
| notes | string | no | — | Internal notes |
| is_default | boolean | no | Defaults to `false` | Set as tenant default (atomically unsets all other defaults) |

**Request Example**:
```bash
curl -X POST https://api.lead360.app/api/v1/financial/payment-methods \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "Chase Business Visa - Vehicle 1",
    "type": "credit_card",
    "bank_name": "Chase",
    "last_four": "4521",
    "notes": "Assigned to field crew for supply runs",
    "is_default": true
  }'
```

**Response** (201):
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
  "nickname": "Chase Business Visa - Vehicle 1",
  "type": "credit_card",
  "bank_name": "Chase",
  "last_four": "4521",
  "notes": "Assigned to field crew for supply runs",
  "is_default": true,
  "is_active": true,
  "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "updated_by_user_id": null,
  "created_at": "2026-03-18T10:00:00.000Z",
  "updated_at": "2026-03-18T10:00:00.000Z",
  "usage_count": 0,
  "last_used_date": null
}
```

**Error Responses**:
- 400: Validation error — invalid `last_four` format (not 4 digits), invalid `type` enum, missing `nickname` or `type`, 50-method limit reached
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient role)
- 409: Conflict — a payment method with this nickname already exists for this tenant

---

## 3. Get Single Payment Method

### GET /api/v1/financial/payment-methods/:id

**Description**: Get a single payment method by UUID, scoped to the authenticated tenant.

**Roles**: Owner, Admin, Manager, Bookkeeper, Sales, Employee

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Payment method UUID. Validated via `ParseUUIDPipe`. |

**Response** (200):
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
  "nickname": "Chase Business Visa - Vehicle 1",
  "type": "credit_card",
  "bank_name": "Chase",
  "last_four": "4521",
  "notes": "Assigned to field crew for supply runs",
  "is_default": true,
  "is_active": true,
  "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "updated_by_user_id": null,
  "created_at": "2026-03-18T10:00:00.000Z",
  "updated_at": "2026-03-18T10:00:00.000Z",
  "usage_count": 12,
  "last_used_date": "2026-03-15T00:00:00.000Z"
}
```

**Error Responses**:
- 400: Invalid UUID format
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient role)
- 404: Payment method not found (or belongs to different tenant)

---

## 4. Update Payment Method

### PATCH /api/v1/financial/payment-methods/:id

**Description**: Partial update a payment method. Only provided fields are updated. **Note:** `is_default` is NOT updatable via PATCH — use the `set-default` endpoint instead.

**Roles**: Owner, Admin, Bookkeeper

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Payment method UUID |

**Request Body** (all fields optional):
| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| nickname | string | Max 100 chars, unique per tenant (case-insensitive, excludes self) | Human-readable name |
| type | enum | `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH` | Payment method type |
| bank_name | string | Max 100 chars | Bank or institution name |
| last_four | string | Exactly 4 numeric digits (`/^\d{4}$/`) | Last 4 digits of card/account |
| notes | string | — | Internal notes |
| is_active | boolean | — | Activate or deactivate this method |

**Request Example**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/financial/payment-methods/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "Chase Business Visa - Updated",
    "bank_name": "Chase Bank"
  }'
```

**Response** (200):
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
  "nickname": "Chase Business Visa - Updated",
  "type": "credit_card",
  "bank_name": "Chase Bank",
  "last_four": "4521",
  "notes": "Assigned to field crew for supply runs",
  "is_default": true,
  "is_active": true,
  "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "updated_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "created_at": "2026-03-18T10:00:00.000Z",
  "updated_at": "2026-03-19T08:30:00.000Z",
  "usage_count": 12,
  "last_used_date": "2026-03-15T00:00:00.000Z"
}
```

**Error Responses**:
- 400: Validation error — invalid `last_four` format, invalid `type` enum
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient role)
- 404: Payment method not found
- 409: Conflict — a payment method with this nickname already exists for this tenant

---

## 5. Soft-Delete Payment Method

### DELETE /api/v1/financial/payment-methods/:id

**Description**: Soft-delete a payment method by setting `is_active = false`. If the deleted record was the tenant default, the system auto-reassigns the default to the most recently created active method. Returns 200 with the deactivated record (NOT 204).

**Roles**: Owner, Admin

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Payment method UUID |

**Response** (200):
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
  "nickname": "Chase Business Visa - Vehicle 1",
  "type": "credit_card",
  "bank_name": "Chase",
  "last_four": "4521",
  "notes": "Assigned to field crew for supply runs",
  "is_default": true,
  "is_active": false,
  "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "updated_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "created_at": "2026-03-18T10:00:00.000Z",
  "updated_at": "2026-03-19T09:00:00.000Z",
  "usage_count": 12,
  "last_used_date": "2026-03-15T00:00:00.000Z"
}
```

**Error Responses**:
- 400: Invalid UUID format
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient role)
- 404: Payment method not found

---

## 6. Set Default Payment Method

### POST /api/v1/financial/payment-methods/:id/set-default

**Description**: Set a payment method as the tenant's default. This is atomic via Prisma `$transaction`: all existing defaults are unset, then this record is set as default. Inactive payment methods cannot be set as default.

**Roles**: Owner, Admin, Bookkeeper

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Payment method UUID |

**Request Body**: None

**Response** (200):
```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "tenant_id": "t1234567-89ab-cdef-0123-456789abcdef",
  "nickname": "Petty Cash",
  "type": "cash",
  "bank_name": null,
  "last_four": null,
  "notes": null,
  "is_default": true,
  "is_active": true,
  "created_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "updated_by_user_id": "u1234567-89ab-cdef-0123-456789abcdef",
  "created_at": "2026-03-05T14:30:00.000Z",
  "updated_at": "2026-03-19T09:15:00.000Z",
  "usage_count": 3,
  "last_used_date": "2026-03-10T00:00:00.000Z"
}
```

**Error Responses**:
- 400: Payment method is inactive — cannot set as default
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient role)
- 404: Payment method not found

---

## 7. Financial Entry Integration (Auto-Copy)

The `financial_entry` table has two payment-related fields:

| Field | Type | Description |
|-------|------|-------------|
| `payment_method` | enum \| null | Raw payment type: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH` |
| `payment_method_registry_id` | string (UUID) \| null | FK → `payment_method_registry.id` |

### Auto-Copy Behavior

When creating a `financial_entry` via `POST /api/v1/financial/entries`:

1. **If `payment_method_registry_id` is provided:**
   - The `FinancialEntryService` validates the registry record via a private `validatePaymentMethodRegistry(tenantId, registryId)` method that queries `payment_method_registry` directly with `is_active: true` — inactive registry records are rejected with `404 Not Found`
   - The registry record's `type` is **automatically copied** to `financial_entry.payment_method`
   - The client does NOT need to provide `payment_method` — it is resolved from the registry
   - If the client also provides `payment_method`, the registry value **takes precedence** (overwritten by auto-copy)
   - This ensures backward compatibility: existing queries filtering by the `payment_method` enum column continue to work without joining the registry table

2. **If only `payment_method` is provided (no `payment_method_registry_id`):**
   - The raw enum value is stored directly in `financial_entry.payment_method`
   - No registry lookup occurs
   - This is the "quick entry" flow for simple expense recording

3. **If neither is provided:**
   - Both fields remain `null`
   - The entry has no payment method information

### Field Relationship Summary

```
financial_entry.payment_method             ← raw enum type (always present when either field is set)
financial_entry.payment_method_registry_id ← FK to named account record (optional)
```

The `payment_method` enum acts as a denormalized copy — enabling efficient filtering without a JOIN. The `payment_method_registry_id` FK links to the full named account record with bank name, last four digits, and notes.

---

## 8. Default Management Behavior

### Single Default Per Tenant

Each tenant can have at most one default payment method. The default is used by Sprint F-04 to pre-populate new expense entry forms via `PaymentMethodRegistryService.findDefault(tenantId)`.

### Atomic Default Changes

Both `create()` (with `is_default: true`) and `setDefault()` use Prisma `$transaction` to:
1. `updateMany` — set `is_default = false` on ALL existing defaults for the tenant
2. `create` or `update` — set `is_default = true` on the target record

This ensures there is never a state where two records are simultaneously marked as default.

### Auto-Reassignment on Soft-Delete

When a payment method is soft-deleted via `DELETE /api/v1/financial/payment-methods/:id`:
- If the deleted record was the default (`is_default = true`), the system finds the most recently created active payment method (`orderBy: { created_at: 'desc' }`) and promotes it to default
- If no other active methods exist, no reassignment occurs — the tenant has no default
- If the deleted record was NOT the default, no reassignment is needed

### Default Cannot Be Set on Inactive Methods

Calling `POST /api/v1/financial/payment-methods/:id/set-default` on an inactive (`is_active = false`) method returns `400 Bad Request`.

---

## 9. Technical Debt

> **Note:** `crew_payment_record.payment_method` and `subcontractor_payment_record.payment_method` currently use a raw `payment_method` enum value. Migration to reference `payment_method_registry` is deferred to a future sprint. These tables continue to accept enum values directly and do not participate in the registry system.

The following tables are **NOT integrated** with the Payment Method Registry:
- `crew_payment_record` — uses `payment_method` enum directly (values: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`)
- `subcontractor_payment_record` — uses `payment_method` enum directly (same values)

Only `financial_entry` has a `payment_method_registry_id` FK and participates in the auto-copy behavior.

---

## 10. Common Error Response Format

All error responses use the platform's custom exception filter. **This is NOT the default NestJS format** — it includes additional fields:

```json
{
  "statusCode": 409,
  "errorCode": "SERVER_INTERNAL_ERROR",
  "message": "A payment method with this nickname already exists",
  "error": "Conflict",
  "timestamp": "2026-03-19T20:55:32.962Z",
  "path": "/api/v1/financial/payment-methods",
  "requestId": "req_e7e74c5998fb7e90"
}
```

| Field | Type | Description |
|-------|------|-------------|
| statusCode | number | HTTP status code |
| errorCode | string | Platform error code. `"RESOURCE_NOT_FOUND"` for 404, `"SERVER_INTERNAL_ERROR"` for all others |
| message | string | Human-readable error message. For validation errors, multiple messages are **comma-separated** (not an array) |
| error | string | HTTP status text (e.g., "Bad Request", "Conflict", "Not Found") |
| timestamp | string (ISO 8601) | Server timestamp of the error |
| path | string | Request path that caused the error |
| requestId | string | Unique request ID for tracing (format: `req_{hex}`) |

**Validation error example** (multiple messages comma-separated):
```json
{
  "statusCode": 400,
  "errorCode": "SERVER_INTERNAL_ERROR",
  "message": "nickname must be shorter than or equal to 100 characters, nickname must be a string, type must be one of: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH",
  "error": "Bad Request",
  "timestamp": "2026-03-19T20:55:33.045Z",
  "path": "/api/v1/financial/payment-methods",
  "requestId": "req_b73d74f7ace97eea"
}
```

| Status | Error Type | errorCode | When |
|--------|-----------|-----------|------|
| 400 | Bad Request | SERVER_INTERNAL_ERROR | Validation error, 50-method limit, inactive method set as default, invalid UUID format |
| 401 | Unauthorized | SERVER_INTERNAL_ERROR | Missing or invalid JWT token |
| 403 | Forbidden | SERVER_INTERNAL_ERROR | User role not in allowed list |
| 404 | Not Found | RESOURCE_NOT_FOUND | Record does not exist or belongs to different tenant |
| 409 | Conflict | SERVER_INTERNAL_ERROR | Duplicate nickname for tenant |

---

## 11. Authentication

All endpoints require a valid JWT Bearer token:

```
Authorization: Bearer <access_token>
```

The `tenant_id` and `user_id` are extracted from the JWT payload by the `JwtAuthGuard`. They are **never** accepted from the request body or query parameters.

### Obtaining a Token

```bash
curl -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## 12. Audit Logging

All data-modifying operations are logged via `AuditLoggerService.logTenantChange()`:

| Endpoint | Action | Description |
|----------|--------|-------------|
| POST /api/v1/financial/payment-methods | `created` | "Created payment method: {nickname}" |
| PATCH /api/v1/financial/payment-methods/:id | `updated` | "Updated payment method: {nickname}" — includes `before` and `after` snapshots |
| DELETE /api/v1/financial/payment-methods/:id | `deleted` | "Deactivated payment method: {nickname}" — includes `before` and `after` snapshots |
| POST /api/v1/financial/payment-methods/:id/set-default | `updated` | "Set payment method as default: {nickname}" — includes `before` and `after` snapshots |

Each audit log entry includes: `action`, `entityType` ("payment_method_registry"), `entityId`, `tenantId`, `actorUserId`, and a human-readable `description`.

---

## 13. Service-Only Methods (Not Exposed via REST)

### `findDefault(tenantId: string): Promise<PaymentMethod | null>`

**Not a REST endpoint.** This is an internal service method exported from `FinancialModule` for use by Sprint F-04 (General Expense Entry Engine).

- Queries `payment_method_registry` where `tenant_id = tenantId`, `is_default = true`, `is_active = true`
- Returns the enriched record (with `usage_count` and `last_used_date`) or `null` if no default exists
- Does NOT throw — returns `null` gracefully
- Used to pre-populate the payment method dropdown in new expense entry forms

**Usage (internal only):**
```typescript
const defaultMethod = await this.paymentMethodRegistryService.findDefault(tenantId);
// defaultMethod is null or { id, nickname, type, ... , usage_count, last_used_date }
```

---

## 14. Gotchas & Edge Cases

### Soft-deleted records retain `is_default: true` in storage

When a default payment method is soft-deleted, the service sets `is_active = false` but does **NOT** clear `is_default`. The auto-reassignment creates a new default on a different record. This means when querying with `is_active=false` (show all), you may see **two records** with `is_default: true` — one active (the new default) and one inactive (the old deleted default).

**Frontend implication:** When displaying the "default" badge, always check `is_active === true && is_default === true`. Never trust `is_default` alone.

### PATCH can reactivate a soft-deleted method

The `UpdatePaymentMethodRegistryDto` accepts `is_active: boolean`. Sending `PATCH { "is_active": true }` on a soft-deleted record will reactivate it. This is an alternative to creating a new record. Note: reactivating does NOT automatically restore `is_default` status — use `set-default` separately.

### `is_active=false` query param shows ALL records, not just inactive

Passing `?is_active=false` does NOT mean "show only inactive." It means "remove the active filter — show everything." The service code:
```typescript
if (query.is_active === false) {
  // Do not filter by is_active — show all
}
```
To show only inactive records, the frontend must filter client-side from the full result set.

### Nickname uniqueness is case-insensitive and enforced at both application and database level

Uniqueness is enforced at **two layers**:
1. **Application level** — `findFirst` check before create/update (returns 409 with user-friendly message)
2. **Database level** — `UNIQUE(tenant_id, nickname)` constraint (catches race conditions, returns 409 via P2002 handler)

MySQL collation handles case-insensitivity. "Chase Visa" and "chase visa" are considered duplicates. Empty string nicknames are rejected by `@IsNotEmpty()` validation.
