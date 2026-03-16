# Financial Gate 3 REST API Documentation

**Module**: Financial (Gate 3 — Crew Payments, Hour Logs, Subcontractor Payments, Invoices)
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT token required on all endpoints
**Tenant Isolation**: All queries scoped to `tenant_id` derived from JWT — never from client input

---

## Table of Contents

1. [Crew Payments](#crew-payments)
2. [Crew Payment History](#crew-payment-history)
3. [Crew Hours](#crew-hours)
4. [Subcontractor Payments](#subcontractor-payments)
5. [Subcontractor Payment History](#subcontractor-payment-history)
6. [Subcontractor Invoices](#subcontractor-invoices)
7. [Task Invoices](#task-invoices)
8. [Subcontractor Invoice List (Profile)](#subcontractor-invoice-list-profile)
9. [Subcontractor Payment Summary](#subcontractor-payment-summary)

---

## Crew Payments

### POST /financial/crew-payments

**Description**: Create a crew payment record.

**Roles**: Owner, Admin, Bookkeeper

**Request Body**:
| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| crew_member_id | string (UUID) | yes | Must belong to tenant | FK → crew_member |
| project_id | string (UUID) | no | Must belong to tenant if provided | FK → project |
| amount | number | yes | > 0, max 2 decimal places | Decimal(12,2) |
| payment_date | string (ISO date) | yes | Cannot be future date | e.g. "2026-03-15" |
| payment_method | enum | yes | cash, check, bank_transfer, venmo, zelle | |
| reference_number | string | no | Max 200 chars | Check number, wire ID, etc. |
| period_start_date | string (ISO date) | no | Must be ≤ period_end_date if both set | |
| period_end_date | string (ISO date) | no | Must be ≥ period_start_date if both set | |
| hours_paid | number | no | ≥ 0, max 2 decimal places | Reference only |
| notes | string | no | | |

**Response** (201):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "crew_member_id": "uuid",
  "project_id": null,
  "amount": "1500.00",
  "payment_date": "2026-03-15T00:00:00.000Z",
  "payment_method": "check",
  "reference_number": "CHK-4521",
  "period_start_date": "2026-03-01T00:00:00.000Z",
  "period_end_date": "2026-03-15T00:00:00.000Z",
  "hours_paid": "40.00",
  "notes": "Bi-weekly payment",
  "created_by_user_id": "uuid",
  "created_at": "2026-03-15T10:00:00.000Z",
  "crew_member": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe"
  },
  "project": null
}
```

**Error Responses**:
- 400: Validation error (amount ≤ 0, future date, period dates invalid)
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient role)
- 404: Crew member not found or does not belong to tenant

---

### GET /financial/crew-payments

**Description**: List crew payments (paginated).

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| crew_member_id | string (UUID) | — | Filter by crew member |
| project_id | string (UUID) | — | Filter by project |
| page | number | 1 | |
| limit | number | 20 | Max 100 |

**Response** (200):
```json
{
  "data": [ /* array of crew payment records */ ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "pages": 2
  }
}
```

---

## Crew Payment History

### GET /crew/:crewMemberId/payment-history

**Description**: Get paginated payment history for a specific crew member.

**Roles**: Owner, Admin, Manager, Bookkeeper

**Path Parameters**:
| Param | Type | Notes |
|-------|------|-------|
| crewMemberId | string (UUID) | Crew member ID |

**Query Parameters**:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| project_id | string (UUID) | — | Filter by project |
| page | number | 1 | |
| limit | number | 20 | Max 100 |

**Response** (200): Same paginated format as GET /financial/crew-payments

---

## Crew Hours

### POST /financial/crew-hours

**Description**: Log hours for a crew member (manual source only in Phase 1).

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| crew_member_id | string (UUID) | yes | Must belong to tenant | |
| project_id | string (UUID) | yes | Must belong to tenant | |
| task_id | string (UUID) | no | Must belong to project if provided | |
| log_date | string (ISO date) | yes | | |
| hours_regular | number | yes | > 0, max 2 decimal places | Decimal(5,2) |
| hours_overtime | number | no | ≥ 0, max 2 decimal places | Defaults to 0 |
| notes | string | no | | |

**Response** (201):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "crew_member_id": "uuid",
  "project_id": "uuid",
  "task_id": null,
  "log_date": "2026-03-15T00:00:00.000Z",
  "hours_regular": "8.00",
  "hours_overtime": "2.00",
  "source": "manual",
  "clockin_event_id": null,
  "notes": "Framing work",
  "created_by_user_id": "uuid",
  "created_at": "2026-03-15T10:00:00.000Z",
  "updated_at": "2026-03-15T10:00:00.000Z",
  "crew_member": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe"
  },
  "project": {
    "id": "uuid",
    "name": "Kitchen Remodel",
    "project_number": "P-0012"
  },
  "task": null
}
```

**Error Responses**:
- 400: Validation error (hours_regular ≤ 0)
- 401: Unauthorized
- 403: Forbidden
- 404: Crew member, project, or task not found

---

### GET /financial/crew-hours

**Description**: List crew hour logs (paginated).

**Roles**: Owner, Admin, Manager, Bookkeeper

**Query Parameters**:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| crew_member_id | string (UUID) | — | Filter by crew member |
| project_id | string (UUID) | — | Filter by project |
| date_from | string (ISO date) | — | Inclusive start date |
| date_to | string (ISO date) | — | Inclusive end date |
| page | number | 1 | |
| limit | number | 20 | Max 100 |

**Response** (200): Paginated format with `data` and `meta`.

---

### PATCH /financial/crew-hours/:id

**Description**: Update a crew hour log entry.

**Roles**: Owner, Admin

**Path Parameters**:
| Param | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Hour log ID |

**Request Body** (all optional):
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| task_id | string (UUID) | Must belong to the log's project | |
| log_date | string (ISO date) | | |
| hours_regular | number | > 0 | |
| hours_overtime | number | ≥ 0 | |
| notes | string | | |

**Response** (200): Updated hour log record.

**Error Responses**:
- 400: Validation error
- 404: Hour log not found

---

## Subcontractor Payments

### POST /financial/subcontractor-payments

**Description**: Create a subcontractor payment record.

**Roles**: Owner, Admin, Bookkeeper

**Request Body**:
| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| subcontractor_id | string (UUID) | yes | Must belong to tenant | FK → subcontractor |
| project_id | string (UUID) | no | Must belong to tenant if provided | |
| amount | number | yes | > 0, max 2 decimal places | Decimal(12,2) |
| payment_date | string (ISO date) | yes | Cannot be future date | |
| payment_method | enum | yes | cash, check, bank_transfer, venmo, zelle | |
| reference_number | string | no | Max 200 chars | |
| notes | string | no | | |

**Response** (201):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "subcontractor_id": "uuid",
  "project_id": null,
  "amount": "5000.00",
  "payment_date": "2026-03-15T00:00:00.000Z",
  "payment_method": "bank_transfer",
  "reference_number": "WIRE-20260315-001",
  "notes": "Payment for electrical work",
  "created_by_user_id": "uuid",
  "created_at": "2026-03-15T10:00:00.000Z",
  "subcontractor": {
    "id": "uuid",
    "business_name": "Acme Electric",
    "trade_specialty": "Electrical"
  },
  "project": null
}
```

**Error Responses**:
- 400: Validation error (amount ≤ 0, future date)
- 404: Subcontractor not found

---

### GET /financial/subcontractor-payments

**Description**: List subcontractor payments (paginated).

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| subcontractor_id | string (UUID) | — | Filter by subcontractor |
| project_id | string (UUID) | — | Filter by project |
| page | number | 1 | |
| limit | number | 20 | Max 100 |

**Response** (200): Paginated format with `data` and `meta`.

---

## Subcontractor Payment History

### GET /subcontractors/:subcontractorId/payment-history

**Description**: Get paginated payment history for a specific subcontractor.

**Roles**: Owner, Admin, Manager, Bookkeeper

**Path Parameters**:
| Param | Type | Notes |
|-------|------|-------|
| subcontractorId | string (UUID) | Subcontractor ID |

**Query Parameters**:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| project_id | string (UUID) | — | Filter by project |
| page | number | 1 | |
| limit | number | 20 | Max 100 |

**Response** (200): Same paginated format as GET /financial/subcontractor-payments

---

## Subcontractor Invoices

### POST /financial/subcontractor-invoices

**Description**: Create a subcontractor task invoice. Supports optional file upload (multipart/form-data).

**Roles**: Owner, Admin, Manager, Bookkeeper

**Content-Type**: `multipart/form-data` (when uploading file) or `application/json`

**Request Body**:
| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| subcontractor_id | string (UUID) | yes | Must belong to tenant | |
| task_id | string (UUID) | yes | Must belong to project | |
| project_id | string (UUID) | yes | Must belong to tenant | |
| amount | number | yes | > 0, max 2 decimal places | Decimal(12,2) |
| invoice_number | string | no | Max 100 chars, unique per tenant | ConflictException if duplicate |
| invoice_date | string (ISO date) | no | | |
| notes | string | no | | |
| file | File (binary) | no | Uploaded via FilesService, category: invoice | |

**Response** (201):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "subcontractor_id": "uuid",
  "task_id": "uuid",
  "project_id": "uuid",
  "invoice_number": "SUB-INV-0045",
  "invoice_date": "2026-03-10T00:00:00.000Z",
  "amount": "3500.00",
  "status": "pending",
  "notes": "Electrical rough-in for unit 5A",
  "file_id": null,
  "file_url": null,
  "file_name": null,
  "created_by_user_id": "uuid",
  "created_at": "2026-03-15T10:00:00.000Z",
  "updated_at": "2026-03-15T10:00:00.000Z",
  "subcontractor": {
    "id": "uuid",
    "business_name": "Acme Electric",
    "trade_specialty": "Electrical"
  },
  "task": {
    "id": "uuid",
    "title": "Electrical Rough-In"
  },
  "project": {
    "id": "uuid",
    "name": "Kitchen Remodel",
    "project_number": "P-0012"
  }
}
```

**Error Responses**:
- 400: Validation error
- 404: Subcontractor, project, or task not found
- 409: Invoice number already exists for this tenant

---

### GET /financial/subcontractor-invoices

**Description**: List subcontractor invoices (paginated).

**Roles**: Owner, Admin, Manager, Bookkeeper

**Query Parameters**:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| subcontractor_id | string (UUID) | — | Filter by subcontractor |
| task_id | string (UUID) | — | Filter by task |
| project_id | string (UUID) | — | Filter by project |
| status | enum | — | pending, approved, paid |
| page | number | 1 | |
| limit | number | 20 | Max 100 |

**Response** (200): Paginated format with `data` and `meta`.

---

### PATCH /financial/subcontractor-invoices/:id

**Description**: Update a subcontractor invoice. Enforces forward-only status transitions.

**Roles**: Owner, Admin, Bookkeeper

**Path Parameters**:
| Param | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Invoice ID |

**Request Body** (all optional):
| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| status | enum | approved or paid | Forward-only: pending→approved→paid. Cannot skip. |
| amount | number | > 0 | Only updatable while status is 'pending' |
| notes | string | | |

**Status Transition Rules**:
- `pending` → `approved` ✅
- `approved` → `paid` ✅
- `approved` → `pending` ❌ (backward not allowed)
- `pending` → `paid` ❌ (cannot skip statuses)
- Amount can only be updated when status is `pending`

**Response** (200): Updated invoice record.

**Error Responses**:
- 400: Invalid status transition, or amount update on non-pending invoice
- 404: Invoice not found

---

## Task Invoices

### GET /projects/:projectId/tasks/:taskId/invoices

**Description**: Get all invoices for a specific task.

**Roles**: Owner, Admin, Manager, Bookkeeper

**Path Parameters**:
| Param | Type | Notes |
|-------|------|-------|
| projectId | string (UUID) | Project ID |
| taskId | string (UUID) | Task ID |

**Response** (200):
```json
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "subcontractor_id": "uuid",
    "task_id": "uuid",
    "project_id": "uuid",
    "invoice_number": "SUB-INV-0045",
    "invoice_date": "2026-03-10T00:00:00.000Z",
    "amount": "3500.00",
    "status": "pending",
    "notes": "...",
    "file_id": null,
    "file_url": null,
    "file_name": null,
    "created_by_user_id": "uuid",
    "created_at": "...",
    "updated_at": "...",
    "subcontractor": {
      "id": "uuid",
      "business_name": "Acme Electric",
      "trade_specialty": "Electrical"
    }
  }
]
```

---

## Subcontractor Invoice List (Profile)

### GET /subcontractors/:id/invoices

**Description**: List all invoices for a specific subcontractor across all projects and tasks. Returns task and project context for each invoice. Added in Sprint 30.

**Roles**: Owner, Admin, Manager, Bookkeeper

**Path Parameters**:
| Param | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Subcontractor UUID |

**Response** (200):
```json
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "subcontractor_id": "uuid",
    "task_id": "uuid",
    "project_id": "uuid",
    "invoice_number": "SUB-INV-0045",
    "invoice_date": "2026-03-10T00:00:00.000Z",
    "amount": "3500.00",
    "status": "pending",
    "notes": "Electrical rough-in",
    "file_id": null,
    "file_url": null,
    "file_name": null,
    "created_by_user_id": "uuid",
    "created_at": "2026-03-10T14:00:00.000Z",
    "updated_at": "2026-03-10T14:00:00.000Z",
    "task": {
      "id": "uuid",
      "title": "Electrical Rough-In"
    },
    "project": {
      "id": "uuid",
      "name": "Smith Residence Remodel",
      "project_number": "P-001"
    }
  }
]
```

**Error Responses**:
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient role)

**Notes**: Returns empty array `[]` if subcontractor has no invoices or does not exist. Ordered by `created_at` descending.

---

## Subcontractor Payment Summary

### GET /subcontractors/:id/payment-summary

**Description**: Get aggregated financial summary for a subcontractor combining invoice totals by status and total payments made. Added in Sprint 30.

**Roles**: Owner, Admin, Manager, Bookkeeper

**Path Parameters**:
| Param | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Subcontractor UUID |

**Response** (200):
```json
{
  "subcontractor_id": "uuid",
  "total_invoiced": 15000.00,
  "total_paid": 10000.00,
  "total_pending": 3000.00,
  "total_approved": 2000.00,
  "invoices_count": 5,
  "payments_count": 3
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| subcontractor_id | string (UUID) | The subcontractor's ID |
| total_invoiced | number | Sum of all invoice amounts (all statuses) |
| total_paid | number | Sum of all payment records (from `subcontractor_payment_record`) |
| total_pending | number | Sum of invoice amounts with status `pending` |
| total_approved | number | Sum of invoice amounts with status `approved` |
| invoices_count | number | Total number of invoices |
| payments_count | number | Total number of payment records |

**Error Responses**:
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient role)
- 404: Subcontractor not found or does not belong to tenant

**Notes**:
- `total_paid` comes from actual payment records, not from invoices with `paid` status
- `total_invoiced` includes invoices in all statuses (pending + approved + paid)
- If the subcontractor has no invoices or payments, all numeric fields return `0`

---

## Common Error Response Format

All error responses follow this format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Or for validation errors with field-level details:

```json
{
  "statusCode": 400,
  "message": [
    "amount must not be less than 0.01",
    "payment_method must be one of: cash, check, bank_transfer, venmo, zelle"
  ],
  "error": "Bad Request"
}
```

---

## Authentication

All endpoints require a valid JWT Bearer token:

```
Authorization: Bearer <jwt_token>
```

The `tenant_id` and `user_id` are extracted server-side from the JWT payload. They are never accepted from client input.

---

## Audit Logging

All write operations (POST, PATCH) produce audit log entries via `AuditLoggerService.logTenantChange()` with:
- `action`: created, updated
- `entityType`: crew_payment_record, crew_hour_log, subcontractor_payment_record, subcontractor_task_invoice
- `before` / `after`: Full entity state for change tracking
- `description`: Human-readable summary
