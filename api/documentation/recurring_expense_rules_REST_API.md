# Recurring Expense Rules — REST API Documentation

**STATUS: VERIFIED BY DOCUMENTATION AGENT — 2026-03-23**
**Module:** Financial (F-06 — Recurring Expense Engine)
**Source:** Documented from the real codebase, not contract assumptions

---

## Overview

The Recurring Expense Engine automates repetitive financial entries (rent, insurance premiums, subscriptions, utility bills, etc.). Tenants create rules that define the amount, frequency, and schedule. A nightly BullMQ scheduler generates `financial_entry` records for due rules. Rules support pause/resume, skip, manual trigger, and auto-completion when a recurrence count or end date is reached.

---

## Base URL

- **Production:** `https://api.lead360.app`
- **Local dev:** `http://localhost:8000`

All endpoints use the global prefix `/api/v1/` followed by `/financial/recurring-rules`.

**Full base path:** `/api/v1/financial/recurring-rules`

---

## Authentication

All endpoints require a valid JWT bearer token:

```
Authorization: Bearer <token>
```

Token is obtained from `POST /api/v1/auth/login`.

The `tenant_id` and `user_id` are extracted from the JWT — they are **never** accepted from the request body or query parameters.

---

## Endpoints

### 1. GET /financial/recurring-rules/preview

**Description:** Preview all upcoming recurring expense obligations within a given day window. Read-only — never creates entries.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| days | integer | Yes | Must be 30, 60, or 90 | Preview window in days |

**Success Response:** `200 OK`

```json
{
  "period_days": 30,
  "total_obligations": 3700.00,
  "occurrences": [
    {
      "rule_id": "550e8400-e29b-41d4-a716-446655440000",
      "rule_name": "Monthly Insurance Premium",
      "amount": 1850,
      "tax_amount": null,
      "category_name": "Insurance",
      "due_date": "2026-04-01",
      "frequency": "monthly",
      "supplier_name": "State Farm",
      "payment_method_nickname": "Chase Business Visa"
    },
    {
      "rule_id": "660e8400-e29b-41d4-a716-446655440001",
      "rule_name": "Office Rent",
      "amount": 1850,
      "tax_amount": null,
      "category_name": "Rent",
      "due_date": "2026-04-15",
      "frequency": "monthly",
      "supplier_name": null,
      "payment_method_nickname": null
    }
  ]
}
```

**Notes:**
- Occurrences are sorted by `due_date` ascending
- Respects `recurrence_count` and `end_date` boundaries
- Safety cap: max 365 occurrences per rule to prevent infinite loops
- `total_obligations` is rounded to 2 decimal places

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | `days` not provided or not one of 30, 60, 90 |
| 401 | Missing or invalid token |
| 403 | Insufficient role |

**Example:**

```bash
curl -s "http://localhost:8000/api/v1/financial/recurring-rules/preview?days=30" \
  -H "Authorization: Bearer <token>"
```

---

### 2. GET /financial/recurring-rules

**Description:** List all recurring expense rules with pagination, filtering, sorting, and a monthly obligation summary.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Required | Default | Validation | Description |
|-------|------|----------|---------|------------|-------------|
| status | enum | No | `active` | `active`, `paused`, `completed`, `cancelled` | Filter by rule status |
| category_id | string (uuid) | No | — | Valid UUID | Filter by category |
| frequency | enum | No | — | `daily`, `weekly`, `monthly`, `quarterly`, `annual` | Filter by frequency |
| page | integer | No | 1 | min: 1 | Page number |
| limit | integer | No | 20 | min: 1, max: 100 | Items per page |
| sort_by | enum | No | `next_due_date` | `next_due_date`, `amount`, `name`, `created_at` | Sort field |
| sort_order | enum | No | `asc` | `asc`, `desc` | Sort direction |

**Success Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "name": "Monthly Insurance Premium",
      "description": "General liability insurance",
      "category_id": "cat-uuid",
      "amount": "1850.00",
      "tax_amount": null,
      "supplier_id": null,
      "vendor_name": "State Farm",
      "payment_method_registry_id": null,
      "frequency": "monthly",
      "interval": 1,
      "day_of_month": 1,
      "day_of_week": null,
      "start_date": "2026-01-01T00:00:00.000Z",
      "end_date": null,
      "recurrence_count": null,
      "occurrences_generated": 3,
      "next_due_date": "2026-04-01T00:00:00.000Z",
      "auto_confirm": true,
      "notes": null,
      "status": "active",
      "last_generated_at": "2026-03-01T02:00:15.000Z",
      "last_generated_entry_id": "entry-uuid",
      "created_by_user_id": "user-uuid",
      "updated_by_user_id": null,
      "created_at": "2026-01-01T10:00:00.000Z",
      "updated_at": "2026-03-01T02:00:15.000Z",
      "category": { "id": "cat-uuid", "name": "Insurance", "type": "overhead" },
      "supplier": null,
      "payment_method": null
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  },
  "summary": {
    "total_active_rules": 5,
    "monthly_obligation": 4750.00
  }
}
```

**Notes:**
- `amount` and `tax_amount` are returned as Decimal strings from Prisma
- `summary.monthly_obligation` is calculated across ALL active rules for the tenant (not just the current page)
- When `status` is not provided, defaults to filtering `active` rules only
- Includes enriched relation data: `category`, `supplier`, `payment_method`

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Invalid query parameter value |
| 401 | Missing or invalid token |
| 403 | Insufficient role |

**Example:**

```bash
curl -s "http://localhost:8000/api/v1/financial/recurring-rules?status=active&page=1&limit=10&sort_by=amount&sort_order=desc" \
  -H "Authorization: Bearer <token>"
```

---

### 3. POST /financial/recurring-rules

**Description:** Create a new recurring expense rule.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Default | Description |
|-------|------|----------|------------|---------|-------------|
| name | string | Yes | max 200 chars, non-empty | — | Human-readable rule name |
| description | string | No | — | null | Internal description |
| category_id | string (uuid) | Yes | Must exist in tenant, must be active | — | FK to `financial_category` |
| amount | number | Yes | min: 0.01, max 2 decimal places | — | Fixed amount per occurrence |
| tax_amount | number | No | min: 0, max 2 decimal places, must be < amount | null | Tax amount per occurrence |
| supplier_id | string (uuid) | No | Must exist in tenant | null | FK to `supplier` |
| vendor_name | string | No | max 200 chars | null | Free-text vendor fallback |
| payment_method_registry_id | string (uuid) | No | Must exist in tenant | null | FK to `payment_method_registry` |
| frequency | enum | Yes | `daily`, `weekly`, `monthly`, `quarterly`, `annual` | — | Recurrence frequency |
| interval | integer | No | min: 1, max: 12 | 1 | Every N frequencies |
| day_of_month | integer | No | min: 1, max: 28 | Auto-populated from start_date for monthly/quarterly/annual | Preferred day of month |
| day_of_week | integer | No | min: 0, max: 6 (0=Sunday) | Auto-populated from start_date for weekly | Preferred day of week |
| start_date | string (date) | Yes | YYYY-MM-DD, must be today or future | — | First occurrence date |
| end_date | string (date) | No | YYYY-MM-DD, must be after start_date | null | Optional end date |
| recurrence_count | integer | No | min: 1 | null | Max occurrences before auto-complete |
| auto_confirm | boolean | No | — | true | If true, entries are `confirmed`; if false, `pending_review` |
| notes | string | No | — | null | Notes carried into generated entries |

**Validation Rules (in order):**
1. Max 100 active rules per tenant
2. `category_id` must belong to tenant and be active
3. `supplier_id` (if provided) must belong to tenant
4. `payment_method_registry_id` (if provided) must belong to tenant
5. `start_date` must be today or in the future
6. `end_date` must be after `start_date` (if both provided)
7. `tax_amount` must be less than `amount` (if both provided)

**Auto-population:**
- For `monthly`, `quarterly`, `annual` frequencies: if `day_of_month` is not provided, it is auto-populated from `start_date.getDate()`
- For `weekly` frequency: if `day_of_week` is not provided, it is auto-populated from `start_date.getDay()`
- `next_due_date` is set to `start_date`
- `status` is set to `active`

**Success Response:** `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "name": "Monthly Insurance Premium",
  "description": null,
  "category_id": "cat-uuid",
  "amount": "1850.00",
  "tax_amount": null,
  "supplier_id": null,
  "vendor_name": "State Farm",
  "payment_method_registry_id": null,
  "frequency": "monthly",
  "interval": 1,
  "day_of_month": 1,
  "day_of_week": null,
  "start_date": "2026-04-01T00:00:00.000Z",
  "end_date": null,
  "recurrence_count": null,
  "occurrences_generated": 0,
  "next_due_date": "2026-04-01T00:00:00.000Z",
  "auto_confirm": true,
  "notes": null,
  "status": "active",
  "last_generated_at": null,
  "last_generated_entry_id": null,
  "created_by_user_id": "user-uuid",
  "updated_by_user_id": null,
  "created_at": "2026-03-23T10:00:00.000Z",
  "updated_at": "2026-03-23T10:00:00.000Z",
  "category": { "id": "cat-uuid", "name": "Insurance", "type": "overhead" },
  "supplier": null,
  "payment_method": null
}
```

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Validation error: start_date in past, day_of_month > 28, tax_amount >= amount, end_date <= start_date, max rules exceeded, invalid FK |
| 401 | Missing or invalid token |
| 403 | Insufficient role |

**Example:**

```bash
curl -X POST http://localhost:8000/api/v1/financial/recurring-rules \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Monthly Insurance Premium",
    "category_id": "<uuid>",
    "amount": 1850.00,
    "frequency": "monthly",
    "start_date": "2026-04-01",
    "auto_confirm": true
  }'
```

---

### 4. GET /financial/recurring-rules/:id

**Description:** Get a single recurring expense rule with enriched relations, last generated entry info, and next 3 occurrence date preview.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Param | Type | Validation | Description |
|-------|------|------------|-------------|
| id | string (uuid) | ParseUUIDPipe | Rule UUID |

**Success Response:** `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "name": "Monthly Insurance Premium",
  "description": null,
  "category_id": "cat-uuid",
  "amount": "1850.00",
  "tax_amount": null,
  "supplier_id": null,
  "vendor_name": "State Farm",
  "payment_method_registry_id": null,
  "frequency": "monthly",
  "interval": 1,
  "day_of_month": 1,
  "day_of_week": null,
  "start_date": "2026-01-01T00:00:00.000Z",
  "end_date": null,
  "recurrence_count": null,
  "occurrences_generated": 3,
  "next_due_date": "2026-04-01T00:00:00.000Z",
  "auto_confirm": true,
  "notes": null,
  "status": "active",
  "last_generated_at": "2026-03-01T02:00:15.000Z",
  "last_generated_entry_id": "entry-uuid",
  "created_by_user_id": "user-uuid",
  "updated_by_user_id": null,
  "created_at": "2026-01-01T10:00:00.000Z",
  "updated_at": "2026-03-01T02:00:15.000Z",
  "category": { "id": "cat-uuid", "name": "Insurance", "type": "overhead" },
  "supplier": null,
  "payment_method": null,
  "last_generated_entry": {
    "id": "entry-uuid",
    "amount": "1850.00",
    "entry_date": "2026-03-01T00:00:00.000Z",
    "submission_status": "confirmed"
  },
  "next_occurrence_preview": [
    "2026-04-01",
    "2026-05-01",
    "2026-06-01"
  ]
}
```

**Notes:**
- `last_generated_entry` is `null` if no entries have been generated yet
- `next_occurrence_preview` contains up to 3 upcoming dates as YYYY-MM-DD strings
- Preview respects `end_date` and `recurrence_count` boundaries — may return fewer than 3 dates

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Invalid UUID format |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Rule not found (or belongs to different tenant) |

**Example:**

```bash
curl -s "http://localhost:8000/api/v1/financial/recurring-rules/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 5. PATCH /financial/recurring-rules/:id

**Description:** Update a recurring expense rule. Cancelled and completed rules cannot be updated.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Param | Type | Validation | Description |
|-------|------|------------|-------------|
| id | string (uuid) | ParseUUIDPipe | Rule UUID |

**Request Body:** All fields are optional (partial update). Same fields as POST except `start_date` is excluded.

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| name | string | max 200 chars | Rule name |
| description | string | — | Description |
| category_id | string (uuid) | Must exist in tenant, must be active | FK to `financial_category` |
| amount | number | min: 0.01, max 2 decimal places | Amount per occurrence |
| tax_amount | number | min: 0, must be < effective amount | Tax amount |
| supplier_id | string (uuid) | Must exist in tenant | FK to `supplier` |
| vendor_name | string | max 200 chars | Free-text vendor |
| payment_method_registry_id | string (uuid) | Must exist in tenant | FK to `payment_method_registry` |
| frequency | enum | `daily`, `weekly`, `monthly`, `quarterly`, `annual` | Frequency |
| interval | integer | min: 1, max: 12 | Interval multiplier |
| day_of_month | integer | min: 1, max: 28 | Preferred day |
| day_of_week | integer | min: 0, max: 6 | Preferred weekday |
| end_date | string (date) | Must be after start_date | End date |
| recurrence_count | integer | min: 1 | Max occurrences |
| auto_confirm | boolean | — | Auto-confirm entries |
| notes | string | — | Notes |

**Schedule recalculation:** If any of these fields change: `frequency`, `interval`, `day_of_month`, `day_of_week`, `amount` — the `next_due_date` is recalculated from the current `next_due_date`. If the recalculated date is in the past, it advances until a future date is found.

**Success Response:** `200 OK` — Returns the updated rule with enriched relations (same shape as GET single).

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Validation error, rule is cancelled/completed, invalid FK, end_date <= start_date, tax_amount >= amount |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Rule not found |

**Example:**

```bash
curl -X PATCH http://localhost:8000/api/v1/financial/recurring-rules/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2000.00,
    "notes": "Rate increased for 2026"
  }'
```

---

### 6. DELETE /financial/recurring-rules/:id

**Description:** Cancel a recurring expense rule (soft delete). Sets status to `cancelled`. Does NOT hard-delete the record. Previously generated entries are unaffected.

**Roles:** Owner, Admin

**Path Parameters:**

| Param | Type | Validation | Description |
|-------|------|------------|-------------|
| id | string (uuid) | ParseUUIDPipe | Rule UUID |

**Success Response:** `200 OK` — Returns the updated rule with `status: "cancelled"`.

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Rule is already cancelled, or rule is completed |
| 401 | Missing or invalid token |
| 403 | Insufficient role (only Owner and Admin can cancel) |
| 404 | Rule not found |

**Example:**

```bash
curl -X DELETE http://localhost:8000/api/v1/financial/recurring-rules/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

---

### 7. POST /financial/recurring-rules/:id/pause

**Description:** Pause an active recurring expense rule. Preserves `next_due_date` — when resumed, the rule picks up where it left off. If `next_due_date` is in the past at resume time, `resume()` will advance it.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Param | Type | Validation | Description |
|-------|------|------------|-------------|
| id | string (uuid) | ParseUUIDPipe | Rule UUID |

**Request Body:** None

**Success Response:** `200 OK` — Returns the updated rule with `status: "paused"`.

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Only active rules can be paused |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Rule not found |

**Example:**

```bash
curl -X POST http://localhost:8000/api/v1/financial/recurring-rules/550e8400-e29b-41d4-a716-446655440000/pause \
  -H "Authorization: Bearer <token>"
```

---

### 8. POST /financial/recurring-rules/:id/resume

**Description:** Resume a paused recurring expense rule. If `next_due_date` is in the past, advances to the next future occurrence. Does NOT back-generate missed entries.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Param | Type | Validation | Description |
|-------|------|------------|-------------|
| id | string (uuid) | ParseUUIDPipe | Rule UUID |

**Request Body:** None

**Success Response:** `200 OK` — Returns the updated rule with `status: "active"` and potentially updated `next_due_date`.

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Only paused rules can be resumed |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Rule not found |

**Example:**

```bash
curl -X POST http://localhost:8000/api/v1/financial/recurring-rules/550e8400-e29b-41d4-a716-446655440000/resume \
  -H "Authorization: Bearer <token>"
```

---

### 9. POST /financial/recurring-rules/:id/trigger

**Description:** Manually trigger entry generation for a recurring rule. Enqueues a high-priority job on the `recurring-expense-generation` BullMQ queue. The rule must not be cancelled or completed.

**Roles:** Owner, Admin

**Path Parameters:**

| Param | Type | Validation | Description |
|-------|------|------------|-------------|
| id | string (uuid) | ParseUUIDPipe | Rule UUID |

**Request Body:** None

**Success Response:** `202 Accepted`

```json
{
  "message": "Entry generation triggered",
  "rule_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Notes:**
- This is asynchronous — the entry is not created immediately
- The job runs with priority 1 (highest), 3 attempts with exponential backoff starting at 10 seconds
- Paused rules CAN be manually triggered (only cancelled and completed are blocked)

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Rule is cancelled or completed |
| 401 | Missing or invalid token |
| 403 | Insufficient role (only Owner and Admin) |
| 404 | Rule not found |

**Example:**

```bash
curl -X POST http://localhost:8000/api/v1/financial/recurring-rules/550e8400-e29b-41d4-a716-446655440000/trigger \
  -H "Authorization: Bearer <token>"
```

---

### 10. POST /financial/recurring-rules/:id/skip

**Description:** Skip the next occurrence of an active recurring rule. Advances `next_due_date` by one occurrence without generating an entry. Skipping counts toward `recurrence_count`. Termination conditions are checked after every skip.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Param | Type | Validation | Description |
|-------|------|------------|-------------|
| id | string (uuid) | ParseUUIDPipe | Rule UUID |

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| reason | string | No | max 500 chars | Reason for skipping |

**Success Response:** `200 OK` — Returns the updated rule with advanced `next_due_date` and incremented `occurrences_generated`. Status may change to `completed` if a termination condition is met.

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Only active rules can skip occurrences |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Rule not found |

**Example:**

```bash
curl -X POST http://localhost:8000/api/v1/financial/recurring-rules/550e8400-e29b-41d4-a716-446655440000/skip \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Holiday month — no payment needed" }'
```

---

### 11. GET /financial/recurring-rules/:id/history

**Description:** List financial entries generated by a specific recurring rule. Supports pagination and date filtering. Entries are ordered by `entry_date` descending.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Param | Type | Validation | Description |
|-------|------|------------|-------------|
| id | string (uuid) | ParseUUIDPipe | Rule UUID |

**Query Parameters:**

| Param | Type | Required | Default | Validation | Description |
|-------|------|----------|---------|------------|-------------|
| page | integer | No | 1 | min: 1 | Page number |
| limit | integer | No | 20 | min: 1, max: 100 | Items per page |
| date_from | string (date) | No | — | YYYY-MM-DD | Filter entries from date |
| date_to | string (date) | No | — | YYYY-MM-DD | Filter entries to date |

**Success Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "entry-uuid-003",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "project_id": null,
      "task_id": null,
      "category_id": "cat-uuid",
      "entry_type": "expense",
      "amount": "1850.00",
      "entry_date": "2026-03-01T00:00:00.000Z",
      "vendor_name": "State Farm",
      "notes": null,
      "has_receipt": false,
      "submission_status": "confirmed",
      "is_recurring_instance": true,
      "recurring_rule_id": "rule-uuid",
      "created_by_user_id": "user-uuid",
      "created_at": "2026-03-01T02:00:15.000Z",
      "updated_at": "2026-03-01T02:00:15.000Z",
      "category": { "id": "cat-uuid", "name": "Insurance", "type": "overhead" }
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

**Errors:**

| Status | Description |
|--------|-------------|
| 400 | Invalid query parameters or UUID |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Rule not found |

**Example:**

```bash
curl -s "http://localhost:8000/api/v1/financial/recurring-rules/550e8400-e29b-41d4-a716-446655440000/history?page=1&limit=10&date_from=2026-01-01&date_to=2026-03-31" \
  -H "Authorization: Bearer <token>"
```

---

## Enums

### recurring_frequency

| Value | Description |
|-------|-------------|
| `daily` | Every N days |
| `weekly` | Every N weeks (N * 7 days) |
| `monthly` | Every N months |
| `quarterly` | Every N quarters (N * 3 months) |
| `annual` | Every N years |

### recurring_rule_status

| Value | Description |
|-------|-------------|
| `active` | Rule is live — scheduler will process it when due |
| `paused` | Rule is paused — scheduler skips it |
| `completed` | Rule auto-completed (recurrence_count or end_date reached) |
| `cancelled` | Rule soft-deleted by user |

---

## Data Model

### recurring_expense_rule

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | VARCHAR(36) | No | uuid() | Primary key |
| tenant_id | VARCHAR(36) | No | — | FK to tenant |
| name | VARCHAR(200) | No | — | Rule name |
| description | TEXT | Yes | null | Internal description |
| category_id | VARCHAR(36) | No | — | FK to financial_category |
| amount | DECIMAL(12,2) | No | — | Fixed amount per occurrence |
| tax_amount | DECIMAL(10,2) | Yes | null | Tax per occurrence |
| supplier_id | VARCHAR(36) | Yes | null | FK to supplier |
| vendor_name | VARCHAR(200) | Yes | null | Free-text vendor |
| payment_method_registry_id | VARCHAR(36) | Yes | null | FK to payment_method_registry |
| frequency | ENUM | No | — | daily, weekly, monthly, quarterly, annual |
| interval | INT | No | 1 | Every N frequencies |
| day_of_month | TINYINT | Yes | null | Preferred day 1-28 |
| day_of_week | TINYINT | Yes | null | Preferred weekday 0-6 |
| start_date | DATE | No | — | Rule activation date |
| end_date | DATE | Yes | null | Optional end boundary |
| recurrence_count | INT | Yes | null | Max occurrences |
| occurrences_generated | INT | No | 0 | Counter |
| next_due_date | DATE | No | — | Next scheduled occurrence |
| auto_confirm | BOOLEAN | No | true | Auto-confirm entries |
| notes | TEXT | Yes | null | Carried into entries |
| status | ENUM | No | active | active, paused, completed, cancelled |
| last_generated_at | DATETIME | Yes | null | Timestamp of last generation |
| last_generated_entry_id | VARCHAR(36) | Yes | null | ID of last generated entry |
| created_by_user_id | VARCHAR(36) | No | — | FK to user |
| updated_by_user_id | VARCHAR(36) | Yes | null | FK to user |
| created_at | DATETIME | No | now() | Creation timestamp |
| updated_at | DATETIME | No | auto | Last update timestamp |

**Indexes:**
- `(tenant_id, status)`
- `(tenant_id, next_due_date)`
- `(tenant_id, status, next_due_date)` — composite for scheduler query
- `(tenant_id, category_id)`
- `(tenant_id, created_at)`

**Relations:**
- `tenant` → tenant.id
- `category` → financial_category.id
- `supplier` → supplier.id (optional)
- `payment_method` → payment_method_registry.id (optional)
- `created_by` → user.id
- `updated_by` → user.id (optional)
- `generated_entries` → financial_entry[] (reverse via `recurring_rule_id`)

---

## Schedule Calculation Logic

The `calculateNextDueDate()` method is a **pure function** (no database calls, no side effects). It uses `date-fns` for date arithmetic.

### Daily
```
next = addDays(currentDueDate, interval)
```
Example: interval=3 → every 3 days.

### Weekly
```
next = addDays(currentDueDate, interval * 7)
if (dayOfWeek != null): advance to next occurrence of that weekday
```
If the advanced date already falls on the target weekday, it is returned unchanged.

### Monthly
```
next = addMonths(currentDueDate, interval)
if (dayOfMonth != null): snap to min(dayOfMonth, daysInMonth)
else: snap to min(currentDueDate.getDate(), daysInMonth)
```
**End-of-month snapping examples:**
- Jan 31 + 1 month → Feb 28 (non-leap) or Feb 29 (leap)
- Jan 31 + 1 month (April) → Apr 30
- The day never overflows to the next month

### Quarterly
```
next = addMonths(currentDueDate, interval * 3)
// Same dayOfMonth snapping as monthly
```

### Annual
```
next = addYears(currentDueDate, interval)
// Same dayOfMonth snapping as monthly
```
**Leap year example:** Feb 29, 2028 + 1 year → Feb 28, 2029

---

## Monthly Obligation Normalization

The `findAll()` endpoint calculates `summary.monthly_obligation` across all active rules using these formulas:

| Frequency | Formula |
|-----------|---------|
| daily | `amount * 30 / interval` |
| weekly | `amount * (30 / (interval * 7))` |
| monthly | `amount / interval` |
| quarterly | `amount / (interval * 3)` |
| annual | `amount / (interval * 12)` |

Result is rounded to 2 decimal places.

---

## Business Rules

1. **BR-1:** Maximum 100 active recurring rules per tenant
2. **BR-2:** `start_date` must be today or in the future
3. **BR-3:** Resume after pause does NOT back-generate missed entries — advances to next future date
4. **BR-4:** `day_of_month` is auto-populated from `start_date` for monthly/quarterly/annual when not provided
5. **BR-5:** `day_of_week` is auto-populated from `start_date` for weekly when not provided
6. **BR-6:** Skipping counts toward `recurrence_count` — the skip increments `occurrences_generated`
7. **BR-7:** Termination conditions checked after every generation and skip: `end_date` exceeded or `recurrence_count` reached → status = `completed`
8. **BR-8:** Cancellation (DELETE) is a soft delete — sets status to `cancelled`. Previously generated entries are unaffected
9. **BR-9:** `processRule()` generates ONE entry per invocation (the next occurrence), not all past-due entries
10. **BR-10:** `auto_confirm = true` → entry `submission_status = confirmed`; `auto_confirm = false` → `pending_review`
11. **BR-11:** Duplicate prevention — if an entry with the same `recurring_rule_id` and `entry_date` already exists, generation is skipped
12. **BR-12:** Entry creation and rule update are wrapped in a Prisma interactive transaction — entry creation failure rolls back the rule update

---

## Scheduler

**Cron expression:** `0 2 * * *` (every day at 02:00 AM server time)

**Behavior:**
1. Query all rules with `status = 'active'` and `next_due_date < tomorrow` (i.e., `<= today`)
2. For each due rule, enqueue a BullMQ job on the `recurring-expense-generation` queue
3. The scheduler itself does NOT generate entries — it only enqueues jobs
4. Concurrency guard: if the scheduler is already running, subsequent triggers are skipped

**Job payload:**
```json
{
  "ruleId": "uuid",
  "tenantId": "uuid"
}
```

**Job options:**
- 3 attempts with exponential backoff (starting at 10 seconds)
- Completed jobs retained for 24 hours (max 500)
- Failed jobs retained indefinitely for inspection

**Processor:** `RecurringExpenseProcessor` (WorkerHost)
- Listens on queue `recurring-expense-generation`
- Calls `RecurringExpenseService.processRule(ruleId, tenantId)`
- On final failed attempt, returns a failure result instead of throwing (prevents queue poisoning)
- Logs `RecurringExpenseProcessor worker initialized and ready` on startup

---

## Generated Entry Fields

When `processRule()` creates a `financial_entry`, these fields are set:

| Field | Value |
|-------|-------|
| tenant_id | From rule |
| category_id | From rule |
| entry_type | `'expense'` |
| amount | From rule |
| tax_amount | From rule |
| entry_date | `rule.next_due_date` |
| vendor_name | From rule |
| supplier_id | From rule |
| payment_method_registry_id | From rule |
| notes | From rule |
| is_recurring_instance | `true` |
| recurring_rule_id | `rule.id` |
| submission_status | `'confirmed'` or `'pending_review'` (based on `auto_confirm`) |
| has_receipt | `false` |
| created_by_user_id | `rule.created_by_user_id` |
