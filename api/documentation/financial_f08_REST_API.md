# Financial Module — F-08: Draw Schedule → Invoice Automation — REST API Documentation

**STATUS: VERIFIED BY DOCUMENTATION AGENT — 2026-03-24**

---

## Base URL

- **Production**: `https://api.lead360.app`
- **Development**: `http://localhost:8000`

All endpoint paths below are shown without the global prefix. The actual URL is `{base_url}/api/v1/{path}`.

**Example:** `GET /projects/:projectId/milestones` → `GET http://localhost:8000/api/v1/projects/:projectId/milestones`

## Authentication

All endpoints require Bearer token authentication.

```
Authorization: Bearer {access_token}
```

Token obtained from `POST /api/v1/auth/login`.

---

## Table of Contents

1. [Draw Milestone Endpoints](#1-draw-milestone-endpoints)
2. [Project Invoice Endpoints](#2-project-invoice-endpoints)
3. [Invoice Payment Endpoints](#3-invoice-payment-endpoints)
4. [Financial Summary (Updated with Revenue)](#4-financial-summary-updated-with-revenue)
5. [Business Rules Summary](#business-rules-summary)
6. [Deferred Items](#deferred-items-future-sprints)

---

## 1. Draw Milestone Endpoints

Base path: `/projects/:projectId/milestones`

### GET /projects/:projectId/milestones

**Description:** List all draw milestones for a project, ordered by `draw_number` ascending.

**RBAC Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string (UUID) | Project identifier |

**Response 200:**

```json
[
  {
    "id": "a1b2c3d4-...",
    "draw_number": 1,
    "description": "Deposit",
    "calculation_type": "percentage",
    "value": 50,
    "calculated_amount": 5000,
    "status": "pending",
    "invoice_id": null,
    "invoice_number": null,
    "invoiced_at": null,
    "paid_at": null,
    "notes": null,
    "created_at": "2026-03-20T10:00:00.000Z"
  },
  {
    "id": "e5f6g7h8-...",
    "draw_number": 2,
    "description": "Framing complete",
    "calculation_type": "percentage",
    "value": 30,
    "calculated_amount": 3000,
    "status": "invoiced",
    "invoice_id": "inv-uuid-001",
    "invoice_number": "INV-0001",
    "invoiced_at": "2026-03-21T14:00:00.000Z",
    "paid_at": null,
    "notes": null,
    "created_at": "2026-03-20T10:01:00.000Z"
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Milestone ID |
| draw_number | number | Milestone order (1-indexed) |
| description | string | Milestone description |
| calculation_type | `"percentage"` \| `"fixed_amount"` | How `value` is interpreted |
| value | number | Raw value (percentage 0-100 or dollar amount) |
| calculated_amount | number | Computed dollar amount |
| status | `"pending"` \| `"invoiced"` \| `"paid"` | Milestone lifecycle status |
| invoice_id | string (UUID) \| null | Linked invoice ID (set when invoice generated) |
| invoice_number | string \| null | Human-readable invoice number (e.g., "INV-0001") |
| invoiced_at | string (ISO 8601) \| null | Timestamp when invoice was generated |
| paid_at | string (ISO 8601) \| null | Timestamp when fully paid |
| notes | string \| null | Internal notes |
| created_at | string (ISO 8601) | Creation timestamp |

**Error Responses:**
- `401` — Missing or invalid Bearer token
- `403` — Insufficient role

---

### POST /projects/:projectId/milestones

**Description:** Manually create a draw milestone for a project.

**RBAC Roles:** Owner, Admin, Manager

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string (UUID) | Project identifier |

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| draw_number | integer | yes | `>= 1` | Milestone order number — must be unique per project |
| description | string | yes | 1–255 chars | Milestone description |
| calculation_type | string | yes | `"percentage"` \| `"fixed_amount"` | How `value` is interpreted |
| value | number | yes | `>= 0.01`, max 2 decimal places | Percentage (1-100) or dollar amount |
| calculated_amount | number | no | `>= 0.01`, max 2 decimal places | Override computed amount — if omitted, auto-computed from `value` + project `contract_value` |
| notes | string | no | max 5000 chars | Internal notes |

**Example Request:**

```json
{
  "draw_number": 1,
  "description": "Deposit",
  "calculation_type": "percentage",
  "value": 50
}
```

**Response 201:** Created milestone object with all fields (same shape as list item).

**Business Logic:**
- If `calculated_amount` is not provided and `calculation_type` is `"percentage"`:
  - `calculated_amount = round(value / 100 * project.contract_value, 2)`
  - If `project.contract_value` is null, `calculated_amount = value` (raw fallback)
- If `calculated_amount` is not provided and `calculation_type` is `"fixed_amount"`:
  - `calculated_amount = value`

**Error Responses:**
- `400` — Percentage value exceeds 100
- `404` — Project not found
- `409` — Draw number already exists for this project

---

### PATCH /projects/:projectId/milestones/:id

**Description:** Update a milestone. `calculated_amount` can only be changed on `pending` milestones.

**RBAC Roles:** Owner, Admin, Manager

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string (UUID) | Project identifier |
| id | string (UUID) | Milestone identifier |

**Request Body (all fields optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| description | string | max 255 chars | Updated description |
| calculated_amount | number | `>= 0.01`, max 2 decimal places | Updated dollar amount — **blocked if status != pending** |
| notes | string | max 5000 chars | Updated notes |

**Response 200:** Updated milestone object.

**Error Responses:**
- `400` — Cannot modify `calculated_amount` on invoiced/paid milestone
- `404` — Milestone not found

---

### DELETE /projects/:projectId/milestones/:id

**Description:** Delete a milestone. Only `pending` milestones can be deleted.

**RBAC Roles:** Owner, Admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string (UUID) | Project identifier |
| id | string (UUID) | Milestone identifier |

**Response 204:** No content (milestone deleted).

**Error Responses:**
- `400` — Milestone is not in `pending` status
- `404` — Milestone not found

---

### POST /projects/:projectId/milestones/:id/invoice

**Description:** Generate an invoice from a pending milestone. This is the core automation action — creates a `project_invoice` record and atomically transitions the milestone to `invoiced` status. All operations occur in a single database transaction.

**RBAC Roles:** Owner, Admin, Manager

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string (UUID) | Project identifier |
| id | string (UUID) | Milestone identifier |

**Request Body (all fields optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| description | string | max 500 chars | Invoice description — defaults to milestone description |
| due_date | string | ISO 8601 date | Payment due date |
| tax_amount | number | `>= 0`, max 2 decimal places | Tax amount — added to amount for `amount_due` |
| notes | string | max 5000 chars | Internal notes |

**Example Request:**

```json
{
  "due_date": "2026-04-15",
  "tax_amount": 375
}
```

**Response 201:**

```json
{
  "id": "inv-uuid-001",
  "tenant_id": "tenant-uuid-001",
  "project_id": "proj-uuid-001",
  "invoice_number": "INV-0001",
  "milestone_id": "ms-uuid-001",
  "description": "Deposit",
  "amount": 5000,
  "tax_amount": 375,
  "amount_paid": 0,
  "amount_due": 5375,
  "status": "draft",
  "due_date": "2026-04-15T00:00:00.000Z",
  "notes": null,
  "created_by_user_id": "user-uuid-001",
  "created_at": "2026-03-20T14:30:00.000Z"
}
```

**Atomic Behavior:**
1. Invoice number auto-generated via `InvoiceNumberGeneratorService` (format: `{prefix}-{0001}`)
2. `project_invoice` created with `status: "draft"`, `amount` from `milestone.calculated_amount`
3. `amount_due = amount + tax_amount` (or just `amount` if no tax)
4. Milestone updated: `status → "invoiced"`, `invoice_id` set, `invoiced_at` set
5. All within a single Prisma `$transaction`

**Error Responses:**
- `400` — Milestone is not in `pending` status (already invoiced/paid)
- `404` — Milestone not found

---

## 2. Project Invoice Endpoints

Base path: `/projects/:projectId/invoices`

### GET /projects/:projectId/invoices

**Description:** Paginated list of invoices for a project with optional status and date filters.

**RBAC Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string (UUID) | Project identifier |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | (all) | Filter: `"draft"` \| `"sent"` \| `"partial"` \| `"paid"` \| `"voided"` |
| date_from | string | — | Filter `created_at >= date` (ISO date) |
| date_to | string | — | Filter `created_at <= date` (inclusive, end of day) |
| page | integer | 1 | Page number (min 1) |
| limit | integer | 20 | Items per page (min 1, max 100) |

**Response 200:**

```json
{
  "data": [
    {
      "id": "inv-uuid-001",
      "invoice_number": "INV-0001",
      "milestone_id": "ms-uuid-001",
      "milestone_description": "Deposit",
      "description": "Deposit",
      "amount": 5000,
      "tax_amount": 375,
      "amount_paid": 2500,
      "amount_due": 2875,
      "status": "partial",
      "due_date": "2026-04-15T00:00:00.000Z",
      "sent_at": "2026-03-21T10:00:00.000Z",
      "paid_at": null,
      "voided_at": null,
      "payment_count": 1,
      "created_at": "2026-03-20T14:30:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Response Fields (per invoice):**

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Invoice ID |
| invoice_number | string | Auto-generated (e.g., "INV-0001") |
| milestone_id | string (UUID) \| null | Linked milestone (null for manual invoices) |
| milestone_description | string \| null | Milestone description (null if no milestone) |
| description | string | Invoice description |
| amount | number | Invoice base amount |
| tax_amount | number \| null | Tax amount |
| amount_paid | number | Total paid so far |
| amount_due | number | Remaining balance |
| status | string | `"draft"` \| `"sent"` \| `"partial"` \| `"paid"` \| `"voided"` |
| due_date | string (ISO 8601) \| null | Payment due date |
| sent_at | string (ISO 8601) \| null | When marked as sent |
| paid_at | string (ISO 8601) \| null | When fully paid |
| voided_at | string (ISO 8601) \| null | When voided |
| payment_count | number | Number of payment records |
| created_at | string (ISO 8601) | Creation timestamp |

---

### POST /projects/:projectId/invoices

**Description:** Create a manual invoice (not linked to a milestone). Invoice number is auto-generated.

**RBAC Roles:** Owner, Admin, Manager

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| description | string | yes | 1–500 chars | Invoice line description |
| amount | number | yes | `>= 0.01`, max 2 decimal places | Invoice total amount |
| tax_amount | number | no | `>= 0`, max 2 decimal places | Tax amount |
| due_date | string | no | ISO 8601 date | Payment due date |
| notes | string | no | max 5000 chars | Internal notes |

**Example Request:**

```json
{
  "description": "Custom work — additional scope",
  "amount": 2500,
  "tax_amount": 187.50,
  "due_date": "2026-04-01"
}
```

**Response 201:** Created invoice object with `status: "draft"`, auto-generated `invoice_number`, computed `amount_due`.

**Business Logic:**
- `amount_due = amount + tax_amount` (or just `amount` if no tax)
- `amount_paid = 0`
- `status = "draft"`
- Invoice number generated atomically within transaction

**Error Responses:**
- `404` — Project not found

---

### GET /projects/:projectId/invoices/:id

**Description:** Get a single invoice with full payment history and milestone details.

**RBAC Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string (UUID) | Project identifier |
| id | string (UUID) | Invoice identifier |

**Response 200:**

```json
{
  "id": "inv-uuid-001",
  "tenant_id": "tenant-uuid-001",
  "project_id": "proj-uuid-001",
  "invoice_number": "INV-0001",
  "milestone_id": "ms-uuid-001",
  "description": "Deposit",
  "amount": 5000,
  "tax_amount": 375,
  "amount_paid": 2500,
  "amount_due": 2875,
  "status": "partial",
  "due_date": "2026-04-15T00:00:00.000Z",
  "sent_at": "2026-03-21T10:00:00.000Z",
  "paid_at": null,
  "voided_at": null,
  "voided_reason": null,
  "notes": null,
  "created_by_user_id": "user-uuid-001",
  "updated_by_user_id": null,
  "created_at": "2026-03-20T14:30:00.000Z",
  "updated_at": "2026-03-21T10:00:00.000Z",
  "milestone": {
    "id": "ms-uuid-001",
    "description": "Deposit",
    "draw_number": 1,
    "status": "invoiced"
  },
  "payments": [
    {
      "id": "pay-uuid-001",
      "tenant_id": "tenant-uuid-001",
      "invoice_id": "inv-uuid-001",
      "project_id": "proj-uuid-001",
      "amount": 2500,
      "payment_date": "2026-03-25T00:00:00.000Z",
      "payment_method": "check",
      "payment_method_registry_id": null,
      "reference_number": "CHK-1234",
      "notes": null,
      "created_by_user_id": "user-uuid-001",
      "created_at": "2026-03-25T09:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `404` — Invoice not found

---

### PATCH /projects/:projectId/invoices/:id

**Description:** Update a draft invoice. Only invoices with `status: "draft"` are editable. If `amount` or `tax_amount` changes, `amount_due` is automatically recomputed.

**RBAC Roles:** Owner, Admin, Manager

**Request Body (all fields optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| description | string | max 500 chars | Updated description |
| amount | number | `>= 0.01`, max 2 decimal places | Updated base amount |
| tax_amount | number | `>= 0`, max 2 decimal places | Updated tax amount |
| due_date | string \| null | ISO 8601 date | Updated due date (null to clear) |
| notes | string | max 5000 chars | Updated notes |

**Business Logic:**
- If `amount` or `tax_amount` changes: `amount_due = amount + tax_amount - amount_paid`
- `updated_by_user_id` set to current user

**Response 200:** Updated invoice object.

**Error Responses:**
- `400` — Invoice is not in `draft` status
- `404` — Invoice not found

---

### POST /projects/:projectId/invoices/:id/send

**Description:** Mark a draft invoice as sent. Transitions `status: "draft" → "sent"` and sets `sent_at`.

**RBAC Roles:** Owner, Admin, Manager

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string (UUID) | Project identifier |
| id | string (UUID) | Invoice identifier |

**Request Body:** None required.

**Response 200:** Updated invoice object with `status: "sent"` and `sent_at` timestamp.

**Error Responses:**
- `400` — Invoice is not in `draft` status
- `404` — Invoice not found

---

### POST /projects/:projectId/invoices/:id/void

**Description:** Void an invoice. If the invoice is linked to a milestone, the milestone is atomically reset to `pending` status (with `invoice_id` and `invoiced_at` cleared). All operations occur in a single database transaction.

**RBAC Roles:** Owner, Admin

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| voided_reason | string | yes | 1–500 chars | Reason for voiding |

**Example Request:**

```json
{
  "voided_reason": "Customer requested cancellation"
}
```

**Response 200:** Voided invoice object with `status: "voided"`, `voided_at` timestamp, and `voided_reason`.

**Atomic Behavior:**
1. Invoice updated: `status → "voided"`, `voided_at` set, `voided_reason` recorded
2. If linked to a milestone: milestone reset to `status: "pending"`, `invoice_id: null`, `invoiced_at: null`
3. All within a single Prisma `$transaction`

**Error Responses:**
- `400` — Invoice is already voided
- `404` — Invoice not found

---

## 3. Invoice Payment Endpoints

### POST /projects/:projectId/invoices/:id/payments

**Description:** Record a payment against an invoice. Atomically creates the payment record, updates invoice amounts, and transitions statuses. If the invoice becomes fully paid and is linked to a milestone, the milestone transitions to `paid`.

**RBAC Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string (UUID) | Project identifier |
| id | string (UUID) | Invoice identifier |

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| amount | number | yes | `>= 0.01`, max 2 decimal places, `<= invoice.amount_due` | Payment amount |
| payment_date | string | yes | ISO 8601 date | Date payment was received |
| payment_method | string | yes | enum (see below) | Payment method used |
| payment_method_registry_id | string (UUID) | no | valid UUID | FK to named payment account |
| reference_number | string | no | max 200 chars | Check number, transaction ID, etc. |
| notes | string | no | max 5000 chars | Internal notes |

**payment_method enum values:** `"cash"`, `"check"`, `"bank_transfer"`, `"venmo"`, `"zelle"`, `"credit_card"`, `"debit_card"`, `"ACH"`

**Example Request:**

```json
{
  "amount": 2500,
  "payment_date": "2026-03-25",
  "payment_method": "check",
  "reference_number": "CHK-1234"
}
```

**Response 201:**

```json
{
  "id": "pay-uuid-001",
  "tenant_id": "tenant-uuid-001",
  "invoice_id": "inv-uuid-001",
  "project_id": "proj-uuid-001",
  "amount": 2500,
  "payment_date": "2026-03-25T00:00:00.000Z",
  "payment_method": "check",
  "payment_method_registry_id": null,
  "reference_number": "CHK-1234",
  "notes": null,
  "created_by_user_id": "user-uuid-001",
  "created_at": "2026-03-25T09:00:00.000Z"
}
```

**Atomic Behavior:**
1. Payment record created in `project_invoice_payment`
2. Invoice `amount_paid` incremented, `amount_due` recomputed: `amount + tax_amount - new_amount_paid`
3. Status transitions:
   - If `amount_due <= 0` → `status: "paid"`, `paid_at` set
   - Else if `amount_paid > 0` → `status: "partial"`
4. If invoice now `"paid"` AND has `milestone_id` → milestone `status: "paid"`, `paid_at` set
5. All within a single Prisma `$transaction`

**Error Responses:**
- `400` — Payment amount exceeds `amount_due`
- `400` — Cannot record payment on a voided invoice
- `404` — Invoice not found

---

### GET /projects/:projectId/invoices/:id/payments

**Description:** List all payments for a specific invoice, ordered by `payment_date` ascending.

**RBAC Roles:** Owner, Admin, Manager, Bookkeeper

**Response 200:**

```json
[
  {
    "id": "pay-uuid-001",
    "tenant_id": "tenant-uuid-001",
    "invoice_id": "inv-uuid-001",
    "project_id": "proj-uuid-001",
    "amount": 2500,
    "payment_date": "2026-03-25T00:00:00.000Z",
    "payment_method": "check",
    "payment_method_registry_id": null,
    "reference_number": "CHK-1234",
    "notes": null,
    "created_by_user_id": "user-uuid-001",
    "created_at": "2026-03-25T09:00:00.000Z"
  }
]
```

**Error Responses:**
- `404` — Invoice not found

---

## 4. Financial Summary (Updated with Revenue)

### GET /projects/:projectId/financial/summary

**Description:** Returns a complete financial picture of a project including cost breakdown, subcontractor/crew summaries, receipt counts, **revenue data from project invoices**, and **margin analysis with billing coverage**.

**RBAC Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string (UUID) | Project identifier |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| date_from | string | — | Filter `entry_date >= date` (ISO date, YYYY-MM-DD) |
| date_to | string | — | Filter `entry_date <= date` (ISO date, YYYY-MM-DD) |

**Response 200 — Revenue & Margin blocks (F-08 additions):**

```json
{
  "project": { "..." },
  "cost_summary": { "..." },
  "subcontractor_summary": { "..." },
  "crew_summary": { "..." },
  "receipt_summary": { "..." },
  "revenue": {
    "total_invoiced": 15000,
    "total_collected": 7500,
    "outstanding": 7500,
    "invoice_count": 3,
    "paid_invoices": 1,
    "partial_invoices": 1,
    "draft_invoices": 1
  },
  "margin_analysis": {
    "contract_value": 50000,
    "estimated_cost": 35000,
    "actual_cost_confirmed": 12500,
    "actual_cost_total": 14000,
    "estimated_margin": 15000,
    "actual_margin": 37500,
    "cost_variance": -22500,
    "margin_percent": 75,
    "gross_margin": 42500,
    "billing_coverage": 30
  }
}
```

**Revenue block fields:**

| Field | Type | Description |
|-------|------|-------------|
| total_invoiced | number | Sum of `amount` for all non-voided invoices |
| total_collected | number | Sum of `amount_paid` for all non-voided invoices |
| outstanding | number | `total_invoiced - total_collected` |
| invoice_count | number | Count of non-voided invoices |
| paid_invoices | number | Count of invoices with `status: "paid"` |
| partial_invoices | number | Count of invoices with `status: "partial"` |
| draft_invoices | number | Count of invoices with `status: "draft"` |

**Margin analysis block fields (F-08 additions):**

| Field | Type | Description |
|-------|------|-------------|
| gross_margin | number \| null | `contract_value - total_collected` (null if no contract value or zero collected) |
| billing_coverage | number \| null | `(total_invoiced / contract_value) * 100` — % of contract invoiced (null if no contract value) |

> **Note:** Revenue data excludes voided invoices. The `date_from`/`date_to` filters apply only to the cost queries (financial_entry), not to revenue aggregations.

**Error Responses:**
- `404` — Project not found or does not belong to tenant

---

## Business Rules Summary

### Milestone Lifecycle

```
pending → invoiced → paid
```

1. **pending** — Milestone exists, no invoice generated yet. Can be edited/deleted.
2. **invoiced** — Invoice generated from milestone. `calculated_amount` locked. Cannot be deleted.
3. **paid** — Linked invoice fully paid. Immutable.

### Invoice Lifecycle

```
draft → sent → partial → paid
                 ↕
              voided (terminal — resets linked milestone to pending)
```

1. **draft** — Newly created. Editable (description, amount, tax, due_date, notes).
2. **sent** — Marked as delivered to customer. No longer editable.
3. **partial** — At least one payment recorded but balance remains.
4. **paid** — Fully paid (`amount_due = 0`). `paid_at` timestamp set.
5. **voided** — Cancelled. If linked to milestone, milestone reset to `pending`.

### Key Business Rules

1. Milestone `calculated_amount` cannot be modified once invoiced or paid.
2. Only `pending` milestones can be deleted.
3. Only `pending` milestones can generate invoices.
4. Invoice number is auto-generated sequentially per tenant (format: `{prefix}-{0001}`).
5. Only `draft` invoices are editable (PATCH).
6. Only `draft` invoices can be marked as sent.
7. Any non-voided invoice can be voided (draft, sent, partial, paid).
8. Voiding an invoice with a linked milestone resets milestone to `pending`.
9. Payment amount must not exceed `amount_due`.
10. Payment on a voided invoice is rejected.
11. Full payment transitions invoice to `paid` and linked milestone to `paid`.
12. Revenue aggregations exclude voided invoices.

---

## Deferred Items (Future Sprints)

- PDF invoice generation
- Email delivery of invoices
- Customer portal invoice view
- Credits and credit notes
- Invoice cap enforcement
- Bulk invoice operations
- Refund/credit logic on payments

---

## Auto-Seeding from Quote (Internal)

When a project is created from a quote via `ProjectService.createFromQuote()`, the system automatically calls `DrawMilestoneService.seedFromQuote()` **inside the same transaction**. This creates milestones from the quote's `draw_schedule_entry` records.

**Seeding logic:**
- For `percentage` entries: `calculated_amount = round(value / 100 * project.contract_value, 2)`
- For `fixed_amount` entries: `calculated_amount = value`
- If `project.contract_value` is null at seed time: `calculated_amount = value` with a warning in `notes`
- Each seeded milestone stores `quote_draw_entry_id` for traceability
- All milestones are created with `status: "pending"`

This is not a REST endpoint — it is an internal integration point documented here for completeness.
