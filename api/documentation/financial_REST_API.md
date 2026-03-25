# Lead360 Financial Module — Complete REST API Documentation

**STATUS: VERIFIED BY DOCUMENTATION AGENT — 2026-03-25**
**Verified against live API responses on port 8000**

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Base URL & Common Patterns](#2-base-url--common-patterns)
3. [Error Handling](#3-error-handling)
4. [Enum Reference](#4-enum-reference)
5. [Financial Categories](#5-financial-categories)
6. [Financial Entries](#6-financial-entries)
7. [Receipts & OCR](#7-receipts--ocr)
8. [Payment Method Registry](#8-payment-method-registry)
9. [Suppliers](#9-suppliers)
10. [Supplier Categories](#10-supplier-categories)
11. [Supplier Products](#11-supplier-products)
12. [Recurring Expense Rules](#12-recurring-expense-rules)
13. [Draw Milestones](#13-draw-milestones)
14. [Project Invoices](#14-project-invoices)
15. [Project Financial Summary](#15-project-financial-summary)
16. [Task-Level Financial Operations](#16-task-level-financial-operations)
17. [Crew Hour Logs](#17-crew-hour-logs)
18. [Crew Payments](#18-crew-payments)
19. [Subcontractor Invoices](#19-subcontractor-invoices)
20. [Subcontractor Payments](#20-subcontractor-payments)
21. [Financial Dashboard](#21-financial-dashboard)
22. [Account Mappings (Export Config)](#22-account-mappings-export-config)
23. [Accounting Exports](#23-accounting-exports)
24. [Role-Based Access Control Matrix](#24-role-based-access-control-matrix)

---

## 1. Authentication

Every endpoint requires a JWT Bearer token (except login).

### How to Get a Token

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "your@email.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "email": "contact@honeydo4you.com",
    "first_name": "Ludson",
    "last_name": "Menezes",
    "phone": "+19786484845",
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "roles": ["Owner"],
    "is_platform_admin": false,
    "email_verified": true,
    "last_login_at": "2026-03-25T04:06:29.401Z",
    "created_at": "2026-01-02T18:27:05.674Z"
  }
}
```

### Using the Token

Add this header to EVERY request:
```
Authorization: Bearer eyJhbG...your-token-here
```

The token expires in 24 hours. You do NOT send `tenant_id` — it is extracted from the token automatically.

---

## 2. Base URL & Common Patterns

| Environment | Base URL |
|-------------|----------|
| Production  | `https://api.lead360.app/api/v1` |
| Local Dev   | `http://localhost:8000/api/v1` |

### Pagination Pattern

All list endpoints that support pagination use this query string format:

```
?page=1&limit=20
```

**Paginated Response Shape:**
```json
{
  "data": [ ...items... ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "total_pages": 3
  }
}
```

> **Pagination field naming varies by endpoint:**
> - **`total_pages`** (snake_case): Financial entries, pending entries, recurring rules, export history, project financial receipts
> - **`pages`**: Suppliers, receipts, crew hours, crew payments, subcontractor invoices, subcontractor payments
> - **`totalPages`** (camelCase): Project invoices
>
> All three mean the same thing — the total number of pages. Check the example response for each endpoint to see which name it uses.

### Sorting Pattern

Endpoints that support sorting:
```
?sort_by=entry_date&sort_order=desc
```

### Date Filtering

```
?date_from=2026-01-01&date_to=2026-03-31
```

Dates must be in ISO 8601 format: `YYYY-MM-DD`

---

## 3. Error Handling

All errors follow this format:

### 401 Unauthorized (No Token or Expired Token)
```json
{
  "statusCode": 401,
  "errorCode": "SERVER_INTERNAL_ERROR",
  "message": "Unauthorized",
  "error": "Unauthorized",
  "timestamp": "2026-03-25T05:03:24.378Z",
  "path": "/api/v1/financial/entries",
  "requestId": "req_273614531be5c6f2"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Financial entry not found",
  "error": "Not Found",
  "timestamp": "2026-03-25T05:03:24.448Z",
  "path": "/api/v1/financial/entries/00000000-0000-0000-0000-000000000000",
  "requestId": "req_8dfcd3ea1704e7c1"
}
```

### 400 Validation Error
```json
{
  "statusCode": 400,
  "errorCode": "SERVER_INTERNAL_ERROR",
  "message": "category_id must be a UUID, entry_type must be expense or income, Amount must be greater than 0, entry_date must be a valid ISO 8601 date string",
  "error": "Bad Request",
  "timestamp": "2026-03-25T05:03:24.500Z",
  "path": "/api/v1/financial/entries",
  "requestId": "req_8ca5ceb73622d776"
}
```

### 403 Forbidden (Wrong Role)
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

**Every error has:** `statusCode`, `message`, `error`, `timestamp`, `path`, `requestId`

---

## 4. Enum Reference

These are the exact string values the API accepts and returns. Use them exactly as shown (lowercase).

### payment_method
```
"cash" | "check" | "bank_transfer" | "venmo" | "zelle" | "credit_card" | "debit_card" | "ACH"
```

### financial_category_type
```
"labor" | "material" | "subcontractor" | "equipment" | "insurance" | "fuel" | "utilities" | "office" | "marketing" | "taxes" | "tools" | "other"
```

### financial_category_classification
```
"cost_of_goods_sold" | "operating_expense"
```

### financial_entry_type
```
"expense" | "income"
```

### expense_submission_status
```
"pending_review" | "confirmed"
```

### recurring_frequency
```
"daily" | "weekly" | "monthly" | "quarterly" | "annual"
```

### recurring_rule_status
```
"active" | "paused" | "completed" | "cancelled"
```

### receipt_file_type
```
"photo" | "pdf"
```

### receipt_ocr_status
```
"not_processed" | "processing" | "complete" | "failed"
```

### milestone_status
```
"pending" | "invoiced" | "paid"
```

### invoice_status_extended
```
"draft" | "sent" | "partial" | "paid" | "voided"
```

### export_type
```
"quickbooks_expenses" | "quickbooks_invoices" | "xero_expenses" | "xero_invoices" | "pl_csv" | "entries_csv"
```

### accounting_platform
```
"quickbooks" | "xero"
```

### subcontractor_invoice_status
```
"pending" | "approved" | "paid"
```

### draw_calculation_type
```
"percentage" | "fixed_amount"
```

---

## 5. Financial Categories

Categories organize expenses and income into logical buckets (e.g., "Labor - General", "Materials - General"). Every tenant starts with 16 system default categories. You can create custom ones too.

### 5.1 List All Categories

```
GET /api/v1/settings/financial-categories
```

**Roles:** Owner, Admin, Manager

**Response:** Array of category objects (not paginated — returns ALL active categories)

```json
[
  {
    "id": "5dc27901-7451-41cd-9da8-474c10c59869",
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "name": "Labor - Crew Overtime",
    "type": "labor",
    "classification": "cost_of_goods_sold",
    "description": null,
    "is_active": true,
    "is_system_default": true,
    "created_by_user_id": null,
    "created_at": "2026-03-12T22:42:58.797Z",
    "updated_at": "2026-03-12T22:42:58.797Z"
  },
  {
    "id": "544e9edb-2293-11f1-9abf-50e8d4ae7953",
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "name": "Insurance",
    "type": "insurance",
    "classification": "operating_expense",
    "description": null,
    "is_active": true,
    "is_system_default": true,
    "created_by_user_id": null,
    "created_at": "2026-03-18T06:26:00.000Z",
    "updated_at": "2026-03-18T06:26:00.000Z"
  }
]
```

**Category Response Fields:**

| Field | Type | Always Present | Description |
|-------|------|---------------|-------------|
| id | string (UUID) | Yes | Unique identifier |
| tenant_id | string (UUID) | Yes | Tenant this belongs to |
| name | string | Yes | Display name (e.g., "Labor - General") |
| type | string (enum) | Yes | One of: labor, material, subcontractor, equipment, insurance, fuel, utilities, office, marketing, taxes, tools, other |
| classification | string (enum) | Yes | "cost_of_goods_sold" or "operating_expense" |
| description | string or null | Yes | Optional description |
| is_active | boolean | Yes | Whether category is usable |
| is_system_default | boolean | Yes | true = cannot be deleted or have classification changed |
| created_by_user_id | string (UUID) or null | Yes | null for system defaults |
| created_at | string (ISO 8601) | Yes | When created |
| updated_at | string (ISO 8601) | Yes | When last updated |

### 5.2 Create a Category

```
POST /api/v1/settings/financial-categories
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | Yes | Max 200 chars | Category name |
| type | string (enum) | Yes | Must be valid category type | See enum list above |
| classification | string (enum) | No | Default: "cost_of_goods_sold" | "cost_of_goods_sold" or "operating_expense" |
| description | string | No | - | Optional description |

**Example Request:**
```json
{
  "name": "Equipment Fuel",
  "type": "fuel",
  "classification": "operating_expense",
  "description": "Fuel costs for heavy equipment on job sites"
}
```

**Response:** The created category object (same shape as list item above)

### 5.3 Update a Category

```
PATCH /api/v1/settings/financial-categories/:id
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager

**URL Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| id | UUID | The category ID |

**Request Body (all fields optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| name | string | Max 200 chars | New name |
| description | string | - | New description |
| classification | string (enum) | "cost_of_goods_sold" or "operating_expense" | New classification (BLOCKED for system defaults) |

**Important:** You CANNOT change the `classification` of a system default category (where `is_system_default: true`). The API will return an error.

**Response:** Updated category object

### 5.4 Deactivate (Delete) a Category

```
DELETE /api/v1/settings/financial-categories/:id
```

**Roles:** Owner, Admin, Manager

This is a **soft delete** — it sets `is_active: false`. The category still exists in the database but won't appear in lists.

**Important:** System default categories (`is_system_default: true`) CANNOT be deactivated. The API will return an error.

**Response:** The deactivated category (with `is_active: false`)

---

## 6. Financial Entries

Financial entries are the core of the financial module. Every expense or income record is a financial entry. Entries can optionally be linked to a project, task, supplier, payment method, and receipts.

### 6.1 Create a Financial Entry

```
POST /api/v1/financial/entries
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Employee

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| category_id | string (UUID) | **Yes** | Must be valid, active category | Which expense/income category |
| entry_type | string | **Yes** | "expense" or "income" | Type of entry |
| amount | number | **Yes** | Min 0.01, max 2 decimal places | Dollar amount |
| entry_date | string | **Yes** | ISO 8601 date (YYYY-MM-DD) | When the expense/income occurred |
| project_id | string (UUID) | No | Must exist | Link to a project |
| task_id | string (UUID) | No | Must exist, project_id required | Link to a task within the project |
| tax_amount | number | No | Min 0, max 2 decimal places, must be < amount | Tax portion of the amount |
| entry_time | string | No | Max 8 chars (HH:MM:SS format) | Time of entry |
| vendor_name | string | No | Max 200 chars | Free-text vendor name |
| supplier_id | string (UUID) | No | Must exist | Link to registered supplier |
| payment_method | string (enum) | No | Valid payment_method enum | How payment was made |
| payment_method_registry_id | string (UUID) | No | Must exist | Link to registered payment method |
| purchased_by_user_id | string (UUID) | No | Must exist | Which user made the purchase |
| purchased_by_crew_member_id | string (UUID) | No | Must exist | Which crew member made the purchase |
| submission_status | string (enum) | No | "pending_review" or "confirmed" | See business rules below |
| notes | string | No | Max 2000 chars | Free-text notes |

**Business Rules:**

1. **Employee role** always gets `submission_status = "pending_review"` regardless of what they send
2. **Owner/Admin/Manager/Bookkeeper** default to `"confirmed"` but can optionally set `"pending_review"`
3. If `payment_method_registry_id` is provided, the `payment_method` enum is automatically copied from the registry record
4. `purchased_by_user_id` and `purchased_by_crew_member_id` are mutually exclusive — you cannot set both
5. If `supplier_id` is provided, the supplier's `total_spend` and `last_purchase_date` are automatically updated
6. `task_id` requires `project_id` to also be set

**Example Request:**
```json
{
  "category_id": "9955c9c5-a4d6-4a45-b044-539a26e2779b",
  "entry_type": "expense",
  "amount": 542.00,
  "entry_date": "2026-03-17",
  "project_id": "f87e2a4c-a745-45c8-a47d-90f7fc4e8285",
  "task_id": "4dffa994-995d-482a-95ab-6c2cb8b5faa6",
  "payment_method": "credit_card",
  "notes": "Bought lumber for deck framing"
}
```

**Response (201 Created):** An enriched entry object (see 6.3 for full field list)

### 6.2 List Financial Entries

```
GET /api/v1/financial/entries
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Employee

> **Note:** Employees can only see their own entries. Other roles see all entries.

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| page | number | No | 1 | Page number (min: 1) |
| limit | number | No | 20 | Items per page (min: 1, max: 100) |
| project_id | UUID | No | - | Filter by project |
| task_id | UUID | No | - | Filter by task |
| category_id | UUID | No | - | Filter by category |
| category_type | string (enum) | No | - | Filter by category type (e.g., "labor", "material") |
| classification | string (enum) | No | - | "cost_of_goods_sold" or "operating_expense" |
| entry_type | string | No | - | "expense" or "income" |
| supplier_id | UUID | No | - | Filter by supplier |
| payment_method | string (enum) | No | - | Filter by payment method enum |
| submission_status | string | No | - | "pending_review" or "confirmed" |
| purchased_by_user_id | UUID | No | - | Filter by who purchased |
| purchased_by_crew_member_id | UUID | No | - | Filter by crew purchaser |
| date_from | string (date) | No | - | Start date filter |
| date_to | string (date) | No | - | End date filter |
| has_receipt | boolean | No | - | Filter entries with/without receipts |
| is_recurring_instance | boolean | No | - | Filter recurring-generated entries |
| search | string | No | - | Search in vendor_name, notes, category name |
| sort_by | string | No | "entry_date" | "entry_date", "amount", or "created_at" |
| sort_order | string | No | "desc" | "asc" or "desc" |

**Response:**
```json
{
  "data": [
    {
      "id": "cee71acf-f7c8-4a2b-ad83-777161dd4af5",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "project_id": "f87e2a4c-a745-45c8-a47d-90f7fc4e8285",
      "project_name": "Teste",
      "task_id": "4dffa994-995d-482a-95ab-6c2cb8b5faa6",
      "task_title": "Retirar Driveway",
      "category_id": "649dfc7b-80e3-493c-83f3-823308d9cd5a",
      "category_name": "Miscellaneous",
      "category_type": "other",
      "category_classification": "cost_of_goods_sold",
      "entry_type": "expense",
      "amount": "542",
      "tax_amount": null,
      "entry_date": "2026-03-17T00:00:00.000Z",
      "entry_time": null,
      "vendor_name": null,
      "supplier_id": null,
      "supplier_name": null,
      "payment_method": null,
      "payment_method_registry_id": null,
      "payment_method_nickname": null,
      "purchased_by_user_id": null,
      "purchased_by_user_name": null,
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
      "notes": null,
      "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "created_by_name": "Ludson Menezes",
      "created_at": "2026-03-17T01:37:05.205Z",
      "updated_at": "2026-03-17T01:37:05.205Z"
    }
  ],
  "meta": {
    "total": 6,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  },
  "summary": {
    "total_expenses": 2542,
    "total_income": 0,
    "total_tax": 0,
    "entry_count": 6
  }
}
```

### 6.3 Entry Response Fields (Complete)

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | Entry ID |
| tenant_id | string (UUID) | No | Tenant ID |
| project_id | string (UUID) | Yes | Linked project |
| project_name | string | Yes | Project name (enriched) |
| task_id | string (UUID) | Yes | Linked task |
| task_title | string | Yes | Task title (enriched) |
| category_id | string (UUID) | No | Category ID |
| category_name | string | No | Category name (enriched) |
| category_type | string (enum) | No | Category type (enriched) |
| category_classification | string (enum) | No | "cost_of_goods_sold" or "operating_expense" (enriched) |
| entry_type | string | No | "expense" or "income" |
| amount | string (decimal) | No | Dollar amount as string (e.g., "542") |
| tax_amount | string (decimal) | Yes | Tax amount as string |
| entry_date | string (ISO 8601) | No | Date of entry |
| entry_time | string | Yes | Time in HH:MM:SS format |
| vendor_name | string | Yes | Free-text vendor name |
| supplier_id | string (UUID) | Yes | Linked supplier |
| supplier_name | string | Yes | Supplier name (enriched) |
| payment_method | string (enum) | Yes | Payment method enum value |
| payment_method_registry_id | string (UUID) | Yes | Linked payment method |
| payment_method_nickname | string | Yes | Payment method nickname (enriched) |
| purchased_by_user_id | string (UUID) | Yes | User who purchased |
| purchased_by_user_name | string | Yes | User name (enriched) |
| purchased_by_crew_member_id | string (UUID) | Yes | Crew member who purchased |
| purchased_by_crew_member_name | string | Yes | Crew member name (enriched) |
| submission_status | string | No | "pending_review" or "confirmed" |
| rejection_reason | string | Yes | Why entry was rejected |
| rejected_by_user_id | string (UUID) | Yes | Who rejected it |
| rejected_by_name | string | Yes | Rejector name (enriched) |
| rejected_at | string (ISO 8601) | Yes | When rejected |
| is_recurring_instance | boolean | No | Was auto-generated by recurring rule |
| recurring_rule_id | string (UUID) | Yes | Source recurring rule |
| has_receipt | boolean | No | Whether a receipt is attached |
| notes | string | Yes | Free-text notes |
| created_by_user_id | string (UUID) | No | Who created it |
| created_by_name | string | No | Creator name (enriched) |
| created_at | string (ISO 8601) | No | When created |
| updated_at | string (ISO 8601) | No | When last updated |

> **Important:** `amount` and `tax_amount` are returned as **strings** (decimal representation), not numbers. Parse them to numbers on the frontend.

### 6.4 Get Single Entry

```
GET /api/v1/financial/entries/:id
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Employee (own entries only)

**Response:** Single entry object (same fields as 6.3)

### 6.5 Update a Financial Entry

```
PATCH /api/v1/financial/entries/:id
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Employee

**Business Rules:**
- Employees can only edit their own entries that are in `"pending_review"` status
- All fields are optional — send only what you want to change
- To clear a field, send `null` (for nullable fields like `supplier_id`, `payment_method_registry_id`, etc.)

**Request Body (all optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| category_id | string (UUID) | Must exist | New category |
| entry_type | string | "expense" or "income" | New type |
| amount | number | Min 0.01 | New amount |
| tax_amount | number | Min 0 | New tax amount |
| entry_date | string | ISO 8601 | New date |
| entry_time | string | Max 8 chars | New time |
| vendor_name | string | Max 200 chars | New vendor |
| supplier_id | string (UUID) or null | - | New supplier or clear |
| payment_method | string (enum) | Valid enum | New method |
| payment_method_registry_id | string (UUID) or null | - | New registry or clear |
| purchased_by_user_id | string (UUID) or null | - | New purchaser or clear |
| purchased_by_crew_member_id | string (UUID) or null | - | New purchaser or clear |
| notes | string | Max 2000 chars | New notes |

**Response:** Updated enriched entry object

### 6.6 Delete a Financial Entry

```
DELETE /api/v1/financial/entries/:id
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Employee

**Business Rules:**
- **Owner/Admin:** Can delete any entry (confirmed or pending)
- **Manager/Bookkeeper:** CANNOT delete entries (403 Forbidden)
- **Employee:** Can only delete their own `"pending_review"` entries

**Response:**
```json
{
  "message": "Financial entry deleted successfully"
}
```

### 6.7 List Pending Entries (Approval Queue)

```
GET /api/v1/financial/entries/pending
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Returns only entries with `submission_status = "pending_review"`.

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| page | number | No | 1 | Page number |
| limit | number | No | 20 | Items per page (max 100) |
| submitted_by_user_id | UUID | No | - | Filter by who submitted |
| date_from | string | No | - | Start date filter |
| date_to | string | No | - | End date filter |

**Response:** Same shape as list entries (data + meta + summary)

### 6.8 Approve an Entry

```
POST /api/v1/financial/entries/:id/approve
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Changes `submission_status` from `"pending_review"` to `"confirmed"`.

**Request Body (optional):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| notes | string | No | Max 500 chars | Approval notes |

**Business Rules:**
- Only entries with `submission_status = "pending_review"` can be approved
- Historical rejection data (`rejected_at`, `rejection_reason`) is preserved in the confirmed entry for audit trail

**Response:** The approved entry object (now with `submission_status: "confirmed"`)

### 6.9 Reject an Entry

```
POST /api/v1/financial/entries/:id/reject
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| rejection_reason | string | **Yes** | Max 500 chars, cannot be empty | Why the entry is rejected |

**Business Rules:**
- Only entries with `submission_status = "pending_review"` can be rejected
- The `submission_status` stays as `"pending_review"` (it does NOT change to "rejected")
- The entry gets `rejection_reason`, `rejected_by_user_id`, and `rejected_at` populated
- The submitter can then resubmit with corrections

**Response:** The rejected entry object (still `submission_status: "pending_review"` but with rejection fields filled)

### 6.10 Resubmit a Rejected Entry

```
POST /api/v1/financial/entries/:id/resubmit
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Employee

**Request Body (all optional — allows corrections):**

Same fields as Update (6.5) — category_id, entry_type, amount, tax_amount, entry_date, vendor_name, supplier_id, etc.

**Business Rules:**
- Only entries that have been rejected (have `rejected_at` set) can be resubmitted
- Resubmission clears the rejection fields (`rejection_reason`, `rejected_by_user_id`, `rejected_at`)
- The `submission_status` stays as `"pending_review"` for another review cycle
- Optional field updates are applied during resubmission

**Response:** The resubmitted entry (rejection fields cleared)

### 6.11 Export Entries as CSV

```
GET /api/v1/financial/entries/export
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:** Same as List Entries (6.2) — all filters apply

**Response:** CSV file download

**Headers returned:**
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="expenses-2026-03-25.csv"
```

**CSV Columns:**
```
Date,Time,Type,Category,Classification,Project,Task,Supplier,Vendor Name,Amount,Tax Amount,Payment Method,Payment Account,Purchased By,Submitted By,Status,Notes,Created At
```

**Business Rules:**
- Maximum 10,000 rows per export
- Uses the same filters as the list endpoint

---

## 7. Receipts & OCR

Receipts are photos or PDFs of purchase receipts. They can be uploaded standalone or linked to financial entries. The OCR system automatically extracts vendor name, amount, and date from receipt images.

### 7.1 Upload a Receipt

```
POST /api/v1/financial/receipts
Content-Type: multipart/form-data
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Field

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File (binary) | **Yes** | The receipt image or PDF |
| project_id | string (UUID) | No | Link to project |
| task_id | string (UUID) | No | Link to task |
| vendor_name | string | No | Override vendor name (max 200 chars) |
| amount | number | No | Override amount (positive, max 2 decimal places) |
| receipt_date | string | No | Override date (ISO 8601) |

**Accepted File Types:**
- Images: JPEG, PNG, WebP
- Documents: PDF
- Max size: 25 MB

**Response (201 Created):**
```json
{
  "id": "d1f154e0-f547-4872-bb00-bc7373c59fd9",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "project_id": "f87e2a4c-a745-45c8-a47d-90f7fc4e8285",
  "task_id": null,
  "financial_entry_id": null,
  "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/files/dcb91b22-ef3f-4513-9097-23f55fbda240.jpg",
  "file_name": "IMG_0152.jpg",
  "file_type": "photo",
  "file_size_bytes": 2048000,
  "vendor_name": "Ludson",
  "amount": 100,
  "receipt_date": "2026-03-16T00:00:00.000Z",
  "ocr_status": "processing",
  "ocr_vendor": null,
  "ocr_amount": null,
  "ocr_date": null,
  "is_categorized": false,
  "uploaded_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-03-25T05:01:09.000Z",
  "updated_at": "2026-03-25T05:01:09.000Z"
}
```

**What happens after upload:**
1. File is saved to storage
2. Receipt record is created with `ocr_status: "processing"`
3. An async OCR job is enqueued (Google Cloud Vision API)
4. OCR extracts vendor, amount, date from the image
5. When done, `ocr_status` becomes `"complete"` or `"failed"`

### 7.2 List Receipts

```
GET /api/v1/financial/receipts
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| project_id | UUID | **Yes (one of)** | Filter by project |
| task_id | UUID | **Yes (one of)** | Filter by task |
| is_categorized | boolean | No | true/false — filter by linked status |
| page | number | No | Default: 1 |
| limit | number | No | Default: 20 (max 100) |

> **Important:** At least one of `project_id` or `task_id` is required. The API returns 400 if neither is provided.

**Response:**
```json
{
  "data": [
    {
      "id": "d1f154e0-f547-4872-bb00-bc7373c59fd9",
      "project_id": "f87e2a4c-a745-45c8-a47d-90f7fc4e8285",
      "task_id": null,
      "task_title": null,
      "file_url": "/public/14a34ab2-6f6f-4e41-9bea-c444a304557e/files/dcb91b22-ef3f-4513-9097-23f55fbda240.jpg",
      "file_name": "IMG_0152.jpg",
      "file_type": "photo",
      "vendor_name": "Ludson",
      "amount": 100,
      "receipt_date": "2026-03-16T00:00:00.000Z",
      "ocr_status": "not_processed",
      "ocr_vendor": null,
      "ocr_amount": null,
      "ocr_date": null,
      "is_categorized": false,
      "financial_entry_id": null,
      "uploaded_by": {
        "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
        "first_name": "Ludson",
        "last_name": "Menezes"
      },
      "created_at": "2026-03-25T05:00:00.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "total_pages": 1 }
}
```

### 7.3 Get Single Receipt

```
GET /api/v1/financial/receipts/:id
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Response:** Single receipt object with all fields

### 7.4 Check OCR Status

```
GET /api/v1/financial/receipts/:id/ocr-status
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Field (own receipts only)

Use this to poll for OCR completion after uploading a receipt.

**Response:**
```json
{
  "receipt_id": "d1f154e0-f547-4872-bb00-bc7373c59fd9",
  "ocr_status": "complete",
  "ocr_vendor": "Home Depot",
  "ocr_amount": 142.50,
  "ocr_date": "2026-03-15T00:00:00.000Z",
  "has_suggestions": true
}
```

**Possible ocr_status values:**
- `"processing"` — Still running, poll again in a few seconds
- `"complete"` — Done, check `ocr_vendor`, `ocr_amount`, `ocr_date`
- `"failed"` — OCR failed, user can retry or enter manually
- `"not_processed"` — Not yet submitted for processing

### 7.5 Create Entry from Receipt

```
POST /api/v1/financial/receipts/:id/create-entry
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Field

Creates a financial entry pre-populated from OCR results (with user overrides).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| project_id | string (UUID) | **Yes** | Target project |
| task_id | string (UUID) | No | Target task |
| category_id | string (UUID) | **Yes** | Expense category |
| amount | number | No | Override OCR amount (min 0.01) |
| tax_amount | number | No | Tax amount |
| entry_date | string | No | Override OCR date |
| entry_time | string | No | Time |
| vendor_name | string | No | Override OCR vendor |
| supplier_id | string (UUID) | No | Link supplier |
| payment_method | string (enum) | No | Payment method |
| payment_method_registry_id | string (UUID) | No | Payment registry |
| purchased_by_user_id | string (UUID) | No | Purchaser user |
| purchased_by_crew_member_id | string (UUID) | No | Purchaser crew |
| crew_member_id | string (UUID) | No | Legacy field |
| subcontractor_id | string (UUID) | No | Link subcontractor |
| submission_status | string | No | Default: "confirmed" |
| notes | string | No | Max 2000 chars |

**Business Rules:**
- If `amount` is not provided, uses `ocr_amount` from OCR results; fails if neither exists
- If `vendor_name` is not provided, uses `ocr_vendor`
- If `entry_date` is not provided, uses `ocr_date`, then falls back to receipt's `receipt_date`
- Links the receipt to the created entry automatically
- Sets `receipt.is_categorized = true` and `entry.has_receipt = true`

**Response (201 Created):**
```json
{
  "entry": { "...enriched entry object..." },
  "receipt": { "...updated receipt object..." }
}
```

### 7.6 Retry OCR

```
POST /api/v1/financial/receipts/:id/retry-ocr
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Re-queues the OCR job for a receipt. Only works on receipts with `ocr_status` of `"failed"` or `"not_processed"`.

**Response:** Updated receipt object with `ocr_status: "processing"`

### 7.7 Link Receipt to Existing Entry

```
PATCH /api/v1/financial/receipts/:id/link
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Links an already-uploaded receipt to an existing financial entry.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| financial_entry_id | string (UUID) | **Yes** | The entry to link to |

**Business Rules:**
- One-to-one: a receipt can only be linked to one entry
- Sets `receipt.is_categorized = true` and `entry.has_receipt = true`

**Response:** Updated receipt object

### 7.8 Update Receipt Metadata

```
PATCH /api/v1/financial/receipts/:id
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body (all optional):**

| Field | Type | Description |
|-------|------|-------------|
| vendor_name | string or null | New vendor name (max 200 chars) |
| amount | number or null | New amount |
| receipt_date | string or null | New date |

**Response:** Updated receipt object

---

## 8. Payment Method Registry

Named payment methods/accounts (e.g., "Chase Business Checking", "Company Visa") that can be linked to financial entries for tracking which account was used.

### 8.1 List Payment Methods

```
GET /api/v1/financial/payment-methods
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Sales, Employee

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| is_active | boolean | true | Filter by active/inactive |
| type | string (enum) | - | Filter by payment method type |

**Response:** Flat array (NOT paginated)
```json
[
  {
    "id": "c9243859-0070-4826-af02-3a8bab3caeb7",
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "nickname": "Test Visa Sprint35",
    "type": "credit_card",
    "bank_name": "Test Bank",
    "last_four": "9999",
    "notes": null,
    "is_default": true,
    "is_active": true,
    "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "updated_by_user_id": null,
    "created_at": "2026-03-19T20:17:54.161Z",
    "updated_at": "2026-03-20T04:00:56.852Z",
    "usage_count": 1,
    "last_used_date": "2026-03-15T00:00:00.000Z"
  }
]
```

**Payment Method Response Fields:**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | Method ID |
| tenant_id | string (UUID) | No | Tenant |
| nickname | string | No | Display name (e.g., "Chase Business Visa") |
| type | string (enum) | No | payment_method enum |
| bank_name | string | Yes | Bank name |
| last_four | string | Yes | Last 4 digits of card/account |
| notes | string | Yes | Notes |
| is_default | boolean | No | Is this the default method |
| is_active | boolean | No | Is this method active |
| created_by_user_id | string (UUID) | No | Creator |
| updated_by_user_id | string (UUID) | Yes | Last updater |
| created_at | string (ISO 8601) | No | Created |
| updated_at | string (ISO 8601) | No | Updated |
| usage_count | number | No | How many entries use this method (enriched) |
| last_used_date | string (ISO 8601) | Yes | When last used (enriched) |

### 8.2 Create a Payment Method

```
POST /api/v1/financial/payment-methods
Content-Type: application/json
```

**Roles:** Owner, Admin, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| nickname | string | **Yes** | Max 100 chars, not empty | Display name |
| type | string (enum) | **Yes** | Valid payment_method | Type of method |
| bank_name | string | No | Max 100 chars | Bank name |
| last_four | string | No | Exactly 4 digits (`/^\d{4}$/`) | Last 4 of card/account |
| notes | string | No | - | Notes |
| is_default | boolean | No | Default: false | Set as default |

**Business Rules:**
- Max 50 active payment methods per tenant
- Nickname must be unique within tenant (case-insensitive)
- Setting `is_default: true` automatically clears the previous default

**Response (201 Created):** Payment method object

### 8.3 Get Single Payment Method

```
GET /api/v1/financial/payment-methods/:id
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Sales, Employee

**Response:** Single payment method object with usage_count and last_used_date

### 8.4 Update a Payment Method

```
PATCH /api/v1/financial/payment-methods/:id
Content-Type: application/json
```

**Roles:** Owner, Admin, Bookkeeper

**Request Body (all optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| nickname | string | Max 100 chars | New nickname |
| type | string (enum) | Valid enum | New type |
| bank_name | string | Max 100 chars | New bank |
| last_four | string | Exactly 4 digits | New last four |
| notes | string | - | New notes |
| is_active | boolean | - | Activate/deactivate |

**Response:** Updated payment method object

### 8.5 Delete (Soft) a Payment Method

```
DELETE /api/v1/financial/payment-methods/:id
```

**Roles:** Owner, Admin

Soft deletes by setting `is_active: false`. If the deleted method was the default, the default is cleared.

**Response:** Deactivated payment method object

### 8.6 Set as Default

```
POST /api/v1/financial/payment-methods/:id/set-default
```

**Roles:** Owner, Admin, Bookkeeper

Sets this payment method as the default. Clears any previous default.

**Response:** Updated payment method object (with `is_default: true`)

---

## 9. Suppliers

Suppliers (vendors) represent companies you buy from. They track spend totals, have addresses with optional Google Maps integration, and can be organized into categories.

### 9.1 List Suppliers

```
GET /api/v1/financial/suppliers
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Sales, Employee

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |
| search | string | - | Search by name, legal_name, contact_name |
| category_id | UUID | - | Filter by supplier category |
| is_active | boolean | true | Filter active/inactive |
| is_preferred | boolean | - | Filter preferred suppliers |
| sort_by | string | - | "name", "total_spend", "last_purchase_date", "created_at" |
| sort_order | string | - | "asc" or "desc" |

**Response:**
```json
{
  "data": [
    {
      "id": "49b8f63f-6e13-4e0f-b0a9-327cef67f721",
      "name": "Status Check Supplier",
      "legal_name": null,
      "phone": null,
      "email": null,
      "contact_name": null,
      "city": null,
      "state": null,
      "is_preferred": false,
      "is_active": true,
      "total_spend": "0",
      "last_purchase_date": null,
      "categories": [],
      "product_count": 0,
      "created_at": "2026-03-19T04:47:13.564Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 2, "pages": 1 }
}
```

### 9.2 Get Single Supplier (Full Detail)

```
GET /api/v1/financial/suppliers/:id
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Sales, Employee

**Response:**
```json
{
  "id": "49b8f63f-6e13-4e0f-b0a9-327cef67f721",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "name": "Status Check Supplier",
  "legal_name": null,
  "website": null,
  "phone": null,
  "email": null,
  "contact_name": null,
  "address_line1": null,
  "address_line2": null,
  "city": null,
  "state": null,
  "zip_code": null,
  "country": "US",
  "latitude": null,
  "longitude": null,
  "google_place_id": null,
  "notes": null,
  "is_preferred": false,
  "is_active": true,
  "total_spend": "0",
  "last_purchase_date": null,
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "updated_by_user_id": null,
  "created_at": "2026-03-19T04:47:13.564Z",
  "updated_at": "2026-03-19T04:47:13.564Z",
  "products": [],
  "created_by": {
    "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "first_name": "Ludson",
    "last_name": "Menezes"
  },
  "categories": []
}
```

### 9.3 Create a Supplier

```
POST /api/v1/financial/suppliers
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | **Yes** | 1-200 chars | Supplier name |
| legal_name | string | No | Max 200 chars | Legal business name |
| website | string | No | Max 500 chars | Website URL |
| phone | string | No | Max 20 chars | Phone number |
| email | string | No | Must be valid email | Email address |
| contact_name | string | No | Max 150 chars | Contact person |
| address_line1 | string | No | Max 255 chars | Street address |
| address_line2 | string | No | Max 255 chars | Apt/suite |
| city | string | No | Max 100 chars | City |
| state | string | No | Exactly 2 uppercase letters (`/^[A-Z]{2}$/`) | State code |
| zip_code | string | No | 5 or 9 digits (`/^\d{5}(-\d{4})?$/`) | ZIP code |
| country | string | No | 2 chars, default "US" | Country code |
| latitude | number | No | -90 to 90 | Latitude |
| longitude | number | No | -180 to 180 | Longitude |
| google_place_id | string | No | Max 255 chars | Google Places ID |
| notes | string | No | - | Notes |
| is_preferred | boolean | No | Default: false | Mark as preferred |
| category_ids | array of UUIDs | No | Must be valid category IDs | Assign categories |

**Business Rules:**
- Name must be unique within tenant (case-insensitive)
- If address fields are provided, Google Maps geocoding may resolve lat/lng automatically

**Response (201 Created):** Full supplier detail object

### 9.4 Update a Supplier

```
PATCH /api/v1/financial/suppliers/:id
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:** Same as create (all optional), plus:

| Field | Type | Description |
|-------|------|-------------|
| is_active | boolean | Reactivate or deactivate |

### 9.5 Delete a Supplier

```
DELETE /api/v1/financial/suppliers/:id
```

**Roles:** Owner, Admin, Bookkeeper

### 9.6 Get Supplier Map Data

```
GET /api/v1/financial/suppliers/map
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Sales, Employee

Returns suppliers that have latitude/longitude coordinates, for displaying on a map.

### 9.7 Get Supplier Statistics

```
GET /api/v1/financial/suppliers/:id/statistics
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Sales, Employee

**Response:**
```json
{
  "supplier_id": "49b8f63f-6e13-4e0f-b0a9-327cef67f721",
  "total_spend": 0,
  "transaction_count": 0,
  "last_purchase_date": null,
  "first_purchase_date": null,
  "spend_by_category": [],
  "spend_by_month": []
}
```

---

## 10. Supplier Categories

Organize suppliers into groups (e.g., "Roofing Supplies", "Electrical", "Plumbing").

### 10.1 List Supplier Categories

```
GET /api/v1/financial/supplier-categories
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Sales, Employee

**Query Parameters:** `is_active` (boolean, optional)

**Response:** Flat array (not paginated)
```json
[
  {
    "id": "b3d6378c-613f-47f6-839f-749630d75e69",
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "name": "Roofing Supplies",
    "description": "Shingles, underlayment, flashing",
    "color": "#EF4444",
    "is_active": true,
    "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "created_at": "2026-03-19T04:44:14.981Z",
    "updated_at": "2026-03-19T04:47:00.738Z",
    "supplier_count": 0
  }
]
```

### 10.2 Create a Supplier Category

```
POST /api/v1/financial/supplier-categories
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | **Yes** | 1-100 chars | Category name |
| description | string | No | Max 2000 chars | Description |
| color | string | No | Hex format (`/^#[0-9A-Fa-f]{6}$/`) | Display color |

**Business Rules:** Max 50 active categories per tenant. Name must be unique (case-insensitive).

### 10.3 Update a Supplier Category

```
PATCH /api/v1/financial/supplier-categories/:id
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Optional fields: name, description, color, is_active

### 10.4 Delete a Supplier Category

```
DELETE /api/v1/financial/supplier-categories/:id
```

**Roles:** Owner, Admin, Bookkeeper. Cannot delete if suppliers are assigned.

---

## 11. Supplier Products

Products/materials tracked per supplier with pricing and automatic price history.

### 11.1 List Supplier Products

```
GET /api/v1/financial/suppliers/:supplierId/products
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Sales, Employee

**URL Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| supplierId | UUID | The supplier ID |

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| is_active | boolean | - | Filter active/inactive products |

**Response:** Flat array (not paginated), ordered by name
```json
[
  {
    "id": "a1b2c3d4-...",
    "tenant_id": "14a34ab2-...",
    "supplier_id": "49b8f63f-...",
    "name": "2x4 Lumber 8ft",
    "description": "Kiln-dried framing lumber",
    "unit_of_measure": "each",
    "unit_price": "5.9900",
    "price_last_updated_at": "2026-03-20T00:00:00.000Z",
    "price_last_updated_by_user_id": "32cd6d0d-...",
    "sku": "LBR-2x4-8",
    "is_active": true,
    "created_by_user_id": "32cd6d0d-...",
    "created_at": "2026-03-19T04:47:13.564Z",
    "updated_at": "2026-03-20T12:00:00.000Z"
  }
]
```

> **Note:** `unit_price` is returned as a **string** (decimal), not a number. Parse it on the frontend.

### 11.2 Create a Product

```
POST /api/v1/financial/suppliers/:supplierId/products
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | **Yes** | 1-200 chars | Product name |
| description | string | No | - | Description |
| unit_of_measure | string | **Yes** | 1-50 chars | Unit (e.g., "each", "bag", "sq ft", "gallon") |
| unit_price | number | No | Min 0, max 4 decimal places | Price per unit |
| sku | string | No | Max 100 chars | SKU/part number |

**Example Request:**
```json
{
  "name": "2x4 Lumber 8ft",
  "description": "Kiln-dried framing lumber",
  "unit_of_measure": "each",
  "unit_price": 5.99,
  "sku": "LBR-2x4-8"
}
```

**Business Rules:**
- Product name must be unique per supplier (case-insensitive)
- If `unit_price` is provided, a price history record is automatically created

**Response (201 Created):** Product object (same shape as list item)

### 11.3 Update a Product

```
PATCH /api/v1/financial/suppliers/:supplierId/products/:productId
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body (all optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| name | string | 1-200 chars | New name |
| description | string | - | New description |
| unit_of_measure | string | 1-50 chars | New unit |
| unit_price | number | Min 0, max 4 decimal places | New price |
| sku | string | Max 100 chars | New SKU |
| is_active | boolean | - | Activate/deactivate |

**Business Rules:** If `unit_price` changes, a price history record is automatically created with the old and new prices.

**Example Request:**
```json
{
  "unit_price": 6.49
}
```

**Response:** Updated product object

### 11.4 Delete a Product

```
DELETE /api/v1/financial/suppliers/:supplierId/products/:productId
```

**Roles:** Owner, Admin, Bookkeeper

### 11.5 Get Price History

```
GET /api/v1/financial/suppliers/:supplierId/products/:productId/price-history
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Sales, Employee

**Response:** Array ordered by `changed_at` descending
```json
[
  {
    "id": "e5f6g7h8-...",
    "previous_price": "5.9900",
    "new_price": "6.4900",
    "changed_by": {
      "id": "32cd6d0d-...",
      "first_name": "Ludson",
      "last_name": "Menezes"
    },
    "changed_at": "2026-03-20T12:00:00.000Z",
    "notes": null
  }
]
```

---

## 12. Recurring Expense Rules

Automate predictable recurring expenses like insurance, subscriptions, rent, equipment leases, etc. Rules generate financial entries on a schedule (daily at 2:00 AM server time).

### 12.1 List Recurring Rules

```
GET /api/v1/financial/recurring-rules
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |
| status | string | "active" | "active", "paused", "completed", "cancelled" |
| category_id | UUID | - | Filter by category |
| frequency | string | - | "daily", "weekly", "monthly", "quarterly", "annual" |
| sort_by | string | "next_due_date" | "next_due_date", "amount", "name", "created_at" |
| sort_order | string | "asc" | "asc" or "desc" |

**Response:**
```json
{
  "data": [
    {
      "id": "r1r2r3r4-...",
      "tenant_id": "14a34ab2-...",
      "name": "Office Rent",
      "description": "Monthly office lease",
      "category_id": "544ea101-...",
      "amount": "2500.00",
      "tax_amount": null,
      "supplier_id": null,
      "vendor_name": "ABC Properties",
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
      "created_by_user_id": "32cd6d0d-...",
      "updated_by_user_id": null,
      "created_at": "2026-03-25T05:00:00.000Z",
      "updated_at": "2026-03-25T05:00:00.000Z",
      "category": { "id": "544ea101-...", "name": "Office & Admin", "type": "office" },
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
    "total_active_rules": 1,
    "monthly_obligation": 2500
  }
}
```

### 12.2 Create a Recurring Rule

```
POST /api/v1/financial/recurring-rules
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | **Yes** | Max 200 chars, not empty | Rule name |
| category_id | string (UUID) | **Yes** | Must exist and be active | Expense category |
| amount | number | **Yes** | Min 0.01, max 2 decimal places | Amount per occurrence |
| frequency | string | **Yes** | "daily", "weekly", "monthly", "quarterly", "annual" | How often |
| start_date | string | **Yes** | ISO 8601, must be >= today | When to start generating |
| description | string | No | - | Description |
| tax_amount | number | No | Min 0, must be < amount | Tax per occurrence |
| supplier_id | string (UUID) | No | Must exist | Link to supplier |
| vendor_name | string | No | Max 200 chars | Free-text vendor name |
| payment_method_registry_id | string (UUID) | No | Must exist | Link to payment method |
| interval | number | No | 1-12, default: 1 | Every N periods |
| day_of_month | number | No | 1-28 | For monthly/quarterly/annual: which day |
| day_of_week | number | No | 0-6 (Sun=0, Sat=6) | For weekly: which day |
| end_date | string | No | ISO 8601, must be > start_date | When to stop |
| recurrence_count | number | No | Min 1 | Stop after N occurrences |
| auto_confirm | boolean | No | Default: true | Auto-confirm generated entries (false = pending_review) |
| notes | string | No | - | Notes |

**Example Request:**
```json
{
  "name": "Office Rent",
  "category_id": "544ea101-2293-11f1-9abf-50e8d4ae7953",
  "amount": 2500.00,
  "frequency": "monthly",
  "day_of_month": 1,
  "start_date": "2026-04-01",
  "auto_confirm": true,
  "vendor_name": "ABC Properties"
}
```

**Business Rules:**
- Max 100 active rules per tenant
- `start_date` must be today or in the future
- If `day_of_month`/`day_of_week` not provided, auto-populated from `start_date`
- `end_date` or `recurrence_count` can limit the rule; without either, it runs indefinitely
- Generated entries inherit all rule fields (category, amount, vendor, etc.)

**Response (201 Created):** Rule object with category, supplier, payment_method relations

### 12.3 Get Single Rule

```
GET /api/v1/financial/recurring-rules/:id
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Response:** Rule object with relations + additional computed fields:
```json
{
  "id": "r1r2r3r4-...",
  "name": "Office Rent",
  "...all rule fields...",
  "category": { "id": "...", "name": "Office & Admin", "type": "office" },
  "supplier": null,
  "payment_method": null,
  "last_generated_entry": {
    "id": "...",
    "amount": "2500.00",
    "entry_date": "2026-04-01T00:00:00.000Z",
    "submission_status": "confirmed"
  },
  "next_occurrence_preview": ["2026-05-01", "2026-06-01", "2026-07-01"]
}
```

### 12.4 Update a Rule

```
PATCH /api/v1/financial/recurring-rules/:id
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

All fields from Create are optional EXCEPT `start_date` (cannot be changed after creation). If you change `frequency` or `interval`, the `next_due_date` is recalculated.

**Example Request:**
```json
{
  "amount": 2750.00,
  "notes": "Rent increased effective May 2026"
}
```

**Response:** Updated rule object with relations

### 12.5 Cancel a Rule

```
DELETE /api/v1/financial/recurring-rules/:id
```

**Roles:** Owner, Admin

Sets `status: "cancelled"`. Previously generated entries are NOT deleted. No more entries will be generated.

**Response:** Cancelled rule object

### 12.6 Pause a Rule

```
POST /api/v1/financial/recurring-rules/:id/pause
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Sets `status: "paused"`. No entries generated while paused. Can be resumed later.

**Response:** Paused rule object

### 12.7 Resume a Rule

```
POST /api/v1/financial/recurring-rules/:id/resume
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Sets `status: "active"`. Resumes generating entries from where it left off.

**Response:** Resumed rule object

### 12.8 Trigger Now

```
POST /api/v1/financial/recurring-rules/:id/trigger
```

**Roles:** Owner, Admin

Immediately generates the next entry from this rule without waiting for the daily 2:00 AM scheduler.

**Response (202 Accepted):** Confirmation that the job was enqueued

### 12.9 Skip Next Occurrence

```
POST /api/v1/financial/recurring-rules/:id/skip
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| reason | string | No | Max 500 chars — why skipping this occurrence |

Advances `next_due_date` to the following occurrence without generating an entry.

**Example Request:**
```json
{
  "reason": "Office closed for holiday — no rent this month"
}
```

**Response:** Updated rule object with new `next_due_date`

### 12.10 Get Rule History

```
GET /api/v1/financial/recurring-rules/:id/history
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Lists all financial entries that were auto-generated by this rule.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |
| date_from | string | - | Filter by entry date |
| date_to | string | - | Filter by entry date |

**Response:** Paginated list of financial entries (same shape as section 6.2 data items)

### 12.11 Preview Upcoming Obligations

```
GET /api/v1/financial/recurring-rules/preview
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Preview what recurring expenses will generate in the next N days — without actually generating anything.

**Query Parameters:**

| Param | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| days | number | **Yes** | 30, 60, or 90 | Look-ahead window |

**Example:** `GET /api/v1/financial/recurring-rules/preview?days=30`

**Response:**
```json
{
  "period_days": 30,
  "total_obligations": 5250.00,
  "occurrences": [
    {
      "rule_id": "r1r2r3r4-...",
      "rule_name": "Office Rent",
      "amount": 2500.00,
      "tax_amount": null,
      "category_name": "Office & Admin",
      "due_date": "2026-04-01",
      "frequency": "monthly",
      "supplier_name": null,
      "payment_method_nickname": null
    },
    {
      "rule_id": "s5s6s7s8-...",
      "rule_name": "Vehicle Insurance",
      "amount": 2750.00,
      "tax_amount": null,
      "category_name": "Insurance",
      "due_date": "2026-04-15",
      "frequency": "quarterly",
      "supplier_name": "State Farm",
      "payment_method_nickname": "Chase Business Checking"
    }
  ]
}
```

---

## 13. Draw Milestones

Draw milestones represent billing stages for a project (e.g., "50% at framing complete", "25% at final inspection"). They are typically seeded from the quote's draw schedule when a project is created from an accepted quote. Each milestone can generate an invoice.

### 13.1 List Milestones

```
GET /api/v1/projects/:projectId/milestones
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Response:** Array ordered by `draw_number` (not paginated)
```json
[
  {
    "id": "m1m2m3m4-...",
    "tenant_id": "14a34ab2-...",
    "project_id": "f87e2a4c-...",
    "quote_draw_entry_id": "q1q2q3q4-...",
    "draw_number": 1,
    "description": "50% at framing complete",
    "calculation_type": "percentage",
    "value": "50.00",
    "calculated_amount": "27500.00",
    "status": "pending",
    "invoice_id": null,
    "invoiced_at": null,
    "paid_at": null,
    "notes": null,
    "created_by_user_id": "32cd6d0d-...",
    "created_at": "2026-03-20T00:00:00.000Z",
    "updated_at": "2026-03-20T00:00:00.000Z"
  },
  {
    "id": "n5n6n7n8-...",
    "tenant_id": "14a34ab2-...",
    "project_id": "f87e2a4c-...",
    "quote_draw_entry_id": "r5r6r7r8-...",
    "draw_number": 2,
    "description": "50% at completion",
    "calculation_type": "percentage",
    "value": "50.00",
    "calculated_amount": "27500.00",
    "status": "pending",
    "invoice_id": null,
    "invoiced_at": null,
    "paid_at": null,
    "notes": null,
    "created_by_user_id": "32cd6d0d-...",
    "created_at": "2026-03-20T00:00:00.000Z",
    "updated_at": "2026-03-20T00:00:00.000Z"
  }
]
```

**Milestone Fields:**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | Milestone ID |
| project_id | string (UUID) | No | Project |
| quote_draw_entry_id | string (UUID) | Yes | Source draw entry from quote (null if manually created) |
| draw_number | number | No | Sequence (1, 2, 3...) |
| description | string | No | What triggers this draw |
| calculation_type | string | No | "percentage" or "fixed_amount" |
| value | string (decimal) | No | Percentage value (e.g., "50.00") or fixed dollar amount |
| calculated_amount | string (decimal) | No | Actual dollar amount |
| status | string | No | "pending", "invoiced", or "paid" |
| invoice_id | string (UUID) | Yes | Linked invoice (set when invoice generated) |
| invoiced_at | string (ISO 8601) | Yes | When invoiced |
| paid_at | string (ISO 8601) | Yes | When paid |
| notes | string | Yes | Notes |

### 13.2 Create a Milestone

```
POST /api/v1/projects/:projectId/milestones
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| draw_number | number | **Yes** | Integer, min 1, unique per project | Sequence number |
| description | string | **Yes** | 1-255 chars | What triggers this draw |
| calculation_type | string | **Yes** | "percentage" or "fixed_amount" | How to calculate amount |
| value | number | **Yes** | Min 0.01, max 2 decimal places (max 100 for percentage) | Percentage or dollar amount |
| calculated_amount | number | No | Min 0.01, max 2 decimal places | Override the computed amount |
| notes | string | No | Max 5000 chars | Notes |

**Example Request:**
```json
{
  "draw_number": 1,
  "description": "50% at framing complete",
  "calculation_type": "percentage",
  "value": 50.00
}
```

**Business Rules:**
- For `percentage` type: `calculated_amount = (value / 100) * project.contract_value`
- For `fixed_amount` type: `calculated_amount = value`
- `draw_number` must be unique within the project

**Response (201 Created):** Milestone object

### 13.3 Update a Milestone

```
PATCH /api/v1/projects/:projectId/milestones/:id
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager

**Request Body (all optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| description | string | Max 255 chars | New description |
| calculated_amount | number | Min 0.01 | Override amount (**BLOCKED** if status is "invoiced" or "paid") |
| notes | string | Max 5000 chars | New notes |

**Response:** Updated milestone object

### 13.4 Delete a Milestone

```
DELETE /api/v1/projects/:projectId/milestones/:id
```

**Roles:** Owner, Admin

**Response:** 204 No Content

### 13.5 Generate Invoice from Milestone

```
POST /api/v1/projects/:projectId/milestones/:id/invoice
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager

Creates a project invoice pre-populated from the milestone's `calculated_amount`. Changes milestone status to "invoiced".

**Request Body (all optional — overrides):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| description | string | Max 500 chars | Override invoice description (defaults to milestone description) |
| due_date | string | ISO 8601 | Payment due date |
| tax_amount | number | Min 0 | Add tax to invoice |
| notes | string | Max 5000 chars | Invoice notes |

**Example Request:**
```json
{
  "due_date": "2026-04-15",
  "tax_amount": 0,
  "notes": "Net 30 terms"
}
```

**Response (201 Created):** The created project invoice object (see section 14 for invoice fields)

---

## 14. Project Invoices

Invoices sent to clients for project work. Can be standalone or generated from milestones. Invoice numbers are auto-generated per tenant (INV-0001, INV-0002, etc.).

### 14.1 List Project Invoices

```
GET /api/v1/projects/:projectId/invoices
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |
| status | string | - | "draft", "sent", "partial", "paid", "voided" |
| date_from | string | - | Filter by creation date |
| date_to | string | - | Filter by creation date |

**Response:**
```json
{
  "data": [
    {
      "id": "inv1-...",
      "tenant_id": "14a34ab2-...",
      "project_id": "f87e2a4c-...",
      "invoice_number": "INV-0001",
      "milestone_id": "m1m2m3m4-...",
      "description": "50% at framing complete",
      "amount": "27500.00",
      "tax_amount": null,
      "amount_paid": "0.00",
      "amount_due": "27500.00",
      "status": "draft",
      "due_date": "2026-04-15T00:00:00.000Z",
      "sent_at": null,
      "paid_at": null,
      "voided_at": null,
      "voided_reason": null,
      "notes": "Net 30 terms",
      "created_by_user_id": "32cd6d0d-...",
      "updated_by_user_id": null,
      "created_at": "2026-03-25T00:00:00.000Z",
      "updated_at": "2026-03-25T00:00:00.000Z",
      "milestone": {
        "id": "m1m2m3m4-...",
        "draw_number": 1,
        "description": "50% at framing complete"
      },
      "payment_count": 0
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

> **Note:** This endpoint uses `totalPages` (camelCase) in meta, unlike most other endpoints.

**Invoice Fields:**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | Invoice ID |
| invoice_number | string | No | Auto-generated (e.g., "INV-0001") |
| milestone_id | string (UUID) | Yes | Linked milestone |
| description | string | No | Invoice description |
| amount | string (decimal) | No | Invoice amount |
| tax_amount | string (decimal) | Yes | Tax |
| amount_paid | string (decimal) | No | Total paid so far |
| amount_due | string (decimal) | No | Remaining (amount + tax - paid) |
| status | string | No | "draft", "sent", "partial", "paid", "voided" |
| due_date | string (ISO 8601) | Yes | Payment due date |
| sent_at | string (ISO 8601) | Yes | When sent to client |
| paid_at | string (ISO 8601) | Yes | When fully paid |
| voided_at | string (ISO 8601) | Yes | When voided |
| voided_reason | string | Yes | Why voided |
| notes | string | Yes | Notes |
| milestone | object | Yes | `{id, draw_number, description}` |
| payment_count | number | No | Number of payments recorded |

### 14.2 Create a Project Invoice

```
POST /api/v1/projects/:projectId/invoices
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| description | string | **Yes** | 1-500 chars | Invoice description |
| amount | number | **Yes** | Min 0.01, max 2 decimal places | Invoice amount |
| tax_amount | number | No | Min 0, max 2 decimal places | Tax amount |
| due_date | string | No | ISO 8601 | Payment due date |
| notes | string | No | Max 5000 chars | Notes |

**Example Request:**
```json
{
  "description": "Progress billing - Phase 1 complete",
  "amount": 15000.00,
  "tax_amount": 0,
  "due_date": "2026-04-30",
  "notes": "Net 30 terms"
}
```

**Business Rules:**
- Invoice number auto-generated and incremented per tenant
- Starts in "draft" status
- `amount_due = amount + (tax_amount || 0)`

**Response (201 Created):** Invoice object

### 14.3 Get Single Invoice

```
GET /api/v1/projects/:projectId/invoices/:id
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Response:** Full invoice object with milestone details and payments array

### 14.4 Update an Invoice

```
PATCH /api/v1/projects/:projectId/invoices/:id
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager

**Important:** Only invoices in "draft" status can be updated. Returns error for other statuses.

**Request Body (all optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| description | string | Max 500 chars | New description |
| amount | number | Min 0.01 | New amount (recalculates amount_due) |
| tax_amount | number | Min 0 | New tax |
| due_date | string | ISO 8601 | New due date |
| notes | string | Max 5000 chars | New notes |

**Response:** Updated invoice object

### 14.5 Mark Invoice as Sent

```
POST /api/v1/projects/:projectId/invoices/:id/send
```

**Roles:** Owner, Admin, Manager

Changes status from "draft" to "sent". Sets `sent_at` to current timestamp.

**Response:** Updated invoice object with `status: "sent"`

### 14.6 Void an Invoice

```
POST /api/v1/projects/:projectId/invoices/:id/void
Content-Type: application/json
```

**Roles:** Owner, Admin

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| voided_reason | string | **Yes** | 1-500 chars | Why voiding this invoice |

**Example Request:**
```json
{
  "voided_reason": "Duplicate invoice — already billed on INV-0003"
}
```

**Business Rules:** Only "draft" or "sent" invoices can be voided (not partial/paid).

**Response:** Voided invoice object with `status: "voided"`, `voided_at`, `voided_reason`

### 14.7 Record a Payment

```
POST /api/v1/projects/:projectId/invoices/:id/payments
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| amount | number | **Yes** | Min 0.01, max 2 decimal places | Payment amount |
| payment_date | string | **Yes** | ISO 8601 | When payment was received |
| payment_method | string (enum) | **Yes** | Valid payment_method enum (all 8 values) | How client paid |
| payment_method_registry_id | string (UUID) | No | Must exist | Link to payment method |
| reference_number | string | No | Max 200 chars | Check #, transaction ID |
| notes | string | No | Max 5000 chars | Payment notes |

**Example Request:**
```json
{
  "amount": 15000.00,
  "payment_date": "2026-04-10",
  "payment_method": "check",
  "reference_number": "CHK-4521"
}
```

**Business Rules:**
- Updates `amount_paid` and recalculates `amount_due`
- If `amount_due` reaches 0, status auto-changes to "paid" and `paid_at` is set
- If partial payment, status changes to "partial"

**Response (201 Created):** Payment record
```json
{
  "id": "pay1-...",
  "tenant_id": "14a34ab2-...",
  "invoice_id": "inv1-...",
  "project_id": "f87e2a4c-...",
  "amount": "15000.00",
  "payment_date": "2026-04-10T00:00:00.000Z",
  "payment_method": "check",
  "payment_method_registry_id": null,
  "reference_number": "CHK-4521",
  "notes": null,
  "created_by_user_id": "32cd6d0d-...",
  "created_at": "2026-04-10T12:00:00.000Z"
}
```

### 14.8 List Invoice Payments

```
GET /api/v1/projects/:projectId/invoices/:id/payments
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Response:** Array of payment records (same shape as 14.7 response)

---

## 15. Project Financial Summary

Aggregated financial data for a specific project — the "financial dashboard" at project level.

### 15.1 Full Financial Summary

```
GET /api/v1/projects/:projectId/financial/summary
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| date_from | string | Optional start date filter (ISO 8601) |
| date_to | string | Optional end date filter (ISO 8601) |

**Response:**
```json
{
  "project": {
    "id": "f87e2a4c-...",
    "project_number": "PRJ-2026-0004",
    "name": "Teste",
    "status": "in_progress",
    "progress_percent": 25,
    "start_date": null,
    "target_completion_date": null,
    "actual_completion_date": null,
    "contract_value": null,
    "estimated_cost": 55000,
    "assigned_pm": null
  },
  "cost_summary": {
    "total_expenses": 2142,
    "total_expenses_pending": 0,
    "total_tax_paid": 0,
    "entry_count": 3,
    "by_category": [
      {
        "category_id": "649dfc7b-...",
        "category_name": "Miscellaneous",
        "category_type": "other",
        "classification": "cost_of_goods_sold",
        "total": 542,
        "entry_count": 1
      }
    ],
    "by_classification": {
      "cost_of_goods_sold": 2142,
      "operating_expense": 0
    }
  },
  "subcontractor_summary": {
    "total_invoiced": 2500,
    "total_paid": 15000,
    "outstanding": -12500,
    "invoice_count": 1,
    "payment_count": 1
  },
  "crew_summary": {
    "total_regular_hours": 8.01,
    "total_overtime_hours": 0,
    "total_hours": 8.01,
    "total_crew_payments": 2500,
    "crew_member_count": 1
  },
  "receipt_summary": {
    "total_receipts": 1,
    "categorized": 0,
    "uncategorized": 1
  },
  "revenue_summary": {
    "total_invoiced": 0,
    "total_collected": 0,
    "outstanding": 0,
    "invoice_count": 0
  },
  "margin_analysis": {
    "contract_value": null,
    "estimated_cost": 55000,
    "actual_cost": 2142,
    "budget_remaining": 52858,
    "budget_used_percent": 3.89,
    "gross_margin": null,
    "gross_margin_percent": null
  }
}
```

### 15.2 Task Breakdown

```
GET /api/v1/projects/:projectId/financial/tasks
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| date_from | string | - | Start date filter |
| date_to | string | - | End date filter |
| sort_by | string | "total_cost" | "total_cost" or "task_title" |
| sort_order | string | "desc" | "asc" or "desc" |

**Response:**
```json
{
  "project_id": "f87e2a4c-...",
  "total_task_cost": 2042,
  "tasks": [
    {
      "task_id": "4dffa994-...",
      "task_title": "Retirar Driveway",
      "task_status": "done",
      "task_order_index": 0,
      "expenses": {
        "total": 2042,
        "by_category": [
          { "category_name": "Miscellaneous", "category_type": "other", "classification": "cost_of_goods_sold", "total": 542 },
          { "category_name": "Labor - General", "category_type": "labor", "classification": "cost_of_goods_sold", "total": 1500 }
        ],
        "entry_count": 2
      },
      "subcontractor_invoices": {
        "total_invoiced": 2500,
        "invoice_count": 1
      },
      "crew_hours": {
        "total_regular_hours": 8.01,
        "total_overtime_hours": 0,
        "total_hours": 8.01
      }
    }
  ]
}
```

### 15.3 Timeline (Monthly Cost Trend)

```
GET /api/v1/projects/:projectId/financial/timeline
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:** `date_from` (optional), `date_to` (optional)

**Response:**
```json
{
  "project_id": "f87e2a4c-...",
  "months": [
    {
      "year": 2026,
      "month": 3,
      "month_label": "Mar 2026",
      "total_expenses": 2142,
      "by_category": [
        { "category_name": "Labor - General", "category_type": "labor", "total": 1500 },
        { "category_name": "Miscellaneous", "category_type": "other", "total": 542 }
      ]
    }
  ],
  "cumulative_total": 2142
}
```

### 15.4 Project Receipts

```
GET /api/v1/projects/:projectId/financial/receipts
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Field

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| is_categorized | boolean | - | Filter linked/unlinked receipts |
| ocr_status | string | - | "not_processed", "processing", "complete", "failed" |
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |

**Response:** Same paginated receipt format as section 7.2

### 15.5 Workforce Summary

```
GET /api/v1/projects/:projectId/financial/workforce
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:** `date_from` (optional), `date_to` (optional)

**Response:**
```json
{
  "project_id": "f87e2a4c-...",
  "crew_hours": {
    "total_regular_hours": 8.01,
    "total_overtime_hours": 0,
    "total_hours": 8.01,
    "by_crew_member": [
      {
        "crew_member_id": "aa4edf1e-...",
        "crew_member_name": "Andre Porto",
        "regular_hours": 8.01,
        "overtime_hours": 0,
        "log_count": 1,
        "total_hours": 8.01
      }
    ]
  },
  "crew_payments": {
    "total_paid": 2500,
    "payment_count": 1,
    "by_crew_member": [
      {
        "crew_member_id": "aa4edf1e-...",
        "crew_member_name": "Andre Porto",
        "total_paid": 2500,
        "payment_count": 1,
        "last_payment_date": "2026-03-16T00:00:00.000Z"
      }
    ]
  },
  "subcontractor_invoices": {
    "total_invoiced": 2500,
    "total_paid": 15000,
    "outstanding": -12500,
    "by_subcontractor": [
      {
        "subcontractor_id": "6364715b-...",
        "subcontractor_name": "Ludson Developer",
        "invoiced": 2500,
        "paid": 15000,
        "invoice_count": 1,
        "pending_invoices": 0,
        "approved_invoices": 0,
        "paid_invoices": 1,
        "outstanding": -12500
      }
    ]
  }
}
```

---

## 16. Task-Level Financial Operations

Convenience endpoints that scope financial operations to a specific project task.

### 16.1 Create Task Cost Entry

```
POST /api/v1/projects/:projectId/tasks/:taskId/costs
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Same request body as creating a financial entry (section 6.1), but `project_id` and `task_id` are automatically pre-filled from the URL parameters — you do not need to include them in the body.

**Response (201 Created):** The created entry object

### 16.2 List Task Cost Entries

```
GET /api/v1/projects/:projectId/tasks/:taskId/costs
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Returns all financial entries for this task (array, not paginated).

> **Important:** This endpoint returns **raw Prisma entry objects**, NOT the enriched format from `/financial/entries`. Raw entries include additional fields like `crew_member_id`, `subcontractor_id`, `updated_by_user_id` that the enriched response omits. They also do NOT include the enriched name fields (`project_name`, `category_name`, `supplier_name`, etc.).

### 16.3 Upload Task Receipt

```
POST /api/v1/projects/:projectId/tasks/:taskId/receipts
Content-Type: multipart/form-data
```

**Roles:** Owner, Admin, Manager, Bookkeeper, Field

Same as receipt upload (section 7.1), but `project_id` and `task_id` are pre-filled from the URL. Max 25MB.

**Response (201 Created):** Receipt object (same shape as section 7.1 response)

### 16.4 List Task Receipts

```
GET /api/v1/projects/:projectId/tasks/:taskId/receipts
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Returns all receipts for this task (array, not paginated).

### 16.5 List Task Subcontractor Invoices

```
GET /api/v1/projects/:projectId/tasks/:taskId/invoices
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Returns subcontractor invoices linked to this task (array, not paginated). Same object shape as section 19.2 data items.

---

## 17. Crew Hour Logs

Track hours worked by crew members on projects and tasks.

### 17.1 Log Hours

```
POST /api/v1/financial/crew-hours
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| crew_member_id | string (UUID) | **Yes** | Must exist | Which crew member |
| project_id | string (UUID) | **Yes** | Must exist | Which project |
| task_id | string (UUID) | No | Must exist | Which task (optional) |
| log_date | string | **Yes** | ISO 8601 | Date worked |
| hours_regular | number | **Yes** | Min 0.01, max 2 decimal places | Regular hours |
| hours_overtime | number | No | Min 0, max 2 decimal places | Overtime hours (default: 0) |
| notes | string | No | - | Notes |

**Example Request:**
```json
{
  "crew_member_id": "aa4edf1e-cf29-43f5-ab3e-796f8b9b8806",
  "project_id": "f87e2a4c-a745-45c8-a47d-90f7fc4e8285",
  "task_id": "4dffa994-995d-482a-95ab-6c2cb8b5faa6",
  "log_date": "2026-03-17",
  "hours_regular": 8.0,
  "hours_overtime": 1.5,
  "notes": "Framing work + overtime for deadline"
}
```

**Response:** Created hour log object

### 17.2 List Crew Hours

```
GET /api/v1/financial/crew-hours
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| project_id | UUID | - | Filter by project |
| crew_member_id | UUID | - | Filter by crew member |
| date_from | string | - | Start date filter |
| date_to | string | - | End date filter |
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |

**Response:**
```json
{
  "data": [
    {
      "id": "4f67de44-...",
      "tenant_id": "14a34ab2-...",
      "crew_member_id": "aa4edf1e-...",
      "project_id": "f87e2a4c-...",
      "task_id": "4dffa994-...",
      "log_date": "2026-03-17T00:00:00.000Z",
      "hours_regular": "8.01",
      "hours_overtime": "0",
      "source": "manual",
      "clockin_event_id": null,
      "notes": null,
      "created_by_user_id": "32cd6d0d-...",
      "created_at": "2026-03-17T00:53:24.173Z",
      "updated_at": "2026-03-17T00:53:24.173Z",
      "crew_member": {
        "id": "aa4edf1e-...",
        "first_name": "Andre",
        "last_name": "Porto"
      },
      "project": {
        "id": "f87e2a4c-...",
        "name": "Teste",
        "project_number": "PRJ-2026-0004"
      },
      "task": {
        "id": "4dffa994-...",
        "title": "Retirar Driveway"
      }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "pages": 1 }
}
```

> **Note:** `hours_regular` and `hours_overtime` are returned as **strings** (decimal). Parse to numbers on the frontend. The `source` field is "manual" for entries created via this API (vs "clockin" for time-clock entries).

### 17.3 Update Crew Hours

```
PATCH /api/v1/financial/crew-hours/:id
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager

**Request Body (all optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| task_id | string (UUID) | Must exist | Change task |
| log_date | string | ISO 8601 | Change date |
| hours_regular | number | Min 0.01 | Change regular hours |
| hours_overtime | number | Min 0 | Change overtime hours |
| notes | string | - | Change notes |

**Response:** Updated hour log object

---

## 18. Crew Payments

Record payments made to crew members for their work.

### 18.1 Create a Crew Payment

```
POST /api/v1/financial/crew-payments
Content-Type: application/json
```

**Roles:** Owner, Admin, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| crew_member_id | string (UUID) | **Yes** | Must exist | Which crew member to pay |
| amount | number | **Yes** | Min 0.01, max 2 decimal places | Payment amount |
| payment_date | string | **Yes** | ISO 8601, cannot be in the future | When paid |
| payment_method | string (enum) | **Yes** | Valid payment_method enum (all 8 values) | How paid |
| project_id | string (UUID) | No | Must exist | Link to project |
| reference_number | string | No | Max 200 chars | Check number, transaction ref |
| period_start_date | string | No | ISO 8601 | Pay period start |
| period_end_date | string | No | ISO 8601, must be >= period_start_date | Pay period end |
| hours_paid | number | No | Min 0, max 2 decimal places | Hours this payment covers |
| notes | string | No | - | Notes |

**Example Request:**
```json
{
  "crew_member_id": "aa4edf1e-cf29-43f5-ab3e-796f8b9b8806",
  "project_id": "f87e2a4c-a745-45c8-a47d-90f7fc4e8285",
  "amount": 2500.00,
  "payment_date": "2026-03-16",
  "payment_method": "cash",
  "period_start_date": "2026-03-11",
  "period_end_date": "2026-03-15",
  "hours_paid": 40
}
```

**Response:** Created payment record
```json
{
  "id": "1d0cca57-...",
  "tenant_id": "14a34ab2-...",
  "crew_member_id": "aa4edf1e-...",
  "project_id": "f87e2a4c-...",
  "amount": "2500",
  "payment_date": "2026-03-16T00:00:00.000Z",
  "payment_method": "cash",
  "reference_number": null,
  "period_start_date": null,
  "period_end_date": null,
  "hours_paid": null,
  "notes": null,
  "created_by_user_id": "32cd6d0d-...",
  "created_at": "2026-03-16T23:05:37.973Z",
  "crew_member": {
    "id": "aa4edf1e-...",
    "first_name": "Andre",
    "last_name": "Porto"
  },
  "project": {
    "id": "f87e2a4c-...",
    "name": "Teste",
    "project_number": "PRJ-2026-0004"
  }
}
```

### 18.2 List All Crew Payments

```
GET /api/v1/financial/crew-payments
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| project_id | UUID | - | Filter by project |
| crew_member_id | UUID | - | Filter by crew member |
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |

**Response:** Paginated list with `meta.pages` (same shape as 18.1 response items)

### 18.3 Get Crew Member Payment History

```
GET /api/v1/crew/:crewMemberId/payment-history
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Same query params and response shape as 18.2, scoped to one crew member.

---

## 19. Subcontractor Invoices

Invoices received FROM subcontractors for work they performed on project tasks.

### 19.1 Create a Subcontractor Invoice

```
POST /api/v1/financial/subcontractor-invoices
Content-Type: multipart/form-data
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Form Fields:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| subcontractor_id | string (UUID) | **Yes** | Must exist | Which subcontractor |
| task_id | string (UUID) | **Yes** | Must exist | Which task |
| project_id | string (UUID) | **Yes** | Must exist | Which project |
| amount | number | **Yes** | Min 0.01, max 2 decimal places | Invoice amount |
| invoice_number | string | No | Max 100 chars | Subcontractor's invoice number |
| invoice_date | string | No | ISO 8601 | Invoice date |
| notes | string | No | - | Notes |
| file | File (binary) | No | - | Optional invoice document attachment |

**Example (JSON, without file):**
```json
{
  "subcontractor_id": "6364715b-2f09-49a8-bc69-8851a0ea31b4",
  "task_id": "4dffa994-995d-482a-95ab-6c2cb8b5faa6",
  "project_id": "f87e2a4c-a745-45c8-a47d-90f7fc4e8285",
  "amount": 2500.00,
  "invoice_number": "SUB-INV-001",
  "invoice_date": "2026-03-16"
}
```

**Response (201 Created):**
```json
{
  "id": "6b4067d7-...",
  "tenant_id": "14a34ab2-...",
  "subcontractor_id": "6364715b-...",
  "task_id": "4dffa994-...",
  "project_id": "f87e2a4c-...",
  "invoice_number": "SUB-INV-001",
  "invoice_date": "2026-03-16T00:00:00.000Z",
  "amount": "2500",
  "status": "pending",
  "notes": null,
  "file_id": null,
  "file_url": null,
  "file_name": null,
  "created_by_user_id": "32cd6d0d-...",
  "created_at": "2026-03-16T23:04:24.855Z",
  "updated_at": "2026-03-16T23:04:24.855Z",
  "subcontractor": {
    "id": "6364715b-...",
    "business_name": "Ludson Developer",
    "trade_specialty": "IT"
  },
  "task": { "id": "4dffa994-...", "title": "Retirar Driveway" },
  "project": { "id": "f87e2a4c-...", "name": "Teste", "project_number": "PRJ-2026-0004" }
}
```

### 19.2 List Subcontractor Invoices

```
GET /api/v1/financial/subcontractor-invoices
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| subcontractor_id | UUID | - | Filter by subcontractor |
| task_id | UUID | - | Filter by task |
| project_id | UUID | - | Filter by project |
| status | string | - | "pending", "approved", "paid" |
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |

**Response:** Paginated list with `meta.pages` (same object shape as 19.1)

### 19.3 Update a Subcontractor Invoice

```
PATCH /api/v1/financial/subcontractor-invoices/:id
Content-Type: application/json
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body (all optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| status | string | "approved" or "paid" | Forward-only status transition |
| amount | number | Min 0.01 | Only changeable BEFORE status reaches "approved" |
| notes | string | - | New notes |

**Business Rules:**
- Status transitions are forward-only: `pending → approved → paid`
- Cannot skip statuses (e.g., cannot go directly from "pending" to "paid")
- Cannot go backwards
- Amount can only be changed while status is "pending"

**Example — Approve an invoice:**
```json
{
  "status": "approved"
}
```

**Response:** Updated invoice object

### 19.4 List Subcontractor's Invoices

```
GET /api/v1/subcontractors/:id/invoices
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Returns all invoices for a specific subcontractor (array, not paginated). Same object shape as 19.1.

---

## 20. Subcontractor Payments

Direct payments made to subcontractors for their work.

### 20.1 Create a Subcontractor Payment

```
POST /api/v1/financial/subcontractor-payments
Content-Type: application/json
```

**Roles:** Owner, Admin, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| subcontractor_id | string (UUID) | **Yes** | Must exist | Which subcontractor |
| amount | number | **Yes** | Min 0.01, max 2 decimal places | Payment amount |
| payment_date | string | **Yes** | ISO 8601, cannot be in the future | When paid |
| payment_method | string (enum) | **Yes** | Valid payment_method enum (all 8 values) | How paid |
| project_id | string (UUID) | No | Must exist | Link to project |
| reference_number | string | No | Max 200 chars | Check number, transaction ref |
| notes | string | No | - | Notes |

**Example Request:**
```json
{
  "subcontractor_id": "6364715b-2f09-49a8-bc69-8851a0ea31b4",
  "project_id": "f87e2a4c-a745-45c8-a47d-90f7fc4e8285",
  "amount": 15000.00,
  "payment_date": "2026-03-17",
  "payment_method": "check",
  "reference_number": "PT22330-",
  "notes": "Final payment for driveway work"
}
```

**Response:**
```json
{
  "id": "418846d1-...",
  "tenant_id": "14a34ab2-...",
  "subcontractor_id": "6364715b-...",
  "project_id": "f87e2a4c-...",
  "amount": "15000",
  "payment_date": "2026-03-17T00:00:00.000Z",
  "payment_method": "check",
  "reference_number": "PT22330-",
  "notes": "asd",
  "created_by_user_id": "32cd6d0d-...",
  "created_at": "2026-03-17T00:52:28.333Z",
  "subcontractor": {
    "id": "6364715b-...",
    "business_name": "Ludson Developer",
    "trade_specialty": "IT"
  },
  "project": {
    "id": "f87e2a4c-...",
    "name": "Teste",
    "project_number": "PRJ-2026-0004"
  }
}
```

### 20.2 List All Subcontractor Payments

```
GET /api/v1/financial/subcontractor-payments
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| project_id | UUID | - | Filter by project |
| subcontractor_id | UUID | - | Filter by subcontractor |
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |

**Response:** Paginated list with `meta.pages` (same object shape as 20.1)

### 20.3 Subcontractor Payment History

```
GET /api/v1/subcontractors/:subcontractorId/payment-history
```

**Roles:** Owner, Admin, Manager, Bookkeeper

Same query params and response shape as 20.2, scoped to one subcontractor.

### 20.4 Subcontractor Payment Summary

```
GET /api/v1/subcontractors/:id/payment-summary
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Response:**
```json
{
  "subcontractor_id": "6364715b-2f09-49a8-bc69-8851a0ea31b4",
  "total_invoiced": 2500,
  "total_paid": 15000,
  "total_pending": 0,
  "total_approved": 0,
  "invoices_count": 1,
  "payments_count": 1
}
```

---

## 21. Financial Dashboard

Business-wide financial intelligence across all projects and operations. Five interconnected views: P&L, Accounts Receivable, Accounts Payable, Cash Flow Forecast, and Alerts.

### 21.1 Dashboard Overview (All-in-One)

```
GET /api/v1/financial/dashboard/overview
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| forecast_days | number | 30 | Forecast period: 30, 60, or 90 |

Returns all 5 dashboard sections in one call:

**Response:**
```json
{
  "pl_summary": { "...see 21.2..." },
  "ar_summary": { "...see 21.4..." },
  "ap_summary": { "...see 21.5..." },
  "forecast": { "...see 21.6..." },
  "alerts": [],
  "generated_at": "2026-03-25T05:01:09.921Z"
}
```

### 21.2 Profit & Loss

```
GET /api/v1/financial/dashboard/pl
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| year | number | **Yes** | - | Year (2020-2100) |
| month | number | No | - | Specific month (1-12). Omit for full year |
| include_pending | boolean | No | false | Include pending_review entries |

**Example:** `GET /api/v1/financial/dashboard/pl?year=2026&month=3`

**Response:**
```json
{
  "year": 2026,
  "period": "single_month",
  "currency": "USD",
  "months": [
    {
      "year": 2026,
      "month": 3,
      "month_label": "Mar 2026",
      "income": {
        "total": 0,
        "invoice_count": 0,
        "by_project": []
      },
      "expenses": {
        "total": 2542,
        "total_with_pending": 2542,
        "total_tax_paid": 0,
        "by_classification": {
          "cost_of_goods_sold": 2542,
          "operating_expense": 0
        },
        "by_category": [
          {
            "category_id": "5dc27901-...",
            "category_name": "Labor - Crew Overtime",
            "category_type": "labor",
            "classification": "cost_of_goods_sold",
            "total": 400,
            "entry_count": 3
          }
        ],
        "top_suppliers": []
      },
      "gross_profit": -2542,
      "operating_profit": -2542,
      "net_profit": -2542,
      "gross_margin_percent": null,
      "tax": {
        "tax_collected": 0,
        "tax_paid": 0,
        "net_tax_position": 0
      }
    }
  ],
  "totals": {
    "total_income": 0,
    "total_expenses": 2542,
    "total_gross_profit": -2542,
    "total_operating_profit": -2542,
    "total_tax_collected": 0,
    "total_tax_paid": 0,
    "avg_monthly_income": 0,
    "avg_monthly_expenses": 2542,
    "best_month": { "month_label": "Mar 2026", "net_profit": -2542 },
    "worst_month": { "month_label": "Mar 2026", "net_profit": -2542 }
  }
}
```

### 21.3 P&L CSV Export

```
GET /api/v1/financial/dashboard/pl/export
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:** `year` (required), `month` (optional)

**Response:** CSV file download

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="pl-2026-03.csv"
```

**CSV includes two sections:**
1. Summary row: Month, Total Income, Total Expenses, COGS, Operating Expense, Gross Profit, Net Profit, Tax Collected, Tax Paid
2. Detail rows: Month, Date, Category, Classification, Supplier/Vendor, Amount, Tax, Payment Method, Project, Notes

### 21.4 Accounts Receivable

```
GET /api/v1/financial/dashboard/ar
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | string | - | Filter by invoice status |
| overdue_only | boolean | false | Show only overdue invoices |

**Response:**
```json
{
  "summary": {
    "total_invoiced": 0,
    "total_collected": 0,
    "total_outstanding": 0,
    "total_overdue": 0,
    "invoice_count": 0,
    "overdue_count": 0,
    "avg_days_outstanding": 0
  },
  "aging_buckets": {
    "current": 0,
    "days_1_30": 0,
    "days_31_60": 0,
    "days_61_90": 0,
    "days_over_90": 0
  },
  "invoices": [
    {
      "invoice_id": "...",
      "invoice_number": "INV-0001",
      "project_id": "...",
      "project_name": "Teste",
      "project_number": "PRJ-2026-0004",
      "amount": 27500,
      "amount_paid": 0,
      "amount_due": 27500,
      "status": "sent",
      "due_date": "2026-04-15T00:00:00.000Z",
      "days_outstanding": 10,
      "days_overdue": null,
      "is_overdue": false
    }
  ]
}
```

### 21.5 Accounts Payable

```
GET /api/v1/financial/dashboard/ap
```

**Roles:** Owner, Admin, Manager, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| days_ahead | number | 30 | Look-ahead window (1-365) |

**Response:**
```json
{
  "summary": {
    "subcontractor_outstanding": 0,
    "crew_unpaid_estimate": 0,
    "recurring_upcoming": 0,
    "total_ap_estimate": 0
  },
  "subcontractor_invoices": {
    "total_pending": 0,
    "total_approved": 0,
    "total_outstanding": 0,
    "invoice_count": 0,
    "by_subcontractor": []
  },
  "recurring_upcoming": [],
  "crew_hours_summary": {
    "note": "Crew payment estimates require hourly rates to be configured. This section shows hours only.",
    "total_regular_hours_this_month": 8.01,
    "total_overtime_hours_this_month": 0,
    "crew_member_count": 1
  }
}
```

### 21.6 Cash Flow Forecast

```
GET /api/v1/financial/dashboard/forecast
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:**

| Param | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| days | number | **Yes** | 30, 60, or 90 | Forecast period |

**Example:** `GET /api/v1/financial/dashboard/forecast?days=30`

**Response:**
```json
{
  "period_days": 30,
  "forecast_start": "2026-03-25T00:00:00.000Z",
  "forecast_end": "2026-04-24T00:00:00.000Z",
  "expected_inflows": {
    "total": 27500,
    "items": [
      {
        "source": "project_invoice",
        "invoice_id": "...",
        "invoice_number": "INV-0001",
        "project_name": "Teste",
        "amount_due": 27500,
        "due_date": "2026-04-15T00:00:00.000Z"
      }
    ]
  },
  "expected_outflows": {
    "total": 2500,
    "items": [
      {
        "source": "recurring_rule",
        "rule_id": "...",
        "rule_name": "Office Rent",
        "amount": 2500,
        "due_date": "2026-04-01T00:00:00.000Z"
      }
    ]
  },
  "net_forecast": 25000,
  "net_forecast_label": "Positive"
}
```

`net_forecast_label` is one of: `"Positive"`, `"Negative"`, `"Breakeven"`

### 21.7 Financial Alerts

```
GET /api/v1/financial/dashboard/alerts
```

**Roles:** Owner, Admin, Bookkeeper

**Response:**
```json
{
  "alert_count": 2,
  "alerts": [
    {
      "type": "cost_overrun",
      "severity": "warning",
      "message": "Project 'Teste' has exceeded 90% of estimated budget",
      "details": {
        "project_id": "f87e2a4c-...",
        "project_name": "Teste",
        "estimated_cost": 55000,
        "actual_cost": 52000,
        "percent_used": 94.5
      }
    },
    {
      "type": "overdue_invoice",
      "severity": "error",
      "message": "Invoice INV-0001 is 15 days overdue",
      "details": {
        "invoice_id": "...",
        "invoice_number": "INV-0001",
        "amount_due": 27500,
        "days_overdue": 15
      }
    }
  ]
}
```

**Alert types:** `cost_overrun`, `overdue_invoice`, `upcoming_obligation`, `budget_warning`
**Alert severities:** `"info"`, `"warning"`, `"error"`

---

## 22. Account Mappings (Export Config)

Map Lead360 financial categories to your accounting software's chart of accounts for cleaner exports. Without mappings, exports use the category name as the account name.

### 22.1 List All Mappings

```
GET /api/v1/financial/export/account-mappings
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| platform | string | Optional: "quickbooks" or "xero" |

**Response:** Array (not paginated)
```json
[
  {
    "id": "map1-...",
    "tenant_id": "14a34ab2-...",
    "category_id": "9955c9c5-...",
    "platform": "quickbooks",
    "account_name": "Job Materials",
    "account_code": "5100",
    "created_by_user_id": "32cd6d0d-...",
    "updated_by_user_id": null,
    "created_at": "2026-03-25T00:00:00.000Z",
    "updated_at": "2026-03-25T00:00:00.000Z",
    "category": {
      "id": "9955c9c5-...",
      "name": "Materials - General",
      "type": "material"
    }
  }
]
```

### 22.2 Get Default Mappings (Preview)

```
GET /api/v1/financial/export/account-mappings/defaults
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| platform | string | **Yes** | "quickbooks" or "xero" |

**Example:** `GET /api/v1/financial/export/account-mappings/defaults?platform=quickbooks`

Shows what account name will be used per category — custom mapping if one exists, or the category name as fallback.

**Response:**
```json
[
  {
    "category_id": "5dc27901-...",
    "category_name": "Labor - Crew Overtime",
    "category_type": "labor",
    "classification": "cost_of_goods_sold",
    "has_custom_mapping": false,
    "account_name": "Labor - Crew Overtime",
    "account_code": null
  },
  {
    "category_id": "9955c9c5-...",
    "category_name": "Materials - General",
    "category_type": "material",
    "classification": "cost_of_goods_sold",
    "has_custom_mapping": true,
    "account_name": "Job Materials",
    "account_code": "5100"
  }
]
```

### 22.3 Create or Update a Mapping (Upsert)

```
POST /api/v1/financial/export/account-mappings
Content-Type: application/json
```

**Roles:** Owner, Admin, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| category_id | string (UUID) | **Yes** | Must exist | Which category to map |
| platform | string | **Yes** | "quickbooks" or "xero" | Target platform |
| account_name | string | **Yes** | Max 200 chars, not empty | Account name in QB/Xero |
| account_code | string | No | Max 50 chars | Account code/number |

**Example Request:**
```json
{
  "category_id": "9955c9c5-a4d6-4a45-b044-539a26e2779b",
  "platform": "quickbooks",
  "account_name": "Job Materials",
  "account_code": "5100"
}
```

**Business Rules:**
- Unique per tenant + category_id + platform
- If a mapping already exists for that category+platform, it is updated (upsert)

**Response:** Returns `201 Created` for new mappings, `200 OK` for updates. Body is the mapping object.

### 22.4 Delete a Mapping

```
DELETE /api/v1/financial/export/account-mappings/:id
```

**Roles:** Owner, Admin

**Response:** 204 No Content

---

## 23. Accounting Exports

Export financial data as CSV files for import into QuickBooks or Xero. Every export is logged for audit trail.

### 23.1 QuickBooks Expense Export

```
GET /api/v1/financial/export/quickbooks/expenses
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| date_from | string | **Yes** | - | ISO 8601 start date |
| date_to | string | **Yes** | - | ISO 8601 end date |
| category_id | UUID | No | - | Filter by category |
| classification | string | No | - | "cost_of_goods_sold" or "operating_expense" |
| project_id | UUID | No | - | Filter by project |
| include_recurring | boolean | No | false | Include entries auto-generated by recurring rules |
| include_pending | boolean | No | false | Include pending_review entries |

**Example:** `GET /api/v1/financial/export/quickbooks/expenses?date_from=2026-01-01&date_to=2026-12-31`

**Response:** CSV file download

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="quickbooks-expenses-2026-01-01-to-2026-12-31.csv"
```

**CSV Content:**
```csv
Date,Description,Amount,Account,Name,Class,Memo,Payment Method,Check No,Tax Amount
03/15/2026,Labor - Crew Overtime,250.00,Labor - Crew Overtime,,Driveway Replacement Projeto,,Credit Card,,
03/16/2026,Labor - General,1500.00,Labor - General,,Teste,,,,
03/17/2026,Miscellaneous,542.00,Miscellaneous,,Teste,,,,
```

**Business Rules:**
- Max 50,000 rows per export
- Date range max 366 days
- Only confirmed entries by default (set `include_pending=true` to include pending)
- Recurring instances excluded by default (set `include_recurring=true` to include)
- Date format: MM/DD/YYYY
- Every export logged to `financial_export_log`
- Returns 400 if no records match filters

### 23.2 QuickBooks Invoice Export

```
GET /api/v1/financial/export/quickbooks/invoices
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| date_from | string | **Yes** | - | ISO 8601 start date |
| date_to | string | **Yes** | - | ISO 8601 end date |
| status | string | No | - | "draft", "sent", "partial", "paid" |

**Business Rules:** Voided invoices are **NEVER** included in exports. Returns 400 if no records match.

**Response:** CSV file download

### 23.3 Xero Expense Export

```
GET /api/v1/financial/export/xero/expenses
```

**Roles:** Owner, Admin, Bookkeeper

Same query parameters as 23.1 (QuickBooks expenses).

**CSV Content:**
```csv
Date,Amount,Payee,Description,Reference,Account Code,Tax Rate,Tracking Name 1
15/03/2026,-250.00,,Labor - Crew Overtime,43f305ff,Labor - Crew Overtime,Tax Exempt,Driveway Replacement Projeto
16/03/2026,-1500.00,,Labor - General,199fb967,Labor - General,Tax Exempt,Teste
17/03/2026,-542.00,,Miscellaneous,cee71acf,Miscellaneous,Tax Exempt,Teste
```

**Key Differences from QuickBooks format:**
- Date format: DD/MM/YYYY (not MM/DD/YYYY)
- Amounts are **NEGATIVE** for expenses
- Reference column uses first 8 chars of entry ID
- "Tracking Name 1" = project name

### 23.4 Xero Invoice Export

```
GET /api/v1/financial/export/xero/invoices
```

**Roles:** Owner, Admin, Bookkeeper

Same query parameters as 23.2 (QuickBooks invoices). Same business rules (voided never included).

**Response:** CSV file download in Xero invoice format

### 23.5 Data Quality Report

```
GET /api/v1/financial/export/quality-report
```

**Roles:** Owner, Admin, Bookkeeper

Analyzes financial entries for export readiness — flags entries missing required fields for a clean accounting import.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| date_from | string | Optional start date filter |
| date_to | string | Optional end date filter |
| platform | string | "quickbooks" or "xero" |

**Response:**
```json
{
  "total_entries_checked": 6,
  "total_issues": 10,
  "errors": 0,
  "warnings": 6,
  "infos": 4,
  "issues": [
    {
      "severity": "warning",
      "check_type": "missing_vendor",
      "entry_id": "cee71acf-...",
      "entry_date": "2026-03-17",
      "amount": 542,
      "category_name": "Miscellaneous",
      "supplier_name": null,
      "message": "Entry on 2026-03-17 has no vendor or supplier — payee will be blank in export"
    },
    {
      "severity": "info",
      "check_type": "no_account_mapping",
      "entry_id": "199fb967-...",
      "entry_date": "2026-03-16",
      "amount": 1500,
      "category_name": "Labor - General",
      "supplier_name": null,
      "message": "Category 'Labor - General' has no custom account mapping — category name will be used as account name"
    }
  ]
}
```

**Issue Severities:**
- `"error"` — Will cause import failure (e.g., zero amount)
- `"warning"` — Missing recommended field (e.g., no vendor)
- `"info"` — Informational (e.g., no custom mapping, using default)

### 23.6 Export History

```
GET /api/v1/financial/export/history
```

**Roles:** Owner, Admin, Bookkeeper

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| export_type | string | - | "quickbooks_expenses", "quickbooks_invoices", "xero_expenses", "xero_invoices", "pl_csv", "entries_csv" |
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |

**Response:**
```json
{
  "data": [
    {
      "id": "cc11277a-...",
      "export_type": "xero_expenses",
      "date_from": "2026-01-01T00:00:00.000Z",
      "date_to": "2026-12-31T00:00:00.000Z",
      "record_count": 6,
      "file_name": "xero-expenses-2026-01-01-to-2026-12-31.csv",
      "filters_applied": {
        "date_from": "2026-01-01",
        "date_to": "2026-12-31",
        "include_recurring": false,
        "include_pending": false
      },
      "exported_by_user_id": "32cd6d0d-...",
      "created_at": "2026-03-25T04:06:29.601Z",
      "exported_by": {
        "id": "32cd6d0d-...",
        "first_name": "Ludson",
        "last_name": "Menezes"
      }
    }
  ],
  "meta": {
    "total": 4,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}

---

## 24. Role-Based Access Control Matrix

| Endpoint Group | Owner | Admin | Manager | Bookkeeper | Sales | Employee | Field |
|---------------|-------|-------|---------|------------|-------|----------|-------|
| Financial Categories | CRUD | CRUD | CRUD | - | - | - | - |
| Financial Entries | CRUD | CRUD | CRUD | CRUD | - | CRUD* | - |
| Entry Approval | Yes | Yes | Yes | Yes | - | - | - |
| Receipts | CRUD | CRUD | CRUD | CRUD | - | - | Upload/OCR |
| Payment Methods | CRUD | CRUD | Read | CRUD | Read | Read | - |
| Suppliers | CRUD | CRUD | CRU | CRUD | Read | Read | - |
| Supplier Categories | CRUD | CRUD | CRU | CRUD | Read | Read | - |
| Supplier Products | CRUD | CRUD | CRU | CRUD | Read | Read | - |
| Recurring Rules | CRUD | CRUD | CRU | CRU | - | - | - |
| Draw Milestones | CRUD | CRUD | CRU | Read | - | - | - |
| Project Invoices | CRUD | CRUD | CRU+Pay | Read+Pay | - | - | - |
| Project Summary | Read | Read | Read | Read | - | - | - |
| Task Financials | CRUD | CRUD | CRUD | CRUD | - | - | Upload |
| Crew Hours | CRU | CRU | CRU | Read | - | - | - |
| Crew Payments | CR | CR | Read | CR | - | - | - |
| Sub Invoices | CRU | CRU | CRU | CRU | - | - | - |
| Sub Payments | CR | CR | Read | CR | - | - | - |
| Dashboard | All | All | AR/AP | All | - | - | - |
| Account Mappings | CRUD | CRUD | - | CRU | - | - | - |
| Exports | All | All | - | All | - | - | - |

**\*Employee restrictions:**
- Can only view/edit/delete their OWN entries
- All entries created by Employees are `submission_status: "pending_review"`
- Can only edit entries in `"pending_review"` status
- Can only delete their own `"pending_review"` entries

---

## Quick Reference: All 109 Endpoints

| # | Method | Path | Section |
|---|--------|------|---------|
| 1 | GET | `/settings/financial-categories` | 5.1 |
| 2 | POST | `/settings/financial-categories` | 5.2 |
| 3 | PATCH | `/settings/financial-categories/:id` | 5.3 |
| 4 | DELETE | `/settings/financial-categories/:id` | 5.4 |
| 5 | POST | `/financial/entries` | 6.1 |
| 6 | GET | `/financial/entries` | 6.2 |
| 7 | GET | `/financial/entries/pending` | 6.7 |
| 8 | GET | `/financial/entries/export` | 6.11 |
| 9 | GET | `/financial/entries/:id` | 6.4 |
| 10 | PATCH | `/financial/entries/:id` | 6.5 |
| 11 | DELETE | `/financial/entries/:id` | 6.6 |
| 12 | POST | `/financial/entries/:id/approve` | 6.8 |
| 13 | POST | `/financial/entries/:id/reject` | 6.9 |
| 14 | POST | `/financial/entries/:id/resubmit` | 6.10 |
| 15 | POST | `/financial/receipts` | 7.1 |
| 16 | GET | `/financial/receipts` | 7.2 |
| 17 | GET | `/financial/receipts/:id` | 7.3 |
| 18 | GET | `/financial/receipts/:id/ocr-status` | 7.4 |
| 19 | POST | `/financial/receipts/:id/create-entry` | 7.5 |
| 20 | POST | `/financial/receipts/:id/retry-ocr` | 7.6 |
| 21 | PATCH | `/financial/receipts/:id/link` | 7.7 |
| 22 | PATCH | `/financial/receipts/:id` | 7.8 |
| 23 | GET | `/financial/payment-methods` | 8.1 |
| 24 | POST | `/financial/payment-methods` | 8.2 |
| 25 | GET | `/financial/payment-methods/:id` | 8.3 |
| 26 | PATCH | `/financial/payment-methods/:id` | 8.4 |
| 27 | DELETE | `/financial/payment-methods/:id` | 8.5 |
| 28 | POST | `/financial/payment-methods/:id/set-default` | 8.6 |
| 29 | GET | `/financial/suppliers` | 9.1 |
| 30 | POST | `/financial/suppliers` | 9.3 |
| 31 | GET | `/financial/suppliers/map` | 9.6 |
| 32 | GET | `/financial/suppliers/:id` | 9.2 |
| 33 | PATCH | `/financial/suppliers/:id` | 9.4 |
| 34 | DELETE | `/financial/suppliers/:id` | 9.5 |
| 35 | GET | `/financial/suppliers/:id/statistics` | 9.7 |
| 36 | GET | `/financial/supplier-categories` | 10.1 |
| 37 | POST | `/financial/supplier-categories` | 10.2 |
| 38 | PATCH | `/financial/supplier-categories/:id` | 10.3 |
| 39 | DELETE | `/financial/supplier-categories/:id` | 10.4 |
| 40 | GET | `/financial/suppliers/:supplierId/products` | 11.1 |
| 41 | POST | `/financial/suppliers/:supplierId/products` | 11.2 |
| 42 | PATCH | `/financial/suppliers/:supplierId/products/:productId` | 11.3 |
| 43 | DELETE | `/financial/suppliers/:supplierId/products/:productId` | 11.4 |
| 44 | GET | `/financial/suppliers/:supplierId/products/:productId/price-history` | 11.5 |
| 45 | GET | `/financial/recurring-rules` | 12.1 |
| 46 | POST | `/financial/recurring-rules` | 12.2 |
| 47 | GET | `/financial/recurring-rules/preview` | 12.11 |
| 48 | GET | `/financial/recurring-rules/:id` | 12.3 |
| 49 | PATCH | `/financial/recurring-rules/:id` | 12.4 |
| 50 | DELETE | `/financial/recurring-rules/:id` | 12.5 |
| 51 | POST | `/financial/recurring-rules/:id/pause` | 12.6 |
| 52 | POST | `/financial/recurring-rules/:id/resume` | 12.7 |
| 53 | POST | `/financial/recurring-rules/:id/trigger` | 12.8 |
| 54 | POST | `/financial/recurring-rules/:id/skip` | 12.9 |
| 55 | GET | `/financial/recurring-rules/:id/history` | 12.10 |
| 56 | GET | `/projects/:projectId/milestones` | 13.1 |
| 57 | POST | `/projects/:projectId/milestones` | 13.2 |
| 58 | PATCH | `/projects/:projectId/milestones/:id` | 13.3 |
| 59 | DELETE | `/projects/:projectId/milestones/:id` | 13.4 |
| 60 | POST | `/projects/:projectId/milestones/:id/invoice` | 13.5 |
| 61 | GET | `/projects/:projectId/invoices` | 14.1 |
| 62 | POST | `/projects/:projectId/invoices` | 14.2 |
| 63 | GET | `/projects/:projectId/invoices/:id` | 14.3 |
| 64 | PATCH | `/projects/:projectId/invoices/:id` | 14.4 |
| 65 | POST | `/projects/:projectId/invoices/:id/send` | 14.5 |
| 66 | POST | `/projects/:projectId/invoices/:id/void` | 14.6 |
| 67 | POST | `/projects/:projectId/invoices/:id/payments` | 14.7 |
| 68 | GET | `/projects/:projectId/invoices/:id/payments` | 14.8 |
| 69 | GET | `/projects/:projectId/financial/summary` | 15.1 |
| 70 | GET | `/projects/:projectId/financial/tasks` | 15.2 |
| 71 | GET | `/projects/:projectId/financial/timeline` | 15.3 |
| 72 | GET | `/projects/:projectId/financial/receipts` | 15.4 |
| 73 | GET | `/projects/:projectId/financial/workforce` | 15.5 |
| 74 | POST | `/projects/:projectId/tasks/:taskId/costs` | 16.1 |
| 75 | GET | `/projects/:projectId/tasks/:taskId/costs` | 16.2 |
| 76 | POST | `/projects/:projectId/tasks/:taskId/receipts` | 16.3 |
| 77 | GET | `/projects/:projectId/tasks/:taskId/receipts` | 16.4 |
| 78 | GET | `/projects/:projectId/tasks/:taskId/invoices` | 16.5 |
| 79 | POST | `/financial/crew-hours` | 17.1 |
| 80 | GET | `/financial/crew-hours` | 17.2 |
| 81 | PATCH | `/financial/crew-hours/:id` | 17.3 |
| 82 | POST | `/financial/crew-payments` | 18.1 |
| 83 | GET | `/financial/crew-payments` | 18.2 |
| 84 | GET | `/crew/:crewMemberId/payment-history` | 18.3 |
| 85 | POST | `/financial/subcontractor-invoices` | 19.1 |
| 86 | GET | `/financial/subcontractor-invoices` | 19.2 |
| 87 | PATCH | `/financial/subcontractor-invoices/:id` | 19.3 |
| 88 | GET | `/subcontractors/:id/invoices` | 19.4 |
| 89 | POST | `/financial/subcontractor-payments` | 20.1 |
| 90 | GET | `/financial/subcontractor-payments` | 20.2 |
| 91 | GET | `/subcontractors/:subcontractorId/payment-history` | 20.3 |
| 92 | GET | `/subcontractors/:id/payment-summary` | 20.4 |
| 93 | GET | `/financial/dashboard/overview` | 21.1 |
| 94 | GET | `/financial/dashboard/pl` | 21.2 |
| 95 | GET | `/financial/dashboard/pl/export` | 21.3 |
| 96 | GET | `/financial/dashboard/ar` | 21.4 |
| 97 | GET | `/financial/dashboard/ap` | 21.5 |
| 98 | GET | `/financial/dashboard/forecast` | 21.6 |
| 99 | GET | `/financial/dashboard/alerts` | 21.7 |
| 100 | GET | `/financial/export/account-mappings` | 22.1 |
| 101 | GET | `/financial/export/account-mappings/defaults` | 22.2 |
| 102 | POST | `/financial/export/account-mappings` | 22.3 |
| 103 | DELETE | `/financial/export/account-mappings/:id` | 22.4 |
| 104 | GET | `/financial/export/quickbooks/expenses` | 23.1 |
| 105 | GET | `/financial/export/quickbooks/invoices` | 23.2 |
| 106 | GET | `/financial/export/xero/expenses` | 23.3 |
| 107 | GET | `/financial/export/xero/invoices` | 23.4 |
| 108 | GET | `/financial/export/quality-report` | 23.5 |
| 109 | GET | `/financial/export/history` | 23.6 |

---

*Documentation generated from live API testing on 2026-03-25. All responses verified against running server on port 8000.*
