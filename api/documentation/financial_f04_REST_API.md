# Financial Entry Engine (F-04) — REST API Documentation

**STATUS: VERIFIED BY DOCUMENTATION AGENT — 2026-03-20**

**Version**: 1.0
**Last Updated**: 2026-03-20
**Base URL**: `https://api.lead360.app/api/v1`
**Module**: Financial Entries — General Expense Entry Engine
**Verification**: All 10 endpoints tested with live HTTP requests. Response shapes, error codes, and business rules confirmed against running server.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Role-Based Behavior Matrix](#role-based-behavior-matrix)
3. [Enriched Response Shape](#enriched-response-shape)
4. [Pending Workflow](#pending-workflow)
5. [Endpoints](#endpoints)
   - [POST /financial/entries](#1-post-financialentries)
   - [GET /financial/entries](#2-get-financialentries)
   - [GET /financial/entries/pending](#3-get-financialentriespending)
   - [GET /financial/entries/export](#4-get-financialentriesexport)
   - [GET /financial/entries/:id](#5-get-financialentriesid)
   - [PATCH /financial/entries/:id](#6-patch-financialentriesid)
   - [DELETE /financial/entries/:id](#7-delete-financialentriesid)
   - [POST /financial/entries/:id/approve](#8-post-financialentriesidapprove)
   - [POST /financial/entries/:id/reject](#9-post-financialentriesidreject)
   - [POST /financial/entries/:id/resubmit](#10-post-financialentriesidresubmit)
6. [Business Rules](#business-rules)
7. [Enums Reference](#enums-reference)
8. [Error Response Format](#error-response-format)

---

## Authentication

All endpoints require JWT authentication via Bearer token.

```
Authorization: Bearer <JWT_TOKEN>
```

---

## Role-Based Behavior Matrix

| Action | Owner | Admin | Manager | Bookkeeper | Employee |
|--------|-------|-------|---------|------------|----------|
| Create entry | Yes (confirmed) | Yes (confirmed) | Yes (confirmed) | Yes (confirmed) | Yes (forced pending_review) |
| List all entries | All tenant | All tenant | All tenant | All tenant | Own entries only |
| View single entry | Any | Any | Any | Any | Own only |
| Update entry | Any | Any | Any | Any | Own + pending_review only |
| Delete entry | Any status | Any status | **NO (403)** | **NO (403)** | Own + pending_review only |
| List pending | Yes | Yes | Yes | Yes | **NO (403)** |
| Approve | Yes | Yes | Yes | Yes | **NO (403)** |
| Reject | Yes | Yes | Yes | Yes | **NO (403)** |
| Resubmit | Any | Any | Any | Any | Own only |
| Export CSV | Yes | Yes | **NO (403)** | Yes | **NO (403)** |

---

## Enriched Response Shape

All entry endpoints return an enriched flat response with human-readable labels for all FK references:

```json
{
  "id": "cee71acf-f7c8-4a2b-ad83-777161dd4af5",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "project_id": "f8a1b2c3-d4e5-6789-abcd-ef0123456789",
  "project_name": "Kitchen Renovation",
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "task_title": "Install Cabinets",
  "category_id": "5dc27901-7451-41cd-9da8-474c10c59869",
  "category_name": "Labor - Crew Overtime",
  "category_type": "labor",
  "category_classification": "cost_of_goods_sold",
  "entry_type": "expense",
  "amount": 542,
  "tax_amount": 35.5,
  "entry_date": "2026-03-17T00:00:00.000Z",
  "entry_time": "1970-01-01T14:30:00.000Z",
  "vendor_name": "Home Depot",
  "supplier_id": "b2c3d4e5-f6a7-8901-bcde-f01234567890",
  "supplier_name": "Home Depot Supply Co.",
  "payment_method": "credit_card",
  "payment_method_registry_id": "c3d4e5f6-a7b8-9012-cdef-012345678901",
  "payment_method_nickname": "Company Visa ****4242",
  "purchased_by_user_id": "d4e5f6a7-b8c9-0123-defa-123456789012",
  "purchased_by_user_name": "John Smith",
  "purchased_by_crew_member_id": null,
  "purchased_by_crew_member_name": null,
  "submission_status": "confirmed",
  "rejection_reason": null,
  "rejected_by_user_id": null,
  "rejected_by_name": null,
  "rejected_at": null,
  "is_recurring_instance": false,
  "recurring_rule_id": null,
  "has_receipt": false,
  "notes": "2x4 studs for framing",
  "created_by_user_id": "e5f6a7b8-c9d0-1234-efab-234567890123",
  "created_by_name": "Ludson Menezes",
  "created_at": "2026-03-17T01:37:05.205Z",
  "updated_at": "2026-03-17T01:37:05.205Z"
}
```

### Field Types (Verified)

| Field | JSON Type | Notes |
|-------|-----------|-------|
| `amount` | number | Prisma Decimal serialized as JS number (e.g., `542`, `125.5`) |
| `tax_amount` | number or null | Same as amount |
| `entry_date` | string (ISO 8601) | Date stored as `YYYY-MM-DDT00:00:00.000Z` |
| `entry_time` | string (ISO 8601) or null | Time stored with 1970-01-01 base: `1970-01-01THH:MM:SS.000Z` |
| `created_at` | string (ISO 8601) | Full datetime |
| `updated_at` | string (ISO 8601) | Full datetime |
| `rejected_at` | string (ISO 8601) or null | Full datetime when populated |
| All `*_id` fields | string (UUID v4) or null | 36-char UUID |
| All `*_name` fields | string or null | Human-readable labels from joined relations |

---

## Pending Workflow

The F-04 engine implements a two-tier submit/post workflow:

1. **Employee creates entry** → `submission_status` is forced to `pending_review` regardless of request body
2. **Privileged role creates entry** → `submission_status` defaults to `confirmed` (can opt for `pending_review`)
3. **Pending entries** appear in the approval queue (`GET /financial/entries/pending`)
4. **Approve** → Changes `submission_status` to `confirmed`
5. **Reject** → Sets `rejection_reason`, `rejected_by_user_id`, `rejected_at` — status STAYS `pending_review`
6. **Resubmit** → Clears all rejection fields, entry returns to clean pending state

Rejected entries remain in `pending_review` status (not deleted) with rejection metadata visible. On approval, rejection fields are preserved for audit trail.

---

## Endpoints

### 1. POST /financial/entries

**Create a financial entry.**

- **URL**: `POST /api/v1/financial/entries`
- **Auth**: Required (JWT)
- **Roles**: Owner, Admin, Manager, Bookkeeper, Employee

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `category_id` | UUID | Yes | Must belong to tenant, active | Financial category ID |
| `entry_type` | string | Yes | `expense` or `income` | Entry type |
| `amount` | number | Yes | > 0, max 2 decimal places | Entry amount |
| `entry_date` | string | Yes | ISO date (YYYY-MM-DD), not future | Date of the entry |
| `project_id` | UUID | No | Must belong to tenant | Project ID (omit for overhead) |
| `task_id` | UUID | No | Must belong to tenant | Task ID |
| `tax_amount` | number | No | >= 0, < amount | Tax amount |
| `entry_time` | string | No | HH:MM:SS format, max 8 chars | Time of entry |
| `vendor_name` | string | No | Max 200 chars | Vendor name (free text) |
| `supplier_id` | UUID | No | Must belong to tenant, active | Supplier from registry |
| `payment_method` | string | No | See enum | Payment method (ignored if registry_id provided) |
| `payment_method_registry_id` | UUID | No | Must belong to tenant, active | Auto-copies type into payment_method |
| `purchased_by_user_id` | UUID | No | Must belong to tenant, mutually exclusive with crew member | User who purchased |
| `purchased_by_crew_member_id` | UUID | No | Must belong to tenant, mutually exclusive with user | Crew member who purchased |
| `submission_status` | string | No | `pending_review` or `confirmed` | Employee value is always overridden to `pending_review` |
| `notes` | string | No | Max 2000 chars | Additional notes |

#### Example Request

```bash
curl -X POST https://api.lead360.app/api/v1/financial/entries \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "550e8400-e29b-41d4-a716-446655440002",
    "entry_type": "expense",
    "amount": 450.00,
    "tax_amount": 35.50,
    "entry_date": "2026-03-10",
    "entry_time": "14:30:00",
    "vendor_name": "Home Depot",
    "supplier_id": "550e8400-e29b-41d4-a716-446655440005",
    "payment_method_registry_id": "550e8400-e29b-41d4-a716-446655440006",
    "purchased_by_user_id": "550e8400-e29b-41d4-a716-446655440007",
    "notes": "2x4 studs for framing"
  }'
```

#### Response 201

Returns the enriched response shape (see [Enriched Response Shape](#enriched-response-shape)).

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error (invalid fields, tax >= amount, both purchased_by provided, future date) |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role permissions |
| 404 | Referenced entity not found (category, project, task, supplier, payment method, user, crew member) |

---

### 2. GET /financial/entries

**List financial entries with pagination, filtering, sorting, search, and summary aggregations.**

- **URL**: `GET /api/v1/financial/entries`
- **Auth**: Required (JWT)
- **Roles**: Owner, Admin, Manager, Bookkeeper, Employee
- **Employee scoping**: Employees see only their own entries (automatic, silent filter)

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (min: 1) |
| `limit` | number | 20 | Items per page (min: 1, max: 100) |
| `sort_by` | string | `entry_date` | Sort field: `entry_date`, `amount`, `created_at` |
| `sort_order` | string | `desc` | Sort direction: `asc`, `desc` |
| `project_id` | UUID | — | Filter by project |
| `task_id` | UUID | — | Filter by task |
| `category_id` | UUID | — | Filter by category |
| `category_type` | string | — | Filter by category type (see enum) |
| `classification` | string | — | Filter: `cost_of_goods_sold` or `operating_expense` |
| `entry_type` | string | — | Filter: `expense` or `income` |
| `supplier_id` | UUID | — | Filter by supplier |
| `payment_method` | string | — | Filter by payment method (see enum) |
| `submission_status` | string | — | Filter: `pending_review` or `confirmed` |
| `purchased_by_user_id` | UUID | — | Filter by purchasing user |
| `purchased_by_crew_member_id` | UUID | — | Filter by purchasing crew member |
| `date_from` | string | — | Filter from date (YYYY-MM-DD, inclusive) |
| `date_to` | string | — | Filter to date (YYYY-MM-DD, inclusive) |
| `has_receipt` | boolean | — | Filter by receipt status |
| `is_recurring_instance` | boolean | — | Filter recurring entries |
| `search` | string | — | Search in `vendor_name` and `notes` |

#### Example Request

```bash
curl "https://api.lead360.app/api/v1/financial/entries?classification=operating_expense&date_from=2026-01-01&page=1&limit=20" \
  -H "Authorization: Bearer <TOKEN>"
```

#### Response 200

```json
{
  "data": [ /* array of enriched entry objects */ ],
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  },
  "summary": {
    "total_expenses": 28450.75,
    "total_income": 5200.00,
    "total_tax": 2150.50,
    "entry_count": 142
  }
}
```

**Important**: The `summary` block reflects the **full filtered result set**, not just the current page.

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid query parameter value |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role permissions |

---

### 3. GET /financial/entries/pending

**List entries with `submission_status = pending_review` for the approval queue.**

- **URL**: `GET /api/v1/financial/entries/pending`
- **Auth**: Required (JWT)
- **Roles**: Owner, Admin, Manager, Bookkeeper
- **Employee**: Returns 403

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max: 100) |
| `submitted_by_user_id` | UUID | — | Filter by submitter |
| `date_from` | string | — | Filter from date (YYYY-MM-DD) |
| `date_to` | string | — | Filter to date (YYYY-MM-DD) |

#### Example Request

```bash
curl "https://api.lead360.app/api/v1/financial/entries/pending?page=1&limit=20" \
  -H "Authorization: Bearer <TOKEN>"
```

#### Response 200

```json
{
  "data": [ /* array of enriched entry objects — all with submission_status=pending_review */ ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  },
  "summary": {
    "total_expenses": 3250.00,
    "total_income": 0,
    "total_tax": 245.00,
    "entry_count": 12
  }
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid JWT |
| 403 | Employee role — access denied |

---

### 4. GET /financial/entries/export

**Export filtered financial entries as CSV file download.**

- **URL**: `GET /api/v1/financial/entries/export`
- **Auth**: Required (JWT)
- **Roles**: Owner, Admin, Bookkeeper
- **Manager/Employee**: Returns 403
- **Limit**: 10,000 rows maximum

#### Query Parameters

Same as [GET /financial/entries](#2-get-financialentries) (all filter parameters apply, pagination is ignored).

#### Example Request

```bash
curl "https://api.lead360.app/api/v1/financial/entries/export?date_from=2026-01-01&date_to=2026-03-31" \
  -H "Authorization: Bearer <TOKEN>" \
  -o expenses.csv
```

#### Response 200

```
Content-Type: text/csv
Content-Disposition: attachment; filename="expenses-2026-03-20.csv"
```

**CSV Headers**:
```
Date,Time,Type,Category,Classification,Project,Task,Supplier,Vendor Name,Amount,Tax Amount,Payment Method,Payment Account,Purchased By,Submitted By,Status,Notes,Created At
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Export limit exceeded (> 10,000 rows). Apply date filters. |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role permissions (Manager or Employee) |

---

### 5. GET /financial/entries/:id

**Get a single financial entry with enriched response.**

- **URL**: `GET /api/v1/financial/entries/:id`
- **Auth**: Required (JWT)
- **Roles**: Owner, Admin, Manager, Bookkeeper, Employee
- **Employee scoping**: Can only view own entries (403 if accessing another user's entry)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Entry ID |

#### Example Request

```bash
curl "https://api.lead360.app/api/v1/financial/entries/550e8400-e29b-41d4-a716-446655440010" \
  -H "Authorization: Bearer <TOKEN>"
```

#### Response 200

Returns the enriched response shape (see [Enriched Response Shape](#enriched-response-shape)).

#### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid JWT |
| 403 | Employee accessing another user's entry |
| 404 | Entry not found |

---

### 6. PATCH /financial/entries/:id

**Update a financial entry.**

- **URL**: `PATCH /api/v1/financial/entries/:id`
- **Auth**: Required (JWT)
- **Roles**: Owner, Admin, Manager, Bookkeeper, Employee
- **Employee restrictions**: Can only edit own entries in `pending_review` status

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Entry ID |

#### Request Body

All fields are optional. Only provided fields are updated.

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `category_id` | UUID | Must belong to tenant, active | Category |
| `entry_type` | string | `expense` or `income` | Type |
| `amount` | number | > 0, max 2 decimal places | Amount |
| `tax_amount` | number | >= 0, < resulting amount | Tax |
| `entry_date` | string | YYYY-MM-DD, not future | Date |
| `entry_time` | string | HH:MM:SS, max 8 chars | Time |
| `vendor_name` | string | Max 200 chars, nullable | Vendor |
| `supplier_id` | UUID or null | Must belong to tenant, active | Supplier |
| `payment_method` | string | See enum | Payment method |
| `payment_method_registry_id` | UUID or null | Must belong to tenant, active | Registry auto-copy |
| `purchased_by_user_id` | UUID or null | Mutually exclusive with crew member | Purchaser user |
| `purchased_by_crew_member_id` | UUID or null | Mutually exclusive with user | Purchaser crew member |
| `notes` | string | Max 2000 chars | Notes |

**Not editable via PATCH**: `project_id`, `task_id`, `submission_status`, `is_recurring_instance`, `recurring_rule_id`, `created_by_user_id`. Use approve/reject/resubmit endpoints for status changes.

#### Example Request

```bash
curl -X PATCH "https://api.lead360.app/api/v1/financial/entries/550e8400-e29b-41d4-a716-446655440010" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500.00,
    "notes": "Updated amount after receipt correction"
  }'
```

#### Response 200

Returns the enriched response shape.

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error (tax >= amount, both purchased_by provided, future date) |
| 401 | Missing or invalid JWT |
| 403 | Employee editing another user's entry or confirmed entry |
| 404 | Entry not found or referenced entity not found |

---

### 7. DELETE /financial/entries/:id

**Hard delete a financial entry.**

- **URL**: `DELETE /api/v1/financial/entries/:id`
- **Auth**: Required (JWT)
- **Roles**: Owner, Admin (any status), Employee (own + pending_review only)
- **Manager/Bookkeeper**: Always returns 403

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Entry ID |

#### Example Request

```bash
curl -X DELETE "https://api.lead360.app/api/v1/financial/entries/550e8400-e29b-41d4-a716-446655440010" \
  -H "Authorization: Bearer <TOKEN>"
```

#### Response 200

```json
{
  "message": "Entry deleted successfully"
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid JWT |
| 403 | Manager/Bookkeeper attempt, or Employee accessing another user's entry, or Employee deleting non-pending entry |
| 404 | Entry not found |

---

### 8. POST /financial/entries/:id/approve

**Approve a pending_review entry — sets submission_status to confirmed.**

- **URL**: `POST /api/v1/financial/entries/:id/approve`
- **Auth**: Required (JWT)
- **Roles**: Owner, Admin, Manager, Bookkeeper

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Entry ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `notes` | string | No | Max 500 chars | Internal approval note |

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/financial/entries/550e8400-e29b-41d4-a716-446655440010/approve" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "notes": "Verified receipt matches amount" }'
```

#### Response 200

Returns the enriched response shape with `submission_status: "confirmed"`.

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Entry is not in pending_review status (already confirmed) |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role permissions (Employee) |
| 404 | Entry not found |

---

### 9. POST /financial/entries/:id/reject

**Reject a pending_review entry — attaches rejection reason and metadata.**

The entry **stays in `pending_review` status** — it is NOT deleted. The rejection metadata is visible in the entry response.

- **URL**: `POST /api/v1/financial/entries/:id/reject`
- **Auth**: Required (JWT)
- **Roles**: Owner, Admin, Manager, Bookkeeper

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Entry ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `rejection_reason` | string | **Yes** | Non-empty, max 500 chars | Reason for rejection |

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/financial/entries/550e8400-e29b-41d4-a716-446655440010/reject" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "rejection_reason": "Receipt is illegible. Please re-upload a clearer photo." }'
```

#### Response 200

Returns the enriched response shape with:
- `submission_status: "pending_review"` (unchanged)
- `rejection_reason`: populated
- `rejected_by_user_id`: populated
- `rejected_by_name`: populated
- `rejected_at`: populated

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Entry is not in pending_review status, or rejection_reason empty |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role permissions (Employee) |
| 404 | Entry not found |

---

### 10. POST /financial/entries/:id/resubmit

**Resubmit a rejected entry — clears rejection fields and optionally updates entry data.**

- **URL**: `POST /api/v1/financial/entries/:id/resubmit`
- **Auth**: Required (JWT)
- **Roles**: Owner, Admin, Manager, Bookkeeper, Employee
- **Employee scoping**: Can only resubmit own entries

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Entry ID |

#### Request Body

All fields are optional. Provided fields are applied as updates before clearing rejection.

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `category_id` | UUID | Must belong to tenant, active | Updated category |
| `entry_type` | string | `expense` or `income` | Updated type |
| `amount` | number | > 0, max 2 decimal places | Updated amount |
| `tax_amount` | number | >= 0, < resulting amount | Updated tax |
| `entry_date` | string | YYYY-MM-DD, not future | Updated date |
| `entry_time` | string | HH:MM:SS, max 8 chars | Updated time |
| `vendor_name` | string | Max 200 chars | Updated vendor |
| `supplier_id` | UUID or null | Must belong to tenant, active | Updated supplier |
| `payment_method` | string | See enum | Updated payment method |
| `payment_method_registry_id` | UUID or null | Must belong to tenant, active | Updated registry |
| `purchased_by_user_id` | UUID or null | Mutually exclusive with crew member | Updated purchaser user |
| `purchased_by_crew_member_id` | UUID or null | Mutually exclusive with user | Updated purchaser crew member |
| `notes` | string | Max 2000 chars | Updated notes |

#### Example Request

```bash
curl -X POST "https://api.lead360.app/api/v1/financial/entries/550e8400-e29b-41d4-a716-446655440010/resubmit" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 475.00,
    "notes": "Corrected amount per receipt"
  }'
```

#### Response 200

Returns the enriched response shape with:
- `submission_status: "pending_review"` (unchanged — re-enters clean pending state)
- `rejection_reason: null` (cleared)
- `rejected_by_user_id: null` (cleared)
- `rejected_by_name: null` (cleared)
- `rejected_at: null` (cleared)

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Entry was not rejected (no `rejected_at`), or entry not in pending_review status, or validation error |
| 401 | Missing or invalid JWT |
| 403 | Employee accessing another user's entry |
| 404 | Entry not found or referenced entity not found |

---

## Business Rules

### Entry Creation

- **BR-06**: Employee creates always forced to `pending_review` — non-negotiable, request body value ignored
- **BR-07**: Owner/Admin/Manager/Bookkeeper default to `confirmed`, can explicitly opt for `pending_review`
- `payment_method_registry_id` provided → `payment_method` auto-populated from registry type, overrides any client-provided value
- `purchased_by_user_id` and `purchased_by_crew_member_id` are mutually exclusive → 400 if both provided
- `tax_amount >= amount` → 400
- `entry_date` cannot be in the future → 400
- `supplier_id` provided → `supplier.total_spend` updated after creation

### Entry Update

- **BR-13**: Employee can only edit own entries in `pending_review` status (403 otherwise)
- Privileged roles can edit any entry in any status
- Tax vs amount validation applied on **resulting state** (existing + update combined)
- Purchased-by mutual exclusion applied on **resulting state**
- Supplier spend recalculated when supplier changes or amount changes

### Entry Deletion

- **BR-14**: Managers and Bookkeepers **cannot** delete entries (403 always)
- **BR-15**: Only Owner/Admin can delete confirmed entries
- Employee can delete own `pending_review` entries only
- Supplier spend decremented on deletion

### Pending Workflow

- **BR-17**: Only `pending_review` entries can be approved (400 otherwise)
- **BR-18**: Only `pending_review` entries can be rejected (400 otherwise)
- **BR-19**: Rejected entry stays `pending_review` — status is NOT changed
- **BR-20**: Only entries with `rejected_at` populated can be resubmitted (400 otherwise)
- **BR-21**: Resubmit clears `rejection_reason`, `rejected_by_user_id`, `rejected_at`
- **BR-22**: After resubmit, `submission_status` stays `pending_review`
- **BR-23**: On approval, rejection fields are preserved (audit trail)

### Export

- **BR-24**: Maximum 10,000 rows — exceeding returns 400
- **BR-25**: No pagination — full result set exported
- Same filter logic as GET /financial/entries (shared filter builder)

---

## Enums Reference

### entry_type
| Value | Description |
|-------|-------------|
| `expense` | Money out |
| `income` | Money in |

### payment_method
| Value | Description |
|-------|-------------|
| `cash` | Cash payment |
| `check` | Check/cheque |
| `bank_transfer` | Bank transfer |
| `venmo` | Venmo |
| `zelle` | Zelle |
| `credit_card` | Credit card |
| `debit_card` | Debit card |
| `ACH` | ACH transfer |

### submission_status
| Value | Description |
|-------|-------------|
| `pending_review` | Awaiting approval from privileged role |
| `confirmed` | Confirmed and posted |

### classification (category join)
| Value | Description |
|-------|-------------|
| `cost_of_goods_sold` | Direct project costs |
| `operating_expense` | Business overhead |

### category_type
| Value |
|-------|
| `labor` |
| `material` |
| `subcontractor` |
| `equipment` |
| `insurance` |
| `fuel` |
| `utilities` |
| `office` |
| `marketing` |
| `taxes` |
| `tools` |
| `other` |

---

## Error Response Format

All errors follow the platform standard format:

```json
{
  "statusCode": 400,
  "errorCode": "SERVER_INTERNAL_ERROR",
  "message": "Descriptive error message",
  "error": "Bad Request",
  "timestamp": "2026-03-20T12:00:00.000Z",
  "path": "/api/v1/financial/entries",
  "requestId": "req_abc123"
}
```

### Common Error Codes

| Status | When |
|--------|------|
| 400 | Validation error, business rule violation |
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role permissions or ownership violation |
| 404 | Entry, category, supplier, project, task, payment method, user, or crew member not found |
