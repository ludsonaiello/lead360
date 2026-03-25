# Financial Module — Project Financial Intelligence (F-07) REST API

**STATUS: VERIFIED BY DOCUMENTATION AGENT — 2026-03-24**

**Version**: 1.1
**Last Updated**: March 2026
**Base URL**: `https://api.lead360.app/api/v1` (local: `http://localhost:8000/api/v1`)
**Global Prefix**: All endpoints are prefixed with `/api/v1` (set via `app.setGlobalPrefix('api/v1')` in `main.ts`)
**Authentication**: Bearer token required on all endpoints
**Content-Type**: `application/json`

---

## Overview

Sprint F-07 provides **5 read-only endpoints** for comprehensive project financial intelligence.
All endpoints are nested under `/projects/:projectId/financial/`.

These endpoints aggregate data from across the financial module — financial entries, receipts, subcontractor invoices/payments, and crew hour logs/payments — into project-scoped summaries. All queries use `Promise.all()` for parallel execution to avoid N+1 query patterns.

**Important: Revenue Gap**
Revenue data (invoiced amount, collected amount, outstanding balance) is **NOT available**.
The Invoicing Module (Sprint 9) has not been built yet. All summary responses include a
`revenue_note` field documenting this known gap. Revenue intelligence will be added in a
future sprint once the invoicing system is complete.

---

## Endpoints Summary

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/projects/:projectId/financial/summary` | Full financial summary | Owner, Admin, Manager, Bookkeeper |
| GET | `/api/v1/projects/:projectId/financial/tasks` | Per-task cost breakdown | Owner, Admin, Manager, Bookkeeper |
| GET | `/api/v1/projects/:projectId/financial/timeline` | Monthly cost timeline | Owner, Admin, Manager, Bookkeeper |
| GET | `/api/v1/projects/:projectId/financial/receipts` | Project receipts list (paginated) | Owner, Admin, Manager, Bookkeeper, **Field** |
| GET | `/api/v1/projects/:projectId/financial/workforce` | Workforce summary | Owner, Admin, Manager, Bookkeeper |

---

## Common Behaviors

### Tenant Isolation
All endpoints validate that `:projectId` belongs to the requesting tenant before returning any data.
The `validateProjectAccess()` method runs `project.findFirst({ where: { id, tenant_id } })`.
Returns **404** if the project does not exist or belongs to a different tenant.
The 404 response is intentionally identical for "does not exist" and "wrong tenant" to prevent tenant enumeration.

### Authentication & Authorization
All endpoints are protected by `JwtAuthGuard` + `RolesGuard`.
The `tenant_id` is derived server-side from the JWT token — clients never send it.

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid authentication token |
| 403 | Valid token but insufficient role permissions |
| 404 | Project not found or does not belong to tenant |
| 400 | Invalid query parameters (e.g., malformed date, invalid UUID) |

**Error Response Format:**
```json
{
  "statusCode": 404,
  "message": "Project not found",
  "error": "Not Found"
}
```

### Date Filter Behavior
The `date_from` and `date_to` query parameters are available on summary, tasks, timeline, and workforce endpoints. They are **inclusive** — entries with `entry_date` exactly matching the boundary dates are included.

---

## 1. GET /projects/:projectId/financial/summary

**Full Project Financial Summary**

Returns a complete financial picture of a project: cost breakdown by category and classification, subcontractor invoices and payments, crew hours and payments, receipt counts, and margin analysis. Runs 5 independent query groups in parallel for optimal performance.

### Authentication
- **Required**: Yes (Bearer token)
- **Roles**: `Owner`, `Admin`, `Manager`, `Bookkeeper`

### Path Parameters

| Name | Type | Description |
|------|------|-------------|
| `projectId` | string (UUID) | The project's unique identifier |

### Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `date_from` | string (ISO 8601 date) | No | — | Filter `entry_date >= this date`. Format: `YYYY-MM-DD` |
| `date_to` | string (ISO 8601 date) | No | — | Filter `entry_date <= this date`. Format: `YYYY-MM-DD` |

**Note**: Date filters apply to `financial_entry.entry_date` for cost data. They do **NOT** apply to subcontractor data, crew data, or receipt counts in this endpoint.

### Response Body

```json
{
  "project": {
    "id": "string (uuid)",
    "project_number": "string",
    "name": "string",
    "status": "string",
    "progress_percent": "number",
    "start_date": "string (ISO 8601) | null",
    "target_completion_date": "string (ISO 8601) | null",
    "actual_completion_date": "string (ISO 8601) | null",
    "contract_value": "number | null",
    "estimated_cost": "number | null",
    "assigned_pm": {
      "id": "string (uuid)",
      "first_name": "string",
      "last_name": "string"
    }
  },
  "cost_summary": {
    "total_expenses": "number",
    "total_expenses_pending": "number",
    "total_tax_paid": "number",
    "entry_count": "number (integer)",
    "by_category": [
      {
        "category_id": "string (uuid)",
        "category_name": "string",
        "category_type": "string",
        "classification": "string (cost_of_goods_sold | operating_expense)",
        "total": "number",
        "entry_count": "number (integer)"
      }
    ],
    "by_classification": {
      "cost_of_goods_sold": "number",
      "operating_expense": "number"
    }
  },
  "subcontractor_summary": {
    "total_invoiced": "number",
    "total_paid": "number",
    "outstanding": "number",
    "invoice_count": "number (integer)",
    "payment_count": "number (integer)"
  },
  "crew_summary": {
    "total_regular_hours": "number",
    "total_overtime_hours": "number",
    "total_hours": "number",
    "total_crew_payments": "number",
    "crew_member_count": "number (integer)"
  },
  "receipt_summary": {
    "total_receipts": "number (integer)",
    "categorized_receipts": "number (integer)",
    "uncategorized_receipts": "number (integer)"
  },
  "margin_analysis": {
    "contract_value": "number | null",
    "estimated_cost": "number | null",
    "actual_cost_confirmed": "number",
    "actual_cost_total": "number",
    "estimated_margin": "number | null",
    "actual_margin": "number | null",
    "cost_variance": "number | null",
    "margin_percent": "number | null"
  },
  "revenue_note": "string"
}
```

### Field Descriptions — `margin_analysis`

| Field | Type | Description |
|-------|------|-------------|
| `contract_value` | number \| null | From `project.contract_value`. Null if not set on the project. |
| `estimated_cost` | number \| null | From `project.estimated_cost`. Null if not set on the project. |
| `actual_cost_confirmed` | number | Sum of `financial_entry.amount` where `submission_status = 'confirmed'`. **Excludes** pending_review entries. |
| `actual_cost_total` | number | Sum of confirmed + pending entries. `actual_cost_confirmed + total_expenses_pending`. |
| `estimated_margin` | number \| null | `contract_value - estimated_cost`. Null if either value is null. |
| `actual_margin` | number \| null | `contract_value - actual_cost_confirmed`. Null if `contract_value` is null. |
| `cost_variance` | number \| null | `actual_cost_confirmed - estimated_cost`. Positive = over budget, negative = under budget. Null if `estimated_cost` is null. |
| `margin_percent` | number \| null | `(actual_margin / contract_value) * 100`. **Null** when `contract_value` is null **OR** zero. Never returns NaN. |

### Field Descriptions — `cost_summary`

| Field | Type | Description |
|-------|------|-------------|
| `total_expenses` | number | Sum of confirmed entries only (`submission_status = 'confirmed'`). |
| `total_expenses_pending` | number | Sum of pending entries only (`submission_status = 'pending_review'`). |
| `total_tax_paid` | number | Sum of `tax_amount` across all entries (all statuses). |
| `entry_count` | integer | Total number of financial entries for this project (all statuses). |
| `by_category` | array | Breakdown by financial category. Includes `classification` field per category. |
| `by_classification` | object | Aggregated totals: `cost_of_goods_sold` vs `operating_expense`. Computed from `by_category` data. |

### Field Descriptions — `project.assigned_pm`

| Field | Type | Description |
|-------|------|-------------|
| `assigned_pm` | object \| null | The assigned project manager. Null if no PM assigned. Contains `id`, `first_name`, `last_name`. |

### Example Request

```bash
curl -s "http://localhost:8000/api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/financial/summary?date_from=2025-01-01&date_to=2025-12-31" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Example Response

```json
{
  "project": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "project_number": "P-001",
    "name": "Kitchen Renovation — Smith Residence",
    "status": "in_progress",
    "progress_percent": 65,
    "start_date": "2025-01-15T00:00:00.000Z",
    "target_completion_date": "2025-06-30T00:00:00.000Z",
    "actual_completion_date": null,
    "contract_value": 85000,
    "estimated_cost": 62000,
    "assigned_pm": {
      "id": "f1a2b3c4-d5e6-7890-abcd-1234567890ef",
      "first_name": "Maria",
      "last_name": "Gonzalez"
    }
  },
  "cost_summary": {
    "total_expenses": 41250.50,
    "total_expenses_pending": 3200,
    "total_tax_paid": 2875.25,
    "entry_count": 47,
    "by_category": [
      {
        "category_id": "cat-uuid-001",
        "category_name": "Materials",
        "category_type": "material",
        "classification": "cost_of_goods_sold",
        "total": 28500,
        "entry_count": 22
      },
      {
        "category_id": "cat-uuid-002",
        "category_name": "Equipment Rental",
        "category_type": "equipment",
        "classification": "cost_of_goods_sold",
        "total": 5200,
        "entry_count": 8
      },
      {
        "category_id": "cat-uuid-003",
        "category_name": "Permits & Fees",
        "category_type": "administrative",
        "classification": "operating_expense",
        "total": 7550.50,
        "entry_count": 17
      }
    ],
    "by_classification": {
      "cost_of_goods_sold": 33700,
      "operating_expense": 7550.50
    }
  },
  "subcontractor_summary": {
    "total_invoiced": 12000,
    "total_paid": 8000,
    "outstanding": 4000,
    "invoice_count": 3,
    "payment_count": 2
  },
  "crew_summary": {
    "total_regular_hours": 320,
    "total_overtime_hours": 24.5,
    "total_hours": 344.5,
    "total_crew_payments": 18500,
    "crew_member_count": 4
  },
  "receipt_summary": {
    "total_receipts": 35,
    "categorized_receipts": 28,
    "uncategorized_receipts": 7
  },
  "margin_analysis": {
    "contract_value": 85000,
    "estimated_cost": 62000,
    "actual_cost_confirmed": 41250.50,
    "actual_cost_total": 44450.50,
    "estimated_margin": 23000,
    "actual_margin": 43749.50,
    "cost_variance": -20749.50,
    "margin_percent": 51.47
  },
  "revenue_note": "Revenue data (invoiced amount, collected amount) will be available after the Invoicing Module is implemented."
}
```

### Business Rules

- `total_expenses` counts only `submission_status = 'confirmed'` entries.
- `total_expenses_pending` counts only `submission_status = 'pending_review'` entries.
- `by_classification` is computed from `by_category` data — no separate DB query.
- `margin_percent` is **null** when `contract_value` is null or zero (no NaN, no divide-by-zero).
- `assigned_pm` is null if the project has no assigned PM user.
- `revenue_note` is a static string, always present in every response.
- Date filters scope `financial_entry.entry_date` only — subcontractor, crew, and receipt data are **not** date-filtered in this endpoint.
- Empty projects return zero values for all numeric aggregations (not null).

---

## 2. GET /projects/:projectId/financial/tasks

**Per-Task Cost Breakdown**

Returns cost breakdown at the task level. Includes expenses (with category breakdown), subcontractor invoices, and crew hours per task. Tasks with zero financial activity are **included** with zero values. Runs 6 independent queries in parallel.

### Authentication
- **Required**: Yes (Bearer token)
- **Roles**: `Owner`, `Admin`, `Manager`, `Bookkeeper`

### Path Parameters

| Name | Type | Description |
|------|------|-------------|
| `projectId` | string (UUID) | The project's unique identifier |

### Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `date_from` | string (ISO 8601 date) | No | — | Filter `entry_date >= this date` |
| `date_to` | string (ISO 8601 date) | No | — | Filter `entry_date <= this date` |
| `sort_by` | enum | No | `total_cost` | Sort field. Values: `total_cost`, `task_title` |
| `sort_order` | enum | No | `desc` | Sort direction. Values: `asc`, `desc` |

**Note**: Date filters apply to `financial_entry.entry_date` for expense data. Subcontractor invoice and crew hour data are **NOT** date-filtered (they use `project_id` scope only).

### Response Body

```json
{
  "project_id": "string (uuid)",
  "total_task_cost": "number",
  "tasks": [
    {
      "task_id": "string (uuid)",
      "task_title": "string",
      "task_status": "string",
      "task_order_index": "number (integer)",
      "expenses": {
        "total": "number",
        "by_category": [
          {
            "category_name": "string",
            "category_type": "string",
            "classification": "string (cost_of_goods_sold | operating_expense)",
            "total": "number"
          }
        ],
        "entry_count": "number (integer)"
      },
      "subcontractor_invoices": {
        "total_invoiced": "number",
        "invoice_count": "number (integer)"
      },
      "crew_hours": {
        "total_regular_hours": "number",
        "total_overtime_hours": "number",
        "total_hours": "number"
      }
    }
  ]
}
```

### Example Request

```bash
curl -s "http://localhost:8000/api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/financial/tasks?sort_by=total_cost&sort_order=desc" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Example Response

```json
{
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "total_task_cost": 28500,
  "tasks": [
    {
      "task_id": "task-uuid-001",
      "task_title": "Foundation Work",
      "task_status": "done",
      "task_order_index": 1,
      "expenses": {
        "total": 18500,
        "by_category": [
          {
            "category_name": "Materials",
            "category_type": "material",
            "classification": "cost_of_goods_sold",
            "total": 12000
          },
          {
            "category_name": "Equipment Rental",
            "category_type": "equipment",
            "classification": "cost_of_goods_sold",
            "total": 6500
          }
        ],
        "entry_count": 15
      },
      "subcontractor_invoices": {
        "total_invoiced": 5000,
        "invoice_count": 1
      },
      "crew_hours": {
        "total_regular_hours": 120,
        "total_overtime_hours": 8.5,
        "total_hours": 128.5
      }
    },
    {
      "task_id": "task-uuid-002",
      "task_title": "Framing",
      "task_status": "in_progress",
      "task_order_index": 2,
      "expenses": {
        "total": 10000,
        "by_category": [
          {
            "category_name": "Materials",
            "category_type": "material",
            "classification": "cost_of_goods_sold",
            "total": 10000
          }
        ],
        "entry_count": 7
      },
      "subcontractor_invoices": {
        "total_invoiced": 0,
        "invoice_count": 0
      },
      "crew_hours": {
        "total_regular_hours": 80,
        "total_overtime_hours": 0,
        "total_hours": 80
      }
    },
    {
      "task_id": "task-uuid-003",
      "task_title": "Cleanup",
      "task_status": "not_started",
      "task_order_index": 3,
      "expenses": {
        "total": 0,
        "by_category": [],
        "entry_count": 0
      },
      "subcontractor_invoices": {
        "total_invoiced": 0,
        "invoice_count": 0
      },
      "crew_hours": {
        "total_regular_hours": 0,
        "total_overtime_hours": 0,
        "total_hours": 0
      }
    }
  ]
}
```

### Business Rules

- **All project tasks are returned**, including those with zero financial activity (zero expenses, zero invoices, zero crew hours).
- Only entries with `task_id IS NOT NULL` are included in expense aggregations.
- `total_task_cost` is the sum of `expenses.total` across all tasks (rounded to 2 decimal places).
- `sort_by=total_cost` sorts by `expenses.total`. Default sort: `total_cost` descending.
- `sort_by=task_title` sorts alphabetically using `localeCompare`.
- Deleted tasks (`deleted_at IS NOT NULL`) are excluded.
- `total_hours` is rounded to 2 decimal places: `Math.round((regular + overtime) * 100) / 100`.

---

## 3. GET /projects/:projectId/financial/timeline

**Monthly Cost Timeline**

Returns expenses grouped by month with category breakdown. Zero-expense months within the project date range are included for chart continuity. Uses UTC date methods because Prisma returns `@db.Date` fields as midnight UTC.

### Authentication
- **Required**: Yes (Bearer token)
- **Roles**: `Owner`, `Admin`, `Manager`, `Bookkeeper`

### Path Parameters

| Name | Type | Description |
|------|------|-------------|
| `projectId` | string (UUID) | The project's unique identifier |

### Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `date_from` | string (ISO 8601 date) | No | Project `start_date` | Timeline start date |
| `date_to` | string (ISO 8601 date) | No | Project `actual_completion_date` or today | Timeline end date |

### Date Range Resolution

The timeline date range is determined by the following priority:

| Boundary | Priority 1 (Query Param) | Priority 2 (Project Field) | Priority 3 (Fallback) |
|----------|--------------------------|---------------------------|----------------------|
| Start | `date_from` query param | `project.start_date` | Earliest `financial_entry.entry_date` or today |
| End | `date_to` query param | `project.actual_completion_date` | Today's date |

### Response Body

```json
{
  "project_id": "string (uuid)",
  "months": [
    {
      "year": "number (integer)",
      "month": "number (integer, 1-12)",
      "month_label": "string (e.g., 'Jan 2025')",
      "total_expenses": "number",
      "by_category": [
        {
          "category_name": "string",
          "category_type": "string",
          "total": "number"
        }
      ]
    }
  ],
  "cumulative_total": "number"
}
```

### Example Request

```bash
curl -s "http://localhost:8000/api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/financial/timeline?date_from=2025-01-01&date_to=2025-06-30" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Example Response

```json
{
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "months": [
    {
      "year": 2025,
      "month": 1,
      "month_label": "Jan 2025",
      "total_expenses": 8500,
      "by_category": [
        { "category_name": "Materials", "category_type": "material", "total": 6000 },
        { "category_name": "Permits & Fees", "category_type": "administrative", "total": 2500 }
      ]
    },
    {
      "year": 2025,
      "month": 2,
      "month_label": "Feb 2025",
      "total_expenses": 12300.50,
      "by_category": [
        { "category_name": "Materials", "category_type": "material", "total": 9800 },
        { "category_name": "Equipment Rental", "category_type": "equipment", "total": 2500.50 }
      ]
    },
    {
      "year": 2025,
      "month": 3,
      "month_label": "Mar 2025",
      "total_expenses": 0,
      "by_category": []
    },
    {
      "year": 2025,
      "month": 4,
      "month_label": "Apr 2025",
      "total_expenses": 5600,
      "by_category": [
        { "category_name": "Materials", "category_type": "material", "total": 5600 }
      ]
    },
    {
      "year": 2025,
      "month": 5,
      "month_label": "May 2025",
      "total_expenses": 0,
      "by_category": []
    },
    {
      "year": 2025,
      "month": 6,
      "month_label": "Jun 2025",
      "total_expenses": 0,
      "by_category": []
    }
  ],
  "cumulative_total": 26400.50
}
```

### Business Rules

- **Zero-expense months ARE included** within the date range. Every month from start to end gets a slot even if no entries exist — this ensures chart continuity on the frontend.
- `cumulative_total` is the running sum of `total_expenses` across **all** months in the response.
- `month` values are 1-indexed (1 = January, 12 = December).
- `month_label` format: `"MMM YYYY"` (e.g., `"Jan 2025"`, `"Dec 2026"`).
- All monetary totals are rounded to 2 decimal places.
- Timeline fetches all matching entries and aggregates in JavaScript (Prisma `groupBy` cannot group by YEAR/MONTH expressions).
- UTC date methods are used to prevent timezone-related month shifts.

---

## 4. GET /projects/:projectId/financial/receipts

**Project Receipts List (Paginated)**

Returns a paginated list of all receipts attached to this project **or** any of its tasks. Field workers can access this endpoint to see their uploaded receipts. Joins task titles from a lookup map to avoid N+1 queries.

### Authentication
- **Required**: Yes (Bearer token)
- **Roles**: `Owner`, `Admin`, `Manager`, `Bookkeeper`, **`Field`**

> **Note**: This is the only F-07 endpoint accessible to the `Field` role.

### Path Parameters

| Name | Type | Description |
|------|------|-------------|
| `projectId` | string (UUID) | The project's unique identifier |

### Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `is_categorized` | boolean | No | — | Filter by categorization status. Values: `true`, `false` |
| `ocr_status` | enum | No | — | Filter by OCR processing status. Values: `not_processed`, `processing`, `complete`, `failed` |
| `page` | integer | No | `1` | Page number (1-indexed, minimum: 1) |
| `limit` | integer | No | `20` | Items per page (minimum: 1, maximum: 100) |

### Response Body

```json
{
  "data": [
    {
      "id": "string (uuid)",
      "project_id": "string (uuid) | null",
      "task_id": "string (uuid) | null",
      "task_title": "string | null",
      "file_url": "string",
      "file_name": "string",
      "file_type": "string",
      "vendor_name": "string | null",
      "amount": "number | null",
      "receipt_date": "string (ISO 8601) | null",
      "ocr_status": "string (not_processed | processing | complete | failed)",
      "ocr_vendor": "string | null",
      "ocr_amount": "number | null",
      "ocr_date": "string (ISO 8601) | null",
      "is_categorized": "boolean",
      "financial_entry_id": "string (uuid) | null",
      "uploaded_by": {
        "id": "string (uuid)",
        "first_name": "string",
        "last_name": "string"
      },
      "created_at": "string (ISO 8601)"
    }
  ],
  "meta": {
    "total": "number (integer)",
    "page": "number (integer)",
    "limit": "number (integer)",
    "total_pages": "number (integer)"
  }
}
```

### Field Descriptions — Receipt Object

| Field | Type | Description |
|-------|------|-------------|
| `task_title` | string \| null | Joined from the task record when `task_id` is present. Null if receipt is linked directly to project (no task). |
| `uploaded_by` | object \| null | User who uploaded the receipt. Contains `id`, `first_name`, `last_name`. Null if uploader record missing. |
| `amount` | number \| null | Manual receipt amount. Cast to Number. Null if not set. |
| `ocr_amount` | number \| null | OCR-extracted amount. Cast to Number. Null if OCR not processed or not detected. |
| `financial_entry_id` | string \| null | Link to the financial entry created from this receipt (if any). |

### Example Request

```bash
curl -s "http://localhost:8000/api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/financial/receipts?page=1&limit=5&is_categorized=false" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Example Response

```json
{
  "data": [
    {
      "id": "rcpt-uuid-001",
      "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "task_id": "task-uuid-001",
      "task_title": "Foundation Work",
      "file_url": "/public/tenant-uuid/files/receipt-abc123.jpg",
      "file_name": "home_depot_receipt.jpg",
      "file_type": "image/jpeg",
      "vendor_name": "Home Depot",
      "amount": 342.50,
      "receipt_date": "2025-03-15T00:00:00.000Z",
      "ocr_status": "complete",
      "ocr_vendor": "Home Depot #4521",
      "ocr_amount": 342.50,
      "ocr_date": "2025-03-15T00:00:00.000Z",
      "is_categorized": false,
      "financial_entry_id": null,
      "uploaded_by": {
        "id": "user-uuid-001",
        "first_name": "Carlos",
        "last_name": "Martinez"
      },
      "created_at": "2025-03-15T14:30:00.000Z"
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 5,
    "total_pages": 3
  }
}
```

### Business Rules

- Returns receipts linked to the **project directly** (`receipt.project_id = projectId`) **AND** receipts linked to any of the project's tasks (`receipt.task_id IN project_task_ids`).
- `task_title` is joined via an in-memory lookup map from `project_task.title` — no N+1 queries.
- Receipts are ordered by `created_at DESC` (newest first).
- Pagination meta uses `total_pages` (not `pages`).
- `limit` is capped at 100 regardless of the value sent by the client (`Math.min(query.limit, 100)`).
- Deleted tasks (`deleted_at IS NOT NULL`) are excluded from the task lookup, so their receipts won't have `task_title` populated (but the receipts themselves are still returned if they match the where clause).
- `is_categorized` query param is transformed from string `"true"`/`"false"` to boolean via `@Transform()`.

---

## 5. GET /projects/:projectId/financial/workforce

**Workforce Summary**

Returns a consolidated workforce financial view: crew hours by member, crew payments by member, and subcontractor invoice/payment activity by subcontractor. Uses `findMany` + JavaScript aggregation because Prisma `groupBy` cannot include cross-relation joins.

### Authentication
- **Required**: Yes (Bearer token)
- **Roles**: `Owner`, `Admin`, `Manager`, `Bookkeeper`

### Path Parameters

| Name | Type | Description |
|------|------|-------------|
| `projectId` | string (UUID) | The project's unique identifier |

### Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `date_from` | string (ISO 8601 date) | No | — | Filter start date |
| `date_to` | string (ISO 8601 date) | No | — | Filter end date |

**Date filter behavior per data section:**

| Data Section | Date Field Filtered | Filtered? |
|--------------|-------------------|-----------|
| Crew hour logs | `log_date` | Yes |
| Crew payments | `payment_date` | Yes |
| Subcontractor invoices | — | **No** (always returns all invoices for project) |
| Subcontractor payments | `payment_date` | Yes |

### Response Body

```json
{
  "project_id": "string (uuid)",
  "crew_hours": {
    "total_regular_hours": "number",
    "total_overtime_hours": "number",
    "total_hours": "number",
    "by_crew_member": [
      {
        "crew_member_id": "string (uuid)",
        "crew_member_name": "string",
        "regular_hours": "number",
        "overtime_hours": "number",
        "total_hours": "number",
        "log_count": "number (integer)"
      }
    ]
  },
  "crew_payments": {
    "total_paid": "number",
    "payment_count": "number (integer)",
    "by_crew_member": [
      {
        "crew_member_id": "string (uuid)",
        "crew_member_name": "string",
        "total_paid": "number",
        "payment_count": "number (integer)",
        "last_payment_date": "string (ISO 8601) | null"
      }
    ]
  },
  "subcontractor_invoices": {
    "total_invoiced": "number",
    "total_paid": "number",
    "outstanding": "number",
    "by_subcontractor": [
      {
        "subcontractor_id": "string (uuid)",
        "subcontractor_name": "string",
        "invoiced": "number",
        "paid": "number",
        "outstanding": "number",
        "invoice_count": "number (integer)",
        "pending_invoices": "number (integer)",
        "approved_invoices": "number (integer)",
        "paid_invoices": "number (integer)"
      }
    ]
  }
}
```

### Field Descriptions — Workforce

| Field | Type | Description |
|-------|------|-------------|
| `crew_member_name` | string | Constructed as `first_name + ' ' + last_name` from the crew member record. |
| `subcontractor_name` | string | From `subcontractor.business_name`. |
| `outstanding` | number | `invoiced - paid`. Calculated per-subcontractor and at the total level. |
| `pending_invoices` | integer | Count of invoices with `status = 'pending'`. |
| `approved_invoices` | integer | Count of invoices with `status = 'approved'`. |
| `paid_invoices` | integer | Count of invoices with `status = 'paid'`. |
| `last_payment_date` | string \| null | Most recent `payment_date` for this crew member on this project. |
| `log_count` | integer | Number of hour log entries for this crew member on this project. |

### Example Request

```bash
curl -s "http://localhost:8000/api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/financial/workforce?date_from=2025-01-01&date_to=2025-06-30" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Example Response

```json
{
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "crew_hours": {
    "total_regular_hours": 320,
    "total_overtime_hours": 24.5,
    "total_hours": 344.5,
    "by_crew_member": [
      {
        "crew_member_id": "crew-uuid-001",
        "crew_member_name": "James Wilson",
        "regular_hours": 160,
        "overtime_hours": 12,
        "total_hours": 172,
        "log_count": 20
      },
      {
        "crew_member_id": "crew-uuid-002",
        "crew_member_name": "David Chen",
        "regular_hours": 160,
        "overtime_hours": 12.5,
        "total_hours": 172.5,
        "log_count": 20
      }
    ]
  },
  "crew_payments": {
    "total_paid": 18500,
    "payment_count": 4,
    "by_crew_member": [
      {
        "crew_member_id": "crew-uuid-001",
        "crew_member_name": "James Wilson",
        "total_paid": 9600,
        "payment_count": 2,
        "last_payment_date": "2025-05-15T00:00:00.000Z"
      },
      {
        "crew_member_id": "crew-uuid-002",
        "crew_member_name": "David Chen",
        "total_paid": 8900,
        "payment_count": 2,
        "last_payment_date": "2025-05-15T00:00:00.000Z"
      }
    ]
  },
  "subcontractor_invoices": {
    "total_invoiced": 12000,
    "total_paid": 8000,
    "outstanding": 4000,
    "by_subcontractor": [
      {
        "subcontractor_id": "sub-uuid-001",
        "subcontractor_name": "Premier Plumbing LLC",
        "invoiced": 8000,
        "paid": 8000,
        "outstanding": 0,
        "invoice_count": 2,
        "pending_invoices": 0,
        "approved_invoices": 0,
        "paid_invoices": 2
      },
      {
        "subcontractor_id": "sub-uuid-002",
        "subcontractor_name": "Ace Electrical Services",
        "invoiced": 4000,
        "paid": 0,
        "outstanding": 4000,
        "invoice_count": 1,
        "pending_invoices": 1,
        "approved_invoices": 0,
        "paid_invoices": 0
      }
    ]
  }
}
```

### Business Rules

- `crew_member_name` is constructed as `first_name + ' ' + last_name`.
- `subcontractor_name` is `business_name` from the subcontractor record.
- `outstanding` = `invoiced` − `paid` (at both the per-subcontractor and total levels).
- Date filters apply to `log_date` for crew hours, `payment_date` for crew and subcontractor payments.
- **Subcontractor invoices are NOT date-filtered** — all invoices for the project are always returned.
- All monetary totals are rounded to 2 decimal places.
- All hour totals are rounded to 2 decimal places.
- Invoice status breakdown counts: `pending_invoices`, `approved_invoices`, `paid_invoices`.

---

## Known Gaps (Documented)

### Revenue Data Not Available
The Invoicing Module has not been built yet. The following data is **not available** in the summary endpoint:

- Total invoiced to client
- Total collected from client
- Outstanding client balance
- Revenue-to-cost ratio

The `revenue_note` field in the summary response documents this gap:
> "Revenue data (invoiced amount, collected amount) will be available after the Invoicing Module is implemented."

This will be resolved when the Invoicing Module (Sprint 9) is built. At that point, the summary endpoint will be extended to include revenue intelligence fields.

---

## Appendix: DTO Definitions (from source code)

### ProjectDateFilterDto
Used by: summary, timeline, workforce endpoints.
```typescript
class ProjectDateFilterDto {
  date_from?: string;  // @IsOptional() @IsDateString() — "YYYY-MM-DD"
  date_to?: string;    // @IsOptional() @IsDateString() — "YYYY-MM-DD"
}
```

### ProjectTaskBreakdownQueryDto
Used by: tasks endpoint. Extends `ProjectDateFilterDto`.
```typescript
class ProjectTaskBreakdownQueryDto extends ProjectDateFilterDto {
  sort_by?: 'total_cost' | 'task_title';   // Default: 'total_cost'
  sort_order?: 'asc' | 'desc';             // Default: 'desc'
}
```

### ProjectReceiptsQueryDto
Used by: receipts endpoint.
```typescript
class ProjectReceiptsQueryDto {
  is_categorized?: boolean;                          // @Transform string→boolean
  ocr_status?: 'not_processed' | 'processing' | 'complete' | 'failed';
  page?: number;   // Default: 1, Min: 1
  limit?: number;  // Default: 20, Min: 1, Max: 100
}
```
